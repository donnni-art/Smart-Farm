// ── Sensor Simulation & UI Rendering ──
// ไฟล์นี้จัดการ: จำลองค่าเซนเซอร์, Auto-irrigation logic, อัปเดต DOM ทั้งหมด

// จำลองค่าเซนเซอร์แบบ random walk (เปลี่ยนเป็น Backend จริงได้ที่นี่)
function simulate() {
  const drift = (v, min, max, step) =>
    Math.min(max, Math.max(min, v + (Math.random() - 0.5) * step));

  state.soil1      = drift(state.soil1,      10,    95,    3);
  state.soil2      = drift(state.soil2,      10,    95,    3);
  state.temp       = drift(state.temp,       18,    44,    0.8);
  state.humid      = drift(state.humid,      30,    95,    1.5);
  state.stemp      = drift(state.stemp,      18,    38,    0.5);
  state.light      = drift(state.light,      500,   90000, 2500);
  state.pressure   = drift(state.pressure,   990,   1025,  0.4);
  state.rain       = drift(state.rain,        0,    100,   4);
  state.waterLevel = drift(state.waterLevel,  5,    100,   1.5);
  state.flow       = drift(state.flow,        0,    8,     0.5);

  // ตรวจ threshold และเปิด/ปิดวาล์วอัตโนมัติ
  autoIrrigateAuto(0, state.soil1);
  autoIrrigateAuto(1, state.soil2);

  // วาล์วที่เปิดอยู่ช่วยเพิ่มความชื้นดิน
  if (state.valves[0]) state.soil1 = Math.min(95, state.soil1 + 1.5);
  if (state.valves[1]) state.soil2 = Math.min(95, state.soil2 + 1.5);

  // RSSI จำลอง (เฉพาะ sim mode)
  const rssi   = -55 + Math.floor(Math.random() * 15);
  const rssiEl = document.getElementById('esp-rssi');
  if (rssiEl) {
    rssiEl.textContent = rssi + ' dBm';
    rssiEl.style.color = rssi > -70 ? 'var(--green)' : 'var(--yellow)';
  }

  // Last telemetry (sim mode)
  const lastSendEl = document.getElementById('last-send');
  if (lastSendEl) lastSendEl.textContent = 'เพิ่งส่ง';

  // Plugin sensors จำลอง
  if (typeof simulatePlugins === 'function') simulatePlugins();
}

// Logic Auto-irrigation — ใช้ค่า thresholds ที่ผู้ใช้ปรับได้
function autoIrrigateAuto(idx, soilPct) {
  if (state.valveManual[idx]) return;  // ข้ามถ้าอยู่ใน Manual mode

  if (soilPct < thresholds.soilDry && !state.valves[idx]) {
    setValveState(idx, true);
    addAlert('warn', `ดินแห้ง Zone ${idx + 1}: ${soilPct.toFixed(0)}% — เปิดวาล์ว ${idx + 1} อัตโนมัติ`);
  } else if (soilPct > thresholds.soilWet && state.valves[idx]) {
    setValveState(idx, false);
    addAlert('ok', `ความชื้น Zone ${idx + 1} ถึง ${soilPct.toFixed(0)}% — ปิดวาล์ว ${idx + 1}`);
  }
}

