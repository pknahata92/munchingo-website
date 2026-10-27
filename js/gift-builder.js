// Munchingo gift-set builder — used on build-a-box.html.
// Pages supply the headline copy plus two empty mount points:
//   <div data-gb-left></div>   (step 1 set choice + step 2 flavor tiles)
//   <div data-gb-right></div>  (the dark "your gift set" panel)
// Everything that touches the cart goes through window.MunchingoCart, using the
// exact slugs / names / prices gifting.html already sends, so the backend's
// catalog check (utils/catalog.js) and the cart page treat both builders alike.
(function () {
  'use strict';

  // Same figures as gifting.html's static Add-to-Bag buttons.
  var SETS = {
    3: { price: 799, name: 'Trio Gift Set', unit: '750g, 3 flavors' },
    4: { slug: 'full-range-set', price: 999, name: 'Full Range Gift Set', unit: '1kg, one of each' }
  };
  // Live prices (js/prices.js) replace the launch figures above when the owner has changed them.
  if (window.MunchingoPrices) { SETS[3].price = window.MunchingoPrices.price('trio-gift-set', SETS[3].price); SETS[4].price = window.MunchingoPrices.price('full-range-set', SETS[4].price); }
  // Canonical order (matches gifting.html's checkbox order) so the cart line is
  // identical whichever order the customer taps the tiles.
  var FLAVOURS = [
    { value: 'Original',   label: 'Original',   title: 'Atta Original',   img: 'images/box-original.webp', color: 'var(--ruby)' },
    { value: 'Kesari',     label: 'Kesari',     title: 'Atta Kesari',     img: 'images/box-kesari.webp',   color: 'var(--kesari)' },
    { value: 'Lite-sugar', label: 'Sugar-Lite', title: 'Atta Sugar-Lite', img: 'images/box-lite.webp',     color: 'var(--mauve)' },
    { value: 'Ajwain',     label: 'Ajwain',     title: 'Atta Ajwain',     img: 'images/box-ajwain.webp',   color: 'var(--slate)' }
  ];
  // Selling prices (what the customer would actually pay per box). Taken from
  // data/products.js when that file is on the page, else these mirror it.
  var SINGLE_FALLBACK = { Original: 259, Kesari: 299, 'Lite-sugar': 329, Ajwain: 259 };
  var PRODUCT_SLUG = { Original: 'atta-original', Kesari: 'atta-kesari', 'Lite-sugar': 'atta-lite-sugar', Ajwain: 'atta-ajwain' };

  var cart = function () { return window.MunchingoCart; };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  var SINGLE_MRP = { Original: 300, Kesari: 350, 'Lite-sugar': 350, Ajwain: 300 };
  // The printed MRP of a single box: the gift set is shown as a discount on this, not on the lower web price.
  function singlePrice(value) {
    var list = window.MUNCHINGO_PRODUCTS || [];
    for (var i = 0; i < list.length; i++) if (list[i].slug === PRODUCT_SLUG[value]) return list[i].mrp || SINGLE_MRP[value];
    return SINGLE_MRP[value];
  }
  function soldOut(value) { return !!(cart() && cart().isFlavourSoldOut && cart().isFlavourSoldOut(value)); }
  function fullRangeSoldOut() { return !!(cart() && cart().isSlugSoldOut && cart().isSlugSoldOut('full-range-set')); }
  function byValue(v) { for (var i = 0; i < FLAVOURS.length; i++) if (FLAVOURS[i].value === v) return FLAVOURS[i]; }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  function init() {
    var left = document.querySelector('[data-gb-left]');
    var right = document.querySelector('[data-gb-right]');
    if (!left || !right || !cart()) return;

    var size = 3;          // 3 = Trio (pick any 3), 4 = Full Range (one of each)
    var picks = [];        // flavor values, in tap order

    left.innerHTML =
      '<p class="gb-step"><i>1</i>Choose your set</p>' +
      '<div class="gb-opts" role="radiogroup" aria-label="Gift set size">' +
        '<button type="button" class="gb-opt on" data-size="3" role="radio" aria-checked="true"><span class="gb-flag">PICK &amp; MIX</span><span class="n">3</span><span><b>Trio Gift Set</b><small>Any 3 of our 4 flavors · 750g</small></span></button>' +
        '<button type="button" class="gb-opt" data-size="4" role="radio" aria-checked="false"><span class="gb-flag">BEST VALUE</span><span class="n">4</span><span><b>Full Range Gift Set</b><small>One of each · 1kg</small></span></button>' +
      '</div>' +
      '<p class="gb-step"><i>2</i><span data-gb-step2>Fill it with any 3 flavors</span></p>' +
      '<p class="gb-stock" data-gb-stock role="status" hidden></p>' +
      '<div class="gb-flavours">' +
        FLAVOURS.map(function (f) {
          return '<button type="button" class="gb-fl" style="--c:' + f.color + '" data-f="' + f.value + '">' +
                 '<span class="gb-plus">+</span><em class="gb-so" hidden>Sold out<small>Back soon</small></em><img src="' + f.img + '" alt="" loading="lazy"><span>' + f.title + '</span></button>';
        }).join('') +
      '</div>';

    right.innerHTML =
      '<aside class="gb-panel" aria-live="polite">' +
        '<div class="gb-k">Your gift set</div>' +
        '<div class="gb-count"><span data-gb="filled">0</span> <small>/ <span data-gb="size">3</span> boxes</small></div>' +
        '<div class="gb-slots" data-gb="slots"></div>' +
        '<div class="gb-bar"><i data-gb="barfill"></i></div>' +
        '<button type="button" class="gb-btn-dark" data-gb="surprise">✦ Surprise me</button>' +
        '<p class="gb-great" data-gb="great" hidden>✦ Great choice — every flavor, already in the box.</p>' +
        '<div class="gb-note" data-gb="note"><span>🎁</span><a href="#" data-gb="notelink">Add a gift note</a>' +
          '<textarea rows="3" maxlength="200" placeholder="Happy Diwali! Love, …" aria-label="Gift note"></textarea></div>' +
        '<div class="gb-row"><span>MRP of these boxes</span><s data-gb="mrp">₹0</s></div>' +
        '<div class="gb-row gb-save"><span>You save</span><b data-gb="sv">—</b></div>' +
        '<div class="gb-total"><span>Total</span><b data-gb="tot">₹0</b></div>' +
        '<p class="promo-note" data-gb="promo" hidden></p>' +
        '<button type="button" class="btn solid gb-cta" data-gb="cta" disabled>Pick 3 flavors to start</button>' +
        '<a class="gb-singles" data-gb="singles" href="shop.html" hidden>Order the single boxes that are in stock →</a>' +
        '<a class="gb-viewbag" data-gb="viewbag" href="cart.html" hidden>View your bag →</a>' +
        '<div class="gb-paused" data-gb="paused" hidden><b data-gb="pausedTitle">Gift sets are paused for now.</b><p data-gb="pausedText"></p>' +
          '<a class="btn solid gb-notify" data-gb="notify" href="https://wa.me/919988992024" rel="noopener">Tell me when they\u2019re back</a>' +
          '<a class="gb-singles gb-paused-shop" href="shop.html">Shop the boxes in stock →</a></div>' +
        '<p class="gb-fine">Pure desi ghee · No maida · ' + (cart() && cart().isPreorder && cart().isPreorder() ? 'Pre-order: dispatches 16 Oct' : 'Packed and dispatched within 48 hours') + '</p>' +
      '</aside>';

    function $(name) { return right.querySelector('[data-gb="' + name + '"]'); }
    var noteBox = $('note'), noteArea = noteBox.querySelector('textarea');
    // Pre-fill (and keep in sync with) the same note the cart page edits.
    var existing = cart().getGiftNote && cart().getGiftNote();
    if (existing) { noteArea.value = existing; noteBox.classList.add('open'); }
    noteArea.addEventListener('input', function () { cart().setGiftNote(noteArea.value); });
    $('notelink').addEventListener('click', function (e) {
      e.preventDefault(); noteBox.classList.toggle('open'); if (noteBox.classList.contains('open')) noteArea.focus();
    });

    // The page's Product data for the two sets follows live stock (Trio needs 3 Flavors in stock, Full Range all four).
    function syncSetSchema(trioOk, fullOk) {
      [].forEach.call(document.querySelectorAll('script[type="application/ld+json"]'), function (el) {
        try {
          var j = JSON.parse(el.textContent), nodes = j['@graph'] || [j], changed = false;
          nodes.forEach(function (n) {
            if (!n || n['@type'] !== 'Product' || !n.offers) return;
            var ok = n.sku === 'trio-gift-set' ? trioOk : n.sku === 'full-range-set' ? fullOk : null;
            if (ok === null) return;
            n.offers.availability = ok ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'; changed = true;
          });
          if (changed) el.textContent = JSON.stringify(j);
        } catch (e) { /* leave it */ }
      });
    }

    function canonical(list) { return FLAVOURS.filter(function (f) { return list.indexOf(f.value) !== -1; }).map(function (f) { return f.value; }); }

    function render() {
      var pn = right.querySelector('.gb-panel'); if (pn) pn.classList.toggle('gb-none', !picks.length);   // phones hide the empty price rows
      var slots = $('slots'); slots.innerHTML = ''; slots.style.gridTemplateColumns = 'repeat(' + size + ',1fr)';
      for (var i = 0; i < size; i++) {
        var s = document.createElement('div'); s.className = 'gb-slot';
        var v = picks[i];
        if (v) {
          var f = byValue(v); s.className += ' full'; s.style.setProperty('--c', f.color);
          s.innerHTML = '<img src="' + f.img + '" alt="' + f.title + '">' + (size === 3 ? '<button type="button" class="x" aria-label="Remove ' + f.title + '" data-idx="' + i + '">×</button>' : '');
        }
        slots.appendChild(s);
      }
      Array.prototype.forEach.call(slots.querySelectorAll('.x'), function (x) {
        x.onclick = function () { picks.splice(+x.getAttribute('data-idx'), 1); render(); };
      });
      $('filled').textContent = picks.length; $('size').textContent = size;
      $('barfill').style.width = (picks.length / size * 100) + '%';

      var set = SETS[size], full = picks.length === size;
      var mrp = picks.reduce(function (a, v) { return a + singlePrice(v); }, 0);
      $('mrp').textContent = inr(mrp);
      $('tot').textContent = full ? inr(set.price) : inr(mrp);
      var saving = mrp - set.price;
      $('sv').textContent = full ? (saving > 0 ? 'Save ' + inr(saving) : '—') : 'Fill it to unlock';
      // Hide the MRP comparison when the set price is within 5% of the cheapest boxes' MRP for this size (Trio ₹949 against
      // ₹950 after 9 Nov would read "Save ₹1"). Decided per set, not per pick, so the rows never vanish mid-fill.
      var cheapest = FLAVOURS.map(function (f) { return singlePrice(f.value); }).sort(function (a, b) { return a - b; })
        .slice(0, size).reduce(function (a, n) { return a + n; }, 0);
      var compare = set.price <= cheapest * 0.95;
      $('mrp').parentNode.style.display = compare ? '' : 'none';
      $('sv').parentNode.style.display = compare ? '' : 'none';

      // Which Flavors are out right now (live from the stock list). A Trio needs 3 different Flavors, the Full Range needs all four.
      var outNames = FLAVOURS.filter(function (f) { return soldOut(f.value); }).map(function (f) { return f.title.replace(/^Atta /, ''); });
      var inNames = FLAVOURS.filter(function (f) { return !soldOut(f.value); }).map(function (f) { return f.title.replace(/^Atta /, ''); });
      var list = function (a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]; };
      var stockMsg = left.querySelector('[data-gb-stock]');
      if (outNames.length) {
        stockMsg.textContent = list(outNames) + (outNames.length > 1 ? ' are' : ' is') + ' sold out for now' + (inNames.length ? '. ' + list(inNames) + (inNames.length > 1 ? ' are' : ' is') + ' available.' : '.') +
          (inNames.length < 3 ? ' A Trio needs 3 different flavors and the Full Range needs all four, so both are unavailable until we restock.' : size === 4 ? ' The Full Range needs all four flavors, so it returns when we restock.' : '');
        stockMsg.hidden = false;
      } else stockMsg.hidden = true;
      var fullOpt = left.querySelector('.gb-opt[data-size="4"] small');
      if (fullOpt) fullOpt.textContent = outNames.length ? 'Back soon · sold out today' : 'One of each · 1kg';

      // No set can be filled at all (fewer than 3 Flavors in stock): one short card instead of a builder that can't finish.
      var paused = inNames.length < 3;
      var panel = right.querySelector('.gb-panel'); if (panel) panel.classList.toggle('gb-is-paused', paused);
      $('paused').hidden = !paused;
      if (paused) {
        $('pausedText').textContent = 'A Trio needs three different Flavors and ' + list(outNames) + (outNames.length > 1 ? ' are' : ' is') + ' sold out until our next bake. ' + (inNames.length ? list(inNames) + (inNames.length > 1 ? ' are' : ' is') + ' in stock as single boxes.' : '');
        $('notify').href = 'https://wa.me/919988992024?text=' + encodeURIComponent('Hi Munchingo, please tell me when the gift sets are back.');
      }
      syncSetSchema(inNames.length >= 3, outNames.length === 0);
      var unavailable = (size === 4 && (fullRangeSoldOut() || outNames.length > 0)) || (size === 3 && inNames.length < 3);
      var cta = $('cta');
      cta.disabled = !full || unavailable;
      cta.textContent = unavailable ? (size === 4 ? 'Full Range returns soon' : 'Trio unavailable today') : (full ? 'Add gift set to bag →' : 'Pick ' + (size - picks.length) + ' more to unlock');
      $('singles').hidden = !unavailable;
      var pt = window.MunchingoPrices && window.MunchingoPrices.promoText ? window.MunchingoPrices.promoText(size === 4 ? 'full-range-set' : 'trio-gift-set') : '';
      $('promo').textContent = pt; $('promo').hidden = !pt;

      Array.prototype.forEach.call(left.querySelectorAll('.gb-fl'), function (b) {
        var v = b.getAttribute('data-f'), on = picks.indexOf(v) !== -1, out = soldOut(v);
        b.disabled = out || size === 4 || (!on && picks.length >= size);
        b.querySelector('.gb-plus').textContent = on ? '✓' : (out ? '–' : '+');
        b.classList.toggle('picked', on);
        b.title = out ? (byValue(v).title + ' is currently sold out') : '';
        b.classList.toggle('gb-out', out);
        b.querySelector('.gb-so').hidden = !out;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      left.querySelector('[data-gb-step2]').textContent = size === 4 ? 'Filled with all four flavors' : 'Fill it with any 3 flavors';
      $('surprise').hidden = size === 4; $('great').hidden = size !== 4;
      $('viewbag').hidden = true;
    }

    Array.prototype.forEach.call(left.querySelectorAll('.gb-opt'), function (o) {
      o.addEventListener('click', function () {
        Array.prototype.forEach.call(left.querySelectorAll('.gb-opt'), function (x) { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); });
        o.classList.add('on'); o.setAttribute('aria-checked', 'true');
        size = +o.getAttribute('data-size');
        picks = size === 4 ? FLAVOURS.map(function (f) { return f.value; }) : [];
        render();
      });
    });
    Array.prototype.forEach.call(left.querySelectorAll('.gb-fl'), function (b) {
      b.addEventListener('click', function () {
        var v = b.getAttribute('data-f');
        if (soldOut(v)) return;
        var at = picks.indexOf(v);
        if (at !== -1) picks.splice(at, 1); else if (picks.length < size) picks.push(v);
        render();
      });
    });
    $('surprise').addEventListener('click', function () {
      var pool = FLAVOURS.map(function (f) { return f.value; }).filter(function (v) { return !soldOut(v); });
      if (pool.length < 3) return;
      pool.sort(function () { return Math.random() - .5; }); picks = pool.slice(0, 3); render();
    });

    $('cta').addEventListener('click', function () {
      if (picks.length !== size) return;
      var set = SETS[size], item;
      if (size === 4) {
        item = { slug: set.slug, name: set.name, price: set.price, unit: set.unit };
      } else {
        var vals = canonical(picks);
        item = {
          slug: 'trio-gift-set-' + vals.map(slugify).sort().join('-'),
          name: 'Trio Gift Set (' + vals.map(function (v) { return byValue(v).label; }).join(', ') + ')',
          price: set.price, unit: set.unit
        };
      }
      if (cart().isSlugSoldOut(item.slug)) return;
      cart().addToCart(item);
      if (cart().renderBadge) cart().renderBadge();
      var c = $('cta'); c.textContent = 'Added to bag ✓';
      $('viewbag').hidden = false;
      setTimeout(function () { if (picks.length === size) c.textContent = 'Add gift set to bag →'; }, 1600);
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
