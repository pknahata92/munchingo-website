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

  // Trio sets carry their flavors in the slug (trio-gift-set-kesari-original-ajwain) but have one price.
  // Gift sets after Diwali (same date and prices as webhook-backend/utils/giftPromo.js). Used only when this browser has no
  // live price list yet, so a sleepy backend can never show the old set price after the switch, and the promo note before it.
  var SET_SWITCH = Date.parse('2026-11-09T00:00:00+05:30'), SET_LIST = { 'trio-gift-set': 949, 'full-range-set': 1199 };
  var PROMO_LABEL = 'Early-grab price till Diwali';
  function keyFor(slug) { return slug && String(slug).indexOf('trio-gift-set') === 0 ? 'trio-gift-set' : slug; }
  function get(slug) { var b = book && book[keyFor(slug)]; return b && typeof b.price === 'number' ? b : null; }
  function price(slug, fallback) {
    var b = get(slug); if (b) return b.price;
    var k = keyFor(slug); if (SET_LIST[k] && Date.now() >= SET_SWITCH) return SET_LIST[k];
    return fallback;
  }
  // The pre-Diwali note for a gift set ({ label, next }), or null once the new price applies.
  function promo(slug) {
    var k = keyFor(slug), b = get(slug);
    if (b) return b.promo && b.promo.next ? b.promo : null;
    return SET_LIST[k] && Date.now() < SET_SWITCH ? { label: PROMO_LABEL, next: SET_LIST[k] } : null;
  }
  // Today's price of a set: the live list, else the price printed on the page (backend asleep), else null.
  function priceNow(slug) {
    var p = price(slug, null); if (p != null) return p;
    var el = document.querySelector('[data-price-for="' + keyFor(slug) + '"]'), n = el ? parseInt(el.textContent.replace(/[^0-9]/g, ''), 10) : NaN;
    return isNaN(n) ? null : n;
  }
  // Before 9 Nov a set shows a short tag and its 9 Nov price struck through, nothing else (Prashant, 29 Oct). Both vanish on
  // their own when the new price applies, so the struck figure is always the price the set really goes to.
  function promoText(slug) { return promo(slug) ? 'Promotional brand pricing' : ''; }
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
    //   data-promo-for="trio-gift-set" -> "Promotional brand pricing" (hidden after the switch)
    //   data-was-for="trio-gift-set"   -> struck "₹949", the 9 Nov price (hidden after the switch)
    Array.prototype.forEach.call(root.querySelectorAll('[data-promo-for]'), function (el) {
      var t = promoText(el.getAttribute('data-promo-for')); el.textContent = t; el.hidden = !t;
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-was-for]'), function (el) {
      var p = promo(el.getAttribute('data-was-for'));
      el.innerHTML = p ? '<span class="sr-only">Price from 9 Nov </span>' + inr(p.next) : ''; el.hidden = !p;
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-price-for]'), function (el) {
      var p = price(el.getAttribute('data-price-for'), null); if (p != null) el.textContent = inr(p);
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-mrp-for]'), function (el) {
      var slug = el.getAttribute('data-mrp-for'), m = mrp(slug, parseInt(el.getAttribute('data-mrp-static') || '0', 10) || null);
      if (m) { el.textContent = inr(m); el.hidden = false; } else { el.hidden = true; }
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-save-for]'), function (el) {
      var slug = el.getAttribute('data-save-for'), pe = document.querySelector('[data-price-for="' + slug + '"]'), p = price(slug, pe ? (parseInt(pe.textContent.replace(/[^0-9]/g, ''), 10) || null) : null), m = mrp(slug, parseInt(el.getAttribute('data-mrp-static') || '0', 10) || null);
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

  window.MunchingoPrices = { get: get, price: price, mrp: mrp, promo: promo, promoText: promoText, inr: inr, apply: apply, ready: !!book };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // Ask the backend what prices are right now; if they changed since this page was built, reload once to pick them up.
  function sync() {
    if (typeof fetch !== 'function' || !/(^|\.)munchingo\.com$/.test(location.hostname)) return;
    fetch(API).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.prices || typeof j.prices !== 'object') return;
      // Compare whole entries (price, MRP, promo), not just the list of names: an array replacer in JSON.stringify would also
      // drop the nested keys, so a changed price used to look unchanged and returning visitors kept the old numbers.
      var canon = function (o) { return JSON.stringify(Object.keys(o || {}).sort().map(function (k) { return [k, o[k]]; })); };
      var fresh = canon(j.prices), had = canon(book);
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
