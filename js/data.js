/* ============================================================
   Seed data (V.01 prototype).
   In V.02 every export here is replaced by a Supabase query with
   the same shape — screens never talk to storage directly.
   ============================================================ */

/* The first five are what Home shows as its summary strip.
   "events" is not a business category — it carries an explicit route to the
   Events screen; every other entry filters the directory. */
export const CATEGORIES = [
  { id: 'restaurants', key: 'catRestaurants', shortKey: 'catShortRestaurants', icon: 'utensils' },
  { id: 'doctors',     key: 'catDoctors',     shortKey: 'catShortDoctors',     icon: 'stethoscope' },
  { id: 'events',      key: 'catEvents',      shortKey: 'catShortEvents',      icon: 'calendar', route: '#/events' },
  { id: 'home',        key: 'catHome',        shortKey: 'catShortHome',        icon: 'wrench' },
  { id: 'beauty',      key: 'catBeauty',      shortKey: 'catShortBeauty',      icon: 'sparkles' },
  { id: 'lawyers',     key: 'catLawyers',     icon: 'scale' },
  { id: 'auto',        key: 'catAuto',        icon: 'car' },
  { id: 'grocery',     key: 'catGrocery',     icon: 'bag' },
  { id: 'realestate',  key: 'catRealEstate',  icon: 'building' },
  { id: 'education',   key: 'catEducation',   icon: 'file' },
  { id: 'travel',      key: 'catTravel',      icon: 'navigation' },
];

/* ---- Marketplace sections ----
   maxActive / days / freeOnly override the account-wide defaults
   (5 active listings, 30 days) for that one section. */
export const MARKET_CATS = [
  { id: 'cars',       key: 'filterCars',       icon: 'car',       emptyKey: 'emptyCars' },
  { id: 'furniture',  key: 'filterFurniture',  icon: 'sofa',      emptyKey: 'emptyFurniture' },
  { id: 'realestate', key: 'filterRealEstate', icon: 'key',       emptyKey: 'emptyRealEstate' },
  { id: 'jobs',       key: 'filterJobs',       icon: 'briefcase', emptyKey: 'emptyJobs' },
  { id: 'pets',       key: 'filterPets',       icon: 'paw',       emptyKey: 'emptyPets' },
  { id: 'handyman',   key: 'filterHandyman',   icon: 'hammer',    emptyKey: 'emptyHandyman', maxActive: 1, days: 14, upsell: true },
  { id: 'free',       key: 'filterFree',       icon: 'gift',      emptyKey: 'emptyFree',     freeOnly: true },
  { id: 'other',      key: 'filterOther',      icon: 'bag',       emptyKey: 'emptyOther' },
];

/** Section rules — screens read limits from here, never hardcode them. */
export function marketCat(id) { return MARKET_CATS.find(c => c.id === id) || null; }

/** kept as an alias so nothing that still imports the old name breaks */
export const CLASSIFIED_CATS = MARKET_CATS;

/** Sentinel stored as the price of a "Free stuff" listing — rendered
    through priceLabel() so it reads "مجاني" / "Free" in both languages. */
export const FREE_PRICE = '__FREE__';

export const MAG_CATS = [
  { id: 'community',   key: 'magCommunity' },
  { id: 'business',    key: 'magBusiness' },
  { id: 'culture',     key: 'magCulture' },
  { id: 'immigration', key: 'magImmigration' },
  { id: 'events',      key: 'magEvents' },
];

/* ---- tiny ZIP dataset for the prototype (V.02: geocoding API) ---- */
export const ZIPS = {
  '77036': { city: 'Houston', state: 'TX', lat: 29.699, lng: -95.535 },
  '77074': { city: 'Houston', state: 'TX', lat: 29.688, lng: -95.510 },
  '77072': { city: 'Houston', state: 'TX', lat: 29.702, lng: -95.586 },
  '77081': { city: 'Houston', state: 'TX', lat: 29.710, lng: -95.487 },
  '77099': { city: 'Houston', state: 'TX', lat: 29.665, lng: -95.583 },
  '77477': { city: 'Stafford', state: 'TX', lat: 29.626, lng: -95.560 },
  '77478': { city: 'Sugar Land', state: 'TX', lat: 29.618, lng: -95.630 },
  '77450': { city: 'Katy', state: 'TX', lat: 29.744, lng: -95.744 },
  '75038': { city: 'Irving', state: 'TX', lat: 32.866, lng: -96.958 },
  '48126': { city: 'Dearborn', state: 'MI', lat: 42.322, lng: -83.176 },
};

