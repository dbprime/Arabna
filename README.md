# ARABNA · عربنا — V.01

تطبيق ويب (mobile-first) للجالية العربية في أمريكا: **دليل أعمال + إعلانات شخصية + مجلة**،
بواجهة عربية أولاً مع تبديل كامل للإنجليزية، وهوية بصرية كحلي/ذهبي.

> **V.01 = نموذج أولي كامل للواجهة والتجربة.** كل الشاشات وكل التدفقات تشتغل فعلياً
> (تسجيل، تحقق بالإيميل، تحقق بالجوال مع رفض أرقام VOIP، نشر إعلان، تمييز مدفوع،
> شراء إعلان، اشتراك الأعمال، لوحة إدارة). البيانات والدفع والرسائل **محاكاة داخل المتصفح**
> لأن حسابات Supabase / Stripe / Twilio لم تُنشأ بعد. كل نقطة اتصال بالخوادم معزولة
> في ملف واحد (`js/store.js`) عشان الربط الحقيقي في V.02 يكون تبديل دوال فقط.

---

## 1. التشغيل محلياً

ما في أي خطوة بناء (no build step) — الملفات ثابتة:

```bash
# أي خادم ملفات ثابت
npx serve .
# أو
python3 -m http.server 8000
```
ثم افتح `http://localhost:8000`.

> ملاحظة: لازم يكون عبر خادم (وليس فتح الملف مباشرة) لأن التطبيق يستخدم ES Modules.

---

## 2. الرفع على GitHub

```bash
cd arabna
git init
git add .
git commit -m "ARABNA V.01 — prototype"
git branch -M main
git remote add origin https://github.com/<your-username>/arabna.git
git push -u origin main
git tag V.01 && git push origin V.01
```

## 3. النشر على Vercel

1. ادخل [vercel.com](https://vercel.com) → **Add New → Project** → اختر مستودع `arabna`.
2. **Framework Preset:** `Other` — **Build Command:** اتركه فاضي — **Output Directory:** `.`
3. اضغط **Deploy**. خلال دقيقة راح يطلع لك رابط `https://arabna-xxxx.vercel.app`.
4. مشروع واحد فقط (One deployment target) — لا تنشئ مشاريع معاينة إضافية.

---

## 4. بنية المشروع

```
arabna/
├── index.html              # هيكل التطبيق (هيدر / محتوى / شريط سفلي)
├── vercel.json             # إعدادات النشر + هيدرات أمان
├── styles/app.css          # نظام التصميم كامل (ألوان، مكوّنات، RTL/LTR)
├── assets/                 # الشعار الرسمي (شفاف) + الأيقونة
└── js/
    ├── app.js              # الراوتر (hash routing) + الإقلاع
    ├── i18n.js             # كل نصوص الواجهة عربي + إنجليزي
    ├── data.js             # البيانات التجريبية (تُستبدل بـ Supabase في V.02)
    ├── store.js            # الحالة + الصلاحيات + نقاط الاتصال بالخوادم
    ├── ui.js               # مكوّنات مشتركة (توست، شيت، قائمة جانبية، هيدر، نav)
    ├── icons.js            # الأيقونات SVG (بدون مكتبات خارجية)
    └── screens/            # الشاشات: home / directory / classifieds / magazine
                            #          / auth / advertise / profile / admin
```

**صفر تبعيات (zero dependencies)** — لا npm ولا مكتبات خارجية. الخط الوحيد الخارجي هو
IBM Plex Sans Arabic من Google Fonts.

---

## 5. حسابات وأرقام تجريبية

| الغرض | القيمة |
|---|---|
| رمز التحقق (إيميل وجوال) | `123456` |
| رقم جوال مقبول | `(713) 466-9182` |
| رقم مرفوض كـ VOIP | أي رقم يبدأ بـ `555` أو `800` أو `888` |
| دخول لوحة الإدارة | `#/admin` وكلمة السر `arabna2026` |
| بطاقة الدفع | وهمية — الدفع محاكاة بدون Stripe |

---

## 6. مسار V.02 (الربط الحقيقي)

| ما يجب ربطه | أين بالضبط |
|---|---|
| قاعدة البيانات والحسابات (Supabase) | `js/store.js` → `signUp` / `confirmEmail` / `allBusinesses` / `allClassifieds` |
| التحقق من نوع الرقم (Twilio Lookup) | `js/store.js` → `lookupLineType` |
| رسائل OTP (Twilio Verify) | `js/store.js` → `sendSmsCode` / `sendEmailCode` |
| الدفع والاشتراكات (Stripe) | `js/store.js` → `chargeCard` / `subscribeBusiness` |
| رفع الصور والفيديو (Cloudflare R2) | أزرار الرفع في `screens/classifieds.js` و `screens/advertise.js` |
| قاعدة الرموز البريدية / Geocoding | `js/data.js` → `ZIPS` و `CITY_SUGGESTIONS` |

كل الشاشات تقرأ من `store.js` فقط، فما تحتاج تعديل أي شاشة عند الربط.

---

© 2026 ARABNA · عربنا — الإصدار V.01
