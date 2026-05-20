# Smart Farm Monitor — System Guide

> ไฟล์นี้ใช้สำหรับ Claude และเจ้าของโปรเจ็คอ่านเพื่อเข้าใจระบบทั้งหมด
> **อัปเดตทุกครั้งที่มีการเพิ่ม/แก้ไขฟีเจอร์**

---

## ภาพรวม (Overview)

**Smart Farm Monitor** คือ Web UI Dashboard สำหรับระบบฟาร์มอัจฉริยะแบบ IoT
รองรับทั้งโหมด **Mock Data** (จำลองข้อมูล) และเชื่อมต่อ **Hardware จริง** (ESP32)
เหมาะสำหรับ Prototype / Demo / Production

---

## สถาปัตยกรรมระบบ (System Architecture)

```
[Sensors]          [ESP32]        [Network]          [Cloud/Output]
 Soil Zone 1  ──SDI-12──►
 Soil Zone 2  ──SDI-12──►
 DHT22        ──1-Wire──►  ESP32  ──WiFi──► Router ──TCP──► MQTT Broker
 DS18B20      ──I2C────►   │              ──────────────────►  ThingsBoard ──WS──► Browser
                            │                                             ──HTTPS──► LINE Notify
                            └──GPIO──► Relay ──12VDC──► Valve 1-4        ──REST──►  Weather API
                                                                          ──RPC──►  ESP32 (cmd)
```

### เซนเซอร์ (Sensors)
| เซนเซอร์   | โปรโตคอล | วัดค่า                  | ID ใน Code |
|-----------|----------|------------------------|------------|
| Capacitive | SDI-12  | ความชื้นดิน Zone 1 (%)  | `soil1`    |
| Capacitive | SDI-12  | ความชื้นดิน Zone 2 (%)  | `soil2`    |
| DHT22      | 1-Wire  | อุณหภูมิ + ความชื้นอากาศ | `temp`, `humid` |
| DS18B20    | I2C     | อุณหภูมิดิน (°C)        | `stemp`    |

### วาล์ว (Actuators)
| วาล์ว | Zone           | โหมด               |
|------|----------------|-------------------|
| 1    | แปลงผัก A       | Auto + Manual + Timer + Scheduler |
| 2    | แปลงผัก B       | Auto + Manual + Timer + Scheduler |
| 3    | ต้นไม้รอบรั้ว    | Manual + Timer + Scheduler       |
| 4    | สนามหญ้า        | Manual + Timer + Scheduler       |

---

## ฟีเจอร์ทั้งหมด (Features)

### Dashboard หลัก
- **Sensor Cards**: Real-time + Sparkline + Progress bar + Status badge (10 sensors)
- **Valve Control**: Toggle Manual/Auto + Reset to Auto + Countdown Timer
- **Charts**: กราฟย้อนหลัง 30m/1h/2h (Chart.js) + Export CSV
- **Threshold Settings**: ปรับ soilDry / soilWet / tempHigh ผ่าน Slider
- **Alert Log**: บันทึกแจ้งเตือน + ลบทั้งหมด
- **Theme Toggle**: Dark / Light mode
- **Weather Widget**: สภาพอากาศ (Mock หรือ OpenWeatherMap API)
- **PWA**: ติดตั้งเป็น App + Offline cache
- **Layout Panel**: ซ่อน/แสดง Section ได้ (📐 Layout ใน header)

### 🌱 Growth Analysis
- คำนวณ Growth Score (0–100) จาก 5 ปัจจัย: soil, temp, humid, light, stemp
- **Crop Profile System**: เลือกพืชต่อ Zone — 8 ชนิด (ผักทั่วไป, มะเขือเทศ, กะเพรา, พริก, ผักกาดหอม, ข้าว, สนามหญ้า, ต้นไม้)
- Farm Health Summary Bar + per-zone badge
- คำแนะนำการดูแลพืชอัตโนมัติ
- Growth Trend Chart (Zone 1 & 2)
- **Sensor Simulator**: ปรับ 6 slider แบบ Real-time → Preview mode / Override mode

