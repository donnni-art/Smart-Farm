// ── Smart Farm Node Flow — Canvas Diagram ──
// ไฟล์นี้จัดการทั้งหมดของหน้า flow.html:
//   Node definitions, Edge definitions, Particle animation, Simulation, Interaction

const canvas = document.getElementById('flowCanvas');
const ctx    = canvas.getContext('2d');

// ── Resize canvas ให้เต็ม container ──
function resize() {
  const wrap   = canvas.parentElement;
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  layoutNodes();
}
window.addEventListener('resize', resize);

// ── Node Definitions (ตำแหน่งสัมพัทธ์ 0–1) ──
// rx, ry = สัดส่วนจากขนาด canvas (0.0 = ซ้ายสุด/บนสุด, 1.0 = ขวาสุด/ล่างสุด)
// ry ของ valve nodes ตั้งเป็น 0.88 (เดิม 0.97 ซึ่งถูกตัดขอบล่าง)
const NODE_DEFS = [
  // ── Sensors — Column 1: Built-in ──
  { id:'soil1',    label:'Soil Sensor\nZone 1',    icon:'💧', type:'sensor', proto:'Capacitive · Analog',  rx:0.03, ry:0.15 },
  { id:'soil2',    label:'Soil Sensor\nZone 2',    icon:'💧', type:'sensor', proto:'Capacitive · Analog',  rx:0.03, ry:0.38 },
  { id:'dht22',    label:'DHT22\nTemp/Humid',      icon:'🌡️', type:'sensor', proto:'DHT22 · GPIO',         rx:0.03, ry:0.61 },
  { id:'ds18b20',  label:'DS18B20\nSoil Temp',     icon:'🌱', type:'sensor', proto:'DS18B20 · OneWire',    rx:0.03, ry:0.84 },
  // ── Sensors — Column 2: Optional / Extended ──
  { id:'light',    label:'BH1750\nLight (lux)',     icon:'☀️', type:'sensor', proto:'BH1750 · I2C / LDR',   rx:0.14, ry:0.06 },
  { id:'pressure', label:'BME280\nPressure',        icon:'🌬️', type:'sensor', proto:'BME280 · I2C',         rx:0.14, ry:0.26 },
  { id:'rain',     label:'Rain Sensor\nฝน',         icon:'🌧️', type:'sensor', proto:'Rain Sensor · Analog', rx:0.14, ry:0.46 },
  { id:'wlevel',   label:'HC-SR04\nWater Level',    icon:'🪣', type:'sensor', proto:'HC-SR04 · Ultrasonic', rx:0.14, ry:0.66 },
  { id:'flow',     label:'YF-S201\nFlow Rate',      icon:'💦', type:'sensor', proto:'YF-S201 · Pulse',      rx:0.14, ry:0.86 },
  // ── ESP32 Controller ──
  { id:'esp32',    label:'ESP32\nController',       icon:'🔧', type:'controller', rx:0.29, ry:0.48 },
  // ── Actuators ──
  { id:'relay',    label:'Relay\nModule',            icon:'⚡', type:'actuator',  rx:0.29, ry:0.74 },
  { id:'valve1',   label:'Valve 1\nZone 1',          icon:'🚿', type:'actuator',  rx:0.17, ry:0.88 },
  { id:'valve2',   label:'Valve 2\nZone 2',          icon:'🚿', type:'actuator',  rx:0.26, ry:0.88 },
  { id:'valve3',   label:'Valve 3\nZone 3',          icon:'🚿', type:'actuator',  rx:0.35, ry:0.88 },
  { id:'valve4',   label:'Valve 4\nZone 4',          icon:'🚿', type:'actuator',  rx:0.44, ry:0.88 },
  // ── Network ──
  { id:'wifi',     label:'WiFi Router\n2.4 GHz',     icon:'📡', type:'network',   rx:0.53, ry:0.32 },
  { id:'mqtt',     label:'MQTT Broker\nMosquitto',   icon:'📨', type:'network',   rx:0.67, ry:0.32 },
  // ── Cloud ──
  { id:'tb',       label:'ThingsBoard\nCloud',        icon:'☁️', type:'cloud',    rx:0.81, ry:0.32 },
  // ── Outputs ──
  { id:'dash',     label:'Dashboard\nBrowser',        icon:'🖥️', type:'output',   rx:0.94, ry:0.18 },
  { id:'line',     label:'LINE Notify\nAlerts',       icon:'💬', type:'output',   rx:0.94, ry:0.46 },
  { id:'api',      label:'Weather API\nOpenWeather',  icon:'🌤️', type:'output',   rx:0.94, ry:0.72 },
];

