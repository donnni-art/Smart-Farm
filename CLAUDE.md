# Smart Farm Monitor — System Guide

> ไฟล์นี้ใช้สำหรับ Claude และเจ้าของโปรเจ็คอ่านเพื่อเข้าใจระบบทั้งหมด

---

## ภาพรวม (Overview)

**Smart Farm Monitor** คือ Web UI Dashboard สำหรับระบบฟาร์มอัจฉริยะแบบ IoT
ปัจจุบันทำงานในโหมด **Mock Data** (จำลองข้อมูล) — ไม่ต้องต่อ Hardware จริง
เหมาะสำหรับ Prototype / Demo / Presentation

---

## โครงสร้างไฟล์ (File Structure)

```
smart-farm-ui/
├── index.html   — Dashboard หลัก (เซนเซอร์ + วาล์ว + กราฟ + การแจ้งเตือน)
├── flow.html    — Node Flow Diagram (แสดง Architecture การไหลของข้อมูล)
└── CLAUDE.md    — ไฟล์นี้ (คู่มือระบบ)
```

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
| DHT22      | 1-Wire  | อุณหภูมิ + ความชื้นอากาศ | `dht22`    |
| DS18B20    | I2C     | อุณหภูมิดิน (°C)        | `ds18b20`  |

### วาล์ว (Actuators)
| วาล์ว | Zone           | โหมด    |
|------|----------------|---------|
| 1    | แปลงผัก A       | Auto + Manual |
| 2    | แปลงผัก B       | Auto + Manual |
| 3    | ต้นไม้รอบรั้ว    | Manual only   |
| 4    | สนามหญ้า        | Manual only   |

วาล์ว 1 และ 2 มีระบบ **Auto-irrigation**: เปิดเมื่อความชื้นดินต่ำกว่า threshold และปิดเมื่อสูงกว่า threshold

---

## ฟีเจอร์ (Features)

### index.html — Dashboard
- **Sensor Cards**: ค่า Real-time + Sparkline + Progress bar + Status badge
- **Valve Control**: Toggle สวิตช์ Manual / Auto พร้อมประวัติการรดน้ำ
- **Reset to Auto**: ปุ่ม "↺ คืนค่า Auto" บนวาล์ว 1 & 2 เพื่อออกจาก Manual mode
- **Charts**: กราฟย้อนหลัง 30 นาที (Chart.js) — ความชื้นดิน, อุณหภูมิ, ความชื้นอากาศ
- **Threshold Settings**: ปรับค่า % เปิด/ปิดวาล์วและ °C แจ้งเตือนได้เอง (บันทึกใน localStorage)
- **Alert Log**: บันทึกการแจ้งเตือน พร้อมปุ่มลบทั้งหมด
- **Theme Toggle**: สลับ Dark / Light mode (บันทึกใน localStorage)
- **Shared State**: บันทึก sensor snapshot ลง localStorage ทุก 3 วินาที เพื่อให้ flow.html อ่านได้

### flow.html — Node Flow
- **Canvas-based Diagram**: วาดด้วย HTML5 Canvas API (ไม่พึ่ง Library)
- **Particle Animation**: แสดงการไหลของ Data packet บน edge
- **Node Interaction**: Hover glow + Click เพื่อเปิด Detail Panel
- **Detail Panel**: แสดง metric ของแต่ละ node (status, packets, latency ฯลฯ)
- **Stats Bar**: สรุปภาพรวม (packets/min, latency, nodes online, active valves)
- **Dashboard Sync**: อ่าน sensor values จาก localStorage ของ Dashboard เมื่อ fresh < 10 วินาที

---

## LocalStorage Keys

| Key | เนื้อหา | ใช้โดย |
|-----|---------|--------|
| `sf_valveCounts`   | จำนวนครั้งรดน้ำแต่ละวาล์ว `[n,n,n,n]` | index.html |
| `sf_valveLastTime` | เวลาเปิดล่าสุดแต่ละวาล์ว `["HH:MM",...]` | index.html |
| `sf_thresholds`    | `{soilDry, soilWet, tempHigh}` | index.html |
| `sf_theme`         | `"light"` หรือ `"dark"` | index.html |
| `sf_sensors`       | `{soil1, soil2, temp, humid, stemp, ts}` | flow.html อ่าน |

---

## Logic สำคัญ

### Auto-irrigation (index.html)
```
ทุก 3 วินาที → simulate() → autoIrrigateAuto(zone, soilPct)
  ถ้า soilPct < thresholds.soilDry  AND วาล์วปิด AND ไม่ได้ Manual → เปิดวาล์ว
  ถ้า soilPct > thresholds.soilWet  AND วาล์วเปิด AND ไม่ได้ Manual → ปิดวาล์ว
```

