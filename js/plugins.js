// ── Sensor Plugin System ──
// ให้ผู้ใช้เพิ่ม sensor ใหม่ในแต่ละ zone ผ่าน UI โดยไม่ต้องแก้โค้ด
// ข้อมูล plugin เก็บใน localStorage['sf_plugins']

const PLUGIN_TYPES = {
  soil:       { icon:'💧', unit:'%',     min:0,   max:100,   color:'fill-green',  proto:'Capacitive · Analog',  simMin:10,   simMax:95,    simStep:3    },
  temp:       { icon:'🌡️', unit:'°C',    min:0,   max:60,    color:'fill-yellow', proto:'DHT22 / BME280 · I2C', simMin:18,   simMax:45,    simStep:0.8  },
  humid:      { icon:'🌫️', unit:'%',     min:0,   max:100,   color:'fill-blue',   proto:'DHT22 / BME280 · I2C', simMin:30,   simMax:95,    simStep:1.5  },
  light:      { icon:'☀️', unit:'lux',   min:0,   max:100000,color:'fill-yellow', proto:'BH1750 · I2C / LDR · Analog', simMin:500, simMax:90000, simStep:2500 },
  pressure:   { icon:'🌬️', unit:'hPa',  min:900, max:1100,  color:'fill-cyan',   proto:'BME280 · I2C',         simMin:990,  simMax:1025,  simStep:0.5  },
  rain:       { icon:'🌧️', unit:'%',     min:0,   max:100,   color:'fill-blue',   proto:'Rain Sensor · Analog', simMin:0,    simMax:80,    simStep:5    },
  waterlevel: { icon:'🪣', unit:'%',     min:0,   max:100,   color:'fill-blue',   proto:'HC-SR04 · Ultrasonic', simMin:10,   simMax:100,   simStep:2    },
  flow:       { icon:'💦', unit:'L/min', min:0,   max:30,    color:'fill-green',  proto:'YF-S201 · Pulse',      simMin:0,    simMax:8,     simStep:0.5  },
  ph:         { icon:'🧪', unit:'pH',    min:0,   max:14,    color:'fill-cyan',   proto:'pH Probe · Analog',    simMin:5.0,  simMax:8.0,   simStep:0.15 },
  ec:         { icon:'⚡', unit:'mS/cm', min:0,   max:10,    color:'fill-cyan',   proto:'EC Probe · Analog',    simMin:0.5,  simMax:4.0,   simStep:0.25 },
  co2:        { icon:'💨', unit:'ppm',   min:300, max:5000,  color:'fill-blue',   proto:'MH-Z19B · UART',       simMin:400,  simMax:2000,  simStep:40   },
  custom:     { icon:'📡', unit:'',      min:0,   max:100,   color:'fill-green',  proto:'Custom',               simMin:0,    simMax:100,   simStep:2    },
};

let _plugins      = [];   // plugin configs (persisted)
let _pluginSim    = {};   // current simulation value per id
let _pluginSparks = {};   // Chart.js sparkline instance per id
let _modalZone    = 0;    // zone index for currently-open modal

// ── Persistence ──

function _loadPlugins() {
  try {
    const raw = localStorage.getItem('sf_plugins');
    _plugins = raw ? JSON.parse(raw) : [];
  } catch(e) { _plugins = []; }
}

function _savePlugins() {
  try { localStorage.setItem('sf_plugins', JSON.stringify(_plugins)); } catch(e) {}
}

// ── Boot ──

function initPlugins() {
  _loadPlugins();
  _plugins.forEach(p => _renderPluginRow(p));

  // Close modal on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('plugin-modal').style.display = 'none';
  });
}

// ── Render a plugin sensor row inside the correct zone card ──

