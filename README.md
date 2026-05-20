# 🌿 Smart Farm Monitor

ระบบ Dashboard สำหรับฟาร์มอัจฉริยะ (IoT) แบบ Real-time  
รองรับทั้งโหมดจำลองข้อมูล (Simulation) และเชื่อมต่อ Hardware จริง (ESP32)

---

## ภาพรวม

Smart Farm Monitor คือ Web Dashboard ที่ใช้ติดตามและควบคุมระบบรดน้ำอัตโนมัติ  
สร้างด้วย **Vanilla JS / HTML5 / CSS3** ล้วน — ไม่มี Framework ไม่มี Build Step  
เปิดไฟล์ `index.html` ในเบราว์เซอร์ได้เลย

---

## หน้าจอหลัก

| หน้า | คำอธิบาย |
|------|----------|
| `index.html` | Dashboard หลัก — เซนเซอร์, วาล์ว, กราฟ, การแจ้งเตือน |
| `flow.html` | Node Flow Diagram — แสดง Architecture การไหลของข้อมูล |
| `guide.html` | คู่มือการใช้งานระบบ |

---

## ฟีเจอร์

### 📊 การแสดงผลเซนเซอร์
- ความชื้นดิน Zone 1 & 2, อุณหภูมิอากาศ, ความชื้นอากาศ, อุณหภูมิดิน
- ความเข้มแสง, ความดันอากาศ, ตรวจจับฝน, ระดับน้ำในถัง, อัตราไหลน้ำ
- Sparkline + Progress bar + Status badge แบบ Real-time

### 🚿 ระบบรดน้ำ
- วาล์ว 4 ตัว (Zone 1–4) — Auto-irrigation สำหรับ Zone 1 & 2
- ตั้งเวลารดน้ำ (Timer) และคืนค่า Auto mode ได้
- **ตารางรดน้ำรายสัปดาห์** — เลือกวัน, เวลา, เงื่อนไข (เสมอ / เมื่อดินแห้ง / เมื่อไม่มีฝน)

### 🌱 วิเคราะห์การเจริญเติบโต
- คำนวณ Growth Score (0–100) จากเซนเซอร์ทุก Zone
- รองรับ **8 โปรไฟล์พืช** — ผักทั่วไป, มะเขือเทศ, กะเพรา, พริก, ผักกาดหอม, ข้าว, สนามหญ้า, ต้นไม้
- คำแนะนำการดูแลพืชอัตโนมัติตามสภาพแวดล้อม
- **Sensor Simulator** — ปรับค่าเซนเซอร์เพื่อดูผลกระทบต่อ Score แบบ Real-time

### 🔮 ทำนายแนวโน้ม
- Linear Regression บนประวัติข้อมูล
- ทำนายเวลาที่ดินจะแห้งถึง Threshold และอุณหภูมิจะสูงเกิน

### 🔔 การแจ้งเตือน
- Alert Log พร้อม Badge นับจำนวน
- **LINE Notify** และ **Webhook** — ส่งอัตโนมัติเมื่อมี Warn/Alert
- Browser Push Notification

### 📷 กล้อง
- รองรับ MJPEG Stream, Snapshot (auto-refresh), RTSP URL
- เพิ่มกล้องได้หลายตัว

### 📱 Multi-Device
- จัดการ ESP32 หลายเครื่อง
- สลับ Dashboard ไปยังอุปกรณ์ต่างๆ ได้ทันที

### ⚙️ อื่นๆ
- **IndexedDB** — บันทึกประวัติเซนเซอร์ย้อนหลัง 7 วัน
- **PWA** — ติดตั้งเป็น App และใช้งาน Offline ได้
- Dark / Light Theme
- **Layout Panel** — ซ่อน/แสดง Section ได้ตามต้องการ
- ปรับ Threshold ผ่าน UI ได้เอง

---

## สถาปัตยกรรม

```
[Sensors]          [ESP32]          [Network]         [Dashboard]
 Soil Zone 1 ──►
 Soil Zone 2 ──►   ESP32   ──WiFi──► Router ──────►  index.html
 DHT22       ──►    │                                   ├── Charts
 DS18B20     ──►    └── GPIO ──► Relay ──► Valve 1–4   ├── Growth Score
                                                        ├── Scheduler
                                                        └── LINE Notify
```

---

## โครงสร้างไฟล์

```
smart-farm-ui/
├── index.html          — Dashboard หลัก
├── flow.html           — Node Flow Diagram
├── guide.html          — คู่มือ
├── sw.js               — Service Worker (PWA)
├── manifest.json       — PWA Manifest
├── esp32/
│   └── SmartFarmESP32.ino  — Arduino Firmware Template
├── css/
│   ├── dashboard.css
│   └── flow.css
└── js/
    ├── state.js        — Global state + localStorage
    ├── alerts.js       — Alert system
    ├── charts.js       — Chart.js wrappers
    ├── valves.js       — Valve control logic
    ├── sensors.js      — Sensor simulation + UI update
    ├── timer.js        — Valve countdown timer
    ├── weather.js      — Weather widget
    ├── plugins.js      — Custom sensor plugins
    ├── connection.js   — WebSocket / REST / Simulation
    ├── crops.js        — Crop profile system
    ├── growth.js       — Growth analysis + Simulator
    ├── db.js           — IndexedDB persistence
    ├── prediction.js   — Predictive alerts
    ├── scheduler.js    — Irrigation scheduler
    ├── notify.js       — LINE Notify + Webhook
    ├── camera.js       — Camera widget
    ├── devices.js      — Multi-device management
    ├── notifications.js — Browser Push Notifications
    └── app.js          — Boot + Section visibility
```

---

## วิธีรัน

ไม่ต้องติดตั้งอะไร — เปิด Browser แล้วลากไฟล์ `index.html` ลงไปได้เลย

```bash
# หรือใช้ local server
npx serve .
# หรือ
python3 -m http.server 8080
```

---

## เชื่อมต่อ Hardware จริง

เปิด Dashboard → ส่วน **"การเชื่อมต่ออุปกรณ์"** → เลือกโหมด

| โหมด | คำอธิบาย |
|------|----------|
| 🎲 Simulation | จำลองข้อมูล Random Walk (default) |
| 🔗 WebSocket | เชื่อมต่อ ESP32 โดยตรง `ws://192.168.x.x/ws` |
| 🌐 REST API | ดึงข้อมูลทุก 3 วินาที `http://192.168.x.x/sensors` |

ESP32 ต้องส่ง JSON format:
```json
{
  "soil1": 55.2, "soil2": 61.8,
  "temp": 29.4, "humid": 65.1, "stemp": 26.3,
  "light": 25000, "pressure": 1013, "rain": 5,
  "waterLevel": 80, "flow": 0,
  "valve1": false, "valve2": false, "valve3": false, "valve4": false
}
```

---

## Tech Stack

| รายการ | ใช้สำหรับ |
|--------|----------|
| HTML5 / CSS3 / Vanilla JS | ทั้งโปรเจ็ค |
| [Chart.js](https://www.chartjs.org/) (CDN) | กราฟย้อนหลัง + Growth trend |
| HTML5 Canvas API | Node Flow diagram |
| IndexedDB | บันทึกประวัติ 7 วัน |
| LocalStorage | Settings, valve state, sensor snapshot |
| Service Worker | PWA offline support |

---

## License

MIT
