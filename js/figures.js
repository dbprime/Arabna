/* ======================= FIGURES =======================
   A CLOSED REGISTRY, drawn in code, exactly as `js/icons.js` is.

   ⚠️ A FIGURE IS NEVER WRITTEN IN THE DATA. The data carries a KEY and
   nothing else, and an unknown key draws nothing. Were an `svg` string a
   field, it would be markup rendered without escaping — a hole we would
   have opened with our own hands in a table the admin writes into from
   the panel two files from now. `FIGURES[key]` and `P[name] || P.info`
   are the same lock.

   TWO RULES, and both are measured rather than preferred:

   1) NO NEW COLOUR. Only tokens already in the layer — `--gold-bright`,
      `--gold`, `--surface-2`, `--text-2`, `--muted`, `--line` — so one
      drawing works in both themes with no second copy. Every one of them
      is written as `style="fill:var(--…)"` and never as a presentation
      attribute: `var()` inside `fill="…"` is not carried by every engine,
      and a colour that silently resolves to black is a figure nobody can
      read.

   2) NO TEXT INSIDE THE SVG. Every word comes from `t()`, or an Arabic
      figure is served to an English reader.

   ⚠️ And every `<text>` carries an explicit `direction`: without it a
   Latin run inside an Arabic sentence («Jay Stores — the first Indian
   shop») reorders. A pure number is forced `ltr` in both languages —
   the digits stay Western, as they are in the articles' own prose.

   ⚠️ And `text-anchor` is derived FROM THE DIRECTION EACH TEXT EMITS,
   never from the interface language, because `start` and `end` are the
   ends of the inline direction and not of the screen: with `direction:rtl`
   the START of the text is its RIGHT edge. So a number forced `ltr` takes
   the LTR anchors while the Arabic label beside it takes the RTL ones.
   `txt()` takes an `edge` — which side of the point the text occupies —
   and works the anchor out from there.

   The geometry does not mirror with the interface. SVG coordinates are
   not touched by `dir`, so one drawing serves both languages — and the
   axis stays where the Arabic reading starts, on the right.
   ======================================================= */
import { t } from './i18n.js';

