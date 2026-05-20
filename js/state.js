// ── Thresholds — ผู้ใช้ปรับได้ผ่าน Settings Panel และบันทึกใน localStorage ──
const thresholds = {
  soilDry:  30,  // % เปิดวาล์วอัตโนมัติเมื่อต่ำกว่านี้
  soilWet:  70,  // % ปิดวาล์วอัตโนมัติเมื่อสูงกว่านี้
  tempHigh: 38,  // °C แจ้งเตือนเมื่อสูงกว่านี้
};

// ── Central Application State ──
const state = {
  // Sensor values (จำลองจาก simulate() หรือรับจาก Backend จริง)
  soil1: 55, soil2: 60, temp: 29, humid: 65, stemp: 26,

  // Extended sensors
  light:      25000,  // ความเข้มแสง (lux) — BH1750 / LDR
  pressure:   1013,   // ความดันอากาศ (hPa) — BME280
  rain:       0,      // ปริมาณฝน 0-100% — Rain Sensor
  waterLevel: 80,     // ระดับน้ำในถัง 0-100% — HC-SR04
  flow:       0,      // อัตราไหลน้ำ (L/min) — YF-S201

  // Valve states
  valves:        [false, false, false, false],  // true = เปิด
  valveManual:   [false, false, false, false],  // true = ผู้ใช้ Override ด้วย Manual
  valveCounts:   [0, 0, 0, 0],                 // จำนวนครั้งรดน้ำ (persist)
  valveLastTime: ['--', '--', '--', '--'],      // เวลาล่าสุดที่เปิด (persist)

  uptime:       0,
  alertCount:   0,
  history: { soil1:[], soil2:[], temp:[], humid:[], labels:[] },
};

const MAX_HISTORY = 2400;  // 2400 จุด × 3 วินาที = 2 ชั่วโมง

// ── LocalStorage: Save ──
// เรียกทุกครั้งที่ state เปลี่ยน เพื่อให้ข้อมูลไม่หายหลัง refresh
// และแชร์ค่าเซนเซอร์ให้ flow.html อ่านได้ผ่าน sf_sensors
function saveState() {
  try {
    localStorage.setItem('sf_valveCounts',   JSON.stringify(state.valveCounts));
    localStorage.setItem('sf_valveLastTime', JSON.stringify(state.valveLastTime));
    localStorage.setItem('sf_thresholds',    JSON.stringify(thresholds));
    localStorage.setItem('sf_sensors', JSON.stringify({
      soil1: state.soil1, soil2: state.soil2,
      temp:  state.temp,  humid: state.humid, stemp: state.stemp,
      light: state.light, pressure: state.pressure,
      rain:  state.rain,  waterLevel: state.waterLevel, flow: state.flow,
      ts:    Date.now(),
    }));
  } catch(e) {}
}

// ── LocalStorage: Load ──
// เรียกตอน Boot เพื่อคืนค่าจากครั้งก่อน
function loadState() {
  try {
    const vc = localStorage.getItem('sf_valveCounts');
    const vl = localStorage.getItem('sf_valveLastTime');
    const th = localStorage.getItem('sf_thresholds');
    if (vc) state.valveCounts   = JSON.parse(vc);
    if (vl) state.valveLastTime = JSON.parse(vl);
    if (th) {
      Object.assign(thresholds, JSON.parse(th));
      // ซิงค์ UI ของ Settings Panel
      document.getElementById('th-dry').value  = thresholds.soilDry;
      document.getElementById('th-wet').value  = thresholds.soilWet;
      document.getElementById('th-temp').value = thresholds.tempHigh;
      document.getElementById('th-dry-val').textContent  = thresholds.soilDry;
      document.getElementById('th-wet-val').textContent  = thresholds.soilWet;
      document.getElementById('th-temp-val').textContent = thresholds.tempHigh;
    }
  } catch(e) {}
}