### Manual Override
```
ผู้ใช้กด toggle → manualValve(idx, on) → state.valveManual[idx] = true
  → Auto-irrigation จะ skip zone นั้น
  → ปุ่ม "↺ คืนค่า Auto" จะ enable

ผู้ใช้กด Reset → resetToAuto(idx) → state.valveManual[idx] = false
  → Auto-irrigation กลับมาทำงาน
```

### Flow Sync
```
index.html → saveState() → localStorage['sf_sensors'] = {soil1, soil2, temp, humid, stemp, ts}
flow.html  → syncFromDashboard() ทุก simTick → อ่าน sf_sensors
           → ถ้า ts อายุ < 10 วินาที → ใช้ค่านั้น (badge: "🔗 Synced")
           → ถ้าเก่ากว่า 10 วินาที   → สุ่มเองและแสดง "⚠ Stale"
```

---

## การรันโปรเจ็ค (How to Run)

ไม่ต้องติดตั้งอะไร — เปิด Browser แล้วลากไฟล์ `index.html` ลงไปได้เลย
หรือใช้ Live Server extension ใน VS Code

```bash
# ถ้าต้องการ local server
npx serve .
# หรือ
python3 -m http.server 8080
```

---

## การเชื่อมต่อ Hardware จริง (Future: Real Hardware)

ปัจจุบันทุกอย่างเป็น Mock Data ทดแทนด้วยการสุ่มใน `simulate()` (index.html:~L220)
เมื่อต้องการต่อจริงให้แทนที่ `simulate()` ด้วยหนึ่งในวิธีดังต่อไปนี้:

### วิธีที่ 1 — WebSocket (แนะนำ)
```javascript
// แทนที่ setInterval simulate ด้วย:
const ws = new WebSocket('ws://esp32.local/ws');
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  state.soil1 = data.soil1;
  state.soil2 = data.soil2;
  state.temp  = data.temp;
  state.humid = data.humid;
  state.stemp = data.stemp;
  updateUI();
};
```

### วิธีที่ 2 — MQTT.js (ผ่าน Broker)
```javascript
const client = mqtt.connect('ws://broker-host:9001');
client.subscribe('farm/sensors');
client.on('message', (topic, message) => {
  const data = JSON.parse(message.toString());
  // ... อัปเดต state เหมือนด้านบน
});
```

### วิธีที่ 3 — REST API Polling
```javascript
setInterval(async () => {
  const data = await fetch('http://esp32.local/sensors').then(r => r.json());
  state.soil1 = data.soil1;
  // ...
  updateUI();
}, 3000);
```

### ESP32 Arduino Code (โครงสร้าง)
```cpp
// ฝั่ง ESP32 ต้องส่ง JSON format นี้:
// {"soil1":55.2,"soil2":61.8,"temp":29.4,"humid":65.1,"stemp":26.3,
//  "valve1":false,"valve2":false,"valve3":false,"valve4":false}
```

---

## Security Notes

- `addAlert()` ใช้ `textContent` (ไม่ใช่ `innerHTML`) เพื่อป้องกัน XSS
- card values (`soil1-val`, `temp-val` ฯลฯ) ยังใช้ `innerHTML` แต่ค่าทั้งหมดมาจาก `Number.toFixed()` ซึ่งเป็น controlled content ไม่ใช่ user input
- เมื่อต่อ Backend จริง ให้ validate / sanitize ค่าที่รับมาก่อนอัปเดต state

---

## โครงสร้างไฟล์ (ฉบับปัจจุบัน หลังแยก module)

```
smart-farm-ui/
├── index.html          — HTML structure เท่านั้น
├── flow.html           — HTML structure เท่านั้น
├── manifest.json       — PWA Manifest
├── sw.js               — Service Worker (offline cache)
├── CLAUDE.md           — ไฟล์นี้
├── icons/
│   └── icon.svg        — PWA icon
├── esp32/
│   └── SmartFarmESP32.ino  — Arduino firmware template (WebSocket + REST + 4 Relay)
├── css/
│   ├── dashboard.css   — styles ทั้งหมดของ Dashboard (รวม Plugin Modal)
│   └── flow.css        — styles ทั้งหมดของ Flow page
└── js/
    ├── state.js        — thresholds + state + MAX_HISTORY(2400) + saveState/loadState
    ├── alerts.js       — addAlert, addAlertThrottle, clearAlerts
    ├── charts.js       — initCharts, renderCharts, setChartRange, exportCSV, makeSparkline
    ├── valves.js       — setValveState, manualValve, resetToAuto, updateValveUI
    ├── sensors.js      — simulate, autoIrrigateAuto, updateUI, DOM helpers
    ├── notifications.js — toggleNotifications, sendNotification (Web Notifications API)
    ├── timer.js        — startValveTimer, tickAllTimers, updateTimerDisplay
    ├── weather.js      — fetchWeather, renderWeather, setWeatherApiKey
    ├── plugins.js      — initPlugins, openPluginModal, confirmAddPlugin, removePlugin
    ├── connection.js   — initConnection, sendValveCommand, applyHardwareData
    ├── app.js          — toggleTheme, toggleSettings, updateThreshold, clock, boot
    └── flow.js         — Node Flow diagram ทั้งหมด (standalone)
```

