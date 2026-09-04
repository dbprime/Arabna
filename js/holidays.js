/* ============================================================
   العطل التي قد يتأثّر بها دوام محلّ — محسوبة، لا محفوظة أبداً،
   تماماً كـ feasts.js المجاور.
   ------------------------------------------------------------
   أربعةٌ حسابٌ مدنيّ بحت (قواعد عطلٍ فدراليّة لا يُعلنها أحد، فلا شيء
   هنا «تقديري» أبداً): رأس السنة و4 يوليو تاريخان ثابتان، عيد العمّال
   أوّل اثنين من سبتمبر، وعيد الشكر الخميس الرابع من نوفمبر. الثلاثة
   الأخرى — الكريسماس وعيد الفطر وعيد الأضحى — هي نفس التواريخ الثلاثة
   التي يحسبها feasts.js أصلاً لصفحتَي #/mass و#/prayer؛ هذا الملفّ
   يطلبها من feasts.js بدل أن يُعيد اشتقاقها، فتاريخ رمضان أو العيد
   المكتوب (S.ramadanDates()) يحرّك تقويم الأعمال تماماً كما يحرّك
   تقويم العبادة، ولا يمكن أن يختلفا.

   الكريسماس الغربيّ وحده: القبطيّ (7 يناير) ليس يوم عطلةٍ لمحلٍّ
   أمريكيّ عاديّ، وطباعة الاثنين معاً تحت قائمةٍ مدنيّة تجعل الملفّ
   يخمّن أيّة طائفةٍ ينتمي إليها محلّ صاحب النشاط — عكس قاعدة feasts.js
   التأسيسيّة نفسها.
   ============================================================ */
import { feastsBetween } from './feasts.js';

const DAY = 86400000;

/** أوّل اثنين من سبتمبر، y */
function laborDay(y) {
  const d = new Date(Date.UTC(y, 8, 1));
  const dow = d.getUTCDay();               // 0=أحد..6=سبت
  const add = (8 - dow) % 7;                // أيّامٌ حتى أوّل اثنين
  return new Date(d.getTime() + add * DAY);
}

/** الخميس الرابع من نوفمبر، y */
function thanksgiving(y) {
  const d = new Date(Date.UTC(y, 10, 1));
  const dow = d.getUTCDay();
  const firstThu = (4 - dow + 7) % 7;        // 4 = خميس
  return new Date(d.getTime() + (firstThu + 21) * DAY);
}

/** مفتاح ي18ن لاسم كلّ عطلة — الثلاثة المشتركة مع feasts.js تُعيد
    استخدام feastChristmas/feastEidFitr/feastEidAdha بدل تكرار اسمٍ
    يحمله التقويم أصلاً. */
export const HOLIDAY_LABEL_KEY = {
  newYear: 'holidayNewYear', july4: 'holidayJuly4',
  laborDay: 'holidayLaborDay', thanksgiving: 'holidayThanksgiving',
  christmas: 'feastChristmas', eidFitr: 'feastEidFitr', eidAdha: 'feastEidAdha',
};

/** قائمة الاختيار الكاملة، بالترتيب الذي يراها صاحب النشاط */
export const HOLIDAY_IDS = ['newYear', 'july4', 'laborDay', 'thanksgiving', 'christmas', 'eidFitr', 'eidAdha'];

/**
 * كلّ عطلةٍ يوافق يومها التقويميّ (UTC) يوم `date` — سطرٌ واحد لكلّ
 * مناسبةٍ مدنيّة أو دينيّة، بنفس اصطلاح «اليوم» في calendarNow (منتصف
 * ليلٍ بتوقيت UTC)، لنتّفق مع ما يعرضه #/prayer و#/mass عن «اليوم».
 * `estimated` لا تصير true إلّا لعيد الفطر أو الأضحى بلا تاريخٍ مكتوب —
 * انظر ملاحظة feasts.js نفسها عن تاريخٍ دينيّ يُقال بثقةٍ ثمّ يخيب.
 * @returns [{id, estimated}]
 */
export function holidaysOn(date, ramadanDates) {
  const t0 = new Date(date); t0.setUTCHours(0, 0, 0, 0);
  const y = t0.getUTCFullYear();
  const same = (d) => d.getTime() === t0.getTime();
  const out = [];
  if (same(new Date(Date.UTC(y, 0, 1)))) out.push({ id: 'newYear', estimated: false });
  if (same(new Date(Date.UTC(y, 6, 4)))) out.push({ id: 'july4', estimated: false });
  if (same(laborDay(y))) out.push({ id: 'laborDay', estimated: false });
  if (same(thanksgiving(y))) out.push({ id: 'thanksgiving', estimated: false });
  // الثلاثة المشتركة مع feasts.js: نوسّع النافذة يوماً قبل t0 ويوماً
  // بعده كي تُقرأ من feastsBetween مهما كانت حلقة السنة التي تمشيها
  const shared = feastsBetween(new Date(t0.getTime() - DAY), new Date(t0.getTime() + DAY), ramadanDates)
    .filter(f => (f.id === 'christmas' && f.tradition === 'west') || f.id === 'eidFitr' || f.id === 'eidAdha');
  for (const f of shared) {
    const ft = new Date(f.at); ft.setUTCHours(0, 0, 0, 0);
    if (same(ft)) out.push({ id: f.id, estimated: f.estimated });
  }
  return out;
}