### 🔮 Predictive Alerts
- Linear Regression บน `state.history` (ช่วง 3 วินาที/จุด)
- ทำนายเวลาที่ดิน Z1/Z2 จะแห้งถึง threshold และอุณหภูมิจะสูงเกิน

### 📅 Irrigation Scheduler
- ตารางรดน้ำรายสัปดาห์ — กำหนดวัน, เวลา, ระยะเวลา, เงื่อนไข
- เงื่อนไข: `always` / `if_dry` (ดินแห้ง) / `no_rain` (ไม่มีฝน)
- เช็คทุก 60 วินาที — เปิดวาล์ว + startValveTimerProgrammatic() อัตโนมัติ

### 🔔 LINE Notify + Webhook
- ส่งแจ้งเตือนอัตโนมัติเมื่อมี `warn`/`alert` ผ่าน `alerts.js`
- รองรับ LINE Notify Token + Custom Webhook URL (POST JSON)
- CORS limitation → ใช้ `mode: 'no-cors'` (fire-and-forget)
- บันทึก Log การส่งใน UI

### 📷 Camera Widget
- รองรับ MJPEG Stream, Snapshot (auto-refresh ทุก N วินาที), RTSP URL
- จัดการหลายกล้อง — ใช้ `_camTimers` dict ป้องกัน interval leak

### 📱 Multi-Device Management
- เพิ่ม ESP32 หลายเครื่อง — สลับ Dashboard ด้วย `activateDevice(id)` → `connectToDevice()`
- บันทึกใน localStorage `sf_devices`, `sf_active_device`

### 💾 IndexedDB Persistence
- บันทึกค่าเซนเซอร์ทุก **30 วินาที** (throttled ใน `dbWriteSensors()`)
- เก็บประวัติย้อนหลัง **7 วัน** — cleanup อัตโนมัติ
- `dbReadHistory(hours)` → Promise\<Array\>

### flow.html — Node Flow
- Canvas-based diagram + Particle animation
- Hover/Click → Detail Panel
- Sync จาก localStorage `sf_sensors` เมื่ออายุ < 10 วินาที

---

## LocalStorage Keys

| Key | เนื้อหา | ใช้โดย |
|-----|---------|--------|
| `sf_valveCounts`   | `[n,n,n,n]` จำนวนครั้งรดน้ำ | index.html |
| `sf_valveLastTime` | `["HH:MM",...]` เวลาเปิดล่าสุด | index.html |
| `sf_thresholds`    | `{soilDry, soilWet, tempHigh}` | index.html |
| `sf_theme`         | `"light"` หรือ `"dark"` | index.html |
| `sf_sensors`       | sensor snapshot + ts | flow.html อ่าน |
| `sf_plugins`       | Custom sensor plugins `[{…}]` | index.html |
| `sf_conn_mode`     | `"sim"/"ws"/"rest"` | connection.js |
| `sf_conn_url`      | URL ของ WS/REST | connection.js |
| `sf_crops`         | `["vegetable","tomato",…]` ต่อ Zone | crops.js |
| `sf_schedules`     | `[{label,zone,time,days,…}]` | scheduler.js |
| `sf_notify`        | `{lineToken, webhookUrl, enabled}` | notify.js |
| `sf_cameras`       | `[{name,url,type,interval}]` | camera.js |
| `sf_devices`       | `[{id,name,url,mode}]` | devices.js |
| `sf_active_device` | device id ที่กำลังใช้ | devices.js |
| `sf_sections`      | `{key: true/false}` visibility state | app.js |

---

## Logic สำคัญ

### Auto-irrigation
```
ทุก 3 วินาที → simulate() → autoIrrigateAuto(zone, soilPct)
  ถ้า soilPct < thresholds.soilDry  AND วาล์วปิด AND ไม่ได้ Manual → เปิดวาล์ว
  ถ้า soilPct > thresholds.soilWet  AND วาล์วเปิด AND ไม่ได้ Manual → ปิดวาล์ว
```

