// "Check delivery" by pincode, answered by Delhivery through the shop's backend (GET /api/pincode/:pin).
//   - serviceable true  -> delivery available, free shipping
//   - serviceable false -> "we cannot deliver there yet", WhatsApp link
//   - unknown (backend has no Delhivery answer) -> India Post confirms the pincode is real and we do not block anyone
// Fills every [data-pincode-check]. Remembers the last good pincode on this phone only. Exposes MunchingoPincode.check(pin).
(function () {
  'use strict';
  var API = 'https://munchingo-whatsapp-webhook.onrender.com/api/pincode/';
  var KEY = 'munchingo_pin', WA = 'https://wa.me/919988992024';
  var memo = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function timed(url, ms) {
    var ctl = ('AbortController' in window) ? new AbortController() : null, t = setTimeout(function () { if (ctl) ctl.abort(); }, ms);
    return fetch(url, ctl ? { signal: ctl.signal } : {}).then(function (r) { clearTimeout(t); return r.json(); }, function (e) { clearTimeout(t); throw e; });
  }
  function indiaPost(pin) {
    return timed('https://api.postalpincode.in/pincode/' + pin, 4000).then(function (d) {
      var po = d && d[0] && d[0].Status === 'Success' && d[0].PostOffice && d[0].PostOffice[0];
      return po ? { valid: true, city: po.District || po.Block || '', state: po.State || '' } : { valid: false };
    }).catch(function () { return { valid: null }; });
  }
  // -> { pin, valid, serviceable: true|false|null, city, state }
  function check(pin) {
    pin = String(pin || '').replace(/\D/g, '');
    if (!/^[1-9][0-9]{5}$/.test(pin)) return Promise.resolve({ pin: pin, valid: false, serviceable: false });
    if (memo[pin]) return memo[pin];
    memo[pin] = timed(API + pin, 7000).then(function (r) {
      if (r && r.ok && r.serviceable !== null && r.serviceable !== undefined) return { pin: pin, valid: !!r.valid, serviceable: r.serviceable, city: r.city || r.district || '', state: r.state || '' };
      return indiaPost(pin).then(function (p) { return { pin: pin, valid: p.valid, serviceable: null, city: p.city || '', state: p.state || '' }; });
    }).catch(function () {
      return indiaPost(pin).then(function (p) { return { pin: pin, valid: p.valid, serviceable: null, city: p.city || '', state: p.state || '' }; });
    }).then(function (res) { if (res.valid === null) delete memo[pin]; return res; });
    return memo[pin];
  }
  function message(r) {
    var where = [r.city, r.state].filter(Boolean).join(', ');
    if (r.valid === false) return { cls: 'bad', html: 'That pincode does not look right. Please check the 6 digits.' };
    if (r.serviceable === false) return { cls: 'bad', html: 'We cannot deliver to ' + esc(r.pin) + ' yet. <a href="' + WA + '" target="_blank" rel="noopener">Message us on WhatsApp</a> and we will try to arrange it.' };
    if (r.serviceable === true) return { cls: 'ok', html: '✓ Delivery available' + (where ? ' to ' + esc(where) : ' to ' + esc(r.pin)) + '. Free shipping.' };
    if (r.valid === true) return { cls: 'ok', html: '✓ ' + esc(where || r.pin) + '. Free shipping across India. We confirm your pincode again at checkout.' };
    return { cls: '', html: 'We could not check that just now. You can still order: we confirm delivery at checkout.' };
  }
  function widget(host) {
    host.className = (host.className + ' pc-wrap').trim();
    host.innerHTML = '<label class="pc-label">Check delivery</label><div class="pc-row"><input class="pc-in" type="text" inputmode="numeric" maxlength="6" autocomplete="postal-code" placeholder="Enter pincode" aria-label="Delivery pincode"><button type="button" class="pc-btn">Check</button></div><p class="pc-msg" role="status" aria-live="polite"></p>';
    var input = host.querySelector('.pc-in'), btn = host.querySelector('.pc-btn'), msg = host.querySelector('.pc-msg'), seq = 0;
    function run() {
      var v = input.value.replace(/\D/g, ''); input.value = v;
      if (v.length !== 6) { msg.className = 'pc-msg'; msg.textContent = v ? 'Enter the 6-digit pincode.' : ''; return; }
      var my = ++seq; msg.className = 'pc-msg'; msg.textContent = 'Checking…';
      check(v).then(function (r) {
        if (my !== seq) return;
        var m = message(r); msg.className = 'pc-msg ' + m.cls; msg.innerHTML = m.html;
        if (r.valid && r.serviceable !== false) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } }
        try { document.dispatchEvent(new CustomEvent('munchingo:pin', { detail: r })); } catch (e) { /* old browsers */ }
      });
    }
    btn.addEventListener('click', run);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    input.addEventListener('input', function () { var d = input.value.replace(/\D/g, ''); if (d.length === 6) run(); else { msg.className = 'pc-msg'; msg.textContent = ''; } });
    var saved = ''; try { saved = localStorage.getItem(KEY) || ''; } catch (e) { /* ignore */ }
    if (/^[1-9][0-9]{5}$/.test(saved)) { input.value = saved; run(); }
  }
  function start() { [].forEach.call(document.querySelectorAll('[data-pincode-check]'), widget); }
  window.MunchingoPincode = { check: check, message: message };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