const dirAttr = () => (document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr');

/** a word from the pack — never a string written here.

    `edge` says which SIDE OF THE POINT the text is to occupy, which is
    what a layout actually means.

    ⚠️ AND THE ANCHOR IS DERIVED FROM THE DIRECTION THIS TEXT REALLY
    EMITS, never from the interface language. `start` and `end` are the
    ends of the inline direction, so a number forced to `ltr` inside an
    Arabic interface takes the LTR anchors while the label beside it takes
    the RTL ones. Measured: deriving it from the language put the year
    column across its own axis and pushed a value off the right-hand edge
    of the drawing, in Arabic only. */
function txt(x, y, key, opts) {
  const o = opts || {};
  const num  = o.num != null;
  const body = num ? o.num : (o.raw != null ? o.raw : t(key));
  const dir  = num ? 'ltr' : dirAttr();
  const edge = o.edge || 'right';
  const anchor = dir === 'rtl'
    ? (edge === 'right' ? 'start' : 'end')
    : (edge === 'right' ? 'end'   : 'start');
  const size   = o.size || 11.5;
  const weight = o.weight || 400;
  const fill   = o.fill || '--text-2';
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" direction="${dir}"`
       + ` font-size="${size}" font-weight="${weight}"`
       + ` style="fill:var(${fill})">${body}</text>`;
}

/* ---------------------------------------------------------------
   1) hillcroftTimeline

   Eight rows on one axis, and the whole article is the GAP: four years
   in which the street was Arab and nobody else's. It is a band across
   the drawing rather than a note beside it, and the 1982 row sits INSIDE
   the band because the oil crash happened in the gap and is its cause.
   A reader understands it in a second, before reading a line.
   --------------------------------------------------------------- */
function hillcroftTimeline() {
  const AX = 316, YR = 330, NM = 300;
  const row = (y, year, key, dot) =>
      `${dot}${txt(YR, y + 4, null, { num: year, edge: 'left', size: 11, weight: 700 })}`
    + `${txt(NM, y + 4, key)}`;
  const plain  = y => `<circle cx="${AX}" cy="${y}" r="4" style="fill:var(--surface-2);stroke:var(--line)" stroke-width="1.5"/>`;
  const hollow = y => `<circle cx="${AX}" cy="${y}" r="5" style="fill:var(--surface-2);stroke:var(--text-2)" stroke-width="2"/>`;
  const first  = y => `<circle cx="${AX}" cy="${y}" r="6.5" style="fill:var(--gold-bright)"/>`;
  const named  = y => `<circle cx="${AX}" cy="${y}" r="6" style="fill:var(--gold)"/>`;

  return `<svg viewBox="0 0 396 346" role="img" aria-label="${t('figHcGap')}">
    <line x1="${AX}" y1="18" x2="${AX}" y2="330" style="stroke:var(--line)" stroke-width="1.5"/>
    <rect x="4" y="84" width="388" height="76" rx="8"
          style="fill:var(--surface-2);stroke:var(--line)" stroke-width="1"/>
    <line x1="${AX}" y1="66" x2="${AX}" y2="180" style="stroke:var(--gold-bright)" stroke-width="5" stroke-linecap="round"/>
    ${txt(NM, 108, 'figHcGap', { size: 11.5, weight: 700, fill: '--gold-bright' })}
    ${row(30,  '1955', 'figHcOpen',    plain(30))}
    ${row(66,  '1979', 'figHcDroubi',  first(66))}
    ${row(132, '1982', 'figHcOil',     plain(132))}
    ${row(180, '1983', 'figHcJay',     hollow(180))}
    ${row(214, '1984', 'figHcKarat',   plain(214))}
    ${row(248, '2002', 'figHc2002',    plain(248))}
    ${row(282, '2010', 'figHcGandhi',  named(282))}
    ${row(316, '2022', 'figHcAnaheim', plain(316))}
  </svg>`;
}

/* ---------------------------------------------------------------
   2) houstonHousing and 3) houstonUncounted

   One shape, two messages. The bars grow from the right because that is
   where the Arabic reading starts, and the label stands ABOVE its bar
   rather than beside it: beside it, the longest Arabic label would eat
   the track and the two bars would no longer be comparable.
   --------------------------------------------------------------- */
function bars(titleKey, rows) {
  const END = 366;
  const body = rows.map((r, i) => {
    const top  = 52 + i * 60;
    const x    = END - r.w;
    return `${txt(END, top - 8, r.key)}`
         + `<rect x="${x}" y="${top}" width="${r.w}" height="24" rx="4"`
         + ` style="fill:var(${r.fill})${r.stroke ? ';stroke:var(' + r.stroke + ')' : ''}"`
         + `${r.stroke ? ' stroke-width="1"' : ''}/>`
         + `${txt(x - 8, top + 17, null, r.mixed
              ? { raw: r.value, size: 12, weight: 700, fill: r.valueFill || '--text-2' }
              : { num: r.value, size: 12, weight: 700, fill: r.valueFill || '--text-2' })}`;
  }).join('');
  return `<svg viewBox="0 0 372 154" role="img" aria-label="${t(titleKey)}">
    ${txt(END, 16, titleKey, { size: 12, fill: '--muted' })}
    ${body}
  </svg>`;
}

function houstonHousing() {
  return bars('figHoTitle', [
    { key: 'figHoBig', w: 260, fill: '--surface-2', stroke: '--line', value: '100' },
    /* ⚠️ `mixed`: this one carries words as well as digits, so it takes the
       interface's own direction. The other three are digits alone and are
       forced `ltr` in both languages — the digits stay Western, as they
       are in the articles' own prose. */
    { key: 'figHoHou', w: 124, fill: '--gold-bright', mixed: true,
      value: '47.6 — ' + t('figHoCheaper'), valueFill: '--gold-bright' },
  ]);
}

function houstonUncounted() {
  /* ⚠️ 5.2 user units, and it is 260 × 4014 ÷ 200000 — not a number
     chosen to look small. The difference nobody believes written down is
     seen drawn. It is filled with `--text-2` rather than `--surface-2`,
     because a sliver that thin in a surface tint reads as nothing at all,
     and «invisible» is a fault even when the point is that it is tiny. */
  return bars('figUnTitle', [
    { key: 'figUnCensus', w: 5.2, fill: '--text-2', value: '4,014' },
    { key: 'figUnEst',    w: 260, fill: '--gold-bright',
      value: '~200,000', valueFill: '--gold-bright' },
  ]);
}

export const FIGURES = {
  hillcroftTimeline,
  houstonHousing,
  houstonUncounted,
};
