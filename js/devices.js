// ── Multi-Device Management ──
// จัดการ ESP32 หลายเครื่อง — เลือก active device เพื่อสลับการเชื่อมต่อ

let _devices        = [];
let _activeDeviceId = null;

function _loadDevices() {
  try {
    _devices        = JSON.parse(localStorage.getItem('sf_devices')      || '[]');
    _activeDeviceId = localStorage.getItem('sf_active_device')            || null;
  } catch(_) { _devices = []; }
}

function _saveDevices() {
  localStorage.setItem('sf_devices', JSON.stringify(_devices));
}

function renderDevices() {
  const container = document.getElementById('devices-list');
  if (!container) return;
  container.innerHTML = '';

  if (_devices.length === 0) {
    container.innerHTML = '<div class="dev-empty">ยังไม่มีอุปกรณ์ — กด "＋ เพิ่มอุปกรณ์" เพื่อเริ่มต้น</div>';
    return;
  }

  _devices.forEach(dev => {
    const isActive = dev.id === _activeDeviceId;
    const card = document.createElement('div');
    card.className = 'dev-card' + (isActive ? ' dev-active' : '');

    const header = document.createElement('div');
    header.className = 'dev-header';

    const icon = document.createElement('div');
    icon.className = 'dev-icon';
    icon.textContent = '📡';

    const info = document.createElement('div');
    info.className = 'dev-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'dev-name';
    nameEl.textContent = dev.name;
    const urlEl = document.createElement('div');
    urlEl.className = 'dev-url';
    urlEl.textContent = dev.url || 'Simulation Mode';
    info.appendChild(nameEl);
    info.appendChild(urlEl);

    const badge = document.createElement('div');
    badge.className = 'dev-status-badge ' + (isActive ? 'dev-badge-active' : 'dev-badge-idle');
    badge.textContent = isActive ? '● เชื่อมต่ออยู่' : '○ ไม่ได้ใช้งาน';

    header.appendChild(icon);
    header.appendChild(info);
    header.appendChild(badge);

    const footer = document.createElement('div');
    footer.className = 'dev-footer';

    const modeTag = document.createElement('span');
    modeTag.className = 'dev-mode-tag';
    modeTag.textContent = (dev.mode || 'sim').toUpperCase();

    const btns = document.createElement('div');
    btns.className = 'dev-btns';

    const connectBtn = document.createElement('button');
    connectBtn.className = 'dev-connect-btn' + (isActive ? ' active' : '');
    connectBtn.textContent = isActive ? '✓ กำลังใช้งาน' : '🔌 เชื่อมต่อ';
    connectBtn.onclick = () => activateDevice(dev.id);

    const delBtn = document.createElement('button');
    delBtn.className = 'dev-del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => deleteDevice(dev.id);

    btns.appendChild(connectBtn);
    btns.appendChild(delBtn);
    footer.appendChild(modeTag);
    footer.appendChild(btns);

    card.appendChild(header);
    card.appendChild(footer);
    container.appendChild(card);
  });
}

function activateDevice(id) {
  const dev = _devices.find(d => d.id === id);
  if (!dev) return;
  _activeDeviceId = id;
  localStorage.setItem('sf_active_device', id);
  if (typeof connectToDevice === 'function') {
    connectToDevice(dev.mode || 'sim', dev.url || '');
  }
  renderDevices();
  addAlert('info', `เชื่อมต่ออุปกรณ์: ${dev.name}`);
}

function deleteDevice(id) {
  _devices = _devices.filter(d => d.id !== id);
  if (_activeDeviceId === id) {
    _activeDeviceId = null;
    localStorage.removeItem('sf_active_device');
  }
  _saveDevices();
  renderDevices();
}

function submitDeviceForm() {
  const name = (document.getElementById('dev-name')?.value || '').trim();
  const url  = (document.getElementById('dev-url')?.value  || '').trim();
  const mode = document.getElementById('dev-mode')?.value  || 'sim';

  if (!name) { addAlert('warn', 'กรุณาใส่ชื่ออุปกรณ์'); return; }

  const id = 'dev_' + Date.now();
  _devices.push({ id, name, url, mode });
  _saveDevices();
  renderDevices();

  const nameEl = document.getElementById('dev-name');
  const urlEl  = document.getElementById('dev-url');
  if (nameEl) nameEl.value = '';
  if (urlEl)  urlEl.value  = '';
  toggleDevForm(false);
}

function toggleDevForm(forceOpen) {
  const form   = document.getElementById('dev-form');
  const addBtn = document.getElementById('dev-add-btn');
  if (!form) return;
  const open = forceOpen !== undefined ? forceOpen : (form.style.display === 'none' || !form.style.display);
  form.style.display   = open ? '' : 'none';
  if (addBtn) addBtn.style.display = open ? 'none' : '';
}

function initDevices() {
  _loadDevices();
  renderDevices();
}
