/* Where did this visitor come from? Saves the FIRST tagged visit (utm tags or an outside referrer) for 30 days and hands it,
   with the buyer's own answer, to checkout. First touch wins. Direct visits save nothing. The backend re-checks everything
   (Munchingo Design Files/webhook-backend/utils/orderSource.js), so this file is a convenience, never a gate. */
(function (root) {
  'use strict';
  var KEY = 'mng_first_touch', TTL = 30 * 864e5;

  function clean(v) { return String(v == null ? '' : v).trim().slice(0, 60); }

  /** Pure. A touch from the landing URL and referrer, or null when the visit carries no source. */
  function parse(search, referrer, pathname, ownHost) {
    var utm = {}, any = false;
    String(search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('='); if (i < 1) return;
      var k = kv.slice(0, i), v;
      try { v = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { return; }
      var m = /^utm_(source|medium|campaign)$/.exec(k);
      if (m && clean(v)) { utm[m[1]] = clean(v); any = true; }
    });
    var ref = '';
    try {
      if (referrer) {
        var h = new URL(referrer).hostname.toLowerCase();
        var own = String(ownHost || '').toLowerCase().replace(/^www\./, '');
        if (h && h.replace(/^www\./, '') !== own) ref = h;
      }
    } catch (e) { ref = ''; }
    if (!any && !ref) return null;
    var out = {};
    if (any) out.utm = utm;
    if (ref) out.ref = ref;
    var p = String(pathname || '/');
    if (/^\/[A-Za-z0-9._\-/]{0,100}$/.test(p)) out.landed = p;
    return out;
  }

  /** Pure. First touch wins for 30 days; after that the newer touch replaces it. */
  function merge(existing, incoming, now) {
    if (!incoming) return existing || null;
    if (existing && typeof existing.t === 'number' && now - existing.t < TTL) return existing;
    var out = {}; for (var k in incoming) out[k] = incoming[k];
    out.t = now;
    return out;
  }

  /** Pure. What checkout sends: the buyer's answer plus the saved touch (without its timestamp). */
  function payload(touch, how) {
    var out = {};
    if (how) out.how = how;
    if (touch) { if (touch.utm) out.utm = touch.utm; if (touch.ref) out.ref = touch.ref; if (touch.landed) out.landed = touch.landed; }
    return out;
  }

  // ---- Browser glue (skipped under Node) ----
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function capture() {
    try {
      var next = merge(read(), parse(location.search, document.referrer, location.pathname, location.hostname), Date.now());
      if (next) localStorage.setItem(KEY, JSON.stringify(next));
    } catch (e) { /* private mode or blocked storage: no source, never an error */ }
  }
  function current(how) { return payload(read(), how); }

  if (typeof module !== 'undefined' && module.exports) module.exports = { parse: parse, merge: merge, payload: payload };
  else { root.MunchingoSource = { capture: capture, current: current }; capture(); }
})(typeof window !== 'undefined' ? window : this);