// ── Edge Definitions (การเชื่อมต่อระหว่าง Node) ──
const EDGE_DEFS = [
  // ── Built-in sensors → ESP32 ──
  { from:'soil1',    to:'esp32',  proto:'Analog',      color:'#22c55e', bidi:false },
  { from:'soil2',    to:'esp32',  proto:'Analog',      color:'#22c55e', bidi:false },
  { from:'dht22',    to:'esp32',  proto:'GPIO',        color:'#22c55e', bidi:false },
  { from:'ds18b20',  to:'esp32',  proto:'OneWire',     color:'#22c55e', bidi:false },
  // ── Optional sensors → ESP32 ──
  { from:'light',    to:'esp32',  proto:'I2C/ADC',     color:'#f59e0b', bidi:false },
  { from:'pressure', to:'esp32',  proto:'I2C',         color:'#06b6d4', bidi:false },
  { from:'rain',     to:'esp32',  proto:'Analog',      color:'#3b82f6', bidi:false },
  { from:'wlevel',   to:'esp32',  proto:'Ultrasonic',  color:'#3b82f6', bidi:false },
  { from:'flow',     to:'esp32',  proto:'Pulse',       color:'#22c55e', bidi:false },
  // ── ESP32 → Actuators ──
  { from:'esp32',    to:'relay',  proto:'GPIO',        color:'#f59e0b', bidi:false },
  { from:'relay',    to:'valve1', proto:'12V DC',      color:'#f97316', bidi:false },
  { from:'relay',    to:'valve2', proto:'12V DC',      color:'#f97316', bidi:false },
  { from:'relay',    to:'valve3', proto:'12V DC',      color:'#f97316', bidi:false },
  { from:'relay',    to:'valve4', proto:'12V DC',      color:'#f97316', bidi:false },
  // ── Network / Cloud ──
  { from:'esp32',    to:'wifi',   proto:'WiFi 2.4',    color:'#a855f7', bidi:false },
  { from:'wifi',     to:'mqtt',   proto:'TCP/1883',    color:'#a855f7', bidi:true  },
  { from:'mqtt',     to:'tb',     proto:'MQTT',        color:'#a855f7', bidi:true  },
  { from:'tb',       to:'dash',   proto:'WebSocket',   color:'#06b6d4', bidi:true  },
  { from:'tb',       to:'line',   proto:'HTTPS',       color:'#06b6d4', bidi:false },
  { from:'tb',       to:'api',    proto:'REST API',    color:'#06b6d4', bidi:true  },
  { from:'tb',       to:'esp32',  proto:'RPC CMD',     color:'#3b82f6', bidi:false, dashed:true },
];

const TYPE_COLOR = {
  sensor:'#22c55e', controller:'#3b82f6', actuator:'#f59e0b',
  network:'#a855f7', cloud:'#a855f7', output:'#06b6d4',
};

// ── Runtime State ──
let nodes = {}, edges = [], particles = [];
let totalPackets = 0, totalDataKB = 0, alertsCount = 0, simTick = 0;

// ── Layout — แปลงตำแหน่งสัมพัทธ์เป็น pixel ──
function layoutNodes() {
  const W = canvas.width, H = canvas.height;
  const NW = Math.max(90, Math.min(130, W * 0.09));
  const NH = 58;
  NODE_DEFS.forEach(def => {
    const x = def.rx * W, y = def.ry * H;
    if (!nodes[def.id]) {
      nodes[def.id] = { ...def, x, y, w: NW, h: NH,
        metrics: initMetrics(def.type), hovered: false, selected: false };
    } else {
      Object.assign(nodes[def.id], { x, y, w: NW, h: NH });
    }
  });
  if (edges.length === 0) {
    EDGE_DEFS.forEach(ed => edges.push({ ...ed, particles: [] }));
  }
}

function initMetrics(type) {
  const base = {
    status:'online', uptime:99.9,
    packetsOut:0, packetsIn:0,
    latency: Math.floor(Math.random() * 20) + 5,
    errorRate: (Math.random() * 0.5).toFixed(2),
    lastSeen:'เพิ่งนี้',
  };
  if (type === 'sensor')     return { ...base, value:'--', unit:'', sampleRate:'30s' };
  if (type === 'controller') return { ...base, firmware:'v2.1.4', heap:180, cpu:12 };
  if (type === 'actuator')   return { ...base, state:false, openCount:0 };
  if (type === 'network' || type === 'cloud') return { ...base, throughput:0, connections:0 };
  return base;
}

