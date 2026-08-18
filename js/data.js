/* ============================================================
   Seed data (V.01 prototype).
   In V.02 every export here is replaced by a Supabase query with
   the same shape — screens never talk to storage directly.
   ============================================================ */

/* The first five are what Home shows as its summary strip.
   "events" is not a business category — it carries an explicit route to the
   Events screen; every other entry filters the directory. */
/* ============================================================
   The twenty directory categories (V.02.0)
   ------------------------------------------------------------
   Frozen shape: the owner enters shops by hand against these ids,
   so renaming one means re-entering its shops. `homeservices` and
   `homegoods` are deliberately apart — someone buying a sofa is
   browsing, someone looking for a plumber has a problem right now,
   and home services is the highest-earning column in any local
   directory, so it gets found rather than buried.
   ============================================================ */
export const CATEGORIES = [
  // 'events' is not a business category: it is a shortcut that opens the
  // Events screen. Every other entry filters the directory.
  { id: "restaurants",  key: "catRestaurants",      icon: "utensils",    shortKey: "catShortRestaurants" },
  { id: "grocery",      key: "catGrocery",          icon: "bag" },
  { id: "worship",      key: "catWorship",          icon: "landmark" },
  { id: "cafe",         key: "catCafe",             icon: "coffee" },
  { id: "beauty",       key: "catBeauty",           icon: "sparkles" },
  { id: "shopping",     key: "catShopping",         icon: "shirt",       shortKey: "catShortBeauty" },
  { id: "community",    key: "catCommunity",        icon: "users" },
  { id: "education",    key: "catEducation",        icon: "graduation" },
  { id: "sweets",       key: "catSweets",           icon: "cake" },
  { id: "finance",      key: "catFinance",          icon: "banknote" },
  { id: "occasions",    key: "catOccasions",        icon: "sparkles" },
  { id: "doctors",      key: "catDoctors",          icon: "stethoscope", shortKey: "catShortDoctors" },
  { id: "auto",         key: "catAuto",             icon: "car" },
  { id: "homegoods",    key: "catHomegoods",        icon: "sofa" },
  { id: "lawyers",      key: "catLawyers",          icon: "scale" },
  { id: "travel",       key: "catTravel",           icon: "navigation" },
  { id: "electronics",  key: "catElectronics",      icon: "smartphone" },
  { id: "realestate",   key: "catRealestate",       icon: "building" },
  { id: "homeservices", key: "catHomeservices",     icon: "wrench",      shortKey: "catShortHome" },
  { id: "gyms",         key: "catGyms",             icon: "dumbbell" },
  // Not a business category: a shortcut that opens the Events screen. It is
  // filtered out of every directory chip row by `!c.route`.
  { id: "events",       key: "catEvents",           icon: "calendar",    shortKey: "catShortEvents", route: "#/events" },
];

/* The five circles on Home, in order. */
export const HOME_CATS = ['restaurants', 'doctors', 'events', 'homeservices', 'shopping'];

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

/* ============================================================
   Opening hours — structured, not prose
   ------------------------------------------------------------
   Storage is one array of seven entries indexed the way
   Date#getDay() indexes: 0 = Sunday … 6 = Saturday. Each entry is
   either null (closed all day) or a list of [open, close] spans in
   24-hour "HH:MM". Two spans cover a shop that shuts at midday.
   A close earlier than its open means the span runs past midnight
   (11:00 → 02:00), which is how late restaurants actually trade.
   ============================================================ */

export const DAY_KEYS = ['daySun', 'dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat'];
const DAY_IDS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/** the whole day, used both as a value and as a marker for "24 hours" */
export const ALL_DAY = ['00:00', '24:00'];

/**
 * Readable spec → canonical array. Accepts per day:
 *   null / omitted        closed
 *   '11:00-23:00'         one span
 *   ['09:00-14:00', …]    several spans
 *   '24h'                 open around the clock
 * `all` sets every day at once and the named days override it.
 */
export function week(spec = {}) {
  const parse = (v) => {
    if (v === null || v === undefined) return null;
    if (v === '24h') return [ALL_DAY.slice()];
    const list = Array.isArray(v) ? v : [v];
    const spans = list.map(x => x.split('-').map(t => t.trim()));
    return spans.length ? spans : null;
  };
  return DAY_IDS.map(d => (d in spec ? parse(spec[d]) : parse(spec.all)));
}

/** true when the day is a single 00:00–24:00 span */
export function isAllDay(spans) {
  return !!spans && spans.length === 1 && spans[0][0] === '00:00' && spans[0][1] === '24:00';
}

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
/* ============================================================
   Directory attributes — one registry, no bespoke fields
   ------------------------------------------------------------
   Adding "women only" or "halal" as columns on the business model
   would mean opening the code, the add form and the filter sheet
   every time a new one is wanted. Instead every attribute is a row
   here and a business just carries a list of ids. The add/edit
   form, the filter sheet and the quick chips all build themselves
   from this table, so a new attribute is one line and nothing else.

   cats   '*' or a list of category ids where the attribute applies
   quick  true, or a list of category ids, where it earns a chip
          above the results instead of living in the filter sheet
   group  how the add form and the filter sheet cluster the options
   season shown only while that season is switched on in admin
   exclusive  one value at most may be picked from the group
   ============================================================ */
