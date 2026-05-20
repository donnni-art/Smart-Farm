// ── Plant Growth Analysis System ──
// คำนวณ Growth Score จากเซนเซอร์แต่ละ zone + Sensor Simulator

// ── Optimal ranges (พืชผักทั่วไป) ──
const GROWTH_OPT = {
  soil:  { low: 40,   high: 70    },  // % ความชื้นดิน
  temp:  { low: 22,   high: 33    },  // °C อุณหภูมิอากาศ
  humid: { low: 55,   high: 85    },  // % ความชื้นอากาศ
  light: { low: 3000, high: 60000 },  // lux
  stemp: { low: 18,   high: 30    },  // °C อุณหภูมิดิน
};

const GROWTH_W = { soil: 0.35, temp: 0.20, humid: 0.20, light: 0.15, stemp: 0.10 };

// ── Simulator Config ──
const _SIM_CFG = [
  { id:'sim-soil1', key:'soil1', min:0,  max:100,   step:1,   unit:'%',   fmt: v => Math.round(v) + '%',   label:'💧 ดิน Z1'      },
  { id:'sim-soil2', key:'soil2', min:0,  max:100,   step:1,   unit:'%',   fmt: v => Math.round(v) + '%',   label:'💧 ดิน Z2'      },
  { id:'sim-temp',  key:'temp',  min:10, max:50,    step:0.5, unit:'°C',  fmt: v => (+v).toFixed(1) + '°C', label:'🌡️ อุณหภูมิ'   },
  { id:'sim-humid', key:'humid', min:0,  max:100,   step:1,   unit:'%',   fmt: v => Math.round(v) + '%',   label:'🌫️ ความชื้น'  },
  { id:'sim-light', key:'light', min:0,  max:100000,step:500, unit:'lux', fmt: v => v >= 1000 ? (v/1000).toFixed(1) + ' klux' : Math.round(v) + ' lux', label:'☀️ แสง' },
  { id:'sim-stemp', key:'stemp', min:10, max:45,    step:0.5, unit:'°C',  fmt: v => (+v).toFixed(1) + '°C', label:'🌱 อุณหภูมิดิน' },
];

const GROWTH_HIST_MAX = 600;
let _gHistory    = { z1: [], z2: [], labels: [] };
let _gChart      = null;
let _simOverride = false;
const _simVals   = { soil1: 55, soil2: 60, temp: 29, humid: 65, light: 25000, stemp: 26 };

// ── Score Calculation ──

function _fScore(val, low, high) {
  if (val >= low && val <= high) return 100;
  const hw   = (high - low) / 2;
  const dist = val < low ? low - val : val - high;
  return Math.max(0, Math.round(100 * (1 - dist / (hw * 2))));
}

// opts = optional per-crop range overrides (from crops.js getZoneOpt)
function calcGrowthScore(soilPct, temp, humid, light, stemp, hasSoil, opts) {
  const o  = opts || GROWTH_OPT;
  const ts = _fScore(temp,  o.temp?.low  ?? GROWTH_OPT.temp.low,  o.temp?.high  ?? GROWTH_OPT.temp.high);
  const hs = _fScore(humid, o.humid?.low ?? GROWTH_OPT.humid.low, o.humid?.high ?? GROWTH_OPT.humid.high);
  const ls = _fScore(light, o.light?.low ?? GROWTH_OPT.light.low, o.light?.high ?? GROWTH_OPT.light.high);
  const ss = _fScore(stemp, o.stemp?.low ?? GROWTH_OPT.stemp.low, o.stemp?.high ?? GROWTH_OPT.stemp.high);
  if (hasSoil) {
    const ms = _fScore(soilPct, o.soil?.low ?? GROWTH_OPT.soil.low, o.soil?.high ?? GROWTH_OPT.soil.high);
    return {
      total: Math.round(ms * GROWTH_W.soil + ts * GROWTH_W.temp +
                        hs * GROWTH_W.humid + ls * GROWTH_W.light + ss * GROWTH_W.stemp),
      soil: ms, temp: ts, humid: hs, light: ls, stemp: ss,
    };
  }
  return {
    total: Math.round((ts + hs + ls + ss) / 4),
    soil: null, temp: ts, humid: hs, light: ls, stemp: ss,
  };
}