// ── Shared sensor sync จาก Dashboard ──
let lsSensors = null;
function syncFromDashboard() {
  try {
    const raw = localStorage.getItem('sf_sensors');
    if (!raw) return;
    const snap = JSON.parse(raw);
    if (Date.now() - snap.ts > 10000) {
      document.getElementById('syncBadge').textContent = '⚠ Stale';
      return;
    }
    lsSensors = snap;
    document.getElementById('syncBadge').textContent = '🔗 Synced';
    document.getElementById('syncBadge').style.color = '#22c55e';
  } catch(e) {
    document.getElementById('syncBadge').textContent = '🔗 Local';
  }
}

// ── Particle System ──
function spawnParticle(edge) {
  const fromNode = nodes[edge.from], toNode = nodes[edge.to];
  if (!fromNode || !toNode) return;
  particles.push({
    edge, t: 0,
    speed: 0.004 + Math.random() * 0.003,
    size:  3 + Math.random() * 2,
    color: edge.color,
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].t += particles[i].speed;
    if (particles[i].t >= 1) {
      const dest = nodes[particles[i].edge.to];
      if (dest) dest.metrics.packetsIn++;
      particles.splice(i, 1);
      totalPackets++;
      totalDataKB += 0.05;
    }
  }
}

// ── Bezier Helpers ──
function getBezierPoint(p0x,p0y,p1x,p1y,p2x,p2y,p3x,p3y,t) {
  const mt = 1 - t;
  return {
    x: mt*mt*mt*p0x + 3*mt*mt*t*p1x + 3*mt*t*t*p2x + t*t*t*p3x,
    y: mt*mt*mt*p0y + 3*mt*mt*t*p1y + 3*mt*t*t*p2y + t*t*t*p3y,
  };
}
function getEdgeControlPoints(from, to) {
  const dx = to.x - from.x;
  return { cp1x: from.x + dx*0.4, cp1y: from.y, cp2x: to.x - dx*0.4, cp2y: to.y };
}

// ── Draw ──
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  edges.forEach(drawEdge);
  drawParticles();
  NODE_DEFS.forEach(def => drawNode(nodes[def.id]));
}

function drawGrid() {
  const step = 40;
  ctx.fillStyle = 'rgba(36,52,71,0.4)';
  for (let x = 0; x < canvas.width;  x += step)
    for (let y = 0; y < canvas.height; y += step)
      ctx.fillRect(x, y, 1, 1);
}

function drawEdge(edge) {
  const from = nodes[edge.from], to = nodes[edge.to];
  if (!from || !to) return;
  const { cp1x, cp1y, cp2x, cp2y } = getEdgeControlPoints(from, to);

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.bezierCurveTo(cp1x,cp1y,cp2x,cp2y,to.x,to.y);
  ctx.strokeStyle = edge.color + '55';
  ctx.lineWidth   = 1.5;
  if (edge.dashed) ctx.setLineDash([6,4]);
  ctx.stroke();
  ctx.setLineDash([]);

  const mid = getBezierPoint(from.x,from.y,cp1x,cp1y,cp2x,cp2y,to.x,to.y,0.5);
  ctx.font      = '10px Segoe UI';
  ctx.fillStyle = edge.color + 'aa';
  ctx.textAlign = 'center';
  ctx.fillText(edge.proto, mid.x, mid.y - 6);

  const nearEnd = getBezierPoint(from.x,from.y,cp1x,cp1y,cp2x,cp2y,to.x,to.y,0.96);
  drawArrow(nearEnd.x, nearEnd.y, to.x, to.y, edge.color + '88');
  if (edge.bidi) {
    const nearStart = getBezierPoint(from.x,from.y,cp1x,cp1y,cp2x,cp2y,to.x,to.y,0.04);
    drawArrow(nearStart.x, nearStart.y, from.x, from.y, edge.color + '55');
  }
  ctx.restore();
}

