// ── IndexedDB Persistence ──
// เก็บ sensor history ย้อนหลัง 7 วัน — เขียนทุก 30 วินาที

let _db = null;
let _dbLastWrite = 0;
const DB_WRITE_INTERVAL = 30000;

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('SmartFarmDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sensors')) {
        const store = db.createObjectStore('sensors', { keyPath: 'ts' });
        store.createIndex('ts', 'ts', { unique: true });
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = ()  => reject(req.error);
  });
}

// เรียกจาก updateUI() ทุก 3 วินาที — บันทึกเมื่อผ่าน 30 วินาที
function dbWriteSensors() {
  const now = Date.now();
  if (now - _dbLastWrite < DB_WRITE_INTERVAL) return;
  _dbLastWrite = now;
  if (!_db) return;
  try {
    const record = {
      ts:         now,
      soil1:      state.soil1,
      soil2:      state.soil2,
      temp:       state.temp,
      humid:      state.humid,
      stemp:      state.stemp,
      light:      state.light,
      pressure:   state.pressure,
      rain:       state.rain,
      waterLevel: state.waterLevel,
      flow:       state.flow,
    };
    const tx = _db.transaction('sensors', 'readwrite');
    tx.objectStore('sensors').put(record);
  } catch(_) {}
}

// อ่านประวัติย้อนหลัง N ชั่วโมง — คืน Promise<Array>
function dbReadHistory(hours) {
  const since = Date.now() - hours * 3600000;
  return new Promise((resolve, reject) => {
    if (!_db) { resolve([]); return; }
    try {
      const tx    = _db.transaction('sensors', 'readonly');
      const store = tx.objectStore('sensors');
      const range = IDBKeyRange.lowerBound(since);
      const req   = store.index('ts').getAll(range);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror   = ()  => reject(req.error);
    } catch(e) { reject(e); }
  });
}

function _dbCleanOld() {
  if (!_db) return;
  try {
    const cutoff = Date.now() - 7 * 24 * 3600000;
    const tx     = _db.transaction('sensors', 'readwrite');
    const store  = tx.objectStore('sensors');
    const range  = IDBKeyRange.upperBound(cutoff);
    const req    = store.index('ts').openCursor(range);
    req.onsuccess = e => {
      const cursor = e.target.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
  } catch(_) {}
}

function initDB() {
  _openDB().then(db => {
    _db = db;
    _dbCleanOld();
    addAlert('info', 'IndexedDB เชื่อมต่อสำเร็จ — บันทึกข้อมูลย้อนหลัง 7 วัน');
  }).catch(() => {
    addAlert('warn', 'IndexedDB ไม่พร้อมใช้งาน — ประวัติจะไม่ถูกบันทึก');
  });
}
