// ── Predictive Alert System ──
// Linear regression บน state.history → ทำนายเวลาถึง threshold

function _linReg(arr) {
  const n = arr.length;
  if (n < 6) return null;
  let sx = 0, sy = 0, sxy = 0, sx2 = 0;
  arr.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sx2 += x * x; });
  const denom = n * sx2 - sx * sx;
  if (Math.abs(denom) < 1e-10) return null;
  const slope     = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

// กี่ step จะถึง target จากปลายของ array (คืน null ถ้าไม่ได้)
function _stepsUntil(arr, target) {
  const reg = _linReg(arr);
  if (!reg || Math.abs(reg.slope) < 1e-6) return null;
  const lastX  = arr.length - 1;
  const steps  = (target - reg.intercept - reg.slope * lastX) / reg.slope;
  if (steps <= 0 || steps > 72000) return null;  // ไม่แสดงถ้าเกิน 60 ชั่วโมง
  return steps;
}

function _fmtTime(secs) {
  if (secs < 60)   return secs + ' วินาที';
  if (secs < 3600) return Math.round(secs / 60) + ' นาที';
  return (secs / 3600).toFixed(1) + ' ชั่วโมง';
}

function _makePredItem(icon, color, msg) {
  const item = document.createElement('div');
  item.className = 'pred-item';
  item.style.borderLeftColor = color;
  const ic = document.createElement('span');
  ic.className = 'pred-icon';
  ic.textContent = icon;
  const ms = document.createElement('span');
  ms.className = 'pred-msg';
  ms.textContent = msg;
  item.appendChild(ic);
  item.appendChild(ms);
  return item;
}

// เรียกจาก updateUI() ทุก 3 วินาที
function updatePredictions() {
  const listEl = document.getElementById('pred-list');
  if (!listEl) return;

  const STEP = 3;  // 3 วินาที/step
  const preds = [];

  // Soil 1 → drying
  const s1steps = _stepsUntil(state.history.soil1, thresholds.soilDry);
  if (s1steps !== null) {
    preds.push({ icon: '💧', color: '#06b6d4',
      msg: `ดิน Zone 1 จะแห้งถึง ${thresholds.soilDry}% ในประมาณ ${_fmtTime(Math.round(s1steps * STEP))}` });
  }

  // Soil 2 → drying
  const s2steps = _stepsUntil(state.history.soil2, thresholds.soilDry);
  if (s2steps !== null) {
    preds.push({ icon: '💧', color: '#06b6d4',
      msg: `ดิน Zone 2 จะแห้งถึง ${thresholds.soilDry}% ในประมาณ ${_fmtTime(Math.round(s2steps * STEP))}` });
  }

  // Temp → high
  const tpSteps = _stepsUntil(state.history.temp, thresholds.tempHigh);
  if (tpSteps !== null) {
    preds.push({ icon: '🌡️', color: '#f97316',
      msg: `อุณหภูมิจะถึง ${thresholds.tempHigh}°C ในประมาณ ${_fmtTime(Math.round(tpSteps * STEP))}` });
  }

  // Water level → critical (20%)
  const wl = state.history.humid;  // humid array reuse — water level not in history
  // Use current waterLevel trend from recent readings (not in history obj — skip for now)

  listEl.innerHTML = '';
  if (preds.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'pred-empty';
    empty.textContent = '✅ ไม่พบแนวโน้มที่น่ากังวลในตอนนี้';
    listEl.appendChild(empty);
    return;
  }
  preds.forEach(p => listEl.appendChild(_makePredItem(p.icon, p.color, p.msg)));
}

function initPrediction() {
  // stub — predictions run via updateUI typeof guard
}