function _renderPluginRow(p) {
  const t        = PLUGIN_TYPES[p.type] || PLUGIN_TYPES.custom;
  const zoneCard = document.getElementById('valve-' + (p.zone + 1) + '-card');
  if (!zoneCard) return;

  const devices  = zoneCard.querySelector('.zone-devices');
  const valveRow = zoneCard.querySelector('.zdev-valve-row');

  // Remove existing row + destroy old sparkline if re-rendering
  const existing = document.getElementById('plugin-' + p.id);
  if (existing) existing.remove();
  if (_pluginSparks[p.id]) { try { _pluginSparks[p.id].destroy(); } catch(_) {} delete _pluginSparks[p.id]; }

  const row = document.createElement('div');
  row.className = 'zdev-row plugin-row';
  row.id = 'plugin-' + p.id;

  // ── Left: icon + name + protocol ──
  const left    = document.createElement('div');
  left.className = 'zdev-left';

  const iconEl  = document.createElement('span');
  iconEl.className = 'zdev-icon';
  iconEl.textContent = p.icon || t.icon;

  const info    = document.createElement('div');
  const nameEl  = document.createElement('div');
  nameEl.className = 'zdev-name';
  nameEl.textContent = p.name;
  const protoEl = document.createElement('div');
  protoEl.className = 'zdev-proto';
  protoEl.textContent = p.proto || t.proto;
  info.appendChild(nameEl);
  info.appendChild(protoEl);
  left.appendChild(iconEl);
  left.appendChild(info);

  // ── Mid: value + bar + status ──
  const mid     = document.createElement('div');
  mid.className = 'zdev-mid';

  const valEl   = document.createElement('div');
  valEl.className = 'zdev-val';
  valEl.id = 'pval-' + p.id;
  const valText = document.createTextNode('--');
  const unitEl  = document.createElement('span');
  unitEl.className = 'card-unit';
  unitEl.textContent = p.unit != null ? p.unit : (t.unit || '');
  valEl.appendChild(valText);
  valEl.appendChild(unitEl);

  const barWrap = document.createElement('div');
  barWrap.className = 'progress-bar';
  barWrap.style.cssText = 'margin:6px 0 4px';
  const barFill = document.createElement('div');
  barFill.className = 'progress-fill ' + (p.color || t.color);
  barFill.id = 'pbar-' + p.id;
  barFill.style.width = '0%';
  barWrap.appendChild(barFill);

  const statusEl = document.createElement('div');
  statusEl.className = 'card-status status-ok';
  statusEl.id = 'pstatus-' + p.id;
  const statusDot = document.createElement('span');
  statusDot.className = 'status-dot';
  statusEl.appendChild(statusDot);
  statusEl.appendChild(document.createTextNode('ปกติ'));

  mid.appendChild(valEl);
  mid.appendChild(barWrap);
  mid.appendChild(statusEl);

  // ── Sparkline ──
  const sparkWrap   = document.createElement('div');
  sparkWrap.className = 'zdev-spark';
  const sparkCanvas = document.createElement('canvas');
  sparkCanvas.id = 'pspark-' + p.id;
  sparkWrap.appendChild(sparkCanvas);

  // ── Delete button ──
  const delBtn = document.createElement('button');
  delBtn.className = 'plugin-del-btn';
  delBtn.title = 'ลบ Sensor นี้';
  delBtn.textContent = '✕';
  delBtn.onclick = () => removePlugin(p.id);

  row.appendChild(left);
  row.appendChild(mid);
  row.appendChild(sparkWrap);
  row.appendChild(delBtn);

  // Insert before valve row (so valve row stays at bottom)
  if (valveRow) {
    devices.insertBefore(row, valveRow);
  } else {
    const addRow = devices.querySelector('.zone-add-row');
    addRow ? devices.insertBefore(row, addRow) : devices.appendChild(row);
  }

  // Create sparkline chart
  const colorMap = {
    'fill-green':  '#22c55e',
    'fill-yellow': '#f59e0b',
    'fill-red':    '#ef4444',
    'fill-blue':   '#3b82f6',
    'fill-cyan':   '#06b6d4',
  };
  const sparkColor = colorMap[p.color || t.color] || '#22c55e';
  _pluginSparks[p.id] = makeSparkline('pspark-' + p.id, sparkColor);
}

// ── Update a single plugin's value in the UI ──

