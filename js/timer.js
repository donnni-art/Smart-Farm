// ── Valve Timer — ตั้งเวลารดน้ำ X นาที แล้วปิดอัตโนมัติ ──

const valveTimerSecs = [0, 0, 0, 0];  // เวลาที่เหลือ (วินาที) ต่อวาล์ว
let timerTick = null;

// เริ่มนับถอยหลัง — เรียกจากปุ่ม "ตั้งเวลา"
function startValveTimer(idx) {
  const input = document.getElementById(`v${idx + 1}-timer-input`);
  const minutes = parseFloat(input?.value);

  if (!minutes || minutes <= 0) {
    // กด "ตั้งเวลา" ตอน input ว่าง = ยกเลิก timer
    cancelValveTimer(idx);
    return;
  }

  valveTimerSecs[idx] = Math.round(minutes * 60);

  // เปิดวาล์วถ้ายังปิดอยู่
  if (!state.valves[idx]) {
    state.valveManual[idx] = true;
    setValveState(idx, true);
    const resetBtn = document.getElementById(`v${idx + 1}-reset`);
    if (resetBtn) resetBtn.disabled = false;
  }

  addAlert('info', `⏱ ตั้งเวลารดน้ำวาล์ว ${idx + 1}: ${minutes} นาที`);
  sendNotification('เริ่มรดน้ำ', `วาล์ว ${idx + 1} เปิดแล้ว ตั้งเวลา ${minutes} นาที`);
  updateTimerDisplay(idx);

  // เริ่ม global interval ถ้ายังไม่มี
  if (!timerTick) timerTick = setInterval(tickAllTimers, 1000);
}

// ยกเลิก timer โดยไม่ปิดวาล์ว
function cancelValveTimer(idx) {
  valveTimerSecs[idx] = 0;
  updateTimerDisplay(idx);
  const input = document.getElementById(`v${idx + 1}-timer-input`);
  if (input) input.value = '';
}

// Tick ทุก 1 วินาที — ลดเวลาทุก timer ที่ active
function tickAllTimers() {
  let anyActive = false;
  for (let i = 0; i < 4; i++) {
    if (valveTimerSecs[i] > 0) {
      valveTimerSecs[i]--;
      anyActive = true;
      updateTimerDisplay(i);

      if (valveTimerSecs[i] === 0) {
        // หมดเวลา — ปิดวาล์ว
        if (state.valves[i]) setValveState(i, false);
        // คืน Auto mode สำหรับ zone ที่มี Auto-irrigation (0 และ 1)
        if (i < 2) {
          state.valveManual[i] = false;
          const resetBtn = document.getElementById(`v${i + 1}-reset`);
          if (resetBtn) resetBtn.disabled = true;
          updateValveUI(i);
        }
        addAlert('ok', `วาล์ว ${i + 1} ปิดอัตโนมัติ — หมดเวลารดน้ำ`);
        sendNotification('รดน้ำเสร็จแล้ว', `วาล์ว ${i + 1} ปิดอัตโนมัติแล้ว`);
        const input = document.getElementById(`v${i + 1}-timer-input`);
        if (input) input.value = '';
      }
    }
  }
  if (!anyActive) {
    clearInterval(timerTick);
    timerTick = null;
  }
}

// เริ่ม timer แบบ Programmatic (ไม่อ่านจาก input) — เรียกจาก Scheduler
function startValveTimerProgrammatic(idx, minutes) {
  if (!minutes || minutes <= 0) return;
  valveTimerSecs[idx] = Math.round(minutes * 60);
  const resetBtn = document.getElementById(`v${idx + 1}-reset`);
  if (resetBtn) resetBtn.disabled = false;
  addAlert('info', `⏱ ตั้งเวลารดน้ำวาล์ว ${idx + 1}: ${minutes} นาที (ตามตาราง)`);
  updateTimerDisplay(idx);
  if (!timerTick) timerTick = setInterval(tickAllTimers, 1000);
}

// อัปเดต countdown display ใน valve card
function updateTimerDisplay(idx) {
  const el = document.getElementById(`v${idx + 1}-timer-display`);
  if (!el) return;
  const secs = valveTimerSecs[idx];
  if (secs <= 0) {
    el.textContent  = '';
    el.style.display = 'none';
    return;
  }
  const m = Math.floor(secs / 60);
  const s = String(secs % 60).padStart(2, '0');
  el.textContent   = `⏱ ${m}:${s}`;
  el.style.display = 'inline-flex';
  // แดงเมื่อเหลือน้อยกว่า 1 นาที
  el.style.color   = secs < 60 ? 'var(--red)' : 'var(--cyan)';
}
