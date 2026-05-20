// ── Camera Widget ──
// จัดการ IP Camera / ESP32-CAM — รองรับ MJPEG, Snapshot, RTSP

let _cameras = [];
const _camTimers = {};

function _loadCameras() {
  try {
    _cameras = JSON.parse(localStorage.getItem('sf_cameras') || '[]');
  } catch(_) { _cameras = []; }
}

function _saveCameras() {
  localStorage.setItem('sf_cameras', JSON.stringify(_cameras));
}

const _CAM_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
  '<rect width="320" height="180" fill="#1e293b"/>' +
  '<text x="160" y="90" font-size="14" fill="#64748b" text-anchor="middle" dy=".3em">ไม่สามารถเชื่อมต่อ</text>' +
  '</svg>'
);

function renderCameras() {
  const container = document.getElementById('cam-list');
  if (!container) return;
  container.innerHTML = '';

  if (_cameras.length === 0) {
    container.innerHTML = '<div class="cam-empty">ยังไม่มีกล้อง — กด "＋ เพิ่มกล้อง" เพื่อเริ่มต้น</div>';
    return;
  }

  _cameras.forEach((cam, idx) => {
    const card = document.createElement('div');
    card.className = 'cam-card';
    card.id = `cam-card-${idx}`;

    const header = document.createElement('div');
    header.className = 'cam-header';
    const nameEl = document.createElement('span');
    nameEl.className = 'cam-name';
    nameEl.textContent = cam.name;
    const actions = document.createElement('div');
    actions.className = 'cam-actions';
    const typeBadge = document.createElement('span');
    typeBadge.className = 'cam-type-badge';
    typeBadge.textContent = cam.type.toUpperCase();
    const delBtn = document.createElement('button');
    delBtn.className = 'cam-del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => deleteCamera(idx);
    actions.appendChild(typeBadge);
    actions.appendChild(delBtn);
    header.appendChild(nameEl);
    header.appendChild(actions);

    const feedWrap = document.createElement('div');
    feedWrap.className = 'cam-feed-wrap';

    if (cam.type === 'mjpeg') {
      const img = document.createElement('img');
      img.className = 'cam-feed';
      img.id = `cam-feed-${idx}`;
      img.alt = cam.name;
      img.src = cam.url;
      img.onerror = () => { img.src = _CAM_PLACEHOLDER; };
      feedWrap.appendChild(img);
    } else if (cam.type === 'snapshot') {
      const img = document.createElement('img');
      img.className = 'cam-feed';
      img.id = `cam-feed-${idx}`;
      img.alt = cam.name;
      img.src = _CAM_PLACEHOLDER;
      img.onerror = () => { img.src = _CAM_PLACEHOLDER; };
      feedWrap.appendChild(img);
      _startSnapshot(idx, cam.url, cam.interval || 5);
    } else {
      // RTSP — แสดง URL เท่านั้น
      const note = document.createElement('div');
      note.className = 'cam-rtsp-note';
      const urlEl = document.createElement('div');
      urlEl.textContent = '🎥 RTSP: ' + cam.url;
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:0.75rem;color:var(--muted);margin-top:6px';
      hint.textContent = 'เปิดด้วย VLC หรือโปรแกรมที่รองรับ RTSP';
      note.appendChild(urlEl);
      note.appendChild(hint);
      feedWrap.appendChild(note);
    }

    card.appendChild(header);
    card.appendChild(feedWrap);
    container.appendChild(card);
  });
}

function _startSnapshot(idx, url, intervalSecs) {
  if (_camTimers[idx]) { clearInterval(_camTimers[idx]); delete _camTimers[idx]; }
  const refresh = () => {
    const img = document.getElementById(`cam-feed-${idx}`);
    if (!img) { clearInterval(_camTimers[idx]); delete _camTimers[idx]; return; }
    img.src = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  };
  refresh();
  _camTimers[idx] = setInterval(refresh, intervalSecs * 1000);
}

function deleteCamera(idx) {
  if (_camTimers[idx]) { clearInterval(_camTimers[idx]); delete _camTimers[idx]; }
  _cameras.splice(idx, 1);
  _saveCameras();
  renderCameras();
}

function submitCamForm() {
  const name     = (document.getElementById('cam-name')?.value    || '').trim();
  const url      = (document.getElementById('cam-url')?.value     || '').trim();
  const type     = document.getElementById('cam-type')?.value     || 'snapshot';
  const interval = parseInt(document.getElementById('cam-interval')?.value || '5');

  if (!name) { addAlert('warn', 'กรุณาใส่ชื่อกล้อง'); return; }
  if (!url && type !== 'rtsp') { addAlert('warn', 'กรุณาใส่ URL กล้อง'); return; }

  _cameras.push({ name, url, type, interval });
  _saveCameras();
  renderCameras();

  const nameEl = document.getElementById('cam-name');
  const urlEl  = document.getElementById('cam-url');
  if (nameEl) nameEl.value = '';
  if (urlEl)  urlEl.value  = '';
  toggleCamForm(false);
}

function toggleCamForm(forceOpen) {
  const form   = document.getElementById('cam-form');
  const addBtn = document.getElementById('cam-add-btn');
  if (!form) return;
  const open = forceOpen !== undefined ? forceOpen : (form.style.display === 'none' || !form.style.display);
  form.style.display   = open ? '' : 'none';
  if (addBtn) addBtn.style.display = open ? 'none' : '';
}

function initCamera() {
  _loadCameras();
  renderCameras();
}
