/* ============================================================
   ARABNA — مواقيت الصلاة / prayer times
   ------------------------------------------------------------
   THE ONE RULE: this is computed here, in the app, and asks
   nothing of anybody.

   No API and no library, for three reasons that all matter more
   than the convenience of a request:
     · it works with no internet — and somebody opening the app
       to know when maghrib is may well be standing outside with
       no signal
     · it is instant, with nothing to wait for
     · it does not stop working the day a website goes down or
       changes its terms

   And it suits the project: zero dependencies has been the rule
   since the first day, and a table of angles is not a reason to
   break it.

   WHAT IS COMPUTED AND WHAT IS NOT
   The five times and sunrise are astronomy: a latitude, a
   longitude and a date, and the answer is the answer. The
   IQAMA and the JUMU'AH are not — they are each mosque's own
   decision, and no amount of arithmetic will produce them. They
   live on the listing, entered by the mosque, and where they are
   missing the app says so instead of inventing one.
   ============================================================ */

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const asin = (x) => Math.asin(x) / DEG;
const acos = (x) => Math.acos(x) / DEG;
const atan = (x) => Math.atan(x) / DEG;
const atan2 = (y, x) => Math.atan2(y, x) / DEG;
const acot = (x) => atan2(1, x);
const fix = (a, n) => { a -= n * Math.floor(a / n); return a < 0 ? a + n : a; };

/**
 * The four methods people in Houston actually follow.
 *
 * This is not a technical detail. There is a large Iraqi and Lebanese
 * Shia community here and their times genuinely differ — maghrib is some
 * minutes after sunset, not at it. An app that hands them one set of
 * times that is not theirs is telling them it is not for them.
 *
 * The names are METHOD names, never sect names. That is what every
 * prayer app does, whoever wants the Jafari method finds it at once, and
 * the app never has to stand in a queue it has no business standing in.
 */
export const METHODS = {
  isna:    { key: 'isna',    fajr: 15,   isha: 15,   maghrib: 0 },
  mwl:     { key: 'mwl',     fajr: 18,   isha: 17,   maghrib: 0 },
  makkah:  { key: 'makkah',  fajr: 18.5, ishaMins: 90, maghrib: 0 },
  jafari:  { key: 'jafari',  fajr: 16,   isha: 14,   maghrib: 4 },
};
export const DEFAULT_METHOD = 'isna';

/** the shadow multiple that defines asr: 1 is the majority, 2 is Hanafi */
export const ASR_STANDARD = 1;
export const ASR_HANAFI = 2;

/** which times are grouped when a method prays them together */
export const GROUPED = { jafari: [['dhuhr', 'asr'], ['maghrib', 'isha']] };

export const PRAYER_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
/** sunrise is not a prayer — it is the end of fajr, and what a fasting
    person is really asking about. It is printed among them, greyed. */
export const IS_PRAYER = { fajr: 1, dhuhr: 1, asr: 1, maghrib: 1, isha: 1 };

/** days since 2000-01-01 12:00 UT, from a calendar date */
function julianDay(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524.5;
}

/**
 * The sun's declination and the equation of time for a Julian day.
 * The low-precision solar position from the Astronomical Almanac: good
 * to well under a minute of prayer time, which is far tighter than the
 * minute we print.
 */
function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);      // mean anomaly
  const q = fix(280.459 + 0.98564736 * D, 360);      // mean longitude
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);  // apparent longitude
  const e = 23.439 - 0.00000036 * D;                 // obliquity
  const dec = asin(sin(e) * sin(L));                 // declination
  const RA = fix(atan2(cos(e) * sin(L), cos(L)) / 15, 24);      // right ascension, hours
  const eqt = q / 15 - RA;                           // equation of time, hours
  return { dec, eqt: fix(eqt + 12, 24) - 12 };
}

/**
 * The hour angle for a sun `angle` degrees below the horizon, in hours.
 * Returns null when there is no such moment — which is the honest answer
 * at high latitude in summer, and the app writes «—» rather than a
 * number nobody could pray by.
 */
function hourAngle(angle, lat, dec) {
  const x = (-sin(angle) - sin(lat) * sin(dec)) / (cos(lat) * cos(dec));
  if (!isFinite(x) || x > 1 || x < -1) return null;
  return acos(x) / 15;
}

/** the hour angle of asr, where the shadow is `shadow` times the object */
function asrAngle(shadow, lat, dec) {
  return -acot(shadow + tan(Math.abs(lat - dec)));
}

/**
 * The six times, in minutes from local midnight.
 *
 * `tzOffsetMinutes` comes from the device — `-new Date().getTimezoneOffset()`
 * — which is why there is no timezone database anywhere in this project:
 * the phone already knows, and it already knows about daylight saving.
 *
 * Any time that cannot exist comes back null, never a guess.
 */
export function prayerTimes({ lat, lng, date = new Date(), tzOffsetMinutes,
                              method = DEFAULT_METHOD, asrShadow = ASR_STANDARD } = {}) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const tz = (isFinite(tzOffsetMinutes) ? tzOffsetMinutes : -date.getTimezoneOffset()) / 60;
  const m = METHODS[method] || METHODS[DEFAULT_METHOD];

  const jd = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);
  const { dec, eqt } = sunPosition(jd);

  const dhuhr = 12 - eqt - lng / 15 + tz;            // solar noon, local clock hours
  const h = (angle) => hourAngle(angle, lat, dec);
  const before = (angle) => { const x = h(angle); return x === null ? null : dhuhr - x; };
  const after = (angle) => { const x = h(angle); return x === null ? null : dhuhr + x; };

  const SUN = 0.833;                                 // refraction + the disc's own radius
  const sunset = after(SUN);
  const maghrib = m.maghrib ? after(m.maghrib) : sunset;
  const isha = m.ishaMins != null
    ? (maghrib === null ? null : maghrib + m.ishaMins / 60)
    : after(m.isha);

  const out = {
    fajr: before(m.fajr),
    sunrise: before(SUN),
    dhuhr,
    asr: after(asrAngle(asrShadow, lat, dec)),
    maghrib,
    isha,
  };
  for (const k of PRAYER_KEYS) out[k] = out[k] === null ? null : Math.round(fix(out[k], 24) * 60);
  return out;
}

/** «7:52» / «19:52» from minutes past midnight, in the reader's own digits */
export function fmtPrayer(mins, lang = 'ar') {
  if (mins === null || mins === undefined) return '—';
  const d = new Date(2000, 0, 1, 0, Math.round(mins));
  return d.toLocaleTimeString(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US',
    { hour: 'numeric', minute: '2-digit' });
}

/**
 * Which prayer is next, and how many minutes away.
 *
 * After isha the next one is tomorrow's fajr, so the countdown wraps
 * rather than going blank for five hours of the night — which is exactly
 * when somebody is most likely to be looking at it.
 */
export function nextPrayer(times, nowMins) {
  if (!times) return null;
  for (const k of PRAYER_KEYS) {
    if (!IS_PRAYER[k]) continue;
    const v = times[k];
    if (v !== null && v > nowMins) return { key: k, at: v, in: v - nowMins };
  }
  const f = times.fajr;
  return f === null ? null : { key: 'fajr', at: f, in: 24 * 60 - nowMins + f, tomorrow: true };
}

/** minutes from local midnight, right now */
export function minutesNow(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}
