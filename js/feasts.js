/* ============================================================
   THE FEAST CALENDAR — computed, never stored
   ------------------------------------------------------------
   The owner asked for «dates for next year». Storing a table would be the
   worse answer: it goes stale, it has to be maintained by hand, and it
   is wrong the first year nobody remembers to extend it. Easter is
   arithmetic — exactly as the prayer times are arithmetic — so this file
   computes it, imports nothing, and works with no signal at all.

   TWO EASTERS, AND BOTH ARE NAMED. Half the churches in the directory
   are Coptic and a third are evangelical, in near-equal numbers, so
   choosing one date would be choosing a congregation. In 2027 the two
   fall **thirty-five days apart**: an app printing a single date that
   year is wrong for half the people reading it.

     2026  Apr 5  / Apr 12   7 days
     2027  Mar 28 / May 2    35 days
     2028  Apr 16 / Apr 16   the same day
     2029  Apr 1  / Apr 8    7 days
     2030  Apr 21 / Apr 28   7 days

   AND WHAT IS CERTAIN IS SEPARATED FROM WHAT IS NOT. Christmas and
   Easter are pure mathematics. The Hijri dates depend on sighting the
   crescent and differ between authorities, so every one of them carries
   «تقديري» and a line saying the announcement comes from the local
   Islamic centres. A religious date said with confidence and then found
   wrong hurts far more than one we never claimed.
   ============================================================ */

/** Gregorian (Western) Easter — the anonymous Gregorian algorithm */
export function easterWestern(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31);
  const da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, mo - 1, da));
}

/** Julian (Eastern) Easter, converted forward — the 13-day offset holds to 2100 */
export function easterEastern(y) {
  const a = y % 4, b = y % 7, c = y % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const mo = Math.floor((d + e + 114) / 31);
  const da = ((d + e + 114) % 31) + 1;
  const j = new Date(Date.UTC(y, mo - 1, da));
  return new Date(j.getTime() + 13 * 86400000);
}

const day = 86400000;
const shift = (d, n) => new Date(d.getTime() + n * day);

/* Everything movable is the same subtraction from Easter in both
   traditions, so it is derived rather than tabulated. */
/* `principal` is what the calendar block shows. The others are computed
   all the same — the arithmetic is free and they are real feasts — but a
   six-row list would otherwise fill with Holy Week and push BOTH Easters
   off the bottom, and the two Easters are the reason this block exists. */
const MOVABLE = [
  { id: 'palm',      off: -7,  principal: false },
  { id: 'goodFri',   off: -2,  principal: false },
  { id: 'easter',    off: 0,   principal: true },
  { id: 'ascension', off: 39,  principal: false },
  { id: 'pentecost', off: 49,  principal: false },
];

/**
 * The reference point for the Hijri estimate: 1 Ramadan 1447 fell on
 * 18 February 2026. Every other Ramadan is stepped from it by the mean
 * Hijri year, which is why the result is an ESTIMATE and says so — the
 * real date is announced when the crescent is seen.
 */
const RAMADAN_ANCHOR = Date.UTC(2026, 1, 18);
const HIJRI_YEAR = 354.367;
const ANCHOR_HY = 1447;          // …and that anchor is 1 Ramadan 1447

/**
 * Ramadan in a Gregorian year, WITH the Hijri year number, because the
 * new year row needs it and nothing else can supply it.
 */
export function ramadanOf(y) {
  for (let n = -40; n <= 40; n++) {
    const d = new Date(RAMADAN_ANCHOR + Math.round(n * HIJRI_YEAR) * day);
    if (d.getUTCFullYear() === y) return { at: d, hy: ANCHOR_HY + n };
  }
  return null;
}
/** the estimated start of Ramadan in a given Gregorian year, or null */
export function ramadanStart(y) { const r = ramadanOf(y); return r ? r.at : null; }

/* The Islamic year holds seven occasions and the file carried three, so
   the nearest one the app knew about was Ramadan — five and a half months
   out — while the Prophet's birthday was two days away and simply absent.
   All six are stepped from the same anchor by the known lunar month
   lengths (Ramadan 30 · Shawwal 29 · Dhu al-Qi'dah 30 · Dhu al-Hijjah 29 ·
   Muharram 30 · Safar 29), so there is still no table, no storage and no
   network — the principle at the head of this file, followed literally.

   `hy` on the new year is `+1`: the Muharram that follows Ramadan 1447
   opens 1448. It is the YEAR THAT BEGINS, not the one that ends. */
const HIJRI_FROM_RAMADAN = [
  { id: 'ramadan',      off: 0   },
  { id: 'eidFitr',      off: 30  },
  { id: 'eidAdha',      off: 99  },
  { id: 'hijriNewYear', off: 118, newYear: true },
  { id: 'ashura',       off: 127 },
  { id: 'mawlid',       off: 188 },
];

/**
 * Every feast that falls inside a window, ordered BY DATE and not by
 * religion. One list everybody reads — two lists side by side would
 * separate people on the screen, which is the opposite of the point.
 *
 * @returns [{ id, at, tradition, estimated }]
 *          `id` is an i18n key suffix; `tradition` is 'west' | 'east' |
 *          'copt' | 'islam' | '' and only exists so the label can name
 *          which Easter or which Christmas is meant.
 */
