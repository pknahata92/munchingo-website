// "Start with a Pack of 2" on the home page (#pack2): pick any two Flavors (the same one twice is fine), see the total, the
// saving against the printed MRP and the shipping line, then add both boxes to the bag in one tap. Sold-out Flavors are shown
// as such and cannot be picked. Rules come from js/cart.js (MIN_BOXES, FREE_FROM, SHIPPING_FEE); the server re-checks all of it.
(function () {
  'use strict';
  var root = document.getElementById('pack2');
  if (!root || !window.MUNCHINGO_PRODUCTS || !window.MunchingoCart) return;
  var C = window.MunchingoCart, list = window.MUNCHINGO_PRODUCTS;
  var COLOR = { 'atta-original': '#7C2230', 'atta-kesari': '#A9582F', 'atta-ajwain': '#4F6579', 'atta-lite-sugar': '#6B4F63' };
  var inr = function (n) { return '₹' + Number(n).toLocaleString('en-IN'); };
  var picks = [];
  var bySlug = function (s) { for (var i = 0; i < list.length; i++) if (list[i].slug === s) return list[i]; return null; };
  var out = function (s) { return !!(C.isSlugSoldOut && C.isSlugSoldOut(s)); };

  root.innerHTML =
    '<div class="p2-tiles">' + list.map(function (p) {
      return '<button type="button" class="p2-tile" data-p2="' + p.slug + '" style="--c:' + (COLOR[p.slug] || '#2A1A12') + '">' +
        '<img src="' + p.img + '" alt="" loading="lazy" width="160" height="160"><b>' + p.name.replace(/^Atta /, '') + '</b>' +
        '<span class="p2-price">' + inr(p.price) + (p.mrp > p.price ? ' <s>' + inr(p.mrp) + '</s>' : '') + '</span>' +
        '<em class="p2-out" hidden>Sold out · back soon</em></button>';
    }).join('') + '</div>' +
    '<div class="p2-panel" aria-live="polite">' +
      '<div class="p2-slots"><span data-slot="0">Pick a Flavor</span><span class="p2-plus">+</span><span data-slot="1">Pick a Flavor</span></div>' +
      '<div class="p2-sum"><span data-p2-total>₹0</span> <s data-p2-mrp hidden></s> <i data-p2-save hidden></i></div>' +
      '<p class="p2-ship">+ ' + inr(C.SHIPPING_FEE) + ' shipping on a Pack of 2. Add a third box and shipping is free (from ' + inr(C.FREE_FROM) + ').</p>' +
      '<button type="button" class="btn solid p2-add" data-p2-add disabled>Pick 2 Flavors</button>' +
      '<a class="p2-bag" href="cart.html" data-p2-bag hidden>View your bag →</a>' +
    '</div>';

  function render() {
    Array.prototype.forEach.call(root.querySelectorAll('[data-p2]'), function (b) {
      var s = b.getAttribute('data-p2'), o = out(s), n = picks.filter(function (x) { return x === s; }).length;
      b.disabled = o || (picks.length >= 2 && !n);
      b.classList.toggle('on', n > 0); b.classList.toggle('is-out', o);
      b.querySelector('.p2-out').hidden = !o;
      b.setAttribute('aria-pressed', n ? 'true' : 'false');
      b.title = o ? 'Sold out for now' : (n === 2 ? 'Two of this one' : '');
    });
    for (var i = 0; i < 2; i++) {
      var slot = root.querySelector('[data-slot="' + i + '"]'), p = picks[i] && bySlug(picks[i]);
      slot.textContent = p ? p.name.replace(/^Atta /, '') + ' ×' : 'Pick a Flavor';
      slot.classList.toggle('full', !!p); slot.setAttribute('role', p ? 'button' : 'presentation');
    }
    var total = picks.reduce(function (n, s) { return n + bySlug(s).price; }, 0);
    var mrp = picks.reduce(function (n, s) { var p = bySlug(s); return n + (p.mrp > p.price ? p.mrp : p.price); }, 0);
    root.querySelector('[data-p2-total]').textContent = inr(total);
    var m = root.querySelector('[data-p2-mrp]'), sv = root.querySelector('[data-p2-save]');
    m.hidden = sv.hidden = !(picks.length && mrp > total);
    m.textContent = inr(mrp); sv.textContent = 'Save ' + inr(mrp - total);
    var add = root.querySelector('[data-p2-add]');
    add.disabled = picks.length !== 2;
    add.textContent = picks.length === 2 ? 'Add Pack of 2 to bag · ' + inr(total) : 'Pick ' + (2 - picks.length) + ' more Flavor' + (picks.length === 1 ? '' : 's');
  }

  root.addEventListener('click', function (e) {
    var t = e.target.closest('[data-p2]');
    if (t) {
      var s = t.getAttribute('data-p2'); if (out(s)) return;
      if (picks.length < 2) picks.push(s); else { var at = picks.lastIndexOf(s); if (at !== -1) picks.splice(at, 1); }
      root.querySelector('[data-p2-bag]').hidden = true; return render();
    }
    var slot = e.target.closest('[data-slot]');
    if (slot && picks[Number(slot.getAttribute('data-slot'))]) { picks.splice(Number(slot.getAttribute('data-slot')), 1); return render(); }
    if (e.target.closest('[data-p2-add]') && picks.length === 2) {
      picks.forEach(function (s) { var p = bySlug(s); C.addToCart({ slug: p.slug, name: p.name, price: p.price, mrp: p.mrp > p.price ? p.mrp : undefined, unit: '250g' }); });
      if (C.track) C.track('add_to_cart', 'AddToCart', { currency: 'INR', value: picks.reduce(function (n, s) { return n + bySlug(s).price; }, 0), items: picks.map(function (s) { return { item_id: s, quantity: 1 }; }) });
      picks = []; render();
      var add = root.querySelector('[data-p2-add]'); add.textContent = 'Added ✓'; root.querySelector('[data-p2-bag]').hidden = false;
    }
  });
  render();
})();
