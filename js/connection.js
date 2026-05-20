// ── Connection Manager ──
// สลับแหล่งข้อมูล: Simulation (mock) หรือ Hardware จริง (WebSocket / REST API)
// เพิ่ม load order: หลัง sensors.js

let _simTimer          = null;
let _restTimer         = null;
let _ws                = null;
let _threshSynced      = false;  // กัน sendThresholds ซ้ำใน REST polling
let _wsReconnectTimer  = null;
let _wsReconnectDelay  = 3000;   // เริ่มที่ 3s, backoff สูงสุด 30s

const conn = { mode: 'sim', url: '' };

function applyHardwareData(data) {
  // ── Sensor values ──
  if (typeof data.soil1      === 'number') state.soil1      = data.soil1;
  if (typeof data.soil2      === 'number') state.soil2      = data.soil2;
  if (typeof data.temp       === 'number') state.temp       = data.temp;
  if (typeof data.humid      === 'number') state.humid      = data.humid;
  if (typeof data.stemp      === 'number') state.stemp      = data.stemp;
  if (typeof data.light      === 'number') state.light      = data.light;
  if (typeof data.pressure   === 'number') state.pressure   = data.pressure;
  if (typeof data.rain       === 'number') state.rain       = data.rain;
  if (typeof data.waterLevel === 'number') state.waterLevel = data.waterLevel;
  if (typeof data.flow       === 'number') state.flow       = data.flow;

  // ── Valve state sync from ESP32 ──
  [0, 1, 2, 3].forEach(i => {
    const key = 'valve' + (i + 1);
    if (typeof data[key] === 'boolean') {
      state.valves[i] = data[key];
      const cb = document.getElementById('v' + (i + 1));
      if (cb) cb.checked = data[key];
      updateValveUI(i);
    }
  });

  // ── Manual override state sync (ESP32 คือ source of truth) ──
  if (typeof data.manual1 === 'boolean') {
    state.valveManual[0] = data.manual1;
    const btn = document.getElementById('v1-reset');
    if (btn) btn.disabled = !data.manual1;
  }
  if (typeof data.manual2 === 'boolean') {
    state.valveManual[1] = data.manual2;
    const btn = document.getElementById('v2-reset');
    if (btn) btn.disabled = !data.manual2;
  }

  // ── RSSI ──
  if (typeof data.rssi === 'number') {
    const rssiEl = document.getElementById('esp-rssi');
    if (rssiEl) {
      rssiEl.textContent = data.rssi + ' dBm';
      rssiEl.style.color = data.rssi > -70 ? 'var(--green)' : 'var(--yellow)';
    }
  }

  // ── Voltage ──
  if (typeof data.voltage === 'number') {
    const voltEl = document.getElementById('esp-volt');
    if (voltEl) {
      voltEl.textContent = data.voltage.toFixed(1) + ' V';
      voltEl.style.color = data.voltage > 4.5 ? 'var(--green)' : 'var(--yellow)';
    }
  }

  // ── Plugin sensor values ──
  if (typeof updatePluginValues === 'function') updatePluginValues(data);

  // ── In hardware mode ESP32 handles auto-irrigation — browser just renders ──
  updateUI();

  // ── Last telemetry timestamp ──
  const lastSendEl = document.getElementById('last-send');
  if (lastSendEl) lastSendEl.textContent =
    new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}

function _stopAll() {
  if (_simTimer)         { clearInterval(_simTimer);    _simTimer         = null; }
  if (_restTimer)        { clearInterval(_restTimer);   _restTimer        = null; }
  if (_wsReconnectTimer) { clearTimeout(_wsReconnectTimer); _wsReconnectTimer = null; }
  if (_ws) { _ws.onclose = null; _ws.close(); _ws = null; }
  _threshSynced     = false;
  _wsReconnectDelay = 3000;
}

