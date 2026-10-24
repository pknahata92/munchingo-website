// Stall tally (stall.html, munchingo.com/stall). One entry per CUSTOMER: tap the packs into the basket, then Paid UPI or
// Paid Cash, so each entry matches one UPI payment in the Eazypay report. Saved on this device only, one list per IST day
// (the basket in progress too), so a reload or a dropped connection loses nothing. Contribution uses the v14 pack costs
// (Documents/munchingo_pricing_v14.xlsx): price less 5% GST, less pack costs, less Rs 100 hamper packaging.
(function () {
  'use strict';
  var KEY = 'munchingo-stall-v1';
  var FLAV = [
    { id: 'original', name: 'Original', cost: 119 },
    { id: 'ajwain', name: 'Ajwain', cost: 119 },
    { id: 'kesari', name: 'Kesari', cost: 133 },
    { id: 'lite', name: 'Sugar-Lite', cost: 156 },
  ];
  var ITEMS = {
    original: { name: 'Original', price: 200, mix: { original: 1 } },
    ajwain: { name: 'Ajwain', price: 200, mix: { ajwain: 1 } },
    kesari: { name: 'Kesari', price: 250, mix: { kesari: 1 } },
    lite: { name: 'Sugar-Lite', price: 250, mix: { lite: 1 } },
    h3: { name: 'Hamper of 3', price: 799, hamper: true, pick: 3 },
    h4: { name: 'Hamper of 4', price: 999, hamper: true, pick: 4 },
  };
  var HAMPER_PACKAGING = 100, GST = 0.05, STALL_FEE = 10000;
  var $ = function (id) { return document.getElementById(id); };
  var rupees = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };

  // ── storage ──
  var saved = true, mem = { days: {} };
  function load() {
    try { var raw = window.localStorage.getItem(KEY); mem = raw ? JSON.parse(raw) : { days: {} }; if (!mem.days) mem.days = {}; window.localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { saved = false; }
    Object.keys(mem.days).forEach(function (k) { normalise(mem.days[k]); });
  }
  function persist() { try { window.localStorage.setItem(KEY, JSON.stringify(mem)); saved = true; } catch (e) { saved = false; } }
  // Days saved before 25 Oct 05:00 IST hold single taps in `sales`; each becomes a one-pack customer.
  function normalise(day) {
    if (!day.orders) day.orders = [];
    if (!day.opening) day.opening = {};
    if (!day.basket) day.basket = [];
    if (day.sales && day.sales.length) {
      day.sales.forEach(function (s) { day.orders.push({ id: s.id, n: day.orders.length + 1, t: s.t, pay: s.pay, lines: [{ item: s.item, name: s.name, price: s.price, hamper: !!s.hamper, mix: s.mix }] }); });
    }
    delete day.sales;
    if (!day.seq) day.seq = day.orders.reduce(function (a, o) { return Math.max(a, o.n || 0); }, 0);
    return day;
  }

  function istParts(ms) {
    var iso = new Date(ms + 5.5 * 3600 * 1000).toISOString();
    return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
  var today = istParts(Date.now()).day;
  function dayData(day) { if (!mem.days[day]) mem.days[day] = normalise({}); return mem.days[day]; }
  function niceDay(day) { var p = day.split('-'); return Number(p[2]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(p[1]) - 1] + ' ' + p[0]; }

  function lineContribution(l) {
    var c = l.price / (1 + GST);
    FLAV.forEach(function (f) { c -= (l.mix[f.id] || 0) * f.cost; });
    if (l.hamper) c -= HAMPER_PACKAGING;
    return c;
  }
  var orderTotal = function (o) { return o.lines.reduce(function (a, l) { return a + l.price; }, 0); };
  function totals(orders) {
    var t = { total: 0, upi: 0, cash: 0, contrib: 0, n: {}, customers: orders.length };
    FLAV.forEach(function (f) { t.n[f.id] = 0; });
    orders.forEach(function (o) {
      var ot = orderTotal(o); t.total += ot; t[o.pay] += ot;
      o.lines.forEach(function (l) { t.contrib += lineContribution(l); FLAV.forEach(function (f) { t.n[f.id] += l.mix[f.id] || 0; }); });
    });
    return t;
  }
  function mixText(mix) {
    return FLAV.filter(function (f) { return mix[f.id]; }).map(function (f) { return (mix[f.id] > 1 ? mix[f.id] + '× ' : '') + f.name; }).join(', ');
  }
  var lineText = function (l) { return l.name + (l.hamper ? ' (' + mixText(l.mix) + ')' : ''); };

  // ── basket and payment ──
  function addLine(itemId, mix) {
    var it = ITEMS[itemId];
    dayData(today).basket.push({ item: itemId, name: it.name, price: it.price, hamper: !!it.hamper, mix: mix });
    persist(); render();
  }
  function removeLine(i) { dayData(today).basket.splice(i, 1); persist(); render(); }
  function clearBasket() { dayData(today).basket = []; persist(); render(); }
  function paid(pay) {
    var dd = dayData(today); if (!dd.basket.length) return;
    var now = Date.now(); dd.seq += 1;
    var o = { id: now + '-' + Math.random().toString(36).slice(2, 6), n: dd.seq, t: now, pay: pay, lines: dd.basket };
    dd.orders.push(o); dd.basket = [];
    persist(); render(); flash('#' + o.n + ' ' + rupees(orderTotal(o)) + (pay === 'cash' ? ' cash' : ' UPI'));
  }
  function undo() { var o = dayData(today).orders.pop(); if (o) { persist(); render(); flash('Undone: customer #' + o.n); } }
  function del(id) {
    var list = dayData(today).orders, i = list.findIndex(function (o) { return o.id === id; });
    if (i < 0) return;
    if (!window.confirm('Delete customer #' + list[i].n + ' (' + rupees(orderTotal(list[i])) + ')?')) return;
    list.splice(i, 1); persist(); render();
  }

  var flashTimer;
  function flash(msg) { var el = $('st-flash'); el.textContent = msg; el.hidden = false; clearTimeout(flashTimer); flashTimer = setTimeout(function () { el.hidden = true; }, 1600); }

  // hampers: choose the packs inside
  var pick = {}, pickItem = null;
  function openMix(itemId) {
    pickItem = itemId; pick = {}; FLAV.forEach(function (f) { pick[f.id] = 0; });
    $('st-mix-title').textContent = ITEMS[itemId].name + ': which flavors?';
    $('st-mix-ok').textContent = 'Add ' + rupees(ITEMS[itemId].price);
    renderMix(); $('st-mix').hidden = false;
  }
  var need = function () { return ITEMS[pickItem].pick; };
  function mixCount() { return FLAV.reduce(function (a, f) { return a + pick[f.id]; }, 0); }
  function renderMix() {
    FLAV.forEach(function (f) { $('st-mix-n-' + f.id).textContent = pick[f.id]; });
    $('st-mix-count').textContent = mixCount() + ' / ' + need();
    $('st-mix-ok').disabled = mixCount() !== need();
    $('st-mix-each').hidden = need() !== FLAV.length;
  }

  // ── view ──
  function render() {
    var dd = dayData(today), t = totals(dd.orders);
    $('st-total').textContent = rupees(t.total);
    $('st-upi').textContent = rupees(t.upi);
    $('st-cash').textContent = rupees(t.cash);
    $('st-contrib').textContent = rupees(t.contrib);
    $('st-sales').textContent = t.customers;
    $('st-sales-word').textContent = t.customers === 1 ? 'customer' : 'customers';
    $('st-avg').textContent = rupees(t.customers ? t.total / t.customers : 0);
    var allContrib = Object.keys(mem.days).reduce(function (a, k) { return a + totals(mem.days[k].orders).contrib; }, 0);
    $('st-fee').textContent = rupees(allContrib) + ' of ' + rupees(STALL_FEE) + ' stall fee covered (all days on this iPad)';
    FLAV.forEach(function (f) {
      $('st-n-' + f.id).textContent = t.n[f.id];
      var open = dd.opening[f.id], input = $('st-open-' + f.id);
      if (document.activeElement !== input) input.value = open == null ? '' : open;
      $('st-left-' + f.id).textContent = open == null ? '–' : (open - t.n[f.id]);
    });

    var b = $('st-basket'), bt = dd.basket.reduce(function (a, l) { return a + l.price; }, 0); b.textContent = '';
    dd.basket.forEach(function (l, i) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(lineText(l) + '  ' + rupees(l.price)));
      var x = document.createElement('button'); x.type = 'button'; x.setAttribute('data-remove', String(i)); x.setAttribute('aria-label', 'Take out ' + l.name); x.textContent = '×';
      li.appendChild(x); b.appendChild(li);
    });
    $('st-basket-empty').hidden = dd.basket.length > 0;
    $('st-basket-total').textContent = rupees(bt);
    $('st-paid-upi').textContent = 'Paid UPI' + (bt ? ' ' + rupees(bt) : '');
    $('st-paid-cash').textContent = 'Paid Cash' + (bt ? ' ' + rupees(bt) : '');
    $('st-paid-upi').disabled = $('st-paid-cash').disabled = !dd.basket.length;

    var log = $('st-log'); log.textContent = '';
    dd.orders.slice().reverse().slice(0, 30).forEach(function (o) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode('#' + o.n + '  ' + istParts(o.t).time + '  ' + o.lines.map(lineText).join(' + ') + '  ' + rupees(orderTotal(o)) + (o.pay === 'cash' ? ' · cash' : ' · UPI')));
      var x = document.createElement('button'); x.type = 'button'; x.setAttribute('data-del', o.id); x.setAttribute('aria-label', 'Delete customer #' + o.n); x.textContent = '×';
      li.appendChild(x); log.appendChild(li);
    });
    var days = $('st-days'); days.textContent = '';
    Object.keys(mem.days).sort().reverse().filter(function (k) { return k !== today && mem.days[k].orders.length; }).forEach(function (k) {
      var x = totals(mem.days[k].orders), li = document.createElement('li');
      li.textContent = niceDay(k) + ': ' + x.customers + (x.customers === 1 ? ' customer, ' : ' customers, ') + rupees(x.total) + ' (UPI ' + rupees(x.upi) + ', cash ' + rupees(x.cash) + ')';
      days.appendChild(li);
    });
    $('st-warn').hidden = saved;
  }

  // ── export: one row per pack line, with the customer number and total to match a UPI payment ──
  function csv() {
    var rows = ['date,time,customer,item,original,ajwain,kesari,sugar_lite,price,payment,customer_total'];
    Object.keys(mem.days).sort().forEach(function (k) {
      mem.days[k].orders.forEach(function (o) {
        var ot = orderTotal(o);
        o.lines.forEach(function (l) {
          rows.push([k, istParts(o.t).time, o.n, l.name, l.mix.original || 0, l.mix.ajwain || 0, l.mix.kesari || 0, l.mix.lite || 0, l.price, o.pay, ot].join(','));
        });
      });
    });
    return rows.join('\n') + '\n';
  }
  function exportCsv() {
    var name = 'munchingo-stall-' + today + '.csv', data = csv();
    try {
      var file = new File([data], name, { type: 'text/csv' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: name }).catch(function () {}); return; }
    } catch (e) { /* fall through to download */ }
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv' })); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  }

  // ── wire up ──
  load();
  dayData(today);
  $('st-day').textContent = niceDay(today);
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    if (b.dataset.item) { var it = ITEMS[b.dataset.item]; return it.pick ? openMix(b.dataset.item) : addLine(b.dataset.item, it.mix); }
    if (b.dataset.plus) { if (mixCount() < need()) pick[b.dataset.plus] += 1; return renderMix(); }
    if (b.dataset.minus) { if (pick[b.dataset.minus] > 0) pick[b.dataset.minus] -= 1; return renderMix(); }
    if (b.dataset.remove != null) return removeLine(Number(b.dataset.remove));
    if (b.dataset.del) return del(b.dataset.del);
    switch (b.id) {
      case 'st-paid-upi': return paid('upi');
      case 'st-paid-cash': return paid('cash');
      case 'st-clear': return clearBasket();
      case 'st-undo': return undo();
      case 'st-mix-each': FLAV.forEach(function (f) { pick[f.id] = 1; }); return renderMix();
      case 'st-mix-ok': if (mixCount() === need()) { $('st-mix').hidden = true; var m = {}; FLAV.forEach(function (f) { if (pick[f.id]) m[f.id] = pick[f.id]; }); addLine(pickItem, m); } return;
      case 'st-mix-cancel': $('st-mix').hidden = true; return;
      case 'st-export': return exportCsv();
    }
  });
  document.addEventListener('change', function (e) {
    var m = e.target.id && e.target.id.match(/^st-open-(\w+)$/); if (!m) return;
    var v = e.target.value.trim(), dd = dayData(today);
    if (v === '' || isNaN(Number(v))) delete dd.opening[m[1]]; else dd.opening[m[1]] = Math.max(0, Math.round(Number(v)));
    persist(); render();
  });
  persist();
  render();
  if (navigator.serviceWorker && navigator.serviceWorker.register) navigator.serviceWorker.register('/stall-sw.js', { scope: '/stall' }).catch(function () {});

  window.StallTally = { csv: csv, version: 2 };   // version must match stall.js?v= in stall.html and stall-sw.js   // for the test and for a manual copy if sharing fails
})();
