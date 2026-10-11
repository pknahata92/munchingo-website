// Live prices for the whole site. The owner sets prices in the admin; the backend serves them at /api/prices.
//
// How it works, so a price is never wrong and the page never waits on the network:
//  1. Every page already contains the launch prices (a safe fallback if the backend is asleep or offline).
//  2. This file runs first, reads the last prices this browser saw (localStorage) and exposes them as
//     window.MunchingoPrices, which products.js, cart.js, the gift builder and the product pages read.
//  3. It then asks the backend. If the answer differs from what the page was built with, it stores the new prices and
//     reloads ONCE, so everything on the page agrees. Checkout never trusts the browser anyway: the server prices the order.
(function () {
  'use strict';
  var KEY = 'munchingo_prices';
  var API = 'https://munchingo-whatsapp-webhook.onrender.com/api/prices';
  var book = null;
  try { book = JSON.parse(localStorage.getItem(KEY)); } catch (e) { book = null; }
  if (!book || typeof book !== 'object') book = null;

  // Trio sets carry their flavours in the slug (trio-gift-set-kesari-original-ajwain) but have one price.
  function keyFor(slug) { return slug && String(slug).indexOf('trio-gift-set') === 0 ? 'trio-gift-set' : slug; }
  function get(slug) { var b = book && book[keyFor(slug)]; return b && typeof b.price === 'number' ? b : null; }
  function price(slug, fallback) { var b = get(slug); return b ? b.price : fallback; }
  // The crossed-out MRP, or null when there is none (MRP equal to the price counts as none).
  function mrp(slug, fallback) {
    var b = get(slug);
    if (!b) return fallback == null ? null : fallback;
    return b.mrp != null && b.mrp > b.price ? b.mrp : null;
  }
  var inr = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };

  // Elements opt in with data attributes; nothing else on the page is touched.
  //   data-price-for="slug"  -> "₹300"        data-mrp-for="slug"  -> "₹350" (hidden when there is no MRP)
  //   data-save-for="slug"   -> "Save ₹51"    (hidden when there is no saving)
  function apply() {
    var root = document;
    Array.prototype.forEach.call(root.querySelectorAll('[data-price-for]'), function (el) {
      var p = price(el.getAttribute('data-price-for'), null); if (p != null) el.textContent = inr(p);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-mrp-for]'), function (el) {
      var slug = el.getAttribute('data-mrp-for'), m = mrp(slug, parseInt(el.getAttribute('data-mrp-static') || '0', 10) || null);
      if (m) { el.textContent = inr(m); el.hidden = false; } else { el.hidden = true; }
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-save-for]'), function (el) {
      var slug = el.getAttribute('data-save-for'), p = price(slug, null), m = mrp(slug, parseInt(el.getAttribute('data-mrp-static') || '0', 10) || null);
      if (m && p != null && m > p) { el.textContent = 'Save ' + inr(m - p); el.hidden = false; } else { el.hidden = true; }
    });
    // Buy buttons carry price/mrp for the cart.
    Array.prototype.forEach.call(root.querySelectorAll('[data-add-to-cart][data-slug]'), function (el) {
      var slug = el.getAttribute('data-slug'), b = get(slug); if (!b) return;
      el.setAttribute('data-price', String(b.price)); var m = mrp(slug, null); if (m) el.setAttribute('data-mrp', String(m)); else el.removeAttribute('data-mrp');
    });
    // Structured data for search engines.
    Array.prototype.forEach.call(root.querySelectorAll('script[type="application/ld+json"]'), function (el) {
      try {
        var d = JSON.parse(el.textContent), changed = false;
        (function walk(o) {
          if (!o || typeof o !== 'object') return;
          if (o.offers && o.offers.price != null && o.name) {
            var slug = slugFromUrl(o.offers.url || '');
            var p = price(slug, null); if (p != null && String(o.offers.price) !== String(p)) { o.offers.price = String(p); changed = true; }
          }
          Object.keys(o).forEach(function (k) { walk(o[k]); });
        })(d);
        if (changed) el.textContent = JSON.stringify(d);
      } catch (e) { /* leave it alone */ }
    });
  }
  function slugFromUrl(u) { var m = String(u).match(/(atta-[a-z-]+?)(?:\.html)?(?:[?#].*)?$/); return m ? m[1] : ''; }

  window.MunchingoPrices = { get: get, price: price, mrp: mrp, inr: inr, apply: apply, ready: !!book };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // Ask the backend what prices are right now; if they changed since this page was built, reload once to pick them up.
  function sync() {
    if (typeof fetch !== 'function' || !/(^|\.)munchingo\.com$/.test(location.hostname)) return;
    fetch(API).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.prices || typeof j.prices !== 'object') return;
      var fresh = JSON.stringify(j.prices, Object.keys(j.prices).sort()), had = JSON.stringify(book || {}, Object.keys(book || {}).sort());
      if (fresh === had) return;
      try {
        localStorage.setItem(KEY, JSON.stringify(j.prices));
        // One reload per tab per price list. With storage blocked we cannot remember, so we just update what is on screen.
        if (sessionStorage.getItem('munchingo_prices_reload') === fresh) return;
        sessionStorage.setItem('munchingo_prices_reload', fresh);
        location.reload();
      } catch (e) { book = j.prices; apply(); }
    }).catch(function () { /* backend asleep or offline: keep what we have */ });
  }
  if (document.readyState === 'complete') sync(); else window.addEventListener('load', sync);
})();
