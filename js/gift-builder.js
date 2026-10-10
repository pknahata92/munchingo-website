// Munchingo gift-set builder — used on index.html (#gifts).
// Pages supply the headline copy plus two empty mount points:
//   <div data-gb-left></div>   (step 1 set choice + step 2 flavour tiles)
//   <div data-gb-right></div>  (the dark "your gift set" panel)
// Everything that touches the cart goes through window.MunchingoCart, using the
// exact slugs / names / prices gifting.html already sends, so the backend's
// catalog check (utils/catalog.js) and the cart page treat both builders alike.
(function () {
  'use strict';

  // Same figures as gifting.html's static Add-to-Bag buttons.
  var SETS = {
    3: { price: 739, name: 'Trio Gift Set', unit: '750g, 3 flavours' },
    4: { slug: 'full-range-set', price: 999, name: 'Full Range Gift Set', unit: '1kg, one of each' }
  };
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
  var SINGLE_FALLBACK = { Original: 259, Kesari: 299, 'Lite-sugar': 299, Ajwain: 259 };
  var PRODUCT_SLUG = { Original: 'atta-original', Kesari: 'atta-kesari', 'Lite-sugar': 'atta-lite-sugar', Ajwain: 'atta-ajwain' };

  var cart = function () { return window.MunchingoCart; };
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function singlePrice(value) {
    var list = window.MUNCHINGO_PRODUCTS || [];
    for (var i = 0; i < list.length; i++) if (list[i].slug === PRODUCT_SLUG[value]) return list[i].price;
    return SINGLE_FALLBACK[value];
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
    var picks = [];        // flavour values, in tap order

    left.innerHTML =
      '<p class="gb-step"><i>1</i>Choose your set</p>' +
      '<div class="gb-opts" role="radiogroup" aria-label="Gift set size">' +
        '<button type="button" class="gb-opt on" data-size="3" role="radio" aria-checked="true"><span class="gb-flag">PICK &amp; MIX</span><span class="n">3</span><span><b>Trio Gift Set</b><small>Any 3 of our 4 flavours · 750g</small></span></button>' +
        '<button type="button" class="gb-opt" data-size="4" role="radio" aria-checked="false"><span class="gb-flag">BEST VALUE</span><span class="n">4</span><span><b>Full Range Gift Set</b><small>One of each · 1kg</small></span></button>' +
      '</div>' +
      '<p class="gb-step"><i>2</i><span data-gb-step2>Fill it with any 3 flavours</span></p>' +
      '<div class="gb-flavours">' +
        FLAVOURS.map(function (f) {
          return '<button type="button" class="gb-fl" style="--c:' + f.color + '" data-f="' + f.value + '">' +
                 '<span class="gb-plus">+</span><img src="' + f.img + '" alt="" loading="lazy"><span>' + f.title + '</span></button>';
        }).join('') +
      '</div>';

    right.innerHTML =
      '<aside class="gb-panel" aria-live="polite">' +
        '<div class="gb-k">Your gift set</div>' +
        '<div class="gb-count"><span data-gb="filled">0</span> <small>/ <span data-gb="size">3</span> boxes</small></div>' +
        '<div class="gb-slots" data-gb="slots"></div>' +
        '<div class="gb-bar"><i data-gb="barfill"></i></div>' +
        '<button type="button" class="gb-btn-dark" data-gb="surprise">✦ Surprise me</button>' +
        '<p class="gb-great" data-gb="great" hidden>✦ Great choice — every flavour, already in the box.</p>' +
        '<div class="gb-note" data-gb="note"><span>🎁</span><a href="#" data-gb="notelink">Add a gift note</a>' +
          '<textarea rows="3" maxlength="200" placeholder="Happy Diwali! Love, …" aria-label="Gift note"></textarea></div>' +
        '<div class="gb-row"><span>Bought separately</span><s data-gb="mrp">₹0</s></div>' +
        '<div class="gb-row gb-save"><span>You save</span><b data-gb="sv">—</b></div>' +
        '<div class="gb-total"><span>Total</span><b data-gb="tot">₹0</b></div>' +
        '<button type="button" class="btn solid gb-cta" data-gb="cta" disabled>Pick 3 flavours to start</button>' +
        '<a class="gb-viewbag" data-gb="viewbag" href="cart.html" hidden>View your bag →</a>' +
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

    function canonical(list) { return FLAVOURS.filter(function (f) { return list.indexOf(f.value) !== -1; }).map(function (f) { return f.value; }); }

    function render() {
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
      $('sv').textContent = full ? (saving > 0 ? inr(saving) + ' off' : '—') : 'Fill it to unlock';

      var unavailable = size === 4 && fullRangeSoldOut();
      var cta = $('cta');
      cta.disabled = !full || unavailable;
      cta.textContent = unavailable ? 'Sold out' : (full ? 'Add gift set to bag →' : 'Pick ' + (size - picks.length) + ' more to unlock');

      Array.prototype.forEach.call(left.querySelectorAll('.gb-fl'), function (b) {
        var v = b.getAttribute('data-f'), on = picks.indexOf(v) !== -1, out = soldOut(v);
        b.disabled = out || size === 4 || (!on && picks.length >= size);
        b.querySelector('.gb-plus').textContent = on ? '✓' : (out ? '–' : '+');
        b.classList.toggle('picked', on);
        b.title = out ? (byValue(v).title + ' is currently sold out') : '';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      left.querySelector('[data-gb-step2]').textContent = size === 4 ? 'Filled with all four flavours' : 'Fill it with any 3 flavours';
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