/** 'YYYY-MM-DD' → a UTC Date, or null if it is not a real date */
function parseDay(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((v || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return isNaN(d.getTime()) ? null : d;
}

export function feastsBetween(from, to, dates) {
  const out = [];
  const y0 = new Date(from).getUTCFullYear();
  const y1 = new Date(to).getUTCFullYear();
  for (let y = y0 - 1; y <= y1 + 1; y++) {
    const w = easterWestern(y), e = easterEastern(y);
    /* When the two coincide — 2028, 2031, 2034 — one line is printed and
       it carries NO tradition. «الفصح (غربي)» standing alone in a year
       when both fall together would read to an Orthodox family as though
       their date had been left out. */
    const together = e.getTime() === w.getTime();
    for (const m of MOVABLE) {
      out.push({ id: m.id, at: shift(w, m.off), tradition: together ? '' : 'west',
                 estimated: false, principal: m.principal });
      if (!together) {
        out.push({ id: m.id, at: shift(e, m.off), tradition: 'east', estimated: false, principal: m.principal });
      }
    }
    // fixed, and there are two of them
    out.push({ id: 'christmas', at: new Date(Date.UTC(y, 11, 25)), tradition: 'west', estimated: false, principal: true });
    out.push({ id: 'christmas', at: new Date(Date.UTC(y, 0, 7)), tradition: 'copt', estimated: false, principal: true });
    /* …and the ones nobody can promise — unless a person has announced
       them. THE HAND BEATS THE ARITHMETIC AND THE ARITHMETIC FILLS THE
       GAP: a written date is printed as fact and «تقديري» is dropped from
       it; with nothing written the computation stands and says so.
       `dates` is passed IN rather than read from anywhere, so this file
       still imports nothing and still needs no network — the same reason
       `synonyms.js` is handed `normalize` instead of importing it. */
    const fromDate = parseDay(dates && dates.from);
    const eidDate = parseDay(dates && dates.eid);
    const useFrom = fromDate && fromDate.getUTCFullYear() === y ? fromDate : null;
    const useEid = eidDate && eidDate.getUTCFullYear() === y ? eidDate : null;
    const ram = ramadanOf(y);
    const r = useFrom || (ram && ram.at);
    if (r) {
      for (const h of HIJRI_FROM_RAMADAN) {
        /* Eid al-Fitr is thirty days on from whichever start we are using,
           so writing only the start still moves it — but a written Eid
           wins over that in turn, because Ramadan runs 29 days as often as
           30 and only the announcement knows which. Nothing else here is
           written by hand, so nothing else stops being an estimate. */
        const written = h.id === 'ramadan' ? useFrom : h.id === 'eidFitr' ? useEid : null;
        const row = { id: h.id, at: written || shift(r, h.off), tradition: 'islam',
                      estimated: !written, principal: true };
        if (h.newYear) row.hy = (ram ? ram.hy : ANCHOR_HY) + 1;
        out.push(row);
      }
    }
  }
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  return out.filter(f => f.at.getTime() >= a && f.at.getTime() <= b)
            .sort((x, z) => x.at - z.at);
}

/**
 * WHAT A SCREEN MAY SHOW RIGHT NOW — and it is two rules, not one.
 *
 * 1. The window opens a week EARLY, so an occasion does not vanish the
 *    morning after. Somebody opening the app the day after Eid should
 *    find it, and a row whose date has gone carries «مضت» instead of
 *    «تقديري» — without that word a past date under «المناسبات القادمة»
 *    reads as our mistake rather than as a feast that has been.
 *
 * 2. ONE ROW PER OCCASION. The list is ordered by date, so keeping the
 *    first appearance of each keeps the near one and drops next year's;
 *    the following year takes its place by itself once this one's window
 *    closes. Without this the Prophet's birthday appears twice in the
 *    same list — once in two days and once in a year.
 *
 * And the key is `id` PLUS tradition, never `id` alone: Western Christmas
 * would swallow the Coptic one and Western Easter the Eastern, which
 * would erase half the churches in the directory from the calendar —
 * worse than the fault being fixed. The grace period is the same for
 * everybody; no side's occasion lingers longer than another's.
 */
const GRACE_DAYS = 7;

export function calendarNow(now = Date.now(), dates) {
  const t0 = new Date(now); t0.setUTCHours(0, 0, 0, 0);
  const rows = feastsBetween(shift(t0, -GRACE_DAYS), shift(t0, 400), dates)
    .filter(f => f.principal);
  const seen = new Set();
  return rows.filter(f => {
    const k = f.id + '|' + (f.tradition || '');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).map(f => Object.assign({}, f, { passed: f.at.getTime() < t0.getTime() }));
}

/**
 * The next `n` from today. `principalOnly` is the default because that is
 * what the block shows — see MOVABLE above.
 */
export function upcomingFeasts(n = 6, now = Date.now(), principalOnly = true, dates) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const all = feastsBetween(start, new Date(start.getTime() + 400 * day), dates);
  return (principalOnly ? all.filter(f => f.principal) : all).slice(0, n);
}