### Manual Override + Timer
```
manualValve(idx, on) → state.valveManual[idx] = true → Auto skip zone นั้น
resetToAuto(idx)     → state.valveManual[idx] = false + cancelValveTimer(idx)
startValveTimer(idx) → อ่านจาก input HTML
startValveTimerProgrammatic(idx, minutes) → เรียกจาก Scheduler โดยตรง
```

### Growth Score Calculation
```
calcGrowthScore(soil, temp, humid, light, stemp, hasSoil, opts)
  opts = getZoneOpt(zoneIdx) จาก crops.js — คืน optimal ranges ของพืชที่เลือก
  ถ้าไม่ส่ง opts → ใช้ GROWTH_OPT (ผักทั่วไป default)
  weights: soil(35%) temp(20%) humid(20%) light(15%) stemp(10%)
```

### Irrigation Scheduler Flow
```
initScheduler() → setInterval(_checkSchedules, 60000)
_checkSchedules() → ตรวจ day + time + condition ทุกนาที
  → setValveState(zone, true) + startValveTimerProgrammatic(zone, duration)
```

### External Notify Flow
```
addAlert(type, msg)
  → ถ้า type === 'warn' || 'alert' → sendExternalNotify(msg)
    → sendLineNotify(msg) [no-cors]
    → sendWebhook(msg)    [no-cors]
```

### Flow Sync
```
index.html → saveState() → localStorage['sf_sensors'] = {…, ts}
flow.html  → syncFromDashboard() ทุก simTick
           → ts อายุ < 10s → "🔗 Synced" | > 10s → "⚠ Stale"
```

---

## โครงสร้างไฟล์ (ฉบับปัจจุบัน v1.7.0)

```
smart-farm-ui/
├── index.html          — Dashboard หลัก
├── flow.html           — Node Flow Diagram
├── guide.html          — คู่มือ
├── manifest.json       — PWA Manifest
├── sw.js               — Service Worker (cache: smartfarm-v1.7)
├── README.md           — คำอธิบายโปรเจ็ค (GitHub)
├── CLAUDE.md           — ไฟล์นี้
├── icons/
│   └── icon.svg
├── esp32/
│   └── SmartFarmESP32.ino
├── css/
│   ├── dashboard.css   — styles Dashboard + Plugin Modal + Growth + v1.7 features
│   ├── flow.css        — styles Flow page
│   └── guide.css       — styles Guide page
└── js/
    ├── state.js        — thresholds + state + MAX_HISTORY(2400) + saveState/loadState
    ├── alerts.js       — addAlert, addAlertThrottle, clearAlerts (→ sendExternalNotify)
    ├── charts.js       — initCharts, renderCharts, setChartRange, exportCSV, makeSparkline
    ├── valves.js       — setValveState, manualValve, resetToAuto, updateValveUI
    ├── sensors.js      — simulate, autoIrrigateAuto, updateUI (→ growth, prediction, db)
    ├── notifications.js — toggleNotifications, sendNotification (Web Push API)
    ├── timer.js        — startValveTimer, startValveTimerProgrammatic, cancelValveTimer
    ├── weather.js      — fetchWeather, renderWeather, setWeatherApiKey
    ├── plugins.js      — initPlugins, openPluginModal, confirmAddPlugin, simulatePlugins
    ├── connection.js   — initConnection, connectToDevice (public), sendValveCommand
    ├── crops.js        — CROP_PROFILES(8), getZoneOpt(zi), setZoneCrop(zi, key)
    ├── growth.js       — initGrowth, updateGrowthAnalysis, calcGrowthScore(…, opts)
    ├── db.js           — initDB, dbWriteSensors (30s throttle), dbReadHistory(hours)
    ├── prediction.js   — updatePredictions (linear regression → pred-list)
    ├── scheduler.js    — initScheduler, _checkSchedules (60s interval), renderSchedules
    ├── notify.js       — sendExternalNotify, sendLineNotify, sendWebhook, initNotify
    ├── camera.js       — initCamera, renderCameras, _camTimers (snapshot cleanup)
    ├── devices.js      — initDevices, activateDevice, renderDevices
    └── app.js          — Section visibility vars/fns + boot IIFE (calls all init*)
```