function _growthLevel(score) {
  if (score >= 80) return { label: 'เจริญเติบโตดี',     color: '#22c55e', bg: 'rgba(34,197,94,.13)',  border: '#22c55e44' };
  if (score >= 60) return { label: 'ปานกลาง',           color: '#f59e0b', bg: 'rgba(245,158,11,.13)', border: '#f59e0b44' };
  if (score >= 40) return { label: 'ควรปรับปรุง',       color: '#f97316', bg: 'rgba(249,115,22,.13)', border: '#f97316aa' };
  return               { label: 'ต้องดูแลเร่งด่วน',    color: '#ef4444', bg: 'rgba(239,68,68,.13)',  border: '#ef4444aa' };
}

function _growthRecs(soilPct, temp, humid, light, stemp, hasSoil, opts) {
  const o = opts || GROWTH_OPT, recs = [];
  if (hasSoil) {
    if (soilPct < o.soil.low)       recs.push('💧 ดินแห้ง — ควรรดน้ำให้ถึง ' + o.soil.low + '%');
    else if (soilPct > o.soil.high) recs.push('🚫 ดินชื้นเกิน — หยุดรดน้ำชั่วคราว');
  }
  if (temp > o.temp.high)           recs.push('🌡️ ร้อนเกิน — พรางแสงหรือเพิ่มการระบายอากาศ');
  else if (temp < o.temp.low)       recs.push('🥶 เย็นเกิน — ป้องกันพืชจากอากาศหนาว');
  if (humid < o.humid.low)          recs.push('💨 ความชื้นต่ำ — พ่นหมอกหรือรดน้ำเพิ่ม');
  else if (humid > 90)              recs.push('🌫️ ความชื้นสูงมาก — เพิ่มการระบายอากาศ');
  if (light < o.light.low)          recs.push('☀️ แสงไม่พอ — ตรวจสอบร่มเงาที่บัง');
  else if (light > 80000)           recs.push('🕶️ แสงแดดจัดเกิน — พรางแสง 30–50%');
  if (stemp > o.stemp.high)         recs.push('🌱 อุณหภูมิดินสูง — คลุมดินด้วยฟาง');
  return recs.length ? recs : ['✅ สภาพแวดล้อมเหมาะสมดีแล้ว'];
}

// ── DOM: Update main Growth Cards ──

const _barColor = v =>
  v === null ? '#334155' : v >= 80 ? '#22c55e' : v >= 60 ? '#f59e0b' : '#ef4444';

function _updateCard(zi, sc, lv, recs) {
  const i   = zi + 1;
  const get = id => document.getElementById(id);

  const scoreEl = get(`g${i}-score`);
  if (!scoreEl) return;
  scoreEl.textContent = sc.total;
  scoreEl.style.color = lv.color;

  const ringEl = get(`g${i}-ring`);
  if (ringEl) {
    const circ = 2 * Math.PI * 28;
    ringEl.style.strokeDasharray = `${((sc.total / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`;
    ringEl.style.stroke = lv.color;
  }

  const card = get(`g${i}-card`);
  if (card) card.style.borderColor = lv.border;

  const bdg = get(`g${i}-badge`);
  if (bdg) {
    bdg.textContent      = lv.label;
    bdg.style.color      = lv.color;
    bdg.style.borderColor = lv.color;
    bdg.style.background  = lv.bg;
  }

  [['soil', sc.soil], ['temp', sc.temp], ['humid', sc.humid],
   ['light', sc.light], ['stemp', sc.stemp]].forEach(([key, val]) => {
    const bar = get(`g${i}-${key}-bar`);
    const lbl = get(`g${i}-${key}-lbl`);
    if (bar) { bar.style.width = (val !== null ? Math.max(2, val) : 0) + '%'; bar.style.background = _barColor(val); }
    if (lbl) lbl.textContent = val !== null ? val + '%' : 'N/A';
  });

  const recEl = get(`g${i}-recs`);
  if (recEl) {
    recEl.innerHTML = '';
    recs.slice(0, 2).forEach(r => {
      const d = document.createElement('div');
      d.className = 'growth-rec';
      d.textContent = r;
      recEl.appendChild(d);
    });
  }
}

// ── DOM: Farm Health Summary Bar ──

function _updateFarmHealthBar(scores) {
  const avg = Math.round(scores.reduce((s, sc) => s + sc.total, 0) / scores.length);
  const lv  = _growthLevel(avg);

  const scoreEl = document.getElementById('farm-health-score');
  const labelEl = document.getElementById('farm-health-label');
  const barEl   = document.getElementById('farm-health-bar-fill');

  if (scoreEl) { scoreEl.textContent = avg;      scoreEl.style.color = lv.color; }
  if (labelEl) { labelEl.textContent = lv.label; labelEl.style.color = lv.color; }
  if (barEl)   { barEl.style.width = avg + '%';  barEl.style.background = lv.color; }

  scores.forEach((sc, zi) => {
    const mini = document.getElementById(`fhb-z${zi + 1}`);
    if (!mini) return;
    const mlv = _growthLevel(sc.total);
    mini.textContent    = sc.total;
    mini.style.color    = mlv.color;
    mini.style.borderColor = mlv.color;
    mini.style.background  = mlv.bg;
  });
}