export const CITY_SUGGESTIONS = [
  'Houston, TX', 'Stafford, TX', 'Sugar Land, TX', 'Katy, TX', 'Pearland, TX', 'Pasadena, TX',
  'Missouri City, TX', 'The Woodlands, TX', 'Richmond, TX', 'Spring, TX', 'Cypress, TX',
  'Dallas, TX', 'Irving, TX', 'Plano, TX', 'Arlington, TX', 'Fort Worth, TX', 'Austin, TX',
  'San Antonio, TX', 'El Paso, TX', 'Dearborn, MI', 'Detroit, MI', 'Sterling Heights, MI',
  'Chicago, IL', 'Bridgeview, IL', 'Orland Park, IL', 'New York, NY', 'Brooklyn, NY',
  'Yonkers, NY', 'Paterson, NJ', 'Jersey City, NJ', 'Bayonne, NJ', 'Philadelphia, PA',
  'Cleveland, OH', 'Columbus, OH', 'Toledo, OH', 'Atlanta, GA', 'Orlando, FL', 'Miami, FL',
  'Tampa, FL', 'Jacksonville, FL', 'Charlotte, NC', 'Nashville, TN', 'Louisville, KY',
  'Phoenix, AZ', 'Tucson, AZ', 'Las Vegas, NV', 'Denver, CO', 'Salt Lake City, UT',
  'Los Angeles, CA', 'Anaheim, CA', 'San Diego, CA', 'San Jose, CA', 'Sacramento, CA',
  'San Francisco, CA', 'Seattle, WA', 'Portland, OR', 'Minneapolis, MN', 'Milwaukee, WI',
  'Kansas City, MO', 'St. Louis, MO', 'Boston, MA', 'Worcester, MA', 'Washington, DC',
  'Alexandria, VA', 'Arlington, VA', 'Baltimore, MD', 'Silver Spring, MD',
];

/* ---- paid ad inventory (main slider) ---- */
export const SLIDER_ADS = [
  {
    id: 'ad1', kind: 'paid',
    name: { ar: 'مطعم الشام', en: 'Al Sham Restaurant' },
    tag:  { ar: 'شاورما ومشاوي على أصولها — توصيل مجاني', en: 'Authentic shawarma & grills — free delivery' },
    cta:  { ar: 'اطلب الآن', en: 'Order now' },
    color: 'linear-gradient(135deg,#7A2E2E,#3A1620)', icon: 'utensils', link: '#/directory/b1',
  },
  {
    id: 'ad2', kind: 'paid',
    name: { ar: 'عيادة النور الطبية', en: 'Al Noor Medical Clinic' },
    tag:  { ar: 'أطباء عرب · مواعيد بنفس اليوم', en: 'Arabic-speaking doctors · same-day appointments' },
    cta:  { ar: 'احجز موعد', en: 'Book now' },
    color: 'linear-gradient(135deg,#1D4E57,#12232E)', icon: 'stethoscope', link: '#/directory/b3',
  },
  {
    id: 'ad3', kind: 'paid',
    name: { ar: 'الأمانة للسيارات', en: 'Al Amana Auto' },
    tag:  { ar: 'صيانة وبيع سيارات — ضمان سنة', en: 'Service & sales — 1 year warranty' },
    cta:  { ar: 'تواصل معنا', en: 'Contact us' },
    color: 'linear-gradient(135deg,#3B3663,#1A1733)', icon: 'car', link: '#/directory/b6',
  },
  { id: 'house', kind: 'house' }, // ARABNA "ضع إعلانك هنا"
];

/* ---- paid ad inventory (mini banner + magazine native) ---- */
export const MINI_ADS = [
  { id: 'm1', name: { ar: 'سوبرماركت البركة', en: 'Al Baraka Supermarket' }, tag: { ar: 'لحوم حلال طازجة يومياً', en: 'Fresh halal meat daily' }, icon: 'bag', link: '#/directory/b5' },
  { id: 'm2', name: { ar: 'مكتب الهدى للمحاماة', en: 'Al Huda Law Office' }, tag: { ar: 'استشارة أولى مجاناً', en: 'Free first consultation' }, icon: 'scale', link: '#/directory/b4' },
  { id: 'm3', name: { ar: 'صالون ليان', en: 'Layan Salon' }, tag: { ar: 'خصم 20% هذا الشهر', en: '20% off this month' }, icon: 'sparkles', link: '#/directory/b7' },
];

