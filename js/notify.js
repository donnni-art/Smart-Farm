// ── LINE Notify + Webhook ──
// ส่งการแจ้งเตือนภายนอกผ่าน LINE Notify หรือ Custom Webhook

let _notifyConfig = { lineToken: '', webhookUrl: '', enabled: false };
const _notifyLog  = [];

function _loadNotifyConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('sf_notify') || '{}');
    _notifyConfig = Object.assign({ lineToken: '', webhookUrl: '', enabled: false }, saved);
  } catch(_) {}
}

function _saveNotifyConfig() {
  localStorage.setItem('sf_notify', JSON.stringify(_notifyConfig));
}

function sendLineNotify(msg) {
  if (!_notifyConfig.lineToken) return;
  fetch('https://notify-api.line.me/api/notify', {
    method: 'POST',
    mode: 'no-cors',  // CORS limitation — fire-and-forget
    headers: {
      'Authorization': 'Bearer ' + _notifyConfig.lineToken,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'message=' + encodeURIComponent('\n' + msg),
  }).catch(() => {});
  _addNotifyLog('LINE', msg);
}

function sendWebhook(msg) {
  if (!_notifyConfig.webhookUrl) return;
  fetch(_notifyConfig.webhookUrl, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg, ts: new Date().toISOString(), source: 'SmartFarm' }),
  }).catch(() => {});
  _addNotifyLog('Webhook', msg);
}

// เรียกจากทุกที่ที่ต้องการแจ้งเตือนภายนอก
function sendExternalNotify(msg) {
  if (!_notifyConfig.enabled) return;
  sendLineNotify(msg);
  sendWebhook(msg);
}

function _addNotifyLog(type, msg) {
  const time = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  _notifyLog.unshift({ type, msg, time });
  if (_notifyLog.length > 50) _notifyLog.pop();
  _renderNotifyLog();
}

function _renderNotifyLog() {
  const el = document.getElementById('notify-log');
  if (!el) return;
  el.innerHTML = '';
  if (_notifyLog.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'notify-log-empty';
    empty.textContent = 'ยังไม่มีการส่งการแจ้งเตือน';
    el.appendChild(empty);
    return;
  }
  _notifyLog.slice(0, 20).forEach(entry => {
    const div  = document.createElement('div');
    div.className = 'notify-log-item';
    const typeEl = document.createElement('span');
    typeEl.className = 'notify-log-type';
    typeEl.textContent = entry.type;
    const msgEl = document.createElement('span');
    msgEl.className = 'notify-log-msg';
    msgEl.textContent = entry.msg;
    const timeEl = document.createElement('span');
    timeEl.className = 'notify-log-time';
    timeEl.textContent = entry.time;
    div.appendChild(typeEl);
    div.appendChild(msgEl);
    div.appendChild(timeEl);
    el.appendChild(div);
  });
}

function applyNotifyConfig() {
  _notifyConfig.lineToken  = (document.getElementById('notify-line-token')?.value  || '').trim();
  _notifyConfig.webhookUrl = (document.getElementById('notify-webhook-url')?.value || '').trim();
  _notifyConfig.enabled    = document.getElementById('notify-enabled')?.checked    || false;
  _saveNotifyConfig();
  addAlert('ok', 'บันทึกการตั้งค่าการแจ้งเตือนภายนอกแล้ว');
}

function testNotify() {
  if (!_notifyConfig.enabled) {
    addAlert('warn', 'กรุณาเปิดใช้งานการแจ้งเตือนก่อน แล้วกด "บันทึก"');
    return;
  }
  sendExternalNotify('🧪 ทดสอบการแจ้งเตือน Smart Farm Monitor — ' + new Date().toLocaleTimeString('th-TH'));
  addAlert('info', 'ส่งการแจ้งเตือนทดสอบแล้ว (ใช้เวลาสักครู่)');
}

function toggleNotifySettings() {
  const body  = document.getElementById('notify-body');
  const arrow = document.getElementById('notify-arrow');
  if (!body) return;
  const open = body.classList.toggle('open');
  if (arrow) arrow.textContent = open ? '▲' : '▼';
}

function initNotify() {
  _loadNotifyConfig();
  const lineEl    = document.getElementById('notify-line-token');
  const webhookEl = document.getElementById('notify-webhook-url');
  const enabledEl = document.getElementById('notify-enabled');
  if (lineEl)    lineEl.value    = _notifyConfig.lineToken;
  if (webhookEl) webhookEl.value = _notifyConfig.webhookUrl;
  if (enabledEl) enabledEl.checked = _notifyConfig.enabled;
  _renderNotifyLog();
}