export const ATTR_GROUPS = [
  { id: "cuisine",      key: "attrGrpCuisine" },
  { id: "dish",         key: "attrGrpDish" },
  { id: "service",      key: "attrGrpService" },
  { id: "halal",        key: "attrGrpHalal" },
  { id: "alcohol",      key: "attrGrpAlcohol" },
  { id: "health",       key: "attrGrpHealth" },
  { id: "gender",       key: "attrGrpGender" },
  { id: "insurance",    key: "attrGrpInsurance" },
  { id: "legal",        key: "attrGrpLegal" },
  { id: "finance",      key: "attrGrpFinance" },
  { id: "beautySvc",    key: "attrGrpBeautySvc" },
  { id: "autoSvc",      key: "attrGrpAutoSvc" },
  { id: "reSvc",        key: "attrGrpReSvc" },
  { id: "homeSvc",      key: "attrGrpHomeSvc" },
  { id: "homeGoods",    key: "attrGrpHomeGoods" },
  { id: "schooling",    key: "attrGrpSchooling" },
  { id: "travelSvc",    key: "attrGrpTravelSvc" },
  { id: "worshipKind",  key: "attrGrpWorshipKind" },
  { id: "worship",      key: "attrGrpWorship" },
  { id: "grocerySvc",   key: "attrGrpGrocerySvc" },
  { id: "cafeSvc",      key: "attrGrpCafeSvc" },
  { id: "sweetsSvc",    key: "attrGrpSweetsSvc" },
  { id: "shopSvc",      key: "attrGrpShopSvc" },
  { id: "occasionSvc",  key: "attrGrpOccasionSvc" },
  { id: "elecSvc",      key: "attrGrpElecSvc" },
  { id: "communitySvc", key: "attrGrpCommunitySvc" },
  { id: "gymSvc",       key: "attrGrpGymSvc" },
  { id: "newcomer",     key: "attrGrpNewcomer" },
  { id: "language",     key: "attrGrpLanguage" },
  { id: "practical",    key: "attrGrpPractical" },
  { id: "ramadan",      key: "attrGrpRamadan", season: 'ramadan' },
];

/* The i18n key is derived from the id, never written out: they cannot drift
   apart, and a new speciality is one line here plus two lines in i18n.js. */
const withKey = (list) => list.map(a => Object.assign(
  { key: 'attr' + a.id[0].toUpperCase() + a.id.slice(1) }, a));