### ลำดับ `<script>` ใน index.html (สำคัญ — ห้ามสลับ)
```
state → alerts → charts → valves → sensors → notifications → timer → weather
→ plugins → connection → crops → growth → db → prediction → scheduler
→ notify → camera → devices → app
```
**กฎ:** crops ต้องมาก่อน growth (growth ใช้ `getZoneOpt`); notify ต้องมาก่อน app (app boot เรียก initNotify); const `_SECTIONS`/`_sectionVis` ประกาศใน app.js ก่อน IIFE เพื่อหลีกเลี่ยง TDZ

### เมื่อต้องการแก้ไขอะไร → เปิดไฟล์ไหน
| ต้องการแก้ | เปิดไฟล์ |
|-----------|---------|
| สีหรือ layout | `css/dashboard.css` |
| threshold default | `js/state.js` |
| เพิ่ม sensor built-in | `js/sensors.js` (simulate + updateUI) |
| เพิ่ม sensor plugin ผ่าน UI | กด "＋ เพิ่ม Sensor" ใน zone card |
| เพิ่มประเภท plugin ใหม่ | `js/plugins.js` → `PLUGIN_TYPES` |
| เปลี่ยน logic รดน้ำ | `js/valves.js` + `js/sensors.js` |
| เพิ่มโปรไฟล์พืชใหม่ | `js/crops.js` → `CROP_PROFILES` |
| เปลี่ยน optimal range พืช | `js/crops.js` → `CROP_PROFILES[key]` |
| แก้ Growth Score weight | `js/growth.js` → `GROWTH_W` |
| เพิ่ม alert rule | `js/alerts.js` หรือ `js/sensors.js` |
| เปลี่ยน chart config | `js/charts.js` |
| ปรับ scheduler logic | `js/scheduler.js` → `_checkSchedules` |
| เปลี่ยน LINE Notify / Webhook | `js/notify.js` |
| เพิ่มประเภทกล้อง | `js/camera.js` |
| เชื่อม Hardware จริง | Dashboard → "การเชื่อมต่ออุปกรณ์" เลือก WS/REST |
| ปรับ firmware ESP32 | `esp32/SmartFarmESP32.ino` |
| Flow diagram | `js/flow.js` (NODE_DEFS, EDGE_DEFS) |
| ซ่อน/แสดง section ใหม่ | `js/app.js` → `_SECTIONS` array |

---

## การรันโปรเจ็ค

ไม่ต้องติดตั้งอะไร — เปิด Browser แล้วลากไฟล์ `index.html` ได้เลย

```bash
npx serve .
# หรือ
python3 -m http.server 8080
```

---

## การเชื่อมต่อ Hardware จริง

เปิด Dashboard → **"การเชื่อมต่ออุปกรณ์"** → เลือกโหมด WebSocket หรือ REST API

ESP32 ต้องส่ง JSON format:
```json
{
  "soil1":55.2, "soil2":61.8, "temp":29.4, "humid":65.1, "stemp":26.3,
  "light":25000, "pressure":1013, "rain":5, "waterLevel":80, "flow":0,
  "valve1":false, "valve2":false, "valve3":false, "valve4":false,
  "rssi":-62, "voltage":5.0
}
```

Browser จะส่งคำสั่งกลับ:
```json
{ "cmd": "valve",      "valve": 1, "state": true  }
{ "cmd": "auto",       "valve": 1                  }
{ "cmd": "thresholds", "soilDry": 30, "soilWet": 70 }
```

---

## Security Notes

- `addAlert()` ใช้ `textContent` ป้องกัน XSS
- card values ใช้ `innerHTML` แต่มาจาก `Number.toFixed()` เท่านั้น (controlled)
- `openPanel()` ใน flow.js ใช้ DOM API ไม่ใช่ `innerHTML`
- LINE Notify Token เก็บใน localStorage — ไม่ส่งไปยัง server ของเรา
- เมื่อต่อ Backend จริง ต้อง validate/sanitize ค่าก่อนอัปเดต state

---

## Changelog

### v1.7.1 — 2026-05-20 (ปัจจุบัน) — Hardware Bug Fixes

