// Checkout form fields: one standard for input constraints and validation.
//   - Indian mobile: digits only, 10 of them, first digit 6-9. "+91 98765 43210" pasted in is cleaned to 9876543210.
//   - Pincode: 6 digits, not starting with 0.
//   - Names, city, state: letters, spaces and . ' - only.
//   - Email: the same shape the server accepts.
// Errors appear under the field once it has been left (or on Pay), never while the customer is still typing the first time.
// The server re-checks everything; this is only the friendly first line.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  function cleanPhone(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    if (/^91\d{10}$/.test(d) || /^0\d{10}$/.test(d)) d = d.replace(/^(91|0)/, '');
    return d.slice(0, 10);
  }
  var NAME_RE = /^(?=.*[\p{L}])[\p{L}\p{M}][\p{L}\p{M} .'’\-]*$/u;
  var PLACE_RE = /^(?=.*[\p{L}])[\p{L}\p{M}][\p{L}\p{M} .'’()\-]*$/u;

  // id -> { clean(value) -> value, check(value) -> error message or '', required }
  var RULES = {
    'ck-name': {
      required: true,
      clean: function (v) { return v.replace(/\s{2,}/g, ' ').replace(/^\s+/, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) return 'Enter your full name.';
        if (v.length < 2 || !NAME_RE.test(v)) return 'Enter your name using letters only.';
        return '';
      }
    },
    'ck-phone': {
      required: true, clean: cleanPhone,
      check: function (v) {
        if (!v) return 'Enter your WhatsApp number.';
        if (!/^[6-9]\d{9}$/.test(v)) return v.length < 10 ? 'That is ' + v.length + ' digits. Enter all 10.' : 'Indian mobile numbers start with 6, 7, 8 or 9.';
        return '';
      }
    },
    'ck-rcp-name': {
      required: false, gift: true,
      clean: function (v) { return v.replace(/\s{2,}/g, ' ').replace(/^\s+/, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) return 'Enter the recipient\'s name.';
        if (v.length < 2 || !NAME_RE.test(v)) return 'Enter the name using letters only.';
        return '';
      }
    },
    'ck-rcp-phone': {
      required: false, gift: true, clean: cleanPhone,
      check: function (v) {
        if (!v) return 'Enter the recipient\'s mobile number.';
        if (!/^[6-9]\d{9}$/.test(v)) return v.length < 10 ? 'That is ' + v.length + ' digits. Enter all 10.' : 'Indian mobile numbers start with 6, 7, 8 or 9.';
        return '';
      }
    },
    'ck-addr-pincode': {
      required: true,
      clean: function (v) { return v.replace(/\D/g, '').slice(0, 6); },
      check: function (v) {
        if (!v) return 'Enter your 6-digit pincode.';
        if (!/^[1-9]\d{5}$/.test(v)) return 'A pincode has 6 digits and does not start with 0.';
        return '';
      }
    },
    'ck-addr-city': {
      required: true,
      clean: function (v) { return v.replace(/\s{2,}/g, ' ').replace(/^\s+/, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) return 'Enter your city.';
        if (v.length < 2 || !PLACE_RE.test(v)) return 'Enter the city using letters only.';
        return '';
      }
    },
    'ck-addr-state': {
      required: true,
      clean: function (v) { return v.replace(/\s{2,}/g, ' ').replace(/^\s+/, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) return 'Enter your state.';
        if (v.length < 2 || !PLACE_RE.test(v)) return 'Pick or type your state.';
        return '';
      }
    },
    'ck-addr-line1': {
      required: true,
      clean: function (v) { return v.replace(/[ \t]{2,}/g, ' ').replace(/^\s+/, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) return 'Enter your house or flat number and street.';
        if (v.length < 8) return 'Add a little more: house or flat number, street and area.';
        return '';
      }
    },
    'ck-email': {
      required: false,
      clean: function (v) { return v.replace(/\s/g, ''); },
      check: function (v) {
        v = v.trim();
        if (!v) { return window.__ckEmailRequired && window.__ckEmailRequired() ? 'Enter your email address.' : ''; }
        return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v) ? '' : 'That email does not look right. Check it, for example name@gmail.com.';
      }
    }
  };

  var touched = {};

  function errEl(id) {
    var el = $('ck-err-' + id);
    if (el) return el;
    var input = $(id); if (!input) return null;
    el = document.createElement('small');
    el.id = 'ck-err-' + id; el.className = 'ck-err'; el.hidden = true; el.setAttribute('role', 'alert');
    var anchor = input.parentNode.classList.contains('ck-phone') ? input.parentNode : input;
    anchor.parentNode.insertBefore(el, anchor.nextSibling);
    // Pincode has a status line right under it: put the error after that so the two never collide.
    if (id === 'ck-addr-pincode' && $('ck-pin-status')) $('ck-pin-status').parentNode.insertBefore(el, $('ck-pin-status').nextSibling);
    return el;
  }
  function show(id, msg) {
    var input = $(id), el = errEl(id); if (!input || !el) return;
    if (msg) { el.textContent = msg; el.hidden = false; input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', el.id); }
    else { el.hidden = true; el.textContent = ''; input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
  }
  function active(id) {
    var r = RULES[id], input = $(id);
    if (!input || !r) return false;
    if (r.gift) return !!($('ck-is-gift') && $('ck-is-gift').checked);   // recipient fields only count when it is a gift
    return !(input.closest && input.closest('[hidden]'));              // a collapsed optional field is not validated
  }
  function run(id) {
    var r = RULES[id], input = $(id);
    if (!r || !input) return true;
    if (!active(id)) { show(id, ''); return true; }
    var msg = r.check(r.clean(input.value));
    show(id, msg);
    return !msg;
  }
  function sanitize(id) {
    var r = RULES[id], input = $(id); if (!r || !input) return;
    var c = r.clean(input.value);
    if (c !== input.value) input.value = c;
  }

  function wire(id) {
    var input = $(id); if (!input) return;
    input.addEventListener('input', function () {
      sanitize(id);
      if (touched[id]) run(id);
      else if (id === 'ck-phone' || id === 'ck-rcp-phone' || id === 'ck-addr-pincode') {
        // Fixed-length fields: say so as soon as the length is complete and wrong (e.g. starts with 5), not before.
        var full = (id === 'ck-addr-pincode') ? 6 : 10;
        if (input.value.length >= full) { touched[id] = true; run(id); }
      }
    });
    input.addEventListener('blur', function () { touched[id] = true; run(id); });
  }

  function validateAll() {
    var firstBad = null;
    Object.keys(RULES).forEach(function (id) {
      touched[id] = true;
      if (!run(id) && !firstBad) firstBad = $(id);
    });
    if (firstBad) {
      try { firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      try { firstBad.focus({ preventScroll: true }); } catch (e) {}
      return false;
    }
    return true;
  }

  function init() {
    Object.keys(RULES).forEach(function (id) { sanitize(id); wire(id); });
    // Gift note: live counter.
    var gn = $('ck-gift-note');
    if (gn) {
      var c = document.createElement('small'); c.className = 'ck-count'; c.setAttribute('aria-hidden', 'true');
      gn.parentNode.insertBefore(c, gn.nextSibling);
      var upd = function () { c.textContent = gn.value.length + ' / ' + (gn.maxLength > 0 ? gn.maxLength : 200); };
      gn.addEventListener('input', upd); upd();
    }
    // Ticking "This is a gift" must not leave stale errors on, or start validating the recipient fields before they are filled.
    var g = $('ck-is-gift');
    if (g) g.addEventListener('change', function () { ['ck-rcp-name', 'ck-rcp-phone'].forEach(function (id) { touched[id] = false; show(id, ''); }); });
    // Subscribing (or a pre-order) makes the email required: the page already says so in the label; this tells the validator.
    window.__ckEmailRequired = function () {
      var sub = $('ck-subscribe');
      var pre = window.MunchingoCart && MunchingoCart.isPreorder && MunchingoCart.isPreorder();
      return !!((sub && sub.checked) || pre);
    };
  }

  window.MunchingoFields = { validateAll: validateAll, cleanPhone: cleanPhone };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
