/* ============================================================
   ARABNA — قاموس المرادفات / search synonyms
   ------------------------------------------------------------
   THE ONE RULE: this expands the QUERY, never the data.
   A business record is never touched, no tag is ever rewritten.
   Adding a word people search by is one line here and nothing
   anywhere else.

   HOW A GROUP WORKS
   Every array below is a set of words that mean the same thing
   to somebody searching. Typing any member searches for all of
   them. A group is SYMMETRIC: every word in it drags every
   other word with it, in both directions.

   That is why an ambiguous word cannot simply be put in two
   groups. «صالون» in the women's group and the barber group
   made «حلاق» widen into «صالون» and «صالون» widen into every
   women's salon — the two searches returned the same 24 rows.
   An ambiguous word goes in SYNONYM_ONEWAY instead, below: it
   widens, and nothing widens into it.

   WHAT MUST NEVER GO IN A GROUP
   - A word that would drag in a different trade. «بار» is not
     here: `includes()` would match it inside «باركنج».
   - A brand name. Brands belong in that listing's own tags.
   - A word with no listing behind it. Every entry below was run
     against the real 514 records; see tools/synonyms.test.mjs.
   ============================================================ */

export const SYNONYM_GROUPS = [

  /* ---------- ١) المهن والمحلات — trades ---------- */

  // مطعم
  ['مطعم', 'مطاعم', 'مطعمه', 'اكل', 'ماكولات', 'مأكولات', 'مطبخ',
   'restaurant', 'restaurants', 'food', 'kitchen', 'eatery', 'cuisine', 'dining'],

  // بقالة / سوبرماركت
  ['بقاله', 'بقالات', 'دكانه', 'دكان', 'سمانه', 'سوبرماركت', 'سوبر ماركت',
   'ماركت', 'مينى ماركت', 'بقاله عربيه', 'محل عربى', 'سوق',
   'grocery', 'groceries', 'market', 'supermarket', 'mini market', 'food store'],

  // ملحمة / جزارة
  // «لحوم» و«لحمة» و«meat» و«halal meat» خارج المجموعة عمداً: كلها تطابق
  // خاصية «ذبيحة حلال / لحوم حلال» الموجودة على 88 مطعماً، فكان من يبحث عن
  // ملحمة يشتري منها يحصل على 58 مطعماً. الملحمة محل، وأكل اللحم ليس ملحمة.
  ['ملحمه', 'ملاحم', 'جزاره', 'جزار', 'لحام', 'قصاب',
   'butcher', 'butchery', 'meat market', 'meat shop'],

  // مخبز
  ['مخبز', 'مخابز', 'فرن', 'افران', 'معجنات', 'بيكرى', 'خبز',
   'bakery', 'bakeries', 'bread', 'pastry'],

  // حلويات
  ['حلويات', 'حلا', 'حلو', 'حلوى', 'سكريه', 'مشهدى',
   'sweets', 'sweet', 'dessert', 'desserts', 'pastries', 'confectionery'],

  // مقهى / كافيه
  ['مقهى', 'مقاهى', 'قهوه', 'كافيه', 'كافى', 'كوفى', 'كوفى شوب', 'كافتيريا',
   'cafe', 'coffee', 'coffee shop', 'coffeehouse', 'espresso'],

  // أرجيلة / شيشة
  ['ارجيله', 'نرجيله', 'شيشه', 'حقه', 'معسل', 'دخان', 'تنباك',
   'hookah', 'shisha', 'sheesha', 'narghile', 'smoke shop', 'vape'],

  // صالون نسائي / كوافير  — «صالون» ليست هنا: انظر SYNONYM_ONEWAY تحت
  // «تجميل» و«beauty» ليستا هنا أيضاً: هما اسم التصنيف نفسه («تجميل وحلاقة»)،
  // فتوسيع «كوافير» إليهما كان يعيد القسم كلّه بحلاقيه. من يكتبهما يجدهما.
  ['صالونات', 'كوافير', 'كوافيره', 'كوافيرة', 'مشغل',
   'صالون نسائى', 'حواجب', 'مكياج', 'اظافر', 'شمع', 'سبا',
   'salon', 'beauty salon', 'hair salon', 'spa', 'nails', 'brows', 'waxing'],

  // حلاق رجالي — «صالون» ليست هنا: انظر SYNONYM_ONEWAY تحت
  ['حلاق', 'حلاقه', 'مزين', 'بربر', 'بربر شوب', 'حلاق رجالى', 'قص شعر',
   'barber', 'barbershop', 'barber shop', 'haircut', 'mens haircut', 'fade'],

  // مسجد
  ['مسجد', 'مساجد', 'جامع', 'جوامع', 'مصلى', 'مركز اسلامى', 'جمعيه اسلاميه',
   'mosque', 'masjid', 'islamic center', 'islamic centre', 'prayer'],

  // كنيسة
  ['كنيسه', 'كنائس', 'كاتدرائيه', 'قداس', 'رعيه',
   'church', 'cathedral', 'parish', 'mass', 'orthodox', 'coptic'],

  // عيادة / طبيب
  ['عياده', 'عيادات', 'طبيب', 'دكتور', 'حكيم', 'مستوصف', 'مركز طبى', 'طب',
   'clinic', 'doctor', 'physician', 'medical', 'medical center', 'health'],

  // أسنان
  ['اسنان', 'سنان', 'طبيب اسنان', 'دكتور اسنان', 'تقويم', 'تنظيف اسنان',
   'dentist', 'dental', 'orthodontist', 'teeth'],

  // صيدلية
  ['صيدليه', 'صيدليات', 'فرمشيه', 'اجزخانه', 'ادويه', 'دواء',
   'pharmacy', 'drugstore', 'chemist', 'prescription'],

  // محاماة
  // «قانونى» خارج المجموعة عمداً، لنفس سبب «عربية» و«لحوم»: «محاسب قانونى»
  // هو الـCPA لا المحامي، وبعد أسماء هذه الدفعة صار يطابق سجلَّين في
  // «مالية» ولا يطابق محامياً واحداً — قِيس: 2 finance، 0 lawyers. حذفه
  // لا يخسر شيئاً، وإبقاؤه يجعل «محامي» ترجع 17% خارج التصنيف بدل 0%.
  // من يكتبها بنفسه يجدها كما هي؛ لكنها لا تُقحَم في بحث لم يطلبها.
  ['محامى', 'محاماه', 'محامون', 'مكتب محاماه', 'افوكاتو', 'قانون', 'قضيه',
   'lawyer', 'lawyers', 'attorney', 'law', 'law firm', 'legal', 'counsel'],

  // محاسبة / ضرائب
  ['محاسب', 'محاسبه', 'ضرائب', 'ضريبه', 'تاكس', 'دفاتر', 'مسك دفاتر',
   'accountant', 'accounting', 'cpa', 'tax', 'taxes', 'bookkeeping', 'payroll'],

  // عقارات
  ['عقار', 'عقارات', 'عقارى', 'وسيط عقارى', 'سمسار', 'دلال', 'بيت للبيع', 'شقه',
   'real estate', 'realtor', 'realty', 'broker', 'property', 'homes', 'apartment'],

  // سيارات / ميكانيكي
  // «عربية» ليست هنا رغم أنها السيارة بالمصري: بعد التطبيع تطابق
  // «يتحدثون العربية» — وهي على 438 من 515 — فكان «سيارات» يرجّع الدليل كله.
  // من يكتبها يجدها كما هي؛ لكنها لا تُقحَم في بحث لم يطلبها.
  ['سياره', 'سيارات', 'ميكانيكى', 'ميكانيك', 'كراج', 'ورشه',
   'تصليح سيارات', 'صيانه سيارات', 'بودى شوب', 'اطارات', 'كاوتش', 'زيت',
   'auto', 'car', 'cars', 'mechanic', 'garage', 'body shop', 'tires', 'oil change', 'automotive'],

  // سفر / حج وعمرة
  ['سفر', 'سفريات', 'سياحه', 'تذاكر', 'طيران', 'حج', 'عمره', 'مكتب سفر',
   'travel', 'travel agency', 'tickets', 'flights', 'hajj', 'umrah', 'tours'],

  // ملابس
  ['ملابس', 'لبس', 'هدوم', 'اواعى', 'بوتيك', 'محل ملابس', 'عبايات', 'عبايه',
   'حجاب', 'طرح', 'جلابيه', 'ثوب', 'فساتين', 'فستان',
   'clothing', 'clothes', 'boutique', 'apparel', 'fashion', 'abaya', 'hijab', 'dresses', 'thobe'],

  // مجوهرات / ذهب
  ['مجوهرات', 'ذهب', 'دهب', 'صاغه', 'صايغ', 'صياغه', 'الماس', 'خواتم', 'مصاغ',
   'jewelry', 'jeweler', 'jewellery', 'gold', 'diamond', 'rings'],

  // عطور / بخور
  ['عطور', 'عطر', 'برفان', 'بخور', 'عود', 'مسك', 'دهن عود',
   'perfume', 'fragrance', 'oud', 'incense', 'attar', 'bakhoor'],

  // مدرسة / تعليم
  ['مدرسه', 'مدارس', 'روضه', 'حضانه', 'تحفيظ', 'تعليم', 'دروس', 'معهد',
   'تدريس', 'قران', 'مدرسه اسلاميه', 'مدرسه عربيه',
   'school', 'schools', 'academy', 'daycare', 'preschool', 'tutoring', 'quran',
   'education', 'institute', 'islamic school'],

  // نادي رياضي
  ['نادى', 'جيم', 'صاله رياضيه', 'نادى رياضى', 'رياضه', 'لياقه', 'كمال اجسام',
   'gym', 'fitness', 'workout', 'crossfit', 'sports club'],

  // قاعة أفراح / مناسبات
  ['قاعه', 'قاعات', 'صاله افراح', 'قاعه افراح', 'عرس', 'اعراس', 'فرح', 'زفاف',
   'مناسبات', 'حفلات', 'تنظيم حفلات', 'كوشه', 'خطوبه',
   'hall', 'banquet', 'banquet hall', 'wedding', 'weddings', 'venue', 'events', 'party'],

  // تموين / كاترينج
  ['تموين', 'كاترينج', 'ضيافه', 'طبخ للمناسبات', 'ولائم', 'بوفيه مفتوح',
   'catering', 'caterer', 'buffet'],

  // خياطة
  ['خياطه', 'خياط', 'ترزى', 'تفصيل', 'تعديل ملابس', 'تضييق',
   'tailor', 'tailoring', 'alterations', 'seamstress', 'sewing'],

  // صيانة المنزل
  ['سباك', 'سباكه', 'كهربائى', 'كهرباء', 'نجار', 'دهان', 'بويه', 'تكييف',
   'مكيف', 'حداد', 'بلاط', 'معلم', 'تصليح بيت', 'صيانه منزل', 'سقف',
   'handyman', 'plumber', 'plumbing', 'electrician', 'electrical', 'hvac', 'ac',
   'air conditioning', 'carpenter', 'painter', 'roofing', 'remodeling'],

  // تنظيف
  ['تنظيف', 'نظافه', 'تنظيف بيوت', 'تنظيف سجاد', 'غسيل',
   'cleaning', 'cleaner', 'maid', 'janitorial', 'housekeeping', 'carpet cleaning'],

  // جوالات / إلكترونيات
  ['جوال', 'جوالات', 'موبايل', 'تلفون', 'هاتف', 'محمول', 'صيانه جوالات',
   'شاشه', 'بطاريه', 'كمبيوتر', 'لابتوب', 'الكترونيات',
   'phone', 'phones', 'mobile', 'cell phone', 'screen repair', 'computer',
   'laptop', 'electronics', 'repair'],

  // بنك / تحويل أموال
  ['بنك', 'صرافه', 'تحويل', 'تحويل اموال', 'حواله', 'ويسترن يونيون', 'صرف عمله',
   'bank', 'banking', 'money transfer', 'remittance', 'exchange', 'western union',
   'wire transfer', 'credit union'],

  // تأمين
  ['تامين', 'بوليصه', 'تامين سيارات', 'تامين صحى', 'تامين بيت',
   'insurance', 'insurance agency', 'auto insurance', 'health insurance', 'policy'],

  // هجرة
  ['هجره', 'جرين كارد', 'جنسيه', 'فيزا', 'لجوء', 'اقامه', 'تجنيس', 'محامى هجره',
   'immigration', 'green card', 'citizenship', 'visa', 'asylum', 'naturalization'],

  // شحن / بريد / طباعة
  ['شحن', 'بريد', 'طرود', 'طباعه', 'مطبعه', 'لافتات', 'تصوير مستندات', 'ترجمه',
   'shipping', 'mail', 'packages', 'printing', 'print shop', 'signs', 'copies',
   'translation', 'notary'],

  // تصوير
  ['تصوير', 'مصور', 'استوديو', 'فيديو', 'تصوير اعراس',
   'photography', 'photographer', 'studio', 'video', 'videographer'],

  // أثاث ومفروشات
  ['اثاث', 'مفروشات', 'كنب', 'طقم', 'سجاد', 'سجاده', 'ستائر', 'مطبخ خشب',
   'furniture', 'sofa', 'couch', 'rugs', 'carpet', 'curtains', 'home goods', 'mattress'],

  /* ---------- ٢) الأكل — the food people actually type ---------- */

  ['شاورما', 'شورما', 'شاورمه', 'جيرو', 'دونر',
   'shawarma', 'shawerma', 'shwarma', 'gyro', 'doner'],

  ['فلافل', 'طعميه', 'falafel', 'taameya'],

  ['حمص', 'حمّص', 'متبل', 'بابا غنوج', 'متبله',
   'hummus', 'humus', 'baba ganoush', 'mutabbal'],

  ['مشاوى', 'مشوى', 'كباب', 'كفته', 'تكه', 'شيش', 'شيش طاووق', 'مشاوى حلال', 'صاج',
   'grill', 'grilled', 'kebab', 'kabob', 'kabab', 'kofta', 'skewers', 'bbq', 'barbecue'],

  ['منسف', 'مقلوبه', 'كبسه', 'مندى', 'مضغوط', 'حنيذ', 'مظبى', 'برياني', 'برياتى', 'زربيان',
   'mandi', 'kabsa', 'maqluba', 'mansaf', 'biryani', 'haneeth', 'madfoon'],

  ['مناقيش', 'منقوشه', 'زعتر', 'فطاير', 'فطيره', 'صفيحه', 'لحم بعجين', 'سمبوسه', 'سمبوسك',
   'manakish', 'manaeesh', 'zaatar', 'zatar', 'pies', 'sfiha', 'lahmacun', 'sambusa'],

  ['كنافه', 'قطايف', 'بقلاوه', 'معمول', 'بسبوسه', 'هريسه حلوه', 'غريبه', 'عوامه', 'لقمه القاضى',
   'knafeh', 'kunafa', 'kanafa', 'baklava', 'baklawa', 'qatayef', 'basbousa', 'maamoul'],

  ['فول', 'مدمس', 'شكشوكه', 'بيض', 'فطور', 'ترويقه',
   'foul', 'ful', 'fava', 'shakshuka', 'eggs', 'breakfast', 'brunch'],

  ['قهوه تركيه', 'قهوه عربيه', 'قهوه يمنيه', 'محمصه', 'بن',
   'turkish coffee', 'arabic coffee', 'yemeni coffee', 'roastery', 'beans'],

  ['عصير', 'عصائر', 'كوكتيل', 'سموذى', 'شربات',
   'juice', 'juices', 'smoothie', 'shakes'],

  ['بوظه', 'ايس كريم', 'جيلاتى', 'مثلجات',
   'ice cream', 'gelato', 'frozen yogurt', 'creamery'],

  ['خبز عربى', 'عيش', 'صمون', 'تنور', 'مرقوق',
   'pita', 'flatbread', 'naan', 'samoon'],

  ['جبنه', 'لبنه', 'لبن', 'زبادى', 'روب', 'البان', 'قشطه',
   'cheese', 'labneh', 'yogurt', 'dairy', 'laban'],

  ['زيتون', 'مخلل', 'مخللات', 'كبيس', 'زيت زيتون', 'مكسرات', 'تمر', 'عجوه',
   'olives', 'pickles', 'olive oil', 'nuts', 'dates'],

  ['بهارات', 'عطاره', 'توابل', 'اعشاب',
   'spices', 'herbs', 'seasoning'],

  ['عربه طعام', 'فود ترك', 'ترك اكل', 'عربيه اكل',
   'food truck', 'truck', 'trailer'],

  ['برجر', 'بيتزا', 'بروست', 'دجاج مقلى', 'وجبات سريعه',
   'burger', 'burgers', 'pizza', 'fried chicken', 'wings', 'fast food'],

  ['سمك', 'مأكولات بحريه', 'روبيان', 'جمبرى',
   'fish', 'seafood', 'shrimp'],

  /* ---------- ٣) الصفات — what makes or breaks a choice ---------- */

  ['حلال', 'ذبيحه', 'مذبوح', 'زبيحه', 'ذبح اسلامى',
   'halal', 'zabiha', 'dhabiha', 'zabihah'],

  ['بدون كحول', 'ما فيه كحول', 'خالى من الكحول',
   'no alcohol', 'alcohol free', 'dry'],

  ['نباتى', 'خضرى', 'فيغن', 'نباتى صرف',
   'vegan', 'vegetarian', 'plant based'],

  ['توصيل', 'دليفرى', 'طلبات', 'يوصلوا',
   'delivery', 'delivers', 'takeout', 'to go'],

  ['عائلى', 'قسم عائلات', 'عوائل', 'مناسب للاطفال',
   'family', 'family friendly', 'kids', 'family section'],

  ['موقف', 'مواقف', 'باركنج', 'كراج سيارات',
   'parking', 'free parking', 'lot'],

  ['واى فاى', 'انترنت', 'نت',
   'wifi', 'wi fi', 'internet'],

  ['يتحدثون العربيه', 'بيحكوا عربى', 'عربى', 'موظف عربى',
   'arabic', 'arabic spoken', 'speaks arabic'],

  ['مفتوح ٢٤ ساعه', 'مفتوح 24 ساعه', 'طوال اليوم', 'ليلى',
   '24 hours', '24/7', 'late night', 'open late'],

  /* ---------- ٤) المطابخ والجنسيات — cuisines ---------- */

  ['شامى', 'لبنانى', 'سورى', 'فلسطينى', 'اردنى', 'بلاد الشام',
   'levantine', 'lebanese', 'syrian', 'palestinian', 'jordanian', 'shami'],

  ['مصرى', 'مصريه', 'egyptian', 'masri'],
  ['عراقى', 'عراقيه', 'iraqi'],
  ['يمنى', 'يمنيه', 'yemeni', 'yemen'],
  ['خليجى', 'سعودى', 'كويتى', 'اماراتى', 'gulf', 'saudi', 'khaleeji'],
  ['مغربى', 'تونسى', 'جزائرى', 'مغاربى', 'moroccan', 'tunisian', 'algerian', 'maghreb'],
  ['سودانى', 'صومالى', 'sudanese', 'somali'],
  ['تركى', 'تركيه', 'عثمانى', 'turkish', 'turkey', 'ottoman'],
  ['ايرانى', 'فارسى', 'persian', 'iranian'],
  ['افغانى', 'افغانيه', 'afghan', 'afghani'],
  ['باكستانى', 'هندى', 'بنغالى', 'pakistani', 'indian', 'desi', 'bangladeshi'],

  // متوسطي ↔ شرق أوسطي — نفس المحلات في هيوستن عملياً
  ['متوسطى', 'شرق اوسطى', 'شرق الاوسط', 'عربى الماكولات',
   'mediterranean', 'middle eastern', 'middle east'],

  /* ---------- ٥) الترفيه والنزهات — outings ---------- */

  ['حديقه', 'حدائق', 'بارك', 'منتزه', 'متنزه', 'محميه',
   'park', 'parks', 'garden', 'preserve', 'nature'],

  ['ملعب', 'ملاهى', 'العاب', 'مدينه العاب', 'زحاليق', 'ملعب اطفال',
   'playground', 'play area', 'arcade', 'amusement', 'games'],

  ['ترامبولين', 'نطاط', 'trampoline', 'jump'],
  ['تزلج', 'سكيت', 'جليد', 'ice skating', 'skating', 'rink', 'roller'],
  ['بولينج', 'بلياردو', 'bowling', 'billiards', 'pool hall'],
  ['كارتينج', 'سباق', 'go kart', 'karting', 'racing'],
  ['شاطئ', 'بحر', 'رمل', 'beach', 'shore', 'coast'],
  ['متحف', 'متاحف', 'معرض', 'museum', 'exhibit', 'gallery'],
  ['حديقه حيوان', 'حيوانات', 'اكواريوم', 'zoo', 'aquarium'],
  ['مسبح', 'مسابح', 'العاب مائيه', 'رذاذ', 'pool', 'swimming', 'water park', 'splash pad'],
  ['مسار', 'مسارات', 'مشى', 'دراجات', 'رحله', 'trail', 'trails', 'hiking', 'biking'],
  ['شوى', 'منقل', 'مشب', 'شواء', 'bbq pit', 'grill pit', 'picnic'],

  /* ---------- ٦) المدن — the way people spell them ---------- */

  ['هيوستن', 'هيوستون', 'هوستن', 'houston', 'htown'],
  ['كاتى', 'كيتى', 'katy'],
  ['شوجر لاند', 'شوقر لاند', 'شوغر لاند', 'sugar land', 'sugarland'],
  ['سبرنج', 'سبرينج', 'spring'],
  ['ريتشموند', 'richmond'],
  ['ستافورد', 'stafford'],
  ['بيرلاند', 'بيرلند', 'pearland'],
  ['وودلاندز', 'ذا وودلاندز', 'الوودلاندز', 'woodlands', 'the woodlands'],
  ['ميسورى سيتي', 'ميزورى سيتى', 'missouri city'],
  ['هامبل', 'humble'],
  ['شوجر كريك', 'sugar creek'],
  ['بلير', 'بيلير', 'bellaire'],
  ['هيلكروفت', 'hillcroft', 'mahatma gandhi district'],
];