| # | บัค | ไฟล์ | รายละเอียด |
|---|-----|------|-----------|
| 1 | **Timer ไม่ส่งคำสั่งเปิดวาล์วไป ESP32** | `js/timer.js` | `startValveTimer()` เรียก `setValveState()` แต่ไม่เรียก `sendValveCommand()` → เพิ่ม call หลัง setValveState |
| 2 | **Timer หมดเวลาแต่ relay ไม่ปิด** | `js/timer.js` | `tickAllTimers()` ปิดวาล์วใน UI แต่ไม่ส่ง `sendValveCommand(i, false)` → relay ยังเปิดอยู่ (น้ำไหลไม่หยุด!) |
| 3 | **valveManual ไม่ reset สำหรับ valve 3&4** | `js/timer.js` | `tickAllTimers()` มี `if (i < 2)` guard — valve 3&4 mode ยังค้างเป็น Manual หลัง timer หมด |
| 4 | **Scheduler ไม่ส่งคำสั่งวาล์วไป ESP32** | `js/scheduler.js` | `_checkSchedules()` เรียก `setValveState()` แต่ไม่เรียก `sendValveCommand()` → ตารางรดน้ำทำงานใน UI เท่านั้น |
| 5 | **WebSocket ไม่มี auto-reconnect** | `js/connection.js` | WiFi ขาดครั้งเดียว → badge แสดง error ถาวร ต้อง reload หน้า — เพิ่ม exponential backoff (3s→6s→12s สูงสุด 30s) |

### v1.7.0 — 2026-05-20 — 8 New Features

| # | ฟีเจอร์ | ไฟล์ | รายละเอียด |
|---|--------|------|-----------|
| 1 | **Crop Profile System** | `js/crops.js` | 8 โปรไฟล์พืช — เลือกต่อ Zone — `getZoneOpt(zi)` คืน optimal ranges ให้ growth.js |
| 2 | **IndexedDB Persistence** | `js/db.js` | บันทึกทุก 30s เก็บ 7 วัน — `dbWriteSensors()`, `dbReadHistory(hours)` |
| 3 | **Predictive Alerts** | `js/prediction.js` | Linear regression บน history — ทำนายเวลาที่ดินจะแห้ง/อุณหภูมิจะสูง |
| 4 | **Irrigation Scheduler** | `js/scheduler.js` | ตารางรายสัปดาห์ + เงื่อนไข 3 แบบ — เช็คทุก 60s — `startValveTimerProgrammatic` |
| 5 | **LINE Notify + Webhook** | `js/notify.js` | fire-and-forget no-cors — เรียกอัตโนมัติจาก `alerts.js` ทุก warn/alert |
| 6 | **Camera Widget** | `js/camera.js` | MJPEG/Snapshot/RTSP — `_camTimers` dict ป้องกัน interval leak |
| 7 | **Multi-Device** | `js/devices.js` | หลาย ESP32 — `activateDevice()` → `connectToDevice()` (public wrapper ใน connection.js) |
| 8 | **Section Visibility** | `js/app.js` | 📐 Layout panel ใน header — toggle 11 sections — บันทึกใน `sf_sections` |
| + | **Crop selector ใน Growth Cards** | `index.html` | `<select>` ใน header แต่ละ card — เรียก `setZoneCrop(zi, key)` |
| + | **calcGrowthScore opts param** | `js/growth.js` | รับ `opts` (crop profile) เป็น param ที่ 7 — fallback เป็น `GROWTH_OPT` |
| + | **startValveTimerProgrammatic** | `js/timer.js` | เริ่ม timer โดยไม่ต้องอ่าน HTML input — สำหรับ Scheduler |
| + | **connectToDevice public wrapper** | `js/connection.js` | `function connectToDevice(mode, url)` เพื่อให้ devices.js เรียกได้ |

### v1.6.0 — 2026-05-18 — Enhanced Growth UI + Sensor Simulator

