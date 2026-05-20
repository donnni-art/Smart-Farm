// ── Application Bootstrap & UI Controls ──
// ไฟล์นี้: theme toggle, settings panel, threshold update, clock, boot

// สลับ Dark / Light theme และบันทึกค่า
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  document.getElementById('themeBtn').textContent = isLight ? '🌙 Dark' : '☀️ Light';
  localStorage.setItem('sf_theme', isLight ? 'light' : 'dark');
}

// เปิด/ปิด Settings Panel (accordion)
function toggleSettings() {
  const body  = document.getElementById('settings-body');
  const arrow = document.getElementById('settings-arrow');
  const open  = body.classList.toggle('open');
  arrow.textContent = open ? '▲' : '▼';
}

// เรียกจาก oninput ของ slider ในหน้า HTML
function updateThreshold(key, val) {
  const n = parseInt(val);
  if (key === 'dry')  { thresholds.soilDry  = n; document.getElementById('th-dry-val').textContent  = n; }
  if (key === 'wet')  { thresholds.soilWet  = n; document.getElementById('th-wet-val').textContent  = n; }
  if (key === 'temp') { thresholds.tempHigh = n; document.getElementById('th-temp-val').textContent = n; }
  saveState();
  if (typeof sendThresholds === 'function') sendThresholds();
}

// อัปเดต clock และ uptime counter ทุก 1 วินาที
function updateClock() {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  state.uptime++;
  const h = String(Math.floor(state.uptime / 3600)).padStart(2, '0');
  const m = String(Math.floor((state.uptime % 3600) / 60)).padStart(2, '0');
  const s = String(state.uptime % 60).padStart(2, '0');
  document.getElementById('esp-uptime').textContent = `${h}:${m}:${s}`;
}

// ── Section Visibility — ประกาศ const/let ก่อน IIFE เพื่อหลีกเลี่ยง TDZ ──

const _SECTIONS = [
  { key: 'esp-status', label: '📡 สถานะอุปกรณ์' },
  { key: 'weather',    label: '🌤️ สภาพอากาศ'    },
  { key: 'zones',      label: '🌿 Zone Overview' },
  { key: 'growth',     label: '🌱 วิเคราะห์การเจริญเติบโต' },
  { key: 'sensors',    label: '📊 เซนเซอร์สิ่งแวดล้อม' },
  { key: 'charts',     label: '📈 กราฟย้อนหลัง'  },
  { key: 'prediction', label: '🔮 การทำนายแนวโน้ม' },
  { key: 'scheduler',  label: '📅 ตารางรดน้ำ'    },
  { key: 'camera',     label: '📷 กล้อง'         },
  { key: 'devices',    label: '📱 อุปกรณ์หลายเครื่อง' },
  { key: 'settings',   label: '⚙️ ตั้งค่า'       },
];

let _sectionVis = {};

function _loadSectionVis() {
  try { _sectionVis = JSON.parse(localStorage.getItem('sf_sections') || '{}'); } catch(_) {}
}

function _saveSectionVis() {
  localStorage.setItem('sf_sections', JSON.stringify(_sectionVis));
}

function toggleSection(key, show) {
  _sectionVis[key] = show;
  _saveSectionVis();
  const el = document.querySelector(`[data-section="${key}"]`);
  if (!el) return;
  el.style.display = show ? '' : 'none';
  if (show && (key === 'charts' || key === 'growth')) {
    setTimeout(() => {
      if (typeof renderCharts === 'function') renderCharts();
    }, 50);
  }
}

function toggleLayoutPanel() {
  const panel = document.getElementById('layout-panel');
  if (panel) panel.classList.toggle('open');
}

function initSectionVisibility() {
  _loadSectionVis();
  const list = document.getElementById('layout-list');
  if (list) {
    list.innerHTML = '';
    _SECTIONS.forEach(s => {
      const visible = _sectionVis[s.key] !== false;
      const lbl = document.createElement('label');
      lbl.className = 'layout-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = visible;
      cb.onchange = () => toggleSection(s.key, cb.checked);
      const span = document.createElement('span');
      span.textContent = s.label;
      lbl.appendChild(cb);
      lbl.appendChild(span);
      list.appendChild(lbl);
    });
  }
  _SECTIONS.forEach(s => {
    if (_sectionVis[s.key] === false) {
      const el = document.querySelector(`[data-section="${s.key}"]`);
      if (el) el.style.display = 'none';
    }
  });
  document.addEventListener('click', e => {
    const panel = document.getElementById('layout-panel');
    const btn   = document.getElementById('layout-btn');
    if (panel && panel.classList.contains('open') &&
        !panel.contains(e.target) && btn && !btn.contains(e.target)) {
      panel.classList.remove('open');
    }
  });
}

// ── Boot — เรียก IIFE นี้ตอนโหลดหน้า ──
// ลำดับสำคัญ: initCharts → loadState → restore theme → start timers
(function boot() {
  initCharts();
  loadState();

  // คืนค่า theme จากครั้งก่อน
  if (localStorage.getItem('sf_theme') === 'light') {
    document.body.classList.add('light');
    document.getElementById('themeBtn').textContent = '🌙 Dark';
  }

  // แสดงเวลาเริ่มระบบ
  document.getElementById('start-time').textContent =
    new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });

  setInterval(updateClock, 1000);
  initPlugins();
  initCrops();
  initGrowth();
  initConnection();
  initDB();
  initPrediction();
  initScheduler();
  initNotify();
  initCamera();
  initDevices();
  initSectionVisibility();
})();
