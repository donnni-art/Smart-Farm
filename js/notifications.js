// ── Browser Push Notifications — Web Notifications API ──
// ส่ง popup แจ้งเตือนเบราว์เซอร์แม้ผู้ใช้ไม่ได้ดูหน้าอยู่

let notifEnabled = false;

const NOTIF_ICON = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect width="100" height="100" rx="20" fill="#162032"/>' +
  '<text y="75" font-size="68" text-anchor="middle" x="50">🌿</text></svg>'
);

// สลับเปิด/ปิด notification — เรียกจากปุ่มใน header
async function toggleNotifications() {
  if (!('Notification' in window)) {
    addAlert('warn', 'เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือน');
    return;
  }
  if (!notifEnabled) {
    const result = await Notification.requestPermission();
    notifEnabled = result === 'granted';
    if (notifEnabled) {
      addAlert('ok', 'เปิดการแจ้งเตือนเบราว์เซอร์แล้ว');
    } else {
      addAlert('warn', 'ไม่ได้รับอนุญาตแจ้งเตือน — ตรวจสอบการตั้งค่าเบราว์เซอร์');
    }
  } else {
    notifEnabled = false;
    addAlert('info', 'ปิดการแจ้งเตือนเบราว์เซอร์แล้ว');
  }
  updateNotifButton();
}

function updateNotifButton() {
  const btn = document.getElementById('notifBtn');
  if (!btn) return;
  if (notifEnabled) {
    btn.textContent      = '🔔 แจ้งเตือน';
    btn.style.color      = 'var(--green)';
    btn.style.borderColor = 'var(--green)';
  } else {
    btn.textContent      = '🔕 แจ้งเตือน';
    btn.style.color      = '';
    btn.style.borderColor = '';
  }
}

// ส่ง notification — จะส่งเฉพาะเมื่อผู้ใช้ไม่ได้ดูหน้าอยู่
function sendNotification(title, body) {
  if (!notifEnabled) return;
  if (document.visibilityState === 'visible') return;
  try {
    new Notification(`🌿 ${title}`, { body, icon: NOTIF_ICON });
  } catch(e) {}
}

// ตรวจสอบ permission เดิม (กรณี reload หน้า)
(function restorePermission() {
  if ('Notification' in window && Notification.permission === 'granted') {
    notifEnabled = true;
    // อัปเดต button หลัง DOM พร้อม
    document.addEventListener('DOMContentLoaded', updateNotifButton, { once: true });
    // กรณี script โหลดหลัง DOMContentLoaded แล้ว
    if (document.readyState !== 'loading') updateNotifButton();
  }
})();
