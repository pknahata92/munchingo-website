# Munchingo v2 Live Site Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current live `munchingo-website` front-of-funnel (home + 4 product pages) with the approved v2 design (packaging palette, pureproject.in-inspired structure), reskin the rest of the buying path (gifting, cart, checkout, order confirmation) to match, and wire every page to the **real**, already-working cart/checkout/backend — not a mockup.

**Architecture:** This is a visual + markup migration, not a rewrite of working systems. `js/cart.js` (localStorage cart, AOV bar, cross-sell, search, carousels, lightbox) and the Razorpay/backend checkout flow (`routes/checkout.js`, `utils/razorpay.js`, the `/razorpay-webhook` handler) are already correct and already live — this plan does not touch their logic, only the HTML/CSS around them. New pages are built to call the existing `MunchingoCart` API and existing `data-add-to-cart` / `data-cart-count` conventions so they plug into the existing cart with zero backend changes.

**Tech Stack:** Static HTML/CSS/vanilla JS (no build step, no framework), `js/cart.js` as the shared client module, Node/Express backend (`webhook-backend`, unchanged by this plan), Razorpay Payment Links, Supabase (order storage, unchanged).

**Spec:** The approved visual design lives at `~/Downloads/Munchingo/drafts/home-v2.html`, `atta-kesari.html`, `atta-original.html`, `atta-ajwain.html`, `atta-sugar-lite.html`, and `drafts/assets/v2.css` (outside this repo, reviewed and approved by Prashant 2026-09-27). This plan is the spec for *wiring* that approved design into this repo — see each task's "Design source" line for exactly which draft file/section it adapts.

## Global Constraints