function drawArrow(fromX, fromY, toX, toY, color) {
  const angle = Math.atan2(toY - fromY, toX - fromX), size = 7;
  ctx.save();
  ctx.translate(toX, toY); ctx.rotate(angle);
  ctx.beginPath(); ctx.moveTo(-size,-size/2); ctx.lineTo(0,0); ctx.lineTo(-size,size/2);
  ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  particles.forEach(p => {
    const from = nodes[p.edge.from], to = nodes[p.edge.to];
    if (!from || !to) return;
    const { cp1x,cp1y,cp2x,cp2y } = getEdgeControlPoints(from, to);
    const pos = getBezierPoint(from.x,from.y,cp1x,cp1y,cp2x,cp2y,to.x,to.y,p.t);
    ctx.save();
    ctx.beginPath(); ctx.arc(pos.x,pos.y,p.size+2,0,Math.PI*2);
    ctx.fillStyle = p.color + '33'; ctx.fill();
    ctx.beginPath(); ctx.arc(pos.x,pos.y,p.size,0,Math.PI*2);
    ctx.fillStyle = p.color; ctx.fill();
    ctx.restore();
  });
}

function drawNode(node) {
  if (!node) return;
  const { x, y, w, h, type, icon, label, metrics } = node;
  const color    = TYPE_COLOR[type];
  const isOnline = metrics.status === 'online';
  const nx = x - w/2, ny = y - h/2, r = 10;

  ctx.save();
  if (node.selected || node.hovered) { ctx.shadowColor = color; ctx.shadowBlur = node.selected ? 20 : 10; }

  ctx.beginPath(); roundRect(ctx,nx,ny,w,h,r);
  ctx.fillStyle = node.selected ? '#1e2f45' : '#162032'; ctx.fill();

  ctx.beginPath(); roundRect(ctx,nx,ny,w,h,r);
  ctx.strokeStyle = node.selected ? color : (isOnline ? color+'88' : '#ef444488');
  ctx.lineWidth = node.selected ? 2 : 1.5; ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.beginPath(); roundRect(ctx,nx,ny,w,3,r);
  ctx.fillStyle = color; ctx.fill();

  ctx.beginPath(); ctx.arc(nx+w-10,ny+12,4,0,Math.PI*2);
  ctx.fillStyle = isOnline ? '#22c55e' : '#ef4444'; ctx.fill();

  ctx.font = `${Math.min(18,w*0.16)}px Segoe UI Emoji`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(icon, x - w*0.2, y - 2);

  const lines = label.split('\n');
  ctx.font = `bold ${Math.min(10,w*0.09)}px Segoe UI`;
  ctx.fillStyle = '#e2e8f0'; ctx.textAlign = 'left';
  const lx = x - w*0.05;
  if (lines.length === 2) {
    ctx.fillText(lines[0], lx, y-9, w*0.62);
    ctx.font = `${Math.min(9,w*0.08)}px Segoe UI`; ctx.fillStyle = '#64748b';
    ctx.fillText(lines[1], lx, y+4, w*0.62);
  } else {
    ctx.fillText(label, lx, y, w*0.62);
  }

  let badge = '';
  if (type === 'sensor' && metrics.value !== '--')         badge = metrics.value + metrics.unit;
  if (type === 'controller')                               badge = `CPU ${metrics.cpu}%`;
  if (type === 'actuator' && node.id.startsWith('valve'))  badge = metrics.state ? '● ON' : '○ OFF';
  if (type === 'actuator' && node.id === 'relay')          badge = `${metrics.openCount} ch`;
  if (type === 'network'  || type === 'cloud')             badge = `${metrics.latency}ms`;
  if (type === 'output')                                   badge = `${metrics.packetsIn} rx`;

  if (badge) {
    ctx.font = `bold ${Math.min(9,w*0.08)}px Segoe UI`;
    ctx.textAlign = 'right'; ctx.fillStyle = color + 'cc';
    ctx.fillText(badge, nx+w-8, ny+h-10);
  }
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.quadraticCurveTo(x+w,y,x+w,y+r);
  ctx.lineTo(x+w,y+h-r);
  ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  ctx.lineTo(x+r,y+h);
  ctx.quadraticCurveTo(x,y+h,x,y+h-r);
  ctx.lineTo(x,y+r);
  ctx.quadraticCurveTo(x,y,x+r,y);
}

