// data/products.js — single source of truth for the 4 SKUs.
// Consumed by index.html's range-card renderer and by each atta-*.html
// PDP (which inlines its own record — see docs/superpowers/plans/
// 2026-09-27-v2-site-integration.md Task 5 for why it's not fetched).
window.MUNCHINGO_PRODUCTS = [
  {
    slug: 'atta-original', name: 'Atta Original', tag: 'Gently sweet',
    sub: 'Cardamom-kissed whole wheat cookies, baked in pure desi ghee.',
    notes: ['Cardamom', 'Desi ghee', 'Whole wheat atta', 'Crumbly, short bite'],
    price: 300, mrp: 300, save: 0, img: 'images/box-original.webp',
    ingredients: 'Whole wheat atta (49.5%), sugar, desi cow ghee, milk solids (milk powder), glucose, raising agent (INS 503(ii)), cardamom (elaichi).',
    allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
    servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
    nutrition100g: { energyKcal: 450, proteinG: 6.7, carbG: 59, totalSugarG: 27, addedSugarG: 26, fibreG: 5.6, fatG: 22, satFatG: 13.5, transFatG: 0, cholesterolMg: 56, sodiumMg: 10, calciumMg: 44, ironMg: 2.08, potassiumMg: 191 },
    rdaPct: { energy: 22.5, protein: 12.2, carb: 19.7, addedSugar: 52.0, fibre: 22.4, fat: 33.8, satFat: 61.4, sodium: 0.5, calcium: 4.4, iron: 11.0, potassium: 5.5 },
    bandEyebrow: 'What makes it Original', bandH2: 'Real cardamom. <span class="script">Nothing pretending.</span>',
    bandP: 'Green cardamom, mixed into every batch with pure desi ghee. The one we started with, and the one most people reorder first.',
    ingr: [{ label: 'Elaichi', sub: 'Green cardamom' }, { label: 'Desi ghee', sub: 'Never palm oil' }, { label: 'Whole wheat atta', sub: '49.5% of the mix' }],
    faqQ1: 'Is Original the same recipe you started with?',
    faqA1: 'Yes. Whole wheat atta, pure desi ghee and cardamom, the same recipe Munchingo launched with. Every other flavour builds on this one.',
  },
  {
    slug: 'atta-ajwain', name: 'Atta Ajwain', tag: 'Spiced & less sweet',
    sub: 'The one that changes the room when the pack is opened.',
    notes: ['Ajwain', 'Desi ghee', 'Whole wheat atta', 'Less sweet'],
    price: 300, mrp: 300, save: 0, img: 'images/box-ajwain.webp',
    ingredients: 'Whole wheat atta (49.9%), desi cow ghee, sugar, milk solids (milk powder), glucose, salt, raising agent (INS 503(ii)), ajwain (carom seed).',
    allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
    servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
    nutrition100g: { energyKcal: 440, proteinG: 6.8, carbG: 52, totalSugarG: 20, addedSugarG: 19, fibreG: 5.8, fatG: 24, satFatG: 14.5, transFatG: 0, cholesterolMg: 60, sodiumMg: 403, calciumMg: 50, ironMg: 2.8, potassiumMg: 196 },
    rdaPct: { energy: 22.0, protein: 12.4, carb: 17.3, addedSugar: 38.0, fibre: 23.2, fat: 36.9, satFat: 65.9, sodium: 20.2, calcium: 5.0, iron: 14.7, potassium: 5.6 },
    bandEyebrow: 'What makes it Ajwain', bandH2: 'Real ajwain. <span class="script">Nothing pretending.</span>',
    bandP: 'Whole carom seed, mixed into every batch with pure desi ghee and just enough salt to round it out. Less sweet than our other flavours, though not sugar-free (see the nutrition table).',
    ingr: [{ label: 'Ajwain', sub: 'Carom seed' }, { label: 'Salt', sub: 'Balanced, not bland' }, { label: 'Desi ghee', sub: 'Never palm oil' }],
    faqQ1: 'Is Ajwain very spicy?',
    faqA1: 'No, it is warm and aromatic rather than hot: whole carom seed and salt, no chilli. It is less sweet than our other flavours, but it does contain sugar (19 g per 100 g).',
  },
  {
    slug: 'atta-kesari', name: 'Atta Kesari', tag: 'Royally sweet',
    sub: 'Saffron whole wheat cookies, baked in pure desi ghee.',
    notes: ['Real saffron', 'Cardamom', 'Desi ghee', 'Crumbly, short bite'],
    price: 350, mrp: 350, save: 0, img: 'images/box-kesari.webp',
    ingredients: 'Whole wheat atta (49.6%), sugar, desi cow ghee, milk solids (milk powder), glucose, raising agent (INS 503(ii)), cardamom (elaichi), saffron (kesar) (0.025%).',
    allergen: 'Contains: wheat (gluten), milk. Made in a facility that also processes tree nuts and other spices.',
    servingLine: 'Per 100g · serving is 2 biscuits (16.7g) · 15 servings per box',
    nutrition100g: { energyKcal: 450, proteinG: 6.7, carbG: 59, totalSugarG: 27, addedSugarG: 26, fibreG: 5.6, fatG: 22, satFatG: 13.5, transFatG: 0, cholesterolMg: 56, sodiumMg: 10, calciumMg: 44, ironMg: 2.09, potassiumMg: 191 },
    rdaPct: { energy: 22.5, protein: 12.2, carb: 19.7, addedSugar: 52.0, fibre: 22.4, fat: 33.8, satFat: 61.4, sodium: 0.5, calcium: 4.4, iron: 11.0, potassium: 5.5 },
    bandEyebrow: 'What makes it Kesari', bandH2: 'Real kesar. <span class="script">Nothing pretending.</span>',
    bandP: 'Saffron threads, mixed into every batch with elaichi and pure desi ghee. No saffron flavouring, and no colour added to fake the gold.',
    ingr: [{ label: 'Kesar', sub: 'Real saffron threads' }, { label: 'Elaichi', sub: 'Green cardamom' }, { label: 'Desi ghee', sub: 'Never palm oil' }],
    faqQ1: 'Is the saffron real?',
    faqA1: 'Yes. Real saffron (kesar), mixed into every batch. It makes up 0.025% of the recipe by weight, which is declared on the pack.',
  },
  {
    slug: 'atta-lite-sugar', name: 'Atta Sugar-Lite', tag: 'No added sugar',
    sub: '95% less sugar than our Original, sweetened with maltitol.',
    notes: ['No added sugar', 'Sweetened with maltitol', 'Desi ghee', 'Whole wheat atta'],
    price: 350, mrp: 350, save: 0, img: 'images/box-lite.webp',
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

// Live prices (js/prices.js) override the launch prices above. The owner changes them in the admin.
(function () {
  var P = window.MunchingoPrices; if (!P) return;
  window.MUNCHINGO_PRODUCTS.forEach(function (p) {
    var b = P.get(p.slug); if (!b) return;
    var m = P.mrp(p.slug, null);
    p.price = b.price; p.mrp = m || b.price; p.save = m ? m - b.price : 0;
  });
})();
