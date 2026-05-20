// ── Alert throttle — ป้องกัน Spam notification ──
// key → timestamp ของครั้งล่าสุดที่แจ้งเตือน
const alertThrottle = {};

// เรียกแทน addAlert() เมื่อต้องการ throttle (เช่น temp สูง)
function addAlertThrottle(key, type, msg) {
  const now = Date.now();
  if (alertThrottle[key] && now - alertThrottle[key] < 60000) return;
  alertThrottle[key] = now;
  addAlert(type, msg);
}

// เพิ่ม alert ลงในรายการ — ใช้ DOM API (ไม่ใช้ innerHTML) เพื่อป้องกัน XSS
function addAlert(type, msg) {
  state.alertCount++;
  document.getElementById('alert-count').textContent = state.alertCount;

  const t        = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  const iconMap  = { warn:'⚠', ok:'✓', info:'ℹ', alert:'!' };
  const classMap = { warn:'a-warn', ok:'a-ok', info:'a-info', alert:'a-warn' };

  const div    = document.createElement('div');
  div.className = 'alert-item';

  const typeEl = document.createElement('div');
  typeEl.className   = `alert-type ${classMap[type] || 'a-info'}`;
  typeEl.textContent = iconMap[type] || 'ℹ';

  const msgEl  = document.createElement('div');
  msgEl.className   = 'alert-msg';
  msgEl.textContent = msg;   // textContent ป้องกัน XSS

  const timeEl = document.createElement('div');
  timeEl.className   = 'alert-time';
  timeEl.textContent = t;

  div.appendChild(typeEl);
  div.appendChild(msgEl);
  div.appendChild(timeEl);

  // ส่งการแจ้งเตือนภายนอกสำหรับ warn / alert
  if ((type === 'warn' || type === 'alert') && typeof sendExternalNotify === 'function') {
    sendExternalNotify(msg);
  }

  const list = document.getElementById('alert-list');
  list.insertBefore(div, list.firstChild);
  // เก็บไว้ไม่เกิน 30 รายการ
  while (list.children.length > 30) list.removeChild(list.lastChild);
}

// ลบ alert ทั้งหมด (เรียกจากปุ่ม "ลบทั้งหมด")
function clearAlerts() {
  document.getElementById('alert-list').innerHTML = '';
  state.alertCount = 0;
  document.getElementById('alert-count').textContent = '0';
}