// ── Simulation Loop ──
function simulate() {
  simTick++;
  syncFromDashboard();

  // อ่านค่าจาก Dashboard (localStorage) ถ้ามี ไม่งั้นสุ่มเอง
  const sensorMap = {
    soil1:    { v:55,    u:'%',    min:10,  max:95,   step:2,   lsKey:'soil1'       },
    soil2:    { v:62,    u:'%',    min:10,  max:95,   step:2,   lsKey:'soil2'       },
    dht22:    { v:29,    u:'°C',   min:18,  max:42,   step:0.8, lsKey:'temp'        },
    ds18b20:  { v:26,    u:'°C',   min:18,  max:35,   step:0.5, lsKey:'stemp'       },
    light:    { v:25000, u:' lux', min:500, max:90000,step:2500,lsKey:'light'       },
    pressure: { v:1013,  u:' hPa', min:990, max:1025, step:0.4, lsKey:'pressure'    },
    rain:     { v:0,     u:'%',    min:0,   max:100,  step:4,   lsKey:'rain'        },
    wlevel:   { v:80,    u:'%',    min:5,   max:100,  step:1.5, lsKey:'waterLevel'  },
    flow:     { v:0,     u:' L/m', min:0,   max:8,    step:0.5, lsKey:'flow'        },
  };
  Object.keys(sensorMap).forEach(id => {
    const n = nodes[id]; if (!n) return;
    const cfg = sensorMap[id];
    let raw;
    if (lsSensors && lsSensors[cfg.lsKey] !== undefined) {
      raw = parseFloat(lsSensors[cfg.lsKey]);
    } else {
      if (n._v === undefined) n._v = cfg.v;
      n._v = Math.min(cfg.max, Math.max(cfg.min, n._v + (Math.random()-0.5)*cfg.step));
      raw = n._v;
    }
    // Format value — light in klux when >= 1000
    if (id === 'light' && raw >= 1000) {
      n.metrics.value = (raw / 1000).toFixed(1);
      n.metrics.unit  = ' klux';
    } else {
      n.metrics.value = raw >= 100 ? raw.toFixed(0) : raw.toFixed(1);
      n.metrics.unit  = cfg.u;
    }
  });

  // Valve states
  const soil1v = parseFloat(nodes['soil1']?.metrics.value || 55);
  const soil2v = parseFloat(nodes['soil2']?.metrics.value || 55);
  if (nodes['valve1']) nodes['valve1'].metrics.state = soil1v < 35;
  if (nodes['valve2']) nodes['valve2'].metrics.state = soil2v < 35;
  if (nodes['relay'])  nodes['relay'].metrics.openCount =
    ['valve1','valve2','valve3','valve4'].filter(id => nodes[id]?.metrics.state).length;

  if (nodes['esp32']) {
    nodes['esp32'].metrics.cpu  = Math.floor(8 + Math.random()*15);
    nodes['esp32'].metrics.heap = Math.floor(170 + Math.random()*30);
  }
  ['wifi','mqtt','tb'].forEach(id => {
    if (nodes[id]) nodes[id].metrics.latency = Math.floor(5 + Math.random()*30);
  });

  // Spawn particles บน active edges
  const ALL_SENSOR_IDS = ['soil1','soil2','dht22','ds18b20','light','pressure','rain','wlevel','flow'];
  const activeEdges = EDGE_DEFS.filter((ed, i) => {
    if (ALL_SENSOR_IDS.includes(ed.from)) return simTick % 10 === i % 10;
    if (ed.from === 'esp32' && ed.to === 'relay') return nodes['relay']?.metrics.openCount > 0;
    return Math.random() < 0.15;
  });
  activeEdges.forEach(ed => {
    const edge = edges.find(e => e.from === ed.from && e.to === ed.to);
    if (edge) { spawnParticle(edge); if (nodes[edge.from]) nodes[edge.from].metrics.packetsOut++; }
  });

  // Stats bar
  const onlineCount  = NODE_DEFS.filter(d => nodes[d.id]?.metrics.status === 'online').length;
  const activeValves = ['valve1','valve2','valve3','valve4'].filter(id => nodes[id]?.metrics.state).length;
  const avgLat = Math.floor(['wifi','mqtt','tb'].reduce((s,id) => s + (nodes[id]?.metrics.latency||0), 0) / 3);
  document.getElementById('sb-ppm').textContent    = Math.floor(totalPackets / Math.max(1, simTick/20));
  document.getElementById('sb-lat').textContent    = avgLat + ' ms';
  document.getElementById('sb-loss').textContent   = '0.0%';
  document.getElementById('sb-nodes').textContent  = `${onlineCount} / ${NODE_DEFS.length}`;
  document.getElementById('sb-valves').textContent = activeValves + ' / 4';
  document.getElementById('sb-alerts').textContent = alertsCount;
  document.getElementById('sb-data').textContent   = totalDataKB.toFixed(1) + ' KB';
}

