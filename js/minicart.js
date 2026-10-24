// Mini bag: the header cart icon opens a slide-in panel (items with - qty +, a suggested set, the stock-up offer, subtotal, Checkout)
// instead of leaving the page. cart.html stays as the full bag ("View full bag"). Not shown on cart / checkout / order-confirmed.
(function () {
  'use strict';
  if (/(^|\/)(cart|checkout|order-confirmed)(\.html)?\/?$/.test(location.pathname)) return;
  var BASE = ['atta-original', 'atta-kesari', 'atta-lite-sugar', 'atta-ajwain'];
  var panel, overlay, body, countEl, lastFocus;
  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function C() { return window.MunchingoCart; }

  function build() {
    overlay = el('div', 'mc-overlay'); overlay.addEventListener('click', close);
    panel = el('aside', 'mc-panel'); panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Your bag'); panel.hidden = true; overlay.hidden = true;
    var head = el('div', 'mc-head'); countEl = el('b', null, 'Your bag');
    var x = el('button', 'mc-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close bag'); x.addEventListener('click', close);
    head.appendChild(countEl); head.appendChild(x);
    body = el('div', 'mc-body');
    panel.appendChild(head); panel.appendChild(body);
    document.body.appendChild(overlay); document.body.appendChild(panel);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  }

  function line(c) {
    var row = el('div', 'mc-line');
    var info = el('div', 'mc-info'); info.appendChild(el('b', null, c.name)); info.appendChild(el('small', null, c.unit + ' · ' + inr(c.price) + ' each'));
    var step = el('div', 'mc-step');
    var dec = el('button', null, '−'); dec.type = 'button'; dec.setAttribute('aria-label', 'One less');
    var out = el('output', null, String(c.qty));
    var inc = el('button', null, '+'); inc.type = 'button'; inc.setAttribute('aria-label', 'One more');
    dec.addEventListener('click', function () { if (c.qty <= 1) C().removeFromCart(c.slug); else C().setQty(c.slug, c.qty - 1); });
    inc.addEventListener('click', function () { if (c.qty < 50) C().setQty(c.slug, c.qty + 1); });
    step.appendChild(dec); step.appendChild(out); step.appendChild(inc);
    var side = el('div', 'mc-side'); side.appendChild(el('b', null, inr(c.price * c.qty)));
    var rm = el('button', 'mc-rm', 'Remove'); rm.type = 'button'; rm.addEventListener('click', function () { C().removeFromCart(c.slug); });
    side.appendChild(rm);
    row.appendChild(info); row.appendChild(step); row.appendChild(side);
    return row;
  }

  function render() {
    if (!panel || !C()) return;
    var cart = C().getCart(), n = C().cartCount();
    countEl.textContent = n ? 'Your bag (' + n + ')' : 'Your bag';
    body.textContent = '';
    if (!cart.length) {
      body.appendChild(el('p', 'mc-empty', 'Your bag is empty. Online orders start at ' + C().MIN_BOXES + ' boxes.'));
      var shop = el('a', 'btn solid mc-cta', 'Shop the range'); shop.href = 'index.html#range'; shop.addEventListener('click', close); body.appendChild(shop);
      return;
    }
    var list = el('div', 'mc-lines'); cart.forEach(function (c) { list.appendChild(line(c)); }); body.appendChild(list);

    var total = C().cartTotal();
    var sum = el('div', 'mc-sum');
    var ship = C().cartShipping(), short = C().boxesShort();
    var r1 = el('div', 'mc-row'); r1.appendChild(el('span', null, 'Subtotal')); r1.appendChild(el('b', null, inr(total))); sum.appendChild(r1);
    var r2 = el('div', 'mc-row'); r2.appendChild(el('span', null, 'Shipping')); r2.appendChild(el('b', null, short ? '\u2014' : (ship ? inr(ship) : 'Free'))); sum.appendChild(r2);
    sum.appendChild(el('small', null, 'Inclusive of GST. Free shipping from ' + inr(C().FREE_FROM) + '; ' + inr(C().SHIPPING_FEE) + ' below that.'));
    body.appendChild(sum);

    var cta;
    if (short) {
      body.appendChild(el('p', 'mc-note', 'Add ' + short + ' more box' + (short === 1 ? '' : 'es') + ' to check out (online orders start at ' + C().MIN_BOXES + ' boxes).'));
      cta = el('a', 'btn solid mc-cta', 'Add ' + short + ' more box' + (short === 1 ? '' : 'es')); cta.href = 'index.html#range'; cta.addEventListener('click', close);
    } else {
      if (ship) body.appendChild(el('p', 'mc-note', 'Add one more box and shipping is free.'));
      cta = el('a', 'btn solid mc-cta', 'Checkout \u2192'); cta.href = 'checkout.html';
    }
    body.appendChild(cta);
    var full = el('a', 'mc-full', 'View full bag'); full.href = 'cart.html'; body.appendChild(full);
  }

  function open() {
    if (!panel) build();
    lastFocus = document.activeElement; render();
    overlay.hidden = false; panel.hidden = false;
    requestAnimationFrame(function () { overlay.classList.add('on'); panel.classList.add('on'); });
    document.documentElement.classList.add('mc-lock');
    var x = panel.querySelector('.mc-x'); if (x) x.focus();
  }
  function close() {
    if (!panel || panel.hidden) return;
    overlay.classList.remove('on'); panel.classList.remove('on'); document.documentElement.classList.remove('mc-lock');
    setTimeout(function () { overlay.hidden = true; panel.hidden = true; }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function start() {
    [].forEach.call(document.querySelectorAll('a[href="cart.html"][aria-label="Cart"]'), function (a) {
      a.addEventListener('click', function (e) { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); open(); });
    });
    document.addEventListener('munchingo:cart', function () { if (panel && !panel.hidden) render(); });
    document.addEventListener('munchingo:offer', function () { if (panel && !panel.hidden) render(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
