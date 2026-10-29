// Calmer page chrome. (1) The announce bar shows ONE short message at a time (no scrolling marquee), rotating gently.
// (2) On phones the footer link columns fold into tap-to-open sections. (3) On phones the header and the WhatsApp button slide
// away while you scroll down, so they stop covering prices and buttons, and come back on any scroll up. All degrade to the old layout
// if this script does not run.
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function announce() {
    var bar = document.querySelector('.announce'), track = bar && bar.querySelector('.announce-track');
    if (!track) return;
    var items = [].filter.call(track.children, function (s) { return s.getAttribute('aria-hidden') !== 'true'; });   // the marquee repeats every item once for looping
    var msg = document.createElement('div'); msg.className = 'announce-msg'; msg.setAttribute('role', 'status');
    bar.appendChild(msg); bar.classList.add('announce-calm');
    var i = -1, timer = null;
    function visible() { return items.filter(function (s) { return !s.hidden && s.textContent.trim() && s.parentNode; }); }
    function show() {
      var list = visible(); if (!list.length) { msg.textContent = ''; return; }
      i = (i + 1) % list.length;
      msg.style.opacity = 0;
      setTimeout(function () { msg.innerHTML = list[i].innerHTML; msg.style.opacity = 1; }, reduce ? 0 : 280);
    }
    show();
    if (!reduce) timer = setInterval(function () { if (!document.hidden) show(); }, 5200);
    document.addEventListener('munchingo:offer', function () { i = -1; show(); });
  }

  function foldFooter() {
    var top = document.querySelector('.v2-footer .v2-top'); if (!top) return;
    [].forEach.call(top.children, function (col, idx) {
      var h = col.querySelector('h5'), ul = col.querySelector('ul'); if (!h || !ul) return;
      col.classList.add('v2-fold');
      var openByDefault = false;                                        // the floating WhatsApp button is always on screen, so contact can fold too
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'v2-fold-btn'; btn.textContent = h.textContent;
      btn.setAttribute('aria-expanded', openByDefault ? 'true' : 'false');
      if (openByDefault) col.classList.add('open');
      btn.addEventListener('click', function () { var o = col.classList.toggle('open'); btn.setAttribute('aria-expanded', o ? 'true' : 'false'); });
      col.insertBefore(btn, col.firstChild);                              // CSS shows the button on phones only and the normal heading elsewhere
    });
  }

  function calmOnScroll() {
    var phone = window.matchMedia && window.matchMedia('(max-width:720px)'), b = document.body, last = window.scrollY || 0, ticking = false;
    if (!phone) return;
    function busy() { return !!document.querySelector('.nav-open, .search-open'); }
    function update() {
      ticking = false;
      var y = window.scrollY || 0, d = y - last;
      if (!phone.matches || y < 160 || busy()) { b.classList.remove('chrome-away'); last = y; return; }
      if (Math.abs(d) < 8) return;                                       // ignore finger jitter
      b.classList.toggle('chrome-away', d > 0); last = y;
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; (window.requestAnimationFrame || setTimeout)(update); } }, { passive: true });
  }

  function start() { announce(); foldFooter(); calmOnScroll(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