// ── Interaction ──
canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let any = false;
  NODE_DEFS.forEach(def => {
    const n = nodes[def.id]; if (!n) return;
    const hit = mx >= n.x-n.w/2 && mx <= n.x+n.w/2 && my >= n.y-n.h/2 && my <= n.y+n.h/2;
    n.hovered = hit;
    if (hit) { canvas.style.cursor = 'pointer'; any = true; }
  });
  if (!any) canvas.style.cursor = 'default';
});

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left, my = e.clientY - rect.top;
  let clicked = null;
  NODE_DEFS.forEach(def => {
    const n = nodes[def.id]; if (!n) return;
    if (mx >= n.x-n.w/2 && mx <= n.x+n.w/2 && my >= n.y-n.h/2 && my <= n.y+n.h/2) clicked = n;
    n.selected = false;
  });
  if (clicked) { clicked.selected = true; openPanel(clicked); }
  else closePanel();
});

// Detail panel — ใช้ DOM API ป้องกัน XSS
function openPanel(node) {
  document.getElementById('detailPanel').classList.remove('collapsed');
  document.getElementById('panelTitle').textContent = node.label.replace('\n', ' ');

  const color = TYPE_COLOR[node.type];
  const m     = node.metrics;
  const body  = document.getElementById('panelBody');
  body.innerHTML = '';

  const mkEl = (tag, cls, txt, col) => {
    const el = document.createElement(tag);
    if (cls) el.className   = cls;
    if (txt) el.textContent = txt;
    if (col) el.style.color = col;
    return el;
  };

  body.appendChild(mkEl('div', 'detail-icon', node.icon));
  body.appendChild(mkEl('div', 'detail-name', node.label.replace('\n', ' ')));
  body.appendChild(mkEl('div', 'detail-type', node.type.toUpperCase(), color));

  const grid = document.createElement('div'); grid.className = 'stat-grid';
  [
    [m.status === 'online' ? '● Online' : '● Offline', 'สถานะ', m.status==='online'?'var(--green)':'var(--red)'],
    [m.uptime + '%', 'Uptime', null],
    [String(m.packetsOut), 'Packets Out', 'var(--cyan)'],
    [String(m.packetsIn),  'Packets In',  'var(--blue)'],
  ].forEach(([val, lbl, col]) => {
    const box = document.createElement('div'); box.className = 'stat-box';
    box.appendChild(mkEl('div', 'stat-box-val', val, col));
    box.appendChild(mkEl('div', 'stat-box-lbl', lbl));
    grid.appendChild(box);
  });
  body.appendChild(grid);

  const rows = [];
  if (node.type === 'sensor') {
    rows.push(['ค่าล่าสุด', `${m.value} ${m.unit}`, color]);
    if (node.proto) rows.push(['Protocol', node.proto, 'var(--cyan)']);
    rows.push(['Sample Rate', m.sampleRate, null]);
  }
  if (node.type === 'controller') {
    rows.push(['Firmware', m.firmware, null]);
    rows.push(['Free Heap', `${m.heap} KB`, null]);
    rows.push(['CPU Usage', `${m.cpu}%`, 'var(--yellow)']);
  }
  if (node.type === 'actuator' && node.id.startsWith('valve')) {
    rows.push(['สถานะวาล์ว', m.state ? '● เปิด' : '○ ปิด', m.state ? 'var(--green)' : 'var(--muted)']);
    rows.push(['เปิดวันนี้', `${m.openCount} ครั้ง`, null]);
  }
  if (node.type === 'network' || node.type === 'cloud') {
    rows.push(['Latency', `${m.latency} ms`, 'var(--green)']);
    rows.push(['Error Rate', `${m.errorRate}%`, null]);
  }
  rows.push(['Last Seen', m.lastSeen, 'var(--cyan)']);

  rows.forEach(([lbl, val, col]) => {
    const row = document.createElement('div'); row.className = 'metric-row';
    row.appendChild(mkEl('span', 'metric-label', lbl));
    row.appendChild(mkEl('span', 'metric-value', val, col));
    body.appendChild(row);
  });
}

function closePanel() {
  document.getElementById('detailPanel').classList.add('collapsed');
  NODE_DEFS.forEach(def => { if (nodes[def.id]) nodes[def.id].selected = false; });
}

// ── Clock ──
setInterval(() => {
  document.getElementById('clock').textContent =
    new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
}, 1000);

// ── Main Animation Loop ──
function loop() {
  simulate();
  updateParticles();
  draw();
  requestAnimationFrame(loop);
}

resize();
loop();