// ── Simulator: Slider Background (shows optimal range as green band) ──

function _updateSliderBg(inp, cfg) {
  const { min, max } = cfg;
  const optKey  = cfg.key === 'soil1' || cfg.key === 'soil2' ? 'soil'
                : cfg.key === 'stemp' ? 'stemp' : cfg.key;
  const optLow  = GROWTH_OPT[optKey]?.low  ?? 0;
  const optHigh = GROWTH_OPT[optKey]?.high ?? 100;
  const pL  = ((optLow  - min) / (max - min) * 100).toFixed(1);
  const pH  = ((optHigh - min) / (max - min) * 100).toFixed(1);
  const cur = ((parseFloat(inp.value) - min) / (max - min) * 100).toFixed(1);
  inp.style.background = `linear-gradient(to right,
    var(--surface2) 0%,
    var(--surface2) ${pL}%,
    #22c55e44 ${pL}%,
    #22c55e44 ${pH}%,
    var(--surface2) ${pH}%,
    var(--surface2) 100%)`;
}

// ── Simulator: Preview Cards (right panel) ──

function _refreshSimPreview() {
  [[_simVals.soil1, true], [_simVals.soil2, true], [null, false], [null, false]]
    .forEach(([soil, hasSoil], zi) => {
      const sc  = calcGrowthScore(soil, _simVals.temp, _simVals.humid, _simVals.light, _simVals.stemp, hasSoil);
      const lv  = _growthLevel(sc.total);
      const scoreEl = document.getElementById(`sim-z${zi + 1}-score`);
      const bdgEl   = document.getElementById(`sim-z${zi + 1}-badge`);
      const ringEl  = document.getElementById(`sim-z${zi + 1}-ring`);
      if (scoreEl) { scoreEl.textContent = sc.total; scoreEl.style.color = lv.color; }
      if (bdgEl)   { bdgEl.textContent = lv.label; bdgEl.style.color = lv.color; bdgEl.style.borderColor = lv.color; bdgEl.style.background = lv.bg; }
      if (ringEl)  {
        const circ = 2 * Math.PI * 22;
        ringEl.style.strokeDasharray = `${((sc.total / 100) * circ).toFixed(1)} ${circ.toFixed(1)}`;
        ringEl.style.stroke = lv.color;
      }
    });
}

// ── Simulator: Sync sliders with live sensor state ──

function _syncSlidersToState() {
  if (_simOverride) return;
  const live = { soil1: state.soil1, soil2: state.soil2, temp: state.temp,
                 humid: state.humid, light: state.light, stemp: state.stemp };
  _SIM_CFG.forEach(cfg => {
    const inp = document.getElementById(cfg.id);
    const val = live[cfg.key];
    if (!inp || val === undefined) return;
    inp.value = Math.min(cfg.max, Math.max(cfg.min, val));
    _simVals[cfg.key] = parseFloat(inp.value);
    const valEl = document.getElementById(cfg.id + '-val');
    if (valEl) valEl.textContent = cfg.fmt(inp.value);
    _updateSliderBg(inp, cfg);
  });
  _refreshSimPreview();
}

// ── Simulator: Public Handlers ──

function onGrowthSimChange() {
  _SIM_CFG.forEach(cfg => {
    const inp = document.getElementById(cfg.id);
    if (!inp) return;
    _simVals[cfg.key] = parseFloat(inp.value);
    const valEl = document.getElementById(cfg.id + '-val');
    if (valEl) valEl.textContent = cfg.fmt(inp.value);
    _updateSliderBg(inp, cfg);
  });
  _refreshSimPreview();

  // Override mode: push slider values to the main growth cards
  if (_simOverride) {
    [[_simVals.soil1, true], [_simVals.soil2, true], [null, false], [null, false]]
      .forEach(([soil, hasSoil], zi) => {
        const sc  = calcGrowthScore(soil, _simVals.temp, _simVals.humid, _simVals.light, _simVals.stemp, hasSoil);
        const lv  = _growthLevel(sc.total);
        const rec = _growthRecs(soil, _simVals.temp, _simVals.humid, _simVals.light, _simVals.stemp, hasSoil);
        _updateCard(zi, sc, lv, rec);
      });

    const scores = [[_simVals.soil1, true], [_simVals.soil2, true], [null, false], [null, false]]
      .map(([soil, hasSoil]) => calcGrowthScore(soil, _simVals.temp, _simVals.humid, _simVals.light, _simVals.stemp, hasSoil));
    _updateFarmHealthBar(scores);
  }
}