// อัปเดต DOM ทั้งหมด — เรียกหลัง simulate() ทุก 3 วินาที
function updateUI() {
  const fmt1 = v => v.toFixed(1);
  const fmt0 = v => v.toFixed(0);

  // Soil 1
  document.getElementById('soil1-val').innerHTML = fmt0(state.soil1) + '<span class="card-unit">%</span>';
  setBar('soil1-bar', state.soil1, getSoilColor(state.soil1));
  setStatus('soil1-status', getSoilStatus(state.soil1));
  pushSparkline(sparks.soil1, state.soil1);

  // Soil 2
  document.getElementById('soil2-val').innerHTML = fmt0(state.soil2) + '<span class="card-unit">%</span>';
  setBar('soil2-bar', state.soil2, getSoilColor(state.soil2));
  setStatus('soil2-status', getSoilStatus(state.soil2));
  pushSparkline(sparks.soil2, state.soil2);

  // Air temperature
  document.getElementById('temp-val').innerHTML = fmt1(state.temp) + '<span class="card-unit">°C</span>';
  setBar('temp-bar', ((state.temp - 15) / 35) * 100, state.temp > thresholds.tempHigh ? 'fill-red' : 'fill-yellow');
  setStatus('temp-status', state.temp > thresholds.tempHigh ? ['alert','ร้อนมาก'] : state.temp > 32 ? ['warn','ร้อน'] : ['ok','ปกติ']);
  if (state.temp > thresholds.tempHigh) addAlertThrottle('temp-high', 'warn', `อุณหภูมิสูง: ${fmt1(state.temp)}°C`);
  pushSparkline(sparks.temp, state.temp);

  // Air humidity
  document.getElementById('humid-val').innerHTML = fmt0(state.humid) + '<span class="card-unit">%</span>';
  setBar('humid-bar', state.humid, 'fill-blue');
  setStatus('humid-status', state.humid > 85 ? ['warn','ชื้นสูง'] : state.humid < 40 ? ['warn','แห้งเกิน'] : ['ok','ปกติ']);
  pushSparkline(sparks.humid, state.humid);

  // Soil temperature
  document.getElementById('stemp-val').innerHTML = fmt1(state.stemp) + '<span class="card-unit">°C</span>';
  setBar('stemp-bar', ((state.stemp - 15) / 25) * 100, 'fill-cyan');
  setStatus('stemp-status', ['ok', 'ปกติ']);
  pushSparkline(sparks.stemp, state.stemp);

  // Light intensity
  const lightKlux = state.light >= 1000;
  document.getElementById('light-val').innerHTML = lightKlux
    ? (state.light / 1000).toFixed(1) + '<span class="card-unit">klux</span>'
    : Math.round(state.light) + '<span class="card-unit">lux</span>';
  setBar('light-bar', (state.light / 90000) * 100, 'fill-yellow');
  setStatus('light-status', state.light > 70000 ? ['warn','แสงจ้า'] : state.light < 1000 ? ['warn','มืด'] : ['ok','ปกติ']);
  pushSparkline(sparks.light, state.light);

  // Barometric pressure
  document.getElementById('pressure-val').innerHTML = state.pressure.toFixed(1) + '<span class="card-unit">hPa</span>';
  setBar('pressure-bar', ((state.pressure - 980) / 50) * 100, 'fill-cyan');
  setStatus('pressure-status', state.pressure < 1000 ? ['warn','ความดันต่ำ'] : state.pressure > 1020 ? ['warn','ความดันสูง'] : ['ok','ปกติ']);
  pushSparkline(sparks.pressure, state.pressure);

  // Rain sensor
  document.getElementById('rain-val').innerHTML = fmt0(state.rain) + '<span class="card-unit">%</span>';
  setBar('rain-bar', state.rain, state.rain > 30 ? 'fill-blue' : 'fill-green');
  setStatus('rain-status', state.rain > 60 ? ['warn','ฝนหนัก'] : state.rain > 20 ? ['warn','ฝนเบา'] : ['ok','ไม่มีฝน']);
  pushSparkline(sparks.rain, state.rain);

  // Water tank level
  document.getElementById('wlevel-val').innerHTML = fmt0(state.waterLevel) + '<span class="card-unit">%</span>';
  setBar('wlevel-bar', state.waterLevel, state.waterLevel < 20 ? 'fill-red' : 'fill-blue');
  setStatus('wlevel-status', state.waterLevel < 20 ? ['alert','น้ำวิกฤต'] : state.waterLevel < 40 ? ['warn','น้ำน้อย'] : ['ok','ปกติ']);
  if (state.waterLevel < 20) addAlertThrottle('wlevel-low', 'warn', `ระดับน้ำในถังต่ำ: ${fmt0(state.waterLevel)}%`);
  pushSparkline(sparks.wlevel, state.waterLevel);

  // Water flow rate
  document.getElementById('flow-val').innerHTML = state.flow.toFixed(1) + '<span class="card-unit">L/min</span>';
  setBar('flow-bar', (state.flow / 8) * 100, 'fill-green');
  setStatus('flow-status', state.flow > 6 ? ['warn','ไหลแรง'] : state.flow > 0.5 ? ['ok','กำลังไหล'] : ['ok','หยุด']);
  pushSparkline(sparks.flow, state.flow);

  // Valve cards
  for (let i = 0; i < 4; i++) updateValveUI(i);

  // History charts (เก็บไม่เกิน MAX_HISTORY จุด)
  const now  = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const push = (arr, v) => { arr.push(v); if (arr.length > MAX_HISTORY) arr.shift(); };
  push(state.history.labels, now);
  push(state.history.soil1,  state.soil1);
  push(state.history.soil2,  state.soil2);
  push(state.history.temp,   state.temp);
  push(state.history.humid,  state.humid);

  renderCharts();

  // Zone health indicators
  updateZoneHealth('zone1-health', getSoilStatus(state.soil1)[0]);
  updateZoneHealth('zone2-health', getSoilStatus(state.soil2)[0]);

  // Growth analysis (ทำงานทั้ง Simulation และ Hardware mode)
  if (typeof updateGrowthAnalysis === 'function') updateGrowthAnalysis();

  // Predictive alerts
  if (typeof updatePredictions === 'function') updatePredictions();

  // IndexedDB write (throttled ใน db.js)
  if (typeof dbWriteSensors === 'function') dbWriteSensors();

  saveState();
}

// ── DOM Helpers ──

function setBar(id, pct, colorClass) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.width = Math.max(2, Math.min(100, pct)) + '%';
  el.className   = 'progress-fill ' + colorClass;
}

function setStatus(id, statusArr) {
  const el = document.getElementById(id);
  if (!el) return;
  const [type, label] = statusArr;
  el.className = 'card-status status-' + type;
  const dot = document.createElement('span');
  dot.className = 'status-dot';
  el.textContent = ' ' + label;
  el.prepend(dot);
}

// อัปเดต zone health badge (id, type: 'ok'|'warn'|'alert')
function updateZoneHealth(id, type) {
  const el = document.getElementById(id);
  if (!el) return;
  const labels = { ok: 'ปกติ', warn: 'เฝ้าระวัง', alert: 'แจ้งเตือน' };
  el.className = 'zone-health health-' + type;
  el.textContent = labels[type] || 'ปกติ';
}

// คืนสี progress bar ตามค่าความชื้นดิน
function getSoilColor(v) {
  if (v < thresholds.soilDry) return 'fill-red';
  if (v > 80)                 return 'fill-blue';
  return 'fill-green';
}

// คืน status badge [type, label] ตามค่าความชื้นดิน
function getSoilStatus(v) {
  if (v < thresholds.soilDry) return ['alert', 'แห้ง — รดน้ำ'];
  if (v > 80)                 return ['warn',  'ชื้นเกิน'];
  return ['ok', 'ปกติ'];
}