| # | ฟีเจอร์ | ไฟล์ | รายละเอียด |
|---|--------|------|-----------|
| 1 | **Farm Health Summary Bar** | `js/growth.js`, `index.html` | Progress bar รวม + per-zone badge ด้านบน Growth Grid |
| 2 | **Sensor Simulator Panel** | `js/growth.js`, `index.html` | 6 slider ปรับค่าเซนเซอร์ — Preview mode (ดู score) / Override mode (ควบคุม Cards) |
| 3 | **Mini Ring Preview Cards** | `index.html` | SVG ring r=22 ด้านขวาของ Simulator แสดง score ต่อ Zone |
| 4 | **Optimal Range Slider BG** | `js/growth.js` | แถบสีเขียวบน slider แสดงช่วงค่าที่เหมาะสม |

### v1.5.0 — 2026-05-17 — Plant Growth Analysis + Bug Fixes

| # | ฟีเจอร์/แก้ไข | ไฟล์ | รายละเอียด |
|---|--------------|------|-----------|
| 1 | **Growth Analysis System** | `js/growth.js` (ใหม่) | Growth Score + SVG ring + factor bars + คำแนะนำ + trend chart |
| 2 | **Bug: Timer ไม่ reset valveManual** | `js/timer.js` | เมื่อ timer หมด zone 0&1 → `state.valveManual[i] = false` |
| 3 | **Bug: resetToAuto ไม่ยกเลิก Timer** | `js/valves.js` | เพิ่ม `cancelValveTimer(idx)` ใน `resetToAuto()` |

### v1.4.0 — 2026-05-17 — Real Hardware + Sensor Plugin System

| # | ฟีเจอร์ | ไฟล์ | รายละเอียด |
|---|--------|------|-----------|
| 1 | **Sensor Plugin System** | `js/plugins.js` | เพิ่ม Sensor ใหม่ผ่าน UI — dataKey, ประเภท, unit, min/max — Sparkline + badge |
| 2 | **Valve Command to ESP32** | `js/connection.js` | `sendValveCommand(idx, on)` ผ่าน WS หรือ REST |
| 3 | **รับ valve/RSSI/voltage จาก ESP32** | `js/connection.js` | `applyHardwareData()` sync state จาก ESP32 |
| 4 | **Arduino Firmware Template** | `esp32/SmartFarmESP32.ino` | WebSocket port 81 + REST GET/POST + CORS |

### v1.3.0 — 2026-05-15 — Timer, Charts, PWA, Notifications

| # | ฟีเจอร์ | ไฟล์ |
|---|--------|------|
| 1 | Valve Timer (0.5–120 นาที) | `js/timer.js` |
| 2 | Chart Time Range 30m/1h/2h | `js/charts.js` |
| 3 | CSV Export | `js/charts.js` |
| 4 | Browser Push Notifications | `js/notifications.js` |
| 5 | Weather Widget | `js/weather.js` |
| 6 | PWA Support | `manifest.json`, `sw.js` |
| 7 | MAX_HISTORY = 2400 (2h) | `js/state.js` |

### v1.2.0 — 2026-05-14 — Module Separation
แยก JS เป็น 6 ไฟล์, แยก CSS เป็น 2 ไฟล์, แยก flow.js

### v1.1.0 — 2026-05-14 — UX & Bug Fixes
XSS fix, Reset to Auto, LocalStorage, Threshold slider, Dark/Light theme, Mobile responsive

### v1.0.0 — 2026-05-14 — Initial
Dashboard 2 หน้า, Mock simulation, Auto-irrigation, Sparkline, Particle animation

---

## Stack & Dependencies

| รายการ | ใช้สำหรับ |
|--------|----------|
| HTML5 / CSS3 / Vanilla JS | ทั้งโปรเจ็ค |
| Chart.js (CDN) | กราฟ Dashboard + Growth trend |
| HTML5 Canvas API | Node Flow diagram |
| IndexedDB API | บันทึก 7 วัน |
| LocalStorage API | Settings + state persistence + page sync |
| Service Worker | PWA offline cache |
| LINE Notify API | Push notification ภายนอก |

ไม่มี build step — ไม่มี npm — ไม่มี framework — เปิด HTML ในเบราว์เซอร์ได้เลย
