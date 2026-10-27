/* Listing sections: "Show more" on About, amenity icons, the all-amenities modal,
   the "book on your favourite app" chooser (data/platforms.json) and social links (data/site.json). */
(function () {
  'use strict';

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var haptic = function (ms) { if (window.LVM && window.LVM.haptic) window.LVM.haptic(ms); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var svg = function (body, vb) { return '<svg viewBox="' + (vb || '0 0 24 24') + '" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>'; };

  /* About: Show more / Show less with a smooth height change */
  var more = $('#about-more');
  var toggle = $('.about__toggle');
  if (more && toggle) {
    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      haptic(6);
      if (open) {
        more.style.height = more.scrollHeight + 'px';
        requestAnimationFrame(function () { more.style.height = '0px'; more.classList.remove('is-open'); });
      } else {
        more.classList.add('is-open');
        more.style.height = more.scrollHeight + 'px';
        var done = function () { if (more.classList.contains('is-open')) more.style.height = 'auto'; };
        if (reduceMotion) done(); else more.addEventListener('transitionend', done, { once: true });
      }
      toggle.setAttribute('aria-expanded', String(!open));
      toggle.textContent = open ? 'Show more' : 'Show less';
      if (window.ScrollTrigger) setTimeout(function () { window.ScrollTrigger.refresh(); }, 450);
    });
  }

  /* Amenity icons */
  var ICONS = {
    pool: '<path d="M2 18c2 0 2-1.5 4-1.5S8 18 10 18s2-1.5 4-1.5S16 18 18 18s2-1.5 4-1.5M2 14c2 0 2-1.5 4-1.5S8 14 10 14s2-1.5 4-1.5S16 14 18 14s2-1.5 4-1.5M7 11V5a2 2 0 0 1 4 0M13 11V5a2 2 0 0 1 4 0"/>',
    wifi: '<path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1" fill="currentColor"/>',
    ac: '<path d="M12 2v20M4.2 6.5l15.6 11M19.8 6.5l-15.6 11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5M3 16h18v3h-3v-1.5M6 18.5V17H3M5 11h14"/><circle cx="7.5" cy="13.5" r="1"/><circle cx="16.5" cy="13.5" r="1"/>',
    lawn: '<path d="M3 11l9-6 9 6M5 10v9M19 10v9M3 20h18M9 20v-4h6v4"/>',
    kitchen: '<path d="M4 10h16v3a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6zM2 10h2M20 10h2M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2"/>',
    fridge: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><path d="M6 10h12M9 5.5v2M9 13v3"/>',
    speaker: '<rect x="6" y="2.5" width="12" height="19" rx="2"/><circle cx="12" cy="14.5" r="3.5"/><circle cx="12" cy="7" r="1.2"/>',
    fire: '<path d="M12 21c-3.9 0-7-2.7-7-6.5 0-3.4 2.4-5.3 3.6-8 .9 1.6 1.4 2.8 1.4 4.3 1.7-1.3 2.5-3.6 2.3-6.3 3 1.8 6.7 5.3 6.7 10 0 3.8-3.1 6.5-7 6.5z"/><path d="M12 21c-1.7 0-3-1.1-3-2.8 0-1.8 1.6-2.6 3-4.4 1.4 1.8 3 2.6 3 4.4 0 1.7-1.3 2.8-3 2.8z"/>',
    balcony: '<path d="M3 11h18M3 21h18M5 11v10M9.5 11v10M14.5 11v10M19 11v10M7 11V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v6"/>'
  };
  $$('.offers__list li[data-icon]').forEach(function (li) {
    var body = ICONS[li.getAttribute('data-icon')];
    if (body) li.insertAdjacentHTML('afterbegin', svg(body));
  });

  /* All-amenities modal */
  var modal = $('#amen-modal');
  if (modal) {
    var panel = $('.modal__panel', modal);
    var lastFocus = null;
    var focusables = function () {
      return $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', panel).filter(function (el) { return !el.disabled && el.offsetParent !== null; });
    };
    var openModal = function () {
      lastFocus = document.activeElement;
      modal.hidden = false;
      document.documentElement.classList.add('modal-open');
      if (window.LVM && window.LVM.lenis) window.LVM.lenis.stop();
      requestAnimationFrame(function () {
        modal.classList.add('is-open');
        panel.focus({ preventScroll: true });
      });
      haptic(10);
    };
    var closeModal = function () {
      if (modal.hidden) return;
      modal.classList.remove('is-open');
      document.documentElement.classList.remove('modal-open');
      if (window.LVM && window.LVM.lenis) window.LVM.lenis.start();
      setTimeout(function () { modal.hidden = true; }, reduceMotion ? 0 : 360);
      if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    $$('[data-open-amenities]').forEach(function (b) { b.addEventListener('click', function (e) { e.preventDefault(); openModal(); }); });
    $$('[data-close-modal]', modal).forEach(function (b) { b.addEventListener('click', closeModal); });
    document.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') { closeModal(); return; }
      if (e.key === 'Tab') {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* Booking platforms (data/platforms.json) */
  var list = $('#platform-list');
  if (list && window.fetch) {
    fetch('data/platforms.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !Array.isArray(d.platforms) || !d.platforms.length) return;
      list.innerHTML = d.platforms.map(function (p) {
        var live = p.status === 'live' && p.url;
        var inner =
          '<span class="platform__badge" style="--c:' + esc(p.color || '#4a5d50') + '">' + esc((p.name || '?').charAt(0)) + '</span>' +
          '<span class="platform__name">' + esc(p.name) + '</span>' +
          (live ? '<span class="platform__tag">' + esc(p.tag || '') + '</span><span class="platform__cta">Book</span>'
                : '<span class="platform__pill">' + esc(p.tag || 'Coming soon') + '</span>');
        return live
          ? '<li class="platform platform--live"><a class="platform__link tap" href="' + esc(p.url) + '" target="_blank" rel="noopener" aria-label="Book on ' + esc(p.name) + '">' + inner + '</a></li>'
          : '<li class="platform platform--soon"><div class="platform__link" aria-disabled="true" aria-label="' + esc(p.name) + ', coming soon">' + inner + '</div></li>';
      }).join('');
      $$('.platform--live .platform__link', list).forEach(function (a) { a.addEventListener('click', function () { haptic(10); }); });
    }).catch(function () {});
  }

  /* Social profiles (data/site.json); nothing renders while the list is empty */
  var SOCIAL = {
    instagram: { label: 'Instagram', icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.8" fill="currentColor"/>' },
    facebook: { label: 'Facebook', icon: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>' },
    youtube: { label: 'YouTube', icon: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/>' },
    x: { label: 'X', icon: '<path d="M4 4l16 16M20 4L4 20"/>' },
    linkedin: { label: 'LinkedIn', icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 10v7M8 7v.01M12 17v-4a2 2 0 0 1 4 0v4M12 10v7"/>' }
  };
  var socials = $('#socials');
  if (socials && window.fetch) {
    fetch('data/site.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      var items = (d && Array.isArray(d.socials) ? d.socials : []).filter(function (s) { return s && s.url && SOCIAL[s.network]; });
      if (!items.length) return;
      socials.innerHTML = items.map(function (s) {
        var n = SOCIAL[s.network];
        return '<li><a class="tap" href="' + esc(s.url) + '" target="_blank" rel="me noopener" aria-label="La Villa Mangata on ' + n.label + '">' + svg(n.icon) + '</a></li>';
      }).join('');
      socials.hidden = false;
    }).catch(function () {});
  }
})();
