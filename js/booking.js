/* App-style booking: bottom sheet with a range calendar, live price breakdown, haptics,
   and the "install as app" prompt. Booked dates come from data/availability.json once the owner fills it. */
(function () {
  'use strict';

  var WA = 'https://wa.me/919111333368';
  var RATE = 15000;
  var EXTRA = 1000;            // per extra guest, per night, above 12
  var BASE_GUESTS = 12;
  var MAX_NIGHTS = 14;
  var $ = function (id) { return document.getElementById(id); };
  var sheet = $('sheet');
  if (!sheet) return;
  var panel = sheet.querySelector('.sheet__panel');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var haptic = function (ms) { if (navigator.vibrate) { try { navigator.vibrate(ms || 8); } catch (e) {} } };
  var inr = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var key = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var view = new Date(today.getFullYear(), today.getMonth(), 1);
  var checkin = null, checkout = null;
  var guests = 12;
  var booked = {};

  fetch('data/availability.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
    if (d && d.updated && Array.isArray(d.booked)) {
      d.booked.forEach(function (k) { booked[k] = true; });
      renderCal();
    }
  }).catch(function () {});

  /* Open / close */
  var lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.documentElement.classList.add('sheet-open');
    if (window.LVM && window.LVM.lenis) window.LVM.lenis.stop();
    requestAnimationFrame(function () { sheet.classList.add('is-open'); panel.focus({ preventScroll: true }); });
    haptic(10);
    renderCal();
    renderPrice(true);
  }
  function close() {
    sheet.classList.remove('is-open');
    panel.style.transform = '';
    document.documentElement.classList.remove('sheet-open');
    if (window.LVM && window.LVM.lenis) window.LVM.lenis.start();
    setTimeout(function () { sheet.hidden = true; }, reduceMotion ? 0 : 380);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-open-sheet]').forEach(function (el) {
    el.addEventListener('click', function (e) { e.preventDefault(); open(); });
  });
  sheet.querySelectorAll('[data-close-sheet]').forEach(function (el) { el.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !sheet.hidden) close(); });

  // Swipe down on the grab bar or header to dismiss
  var drag = null;
  function dragStart(e) { drag = { y: e.clientY, dy: 0 }; panel.style.transition = 'none'; }
  function dragMove(e) {
    if (!drag) return;
    drag.dy = Math.max(0, e.clientY - drag.y);
    panel.style.transform = 'translateY(' + drag.dy + 'px)';
  }
  function dragEnd() {
    if (!drag) return;
    panel.style.transition = '';
    if (drag.dy > 110) close(); else panel.style.transform = '';
    drag = null;
  }
  [$('sheet-grab'), sheet.querySelector('.sheet__head')].forEach(function (el) {
    el.addEventListener('pointerdown', function (e) {
      if (e.target.closest('button')) return;
      el.setPointerCapture(e.pointerId);
      dragStart(e);
    });
    el.addEventListener('pointermove', dragMove);
    el.addEventListener('pointerup', dragEnd);
    el.addEventListener('pointercancel', dragEnd);
  });

  /* Calendar */
  var grid = $('cal-grid');
  function renderCal() {
    $('cal-month').textContent = MONTHS[view.getMonth()] + ' ' + view.getFullYear();
    $('cal-prev').disabled = view <= new Date(today.getFullYear(), today.getMonth(), 1);
    var first = new Date(view);
    var lead = (first.getDay() + 6) % 7;            // Monday-first
    var days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var html = '';
    for (var i = 0; i < lead; i++) html += '<span class="cal__blank"></span>';
    for (var d = 1; d <= days; d++) {
      var date = new Date(view.getFullYear(), view.getMonth(), d);
      var k = key(date);
      var past = date < today;
      var isBooked = !!booked[k];
      var cls = ['cal__day', 'tap'];
      if (checkin && k === key(checkin)) cls.push('is-start');
      if (checkout && k === key(checkout)) cls.push('is-end');
      if (checkin && checkout && date > checkin && date < checkout) cls.push('is-range');
      if (k === key(today)) cls.push('is-today');
      if (isBooked) cls.push('is-booked');
      var label = date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) + (isBooked ? ', booked' : '');
      html += '<button type="button" class="' + cls.join(' ') + '" data-key="' + k + '"' + (past || isBooked ? ' disabled' : '') +
        ' aria-label="' + label + '"' + (cls.indexOf('is-start') > -1 || cls.indexOf('is-end') > -1 ? ' aria-pressed="true"' : '') + '>' + d + '</button>';
    }
    grid.innerHTML = html;
    var hint = $('cal-hint');
    if (!checkin) hint.textContent = 'Tap your check-in date';
    else if (!checkout) hint.textContent = 'Now tap your check-out date';
    else hint.textContent = fmt(checkin) + ' → ' + fmt(checkout) + ' · ' + nights() + (nights() === 1 ? ' night' : ' nights');
  }
  var fmt = function (d) { return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); };
  var nights = function () { return checkin && checkout ? Math.round((checkout - checkin) / 864e5) : 0; };
  function rangeHasBooked(a, b) {
    for (var t = new Date(a); t < b; t.setDate(t.getDate() + 1)) if (booked[key(t)]) return true;
    return false;
  }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.cal__day');
    if (!b || b.disabled) return;
    var parts = b.getAttribute('data-key').split('-');
    var date = new Date(+parts[0], +parts[1] - 1, +parts[2]);
    haptic(8);
    $('sheet-error').textContent = '';
    if (!checkin || checkout || date <= checkin) {
      checkin = date; checkout = null;
    } else if ((date - checkin) / 864e5 > MAX_NIGHTS) {
      $('sheet-error').textContent = 'For stays longer than ' + MAX_NIGHTS + ' nights, message us on WhatsApp.';
      return;
    } else if (rangeHasBooked(checkin, date)) {
      $('sheet-error').textContent = 'Some of those nights are already booked. Pick other dates.';
      return;
    } else {
      checkout = date;
      haptic([8, 40, 12]);
    }
    renderCal();
    renderPrice();
  });
  $('cal-prev').addEventListener('click', function () { view.setMonth(view.getMonth() - 1); haptic(6); renderCal(); });
  $('cal-next').addEventListener('click', function () { view.setMonth(view.getMonth() + 1); haptic(6); renderCal(); });

  // Swipe sideways on the calendar to change month
  var sx = null;
  grid.addEventListener('pointerdown', function (e) { sx = e.clientX; });
  grid.addEventListener('pointerup', function (e) {
    if (sx === null) return;
    var dx = e.clientX - sx; sx = null;
    if (Math.abs(dx) < 60) return;
    if (dx < 0) $('cal-next').click(); else if (!$('cal-prev').disabled) $('cal-prev').click();
  });

  /* Guests */
  function renderGuests() {
    $('sg-out').textContent = guests;
    $('sg-down').disabled = guests <= 1;
    $('sg-up').disabled = guests >= 30;
  }
  $('sg-down').addEventListener('click', function () { if (guests > 1) { guests--; haptic(6); renderGuests(); renderPrice(); } });
  $('sg-up').addEventListener('click', function () { if (guests < 30) { guests++; haptic(6); renderGuests(); renderPrice(); } });
  renderGuests();
  sheet.querySelectorAll('.chips input').forEach(function (r) { r.addEventListener('change', function () { haptic(6); }); });

  /* Price with a counting animation */
  var shown = 0, raf = null;
  function animateTo(el, target) {
    if (raf) cancelAnimationFrame(raf);
    if (reduceMotion) { el.textContent = inr(target); shown = target; return; }
    var from = shown, t0 = performance.now(), dur = 520;
    (function step(t) {
      var p = Math.min(1, (t - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      shown = from + (target - from) * e;
      el.textContent = inr(shown);
      if (p < 1) raf = requestAnimationFrame(step);
    })(t0);
  }
  function renderPrice(instant) {
    var n = nights();
    var extraGuests = Math.max(0, guests - BASE_GUESTS);
    var villa = RATE * n;
    var extra = EXTRA * extraGuests * n;
    var total = villa + extra;
    $('bd-nights-label').textContent = 'Villa, ' + n + (n === 1 ? ' night' : ' nights') + ' × ' + inr(RATE);
    $('bd-villa').textContent = inr(villa);
    $('bd-extra-row').hidden = extraGuests === 0;
    $('bd-extra-label').textContent = extraGuests + ' extra ' + (extraGuests === 1 ? 'guest' : 'guests') + ' × ' + inr(EXTRA) + ' × ' + n;
    $('bd-extra').textContent = inr(extra);
    if (instant) { shown = total; $('bd-total').textContent = inr(total); } else animateTo($('bd-total'), total);
    $('bd-pp').textContent = n ? inr(total / guests) + ' per person for the stay' : 'Pick dates to see the price';
  }

  /* Send */
  $('sheet-send').addEventListener('click', function () {
    var err = $('sheet-error');
    if (!checkin || !checkout) { err.textContent = 'Pick your check-in and check-out dates on the calendar.'; haptic([20, 40, 20]); return; }
    var name = $('sheet-name').value.trim();
    if (!name) { err.textContent = 'Enter your name so we know who to reply to.'; $('sheet-name').focus(); haptic([20, 40, 20]); return; }
    err.textContent = '';
    var occasion = (sheet.querySelector('.chips input:checked') || {}).value || 'Weekend stay';
    var n = nights();
    var total = RATE * n + EXTRA * Math.max(0, guests - BASE_GUESTS) * n;
    var msg = 'Hi, I would like to book La Villa Mangata.\n' +
      'Check-in: ' + fmt(checkin) + ' ' + checkin.getFullYear() + '\n' +
      'Check-out: ' + fmt(checkout) + ' ' + checkout.getFullYear() + ' (' + n + (n === 1 ? ' night' : ' nights') + ')\n' +
      'Guests: ' + guests + '\n' +
      'Occasion: ' + occasion + '\n' +
      'Estimated total: ' + inr(total) + '\n' +
      'Name: ' + name;
    haptic([10, 30, 10]);
    window.open(WA + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  /* Install as an app */
  var deferred = null;
  var installBtn = $('install-btn');
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
  });
  installBtn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.finally(function () { deferred = null; installBtn.hidden = true; });
  });
  var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (isIOS && !standalone) $('install-ios').hidden = false;

  renderCal();
  renderPrice(true);
})();
