// Stock-up offer line ("Flat 10% off on Rs 1,500+ of single boxes, up to Rs 300"), pulled live from the shop's own price quote
// so the site can never advertise an offer that is paused or changed. Shows nothing if the offer is off or the shop is unreachable.
// Fills every [data-tier-line] (hidden until the offer is known). Cached per tab for 10 minutes. Exposes MunchingoOffers.tier().
(function () {
  'use strict';
  var API = 'https://munchingo-whatsapp-webhook.onrender.com/api/quote';
  var KEY = 'munchingo_offer_v1', TTL = 10 * 60 * 1000;
  var current = null, waiting = [];
  function rs(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function describe(t) {
    if (!t) return '';
    return t.pct
      ? 'Flat ' + t.pct + '% off on ' + rs(t.min) + '+ of single boxes' + (t.cap ? ', up to ' + rs(t.cap) : '')
      : 'Spend ' + rs(t.min) + ' on single boxes, save ' + rs(t.off);
  }
  function apply(t) {
    current = t;
    [].forEach.call(document.querySelectorAll('[data-tier-line]'), function (el) {
      if (!t) { el.hidden = true; return; }
      var txt = el.querySelector('[data-tier-text]') || el;
      txt.textContent = describe(t);
      el.hidden = false;
    });
    waiting.splice(0).forEach(function (f) { try { f(t); } catch (e) { /* a listener's problem, not the page's */ } });
    try { document.dispatchEvent(new CustomEvent('munchingo:offer')); } catch (e) { /* old browsers */ }
  }
  function pick(tiers) { return tiers && tiers.length ? tiers.slice().sort(function (a, b) { return a.min - b.min; })[0] : null; }
  function load() {
    try {
      var c = JSON.parse(sessionStorage.getItem(KEY));
      if (c && Date.now() - c.at < TTL) return apply(c.tier);
    } catch (e) { /* no storage: just fetch */ }
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: [{ slug: 'atta-original', qty: 3 }] }) })
      .then(function (r) { return r.json(); })
      .then(function (q) {
        var t = q && q.ok ? pick(q.tiers) : null;
        try { sessionStorage.setItem(KEY, JSON.stringify({ at: Date.now(), tier: t })); } catch (e) { /* ignore */ }
        apply(t);
      })
      .catch(function () { apply(null); });
  }
  window.MunchingoOffers = {
    tier: function () { return current; },
    describe: describe,
    ready: function (f) { if (current !== null) f(current); else waiting.push(f); },
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load); else load();
})();