export const ATTRIBUTES = withKey([
  /* --- cuisine --- */
  { id: "cuisLebanese", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisSyrian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisPalestinian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisJordanian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisEgyptian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisIraqi", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisYemeni", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisGulf", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisSaudi", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisSudanese", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisMoroccan", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisTunisian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisLibyan", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisTurkish", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisPakistani", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisIndian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisBengali", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisAfghan", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisPersian", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisMalay", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisChineseHalal", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisAmericanHalal", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisMediterranean", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  { id: "cuisMiddleEastern", group: "cuisine", cats: ["restaurants"], icon: "utensils" },
  /* --- dish --- */
  { id: "dishShawarma", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishGrill", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishMandi", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishFalafel", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishManakish", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishBurger", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishPizza", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishBiryani", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishFriedChicken", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishSeafood", group: "dish", cats: ["restaurants"], icon: "utensils" },
  { id: "dishVegetarian", group: "dish", cats: ["restaurants"], icon: "utensils" },
  /* --- service --- */
  { id: "svcBreakfast", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcBuffet", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcCatering", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcHookah", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcFoodTruck", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcTakeout", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcWomenSection", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcGroupBooking", group: "service", cats: ["restaurants"], icon: "clock" },
  { id: "svcLateNight", group: "service", cats: ["restaurants"], icon: "clock" },
  /* --- halal --- */
  { id: "halalMeat", group: "halal", cats: ["restaurants", "grocery", "cafe", "sweets"], icon: "checkCircle", exclusive: true },
  { id: "halalWithAlc", group: "halal", cats: ["restaurants", "grocery", "cafe", "sweets"], icon: "checkCircle", exclusive: true },
  { id: "notHalal", group: "halal", cats: ["restaurants", "grocery", "cafe", "sweets"], icon: "checkCircle", exclusive: true },
  /* --- alcohol --- */
  { id: "noAlcohol", group: "alcohol", cats: ["restaurants", "grocery", "cafe", "sweets"], icon: "droplet", exclusive: true },
  { id: "servesAlcohol", group: "alcohol", cats: ["restaurants", "grocery", "cafe", "sweets"], icon: "droplet", exclusive: true },
  /* --- health --- */
  { id: "medFamily", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medDental", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medOrthodontics", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medPediatric", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medObgyn", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medDerma", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medEye", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medBones", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medCardio", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medInternal", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medEnt", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medUrology", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medNeuro", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medEndo", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medMental", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medNutrition", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medPhysio", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medUrgent", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medLab", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medImaging", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medPharmacy", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medOptical", group: "health", cats: ["doctors"], icon: "stethoscope" },
  { id: "medHearing", group: "health", cats: ["doctors"], icon: "stethoscope" },
  /* --- gender --- */
  { id: "femaleDoctor", group: "gender", cats: ["doctors"], icon: "user" },
  { id: "maleDoctor", group: "gender", cats: ["doctors"], icon: "user" },
  /* --- insurance --- */
  { id: "insMedicaid", group: "insurance", cats: ["doctors"], icon: "shield" },
  { id: "insMedicare", group: "insurance", cats: ["doctors"], icon: "shield" },
  { id: "insMajor", group: "insurance", cats: ["doctors"], icon: "shield" },
  { id: "insSelfPay", group: "insurance", cats: ["doctors"], icon: "shield" },
  /* --- service --- */
  { id: "medSameDay", group: "service", cats: ["doctors"], icon: "clock" },
  { id: "medTelehealth", group: "service", cats: ["doctors"], icon: "clock" },
  /* --- legal --- */
  { id: "immigrationLaw", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawGreenCard", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawCitizenship", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawAsylum", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawDeportation", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawFamily", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawCustody", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawCriminal", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawInjury", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawContracts", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawIncorporation", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawRealEstate", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawBankruptcy", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawEmployment", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawWills", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawTraffic", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawIp", group: "legal", cats: ["lawyers"], icon: "scale" },
  { id: "lawFreeConsult", group: "legal", cats: ["lawyers"], icon: "scale" },
  /* --- finance --- */
  { id: "finTaxPersonal", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finTaxBusiness", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finBookkeeping", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finLlc", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finPayroll", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finAudit", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finConsulting", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finItin", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "finIrs", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insAuto", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insHome", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insHealth", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insLife", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insCommercial", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insTravel", group: "finance", cats: ["finance"], icon: "banknote" },
  { id: "insRenters", group: "finance", cats: ["finance"], icon: "banknote" },
  /* --- beautySvc --- */
  { id: "bsBarber", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsWomenSalon", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsBrows", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsHenna", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsBridalMakeup", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsBridalHair", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsSkincare", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsNails", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsLaser", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsSpa", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  { id: "bsKidsCut", group: "beautySvc", cats: ["beauty"], icon: "sparkles" },
  /* --- gender --- */
  { id: "women", group: "gender", cats: ["beauty"], icon: "user" },
  { id: "men", group: "gender", cats: ["beauty"], icon: "user" },
  { id: "familyPlace", group: "gender", cats: ["beauty"], icon: "user" },
  /* --- autoSvc --- */
  { id: "autoMechanic", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoElectric", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoBody", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoGlass", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoTires", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoWash", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoAudio", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoAc", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoInspection", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoParts", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoUsed", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoNew", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoFinance", group: "autoSvc", cats: ["auto"], icon: "car" },
  { id: "autoTow", group: "autoSvc", cats: ["auto"], icon: "car" },
  /* --- reSvc --- */
  { id: "reSales", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "reRent", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "rePropertyMgmt", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "reCommercial", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "reMortgage", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "reContracting", group: "reSvc", cats: ["realestate"], icon: "building" },
  { id: "reAppraisal", group: "reSvc", cats: ["realestate"], icon: "building" },
  /* --- homeSvc --- */
  { id: "hsHandyman", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsPlumbing", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsElectric", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsHvac", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsCarpentry", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsPainting", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsFlooring", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsStone", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsRoofing", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsCleaning", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsPest", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsMoving", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsIronDoors", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsCameras", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsLandscaping", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsPools", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  { id: "hsAppliance", group: "homeSvc", cats: ["homeservices"], icon: "wrench" },
  /* --- homeGoods --- */
  { id: "hgRugs", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgFurniture", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgHousewares", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgMajlis", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgCurtains", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgLighting", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgKitchens", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  { id: "hgCookware", group: "homeGoods", cats: ["homegoods"], icon: "sofa" },
  /* --- schooling --- */
  { id: "eduIslamicSchool", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "schoolArabic", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduDaycare", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "quranSchool", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduArabicLang", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "tutoring", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduRemedial", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduDriving", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduEnglish", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduComputer", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduTestPrep", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduCollegePrep", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "eduVocational", group: "schooling", cats: ["education"], icon: "graduation" },
  { id: "weekendClass", group: "schooling", cats: ["education"], icon: "graduation" },
  /* --- travelSvc --- */
  { id: "trvHajj", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  { id: "trvTickets", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  { id: "trvVisas", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  { id: "trvGroupTours", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  { id: "trvHotels", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  { id: "trvInsurance", group: "travelSvc", cats: ["travel"], icon: "navigation" },
  /* --- worshipKind --- */
  { id: "wkMosque", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkMusalla", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkIslamicCenter", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkCoptic", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkAntiochian", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkCatholic", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkMelkite", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkEvangelical", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkBaptist", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  { id: "wkCultural", group: "worshipKind", cats: ["worship"], icon: "landmark" },
  /* --- worship --- */
  { id: "womensPrayer", group: "worship", cats: ["worship"], icon: "users" },
  { id: "arabicClasses", group: "worship", cats: ["worship"], icon: "users" },
  { id: "wfMultiJumuah", group: "worship", cats: ["worship"], icon: "users" },
  { id: "wfKhutbahAr", group: "worship", cats: ["worship"], icon: "users" },
  { id: "wfKhutbahEn", group: "worship", cats: ["worship"], icon: "users" },
  { id: "wfMassAr", group: "worship", cats: ["worship"], icon: "users" },
  { id: "wfFuneral", group: "worship", cats: ["worship"], icon: "users" },
  /* --- grocerySvc --- */
  { id: "grHalalButcher", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grArabGrocery", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grSupermarket", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grBakery", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grSpices", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grFish", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grProduce", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grTurkish", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grEgyptian", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grLevantine", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grMaghrebi", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grDesi", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grQurbani", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grNuts", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grHoneyDates", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  { id: "grWholesale", group: "grocerySvc", cats: ["grocery"], icon: "bag" },
  /* --- cafeSvc --- */
  { id: "cfCafe", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfYemeniCoffee", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfTurkishCoffee", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfSpecialty", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfHookahLounge", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfHookahShop", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfTeaSnacks", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  { id: "cfMatches", group: "cafeSvc", cats: ["cafe"], icon: "coffee" },
  /* --- sweetsSvc --- */
  { id: "swKnafeh", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swBaklava", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swMoroccan", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swArabBakery", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swManakish", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swCakes", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swIceCream", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swChocolate", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  { id: "swNutRoastery", group: "sweetsSvc", cats: ["sweets"], icon: "cake" },
  /* --- shopSvc --- */
  { id: "shAbaya", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shModest", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shOccasionDress", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shMenswear", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shKidswear", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shTailoring", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shAlterations", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shJewelry", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shWatches", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shPerfume", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shCosmetics", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  { id: "shGifts", group: "shopSvc", cats: ["shopping"], icon: "shirt" },
  /* --- occasionSvc --- */
  { id: "ocHall", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocPartyPlanning", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocDecor", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocPhotoVideo", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocRentals", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocStageLighting", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocDjBand", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocZaffa", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocCatering", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocInvitations", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  { id: "ocDressRental", group: "occasionSvc", cats: ["occasions"], icon: "sparkles" },
  /* --- elecSvc --- */
  { id: "elPhoneSales", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elPhoneRepair", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elUnlock", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elPlans", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elComputers", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elAppliances", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elArabTv", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  { id: "elCameras", group: "elecSvc", cats: ["electronics"], icon: "smartphone" },
  /* --- communitySvc --- */
  { id: "cmCharity", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmRefugee", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmFuneral", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmIslamicBookstore", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmCulturalClub", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmProfessional", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmNotary", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmMailParcel", group: "communitySvc", cats: ["community"], icon: "users" },
  { id: "cmPrinting", group: "communitySvc", cats: ["community"], icon: "users" },
  /* --- gymSvc --- */
  { id: "gymWomenOnly", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gymWomenHours", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gymMen", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gymMixed", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gyBoxing", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gySwimming", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gyYoga", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  { id: "gyPersonalTrainer", group: "gymSvc", cats: ["gyms"], icon: "dumbbell" },
  /* --- newcomer --- */
  { id: "certTranslation", group: "newcomer", cats: "*", icon: "languages" },
  { id: "moneyTransfer", group: "newcomer", cats: "*", icon: "languages" },
  { id: "shipAbroad", group: "newcomer", cats: "*", icon: "languages" },
  /* --- language --- */
  { id: "arabicSpoken", group: "language", cats: "*", icon: "languages" },
  /* --- practical --- */
  { id: "delivery", group: "practical", cats: "*", icon: "check" },
  { id: "parking", group: "practical", cats: "*", icon: "check" },
  { id: "wifi", group: "practical", cats: "*", icon: "check" },
  { id: "accessible", group: "practical", cats: "*", icon: "check" },
  { id: "familySeating", group: "practical", cats: "*", icon: "check" },
  { id: "prByAppt", group: "practical", cats: "*", icon: "check" },
  { id: "prOpenSat", group: "practical", cats: "*", icon: "check" },
  { id: "prOpenSun", group: "practical", cats: "*", icon: "check" },
  { id: "acceptsCard", group: "practical", cats: "*", icon: "creditCard", exclusive: true },
  { id: "cashOnly", group: "practical", cats: "*", icon: "creditCard", exclusive: true },
  /* --- ramadan --- */
  { id: "ramadanHours", group: "ramadan", cats: "*", icon: "moon", season: "ramadan" },
  { id: "iftar", group: "ramadan", cats: ["restaurants", "worship", "cafe"], icon: "utensils", season: "ramadan" },
  { id: "suhoor", group: "ramadan", cats: ["restaurants", "worship", "cafe"], icon: "sunrise", season: "ramadan" },
]);

/* ============================================================
   Three layers of visibility
   ------------------------------------------------------------
   With three hundred specialities defined, showing them all would
   bury the screen. So: a chip above the results only once the
   attribute actually has CHIP_MIN businesses in the category being
   viewed; the filter sheet whenever it has at least one; and the
   add/edit form always, empty or not.

   The consequence is the point of it: a user never meets a filter
   that returns nothing, and a new speciality surfaces by itself the
   day it has content — with no code change at all.
   ============================================================ */
export const CHIP_MIN = 5;

export const EVENT_TYPES = [
  { id: "concert",    key: "evTypeConcert",     icon: "play" },
  { id: "festival",   key: "evTypeFestival",    icon: "sparkles" },
  { id: "lecture",    key: "evTypeLecture",     icon: "graduation" },
  { id: "iftar",      key: "evTypeIftar",       icon: "moon" },
  { id: "bazaar",     key: "evTypeBazaar",      icon: "bag" },
  { id: "sports",     key: "evTypeSports",      icon: "dumbbell" },
  { id: "kids",       key: "evTypeKids",        icon: "users" },
  { id: "charity",    key: "evTypeCharity",     icon: "heart" },
  { id: "community",  key: "evTypeCommunity",   icon: "users" },
  { id: "national",   key: "evTypeNational",    icon: "flag" },
  { id: "conference", key: "evTypeConference",  icon: "message" },
];

export function attrById(id) { return ATTRIBUTES.find(a => a.id === id) || null; }

/** does this attribute belong on a business in `cat`? */
export function attrInCat(attr, cat) {
  return attr.cats === '*' || (Array.isArray(attr.cats) && attr.cats.includes(cat));
}

/* Which attributes earn a chip is no longer declared here: it is counted from
   the data by `quickAttrsForCat` in store.js against CHIP_MIN. */

export const BUSINESSES = [
  {
    id: 'b1', name: { ar: 'مطعم الشام', en: 'Al Sham Restaurant' }, cat: 'restaurants',
    phone: '(713) 555-0142', address: '6821 Hillcroft Ave, Houston, TX 77081',
    // trades past midnight on the weekend — the case open/closed maths gets wrong
    hours: week({ all: '11:00-23:00', fri: '11:00-02:00', sat: '11:00-02:00' }),
    tags: ['شاورما', 'مشاوي', 'فلافل', 'حمص', 'مقبلات', 'توصيل',
           'shawarma', 'grill', 'falafel', 'hummus', 'mezze', 'delivery'],
    attributes: ['cuisSyrian', 'cuisLebanese', 'dishShawarma', 'dishGrill', 'svcCatering', 'svcLateNight',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'delivery', 'familySeating', 'acceptsCard', 'parking', 'iftar', 'ramadanHours'],
    plan: 'paid', verified: true, rating: 4.8, reviewCount: 126, dist: 1.2, claimed: true,
    desc: { ar: 'مطبخ شامي أصيل من ٢٠٠٤ — مشاوي، شاورما، ومقبلات بيتية.', en: 'Authentic Levantine kitchen since 2004 — grills, shawarma and homemade mezze.' },
    photos: 8, videos: 2,
  },
  {
    id: 'b2', name: { ar: 'فرن بيروت', en: 'Beirut Bakery' }, cat: 'sweets',
    phone: '(281) 555-0198', address: '10920 Westheimer Rd, Houston, TX 77042',
    hours: week({ all: '07:00-21:00', sun: '08:00-15:00' }),
    tags: ['مناقيش', 'زعتر', 'معجنات', 'حلويات', 'كنافة', 'خبز',
           'manakish', 'zaatar', 'pastries', 'sweets', 'knafeh', 'bread'],
    attributes: ['swArabBakery', 'swManakish', 'swKnafeh', 'halalMeat', 'noAlcohol', 'arabicSpoken', 'acceptsCard', 'suhoor'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 3.4, claimed: false,
    desc: { ar: 'مناقيش، معجنات، وحلويات عربية طازجة.', en: 'Manakish, pastries and fresh Arabic sweets.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b3', name: { ar: 'عيادة النور الطبية', en: 'Al Noor Medical Clinic' }, cat: 'doctors',
    phone: '(713) 555-0177', address: '9440 Bellaire Blvd, Houston, TX 77036',
    hours: week({ all: '09:00-18:00', fri: null }),
    tags: ['طب عائلي', 'باطنية', 'أطفال', 'تطعيمات', 'فحص سنوي',
           'family medicine', 'internal', 'pediatrics', 'vaccines', 'checkup'],
    attributes: ['medFamily', 'medInternal', 'medPediatric', 'medSameDay',
                 'femaleDoctor', 'maleDoctor', 'arabicSpoken', 'insMedicaid', 'insMajor', 'insSelfPay', 'acceptsCard', 'parking', 'accessible'],
    plan: 'paid', verified: true, rating: 4.9, reviewCount: 88, dist: 2.3, claimed: true,
    desc: { ar: 'طب عائلي وباطنية — الطاقم يتكلم عربي وإنجليزي.', en: 'Family & internal medicine — Arabic and English speaking staff.' },
    photos: 5, videos: 1,
  },
  {
    id: 'b4', name: { ar: 'مكتب الهدى للمحاماة', en: 'Al Huda Law Office' }, cat: 'lawyers',
    phone: '(832) 555-0110', address: '2500 Wilcrest Dr, Houston, TX 77042',
    hours: week({ mon: '09:00-17:00', tue: '09:00-17:00', wed: '09:00-17:00', thu: '09:00-17:00', fri: '09:00-13:00' }),
    tags: ['هجرة', 'جرين كارد', 'جنسية', 'لجوء', 'ترجمة معتمدة', 'قضايا أسرة',
           'immigration', 'green card', 'citizenship', 'asylum', 'certified translation', 'family law'],
    attributes: ['immigrationLaw', 'lawGreenCard', 'lawCitizenship', 'lawAsylum', 'lawFamily', 'lawFreeConsult',
                 'arabicSpoken', 'certTranslation', 'acceptsCard', 'parking', 'wifi'],
    plan: 'paid', verified: true, rating: 4.7, reviewCount: 41, dist: 4.1, claimed: true,
    desc: { ar: 'هجرة، أعمال، وقضايا الأسرة.', en: 'Immigration, business and family law.' },
    photos: 3, videos: 0,
  },
  {
    id: 'b5', name: { ar: 'سوبرماركت البركة', en: 'Al Baraka Supermarket' }, cat: 'grocery',
    phone: '(713) 555-0165', address: '5711 Hillcroft St, Houston, TX 77036',
    hours: week({ all: '08:00-22:00' }),
    tags: ['لحوم حلال', 'ذبيحة', 'خضار', 'بهارات', 'جبنة', 'زيتون', 'تمر',
           'halal meat', 'butcher', 'produce', 'spices', 'cheese', 'olives', 'dates'],
    attributes: ['grHalalButcher', 'grArabGrocery', 'grSpices', 'grNuts', 'grHoneyDates',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'delivery', 'acceptsCard', 'parking', 'accessible', 'ramadanHours'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 0.8, claimed: false,
    desc: { ar: 'لحوم حلال، خضار، ومنتجات مستوردة.', en: 'Halal meat, produce and imported goods.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b6', name: { ar: 'الأمانة للسيارات', en: 'Al Amana Auto' }, cat: 'auto',
    phone: '(281) 555-0133', address: '12105 Bissonnet St, Houston, TX 77099',
    hours: week({ all: '08:00-19:00', sun: null }),
    tags: ['ميكانيكا', 'زيت', 'فرامل', 'كهرباء سيارات', 'سيارات مستعملة', 'فحص',
           'mechanic', 'oil change', 'brakes', 'auto electric', 'used cars', 'inspection'],
    attributes: ['autoMechanic', 'autoElectric', 'autoAc', 'autoUsed', 'autoInspection',
                 'arabicSpoken', 'acceptsCard', 'parking'],
    plan: 'paid', verified: true, rating: 4.5, reviewCount: 63, dist: 5.6, claimed: true,
    desc: { ar: 'صيانة، ميكانيكا، وبيع سيارات مستعملة مضمونة.', en: 'Service, mechanics and warrantied used cars.' },
    photos: 6, videos: 3,
  },
  {
    id: 'b7', name: { ar: 'صالون ليان', en: 'Layan Beauty Salon' }, cat: 'beauty',
    phone: '(832) 555-0121', address: '8300 W Airport Blvd, Houston, TX 77071',
    // shuts for a midday break — the two-span case
    hours: week({ all: ['10:00-14:00', '16:00-20:00'], mon: null }),
    tags: ['قص شعر', 'صبغة', 'مكياج', 'عرايس', 'حناء', 'عناية بالبشرة', 'أظافر',
           'haircut', 'color', 'makeup', 'bridal', 'henna', 'skincare', 'nails'],
    attributes: ['bsWomenSalon', 'bsBrows', 'bsHenna', 'bsBridalMakeup', 'bsNails',
                 'women', 'familyPlace', 'arabicSpoken', 'acceptsCard', 'parking'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 2.9, claimed: false,
    desc: { ar: 'قص، صبغة، مكياج مناسبات، وعناية بالبشرة.', en: 'Cuts, color, event makeup and skincare.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b8', name: { ar: 'تكييف وتبريد أبو خالد', en: 'Abu Khaled A/C & Heating' }, cat: 'homeservices',
    phone: '(713) 555-0188', address: '7100 Regency Square Blvd, Houston, TX 77036',
    hours: week({ all: '24h' }),
    tags: ['تكييف', 'تبريد', 'تدفئة', 'صيانة', 'طوارئ', 'تركيب',
           'ac', 'air conditioning', 'heating', 'repair', 'emergency', 'install'],
    attributes: ['hsHvac', 'hsHandyman', 'arabicSpoken', 'cashOnly'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 1.9, claimed: false,
    desc: { ar: 'تركيب وصيانة تكييف — خدمة سريعة.', en: 'A/C install and repair — fast service.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b9', name: { ar: 'مدرسة النهضة العربية', en: 'Al Nahda Arabic School' }, cat: 'education',
    phone: '(281) 555-0144', address: '3110 Eldridge Pkwy, Houston, TX 77082',
    hours: week({ sat: '09:00-14:00', sun: '09:00-14:00' }),
    tags: ['لغة عربية', 'قرآن', 'تحفيظ', 'أطفال', 'دروس', 'نهاية الأسبوع',
           'arabic language', 'quran', 'memorization', 'kids', 'lessons', 'weekend'],
    attributes: ['schoolArabic', 'eduArabicLang', 'quranSchool', 'weekendClass', 'tutoring', 'arabicSpoken', 'parking', 'accessible'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 6.7, claimed: false,
    desc: { ar: 'تعليم اللغة العربية والقرآن للأطفال.', en: 'Arabic language and Quran classes for children.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b10', name: { ar: 'الديار العقارية', en: 'Al Diyar Realty' }, cat: 'realestate',
    phone: '(832) 555-0156', address: '15915 Katy Fwy, Houston, TX 77094',
    hours: week({ all: '09:00-18:00', sun: null }),
    tags: ['بيع', 'إيجار', 'شقق', 'بيوت', 'تجاري', 'استثمار',
           'buy', 'rent', 'apartments', 'homes', 'commercial', 'investment'],
    attributes: ['reSales', 'reRent', 'rePropertyMgmt', 'arabicSpoken', 'acceptsCard', 'parking', 'wifi'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 9.2, claimed: false,
    desc: { ar: 'بيع وشراء وتأجير عقارات سكنية وتجارية.', en: 'Residential and commercial sales and leasing.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b11', name: { ar: 'مسجد الرحمة', en: 'Al Rahma Mosque' }, cat: 'worship',
    phone: '(713) 555-0210', address: '11815 Adel Rd, Houston, TX 77067',
    hours: week({ all: '05:00-22:00' }),
    tags: ['مسجد', 'صلاة', 'جمعة', 'تراويح', 'تحفيظ', 'جنازة',
           'mosque', 'masjid', 'prayer', 'jumuah', 'friday', 'quran'],
    attributes: ['wkMosque', 'wkIslamicCenter', 'wfMultiJumuah', 'wfKhutbahAr', 'wfKhutbahEn',
                 'womensPrayer', 'quranSchool', 'arabicClasses', 'arabicSpoken', 'parking', 'accessible', 'iftar', 'ramadanHours'],
    worship: {
      kind: 'mosque',
      prayers: { fajr: '05:35', dhuhr: '13:15', asr: '16:45', maghrib: '19:52', isha: '21:10' },
      jumuah: ['13:30', '14:30'],
      lang: 'both',
    },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 4.6, claimed: true,
    desc: { ar: 'مسجد ومركز إسلامي — صلوات الخمس، خطبة الجمعة، ومدرسة تحفيظ.', en: 'Mosque and Islamic centre — five daily prayers, Friday sermon and a Quran school.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b12', name: { ar: 'كنيسة السيدة العذراء القبطية', en: 'St Mary Coptic Orthodox Church' }, cat: 'worship',
    phone: '(281) 555-0233', address: '1050 W Sam Houston Pkwy N, Houston, TX 77043',
    hours: week({ all: '09:00-20:00', mon: null }),
    tags: ['كنيسة', 'قداس', 'قبطية', 'أرثوذكسية', 'مدارس أحد', 'تعميد',
           'church', 'mass', 'coptic', 'orthodox', 'sunday school', 'baptism'],
    attributes: ['wkCoptic', 'wfMassAr', 'wfFuneral', 'arabicClasses', 'arabicSpoken', 'parking', 'accessible'],
    worship: {
      kind: 'church',
      mass: [{ day: 0, time: '08:00' }, { day: 3, time: '18:30' }, { day: 6, time: '09:00' }],
      lang: 'both',
    },
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 7.3, claimed: true,
    desc: { ar: 'كنيسة قبطية أرثوذكسية — قداسات بالعربية والإنجليزية ومدارس أحد.', en: 'Coptic Orthodox church — Arabic and English liturgy and Sunday school.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b13', name: { ar: 'نادي الصفا الرياضي', en: 'Al Safa Fitness Club' }, cat: 'gyms',
    phone: '(832) 555-0244', address: '9600 Bellaire Blvd, Houston, TX 77036',
    hours: week({ all: '05:00-23:00', fri: '05:00-12:00' }),
    tags: ['نادي', 'رياضة', 'حديد', 'لياقة', 'أوقات نسائية', 'مدرب',
           'gym', 'fitness', 'weights', 'training', 'women hours', 'coach'],
    attributes: ['gymWomenHours', 'gymMen', 'gyBoxing', 'gyPersonalTrainer', 'arabicSpoken', 'acceptsCard', 'parking', 'wifi', 'accessible'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 1.5, claimed: false,
    desc: { ar: 'نادي رياضي بأوقات نسائية مخصّصة ومدربين معتمدين.', en: 'Fitness club with dedicated women-only hours and certified trainers.' },
    photos: 0, videos: 0,
  },

  /* --- V.02.0: one shop in each of the new categories, and enough
         restaurants for the CHIP_MIN threshold to mean something --- */
  {
    id: 'b14', name: { ar: 'مطعم زيتونة', en: 'Zaytouna Grill' }, cat: 'restaurants',
    phone: '(713) 555-0301', address: '9720 Bissonnet St, Houston, TX 77036',
    hours: week({ all: '11:00-23:00' }),
    tags: ['مشاوي', 'كباب', 'شاورما', 'grill', 'kebab', 'shawarma'],
    attributes: ['cuisLebanese', 'dishGrill', 'dishShawarma', 'svcCatering',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'delivery', 'acceptsCard', 'parking', 'familySeating'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 2.1, claimed: false,
    desc: { ar: 'مشاوي لبنانية على الفحم وتموين مناسبات.', en: 'Lebanese charcoal grills and event catering.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b15', name: { ar: 'مندي الديرة', en: 'Al Deera Mandi' }, cat: 'restaurants',
    phone: '(281) 555-0312', address: '6100 Hillcroft Ave, Houston, TX 77081',
    hours: week({ all: '12:00-23:00', fri: '13:00-00:30' }),
    tags: ['مندي', 'كبسة', 'يمني', 'mandi', 'kabsa', 'yemeni'],
    attributes: ['cuisYemeni', 'cuisGulf', 'dishMandi', 'svcGroupBooking', 'svcWomenSection',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'delivery', 'familySeating', 'acceptsCard'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 3.0, claimed: false,
    desc: { ar: 'مندي وكبسة على الطريقة اليمنية، وجلسات عائلية.', en: 'Yemeni-style mandi and kabsa, with family seating.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b16', name: { ar: 'فلافل القدس', en: 'Al Quds Falafel' }, cat: 'restaurants',
    phone: '(713) 555-0323', address: '5645 Beechnut St, Houston, TX 77096',
    hours: week({ all: '09:00-21:00', sun: null }),
    tags: ['فلافل', 'حمص', 'فطور', 'falafel', 'hummus', 'breakfast'],
    attributes: ['cuisPalestinian', 'dishFalafel', 'svcBreakfast', 'svcTakeout',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'cashOnly', 'parking'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 4.2, claimed: false,
    desc: { ar: 'فلافل وحمص وفطور فلسطيني كل صباح.', en: 'Falafel, hummus and a Palestinian breakfast every morning.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b25', name: { ar: 'بيتزا وبرجر الرافدين', en: 'Rafidain Pizza & Burger' }, cat: 'restaurants',
    phone: '(281) 555-0356', address: '11220 Bellaire Blvd, Houston, TX 77072',
    hours: week({ all: '11:00-23:00', fri: '11:00-01:00', sat: '11:00-01:00' }),
    tags: ['بيتزا', 'برجر', 'عراقي', 'pizza', 'burger', 'iraqi'],
    attributes: ['cuisIraqi', 'dishPizza', 'dishBurger', 'svcTakeout', 'svcLateNight',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'delivery', 'acceptsCard', 'familySeating'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 3.8, claimed: false,
    desc: { ar: 'بيتزا وبرجر بلحم حلال، ودوام متأخر آخر الأسبوع.', en: 'Halal pizza and burgers, open late at weekends.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b17', name: { ar: 'مقهى صنعاء', en: 'Sanaa Coffee House' }, cat: 'cafe',
    phone: '(832) 555-0334', address: '10555 Westheimer Rd, Houston, TX 77042',
    hours: week({ all: '08:00-01:00' }),
    tags: ['قهوة يمنية', 'أرجيلة', 'شاي', 'yemeni coffee', 'hookah', 'tea'],
    attributes: ['cfYemeniCoffee', 'cfHookahLounge', 'cfTeaSnacks', 'cfMatches',
                 'noAlcohol', 'arabicSpoken', 'wifi', 'acceptsCard', 'parking', 'familySeating'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 2.6, claimed: false,
    desc: { ar: 'قهوة يمنية وأرجيلة وبث المباريات.', en: 'Yemeni coffee, hookah and live matches.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b18', name: { ar: 'أزياء نور', en: 'Noor Modest Fashion' }, cat: 'shopping',
    phone: '(713) 555-0345', address: '6464 Hillcroft Ave, Houston, TX 77081',
    hours: week({ all: '11:00-20:00', sun: '13:00-18:00' }),
    tags: ['عبايات', 'حجاب', 'فساتين', 'abaya', 'hijab', 'dresses'],
    attributes: ['shAbaya', 'shModest', 'shOccasionDress', 'shAlterations',
                 'arabicSpoken', 'acceptsCard', 'parking'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 2.2, claimed: false,
    desc: { ar: 'عبايات وحجابات وفساتين مناسبات مع خدمة تعديل.', en: 'Abayas, hijabs and occasion dresses with alterations.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b19', name: { ar: 'مركز الجالية العربية', en: 'Arab Community Center' }, cat: 'community',
    phone: '(713) 555-0356', address: '7212 Wynnwood Ln, Houston, TX 77008',
    hours: week({ all: '09:00-17:00', sat: null, sun: null }),
    tags: ['جمعية', 'ترجمة', 'لاجئين', 'charity', 'translation', 'refugee'],
    attributes: ['cmCharity', 'cmRefugee', 'cmNotary', 'certTranslation',
                 'arabicSpoken', 'parking', 'accessible', 'wifi'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 5.4, claimed: false,
    desc: { ar: 'دعم الوافدين الجدد، ترجمة معتمدة، وخدمات كاتب عدل.', en: 'Newcomer support, certified translation and notary services.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b20', name: { ar: 'مكتب الأمين للضرائب', en: 'Al Amin Tax & Accounting' }, cat: 'finance',
    phone: '(281) 555-0367', address: '3050 Post Oak Blvd, Houston, TX 77056',
    hours: week({ mon: '09:00-18:00', tue: '09:00-18:00', wed: '09:00-18:00', thu: '09:00-18:00', fri: '09:00-15:00' }),
    tags: ['ضرائب', 'محاسبة', 'LLC', 'tax', 'accounting', 'bookkeeping'],
    attributes: ['finTaxPersonal', 'finTaxBusiness', 'finBookkeeping', 'finLlc', 'finItin',
                 'arabicSpoken', 'acceptsCard', 'parking', 'wifi'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 6.8, claimed: false,
    desc: { ar: 'ضرائب أفراد وشركات، مسك دفاتر، وتأسيس شركات.', en: 'Personal and business tax, bookkeeping and company formation.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b21', name: { ar: 'قاعة الأندلس للأفراح', en: 'Andalus Wedding Hall' }, cat: 'occasions',
    phone: '(832) 555-0378', address: '12000 Bellaire Blvd, Houston, TX 77072',
    hours: week({ all: '10:00-22:00' }),
    tags: ['قاعة أفراح', 'زفة', 'تصوير', 'wedding hall', 'zaffa', 'photography'],
    attributes: ['ocHall', 'ocDecor', 'ocPhotoVideo', 'ocZaffa', 'ocCatering',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'parking', 'accessible'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 4.8, claimed: false,
    desc: { ar: 'قاعة أفراح تتسع ٤٠٠ ضيف مع تموين وزفة وتصوير.', en: 'A 400-guest wedding hall with catering, zaffa and photography.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b22', name: { ar: 'جوالات الخليج', en: 'Gulf Mobiles' }, cat: 'electronics',
    phone: '(713) 555-0389', address: '8200 S Gessner Rd, Houston, TX 77036',
    hours: week({ all: '10:00-20:00' }),
    tags: ['جوالات', 'صيانة', 'رسيفر', 'phones', 'repair', 'receiver'],
    attributes: ['elPhoneSales', 'elPhoneRepair', 'elUnlock', 'elPlans', 'elArabTv',
                 'arabicSpoken', 'acceptsCard', 'parking'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 1.7, claimed: false,
    desc: { ar: 'بيع وصيانة الجوالات وخطوط وقنوات عربية.', en: 'Phone sales and repair, plans and Arabic TV.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b23', name: { ar: 'بيت السجاد', en: 'The Rug House' }, cat: 'homegoods',
    phone: '(281) 555-0390', address: '14100 Westheimer Rd, Houston, TX 77077',
    hours: week({ all: '10:00-19:00', sun: null }),
    tags: ['سجاد', 'أثاث', 'مجالس', 'rugs', 'furniture', 'majlis'],
    attributes: ['hgRugs', 'hgMajlis', 'hgFurniture', 'hgCurtains',
                 'arabicSpoken', 'acceptsCard', 'parking', 'delivery'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 8.1, claimed: false,
    desc: { ar: 'سجاد شرقي وفارسي وأطقم مجالس عربية.', en: 'Oriental and Persian rugs and Arabic majlis sets.' },
    photos: 0, videos: 0,
  },
  {
    id: 'b24', name: { ar: 'حلويات دمشق', en: 'Damascus Sweets' }, cat: 'sweets',
    phone: '(713) 555-0401', address: '5711 Hillcroft St, Houston, TX 77036',
    hours: week({ all: '09:00-22:00' }),
    tags: ['كنافة', 'بقلاوة', 'حلويات', 'knafeh', 'baklava', 'sweets'],
    attributes: ['swKnafeh', 'swBaklava', 'swChocolate', 'swNutRoastery',
                 'halalMeat', 'noAlcohol', 'arabicSpoken', 'acceptsCard', 'delivery'],
    plan: 'free', verified: false, rating: 0, reviewCount: 0, dist: 1.1, claimed: false,
    desc: { ar: 'كنافة وبقلاوة ومكسرات محمّصة يومياً.', en: 'Knafeh, baklava and nuts roasted daily.' },
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
    id: 'e1', type: 'festival', status: 'live',
    title: { ar: 'مهرجان الأكل العربي — هيوستن', en: 'Arab Food Festival — Houston' },
    startsAt: '2026-10-24T17:00', endsAt: '2026-10-25T22:00',
    venue: { ar: 'مركز جورج آر براون', en: 'George R. Brown Convention Center' },
    city: 'Houston, TX',
    desc: { ar: 'أكثر من ٤٠ مطعماً وكشكاً، وبرنامج موسيقي على مدى يومين، وركن للأطفال.',
            en: 'More than 40 restaurants and booths, a two-day music program and a kids corner.' },
    organizer: { ar: 'جمعية التجار العرب', en: 'Arab Merchants Association' },
    ticketUrl: 'https://example.com/tickets/arab-food-festival',
    icon: 'utensils', photo: '', featured: true,
    // a fixed Gregorian date every year
    repeat: { kind: 'gregorian', spawned: [] },
    source: '', externalId: '', sourceUrl: '',
  },
  {
    id: 'e2', type: 'lecture', status: 'live',
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
    id: 'e3', type: 'bazaar', status: 'live',
    title: { ar: 'سوق رمضان الخيري', en: 'Ramadan Charity Bazaar' },
    startsAt: '2027-02-20T16:00', endsAt: '2027-02-20T23:00',
    venue: { ar: 'مسجد الهدى', en: 'Al Huda Masjid' },
    city: 'Stafford, TX',
    desc: { ar: 'بازار عائلي لدعم صندوق الطلاب، مع مأكولات ومنتجات يدوية.',
            en: 'A family bazaar supporting the student fund, with food and handmade goods.' },
    organizer: { ar: 'مسجد الهدى', en: 'Al Huda Masjid' },
    ticketUrl: '', icon: 'users', photo: '', featured: false,
    // Ramadan moves about eleven days earlier each Gregorian year
    repeat: { kind: 'hijri', spawned: [] },
    source: '', externalId: '', sourceUrl: '',
  },
];

/** A brand-new event record — one place that defines the shape. */
export function blankEvent() {
  return {
    id: '', status: 'pending', type: 'community',
    title: { ar: '', en: '' }, startsAt: '', endsAt: '',
    venue: { ar: '', en: '' }, city: '',
    desc: { ar: '', en: '' }, organizer: { ar: '', en: '' },
    ticketUrl: '', icon: 'calendar', photo: '', featured: false,
    // filled in only for type 'concert'
    concert: null,          // { artist, doorsAt, priceFrom, ageLimit, familySeating }
    // an event that comes round every year, by one calendar or the other
    repeat: null,           // { kind: 'gregorian' | 'hijri', spawned: [year, …] }
    source: '', externalId: '', sourceUrl: '',
  };
}

/**
 * A yearly event moves differently depending on which calendar it belongs to:
 * Independence Day is on the same Gregorian date every year, while Ramadan and
 * the two Eids arrive about eleven days earlier each Gregorian year. Getting
 * that wrong by a fortnight would be worse than not repeating at all.
 */
export const HIJRI_YEAR_DAYS = 354.367;
export function nextOccurrence(iso, kind) {
  const base = new Date(iso);
  if (isNaN(base)) return '';
  const next = new Date(base);
  if (kind === 'hijri') next.setDate(next.getDate() + Math.round(HIJRI_YEAR_DAYS));
  else next.setFullYear(next.getFullYear() + 1);
  // keep the local wall-clock time rather than drifting with the timezone
  const pad = (n) => String(n).padStart(2, '0');
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`
       + `T${pad(next.getHours())}:${pad(next.getMinutes())}`;
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