// ── ส่ง payload ไปยัง ESP32 ผ่าน WS หรือ REST endpoint ──
function _sendToESP32(payload, restPath) {
  if (conn.mode === 'sim') return;
  if (conn.mode === 'ws' && _ws && _ws.readyState === WebSocket.OPEN) {
    _ws.send(payload);
  } else if (conn.mode === 'rest' && conn.url) {
    const base = conn.url.replace(/\/sensors\/?$/, '');
    fetch(base + restPath, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload,
    }).catch(() => {});
  }
}

// ── Send valve command to ESP32 ──
function sendValveCommand(idx, on) {
  _sendToESP32(JSON.stringify({ cmd: 'valve', valve: idx + 1, state: on }), '/valve');
}

// ── Reset valve to auto mode on ESP32 ──
function sendAutoCommand(idx) {
  _sendToESP32(JSON.stringify({ cmd: 'auto', valve: idx + 1 }), '/valve');
}

// ── Sync threshold values to ESP32 ──
function sendThresholds() {
  _sendToESP32(
    JSON.stringify({ cmd: 'thresholds', soilDry: thresholds.soilDry, soilWet: thresholds.soilWet }),
    '/thresholds'
  );
}

function _setBadge(status) {
  const textEl = document.getElementById('conn-badge-text');
  const dotEl  = document.querySelector('.conn-dot');
  if (!textEl) return;
  const map = {
    sim:     { text: 'ESP32 Online (Mock)', color: 'var(--green)'  },
    ws:      { text: 'WebSocket Live',      color: 'var(--green)'  },
    rest:    { text: 'REST API Live',       color: 'var(--cyan)'   },
    linking: { text: 'กำลังเชื่อมต่อ…',     color: 'var(--yellow)' },
    error:   { text: 'เชื่อมต่อล้มเหลว',     color: 'var(--red)'    },
  };
  const s = map[status] || map.sim;
  textEl.textContent = s.text;
  if (dotEl) dotEl.style.background = s.color;
}

// ── Simulation ──
function _startSim() {
  _stopAll();
  conn.mode = 'sim';
  _setBadge('sim');
  simulate(); updateUI();
  _simTimer = setInterval(() => { simulate(); updateUI(); }, 3000);
}

// ── WebSocket ──
function _startWS(url) {
  _stopAll();
  conn.mode = 'ws';
  _setBadge('linking');
  try {
    _ws = new WebSocket(url);
    _ws.onopen = () => {
      _setBadge('ws');
      _wsReconnectDelay = 3000;  // reset backoff เมื่อเชื่อมต่อสำเร็จ
      addAlert('ok', 'WebSocket เชื่อมต่อสำเร็จ: ' + url);
      sendThresholds();
    };
    _ws.onmessage = (e) => { try { applyHardwareData(JSON.parse(e.data)); } catch(_) {} };
    _ws.onerror   = ()  => { _setBadge('error'); };
    _ws.onclose   = ()  => {
      if (conn.mode !== 'ws') return;
      _setBadge('error');
      // Auto-reconnect พร้อม exponential backoff (3s → 6s → 12s → … สูงสุด 30s)
      _wsReconnectTimer = setTimeout(() => {
        if (conn.mode === 'ws' && conn.url) {
          addAlert('info', `🔄 กำลังเชื่อมต่อใหม่… (${_wsReconnectDelay / 1000}s)`);
          _wsReconnectDelay = Math.min(_wsReconnectDelay * 2, 30000);
          _startWS(conn.url);
        }
      }, _wsReconnectDelay);
    };
  } catch(_) {
    _setBadge('error');
    addAlert('warn', 'WebSocket URL ไม่ถูกต้อง');
  }
}

// ── REST API Polling ──
function _startREST(url) {
  _stopAll();
  conn.mode = 'rest';
  _setBadge('linking');
  const poll = async () => {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      applyHardwareData(await r.json());
      _setBadge('rest');
      if (!_threshSynced) { sendThresholds(); _threshSynced = true; }
    } catch(_) { _setBadge('error'); }
  };
  poll();
  _restTimer = setInterval(poll, 3000);
}

