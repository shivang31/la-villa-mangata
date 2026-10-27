/* "Live from the villa": ticking villa clock, current weather + sunset from Open-Meteo (free, no key),
   and the visitor's distance to the villa (asked once, only when they tap the button). */
(function () {
  'use strict';

  var VILLA = { lat: 21.2009824, lon: 81.1533676 };
  var $ = function (id) { return document.getElementById(id); };
  if (!$('hud-clock')) return;

  var clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  var hmFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });

  /* Clock */
  function tick() { $('hud-clock').textContent = clockFmt.format(new Date()); }
  tick();
  setInterval(tick, 1000);

  /* Weather + sun */
  var WMO = [
    [[0], 'Clear sky', 'Clear night'],
    [[1, 2], 'Partly cloudy', 'Partly cloudy'],
    [[3], 'Overcast', 'Overcast'],
    [[45, 48], 'Fog', 'Fog'],
    [[51, 53, 55, 56, 57], 'Drizzle', 'Drizzle'],
    [[61, 63, 65, 66, 67], 'Rain', 'Rain'],
    [[71, 73, 75, 77], 'Snow', 'Snow'],
    [[80, 81, 82], 'Rain showers', 'Rain showers'],
    [[95, 96, 99], 'Thunderstorm', 'Thunderstorm']
  ];
  function describe(code, isDay) {
    for (var i = 0; i < WMO.length; i++) if (WMO[i][0].indexOf(code) > -1) return isDay ? WMO[i][1] : WMO[i][2];
    return 'Weather';
  }
  // Open-Meteo returns local IST times without an offset.
  var ist = function (s) { return new Date(s + ':00+05:30'); };
  var sun = null;

  function renderSun() {
    if (!sun) return;
    var t = Date.now();
    var next, label;
    if (t < sun.sunset[0]) {
      if (t < sun.sunrise[0]) { next = sun.sunrise[0]; label = 'Sunrise'; }
      else { next = sun.sunset[0]; label = 'Sunset'; }
    } else { next = sun.sunrise[1]; label = 'Sunrise'; }
    var mins = Math.max(0, Math.round((next - t) / 60000));
    var h = Math.floor(mins / 60), m = mins % 60;
    $('hud-sun-label').textContent = label;
    $('hud-sun').textContent = hmFmt.format(next);
    $('hud-sun-in').textContent = 'in ' + (h ? h + 'h ' : '') + m + 'm';
  }

  function loadWeather() {
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + VILLA.lat.toFixed(4) + '&longitude=' + VILLA.lon.toFixed(4) +
      '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
      '&daily=sunrise,sunset&timezone=Asia%2FKolkata&forecast_days=2';
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      var c = d.current;
      $('hud-temp').textContent = Math.round(c.temperature_2m) + '°C';
      $('hud-cond').textContent = describe(c.weather_code, c.is_day === 1) + ' · ' + Math.round(c.relative_humidity_2m) + '% humidity';
      sun = {
        sunrise: d.daily.sunrise.map(ist),
        sunset: d.daily.sunset.map(ist)
      };
      renderSun();
      $('hud-stamp').textContent = 'Updated ' + hmFmt.format(new Date()) + ' IST · via Open-Meteo';
    }).catch(function () {
      $('hud-cond').textContent = 'Weather unavailable';
      $('hud-stamp').textContent = 'Offline';
    });
  }
  loadWeather();
  setInterval(loadWeather, 10 * 60 * 1000);
  setInterval(renderSun, 30 * 1000);

  /* Distance from the visitor (only after they tap) */
  function haversine(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  var btn = $('hud-locate');
  btn.addEventListener('click', function () {
    if (!('geolocation' in navigator)) { $('hud-drive').textContent = 'Location not supported'; return; }
    btn.textContent = 'Locating…';
    btn.disabled = true;
    navigator.geolocation.getCurrentPosition(function (pos) {
      var km = haversine({ lat: pos.coords.latitude, lon: pos.coords.longitude }, VILLA);
      // Straight-line distance × 1.35 for roads, at ~40 km/h average on local roads.
      var roadKm = km * 1.35;
      var mins = Math.round(roadKm / 40 * 60);
      var h = Math.floor(mins / 60), m = mins % 60;
      $('hud-dist').innerHTML = '<span class="mono">' + (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km</span>';
      $('hud-drive').textContent = '≈ ' + (h ? h + 'h ' : '') + m + 'm drive (approx.)';
    }, function () {
      btn.textContent = 'Measure distance';
      btn.disabled = false;
      $('hud-drive').textContent = 'Location permission was declined';
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  });
})();
