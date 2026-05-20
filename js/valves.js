// ── Valve Control Logic ──
// ไฟล์นี้จัดการ: เปิด/ปิดวาล์ว, Manual override, Reset to Auto, อัปเดต UI

// เปลี่ยนสถานะวาล์ว (เรียกจากทั้ง Auto และ Manual)
// ไม่ส่ง command ไป hardware — ให้ caller ตัดสินใจเอง
function setValveState(idx, on) {
  if (on && !state.valves[idx]) {
    state.valveCounts[idx]++;
    state.valveLastTime[idx] = new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
  }
  state.valves[idx] = on;

  const cb = document.getElementById(`v${idx + 1}`);
  if (cb) cb.checked = on;

  updateValveUI(idx);
  saveState();
}

// ผู้ใช้กด Toggle สวิตช์ด้วยตนเอง — ล็อค Manual mode และส่ง command ไป ESP32
function manualValve(idx, on) {
  state.valveManual[idx] = true;
  setValveState(idx, on);
  if (typeof sendValveCommand === 'function') sendValveCommand(idx, on);
  addAlert('info', `Manual: ${on ? 'เปิด' : 'ปิด'} วาล์ว ${idx + 1}`);

  const resetBtn = document.getElementById(`v${idx + 1}-reset`);
  if (resetBtn) resetBtn.disabled = false;
}

// คืนวาล์วกลับโหมดอัตโนมัติ — ส่ง {cmd:"auto"} ให้ ESP32 ด้วย
function resetToAuto(idx) {
  state.valveManual[idx] = false;
  if (typeof cancelValveTimer === 'function') cancelValveTimer(idx);
  const resetBtn = document.getElementById(`v${idx + 1}-reset`);
  if (resetBtn) resetBtn.disabled = true;
  if (typeof sendAutoCommand === 'function') sendAutoCommand(idx);
  addAlert('info', `วาล์ว ${idx + 1} คืนค่าเป็นอัตโนมัติแล้ว`);
  updateValveUI(idx);
}

// อัปเดต UI ทั้งหมดของวาล์ว idx (label, border color, สถิติ)
function updateValveUI(idx) {
  const i     = idx + 1;
  const on    = state.valves[idx];
  const label = document.getElementById(`v${i}-label`);
  const card  = document.getElementById(`valve-${i}-card`);

  if (label) {
    label.textContent = on ? 'เปิด' : 'ปิด';
    label.style.color = on ? 'var(--green)' : 'var(--muted)';
  }
  if (card) card.style.borderColor = on ? 'var(--green)' : 'var(--border)';

  const lastEl  = document.getElementById(`v${i}-last`);
  const countEl = document.getElementById(`v${i}-count`);
  if (lastEl)  lastEl.textContent  = state.valveLastTime[idx];
  if (countEl) countEl.textContent = state.valveCounts[idx];

  const modeEl = document.getElementById(`v${i}-mode`);
  if (modeEl) {
    modeEl.textContent = state.valveManual[idx] ? 'Manual' : 'อัตโนมัติ';
    modeEl.style.color = state.valveManual[idx] ? 'var(--yellow)' : 'var(--green)';
  }
}