/* ------------------------------------------------------------
   مداخل باتجاه واحد

   بعض الكلمات غامضة في فم الباحث ودقيقة في فم غيره. «صالون» تعني
   عند واحد صالون السيدات وعند آخر محلّ الحلاقة، فمن يكتبها يريد
   الاثنين. أما «حلاق» فدقيقة: من يكتبها يريد الرجالي وحده.

   المجموعة العادية متناظرة — كل كلمة فيها تجرّ كل أخواتها — فوضع
   «صالون» في المجموعتين جعل «حلاق» تتوسّع إلى «صالون» وهذه تتوسّع
   إلى كل الصالونات: 24 نتيجة فيها 11 صالوناً نسائياً، أحدها مكتوب
   عليه «للنساء فقط».

   فهنا يوسّع المفتاح ولا يُوسَّع إليه أبداً.
   ------------------------------------------------------------ */
export const SYNONYM_ONEWAY = {
  'صالون': ['صالونات', 'كوافير', 'كوافيره', 'مشغل', 'صالون نسائى', 'حواجب',
            'مكياج', 'اظافر', 'salon', 'beauty salon', 'hair salon', 'nails',
            'حلاق', 'حلاقه', 'مزين', 'بربر', 'بربر شوب', 'حلاق رجالى', 'قص شعر',
            'barber', 'barbershop', 'barber shop', 'haircut'],
};

