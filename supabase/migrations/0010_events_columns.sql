-- 0010 — إحدى عشرةَ خانةً يملؤها إنسانٌ تجد عمودَها، واليومُ الكاملُ يبقى يوماً كاملاً (649)
--
-- ⚠️ تُنفَّذ بيد مالك البرنامج في محرّر SQL بعد الدمج.
-- ⚠️ ولا `||` ولا `*` في هذا الملفّ — الحقلُ الذي يُلصَق فيه يُسقط الحرفين،
--    مقيسٌ مرّتين. قاعدةُ `0005` بحرفها.
--
-- ============================================================
-- ١) الأعمدةُ الناقصة — قاعدةُ `645` §٨.٤ مكسورةً إحدى عشرةَ مرّة
-- ============================================================
-- «لكلّ خانةٍ في نموذجٍ يملؤها إنسانٌ عمودٌ على الخادم.» والنموذجُ في
-- `js/screens/events.js` يجمع النوعَ والمدينةَ والمنظِّمَ ورابطَ التذاكر
-- والصورةَ و«مثبَّتة» وحقولَ الحفلة الخمسةَ والتكرار — ولا عمودَ لواحدٍ
-- منها. ⚠️ و«مثبَّتة» هي دبّوسُ الـ$99 أسبوعيّاً: خانةٌ تُملأ ولا تصل
-- أحداً ليست نقصاً في الشاشة، هي دخلٌ لا يُسلَّم.
--
-- ⚠️ ولا سياسةَ تُمَسّ: «admin: write» و«organiser: propose» تحكمان الصفَّ
--    كلَّه، وعمودٌ جديدٌ داخل صفٍّ محكومٍ لا يحتاج شيئاً — نصُّ ما قالته
--    هجرةُ `0008`.

alter table public.events add column if not exists type          text;
alter table public.events add column if not exists city          text;
alter table public.events add column if not exists ticket_url    text;
alter table public.events add column if not exists photo         text;
alter table public.events add column if not exists organizer_ar  text;
alter table public.events add column if not exists organizer_en  text;
alter table public.events add column if not exists venue_ar      text;
alter table public.events add column if not exists venue_en      text;
alter table public.events add column if not exists source        text;
alter table public.events add column if not exists external_id   text;
alter table public.events add column if not exists source_url    text;

-- ⚠️ و«مثبَّتة» تُقرأ في ترتيب القارئ الحيّ (`featured desc`)، فلا تُترَك
--    فارغةً تحتمل NULL: صفٌّ بلا قيمةٍ يقع في ذيلٍ أو رأسٍ بحسب المحرّك.
alter table public.events add column if not exists featured      boolean not null default false;

-- ⚠️ وهنا وحدَه يُقبَل `jsonb`: خمسةُ حقولٍ تخصّ نوعاً واحداً من أحدَ عشرَ،
--    وخمسةُ أعمدةٍ فارغةٍ في كلّ صفٍّ غيرِ حفلةٍ أسوأ. ولا يُوسَّع هذا
--    الاستثناءُ إلى غيره.
alter table public.events add column if not exists concert       jsonb;
alter table public.events add column if not exists repeat        jsonb;

-- ============================================================
-- ٢) `all_day` — وأهمُّ عمودٍ في الهجرة
-- ============================================================
-- `642` جعلت الفرقَ بين «17 أكتوبر» و«17 أكتوبر الساعة 11:00» هو وجودُ
-- الساعة في النصّ نفسِه، وعليه بُني شيئان: فعاليّةٌ لم يعلن منظِّمُها ساعةً
-- لا تطبع ساعة، ومهرجانُ يومين ينتهي آخرَ يومه لا أوّلَه.
--
-- ⚠️ وعمودُ `timestamptz` يمحو ذلك الفرقَ ويزيد: `2026-10-17` يدخل فيصير
--    `2026-10-17T00:00:00Z` ويعود ومعه ساعة، فتُطبَع «12:00 ص» — العطلُ
--    الذي أُصلح بالأمس عائداً من باب الخادم. وأسوأُ منه: منتصفُ ليل
--    غرينتش هو في هيوستن مساءُ 16 أكتوبر، فمهرجانُ 17 يُعرَض على أنّه 16.
--    ونصفُ يومٍ خطأً في تاريخ مهرجانٍ ليس عيباً في العرض: هو قارئٌ يقف على
--    الباب في اليوم الخطأ.
--
-- والجوابُ عمودٌ واحدٌ يحمل المعنى، والتاريخُ يُكتَب عند منتصف النهار
-- بتوقيت الدليل لا منتصف الليل: منتصفُ النهار لا يعبر حدَّ يومٍ في أيّ
-- منطقةٍ زمنيّة، ومنتصفُ الليل يعبره دائماً.
alter table public.events add column if not exists all_day       boolean not null default false;
