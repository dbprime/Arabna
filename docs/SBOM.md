# قائمةُ مكوّنات عربنا — SBOM

آخرُ قياس: 2 سبتمبر 2026 · على main

## ما يصل المستخدم
| المكوّن | الرخصة | الموضع | ملاحظة |
|---|---|---|---|
| IBM Plex Sans Arabic | SIL OFL 1.1 | يُحمَّل من Google Fonts وقت التشغيل | لا ملفَّ خطٍّ في المستودع |
| Noto Kufi Arabic | SIL OFL 1.1 | كذلك | كذلك |
| مساراتُ الأيقونات في js/icons.js | ⚠️ انظر LICENSES.md | مرسومةٌ داخل الواجهة | قِيست مقابل Feather 4.29.2 في 2 سبتمبر 2026: 31 حرفيّة · 16 مشتقّة · 48 أصليّة — الإسنادُ في LICENSES.md |
| خدماتٌ عامّة وقت التشغيل: api.bigdatacloud.net · nominatim.openstreetmap.org · api.zippopotam.us | شروطُ كلّ مزوّد | connect-src في CSP | Nominatim: لا استعمالَ بالجملة — قرارٌ مسجَّل |

## ما لا يصل المستخدم (تطويرٌ وفحص)
| المكوّن | الرخصة | الموضع | ملاحظة |
|---|---|---|---|
| Playwright + Chromium | Apache-2.0 / BSD | tools/e2e | |
| Node.js · Python 3 | MIT / PSF | tools/ | |

## ما ليس مكوّناً ويُذكَر للاكتمال
| المكوّن | المصدر | الموضع | ملاحظة |
|---|---|---|---|
| سجلّاتُ الدليل | حقائقُ من مصادرَ عامّة، وعمودُ مصدرٍ لكلّ سجلّ | js/data.js | صفرُ صورةٍ أو تقييمٍ منقول — مقيس |

## اعتماديّاتُ الحزم
لا package.json · لا node_modules · لا مكتبةَ JavaScript خارجيّةً في البرنامج — مقيس.

## فحصُ الأسرار
شُغِّل في 2 سبتمبر 2026 على main:

```
grep -rnE "sk_live|sk_test|eyJhbGci|AKIA[0-9A-Z]{16}|service_role|supabase\.co|-----BEGIN" js/ index.html vercel.json sw.js manifest.json
```

الناتج: **0 سطر.**
