// ── Crop Profile System ──
// กำหนด optimal ranges ต่อพืชแต่ละชนิด + per-zone selection

const CROP_PROFILES = {
  vegetable: {
    name: 'ผักทั่วไป', icon: '🥬',
    soil:  { low: 40, high: 70 },
    temp:  { low: 22, high: 33 },
    humid: { low: 55, high: 85 },
    light: { low: 3000, high: 60000 },
    stemp: { low: 18, high: 30 },
  },
  tomato: {
    name: 'มะเขือเทศ', icon: '🍅',
    soil:  { low: 50, high: 75 },
    temp:  { low: 20, high: 30 },
    humid: { low: 50, high: 75 },
    light: { low: 10000, high: 70000 },
    stemp: { low: 18, high: 28 },
  },
  basil: {
    name: 'กะเพรา/โหระพา', icon: '🌿',
    soil:  { low: 40, high: 65 },
    temp:  { low: 24, high: 35 },
    humid: { low: 50, high: 80 },
    light: { low: 5000, high: 60000 },
    stemp: { low: 20, high: 32 },
  },
  chili: {
    name: 'พริก', icon: '🌶️',
    soil:  { low: 35, high: 65 },
    temp:  { low: 25, high: 35 },
    humid: { low: 45, high: 75 },
    light: { low: 8000, high: 70000 },
    stemp: { low: 20, high: 30 },
  },
  lettuce: {
    name: 'ผักกาดหอม', icon: '🥗',
    soil:  { low: 50, high: 80 },
    temp:  { low: 15, high: 25 },
    humid: { low: 60, high: 85 },
    light: { low: 2000, high: 40000 },
    stemp: { low: 12, high: 22 },
  },
  rice: {
    name: 'ข้าว', icon: '🌾',
    soil:  { low: 70, high: 95 },
    temp:  { low: 25, high: 35 },
    humid: { low: 65, high: 90 },
    light: { low: 10000, high: 80000 },
    stemp: { low: 20, high: 32 },
  },
  grass: {
    name: 'สนามหญ้า', icon: '🌱',
    soil:  { low: 35, high: 60 },
    temp:  { low: 18, high: 32 },
    humid: { low: 50, high: 80 },
    light: { low: 5000, high: 70000 },
    stemp: { low: 15, high: 28 },
  },
  tree: {
    name: 'ต้นไม้ทั่วไป', icon: '🌳',
    soil:  { low: 30, high: 60 },
    temp:  { low: 18, high: 38 },
    humid: { low: 45, high: 85 },
    light: { low: 3000, high: 80000 },
    stemp: { low: 15, high: 32 },
  },
};

const _CROP_DEFAULT = ['vegetable', 'vegetable', 'tree', 'grass'];
let _zoneCrops = [..._CROP_DEFAULT];

function _loadCrops() {
  try {
    const saved = JSON.parse(localStorage.getItem('sf_crops') || '[]');
    if (Array.isArray(saved) && saved.length === 4) {
      _zoneCrops = saved.map((k, i) => CROP_PROFILES[k] ? k : _CROP_DEFAULT[i]);
    }
  } catch(_) {}
}

function _saveCrops() {
  localStorage.setItem('sf_crops', JSON.stringify(_zoneCrops));
}

// คืน optimal ranges สำหรับ zone (0-indexed)
function getZoneOpt(zoneIdx) {
  const key = _zoneCrops[zoneIdx] || 'vegetable';
  return CROP_PROFILES[key] || CROP_PROFILES.vegetable;
}

function getZoneCropKey(zoneIdx) {
  return _zoneCrops[zoneIdx] || 'vegetable';
}

function setZoneCrop(zoneIdx, cropKey) {
  if (!CROP_PROFILES[cropKey]) return;
  _zoneCrops[zoneIdx] = cropKey;
  _saveCrops();
  _syncCropSelector(zoneIdx);
  if (typeof updateGrowthAnalysis === 'function') updateGrowthAnalysis();
}

function _syncCropSelector(zoneIdx) {
  const sel    = document.getElementById(`g${zoneIdx + 1}-crop-sel`);
  const iconEl = document.getElementById(`g${zoneIdx + 1}-crop-icon`);
  const key    = _zoneCrops[zoneIdx] || 'vegetable';
  if (sel)    sel.value       = key;
  if (iconEl) iconEl.textContent = CROP_PROFILES[key]?.icon || '🌱';
}

function initCrops() {
  _loadCrops();
  for (let i = 0; i < 4; i++) _syncCropSelector(i);
}
