/* Serve the app with PHONE_AUTH flipped ON, without touching one file on
   disk — a suite that edits a source file races every other suite in the
   net, and `run.sh` runs two builds at once.

   ⚠️ It is here rather than copied into each suite because three of them
   need it, and a rule written three times has three versions two batches
   later. And it is the SAME mechanism `test_v74` items 7 and 8 use.

   ⚠️ On the single-file build the module is a base64 data: URI inside the
   importmap, so the DOCUMENT is rewritten instead — the two builds are
   different environments, not copies of one. */
import { Buffer } from 'node:buffer';

const OFF = 'export const PHONE_AUTH = false;';
const ON  = 'export const PHONE_AUTH = true;';

export async function phoneAuthOn(ctx, base) {
  const single = /index-single-file/.test(base);
  const swap = (src) => {
    if (!src.includes(OFF)) throw new Error('PHONE_AUTH anchor not found while flipping');
    return src.replace(OFF, ON);
  };
  if (single) {
    await ctx.route('**/index-single-file.html*', async (route) => {
      const res = await route.fetch();
      let html = await res.text();
      const m = html.match(/"arabna\/js\/data\.js":\s*"data:text\/javascript;base64,([A-Za-z0-9+/=]+)"/);
      if (!m) throw new Error('data.js not found in the importmap');
      const flipped = swap(Buffer.from(m[1], 'base64').toString('utf8'));
      html = html.replace(m[1], Buffer.from(flipped, 'utf8').toString('base64'));
      await route.fulfill({ response: res, body: html });
    });
  } else {
    await ctx.route('**/js/data.js', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, body: swap(await res.text()) });
    });
  }
}