/* ---- directory listings (seeded like an admin bulk import) ---- */
export const BUSINESSES = [
  {
    id: 'b1', name: { ar: 'مطعم الشام', en: 'Al Sham Restaurant' }, cat: 'restaurants',
    phone: '(713) 555-0142', address: '6821 Hillcroft Ave, Houston, TX 77081',
    hours: { ar: 'يومياً ١١ص – ١١م', en: 'Daily 11am – 11pm' },
    plan: 'paid', verified: true, rating: 4.8, reviewCount: 126, dist: 1.2, claimed: true,
    desc: { ar: 'مطبخ شامي أصيل من ٢٠٠٤ — مشاوي، شاورما، ومقبلات بيتية.', en: 'Authentic Levantine kitchen since 2004 — grills, shawarma and homemade mezze.' },
    photos: 8, videos: 2,
  },
  {
    id: 'b2', name: { ar: 'فرن بيروت', en: 'Beirut Bakery' }, cat: 'restaurants',
    phone: '(281) 555-0198', address: '10920 Westheimer Rd, Houston, TX 77042',
    hours: { ar: 'يومياً ٧ص – ٩م', en: 'Daily 7am – 9pm' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 3.4, claimed: false,
    desc: { ar: 'مناقيش، معجنات، وحلويات عربية طازجة.', en: 'Manakish, pastries and fresh Arabic sweets.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b3', name: { ar: 'عيادة النور الطبية', en: 'Al Noor Medical Clinic' }, cat: 'doctors',
    phone: '(713) 555-0177', address: '9440 Bellaire Blvd, Houston, TX 77036',
    hours: { ar: 'سبت – خميس ٩ص – ٦م', en: 'Sat – Thu 9am – 6pm' },
    plan: 'paid', verified: true, rating: 4.9, reviewCount: 88, dist: 2.3, claimed: true,
    desc: { ar: 'طب عائلي وباطنية — الطاقم يتكلم عربي وإنجليزي.', en: 'Family & internal medicine — Arabic and English speaking staff.' },
    photos: 5, videos: 1,
  },
  {
    id: 'b4', name: { ar: 'مكتب الهدى للمحاماة', en: 'Al Huda Law Office' }, cat: 'lawyers',
    phone: '(832) 555-0110', address: '2500 Wilcrest Dr, Houston, TX 77042',
    hours: { ar: 'اثنين – جمعة ٩ص – ٥م', en: 'Mon – Fri 9am – 5pm' },
    plan: 'paid', verified: true, rating: 4.7, reviewCount: 41, dist: 4.1, claimed: true,
    desc: { ar: 'هجرة، أعمال، وقضايا الأسرة.', en: 'Immigration, business and family law.' },
    photos: 3, videos: 0,
  },
  {
    id: 'b5', name: { ar: 'سوبرماركت البركة', en: 'Al Baraka Supermarket' }, cat: 'grocery',
    phone: '(713) 555-0165', address: '5711 Hillcroft St, Houston, TX 77036',
    hours: { ar: 'يومياً ٨ص – ١٠م', en: 'Daily 8am – 10pm' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 0.8, claimed: false,
    desc: { ar: 'لحوم حلال، خضار، ومنتجات مستوردة.', en: 'Halal meat, produce and imported goods.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b6', name: { ar: 'الأمانة للسيارات', en: 'Al Amana Auto' }, cat: 'auto',
    phone: '(281) 555-0133', address: '12105 Bissonnet St, Houston, TX 77099',
    hours: { ar: 'اثنين – سبت ٨ص – ٧م', en: 'Mon – Sat 8am – 7pm' },
    plan: 'paid', verified: true, rating: 4.5, reviewCount: 63, dist: 5.6, claimed: true,
    desc: { ar: 'صيانة، ميكانيكا، وبيع سيارات مستعملة مضمونة.', en: 'Service, mechanics and warrantied used cars.' },
    photos: 6, videos: 3,
  },
  {
    id: 'b7', name: { ar: 'صالون ليان', en: 'Layan Beauty Salon' }, cat: 'beauty',
    phone: '(832) 555-0121', address: '8300 W Airport Blvd, Houston, TX 77071',
    hours: { ar: 'ثلاثاء – أحد ١٠ص – ٨م', en: 'Tue – Sun 10am – 8pm' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 2.9, claimed: false,
    desc: { ar: 'قص، صبغة، مكياج مناسبات، وعناية بالبشرة.', en: 'Cuts, color, event makeup and skincare.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b8', name: { ar: 'تكييف وتبريد أبو خالد', en: 'Abu Khaled A/C & Heating' }, cat: 'home',
    phone: '(713) 555-0188', address: '7100 Regency Square Blvd, Houston, TX 77036',
    hours: { ar: 'خدمة طوارئ ٢٤ ساعة', en: '24h emergency service' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 1.9, claimed: false,
    desc: { ar: 'تركيب وصيانة تكييف — خدمة سريعة.', en: 'A/C install and repair — fast service.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b9', name: { ar: 'مدرسة النهضة العربية', en: 'Al Nahda Arabic School' }, cat: 'education',
    phone: '(281) 555-0144', address: '3110 Eldridge Pkwy, Houston, TX 77082',
    hours: { ar: 'سبت وأحد ٩ص – ٢م', en: 'Sat & Sun 9am – 2pm' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 6.7, claimed: false,
    desc: { ar: 'تعليم اللغة العربية والقرآن للأطفال.', en: 'Arabic language and Quran classes for children.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b10', name: { ar: 'الديار العقارية', en: 'Al Diyar Realty' }, cat: 'realestate',
    phone: '(832) 555-0156', address: '15915 Katy Fwy, Houston, TX 77094',
    hours: { ar: 'اثنين – سبت ٩ص – ٦م', en: 'Mon – Sat 9am – 6pm' },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 9.2, claimed: false,
    desc: { ar: 'بيع وشراء وتأجير عقارات سكنية وتجارية.', en: 'Residential and commercial sales and leasing.' },
    photos: 0, videos: 0,
  },
];

export const REVIEWS = {
  b1: [
    { user: 'Omar H.', rating: 5, when: { ar: 'قبل ٣ أيام', en: '3 days ago' }, text: { ar: 'أطيب شاورما بهيوستن بصراحة، والخدمة سريعة.', en: 'Best shawarma in Houston honestly, and fast service.' } },
    { user: 'ليلى ك.', rating: 5, when: { ar: 'قبل أسبوع', en: '1 week ago' }, text: { ar: 'الأكل بيتي وطازج والأسعار معقولة.', en: 'Homemade taste, fresh, reasonable prices.' } },
    { user: 'Sami D.', rating: 4, when: { ar: 'قبل أسبوعين', en: '2 weeks ago' }, text: { ar: 'ممتاز بس المكان يزحم بالويكند.', en: 'Excellent but it gets crowded on weekends.' } },
  ],
  b3: [
    { user: 'Nour A.', rating: 5, when: { ar: 'قبل ٥ أيام', en: '5 days ago' }, text: { ar: 'الدكتور صبور ويشرح كل شي بالعربي.', en: 'The doctor is patient and explains everything in Arabic.' } },
    { user: 'محمد ص.', rating: 5, when: { ar: 'قبل ١٠ أيام', en: '10 days ago' }, text: { ar: 'موعد بنفس اليوم وما انتظرت كثير.', en: 'Same-day appointment, barely waited.' } },
  ],
  b4: [
    { user: 'Rami E.', rating: 5, when: { ar: 'قبل شهر', en: '1 month ago' }, text: { ar: 'ساعدوني بملف الهجرة خطوة بخطوة.', en: 'They walked me through my immigration file step by step.' } },
  ],
  b6: [
    { user: 'Khaled M.', rating: 4, when: { ar: 'قبل أسبوع', en: '1 week ago' }, text: { ar: 'سعر عادل وشغل نظيف.', en: 'Fair price and clean work.' } },
  ],
};

/* ---- classifieds (person-to-person) ---- */
export const CLASSIFIEDS = [
  { id: 'c1', cat: 'cars', title: { ar: 'تويوتا كامري ٢٠١٩ — نظيفة', en: '2019 Toyota Camry — clean' }, price: '$14,500', city: 'Houston, TX', when: { ar: 'قبل ٣ ساعات', en: '3 hours ago' }, boosted: true, icon: 'car', daysLeft: 27, owner: 'me',
    desc: { ar: 'ماشية ٦٢ ألف ميل، فحص كامل، تيتل نظيف، بدون حوادث.', en: '62k miles, fully inspected, clean title, no accidents.' } },
  { id: 'c2', cat: 'furniture', title: { ar: 'طقم كنب ٧ مقاعد', en: '7-seat sofa set' }, price: '$650', city: 'Stafford, TX', when: { ar: 'قبل يوم', en: '1 day ago' }, boosted: false, icon: 'sofa', daysLeft: 29,
    desc: { ar: 'استعمال سنة واحدة، حالة ممتازة، البيع بسبب السفر.', en: 'One year of use, excellent condition, selling due to moving.' } },
  { id: 'c3', cat: 'realestate', title: { ar: 'شقة غرفتين للإيجار', en: '2BR apartment for rent' }, price: '$1,250/mo', city: 'Sugar Land, TX', when: { ar: 'قبل يومين', en: '2 days ago' }, boosted: false, icon: 'key', daysLeft: 28,
    desc: { ar: 'قريبة من المدارس والمسجد، مع موقف سيارة.', en: 'Close to schools and the masjid, parking included.' } },
  { id: 'c4', cat: 'jobs', title: { ar: 'مطلوب كاشير دوام جزئي', en: 'Part-time cashier wanted' }, price: '$15/hr', city: 'Houston, TX', when: { ar: 'قبل ٣ أيام', en: '3 days ago' }, boosted: false, icon: 'briefcase', daysLeft: 27,
    desc: { ar: 'دوام مسائي، يفضل يتكلم عربي وإنجليزي.', en: 'Evening shift, Arabic + English preferred.' } },
  { id: 'c5', cat: 'furniture', title: { ar: 'طاولة سفرة خشب زان', en: 'Beech wood dining table' }, price: '$300', city: 'Katy, TX', when: { ar: 'قبل ٤ أيام', en: '4 days ago' }, boosted: false, icon: 'sofa', daysLeft: 26,
    desc: { ar: 'مع ٦ كراسي، خشب طبيعي.', en: 'With 6 chairs, solid wood.' } },
  { id: 'c6', cat: 'cars', title: { ar: 'هوندا أكورد ٢٠١٦', en: '2016 Honda Accord' }, price: '$11,900', city: 'Houston, TX', when: { ar: 'قبل ٥ أيام', en: '5 days ago' }, boosted: false, icon: 'car', daysLeft: 25,
    desc: { ar: 'ماشية ٩٠ ألف ميل، محرك ممتاز.', en: '90k miles, engine runs great.' } },
  { id: 'c7', cat: 'pets', title: { ar: 'قطط شيرازي — عمر شهرين', en: 'Persian kittens — 2 months' }, price: '$250', city: 'Houston, TX', when: { ar: 'قبل يومين', en: '2 days ago' }, boosted: false, icon: 'paw', daysLeft: 28,
    desc: { ar: 'مطعّمة ونظيفة، تربية منزلية.', en: 'Vaccinated and clean, raised at home.' } },
  { id: 'c8', cat: 'handyman', title: { ar: 'خدمات دهان وترميم منازل', en: 'Painting & home repair services' }, price: '$40/hr', city: 'Stafford, TX', when: { ar: 'قبل ٣ أيام', en: '3 days ago' }, boosted: false, icon: 'hammer', daysLeft: 11,
    desc: { ar: 'دهان داخلي وخارجي، تصليح جبس، خبرة ١٢ سنة.', en: 'Interior and exterior painting, drywall repair, 12 years experience.' } },
  { id: 'c9', cat: 'free', title: { ar: 'كراتين نقل — مجاني للاستلام', en: 'Moving boxes — free to collect' }, price: '__FREE__', city: 'Sugar Land, TX', when: { ar: 'قبل يوم', en: '1 day ago' }, boosted: false, icon: 'gift', daysLeft: 29,
    desc: { ar: 'حوالي ٢٠ كرتونة بحالة ممتازة، الاستلام من البيت.', en: 'About 20 boxes in good shape, pickup from the house.' } },
];

/* ---- magazine ---- */
export const ARTICLES = [
  {
    id: 'a1', cat: 'business', sponsored: false, read: 4, author: { ar: 'فريق عربنا', en: 'ARABNA Team' },
    date: { ar: '١٢ أغسطس ٢٠٢٦', en: 'Aug 12, 2026' }, media: 'image', icon: 'trendingUp',
    title: { ar: 'كيف صارت هيوستن عاصمة الأعمال العربية في تكساس', en: 'How Houston became the capital of Arab business in Texas' },
    excerpt: { ar: 'من بقالة صغيرة على هيلكروفت إلى شبكة مطاعم وعيادات ومكاتب — قصة نمو ثلاثين سنة.', en: 'From a small grocery on Hillcroft to a network of restaurants, clinics and offices — a thirty-year story.' },
    body: {
      ar: ['خلال العقود الثلاثة الماضية، تحوّل شارع هيلكروفت في هيوستن من مجموعة محلات صغيرة إلى واحد من أكثر الشوارع التجارية العربية حيوية في الولايات المتحدة.',
           'أصحاب الأعمال يقولون إن السر في شيئين: العائلة، والسمعة. أغلب هذه المشاريع بدأت برأس مال صغير جداً واعتمدت على الكلمة المنطوقة بين الجيران.',
           'اليوم، ومع دخول الجيل الثاني إلى الإدارة، بدأت هذه الأعمال بالانتقال إلى المنصات الرقمية — وهنا بالضبط تظهر الحاجة إلى دليل عربي موحّد يجمعها في مكان واحد.'],
      en: ['Over the past three decades, Hillcroft Avenue in Houston has grown from a handful of small shops into one of the most active Arab commercial corridors in the United States.',
           'Owners say the secret is two things: family, and reputation. Most of these businesses started with very little capital and grew on word of mouth between neighbors.',
           'Today, as a second generation steps into management, these businesses are moving online — which is exactly where a unified Arabic directory becomes necessary.'],
    },
  },
  {
    id: 'a2', cat: 'community', sponsored: false, read: 3, author: { ar: 'سارة الحاج', en: 'Sara Al Hajj' },
    date: { ar: '٩ أغسطس ٢٠٢٦', en: 'Aug 9, 2026' }, media: 'image', icon: 'users',
    title: { ar: 'مبادرة شبابية لتعليم العربية لأطفال الجالية', en: 'A youth initiative teaching Arabic to community kids' },
    excerpt: { ar: 'عشرون متطوعاً يفتحون صفوفاً كل سبت — والنتيجة قائمة انتظار طويلة.', en: 'Twenty volunteers open Saturday classes — and the result is a long waiting list.' },
    body: {
      ar: ['بدأت المبادرة بغرفة واحدة في مركز إسلامي، واليوم فيها أكثر من مئة وخمسين طالباً.',
           'المنهج بسيط: قراءة، محادثة، وأنشطة ثقافية. لكن الأثر الحقيقي — كما يقول المتطوعون — هو أن الأطفال صاروا يتكلمون مع أجدادهم.'],
      en: ['The initiative started with one room in an Islamic center; today it has more than 150 students.',
           'The curriculum is simple: reading, conversation and cultural activities. But the real impact, volunteers say, is that the kids now talk to their grandparents.'],
    },
  },
  {
    id: 'a3', cat: 'business', sponsored: true, advertiser: { ar: 'مكتب الهدى للمحاماة', en: 'Al Huda Law Office' },
    read: 3, author: { ar: 'محتوى برعاية', en: 'Sponsored content' },
    date: { ar: '٧ أغسطس ٢٠٢٦', en: 'Aug 7, 2026' }, media: 'image', icon: 'scale',
    title: { ar: 'خمسة أخطاء شائعة في ملفات الهجرة — وكيف تتجنبها', en: 'Five common immigration filing mistakes — and how to avoid them' },
    excerpt: { ar: 'محتوى برعاية مكتب الهدى للمحاماة.', en: 'Sponsored by Al Huda Law Office.' },
    body: {
      ar: ['الخطأ الأول هو التأخر في الرد على طلب المستندات الإضافية، وهو سبب شائع جداً للرفض.',
           'الخطأ الثاني تعبئة النماذج بمعلومات غير مطابقة للوثائق الرسمية.',
           'للاستشارة الأولى المجانية، تواصل مع المكتب عبر صفحته في دليل عربنا.'],
      en: ['The first mistake is responding late to a request for evidence — a very common cause of denial.',
           'The second is filling forms with details that do not match official documents.',
           'For a free first consultation, contact the office through its ARABNA directory page.'],
    },
  },
  {
    id: 'a4', cat: 'events', sponsored: false, read: 2, author: { ar: 'فريق عربنا', en: 'ARABNA Team' },
    date: { ar: '٤ أغسطس ٢٠٢٦', en: 'Aug 4, 2026' }, media: 'video', icon: 'calendar',
    title: { ar: 'مهرجان الأكل العربي يعود لهيوستن هذا الخريف', en: 'The Arab Food Festival returns to Houston this fall' },
    excerpt: { ar: 'أكثر من ٤٠ مطعماً وكشكاً، وبرنامج موسيقي على مدى يومين.', en: 'More than 40 restaurants and booths, plus a two-day music program.' },
    body: {
      ar: ['المهرجان راح يقام في نهاية أكتوبر، والتسجيل للمشاركين التجاريين مفتوح من الآن.',
           'المنظمون يتوقعون حضور أكثر من عشرة آلاف زائر على مدى يومين.'],
      en: ['The festival takes place at the end of October, and vendor registration is already open.',
           'Organizers expect more than ten thousand visitors across the two days.'],
    },
  },
  {
    id: 'a5', cat: 'immigration', sponsored: false, read: 5, author: { ar: 'خالد ن.', en: 'Khaled N.' },
    date: { ar: '١ أغسطس ٢٠٢٦', en: 'Aug 1, 2026' }, media: 'image', icon: 'file',
    title: { ar: 'دليل مبسّط: أول ٩٠ يوم بعد الوصول لأمريكا', en: 'A simple guide: your first 90 days in the U.S.' },
    excerpt: { ar: 'السوشال سكيورتي، الرخصة، الحساب البنكي، والمدرسة — بالترتيب الصحيح.', en: 'Social security, license, bank account and school — in the right order.' },
    body: {
      ar: ['الترتيب مهم: ابدأ برقم الضمان الاجتماعي لأن أغلب الخطوات الأخرى تطلبه.',
           'بعدها الحساب البنكي، ثم رخصة القيادة، وأخيراً تسجيل الأطفال بالمدرسة.'],
      en: ['Order matters: start with a social security number because most other steps require it.',
           'Then a bank account, then a driver license, and finally school enrollment for children.'],
    },
  },
];

/* ============================================================
   EVENTS
   `source` / `externalId` / `sourceUrl` are populated in V.02 by the
   automatic importers (Ticketmaster Discovery API, and ICS calendar feeds
   from masjids and community centers). They stay empty for anything typed
   in by hand, and `source: 'manual'` marks a human-entered event.
   ============================================================ */
export const EVENTS = [
  {
    id: 'e1', status: 'live',
    title: { ar: 'مهرجان الأكل العربي — هيوستن', en: 'Arab Food Festival — Houston' },
    startsAt: '2026-10-24T17:00', endsAt: '2026-10-25T22:00',
    venue: { ar: 'مركز جورج آر براون', en: 'George R. Brown Convention Center' },
    city: 'Houston, TX',
    desc: { ar: 'أكثر من ٤٠ مطعماً وكشكاً، وبرنامج موسيقي على مدى يومين، وركن للأطفال.',
            en: 'More than 40 restaurants and booths, a two-day music program and a kids corner.' },
    organizer: { ar: 'جمعية التجار العرب', en: 'Arab Merchants Association' },
    ticketUrl: 'https://example.com/tickets/arab-food-festival',
    icon: 'utensils', photo: '', featured: true,
    source: '', externalId: '', sourceUrl: '',
  },
  {
    id: 'e2', status: 'live',
    title: { ar: 'أمسية شعر عربي', en: 'Arabic Poetry Evening' },
    startsAt: '2026-09-12T19:30', endsAt: '2026-09-12T22:00',
    venue: { ar: 'المركز الثقافي العربي', en: 'Arab Cultural Center' },
    city: 'Houston, TX',
    desc: { ar: 'أمسية مفتوحة مع شعراء من الجالية، والدخول مجاني مع التسجيل المسبق.',
            en: 'An open evening with community poets. Free entry with prior registration.' },
    organizer: { ar: 'المركز الثقافي العربي', en: 'Arab Cultural Center' },
    ticketUrl: 'https://example.com/register/poetry-night',
    icon: 'newspaper', photo: '', featured: false,
    source: '', externalId: '', sourceUrl: '',
  },
  {
    id: 'e3', status: 'live',
    title: { ar: 'سوق رمضان الخيري', en: 'Ramadan Charity Bazaar' },
    startsAt: '2027-02-20T16:00', endsAt: '2027-02-20T23:00',
    venue: { ar: 'مسجد الهدى', en: 'Al Huda Masjid' },
    city: 'Stafford, TX',
    desc: { ar: 'بازار عائلي لدعم صندوق الطلاب، مع مأكولات ومنتجات يدوية.',
            en: 'A family bazaar supporting the student fund, with food and handmade goods.' },
    organizer: { ar: 'مسجد الهدى', en: 'Al Huda Masjid' },
    ticketUrl: '', icon: 'users', photo: '', featured: false,
    source: '', externalId: '', sourceUrl: '',
  },
];

/** A brand-new event record — one place that defines the shape. */
export function blankEvent() {
  return {
    id: '', status: 'pending',
    title: { ar: '', en: '' }, startsAt: '', endsAt: '',
    venue: { ar: '', en: '' }, city: '',
    desc: { ar: '', en: '' }, organizer: { ar: '', en: '' },
    ticketUrl: '', icon: 'calendar', photo: '', featured: false,
    source: '', externalId: '', sourceUrl: '',
  };
}

/* ---- paid verification badge ----
   Owner sets the real number later; 0 means "not priced yet" and the app
   shows the request flow without charging. */
export const VERIFY_BADGE_PRICE = 0;

/* ---- ad products & pricing (wired for Stripe in V.02) ---- */
export const AD_PRODUCTS = [
  { id: 'slider', nameKey: 'prodSlider', descKey: 'prodSliderDesc', icon: 'megaphone', prices: { week1: 149, week2: 269, month1: 449 } },
  { id: 'mini',   nameKey: 'prodMini',   descKey: 'prodMiniDesc',   icon: 'bolt',      prices: { week1: 49,  week2: 89,  month1: 149 } },
  { id: 'story',  nameKey: 'prodStory',  descKey: 'prodStoryDesc',  icon: 'newspaper', prices: { week1: 199, week2: 349, month1: 549 } },
  { id: 'event',  nameKey: 'prodEvent',  descKey: 'prodEventDesc',  icon: 'calendar',  prices: { week1: 99,  week2: 179, month1: 299 } },
];

export const BOOST_PRICES = [
  { id: 'b3d', days: 3,  price: 2 },
  { id: 'b7d', days: 7,  price: 5 },
  { id: 'b14d', days: 14, price: 8 },
];

export const SUBSCRIPTION_PRICE = 29;

/* Every notification carries a `route`: tapping one must always land on the
   thing it is talking about. */
export const NOTIFICATIONS = [
  { id: 'n1', icon: 'megaphone', unread: true, route: '#/marketplace/c1', title: { ar: 'إعلانك صار مباشر', en: 'Your ad is live' }, body: { ar: 'إعلان "تويوتا كامري" ظاهر الآن بأعلى فئة السيارات.', en: 'Your "Toyota Camry" listing is now pinned in Cars.' }, when: { ar: 'قبل ساعتين', en: '2 hours ago' } },
  { id: 'n2', icon: 'clock', unread: true, route: '#/my-ads', title: { ar: 'إعلانك ينتهي قريباً', en: 'Listing expiring soon' }, body: { ar: 'باقي ٣ أيام على انتهاء إعلان "طقم كنب".', en: '3 days left on your "sofa set" listing.' }, when: { ar: 'قبل يوم', en: '1 day ago' } },
  { id: 'n3', icon: 'star', unread: false, route: '#/my-business', title: { ar: 'مراجعة جديدة', en: 'New review' }, body: { ar: 'وصلتك مراجعة ٥ نجوم على صفحة نشاطك.', en: 'You received a 5-star review on your business page.' }, when: { ar: 'قبل ٣ أيام', en: '3 days ago' } },
];

/* The moderation queue has no seed data on purpose: it is built entirely
   from real pending listings, avatars, badge requests and scan reports, so
   an "approve" in the admin panel always publishes something real. */
