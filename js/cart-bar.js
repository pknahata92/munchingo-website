// Sticky "bag" bar for phones: appears once something is in the bag and sends the
// customer straight to checkout (checkout.html already shows the order summary,
// the minimum-order progress and cross-sells, so the separate bag page is optional).
// Not shown on cart / checkout / order-confirmed.
(function () {
  'use strict';
  var MIN_ORDER = 499; // keep equal to MIN_ORDER_VALUE in checkout.html
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
    var short = Math.max(0, MIN_ORDER - total);
    q('count').textContent = n + (n === 1 ? ' item' : ' items');
    q('total').textContent = inr(total);
    q('fill').style.width = Math.min(100, Math.round(total / MIN_ORDER * 100)) + '%';
    q('hint').textContent = short ? 'Add ' + inr(short) + ' more to order' : 'Ready to order';
    var cta = q('cta');
    if (short) { cta.textContent = 'Add ' + inr(short) + ' more'; cta.setAttribute('href', 'index.html#range'); }
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