### ลำดับ `<script>` ใน index.html (สำคัญ)
```
state → alerts → charts → valves → sensors → notifications → timer → weather → plugins → connection → app
```
เหตุผล: `plugins.js` ต้องการ `makeSparkline` (charts) + `thresholds` (state); `connection.js` ต้องการ `updatePluginValues` (plugins) + `simulate`/`updateUI` (sensors)

### เมื่อต้องการแก้ไขอะไร → เปิดไฟล์ไหน
| ต้องการแก้ | เปิดไฟล์ |
|-----------|---------|
| สีหรือ layout | `css/dashboard.css` |
| threshold default | `js/state.js` |
| เพิ่ม sensor ใหม่ (built-in) | `js/sensors.js` (simulate + updateUI) |
| เพิ่ม sensor plugin ผ่าน UI | กด "＋ เพิ่ม Sensor" ใน zone card |
| เพิ่มประเภท plugin ใหม่ | `js/plugins.js` → `PLUGIN_TYPES` |
| เปลี่ยน logic รดน้ำ | `js/valves.js` + `js/sensors.js` (autoIrrigateAuto) |
| เปลี่ยน chart config | `js/charts.js` |
| เพิ่ม alert rule ใหม่ | `js/alerts.js` หรือ `js/sensors.js` |
| เชื่อม Hardware จริง | Dashboard → "การเชื่อมต่ออุปกรณ์" เลือก WS/REST |
| ปรับ firmware ESP32 | `esp32/SmartFarmESP32.ino` |
| Flow diagram | `js/flow.js` (NODE_DEFS, EDGE_DEFS) |

---

## Changelog

### v1.4.0 — 2026-05-17 (ปัจจุบัน) — Real Hardware + Sensor Plugin System

| # | ฟีเจอร์ | ไฟล์ | รายละเอียด |
|---|--------|------|-----------|
| 1 | **Sensor Plugin System** | `js/plugins.js` | เพิ่ม Sensor ใหม่ในแต่ละ Zone ผ่าน UI — กำหนด dataKey, ประเภท, unit, min/max — บันทึกใน localStorage `sf_plugins` — แสดงค่า, progress bar, sparkline, status badge เหมือน sensor built-in |
| 2 | **Valve Command to ESP32** | `js/connection.js`, `js/valves.js` | `sendValveCommand(idx, on)` ส่ง `{"cmd":"valve","valve":1,"state":true}` ผ่าน WebSocket หรือ REST POST /valve ทันทีที่กด toggle |
| 3 | **รับ valve/RSSI/voltage จาก ESP32** | `js/connection.js` | `applyHardwareData()` อัปเดต valve state, แสดง RSSI จริง, แสดง voltage จริง |
| 4 | **Last Telemetry timestamp จริง** | `js/connection.js`, `js/sensors.js` | Hardware mode แสดงเวลาจริง; Sim mode แสดง "เพิ่งส่ง" |
| 5 | **Arduino Firmware Template** | `esp32/SmartFarmESP32.ino` | ESP32 firmware ครบ: DHT22, DS18B20, Soil × 2, Relay × 4, WebSocket server (port 81), REST API GET /sensors + POST /valve, CORS headers |
| 6 | **Plugin Simulation** | `js/plugins.js`, `js/sensors.js` | Plugin sensor ที่เพิ่มจะถูกจำลองค่าในโหมด Simulation โดยอัตโนมัติ |

### v1.1.0 — 2026-05-14

