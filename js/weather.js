// ── Weather Widget ──
// ค่าเริ่มต้นเป็น Mock; ตั้งค่า API key จริงผ่าน setWeatherApiKey(city, key)

let wxTimer = null;

const WX_ICONS = {
  '01':'☀️', '02':'⛅', '03':'☁️', '04':'☁️',
  '09':'🌦', '10':'🌧', '11':'🌩', '13':'❄️', '50':'🌫️',
};

function getMockWeather() {
  const pool = [
    { icon:'☀️',  desc:'แดดจัด' },
    { icon:'⛅',  desc:'มีเมฆบางส่วน' },
    { icon:'🌤',  desc:'เมฆมาก' },
    { icon:'🌦',  desc:'ฝนเล็กน้อย' },
    { icon:'🌧',  desc:'ฝนตก' },
    { icon:'🌩',  desc:'ฟ้าคะนอง' },
  ];
  const pick = pool[Math.floor(Date.now() / 3600000) % pool.length];
  return {
    icon:     pick.icon,
    desc:     pick.desc,
    temp:     Math.round(28 + Math.sin(Date.now() / 3600000) * 5),
    humid:    Math.round(60 + Math.cos(Date.now() / 3600000) * 15),
    wind:     Math.round(5  + Math.abs(Math.sin(Date.now() / 7200000)) * 15),
    clouds:   30 + Math.floor(Math.random() * 40),
    location: 'Mock Location',
    source:   'จำลอง',
  };
}

async function fetchWeather() {
  try {
    const key  = localStorage.getItem('sf_weather_key');
    const city = localStorage.getItem('sf_weather_city') || 'Bangkok';

    if (!key) { renderWeather(getMockWeather()); return; }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(key)}&units=metric&lang=th`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error('API error');
    const d = await res.json();

    renderWeather({
      icon:     WX_ICONS[d.weather[0].icon.slice(0, 2)] || '🌡️',
      desc:     d.weather[0].description,
      temp:     Math.round(d.main.temp),
      humid:    d.main.humidity,
      wind:     Math.round(d.wind.speed * 3.6),
      clouds:   d.clouds.all,
      location: d.name,
      source:   'OpenWeatherMap',
    });
  } catch(e) {
    renderWeather(getMockWeather());
  }
}

function renderWeather(wx) {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('wx-icon',     wx.icon);
  set('wx-temp',     wx.temp + ' °C');
  set('wx-desc',     wx.desc);
  set('wx-humid',    wx.humid + '%');
  set('wx-wind',     wx.wind + ' km/h');
  set('wx-clouds',   wx.clouds + '%');
  set('wx-location', wx.location);
  set('wx-updated',
    'อัปเดต: ' +
    new Date().toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' }) +
    ' (' + wx.source + ')'
  );
}

// ตั้งค่า OpenWeatherMap API key และเมือง — เรียกจาก Console หรือ Settings
function setWeatherApiKey(city, key) {
  try {
    localStorage.setItem('sf_weather_city', city);
    localStorage.setItem('sf_weather_key',  key);
    fetchWeather();
    addAlert('info', 'อัปเดต Weather API: ' + city);
  } catch(e) {}
}

(function initWeather() {
  fetchWeather();
  wxTimer = setInterval(fetchWeather, 600000);  // รีเฟรชทุก 10 นาที
})();