function toggleGrowthSimOverride(on) {
  _simOverride = on;

  const panel   = document.getElementById('gsim-panel');
  const badge   = document.getElementById('gsim-status-badge');
  const hint    = document.getElementById('gsim-hint');

  if (badge) {
    badge.textContent    = on ? '🔴 Override Active' : '🟢 Preview Mode';
    badge.style.color    = on ? '#ef4444' : '#22c55e';
    badge.style.borderColor = on ? '#ef4444' : '#22c55e';
    badge.style.background  = on ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)';
  }
  if (panel) panel.classList.toggle('gsim-override-active', on);
  if (hint)  hint.textContent = on
    ? '⚠️ Growth Cards ถูกควบคุมโดย Simulator — Simulation ถูกหยุดชั่วคราว'
    : 'ปรับค่าเซนเซอร์เพื่อดูผลกระทบต่อ Growth Score แบบ Real-time';

  if (on) {
    onGrowthSimChange();
  } else {
    // Resume live values
    updateGrowthAnalysis();
  }
}

// ── Main update — เรียกจาก updateUI() ทุก 3 วินาที ──

function updateGrowthAnalysis() {
  if (_simOverride) return;

  const { soil1, soil2, temp, humid, light, stemp } = state;
  const zoneParams = [[soil1, true], [soil2, true], [null, false], [null, false]];
  const scores = zoneParams.map(([soil, hasSoil], zi) => {
    const opts = typeof getZoneOpt === 'function' ? getZoneOpt(zi) : null;
    return calcGrowthScore(soil, temp, humid, light, stemp, hasSoil, opts);
  });

  zoneParams.forEach(([soil, hasSoil], zi) => {
    const opts = typeof getZoneOpt === 'function' ? getZoneOpt(zi) : null;
    _updateCard(zi, scores[zi], _growthLevel(scores[zi].total),
                _growthRecs(soil, temp, humid, light, stemp, hasSoil, opts));
  });

  _updateFarmHealthBar(scores);
  _syncSlidersToState();

  // History (Zone 1 & 2 เท่านั้น)
  const now = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  _gHistory.z1.push(scores[0].total);
  _gHistory.z2.push(scores[1].total);
  _gHistory.labels.push(now);
  if (_gHistory.z1.length > GROWTH_HIST_MAX) {
    _gHistory.z1.shift(); _gHistory.z2.shift(); _gHistory.labels.shift();
  }
  _renderGChart();
}

function _renderGChart() {
  if (!_gChart) return;
  const n = 200;
  const s = a => a.slice(-n);
  _gChart.data.labels            = s(_gHistory.labels);
  _gChart.data.datasets[0].data  = s(_gHistory.z1);
  _gChart.data.datasets[1].data  = s(_gHistory.z2);
  _gChart.update('none');
}

// ── Init ──

function initGrowth() {
  const canvas = document.getElementById('growthChart');
  if (!canvas) return;

  _gChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Zone 1', data: [], borderColor: '#22c55e', backgroundColor: '#22c55e22',
          borderWidth: 2, fill: true,  tension: 0.4, pointRadius: 0 },
        { label: 'Zone 2', data: [], borderColor: '#06b6d4', backgroundColor: '#06b6d422',
          borderWidth: 2, fill: false, tension: 0.4, pointRadius: 0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration: 300 },
      plugins: { legend: { labels: { color: '#e2e8f0', boxWidth: 12, font: { size: 11 } } } },
      scales: {
        x: { ticks: { color: '#64748b', maxTicksLimit: 6, font: { size: 10 } }, grid: { color: '#1e2f45' } },
        y: { min: 0, max: 100,
             ticks: { color: '#64748b', font: { size: 10 }, callback: v => v + '%' },
             grid: { color: '#1e2f45' } },
      }
    }
  });
  requestAnimationFrame(() => { _gChart.resize(); });

  // Init slider backgrounds
  _SIM_CFG.forEach(cfg => {
    const inp = document.getElementById(cfg.id);
    if (inp) _updateSliderBg(inp, cfg);
  });
  _refreshSimPreview();
}
