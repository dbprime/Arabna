/* ============================================================
   ARABNA — the ready-made profile marks
   ------------------------------------------------------------
   Rai's decision (25 August 2026), and it reverses my own
   recommendation. I argued against ready-made pictures on storage
   grounds — and I was measuring the wrong axis. His design is that the
   pictures live HERE, once, and a reader stores only the id:

     one vector mark        236 bytes
     twelve of them       2,832 bytes  =  0.042% of the single-file build
     what a reader keeps   'p07'       =  three characters

   And a second gain neither of us saw during the discussion, which is
   larger than the first: an UPLOADED photo goes through the admin queue
   (`setAvatar` writes status 'pending'). A ready-made mark is OUR
   picture, so it is never reviewed at all — the choice TAKES WORK OFF
   the admin instead of adding it.

   ⚠️ SVG AND NEVER PNG. The single-file build inlines every image as
   base64, and base64 inflates by a third; a vector drawing stays text
   and goes in as it is.

   ⚠️ AND NOT ONE OF THESE MARKS A PERSON'S IDENTITY. No flag, no
   sect, no country. The app never decides who somebody is — the same
   rule that forbids tagging a mosque with a school. A reader who picks
   a lantern picked it themselves; we did not hand it to them.

   The hues avoid 35–55, the gold band, for the reason CAT_HUE avoids
   it: gold is the colour of the action, and a gold mark reads «tap me».
   ============================================================ */

/** the drawing inside a 64×64 box — ground and mark, both from the hue */
const mark = (h, d) =>
  `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">` +
  `<rect width="64" height="64" rx="32" fill="hsl(${h} 42% 26%)"/>` +
  `<path d="${d}" fill="hsl(${h} 78% 72%)" fill-rule="evenodd"/></svg>`;

/* Twelve, in twelve hues, twelve degrees apart at the closest. */
export const AVATARS = [
  /* p01 — khatam, the app's own eight-point star */
  ['p01', 202, 'M32 12l5.6 9.7 11-2.3-2.3 11 9.7 5.6-9.7 5.6 2.3 11-11-2.3L32 52l-5.6-9.7-11 2.3 2.3-11L8 32l9.7-5.6-2.3-11 11 2.3z'],
  /* p02 — a cup */
  ['p02', 24,  'M16 22h26v14a13 13 0 0 1-26 0zm26 3h4a6 6 0 0 1 0 12h-4zM14 52h32v4H14z'],
  /* p03 — an open book */
  ['p03', 268, 'M10 18c7-3 14-3 20 1v27c-6-4-13-4-20-1zm44 0c-7-3-14-3-20 1v27c6-4 13-4 20-1z'],
  /* p04 — a palm */
  ['p04', 128, 'M30 30h4v24h-4zM32 12c7 0 12 4 13 9-4-3-9-4-13-2-4-2-9-1-13 2 1-5 6-9 13-9zM14 24c5-3 11-2 15 2-5 1-9 3-12 7-2-3-3-6-3-9zm36 0c0 3-1 6-3 9-3-4-7-6-12-7 4-4 10-5 15-2z'],
  /* p05 — a lantern, and the flame is a hole through it */
  ['p05', 334, 'M30 8h4v6h-4zM18 16h28l-5 7H23zM22 25h20v22H22zm5 5h10v12H27zM18 49h28l-5 7H23z'],
  /* p06 — a pen */
  ['p06', 92,  'M44 10l10 10-27 27-13 3 3-13zM12 54h40v4H12z'],
  /* p07 — a boat under sail */
  ['p07', 188, 'M32 8l16 26H32zM28 14v20H16zM8 40h48l-8 12H16z'],
  /* p08 — a house, and the door is a hole */
  ['p08', 304, 'M32 10l24 21h-7v21H15V31H8zm-5 26h10v16H27z'],
  /* p09 — three concentric rings */
  ['p09', 356, 'M32 8a24 24 0 1 0 .01 48A24 24 0 0 0 32 8zm0 6a18 18 0 1 1-.01 36A18 18 0 0 1 32 14zm0 7a11 11 0 1 0 .01 22A11 11 0 0 0 32 21zm0 6a5 5 0 1 1-.01 10A5 5 0 0 1 32 27z'],
  /* p10 — two peaks, and the snow on the taller one is a hole */
  ['p10', 152, 'M24 16l14 20-6 5-4-5-11 16h34L38 28l4-5 14 25H6zm0 8l-4 6h8z'],
  /* p11 — a leaf */
  ['p11', 80,  'M52 10C28 10 14 22 14 38c0 6 2 11 6 15l4-4c-3-3-4-7-4-11 0-12 11-22 32-22-6 12-16 20-28 24l3 5c18-6 25-22 25-35z'],
  /* p12 — a lattice, four squares turned */
  ['p12', 236, 'M32 8l10 10-10 10-10-10zm0 28l10 10-10 10-10-10zM18 22l10 10-10 10L8 32zm28 0l10 10-10 10-10-10z'],
];

/** the svg for one id, or null — never a fallback picture nobody chose */
export function avatarSvg(id) {
  const row = AVATARS.find(a => a[0] === id);
  return row ? mark(row[1], row[2]) : null;
}
export function avatarIds() { return AVATARS.map(a => a[0]); }
