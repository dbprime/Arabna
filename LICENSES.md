# رخصُ المكوّنات الخارجيّة

## @supabase/supabase-js — MIT

مكتبةُ العميل التي يصل بها البرنامجُ قاعدةَ بياناته ومصادقتَه، **مودَعةٌ
ملفّاً في المستودع** لا محمَّلةً من شبكةِ توزيع.

```
الإصدار      2.115.0
الرخصة       MIT
المصدر       npm — @supabase/supabase-js، ملفُّ dist/umd/supabase.js
قِيس ونُزِّل   5 سبتمبر 2026
الموضع       js/vendor/supabase.js
```

**ما تغيّر في الملفّ عن الحزمة: لا شيءَ في الشيفرة.** أُضيف رأسٌ تعليقيٌّ
يشرح سببَ الإيداع، وسطرُ تصديرٍ واحدٌ في الذيل — بناءُ UMD دالّةٌ تُسنِد إلى
`var supabase` ولا تلمس `module.exports` ولا `define.amd` (مقيس: صفرٌ
لكليهما)، فداخل وحدة ES يصير المتغيّرُ محليّاً ويكفي تصديرُه.

**ولماذا مودَعةٌ لا محمَّلةٌ من CDN:** `sw.js` يتجاهل كلَّ ما ليس من أصلِنا
(`url.origin !== self.location.origin`)، فسكربتٌ خارجيٌّ لا يدخل المخزنَ
المؤقّت أبداً — وأوّلُ فتحةٍ بلا شبكة شاشةٌ بيضاء، نقضاً لوعد «الدليل يعمل
بلا إنترنت». ومودَعةً يلتقطها `tools/build_sw.py` تلقائياً في `PRECACHE`،
ويبقى `script-src 'self'` بلا حرفٍ يُضاف إليه.

**لتحديثها:** يُنزَّل `dist/umd/supabase.js` للإصدار المطلوب، ويُستبدَل ما
بين الرأس وسطرِ التصدير، ويُحدَّث الرقمُ والتاريخ هنا وفي `docs/SBOM.md`
وفي رأس الملفّ نفسِه — **ثلاثةُ مواضعَ تُحدَّث معاً أو لا تُمَسّ**، وهي
قاعدةُ الرقم الواحد في مواضعَ عدّة التي دفع هذا المشروع ثمنَها.


## Feather Icons — MIT

مساراتُ الأيقونات التالية في `js/icons.js` مأخوذةٌ أو مشتقّةٌ من
[Feather Icons](https://feathericons.com) (الإصدار المقارَن: 4.29.2).
قِيست بالنصّ في 2 سبتمبر 2026 — كلُّ مسارٍ عندنا قُورن بكلّ مسارٍ في
`dist/icons.json` بعد توحيد الصيغة (إغلاقُ الوسم، ترتيبُ الخصائص، علاماتُ
الاقتباس): **31 مطابقةٌ حرفاً، و16 مشتقّةٌ بتعديلٍ طفيف، و48 أصليّةٌ لا تقابل شيئاً.**

### مطابقةٌ حرفاً (31)
- `menu` ← Feather `bar-chart-2`
- `search` ← Feather `search`
- `mapPin` ← Feather `map-pin`
- `navigation` ← Feather `navigation`
- `compass` ← Feather `compass`
- `plus` ← Feather `plus`
- `user` ← Feather `user`
- `star` ← Feather `star`
- `check` ← Feather `check`
- `checkCircle` ← Feather `check-circle`
- `x` ← Feather `plus`
- `chevronL` ← Feather `chevron-left`
- `chevronR` ← Feather `chevron-right`
- `chevronD` ← Feather `chevron-down`
- `camera` ← Feather `camera`
- `clock` ← Feather `clock`
- `filter` ← Feather `filter`
- `info` ← Feather `alert-circle`
- `shield` ← Feather `shield`
- `logout` ← Feather `log-out`
- `trash` ← Feather `trash`
- `refresh` ← Feather `rotate-cw`
- `flag` ← Feather `flag`
- `share` ← Feather `share-2`
- `trendingUp` ← Feather `trending-up`
- `bookmark` ← Feather `bookmark`
- `eye` ← Feather `eye`
- `bolt` ← Feather `zap`
- `send` ← Feather `send`
- `users` ← Feather `users`
- `play` ← Feather `play`

### مشتقّةٌ بتعديلٍ طفيفٍ في الأرقام (16)
- `bell` ← Feather `bell`
- `bag` ← Feather `shopping-bag`
- `phone` ← Feather `phone`
- `video` ← Feather `video`
- `lock` ← Feather `lock`
- `briefcase` ← Feather `briefcase`
- `help` ← Feather `help-circle`
- `file` ← Feather `file-minus`
- `copy` ← Feather `copy`
- `edit` ← Feather `edit`
- `creditCard` ← Feather `credit-card`
- `image` ← Feather `image`
- `alert` ← Feather `alert-triangle`
- `calendar` ← Feather `calendar`
- `smartphone` ← Feather `smartphone`
- `grid` ← Feather `grid`

(مساران آخران — `instagram` و`mail` — يشبهان شكلين في Feather شبهَ
هندسةٍ عامّة (`speaker` · `tv`) لا نقلاً، فلم يُدرَجا.)

```
The MIT License (MIT)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## SIL Open Font License 1.1 — IBM Plex Sans Arabic · Noto Kufi Arabic

يُحمَّلان وقت التشغيل من Google Fonts ولا يُوزَّعان مع البرنامج — لا ملفَّ
خطٍّ في المستودع. نصُّ الرخصة: https://openfontlicense.org/open-font-license-official-text/
