/* ============================================================
   THE FEAST CALENDAR — computed, never stored
   ------------------------------------------------------------
   Rai asked for «dates for next year». Storing a table would be the
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

/** the estimated start of Ramadan in a given Gregorian year, or null */
export function ramadanStart(y) {
  for (let n = -40; n <= 40; n++) {
    const d = new Date(RAMADAN_ANCHOR + Math.round(n * HIJRI_YEAR) * day);
    if (d.getUTCFullYear() === y) return d;
  }
  return null;
}

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
export function feastsBetween(from, to) {
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
    // …and the ones nobody can promise
    const r = ramadanStart(y);
    if (r) {
      out.push({ id: 'ramadan', at: r, tradition: 'islam', estimated: true, principal: true });
      out.push({ id: 'eidFitr', at: shift(r, 30), tradition: 'islam', estimated: true, principal: true });
      out.push({ id: 'eidAdha', at: shift(r, 99), tradition: 'islam', estimated: true, principal: true });
    }
  }
  const a = new Date(from).getTime(), b = new Date(to).getTime();
  return out.filter(f => f.at.getTime() >= a && f.at.getTime() <= b)
            .sort((x, z) => x.at - z.at);
}

/**
 * The next `n` from today. `principalOnly` is the default because that is
 * what the block shows — see MOVABLE above.
 */
export function upcomingFeasts(n = 6, now = Date.now(), principalOnly = true) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const all = feastsBetween(start, new Date(start.getTime() + 400 * day));
  return (principalOnly ? all.filter(f => f.principal) : all).slice(0, n);
}
