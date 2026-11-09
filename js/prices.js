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
  // A page may opt out of the reload (the stall tally, where a reload mid-sale could lose the open basket): put data-no-reload on its
  // script tag. Then fresh prices update this page in memory and a 'munchingo:prices' event is dispatched instead.
  var NO_RELOAD = !!(document.currentScript && document.currentScript.hasAttribute('data-no-reload'));
  var book = null;
  try { book = JSON.parse(localStorage.getItem(KEY)); } catch (e) { book = null; }
  if (!book || typeof book !== 'object') book = null;

  // The box rule (9 Nov 2026): a gift box costs the sum of its singles minus 8% (3 boxes) or 12.5% (4 boxes), rounded to a price
  // ending in 9. Same formula as webhook-backend/utils/boxPricing.js, so a set price is never stored: it is worked out from the
  // single-box prices and the rule. The rule lives under its own key so the price book stays a plain slug -> price map.
  var RULE_KEY = 'munchingo_box_rule';
  var DEFAULT_RULE = { 3: 8, 4: 12.5 };
  var DEFAULT_SINGLES = { 'atta-original': 259, 'atta-ajwain': 259, 'atta-kesari': 299, 'atta-lite-sugar': 329 };
  var TOKENS = ['ajwain', 'kesari', 'lite-sugar', 'original'];   // alphabetical, as in a Trio slug
  var rule = null;
  try { rule = JSON.parse(localStorage.getItem(RULE_KEY)); } catch (e) { rule = null; }
  function validRule(r) { return !!r && typeof r === 'object' && [3, 4].every(function (n) { return typeof r[n] === 'number' && isFinite(r[n]) && r[n] >= 0 && r[n] < 100; }); }
  if (!validRule(rule)) rule = null;
  function boxRule() { var r = rule || DEFAULT_RULE; return { 3: r[3], 4: r[4] }; }
  function singlePrice(slug) { var b = book && book[slug]; return b && typeof b.price === 'number' ? b.price : DEFAULT_SINGLES[slug]; }
  // Price of a gift box made of these single slugs (['atta-original', ...]); one or two boxes are just the sum.
  function boxPrice(slugs) {
    var sum = 0; (slugs || []).forEach(function (s) { sum += singlePrice(s) || 0; });
    var pct = (rule || DEFAULT_RULE)[(slugs || []).length];
    if (typeof pct !== 'number') return sum;
    return Math.floor((sum * (1 - pct / 100) + 1) / 10) * 10 - 1;
  }
  function trioTokens(slug) {
    var padded = '-' + String(slug).slice('trio-gift-set'.length) + '-', out = [];
    TOKENS.forEach(function (t) { if (padded.indexOf('-' + t + '-') >= 0) out.push(t); });
    return out.length === 3 ? out : null;
  }
  function trioPrices() {   // the four possible Trios
    return TOKENS.map(function (skip) { return boxPrice(TOKENS.filter(function (t) { return t !== skip; }).map(function (t) { return 'atta-' + t; })); });
  }
  function isSet(slug) { return slug === 'full-range-set' || (typeof slug === 'string' && slug.indexOf('trio-gift-set') === 0); }
  // The price of a set from the rule, or null if the slug is not a set. A bare 'trio-gift-set' is the lowest Trio ("from").
  function setPrice(slug) {
    if (slug === 'full-range-set') return boxPrice(TOKENS.map(function (t) { return 'atta-' + t; }));
    if (!isSet(slug)) return null;
    var t = slug === 'trio-gift-set' ? null : trioTokens(slug);
    return t ? boxPrice(t.map(function (x) { return 'atta-' + x; })) : Math.min.apply(null, trioPrices());
  }
  function get(slug) {
    if (isSet(slug)) return { price: setPrice(slug), mrp: null };
    var b = book && book[slug]; return b && typeof b.price === 'number' ? b : null;
  }
  function price(slug, fallback) { var b = get(slug); return b ? b.price : fallback; }
  // The crossed-out MRP, or null when there is none (MRP equal to the price counts as none). Sets never have one.
  function mrp(slug, fallback) {
    if (isSet(slug)) return null;
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

  window.MunchingoPrices = { get: get, price: price, mrp: mrp, boxPrice: boxPrice, boxRule: boxRule, inr: inr, apply: apply, ready: !!book };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();

  // Ask the backend what prices are right now; if they changed since this page was built, reload once to pick them up.
  function sync() {
    if (typeof fetch !== 'function' || !/(^|\.)munchingo\.com$/.test(location.hostname)) return;
    fetch(API).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.prices || typeof j.prices !== 'object') return;
      // Compare whole entries (price, MRP), not just the list of names: an array replacer in JSON.stringify would also
      // drop the nested keys, so a changed price used to look unchanged and returning visitors kept the old numbers.
      var canon = function (o) { return JSON.stringify(Object.keys(o || {}).sort().map(function (k) { return [k, o[k]]; })); };
      var freshRule = validRule(j.boxRule) ? { 3: j.boxRule[3], 4: j.boxRule[4] } : null;
      var fresh = canon(j.prices) + JSON.stringify(freshRule), had = canon(book) + JSON.stringify(rule);
      if (fresh === had) return;
      if (NO_RELOAD) {
        book = j.prices; rule = freshRule; window.MunchingoPrices.ready = true;
        try {
          localStorage.setItem(KEY, JSON.stringify(j.prices));
          if (freshRule) localStorage.setItem(RULE_KEY, JSON.stringify(freshRule)); else localStorage.removeItem(RULE_KEY);
        } catch (e) { /* storage blocked: the page still has the fresh prices in memory */ }
        apply(); window.dispatchEvent(new Event('munchingo:prices'));
        return;
      }
      try {
        localStorage.setItem(KEY, JSON.stringify(j.prices));
        if (freshRule) localStorage.setItem(RULE_KEY, JSON.stringify(freshRule)); else localStorage.removeItem(RULE_KEY);
        // One reload per tab per price list. With storage blocked we cannot remember, so we just update what is on screen.
        if (sessionStorage.getItem('munchingo_prices_reload') === fresh) return;
        sessionStorage.setItem('munchingo_prices_reload', fresh);
        location.reload();
      } catch (e) { book = j.prices; rule = freshRule; apply(); }
    }).catch(function () { /* backend asleep or offline: keep what we have */ });
  }
  if (document.readyState === 'complete') sync(); else window.addEventListener('load', sync);
})();