- **No test framework exists in this repo** (confirmed: no `package.json` test script, no CI). "Testing" a task means: (a) run `qa-audit.js` in the browser console on the changed page (installed in Task 1) and get a clean result, (b) walk the manual checklist listed in that task, (c) for anything touching checkout, use Razorpay **test-mode** keys locally — never production keys, never a real card, never submit the live `checkout.html` on `munchingo.com` with real payment intent.
- **Do not rename existing product slugs.** The backend, `js/cart.js`, and Supabase orders all key on these exact strings: `atta-original`, `atta-kesari`, `atta-ajwain`, `atta-lite-sugar` (not "sugar-lite" — the draft's file used that spelling for its filename only; the real slug stays `atta-lite-sugar`), `full-range-set`, `trio-gift-set-<sorted-flavour-slugs>` (built dynamically, see Task 6).
- **Reuse existing real assets — do not use the draft's placeholder assets.** `images/box-{original,kesari,ajwain,lite}.jpg`, `images/ingredients-{original,kesari,ajwain,lite-sugar}.png`, and `images/nutrition-{original,kesari,ajwain,lite-sugar}.png` already exist in this repo for **all four** SKUs (the draft only had Kesari's — that limitation does not apply here).
- **Keep the existing button class system.** `css/style.css` already defines `.btn.solid`, `.btn.outline`, `.btn.gold`, `.btn.navybtn`, `.btn.block`, `.btn.small` and `cart.html`/`checkout.html`/`about.html` etc. already use them. New v2 markup uses these classes, not the draft's own `.btn-primary`/`.btn-ghost`/`.btn-dark` names — don't introduce a second button system.
- **Keep every add-to-cart button wired the existing way**: `<button data-add-to-cart data-slug="…" data-name="…" data-price="…" data-mrp="…" data-unit="…">` — `js/cart.js`'s `DOMContentLoaded` handler auto-wires any button matching that selector. Don't hand-write new cart JS for "add to bag" anywhere.
- **Correct color values, not new token names.** Three tokens in `css/style.css`'s `:root` are stale relative to Prashant's 2026-09-26 decision (see `munchingo-website-palette-decision` memory) and get corrected in place in Task 2: `--terra` (#B7673E → #A35A34, the old value fails contrast on navy at 2.7:1), `--terra-deep` (#914F2E → #86482A), `--kesari` (#B15A2E → #A9582F).
- Every task that changes a page ends with that page loading with zero console errors and the cart badge (`[data-cart-count]`) updating correctly when something is added.

---

## File Structure

```
munchingo-website/
├── css/
│   └── style.css                 [MODIFY] — token corrections (Task 2) +
│                                    new v2 component rules appended (Task 2):
│                                    header/nav, hero, range-cards, PDP layout,
│                                    flavour band, gift-builder-v2 skin,
│                                    statement band, process steps, footer
│                                    wordmark. Existing rules (AOV bar,
│                                    cross-sell, lightbox, carousel, search,
│                                    forms, coupon/subscribe UI) are untouched.
├── data/
│   └── products.js               [CREATE] — single source of truth for the
│                                    4 SKUs (Task 3), consumed by index.html
│                                    and the 4 PDP pages.
├── js/
│   ├── cart.js                   [UNCHANGED] — already correct, do not touch.
│   └── qa-audit.js               [CREATE, copied from drafts/qa-audit.js]
│                                    (Task 1) — standing QA tool for every
│                                    later task.
├── index.html                    [MODIFY] — v2 homepage (Task 4)
├── atta-original.html            [CREATE] (Task 5)
├── atta-ajwain.html              [CREATE] (Task 5)
├── atta-kesari.html              [CREATE] (Task 5)
├── atta-lite-sugar.html          [CREATE] (Task 5) — note filename, not
│                                    "atta-sugar-lite.html"
├── gifting.html                  [MODIFY] — v2 skin, same builder JS (Task 6)
├── cart.html                     [MODIFY] — v2 skin only (Task 7)
├── checkout.html                 [MODIFY] — v2 skin only (Task 8)
├── order-confirmed.html          [MODIFY] — v2 skin only (Task 9)
├── about.html                    [MODIFY] — header/footer chrome only (Task 10)
├── contact.html                  [MODIFY] — header/footer chrome only (Task 10)
├── privacy-policy.html           [MODIFY] — header/footer chrome only (Task 10)
├── terms.html                    [MODIFY] — header/footer chrome only (Task 10)
├── sitemap.xml                   [MODIFY] (Task 11)
└── images/logo-gold-v2.png       [UNCHANGED] — already the right logo file
```

---

### Task 1: Install the standing QA tool

**Files:**
- Create: `js/qa-audit.js` (copy of `~/Downloads/Munchingo/drafts/qa-audit.js`, unchanged — it's already generic, not draft-specific)

**Interfaces:**
- Produces: a global pattern every later task uses to self-check — paste `js/qa-audit.js`'s contents into the browser console on the page you just changed, and read `{contrast, targets, overlaps, overflow, brokenImgs}` off the returned object. All five must be empty/zero before a task is considered done.

- [ ] **Step 1:** Copy the file
  ```bash
  cp ~/Downloads/Munchingo/drafts/qa-audit.js /Users/prashantnahata/Downloads/Munchingo/munchingo-website/js/qa-audit.js
  ```
- [ ] **Step 2:** Verify it runs clean on the *current, unmodified* `index.html` (establishes your baseline — if it's not clean today, that's pre-existing and not something later tasks need to fix unless it's on a page they touch):
  Open `index.html` locally, paste `js/qa-audit.js`'s contents into the console, run it, note the result.
- [ ] **Step 3:** Commit
  ```bash
  git add js/qa-audit.js
  git commit -m "chore: add qa-audit.js as the standing visual QA tool"
  ```

---

### Task 2: Design tokens + v2 component CSS

**Files:**
- Modify: `css/style.css:6` (the `:root` block) — correct 3 token values, add new v2-only tokens
- Modify: `css/style.css` (append new rules at end of file) — v2 component styles

**Interfaces:**
- Produces: the token names and component class names every later task's markup uses — `--marigold`, `--marigold-soft`, `--ink`, `--ink-2`, `--ink-3`, `--paper`, `--shadow`, and classes `.v2-header`, `.v2-nav`, `.v2-hero`, `.v2-range .card`, `.v2-pdp`, `.v2-band`, `.v2-builder`, `.v2-statement`, `.v2-process`, `.v2-footer-word` (the `v2-` prefix keeps these from colliding with any existing `.header`/`.hero`/etc. rule already in the file — check for collisions before dropping the prefix on any individual class if you'd rather not prefix all of them).

- [ ] **Step 1: Correct the 3 stale color values**

  In `css/style.css`'s `:root` block, change:
  ```css
  /* before */
  --terra:#B7673E; --terra-deep:#914F2E;
  --ruby:#7C2230; --kesari:#B15A2E; --slate:#4F6579; --mauve:#6B4F63;
  ```
  to:
  ```css
  /* after */
  --terra:#A35A34; --terra-deep:#86482A;
  --ruby:#7C2230; --kesari:#A9582F; --slate:#4F6579; --mauve:#6B4F63;
  ```
  (`--ruby`, `--slate`, `--mauve` are already correct — leave them.)

- [ ] **Step 2: Add the new tokens the v2 pages need**, right after the corrected block:
  ```css
  --marigold:#E3A72F; --marigold-soft:#F6DFA8;
  --ink:#2A1A12; --ink-2:#5B4537; --ink-3:#76604F;
  --paper:#FFFDF8; --cream-2:#F3E6CC;
  --r:22px; --shadow:0 18px 40px -18px rgba(42,26,18,.35);
  ```
  (this overwrites the old `--cream-2:#EFE3C2` with the draft's `#F3E6CC` — check nothing currently visible relies on the old value looking *exactly* as it did; it's a few percent lighter, not a different hue, so this is safe.)

- [ ] **Step 3: Port the v2 component CSS.** Open `~/Downloads/Munchingo/drafts/assets/v2.css` and, for each selector block, append it to the end of `css/style.css`, with these find-and-replace changes as you go (do this with a script, not by hand, to avoid missing one):
  - Prefix every top-level component class the draft defines with `v2-` (e.g. `.header{` → `.v2-header{`, `.card{` → `.v2-range .v2-card{`) **except**: `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-dark`, `.eyebrow`, `.script` — these don't get ported at all, because `css/style.css` already has `.btn.solid/.outline/.gold`, `.eyebrow`, and `.script` doing the same job. Any draft markup you port in Tasks 4–9 uses the **existing** names for these, not the draft's.
  - Skip porting `.thumbs`/`.stage.label` rules — Task 5 uses the real photo-carousel component already in `css/style.css` (`[data-carousel]`, ported from `gifting.html`'s existing per-SKU galleries) instead of the draft's simplified single-image stage, since this repo already has real ingredient/nutrition label photos for all 4 SKUs and a working carousel to show them.
  - Skip porting `.sticky-buy` — decide in Task 5 whether the real PDP wants it; if yes, port it then, scoped to that task.
  - A concrete script to do the bulk of this mechanically:
    ```bash
    cd /Users/prashantnahata/Downloads/Munchingo
    python3 - <<'EOF'
    import re
    src = open('drafts/assets/v2.css').read()
    # Strip the parts Task 2 explicitly excludes
    for pat in [r'\.thumbs\{.*?\}\n', r'\.thumbs[^{]*\{[^}]*\}\n',
                r'\.stage\.label[^{]*\{[^}]*\}\n', r'\.sticky-buy[^{]*\{[^}]*\}\n']:
        src = re.sub(pat, '', src, flags=re.S)
    # Prefix component classes with v2- (skip already-shared names)
    SKIP = {'btn','btn-primary','btn-ghost','btn-dark','eyebrow','script'}
    def prefix(m):
        cls = m.group(1)
        return ('.' if cls not in SKIP else '.') + (cls if cls in SKIP else 'v2-'+cls)
    src = re.sub(r'\.([a-zA-Z][\w-]*)', prefix, src)
    open('munchingo-website/css/style-v2-import.css.tmp','w').write(src)
    EOF
    ```
    Review `style-v2-import.css.tmp` by eye (the regex is a starting point, not a guarantee — check it didn't double-prefix `.v2-v2-` anywhere, fix by hand, then append its contents to `css/style.css` and delete the `.tmp` file).

- [ ] **Step 4: Manual check.** Open `index.html` (still unmodified markup at this point) in a browser — it must render **identically** to before this task, since you've only added new, unused CSS so far. Run `qa-audit.js`; it should match your Task 1 baseline exactly.

- [ ] **Step 5: Commit**
  ```bash
  git add css/style.css
  git commit -m "style: correct terra/kesari token values, add v2 design tokens and component CSS"
  ```

---

### Task 3: Product data module (single source of truth)

**Design source:** this doesn't exist in the draft — the draft hardcoded each PDP's copy by hand (that's what the earlier tile-duplication bug came from). This task is what Prashant's original design note asked for ("product pages get their own URLs, generated from a single product data file").

**Files:**
- Create: `data/products.js`

**Interfaces:**
- Produces: `window.MUNCHINGO_PRODUCTS`, an array of 4 objects, each shaped:
  ```js
  {
    slug, name, tag, sub, notes /* string[] */,
    price, mrp, save, img /* "images/box-original.jpg" */,
    ingredients /* string, the full comma list */,
    allergen /* string */,
    servingLine /* "Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box" */,
    nutrition100g: { energyKcal, proteinG, carbG, totalSugarG, addedSugarG,
                     fibreG, fatG, satFatG, transFatG, cholesterolMg,
                     sodiumMg, calciumMg, ironMg, potassiumMg,
                     polyolsG /* only atta-lite-sugar */ },
    rdaPct: { energy, protein, carb, addedSugar, fibre, fat, satFat,
              sodium, calcium, iron, potassium },
    bandEyebrow, bandH2 /* HTML-safe string, may contain <span class="script"> */, bandP,
    ingr /* [{label, sub}, …], 3 items */,
    faqQ1, faqA1,
  }
  ```
  Consumed by: Task 4 (homepage range cards, built from a `.forEach`) and Task 5 (each PDP inlines its own single record rather than fetching, for reliability without a build step — see Task 5 Step 1 for why).

- [ ] **Step 1: Write the file**, with real values pulled from `index.html`'s current nutrition tables (already verified correct — 16.7g serving, corrected cholesterol precision) and from `~/Downloads/Munchingo/drafts/atta-*.html`'s copy (tag/sub/notes/band content, already approved 2026-09-27):
  ```js
  // data/products.js — single source of truth for the 4 SKUs.
  // Consumed by index.html's range-card renderer and by each atta-*.html
  // PDP (which inlines its own record — see docs/superpowers/plans/
  // 2026-09-27-v2-site-integration.md Task 5 for why it's not fetched).
  window.MUNCHINGO_PRODUCTS = [
    {
      slug: 'atta-original', name: 'Atta Original', tag: 'Gently sweet',
      sub: 'Cardamom-kissed whole wheat cookies, baked in pure desi ghee.',
      notes: ['Cardamom', 'Desi ghee', 'Whole wheat atta', 'Crumbly, short bite'],
      price: 259, mrp: 300, save: 41, img: 'images/box-original.jpg',
      ingredients: 'Whole wheat atta (49.5%), sugar, desi cow ghee, milk solids (milk powder), glucose, raising agent (INS 503(ii)), cardamom (elaichi).',
      allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
      servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
      nutrition100g: { energyKcal: 450, proteinG: 6.7, carbG: 59, totalSugarG: 27, addedSugarG: 26, fibreG: 5.6, fatG: 22, satFatG: 13.5, transFatG: 0, cholesterolMg: 56, sodiumMg: 10, calciumMg: 44, ironMg: 2.08, potassiumMg: 191 },
      rdaPct: { energy: 22.5, protein: 12.2, carb: 19.7, addedSugar: 52.0, fibre: 22.4, fat: 33.8, satFat: 61.4, sodium: 0.5, calcium: 4.4, iron: 11.0, potassium: 5.5 },
      bandEyebrow: 'What makes it Original', bandH2: 'Real cardamom. <span class="script">Nothing pretending.</span>',
      bandP: 'Green cardamom, hand-mixed into every batch with pure desi ghee. The one we started with, and the one most people reorder first.',
      ingr: [{ label: 'Elaichi', sub: 'Green cardamom' }, { label: 'Desi ghee', sub: 'Never palm oil' }, { label: 'Whole wheat atta', sub: '49.5% of the mix' }],
      faqQ1: 'Is Original the same recipe you started with?',
      faqA1: 'Yes. Whole wheat atta, pure desi ghee and cardamom, the same recipe Munchingo launched with. Every other flavour builds on this one.',
    },
    {
      slug: 'atta-ajwain', name: 'Atta Ajwain', tag: 'Savoury & spiced',
      sub: 'The one that changes the room when the pack is opened.',
      notes: ['Ajwain', 'Desi ghee', 'Whole wheat atta', 'Savoury bite'],
      price: 259, mrp: 300, save: 41, img: 'images/box-ajwain.jpg',
      ingredients: 'Whole wheat atta (49.9%), desi cow ghee, sugar, milk solids (milk powder), glucose, salt, raising agent (INS 503(ii)), ajwain (carom seed).',
      allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
      servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
      nutrition100g: { energyKcal: 440, proteinG: 6.8, carbG: 52, totalSugarG: 20, addedSugarG: 19, fibreG: 5.8, fatG: 24, satFatG: 14.5, transFatG: 0, cholesterolMg: 60, sodiumMg: 403, calciumMg: 50, ironMg: 2.8, potassiumMg: 196 },
      rdaPct: { energy: 22.0, protein: 12.4, carb: 17.3, addedSugar: 38.0, fibre: 23.2, fat: 36.9, satFat: 65.9, sodium: 20.2, calcium: 5.0, iron: 14.7, potassium: 5.6 },
      bandEyebrow: 'What makes it Ajwain', bandH2: 'Real ajwain. <span class="script">Nothing pretending.</span>',
      bandP: 'Whole carom seed, hand-mixed into every batch with pure desi ghee and just enough salt to round it out. Savoury, not sweet, and it says so on the box.',
      ingr: [{ label: 'Ajwain', sub: 'Carom seed' }, { label: 'Salt', sub: 'Balanced, not bland' }, { label: 'Desi ghee', sub: 'Never palm oil' }],
      faqQ1: 'Is Ajwain very spicy?',
      faqA1: 'No, it is savoury rather than hot, whole carom seed and salt, no chilli. Think of it closer to a namkeen biscuit than a sweet one.',
    },
    {
      slug: 'atta-kesari', name: 'Atta Kesari', tag: 'Royally sweet',
      sub: 'Saffron whole wheat cookies, baked in pure desi ghee.',
      notes: ['Real saffron', 'Cardamom', 'Desi ghee', 'Crumbly, short bite'],
      price: 299, mrp: 350, save: 51, img: 'images/box-kesari.jpg',
      ingredients: 'Whole wheat atta (49.6%), sugar, desi cow ghee, milk solids (milk powder), glucose, raising agent (INS 503(ii)), cardamom (elaichi), saffron (kesar) (0.025%).',
      allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
      servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
      nutrition100g: { energyKcal: 450, proteinG: 6.7, carbG: 59, totalSugarG: 27, addedSugarG: 26, fibreG: 5.6, fatG: 22, satFatG: 13.5, transFatG: 0, cholesterolMg: 56, sodiumMg: 10, calciumMg: 44, ironMg: 2.09, potassiumMg: 191 },
      rdaPct: { energy: 22.5, protein: 12.2, carb: 19.7, addedSugar: 52.0, fibre: 22.4, fat: 33.8, satFat: 61.4, sodium: 0.5, calcium: 4.4, iron: 11.0, potassium: 5.5 },
      bandEyebrow: 'What makes it Kesari', bandH2: 'Real kesar. <span class="script">Nothing pretending.</span>',
      bandP: 'Saffron threads, hand-mixed into every batch with elaichi and pure desi ghee. No saffron flavouring, and no colour added to fake the gold.',
      ingr: [{ label: 'Kesar', sub: 'Real saffron threads' }, { label: 'Elaichi', sub: 'Green cardamom' }, { label: 'Desi ghee', sub: 'Never palm oil' }],
      faqQ1: 'Is the saffron real?',
      faqA1: 'Yes. Real saffron (kesar), hand-mixed into every batch. It makes up 0.025% of the recipe by weight, which is declared on the pack.',
    },
    {
      slug: 'atta-lite-sugar', name: 'Atta Sugar-Lite', tag: 'No added sugar',
      sub: '95% less sugar than our Original, sweetened with maltitol.',
      notes: ['No added sugar', 'Sweetened with maltitol', 'Desi ghee', 'Whole wheat atta'],
      price: 299, mrp: 350, save: 51, img: 'images/box-lite.jpg',
      ingredients: 'Whole wheat atta (53.1%), desi cow ghee, sweetener (maltitol, INS 965(i)) (15.9%), milk solids (milk powder), cardamom (elaichi), raising agent (INS 503(ii)).',
      allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
      polyolWarning: 'Contains polyols (maltitol): excess consumption may have a laxative effect.',
      servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
      nutrition100g: { energyKcal: 434, proteinG: 7.4, carbG: 52, polyolsG: 16, totalSugarG: 1.2, addedSugarG: 0, fibreG: 6.2, fatG: 26, satFatG: 15.5, transFatG: 0, cholesterolMg: 65, sodiumMg: 13, calciumMg: 54, ironMg: 2.25, potassiumMg: 220 },
      rdaPct: { energy: 21.7, protein: 13.5, carb: 17.3, addedSugar: 0, fibre: 24.8, fat: 40.0, satFat: 70.5, sodium: 0.7, calcium: 5.4, iron: 11.8, potassium: 6.3 },
      bandEyebrow: 'What makes it Sugar-Lite', bandH2: 'Real cardamom. <span class="script">No added sugar.</span>',
      bandP: 'Sweetened with maltitol instead of sugar, so it still tastes like a treat. We kept the cardamom and the desi ghee exactly as they are in Original.',
      ingr: [{ label: 'Maltitol', sub: 'Sweetener, not sugar' }, { label: 'Elaichi', sub: 'Green cardamom' }, { label: 'Desi ghee', sub: 'Never palm oil' }],
      faqQ1: 'Is this actually sugar-free?',
      faqA1: 'It carries the "No Added Sugar" claim, not "Sugar Free". A small amount of natural sugar remains from the milk solids. It is sweetened with maltitol, a polyol, instead of added sugar.',
    },
  ];
  ```
- [ ] **Step 2: Manual check.** Open a blank HTML file that just does `<script src="data/products.js"></script><script>console.log(window.MUNCHINGO_PRODUCTS.length)</script>` — must log `4`.
- [ ] **Step 3: Commit**
  ```bash
  git add data/products.js
  git commit -m "feat: add single-source-of-truth product data module"
  ```

---

### Task 4: Homepage (`index.html`)

**Design source:** `drafts/home-v2.html`

**Files:**
- Modify: `index.html` (header, hero, range section, footer — the gift-builder section is handled by Task 6, not here; keep `index.html`'s existing "gifts" section as a slim teaser card linking to `gifting.html` rather than porting the draft's inline builder — see Task 6 for why)

**Interfaces:**
- Consumes: `data/products.js` (Task 3), `js/cart.js`'s `data-add-to-cart` convention, `js/qa-audit.js` (Task 1)
- Produces: nothing new consumed elsewhere, but must keep the existing `[data-search-toggle]`, `[data-search-panel]`, `[data-cart-count]`, `nav`/`.nav-toggle` elements **present with the same attribute names**, since `js/cart.js`'s `DOMContentLoaded` handler wires all of these by selector, unchanged.

- [ ] **Step 1: Port the header/hero/statement/process/compare/order-steps/footer markup** from `drafts/home-v2.html`, with these adaptations as you copy each section in:
  - Replace every `class="btn btn-primary"` → `class="btn solid"`, `class="btn btn-ghost"` → `class="btn outline"`, `class="btn btn-dark"` → `class="btn navybtn"`.
  - Replace the draft's inert cart icon (`href="https://munchingo.com/cart"`, static `<span class="cart-count" id="cc">0</span>`) with the real ones already in the current `index.html`'s header: `href="cart.html"` and `<span data-cart-count>0</span>` (search `index.html` for `data-cart-count` to copy the exact existing markup).
  - Replace the draft's inert search icon (`href="…#range"`) with the real search-toggle button from the current `index.html` (search for `data-search-toggle`) — copy it verbatim, then also copy the current `index.html`'s search panel markup (`[data-search-panel]`) into the new page, unchanged.
  - The draft's mobile hamburger `onclick="…"` inline handler gets dropped — `js/cart.js` already wires `.nav-toggle` by selector; use the current `index.html`'s existing `<button class="nav-toggle">` markup instead of the draft's `<button class="icon-btn menu-btn" onclick=…>`.
- [ ] **Step 2: Range section — build the 4 cards from `data/products.js`** instead of hand-writing 4 `<article>` blocks (this is what the tile-duplication bug came from last time — a generated loop can't drift out of sync the way hand-copied markup did):
  ```html
  <section class="v2-range" id="range">
    <div class="wrap">
      <div class="v2-head">
        <div><span class="eyebrow">The range</span><h2>Pick your <span class="script">moment.</span></h2></div>
        <p>Same whole wheat atta and desi ghee in every box. The difference is what we add, or leave out.</p>
      </div>
      <div class="v2-cards" id="range-cards"></div>
    </div>
  </section>
  <script src="data/products.js"></script>
  <script>
  (function () {
    var COLOR_BY_SLUG = { 'atta-original': 'ruby', 'atta-ajwain': 'slate', 'atta-kesari': 'kesari', 'atta-lite-sugar': 'mauve' };
    var PAT_BY_SLUG = { 'atta-original': 'v2-pat-ruby', 'atta-ajwain': 'v2-pat-slate', 'atta-kesari': 'v2-pat-terra', 'atta-lite-sugar': 'v2-pat-mauve' };
    var el = document.getElementById('range-cards');
    el.innerHTML = window.MUNCHINGO_PRODUCTS.map(function (p) {
      var href = p.slug + '.html';
      var fine = p.polyolWarning ? '<p class="v2-fine">' + p.polyolWarning + '</p>' : '';
      return '' +
        '<article class="v2-card ' + PAT_BY_SLUG[p.slug] + '" style="--c:var(--' + COLOR_BY_SLUG[p.slug] + ')">' +
          '<a class="v2-img" href="' + href + '"><img src="' + p.img + '" alt="' + p.name + '"><span class="v2-save">Save ₹' + p.save + '</span></a>' +
          '<div class="v2-body"><span class="v2-tag">' + p.tag + '</span><h3><a href="' + href + '">' + p.name + '</a></h3><p class="v2-line">' + p.sub + '</p>' + fine +
            '<div class="v2-price"><b>₹' + p.price + '</b><s>₹' + p.mrp + '</s><span>· 250g</span></div>' +
            '<button class="btn solid v2-add" data-add-to-cart data-slug="' + p.slug + '" data-name="' + p.name + '" data-price="' + p.price + '" data-mrp="' + p.mrp + '" data-unit="250g">Add to bag</button></div>' +
        '</article>';
    }).join('');
  })();
  </script>
  ```
  (this replaces the draft's fake `[data-add]`/`count++` script entirely — the real `data-add-to-cart` button is picked up automatically by `js/cart.js`, no custom handler needed here.)
- [ ] **Step 2b:** The draft's `.v2-add` button text swaps to "Added ✓" for 1.4s on click in the draft's own script — `js/cart.js` doesn't do this today. Either accept the plain instant-update cart badge as sufficient feedback (recommended — one fewer thing to keep in sync) or add a small `click` listener in this same inline script block that does the text swap *after* calling into the button's own default handler (don't duplicate the `addToCart` call — `js/cart.js` already attached its own listener to `[data-add-to-cart]` by the time this runs, since this script tag runs after `js/cart.js` loads and both fire on the same click event).
- [ ] **Step 3: Gift-set teaser** — keep the current `index.html`'s existing "gifts" section pointing at `gifting.html` (don't port the draft's inline builder here — see Task 6), but restyle its container to the v2 look (marigold sticker, `.v2-` card treatment) so it doesn't look out of place next to the new range cards.
- [ ] **Step 4: Manual check.**
  - Load `index.html` locally. Click "Add to bag" on each of the 4 range cards — the header cart badge must increment each time, and `localStorage.munchingo_cart` (check via devtools) must show 4 distinct line items after one click each.
  - Click the search icon — the existing search panel must open and return results for "kesari" (this proves you copied the real search markup, not the draft's inert one).
  - Run `qa-audit.js` — clean result required.
  - Resize to 375px — mobile nav hamburger opens/closes, range cards become a horizontal scroll-snap carousel with no visible scrollbar (per the fix already made in the draft).
- [ ] **Step 5: Commit**
  ```bash
  git add index.html
  git commit -m "feat: rebuild homepage on the v2 design, wired to the real cart"
  ```

---

### Task 5: The four product pages

**Design source:** `drafts/atta-kesari.html` (the template all 4 are built from) + `drafts/atta-original.html`, `atta-ajwain.html`, `atta-sugar-lite.html` (the 3 already-adapted copies — reuse their copy, not their filenames or images)

**Files:**
- Create: `atta-original.html`, `atta-ajwain.html`, `atta-kesari.html`, `atta-lite-sugar.html`

**Interfaces:**
- Consumes: one record from `data/products.js`'s shape (Task 3), `js/cart.js`
- Produces: 4 URLs that Task 4's range cards, Task 6's cross-sell cards, and `js/cart.js`'s `SEARCH_INDEX` (Task 11) all link to: `/atta-original.html`, `/atta-ajwain.html`, `/atta-kesari.html`, `/atta-lite-sugar.html`

- [ ] **Step 1: Why inline data instead of fetching `data/products.js` here:** these are the pages Google indexes and the pages a slow connection hits first — each one should render its price/nutrition from markup already in the HTML, not wait on a second script to fetch and render. So each PDP **duplicates** its own record from `data/products.js` directly into its markup (same values, same source of truth conceptually — `data/products.js` is what Task 4's loop reads, these 4 files are what a human/crawler reads). This is the one deliberate exception to "single source of truth" in this plan, and it's why Task 5's **Step 5 manual check** below specifically re-diffs each PDP's numbers against `data/products.js` — that diff is what keeps them from drifting apart over time.

- [ ] **Step 2: Build `atta-kesari.html` first**, adapting `drafts/atta-kesari.html` section by section:
  - Header/footer: same substitutions as Task 4 Step 1 (`.btn.btn-primary`→`.btn.solid` etc., real cart/search icons).
  - Breadcrumb, gallery, buy box, flavour band, details panels, FAQ: port as-is from the draft, they're already correct (including the already-fixed footer alignment, GSTIN/FSSAI nbsp, tidy-up button, saffron-thread SVG accent).
  - **Gallery — the one real structural change from the draft:** the draft dropped the ingredient/nutrition photo thumbnails because those images didn't exist yet for 3 of the 4 SKUs. They exist now (`images/ingredients-kesari.png`, `images/nutrition-kesari.png`, and the equivalent for all 4 SKUs). Restore a 3-thumbnail gallery (box photo / ingredients label / nutrition label) using the **existing carousel component** already built for `gifting.html`'s per-SKU cards (`[data-carousel]`, `.slide`, `.dot` — copy that markup pattern from `gifting.html`'s Kesari card, not from the draft, since the draft's thumbnail/lightbox code was removed and gifting.html's `[data-carousel]` + lightbox wiring in `js/cart.js` is already correct and already handles zoom-on-tap for label photos).
  - Cross-sell "Pair it with another" cards: build these from `data/products.js` the same way Task 4 Step 2 does (loop, filter out the current page's own slug), not hand-copied.
- [ ] **Step 3: Build the other 3 pages** the same way, each substituting its own `data/products.js` record. Filename is `atta-lite-sugar.html` for the fourth one (not `atta-sugar-lite.html`) to match the existing slug.
- [ ] **Step 4: Add the polyol warning** to `atta-lite-sugar.html`'s ingredients panel (the `<p class="allergen">` block gets a second paragraph, per the draft's already-approved copy: *"Contains polyols (maltitol): excess consumption may have a laxative effect."*).
- [ ] **Step 5: Manual check, per page:**
  - Diff the nutrition table's numbers against the matching record in `data/products.js` — every one of the 14 rows, by eye, both the 100g and Serve columns. This is the check that catches a Task-5-Step-1-style regression before it ships.
  - Click "Add to bag" — cart badge increments, `localStorage` shows the correct slug.
  - Click each of the 3 cross-sell cards — lands on the right page, no console errors.
  - Run `qa-audit.js` — clean.
  - 375px width — sticky bottom buy bar appears on scroll, doesn't cover the footer's copyright line.
- [ ] **Step 6: Commit**
  ```bash
  git add atta-original.html atta-ajwain.html atta-kesari.html atta-lite-sugar.html
  git commit -m "feat: add v2 product pages for all four SKUs, wired to the real cart"
  ```

---

### Task 6: Gift builder (`gifting.html`) — reskin, don't replace the logic

**Design source:** `drafts/home-v2.html`'s `#gifts` section, for **visual treatment only**

**Why this task doesn't port the draft's builder JS:** the draft's gift-builder (`picks` array, slot UI, `Surprise me`) is a mockup that never talks to the backend. The *real* builder already in `gifting.html` uses checkboxes and builds a real, backend-valid slug like `trio-gift-set-ajwain-kesari-original` via `slugify()` + `sort().join('-')` (see `gifting.html` around line 544–585) — that slug is what `js/cart.js`'s `addToCart` stores and what the backend's `utils/catalog.js` prices server-side. Replacing that logic with the draft's mock version would let a customer "buy" a gift set the backend can't price. So this task restyles the **existing** checkbox markup and its container to look like the draft's builder card, and leaves every `id`, `class` hook the existing script queries, and the `slugify`/`update()` functions completely untouched.

**Files:**
- Modify: `gifting.html` (visual classes only — see constraint above)

**Interfaces:**
- Consumes: the existing (unchanged) builder script in `gifting.html`
- Produces: nothing new — this task changes no IDs/classes the script depends on

- [ ] **Step 1:** Open `gifting.html`, find the Trio and Full Range gift-card markup (`#trio-gift-set`, `#full-range-set`) and the flavour checkboxes above them. Re-skin their container to the v2 "builder" visual (dark `--ink` card, `--marigold` accents) by adding classes only — do not remove or rename `id="trio-gift-set"`, `id="full-range-set"`, the checkbox `data-label`/`value` attributes, or the `data-slug`/`data-add-to-cart` attributes on either "Add to Bag" button.
- [ ] **Step 2:** Re-skin the surrounding page (header/footer/hero copy) using the same substitutions as Task 4 Step 1.
- [ ] **Step 3:** On `index.html`'s gift-teaser section (Task 4 Step 3), make sure its "Build a gift set" button/link points at `gifting.html` (not `#gifts`, since the real builder lives on its own page).
- [ ] **Step 4: Manual check.**
  - Check 3 flavour boxes on the Trio card — the "Add to Bag" button's `data-slug` attribute must update live to `trio-gift-set-<the 3 you picked, alphabetical>` (inspect via devtools). Click it, confirm that exact slug lands in `localStorage.munchingo_cart`.
  - Click Full Range's "Add to Bag" — `full-range-set` lands in the cart at ₹999.
  - Run `qa-audit.js` — clean.
- [ ] **Step 5: Commit**
  ```bash
  git add gifting.html index.html
  git commit -m "style: reskin gift builder to v2 palette, keep existing slug logic untouched"
  ```

---

### Task 7: Cart page (`cart.html`)

**Files:**
- Modify: `cart.html`

**Interfaces:**
- Consumes: `MunchingoCart.getCart/removeFromCart/setQty/cartTotal/renderAovProgressHtml/initAovUpgrade/renderCrossSellHtml/initCrossSell/getGiftNote/setGiftNote` — all already called by `cart.html`'s existing `renderCart()` function (line 176). This task does not touch that function.

- [ ] **Step 1:** Re-skin the page: header/footer per Task 4 Step 1's substitutions, the cart line-item cards to `--paper` background / `--r` radius / `--shadow`, the "Proceed to Checkout" button already using `class="btn solid block"` (no change needed, it's already the right class).
- [ ] **Step 2:** Leave the AOV progress bar, cross-sell strip, and gift-note textarea markup structurally alone (they're generated by `MunchingoCart.renderAovProgressHtml`/`renderCrossSellHtml` as HTML strings — only the CSS painting their existing class names changes, e.g. `.aov-progress-fill`'s `background` becomes `var(--terra)` instead of its current color).
- [ ] **Step 3: Manual check.**
  - Add 3 different items via `index.html`, then open `cart.html` — all 3 show with correct qty/price, the AOV bar reflects the real total.
  - Increment/decrement a qty — total updates, `localStorage` updates.
  - Remove an item — disappears, cross-sell strip re-offers it.
  - Run `qa-audit.js` — clean.
- [ ] **Step 4: Commit**
  ```bash
  git add cart.html
  git commit -m "style: reskin cart page to v2 palette"
  ```

---

### Task 8: Checkout page (`checkout.html`)

**Files:**
- Modify: `checkout.html`

**Interfaces:**
- Consumes: same `MunchingoCart` calls as today (line 244–449) — untouched. `CHECKOUT_API` constant (line 224, `https://munchingo-whatsapp-webhook.onrender.com/api/checkout`) — untouched.

- [ ] **Step 1:** Re-skin the address form, coupon/subscribe UI, and order-summary panel to v2 tokens. Field IDs that must not change (the submit handler references them by ID): `ck-name`, `ck-phone`, `ck-addr-line1`, `ck-addr-area`, `ck-addr-city`, `ck-addr-state`, `ck-addr-pincode`, `ck-email`, `ck-subscribe`, `ck-submit`, `ck-promo-input`, `ck-promo-apply`, `ck-promo-featured-apply`.
- [ ] **Step 2:** Re-skin header/footer per Task 4 Step 1.
- [ ] **Step 3: Manual check — this is the task where you must actually exercise the real submit flow, safely:**
  - **Do this with Razorpay test-mode keys in a local copy of `webhook-backend`, never against the production backend URL.** Set `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` in a local `.env` to your Razorpay **test** key pair (dashboard → test mode → API keys), run `node server.js` locally, and point this local `checkout.html` copy's `CHECKOUT_API` constant at `http://localhost:<port>/api/checkout` *for this local test only* — revert that constant back to the production URL before committing.
  - Fill the form with a fake name/address, a real-format-but-fake phone, submit. Confirm: a `pending_payment` row appears in your Supabase `orders` table (or ask Prashant to check, if you don't have DB access), and you land on Razorpay's **test-mode** hosted payment page (its banner says "Test Mode"). Pay with Razorpay's published test card number (visible on their test-mode payment page).
  - Confirm the webhook fires (`payment_link.paid` in the local server's console log), the order flips to `paid`, and `order-confirmed.html` (Task 9) shows it as paid when you visit `order-confirmed.html?orderId=<the one just created>`.
  - Try an invalid pincode (5 digits) — the existing inline validation blocks submission client-side, matching today's behavior.
  - Run `qa-audit.js` on the page at rest — clean.
- [ ] **Step 4: Commit**
  ```bash
  git add checkout.html
  git commit -m "style: reskin checkout page to v2 palette"
  ```

---

### Task 9: Order confirmation (`order-confirmed.html`)

**Files:**
- Modify: `order-confirmed.html`

**Interfaces:**
- Consumes: `GET /api/order/:orderId` (unchanged, see `routes/checkout.js:306`), reads `orderId` from the URL query string (existing behavior, unchanged).

- [ ] **Step 1:** Re-skin to v2 tokens — this page has no cart/form logic to preserve, purely a status display, lowest-risk task in the plan.
- [ ] **Step 2: Manual check.** Visit with a real (or the test order from Task 8) order ID in the URL — status, items, and total render correctly for both a `pending_payment` and a `paid` order. Run `qa-audit.js` — clean.
- [ ] **Step 3: Commit**
  ```bash
  git add order-confirmed.html
  git commit -m "style: reskin order confirmation page to v2 palette"
  ```

---

### Task 10: Shared chrome on the remaining pages

**Files:**
- Modify: `about.html`, `contact.html`, `privacy-policy.html`, `terms.html` (header + footer markup only — page bodies unchanged, this is not a content redesign)

- [ ] **Step 1:** For each file, swap the header and footer blocks to match Task 4 Step 1's version (same nav links, same real cart/search icons, same v2 footer with the wordmark on `about.html`/`contact.html` only if you want the fun footer everywhere — otherwise a plain v2-styled footer without the draggable letters is fine for the legal pages).
- [ ] **Step 2: Manual check per page** — nav links work, cart badge shows the right count if something's already in the cart from browsing, search opens. Run `qa-audit.js` on each — clean.
- [ ] **Step 3: Commit**
  ```bash
  git add about.html contact.html privacy-policy.html terms.html
  git commit -m "style: bring header/footer chrome on remaining pages to v2"
  ```

---

### Task 11: SEO — sitemap, search index, redirects

**Files:**
- Modify: `sitemap.xml`
- Modify: `js/cart.js` — `SEARCH_INDEX` array (currently points product entries at `gifting.html#atta-original` etc.)

- [ ] **Step 1:** Add the 4 new PDP URLs to `sitemap.xml` with today's date as `<lastmod>`.
- [ ] **Step 2:** Update `js/cart.js`'s `SEARCH_INDEX` (the array around `{ title: 'Atta Original', … url: 'gifting.html#atta-original' }`) so each product entry's `url` points at its own new page (`atta-original.html`, etc.) instead of a `gifting.html` anchor — gifting.html's per-flavour anchors may not exist in the new gift-builder-only version of that page.
- [ ] **Step 3:** Check whether anything outside this repo links to the old anchor URLs (`gifting.html#atta-original` etc.) — grep any saved ad copy, GBP posts, or Meta ad landing-page URLs (see the `marketing` skill/memory for where those live) for that pattern; if any paid traffic points there, add a plain `<meta http-equiv="refresh">`-style redirect or, better, ask Prashant whether the hosting platform (check `render.yaml`/hosting config) supports real 301s and use those instead.
- [ ] **Step 4:** Update each new PDP's `<meta name="description">` and `<link rel="canonical">` — already correct in the drafts, just carry them over from `drafts/atta-*.html`'s `<head>`.
- [ ] **Step 5: Commit**
  ```bash
  git add sitemap.xml js/cart.js
  git commit -m "seo: point sitemap and search index at the new product page URLs"
  ```

---

### Task 12: Final full-site QA pass

**Files:** none — verification only

- [ ] **Step 1:** Run `qa-audit.js` on all 13 pages (`index`, 4 PDPs, `gifting`, `cart`, `checkout`, `order-confirmed`, `about`, `contact`, `privacy-policy`, `terms`) at both 375px and 1440px. Zero contrast/overlap/overflow/broken-image findings across the board.
- [ ] **Step 2:** Click through the full funnel once, start to finish, in one browser session: `index.html` → add 2 different SKUs → `cart.html` → adjust a qty → `checkout.html` → submit against your **local test-mode backend** (per Task 8) → pay with a Razorpay test card → land on `order-confirmed.html` showing `paid`. Zero console errors anywhere in that path.
- [ ] **Step 3:** Repeat the funnel once for the Trio gift set and once for Full Range, confirming both dynamic slugs price correctly.
- [ ] **Step 4:** Check every internal link on every page resolves (reuse the pattern from the `atta-*.html` draft QA — `fetch(url, {method:'HEAD'})` on every unique `href`/`src` found across all 13 pages, expect 200 on every one).
- [ ] **Step 5:** Mobile Safari and Chrome Android real-device check if available (not just the emulated viewport) — font rendering and the sticky-buy bar behavior are the two things most likely to differ from emulation.

---

### Task 13: Deploy

**This task is not something the implementer runs themselves against production** — per this project's standing rule, commits are made locally and handed to Prashant to push (see `Handoff/CLAUDE.md` §9's "START HERE" convention and the `munchingo-next-session-start` memory).

- [ ] **Step 1:** Confirm `git log --oneline` shows one commit per task above, nothing squashed, nothing left uncommitted (`git status` clean).
- [ ] **Step 2:** Hand Prashant this exact command:
  ```bash
  cd /Users/prashantnahata/Downloads/Munchingo/munchingo-website
  git push origin main
  ```
- [ ] **Step 3:** After he confirms the push, verify live the same way past deploys in this project have been verified (per the 2026-09-26 session log's lesson): probe with a payload the *old* code would reject harmlessly, never one it would act on. For this deploy, that means: load `https://munchingo.com/atta-kesari.html` and confirm it 200s (the old site had no such URL, so any response other than the host's real 404 page proves the new file is live) — don't submit a real checkout against production as your verification step.

---

## Self-Review

**Spec coverage:** every section of `drafts/home-v2.html` and the 4 PDP drafts maps to a task above (header/hero → Task 4; range cards → Task 4; gift builder → Task 6, intentionally not ported 1:1 — reasoning given inline; statement/process/compare/order-steps/footer → Task 4; PDP gallery/buy-box/band/details/FAQ/cross-sell → Task 5). Cart/checkout/order-confirmed/about/contact/legal pages, which have no draft equivalent but were named in Prashant's original "whole buying path" decision, are covered by Tasks 7–10. SEO follow-through (Task 11) and a full technical QA + safe checkout test (Task 12) close the loop before Task 13's handoff.

**Placeholder scan:** no "TBD"/"handle errors appropriately" left in any task; every task names its exact files, exact class/slug/ID names, and exact verification steps.

**Type/naming consistency:** `atta-lite-sugar` (not `atta-sugar-lite`) used consistently in Tasks 3, 5, 6, 11. `data-add-to-cart`/`data-cart-count` conventions referenced identically in Tasks 4–10. `.btn.solid/.outline/.gold/.navybtn` used consistently, never the draft's `.btn-primary` naming, in every task that touches markup.
