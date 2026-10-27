// Product pages (atta-*.html): sold-out state for the main buy box, the product data Google reads, and the phone's
// bottom bars. Runs after js/cart.js, which knows the sold-out list (/api/stock, cached in localStorage).
(function () {
  'use strict';
  var WA = '919988992024';

  function slugOfPage() {
    var b = document.querySelector('.v2-pricebox [data-price-for]');
    return b ? b.getAttribute('data-price-for') : null;
  }

  // Sold out: no "Add to bag" anywhere on the page for this Flavor, a plain notice instead, and a way to hear when it is back.
  function applySoldOut(slug, name) {
    var add = document.getElementById('add'), add2 = document.getElementById('add2');
    var row = document.querySelector('.v2-qtyrow'), sticky = document.getElementById('sticky');
    if (!add || !row) return;
    [add, add2].forEach(function (b) { if (b) { b.disabled = true; b.textContent = 'Sold out'; b.classList.add('sold-out'); b.onclick = null; } });
    var minus = document.getElementById('minus'), plus = document.getElementById('plus');
    if (minus) minus.disabled = true; if (plus) plus.disabled = true;
    row.classList.add('v2-soldout');
    if (!document.getElementById('soldout-note')) {
      var note = document.createElement('div');
      note.id = 'soldout-note';
      note.className = 'v2-soldout-note';
      note.setAttribute('role', 'status');
      var text = 'Hi Munchingo, please tell me when ' + name + ' is back in stock.';
      note.innerHTML = '<b>' + name + ' is sold out.</b> We bake in small batches and it will be back soon. ' +
        '<a href="https://wa.me/' + WA + '?text=' + encodeURIComponent(text) + '" rel="noopener">Tell me when it’s back</a>';
      row.parentNode.insertBefore(note, row.nextSibling);
    }
    if (sticky) sticky.classList.add('v2-soldout');
    // The minimum-order nudge would push this Flavor; hide it while it can't be bought.
    var mov = document.getElementById('mov'); if (mov) mov.hidden = true;
  }

  // Keep the Product structured data honest: OutOfStock while sold out.
  function syncSchema(soldOut) {
    [].forEach.call(document.querySelectorAll('script[type="application/ld+json"]'), function (s) {
      try {
        var j = JSON.parse(s.textContent), changed = false;
        (Array.isArray(j) ? j : [j]).forEach(function (node) {
          var offers = node && node['@type'] === 'Product' && node.offers;
          (Array.isArray(offers) ? offers : offers ? [offers] : []).forEach(function (o) {
            o.availability = soldOut ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock'; changed = true;
          });
        });
        if (changed) s.textContent = JSON.stringify(j);
      } catch (e) { /* leave malformed blocks alone */ }
    });
  }

  // Phone: the product's own sticky bar and the bag bar used to sit on the same spot, bag bar on top. While the
  // product bar shows, the bag bar steps aside and the product bar carries a small link to the bag.
  function bagLink() {
    var sticky = document.getElementById('sticky'), C = window.MunchingoCart;
    if (!sticky || !C) return;
    var a = sticky.querySelector('.v2-sticky-bag');
    if (!a) { a = document.createElement('a'); a.className = 'v2-sticky-bag'; sticky.appendChild(a); }
    var n = C.cartCount();
    a.hidden = !n;
    a.href = C.boxesShort() ? 'shop.html' : 'checkout.html';
    a.textContent = 'Bag · ' + n;
    a.setAttribute('aria-label', 'Your bag, ' + n + (n === 1 ? ' item' : ' items'));
  }

  function start() {
    var slug = slugOfPage(), C = window.MunchingoCart;
    if (!slug || !C) return;
    var h1 = document.querySelector('.v2-buy h1'), name = h1 ? h1.textContent.trim() : 'This Flavor';
    var out = !!(C.isSlugSoldOut && C.isSlugSoldOut(slug));
    if (out) applySoldOut(slug, name);
    syncSchema(out);
    bagLink();
    document.addEventListener('munchingo:cart', bagLink);
    window.addEventListener('pageshow', bagLink);
  }
  // Run after the page's own buy-box script (it sets the button label on DOMContentLoaded), or that label wins.
  function later() { setTimeout(start, 0); }
  if (document.readyState === 'complete') later(); else document.addEventListener('DOMContentLoaded', later);
})();
