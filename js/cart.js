// Munchingo cart — client-side only, no backend. Hands off to WhatsApp at checkout.
(function () {
  var KEY = 'munchingo_cart';
  var GIFT_NOTE_KEY = 'munchingo_gift_note';
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

  // Optional gift note — set on cart.html, read (and cleared after a
  // successful order) on checkout.html. Separate key from the cart itself
  // so it survives independently of cart edits.
  function getGiftNote() {
    try { return localStorage.getItem(GIFT_NOTE_KEY) || ''; }
    catch (e) { return ''; }
  }
  function setGiftNote(note) {
    try { localStorage.setItem(GIFT_NOTE_KEY, note || ''); }
    catch (e) { /* ignore — private-browsing / storage blocked */ }
  }
  function addToCart(item) {
    var cart = getCart();
    var existing = cart.find(function (c) { return c.slug === item.slug; });
    if (existing) { existing.qty += 1; }
    else { cart.push({ slug: item.slug, name: item.name, price: item.price, mrp: item.mrp, unit: item.unit, qty: 1 }); }
    saveCart(cart);
    return cart;
  }
  function removeFromCart(slug) {
    saveCart(getCart().filter(function (c) { return c.slug !== slug; }));
  }
  function clearCart() {
    saveCart([]);
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

  // ---- AOV progress bar (cart.html + checkout.html) ----
  // A visual goal-gradient bar toward two thresholds: the ₹499 minimum
  // order value, then the ₹999 Full Range Gift Set price. People push
  // harder to finish a visibly-nearly-complete bar than they respond to
  // the same information as plain text — this is the single mechanism
  // Blinkit's own cart leans on hardest for AOV (a live progress bar
  // toward "unlock free delivery", not a static line of copy). Shared
  // here so cart.html and checkout.html render an identical bar instead
  // of two hand-maintained copies.
  var AOV_MIN_ORDER = 499;
  var AOV_FULL_RANGE_PRICE = 999;
  var AOV_FULL_RANGE_SAVING = 117;

  var BASE_SLUGS_FOR_UPGRADE = ['atta-original', 'atta-kesari', 'atta-ajwain', 'atta-lite-sugar'];

  // Whether the cart holds at least 1 of each of the 4 base flavours as
  // loose singles — i.e. a real, one-tap-swappable Full Range Gift Set
  // sitting unassembled in the cart.
  function hasFullRangeUpgrade(cart) {
    return BASE_SLUGS_FOR_UPGRADE.every(function (slug) {
      var item = cart.find(function (c) { return c.slug === slug; });
      return item && item.qty >= 1;
    });
  }

  // Swaps 1 unit of each of the 4 base flavours for 1 Full Range Gift Set
  // — decrements (or removes, if that was the only unit) each base flavour
  // by exactly 1, leaving any extra quantity untouched, then adds the set.
  function upgradeToFullRange() {
    BASE_SLUGS_FOR_UPGRADE.forEach(function (slug) {
      var item = getCart().find(function (c) { return c.slug === slug; });
      if (!item) return;
      if (item.qty > 1) setQty(slug, item.qty - 1);
      else removeFromCart(slug);
    });
    addToCart({ slug: 'full-range-set', name: 'Full Range Gift Set', price: AOV_FULL_RANGE_PRICE, unit: '1kg, one of each' });
  }

  // total is derived from cart, not passed separately, so this can never
  // drift out of sync with what's actually in the cart.
  function renderAovProgressHtml(cart) {
    var total = cart.reduce(function (n, c) { return n + c.qty * c.price; }, 0);
    var fillPct = Math.min(100, Math.round((total / AOV_FULL_RANGE_PRICE) * 100));
    var movMarkerPct = Math.round((AOV_MIN_ORDER / AOV_FULL_RANGE_PRICE) * 100);

    var hasSet = cart.some(function (c) { return c.slug === 'full-range-set'; });
    var canUpgrade = !hasSet && hasFullRangeUpgrade(cart);

    var msgClass, msgHtml, upgradeBtnHtml = '';
    if (total < AOV_MIN_ORDER) {
      msgClass = 'pending';
      msgHtml = 'Add <b>₹' + (AOV_MIN_ORDER - total) + '</b> more to unlock delivery (₹' + AOV_MIN_ORDER + ' minimum)';
    } else if (hasSet) {
      // Genuinely holds the discounted set — this claim is real.
      msgClass = 'unlocked';
      msgHtml = '🎉 Full Range value unlocked — you\'re saving up to ₹' + AOV_FULL_RANGE_SAVING + ' vs buying separately';
    } else if (canUpgrade) {
      // All 4 flavours present as loose singles: real one-tap swap
      // available, not just a text nudge.
      msgClass = 'upsell';
      msgHtml = 'You\'ve got all 4 flavours in your cart — swap for the Full Range Gift Set and save ₹' + AOV_FULL_RANGE_SAVING;
      upgradeBtnHtml = '<button type="button" class="aov-upgrade-btn" data-aov-upgrade>Swap &amp; Save ₹' + AOV_FULL_RANGE_SAVING + '</button>';
    } else if (total < AOV_FULL_RANGE_PRICE) {
      msgClass = 'upsell';
      msgHtml = 'Delivery unlocked ✓ — add <b>₹' + (AOV_FULL_RANGE_PRICE - total) + '</b> more for the Full Range Gift Set, save ₹' + AOV_FULL_RANGE_SAVING;
    } else {
      // Spent past the Full Range price without actually holding that set
      // or all 4 flavours (e.g. several units of just 1-2 flavours) — no
      // specific savings claim applies here, so none is made.
      msgClass = 'unlocked';
      msgHtml = 'Delivery unlocked ✓ — you\'re all set';
    }

    return '' +
      '<div class="aov-progress">' +
        '<div class="aov-progress-track">' +
          '<div class="aov-progress-fill" style="width:' + fillPct + '%"></div>' +
          '<div class="aov-progress-marker" style="left:' + movMarkerPct + '%"><span class="aov-marker-dot"></span><span class="aov-marker-label">₹' + AOV_MIN_ORDER + '</span></div>' +
        '</div>' +
        '<p class="aov-progress-msg ' + msgClass + '">' + msgHtml + '</p>' +
        upgradeBtnHtml +
      '</div>';
  }

  // Wires the "Swap & Save" button if present in the given container.
  function initAovUpgrade(containerEl, onUpgraded) {
    if (!containerEl) return;
    var btn = containerEl.querySelector('[data-aov-upgrade]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      upgradeToFullRange();
      if (typeof onUpgraded === 'function') onUpgraded();
    });
  }

  // ---- "Complete your box" cross-sell strip (cart.html + checkout.html) ----
  // One-tap add cards for whichever base flavours aren't already in the
  // cart — the single mechanism the impulse-buying research kept pointing
  // to hardest: zero-friction, one-tap add, shown at the exact moment
  // someone's already mid-purchase. Deliberately NOT: countdown timers,
  // "only X left" scarcity messaging, or anything not literally true —
  // those are dark patterns, not persuasion, and don't fit how Munchingo
  // talks to people.
  var CROSS_SELL_PRODUCTS = [
    { slug: 'atta-original',   name: 'Atta Original',    price: 259, mrp: 300, unit: '250g', img: 'images/box-original.jpg' },
    { slug: 'atta-kesari',     name: 'Atta Kesari',       price: 299, mrp: 350, unit: '250g', img: 'images/box-kesari.jpg' },
    { slug: 'atta-ajwain',     name: 'Atta Ajwain',       price: 259, mrp: 300, unit: '250g', img: 'images/box-ajwain.jpg' },
    { slug: 'atta-lite-sugar', name: 'Atta Sugar-Lite',   price: 299, mrp: 350, unit: '250g', img: 'images/box-lite.jpg' }
  ];

  function renderCrossSellHtml() {
    var cart = getCart();
    var cartSlugs = cart.map(function (c) { return c.slug; });
    var candidates = CROSS_SELL_PRODUCTS.filter(function (p) {
      return cartSlugs.indexOf(p.slug) === -1 && !isSlugSoldOut(p.slug);
    });
    if (!candidates.length) return '';

    var cards = candidates.map(function (p) {
      return '' +
        '<div class="cross-sell-card">' +
          '<img src="' + p.img + '" alt="' + p.name + '">' +
          '<div class="cross-sell-body">' +
            '<div class="cross-sell-name">' + p.name + '</div>' +
            '<div class="cross-sell-price">₹' + p.price + ' · ' + p.unit + '</div>' +
          '</div>' +
          '<button type="button" class="cross-sell-add" data-cross-sell-add data-slug="' + p.slug + '" data-name="' + p.name + '" data-price="' + p.price + '" data-mrp="' + p.mrp + '" data-unit="' + p.unit + '" aria-label="Add ' + p.name + ' to cart">+ Add</button>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="cross-sell-strip">' +
        '<div class="cross-sell-lbl">Complete your box</div>' +
        '<div class="cross-sell-row">' + cards + '</div>' +
      '</div>';
  }

  // Wires up any [data-cross-sell-add] buttons currently in the DOM (call
  // again after re-rendering the strip's innerHTML — new buttons need new
  // listeners). Calls back into onAdded() after a successful add so the
  // page can re-render its totals/progress bar/cross-sell strip itself,
  // rather than this shared module knowing about page-specific DOM.
  function initCrossSell(containerEl, onAdded) {
    if (!containerEl) return;
    containerEl.querySelectorAll('[data-cross-sell-add]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var mrpAttr = btn.getAttribute('data-mrp');
        addToCart({
          slug: btn.getAttribute('data-slug'),
          name: btn.getAttribute('data-name'),
          price: parseInt(btn.getAttribute('data-price'), 10),
          mrp: mrpAttr ? parseInt(mrpAttr, 10) : undefined,
          unit: btn.getAttribute('data-unit')
        });
        if (typeof onAdded === 'function') onAdded();
      });
    });
  }

  window.MunchingoCart = {
    getCart: getCart,
    addToCart: addToCart,
    removeFromCart: removeFromCart,
    clearCart: clearCart,
    setQty: setQty,
    cartCount: cartCount,
    cartTotal: cartTotal,
    whatsappCheckoutUrl: whatsappCheckoutUrl,
    renderBadge: renderBadge,
    isSlugSoldOut: isSlugSoldOut,
    isFlavourSoldOut: isFlavourSoldOut,
    renderAovProgressHtml: renderAovProgressHtml,
    initAovUpgrade: initAovUpgrade,
    renderCrossSellHtml: renderCrossSellHtml,
    initCrossSell: initCrossSell,
    getGiftNote: getGiftNote,
    setGiftNote: setGiftNote
  };

  // ---- Lightbox for ingredients/nutrition panel images ----
  // These are screenshots of dense label text — at card width (~290px) they
  // scale down to single-digit pixel heights and become unreadable, so any
  // click opens the same image at a legible size.
  function initLightbox() {
    var overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = '<button class="lightbox-close" aria-label="Close">&times;</button><img class="lightbox-img" alt="">';
    document.body.appendChild(overlay);
    var lightboxImg = overlay.querySelector('.lightbox-img');

    function open(src, alt) {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      overlay.classList.add('open');
    }
    function close() {
      overlay.classList.remove('open');
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || e.target.classList.contains('lightbox-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });

    document.querySelectorAll('.ni-img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { open(img.src, img.alt); });
    });
    document.querySelectorAll('.photo-carousel .slide:not(:first-child) img').forEach(function (img) {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', function () { open(img.src, img.alt); });
    });
  }

  // ---- Product photo / ingredients / nutrition carousel ----
  function initCarousels() {
    document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
      var slides = Array.prototype.slice.call(carousel.querySelectorAll('.slide'));
      var dots = Array.prototype.slice.call(carousel.querySelectorAll('.dot'));
      var slidesEl = carousel.querySelector('.slides');

      function currentIndex() {
        return slides.findIndex(function (s) { return s.classList.contains('active'); });
      }
      function showSlide(index) {
        index = Math.max(0, Math.min(index, slides.length - 1));
        slides.forEach(function (s, i) { s.classList.toggle('active', i === index); });
        dots.forEach(function (d, i) { d.classList.toggle('active', i === index); });
        carousel.classList.toggle('on-info', index !== 0);
      }
      function step(delta) { showSlide(currentIndex() + delta); }

      dots.forEach(function (dot) {
        dot.addEventListener('click', function () {
          showSlide(parseInt(dot.getAttribute('data-slide'), 10));
        });
      });

      // Prev/next arrow buttons, overlaid on the image frame
      var prevBtn = document.createElement('button');
      prevBtn.className = 'carousel-arrow prev';
      prevBtn.setAttribute('aria-label', 'Previous photo');
      prevBtn.innerHTML = '&#8249;';
      var nextBtn = document.createElement('button');
      nextBtn.className = 'carousel-arrow next';
      nextBtn.setAttribute('aria-label', 'Next photo');
      nextBtn.innerHTML = '&#8250;';
      prevBtn.addEventListener('click', function () { step(-1); });
      nextBtn.addEventListener('click', function () { step(1); });
      slidesEl.appendChild(prevBtn);
      slidesEl.appendChild(nextBtn);

      // "Tap to enlarge" badge — an overlay inside the fixed-size frame, not
      // a block element, so its appearance/disappearance on info slides
      // never changes the carousel's height (which broke card alignment).
      var hint = document.createElement('span');
      hint.className = 'carousel-hint';
      hint.textContent = 'Tap to enlarge';
      slidesEl.appendChild(hint);

      // Keyboard navigation when the carousel has focus
      carousel.setAttribute('tabindex', '0');
      carousel.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowLeft') { step(-1); e.preventDefault(); }
        else if (e.key === 'ArrowRight') { step(1); e.preventDefault(); }
      });

      // Basic swipe support for touch devices
      var touchStartX = null;
      carousel.addEventListener('touchstart', function (e) {
        touchStartX = e.touches[0].clientX;
      }, { passive: true });
      carousel.addEventListener('touchend', function (e) {
        if (touchStartX === null) return;
        var dx = e.changedTouches[0].clientX - touchStartX;
        touchStartX = null;
        if (Math.abs(dx) < 40) return;
        step(dx < 0 ? 1 : -1);
      }, { passive: true });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderBadge();
    initCarousels();
    initLightbox();
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
        var mrpAttr = btn.getAttribute('data-mrp');
        addToCart({
          slug: btn.getAttribute('data-slug'),
          name: btn.getAttribute('data-name'),
          price: parseInt(btn.getAttribute('data-price'), 10),
          mrp: mrpAttr ? parseInt(mrpAttr, 10) : undefined,
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
      { title: 'Atta Original', desc: 'Cardamom, whole wheat atta, pure desi ghee. ₹259 / 250g.', type: 'Product', url: 'gifting.html#atta-original' },
      { title: 'Atta Kesari', desc: 'Real saffron, hand-mixed into every batch. ₹299 / 250g.', type: 'Product', url: 'gifting.html#atta-kesari' },
      { title: 'Atta Sugar-Lite', desc: '95% less sugar than Original, sweetened with maltitol. ₹299 / 250g.', type: 'Product', url: 'gifting.html#atta-lite-sugar' },
      { title: 'Atta Ajwain', desc: 'Savoury, spiced with ajwain. ₹259 / 250g.', type: 'Product', url: 'gifting.html#atta-ajwain' },
      { title: 'The Trio Gift Set', desc: 'Choose any 3 of 4 flavours, 250g each, gift-boxed. ₹739.', type: 'Gift Set', url: 'gifting.html#trio-gift-set' },
      { title: 'The Full Range Gift Set', desc: 'One of each flavour, 1kg total, 4 boxes. ₹999.', type: 'Gift Set', url: 'gifting.html#full-range-set' },
      { title: 'About Us', desc: 'Our story — baked in Bikaner for over a decade.', type: 'Page', url: 'about.html' },
      { title: 'Contact', desc: 'WhatsApp, email, Instagram, corporate gifting.', type: 'Page', url: 'contact.html' },
      { title: 'Your Cart', desc: 'Review your bag and check out on WhatsApp.', type: 'Page', url: 'cart.html' },
      { title: 'Is Atta Sugar-Lite safe for diabetics?', desc: 'Sweetened with maltitol, no added sugar. Contains polyols; may have a laxative effect.', type: 'FAQ', url: 'contact.html#faq-diabetic' },
      { title: "What's the shelf life?", desc: 'Best before 90 days from packing.', type: 'FAQ', url: 'contact.html#faq-shelf-life' },
      { title: 'Can I customise a corporate hamper?', desc: 'Corporate gifting and bulk orders from 25 boxes.', type: 'FAQ', url: 'contact.html#faq-hamper' },
      { title: 'Where is it made?', desc: 'Krazy Bakers, Gangashahar, Bikaner, Rajasthan.', type: 'FAQ', url: 'contact.html#faq-location' },
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