// ── Common connection logic (เรียกจากทั้ง applyConnSettings และ applyQuickConnect) ──
function _doConnect(mode, url) {
  localStorage.setItem('sf_conn_mode', mode);
  localStorage.setItem('sf_conn_url',  url);
  // Sync URL inputs ทั้งสองแผง
  ['conn-url', 'qcp-url'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp && url) inp.value = url;
  });
  if (mode === 'sim') {
    addAlert('info', 'เปลี่ยนเป็น Simulation Mode');
    _startSim();
  } else if (mode === 'ws') {
    if (!url) { addAlert('warn', 'กรุณาใส่ WebSocket URL เช่น ws://192.168.1.100/ws'); return; }
    _startWS(url);
  } else if (mode === 'rest') {
    if (!url) { addAlert('warn', 'กรุณาใส่ REST URL เช่น http://192.168.1.100/sensors'); return; }
    _startREST(url);
  }
}

// ── UI Handlers — Settings Panel ──
function toggleConnSettings() {
  const body  = document.getElementById('conn-body');
  const arrow = document.getElementById('conn-arrow');
  if (!body) return;
  const open = body.classList.toggle('open');
  arrow.textContent = open ? '▲' : '▼';
}

function applyConnSettings() {
  const activeBtn = document.querySelector('.conn-mode-btn.active');
  const mode = activeBtn ? activeBtn.dataset.mode : 'sim';
  const url  = (document.getElementById('conn-url')?.value || '').trim();
  _doConnect(mode, url);
  const body = document.getElementById('conn-body');
  if (body) body.classList.remove('open');
  const arrow = document.getElementById('conn-arrow');
  if (arrow) arrow.textContent = '▼';
}

// ── UI Handlers — Quick Connect Panel (Header) ──
function toggleQuickConnect() {
  const panel = document.getElementById('quick-conn-panel');
  if (panel) panel.classList.toggle('open');
}

function applyQuickConnect() {
  const activeBtn = document.querySelector('.conn-mode-btn.active');
  const mode = activeBtn ? activeBtn.dataset.mode : 'sim';
  const url  = (document.getElementById('qcp-url')?.value || '').trim();
  _doConnect(mode, url);
  const panel = document.getElementById('quick-conn-panel');
  if (panel) panel.classList.remove('open');
}

// ── Mode Selection (shared — อัปเดตทุก .conn-mode-btn ในทุกแผง) ──
function selectConnMode(mode) {
  conn.mode = mode;
  document.querySelectorAll('.conn-mode-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mode === mode));

  const show = mode !== 'sim';
  ['conn-url-row', 'qcp-url-row'].forEach(id => {
    const r = document.getElementById(id);
    if (r) r.style.display = show ? 'flex' : 'none';
  });
  ['conn-url', 'qcp-url'].forEach(id => {
    const inp = document.getElementById(id);
    if (!inp) return;
    if (mode === 'ws')   inp.placeholder = 'ws://192.168.1.100/ws';
    if (mode === 'rest') inp.placeholder = 'http://192.168.1.100/sensors';
  });
}

// Public wrapper สำหรับ devices.js เรียก
function connectToDevice(mode, url) {
  _doConnect(mode, url);
}

// ── Boot: เรียกจาก app.js ──
function initConnection() {
  const savedMode = localStorage.getItem('sf_conn_mode') || 'sim';
  const savedUrl  = localStorage.getItem('sf_conn_url')  || '';
  // คืนค่า URL ใน inputs ทั้งสอง
  ['conn-url', 'qcp-url'].forEach(id => {
    const inp = document.getElementById(id);
    if (inp && savedUrl) inp.value = savedUrl;
  });
  selectConnMode(savedMode);
  _doConnect(savedMode, savedUrl);
}

// ── ปิด Quick Panel เมื่อคลิกนอกพื้นที่ หรือกด Escape ──
document.addEventListener('click', function(e) {
  const panel = document.getElementById('quick-conn-panel');
  const wrap  = document.querySelector('.conn-wrap');
  if (panel && panel.classList.contains('open') && wrap && !wrap.contains(e.target)) {
    panel.classList.remove('open');
  }
});
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const panel = document.getElementById('quick-conn-panel');
    if (panel) panel.classList.remove('open');
  }
});
