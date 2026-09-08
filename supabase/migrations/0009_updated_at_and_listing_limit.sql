-- 0009 — «آخر تحديث» يتحرّك، والحدُّ يُحرَس على الخادم (648)
--
-- ⚠️ تُنفَّذ بيد مالك البرنامج في محرّر SQL بعد الدمج.
-- ⚠️ ولا `||` ولا `*` في هذا الملفّ: الحقلُ الذي يُلصَق فيه يُسقِط
--    الحرفين — مقيسٌ مرّتين — فـ`concat()` بدل `||` و`count(1)` بدل
--    `count(*)`. قاعدةُ `0005` بحرفها.
--
-- ============================================================
-- ١) `updated_at`: سبعةَ عشرَ عموداً، ولا كاتبَ لواحدٍ منها
-- ============================================================
-- مقيسٌ قبل هذا الملفّ: العمودُ موجودٌ في الجداول السبعةَ عشرَ كلِّها،
-- والمُشغِّلاتُ صفر، ومواضعُه في `js/` صفر. فهو يحمل `now()` الافتراضيّةَ
-- لحظةَ الإنشاء ولا يتحرّك بعدها أبداً — عمودٌ يسمّي نفسَه «آخر تحديث»
-- ولا يقول إلّا «وقت الإنشاء».
--
-- ⚠️ ولا `security definer` هنا: الدالّةُ لا تقرأ ولا تكتب خارج الصفّ
--    الذي بين يديها، وصلاحيّةٌ لا يحتاجها البناءُ لا تُمنَح.
-- ⚠️ ولا يُكتَب العمودُ من العميل أبداً: ساعةُ الجهاز يملكها صاحبُه،
--    وفي البرنامج `clockOffset` تزيحها عمداً لاختبار اللوحة. الخادمُ
--    وحدَه يعرف متى.

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ⚠️ وعلى الجداول السبعةَ عشرَ كلِّها لا على الثلاثة الحيّة: الأربعةَ عشرَ
--    الباقية تحيا في دفعاتٍ لاحقة، ومُشغِّلٌ يُضاف بعد امتلاء الجدول يترك
--    صفوفَه الأولى بلا تاريخ.

drop trigger if exists set_updated_at on public.profiles;
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.businesses;
create trigger set_updated_at before update on public.businesses
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.classifieds;
create trigger set_updated_at before update on public.classifieds
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.reviews;
create trigger set_updated_at before update on public.reviews
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.review_replies;
create trigger set_updated_at before update on public.review_replies
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.messages;
create trigger set_updated_at before update on public.messages
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.claims;
create trigger set_updated_at before update on public.claims
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.biz_photos;
create trigger set_updated_at before update on public.biz_photos
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.biz_verify;
create trigger set_updated_at before update on public.biz_verify
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.offers;
create trigger set_updated_at before update on public.offers
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.flags;
create trigger set_updated_at before update on public.flags
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.events;
create trigger set_updated_at before update on public.events
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.articles;
create trigger set_updated_at before update on public.articles
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.greetings;
create trigger set_updated_at before update on public.greetings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.settings;
create trigger set_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.admin_log;
create trigger set_updated_at before update on public.admin_log
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at on public.receipts;
create trigger set_updated_at before update on public.receipts
  for each row execute function public.set_updated_at();

-- ============================================================
-- ٢) حدُّ الإعلانات محروسٌ على الخادم
-- ============================================================
-- مقيسٌ قبل هذا الملفّ: الحدُّ في `js/store.js` وحدَه، و`state.myListings`
-- قائمةُ هذا الجهاز. فحسابٌ واحدٌ من جهازين ينشر بلا حدّ: كلُّ جهازٍ يعدّ
-- ما يعرفه هو، ولا أحدَ يعدّ المجموع. والحدُّ ليس زينةً — هو ما يمنع
-- السوقَ من أن يمتلئ بحسابٍ واحد، وهو أيضاً ما يُشترى بالاشتراك.
--
-- ⚠️ والصفوفُ تُزرَع هنا لا في دفعةٍ لاحقة: مُشغِّلٌ يقرأ صفّاً لا يكتبه
--    أحدٌ أبداً يعمل على افتراضه إلى الأبد.

insert into public.settings (key, value) values
  ('listingLimit.default',  '4'::jsonb),
  ('listingLimit.handyman', '1'::jsonb)
on conflict (key) do nothing;

-- ⚠️ والافتراضُ مكتوبٌ في الدالّة عن قصد، ويجب أن يساوي الصفَّ المزروع
--    أعلاه — سنّةٌ تقارن الاثنين. مُشغِّلٌ يرفض لأنّ إعداداً لم يصل
--    يُغلِق النشرَ على الجميع، وذلك أسوأ من حدٍّ لا يُحرَس.

create or replace function public.classifieds_limit() returns trigger
language plpgsql as $$
declare
  fallback int := 4;              -- يساوي listingLimit.default المزروع
  lim      int;
  base     int;
  n        int;
begin
  if new.owner_id is null then return new; end if;

  -- الحدُّ يُقرأ لكلّ تصنيفٍ على حدة، والافتراضُ لِما لا حدَّ خاصّاً له
  select nullif(value #>> '{}', '')::int into lim
    from public.settings where key = concat('listingLimit.', new.cat);
  select nullif(value #>> '{}', '')::int into base
    from public.settings where key = 'listingLimit.default';
  base := coalesce(base, fallback);
  lim  := coalesce(lim, base);

  -- الحيُّ وغيرُ المخفيّ: المخفيُّ يفتح مكانَه، وهي القاعدةُ القائمة
  select count(1) into n from public.classifieds
   where owner_id = new.owner_id
     and cat = new.cat
     and hidden = false
     and status in ('live', 'pending');
  if n >= lim then
    raise exception 'ARABNA_LISTING_LIMIT' using errcode = 'P0001';
  end if;

  -- وحدُّ الحساب كلِّه، ويُطبَّق على التصنيفات التي لا حدَّ خاصّاً لها
  -- وحدَها — مطابقٌ لشرط العميل حرفاً: `handyman` أضيقُ أصلاً
  if lim = base then
    select count(1) into n from public.classifieds
     where owner_id = new.owner_id
       and hidden = false
       and status in ('live', 'pending');
    if n >= base then
      raise exception 'ARABNA_LISTING_LIMIT' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists classifieds_limit on public.classifieds;
create trigger classifieds_limit before insert on public.classifieds
  for each row execute function public.classifieds_limit();