function updatePluginValue(p, value) {
  const t   = PLUGIN_TYPES[p.type] || PLUGIN_TYPES.custom;
  const min = typeof p.min === 'number' ? p.min : t.min;
  const max = typeof p.max === 'number' ? p.max : t.max;

  // Value text (first text node in pval-{id})
  const valEl = document.getElementById('pval-' + p.id);
  if (valEl) {
    const decimals = (Math.abs(value) >= 100 || Number.isInteger(value)) ? 0 : 1;
    valEl.childNodes[0].textContent = value.toFixed(decimals);
  }

  // Progress bar
  const barEl = document.getElementById('pbar-' + p.id);
  if (barEl) {
    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
    barEl.style.width = Math.max(2, Math.min(100, pct)) + '%';
  }

  // Status badge
  const statusEl = document.getElementById('pstatus-' + p.id);
  if (statusEl) {
    let type, label;
    const norm = max > min ? (value - min) / (max - min) : 0.5;
    if (p.type === 'soil') {
      if (value < (typeof thresholds !== 'undefined' ? thresholds.soilDry : 30)) { type='alert'; label='แห้ง'; }
      else if (value > 80) { type='warn'; label='ชื้นเกิน'; }
      else                 { type='ok';   label='ปกติ'; }
    } else if (p.type === 'temp') {
      if (value > (typeof thresholds !== 'undefined' ? thresholds.tempHigh : 38)) { type='alert'; label='ร้อนมาก'; }
      else if (value > 32) { type='warn'; label='ร้อน'; }
      else                 { type='ok';   label='ปกติ'; }
    } else if (p.type === 'ph') {
      if (value < 5.5 || value > 7.5) { type='warn'; label='ผิดปกติ'; }
      else                             { type='ok';   label='ปกติ'; }
    } else if (p.type === 'rain') {
      if (value > 60) { type='warn'; label='ฝนหนัก'; }
      else if (value > 20) { type='warn'; label='ฝนเบา'; }
      else                 { type='ok';   label='ไม่มีฝน'; }
    } else if (p.type === 'waterlevel') {
      if (value < 20)      { type='alert'; label='น้ำวิกฤต'; }
      else if (value < 40) { type='warn';  label='น้ำน้อย'; }
      else                 { type='ok';    label='ปกติ'; }
    } else {
      if (norm > 0.9)      { type='warn';  label='สูง'; }
      else if (norm < 0.1) { type='warn';  label='ต่ำ'; }
      else                 { type='ok';    label='ปกติ'; }
    }
    statusEl.className = 'card-status status-' + type;
    const dot = document.createElement('span');
    dot.className = 'status-dot';
    statusEl.textContent = ' ' + label;
    statusEl.prepend(dot);
  }

  // Sparkline
  if (_pluginSparks[p.id]) pushSparkline(_pluginSparks[p.id], value);
}

// ── Called from applyHardwareData() when hardware data arrives ──

function updatePluginValues(data) {
  _plugins.forEach(p => {
    if (typeof data[p.dataKey] === 'number') updatePluginValue(p, data[p.dataKey]);
  });
}

// ── Called from simulate() every 3 seconds in simulation mode ──

function simulatePlugins() {
  _plugins.forEach(p => {
    const t      = PLUGIN_TYPES[p.type] || PLUGIN_TYPES.custom;
    const simMin = typeof p.min === 'number' ? p.min : t.simMin;
    const simMax = typeof p.max === 'number' ? p.max : t.simMax;
    if (_pluginSim[p.id] === undefined) _pluginSim[p.id] = (t.simMin + t.simMax) / 2;
    _pluginSim[p.id] = Math.min(simMax, Math.max(simMin,
      _pluginSim[p.id] + (Math.random() - 0.5) * t.simStep));
    updatePluginValue(p, _pluginSim[p.id]);
  });
}

// ── Modal: Open ──

function openPluginModal(zoneIdx) {
  _modalZone = zoneIdx;
  const modal = document.getElementById('plugin-modal');
  if (!modal) return;

  // Reset form
  document.getElementById('pm-name').value    = '';
  document.getElementById('pm-datakey').value = '';
  document.getElementById('pm-unit').value    = '';
  document.getElementById('pm-min').value     = '';
  document.getElementById('pm-max').value     = '';
  document.getElementById('pm-proto').value   = '';
  document.getElementById('pm-type').value    = 'soil';
  _onTypeChange('soil');

  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('pm-name').focus(), 80);
}