| # | รายการแก้ไข | ไฟล์ | รายละเอียด |
|---|------------|------|-----------|
| 1 | **แก้ XSS ใน `addAlert()`** | index.html | เปลี่ยนจาก `innerHTML` เป็น `createElement` + `textContent` |
| 2 | **ปุ่ม "↺ คืนค่า Auto"** | index.html | วาล์ว 1 & 2 มีปุ่ม reset กลับ Auto mode หลังจาก Manual override |
| 3 | **LocalStorage persistence** | index.html | บันทึก valve counts, last times, thresholds ไม่หายหลัง refresh |
| 4 | **Threshold Settings Panel** | index.html | Slider ปรับค่า soilDry / soilWet / tempHigh ได้เอง |
| 5 | **Dark / Light theme toggle** | index.html | ปุ่ม "☀️ Light / 🌙 Dark" ใน header บันทึกค่าใน localStorage |
| 6 | **Mobile responsive** | index.html | Media queries สำหรับ 600px และ 400px (grid 1-2 column) |
| 7 | **Shared sensor state** | index.html | เขียน `sf_sensors` ลง localStorage ทุก 3 วินาที |
| 8 | **ปุ่มลบ Alert** | index.html | ปุ่ม "ลบทั้งหมด" ใน Alert Log |
| 9 | **แก้ตำแหน่ง valve nodes** | flow.html | `ry` เปลี่ยน 0.97→0.88 (valve), 0.82→0.74 (relay) ป้องกันถูกตัดขอบล่าง |
| 10 | **Dashboard Sync badge** | flow.html | แสดง "🔗 Synced" / "⚠ Stale" ตามอายุข้อมูล |
| 11 | **อ่าน sensor จาก Dashboard** | flow.html | flow.html อ่าน `sf_sensors` จาก localStorage แสดงค่าเดียวกัน |
| 12 | **Detail panel ใช้ DOM API** | flow.html | `openPanel()` ใช้ `createElement`+`textContent` แทน `innerHTML` |

### v1.3.0 — 2026-05-15 (Feature Update)

| # | ฟีเจอร์ | ไฟล์ | รายละเอียด |
|---|--------|------|-----------|
| 1 | **Valve Timer** | `js/timer.js` | ตั้งเวลารดน้ำ (0.5–120 นาที) ต่อวาล์ว นับถอยหลัง M:SS แดงเมื่อเหลือ <1 นาที ปิดอัตโนมัติเมื่อหมดเวลา |
| 2 | **Chart Time Range** | `js/charts.js` | ปุ่ม Tab 30 นาที / 1 ชั่วโมง / 2 ชั่วโมง — slice history ตาม chartRange ที่เลือก |
| 3 | **CSV Export** | `js/charts.js` | ปุ่ม "⬇ CSV" ดาวน์โหลด history ทั้งหมดเป็น UTF-8 CSV พร้อม BOM |
| 4 | **Browser Push Notifications** | `js/notifications.js` | ปุ่ม "🔔 แจ้งเตือน" ใน header, ส่ง notification เมื่อผู้ใช้ไม่ได้ดูหน้าอยู่ |
| 5 | **Weather Widget** | `js/weather.js` | แสดงสภาพอากาศ (mock default); รองรับ OpenWeatherMap API key ผ่าน `setWeatherApiKey(city, key)` |
| 6 | **PWA Support** | `manifest.json`, `sw.js` | ติดตั้งได้เป็น App, offline cache-first สำหรับ local assets, cache name `smartfarm-v1.3` |
| 7 | **MAX_HISTORY = 2400** | `js/state.js` | เก็บข้อมูลย้อนหลัง 2 ชั่วโมง (2400 จุด × 3 วินาที) รองรับ range 2h |

**Load order อัปเดต:** `state → alerts → charts → valves → sensors → notifications → timer → weather → app`

### v1.2.0 — 2026-05-14 (Module Separation)
- แยก CSS ออกเป็น `css/dashboard.css` และ `css/flow.css`
- แยก JS ออกเป็น 6 ไฟล์ตาม responsibility: `state.js`, `alerts.js`, `charts.js`, `valves.js`, `sensors.js`, `app.js`
- แยก flow logic ออกเป็น `js/flow.js`
- `index.html` และ `flow.html` เหลือแค่ HTML structure ล้วนๆ
- เพิ่ม comment บอก load order และ dependency ใน index.html

### v1.0.0 — 2026-05-14 (Initial)
- Dashboard 2 หน้า: index.html + flow.html
- Mock data simulation, Auto-irrigation logic, Sparkline + Chart.js, Particle animation

---

## Stack & Dependencies

| รายการ | เวอร์ชัน | ใช้สำหรับ |
|--------|---------|---------|
| HTML5 / CSS3 / Vanilla JS | — | ทั้งโปรเจ็ค |
| [Chart.js](https://cdn.jsdelivr.net/npm/chart.js) | latest CDN | กราฟใน Dashboard |
| HTML5 Canvas API | built-in | Node Flow diagram |
| LocalStorage API | built-in | Persistence + page sync |

ไม่มี build step, ไม่มี npm, ไม่มี framework — เปิด HTML ใน browser ได้เลย
