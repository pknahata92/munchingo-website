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

  // Stock-up offer (js/offers.js): how close the single boxes in the bag are to the percentage tier. Gift sets never count.
  var BASE = ['atta-original', 'atta-kesari', 'atta-lite-sugar', 'atta-ajwain'];
  function offerHint(c) {
    var o = window.MunchingoOffers && window.MunchingoOffers.tier();
    if (!o || !o.pct) return '';
    var singles = c.getCart().filter(function (i) { return BASE.indexOf(i.slug) !== -1; }).reduce(function (n, i) { return n + i.price * i.qty; }, 0);
    if (!singles) return '';
    if (singles >= o.min) {
      var d = Math.round(singles * o.pct / 100); if (o.cap) d = Math.min(d, o.cap);
      return o.pct + '% off unlocked · saves ' + inr(d);
    }
    return 'Add ' + inr(o.min - singles) + ' more for ' + o.pct + '% off';
  }

  // A cheaper set the buyer could choose (js/cart.js suggestion()): only a tip here; the choice is made in the bag.
  function setHint(c) {
    var sg = c.suggestion && c.suggestion();
    return sg ? 'Tip: save ' + inr(sg.saved) + ' as a ' + (sg.kind === 'trio' ? 'Trio' : 'Full Range') + ' set' : '';
  }

  function q(n) { return bar.querySelector('[data-mcb-' + n + ']'); }
  function refresh() {
    var c = window.MunchingoCart; if (!c) return;
    var n = c.cartCount(), total = c.cartTotal();
    if (!n) { bar.classList.remove('on'); document.body.classList.remove('has-mcb'); return; }
    var min = c.MIN_ORDER_VALUE, short = Math.max(0, min - total);
    q('count').textContent = n + (n === 1 ? ' item' : ' items');
    q('total').textContent = inr(total);
    q('fill').style.width = Math.min(100, Math.round(total / min * 100)) + '%';
    q('hint').textContent = short ? 'Minimum order ' + inr(min) : (setHint(c) || offerHint(c) || 'Ready to order');
    var cta = q('cta');
    if (short) { cta.textContent = 'Add ' + inr(short) + ' more'; cta.setAttribute('href', 'index.html#range'); }
    else { cta.textContent = 'Checkout \u2192'; cta.setAttribute('href', 'checkout.html'); }
    bar.classList.add('on'); document.body.classList.add('has-mcb');
  }

  function start() {
    document.body.appendChild(bar);
    refresh();
    document.addEventListener('munchingo:cart', refresh);
    document.addEventListener('munchingo:offer', refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('pageshow', refresh);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
