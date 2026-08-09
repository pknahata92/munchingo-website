// Munchingo cart — client-side only, no backend. Hands off to WhatsApp at checkout.
(function () {
  var KEY = 'munchingo_cart';
  var WA_NUMBER = '919988992024';

  // Manual stock control for the website only (WhatsApp ordering reflects
  // stock set separately in Meta Commerce Manager). List a base flavour slug
  // here to mark it sold out on the site; remove it to restock. Must match
  // utils/catalog.js's SOLD_OUT_SLUGS on the backend, which is the check
  // that actually blocks a sold-out item at checkout — this file only
  // controls what the UI shows before that.
  var SOLD_OUT_SLUGS = [];

  function isSlugSoldOut(slug) {
    if (!slug) return false;
    if (SOLD_OUT_SLUGS.indexOf(slug) !== -1) return true;
    if (slug === 'full-range-set') return SOLD_OUT_SLUGS.length > 0;
    if (slug.indexOf('trio-gift-set-') === 0) {
      return SOLD_OUT_SLUGS.some(function (soldSlug) {
        var token = soldSlug.replace(/^atta-/, '');
        return new RegExp('(^|-)' + token + '(-|$)').test(slug);
      });
    }
    return false;
  }
  // Whether a trio-picker flavour value (e.g. "Lite-sugar") is sold out.
  function isFlavourSoldOut(flavourValue) {
    var token = flavourValue.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return SOLD_OUT_SLUGS.indexOf('atta-' + token) !== -1;
  }

  function getCart() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; }
    catch (e) { return []; }
  }
  function saveCart(cart) {
    localStorage.setItem(KEY, JSON.stringify(cart));
    renderBadge();
  }
  function addToCart(item) {
    var cart = getCart();
    var existing = cart.find(function (c) { return c.slug === item.slug; });
    if (existing) { existing.qty += 1; }
    else { cart.push({ slug: item.slug, name: item.name, price: item.price, unit: item.unit, qty: 1 }); }
    saveCart(cart);
    return cart;
  }
  function removeFromCart(slug) {
    saveCart(getCart().filter(function (c) { return c.slug !== slug; }));
  }
  function setQty(slug, qty) {
    var cart = getCart();
    var item = cart.find(function (c) { return c.slug === slug; });
    if (item) {
      item.qty = Math.max(1, qty | 0);
      saveCart(cart);
    }
  }
  function cartCount() {
    return getCart().reduce(function (n, c) { return n + c.qty; }, 0);
  }
  function cartTotal() {
    return getCart().reduce(function (n, c) { return n + c.qty * c.price; }, 0);
  }
  function renderBadge() {
    var count = cartCount();
    document.querySelectorAll('[data-cart-count]').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? '' : 'none';
    });
  }
  function whatsappCheckoutUrl() {
    // Deliberately just a greeting, not the cart contents as text: the WhatsApp bot
    // doesn't parse free-text order dumps, so a customer would get a generic reply
    // instead of anything actionable. Opening with "Hi" triggers the bot's own
    // welcome flow, which hands off into its native catalog + cart ordering path.
    return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent('Hi Munchingo 👋');
  }

  window.MunchingoCart = {
    getCart: getCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    setQty: setQty,
    cartCount: cartCount,
    cartTotal: cartTotal,
    whatsappCheckoutUrl: whatsappCheckoutUrl,
    renderBadge: renderBadge,
    isSlugSoldOut: isSlugSoldOut,
    isFlavourSoldOut: isFlavourSoldOut
  };

  document.addEventListener('DOMContentLoaded', function () {
    renderBadge();
    document.querySelectorAll('[data-add-to-cart]').forEach(function (btn) {
      var staticSlug = btn.getAttribute('data-slug');
      // Trio's button slug changes as flavours are picked (handled by its
      // own script in gifting.html) — only grey out buttons with a fixed
      // slug here (base SKUs + Full Range).
      if (staticSlug && staticSlug.indexOf('trio-gift-set') !== 0 && isSlugSoldOut(staticSlug)) {
        btn.disabled = true;
        btn.textContent = 'Sold Out';
        btn.classList.add('sold-out');
        return;
      }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        addToCart({
          slug: btn.getAttribute('data-slug'),
          name: btn.getAttribute('data-name'),
          price: parseInt(btn.getAttribute('data-price'), 10),
          unit: btn.getAttribute('data-unit')
        });
        var original = btn.textContent;
        btn.textContent = 'Added ✓';
        setTimeout(function () { btn.textContent = original; }, 1200);
      });
    });

    // Mobile nav toggle
    var nav = document.querySelector('nav');
    var toggle = document.querySelector('.nav-toggle');
    if (nav && toggle) {
      var HAMBURGER = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/></svg>';
      var CLOSE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 5l14 14M19 5L5 19" stroke-linecap="round"/></svg>';
      toggle.innerHTML = HAMBURGER;
      toggle.addEventListener('click', function () {
        var open = nav.classList.toggle('nav-open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.innerHTML = open ? CLOSE : HAMBURGER;
      });
      nav.querySelectorAll('ul a').forEach(function (a) {
        a.addEventListener('click', function () {
          nav.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = HAMBURGER;
        });
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 820 && nav.classList.contains('nav-open')) {
          nav.classList.remove('nav-open');
          toggle.setAttribute('aria-expanded', 'false');
          toggle.innerHTML = HAMBURGER;
        }
      });
    }

    // ---- Site search ----
    var SEARCH_INDEX = [
      { title: 'Atta Original', desc: 'Cardamom, whole wheat atta, pure desi ghee. ₹279 / 250g.', type: 'Product', url: 'gifting.html#atta-original' },
      { title: 'Atta Kesari', desc: 'Real saffron, hand-mixed into every batch. ₹319 / 250g.', type: 'Product', url: 'gifting.html#atta-kesari' },
      { title: 'Atta Lite-sugar', desc: '95% less sugar than Original, sweetened with maltitol. ₹319 / 250g.', type: 'Product', url: 'gifting.html#atta-lite-sugar' },
      { title: 'Atta Ajwain', desc: 'Savoury, spiced with ajwain. ₹279 / 250g.', type: 'Product', url: 'gifting.html#atta-ajwain' },
      { title: 'The Trio Gift Set', desc: 'Choose any 3 of 4 flavours, 250g each, gift-boxed. ₹789.', type: 'Gift Set', url: 'gifting.html#trio-gift-set' },
      { title: 'The Full Range Gift Set', desc: 'One of each flavour, 1kg total, 4 boxes. ₹1,079.', type: 'Gift Set', url: 'gifting.html#full-range-set' },
      { title: 'About Us', desc: 'Our story — baked in Bikaner for over a decade.', type: 'Page', url: 'about.html' },
      { title: 'Contact', desc: 'WhatsApp, email, Instagram, corporate gifting.', type: 'Page', url: 'contact.html' },
      { title: 'Your Cart', desc: 'Review your bag and check out on WhatsApp.', type: 'Page', url: 'cart.html' },
      { title: 'Is Atta Lite-sugar safe for diabetics?', desc: 'Sweetened with maltitol, no added sugar. Contains polyols; may have a laxative effect.', type: 'FAQ', url: 'contact.html#faq-diabetic' },
      { title: "What's the shelf life?", desc: 'Best before 90 days from packing.', type: 'FAQ', url: 'contact.html#faq-shelf-life' },
      { title: 'Can I customise a corporate hamper?', desc: 'Corporate gifting and bulk orders from 25 boxes.', type: 'FAQ', url: 'contact.html#faq-hamper' },
      { title: 'Where is it made?', desc: 'Krazy Baker, Gangashahar, Bikaner, Rajasthan.', type: 'FAQ', url: 'contact.html#faq-location' },
      { title: 'How do I pay?', desc: 'WhatsApp confirmation, then a UPI payment link. Pre-paid.', type: 'FAQ', url: 'contact.html#faq-payment' }
    ];

    var searchToggle = document.querySelector('[data-search-toggle]');
    var searchPanel = document.querySelector('[data-search-panel]');
    var searchInput = document.querySelector('[data-search-input]');
    var searchResults = document.querySelector('[data-search-results]');
    var searchClose = document.querySelector('[data-search-close]');

    if (searchToggle && searchPanel && searchInput && searchResults) {
      function escapeHtml(s) {
        return s.replace(/[&<>"']/g, function (c) {
          return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
      }

      function renderResults(query) {
        var q = query.trim().toLowerCase();
        if (!q) {
          searchResults.innerHTML = '<div class="search-hint">Try "kesari", "gift set", "diabetic", or "shelf life".</div>';
          return;
        }
        var matches = SEARCH_INDEX.filter(function (item) {
          return item.title.toLowerCase().indexOf(q) !== -1 || item.desc.toLowerCase().indexOf(q) !== -1;
        }).slice(0, 8);
        if (!matches.length) {
          searchResults.innerHTML = '<div class="search-empty">No results for "' + escapeHtml(query) + '". Try a flavour name, "gift set", or a question about shipping/payment.</div>';
          return;
        }
        searchResults.innerHTML = matches.map(function (item) {
          return '<a class="search-result" href="' + item.url + '">' +
            '<span class="rtitle">' + escapeHtml(item.title) + '</span><span class="rtype">' + item.type + '</span>' +
            '<div class="rdesc">' + escapeHtml(item.desc) + '</div></a>';
        }).join('');
      }

      function openSearch() {
        searchPanel.classList.add('search-open');
        searchToggle.setAttribute('aria-expanded', 'true');
        renderResults(searchInput.value);
        setTimeout(function () { searchInput.focus(); }, 10);
        document.addEventListener('keydown', onKeydown);
      }
      function closeSearch() {
        searchPanel.classList.remove('search-open');
        searchToggle.setAttribute('aria-expanded', 'false');
        document.removeEventListener('keydown', onKeydown);
      }
      function onKeydown(e) {
        if (e.key === 'Escape') closeSearch();
      }

      searchToggle.addEventListener('click', function () {
        if (searchPanel.classList.contains('search-open')) closeSearch();
        else openSearch();
      });
      if (searchClose) searchClose.addEventListener('click', closeSearch);
      searchPanel.addEventListener('click', function (e) {
        if (e.target === searchPanel) closeSearch();
      });
      searchInput.addEventListener('input', function () {
        renderResults(searchInput.value);
      });
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var first = searchResults.querySelector('.search-result');
          if (first) window.location.href = first.getAttribute('href');
        }
      });

      // In-page navigation: if a result points to an anchor on the current page, scroll instead of reloading
      searchResults.addEventListener('click', function (e) {
        var link = e.target.closest('a.search-result');
        if (!link) return;
        var href = link.getAttribute('href');
        var hashIdx = href.indexOf('#');
        if (hashIdx === -1) return; // normal navigation
        var targetPage = href.slice(0, hashIdx);
        var targetId = href.slice(hashIdx + 1);
        var currentPage = window.location.pathname.split('/').pop() || 'index.html';
        if (targetPage === currentPage || (targetPage === '' && currentPage === 'index.html')) {
          var el = document.getElementById(targetId);
          if (el) {
            e.preventDefault();
            if (el.tagName === 'DETAILS') el.open = true;
            history.pushState(null, '', '#' + targetId);
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            closeSearch();
          }
        }
      });
    }

    // Auto-open + scroll to a FAQ item if the page loads with a matching hash
    if (window.location.hash) {
      var hashEl = document.getElementById(window.location.hash.slice(1));
      if (hashEl && hashEl.tagName === 'DETAILS') {
        hashEl.open = true;
        setTimeout(function () { hashEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 350);
      }
    }
  });
})();