/* ------------------------------------------------------------
   The index: word → every group it belongs to, flattened once
   at module load. A word in two groups yields the union, which
   is what keeps «صالون» wide and «حلاق» narrow.
   ------------------------------------------------------------ */
let INDEX = null;

let ONEWAY = null;
function buildOneway(normalize) {
  const m = {};
  for (const k of Object.keys(SYNONYM_ONEWAY)) m[normalize(k)] = SYNONYM_ONEWAY[k];
  return m;
}

function buildIndex(normalize) {
  const map = new Map();
  for (const group of SYNONYM_GROUPS) {
    const normed = group.map(w => normalize(w)).filter(Boolean);
    for (const w of normed) {
      if (!map.has(w)) map.set(w, new Set());
      for (const other of normed) map.get(w).add(other);
    }
  }
  return map;
}

/**
 * Every term worth searching for, given what the reader typed.
 * The whole phrase is tried first («عربه طعام» is one entry, not
 * two words), then each word on its own.
 *
 * @param {string} term        what the reader typed
 * @param {function} normalize store.js's normalize — passed in so
 *                             this file imports nothing and cannot
 *                             drift from the search's own folding
 * @returns {{typed: string, alts: string[]}[]} one entry per typed word
 */
export function expandQuery(term, normalize) {
  if (!INDEX) INDEX = buildIndex(normalize);
  if (!ONEWAY) ONEWAY = buildOneway(normalize);
  const q = normalize(term);
  if (!q) return [];

  const one = (w) => {
    // one-way first: it widens, and nothing widens into it
    const ow = ONEWAY[w];
    if (ow) return { typed: w, alts: ow.map(x => normalize(x)).filter(x => x !== w) };
    const set = INDEX.get(w);
    return { typed: w, alts: set ? [...set].filter(x => x !== w) : [] };
  };

  // the whole phrase, if the dictionary knows it as one thing
  if (ONEWAY && ONEWAY[q]) return [one(q)];
  if (INDEX.get(q)) return [one(q)];
  return q.split(/\s+/).filter(Boolean).map(one);
}