// ── Modal: Close (click overlay or button) ──

function closePluginModal(e) {
  if (e && e.target !== document.getElementById('plugin-modal')) return;
  document.getElementById('plugin-modal').style.display = 'none';
}

// ── Modal: Type selector auto-fills defaults ──

function onPluginTypeChange() {
  _onTypeChange(document.getElementById('pm-type').value);
}

function _onTypeChange(type) {
  const t     = PLUGIN_TYPES[type] || PLUGIN_TYPES.custom;
  const unitEl  = document.getElementById('pm-unit');
  const minEl   = document.getElementById('pm-min');
  const maxEl   = document.getElementById('pm-max');
  const protoEl = document.getElementById('pm-proto');

  unitEl.value  = t.unit;
  minEl.value   = t.min;
  maxEl.value   = t.max;
  protoEl.value = t.proto;

  // Update dataKey preview
  _updateKeyPreview();
}

// ── Modal: Update dataKey preview as user types ──

function onDataKeyInput() {
  _updateKeyPreview();
}

function _updateKeyPreview() {
  const keyEl     = document.getElementById('pm-datakey');
  const previewEl = document.getElementById('pm-key-preview');
  if (!keyEl || !previewEl) return;
  const defaults  = { soil:'soil3', temp:'temp2', humid:'humid2', light:'light', pressure:'pressure', rain:'rain', waterlevel:'waterLevel', flow:'flow', ph:'ph', ec:'ec', co2:'co2', custom:'sensor1' };
  const type      = (document.getElementById('pm-type') || {}).value || 'custom';
  previewEl.textContent = keyEl.value.trim() || defaults[type] || 'sensor';
}

// ── Modal: Confirm add ──

function confirmAddPlugin() {
  const name    = document.getElementById('pm-name').value.trim();
  const type    = document.getElementById('pm-type').value;
  const dataKey = document.getElementById('pm-datakey').value.trim();
  const unit    = document.getElementById('pm-unit').value.trim();
  const minVal  = parseFloat(document.getElementById('pm-min').value);
  const maxVal  = parseFloat(document.getElementById('pm-max').value);
  const proto   = document.getElementById('pm-proto').value.trim();

  if (!name)    { document.getElementById('pm-name').classList.add('pm-error');    document.getElementById('pm-name').focus();    return; }
  if (!dataKey) { document.getElementById('pm-datakey').classList.add('pm-error'); document.getElementById('pm-datakey').focus(); return; }

  const t = PLUGIN_TYPES[type] || PLUGIN_TYPES.custom;
  const plugin = {
    id:      'p-' + Date.now(),
    zone:    _modalZone,
    name,
    type,
    icon:    t.icon,
    dataKey,
    unit:    unit  || t.unit,
    min:     isNaN(minVal) ? t.min : minVal,
    max:     isNaN(maxVal) ? t.max : maxVal,
    color:   t.color,
    proto:   proto || t.proto,
  };

  _plugins.push(plugin);
  _savePlugins();
  _renderPluginRow(plugin);

  if (typeof addAlert === 'function') addAlert('info', `เพิ่ม Sensor "${name}" ใน Zone ${_modalZone + 1} (key: ${dataKey})`);

  document.getElementById('plugin-modal').style.display = 'none';
}

// ── Remove plugin ──

function removePlugin(id) {
  const p = _plugins.find(x => x.id === id);
  _plugins = _plugins.filter(x => x.id !== id);
  _savePlugins();

  const row = document.getElementById('plugin-' + id);
  if (row) {
    row.style.opacity = '0';
    row.style.transition = 'opacity .2s';
    setTimeout(() => row.remove(), 200);
  }

  if (_pluginSparks[id]) { try { _pluginSparks[id].destroy(); } catch(_) {} delete _pluginSparks[id]; }
  delete _pluginSim[id];

  if (p && typeof addAlert === 'function') addAlert('info', `ลบ Sensor "${p.name}" แล้ว`);
}

// ── Remove error highlight on input ──

document.addEventListener('input', e => {
  if (e.target && e.target.classList.contains('pm-error')) e.target.classList.remove('pm-error');
});
