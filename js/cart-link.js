// Add-to-bag links: https://munchingo.com/cart?add=<id>[,<id>...]&qty=<n>
// Lets Google Shopping ("checkout link"), Instagram, WhatsApp and ads drop a product straight into the bag.
// <id> can be the site slug (atta-kesari), the Google Merchant Center id (MNG-KESARI-250) or the Meta catalogue id.
// "add=atta-kesari:2,atta-ajwain" gives 2 Kesari and 1 Ajwain. Unknown or sold-out ids are skipped. The add/qty params are removed
// from the address afterwards (utm and click ids stay), so a refresh never adds the item twice.
(function () {
  'use strict';
  var C = window.MunchingoCart; if (!C || !location.search) return;
  var PRODUCTS = {
    'atta-original': { name: 'Atta Original', price: 259, unit: '250g', ids: ['MNG-ORIGINAL-250', '91slwpjdqq'] },
    'atta-ajwain': { name: 'Atta Ajwain', price: 259, unit: '250g', ids: ['MNG-AJWAIN-250', '97q9r5q5q3'] },
    'atta-kesari': { name: 'Atta Kesari', price: 299, unit: '250g', ids: ['MNG-KESARI-250', 'w2w5ynf2m5'] },
    'atta-lite-sugar': { name: 'Atta Sugar-Lite', price: 299, unit: '250g', ids: ['MNG-LITE-250', 'vf5p90bcy5'] }
  };
  function resolve(raw) {
    var k = String(raw || '').trim().toLowerCase(), slug;
    if (!k) return null;
    for (slug in PRODUCTS) {
      if (slug === k || PRODUCTS[slug].ids.some(function (i) { return i.toLowerCase() === k; })) return slug;
    }
    return null;
  }
  var params = new URLSearchParams(location.search), add = params.get('add');
  if (!add) return;
  var defaultQty = parseInt(params.get('qty'), 10); if (!(defaultQty >= 1)) defaultQty = 1;
  var wanted = {}, order = [];
  add.split(',').slice(0, 8).forEach(function (part) {
    var bits = part.split(':'), slug = resolve(bits[0]); if (!slug) return;
    var q = bits.length > 1 ? parseInt(bits[1], 10) : defaultQty; if (!(q >= 1)) q = 1;
    if (!(slug in wanted)) { wanted[slug] = 0; order.push(slug); }
    wanted[slug] = Math.min(20, wanted[slug] + q);
  });
  var skipped = [];
  order.forEach(function (slug) {
    var p = PRODUCTS[slug], P = window.MunchingoPrices;
    if (C.isSlugSoldOut && C.isSlugSoldOut(slug)) { skipped.push(p.name); return; }
    var item = { slug: slug, name: p.name, price: P ? P.price(slug, p.price) : p.price, mrp: P ? (P.mrp(slug, null) || undefined) : undefined, unit: p.unit };
    C.addToCart(item);                                                       // tracked add_to_cart, bag-of-four suggestions
    for (var i = 1; i < wanted[slug]; i++) C.addToCart(item, { silent: true });
    if (wanted[slug] > 1) C.setQty(slug, C.getCart().filter(function (c) { return c.slug === slug; })[0].qty);
  });
  // Tidy the address so a refresh does not add again; keep utm_* and click ids for attribution.
  try {
    params.delete('add'); params.delete('qty');
    var rest = params.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  } catch (e) { /* very old browser: the params stay, so a refresh adds again */ }
  if (skipped.length) {
    document.addEventListener('DOMContentLoaded', function () {
      var el = document.getElementById('cart-aov-progress') || document.getElementById('cart-list'); if (!el) return;
      var n = document.createElement('p'); n.className = 'muted'; n.setAttribute('role', 'status'); n.style.cssText = 'margin:0 0 12px;font-weight:600';
      n.textContent = skipped.join(', ') + (skipped.length > 1 ? ' are' : ' is') + ' sold out right now, so it was not added.';
      el.parentNode.insertBefore(n, el);
    });
  }
})();
