// Stall tally (stall.html, munchingo.com/stall): one tap per sale while the buyer pays. Saved on this device only, one
// list per IST day, so a reload or a dropped connection loses nothing. Contribution uses the v14 pack costs
// (Munchingo Docs/munchingo_pricing_v14.xlsx): price less 5% GST, less pack costs, less Rs 100 hamper packaging.
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
    h4: { name: 'Hamper of 4', price: 999, hamper: true, mix: { original: 1, ajwain: 1, kesari: 1, lite: 1 } },
  };
  var HAMPER_PACKAGING = 100, GST = 0.05, STALL_FEE = 10000;
  var $ = function (id) { return document.getElementById(id); };
  var rupees = function (n) { return '₹' + Math.round(n).toLocaleString('en-IN'); };

  // ── storage ──
  var saved = true, mem = { days: {} };
  function load() {
    try { var raw = window.localStorage.getItem(KEY); mem = raw ? JSON.parse(raw) : { days: {} }; if (!mem.days) mem.days = {}; window.localStorage.setItem(KEY, JSON.stringify(mem)); }
    catch (e) { saved = false; }
  }
  function persist() { try { window.localStorage.setItem(KEY, JSON.stringify(mem)); saved = true; } catch (e) { saved = false; } }

  function istParts(ms) {
    var d = new Date(ms + 5.5 * 3600 * 1000);
    var iso = d.toISOString();
    return { day: iso.slice(0, 10), time: iso.slice(11, 16) };
  }
  var today = istParts(Date.now()).day;
  function dayData(day) { if (!mem.days[day]) mem.days[day] = { sales: [], opening: {} }; return mem.days[day]; }
  function niceDay(day) { var p = day.split('-'); return Number(p[2]) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(p[1]) - 1] + ' ' + p[0]; }

  function contribution(s) {
    var c = s.price / (1 + GST);
    FLAV.forEach(function (f) { c -= (s.mix[f.id] || 0) * f.cost; });
    if (s.hamper) c -= HAMPER_PACKAGING;
    return c;
  }
  function totals(sales) {
    var t = { total: 0, upi: 0, cash: 0, contrib: 0, n: {} };
    FLAV.forEach(function (f) { t.n[f.id] = 0; });
    sales.forEach(function (s) {
      t.total += s.price; t[s.pay] += s.price; t.contrib += contribution(s);
      FLAV.forEach(function (f) { t.n[f.id] += s.mix[f.id] || 0; });
    });
    return t;
  }

  // ── actions ──
  var pay = 'upi';
  function record(itemId, mix) {
    var it = ITEMS[itemId], now = Date.now();
    dayData(today).sales.push({ id: now + '-' + Math.random().toString(36).slice(2, 6), t: now, item: itemId, name: it.name, price: it.price, hamper: !!it.hamper, mix: mix, pay: pay });
    persist(); render(); flash(it.name + ' ' + rupees(it.price) + (pay === 'cash' ? ' (cash)' : ' (UPI)'));
  }
  function undo() { var s = dayData(today).sales.pop(); if (s) { persist(); render(); flash('Undone: ' + s.name); } }
  function del(id) {
    var list = dayData(today).sales, i = list.findIndex(function (s) { return s.id === id; });
    if (i < 0) return;
    if (!window.confirm('Delete ' + list[i].name + ' ' + rupees(list[i].price) + '?')) return;
    list.splice(i, 1); persist(); render();
  }
  function setPay(p) { pay = p; $('st-pay-upi').setAttribute('aria-pressed', String(p === 'upi')); $('st-pay-cash').setAttribute('aria-pressed', String(p === 'cash')); }

  var flashTimer;
  function flash(msg) { var el = $('st-flash'); el.textContent = msg; el.hidden = false; clearTimeout(flashTimer); flashTimer = setTimeout(function () { el.hidden = true; }, 1600); }

  // hamper of 3: choose the mix
  var pick = {};
  function openMix() { pick = {}; FLAV.forEach(function (f) { pick[f.id] = 0; }); renderMix(); $('st-mix').hidden = false; }
  function mixCount() { return FLAV.reduce(function (a, f) { return a + pick[f.id]; }, 0); }
  function renderMix() {
    FLAV.forEach(function (f) { $('st-mix-n-' + f.id).textContent = pick[f.id]; });
    $('st-mix-count').textContent = mixCount() + ' / 3';
    $('st-mix-ok').disabled = mixCount() !== 3;
  }

  // ── view ──
  function render() {
    var dd = dayData(today), t = totals(dd.sales);
    $('st-total').textContent = rupees(t.total);
    $('st-upi').textContent = rupees(t.upi);
    $('st-cash').textContent = rupees(t.cash);
    $('st-contrib').textContent = rupees(t.contrib);
    $('st-sales').textContent = dd.sales.length;
    var allContrib = Object.keys(mem.days).reduce(function (a, k) { return a + totals(mem.days[k].sales).contrib; }, 0);
    $('st-fee').textContent = rupees(allContrib) + ' of ' + rupees(STALL_FEE) + ' stall fee covered (all days on this iPad)';
    FLAV.forEach(function (f) {
      $('st-n-' + f.id).textContent = t.n[f.id];
      var open = dd.opening[f.id], input = $('st-open-' + f.id);
      if (document.activeElement !== input) input.value = open == null ? '' : open;
      $('st-left-' + f.id).textContent = open == null ? '–' : (open - t.n[f.id]);
    });
    var log = $('st-log'); log.textContent = '';
    dd.sales.slice().reverse().slice(0, 30).forEach(function (s) {
      var li = document.createElement('li');
      var mix = s.hamper ? ' (' + FLAV.filter(function (f) { return s.mix[f.id]; }).map(function (f) { return (s.mix[f.id] > 1 ? s.mix[f.id] + '× ' : '') + f.name; }).join(', ') + ')' : '';
      li.appendChild(document.createTextNode(istParts(s.t).time + '  ' + s.name + mix + '  ' + rupees(s.price) + (s.pay === 'cash' ? ' · cash' : ' · UPI')));
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-del', s.id); b.setAttribute('aria-label', 'Delete this sale'); b.textContent = '×';
      li.appendChild(b); log.appendChild(li);
    });
    var days = $('st-days'); days.textContent = '';
    Object.keys(mem.days).sort().reverse().filter(function (k) { return k !== today && mem.days[k].sales.length; }).forEach(function (k) {
      var x = totals(mem.days[k].sales), li = document.createElement('li');
      li.textContent = niceDay(k) + ': ' + mem.days[k].sales.length + ' sales, ' + rupees(x.total) + ' (UPI ' + rupees(x.upi) + ', cash ' + rupees(x.cash) + ')';
      days.appendChild(li);
    });
    $('st-warn').hidden = saved;
  }

  // ── export ──
  function csv() {
    var rows = ['date,time,item,original,ajwain,kesari,sugar_lite,price,payment'];
    Object.keys(mem.days).sort().forEach(function (k) {
      mem.days[k].sales.forEach(function (s) {
        rows.push([k, istParts(s.t).time, s.name, s.mix.original || 0, s.mix.ajwain || 0, s.mix.kesari || 0, s.mix.lite || 0, s.price, s.pay].join(','));
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
    if (b.dataset.item) { var it = ITEMS[b.dataset.item]; return it.pick ? openMix() : record(b.dataset.item, it.mix); }
    if (b.dataset.plus) { if (mixCount() < 3) pick[b.dataset.plus] += 1; return renderMix(); }
    if (b.dataset.minus) { if (pick[b.dataset.minus] > 0) pick[b.dataset.minus] -= 1; return renderMix(); }
    if (b.dataset.del) return del(b.dataset.del);
    switch (b.id) {
      case 'st-pay-upi': return setPay('upi');
      case 'st-pay-cash': return setPay('cash');
      case 'st-undo': return undo();
      case 'st-mix-ok': if (mixCount() === 3) { $('st-mix').hidden = true; var m = {}; FLAV.forEach(function (f) { if (pick[f.id]) m[f.id] = pick[f.id]; }); record('h3', m); } return;
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
  setPay('upi');
  render();
  if (navigator.serviceWorker && navigator.serviceWorker.register) navigator.serviceWorker.register('/stall-sw.js', { scope: '/stall' }).catch(function () {});

  window.StallTally = { csv: csv };   // for the test and for a manual copy if sharing fails
})();
