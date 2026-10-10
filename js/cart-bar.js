// Sticky "bag" bar for phones: appears once something is in the bag and sends the
// customer straight to checkout (checkout.html already shows the order summary,
// the minimum-order progress and cross-sells, so the separate bag page is optional).
// Not shown on cart / checkout / order-confirmed.
(function () {
  'use strict';
  if (/(^|\/)(cart|checkout|order-confirmed)(\.html)?\/?$/.test(location.pathname)) return;

  function inr(n) { return '₹' + Number(n).toLocaleString('en-IN'); }
  var bar = document.createElement('div');
  bar.className = 'mcb';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Your bag');
  bar.innerHTML =
    '<div class="mcb-info"><div class="mcb-line"><b data-mcb-count></b><span data-mcb-total></span></div>' +
    '<div class="mcb-prog" aria-hidden="true"><i data-mcb-fill></i></div><small data-mcb-hint></small></div>' +
    '<a class="btn solid mcb-cta" data-mcb-cta href="checkout.html">Checkout →</a>';

  function q(n) { return bar.querySelector('[data-mcb-' + n + ']'); }
  function refresh() {
    var c = window.MunchingoCart; if (!c) return;
    var n = c.cartCount(), total = c.cartTotal();
    if (!n) { bar.classList.remove('on'); document.body.classList.remove('has-mcb'); return; }
    var boxes = c.cartBoxes(), min = c.MIN_BOXES, short = Math.max(0, min - boxes);
    q('count').textContent = n + (n === 1 ? ' item' : ' items');
    q('total').textContent = inr(total);
    q('fill').style.width = Math.min(100, Math.round(boxes / min * 100)) + '%';
    var more = short + (short === 1 ? ' more box' : ' more boxes');
    q('hint').textContent = short ? 'Add ' + more + ' to order (' + min + '-box minimum)' : 'Ready to order';
    var cta = q('cta');
    if (short) { cta.textContent = 'Add ' + more; cta.setAttribute('href', 'index.html#range'); }
    else { cta.textContent = 'Checkout →'; cta.setAttribute('href', 'checkout.html'); }
    bar.classList.add('on'); document.body.classList.add('has-mcb');
  }

  function start() {
    document.body.appendChild(bar);
    refresh();
    document.addEventListener('munchingo:cart', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
