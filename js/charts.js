// ── Sparkline & Main Chart instances ──
// ประกาศ let ไว้ก่อน — ค่าจริงกำหนดใน initCharts() เมื่อ DOM พร้อม
let sparks    = {};
let chartSoil, chartEnv;
let chartRange = '30m';

// สร้าง sparkline เล็กๆ ใน sensor card
function makeSparkline(id, color) {
  const ctx = document.getElementById(id).getContext('2d');
  return new Chart(ctx, {
    type: 'line',
    data: {
      labels: Array(20).fill(''),
      datasets: [{
        data: Array(20).fill(null),
        borderColor: color, borderWidth: 1.5,
        fill: true, backgroundColor: color + '22',
        pointRadius: 0, tension: 0.4,
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales:  { x: { display: false }, y: { display: false } },
    }
  });
}

// เพิ่มค่าใหม่เข้า sparkline แล้ว render
function pushSparkline(spark, val) {
  const d = spark.data.datasets[0].data;
  d.push(val);
  if (d.length > 20) d.shift();
  spark.update('none');
}

// สร้าง sparklines และกราฟหลัก — เรียกจาก app.js ตอน boot
function initCharts() {
  sparks = {
    soil1:    makeSparkline('spark-soil1',    '#22c55e'),
    soil2:    makeSparkline('spark-soil2',    '#22c55e'),
    temp:     makeSparkline('spark-temp',     '#f59e0b'),
    humid:    makeSparkline('spark-humid',    '#3b82f6'),
    stemp:    makeSparkline('spark-stemp',    '#06b6d4'),
    light:    makeSparkline('spark-light',    '#f59e0b'),
    pressure: makeSparkline('spark-pressure', '#06b6d4'),
    rain:     makeSparkline('spark-rain',     '#3b82f6'),
    wlevel:   makeSparkline('spark-wlevel',   '#3b82f6'),
    flow:     makeSparkline('spark-flow',     '#22c55e'),
  };

  // กราฟความชื้นดิน Zone 1 & 2
  chartSoil = new Chart(document.getElementById('chartSoil').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label:'Zone 1', data:[], borderColor:'#22c55e', backgroundColor:'#22c55e22', borderWidth:2, fill:true,  tension:0.4, pointRadius:0 },
        { label:'Zone 2', data:[], borderColor:'#06b6d4', backgroundColor:'#06b6d422', borderWidth:2, fill:true,  tension:0.4, pointRadius:0 },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration:300 },
      plugins: { legend: { labels: { color:'#e2e8f0', boxWidth:12, font:{ size:11 } } } },
      scales: {
        x: { ticks:{ color:'#64748b', maxTicksLimit:6, font:{ size:10 } }, grid:{ color:'#1e2f45' } },
        y: { min:0, max:100, ticks:{ color:'#64748b', font:{ size:10 } }, grid:{ color:'#1e2f45' } },
      }
    }
  });

  // Resize ให้ถูกต้องหลัง layout settle (แก้ปัญหา Mac HiDPI/Retina)
  requestAnimationFrame(() => { chartSoil.resize(); });

  // กราฟอุณหภูมิ + ความชื้นอากาศ (dual Y-axis)
  chartEnv = new Chart(document.getElementById('chartEnv').getContext('2d'), {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label:'อุณหภูมิ (°C)', data:[], borderColor:'#f59e0b', backgroundColor:'#f59e0b22', borderWidth:2, fill:false, tension:0.4, pointRadius:0, yAxisID:'yT' },
        { label:'ความชื้น (%)',  data:[], borderColor:'#3b82f6', backgroundColor:'#3b82f622', borderWidth:2, fill:true,  tension:0.4, pointRadius:0, yAxisID:'yH' },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, animation: { duration:300 },
      plugins: { legend: { labels: { color:'#e2e8f0', boxWidth:12, font:{ size:11 } } } },
      scales: {
        x:  { ticks:{ color:'#64748b', maxTicksLimit:6, font:{ size:10 } }, grid:{ color:'#1e2f45' } },
        yT: { position:'left',  min:15, max:50,  ticks:{ color:'#f59e0b', font:{ size:10 } }, grid:{ color:'#1e2f45' } },
        yH: { position:'right', min:0,  max:100, ticks:{ color:'#3b82f6', font:{ size:10 } }, grid:{ display:false } },
      }
    }
  });
  requestAnimationFrame(() => { chartEnv.resize(); });
}

// จำนวน data point ที่แสดงตาม chartRange ที่เลือก
function getViewPoints() {
  return { '30m': 600, '1h': 1200, '2h': 2400 }[chartRange] || 600;
}

// อัปเดตกราฟทั้งสองด้วยข้อมูลที่ slice ตาม chartRange
function renderCharts() {
  const n  = getViewPoints();
  const sl = arr => arr.slice(-n);

  chartSoil.data.labels           = sl(state.history.labels);
  chartSoil.data.datasets[0].data = sl(state.history.soil1);
  chartSoil.data.datasets[1].data = sl(state.history.soil2);
  chartSoil.update('none');

  chartEnv.data.labels            = sl(state.history.labels);
  chartEnv.data.datasets[0].data  = sl(state.history.temp);
  chartEnv.data.datasets[1].data  = sl(state.history.humid);
  chartEnv.update('none');
}

// สลับช่วงเวลาที่แสดงในกราฟ — เรียกจากปุ่ม Range Tab
function setChartRange(range) {
  chartRange = range;
  document.querySelectorAll('.chart-range-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'range-' + range);
  });
  renderCharts();
}

// ดาวน์โหลด history ทั้งหมดเป็น CSV
function exportCSV() {
  const rows = [['เวลา', 'ความชื้นดิน Zone1 (%)', 'ความชื้นดิน Zone2 (%)', 'อุณหภูมิ (°C)', 'ความชื้นอากาศ (%)']];
  const len  = state.history.labels.length;
  for (let i = 0; i < len; i++) {
    const fix = v => (typeof v === 'number' ? v.toFixed(1) : '');
    rows.push([
      state.history.labels[i],
      fix(state.history.soil1[i]),
      fix(state.history.soil2[i]),
      fix(state.history.temp[i]),
      fix(state.history.humid[i]),
    ]);
  }
  const csv  = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'smartfarm_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}
