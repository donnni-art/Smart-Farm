// ── Irrigation Scheduler ──
// ตารางรดน้ำรายสัปดาห์ — เช็คทุก 60 วินาที

const DAYS_TH = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
let _schedules = [];
let _schedTick = null;

function _loadSchedules() {
  try {
    _schedules = JSON.parse(localStorage.getItem('sf_schedules') || '[]');
  } catch(_) { _schedules = []; }
}

function _saveSchedules() {
  localStorage.setItem('sf_schedules', JSON.stringify(_schedules));
}

function _checkSchedules() {
  const now  = new Date();
  const day  = now.getDay();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

  _schedules.forEach(s => {
    if (!s.enabled) return;
    if (!s.days.includes(day)) return;
    if (s.time !== hhmm) return;
    if (s._firedAt === hhmm) return;  // ยิงแล้วในนาทีนี้

    let run = false;
    if      (s.condition === 'always')  run = true;
    else if (s.condition === 'if_dry')  run = state.soil1 < thresholds.soilDry || state.soil2 < thresholds.soilDry;
    else if (s.condition === 'no_rain') run = state.rain < 20;

    if (!run) return;
    s._firedAt = hhmm;

    // เปิดวาล์วและเริ่มนับเวลา
    state.valveManual[s.zone] = true;
    setValveState(s.zone, true);
    if (s.duration > 0 && typeof startValveTimerProgrammatic === 'function') {
      startValveTimerProgrammatic(s.zone, s.duration);
    }
    addAlert('info', `⏰ ตารางรดน้ำ: วาล์ว ${s.zone + 1} — ${s.label || 'ไม่ระบุชื่อ'}`);
    if (typeof sendNotification === 'function') sendNotification('ตารางรดน้ำ', `วาล์ว ${s.zone + 1} เริ่มทำงานตามตาราง`);
    if (typeof sendExternalNotify === 'function') sendExternalNotify(`⏰ ตารางรดน้ำ: วาล์ว ${s.zone + 1} — ${s.label || ''}`);
    renderSchedules();
  });
}

function renderSchedules() {
  const listEl = document.getElementById('sched-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (_schedules.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sched-empty';
    empty.textContent = 'ยังไม่มีตารางรดน้ำ — กด "＋ เพิ่มตาราง" เพื่อเริ่มต้น';
    listEl.appendChild(empty);
    return;
  }

  const condMap = { always: 'ทุกครั้ง', if_dry: 'เมื่อดินแห้ง', no_rain: 'เมื่อไม่มีฝน' };
  _schedules.forEach((s, idx) => {
    const item = document.createElement('div');
    item.className = 'sched-item' + (s.enabled ? '' : ' sched-disabled');

    const info = document.createElement('div');
    info.className = 'sched-info';
    const name = document.createElement('div');
    name.className = 'sched-name';
    name.textContent = s.label || 'ไม่ระบุชื่อ';
    const meta = document.createElement('div');
    meta.className = 'sched-meta';
    meta.textContent = `วาล์ว ${s.zone + 1} · ${s.time} น. · ${s.days.map(d => DAYS_TH[d]).join(' ')} · ${condMap[s.condition] || ''} · ${s.duration} นาที`;
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'sched-actions';

    const tog = document.createElement('label');
    tog.className = 'toggle';
    tog.style.transform = 'scale(0.85)';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.enabled;
    cb.onchange = () => toggleSchedule(idx, cb.checked);
    const sliderSpan = document.createElement('span');
    sliderSpan.className = 'slider';
    tog.appendChild(cb);
    tog.appendChild(sliderSpan);

    const delBtn = document.createElement('button');
    delBtn.className = 'sched-del-btn';
    delBtn.textContent = '✕';
    delBtn.onclick = () => deleteSchedule(idx);

    actions.appendChild(tog);
    actions.appendChild(delBtn);
    item.appendChild(info);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

function toggleSchedule(idx, on) {
  if (_schedules[idx]) { _schedules[idx].enabled = on; _saveSchedules(); }
}

function deleteSchedule(idx) {
  _schedules.splice(idx, 1);
  _saveSchedules();
  renderSchedules();
}

function submitScheduleForm() {
  const label    = (document.getElementById('sched-label')?.value    || '').trim();
  const zone     = parseInt(document.getElementById('sched-zone')?.value     || '0');
  const time     = document.getElementById('sched-time')?.value     || '06:00';
  const duration = parseFloat(document.getElementById('sched-dur')?.value   || '10');
  const condition = document.getElementById('sched-cond')?.value   || 'always';

  const days = [];
  document.querySelectorAll('.sched-day-cb:checked').forEach(cb => days.push(parseInt(cb.value)));
  if (days.length === 0) { addAlert('warn', 'กรุณาเลือกอย่างน้อย 1 วัน'); return; }

  _schedules.push({ label, zone, time, duration, condition, days, enabled: true, _firedAt: '' });
  _saveSchedules();
  renderSchedules();

  // ล้างฟอร์ม
  const lblEl = document.getElementById('sched-label');
  const durEl = document.getElementById('sched-dur');
  if (lblEl) lblEl.value = '';
  if (durEl) durEl.value = '10';
  document.querySelectorAll('.sched-day-cb').forEach(cb => cb.checked = false);

  toggleSchedForm(false);
}

function toggleSchedForm(forceOpen) {
  const form   = document.getElementById('sched-form');
  const addBtn = document.getElementById('sched-add-btn');
  if (!form) return;
  const open = forceOpen !== undefined ? forceOpen : (form.style.display === 'none' || !form.style.display);
  form.style.display   = open ? '' : 'none';
  if (addBtn) addBtn.style.display = open ? 'none' : '';
}

function initScheduler() {
  _loadSchedules();
  renderSchedules();
  _schedTick = setInterval(_checkSchedules, 60000);
  _checkSchedules();
}
