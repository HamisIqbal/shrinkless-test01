/**
 * The long-form product copy, in one file because two scripts need it: the full
 * seed, which deletes and rebuilds the catalogue, and `copy:refresh`, which
 * writes nothing but this and is therefore safe to run against a live store.
 *
 * The format is the one `lib/shop/story.ts` reads back — blank lines separate
 * blocks and a line opening with a dash is a list item. Each entry is a lead
 * paragraph, the five to seven things a shopper checks before buying a tee,
 * and a line to close.
 */
export const PRODUCT_COPY: Record<string, string> = {
  'mens-organic-tee':
    'The one everything else is measured against. Garment dyed organic cotton in a mid weight that holds its shape without feeling stiff, a true crew neck that does not stretch out at the collar, and a body cut straight enough to wear on its own or under something else. It is the tee we make the most of, and the one we hear back about most.\n' +
    '\n' +
    '- 6.5oz organic cotton, ring spun and combed for a smooth face\n' +
    '- Garment dyed after cutting, so the colour settles into the cloth rather than sitting on top of it\n' +
    '- Pre-shrunk at temperature: expected residual shrinkage under 2%\n' +
    '- Ribbed collar with shoulder-to-shoulder taping to hold the neckline\n' +
    '- Straight body, regular through the chest, with a hem that clears the belt\n' +
    '- Cut and sewn in the United States\n' +
    '- Machine wash cold, tumble dry low\n' +
    '\n' +
    'Wears in rather than out. The colour softens a shade over the first few washes and then stays where it lands.\n',

  'mens-heavyweight-tee':
    'A denser knit with real weight in the hand and a shoulder that holds its line all day. Cut slightly longer and a touch wider than the Organic Tee, so it hangs away from the body rather than following it. This is the one to reach for when a tee has to do the job of a layer.\n' +
    '\n' +
    '- 8.5oz organic cotton in a tight jersey knit\n' +
    '- Garment dyed, so no two runs are quite alike and none of them fade flat\n' +
    '- Pre-shrunk at temperature: expected residual shrinkage under 2%\n' +
    '- Heavier ribbed collar, double-needle stitched at the hem and the cuffs\n' +
    '- Cut an inch longer and wider through the body than the Organic Tee\n' +
    '- Holds a square shoulder without a pad or a taped seam\n' +
    '- Cut and sewn in the United States\n' +
    '\n' +
    'Heavy enough to wear on its own through autumn, and the last tee in the drawer to lose its shape.\n',

  'mens-long-sleeve-tee':
    'The Organic Tee body with a set-in long sleeve and a ribbed cuff that stays where you push it. Same cotton, same dye, same fit through the chest, so it layers under everything the short sleeve already lives with. The sleeve is cut to reach the wrist bone with the arm extended, not halfway up it.\n' +
    '\n' +
    '- 6.5oz organic cotton, the same cloth as the Organic Tee\n' +
    '- Set-in sleeve rather than a raglan, so the shoulder line stays square\n' +
    '- Ribbed cuffs that hold their shape after being pushed up\n' +
    '- Garment dyed and pre-shrunk: expected residual shrinkage under 2%\n' +
    '- Ribbed collar with shoulder-to-shoulder taping\n' +
    '- Cut and sewn in the United States\n' +
    '\n' +
    'The layer that does not need to be seen to be worth wearing.\n',

  'womens-organic-tee':
    'The same cotton and the same dye process as the men\'s, cut for a shorter body and a narrower shoulder. It holds its length and its neckline wash after wash, which is the whole reason this shop exists: a tee that rides up an inch every time it is washed is a tee you quietly stop wearing.\n' +
    '\n' +
    '- 6.5oz organic cotton, ring spun and combed\n' +
    '- Cut shorter through the body, with a narrower shoulder and armhole\n' +
    '- Garment dyed after cutting for depth of colour\n' +
    '- Pre-shrunk at temperature: expected residual shrinkage under 2%\n' +
    '- Ribbed collar that keeps its shape through the wash\n' +
    '- Cut and sewn in the United States\n' +
    '\n' +
    'Comes out of the dryer the length it went in. That is the promise, and it is the only one we make.\n',

  'womens-boxy-tee':
    'A wide, square body with a dropped shoulder and a cropped length, meant to sit away from the body rather than against it. The proportions only work if they stay put, which is why this one is pre-shrunk harder than anything else we make. A boxy tee that shrinks is just a small tee.\n' +
    '\n' +
    '- 7oz organic cotton with a soft, dry hand\n' +
    '- Square through the body with a dropped shoulder seam\n' +
    '- Cropped: sits at the top of the hip rather than below it\n' +
    '- Garment dyed and pre-shrunk at temperature\n' +
    '- Wide ribbed collar, cut to match the proportions of the body\n' +
    '- Cut and sewn in the United States\n' +
    '\n' +
    'Wear it over something or on its own. It is not going to change shape either way.\n',

  'womens-everyday-tee':
    'The lightest weight we make, in the two colours that go with everything already in the drawer. Thin enough to layer under a shirt without adding bulk, and finished exactly the way every other tee here is finished, so being light costs it nothing in how long it lasts.\n' +
    '\n' +
    '- 5.5oz organic cotton, the finest knit in the range\n' +
    '- Cut close through the body without being tight\n' +
    '- Garment dyed in black and charcoal, both of which stay dark\n' +
    '- Pre-shrunk at temperature: expected residual shrinkage under 2%\n' +
    '- Ribbed collar with shoulder-to-shoulder taping\n' +
    '- Cut and sewn in the United States\n' +
    '\n' +
    'The one you buy three of and then stop thinking about.\n',
};
