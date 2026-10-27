// Munchingo cart — client-side only, no backend. Hands off to WhatsApp at checkout.
(function () {
  var KEY = 'munchingo_cart';
  var GIFT_NOTE_KEY = 'munchingo_gift_note';
  var WA_NUMBER = '919988992024';

  // Sold-out flavors for the website only (WhatsApp ordering reflects stock
  // set separately in Meta Commerce Manager). The owner toggles flavors in the
  // admin; the backend serves the live list at /api/stock and is also what
  // actually blocks a sold-out item at checkout — this file only controls what
  // the UI shows before that. The last list seen is cached so every page paints
  // the right state at once; if the live list differs, the page reloads once.
  var STOCK_API = 'https://munchingo-whatsapp-webhook.onrender.com/api/stock';
  var STOCK_KEY = 'munchingo_soldout';
  var SOLD_OUT_SLUGS = [];
  try { SOLD_OUT_SLUGS = JSON.parse(localStorage.getItem(STOCK_KEY)) || []; } catch (e) { SOLD_OUT_SLUGS = []; }
  if (!Array.isArray(SOLD_OUT_SLUGS)) SOLD_OUT_SLUGS = [];

  function syncStock() {
    if (typeof fetch !== 'function' || !/(^|\.)munchingo\.com$/.test(location.hostname)) return;
    fetch(STOCK_API).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !Array.isArray(j.soldOut)) return;
      var fresh = j.soldOut.slice().sort().join(','), had = SOLD_OUT_SLUGS.slice().sort().join(',');
      if (fresh === had) return;
      // Only reload if the new list could be remembered; with storage blocked (private mode) the next load would
      // see the same difference and reload forever. One reload per tab session at most.
      try {
        localStorage.setItem(STOCK_KEY, JSON.stringify(j.soldOut));
        if (sessionStorage.getItem('munchingo_stock_reload') === fresh) return;
        sessionStorage.setItem('munchingo_stock_reload', fresh);
        location.reload();
      } catch (e) { SOLD_OUT_SLUGS = j.soldOut; }
    }).catch(function () { /* backend asleep or offline: keep what we have; checkout still enforces it */ });
  }

  function isSlugSoldOut(slug) {
    if (!slug) return false;
    if (SOLD_OUT_SLUGS.indexOf(slug) !== -1) return true;
    if (slug === 'full-range-set') return SOLD_OUT_SLUGS.length > 0;
    if (slug.indexOf('trio-gift-set-') === 0) {
      return SOLD_OUT_SLUGS.some(function (soldSlug) {
        var token = soldSlug.replace(/^atta-/, '');
        return new RegExp('(^|-)' + token + '(-|$)').test(slug);
      });
    }
    return false;
  }
  // Whether a trio-picker flavor value (e.g. "Lite-sugar") is sold out.
  function isFlavourSoldOut(flavourValue) {
    var token = flavourValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return SOLD_OUT_SLUGS.indexOf('atta-' + token) !== -1;
  }

  // Items in a saved bag are re-priced from the live price list every time the bag is read, so a customer who added a
  // box at yesterday's price sees (and is charged) today's. The server prices the order itself at checkout regardless.
  function getCart() {
    var cart;
    try { cart = JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
    var P = window.MunchingoPrices;
    if (P && P.ready) cart.forEach(function (c) {
      var b = P.get(c.slug); if (!b) return;
      c.price = b.price; var m = P.mrp(c.slug, null); if (m) c.mrp = m; else delete c.mrp;
    });
    return cart;
  }
  function saveCart(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    renderBadge();
    // Lets other scripts (the sticky bag bar) react to any cart change.
    try { document.dispatchEvent(new CustomEvent('munchingo:cart')); } catch (e) { /* old browsers: bar refreshes on next page */ }
  }

  // Optional gift note — set on cart.html, read (and cleared after a
  // successful order) on checkout.html. Separate key from the cart itself
  // so it survives independently of cart edits.
  function getGiftNote() {
    try { return localStorage.getItem(GIFT_NOTE_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setGiftNote(note) {
    try { localStorage.setItem(GIFT_NOTE_KEY, note || ''); }
    catch (e) { /* ignore — private-browsing / storage blocked */ }
  }
  // Funnel analytics (GA4 + Meta Pixel). Fires only on the real domain, so previews and tests never pollute the data.
  // Meta matches Pixel events to catalogue items by the catalogue's own retailer ID, not our URL slug. GA keeps the slug.
  var META_IDS = { 'atta-original': '91slwpjdqq', 'atta-ajwain': '97q9r5q5q3', 'atta-kesari': 'w2w5ynf2m5', 'atta-lite-sugar': 'vf5p90bcy5' };
  function metaId(slug) { return META_IDS[slug] || slug; }

  function track(event, meta, params) {
    try {
      if (!/(^|\.)munchingo\.com$/.test(location.hostname)) return;
      if (typeof window.gtag === 'function') window.gtag('event', event, params);
      if (typeof window.fbq === 'function' && meta) window.fbq('track', meta, {
        value: params.value, currency: 'INR', content_type: 'product',
        content_ids: (params.items || []).map(function (i) { return metaId(i.item_id); }), num_items: (params.items || []).length
      });
    } catch (e) { /* tracking must never break the cart */ }
  }

  function addToCart(item, opts) {
    var silent = opts && opts.silent;
    var cart = getCart();
    var existing = cart.find(function (c) { return c.slug === item.slug; });
    if (existing) { existing.qty += 1; }
    else { cart.push({ slug: item.slug, name: item.name, price: item.price, mrp: item.mrp, unit: item.unit, qty: 1 }); }
    saveCart(cart);
    if (!silent) {
      track('add_to_cart', 'AddToCart', { currency: 'INR', value: item.price, items: [{ item_id: item.slug, item_name: item.name, price: item.price, quantity: 1 }] });
      autoPackOfFour();
    }
    return getCart();
  }
  function removeFromCart(slug) {
    saveCart(getCart().filter(function (c) { return c.slug !== slug; }));
  }
  function clearCart() {
    saveCart([]);
  }
  function setQty(slug, qty, opts) {
    var cart = getCart();
    var item = cart.find(function (c) { return c.slug === slug; });
    if (item) {
      item.qty = Math.max(1, qty | 0);
      saveCart(cart);
      if (!(opts && opts.silent)) autoPackOfFour();
    }
  }
  function cartCount() {
    return getCart().reduce(function (n, c) { return n + c.qty; }, 0);
  }
  function cartTotal() {
    return getCart().reduce(function (n, c) { return n + c.qty * c.price; }, 0);
  }
  function renderBadge() {
    var count = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }
  function whatsappCheckoutUrl() {
    // Deliberately just a greeting, not the cart contents as text: the WhatsApp bot
    // doesn't parse free-text order dumps, so a customer would get a generic reply
    // instead of anything actionable. Opening with "Hi" triggers the bot's own
    // welcome flow, which hands off into its native catalog + cart ordering path.
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Hi Munchingo 👋');
  }

  // ---- Pre-orders open 11 Oct 2026; orders placed before 16 Oct ship from 16 Oct (IST) ----
  // The backend enforces the open moment too (utils/launch.js); this just shows the closed state nicely.
  // Keep DISPATCH_FROM in step with DISPATCH_FROM in the backend (it decides the email wording).
  // The owner can test earlier by opening checkout.html?preview=<ORDER_PREVIEW_KEY>.
  var LAUNCH_AT = Date.parse('2026-10-11T00:00:00+05:30');
  var DISPATCH_FROM = Date.parse('2026-10-16T00:00:00+05:30');
  function isPreorder() { return Date.now() < DISPATCH_FROM; }
  // Swaps the wording of any element that carries data-pre / data-post attributes.
  function applyDispatchCopy(root) {
    (root || document).querySelectorAll('[data-dispatch-note]').forEach(function (el) {
      el.textContent = isPreorder() ? el.getAttribute('data-pre') : el.getAttribute('data-post');
    });
  }
  function previewKey() {
    try {
      var m = location.search.match(/[?&]preview=([^&]+)/);
      if (m) sessionStorage.setItem('mngPreview', decodeURIComponent(m[1]));
      return sessionStorage.getItem('mngPreview') || '';
    } catch (e) { return ''; }
  }
  function ordersOpen() { return Date.now() >= LAUNCH_AT || !!previewKey(); }

  // ---- Minimum order and shipping (25 Oct 2026, the Pack of 2 flow; replaced the Rs 700 minimum) ----
  // The minimum is 2 boxes (a Pack of 2, any two Flavors; gift sets count as 3 and 4). Items under FREE_FROM rupees pay SHIPPING_FEE;
  // from FREE_FROM up, shipping is free (3 boxes at Rs 259 is exactly Rs 777). Must match MIN_BOXES, FREE_FROM and SHIPPING_FEE in
  // webhook-backend/utils/shipping.js; the server adds the fee as its own order line and re-checks everything.
  var MIN_BOXES = 2, FREE_FROM = 777, SHIPPING_FEE = 49;
  function boxesFor(slug) {
    if (slug === 'full-range-set') return 4;
    if (typeof slug === 'string' && slug.indexOf('trio-gift-set') === 0) return 3;
    return 1;
  }
  function cartBoxes() {
    return getCart().reduce(function (n, c) { return n + c.qty * boxesFor(c.slug); }, 0);
  }
  function boxesShort() { return Math.max(0, MIN_BOXES - cartBoxes()); }
  // Shipping on the bag as it is now: nothing for an empty or too-small bag (it cannot be ordered yet), otherwise the fee under FREE_FROM.
  function cartShipping() { var t = cartTotal(); return (cartBoxes() >= MIN_BOXES && t < FREE_FROM) ? SHIPPING_FEE : 0; }
  function cartPayable() { return cartTotal() + cartShipping(); }
  // What the shopper saves against the printed MRP (the MRP stays 300/350; only the selling price is lower). Falls back to the printed MRPs when the live book has none.
  var PRINTED_MRP = { 'atta-original': 300, 'atta-ajwain': 300, 'atta-kesari': 350, 'atta-lite-sugar': 350, 'full-range-set': 1300 };
  function mrpOf(c) { var m = c.mrp || PRINTED_MRP[c.slug] || 0; return m > c.price ? m : 0; }
  function cartSavings() {
    return getCart().reduce(function (n, c) { var m = mrpOf(c); return n + (m > c.price ? (m - c.price) * c.qty : 0); }, 0);
  }

  // ---- AOV progress bar (cart.html + checkout.html) ----
  // A visual goal-gradient bar toward two thresholds: the 3-box minimum
  // order, then the ₹999 Full Range Gift Set price. People push
  // harder to finish a visibly-nearly-complete bar than they respond to
  // the same information as plain text — this is the single mechanism
  // Blinkit's own cart leans on hardest for AOV (a live progress bar
  // toward "unlock free delivery", not a static line of copy). Shared
  // here so cart.html and checkout.html render an identical bar instead
  // of two hand-maintained copies.
  var LIVE = window.MunchingoPrices;
  var livePrice = function (slug, fallback) { return LIVE ? LIVE.price(slug, fallback) : fallback; };
  var AOV_FULL_RANGE_PRICE = livePrice('full-range-set', 999);
  // What buying the four boxes one by one would cost, minus the set price (never negative).
  var AOV_FULL_RANGE_SAVING = Math.max(0, livePrice('atta-original', 259) + livePrice('atta-ajwain', 259) + livePrice('atta-kesari', 299) + livePrice('atta-lite-sugar', 329) - AOV_FULL_RANGE_PRICE);

  var BASE_SLUGS_FOR_UPGRADE = ['atta-original', 'atta-kesari', 'atta-ajwain', 'atta-lite-sugar'];

  // Whether the cart holds at least 1 of each of the 4 base flavors as
  // loose singles — i.e. a real, one-tap-swappable Full Range Gift Set
  // sitting unassembled in the cart.
  function hasFullRangeUpgrade(cart) {
    return BASE_SLUGS_FOR_UPGRADE.every(function (slug) {
      var item = cart.find(function (c) { return c.slug === slug; });
      return item && item.qty >= 1;
    });
  }

  // Swaps 1 unit of each of the 4 base flavors for 1 Full Range Gift Set
  // — decrements (or removes, if that was the only unit) each base flavor
  // by exactly 1, leaving any extra quantity untouched, then adds the set.
  function upgradeToFullRange() {
    BASE_SLUGS_FOR_UPGRADE.forEach(function (slug) {
      var item = getCart().find(function (c) { return c.slug === slug; });
      if (!item) return;
      if (item.qty > 1) setQty(slug, item.qty - 1, { silent: true });
      else removeFromCart(slug);
    });
    addToCart({ slug: 'full-range-set', name: 'Full Range Gift Set', price: AOV_FULL_RANGE_PRICE, unit: '1kg, one of each' }, { silent: true });
  }

  // Any three different flavors are exactly the Trio, and all four are exactly the Full Range set. Both cost less than
  // the same boxes bought one by one, so the bag swaps them automatically and says so once, in plain words.
  var FLAV_META = [
    { slug: 'atta-original',   token: 'original',   label: 'Original' },
    { slug: 'atta-kesari',     token: 'kesari',     label: 'Kesari' },
    { slug: 'atta-lite-sugar', token: 'lite-sugar', label: 'Sugar-Lite' },
    { slug: 'atta-ajwain',     token: 'ajwain',     label: 'Ajwain' }
  ];
  var TRIO_UNIT = '750g, 3 flavors';
  function trioPrice() { return livePrice('trio-gift-set', 799); }
  function isTrioSlug(slug) { return typeof slug === 'string' && slug.indexOf('trio-gift-set') === 0; }
  function distinctSingles(cart) {
    return FLAV_META.filter(function (f) { return cart.some(function (c) { return c.slug === f.slug && c.qty >= 1; }); });
  }
  // Swaps one of each of three different loose flavors for one Trio. Returns { saved, labels } or null if not worthwhile.
  function swapToTrio() {
    var cart = getCart(), d = distinctSingles(cart);
    if (d.length < 3) return null;
    var picks = d.slice(0, 3), tp = trioPrice();
    var sum = picks.reduce(function (n, f) { return n + cart.find(function (c) { return c.slug === f.slug; }).price; }, 0);
    if (sum <= tp) return null;                         // never "upgrade" into a dearer set
    var slug = 'trio-gift-set-' + picks.map(function (f) { return f.token; }).sort().join('-');
    if (isSlugSoldOut(slug)) return null;
    picks.forEach(function (f) {
      var item = getCart().find(function (c) { return c.slug === f.slug; });
      if (item.qty > 1) setQty(f.slug, item.qty - 1, { silent: true }); else removeFromCart(f.slug);
    });
    var labels = picks.map(function (f) { return f.label; }).join(', ');
    addToCart({ slug: slug, name: 'Trio Gift Set (' + labels + ')', price: tp, unit: TRIO_UNIT }, { silent: true });
    return { saved: sum - tp, labels: labels };
  }
  // A Trio in the bag can become the Full Range set by adding the 4th flavor: replaces one Trio with one Full Range set.
  function upgradeTrioToFullRange() {
    var t = getCart().filter(function (c) { return isTrioSlug(c.slug); })[0];
    if (!t) return;
    if (t.qty > 1) setQty(t.slug, t.qty - 1, { silent: true }); else removeFromCart(t.slug);
    addToCart({ slug: 'full-range-set', name: 'Full Range Gift Set', price: AOV_FULL_RANGE_PRICE, unit: '1kg, one of each' }, { silent: true });
    autoPackOfFour();
  }
  // A Trio plus a loose box of the 4th flavor is the Full Range set for less money: merge them.
  function mergeTrioAndFourth() {
    var cart = getCart(), t = cart.filter(function (c) { return isTrioSlug(c.slug); })[0];
    if (!t) return null;
    var padded = '-' + t.slug + '-';
    var have = FLAV_META.filter(function (f) { return padded.indexOf('-' + f.token + '-') >= 0; });
    if (have.length !== 3) return null;
    var miss = FLAV_META.filter(function (f) { return have.indexOf(f) < 0; })[0];
    var single = cart.filter(function (c) { return c.slug === miss.slug && c.qty >= 1; })[0];
    if (!single) return null;
    var saved = t.price + single.price - AOV_FULL_RANGE_PRICE;
    if (saved <= 0) return null;
    if (t.qty > 1) setQty(t.slug, t.qty - 1, { silent: true }); else removeFromCart(t.slug);
    if (single.qty > 1) setQty(single.slug, single.qty - 1, { silent: true }); else removeFromCart(single.slug);
    addToCart({ slug: 'full-range-set', name: 'Full Range Gift Set', price: AOV_FULL_RANGE_PRICE, unit: '1kg, one of each' }, { silent: true });
    return { saved: saved };
  }
  // The bag no longer changes itself. A cheaper set is SUGGESTED (see suggestion()) and the customer chooses; kept as a no-op
  // because add/set-quantity still call it.
  function autoPackOfFour() { return 0; }
  function showAutoPackNotice(text) {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      var old = document.getElementById('mng-autopack'); if (old) old.remove();
      var d = document.createElement('div');
      d.id = 'mng-autopack'; d.setAttribute('role', 'status');
      d.textContent = text;
      d.style.cssText = 'position:fixed;left:50%;bottom:84px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,420px);background:#1c1b19;color:#fff;padding:12px 16px;border-radius:14px;font:500 14px/1.4 Poppins,system-ui,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.25);text-align:center';
      document.body.appendChild(d);
      setTimeout(function () { if (d.parentNode) d.remove(); }, 6000);
    } catch (e) { /* a notice must never break the cart */ }
  }

  // ---- Suggested sets (the buyer decides; nothing in the bag changes unless they tap) ----
  // Three different flavors as singles cost more than the Trio; all four cost more than the Full Range set; a Trio plus the
  // 4th flavor costs more than the Full Range set. The saving shown is the real change in what they would pay, counting the
  // stock-up offer (10% off single boxes) they might lose by switching.
  var KEEP_KEY = 'mngKeep';
  function keptList() { try { return JSON.parse(sessionStorage.getItem(KEEP_KEY)) || []; } catch (e) { return []; } }
  function keepSig(sig) { try { var k = keptList(); if (k.indexOf(sig) < 0) k.push(sig); sessionStorage.setItem(KEEP_KEY, JSON.stringify(k)); } catch (e) {} }
  function singlesOf(cart) { return cart.filter(function (c) { return BASE_SLUGS_FOR_UPGRADE.indexOf(c.slug) >= 0; }).reduce(function (n, c) { return n + c.qty * c.price; }, 0); }
  function stockUpOff(singles) {
    return 0;   // the stock-up percentage offer is retired (25 Oct 2026): Rs 259/299 is already below MRP
    var o = window.MunchingoOffers && window.MunchingoOffers.tier();
    if (!o || !o.pct || singles < o.min) return 0;
    var d = Math.round(singles * o.pct / 100);
    return o.cap ? Math.min(d, o.cap) : d;
  }
  function payableOf(cart) { return cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0) - stockUpOff(singlesOf(cart)); }
  // The bag as it would be after removing one of each slug and adding one set.
  function afterSwap(cart, slugs, add) {
    var out = cart.map(function (c) { return { slug: c.slug, qty: c.qty, price: c.price }; });
    slugs.forEach(function (sl) { var i = out.findIndex(function (c) { return c.slug === sl; }); if (i >= 0) { if (out[i].qty > 1) out[i].qty--; else out.splice(i, 1); } });
    var ex = out.find(function (c) { return c.slug === add.slug; });
    if (ex) ex.qty++; else out.push({ slug: add.slug, qty: 1, price: add.price });
    return out;
  }
  function suggestion() {
    return null;   // set suggestions are off (25 Oct 2026): at Rs 259/299 a Trio saves Rs 18 and costs far more in margin than it earns; gift sets stay as explicit choices
    var sg = suggestionCore();
    if (sg && stockUpOff(singlesOf(getCart())) > 0) sg.tierNote = true;
    return sg;
  }
  function suggestionCore() {
    var cart = getCart(), kept = keptList(), d = distinctSingles(cart), now = payableOf(cart), s;
    if (d.length === 4) {
      if (kept.indexOf('full') >= 0) return null;
      s = now - payableOf(afterSwap(cart, BASE_SLUGS_FOR_UPGRADE, { slug: 'full-range-set', price: AOV_FULL_RANGE_PRICE }));
      return s > 0 ? { kind: 'full', sig: 'full', saved: s, singles: d.reduce(function (n, f) { return n + cart.find(function (c) { return c.slug === f.slug; }).price; }, 0), setPrice: AOV_FULL_RANGE_PRICE } : null;
    }
    var t = cart.filter(function (c) { return isTrioSlug(c.slug); })[0];
    if (t) {
      var padded = '-' + t.slug + '-';
      var have = FLAV_META.filter(function (f) { return padded.indexOf('-' + f.token + '-') >= 0; });
      if (have.length === 3) {
        var miss = FLAV_META.filter(function (f) { return have.indexOf(f) < 0; })[0];
        var single = cart.filter(function (c) { return c.slug === miss.slug && c.qty >= 1; })[0];
        var sig = 'merge:' + t.slug;
        if (single && kept.indexOf(sig) < 0) {
          s = now - payableOf(afterSwap(cart, [t.slug, single.slug], { slug: 'full-range-set', price: AOV_FULL_RANGE_PRICE }));
          if (s > 0) return { kind: 'merge', sig: sig, saved: s, singles: t.price + single.price, setPrice: AOV_FULL_RANGE_PRICE, extra: miss.label };
        }
      }
    }
    if (d.length >= 3) {
      var picks = d.slice(0, 3), tp = trioPrice(), tsig = 'trio:' + picks.map(function (f) { return f.token; }).sort().join('-');
      if (kept.indexOf(tsig) >= 0) return null;
      var tslug = 'trio-gift-set-' + picks.map(function (f) { return f.token; }).sort().join('-');
      if (isSlugSoldOut(tslug)) return null;
      s = now - payableOf(afterSwap(cart, picks.map(function (f) { return f.slug; }), { slug: tslug, price: tp }));
      var sum = picks.reduce(function (n, f) { return n + cart.find(function (c) { return c.slug === f.slug; }).price; }, 0);
      return s > 0 ? { kind: 'trio', sig: tsig, saved: s, singles: sum, setPrice: tp, labels: picks.map(function (f) { return f.label; }).join(', ') } : null;
    }
    return null;
  }
  function acceptSuggestion() {
    var sg = suggestion(); if (!sg) return 0;
    if (sg.kind === 'full') upgradeToFullRange(); else if (sg.kind === 'merge') mergeTrioAndFourth(); else swapToTrio();
    return 1;
  }
  function suggestionHtml(sg) {
    var what = sg.kind === 'trio' ? 'Trio Gift Set' : 'Full Range Gift Set';
    var lead = sg.kind === 'trio' ? 'Your 3 flavors (' + sg.labels + ')' : sg.kind === 'full' ? 'All 4 flavors' : 'Your Trio and a box of ' + sg.extra;
    return lead + ' come to <b>\u20B9' + sg.singles + '</b> as separate boxes. As the ' + what + ' they are <b>\u20B9' + sg.setPrice + '</b>. Save <b>\u20B9' + sg.saved + '</b> if you like' + (sg.tierNote ? ' (counting the 10% stock-up offer you would otherwise get)' : '') + '.';
  }

  // total is derived from cart, not passed separately, so this can never
  // drift out of sync with what's actually in the cart.
  function renderAovProgressHtml(cart) {
    var total = cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0);
    var boxes = cart.reduce(function (n, c) { return n + c.qty * boxesFor(c.slug); }, 0);
    var pendingMin = boxes < MIN_BOXES;
    var needShip = !pendingMin && total < FREE_FROM;
    // Until the 2-box minimum is met the bar fills toward it; after that it fills toward free shipping.
    var fillPct = pendingMin ? Math.round((boxes / MIN_BOXES) * 100) : Math.min(100, Math.round((total / FREE_FROM) * 100));
    var msgClass, msgHtml;
    if (pendingMin) {
      var n = MIN_BOXES - boxes;
      msgClass = 'pending';
      msgHtml = 'Add <b>' + n + ' more box' + (n === 1 ? '' : 'es') + '</b> to check out. Online orders start at ' + MIN_BOXES + ' boxes (a Pack of 2, any two Flavors).';
    } else if (needShip) {
      msgClass = 'upsell';
      msgHtml = 'Shipping is \u20B9' + SHIPPING_FEE + ' on this order. Add <b>one more box</b> and it ships free (free shipping from \u20B9' + FREE_FROM + ').';
    } else {
      msgClass = 'unlocked';
      msgHtml = 'Free shipping \u2713 you\'re all set';
    }
    return '' +
      '<div class="aov-progress">' +
        '<div class="aov-progress-track">' +
          '<div class="aov-progress-fill" style="width:' + fillPct + '%"></div>' +
        '</div>' +
        '<p class="aov-progress-msg ' + msgClass + '">' + msgHtml + '</p>' +
      '</div>';
  }

  // Wires the "Swap & Save" button if present in the given container.
  function initAovUpgrade(containerEl, onUpgraded) {
    if (!containerEl) return;
    var acc = containerEl.querySelector('[data-aov-accept]'), keep = containerEl.querySelector('[data-aov-keep]');
    if (acc) acc.addEventListener('click', function () { acceptSuggestion(); if (typeof onUpgraded === 'function') onUpgraded(); });
    if (keep) keep.addEventListener('click', function () { keepSig(keep.getAttribute('data-sig')); if (typeof onUpgraded === 'function') onUpgraded(); });
    var btn = containerEl.querySelector('[data-aov-upgrade]');
    var tbtn = containerEl.querySelector('[data-aov-trio-upgrade]');
    if (tbtn) tbtn.addEventListener('click', function () { upgradeTrioToFullRange(); if (typeof onUpgraded === 'function') onUpgraded(); });
    if (!btn) return;
    btn.addEventListener('click', function () {
      upgradeToFullRange();
      if (typeof onUpgraded === 'function') onUpgraded();
    });
  }

  // ---- "Complete your box" cross-sell strip (cart.html + checkout.html) ----
  // One-tap add cards for whichever base flavors aren't already in the
  // cart — the single mechanism the impulse-buying research kept pointing
  // to hardest: zero-friction, one-tap add, shown at the exact moment
  // someone's already mid-purchase. Deliberately NOT: countdown timers,
  // "only X left" scarcity messaging, or anything not literally true —
  // those are dark patterns, not persuasion, and don't fit how Munchingo
  // talks to people.
  var CROSS_SELL_PRODUCTS = [
    { slug: 'atta-original',   name: 'Atta Original',    price: 259, mrp: 300, unit: '250g', img: 'images/box-original.webp' },
    { slug: 'atta-kesari',     name: 'Atta Kesari',       price: 299, mrp: 350, unit: '250g', img: 'images/box-kesari.webp' },
    { slug: 'atta-ajwain',     name: 'Atta Ajwain',       price: 259, mrp: 300, unit: '250g', img: 'images/box-ajwain.webp' },
    { slug: 'atta-lite-sugar', name: 'Atta Sugar-Lite',   price: 329, mrp: 350, unit: '250g', img: 'images/box-lite.webp' }
  ];
  CROSS_SELL_PRODUCTS.forEach(function (p) { p.price = livePrice(p.slug, p.price); var m = LIVE ? LIVE.mrp(p.slug, null) : null; p.mrp = m || p.price; });

  function renderCrossSellHtml() {
    var cart = getCart();
    var cartSlugs = cart.map(function (c) { return c.slug; });
    var candidates = CROSS_SELL_PRODUCTS.filter(function (p) {
      return cartSlugs.indexOf(p.slug) === -1 && !isSlugSoldOut(p.slug);
    });
    if (!candidates.length) return '';

    var cards = candidates.map(function (p) {
      return '' +
        '<div class="cross-sell-card">' +
          '<img src="' + p.img + '" alt="' + p.name + '">' +
          '<div class="cross-sell-body">' +
            '<div class="cross-sell-name">' + p.name + '</div>' +
            '<div class="cross-sell-price">₹' + p.price + ' · ' + p.unit + '</div>' +
          '</div>' +
          '<button type="button" class="cross-sell-add" data-cross-sell-add data-slug="' + p.slug + '" data-name="' + p.name + '" data-price="' + p.price + '"' + (p.mrp > p.price ? ' data-mrp="' + p.mrp + '"' : '') + ' data-unit="' + p.unit + '" aria-label="Add ' + p.name + ' to cart">+ Add</button>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="cross-sell-strip">' +
        '<div class="cross-sell-lbl">Complete your box</div>' +
        '<div class="cross-sell-row">' + cards + '</div>' +
      '</div>';
  }

  // Wires up any [data-cross-sell-add] buttons currently in the DOM (call
  // again after re-rendering the strip's innerHTML — new buttons need new
  // listeners). Calls back into onAdded() after a successful add so the
  // page can re-render its totals/progress bar/cross-sell strip itself,
  // rather than this shared module knowing about page-specific DOM.
  function initCrossSell(containerEl, onAdded) {
    if (!containerEl) return;
    containerEl.querySelectorAll('[data-cross-sell-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mrpAttr = btn.getAttribute('data-mrp');
        addToCart({
          slug: btn.getAttribute('data-slug'),
          name: btn.getAttribute('data-name'),
          price: parseInt(btn.getAttribute('data-price'), 10),
          mrp: mrpAttr ? parseInt(mrpAttr, 10) : undefined,
          unit: btn.getAttribute('data-unit')
        });
        if (typeof onAdded === 'function') onAdded();
      });
    });
  }

  window.MunchingoCart = {
    getCart: getCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    setQty: setQty,
    cartCount: cartCount,
    cartTotal: cartTotal,
    cartBoxes: cartBoxes,
    ordersOpen: ordersOpen,
    previewKey: previewKey,
    LAUNCH_AT: LAUNCH_AT,
    DISPATCH_FROM: DISPATCH_FROM,
    isPreorder: isPreorder,
    applyDispatchCopy: applyDispatchCopy,
    MIN_BOXES: MIN_BOXES,
    FREE_FROM: FREE_FROM,
    SHIPPING_FEE: SHIPPING_FEE,
    boxesShort: boxesShort,
    cartShipping: cartShipping,
    cartPayable: cartPayable,
    cartSavings: cartSavings,
    mrpOf: mrpOf,
    whatsappCheckoutUrl: whatsappCheckoutUrl,
    renderBadge: renderBadge,
    isSlugSoldOut: isSlugSoldOut,
    isFlavourSoldOut: isFlavourSoldOut,
    track: track,
    metaId: metaId,
    suggestion: suggestion,
    suggestionHtml: suggestionHtml,
    acceptSuggestion: acceptSuggestion,
    keepSuggestion: keepSig,
    renderAovProgressHtml: renderAovProgressHtml,
    initAovUpgrade: initAovUpgrade,
    renderCrossSellHtml: renderCrossSellHtml,
    initCrossSell: initCrossSell,
    getGiftNote: getGiftNote,
    setGiftNote: setGiftNote
  };

  // ---- Lightbox for ingredients/nutrition panel images ----
  // These are screenshots of dense label text — at card width (~290px) they
  // scale down to single-digit pixel heights and become unreadable, so any
  // click opens the same image at a legible size.
  function initLightbox() {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button><img class="lightbox-img" alt="">';
    document.body.appendChild(overlay);
    var lightboxImg = overlay.querySelector('.lightbox-img');

    function open(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      overlay.classList.add('open');
    }
    function close() {
      overlay.classList.remove('open');
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    document.querySelectorAll('.ni-img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { open(img.src, img.alt); });
    });
    document.querySelectorAll('.photo-carousel .slide:not(:first-child) img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { open(img.src, img.alt); });
    });
  }

  // ---- Product photo / ingredients / nutrition carousel ----
  function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
      var slides = Array.prototype.slice.call(carousel.querySelectorAll('.slide'));
      var dots = Array.prototype.slice.call(carousel.querySelectorAll('.dot'));
      var slidesEl = carousel.querySelector('.slides');

      function currentIndex() {
        return slides.findIndex(function (s) { return s.classList.contains('active'); });
      }
      function showSlide(index) {
        index = Math.max(0, Math.min(index, slides.length - 1));
        slides.forEach(function (s, i) { s.classList.toggle('active', i === index); });
        dots.forEach(function (d, i) { d.classList.toggle('active', i === index); });
        carousel.classList.toggle('on-info', index !== 0);
      }
      function step(delta) { showSlide(currentIndex() + delta); }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          showSlide(parseInt(dot.getAttribute('data-slide'), 10));
        });
      });

      // Prev/next arrow buttons, overlaid on the image frame
      var prevBtn = document.createElement('button');
      prevBtn.className = 'carousel-arrow prev';
      prevBtn.setAttribute('aria-label', 'Previous photo');
      prevBtn.innerHTML = '&#8249;';
      var nextBtn = document.createElement('button');
      nextBtn.className = 'carousel-arrow next';
      nextBtn.setAttribute('aria-label', 'Next photo');
      nextBtn.innerHTML = '&#8250;';
      prevBtn.addEventListener('click', function () { step(-1); });
      nextBtn.addEventListener('click', function () { step(1); });
      slidesEl.appendChild(prevBtn);
      slidesEl.appendChild(nextBtn);

      // "Tap to enlarge" badge — an overlay inside the fixed-size frame, not
      // a block element, so its appearance/disappearance on info slides
      // never changes the carousel's height (which broke card alignment).
      var hint = document.createElement('span');
      hint.className = 'carousel-hint';
      hint.textContent = 'Tap to enlarge';
      slidesEl.appendChild(hint);

      // Keyboard navigation when the carousel has focus
      carousel.setAttribute('tabindex', '0');
      carousel.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      });

      // Basic swipe support for touch devices
      var touchStartX = null;
      carousel.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      carousel.addEventListener('touchend', function (e) {
        if (touchStartX === null) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) < 40) return;
        step(dx < 0 ? 1 : -1);
      }, { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderBadge();
    applyDispatchCopy();
    syncStock();
    initCarousels();
    initLightbox();
    document.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
      var staticSlug = btn.getAttribute('data-slug');
      // Trio's button slug changes as flavors are picked (handled by its
      // own script in gifting.html) — only grey out buttons with a fixed
      // slug here (base SKUs + Full Range).
      if (staticSlug && staticSlug.indexOf('trio-gift-set') !== 0 && isSlugSoldOut(staticSlug)) {
        btn.disabled = true;
        btn.textContent = 'Sold Out';
        btn.classList.add('sold-out');
        return;
      }
      function itemFromBtn() {
        var mrpAttr = btn.getAttribute('data-mrp');
        return {
          slug: btn.getAttribute('data-slug'),
          name: btn.getAttribute('data-name'),
          price: parseInt(btn.getAttribute('data-price'), 10),
          mrp: mrpAttr ? parseInt(mrpAttr, 10) : undefined,
          unit: btn.getAttribute('data-unit')
        };
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        addToCart(itemFromBtn());
        if (btn.hasAttribute('data-stepper')) return;        // the stepper below replaces the button, no flash needed
        var original = btn.textContent;
        btn.textContent = 'Added ✓';
        setTimeout(function () { btn.textContent = original; }, 1200);
      });
      // Range cards: once the box is in the bag the button becomes  - qty +  (same pattern as every quick-commerce app).
      if (btn.hasAttribute('data-stepper') && staticSlug) {
        var step = document.createElement('div');
        step.className = 'v2-qty'; step.hidden = true;   // own class: .v2-step belongs to the order-steps section and carries a 16px margin
        step.innerHTML = '<button type="button" data-d aria-label="One less">\u2212</button><output aria-live="polite"></output><button type="button" data-i aria-label="One more">+</button>';
        btn.parentNode.insertBefore(step, btn.nextSibling);
        var out = step.querySelector('output');
        var qtyOf = function () { var it = getCart().filter(function (c) { return c.slug === staticSlug; })[0]; return it ? it.qty : 0; };
        var sync = function () { var q = qtyOf(); btn.hidden = q > 0; step.hidden = q === 0; out.textContent = q; };
        step.querySelector('[data-i]').addEventListener('click', function () { if (qtyOf() < 50) addToCart(itemFromBtn()); });
        step.querySelector('[data-d]').addEventListener('click', function () { var q = qtyOf(); if (q <= 1) removeFromCart(staticSlug); else setQty(staticSlug, q - 1); });
        document.addEventListener('munchingo:cart', sync);
        window.addEventListener('pageshow', sync);
        window.addEventListener('storage', sync);
        sync();
      }
    });

    // Mobile nav toggle
    var nav = document.querySelector('nav');
    var toggle = document.querySelector('.nav-toggle');
    if (nav && toggle) {
      var HAMBURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/></svg>';
      var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19" stroke-linecap="round"/></svg>';
      toggle.innerHTML = HAMBURGER;
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.innerHTML = open ? CLOSE : HAMBURGER;
      });
      nav.querySelectorAll('ul a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = HAMBURGER;
        });
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 820 && nav.classList.contains('nav-open')) {
          nav.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = HAMBURGER;
        }
      });
    }

    // ---- Site search ----
    var SEARCH_INDEX = [
      { title: 'Atta Original', desc: 'Cardamom, whole wheat atta, pure desi ghee. 250g.', type: 'Product', url: 'atta-original.html' },
      { title: 'Atta Kesari', desc: 'Real saffron, mixed into every batch. 250g.', type: 'Product', url: 'atta-kesari.html' },
      { title: 'Atta Sugar-Lite', desc: '95% less sugar than Original, sweetened with maltitol. 250g.', type: 'Product', url: 'atta-lite-sugar.html' },
      { title: 'Atta Ajwain', desc: 'Spiced with ajwain, less sweet than the others. 250g.', type: 'Product', url: 'atta-ajwain.html' },
      { title: 'The Trio Gift Set', desc: 'Choose any 3 of 4 flavors, 250g each, gift-boxed.', type: 'Gift Set', url: 'build-a-box.html' },
      { title: 'The Full Range Gift Set', desc: 'One of each flavor, 1kg total, 4 boxes.', type: 'Gift Set', url: 'build-a-box.html' },
      { title: 'Corporate Gifting', desc: 'Bulk and corporate orders from 25 boxes, quoted on WhatsApp.', type: 'Page', url: 'corporate-gifting.html' },
      { title: 'Maida-free cookies: how to read a label', desc: 'A plain guide to maida, atta, fats and sugar on biscuit labels.', type: 'Page', url: 'maida-free-cookies-guide.html' },
      { title: 'About Us', desc: 'Our story — baked in Bikaner by Krazy Bakers.', type: 'Page', url: 'about.html' },
      { title: 'Contact', desc: 'WhatsApp, email, Instagram, corporate gifting.', type: 'Page', url: 'contact.html' },
      { title: 'Your Cart', desc: 'Review your bag and check out securely online.', type: 'Page', url: 'cart.html' },
      { title: 'Is Atta Sugar-Lite safe for diabetics?', desc: 'Sweetened with maltitol, no added sugar. Contains polyols; may have a laxative effect.', type: 'FAQ', url: 'contact.html#faq-diabetic' },
      { title: "What's the shelf life?", desc: 'Best before 90 days from packing.', type: 'FAQ', url: 'contact.html#faq-shelf-life' },
      { title: 'Can I customise a corporate hamper?', desc: 'Corporate gifting and bulk orders from 25 boxes.', type: 'FAQ', url: 'contact.html#faq-hamper' },
      { title: 'Where is it made?', desc: 'Krazy Bakers, Gangashahar, Bikaner, Rajasthan.', type: 'FAQ', url: 'contact.html#faq-location' },
      { title: 'How do I pay?', desc: 'WhatsApp confirmation, then a UPI payment link. Pre-paid.', type: 'FAQ', url: 'contact.html#faq-payment' }
    ];

    var searchToggle = document.querySelector('[data-search-toggle]');
    var searchPanel = document.querySelector('[data-search-panel]');
    var searchInput = document.querySelector('[data-search-input]');
    var searchResults = document.querySelector('[data-search-results]');
    var searchClose = document.querySelector('[data-search-close]');

    if (searchToggle && searchPanel && searchInput && searchResults) {
      function escapeHtml(s) {
        return s.replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function renderResults(query) {
        var q = query.trim().toLowerCase();
        if (!q) {
          searchResults.innerHTML = '<div class="search-hint">Try "kesari", "gift set", "diabetic", or "shelf life".</div>';
          return;
        }
        var matches = SEARCH_INDEX.filter(function (item) {
          return item.title.toLowerCase().indexOf(q) !== -1 || item.desc.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (!matches.length) {
          searchResults.innerHTML = '<div class="search-empty">No results for "' + escapeHtml(query) + '". Try a flavor name, "gift set", or a question about shipping/payment.</div>';
          return;
        }
        searchResults.innerHTML = matches.map(function (item) {
          return '<a class="search-result" href="' + item.url + '">' +
            '<span class="rtitle">' + escapeHtml(item.title) + '</span><span class="rtype">' + item.type + '</span>' +
            '<div class="rdesc">' + escapeHtml(item.desc) + '</div></a>';
        }).join('');
      }

      function openSearch() {
        searchPanel.classList.add('search-open');
        searchToggle.setAttribute('aria-expanded', 'true');
        renderResults(searchInput.value);
        setTimeout(function () { searchInput.focus(); }, 10);
        document.addEventListener('keydown', onKeydown);
      }
      function closeSearch() {
        searchPanel.classList.remove('search-open');
        searchToggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onKeydown);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') closeSearch();
      }

      searchToggle.addEventListener('click', function () {
        if (searchPanel.classList.contains('search-open')) closeSearch();
        else openSearch();
      });
      if (searchClose) searchClose.addEventListener('click', closeSearch);
      searchPanel.addEventListener('click', function (e) {
        if (e.target === searchPanel) closeSearch();
      });
      searchInput.addEventListener('input', function () {
        renderResults(searchInput.value);
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var first = searchResults.querySelector('.search-result');
          if (first) window.location.href = first.getAttribute('href');
        }
      });

      // In-page navigation: if a result points to an anchor on the current page, scroll instead of reloading
      searchResults.addEventListener('click', function (e) {
        var link = e.target.closest('a.search-result');
        if (!link) return;
        var href = link.getAttribute('href');
        var hashIdx = href.indexOf('#');
        if (hashIdx === -1) return; // normal navigation
        var targetPage = href.slice(0, hashIdx);
        var targetId = href.slice(hashIdx + 1);
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (targetPage === currentPage || (targetPage === '' && currentPage === 'index.html')) {
          var el = document.getElementById(targetId);
          if (el) {
            e.preventDefault();
            if (el.tagName === 'DETAILS') el.open = true;
            history.pushState(null, '', '#' + targetId);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            closeSearch();
          }
        }
      });
    }

    // Auto-open + scroll to a FAQ item if the page loads with a matching hash
    if (window.location.hash) {
      var hashEl = document.getElementById(window.location.hash.slice(1));
      if (hashEl && hashEl.tagName === 'DETAILS') {
        hashEl.open = true;
        setTimeout(function () { hashEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350);
      }
    }
  });
})();