/* ------------------------------------------------------------
   THE RULE THAT KEEPS THIS HONEST

   A word the reader typed themselves matches anywhere in the
   text, exactly as the search has always worked — they chose it
   and they own the consequences.

   A word the DICTIONARY put in their mouth must end on a word
   boundary. Without this, three of the most useful entries were
   catastrophes hiding in plain sight:

     «حلا»  is inside «حلال»   → 93 halal shops for "sweets"
     «سبا»  is inside «مناسبات» → 7 wedding halls for "salon"
     «park» is inside «parkway» → every address on a parkway

   The boundary is required at the END only, never at the start:
   Arabic glues «ال» and «و» and «ب» onto the front of a word, so
   demanding a clean start would lose «الحديقة» — the commonest
   way the word is actually written.
   ------------------------------------------------------------ */
const ENDS = new Map();
function endsClean(hay, word) {
  let re = ENDS.get(word);
  if (!re) {
    re = new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'u');
    ENDS.set(word, re);
  }
  return re.test(hay);
}

/* Spacing is not spelling. «عبدالله» and «عبد الله» are the same name, and
   so are Alshami / Al Shami / Al-Shami and Dimassis / Dimassi's. The
   haystack keeps whatever the record happened to use, so a reader who
   closes the gap finds nothing at all.

   So the typed word is tried a second time against a copy of the text with
   every space, hyphen, apostrophe and dot removed — the reader's own word
   only, never a dictionary substitution, and only from four characters up:
   below that, squashing deletes the word boundaries that keep a short query
   from landing in the middle of an unrelated one. */
