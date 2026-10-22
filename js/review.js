// Review page (review.html?t=<token>): one star row per flavour the buyer received, one optional comment, consent to show it,
// then a thank-you with the Google review link for every reviewer. The token is the proof of purchase; the server never
// sends phone, address or email to this page. API: GET/POST /api/review/:token (backend utils/reviews.js).
(function () {
  'use strict';
  var API = 'https://munchingo-whatsapp-webhook.onrender.com/api/review/';
  var root = document.getElementById('rv-root');
  var token = new URLSearchParams(window.location.search).get('t') || '';
  var BAD_LINK = "This link doesn't work. Message us on WhatsApp and we'll sort it out.";
  var THANKS_HAVE = 'Thanks, we have your review.';

  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'text') e.textContent = attrs[k]; else e.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function message(lines) {
    root.textContent = '';
    var box = el('div', { 'class': 'rv-msg' });
    lines.forEach(function (n) { box.appendChild(n); });
    root.appendChild(box);
  }
  function plain(text) { return el('p', { text: text }); }

  function thanks(googleUrl) {
    var parts = [el('h1', { text: 'Thank you.' }), plain('Thank you. Would you also leave a word on Google? It helps other people find us.')];
    if (googleUrl) parts.push(el('p', {}, [el('a', { id: 'rv-google', 'class': 'btn solid', href: googleUrl, target: '_blank', rel: 'noopener', text: 'Review us on Google' })]));
    message(parts);
  }

  function form(data) {
    root.textContent = '';
    root.appendChild(el('h1', { text: 'Hi ' + data.first + ', how was your box?' }));
    root.appendChild(el('p', { 'class': 'rv-lede', text: 'Rate each flavor. Honest is more useful to us than nice.' }));
    var f = el('form', { id: 'rv-form', novalidate: '' });
    data.flavours.forEach(function (fl) {
      var stars = el('div', { 'class': 'rv-stars' });
      for (var n = 5; n >= 1; n--) {   // row-reverse: 5 is first in the DOM so CSS can colour the stars to its left
        var id = 'r-' + fl.slug + '-' + n;
        stars.appendChild(el('input', { type: 'radio', name: 'r-' + fl.slug, value: String(n), id: id }));
        stars.appendChild(el('label', { 'for': id, title: n + (n === 1 ? ' star' : ' stars'), 'aria-label': n + (n === 1 ? ' star' : ' stars'), text: '★' }));
      }
      f.appendChild(el('fieldset', { 'class': 'rv-flav', 'data-flavour': fl.slug }, [el('legend', { text: fl.name }), stars]));
    });
    var comment = el('textarea', { id: 'rv-comment', maxlength: '500', placeholder: "What's off, what's amazing (optional)" });
    f.appendChild(el('div', { 'class': 'rv-field' }, [el('label', { 'for': 'rv-comment', text: 'Anything to add?' }), comment]));
    var showName = el('input', { type: 'radio', name: 'rv-show', value: 'name', checked: '' });
    var showAnon = el('input', { type: 'radio', name: 'rv-show', value: 'anonymous' });
    f.appendChild(el('div', { 'class': 'rv-field' }, [el('span', { text: 'Show my review as' }), el('div', { 'class': 'rv-choice' }, [
      el('label', {}, [showName, document.createTextNode('My first name and city')]),
      el('label', {}, [showAnon, document.createTextNode('Anonymous buyer')])])]));
    var consent = el('input', { type: 'checkbox', id: 'rv-consent' });
    f.appendChild(el('label', { 'class': 'rv-consent' }, [consent, document.createTextNode('You can show my review on munchingo.com')]));
    var btn = el('button', { type: 'submit', id: 'rv-submit', 'class': 'btn solid block', disabled: '', text: 'Send my review' });
    var err = el('p', { 'class': 'rv-err', role: 'alert' });
    f.appendChild(btn); f.appendChild(err);
    root.appendChild(f);

    function ratings() {
      var out = {}, all = true;
      data.flavours.forEach(function (fl) { var c = f.querySelector('input[name="r-' + fl.slug + '"]:checked'); if (c) out[fl.slug] = Number(c.value); else all = false; });
      return all ? out : null;
    }
    f.addEventListener('change', function () { btn.disabled = !ratings(); });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = ratings(); if (!r) return;
      btn.disabled = true; err.textContent = '';
      var body = { ratings: r, comment: comment.value, showAs: showAnon.checked ? 'anonymous' : 'name', consent: consent.checked };
      fetch(API + encodeURIComponent(token), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, j: j }; }); })
        .then(function (x) {
          if (x.status === 201) return thanks(x.j.googleUrl);
          if (x.status === 409) return message([plain(THANKS_HAVE)]);
          if (x.status === 404) return message([plain(BAD_LINK)]);
          err.textContent = x.j.error || 'Something went wrong. Please try again in a minute.'; btn.disabled = false;
        })
        .catch(function () { err.textContent = 'Could not send. Check your connection and try again.'; btn.disabled = false; });
    });
  }

  if (!token) { message([plain(BAD_LINK)]); return; }
  fetch(API + encodeURIComponent(token))
    .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { status: res.status, j: j }; }); })
    .then(function (x) {
      if (x.status !== 200) return message([plain(BAD_LINK)]);
      if (x.j.reviewed) return message([plain(THANKS_HAVE)]);
      form(x.j);
    })
    .catch(function () { message([plain('Could not load your order. Check your connection and try again.')]); });
})();