const SQUASH = /[\s\-'’.،_/]+/g;
export function squash(s) { return String(s == null ? '' : s).replace(SQUASH, ''); }

/** does this listing's haystack answer one expanded word? */
export function hayMatches(hay, entry, squashedHay) {
  if (hay.includes(entry.typed)) return true;
  if (squashedHay && entry.typed.length >= 4) {
    const q = squash(entry.typed);
    if (q.length >= 4 && squashedHay.includes(q)) return true;
  }
  return entry.alts.some(a => endsClean(hay, a));
}

/* ------------------------------------------------------------
   A CATEGORY NAME IS A LABEL, NOT A DESCRIPTION

   The category name is indexed with every listing, so typing
   «مطاعم» returns the restaurants — which is right, and must
   stay. But two of the twenty-one names carry two trades at
   once, «تجميل وحلاقة» and «أسواق وملاحم», and a label matched
   loosely merges them: «حلاق» sits inside «وحلاقة», so a barber
   search returned all 24 beauty listings, women's salons and
   one «للنساء فقط» included. The same fault handed «ملحمة» the
   whole grocery aisle.

   So the label is matched as a WHOLE WORD, on both sides. This
   is the one place a clean start is demanded — everywhere else
   Arabic's glued «ال» and «و» forbid it — and it is safe here
   for the same reason: the label is our own text, we wrote its
   «و», and the reader is never typing it.
   ------------------------------------------------------------ */
const WORDS = new Map();
function wholeWord(hay, word) {
  let re = WORDS.get(word);
  if (!re) {
    re = new RegExp('(?<![\\p{L}\\p{N}])' +
      word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}])', 'u');
    WORDS.set(word, re);
  }
  return re.test(hay);
}

/** does the listing's category name answer one expanded word? */
export function catMatches(catHay, entry) {
  if (!catHay) return false;
  if (wholeWord(catHay, entry.typed)) return true;
  return entry.alts.some(a => wholeWord(catHay, a));
}

/** for the test harness and for admin diagnostics */
export function synonymsOf(word, normalize) {
  if (!INDEX) INDEX = buildIndex(normalize);
  const set = INDEX.get(normalize(word));
  return set ? [...set] : [];
}
