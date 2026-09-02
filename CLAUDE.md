# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

⚠️ وقبله: `CLAUDE_PROJECT_MEMORY.md` في الجذر — ذاكرةُ المشروع الدائمة.
   يُقرأ كاملاً قبل أيّ مهمّة، ويُحدَّث بعد كلّ قرارٍ أو تعديلٍ بلا أن يُطلَب.
   وعند تعارضه مع أيّ ملفٍّ آخر فهو المعتمَد، ثمّ يُصحَّح الآخر فوراً.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + marketplace + events + magazine**, Arabic-first with a full English toggle.
("Classifieds / الإعلانات الشخصية" is now "Marketplace / السوق" — the old `#/classifieds`
routes still resolve so shared links keep working.)
Current version: **V.08.7 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

## Hard rules (from the product brief)
1. **One repository, one Vercel project.** No duplicates, no stray preview projects.
2. **Never break a working feature while building another.** If a new request conflicts with
   something already built, stop and explain the conflict instead of silently deleting it.
3. **Every section must have a monetization path** (see table below).
4. **Arabic-first, English toggle** — every UI string exists in both languages in `js/i18n.js`.
   Use logical CSS properties (`inset-inline-start`, `margin-inline`), never hardcoded left/right.
5. **The logo is a fixed asset** (`assets/logo.png` / `logo-sm.png`) — never recreate it with
   text, emoji or CSS. It must render centered, correct aspect ratio, no white box.
6. Version tags: V.01, V.02, … Never overwrite a working version without preserving it.
7. **No blank screens** — every empty list has a designed empty state.
8. **ذاكرةُ المشروع ملفٌّ لا جلسة.** `CLAUDE_PROJECT_MEMORY.md` يُقرأ قبل العمل
   ويُحدَّث بعده. وكلُّ قرارٍ أو خطأٍ أو وعدٍ أو متطلَّبٍ يُكتب فيه لحظتَه —
   وما لا يُكتب يُنسى ويُبنى عليه خطأً.
9. **سجلُّ المصدر وقائمةُ المكوّنات ملفّان في المستودع**: `docs/AI-PROVENANCE.md`
   يُولَّد ولا يُكتب، و`docs/SBOM.md` يُعاد قياسُه يومَ يُضاف مكوّنٌ أو خطٌّ أو
   خدمةٌ خارجيّة — ولا يدخل البرنامجَ مكوّنٌ بلا سطرٍ فيه.

## Stack
Zero dependencies. Plain ES modules + one CSS file. No build step — Vercel serves it statically.
The only external resource is the IBM Plex Sans Arabic font from Google Fonts.

```
index.html            app shell (header / main / bottom nav)
vercel.json           deploy config + security headers
styles/app.css        the whole design system
assets/               official logo (transparent) + icon
js/app.js             hash router + bootstrap
js/i18n.js            all UI strings (ar + en)
js/data.js            seed data — replaced by Supabase queries in V.02
js/store.js           state, entitlements, and ALL backend seams
js/prayer.js          the prayer-time arithmetic — no API, no library
js/feasts.js          Easter (both), the movable feasts, and the estimated Hijri dates
js/synonyms.js        the search dictionary — expands the QUERY, never the data
tools/synonyms.test.mjs  runs all 984 words against the real listings
tools/e2e/               the Playwright suites, v3–v50, plus run.sh and the i18n check
tools/build_single.py    generates index-single-file.html from the sources
js/ui.js              toast / sheet / drawer / header / nav primitives
js/icons.js           inline SVG icons
js/screens/*.js       home · categories · directory · marketplace · events · magazine ·
                      auth · advertise · profile · admin · prayer
manifest.json         PWA manifest (installable; NO service worker until V.02)
assets/icons/         32 · 180 · 192 · 512 · 1024 icons generated from logo.png,
                      solid navy background (iOS rejects transparency)
index-single-file.html  generated single-file build (backup / offline demo)
```

## Design language
**Two themes, one set of symbols** (V.02.5): every colour is a role, never a
value. Dark — page `#0E1829` · bar `#131F39` · surface `#1C2A50` / `#263764`.
Light — page `#EFE8DA` · bar and surface `#FFFDF8` / `#F6EFE1`.
Gold `#C6A15B` / `#E4C77E` · ivory `#F3F1EC` · muted `#8B93AC` in dark;
the light theme darkens gold and green for contrast on ivory.
Base font-size 16px, generous spacing, large tap targets (buttons ≥ 52px).
Icons are sized inline via `icon('name', size)`.

## Monetization map
| Section | Revenue |
|---|---|
| Home main slider | highest-priced ad placement ($149+/week) |
| Home mini banner | cheaper ad tier ($49+/month); fixed 62px box, capped at `AD_SLOTS.mini` |
| Category slider | `catSlider` — the same strip at the top of one category page ($69+/week), 4 slots per category |
| Directory | $29/month business subscription — unlimited photos + video, eligibility for the gold badge, category ranking, "featured this week", **"your page, only yours"**, stats, **offers (built V.03.2)**. **Reviews are NOT on it** (see below) |
| Marketplace | free + paid "Boost" ($2–8); the Handyman section caps at 1 listing / 14 days and upsells the directory subscription |
| Magazine | native banners between articles + sponsored stories ($199+) |
| Events | "Featured Event" pin at the top of the section ($99+/week, `AD_PRODUCTS.event`) |
| Accounts | paid blue verification badge — price lives in `VERIFY_BADGE_PRICE` (currently 0 = free while unpriced) |
| Every placement | inventory is capped in `AD_SLOTS`; a full one takes a waiting-list entry rather than losing the buyer |
| Outings | the ticketed half — trampolines, indoor playgrounds, rinks, museums, water parks — pays the same $29 directory subscription; the free public places carry `nonCommercial` and are deliberately outside every commercial surface |

## Auth tiers (do not weaken these)
- Tier 1 — email + verification code: browse, save favorites, write a review.
- Tier 2 — **real mobile number**: post a classified, contact a seller, claim/subscribe a
  business, buy any ad. VOIP and landline numbers are rejected **before** the OTP is sent.
- Any gated action started while logged out must be remembered and resumed after signup
  (`setPendingIntent` / `takePendingIntent` in `store.js`).

## V.02 — where the real services plug in (all inside `js/store.js`)
| Service | Function to replace |
|---|---|
| Supabase (DB + auth) | `signUp`, `confirmEmail`, `allBusinesses`, `allClassifieds`, `addClassified` … |
| Twilio Lookup (line type) | `lookupLineType` |
| Twilio Verify (OTP) | `sendSmsCode`, `sendEmailCode` |
| Stripe (payments) | `chargeCard`, `subscribeBusiness` |
| Cloudflare R2 (media) | `mountPhotoPicker` / `compressImage` in `screens/marketplace.js` — today the picker downscales to 1200px and stores a data URL in localStorage; V.02 uploads the same blob and stores the URL |
| Geocoding | `lookupZip` + `reverseGeocode` in `screens/home.js` (ZIP table + api.zippopotam.us; coordinates via BigDataCloud → Nominatim) |
| Moderation service | `scanMessage`, `violatesFreeRule`, `stripPhones` in `store.js` — on-device now, same call signature against the real service later |

### Events
Seed events in `data.js`; admin edits layer on top via `state.eventEdits` so the seed file
stays a clean import target. Every event carries **`source` / `externalId` / `sourceUrl`** —
empty today, filled in V.02 by the Ticketmaster Discovery API and ICS calendar feeds from
masjids and centers. Organizers propose (`status: 'pending'`), the admin approves, edits,
features or deletes. Finished events hide themselves (`eventIsPast`), and the list is sorted
soonest-first with any featured event pinned.

### Accounts
`state.user` carries `joined`, `password`, `avatar {url,status}` and `badge {status}`.
The profile photo and the verification badge both go through the admin queue; until a photo
is approved the user's initial is shown. Changing the phone number is the only edit that
resets `phoneVerified`.

### Marketplace rules (enforced in `store.js`, never hardcoded in screens)
`catRule(catId)` returns the per-section limits. Handyman = 1 active listing / 14 days.
Free stuff = price pinned to "مجاني"; a **new** listing with price wording is refused outright,
while an **edit** that adds a price is published back into the review queue with a flag.
Phone numbers are stripped from marketplace titles, descriptions and private messages
(`stripPhones`, Arabic-Indic digits included) — the business directory is exempt on purpose.
Every user listing starts `status: 'pending'`: visible to its owner immediately, invisible to
everyone else until `approveClassified`. `rejectClassified(id, reason)` delivers the admin's
written reason to the owner. A half-finished post (text *and* compressed photos) is parked in
`state.draft` before any verification detour and the publish resumes automatically afterwards.
Private messages run through `scrubContact`, which removes digits, digits spelled out as words
("seven one three"), email addresses and WhatsApp links, and reports repeat offenders.

Screens never touch storage directly — they only call `store.js`.

## Demo credentials (prototype only)
Verification code `123456` (the verify screen shows it and has a "fill demo code" button) ·
accepted mobile `(713) 466-9182` · rejected as VOIP: anything starting 555/800/888 ·
admin panel reachable **only** by typing `#/admin` (not linked from the drawer or profile).
**No staff password ships any more (V.03.6)** — the first `#/admin` on a device asks the owner
to set one, and only its salted SHA-256 is kept in `state.adminAuth`. The username compare is
case-insensitive + trimmed so iOS auto-capitalisation cannot lock you out · payments are
simulated.

## Interface rules (V.01.4 — simplification pass)
Nothing is shown unless the user needs it at that moment; anything advanced or
rare opens with one tap.
- **Header** carries the menu button and the logo only, with a 44px spacer opposite
  the menu so the logo is optically centred in both directions. Language and
  notifications live in the drawer.
- **One search row** per listing screen: field + compact city chip + filter button.
  The radius lives inside the location sheet.
- **Home order** is categories → paid slider → featured → mini banner → magazine.
  Five one-word categories (`shortKey` in `data.js`), 56px circles.
- **Directory** has no second tab bar and no redundant title; the $29 upsell is a
  normal-height row after the first five results. Business cards carry icon, name +
  verified, rating/reviews/distance and a call button — the written phone and the
  directions button live on the detail page.
- **`openFilterSheet()` in `ui.js`** is the single filter surface (category · radius ·
  sort · price on the marketplace) with apply / clear-all and a count on the button.
- **Notifications** split into "جديد / New" and "أقدم / Earlier"; opening the screen
  never bulk-marks them read — a notification is read when it is tapped, and every
  one carries a `route` so no tap is a dead end.

## Navigation rules (V.01.5 — the drawer, the visitor, and branching)
Two rules govern **every** menu, chip row and category grid, not just the drawer.

**1. A group head opens, it never navigates.** Tapping the head of a drawer group
expands it in place; the head carries no `data-route`. It follows that no screen may
exist just to re-print a list that is already in the drawer — that is why the profile
screen no longer holds link rows.

**2. Every leaf lands on itself, pre-filtered.** "Cars" opens the marketplace already
on Cars, not on "All". Three details make a filtered arrival believable and all three
are required: the section chip is `active`, it is brought into view with a horizontal
`scrollIntoView`, and `sectionNote()` in `ui.js` prints one line above the results
naming the section and the count.

- **`isMember()` in `store.js` is the single source of truth** for account holder vs.
  visitor. The drawer, the profile screen and the nav all ask it; no screen decides
  for itself, so they can never disagree.
- **The drawer has two versions.** Member: user head · language · **notifications as a
  standalone row with its own badge** · ▸حسابي · ▸أقسام التطبيق · أعلن معنا · ▸المساعدة
  والقوانين · تسجيل الخروج — seven rows, no scrolling, all groups folded, one open at a
  time. **The light/dark flip (V.02.5) is an icon in the head, not a row**: an eighth
  row measured 887px against 844 the moment a group was open, and the drawer's rule is
  that it never scrolls. Visitor: guest head · one invite card (sign up + "have an account?") · language ·
  ▸أقسام التطبيق · أعلن معنا · ▸المساعدة والقوانين.
- **A visitor never sees an account tool.** Notifications, the حسابي group, settings and
  sign-out are *removed from the tree*, not greyed out — a row that only bounces you to
  a sign-up screen makes the app feel broken. أعلن معنا stays visible on purpose: it is a
  pricing page, and the gate is at payment.
- **أقسام التطبيق lists الرئيسية and الدليل too.** They are in the bottom bar as well, but
  the drawer has to be a complete index; the group is folded, so it costs no screen space.
- **Personal screens guard themselves** (`memberOnly` in `screens/profile.js`, `requireTier`
  in `MessagesScreen`): a session that ends while one is open redirects to the missing
  step and resumes there, instead of painting an empty list.
- **`#/profile` is an identity card, not a link list**: avatar, name + badge, tier, email,
  phone with its verified mark, join date, a one-line "verify your number" prompt when the
  phone is unverified, three **tappable** counters (`#/my-ads`, `#/saved`, `#/my-reviews`)
  and the edit / change-password buttons. Sign-out lives in the drawer only.

## Pricing visibility (V.01.6)
**A visitor never sees a price we charge.** `showsPrices()` in `ui.js` (which is
`isMember()`) gates every commercial figure: ad placements, the $29 directory
subscription, marketplace boosts, the verification badge. The screen, the layout
and the copy are identical for both — only the numbers appear or don't, so there
is no second flow to keep in sync.

- **`priceGate(returnRoute, labelKey)` + `wirePriceGates(root)`** render the line
  and the gold button that stand where a price would be. The button calls
  `requireTier(1, returnRoute, go)`, so signing up returns the user to the exact
  screen — and, on `#/advertise`, to the exact package — they were looking at.
- **The pending intent carries its tier** (`setPendingIntent(route, label, tier)`).
  Guessing the tier from the route broke once `#/advertise` became browsable at
  tier 1: the same URL means "read the prices" or "pay", so only the intent knows.
- **The one exception is marketplace item prices** — a $14,500 car, a $650 sofa,
  "مجاني". Those are content, not our pricing, and are never hidden.
- **Ad packages sort cheapest-first** from `prices.week1` (`ORDERED` in
  `advertise.js`), and the cheapest is preselected, so the first number a shop
  owner sees is the smallest.
- **A package opens where it stands** — one at a time, same accordion idiom as the
  drawer — showing four benefit lines and a CSS phone wireframe (`placement()`)
  with that product's slot lit in gold and labelled «إعلانك هنا». No separate
  detail page and no comparison table: the flow is four sequential steps, and the
  four products live in different places, so most comparison cells would read
  "n/a".
- **«مش عارف أيّهم يناسبك؟»** opens a four-line guide sheet; each line selects and
  expands its package. It carries no prices, for visitor and member alike.

## Installed-app chrome (V.01.7)
`viewport-fit=cover` plus `black-translucent` means the installed app owns the
whole screen, clock row included, so the page reserves that strip itself.
`--safe-top` / `--safe-bottom` in `:root` resolve to `0px` in a browser, so
nothing about the browser layout changes.

- `.app-header` is `height: calc(var(--header-h) + var(--safe-top))` with the
  inset as top padding; the absolutely-placed logo centres on
  `calc(var(--safe-top) + var(--header-h) / 2)` so it sits in the visible half,
  not the middle of the padded box.
- `@media (display-mode: standalone)` drops `--header-h` to 72px (logo 54px), so
  installed the bar totals 72 + 59 = 131px instead of 151px. **It must stay after
  the base `.h-logo` rule** — equal specificity, so source order decides.
- `.drawer-panel` and `.toast-root` reserve the same inset; `.dr-version` reserves
  `--safe-bottom`. Chromium cannot emulate `display-mode`, so this is verified by
  applying the same variables and checking the geometry.

## Drawer look (V.01.7)
The rule the drawer kept breaking: **an accent that marks everything marks
nothing.** Gold appears in exactly two places — the invite card's sign-up button
and the `.dr-accent` icon on «أعلن معنا», the revenue row. Everything else is
`rgba(243,241,236,.55)`.

- **No `Home` row.** The app opens on it and it holds a permanent bottom-bar tab;
  listing it made the drawer read like a website menu. (A deliberate reversal of
  V.01.5 — do not restore it.) The group is «أقسام عربنا» and its last leaf is
  «كل التصنيفات», so the word "أقسام" appears once.
- **No chevron on leaf rows** — a chevron promises depth, and a column of them is
  noise. `.grp-arrow` on a group head stays: it is the fold indicator.
- **No rule under every row.** One hairline between top-level blocks only. Inside
  an open group, `.dr-sub-inner::before` draws a gold-to-transparent vertical rule
  at `inset-inline-start: 26px` and the rows indent to 40px — that line does the
  grouping work separators used to.
- An open head takes `rgba(255,255,255,.035)` and a turned arrow, never gold text.
- Sub-items step down: 13.8px / 500 / `.72` alpha, 18px icons.
- Panel `min(360px, 86%)`, scrim `rgba(4,8,16,.74)`, version line pinned with
  `margin-block-start: auto` under a hairline.
- **A folded panel is inert**, not merely clipped: `.dr-sub-inner` and
  `.ad-more-inner` carry `visibility: hidden`, because `overflow: hidden` alone
  leaves the children in the tab order and the accessibility tree.

## Advertise: the price is the button (V.01.7)
There is no screen-wide "next" any more — the same action in two places is the
duplication banned everywhere else. Each package's own button lives inside it,
under the benefits and the wireframe: `ابدأ — يبدأ من $49` for a member (number
wrapped in `.ltr`), `شوف السعر وابدأ` plus a one-line note for a visitor.
**Selecting never deselects** — the way forward lives inside the open package, so
an all-folded screen would be a dead end; the cheapest opens by default.

## The business record (V.01.8) — read this before touching `data.js`
**The 486 real listings are now in the file** (V.02.1), so this shape is no
longer merely frozen by intent — changing it means re-entering 486 records by
hand. Treat it as immovable unless there is no choice.

```js
{
  id, name: {ar,en}, cat, phone, address, desc: {ar,en},
  hours: [ null | [['11:00','23:00'], …], …7 ],   // 0 = Sunday, Date#getDay order
  tags: ['شاورما', 'shawarma', …],                 // both languages in one flat list
  attributes: ['halalMeat', 'noAlcohol', …],       // ids only, never booleans
  worship: { kind, prayers, jumuah, mass, lang },  // places of worship only
  nonCommercial, entryPrice,                       // outings; both optional (V.02.1)
  plan, verified, rating, reviewCount, claimed, photos, videos,
  lat, lng, needsGeo,                              // V.02.3; never shown to a reader
  dist,                                            // dead since V.02.3 — nothing reads it
}
```

- **Hours are data, not prose.** Seven entries; `null` is closed, two spans cover
  a midday break, `['00:00','24:00']` is round the clock, and a close earlier
  than its open runs past midnight. `week({all:'11:00-23:00', fri:'11:00-02:00'})`
  in `data.js` builds the canonical array from something readable.
  `openState()` in `store.js` is the only place the maths lives: it inspects
  **yesterday as well as today**, because at 00:30 on Saturday it is Friday's
  span that is still running. Everything else — the pill, "closes within the
  hour", "opens 9am", the `open now` filter, the `open first` sort — reads it.
- **Attributes are a registry, not fields.** `ATTRIBUTES` in `data.js` gives each
  one `cats` (where it applies), `quick` (where it earns a chip above the
  results), `group`, `exclusive` and `season`. The add/edit form, the filter
  sheet and the quick-chip row all build themselves from it, so **a new
  attribute is one line in `data.js` and no code anywhere else**. Never add a
  bespoke boolean column to a business.
- **Never split an attribute into its own category.** One salon serves women and
  men; two categories would list it twice. A family salon must appear under
  "women" and under "men" alike, and the tests assert exactly that.
- **Halal and alcohol are two attributes on purpose.** Much of the community will
  not eat where alcohol is served even when the meat is halal, so one flag could
  not answer the question being asked.
- **Search** matches name + description + address + `tags` + the category name,
  **in both languages whatever the interface is set to** (`matchesSearch` /
  `searchHaystack`). `normalize()` folds case, tatweel, diacritics and
  alef/ya/ta-marbuta variants. `app.js` hands i18n's tables to the store at boot
  via `registerStrings` so the store never imports i18n back.
- **Duplicates** are caught at the door: `findDuplicates()` keys on the last ten
  phone digits first, then name + address. **A missing phone is never a match**
  — if it were, every listing without a number would duplicate every other one,
  so a phoneless row falls through to name + address (in the file and against
  the directory alike) and a row with neither matches nothing. The add form shows the match and
  offers both honest answers. `mergeBusinesses(keep, drop)` in the admin
  directory tab moves reviews, favourites, ownership, tags and attributes across.
- **Seasonal groups** (`season: 'ramadan'`) are hidden until the owner flips one
  switch in admin → settings; `state.seasons` holds it.
- **Twenty-one categories (V.02.1), frozen** — see the list below. Arabic schooling
  and newcomer services stay attribute groups rather than categories, for the
  anti-duplication reason above.

## What the $29 buys, and what it must never buy (V.01.9)
- **Reviews are free on every listing, subscribed or not.** If twenty of three
  hundred shops subscribe, gating reviews leaves 93% of the directory empty and
  nobody has a reason to open the app — and with no users nobody pays. Reviews
  are the content that makes the app worth opening, not a feature to sell.
  `canSeeReviews()` returns true; `PLAN_LIMITS` in `store.js` holds the real
  split (free: 3 photos · paid: unlimited + video).
- **Never print "مجاني" on a business.** The owner reads it as "this one didn't
  pay", and in the marketplace the same word means "costs nothing". A subscriber
  is marked by the row tint and, if verified, the badge; absence is the signal.
- **Paying never verifies anyone.** `businessVerified()` reads an explicit,
  reviewed decision (`state.bizVerify`) and is *never* derived from `plan`. A
  subscription is only the precondition for applying. Two distinct badges:
  **gold "نشاط موثّق"** for a business, **blue** for a personal identity —
  same word for both and nobody could tell them apart.
- **No identity image ever enters this app.** The flow asks for consent in a
  separate checkbox *before* anything is captured (Texas CUBI requires prior
  consent and destruction inside a year; Illinois allows private suits), and
  `runIdentityCheck()` is the Stripe Identity seam: the document and selfie go
  to the provider, and only a pass/fail plus a reference come back. The admin
  review screen therefore shows status and note and says why there is nothing
  to look at.
- **Never import reviews from Google or Yelp, and never seed a fake one.** The
  FTC rule of October 2024 makes the platform itself liable with civil
  penalties. Seed reviews in `data.js` are development data and must be
  cleared before launch.

## Ownership, photos and bulk entry (V.01.9)
- **Claiming is a request.** `claimBusiness()` raises a pending record;
  `approveClaim()` is the only thing that sets `state.myBusinessId`, and both
  outcomes notify the owner. The claim button lives on the business page itself,
  because almost every shop owner arrives there from a link or a search rather
  than from a claim screen.
- **Photos are real and reviewed.** `state.bizPhotos` holds `{url, status}` per
  business through the marketplace's `mountPhotoPicker` / `compressImage` path.
  The first approved one becomes the hero. **A business with no photos renders
  no gallery** — the old `b.photos || 3` invented placeholder squares for a
  feature that did not exist.
- **"Your page, only yours".** Free pages end with `similarTo()` suggestions;
  a subscriber's page shows none. These are never sold: this community is small
  and its owners talk to each other, so "pay to bury your rival" would cost more
  in reputation than it earns.
- **The English name is the required one, the Arabic name is optional.** Most
  Arab-owned shops in Houston trade under an English name — Abdallah's, Fadi's,
  Dimassi's — and that is the name on the shopfront and in people's searches.
  Inventing an Arabic name for them would be worse than having none, so
  `name.ar` falls back to `name.en`, in the importer and in the add/edit form
  alike, and `L()` falls back on an empty side rather than rendering a blank.
- **The importer distinguishes an error from a warning.** Only two columns
  are required: **`name_en` and `category`**. An error blocks the row (no
  English name · no category · unknown category · a phone that is *present
  but unusable*, which is a typo); a warning does not (no phone · no address
  · no Arabic name · no hours · no description · an attribute this build has
  not defined yet, which is dropped with a note). Treating everything as an
  error once made a clean file of 413 shops read as a total failure.
  **Never make an unknown attribute id fatal** — new ones keep being defined,
  and a file must not fail because it is ahead of the code.
- **Bulk import is three steps, because of one constraint:** seed businesses
  live in `js/data.js` (deployed, everyone sees them) while anything saved in
  the app lives in the owner's own localStorage (nobody else ever sees it).
  So `parseBusinessCsv()` reads and checks, the preview names the fault on every
  row, and `toDataFile()` emits text to paste into `data.js` and push. In V.02
  the same screen writes to the database and step three disappears.
  `exportBackup()` dumps the whole state as JSON.

## The twenty-one categories and the speciality tree (V.02.1)
```
restaurants · grocery · worship · cafe · beauty · shopping · community ·
education · sweets · finance · occasions · doctors · auto · homegoods ·
lawyers · travel · electronics · realestate · homeservices · gyms · outings
```
Plus `events`, which is **not** a business category: it carries `route: '#/events'`
and every directory chip row filters it out with `!c.route`. `HOME_CATS` names the
five circles on Home.

- **`homeservices` and `homegoods` never merge.** Someone buying a sofa is
  browsing; someone looking for a plumber has a problem right now. Home services
  is the highest-earning column in any local directory, so it gets chased to be
  filled, not buried in a bigger one.
- **The category is never called "handyman".** A licensed HVAC company will not
  see itself in that word and will not sign up — and those are the ones who pay.
  `hsHandyman` is a speciality *inside* `homeservices`. Not to be confused with
  the marketplace's `handyman` section, which is a free 14-day classified for a
  private individual; the directory page is a permanent listing for a business.
- **342 specialities** live in `ATTRIBUTES`, generated from one table so the
  i18n key is derived from the id (`attr` + Id) and cannot drift. Adding one is a
  line in `data.js` and two in `i18n.js`.

### Three layers of visibility — the rule that keeps 342 specialities usable
| Layer | Shows |
|---|---|
| Quick chips above the results | attributes with **`CHIP_MIN` (5) or more** businesses in the current category, counted live |
| Filter sheet | anything with **at least one** business in that category |
| Add / edit form | **every** attribute defined for the category, empty ones included |

`quickAttrsForCat` / `filterAttrsForCat` / `attrGroupsForCat(cat, {all:true})` in
`store.js`. **Nothing is hand-listed**: a user never meets a filter that returns
nothing, and a new speciality surfaces by itself the day it has content.

## A listing without a phone number (V.02.1)
**The phone is optional, in the importer and in the add/edit form.** Nine of
the 74 Houston outings are city parks and preserves with no direct line at
all (they answer to the parks department), and two shops trade with no
published number. Their absence is a fact about the place, not a fault in
the file — the name, address, map, hours, category and specialities are all
still there, and whoever wants a park wants its location, not its number.

- **No number means no call button** — on the row card and on the detail page
  alike. Never a disabled button and never an empty phone line: a control
  that cannot do anything is worse than no control. The detail page prints a
  quiet «لا يوجد رقم — استخدم الاتجاهات» in the phone row's place.
- The address is optional on the same grounds, and the **directions** button
  and the address row disappear with it. `.action-grid` collapses to a single
  column when only one of the two buttons survives, so it is full width
  rather than half of a missing pair.
- The import preview counts the phoneless rows separately, under the four
  totals, so the operator knows how many listings will publish with no call
  button before pressing go.

## Outings, and the places nobody owns (V.02.1)
`outings` — «ترفيه ونزهات / Outings & Fun» — is the twenty-first category:
parks, preserves, playgrounds indoor and out, splash pads, trampolines, ice
rinks, karting, bowling, arcades, museums, the zoo, the aquarium, beaches,
science centres and trails. Two attribute groups carry it: `outingKind` (18)
and `outingFeature` (15).

- **`outOwnFood` and `outBbq` are the reason the category exists.** "Can we
  bring our own food" and "is there a pit we can grill on" are the first two
  questions an Arab family asks before a day out, and no American listing app
  answers either. They are ordinary attributes, so they filter, chip and
  search like everything else.
- **`nonCommercial` on a business hides every commercial surface from its
  page** — the claim button, the subscription offer, the upgrade card. A city
  park has no owner to claim it and nobody to sell $29 a month to; leaving
  those on Hermann Park reads as a plain bug. `isNonCommercial()` /
  `setNonCommercial()` in `store.js`, a checkbox in the add/edit form, a
  `noncommercial` column in the importer (`1` / `yes` / `true`), and a
  marker in admin → directory that flips an existing listing either way.
- **Paid places stay commercial.** Of the 74 Houston outings ready to import,
  46 are ticketed — trampolines, indoor playgrounds, rinks, museums, water
  parks — and those are real businesses and real advertisers. The flag is for
  the ~28 free ones. Never derive it from the category.
- **`entryPrice` is free text and only shown when entry is not free**, beside
  a standing «الأسعار والأوقات تتغيّر — تأكّد قبل الزيارة». Half of these
  places are seasonal and change their gate price between spring and summer,
  so the app prints roughly what it costs and tells you to check rather than
  claiming to know today's number. It is a separate axis from
  `nonCommercial`: a public park can charge at a gate, a business can be free
  to walk into.
- **Every outings page ends with three halal restaurants nearby**
  (`nearbyHalal` in `store.js`), sorted by distance and never by who paid. A
  family on a day out has to eat; it costs us nothing and gives the
  restaurants in the directory another doorway. It is not a slot anyone can
  buy — same rule as `similarTo`.

## Events: types, concerts, and the yearly ones (V.02.0)
- `EVENT_TYPES` holds eleven types; the chip row on `#/events` shows only the
  types that actually have something upcoming, the same rule as the directory.
- **Concert-only fields** (`e.concert`) appear when the type is `concert`:
  artist, doors, price from, age limit, family seating. **Ticketing is never
  built in** — the button opens the organiser's site. Selling tickets means
  payments, refunds and liability on a cancellation, and that is not this
  business.
- **A yearly event is never republished automatically.** `repeat.kind` is
  `gregorian` (a fixed date) or `hijri` (~11 days earlier each Gregorian year,
  `HIJRI_YEAR_DAYS`). `dueRepeats()` warns the admin `REPEAT_LEAD_DAYS` ahead and
  `spawnRepeat()` makes a **draft** — the venue, the price and the line-up change
  every year, so a human checks before it goes live.

## `docs/الحالة.md` — the memory every session reads
The daily check runs in a NEW session each morning, and a new session
knows nothing: not the numbering, not what is deferred by decision, not
what was proposed and closed. So it reports the deferred as newly found,
takes a number already in use, and reopens a settled argument.

> **`docs/الحالة.md` is updated WITH each batch that ships, not after
> it.** The version number, what left the waiting list, and what joined
> the deferred-gaps table.
>
> **And no batch file is closed while its number is still under «ما ينتظر
> الإرسال».**
>
> **And the waiting list is never emptied by a session because that
> session received nothing.** A session deletes from it what it landed
> itself, **and never writes «لا شيء»** — somebody who has not been sent a
> file does not know that a file exists to be sent.

**Written in the file itself, not in anybody's head.** State that lives in
one person's memory falls over on the first day they are not there — and
it did: the record said batch nine (ب) had not shipped **while it was
live in V.04.0**, and Rai found it from the colour of a dot on his phone.

## `docs/سجل-القرارات.md` and `docs/تقارير/` — what was already settled, and what was already found

`docs/الحالة.md` says where the project **is**. These two say what has
already been **decided**, and what has already been **seen** — and a
session that skips them spends itself twice on the same ground.

> **Read `docs/سجل-القرارات.md` at the start of every session, with
> `docs/الحالة.md`.** Its **second table** is the one that saves the
> session: things proposed and **refused, with the reason**. Proposing one
> of them again is not a new idea — it is a settled argument reopened.
>
> **And read every file under `docs/تقارير/` whose first line reads
> `الحالة: جديد`.** Those are the scheduled-check reports. They run in a
> separate session that never reaches this repository, so what they found
> is invisible here until somebody reads them.

**A report is not an order.** It is read so the session does not
re-report what was already reported, and does not fix what already has a
file waiting. **No code changes because a report asked for it** — a change
arrives in a numbered file like everything else, and the report's author
could not see what shipped after it.

**And neither file is written by a session.** A session that lands a
decision does **not** mark it landed in `سجل-القرارات.md` — that is
precisely the line that goes stale, and `docs/الحالة.md` is where state
belongs. It said batch nine (ب) had not shipped **while it was live in
V.04.0**.

**Reports keep their status line and are never deleted.** The read report
is what proves the item was seen, and when.

## The queue: `docs/الطابور.md` says what is next
A new session's memory ends with the session, so it cannot know what has
not arrived yet; the repository knows what landed and not what is waiting;
and the owner has been carrying the order in his head. **The order is not
a preference but a safety condition** — two files touching `js/store.js`
in one batch conflict, and `168` out of turn deletes a function a file
that has not arrived brings back to life.

> **The queue is `docs/الطابور.md`.**
>
> **At the end of every batch report, after the closing line:** put an `x`
> against the number that landed, **then write the next line exactly as it
> stands in the file** — its number and its name — together with the
> «الترتيب» line from that file's own head if you have it.
>
> ⚠️ **Never invent a number, never reorder, never add a line.** The queue
> is written by whoever writes the files. The order satisfies a constraint
> written at the head of each one («not to be sent with X»), and
> reordering it without reading those constraints creates the very
> conflict it prevents.
>
> ⚠️ **If a file arrives whose number is not in the queue, or is not the
> next one in it:** say so in your first line, name what the next one is,
> **then ask: shall I go on with this?** **Do not refuse, and do not carry
> on without saying.** The owner may bring a file forward for a reason he
> knows — the queue is a reminder, not a gate — but staying silent about
> stepping outside it costs it its whole meaning.
>
> ⚠️ **A cancelled file is not executed even if it arrives.** Say that it
> is cancelled, and name what replaced it.

**A queue that guesses at the next file is worse than no queue** — the
same rule as «a check that lies is worse than no check». And it is not
`docs/الحالة.md`: that one says **what landed**, this one says **what has
not landed yet and in what order**. Merging them makes the first grow
until nobody reads it.

**And it carries a version number and a date on its first line.** Whenever
a file is cancelled or rebuilt under a new number, a new queue lands with
a higher version — written by whoever writes the files, never edited by a
session.

## The report names the file it closed, and the net when a group closes
Rai's rule of 29 August, and it is the twin of the one above it: a session
that says «خلصت» and nothing else leaves a reader who cannot tell **which**
file was landed — and the numbering is the one thing a fresh session has no
way to recover.

> **Every report ends by saying it is finished AND naming the number of the
> file it finished.** «خلصت الملفّ `330`.» Not «خلصت» alone.
>
> **And the report that closes a GROUP adds that the full net was run** —
> on both builds, with its numbers. A group's closing file says so at its
> own head (the rule above); the closing report has to say it too, or the
> only record that the net ever ran lives in a terminal nobody kept.

It costs one line and it is the line that places a report months later.

## The version number is part of the batch, not a step after it
> **`APP_VERSION` in `js/data.js` is raised inside the batch that changes
> the app, and a batch is not closed while that number disagrees with the
> one at the top of this file.**

It has now drifted twice — found at `0.1` while the project was V.03.5,
and at `0.3.8` while this file read V.03.9 — and both times it was
corrected by hand, which is precisely the thing that forgets. **It is
printed in the drawer and in «حسابي»**, so somebody filing a report reads a
number that is not their build's, and the report cannot be placed.

## Testing: what is run, and when

There are three gates, and **the session goes into the work, not into the
tests**. ⚠️ **The whole set is every `tools/e2e/test_v<n>.mjs` × 2 builds
and takes about fifty minutes.** The count is deliberately NOT written
here: `run.sh` derives the list from the files and prints the number at
the head and the tail of every run. It was a hand-written figure and it
dried out twice in a single day — 48 → 49 → 50 — **and correcting it each
time is not a fix, it is the same fault living in the documentation.**
Running it after every edit eats the session and leaves the work
unfinished — four calls is an hour and a half of testing before a line is
written. And more parallelism does not help: the machine has two cores and
`run.sh` already has both busy with the two builds, so the way out is
**fewer suites, not faster ones**.

| when | what | measured |
|---|---|---|
| **after every change** | `tools/audit/quick.sh` | **~100s** — the static pass and all 42 screens in both languages |
| **while working on one area** | `SUITES="33 37" tools/e2e/run.sh` | seconds to a minute — only what your change touches |
| **once, at the end of a GROUP** | `tools/audit/daily.sh` | **~50 min** — the second build, the four roles, the admin panel, everything |

`quick.sh` is `index.html` only, on purpose: the single-file build comes
from the same source, and a fault in it alone is rare and of a known kind
(`esc()` and CSP), which `daily.sh` catches at the end. **Doubling the gate's
time for a rare case removes the point of having a gate.** What it does not
check: the second build · the four roles · the admin panel · the calendar ·
the deep cases in every other suite.

**Which suites touch what**, for the middle row:

```
the city chip and location   33 · 37        the calendar and feasts   36
the directory list/filters   37 · 38        the admin panel           38
prayer and mass              read each file's own header — it says what it covers
```

**If you do not know which one covers your change, run three, not
the whole set** — and the full set at the end catches what you missed.

### `main` IS PRODUCTION — so nothing reaches it before the net is green
Rai's rule of 29 August, and it exists because two true things were being
treated as one.

**Measured:** the Vercel project is wired to `main`, and **every push to
`main` publishes to the public site as production** — the last fourteen
deployments are all `target: production`. So pushing V.07.0 to `main`
before the full net had finished **published it to everybody** while it
was still being tested.

**The argument it was pushed under is right, and only half of it:**
«work must not sit uncommitted in a container that gets reclaimed» — true.
**But saving is not publishing, and here they are the same button.**

> **1. Push to the WORK BRANCH immediately, exactly as now.** Nothing is
> lost, and the branch gets its own preview URL — that works today and is
> measured.
>
> **2. Nothing is pushed to `main`, or merged into it, until the full net
> is green on BOTH builds.**
>
> **3. So production moves at GROUP boundaries only, not with every
> batch** — and that is intended, not a side effect.
>
> **4. ⚠️ And if a net goes red AFTER production is already standing on
> that commit, it is reported at once and BY THE NAME OF THE ITEM. It is
> never fixed in silence, and the decision to roll back is Rai's alone.**

### The suite list is derived from the files, never written by hand
`SUITES` in `run.sh` was a literal string, and nothing compared it against
`tools/e2e/test_v*.mjs`. **So a suite file forgotten in it is never run —
while `run.sh` exits with zero FAIL and «ALLDONE», and the net reads GREEN
without having seen the file.** A check that lies, of the same family as
`test_v36`'s hand-written port and `test_v50` computing the day in a
timezone the browser was not in.

⚠️ **And the measurement that makes it heavier than it looks: three
numbers went into that string in one day** — 50, 51 and 52, in three
separate batches, each by hand. Had one been forgotten nobody would have
noticed: the only figure that would have shown it is the run count in the
report, **and that figure was itself misread the same day, 48 for 49. A
guard whose only guard has already failed is not a guard.**

> **The list is derived: `test_v` then DIGITS ONLY then `.mjs`, sorted
> numerically. And no document writes its count — `run.sh` prints it at
> the head and the tail of every run.**

- **The strict pattern** keeps a spare copy named `test_v9_old.mjs` out of
  the net; **the numeric sort** keeps 10 from preceding 9 and the report
  from reading as though the run jumped.
- ⚠️ **Three guards on the derivation itself, because a derivation that
  fails silently is worse than a hand-written list — it is assumed safe.**
  The list is printed in full at the head, the count at both ends, and the
  script **aborts** below a floor of forty. **The floor is written, not
  computed:** a threshold derived from the thing it guards always agrees
  with itself.
- ⚠️ **And the report names its own scope.** The first version printed
  «SUITES (50)» over a run of two — a report lying about its own reach,
  the very fault being removed. A partial run now prints
  «PARTIAL, not the full net».
- **The manual override stays** (`SUITES="8 33" tools/e2e/run.sh`):
  running three while you work is what keeps a batch from paying fifty
  minutes, and removing it would slow every batch down.

### The full net runs once per GROUP, and the closing file says so at its head
Rai's decision of 28 August: the full net is about fifty minutes, and
running it after every batch pays that four times inside one group. So a
batch runs **only the suites it touches**, and the net runs **once, at the
end of the group**.

> **The rule was not cancelled, its place moved.** «A batch is not finished
> when its own suite is green» became **«a GROUP is not finished when its
> suites are green»** — the same guarantee, paid once instead of four
> times. And a red at the end is attributed **by reading** which batch
> touched which file — every batch names its files at its head — never by
> guessing.

⚠️ **AND THE FILE THAT CLOSES A GROUP SAYS SO INSIDE ITSELF, AT ITS HEAD.**
Rai's rule from 29 August, and he writes it in the head rather than the
tail so it is read before the work starts, not after it is done.

**Why it has to be written in the file and not carried in anybody's head:**
a session that does not know it is holding the last batch of a group runs
the touching suites, reports green, and **the group closes having never
been tested whole** — which is precisely the failure the group rule was
invented to prevent. The first group ran this way (`307`+`308`, then
`315`+`325`+`326`) only because the closing file happened to be named in
conversation; that is not a mechanism.

**So: no group is closed, and no report says a group is finished, until the
full net has been green on BOTH builds.** If the closing file does not say
it closes the group, ask before assuming it does.

### The report is two lines, and the number is one of them
> **«خلصت الملفّ `430`.» That is the report.**

⚠️ **Rai has asked for this three times, and each time the reply came back
longer.** He is not reading a summary of the work — he has the commit, the
docs and the net's own output — so a page of headings and tables is noise
standing between him and the next file.

```
finished          «خلصت الملفّ NNN» · and the next queue line
a red             the ITEM'S NAME, at once, and what it means — never in silence
a decision he owes  the question, the recommendation, in one short line
anything else     is not reported
```

**«خلصت» alone is not enough either** — it leaves a reader who cannot tell
which of forty files it names. **The number is the other half, and the two
together are the whole thing.**

### Never wait on a file with a loop
No `until grep … do sleep`, and no waiting for a marker to appear in a
file. **Run the command in the foreground and read its output**, or run it
and read the file **once, after the command itself has finished**.

**Measured, and it cost most of a session:** two watcher loops on
`/tmp/daily.txt` spun for forty minutes in the `015`/`025` batch waiting
for a marker a killed run was never going to write — **and the work was
finished and sitting behind them.**

⚠️ **And what looks stuck is usually waiting, not working.**
`build_single.py` finishes in **under one and a half seconds** — measured
three times: 1.24s, 0.73s, 0.23s. If something has "been running" for forty
minutes, it is waiting on something else, and killing it is more correct
than waiting for it.

## The newcomer guide is generated — `tools/nc/` holds its source

`js/newcomer-content.js` is **built**, not written. Its source is
`tools/nc/nc-ar.json` and `tools/nc/nc-en.json`, and the three commands
that rebuild it are in `tools/nc/اقرأني.md`.

> **Never edit `js/newcomer-content.js` by hand.** The edit is lost on the
> next build, silently — no error, no diff in size.

**And the guide text is Rai's, approved word by word.** It is not
reworded, shortened, or added to — not in the JSON and not in the
generated file. A change to it arrives in a numbered file after he
approves it, like everything else.

**One file per language, and no second copy under any name.** The source
was once kept as two byte-identical files. One was edited, the tool built
from the other, and the output came out unchanged — same size, no error.
It was found by accident, not by a check. `git` is the backup; a second
copy is a second source on the first day somebody forgets which is which.

**And `docs/إعادة-البناء.md` is the answer to "if everything fell, how
does it come back".** Vercel is the front, not the store — it publishes
from this repository, so losing it loses nothing. Keep that file true:
when the server batch lands and real data exists, its section 1 stops
being correct and has to be rewritten in the same batch.

## Testing before you ship a change
```
python3 -m http.server 8099        # from the repo root
node tools/e2e/chk_i18n.mjs        # both packs, every derived key, seconds
tools/audit/quick.sh               # the fast gate — ~100 seconds
tools/audit/daily.sh               # everything, once at the end — ~20 minutes
python3 tools/build_single.py > index-single-file.html
node tools/audit/provenance.mjs  # يُولَّد docs/AI-PROVENANCE.md ويدخل كومِتَ الإغلاق
```
⚠️ **كومِتُ الإغلاق نفسُه يحمل `docs/AI-PROVENANCE.md` المولَّد بعد fetch.**
مقيس: كومِتُ إغلاق `505` لم يحمله، وكومِتُ عمل `540` ولّده من مرجعٍ بعيدٍ
عالقٍ على 9a98c8f فتراجع السجلُّ من 193 صفّاً إلى 104. الأداةُ تجلب `main`
من الخادم قبل القراءة، **وترفض أن يتراجع السجلُّ** (تخرج 1) — سجلُّ مصدرٍ
لا ينقص إلّا بإعادة كتابة التاريخ — ويذكر رأسُه تاريخَ آخر كومِتٍ قرأه.
1. `tools/e2e/` holds every suite, v3 to v50, one per batch, and `run.sh`
   runs all of them against **both** `index.html` and the generated
   `index-single-file.html`. A change is not finished until both are green.
2. Check **both** languages (the AR/EN button in the header) and **both**
   themes — layout must mirror and every colour must come from the token
   layer.
3. Confirm the logo renders and no console errors.
4. Regenerate the single-file build if you changed any source file.

**The suites live in the repository on purpose (V.03.2).** They spent five
batches in a scratch directory, and a container reset destroyed three of
them at once — taking the only regression cover batches six (b), seven and
seven (a) had, and silently reverting fixes in four more. They were rebuilt
from the invariants recorded in this file, which is the second reason to
keep writing those down. The net is what enforces rule 2; it belongs with
the thing it protects.

Two things the harness has to know, both learned the hard way:
- **On the single-file build the app's modules sit behind an importmap**, so
  `import('./js/store.js')` from the page fetches the file again and hands
  back a **second instance with its own state**. Reach the app's own with
  `import('arabna/js/store.js')` and fall back to the relative path.
- The proxy's `ERR_TUNNEL_CONNECTION_FAILED` on the Google Fonts stylesheet
  is the sandbox, not the app. Every suite filters it alongside
  `ERR_CONNECTION` and `ERR_CERT`.

## What is actually in `data.js` now (V.02.1)
**514 businesses** (V.02.6): 29 invented development seeds (`b1`–`b29`) and
**485 real Houston listings** entered by the owner and brought in through the
admin importer — `b30`–`b441` less `b321`, and 74 outings as `b442`–`b515`.
Both export files began at `b30`, so the outings ids were shifted by 412
rather than renumbered by hand. **`b321` (Cafe Mawal, Bay Area) closed for
good and its record was deleted — nothing was renumbered.** An id is a key:
`b322` staying `b322` is what keeps reviews, favourites and ownership on the
shop they belong to.

| | | | |
|---|---|---|---|
| restaurants 138 | grocery 42 | worship 35 | cafe 32 |
| beauty 24 | shopping 21 | community 21 | sweets 16 |
| education 16 | finance 13 | occasions 12 | doctors 11 |
| auto 11 | lawyers 10 | homegoods 9 | electronics 8 |
| travel 7 | realestate 6 | homeservices 3 | gyms 1 |
| outings 78 | | | |

- **The seeds stay until launch** — they are the only records with reviews,
  ratings, photos, a paid plan and a real distance, so half the app has
  nothing to demonstrate without them. They go together with the seed
  reviews, in one deletion, before the app is public.
- **`dist` is 0 on every imported record** because the importer has no
  geocoding yet. `distLabel()` in `ui.js` prints nothing rather than "0 mi":
  the app never invents a number it does not have. Geocoding at V.02 fills
  these in and the line appears by itself.
- **The specialities are thin outside outings.** 278 of the 412 businesses
  carry only `arabicSpoken`, so most categories show one quick chip; the
  outings rows average five attributes each and produce seventeen. Nothing in
  the code limits this — filling `attributes` in the source rows is all it
  takes, and the three-layer rule surfaces them the day they arrive.
- **Nine phone numbers are shared** between listings (the ISGH central line,
  a parks department, a driving school's two branches, two shops in one
  plaza). They are not duplicates and must not be merged; the importer will
  flag any future row against them, which is the correct behaviour.

## Batch four (V.02.2) — ten things, in the order they had to be done

### Duplicates are a sales moment, not an error
`nameKey()` strips punctuation, the Arabic article and the trade word
itself (`GENERIC_WORDS` in `data.js`), so «Al-Aseel Restaurant & Grill LLC»
and «مطعم الأصيل» both reduce to what actually names the place.
`similarity()` is a Dice coefficient over bigrams against `NAME_SIM_MIN`
(0.85), plus a rule that every word of the shorter name appearing in the
longer one counts. `addressKey()` folds street spellings, drops the unit
number from the *comparison* key only, and keeps house number + street +
ZIP. `findDuplicates()` returns `{biz, reason, confidence}` — certain
(same phone, or same name + same address), likely (same name + same ZIP),
weak (name only in the same category, or address only) — sorted strongest
first. **A missing phone is never a match.**

- **The screen never refuses and never says "duplicate".** `openSimilarSheet`
  shows the existing page in full and offers, in this order: «هذا محلي —
  طالب بملكيته», «لا، هذا محل مختلف», «رجوع». A shop owner typing their own
  name in is the most valuable moment the app gets, and turning them away
  wastes it. On a *certain* match, "different place" still saves — as
  `status: 'pendingReview'`, visible to whoever entered it and to nobody
  else until an admin agrees.
- One function, three doors: the importer, the admin add form and
  «أضف نشاطك». Admin → directory holds the review queue and a
  **«افحص الدليل بحثاً عن تكرار»** button that sweeps all 515 records.

### The demo data has a switch and a delete
Every invented record carries `demo: true` (`markDemo()` in `data.js`;
`DEMO_BUSINESSES` and `DEMO_REVIEWS` are separate arrays so deleting them
before launch is deleting two arrays). `withoutDemo()` in `store.js` is
the single gate; `showDemo()` / `setShowDemo()` / `purgeDemoData()` drive
it, and admin → settings shows the counts, the switch and a delete that
requires the word «حذف» typed out. **A standing warning bar sits above the
admin tabs while any of it is visible.** The house "your ad here" slide is
deliberately *not* demo data — it is the app's own unsold-slot filler.

### Subscription: what the law wants, not what is convenient
`startSubscription()` records plan, price, status, `trialEndsAt`,
`currentPeriodEnd`, `cancelAtPeriodEnd`, invoices, and a **verbatim copy of
the agreement text** with the time, device, amount and cycle. Yearly is
derived (`planPrice`, 15% off the monthly × 12) so the two cannot drift.

- **A separate consent screen stands before any card field**: amount,
  cycle, the exact first-charge date, the words "renews automatically" and
  the literal path to cancel. The box is never pre-ticked and the button is
  disabled until it is. That is the point cases are lost on.
- **Cancelling is one button and one confirmation**, in the place the
  consent screen said it would be, and the service runs to the end of the
  paid period with an undo.
- `now()` is the app's clock — real time plus `state.clockOffset`, which
  the admin test panel winds forward. Everything dated reads it, so the
  trial ending, the renewal and both legally required notices can be
  watched without a server. **The panel is tied to the demo flag** and goes
  with it.

### Ads: inventory is finite, and impressions have to be real
`AD_SLOTS` in `data.js` (slider 6 · catSlider 4 *per category* · mini 8 ·
story 4 · event 3). `adSlotsLeft()` and `adNextFreeAt()` are read off the
running orders, never typed. A full placement shows «محجوز بالكامل» plus
the next free date and takes a **waiting-list** entry rather than losing
the buyer. New product: **`catSlider`**, the same strip at the top of one
category page, cheaper because the audience is narrower.

- **`mountAdRotator` in `ui.js`** rotates only while the element is on
  screen (IntersectionObserver) and the tab is visible, and counts an
  impression only after a full second of being seen. Selling a view that
  did not happen buys an advertiser who does not renew.
- The mini banner was **shrink-to-fit** — a `<button>` sized by its own
  text, so it changed width every seven seconds. It is now a fixed
  full-width 62px box with `text-overflow: ellipsis`. It stays small on
  purpose: the size difference is what justifies the price difference.

### The numbers that renew a subscription
`recordBizView/Call/Directions/Save` and `bizStats()` give the subscriber
views, call taps, directions taps, saves and new reviews, this month
against last, ending in «صفحتك شافها N شخص هالشهر». Advertisers get
impressions, clicks, CTR and a bar per day (CSS, no library) with the
renew button beside them.

### Notifications now come from something that happened
`pushNotif` existed and nothing called it. Wired: ad approved/rejected,
a review on your business, a message about your listing, trial ending,
renewal due, each charge, an ad ending tomorrow, a saved event tomorrow —
plus the claim, verification and moderation ones that already existed.
Time-based ones run through `runReminders()` at boot with one-shot keys.
**Saving an event** (`toggleSavedEvent`) was added so its reminder has
something real behind it.

### What the app stores require
`blockUser` / `unblockUser` / `isBlocked` with `personKey()` as the single
definition of "the same person" (real user ids replace it in V.02).
Blocking is **immediate and needs no moderator** — that is Apple's
requirement and the only version that helps somebody being harassed.
Blocked people vanish from listings, messages and reviews at once, and
`#/blocked` undoes it. `SUPPORT_EMAIL` / `SUPPORT_PHONE` are published in
About and both legal pages, not behind a form. `deleteAccount()` now
really deletes — listings, reviews, messages, favourites, ad orders,
subscription, ownership — and the sheet lists what will go first.

### Back puts you where you were
`scrollMemory` is keyed to the **history entry**, not the route, so two
visits to the directory are two places. The key is captured *before* the
hash changes (`shownKey`), because by the time `hashchange` fires the
browser has already moved — filing the old page's position under the new
page's key was the first bug this had. Restore happens after two
`requestAnimationFrame`s and is clamped to the real scroll height. The map
is memory-only: a fresh launch starts at the top.

- **Screen state lives in the hash query** on the directory, the
  marketplace and the events list, written with **`replaceHash`** and never
  `pushState` — otherwise back undoes filters one at a time and never
  leaves the screen. The bonus is a link somebody can send.
- Returning to the directory scrolls the card you opened into the middle
  and flashes it once: the saved pixel is right until the list changes
  length; the card is right either way.
- `goAfterDone()` replaces the entry after something is completed, so back
  never re-enters a submitted form or a payment screen.

### Search that finds what is there
Three stages: all words → any word (best first, with «ما لقينا … بالضبط —
هاي الأقرب» above the results) → a useful empty state offering the longest
word and any matching category as buttons. «صالون فلوريدا» returned zero
while Florida Beauty Salon sat in the directory; it now returns it.

- The magnifier was being squeezed to ~13px by `flex-shrink` in a crowded
  row. **Search has its own full-width row**, the icon is `flex: 0 0 auto`
  at 22px in gold, and the placeholder is an example.
- **`CHIP_MAX_SHARE = 0.6`**: an attribute carried by more than 60% of a
  category is not a filter. «يتحدثون العربية» is on 139 of 139 restaurants
  and was taking the first slot in the row; it stays in the sheet.
- Quick chips appear **only after a category is chosen**, capped at five.
  A grid button opens every category at once with real counts.
- The filter sheet: no repeated category row, everything wraps (no
  horizontal scroll anywhere), a count beside every option, nothing with
  zero behind it, a «الأكثر استخداماً» group first, radius as a slider, and
  a pinned footer whose button reads «عرض N نتيجة» live.
- Active filters show as removable pills above the results.

### The "+" button
Labelled «أضف», and it opens a choice — sell something · add your business
· suggest an event, with «أعلن معنا» underneath — instead of jumping
straight into the marketplace form. **A visitor fills the form and is asked
for an account at the publish button**, with the draft (text and photos)
parked and the publish resuming itself afterwards. Asking before a person
knows what they get is the commonest reason they leave.

## V.02.3 — the six fixes after batch four

### Back restores the position (superseded by V.02.4 below)
The scroll is saved by a **single passive, rAF-throttled `scroll` listener on
`#app`**, mounted once at boot (`mountScrollMemory` in `ui.js`), keyed to the
**history entry**. Removing the save from `render()` was right; removing it
from `go()` as well was not, and V.02.4 puts it back — see there.

### An option appears once
«الأكثر استخداماً» is a shortcut to the top of the list, not a second copy of
it: whatever it lifts is removed from the group it came from (`inTop`), and
`CHIP_MAX_SHARE` applies to it too, so «يتحدثون العربية» (438 of 515) leads
nothing.

### The sheet footer is a sibling of the body
`.sheet-panel` is `display:flex; flex-direction:column; max-height:88dvh`;
`.sheet-body` is `flex:1 1 auto; overflow-y:auto` and holds every group;
`.sheet-foot` sits **outside** it with no `sticky`. A sticky footer inside a
container taller than the screen covered the last group on a real device.

### The radius became the area
The 5–100 mile slider filtered nothing — no listing has coordinates, so every
setting returned the same list, and in RTL the thumb sat at the wrong end. It
is replaced on the directory by **counted area options**: «كل المنطقة», the
reader's own city, and 5/10/25/50 miles that appear **only** when both halves
exist (a point for the reader and geocoded listings). The marketplace never
filtered by distance at all, so it has no area group. The `.range` rule with
its RTL fix stays in the design system.

### «مفتوح الآن» keeps time
One 60-second timer (`startClock` / `onMinute` / `refreshOpenBadges` in
`ui.js`) rewrites **the badges only** — `openBadgeSlot()` wraps each in
`[data-openbadge]` — so nobody's place in a 139-row list moves. It recomputes
at once on `visibilitychange` and `focus`, stops while the tab is hidden, and
the directory re-filters only when «مفتوح الآن» is actually on. A wrong
«مفتوح الآن» sends somebody driving to a closed shop.

### Location: the real thing, or the area name — never a number we invented
`dist` was a hand-typed field, 0 on all 486 imported rows and identical for
every reader in every city. Nothing reads it any more.

- **A figure in miles is printed only when both points exist** — the
  reader's and the listing's (`distanceTo()` returns `null` otherwise, and
  `distLabel()` prints the city instead). This is the rule the rest follows
  from.
- **The chip starts empty.** Before there is a location it is a dashed
  button saying «حدّد موقعك»: a chip reading "Houston" to somebody standing
  in Katy is the app telling them something false before they have touched
  anything.
- **Nothing asks the browser at launch.** iOS asks once and a refusal is
  permanent, so permission is requested at the moment of use — the chip, the
  «الأقرب» sort, the area filter — and `openGeoPrompt()` puts one line of our
  own in front of the system dialog: «عشان نوريك أقرب المحلات إلك» with
  [سماح] [مش هلق]. `askForLocation()` is the whole flow; the location sheet
  hands over to it rather than stacking a second sheet on itself.
- **Three ways in, one sheet**: the device (the only one that yields a
  point), the **25 real cities with live counts** — Houston 377 · Katy 39 ·
  Sugar Land 32 · Spring 15 · Richmond 13 — read off the addresses by
  `cityOf()` / `directoryCities()`, and any U.S. ZIP. A city picked by hand
  clears any stored point: it belonged to somewhere the reader has left.
- **Every ending is handled**: refusal, timeout, no GPS, a point outside the
  region. Each says what happened and leaves the city list one tap away;
  `nearestCity()` snaps a point to a city we actually cover, and beyond
  `REGION_RADIUS_MI` (60) it stays the area.
- **Ordering falls back in the order of what it knows**: real miles when
  there is a point (`byNearest`, ungeocoded listings after, never mixed in),
  otherwise the reader's own city first, then the rating, then a subscriber
  ahead of a free listing at the same rating.
- **A paid listing leads for every reader inside Greater Houston and for
  nobody outside it** (`inCoverage()` + `pinSponsored()`, one slot): the 25
  cities the directory covers, not the state — an advertiser in Houston is
  worth showing to somebody in Katy and worth nothing to somebody in Dallas.
  It is labelled «إعلان مموّل» and carries **the same distance line as every
  other row**, real miles or the area name. The money buys the place, not
  the silence.
- **Coordinates are never shown to anyone** — not on a card, a page, the add
  form or the import template — but they live in the record and in the
  backup. Every new listing is saved `needsGeo: true`, **changing an address
  clears `lat`/`lng` and sets the flag again** (a shop that moved and kept its
  old point is worse than one with none), and admin → directory carries the
  «بانتظار الإحداثيات» queue with its count and an «تصدير العناوين الناقصة»
  CSV. Geocoding the 514 addresses is a data job done outside the app; the
  day they arrive the miles appear by themselves.
- The privacy page says all of it, in both languages, as its own section.

## V.02.4 — the scroll, and the end of sideways choosing

### Back restores the position (the third attempt, and the last)
Two earlier fixes both wrote a **0** over the saved pixel, from different
places. The order of events on a tap is:

```
scroll  → scrollTop = 0     ← the browser empties the container
hash    → #/directory/b3    ← only then does hashchange fire
```

So the save has to happen **before** anything else, and the listener has to
be told to ignore the browser's own reset:

- `go()` writes `scrollMemory.set(shownKey, app.scrollTop)` as its very first
  statement, then sets `navigating = true`.
- the `scroll` listener returns early while `navigating` is true.
- `markShown()` clears the flag once the new screen is up.

Going **forward** is the path that matters — the screen being left is the one
we want back, and `go()` is the only moment we control. Going **back** needs
nothing: there the browser zeroes the *departing* screen, and that zero is
filed under that screen's own key. Do not try to intercept it; the event
arrives before anything we own.

### An option that scrolls off the edge is an option nobody has
Every row a person **chooses** from now comes down vertically instead of
running off the side. Sideways scrolling stays where it is *display* —
a shop's photos, "featured this week", the story cards.

- **One picker row** replaces the two scrolling ones:
  `[ التصنيف · الكل ▾ ] [ الترتيب · الأحدث ▾ ] [ ⚙︎ ]`. The pickers share
  the space, the filter button keeps its own. Each prints the small label
  and the chosen value **in gold**, so the reader knows what they are
  filtering by without opening anything. Long values ellipsis; the row's
  height never moves.
- **The panel is in the flow** (`#ddHost` under the row) and **pushes the
  results down rather than covering them**: `.dd-scroll` is capped at
  `45dvh` and scrolls inside itself.
- «الكل» is always the first row with the total; the rest are **ordered by
  how many listings stand behind them**, so the ones people want need no
  scrolling at all. Every row carries an icon, a count, and a ✓ when chosen.
- Closing: picking · a tap outside · `Escape` · the **device back button**.
  The panel pushes **one history entry**, and that entry stands for "a panel
  is open" rather than for one particular panel — switching from the
  category list to the sort list passes it over (`adopt`) instead of
  fighting over it. Anything the pick has to do waits for the pop
  (`pending`), because a `history.back()` in flight will otherwise wind the
  URL the pick just wrote straight back off again.
- The first tap outside **only closes the panel**. It does not also press
  the shop underneath it.
- `aria-expanded` on the button, `role="listbox"` / `role="option"`,
  `aria-selected` on the chosen row, ↑↓ to move and Enter to pick.
- The same picker on the **marketplace** (sections) and **events** (types).
  The **magazine**'s six chips simply wrap. **Home keeps its circles** —
  they show, they do not filter — with «عرض الكل» in the section head.
- `#catGrid` and the all-categories sheet are gone: the list does that job,
  and the button that opened it used to sit at the far end of the row it
  was meant to save you from.
- The filter button's badge no longer counts the category: it is printed on
  the row where the reader can already see it.
- Measured at 390px: the results start at **272px instead of 322px**, and
  nothing on the directory, the marketplace, the events list or the
  magazine is cut off at the edge in either language.

### The events list shows three types because there are three
The type list holds «الكل» plus every type with something upcoming — today
that is festival · lecture · bazaar, one event each. `EVENT_TYPES` defines
eleven, but the row was never hiding the other eight: **there are no events
of those types yet**. The rule stands (never offer a filter that returns
nothing); the list grows by itself as events arrive.

## V.02.5 — the logo files, and light mode

### The logo is horizontal now
`ARABNA-logo-files.zip` replaced every image: `lockup-horizontal-transparent`
→ `assets/logo-sm.png` (the header), `lockup-original-transparent` →
`assets/logo.png`, `icon-1024` → `assets/icon.png`, and 32 · 120 · 152 · 180 ·
192 · 512 · 1024 into `assets/icons/`. The header sizes it at
**`height: 44px; width: auto`** with no forced width and no `object-fit` —
the file is 913×340, so it takes its own width (118px) and keeps its
proportions. 40px installed.

- **The icons are square on purpose.** iOS rounds them itself; a
  pre-rounded file is cut twice and comes out wrong. Nothing is
  re-compressed or resized.
- **No plate, no background behind the logo, in either theme.** The
  transparency is the point, and the silver mark carries its own dark
  outline so it survives on ivory.
- `icon-120` and `icon-152` are new — both in `index.html` as
  `apple-touch-icon` and in the manifest.
- **The splash is `#071A3D`** (`background_color` in the manifest) — the
  navy of the logo itself, not `--bar`. Anything else draws a rectangle of
  a different colour around the mark for the first second.
- `header-h44/56/72/96`, `mark-transparent` and the two Android layers
  travel with the project in `assets/` and are wired to nothing yet.

### Light mode: a symbol says the role, the theme says the value
Every colour in the app is a token. `styles/app.css` holds three blocks —
the theme-independent one (geometry, the ad-card colours, the Settings
previews), dark, and light — plus a `prefers-color-scheme` copy of light so
the very first paint is right before any script runs.

- **288 hand-written colours are gone**: 204 in `app.css` outside `:root`
  and 16 inline styles in `js/`. `grep` for a literal outside the token
  layer returns **nothing**, in the CSS and in the JavaScript alike.
- **The one exception is `data.js`** — the saturated ad cards. Their
  gradient moved there as `AD_CARD_COLOR` (it had been sitting in
  `store.js`), and `--ad-ink` / `--ad-cta` / `--ad-badge` / `--ad-line` /
  `--ad-sheen` keep the card's own parts literal-free **without** making
  them follow the theme: white on a strong colour reads either way, and an
  advertiser's artwork should not change under the reader.
- **`--muted` is never put on `--surface-2`** — measured at 3.79 in dark,
  under the 4.5 line. The picker row moved to `--surface`, and secondary
  text inside a tinted pill uses `--text-2` (dimmed ivory) instead.
- Two light values were **measured down** from the table: `--gold-bright`
  #6E5324 → **#5A4418** (4.17 on a gold wash over ivory) and `--green`
  #256B48 → **#1F5C3D** (4.42 on its own pill).
- **2470 pieces of text were measured on 15 screens plus the drawer, in
  both themes.** The audit walks each element's real background stack; the
  script lives in the scratchpad and is worth re-running after any colour
  change.

### The switch
`state.theme` is `'auto' | 'light' | 'dark'`, default `'auto'`, saved with
everything else. `applyTheme()` in `ui.js` sets `data-theme` on `<html>`
and nothing else — one attribute repaints the whole app with no reload and
no re-render.

- **`auto` follows the device while the app is open**: a `matchMedia`
  listener, so a phone that dims itself on a schedule dims the app too.
- **The system chrome follows**: `theme-color` and
  `apple-mobile-web-app-status-bar-style` are rewritten on every switch and
  set correctly at boot, or the iPhone keeps a black status bar over an
  ivory app.
- `color-scheme: light dark` hands the scrollbars, the caret and the native
  inputs to the system.
- The fade is on the large surfaces only, and only for readers who have
  not asked for less motion.
- **Settings → المظهر** has the three choices, each with a preview of
  itself (the automatic one is split down the middle), and the note
  «بيتبع إعدادات جهازك». The **drawer head** carries a sun/moon button that
  flips light ↔ dark in one tap — reaching Settings to turn the lights down
  at night is too far. It is in the head and not a row on purpose: an
  eighth row made the drawer scroll (887px against 844) as soon as a group
  was open.

## V.02.5b — three faults the colour batch left behind

### A fixed ground takes fixed ink; a themed ground takes themed ink
This is the rule, and every surface in the app must have both halves from
the same family. `.slide` broke it: its background comes from the
advertiser (`style="background:${a.color}"`, `home.js` and `directory.js`)
and therefore does **not** follow the theme, but the rule set no `color`,
so the text inherited `--text` and turned navy on maroon in light —
**measured 1.04**, the highest-priced placement in the app, unreadable.
`.slide-badge` and `.slide-cta` were already using `--ad-cta` and survived;
the title and the description inherited and did not.

- `.slide { color: var(--ad-cta); }` — never inherits again.
- `.slide-house { color: var(--text); }` — **the exception that proves the
  rule**: the house "your ad here" slide sits on `--surface-2`/`--bar`,
  which *is* ours and *does* follow the theme, so its ink must follow too
  or it inverts in turn.
- Everything else was checked and was already correct: the mini banner, the
  story cards, the featured event, the category strip all take both halves
  from the token layer.

### The header logo is stacked, not horizontal
A deliberate reversal of the V.02.5 mapping: `lockup-horizontal` in the
header put «عربنا» and `ARABNA` *beside* the mark instead of under it. The
header now uses the stacked `assets/logo.png` at the **old numbers — 65px,
54px installed** — and because the new file's ratio is 1.23 against the old
1.44 it takes **80px** of width where the old one took 94, so the 92px
header does not move. `header-h44/56/72/96.png` are crops of the horizontal
file and stay in `assets/` wired to nothing.

### Transparency is not contrast
The silver family in the lockup is a dark-background mark: measured over
every opaque pixel, **72% of it falls under 2:1 against the ivory bar**
(median 1.58, against 10.2 on navy). Transparency solved the white box
behind the logo — a different problem entirely.

- `assets/logo-ink.png` and `assets/logo-sm-ink.png` are the same lockups
  with the silver re-inked to the logo's own navy `#071A3D`, the gold
  untouched, and the gradient inverted so the mark keeps its depth.
  **Median 12.94 on the ivory bar, 12.3% under 2:1.**
- **Never `filter: invert`** — it turns the gold blue.
- `logoSrc(kind)` in `ui.js` picks the file (`stacked` | `wide`), every
  `<img>` carries `data-logo`, and **`applyTheme()` rewrites all of them**,
  so the mark flips with the theme on the spot rather than one screen late.
- It is wired at **every** logo, not only the header: the drawer head and
  the sign-up/sign-in screens use the wide one and the About page the
  stacked one, and all of them sit on ivory in light. The spec called the
  wide ink file a spare "not to be linked" on the assumption the horizontal
  lockup had no use left; it still has three, and they dissolved the same
  way (78% under 2:1 on the light page).

## V.02.6 — the words people actually type

### The dictionary expands the query and never the data
`js/synonyms.js` — **100 groups, 984 words** (989 until V.03.0 moved «صالون»
to `SYNONYM_ONEWAY` and took «تجميل» / «beauty» out of the salon group). Every array is a set of words
that mean the same thing to somebody searching; typing any member searches
for all of them. **No record is touched, no tag is rewritten, `data.js` does
not grow**, and adding a word is one line here and nothing anywhere else.
`store.js` calls `expandQuery(term, normalize)` and `hayMatches(hay, entry)`
in stages one and two of `searchBusinesses()` and in `matchesSearch()`; the
file imports nothing and takes `normalize` as an argument so it cannot drift
from the search's own folding. **517 words that returned zero now return
something real.**

- **A word may be in two groups on purpose.** «صالون» is in the women's
  salon group *and* the barber group, so it finds both; «كوافير» is only in
  the first and «حلاق» only in the second. That asymmetry is the whole
  design — an ambiguous word stays wide and a precise word stays narrow,
  with no extra code.
- **The boundary rule, which prevented three disasters.** A word the reader
  typed matches anywhere; **a word the dictionary put in their mouth must end
  at a word boundary.** Without it `حلا` inside «حلال» returned 93 halal
  shops for "sweets", `سبا` inside «مناسبات» returned wedding halls for
  "salon", and `park` inside "parkway" returned every address on a highway.
  The boundary is required at the **end only** — Arabic glues «ال» and «و»
  and «ب» onto the front, so demanding a clean start would lose «الحديقة».
- **Three words are deliberately absent**, each with the measurement that
  removed it: **«عربية»** (the car, in Egyptian) folds onto «يتحدثون
  العربية», which is on 438 of 514, so «سيارات» returned the whole
  directory. **«لحوم» / «لحمة» / `meat`** match the halal-meat attribute on
  88 restaurants, so somebody looking for a butcher got 58 restaurants — a
  butcher is a shop, and eating meat is not a butcher (19 results instead of
  96). **«قانونى»** matches «محاسب قانوني», the CPA, and — measured after
  this batch's own renames — hits 2 finance records and **0 lawyers**, so it
  rescued nothing and pushed «محامي» from 0% off-category to 17%.
- **Never add a word without running the check.** `node tools/synonyms.test.mjs`
  prints the dead groups, the biggest gains, the rescued words and the
  **confusion check**. The bar: حلاق · كوافير · صالون · شاورما · أرجيلة ·
  محامي · ضرائب · ترامبولين · كنيسة → **0%**; ملحمة 5% · بقالة 5% ·
  مسجد 8% · حديقة 14% (real address matches containing the word Park).
- Two groups have nothing behind them — **عصير** and **سوداني**. There is no
  juice bar and no Sudanese restaurant among the listings. They stay: they
  start working by themselves the day the first one arrives.

### The search reads the specialities at last
`searchHaystack()` indexed name, description, address, tags and the category
name — and **not `attributes`**, so 342 specialities carried by every listing
were reachable only from the filter sheet. Three lines and an `attrLabel()`
that derives the i18n key from the id the same way the registry does:
«مواقف» / "parking" **0 → 130**, «بدون كحول» 0 → 10, «واي فاي» 0 → 8,
«بولينج» 0 → 2. This is also what exposed the «عربية» and «لحوم» faults
above — anything added to the dictionary from now on has to be measured
against the attribute labels too.

### The haystack is built once per listing
`searchHaystack()` is read once per listing per search, and the filter
sheet asks for a count **per option** — about ninety searches in one tap.
With the attribute labels in it that measured **260ms to open the sheet**.
A `WeakMap` keyed by the record fixed it: an unedited listing is the same
object on every call so it always hits, an edited one is a fresh object and
misses, which is correct rather than stale, and `registerStrings()` throws
the whole cache away because the labels in it came from the old pack.
**260ms → 59ms, and a single search 2.9ms → 0.63ms** — faster than before
the attributes went in.

### The name on the sign, the transliteration in the search
Rai went through the 179 names that had been guessed at and settled all of
them: 154 stay English, 21 take the Arabic name, 4 take a name he wrote
himself. So **25 records changed `name.ar`** and `name.en` was never touched.

- **154 English names created a hole:** the record had no Arabic anywhere,
  so nobody typing the name in Arabic could find it. «فادي» — a name every
  Arab in Houston knows — returned **1 of 5**. «بترا», «قهوة هاوس»,
  «حديقة هيرمان», «مسجد حمزة» all returned **zero**.
- **113 transliteration tags** went into `tags`, added and never replacing.
  A tag is never displayed; its only job is search. فادي 1 → **5** ·
  بترا 0 → **4** · قهوة هاوس 0 → **2** · حديقة هيرمان 0 → **3**.
- This is exactly the promise made when the foreign names were kept English:
  **the name on the shopfront, the transliteration in the search words.**
- The detail page prints one name — the current language's. b30 now reads
  «عبد الله» and the English `Abdallah's` is in the record and in the search
  but is **not** printed under the title; that would be an interface change
  and this batch was data only.

## V.02.7 — batch six (a): the interface pass

### Latin digits, in both languages
«٢٠٢٦» and «٩:٠٠ ص» are gone. Every `Intl` / `toLocale*` that took `'ar-EG'`
now takes **`'ar-EG-u-nu-latn'`** — the month and day names stay Arabic and
only the digits change — `fmtTime()` stopped converting, and 133 literal
Arabic-Indic digits in `i18n.js`, `data.js` and the legal pages became Latin.
**Measured: 18 screens, zero Arabic-Indic digits.** The address, the phone
and the price on the same screen are Latin already, so an Arabic-Indic year
beside them reads as a typo. **Digits a user typed are never converted** —
`stripPhones()` in `store.js` still normalises Arabic-Indic input, and the
search dictionary still carries «مفتوح ٢٤ ساعه» as a word people type.

### Simple MSA, never a dialect
115 UI strings rewritten: «ليس لديك حساب؟» not «ما عندك حساب؟» · «ابحث عن»
not «دوّر على» · «تعذّر» not «ما قدرنا» · «يمكنك» not «تقدر» · «غداً» not
«بكرة». The app speaks to Levantines, Egyptians, Iraqis, Yemenis and
Moroccans in one city, and **no single dialect belongs to all of them**;
plain MSA belongs to nobody's country in particular. Simple, not stiff:
«أرسل رمزاً جديداً», never «يُرجى النقر لإعادة إرسال رمز التحقّق».
**The exception is data** — business names, descriptions and search tags are
things, not interface.

### Money is isolated at the source
`$49` was rendering as `49$` inside Arabic text: the dollar sign is a neutral
bidi character and the paragraph direction placed it. `fmtMoney()` now wraps
its output in **U+2066 … U+2069**, so every one of its 28 call sites — and
every future one — is right without a wrapper, in attributes as well as text.
`ltr()` does the same for a price we did not format (`$14,500`). Verified by
measuring the glyph rectangles: the `$` is left of the digits.

### The light/dark flip is in the header corner
It replaces `.h-spacer` — **44px for 44px, so nothing moved**, and the logo
is `position:absolute` on the middle of the header so it never depended on
what stands beside it (**measured: centre at 195px in Arabic and English**).
`.app-header` needed **`justify-content: space-between`**: with the logo out
of the flow the two corner buttons had nothing between them and collapsed
against each other — measured, menu at 332 and the flip at 278 instead of
14. Now Arabic reads menu 332 / flip 14, English the mirror.
No direction code: flex plus `dir` swap the corners by themselves, and an
`if (rtl)` would only ever be right in one language. `applyTheme()` repaints
the icon and its `aria-label` the same way it swaps the logo files — the
attribute repaints what a symbol coloured, it cannot redraw what was content.
**It is deleted from the drawer, not copied**: the same action in two places
is the duplication banned everywhere else. Full header only, never the
simple back+title one.

### Screen by screen
- **Home** — search and location share one row. The magnifier keeps
  `flex: 0 0 22px`; it was squeezed to ~13px the last time this row got
  crowded. The chip ellipsises at 44% rather than wrapping. 360px, both
  languages, no overflow.
- **Directory** — the quick-chip row is **deleted**. Filtering is the ⚙
  button and the two pickers; what is *on* still shows as ✕ pills, because
  that is state, not a control. `quickAttrsForCat` stays in `store.js`
  untouched. And an unsold category strip now carries **the house slide** —
  «إعلانك هنا — أول ما يفتح أحدٌ قسم «مطاعم»» opening `#/advertise/catSlider`
  with that package already selected. The best place in the app to sell it
  from: the restaurant owner browsing «مطاعم» is the buyer.
- **Business page** — the strip no longer repeats the photo already filling
  the hero. No photos still means no gallery.
- **Marketplace** — the third copy of the section name is gone; the rules
  dot moved onto the note, where the section is named.
- **Advertise** — «احجز مكانك — من $49» and «أيّ باقة تناسبك؟».
- **Subscribe** — «أهلية» is gone and the meaning stays: **«اطلب شارة «نشاط
  موثّق»»** with the gold mark beside it and **«بعد المراجعة»** under it, in
  `--muted`, never dropped. Not «احصل على» and not the bare badge name:
  somebody who reads «نشاط موثّق» beside $29 expects the mark tomorrow, and
  paying has never verified anyone.
- **Drawer** — «تصنيفات عربنا»; الدليل and السوق dropped (both are permanent
  bottom-bar tabs); **«إعلانات مميّزة»** in their place → `#/directory?featured=1`.
  When no business subscribes it reads «قريباً» and does not navigate, so
  the row can never open an empty list. Still 844px, still no scroll.
- **Help** — ten folded questions above the contact block, one open at a
  time, the drawer's idiom; placeholder answers for Rai to replace. The
  phone is off this screen (it stays in About and both legal pages, where
  the app stores expect it).
- **Sign in** — «ليس لديك حساب؟ أنشئ حساباً», and the forgot-password link
  carries «قريباً» before the tap.

### Forgot password says what is true
`signOut()` clears the only account record there is, so a form here would
take an email and do nothing — the one outcome the project bans. The screen
explains that reset needs a server account, and offers the two doors that
open. **The third state, a screen that opens and does nothing, is the one
thing not allowed.**

### The marketplace listing
- The owner's button and the visitor's button were near-identical labels on
  one destination doing two jobs, so **the owner could not tell which they
  had**. It reads **«رسائل المشترين (N)»** now, and **is not drawn at all at
  zero** — a button onto an empty screen reads as broken, and «رسائلي» in the
  drawer still reaches everything.
- **Share moved beside the heart** on the business page and the listing, for
  owner and visitor alike, and the bottom copy is gone from both (it sat at
  y=3454 on a page that tall; it is at **y=191** now). Each ad in
  «إعلاناتي» has its own share icon. Event and article pages keep theirs —
  those pages are short. `shareItem()` needed no change and `location.href`
  is the right link.
- The conversation header carries **the listing's photo** when it has one.

### Posting: four, fourteen, and hidden rather than erased
`MAX_ACTIVE_LISTINGS = 4` and `LISTING_DAYS = 14` in `store.js` and nowhere
else; handyman keeps its stricter one-per-fortnight. **«حذف» is «أخفِ
الإعلان»**: off every public list at once, still under «إعلاناتي», its slot
freed (`activeListingCount()` skips hidden), and reversible while the days
last. Hidden is **its own list (`state.hiddenListings`)**, not a field on
the record — a field only reaches `extraClassifieds`, and somebody can own
a seed listing too. Every field but the photos is required, and the empty one is *marked*
rather than announced.

### Add your business
- **The English name and the category are required**, starred, and the
  button is dead until both are there — **the same two the importer demands,
  not a second list invented for this screen**. The category select opens on
  «اختر تصنيفاً» rather than defaulting to the first one.
- **«خدمة متنقّلة»** hides the address and asks for a **ZIP** instead, saved
  on the record for geocoding. A plumber has no shopfront, and without a ZIP
  they would never appear under «الأقرب» at all.
- **«مفتوح 24 ساعة»** hides the seven day rows and saves
  `[['00:00','24:00']]` for each of them — the existing shape, no new field.
- **Attributes are one box per group**, and the box **stays open** while you
  pick: somebody adding a restaurant chooses two or three from one list, and
  a panel that shut on every tap would need reopening each time. Chosen ones
  show as ✕ pills under the box, readable with it closed. **At least one
  from every group**, and the button names the group and scrolls to it.
  ⚠️ **Restaurants has eight groups**, so adding one needs eight choices —
  the highest-volume category is also the heaviest form. Worth revisiting.

### Sign up
- **First and last name, letters only** (`validName` allows letters, spaces,
  apostrophes, hyphens — Unicode-aware, so «رامي» passes and «رامي1» does
  not). Every error is **written under its field**; an alert names no field
  and is gone before the reader looks up from the keyboard.
- **The email is checked before anything is sent**; **the password rule is
  stated before the typing** (`passwordRule`), with a strength meter and a
  confirm field.
- **The terms open in a sheet and close back onto the same line** with
  everything still typed. The old link navigated away and lost the form.
  `legalText()` harvests the screen's body and **puts the header back**,
  because both legal screens set it as their first act.
- **The code screen survives the app closing.** `state.pendingVerify` is
  written at sign-up and read by `firstRoute()` in `app.js`, so reopening
  lands on `#/auth/email` and not on an empty form — the commonest reason
  somebody never comes back. The code has a **10-minute life**, the resend
  button counts down **45 seconds from when the code was actually sent** (so
  returning later finds it already available), and **«تصفّح الآن وأكمل
  لاحقاً»** means nobody is thrown out for not having the email to hand.
- **The phone is collected at sign-up and stored unverified.** Asking for it
  at the moment somebody is trying to publish is the worst possible time.
  The first action that needs it asks for the code, and **re-entering a
  different number** says «الرقم غير مطابق — الرقم المسجّل ينتهي بـ182» —
  **the last three digits only**, enough to jog a memory and not enough to
  leak one. `samePhone()` compares the last ten digits, so punctuation
  never matters.

## V.02.8 — batch six (c): an ad block in every section

### One shape, four sections
Every section now reads top to bottom the same way — **slider · two
sponsored · the content** — the order Home already had. The four are the
directory, the marketplace, events and the magazine.

### The mini banner is a slider that says so
It always rotated (`home.js`), but with nothing to indicate it and at
**7 seconds — faster than the main slider's 10**, which is backwards. The
main one is above the fold and is looked at on opening; this one is passed
on the way down, and at 7s it could change its text under the reader's eye.
It is **16 seconds** now, with **small dots below the box**. The box stays
62px with `text-overflow: ellipsis`: its smallness is what justifies the
price difference, and the dots never go inside it.

**`AD_SLOTS.mini` went 8 → 4, and that is an increase.** Eight slides at
16s is a 128-second cycle and each buyer is on screen an eighth of the
time — nobody stays two minutes, so most buyers were never seen at all.
Four is a 64-second cycle and a quarter of the time each: half the slots,
twice the slot's worth, and an advertiser who saw a result is the one who
renews.

### Three new products, at prices the owner will set
```js
AD_SLOTS = { slider: 6, catSlider: 4, mini: 4,
             market: 4, events: 4, magazine: 4,
             story: 4, event: 3 };
```
`AD_PRODUCTS` gains `market` ($79/wk), `events` ($59) and `magazine` ($49).
**Those numbers are placeholders and are marked as such in `data.js`** —
the standing rule is that pricing belongs to the owner, not the code. The
ordering behind them: the marketplace has the most traffic and the most
direct buying intent, events draw a seasonal crowd, the magazine is a
quieter read held for longer.

### The house slide is compulsory, and it is the advertisement for advertising
When a section has sold nothing it shows **«إعلانك هنا — أعلى قسم …»**
opening `#/advertise` **on that section's package, already selected**.
Without it the section reads as having no room for advertising and no shop
owner ever learns the slot is for sale. `sectionSlider()` in `ui.js` draws
both cases so no screen writes its own.

- **The directory shows one on «الكل» too.** There is no single category to
  sell there, so the slide carries the generic wording and invites them to
  pick the category they want to be at the top of — the section still reads
  the same way top to bottom.
- **The two slides are not interchangeable.** An advertiser's ground is
  their own colour and does not follow the theme, so its ink is fixed
  (`--ad-cta`); the house slide sits on our surface, which does follow, so
  its ink must follow too (`--text`). That is the ce0fc77 fault, and both
  halves are measured in v21.

### Two sponsored rows, and never three
Between the slider and the content, each labelled «إعلان مموّل» with the
badge the directory results already use. **Three would make the first
screen of a section entirely advertising**, and a reader who learns to
scroll past it makes the slot worth nothing — scarcity is what is being
sold. Each section draws from what it actually sells: paid businesses in
the directory, boosted listings in the marketplace, the other featured
events, the sponsored stories. **With a category chosen they come from that
category alone** — somebody who opened «مطاعم» wants a restaurant.

### The rotation: fair, and it survives Back
Rai asked for them to change every time. Plain randomness gets that wrong
twice, and both were designed out.

- **It would break Back.** Scroll the directory, open a shop, come back —
  and the order beneath you has changed, so the pixel we saved belongs to a
  page that no longer exists. Back has been fixed three times (V.02.3,
  V.02.4); an advertisement does not get to break it again. **The seed is
  chosen once per visit and filed under the history entry**, the same key
  `scrollMemory` uses. A new visit is a new order; Back is the same order.
- **It would not be fair.** With four advertisers, real randomness hands one
  of them nine impressions and another seven over twenty opens — and all
  four paid the same. `rotate(pool, n, key, skip)` is a **round robin whose
  first visit of a session starts somewhere random and every visit after it
  advances by one**. Measured over twenty visits with four advertisers:
  **ten impressions each, spread 0** (with three: spread 1). That is the
  version you can put in a contract and defend when an advertiser asks how
  many times they ran.
- **Nobody appears twice on one screen.** What the slider showed is excluded
  from the sponsored rows, and what lands in the sponsored rows is removed
  from the results before `pinSponsored()` runs. One advertiser three times
  on one screen reads as a fault, not as luck.

`pinSponsored()` is untouched — it is the pin *inside* the results, and the
sponsored rows are a band above them. The two are not merged; they only
avoid each other.

### And the counting rule stands
Every one of these uses **`mountAdRotator`** — no second timer anywhere. It
counts an impression only while the element is on screen, the tab is
visible, and a full second has passed. Anything else sells a view that did
not happen.

## V.02.9 — batch six (b): the admin panel

### Two things were not built, on purpose
**A users section, and view counts across users.** There are no user
accounts in this build: `state.user` is one person — whoever holds the
device — and `personKey()` says in `store.js` that it stands in for real
identities until there is a server. A «المستخدمون» screen today would show
one row, Rai looking at himself, which is worse than no screen: it looks
like a tool and is a mirror. Same for `bizStats` and `adStats` — they count
this device. **Where a number needs a server, the panel writes «يبدأ العدّ
مع السيرفر»** rather than a zero or an invented figure.

### The directory is browsable, searchable and editable
514 records with no search meant a particular one could not be reached at
all, and every row offered a ✕ and nothing else.

- **The search** matches name in both languages, phone, address and id, and
  prints «12 من 514». The phone goes through **`phoneKey()` — the very
  function `findDuplicates()` uses** — so the last-ten-digits rule cannot
  drift into a second version; the text goes through `normalize()`, so
  «الامانة» finds «الأمانة». Two quick filters: category and «بانتظار
  الإحداثيات», each with its live count.
- **✎ opens `#/business/edit/:id`** — the same form the owner uses. Two
  forms would be two shapes of the same data. `ownerOnly()` now lets an
  unlocked panel through via **`adminUnlocked()`, which is memory-only**: a
  reload asks for the password again.
- **✕ asks first and names the business.** `deleteBusiness()` takes the
  reviews, favourites, photos and edits with it, or they would attach to
  whatever takes the id next. A seed cannot be spliced out of `data.js`, so
  the removal is recorded in `state.removedBusinesses` and `everyBusiness()`
  filters it.
- The list is capped at 20 rows with «اعرض المزيد» — painting 514 rows to
  show three is not a list, it is a wait.

### The marketplace tab: an approved listing is still reachable
Until now the moderation queue held **only the pending**, so the moment a
listing was approved it left the panel for good — and a report arriving two
days later, or an approval given by mistake, had nowhere to be opened.

- `adminListings()` returns **everything**, seeds included, each with its
  report count. Filter by all · reported · pending · live · hidden ·
  rejected, each option carrying its own count; search by title, section,
  price or id. **Reported first by default**, because that is what the
  screen gets opened for, and the tab label carries the number.
- **«أخفِ» is the default and «احذف» is not.** Most cases are a breach that
  can be fixed, and an erased listing takes its messages and its remaining
  days with it. Hiding reuses **`hideClassified()` — the same list the
  owner's own «أخفِ الإعلان» writes to**, so it works on a seed listing too.
- **Both ask for a reason, and refuse an empty one, and the reason reaches
  the owner verbatim as a notification.** One report can be malicious; the
  person on the other end is owed the sentence that explains it.

### The statistics tab
Every figure is computed from the data, never from a counter that could
drift: the directory (total, verified, subscribed, phoneless, awaiting
coordinates), the marketplace (live, pending, hidden, expired), events,
the magazine, and every ad placement's sold / left / waiting list.

- **The chart is the `.spark` component the ads tab already had.** No
  library was added — the project is zero-dependency and does not break
  that for a drawing. Range 7 · 30 · 90 days, 30 by default.
- **The comparison** takes two dropdowns — either two sections or two
  categories — and draws two bars with a line naming the gap. **138 against
  1 is not «13700% أكثر»**: past ten times over it is said as a multiple,
  because a true number nobody can read is not a measurement.
- **Three lists**: the ten most-viewed businesses, the ten most-searched
  terms, and **the thinnest categories** — the last is the commercially
  useful one, since it says where there is not enough content to be worth
  opening, which is exactly where a subscription needs selling. Today:
  gyms 1, homeservices 3, realestate 6.
- **`recordSearch()` stores the NORMALIZED term**, or «مطعم» and «مطاعم»
  become two rows saying the same thing, and it fires 900ms after the
  typing stops — recording every keystroke would count «م», «مط», «مطع» as
  three searches.

### The Ramadan switch was never broken
Three seasonal attributes exist; **four businesses carry them and all four
are demo seeds**, and `CHIP_MIN` is 5 — so the switch opened onto nothing
and looked dead. The fix is not code. One computed line now sits under it:
**«خصائص رمضان — على 4 أنشطة اليوم (تحتاج 5 لتظهر كشريحة)»**. The work is
data, and it belongs weeks before Ramadan, not on the night.

### The panel obeys the app's own rules
The tab bar reached eight and stopped fitting in 390px. **It wraps onto a
second line rather than scrolling sideways** — the magazine chips' answer,
and the same rule: a row somebody chooses from must not run off the edge.
That rule covers the panel too.

## V.03.0 — batch seven: the search says what it means

### One-way entries: a word may be wide without making its neighbours wide
`SYNONYM_GROUPS` is symmetric — every word in a group drags every other
word with it — and «صالون» sat in **both** the women's-salon group and the
barber group so that it would find both. It did, and it also made «حلاق»
find every women's salon and «كوافير» find every barbershop: **the two
returned exactly the same 24 rows**, one of them marked «للنساء فقط».

- **`SYNONYM_ONEWAY` in `synonyms.js`** is a second table that **widens and
  is never widened into**. «صالون» left both groups and lives there alone,
  carrying both vocabularies. `expandQuery` asks the one-way table first —
  for the whole phrase, then per word — and only then the symmetric index.
- **Measured: حلاق 24 → 13 · كوافير 24 → 15 · صالون 24 → 24.** The single
  women's salon still in «حلاق» carries «قص شعر» in its own tags, and the
  three barbershops still in «كوافير» are the three trading as
  "Hair Salon" — both are the listing's own words, not a substitution, and
  the project's rule is explicit that a salon serving both appears under
  women and under men alike.

### A category name is a label, not a description
The fix above was necessary and **not sufficient**, and the reason was two
levels down: `searchHaystack()` appends **the category name** to every
listing, so typing «مطاعم» returns the restaurants. Two of the twenty-one
names carry two trades at once — **«تجميل وحلاقة»** and **«أسواق وملاحم»**
— and matched loosely they merge them. «حلاق» sits inside «وحلاقة», so a
barber search returned all 24 beauty listings **no matter what the
dictionary did**. The same fault handed «ملحمة» the whole grocery aisle.

- **The label is now held apart** (`catHaystack()` beside `searchHaystack()`,
  same `WeakMap` idiom, no second pass over the record) and matched by
  **`catMatches()` — a whole word, on both sides**. `answers(biz, entry)` in
  `store.js` is the single place the two are combined, so the three call
  sites cannot drift.
- **This is the one place a clean START is demanded.** Everywhere else
  Arabic's glued «ال» and «و» forbid it — that is the V.02.6 boundary rule
  and it stands. It is safe here because the label is **our own text**: we
  wrote its «و», and the reader is never typing it.
- **Measured, and it fixed a second category nobody had reported:**
  ملحمة 43 → **19**, بقالة 62 → **41**. Nineteen is the number V.02.6
  argued for when it threw «لحوم» out of the dictionary — the label had
  quietly put the inflation back.
- **Nothing that should return a category stopped doing so:** «مطعم» 176,
  «تجميل» 24, «beauty» 24, «مسجد» 25, «شاورما» 27, «مواقف» 130 — all
  unchanged. `registerStrings()` now throws **all three** caches away, not
  only the first: every one of them was built from the old pack.
- **Two words left the women's-salon group: «تجميل» and «beauty».** They
  are the category's own name, not salon words, and expanding «كوافير» into
  them handed back the whole section, barbers included. Typing either still
  returns all 24 — through the label, which is what they name.

### The name people type, and the space they leave out
Two more faults of the same family, both from the owner's own searching:

- **162 transliteration tags on 126 records.** V.02.6 tagged the names whose
  Arabic *looked* wrong; the right question was **which names an Arab types
  in Arabic**. «ديماسي», «الشامي», «الأقصى», «سنابرة», «حضرموت» are Arabic
  names already, so they never looked wrong and never got tagged — and all
  returned **zero**. Three families: Arabic names in Latin letters, the
  churches (the Coptic and Antiochian parishes carried the denomination but
  **not the saint** — مار مرقس, العذراء مريم, مار جرجس), and places people
  say in Arabic (اسطنبول, الغاليريا, بترا, غالفستون). **`name.ar` and
  `name.en` were not touched** — a tag is never displayed.
  **Foreign brands were deliberately left out**: Dave & Buster's, Meow Wolf,
  Puttshack. **A wrong tag is worse than no tag** — it sends the reader to
  the wrong shop.
- **`squash()`**: the space is not spelling. «عبدالله» is how most people
  write the name the record spells «عبد الله», and `Alshami` / `Al Shami` /
  `Al-Shami` are one shop. A second cached copy of the haystack with every
  space, hyphen, apostrophe and dot removed is tried **only against the word
  the reader typed, never a dictionary substitution, and only from six
  characters up** — squashing erases word boundaries, so a short query would
  land in the middle of an unrelated word. `alshami` 0 → **2** · `abuomar`
  0 → **1** · `عبدالله` 0 → **2** · `dimassis` 0 → **1**.
- **The floor is six, not four**, and this is the one number in the batch
  that was raised rather than taken as given. Four was measured on the
  Latin cases the rule was built for — `alshami`, `abuomar`, `dimassis`,
  «عبدالله», every one of them seven letters or more — and Arabic words are
  short and glue «و» and «ال» onto the next one. Run over all 984
  dictionary words plus every tag word in the directory, **four invented
  143 matches**: «نجار» found nine hookah lounges inside «لاونج بار»,
  «بترا» found three trampoline parks inside «ألعاب ترامبولين», «موال»
  found the aquarium inside «أكواريوم وألعاب», and «بارك» · «سينا» · «ايوب»
  each found something unrelated. **At six all of them are gone and every
  true match is kept** — «سوبر ماركت» 23 · `sugarland` 32 · `coffeehouse` ·
  `barber shop` · `water park` · `wifi` against «wi fi». The break between
  five and six is that clean, and it is not luck: a squashed query earns a
  false positive by being short.
- **One V.02.2 result was deliberately reversed.** «صالون فلوريدا» was the
  example that justified the three-stage search: it matched nothing exactly
  and fell to stage two, 24 rows under «ما لقينا … بالضبط». The record now
  carries the Arabic «فلوريدا», so the query is **exact and returns the one
  salon** — the near-miss line correctly does not appear. The three stages
  are untouched; this query simply no longer needs the second one.

### An id is an id
The admin search box says «بالاسم أو الهاتف أو العنوان أو المعرّف» and the
id was the one that did not work: **`b281` returned 145 rows** with the
right one buried, because the three-digit phone rule took `281` — **Houston's
area code**. So did `b713` and `b832`.

- **A word shaped `/^b\d+$/` is never a name, an address or a phone
  number**, so it is matched alone and **returned alone**. `b281` → 1.
  `b9999` → **0, and zero is the true and useful answer**.
- **The small rule itself was not wrong** — three digits matching anywhere
  in a number helps whoever remembers the last four. It was only swallowing
  the id.
- **Everything else is ranked instead of mixed**: whole phone · name ·
  partial phone · address. `Array#sort` is stable, so equals keep the order
  of the file. `713` still returns 168 and `Hillcroft` still returns 65 —
  but Hillcroft now leads with **b187 Aisha's Salon (the name)** instead of
  **b1 Al Sham (the address)**, which is what whoever typed a name wanted.

### The dictionary's own test reads what the app reads
`tools/synonyms.test.mjs` built its haystack **without** the category name
at all, which is why the label fault survived a batch that measured
everything else. It now holds the label apart and matches it with
`catMatches`, and squashes the haystack too — the same three pieces the
store uses. **100 groups · 984 words**, and the confusion bar is unmoved:
حلاق · كوافير · صالون · كنيسة · شاورما · محامي · ضرائب · ترامبولين → **0%**,
ملحمة 5% · بقالة 5% · مسجد 8% · حديقة 14%.

## V.03.1 — batch seven (a): the location, and the prayer times

### The ZIP names the city; the snap only fills the gaps
Rai opened the app at home in **77407 — Richmond** and was told he was in
**Katy**. The reverse lookup had resolved the ZIP correctly and one line
then threw the right answer away:

```js
const near = S.nearestCity({ lat, lng });
onOk({ city: (near && near.city) || r.city, … });   // ← Katy
```

North 77407 is **6.9 miles** from the centre of Katy and **9.1** from the
centre of Richmond, so the arithmetic was right — **and the arithmetic was
the mistake.** Ask somebody where they live and they name their town;
nobody says "the nearest city hall to me is Katy".

- **If the ZIP's own city is one of the 25 we cover, that IS the city.**
  `nearestCity()` is consulted only when it is not — which is what it was
  written for: keeping «مدينتي» from naming a place the directory has never
  heard of.
- **`inRegion` still comes from `nearestCity`.** Coverage is one question
  and the name is another, and merging them is what caused this.

### The point goes stale the moment its owner drives away
`state.geo` was written once and never read again: whoever set their
location in Katy and moved to Sugar Land stayed in Katy for good.

- **`watchPosition` is banned and is not used.** It runs the radio
  continuously, flattens the battery, and makes an app feel like it is
  following you — which is the one thing that gets it deleted.
- The point is re-read when the reader comes **back** to the app, and only
  when all three hold at once: **the permission was already granted** (a
  point exists and there is no refusal), **what we hold is older than
  thirty minutes**, and **the page is visible**. Then one quiet
  `getCurrentPosition` (`maximumAge: 300000`, `timeout: 8000`) with no
  sheet, no prompt and no question. A failure is swallowed and the stored
  point stands — and a failed attempt does not refresh `at`, so the retry
  is throttled by its own timestamp rather than firing on every switch.
- **The permission is never asked for twice.** iOS asks once and a refusal
  is permanent; `geoDenied` stops the quiet path dead.
- The changed city repaints **the chips in place** — the new name is the
  whole signal — and «حدّث موقعي» in the location sheet skips the thirty
  minutes for somebody who has just arrived somewhere.

### Prayer times: computed here, asking nothing of anybody
`js/prayer.js` — **no API and no library**, and it imports nothing. Three
reasons, in order of weight: it **works with no internet**, and somebody
opening the app to know when maghrib is may be standing outside with no
signal; it is **instant**; and it does not stop the day a website changes
its terms. Zero dependencies has been the rule since the first day, and a
table of angles is not a reason to break it.

- Julian day → the sun's declination and the equation of time → solar noon
  → an hour angle per time. Asr from the shadow ratio, sunrise and sunset
  at **0.833°** below the horizon (refraction plus the disc's own radius).
- **The timezone comes from the device** (`-new Date().getTimezoneOffset()`),
  which is why this project carries no timezone database: the phone already
  knows, daylight saving included.
- **Four methods, and this is not a technical detail.** ISNA (15/15) ·
  Muslim World League (18/17) · Umm al-Qura (18.5 / isha +90 min) ·
  **Jafari (16/14, maghrib 4° below the horizon)**. Houston holds a large
  Iraqi and Lebanese Shia community whose times genuinely differ, and an
  app that hands them one set of times that is not theirs is telling them
  it is not for them. Plus the asr school: **standard (shadow 1) or Hanafi
  (shadow 2)**.
- **The labels are method names, never sect names** — ISNA, أم القرى,
  الجعفري — which is what every prayer app does; whoever wants the Jafari
  method finds it in one tap and the app never stands in a queue it has no
  business standing in. **And no mosque is ever tagged with a school or a
  sect by us.** Whoever wants to declare an identity declares it themselves
  when they claim the page. One mistake here costs the trust of a whole
  community.
- **When Jafari is chosen the times are shown grouped** (ظهر+عصر ·
  مغرب+عشاء), because that is how they are actually prayed, and it costs a
  line.
- **A time that cannot exist comes back `null` and prints «—».** At 69°N in
  June the sun never reaches the fajr angle; the app says so rather than
  inventing a number somebody would pray by.
- Measured against the reference table for Houston, **to the minute**:
  20 Aug 2026 ISNA 05:43 · 06:52 · 13:25 · 17:01 · 19:58 · 21:07 · Jafari
  maghrib **20:13** · Hanafi asr **18:05** · 21 Dec 2026 06:02 · 07:13 ·
  12:19 · 15:08 · 17:26 · 18:37. And the order fajr < شروق < ظهر < عصر <
  مغرب < عشاء holds on **every day of the year in all four methods and both
  asr schools**.

### Four places, and one of them is the hook
- **A single line under the header on Home**: «المغرب 7:52 · باقي ساعة و12
  دقيقة». It rides **the existing minute ticker** (`onMinute` in `ui.js`) —
  there is one minute timer in this app and this adds none — repaints only
  itself, and never grows to a second line above the fold. With no location
  it reads «حدّد موقعك لتظهر مواقيت الصلاة» and opens the existing flow.
- **`#/prayer`**: the five plus sunrise, the next one on a live countdown,
  the mosques nearby, the settings, and the standing line **«الحساب فلكي —
  والإقامة يحدّدها كل مسجد»**. Sunrise is printed among them and greyed: it
  is not a prayer, it is what a fasting person is asking about.
- **The mosque's page** — see below.
- **A drawer row** under «تصنيفات عربنا». **The bottom bar is untouched**:
  five tabs, all five spoken for.
- **The times work anywhere in the United States** — the calculation needs a
  point and a date and nothing else — while the **directory** covers Houston
  and its suburbs. So outside the region «مساجد قريبة منك» is **hidden
  rather than empty** and one honest line says «المواقيت تعمل أينما كنت —
  والدليل يغطّي هيوستن وضواحيها حالياً».

### The adhan is computed; the iqama is the mosque's own decision
This is the distinction the whole worship block is built around. ISGH prays
jumuah at 1:30, the mosque down the road at 2:00, a third holds two
khutbahs. No API in the world has those numbers, because they are not
arithmetic.

- Calculated times under **«الأذان (حساب فلكي)»**, whatever the mosque
  published under **«الإقامة»**, and never mixed — confusing the two gets
  people there late.
- **Where nothing is published the app says so**: «الإقامة: غير متوفّرة —
  اتصل بالمسجد» · «وقت الجمعة: غير متوفّر — اتصل بالمسجد» (and the same for
  a church's mass times). **An invented Friday time sends a man late to
  jumuah, and that is not forgivable** — the blank is what creates the
  pressure that fills it.
- **The mosque enters its own**: the edit form a claimed listing already
  opens now carries jumuah (one khutbah or two) and the five iqamas. A
  mosque *wants* this filled in — people knowing when its jumuah is serves
  the mosque.
- **The congregation corrects it**: «الوقت غير صحيح؟ صحّحه» takes one line
  into the admin queue — **never straight onto the page** — and the admin
  opens it in the same edit form the mosque uses. Every mosque has hundreds
  who go each Friday and one of them fixes it in half a minute.

### Thirty-three places of worship did not say what they were
The block above needs to know a masjid from a parish, and **33 of the 35
records carried no kind at all** — `worship` was empty on everything except
the two development seeds, and not one imported row carried a `worshipKind`
attribute. So the app could show neither the adhan nor the honest blank
where they mattered most.

**The fix was the data, not the code.** Each of the 33 now carries the kind
its own name states — `wkMosque` · `wkIslamicCenter` · `wkCoptic` ·
`wkAntiochian` · `wkMelkite` · `wkBaptist` — and `worshipKind()` in
`store.js` reads that attribute and **never the name and never a guess**.
**23 mosques and 12 churches**, and the filter sheet gained a working group
in the same move.

- **`wkChurch` is a new attribute** for the three churches whose own name
  states no denomination. Naming one for them would be us deciding somebody
  else's identity — the same rule that forbids tagging a mosque with a
  school. A new attribute is one line in `data.js` and two in `i18n.js`,
  exactly as the registry promises.

## V.03.2 — batch seven (b): the content that brings people back

The measure here is not audience but **frequency**. An app opened once a
year is worth nothing however many people installed it. Prayer times (V.03.1)
return somebody five times a day; offers weekly; the newcomer's guide daily
for a few weeks, once in a lifetime; Ramadan is one month a year.

### Offers — a subscription feature before it is content
«العروض» had been printed in the $29 column since V.01.8 and never built.
It pays twice: content that changes every week is what reopens the app, and
it is the **first concrete thing a grocer can picture buying** — one post to
the whole community for less than a single boosted photo elsewhere. There
are 41 markets in the directory and every one of them already posts its
weekly deals to WhatsApp, where they vanish.

Four rules, all in `store.js` so no second surface can disagree:

- **It ends by itself.** `endsAt` is required and capped at
  `MAX_OFFER_DAYS` (30). Nothing sweeps up: `offersFor()` filters on the
  clock, so an expired offer is gone from the page, the home strip, the
  «عنده عرض» badge and the filter in the same instant. A stale offer is
  worse than none — somebody drives out and is turned away at the counter.
- **Three at a time** (`MAX_OFFERS`), pending ones counted, or a fourth
  would queue behind the cap. Without it the page becomes a circular.
- **Every one is reviewed**, like any other user content. A price claim
  published unread is our liability, not the shop's. A rejection carries
  the admin's written reason to the owner as a notification.
- **No phone number in the text.** `stripPhones` already existed for the
  marketplace and this is the same job; `addOffer` returns
  `strippedPhone` so the owner is **told** it happened rather than left to
  notice — «الرقم موجود على صفحتك أصلاً».

Four surfaces, and the block draws itself differently for each reader:
a reader sees what is live; the owner sees their pending and rejected ones
too, with the count left; **a shop that has not subscribed sees the door**
(`.offer-lock` → `#/subscribe`) and a reader on that same page sees nothing
at all, because an «offers» heading over an empty page is the blank screen
this project bans. **A `nonCommercial` place is offered none of it** — a
city park has nobody to sell to, the same rule as the claim button.

- **Home**: «عروض هذا الأسبوع» between «مميّز هذا الأسبوع» and the magazine,
  **six** at most with «عرض الكل» → `#/offers` behind it, soonest to run out
  first. The shop's name is on the card: «خصم 20%» alone says nothing about
  who.
- **Directory**: a gold «عنده عرض» mark on the row, an option in the filter
  sheet **with its live count** — offered only when somebody is actually
  running one — and `offer=1` in the URL, so the filtered view is a link
  somebody can send.
- **Admin**: its own block in the moderation queue, counted in
  `pendingCount()`. `pendingWorshipFixes()` was also missing from that
  count and went in with it.

### The newcomer's guide
A family that landed a month ago is at the sharpest moment of need in their
lives and opens the app every day for weeks; whoever helps them then keeps
them for years and is named to every family that arrives after.

- **Pinned at the head of the magazine, above the chips**, so no section
  filter can hide it and no newer article can sink it — and a fixed card on
  Home, and a drawer row.
- **Eight parts**, the drawer's own accordion, one open at a time.
- **Every part ends in a doorway** — that is what separates a guide from a
  post. And **every route was measured**: `eduDriving` was the obvious
  filter for the driving licence and carries **zero** businesses, so that
  part opens the whole education category instead. `NEWCOMER_PARTS` in
  `data.js` holds the structure; the strings derive their i18n key from the
  id the way the attribute registry does, so they cannot drift.
- **The copy is a placeholder and says so.** Nothing here invents a
  government procedure — one wrong step or number costs a family a day.
  The button under each part works today; Rai's text replaces `ncSoon`.

### Ramadan
**Iftar is maghrib.** The V.03.1 engine already computes it to the minute
with the reader's own method, so the bar costs no arithmetic, no setting
and **no second timer** — it rides the same `onMinute` ticker and re-labels
one number. Verified: the bar and `#/prayer` agree to the minute.

- It appears only while `state.seasons.ramadan` is on and goes with it,
  filters included — `attrGroupsForCat` already gated on `seasonOn`, so
  that half needed no code.
- **The two buttons filter by the attribute, not the category.**
  `cat=restaurants&attrs=suhoor` measured **zero**: the one listing that
  carries `suhoor` is a bakery, which is exactly who is open at 3am, and
  the category was hiding the only right answer. A button whose filter
  returns nothing is not drawn at all.
- The admin switch already printed «على 4 أنشطة اليوم — تحتاج 5 لتظهر
  كشريحة» from batch six (b); that is what item 3(ج) asked for and it was
  left alone.

### The drawer is now full — and this is for the owner to settle
The newcomer row is the sixth leaf in «تصنيفات عربنا», and with that group
open the panel measures **882 against 844: it scrolls**, which the drawer's
standing rule forbids. One row anywhere would fix it. Separately, the
**«حسابي» group has measured 932 against 844 since before V.03.1** — that
one is not new and not from this batch. Nothing was removed to make room:
which row goes is a product decision, not a code one.

## V.03.3 — batch eight (1 + 2): the descriptions, and who may pay

### The city is written in English, always
Rai's rule: **the city name is English even when the interface is Arabic,
and somebody who searches in Arabic finds the listing and is shown its
English name.** It follows the rule the names already obey — the name as
it is on the shopfront, the transliteration in the search words — and the
address underneath is English anyway, so an Arabic city above it makes the
screen say the same thing twice in two scripts.

**The code already obeyed it.** `cityOf()` reads the English address,
`cityChipLabel()` does not translate, `CITY_POINTS` and
`directoryCities()` are English throughout, and no city name exists in
i18n as a label. Every violation was in the data, and there were six:

- **b137 and b281** carried «كاتي» and «هيوستن» in their displayed names.
  b137 carried it on its **English side too**, which the supplied file did
  not list.
- **`regionName`** read «هيوستن والمنطقة» → «Houston والمنطقة».
- **`prOutside`, `ncSub`, `ncCardTitle`** — three of our own strings from
  V.03.1 and V.03.2 said «هيوستن» inside a sentence. The audit had looked
  for a city used *as a label*; a city inside a sentence sits on the same
  screen as the same city in English. («وصلت هيوستن جديد؟» was dialect as
  well, and is «وصلت إلى Houston حديثاً؟».)

**The tags stay Arabic and must never be converted.** They are invisible,
and they are the whole reason «هيوستن» typed in Arabic returns 378 shops
whose names and addresses are English. That is the rule working, not an
exception to it.

### 485 descriptions that had been written and never installed
Every real listing carried `desc: {ar:"", en:""}`. The text existed — it
went to review with the name proposals — but only the names came back and
were applied, so 485 pages printed a name, a rating, tags, hours and an
address with **no line saying what the place is**. The same thing that had
happened to the Arabic names, and invisible for the same reason: the page
looks finished and is missing its meaning.

- One short sentence each, no claim words (the FTC rule), measured: **zero
  «الأفضل» / «الأشهر» / «الأرخص» / "best" / "cheapest"**.
- **Fourteen still ended «بتكساس».** The supplied file's own sweep looked
  for the city at the *end* of the line and the state name sits after it.
  All read «بـTexas» now.
- The search numbers held: حلاق 13 · كوافير 15 · صالون 24 · ملحمة 19 ·
  مطعم 176 — V.03.0's figures unmoved. **«بقاله» went 41 → 42**, and the
  newcomer is a bakery whose description says supermarket, which is a find
  and not a leak.

### The payment path had no guard at all
The V.02.9 audit was right about the three screens it checked and missed
the one that had **never been guarded**: a reader who owns nothing could
open `#/subscribe-consent/b1` and reach «$29 · متابعة إلى الدفع», with the
business id coming straight off the URL. Today that is a mess rather than
a theft — the state is in the reader's own localStorage — but the day it
lives on a server it is somebody buying a stranger's shop a subscription,
and the record is not a row in a table: `isPaid()` feeds «إعلانات مميّزة»
and the ranking inside a category.

- Both screens call `ownerOnly(bizId)`, **deliberately without
  `allowAdmin`**: an admin edits data and never buys in somebody's name. A
  subscription given by hand goes through the panel, where it leaves a
  receipt and a record of who took the money.
- **`startSubscription()` itself returns `null` for a business the caller
  does not own.** A guard on a screen is bypassed by anything that is not
  that screen — the console today, an API call tomorrow — so the rule is
  written once in `store.js` where every caller passes it. That is the
  line that still holds the day there is a server, and it is the one the
  test exercises from the console.

### «آخر ما عُدِّل» — the panel leaves a trace
An admin edits from the owner's own screen. That is the right design and it
makes the two writes indistinguishable afterwards, so «who changed my phone
number?» had no answer at all.

`state.adminLog` records `{at, bizId, field, from, to}`, **one line per
field and only when the writer is the admin and not the owner** —
`adminEditing()` in `store.js` is the single definition, so no screen has
to remember to pass a flag. Capped at `ADMIN_LOG_MAX` (500). The directory
tab prints it. **A field the form merely filled in is not a change**: the
edit form submits everything it holds, so a record that simply had no
`nonCommercial` came back `undefined → false`, and a log full of that
teaches nobody anything.

And the edit screen, opened from the panel, says **«تعدّل بصفتك الإدارة —
لا بصفتك صاحب هذا النشاط»**. `adminUnlocked()` is a login, not a mode that
lingers, so the risk was never that it stays on — it is not noticing you
are in it.

## V.03.4 — batch eight (3 + 4): the words, the password, and the money

### One word per meaning
**«مراجعة» was doing two opposite jobs** across 41 texts — a customer's
opinion and an admin's vetting — so «صورتك قيد المراجعة» read as somebody
writing a review of your photo. The split:

| meaning | the only word | never |
|---|---|---|
| a customer's opinion | **تقييم** | مراجعة |
| an admin's vetting | **بانتظار الموافقة** | قيد المراجعة |

«تقييم» is what Google Maps uses in Arabic, so it is familiar; «بانتظار
الموافقة» says **what you are waiting for** rather than what a member of
staff is doing. The verb survives only where the actor is named
(`claimFormNote` «الطلب يُراجع يدوياً», `verifyStep3`, and `reviewOrder`,
which is the buyer reviewing their own order before paying).

And it was being **sold twice**: `reviewsTitle` «التقييمات والمراجعات» beside
`subFeatures` «المراجعات والتقييمات» made one feature look like two on the
subscription page.

### Nine keys were defined twice, and the first was dead
`catRestaurants` · `catDoctors` · `catLawyers` · `catBeauty` · `catAuto` ·
`catGrocery` · `catEducation` · `catTravel` · `confirmPassword`. In
JavaScript the later definition wins, so the early ones looked like the
reference and changed nothing — a maintenance trap, not a tidiness
problem: fix «أطباء» on the dead line and hunt for an hour.

**They share lines** (`catAll: 'الكل', catRestaurants: 'مطاعم', …`), which
is why a line-based grep finds none of them. Found by parsing the packs,
deleted from **both** at once, and v27 re-parses on every run so no tenth
can appear quietly.

### One name for the password, and one rule behind it
«كلمة السر» (10 keys) and «كلمة المرور» (6) stood in the same screen — the
field said one and its own error message said the other. It is **كلمة
المرور** everywhere now, as Google, Apple and Microsoft write it.

The rule had the same disease. Sign-up demanded 8 + a letter + a digit;
**the change screen demanded `length < 6` and nothing else**, and so did
the panel — so a strong password could become `123456` a minute later,
which makes a rule on the sign-up screen worth nothing. All three call
`passwordChecks()` in `store.js`.

- **English only, and not as a preference.** Arabic has no capitals, so
  «حرف كبير» is a condition nobody can meet. ا · أ · إ · آ look identical
  and are four characters; keyboards disagree about which they emit, so
  the same word typed on another phone is a different string and its owner
  is locked out **reading their correct password off the screen**, with
  nothing visible to explain it. And Arabic-Indic digits are not digits to
  `/\d/`, so `Rami٢٠٢٦$` would be refused for «missing a number» with four
  of them on screen. The message says the reason, not the verdict, and it
  comes **alone** — telling somebody who typed Arabic that they also need
  a capital adds confusion to confusion.
- **The banned list is what makes the rule work.** Without it the rule
  produces `Password1$`: eight characters, upper, lower, digit, symbol,
  and one of the most-used passwords on earth. Leet forms are normalised
  **before** the comparison — strip the symbols first and `P@ssw0rd!`
  becomes `pssw0rd`, which does not match `password` and sails through.
  The app's own name and the cities are matched **whole**, so
  `Houston2026$` is refused and `Elby#Katy77` is not.
- **The strength meter is gone.** Once the rule is absolute a password is
  accepted or it is not, and «متوسّطة» tells nobody what to fix. The live
  checklist does: five conditions, green as each is met, **red only after
  leaving the field or pressing the button**, and never on the first
  keystroke — somebody who types `R` and is told it is invalid feels they
  got it wrong before they started.
- **The word itself is no longer stored.** It sat in localStorage as
  typed. The danger was never really this app, where the account lives on
  its owner's device — it is that most people reuse one password, so what
  we kept in the clear was probably the key to their email. A salted
  SHA-256 is kept instead, which answers the one question this build asks.
  `ADMIN_PASS` in `store.js` is still the server batch's job, and it is
  the same lesson: it satisfies every condition and everyone who opens the
  file knows it.

### Arabic counts to four
The countdown under the header read **«باقي 2 ساعات»** — on the first
screen anybody opens, repainting every minute. The code knew singular and
"everything else is plural"; Arabic has four cases: 1 singular · 2 **dual**
· 3–10 plural · 11+ **singular again**. `arCount()` in `i18n.js` carries
all four and English fills its two forms into the same four slots, so
there is one function and no `if (lang)` anywhere. Eight counters use it —
days left on an ad, the resend countdown (which ticks every second in
front of somebody's first minute in the app), the results count, the views
line, the season count, the test clock, the comparison — and `prHour` /
`prHours` are gone.

### No message confirms what the eye already saw
The theme button raised «صار الوضع غامق» over the logo. The screen had
just changed colour and the icon had flipped sun ↔ moon: two
confirmations, without a word, and the bar hid `ARABNA` every time.
Deleted, with both strings. **The rule it leaves behind:** a toast is for
what leaves no mark — «تم حفظ ملفك», «تم نسخ الرابط» — never for a change
the reader is watching happen.

### A receipt for every amount taken
`inv1` · `inv2` · `inv3` **published the size of the business**: an
advertiser reading `inv3` knows they are the third customer since it
opened. `ARB-26-K4M8P` instead, from an alphabet with no `0/O` and no
`1/I/L` because the number is read down a phone, unique before it is
issued. Ads, boosts and the badge produced no invoice at all before.

- **Never edited after issue** — that is the definition of cooking the
  books. A refund is a **second** receipt with a negative amount pointing
  at the first, and both stay in the list.
- **Three lines that do not come off**: the period the money bought,
  «renews automatically on …» with the literal path to cancel, and the
  issuer — left as `[TODO]` until Rai gives the registered name.
- **The tax line is present at `$0.00`**, not absent. Adding it later to
  receipts issued without one is far harder than filling a line that is
  already there, and whether Texas taxes a digital subscription is a
  question for his accountant.
- **`deleteAccount()` was wiping the financial record.** Somebody who
  subscribed and then deleted their account left no trace that money had
  been taken — not for the accountant, not for the bank on a chargeback.
  Deleting is a right and an app-store requirement, so the person is
  stripped out of the receipt and the transaction stays.
- The screen is the original, not a stopgap: email is lost and binned, and
  the button for it says plainly that it waits for the server.

### Directions ask once
`openMaps` decided for the owner of the phone — anything Apple opened
Apple Maps, for somebody who may have used Google Maps every day of their
life. **No web app can see what is installed** (the platforms forbid it,
or any site could read your app list), so there is nothing to detect:
offer the three and let them choose, Google first and preselected, with
«افتح فيه دائماً» stored in `state.mapsApp` and changeable from Settings.
All three are **web links, never app schemes** — a web link opens the app
when it is there and the site when it is not, while `waze://` on a phone
without Waze is a white screen. Apple Maps is not offered on Android. The
address goes as text, never coordinates: a street address opens the right
business card, a point opens a spot in space.

### Cash is taken on the books
There is **no «skip payment» button on any screen a user can reach** and no
«paid in cash» box anybody can tick — a button like that gets found. The
money is handed over and the order is issued from the panel, which refuses
without the name of **who took it**.

**A cash order does not renew**, and that is the part that would have cost
money quietly: created like an ordinary subscription it leaves a
subscriber whose month ran out weeks ago, whose page still says
«subscribed», and from whom nothing was collected. So it is a closed
period (`autoRenew: false`, `cancelAtPeriodEnd: true`), the panel warns
`CASH_WARN_DAYS` (7) ahead, it expires by itself, and its receipt says
**«ينتهي في»** — never «يتجدّد تلقائياً», which would be a promise nobody
keeps. Card and cash are two figures in the statistics: mixed together the
revenue never matches the bank statement.

## V.03.5 — batch eight (5): Back out of the drawer, and the size of the text

### The drawer never told the browser it was there
The drawer is a layer painted over the screen and wiped again; history knew
nothing about it. So Back from an open drawer left the screen entirely, and
Back after choosing a leaf returned to the previous page rather than to the
list the reader had just been reading — they are still in the menu in their
own head, and they picked one thing meaning to come back for another.

The pattern was already in the file: the dropdown panels (`ui.js:250–330`)
solve exactly this with **one history entry** and a token in
`history.state`. The drawer copies it — a second scheme fighting over
history is what caused the three separate Back bugs this project has
already fixed.

- **`hideDrawer()` and `closeDrawer()` are the whole batch.** `hideDrawer()`
  removes the panel and **leaves the entry**, so Back lands on it and the
  drawer comes back — with its group still expanded, because `openGroup` is
  a module variable that already survived a close. `closeDrawer()` — the ✕,
  a tap outside, the language, signing out — **winds the entry back**, so a
  drawer closed on purpose never reappears.
- **The mark lives on the entry, not in a variable**, and this is the fault
  that cost the batch its afternoon. Setting `location.hash` fires a
  **`popstate` with a null state BEFORE `hashchange`** — the fragment
  navigation algorithm does both, in that order — so a handler that tore its
  own bookkeeping down on the first pop it saw destroyed the entry at the
  one moment it had to survive: the instant a route was picked. Reading
  `history.state.drawer` makes that stray pop harmless.
- **`historyKey()` and `replaceHash()` now MERGE state instead of replacing
  it.** Stamping a bare `{ key }` over the entry wiped the drawer's mark
  before its own handler could read it. Anything else that ever puts a field
  on an entry is protected by the same line.
- **The entry carries the key of the page it was opened from**, so it is the
  same page as far as scroll memory is concerned and Back lands on the
  directory exactly where it was left.
- The guard is `if (!drawerOwnsEntry())`, so reopening from a pop pushes
  nothing and **ten opens and closes are still one Back**. `openDD.close(true)`
  ('abandon') hands a dropdown's entry over rather than leaving a second one:
  **one Back closes the drawer and keeps the screen.**
- Every `history` call stays inside `try` — the project is opened from
  `file://` sometimes, where `pushState` throws and the drawer must simply
  work as it did.

### The text was small, and the phone's own setting did nothing at all
196 `font-size` declarations, **every one of them in `px`**, commonest value
**12.5px** against a declared base of 16 that almost nothing used. The size
was the smaller half of the problem: **`px` is absolute, so a reader who
enlarged the text on their iPhone saw no difference here whatsoever** — and
that reader is the one who needs us most.

**Four steps, and the order cannot be reversed.**

**1. One line, for a fault that was already there.** `.search-bar input` had
`min-width: auto` — every flex item's default, meaning "never shrink below
your own content". Its content is the long placeholder, so the input refused
to shrink and **spilled out of the bar it sits in, over the location chip**.
The parent shrank as told and the child walked out of it. Measured at 390px:
**14px of overlap today at base 16**, hidden under the rounded corner — and
**105px at base 22**, one word printed on top of another. `min-width: 0;
width: 100%` → **0 at 16, 20, 22 and 26**. Required whether or not the text
ever grows.

**2. `px` → `rem`, and nothing else.** 196 declarations in `app.css` and
**27 more inline in the modules** — leaving those would have left a 17px
heading beside body text that had grown. **Five decimals, not four**: at four,
12.5px becomes `.7813rem` = 12.5008px, invisible and enough to make every
later before/after comparison stop matching literally. At five all 22 values
map back exactly. **`font-size` only** — no padding, no radius, no width, or
every enlargement would inflate the whole app instead of the words. The
mini banner's **62px box is untouched**: its size is sold and is written into
this file. **Verified pixel-identical**: computed `font-size` of every
element on 14 screens, old stylesheet against new, **zero differences**.

**3. The base — and it is a percentage, not `17px`.** The spec asked for
`html, body { font-size: 17px }`, and its own test asked for **zero px
font-sizes in the file**; the two cannot both be true, and the px version
also quietly cancels the device setting this batch exists to honour. So
**`html { font-size: 106.25% }`** — 17px on a stock browser, and 106.25% of
*the reader's own number* on a phone whose text was enlarged. Measured with
the browser default moved to 24px: **before, the app stayed at 16px and a
card title at 15px whatever the device said; now the root follows to 25.5px.**
Only `html` carries it — on `body` as well it would compound, which `px`
never did. 17 and not 18: 18 turns 12.5px into 14px, a 12% jump nobody could
judge one piece of afterwards.

**4. Settings → حجم الخط**, four steps `16 · 17 · 19 · 21` in
`state.fontScale`, applied by `applyFontScale()` **before the first paint**,
beside `applyTheme()` and for the same reason — after it, every launch
flashes the old size. Written as a percentage too, so the reader's choice
**multiplies** with their device's rather than replacing it: device 24 +
«أكبر» = 31.5px, and that is correct, they know their own eyes. **A live
sample sits under the buttons** — four words named «كبير» tell nobody how
large large is — and «عادي» is the default, so anybody who never opens the
screen is never moved.

**Measured after all four**: nine screens × two languages × bases 17 and 21
— no horizontal scroll, nothing off the edge, nothing clipped, zero console
errors.

**Three assertions moved, and only because the base did.** Each carries a
comment naming the reversal. v7's «sub-item font is 13.8px» is asserted as
the RATIO (`.8625rem`) it always meant, so it survives the reader picking
«كبير» too. v7's and v20's drawer-overflow guards were frozen pixels
against a frozen 844; they measure a real row and the panel's own height
now. And the drawer gap itself is worth reading twice: **the rows grow
6.25% while the panel's height is the viewport's and does not move at
all**, so the overflow — the difference between the two — grows far
faster than the text. 46px over at 16, **72 at 17**, 127 at «أكبر».

## V.03.6 — batch nine (ح): the security pass

**Nothing here made the app look broken.** It worked exactly as it always
had, which is why none of it surfaced in eight batches of screen-by-screen
review. That is the reason this file went first: every other file in the
batch adds display sites, and a new display site over an unguarded base is
a new hole.

### The user's text was running as code, and a link was enough
Measured before the fix: a probe element sent in `#/directory?q=…` **became
part of the page**, not a word on it. So did a marketplace listing's title
and description, a review and its author, an offer — and the queue **inside
the admin panel**, which is the one that matters most: reaching Rai's own
screen needed no break-in, only posting an advertisement and waiting for him
to open it.

- **The protection existed and was not binding.** `esc` was copied into five
  screens, a sixth copy in `admin.js` guarded the quote and nothing else, a
  seventh (`att`) sat beside it, and one template escaped `&` and `<` by
  hand. So a fifth screen written afterwards had none. Adding the call in
  the four reported places would have left the sixth to be written tomorrow.
- **`esc()` is now exported from `ui.js` and is the only one.** All seven
  copies are deleted. It escapes the apostrophe too, so it is correct inside
  a single-quoted attribute as well as a double-quoted one — one function
  that is right everywhere beats two the caller has to choose between.
- **129 interpolations were wrapped** across nine files: names, addresses,
  descriptions, tags, reviews and their authors, search terms, offers,
  prices somebody typed, photo URLs, an advertiser's own colour in a `style`
  attribute, and the city that comes back from the reverse-geocoder — that
  last one is somebody else's server, which is the same category of trust.
- **THE RULE, and it is not a matter of judgement:** *every value that was
  not written in `i18n.js` goes through `esc()` before it reaches
  `innerHTML`.* `t()` and `icon()` are ours; a number we computed is ours;
  everything else is not. Reviewing a change means looking for `${` inside a
  template and asking where the value came from.
- **Two places deliberately do NOT escape**, and both would break if they
  did: `toDataFile()` in `store.js` emits JavaScript source for `data.js`
  (it uses `JSON.stringify`, which is the right escape for that target), and
  a handful of interpolations whose value is markup we built, not a value —
  the phone line on `#/profile` is one, and wrapping it printed the tags.

### The second layer, which does not excuse the first
`script-src 'self'` in a `Content-Security-Policy` — as a `<meta>` in
`index.html` and as a real header in `vercel.json`. Injected code is not a
file from this origin, so it does not run whatever anybody forgets.

- Every host in `connect-src` is one the app really calls: `api.zippopotam.us`
  and the two reverse-geocoders. **A host forgotten here fails silently**,
  which is why v29 walks fifteen screens and asserts zero violations, and
  proves each of the three passes the policy while an unlisted host does not.
- `style-src` needs `'unsafe-inline'`: the app sets `style="…"` on elements
  it builds and an advertiser's colour is one of them. A style cannot execute.
- **The single-file build gets a different policy, and that is not a
  loophole.** It *is* an inline importmap plus modules as `data:` URLs, so
  the strict rule would refuse to run the app itself. It is the offline
  backup, opened from a file and never from the web; `build_single.py`
  rewrites the line and v29 asserts both cases rather than skipping one.

**And that difference is what these two lines are for.** The attack was
re-run on both builds after this batch and the protection holds in each —
but the second layer is not the same in each:

```
index.html                script-src 'self'
index-single-file.html    script-src 'self' 'unsafe-inline' data: blob:
```

So `index.html` has two layers, `esc()` first and the policy refusing
whatever survived it, while the single-file build has **one**. A display
site that forgets `esc` prints markup as words in the first and is a whole
hole in the second.

> **`esc()` is compulsory with no exception, and is never leaned on CSP.**
> The single-file build runs under `script-src 'unsafe-inline'` — the
> condition of that build existing, not a choice — **so there is no second
> layer in it.** Whatever escapes `esc()` executes.
>
> **No file with an `innerHTML` in it is closed before every `${` in it has
> been read:** if the value is not from `t()`, `icon()`, or a number we
> computed, **it needs `esc()`.**

Two lines and not one, because the first says *why* and the second says
*when it is checked* — **and a rule with no fixed moment of checking is a
rule that gets forgotten.** That is exactly what happened to `distLabel`
(V.04.1): the rule was already written down, the review was not a step in
closing a batch, and the markup reached the most-opened screen in the app.

### Signed in is not the same as owning it
`#/boost/<somebody else's listing>` charged the reader, pinned **the other
person's advertisement** to the top of the marketplace and wrote the receipt
in the reader's name. The file reported that one. Auditing every screen that
edits by an id from the URL turned up two more:

- **`#/post?edit=<not yours>`** opened a stranger's listing with their text
  in the fields.
- **`#/events/propose?admin=1`** — the worst of the three. `isAdmin` was read
  **off the query string**, so anybody, signed in or not, got the staff form,
  published an event **live to everyone**, and could tick `featured`, which
  is the $99/week pin. A flag in the address bar is a request, never a
  permission; it is `adminUnlocked()` now, which is memory-only.

Guarded at the door **and in the store**, because a guard on a screen is
bypassed by anything that is not that screen — the console today, an API
call tomorrow. That is the V.03.3 lesson about `startSubscription`, and
`ownsListing()` / `ownsEvent()` are now the single definitions.
`boostClassified`, `updateClassified` and `updateEvent` refuse; `addEvent`
downgrades a `live` status and strips `featured` unless the panel asked.
**The owner and the panel lose nothing** — v29 asserts that too, because a
guard that also blocks the right people is a different bug.

### The staff password is out of the file
`ADMIN_USER` and `ADMIN_PASS` were two exported constants in a module the
browser downloads: **published, not stored.** Combined with the injection
above they were worse than either alone — code running in the page reads the
app's state.

- Both are deleted and **nothing replaced them.** The panel is now **claimed
  on first use**: a device with no staff password shows a setup screen, the
  owner sets one, and it is asked for from then on. Rai types it himself and
  it is in no file and in no message.
- **Only a salted SHA-256 is kept** (`{user, salt, hash}`), the same
  `pwSalt`/`pwHash` path a user's own password already used — this was the
  one place left out of it. `checkAdmin` is async now, and it refuses when
  nothing is set: an unclaimed panel is claimed, not guessed into.
- Hashing needs `crypto.subtle`, which needs a secure context. Opened
  straight off the disk there is none, so the screen **says so and stays
  shut** rather than storing something weaker and calling it a password.
- Thirteen suites had the old pair as a fixture; each now claims the device
  first, which is what the owner does once.

### The forms accepted what cannot be true
Published, all four: `-500`, `999999999999`, `abc`, and a 300-character
title. `#/events/propose` took a start in 2020 with an end in 2019.

- The limits live in `store.js` — `LISTING_TITLE_MIN/MAX` (3 / 80),
  `LISTING_DESC_MAX` (2000), `LISTING_PRICE_MAX` (500,000) — so the admin
  form, the importer and the server batch cannot disagree; three copies of a
  number is three numbers.
- **Every message names what IS accepted**, under its own field: «السعر
  أرقام فقط — مثال: 250 أو 1200.50». «قيمة غير صالحة» tells somebody who
  typed 999999999999 nothing about what to type instead.
- **«0» is an answer, not an error**: it means «مجاني», it says so live
  while being typed, and it publishes as `FREE_PRICE` — never as "$0", which
  reads as a fault in the listing.
- The counter is on the label and `maxlength` does the stopping, so a long
  title is caught **while it is typed** rather than announced after the
  reader thinks they have finished.
- Events: a start in the past is refused (the admin is exempt — correcting
  last month's record is a real thing to do), and an end before its start is
  refused for everybody, because that is arithmetic.

### The payment rules are written now and built later
`chargeCard()` says `ok: true` to anything, and with no card on file at all
it still produced `{ status:'paid', method:'card', amount:5 }`. **That is
acceptable today** — there is no gateway and the whole app knows it — and
unacceptable the moment the first dollar moves. The three rules are written
at the seam itself, where the server batch will be standing:
no charge without a payment method · no `paid` receipt without the
gateway's confirmation · **the amount is computed on the server**, because
whoever can edit the page can edit the number.

### And the harness had to stop doing what the app is now forbidden
`script-src 'self'` refuses `eval` and `new Function`. **The app never used
either** — so the policy stands and five suites changed instead.

- The trap that made it look intermittent: a callback that **awaits** before
  calling `new Function` runs its continuation as ordinary page code, where
  CSP applies; one that does not stays inside Playwright's own call frame
  and slips through. So v9's check moved into Node (the text was already
  there), v15 and v29 prime the module once and read it synchronously, v20
  installs one `__patch` helper with `addInitScript`, and v18's contrast
  maths stopped being a source string. **Zero `eval` left in `tools/e2e`.**
- **`run.sh` was reporting a crashed suite as «0 FAIL».** It counted `^FAIL`
  lines, and a suite that aborts prints none — which is how a v15 that died
  at check 55 of 88 read as green in a full run. It now reports
  `*** CRASHED ***` with the exit code and the last six lines. A net that
  can score a crash as a pass is worse than no net, because it is trusted.

### Three claims from the previous file, corrected
The second audit was right on all three and they are recorded rather than
quietly dropped: hiding a listing does **not** remove it from its owner's
own view (it keeps a «مخفي» badge, `store.js:1428`), «امسح التصفية» **does**
work, and the app does **not** reject 555 numbers at sign-up.

That last one had a real fault underneath the wrong reason.
`lookupLineType()` reads the **area code**, not the exchange — so
`(713) 555-0199`, the published support number, passes the app's own check.
555 is the reserved fictional exchange, so **every legal page carried a
`tel:` link that rings nowhere**, offered to somebody reporting harassment
or asking for their listing to come down. `SUPPORT_PHONE` is **empty** until
there is a working number; no line is drawn when it is empty (the same rule
the directory already follows for a shop with no phone), and the email is
published on all the same pages. **One line in `store.js` brings it back
everywhere.** And «امسح التصفية» now reads «امسح البحث والتصفية», which is
what the button actually does.

## V.03.7 — batch nine (ز): what a full pass over the running app found

Not a spec. Somebody opened the app and looked, and every one of these had
survived eight batches **because none of them looks like a fault** — they
look like the app working.

### A visitor who had never signed up owned a listing
```js
myListings: ['c1'],       // js/store.js — a value put in to try something
```
Two lines under `user: null`. So on a clean browser `#/marketplace/c1`
showed **the owner's buttons** — تعديل · ميّز · تجديد · **أخفِ الإعلان** —
and no «تواصل مع البائع» at all; «أخفِ» really wrote to `hiddenListings`;
«تعديل» opened `#/post?edit=c1` full of somebody else's text; and `#/post`
read **1/4** before a character was typed.

- **Changing the default was not enough.** Anybody who had opened the app
  already had `["c1"]` written into their own localStorage, where it
  survives every update — so it is cleared once at boot **for whoever has
  no account**, since somebody with no account owns nothing by definition.
- **And `signUp` clears it too.** It survived the sign-up as well: a brand-
  new account's first «إعلاناتي» showed a stranger's car, editable.
- **THE RULE, and it belongs here:** *the default state in `store.js` is a
  brand-new visitor, never a test seat.* Any id written into it is a bug
  waiting for somebody's first launch. This one waited eight batches.

### The share button said «تم نسخ الرابط» over an empty clipboard
`navigator.clipboard.writeText` returns a **promise**, so the `try/catch`
around it caught nothing — the rejection escaped as an uncaught error — and
the toast sat outside any `then`, firing whether the write had happened or
not. On a desktop browser with no Web Share, or any page that is not a
secure context, the reader was told the link was copied and pasted nothing.

**A share button that lies is worse than one that is missing**, because the
reader finds out in somebody else's chat window. It is a promise chain now,
and the last resort is not an apology — it is **the link itself, selected,
ready to copy by hand**. Measured in all three states: the clipboard really
holds the link when it says so, and neither failure path produces a toast
or an uncaught error. (The string was hard-coded in `ui.js` too; it is
`linkCopied` in both packs now.)

### An empty search blamed filters nobody had set
Typing «sushi» on a clean directory produced «لا توجد نتائج بهذه الفلاتر ·
جرّب إزالة خيار أو اثنين» over an empty filter row. The button worked — it
cleared the word — which is why this reads as wording and is really a dead
end: the sentence sends the reader hunting for a control that is not there.

**A search is not a filter**, and merging them was the fault. Three states
now: the word named back to the reader when nothing is filtered; «ما وجدنا
«sushi» ضمن هذه الفلاتر» when something is; and inside a category, the move
that is actually useful — **«ابحث في كل الأقسام»**. The clear button appears
**only when there is something to clear**, and names which of the two it
will clear. Same rule as the picker row: an option that does nothing is not
an option.

### 80 KB of admin panel in every reader's first paint
`import { AdminScreen } from './screens/admin.js'` was static, so every
person in the community downloaded and parsed the back office to look at a
restaurant. It is a dynamic import on the `#/admin` route — no build step,
no dependency, every module-capable browser does it — cached after the
first load so the panel's own repaints do not refetch. **Measured: not
requested across six screens of ordinary browsing; fetched once on
`#/admin` and it opens.**

### Four small ones
- **The empty post form claimed a phone number had been removed.** «حذفنا
  رقم الهاتف» is a claim about something that *happened*; on a blank form
  nothing has. It stays as the message shown when a number really is
  stripped, and the standing note states the rule instead.
- **The filter badge counted the sort.** Choosing «الأعلى تقييماً» made it
  read **1** over a list that had not lost a row. Ordering is not
  filtering — `activeFilterCount` already excluded the category for exactly
  this reason, and now excludes the sort with it.
- **The events list dropped the year.** «السبت، 20 فبراير» for an event in
  **2027**, read in August 2026, says «that has been and gone». The detail
  page had the year all along, so the list was the only place saying
  something untrue. Printed now whenever it is not this year, and only then.
- **The prayer screen's one door carried the directory's words.** With no
  location it offered a single button opening a sheet titled «لنعرض لك أقرب
  المحلات إليك». `openGeoPrompt(onAllow, why)` takes the caller's own
  reason, so prayer asks «لنحسب مواقيت الصلاة عندك» — and the settings,
  which need no location at all (they are a table of angles), got the second
  door they had been missing.
- **The version said 0.1** in the drawer and in About while the project was
  at V.03.6 — two hand-typed literals, both stale, so a reader reporting a
  fault could not say which build they were on. `APP_VERSION` in `data.js`,
  one place, raised with this file's version line.

### Two items deferred, on the file's own instruction
- **The 818 KB header logo**, displayed at 80×65 — 37% of a 2.1 MB first
  load, and another 812 KB the moment somebody flips the theme. The fix is
  a properly downscaled mark, and the file assigns it to batch (ج), which
  changes what the header shows. **Measured and waiting, not forgotten.**
- **Keyboard access**: 515 directory rows, none reachable by Tab; Escape
  closes neither a sheet nor the drawer; only three elements have a visible
  focus ring. Assigned to batch (و), which is the one that opens the app on
  a desktop — and a desktop screen that cannot be driven from the keyboard
  is half a screen.

### And the dependency that governs the whole batch
**Zero of the 514 listings has coordinates.** So «الأقرب» is never chosen,
«محلات قريبة منك» promises a nearness nothing computes, no mile figure
appears for anybody, and the radius filter is inert. The fallback does not
save it either: **485 of 485 real listings have a rating of 0** (the seven
that exist are all on demo records), so the real order is city, then
subscriber, then file order. It is a data job, done outside the app — and
half of what the later files in this batch describe is built on it.

## V.03.8 — «سمحتُ بالموقع ولم يظهر شيء»

Somebody allowed the location on the prayer screen and nothing happened.
He chose «Katy» by hand a moment later and the times appeared at once — so
the permission, the point, the arithmetic and the screen were all working.

**The app had the coordinates and threw them away because it could not
find out the name of the town.** `setUserLocation` lived inside `onOk`,
and `onOk` only ran after `reverseGeocode()` — a call to somebody else's
server. Fail that call and the point the device had just handed over was
gone, along with the only thing prayer times need.

Any of these is enough to fail it and none is a fault in this app: an ad
blocker (the three hosts look like trackers to one), Nominatim's rate
limit on browser traffic, a weak cellular signal against an 8-second
timeout, an office or school network filtering outside domains. That is
why it failed for him and works for you.

**And `prayer.js` says at the top of its own file** that everything on
that screen is computed on the device and nothing is fetched, so it works
with no signal at all. That was true — and then the screen was wired to
the internet through the back door.

> **THE RULE: prayer times need a POINT and a DATE and nothing else.
> The name of the city is the directory's business alone.**

### Two stages, and the first owes nothing to the network
`requestGeo` saves the point **the moment it arrives, before any request
goes out**, and calls `onOk({…, naming: true})`. The name is asked for
afterwards and calls `onOk({…, naming: false})` if it comes. **It may
never come, and that is fine.**

- **Measured with all three hosts blocked: the times appear in 971ms**,
  the point is stored, and the directory prints real miles from it. Before
  the fix: never.
- **`geoOutsideUs` is unchanged.** Being outside the United States is not
  a failure to name a place, it is a fact the reader has to be told — the
  first draft of this fix dropped that line and it is back.
- **A naming call that simply did not answer says nothing to anybody.** No
  red message: from the reader's side nothing failed. The screen repaints
  because the point landed a moment ago.
- **The city list no longer opens itself after a granted permission.** It
  opens on a real refusal, which is what `onFail` now means. He picked
  Katy from a list the app had put in front of him — his behaviour was
  right, the app had sent him there.
- **`markGeoDenied` still fires on `err.code === 1` alone.** The flag is
  permanent on iOS; setting it on a network failure would silence the ask
  for good.

### Both providers at once
They were awaited in turn, 8 seconds each, so a hung network was **16
seconds of a screen saying nothing** — which is literally «I pressed allow
and nothing showed». `Promise.all`, so the worst case halves. The second
provider was being called in most cases anyway, so this costs no real
traffic.

### The third state, which was half the fault
The bar and `#/prayer` had two states — times, or «حدّد موقعك» — and
**nothing in between**, so a reader who pressed «سماح» went on looking at
the very screen they had just pressed and concluded their tap had not
registered. **«جارٍ تحديد موقعك…»** now stands in the place the times will
take, at the same height so nothing jumps. `geoPending()` is memory-only
and lives in `store.js`, because the Home bar and the prayer screen must
not disagree about whether a request is in flight and `render()` rebuilds
both from scratch.

### And a point with no name is not «no location»
`cityChipLabel()` had two answers and needed three. With a point and no
name it reads **«موقعك الحالي»** — not «حدّد موقعك», which is false (every
distance and every prayer time is being computed), and not an invented
city name. The point is right; only the label is missing.

## V.03.9 — batch nine (أ): the churches, and the mass times

Rai asked for a churches section in the drawer — «so a Christian feels
there is something here for him» — and asked what to put in it.

### The naming is the message
```
مواقيت الصلاة   →  #/prayer
مواعيد القداس   →  #/mass
```
Not «الكنائس»: a church is a building, and «مواقيت الصلاة» beside it names
a service. **The parallel in the WORDING is what carries what Rai meant**;
the row merely existing does not. Directly under it, in the same group, at
the same size and weight — measured identical at 14.6625px / 500. In
another group it would be an appendix; above it would reverse an order
with no reason to reverse.

### The calendar is computed, never stored
Storing a table of dates is the worse answer: it goes stale and it is
wrong the first year nobody remembers to extend it. **Easter is
arithmetic, exactly as the prayer times are** — `js/feasts.js` imports
nothing, fetches nothing and works with no signal at all.

**Both Easters, both named.** Half the churches in the directory are
Coptic and a third evangelical, in near-equal numbers, so choosing one
date would be choosing a congregation:

| | western | eastern | gap |
|---|---|---|---|
| 2026 | 5 Apr | 12 Apr | 7 days |
| **2027** | **28 Mar** | **2 May** | **35 days** |
| 2028 | 16 Apr | 16 Apr | the same day |
| 2029 | 1 Apr | 8 Apr | 7 days |
| 2030 | 21 Apr | 28 Apr | 7 days |

**In 2027 they are thirty-five days apart.** An app printing one date that
year is wrong for half the people reading it.

- **When they coincide the row carries NO tradition.** «الفصح (غربي)»
  standing alone in 2028 would read to an Orthodox family as though their
  date had been left out. One line, unqualified.
- Palm Sunday, Good Friday, Ascension and Pentecost are **derived by
  subtraction** from Easter and are computed — but the block shows the
  **principal** feasts only, because six rows of Holy Week pushed *both
  Easters off the bottom*, and the two Easters are why the block exists.
- **Christmas is two lines**: 25 December, and 7 January named as the
  Coptic one.
- **Ordered by date, not by religion.** One list everybody reads. Two
  lists side by side would separate people on the screen, which is the
  opposite of the point.
- **The same block on `#/prayer`**, imported from `mass.js` rather than
  copied — it belongs to both screens and is hidden from neither.

### What is certain is separated from what is not
Christmas and Easter are pure mathematics. **The Hijri dates depend on
sighting the crescent and differ between authorities**, so every one
carries **«تقديري»** and a line saying the announcement comes from the
local Islamic centres. Easter and Christmas carry no such word. A
religious date said with confidence and then found wrong hurts far more
than one we never claimed.

### The churches, and the two rules that do not bend
`nearbyChurches()` is `nearbyMosques()`'s twin and deliberately not a
second component. Measured from Houston with points injected (no listing
has coordinates yet): **1.4 → 6.3 → 17 miles**, nearest first. Outside the
region the block is **hidden rather than empty** — Dallas keeps the
calendar, which is arithmetic, and loses the churches. The V.03.1 rule,
unchanged.

1. **We never assign a denomination.** «قبطية», «أنطاكية», «ملكية» appear
   only where they are already in the registered name or where the owner
   declared them after claiming the page. There is no denomination field
   in any form we show. That is the mosque rule word for word.
2. **Ordered by distance and nothing else**, and **no advertising is ever
   sold on this screen** — asserted, not merely intended.

### Service times: published, or honestly absent
`BLANK_SERVICES` — `{sunday, weekday, note}` plus `icsUrl` — empty on
every record and filled only by the parish itself, or from the `.ics`
calendar most of them already publish. **Reading an `.ics` needs a
server** (the browser blocks cross-origin reads), so that layer belongs to
the server batch and the same reader `eventImportNote` already promised
for Ticketmaster serves both. Until then: **«مواعيد القداس: غير متوفّرة —
اتصل بالكنيسة»**, and never a time we worked out. A wrong mass time sends
somebody to a locked door on a Sunday morning.

### Two corrections to the batch file's own numbers
- **`b11` is Al Rahma Mosque, not a church.** So it is **12 churches now
  and 11 at launch** — one demo record (`b12`, the St Mary), not two.
- The distribution behind the design holds: 6 Coptic · 4 evangelical ·
  1 Antiochian · 1 Melkite.

### And the drawer moved further past its own rule
The new row costs 50px. With «تصنيفات عربنا» open the panel overflows by
**122px at base 17** (146 at «كبير», 180 at «أكبر»), against 72 before.
**Two test guards caught it** — they exist to stop exactly that growing
unnoticed — and both were raised with the numbers written into them
rather than the checks being softened. **The drawer misses its
never-scrolls rule by more than two rows now, and which row goes is still
the owner's decision.**

## V.04.0 — batch nine (ب): two bugs off the phone, and the dropdown rule finished

### A place of worship is not a customer
Every one of the 35 masjids and churches was offering its owner a $29
monthly subscription. Measured before the fix: **35 worship records, 0
marked non-commercial**, and a claimed mosque's page showed «رقّي صفحتك —
صور وفيديو وتقييمات · $29 شهرياً». The first imam to claim his masjid
would have met that, and it is not an interface slip — it is the app
asking a mosque for rent.

- **Fixed by category, never by a switch.** `isNonCommercial()` now
  derives: `b.nonCommercial || b.cat === 'worship'`. A manual flag is
  precisely what was forgotten on all thirty-five, and deriving it means
  it cannot be forgotten on the ones added from here on — including the
  ones strangers now add themselves (below).
- **It did not widen.** The 28 free `outings` that carry the flag by hand
  are untouched, a free restaurant still meets the claim card and the
  offer, and the two are asserted against each other in v33 so neither can
  drift into the other.

### The city he picked by hand froze there for good
Rai chose Houston by hand, drove, and the app stayed Houston forever. The
quiet refresh was gated on `!state.geo` — and **choosing a city by hand
clears the point on purpose**, because that point belonged to somewhere
the reader had left. So one manual choice switched the refresh off
permanently.

**One flag was doing two jobs.** «الإذن مُنح مرّة» and «عندنا نقطة الآن»
are different facts and are now two:

- **`geoGranted`** survives a hand-picked city and is cleared only by a
  refusal or by deleting the account. `refreshLocationQuietly` gates on
  `!S.geoGranted() || S.state.geoDenied` instead of `!g`.
- **`location.manual = !fromDevice`** records where the city came from.

| The city came from | What happens |
|---|---|
| the device (`manual = false`) | it updates **in silence**, as before |
| his hand (`manual = true`) | he is **asked**, never overwritten |

He may have chosen Houston *deliberately* while standing in Richmond, to
browse its shops. So «يبدو أنك في Richmond — تحدّث موقعك؟ [نعم] [لا،
اترِكه Houston]», **once**: «لا» is honoured for the rest of the session
and the city does not change anyway. And the chip finally says which mode
it is in — **«Houston» pinned, «Houston · تلقائي» live** — where one word
in both states had been telling the reader nothing.

**`watchPosition` is still banned** and still not used: the read is one
`getCurrentPosition` on return to the app, and a reader who never granted
is never read and never asked. That is the limit the whole thing exists to
protect, and v33 measures it from the source.

### More than five options is a dropdown — in all four places, not one
The rule was written in the filter batch and applied to **the directory's
top row alone**. The three places holding the most options were left on
chips, which is where the wall was.

- **The location sheet**: 24 city chips → one picker with a live count
  beside each city. **«استخدم موقعي الحالي» stays a full-width button
  above it** — it is the fastest route for nine readers in ten, and
  burying it in a list to tidy the sheet would slow the majority for the
  minority.
- **The magazine**: six sections → one picker. Wrapping to a second row
  beat running off the edge, but a picker costs one line and names the
  chosen section in gold.
- **The filter sheet, the biggest**: five headed groups and sixteen
  options over two screens became **area · sort · two multi-selects · the
  open-now switch**. Measured: the body no longer scrolls at all on
  390×844.

`openDropdown` gains **`multi`** — several may be chosen and **the panel
stays open**, because narrowing by three attributes is one gesture and not
three visits to the same list. The button reads «2 مختارة». **The
per-option count travels with it**: it is the most useful thing on the
sheet, since it says what you will find *before* you press. Three
exceptions stand: **«مفتوح الآن» stays a switch** (one option is never a
list), the two multi-selects stay open, and the counts stay.

And every one of them inherits the dropdown's **history entry** for free,
so the device back button closes the list rather than leaving the screen.

**Horizontal scrolling stays where it is display and not choice** — the
photo strip, «مميّز هذا الأسبوع», the story cards, the ad slider — and the
attribute chips in the add-business form stay chips: there the reader is
marking several from named groups, which is that shape's right use.

### «كل المنطقة» answered no question
All of Texas? All of America? **`regionName` had carried the right words
since V.03.3** — «Houston والمنطقة» — and was used everywhere except the
one sheet where the difference matters:

```
Houston            376
Houston والمنطقة   514
```

Two lines that explain themselves.

### The prayer bar is asked for once, and never hidden by default
Hiding it by default means nobody finds it; showing it forever to somebody
who does not want it is the other failure. **One card, once**, on the
first open: «نعرض مواقيت الصلاة على الرئيسية؟ [نعم] [لا]». «لا» removes
the bar and **is never asked again** — measured over five reopens — while
**`#/prayer` stays in the drawer**, because refusing a line on Home is not
refusing the screen. Settings → المواقيت carries the switch that brings it
back.

### The pre-adhan alert is placed now and says what is true
A web page cannot fire a notification with the tab closed, and this build
has no server. So the switch is built, it is remembered, and under it
stands **«يعمل مع إطلاق السيرفر»** — **and there is no tone picker**,
because choosing a sound for something that cannot sound is the dishonest
half. The honest blank is what creates the pressure that fills it.

### A stranger adds the place, never its times
Rai asked that anyone be able to add a masjid or a church, reviewed before
it appears — «علشان نخلّي الكل يشتغل لخدمة البرنامج بدون ما يحسّ».
**The machinery already existed** — the add-business queue, `findDuplicates()`,
the merge button — so what was needed was a door, not a system.

- **The door is on `#/prayer` and `#/mass`**, under the nearby list:
  «تعرف مسجداً ليس هنا؟ [أضِف مسجداً]». **It is on the no-location branch
  of `#/prayer` too**: knowing a masjid is missing has nothing to do with
  knowing where you are standing, and the screen would otherwise have the
  door only for readers who shared a point. **Not in the «+» button** —
  that one is for commerce, and mixing them dirties both.
- **Three fields**: name · address or ZIP · phone (optional). «بدون ما
  يحسّ» is only true when the ask is twenty seconds.
- **And the most important line in the item: the stranger adds the place,
  never its times.** Adhan, iqama, jumuah and mass stay with the page's own
  owner after a claim; everything else reads «غير متوفّر — اتصل بالمسجد».
  **A wrong time makes people arrive late to their prayer, and the harm
  lands on us, not on whoever typed it.**
- **No denomination field, and not as an optional one — absent.** The
  category is set to `worship` by the door itself, so the sender neither
  chooses it nor gets it wrong, and the record is born non-commercial by
  the rule above without anybody deciding it.
- **And a thank-you line, with no points, no badges and no contributor
  ranking.** People give more when they feel what they gave arrived, and
  stop when they feel they are being worked.

### The rule that protects the whole of it
**No advertising space is ever sold on `#/prayer`, `#/mass`, or any mosque
or church page. No slider, no banner, no «مموّل».** It is not a design
preference, it is protection: **selling an ad beside a call to prayer
costs the whole community in a day**, and nothing taken for it covers
that. The right way these screens earn is that they bring people back
daily — and then those people browse the directory, where advertising
belongs. v33 measures all four surfaces for a slider, a sponsored badge,
an `#/advertise` link and the word itself.

### And two housekeeping notes
- **`APP_VERSION` had drifted**: it read `0.3.8` while `CLAUDE.md` said
  V.03.9. Both now read the same. It is still raised by hand, which is why
  it drifts.
- **v33 is 61 checks** over the spec's own 26, and is in `run.sh`.

## V.04.1 — the `<svg>` printed as words, and the rule it leaves behind

### The fault, on the two rows we sell
Under the name of every sponsored business on `#/directory`, in both
languages, the pin icon's own source was printed as text:

```
Al Huda Law Office   [إعلان مموّل]
<span><svg class="" width="13" height="13" viewBox="0 0 24 24" …/></svg> Houston</span>
```

**The worst visible fault in the app**, because it stood on the first two
cards of the most-opened screen — and those two cards are the thing we ask
shop owners to pay for.

**Every link in the chain was right and the result was wrong.**
`distLabel()` returned HTML and said nothing about it in its name;
`sponsoredRows()` took `sub` as a text field; `esc()` escaped it —
**correctly** — and out came the markup.

- **`esc()` is not the cause and was not touched.** It is what stopped a
  user's text executing inside the admin panel in V.03.6, and deleting it
  from this row would open an injection hole in **the one row that prints
  names people type**. That is the fast-looking wrong answer.
- **The icon comes from the row now, because an icon is not data**:
  `sponsoredRows` gained `subIcon`, and the directory passes
  `sub: distText(b) || t(catKey(b.cat))` with `subIcon: where ? 'mapPin' : ''`.
  A pin over a category name would be an icon hanging on nothing.
- **There is deliberately no `subHtml` field.** An unescaped field in that
  row is the same injection six months from now, by our own hand. v34
  asserts the hatch does not exist.

### THE RULE, because this is a class and not an accident
> **Every function that returns HTML ends its name in `Html`.** Anything
> whose name does not **returns text**, and may pass through `esc()` safely.

Applied to what was already there, in the same pass — the spec's own
instruction, and the reason it matters is that the next person to hand one
of these to a text field reproduces this fault word for word:

```
distLabel   → distLabelHtml   + distText   (new, the text half)
bizBadge    → bizBadgeHtml
openBadge   → openBadgeHtml
openBadgeSlot → openBadgeSlotHtml
attrChips   → attrChipsHtml
statusBadge → statusBadgeHtml
```

All five sisters were already used outside `esc()`, which was correct —
only their names lied. **The old names are gone rather than aliased**, so
there is nothing left to misuse.

### What was checked and found sound, so it is not re-checked
The marketplace's price, the magazine's advertiser and the events date are
real text; `esc(L(name))` on every row title is right and stays. **The
fault was in one place and its cause was general** — which is why the rule
above is written down rather than the line simply repaired.

## V.04.2 — «انتقلتُ إلى مدينة أخرى والبرنامج ما زال في الأولى»

Half the report was already gone by `baa42bb` — the `geoGranted` split, the
manual-city question, «حدّث موقعي», `cityNameFor`. Two functions were left,
and they are the same mistake in two costumes: **the app knew where the
reader was and did not act on it.**

### `visibilitychange` does not fire when an app OPENS
The page is born visible, so there is no hidden→visible transition to
hear. The event arrives when somebody **returns to an app that was still
running** — never when they launch one. Measured on `baa42bb` with the
permission granted and the point three hours old:

```
cold open  (closed it, opened it)   getCurrentPosition → 0
warm return (it was still running)  getCurrentPosition → 1
```

**That is «sometimes it asks and sometimes it doesn't», exactly.** And
closing the app, travelling, and opening it again is the ordinary way a
phone is used — so the one case that most needed the refresh was the one
case that never got it. The fix is `refreshLocationQuietly()` at the end
of `mountGeoRefresh()`. **`shouldRefreshGeo` is untouched**: the same four
conditions a warm return already passed, so nobody new is asked anything
and a reader who never granted is not read at startup either.

### The point was thrown away because the NAME did not arrive
```js
const r = await reverseGeocode(lat, lng);
if (!r || r.error) return;          // ← the coordinate that just landed, discarded
```

**This is the V.03.8 fault living on in a second function**, and the rule
was already written down: *the prayer times need a point and a date and
nothing else, and the city name is the directory's business alone.* The
reach is wider than the chip — **every distance in the directory and every
time on `#/prayer` is computed from `state.geo`** — so somebody who moved
and could not be named went on **praying to the timetable of the city they
left**.

So the point is saved **before any network call**, and the name catches up:

- **`NAME_STALE_MI = 3`.** Below it you are almost certainly still in your
  own town, so a correct name is never wiped; above it the old name is a
  claim about somewhere the reader is not, and it is cleared so the chip
  can say «موقعك الحالي» honestly until a name arrives. `haversine` is
  local arithmetic — **even this judgement needs no network.**
- **A hand-picked city does not move.** That is the V.04.0 decision and it
  is not reversed. And **the order matters**: `setUserLocation` writes
  `manual` from whether a point came with it, so calling it with one would
  erase the mark — which is why the whole early-save branch is skipped for
  a manual city rather than the condition being inverted.
- **`repaintCityChips` had its own older two-state formula** and was
  repainting the chip into a shape the render path would never draw. It
  calls `cityChipLabel()` now — the one definition that knows all four
  states, including the «موقعك الحالي» this batch depends on.

**And the reader sees nothing.** No message, no spinner, no question. The
silent refresh is genuinely silent — except when the name changes, and
then the chip alone is rewritten in place. **The new name is the whole
signal.**

### Two the regression turned up, both about the same missing word
Making the cold open read the device exposed two states where nothing said
whether a city had been **chosen** or **found** — and this batch turns
entirely on that question.

- **`location.manual` did not exist before V.04.0.** A reader upgrading
  carries a city with no word on its origin, and treating that as "found"
  would wipe a city they picked deliberately on their very first cold
  open. The answer was already in their data: `setUserLocation` only ever
  stores a point when the DEVICE supplied one, **so a saved city with no
  point beside it was chosen by hand.** Inferred once at boot rather than
  guessed on every read.
- **«امسح الموقع» has to survive an open.** `clearUserLocation` now writes
  `manual: true`: clearing is a decision exactly like picking, and without
  it the quiet refresh put a city straight back and the button read as
  doing nothing. **The permission is not revoked** — iOS asks once and we
  do not spend that question twice — so the reader is *offered* the new
  city rather than given it.
- And the name is only dropped when we can **show** the reader travelled:
  with no stored point to compare against, `moved` is 0, not `Infinity`.
  «A correct name is never wiped» has to hold when we cannot tell, too.

### Three from the churches file
- **`#/mass` was asking for the location in `#/prayer`'s words** —
  «حدّد موقعك لتظهر مواقيت الصلاة» on a screen titled «مواعيد القداس».
  A ready key is not a reason to reuse a sentence. **`massNoLocation` is
  its own string**, and the rule is that *every screen that asks for the
  location says why IT is asking, never why its neighbour does.*
- **`APP_VERSION` had drifted twice**, so it is now a rule with a test
  behind it — see the section above, and v35 compares `data.js` against
  the line at the top of this file on every run.
- **The hand beats the arithmetic, and the arithmetic fills the gap.**
  `ramadanDates()` / `setRamadanDates()` hold the two dates only a person
  can know, and admin → settings has the fields. With nothing written the
  calendar computes and prints «تقديري»; with a date written it prints
  that date and **drops the word**. `feasts.js` is **handed** the dates
  rather than importing them, so it still imports nothing and fetches
  nothing — the same reason `synonyms.js` takes `normalize` as an
  argument. **Eid al-Adha stays an estimate**, because nobody wrote it,
  and **a computed number is never corrected by another computed number**:
  moving 7 February to 8 February would swap one guess for another when
  the difference comes from the crescent, not the table.

## V.04.3 — the calendar follows its screen, completes itself, and goes on time

### Slicing six off a date-ordered list does not know about religion
Both screens showed **the same six rows in the same order** — and that was
a written decision, not a slip: *one calendar ordered by date and not by
religion; two lists side by side separate people on the screen.* **The
reasoning was right and the implementation was the fault.** What a reader
opening `#/prayer` actually met was **four Christian occasions and two
Islamic**, with **Eid al-Adha missing** — it was in the list and had
fallen off the end of the slice. The one list had united nothing. It had
cut.

- **Split first, then slice.** `feastsBlockHtml(own)` takes `'islam'` or
  `'christian'`, filters, and only then takes six and three.
- **The second heading is not a separation.** Both tables are on the same
  screen, read together with no tap and no tab: the reader finds theirs
  first and sees their neighbour's underneath.
- **Six in the first table and not four**, because the Islamic year now
  holds seven — four would drop the new year and Ashura, the two just
  added.
- **No heading names a religion.** «مناسبات أخرى في الجالية», never
  «مناسبات مسيحية». The screen already says where you are, and labelling
  a section with the reader's own faith tells them they have been sorted.
- **One row, written once.** Two tables with two copied rows become two
  different shapes two batches later — one gets edited, the other is
  forgotten. `feastRowHtml()` and `feastListHtml()`.

### Three of seven, and the nearest one was five months away
The file computed Ramadan, Eid al-Fitr and Eid al-Adha. **Measured on the
day: the nearest Islamic occasion the app knew about was Ramadan, five and
a half months out — while the Prophet's birthday was two days away and
simply absent.** Also missing: Ashura and the Islamic new year.

All three are stepped from the anchor already in the file by the known
lunar month lengths, so **there is still no table, no storage and no
network** — the principle at the head of `feasts.js`, followed literally:

```
1 شوّال        +30   ·  10 ذو الحجّة   +99   ·  1 محرّم    +118
10 محرّم       +127  ·  12 ربيع الأوّل +188
```

Measured, not assumed: المولد 25 Aug 2026 · رمضان 7 Feb 2027 · الفطر
9 Mar · الأضحى 17 May · رأس السنة 1449 on 5 Jun · عاشوراء 14 Jun.
**Every one carries «تقديري»** — the crescent decides, not the table.

- **`ramadanOf(y)` returns the Hijri year with the date**, because the new
  year row needs it and nothing else can supply it. `ramadanStart` is
  unchanged, still exported, and built on it.
- **The number is the row, not decoration on it.** «رأس السنة الهجريّة»
  alone tells nobody anything; **«1449» is the news.** And it is the year
  that BEGINS — the Muharram after Ramadan 1447 opens 1448, so `hy + 1`.

### It does not vanish the morning after, and it is never written twice
`calendarNow()` in `feasts.js`, and it is two rules:

- **A week of grace.** Somebody opening the app the day after Eid should
  find it. A past row is dimmed and reads **«مضت»** instead of «تقديري» —
  **without that word a past date under «المناسبات القادمة» reads as our
  mistake rather than as a feast that has been.** The same week for
  everybody; no side's occasion lingers longer than another's.
- **One row per occasion.** The list is date-ordered, so keeping each
  occasion's first appearance keeps the near one and drops next year's,
  and next year takes its place by itself when this one's window closes.
  Without it **the Prophet's birthday appeared twice in one list** — in
  two days and in a year.
- **The key is `id` PLUS tradition, never `id` alone.** Western Christmas
  would swallow the Coptic and Western Easter the Eastern, **erasing half
  the churches in the directory from the calendar** — worse than the fault
  being fixed.
- The «dates are estimates» line belongs to **the table holding a live
  estimate**, not to the screen, and **never to one whose estimates have
  all passed**: that estimate's business is finished.

### `.ltr` reordered a date nobody had reported
```
written   25 ديسمبر 2026
shown     25 2026 ديسمبر     ✗
```
`.ltr` is an isolate built for numbers and Latin names, and this string is
**Arabic with a number in it**, so forcing left-to-right reordered its
parts. **`.feast-date { unicode-bidi: plaintext }`** — `plaintext` takes
its direction **from** the text where `isolate` imposes one **on** it, so
the Arabic date reads Arabic and the English one English, one class and no
condition. **Two places had it and only two**: this row and
`adminLogHtml()`. Every other `.ltr` in the app wraps a phone, an address
or a price, all pure Latin, and is correct.

## V.04.4 — the directory drew all five hundred at once

### One line, one screen, twenty-four times the next heaviest
Measured on a 4x-throttled processor — a mid-range Android:

```
#/home            22 ms       421 elements
#/directory    4,327 ms    11,828 elements    517 rows    1,027 listeners
#/marketplace    175 ms       284
…the other six all under 200 ms
```

**The directory alone**, and the cause was one line —
`el.innerHTML = rows.join('')`. The page it built measured **80,282px:
about 107 screens drawn so a reader could look at one.**

The wall is between 1,500 and 2,000 listings and there are 514 today, so
there is room — **which is the reason to do it now, before it becomes a
fault somebody reports.** Memory and scrolling were never the problem;
measured at 10,283 listings the scroll stayed smooth. **The whole cost is
in the first paint.**

### Forty rows, then forty more
`PAGE = 40`, an `IntersectionObserver` on a one-pixel sentinel, and
`growList()` appending the next slice. Measured after:

```
elements   11,760 → 1,086      (a 91% cut)
height     80,282px → 6,834px
rows        515 → 41 at first paint, 515 after scrolling to the end
```

- **`rootMargin: '600px'`** so the next batch is drawn *before* the reader
  reaches the end — no gap and no wait.
- **A browser without `IntersectionObserver` draws the lot.** Slower, but
  working; never half a screen because a feature is missing. Measured with
  it deleted: all 515.
- **`dataset.rowWired` is not decoration.** Without it every batch hands
  each existing row another listener and one tap opens the screen twice —
  a worse fault than the slowness. The two old sweeps
  (`$$('#dirList [data-call]')` and the route one) are **deleted**, not
  left beside `wireRows`.
- **The upsell card is not a result**, so it does not consume one of the
  forty: forty listings and the card, forty-one children.

### Coming back had to be rebuilt with it
A forty-row window breaks both halves of returning: somebody who opened
the 300th listing comes back to a list that does not contain their row,
and the saved pixel points past the end of a shorter page. So `resume`
records **how many rows were drawn**, not only where the scroll was, and
`flashReturn` draws on until the row exists:

```js
while (!row && growList()) row = $(`…[data-route="#/directory/${lastOpened}"]`);
```

**`growList` returns zero when the list is finished**, so the loop ends by
itself even if the listing was deleted underneath us. Measured against the
old build on the same interaction: row at 401px vs 400px, 515 rows both —
**identical.**

### And the shape is chosen for the server, not for today
`growList` is the seam the server arrives through: the slice becomes a
fetch and **nothing else moves** — not `rowHtml`, not the observer, not
`flashReturn`, not the filters. **That is why this is not a virtual scroll
that measures row heights and paints the viewport.** That shape assumes
the whole list is already in hand, which is exactly what stops being true
once the directory is on a server: the growing window works in both worlds
and the other one gets thrown away and rewritten.

### The state file said «nothing is waiting» while twelve files were
`docs/الحالة.md` was written in the session that received 005 and 006, so
it recorded what it could see: two files arrived, both shipped, nothing
waiting. **True from where it stood and false about the project** — and it
is the exact fault the file exists to prevent, since a session reading
«nothing waiting» concludes the project is finished and numbers its next
file `010`, which is taken.

Section 4 is now the real queue, eighteen rows, `165` marked **sent last**.
And a line in `CLAUDE.md`: **the waiting list is never emptied by a session
because that session received nothing** — somebody who has not been sent a
file does not know that a file exists to be sent.

## V.04.5 — the word «تلقائي», and the reader who is 450 miles away

### The chip says the city and nothing about how it got there
V.04.0 put «· تلقائي» on a device-found city so the two states would not
read alike. Rai asked for the word gone, and he is right that a chip in
the header is not where an internal distinction belongs.

**`cityIsManual()` is untouched and still does its work** — it is what
stops a hand-picked city being changed behind its owner and what decides
whether `askToMove` appears. It simply no longer writes itself on screen.
`locAuto` is deleted from both packs: a key nobody uses is debt.

**The two checks that asserted the word are inverted, not deleted** —
v33's 2.5 and v15's 6.30, each with a comment naming the reversal. A check
that disappears with no reason takes its behaviour back two batches later.

### Somebody opened the app from Beebe, Arkansas
Measured with the point 450 miles out, before writing anything:

```
#/prayer      says so in a line     ✓
#/mass        says so in a line     ✓
#/home        nothing at all        ✗
#/directory   514 listings, nothing ✗
```

So the reader saw their own town on the chip and a directory entirely of
somewhere else, **with no sentence saying why** — and it gets worse the
day coordinates land, when «450 ميلاً» sits under every name: a true
number and a meaningless one.

- **The box names no area.** With one region the sentence would read; with
  three it nags; with six nobody reads it — **and a message that grows
  every time the project succeeds is wrong from the start.** Its length
  never changes. The names live in a sheet that opens.
- **It explains, it does not block.** The listings stay exactly where they
  are: somebody in Dallas visiting Houston next month has every right to
  read them.
- **No city in the region sheet, and no arrow.** Somebody outside Houston
  does not know Katy from Sugar Land, and twenty-five suburbs mean nothing
  to them. The existing city sheet is untouched for readers inside the
  coverage — **two sheets with two purposes**: that one picks a city, this
  one picks a whole area.

### `setUserRegion` writes no city, and that is the whole item
```js
state.location = { zip: '', city: '', state: 'TX', region: id, manual: true };
```
Writing `city: 'Houston'` would show the businesses of the city of Houston
alone and **drop half the directory**, because half the shops are in the
suburbs. So the region id is stored, `baseList` reads it, and the reader
who picked one name gets **Katy · Sugar Land · Spring** and the rest —
measured: 514 listings, all three suburbs present.

### The name comes out of the text
`REGIONS` in `data.js`, a `region` field on all 24 `CITY_POINTS`, and
`regionName` — which had «Houston» typed into it — replaced by
**`regionAll: '{r} والمنطقة'`** with the name substituted. **No `if` on a
city name anywhere**: a city written into a condition is the city somebody
forgets the day the coverage changes.

**And nothing is written when a new area opens.** Measured by adding
`{ id:'dal', name:'Dallas' }` and one city: two rows in the sheet, the
box's text identical to the character, and a point inside that city makes
the box disappear on its own. Then reverted.

### Distances are not shown to somebody outside
`distanceTo` returns null outside the coverage and «الأقرب» is dropped
from both sort surfaces — the row picker and the filter sheet. Ordering by
nearest between two shops 449 and 451 miles away is an ordering that means
nothing. A reader who picked a region by hand has no point at all
(`setUserRegion` clears it), so it never reaches them either.

## V.04.6 — the silent refresh failed silently, and locked itself out

### «It works when it feels like it» is the signature of a throttle
Rai's chip said `Beebe, AR` while he was in `Romeoville, IL` — six hundred
miles — and «حدّث موقعي» corrected it at once. So the permission was
granted, the read worked and the naming worked: **only the automatic
refresh was failing.**

Three lines did it. `lastQuietTry = S.now()` was written **before** the
attempt, and `GEO_STALE_MS` governed both success and failure — so **a
failure was stamped exactly like a success and shut the door for thirty
minutes.** With an eight-second timeout, short for a device in motion:

```
open  → 8s → fail → silence → locked 30 min
open  → locked, no attempt at all
open an hour later → works → "it worked this time"
```

- **A failure gets its own throttle**: `GEO_RETRY_MS = 90 * 1000`. A read
  that did not answer says nothing about whether the next one will.
- **The timestamp is written after the answer, not before it.**
- **`quietInFlight`** stops `visibilitychange` opening an attempt on top of
  one that has not answered — without it every one counts as a failure and
  the throttle grows, making the fault worse.
- **`enableHighAccuracy: false`, timeout 20s.** We want a CITY NAME, not a
  car's position in a street: coarse arrives faster, succeeds where precise
  fails, and spares the battery of a device on the road. Twenty seconds
  costs somebody sitting at home nothing — they answer in under a second.

### The failure throttle is the stored trace, not a variable
The file specified `lastQuietFail` in module state, and **measured, that
does not hold**: module state dies with the page, so **five opens inside a
minute made five failed reads** — and closing and reopening the app is
exactly what somebody does while it is failing. `geoFail.at` is already
saved, so it is the one definition; a second copy in memory could only
disagree with it. **Measured after: 5 opens, one attempt.**

### A fault that leaves no trace is guessed at, not diagnosed
The failure handler was empty — no message, no retry, **not a line written
anywhere**. So Rai could not know it had failed and nobody could prove it.
`noteGeoFail(code)` records the code, the time and a count.

- **It is shown in the location sheet and nowhere else** — not on Home, not
  on the chip, not on any public screen. It is for us. **A reader is not
  frightened with a fault they can do nothing about.**
- **The first success clears it**, so the note never outlives the fault.

### And one door that is left open on purpose
`setUserRegion` writes `manual: true`, so **anybody who once pressed
«اختر منطقة» has a hand-picked city for good** and moves onto the
ask-first path instead of the silent refresh. That is `askToMove`'s design
from V.04.0 — a city somebody chose is not changed behind their back —
and reversing a decision nobody asked to reverse is not this batch's job.
It is one line, in its own file, when Rai says so.

## V.04.7 — batch nine (ج): the visual identity, and the link when it is sent

Ten items, in two commits: `b886922` carried the first four, this one the
rest.

### Two faces, and every size in `rem`
`--font-display` is **Noto Kufi Arabic**, on the headings and the numbers
only: `.h-title` · `.section-title` · `.row-title` · `.pr-next-name` ·
`.pr-next-at` · `.pr-row-name` · `.pr-row-at`. **`.cat-label` and
`.nav-item` deliberately keep IBM Plex** — a display face on a 12px label
under an icon is decoration, and the bottom bar is read a hundred times a
day. Five sizes went up ×1.1.

⚠️ **Every size is in `rem`, and this is not a style preference.**
`html { font-size: 106.25% }`, so **the root is 17px and not 16** — a `px`
number would be 6.25% wrong on arrival and would then refuse to grow for
the first reader who enlarges their type. `.h-title` **1.2375rem** ·
`.row-title` **1.1rem** · `.pr-next-at` **2.0625rem**.

### Twenty-one categories, twenty-one hues
`CAT_HUE` in `data.js` gives each category one hue and **everything else is
derived from it** in `catTileHtml(catId, size, cls)` — the tile, the wash,
the border and the khatam pattern, all `hsl()` off that one number. Twenty-
one identical gold circles gave the eye nothing to aim at.

- **No hue falls in 35–55**, the gold band: a tile the colour of the brand
  accent reads as «selected».
- ⚠️ **`--h` is written on the tile element itself, never on a parent.**
  `var()` inside a custom property is substituted **at the element that
  DECLARES it**, so a hue set on a wrapper resolves there and every child
  gets the same colour. This cost an afternoon; it is written here so it
  costs nobody another one.
- Radii **18px** at the large size and **13px** at the small, the same
  shape on Home, in the directory and in «كل التصنيفات» — and **not a
  circle in any of the three**. Verified: zero tiles render with no
  background and no border.

### The light theme is sky, not ivory
Page `#CFE4F2` · bar `#DFEEF8` · surface `#F3F9FD` / `#E9F3FB` · text
`#0C1424` · `--text-2` `#1E2942` · `--muted` `#454B5C`. **The card is
lighter than the page**, which the ivory theme had backwards.

Measured: dim text on a card **5.90 → 8.19**, body text **16.38 → 17.33**.
The values are written in **three** places and all three must agree — the
explicit `[data-theme="light"]` block, the `prefers-color-scheme` copy that
makes the first paint right before any script runs, and the Settings
preview swatch.

### One row of six on Home
Six tiles across at 390px: **6×52 + 5×10 = 362**, no sideways scroll, and
the sixth is a computed **«+16»** into `#/categories` — the number is read
off `CATEGORIES`, never typed. The word «التصنيفات» and the «عرض الكل» link
are both gone: the row is what they named.

**This is the item that decides the screen.** Measured at 390×844: the
slider starts at **393px** and «مميّز هذا الأسبوع» at **695px** — both above
the fold, which is what the first prototype failed.


### The mark alone in the header
`assets/mark.png` and `assets/mark-ink.png` are cropped from `logo.png` and
`logo-ink.png` at rows 0–651 and trimmed to the alpha box: **659×649,
ratio 1.015, so 66px wide at 65px tall** — the same 65px (54 installed) the
stacked lockup had, and 80px of width becomes 66. `LOGO.mark` joins
`stacked` and `wide`, the header carries `data-logo="mark"`, and
`applyTheme()` swaps the two files exactly as it does the other pair.
**The name leaves the bar and stays on every other logo** — the drawer
head, the sign-in screens and About are unchanged.

### A word that rotates in the search box
`SEARCH_HINTS` (8 words) and `HINT_MS` / `HINT_FADE_MS` in `data.js`, with
`mountSearchHint` in `home.js`. Measured over eight changes: **2250ms mean,
exactly** — `HINT_MS` plus the fade, and the number lives in one place with
no second copy in the CSS.

- **A word in the box is a promise**, and a promise that opens on «no
  results» is the same fault as a filter that returns nothing. The list is
  sieved against the real search at boot and anything returning zero never
  enters the rotation. (`بنشر` was the test case and is correctly absent.)
- **THE RULE IS NOT «no new timer» BUT «no timer running for no reason».**
  It stops on focus, on `document.hidden`, and when Home is left — and the
  earlier claim that this app has one timer was wrong: it has four (the
  minute tick, the ad rotator, and the two resend counters in `auth.js`).
- **`prefers-reduced-motion` gets one still word**, not a slower rotation.

### A line for the visitor, and nothing for the member
«كلّ ما تحتاجه في {c}» over «مطاعم وأسواق وأطبّاء ومساجد، ومواقيت الصلاة،
وسوق», gated on `isMember()`. Somebody with an account has opened the app
twenty times and knows what it is; the line would be stealing the space
they came for.

- **Measured on `The Woodlands`**, the longest city the directory covers:
  **one line at 390px**. The English was two — «Everything you need in The
  Woodlands» measured **393px in a 362px box** — so it reads **«All you
  need in {c}»** and measures 311. The Arabic was never touched.
- With no city it is «كلّ ما تحتاجه في أمريكا», never a guessed city.

### The link when it is sent, which matters more than the page it opens
`index.html` had one `description` and **zero share tags**, so a link
passed on WhatsApp arrived bare — and that is how things travel in this
community.

- The full `og:` set plus `twitter:card`, and **`assets/share-1200x630.png`**:
  ground `#0E1829`, the stacked lockup, and «كلّ ما تحتاجه في Houston — في
  مكان واحد» in the display face. **The URLs are absolute** — the scraper
  fetches them from its own server, where a relative path resolves to
  nothing.
- ⚠️ **The card cannot know the reader's city.** It is read before anybody
  opens anything, so the image says Houston and is replaced by hand.
- ⚠️ **And every link previews as the app, not as the page.** Our routes
  carry a `#`, and nothing after a `#` reaches the server, so whoever
  shares «مطعم الشامي» gets the app's own card. A card per page needs real
  paths — **the same thing Universal Links will need** — and two needs
  pointing at one decision put it in the server batch, where it costs
  nothing.

**And two share buttons that did not exist.** `adShareBtn()` draws the mark
and **`mountAdShare()` wires it once at the root, in the CAPTURE phase** —
not a wiring call per screen, because the mark is drawn on three surfaces
from seven call sites and a wiring call is a thing somebody forgets. ⚠️ **It
sits inside a row that navigates**, so capture is what lets
`stopPropagation` reach the row's own handler, which `wireRoutes` binds on
the row itself. Measured: the tap shares and **the hash does not move**.

- The slider, the mini banner and the sponsored rows carry it. **The house
  slide does not** — an unsold slot has no advertiser and nothing to send.
- **«ابعث عربنا لصديقك» is a LEAF in the help group, not a top-level row.**
  The drawer's standing rule is that it never scrolls and it is already
  over at 882/844 with «تصنيفات عربنا» open; an eighth row would break it
  for everybody instead of only for an open group. Measured with the help
  group open: **866 against 844.** That is a third group over the line, and
  which row to drop is still the owner's call.
- **`appLink(hash)` in `ui.js`** builds the link instead of reading
  `location.href`. Five of the six share buttons passed the address bar,
  which is only right while the reader is standing on the thing they are
  sharing — and an ad in a strip on Home is not. `profile.js` already built
  its own; this is that one, in one place. The drawer's is `appLink()` with
  no hash: the one share in the app that means «this application».

### The badge: a mark in lists, a word on the page
**The measurement:** a name row carrying the pill was **60px against 28** —
two lines where there was one — and the word alone took **66 of the 265
pixels** the name has.

- `bizBadgeHtml(b)` returns **the mark alone** and `bizBadgeHtml(b, true)`
  the mark and the word. One call site passes `true`: the business page.
- ⚠️ **TWO SHAPES, NOT TWO COLOURS.** Both badges were a circle with a
  check and differed only in colour, which is no difference at all to a
  reader who cannot see colour. The business is a **shield**
  (`shieldCheck`, new in `icons.js`), the person stays a **circle**
  (`.badge-check`). Contrast measured on the mark as a graphical object:
  **8.53 dark · 8.70 light**, against a bar of 3.
- ⚠️ **`.row-title` IS A FLEX ROW WITH `gap: 6px`**, so a margin on the
  mark is double spacing — and «مطبخ ومخبز سامي اللبناني», the longest
  Arabic name in the file, measures **242px of the row's 263**. Those four
  pixels were the whole difference: with the margin the row was 50px, and
  with the gap alone it is **30px, identical to the same row unmarked**.
  The box is the glyph at 14px for the same reason; an 18px box around a
  12px shield spent six pixels on nothing.
- A fifty-character name is three lines with no badge at all, so the test
  asserts the row against **itself unmarked**, never an absolute height.

### And one thing the harness had to learn
⚠️ **The single-file build inlines every image as a data URI**, so an
assertion on a logo's filename passes on one build and fails on the other
— which is what `s v40` failed on first. What is true of both is that the
two themes must resolve to **different bytes**, so that is what `test_v40`
asserts, with the filenames checked as well wherever they survive.
Measured: 443,758 against 450,138 characters. This sits beside the
importmap rule already recorded above — both are the same lesson, that the
second build is a different environment and not a copy.

### The state is pressed, never searched
`Texas` and `TX` were missing, and adding them to the dictionary would have
been the **«عربية» and «لحوم» trap exactly**: every address in the file ends
`TX 77xxx`, so **`TX` measured 514 — the whole directory.**

- **`STATE_SUGGEST` in `data.js`** is matched as a **whole query** and
  answered with a place to go. `stateSuggestion(term)` in `store.js`
  separates the two halves, and the split is the point: **the CODE** is in
  every address and carries no information, so its results are suppressed
  and it gets the suggestion alone; **the NAME** is in 38 real shop names
  («Texas Halal Market»), so those stand with the suggestion above them.
  Measured: `TX` 514 → **0 + a suggestion** · `Texas` **38** · `تكساس`
  **2** · `Houston` **378** and `شوجر لاند` **32**, both unmoved.
- ⚠️ **And «ما وجدنا شيئاً باسم TX» is a lie** — there are 514 shops in
  Texas and the suggestion two lines above says so. Both empty states are
  suppressed for a code: the suggestion IS the answer, and a screen must
  not contradict itself.
- Pressing it: `setUserState()` → the chip reads **`TX`** and the whole
  directory is inside it.

**And the abbreviation turns itself on.** `REGIONS` carries `state: 'TX'`
and `statesCovered()` counts the distinct ones; `cityChipLabel()` prints
«Richmond TX» **only when there is more than one state**, because today
every listing is in Texas and printing it 514 times is noise in a button
capped at 44% of the row. **The field is in the data now and the display
works by itself** — there is no later change to make.

- The business page needed nothing: every address in `data.js` already
  reads `…, Richmond, TX 77407`, which is the whole requirement.
- **Bidi was already right, and was measured rather than assumed.** Fifteen
  screens plus both Texas queries: **zero RTL lines carrying a Latin run
  without an isolating ancestor**, and «أول الخطوات في Houston، خطوة خطوة»
  measured run by run renders in the correct order. Nothing was changed;
  the sweep is now assertion 5.1 in `test_v40.mjs` so it stays that way.

## V.04.8 — device preferences are not account property

Two reports from the phone, and one cause under both.

### «My phone is on light and the app opens dark»
Not a fault — it was written that way. The header button's two outcomes
were `light` and `dark`, and **«تلقائي» was not one of them.** So one tap
on the plainest control on the screen took the reader out of following
their own device **for good**: no word, no change in the icon, and no way
back except a settings screen most people never open.

```js
const want   = resolvedTheme() === 'dark' ? 'light' : 'dark';
const device = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
setTheme(want === device ? 'auto' : want);
```

**When the direction of the tap is the one the device already says, the
choice is not pinned — following resumes.** Measured on a light device:
`auto` → tap → `dark` pinned → tap → **`auto`, not `light`**; and the
mirror on a dark one. So the reader is never more than one tap from
«تلقائي» however often they flip.

- **Nothing new is drawn**, and that is deliberate: no third icon state, no
  extra button, no screen. The sun stays a sun and the moon a moon —
  **what changed is what gets saved, not what is seen.**
- **An explicit «فاتح» or «غامق» chosen in Settings is not overruled.** It
  survives a device on the opposite setting; the reader taps, it flips, and
  when it lands on what their device says the automatic comes back — which
  is what tapping the button asks for.

### The settings screen was behind a sign-up form
`memberOnly('#/settings')` sent a visitor to `#/auth/signup`, and the
drawer had no settings row for them at all: it was a leaf inside «حسابي»,
**a group that is not drawn for a visitor at all** — which is why this was
the fault itself and not merely where the row sat.

```
a visitor who wants «تلقائي» back  →  create an account
a visitor who wants larger text    →  create an account
```

⚠️ **And the second is not cosmetic.** Our oldest readers need the large
text first and sign up last. Somebody who cannot read the screen is not
persuaded to register in order to make it bigger — **they close the app.**

> **THE RULE: the language, the appearance, the text size and the maps app
> are DEVICE preferences, not account property.** Nothing about them
> reaches a server, nothing follows the reader to another phone, and there
> is no identity to ask for in exchange.

- The guard is deleted and the screen splits in two. Everything an account
  really owns — notifications, payment, the subscription, receipts, the
  block list, deletion — is wrapped in `isLoggedIn()`, and **the maps app
  moved up out of that block**, because it is the fourth device preference
  and belongs with the other three.
- **A visitor is told, never shown a blank** where six sections used to be:
  `settingsGuestNote` says what an account adds and what already works
  without one, over a sign-up button.
- ⚠️ **The wiring is guarded by the same condition that drew it.**
  `$('#addCard')` and `$('#delAcc')` on a screen that never rendered them
  throw on `null` and take the whole screen down. Measured: five entries
  and exits, **zero console errors**.
- **The drawer row is standalone, for everybody, directly under «اللغة».**
  Not taste: the language is a device preference and is already a
  standalone row for everybody, so settings is of its kind, and the two
  together make device preferences one block at the top — before anything
  belonging to an account. **Not inside «الأقسام»**: those are destinations
  a reader browses to, and settings is not somewhere you go, it is
  something you go back to. Measured: **exactly one settings row** for both
  roles, and a member loses nothing from «حسابي».
- Measured for a visitor: the text really enlarges (17 → 21px) and **is
  still there after the app is closed and reopened**.

**And the eighth row's cost, measured rather than waved past.** V.02.5
rejected an eighth drawer row because it made the panel scroll; this one
is added anyway, and the numbers are: **folded, the panel is exactly 844
and still does not scroll** — the rule holds where it is most often read.
With a group open it is over, as it already was: visitor **1021** with
«تصنيفات عربنا» and **921** with «المساعدة»; member **941 / 991 / 891**.
So this makes an existing overflow worse and does not create a new one,
and **which row goes is still the owner's decision, open since V.03.2.**

### Three faults the net caught in V.04.7, and the suites that assert what changed
The twenty-minute gate exists for exactly this, and it earned itself three
times over.

- ⚠️ **The «+16» tile opened `#/directory?cat=undefined`** — an empty
  directory reached by tapping the one tile that promises the whole list.
  Home's category handler read `data-cat` off every `.cat-item`, and the
  sixth has none: it carries `data-route`, so it is skipped there and
  `wireRoutes` takes it.
- ⚠️ **`BAR_COLOR` in `ui.js` is the ONE place `--bar` is duplicated** —
  the browser's own chrome cannot read a custom property — and V.04.7 moved
  the light bar to sky and left this at the old ivory, so the phone painted
  a strip of the previous theme above a bar of the new one. Change one,
  change the other.
- ⚠️ **`state: 'TX'` is a DEFAULT written by all four location writers**,
  so reading it as «this reader chose a state» made the chip say «TX» to
  somebody whose point had simply not been named yet — **the V.03.8 rule
  inverted**, since a point with no name says «موقعك الحالي» and never an
  invented place. `setUserState` marks its own work with `stateOnly` now.
  And the chip did not repaint after the press either: **`paint()` redraws
  the results, not the search row**, so it went on saying «حدّد موقعك» over
  a directory that had just been set to the whole state. `repaintCityChips`
  is exported and is the one definition all three screens share.
- **`HOME_CATS` gained two members with no one-word short label**, so
  «أسواق وملاحم» and «أماكن عبادة» sat under 52px tiles against the row's
  own rule. `catShortGrocery` / `catShortWorship` — «أسواق» and «عبادة»,
  the second naming neither a mosque nor a church, which is the standing
  rule too.

**Nine suites asserted what these two batches deliberately reversed.** Each
was rewritten rather than relaxed, and each carries a comment naming the
reversal — never a deleted check:

| suite | asserted | now |
|---|---|---|
| v3 | Home shows five categories, Events among them | six tiles, Events is not one; the events screen is reached directly so its own coverage survives |
| v4 | categories first under the search row · circles at 56px | the visitor's headline stands between; **tiles** at 52px, and every tile must have a ground |
| v5 · v7 | a visitor has no settings row and `#/settings` redirects · seven drawer rows | the row is there and the screen opens · eight rows |
| v10 | the five are restaurants · doctors · events · homeservices · shopping | restaurants · grocery · doctors · worship · auto |
| v16 | «home keeps its circle row» | its tile row — and the point of the check, that Home shows and does not filter, is asserted harder than before |
| v17 · v18 | the stacked lockup at 80×65 · light is ivory · seven rows · the gold pill in the directory list | the mark at 66×65 · light is sky · eight rows · the pill is on the business page, where the word moved |
| v20 | search and chip share a top edge · the drawer is ≤130px over | they share a **centre** — the box is 38px and the chip 52 — · ≤185px, and folded it must not scroll at all |
| v27 | a dialect guard with no start boundary | «اختصار» ends in «صار » and is the ordinary word for an abbreviation — **the V.02.6 boundary lesson inside a test** |

⚠️ **AND THE LESSON THE SESSION ITSELF PAID FOR: a batch is not finished
when its own suite is green.** V.04.7 shipped with `test_v40` at 48/48 and
`33/37/38` clean, and left **nine older suites red** — three of them
hiding real faults (the «+16» tile, the browser bar colour, the state
chip). The touching-suites shortcut in the testing rules is for *while you
work*; the full gate at the end is what makes «never break a working
feature» true, and skipping it does not save the time, it moves it.

## V.04.9 — the mosque that would not open, and the order of the two blocks

### One screen wired its list and the other did not
Rai: «في المواقيت، المساجد ما بتتحوّل على صفحة المسجد.» Measured on both
screens before touching anything, and the difference is the proof:

```
#/mass    tapped a church  →  #/directory/b12    ✓
#/prayer  tapped a mosque  →  stayed #/prayer    ✗
```

The two lists are **identical in markup** — both draw
`<button class="list-row" data-route="#/directory/…">`. The attribute was
written on every row and nothing had ever wired it: `mass.js` calls
`wireRoutes(root)` after `mountSuggestWorship`, and `prayer.js` calls
`wireRoutes(bar)` — **the prayer bar, drawn somewhere else at another
time** — and never `root`.

- The fix is **one added line**, `wireRoutes(root)` after
  `mountSuggestWorship(root, 'mosque')`. ⚠️ **`wireRoutes(bar)` is not
  moved and not replaced**: it belongs to the bar, and two lines in two
  places is the correct shape, not one line relocated. `wireRoutes` guards
  itself with `dataset.wired`, so the second call cannot double a listener
  on anything already wired.
- After: `#/prayer` first row → `#/directory/b11`, last row →
  `#/directory/b161`, back returns to the times screen intact, `#/mass`
  unmoved at `#/directory/b12`, zero console errors on both builds.

### Occasions above the lists, on both screens
Rai's decision after the mockups. `#/prayer` reads times → prayer settings
→ **occasions** → mosques; `#/mass` reads **occasions** → churches.

⚠️ **The times stay the first thing on `#/prayer`** — they are the screen's
answer and never sink under anything. Measured: card 108 → list 295 →
settings 667 → the first section title at 739. **Only the two blocks under
them trade places**, and not a line inside either changes — no heading, no
card, no internal order, no seven-day grace logic.

⚠️ **I recommended the opposite for `#/mass` and said why**: the mass times
are printed inside the church cards, so pushing them down buries the
screen's purpose. Rai chose the uniform order **and a switch that reverses
it**, so the decision needs no deploy to undo. The comment recording that
sits in `mass.js`.

### Two switches, because the two reasons are different
`occFirst(screen)` / `setOccFirst(screen, on)` in `store.js`, built on the
`seasonOn` / `setSeason` pattern rather than a second pattern invented
beside it. Admin → settings carries «المناسبات فوق المساجد» and «المناسبات
فوق الكنائس».

- **Two and not one**, because only the mass side is expected to change:
  the day the churches send their times, that screen wants the churches
  first again. One switch would force both screens to move to fix one.
- ⚠️ **`v === undefined`, never `!v`.** A switch turned off deliberately
  holds `false`, and reading it with `!v` sends it back to the default on
  every open — a switch that is turned off and will not stay off. Verified
  by closing and reopening with `occFirst:{mass:false}` stored.
- ⚠️ **The switch changes the admin's own device and nothing else.** There
  is no server; the whole state is in the `localStorage` of the phone that
  was tapped. It is built now so the server batch is one call instead of a
  build under pressure — but **no operating decision may rest on it before
  then**, and it is written into `docs/الحالة.md` as a deferred gap rather
  than left to be rediscovered.

## V.05.0 — the hue is the subject, the shape is the section

### Two faults, one line between them
Rai: the marketplace section icons have no colour, as if they were still
the old shape. Measured on `#/categories` before touching anything:

```
marketplace sections   8 tiles  ·  8 with no hue
directory categories  22 tiles  ·  1 with no hue — «فعاليات», white among 21 coloured
```

Both came out of the same argument in `cell()`, `c.route ? '' : c.id`:
the marketplace was called with no `catId` at all, and Events is the only
`CATEGORIES` entry carrying a `route`, so it reached the same branch.

- **The marketplace's colourlessness was a decision**, written into the
  file's own comment: «a marketplace section has neither». So it is a
  decision reversed, not a bug fixed.
- ⚠️ **«فعاليات» was a bug.** Nobody decided it should be white — it fell
  out of a condition written for something else. `route` means «this is
  not a directory filter» and says nothing about colour, and it was
  guarding nothing else: no other category carries one.

### Filled is a place, outlined is a listing that passes
Rai's decision after the mockups: **outline, not fill.**

```
filled + khatam    a place in the directory
outline, no fill   a listing passing through the marketplace
```

⚠️ **So a marketplace section may share the hue of its directory twin** —
Cars above and Cars below are one hue, and only the shape says which. That
is what «ميّزهم عن أيقونات الرئيسيّة» asked for, and it is why the hue is
the subject and the shape is the section.

- `MARKET_HUE` in `data.js` beside `CAT_HUE`: four sections take their
  twin's hue (`cars`=auto 128 · `furniture`=homegoods 334 ·
  `realestate` 202 · `handyman`=homeservices 304), and the four with no
  twin take **56/68/80/92 — the only band the twenty-one leave free with
  12 degrees between them.** They are visually close and that is accepted:
  what separates them for the reader is the icon — briefcase · paw · gift
  · bag. ⚠️ **And nothing goes near the gold band (~39°)**: gold is the
  colour of the button and the action, and a gold tile reads «tap me».
- `events: 276` joins `CAT_HUE`. Measured against its own fill in dark:
  **3.76**, inside the twenty-one's range of 3.41→5.56, not under it; 8.22
  in light. It sits 10 degrees from `worship` 266 and `community` 286, and
  that is accepted **only because the three never stand together** — rows
  one, three and eight, with three different icons. ⚠️ **No fourth hue in
  that band.**
- ⚠️ **`--h` is written on the pill itself, never on a parent** — the
  V.04.7 rule, because a custom property carrying `var()` is substituted
  where it is declared.

### The rule repeated three times, and why that is not a slip
```css
.cat-cell .cc-ico.mk                                    /* (0,3,0) */
:root[data-theme="light"] .cat-cell .cc-ico.mk          /* (0,4,0) */
@media (prefers-color-scheme: light) … .cc-ico.mk       /* (0,4,0) */
```
The light-theme fill rules above are **(0,4,0)** and a single `(0,3,0)`
rule loses to them — **the fill would come back in light mode alone**,
which is the mode Rai uses. And `border-color: currentColor` means the
outline can never drift from the icon: measured worst case **6.67 dark
(أثاث 334) and 5.28 light (حيوانات 68)** against the page ground, both far
over 3. ⚠️ **The width stays 1px on purpose** — the browser floors
`1.5px` to 1px at every pixel density, so writing 1.5 would say one thing
and render another.

### Measured after
```
marketplace tiles with no hue   8 → 0      both themes, both builds
directory tiles with no hue     1 → 0      («فعاليات», and it keeps its khatam)
marketplace fill                transparent · border == icon colour · 1px
khatam on a marketplace tile    none
cars hue == auto hue            yes, and the shapes differ
the flip repaints in place      rgb(136,231,149) → rgb(21,102,32), fill still none
Home's row of six               unchanged — five hues and the hueless «+16» tile
the directory chip row          still without «فعاليات» (`!c.route`, another file)
console errors                  0
```

### A check that lies about a green build is worse than no check
`test_v36` counted outside requests with `localhost:8099` **written as a
literal** while `BASE` honours `HOST`. Proven on port 8123: the old line
counted **29 of our own files** as outside requests and printed a red FAIL
on a clean build; reading the origin off `BASE` reports 0. It was the only
hardcode of its kind — every other suite was searched.

## V.05.1 — the placeholder nobody had styled, and the drawer's stacked mark

### The first of the three had already landed
File `205` reported «+16 · عرض الكل» opening `#/directory?cat=undefined`.
**It was fixed in V.04.8** — the file says itself that `195`, `200` and
`210` shipped after it was written. Pressed and measured before touching
anything: `+16` → `#/categories`, مطاعم → `#/directory?cat=restaurants`,
عبادة → `#/directory?cat=worship`. The guard is already general — a card
carrying `data-route` is `wireRoutes`'s and this listener leaves it alone
— so nothing was rewritten to match the file's phrasing of the same fix.

⚠️ **And test 3 of that item cannot run**: it asks for a card with
`data-dest`, and no Home tile has one. `data-dest` is written only for a
category carrying `route`, which is Events alone, and Events is not in
`HOME_CATS`.

### A colour identical in both themes is a colour nobody chose
Rai: the rotating word in the search box is too faint in light mode.
Measured, and it was the opposite of what he expected:

```
          colour     ground     ratio
light     #757575    #E9F3FB    4.10    borderline
dark      #757575    #263764    2.51    fails
```

⚠️ **The same `#757575` in both themes — that is the browser's default,
and its being identical is the proof the field was never styled at all.**
`.input::placeholder` exists and does not reach it: the search input's
`className` is empty, it is not `.input`. The only rule that did reach it
is V.04.7's fade, and that rule owns `opacity` and never mentions colour.

- **Light was the better of the two, not the worse.** Dark failed by a
  wide margin, and Rai noticed light because faint grey on white reads as
  «empty», while the same grey on dark blue reads as «faint text» — seen,
  and not complained about.
- ⚠️ **Dark takes `--text-2`, not `--muted`.** The field's ground is
  `--surface-2`, and «`--muted` is never put on `--surface-2`» is the
  V.02.5 rule, measured 3.79 there. **This field was the case the rule had
  missed, not an exception to it.**
- After: **7.74 light · 7.81 dark** (the file predicted 8.45 for dark; the
  colours and the ground are the ones it named, so the arithmetic is the
  only difference — both are far over 4.5). The typed text is untouched at
  16.37 and 10.26: the rule is on `::placeholder` alone.

### The drawer kept the lockup the header had already rejected
Rai: «الكلام جنبه مش تحته». Measured: the drawer drew
`assets/logo-sm-ink.png` — **913×340, ratio 2.69** — at 124px wide, so
«عربنا» was a few pixels beside the mark rather than under it.

⚠️ **This exact fault was fixed in the header in V.02.5b and the drawer
was left on the rejected shape** — that batch even listed the drawer among
`wide`'s remaining users. Two words in two places:

```
js/ui.js        data-logo="wide"     2 → 0
js/ui.js        data-logo="stacked"  0 → 2
js/screens/auth.js  wide             2, before and after — untouched
```

**How the two are told apart from the two that stay**: the pair in `ui.js`
carry no `style`, the pair in `auth.js` carry `style="height:56px"`.
Change what has no `style`.

- `alt` went with them, «ARABNA» → «ARABNA عربنا» — the stacked file
  carries both names, and it is **what `profile.js` already writes for the
  same image**, so the two agree instead of differing.
- The mark is now **56.5 × 46** where it was 123.5 × 46: the height is
  fixed in CSS and the ratio went 2.69 → 1.23, so the width follows and
  **the drawer's own height does not move — still 844/844 folded.** Same
  reasoning as the header's in V.02.5b.
- Member and visitor drawers measured separately and are identical, and
  the flip still swaps the file in place with the drawer open —
  `logo.png ↔ logo-ink.png` on the module build, two different data URIs
  on the single-file one. `data-logo` is what `applyTheme` reads, and only
  its value changed.

## V.05.2 — signing out did not end ownership on the device

### The contradiction was one line wide
Reported by the daily check and reproduced by pressing, not by reading. A
reader signed out; the app was reopened on the same phone with no account:

```
isLoggedIn()  false      ownsBusiness('b1')  TRUE   ← the whole fault
tier()        0

#/receipts          the previous account's ARB-26-5UQQ4 · $29
#/my-subscription   «فعّال · $29 شهرياً · مطعم الشام»
#/business/edit/b1  the owner's edit form, opened
```

⚠️ **And worse than reading.** The «إلغاء الاشتراك» button was drawn for
that visitor; pressing it and confirming set **`cancelAtPeriodEnd: false →
true`** on somebody else's subscription. Measured, not inferred.

Two functions between them: `signOut()` was `state.user = null; save();`
— it erased the account and left everything the account owned — and
`ownsBusiness()` never asked whether anyone was signed in at all.

⚠️ **This is not a new rule.** It is the second half of the one V.04.8
landed: **device preferences are not the account's, and what the account
owns is not the device's.** The first half shipped and the second did not.

### A route guard was the wrong answer, and the net said so
`requireTier(1, …)` on `#/receipts` and `#/my-subscription` fails
**`test_v38 · 1.1b`**, which carries the decision in writing: those two
are deliberately **not** gated — a visitor has no subscription and no
receipts, so what they meet is a designed empty state, and the first
carries the door to buy. **A page that sells stays open and the gate
stands at the payment.**

- **So the leak was never a missing route guard — it was the data
  answering to nobody.** The guard went into `receipts()`,
  `receiptById()` and `subscription()` instead.
- **And that is the stronger place.** It closes the leak on a phone that
  still carries the old state **with no `signOut` ever having run** — a
  route guard could not have reached that case at all. Asserted as its own
  block in v42.

### What survives, written as what STAYS
`KEEPS_ON_SIGN_OUT` names **34 of the 59 `DEFAULTS` keys**; the other 25
go back to their declared defaults.

```
10  the device's own          lang · theme · fontScale · location · geo … · mapsApp
23  the admin's and operator's adminAuth · businessEdits · bizPhotos · seasons …
 1  an accounting record       receipts
```

- ⚠️ **The list names what stays, never what goes.** A key added tomorrow
  is therefore cleared by default — **the safe direction to be wrong in.**
  Being wrong the other way is what this batch exists for.
- ⚠️ **Receipts are hidden, never erased** — `receipts()` returns `[]`
  while signed out and the row is untouched on disk, which is why signing
  back in gets every one of them back. They already survive
  `deleteAccount` for the same reason.
- ⚠️ **`JSON.parse(JSON.stringify(DEFAULTS))`** is the deep copy this file
  already uses when resetting: without it the state's arrays *are*
  `DEFAULTS`'s arrays and the first write poisons the defaults for the
  rest of the session. And `boosted` goes back to what `DEFAULTS` says,
  not to an empty array — the default is declared there, not decided here.
- **Signing out resets keys and never removes them** (v42 · 3.5): a
  missing key reads as `undefined` at every call site instead of as the
  declared default, which is a second bug wearing the first one's clothes.

### Measured after
```
after a real signOut, reopened as a visitor
  isLoggedIn · ownsBusiness    false · false — they agree at last
  myBusinessId · subscription · cardOnFile   back to default
  saved · blocked · myAds      emptied
  receipts on disk             1, untouched · receipts() → []
  theme · fontScale            light · 21 — the 195 rule holds
  city · geoGranted            Katy · true — nobody is asked twice
  adminAuth · businessEdits · bizPhotos · seasons   all untouched
  59 keys before, 59 after     reset, not removed
screens
  #/receipts          opens · «لا إيصالات بعد» · no amount, no number
  #/my-subscription   opens · «لا يوجد اشتراك» + «اشترك الآن»
                      and NO «إلغاء الاشتراك» button is drawn at all
  #/business/edit/b1  → #/directory/b1
  #/subscribe         open, and its button is «سجّل مجاناً واعرض السعر»
                      → #/auth/signup, never the payment
console errors        0
```

⚠️ **A visitor still sees no price on `#/subscribe`, and that is correct**
— `showsPrices()`, the V.01.6 rule. The file's own test 9 expected the
price to be visible; the standing rule wins, and what the visitor meets is
the price gate, which is what it is for.

**`test_v42` — 35 assertions, both builds.** Its number was taken from the
repository at the moment of writing, not from a note, which is the rule
`v36` was written to enforce.

## V.05.3 — colour that reads on ivory, and the word that only moved on Home

### An outline carrying all the colour cannot also be dark
Rai: «على الغامق مبيّنة وشكلها حلو، بس على الفاتح كأنّها أبيض وأسود.» He
is right, and the cause is not a missing colour — it is the missing fill.

```
dark    a light saturated line on a dark ground   → reads as colour
light   a line at 24% lightness on near-white     → reads as black
```

The directory's 22 tiles read as colour on ivory because they have a
**fill**, and the hue rides the fill. V.05.0 gave the marketplace pill an
outline and no fill by decision, so **all of its colour rides one thin
line** — and a line dark enough to clear 4.5 has to lose its hue.

- Light-mode ink goes to **32%**. Measured before and after on the same
  eight hues: cars `#156620` → **`#188b28`**, furniture `#661538` →
  **`#8b184a`** — the exact values the batch predicted.
- ⚠️ **The contrast fell and it is written here, not hidden**: lowest
  3.19 against the page ground where it was 5.28. **3:1 is the bar
  non-text graphics answer to and 4.5 is the text bar**, and an icon is a
  graphic — but the number did drop, and Rai chose 32% after seeing both.
- ⚠️ **Dark is untouched** — «شكلها حلو», and the measurement agrees at
  6.67. **The 22 directory tiles are untouched** — 24% on their own fill
  is correct. **And the border stays `currentColor`**, so it followed the
  new ink by itself with no second value written. That is what writing it
  that way in V.05.0 bought.

### The rotating word moved on Home alone
`mountSearchHint` was private to `home.js` and wired to `#homeSearch` **as
a literal**. Measured over ten seconds: Home 5 different words, the
directory 1, the marketplace 1.

- It is exported and takes its selector; the directory calls it with
  `#dirSearch`. **Measured after: the directory shows 5 words too.**
- ⚠️ **The teardown line had to take the selector as well.** It compared
  against `'#homeSearch'` to decide whether the screen had been left — so
  with the literal left in place **the directory's timer would have kept
  running after the reader walked away**, and no timer in this app runs
  without a reason. Measured: ten seconds after leaving the directory, its
  input took **0 further repaints** and Home's kept moving.
- ⚠️ **Mounted in the screen's mount, never in `paint()`.** The search bar
  is drawn once and is not rebuilt by a filter; a call inside `paint`
  would start a fresh timer on every filter tap.
- ⚠️ **The marketplace is deliberately still.** `SEARCH_HINTS` are trades
  — restaurant, plumber, doctor, electrician, masjid — and the
  marketplace's sections are cars, furniture and jobs. Rai's decision; if
  it ever wants one it needs its own words.

### The drawer mark, and the eighteen pixels it costs
`.drawer-head img` goes 46px → **64px**. The width is never written: the
file is 1173×955, so it takes **78.6px** and keeps its proportions.
Nothing crops it — no `overflow`, no `object-fit`, and the head is an
ordinary block, so the height pushes what is below and cuts nothing above.
Measured top and bottom on both roles: no clipping either side.

⚠️ **And here the batch file's own summary was wrong, so it is corrected
here.** It said the visitor never overflows. Measured at both heights,
every group in the drawer overflows and always did:

```
                     46px        64px
visitor  تصنيفات     +177   →    +195
         المساعدة     +77   →     +95
member   حسابي        +97   →    +115
         تصنيفات     +147   →    +165
         المساعدة     +47   →     +65
```

**Every group grew by exactly +18** — the file's arithmetic for the member
was right to the pixel; only its claim about the visitor was not. The
overflow is a standing gap awaiting Rai's decision on which row to drop,
and `docs/الحالة.md` already carried the 46px figures — they are updated
to the new ones and **the gap stays open**. Folded, the drawer is still
844/844 and does not scroll.

### A check that lies about a green build is worse than no check
`test_v37` waited a flat 600ms and then read `#app`. `run.sh` runs both
builds at once on a two-core machine, every screen it named is behind
`memberOnly`, and a redirect is a tick of work — so it sampled
mid-redirect and printed red on a clean build, naming different screens
each run, which is the signature of a race and not of a defect. It now
waits for `#app` to actually have text, capped at 8s.

- ⚠️ **The `.catch(() => {})` is the point, not leniency.** Without it a
  genuinely empty screen throws and takes the whole suite down instead of
  recording one failed item.
- **Proven both ways**: three consecutive `run.sh` passes, and with
  `HelpScreen` deliberately emptied it still printed `FAIL AR 1 ->
  #/help(0)` and the English twin. **We removed the lie, not the teeth.**
- And it is **faster**: 100s → 76s on the single-file build, because the
  flat wait paid 600ms for each of 41 screens even when one drew in 80.
  This is the second check in one day found lying — after `test_v36`'s
  hardcoded port.

## V.05.4 — the second approval was shredding the first

### Silent, and worse than a refusal
Rai asked about a restaurant with three branches, each with its own phone
number, and then about one owner trading under three names. Neither is a
verification problem — a code to the **listing's** own number proves
control per listing, and the name never enters it. The question exposed
something one step past that:

```js
approveClaim →  state.myBusinessId = c.bizId;      // REPLACES
```

Measured before touching anything: the admin approves `b1`, `b2`, `b3`,
and the account ends up owning **`b3` alone** — while the line below has
already marked all three `claimed: true`. And `directory.js` reads:

```js
if (b.claimed) return '';                      the claim button goes
const unclaimed = …filter(b => !b.claimed);    and so does the listing
```

⚠️ **So the two dropped branches become orphans: locked, ownerless, and
claimable by nobody — their owner included.** Measured: neither appeared
on `#/claim` afterwards. The approval did damage no screen could undo,
**with no message, no console error and no log line** — and nobody
complains about what they cannot see.

- **The request side was never broken.** `state.claims` is already an
  array and all three reach the admin. Only the approval replaced, which
  is why the fix is smaller than the fault.
- **`deletionSummary` said «1» to somebody who owned three.** Not
  cosmetic: that is the sheet listing what an account deletion destroys.

### The migration is the dangerous half, not the model
⚠️ **Changing `DEFAULTS` does nothing to a device that already exists.**
Every phone that has opened the app carries `myBusinessId` in its own
`localStorage`, and it survives every update — so without the boot
migration **every current owner loses their listing the moment this
lands.** It folds the old key in once, then deletes it, from state and
from disk.

⚠️ **`!== undefined`, never `if (state.myBusinessId)`.** Most devices hold
the key as `null`: the truthy test would leave it in their storage for
ever and the migration would never finish. Same rule as `occFirst` in
V.04.9, and `test_v43 · 2.1` is what holds it there.

### Plural, and singular where a screen still speaks singular
`myBusinessIds: []` with `ownsBusiness()` reading `includes`, plus
`myBusinesses()` (records) and `primaryBusinessId()`. ⚠️ **The second is
not a second source of truth — it is the first element of the one list**,
so an account with one listing behaves exactly as before, to the letter.
Ten sites in `store.js`, four in `directory.js`, one in `profile.js`.

- ⚠️ **`KEEPS_ON_SIGN_OUT` is untouched and did not need touching.** The
  new key is not in it, so signing out resets it to `[]` by itself. That
  is what V.05.2 bought: one rule that governs every key added afterwards
  without naming it.
- ⚠️ **The subscription stays singular on purpose, and it is written down
  as a gap.** A subscription is a payment, and payment belongs on the
  server, not in a browser. An owner of three branches subscribes once
  until then.
- The new button is **«عندي نشاط آخر» → `#/claim`** — Rai's own wording,
  landing in the **existing** admin queue. No new screen, no invented
  review path.

### Measured after
```
three approvals          all three owned · ownsBusiness true · true · true
the first branch         still owned — it was the one silently dropped
a repeated approval      does not duplicate the entry
deletionSummary          3, where it said 1
an existing owner        keeps their listing, and myBusinessId is gone
                         from state AND from localStorage
a null key               removed too, and the list is [] not [null]
signing out              the list empties · 225 still holds
a visitor, ids on disk   owns nothing — the accessor refuses, not a route
one-business owner       #/my-business unchanged, plus the new button
```

**`test_v43` — 23 assertions, six blocks, both builds.** Block 1 is the
migration and is the most dangerous thing in the batch. **`test_v42 · 2.1`
was reversed rather than deleted** — it checked the key by its old name,
and the comment there names the reversal.

### And the net's five — attributed, not assumed
The full run after V.05.4 came back with ten red runs across five suites.
Each was re-run **on the pre-batch commit** rather than guessed at:

| suite | green at 43cf641? | from | asserted | now |
|---|---|---|---|---|
| v9 · v26 | **yes** — 126/0 and 56/0 | 240 | ownership by its singular name | the list, same checks |
| v18 | no | 205 | the drawer's **wide** lockup | `stacked` — the fault the header fixed in V.02.5b |
| v20 | no | 230 | the drawer gap ≤ 185 | ≤ 200, for the exactly-18px every group gained |
| v27 | no (**crashed**) | 225 | `S.receipts()[0].buyer` | read off the record itself |

- **v27 did not fail, it crashed** — `deleteAccount` ends the session and
  V.05.2 made `receipts()` answer nobody, so the subscript was `undefined`
  and reading `.buyer` took the whole suite down before it could report a
  single item. What it tests is unchanged and still the important thing —
  **the money record survives the person** — and reading it off
  `state.receipts` is the truer test anyway, because that is where an
  accounting record lives. It now runs to completion at **99 assertions**,
  a number nobody had ever seen.
- Every one carries a comment naming its reversal. **None was deleted and
  none was softened past what was measured.**

⚠️ **And the lesson repeats, so it is written again: a batch is not
finished when its own suite is green.** `240` shipped with `v43` at 23/23
and `38/41/42` clean, and left `v9` and `v26` red — and `230` before it
left `v20` red the same way. Rai's own decision log had already recorded
exactly this («الدفعة لا تنتهي بخُضرة سويتها وحدها»), which is why the log
is read at the start of a session and not only written at the end.

## V.05.5 — the drawer empties, the profile fills, and the picture becomes a choice

### «حسابي» was a group in a panel that scrolls
Rai: «بتشيل حسابي من تحت كامل وتخلّي حسابي اللي فوق، وبعد الضغط على حسابي
اللي فوق تفتحله شاشة فيها كلّ الخيارات اللي كانت تحت.» Two buttons under
the name, and the six leaves become the account hub on `#/profile`.

```
                       before    after
member, folded         844/844   844/844 · 8 blocks → 6
member «حسابي» open    +115      the group is gone
member «تصنيفات»       +165      +112
member «المساعدة»       +65      +12
visitor «تصنيفات»      +195      +195 — not one pixel
```

- ⚠️ **Removing the group is what paid, not the two buttons.** I had told
  Rai the buttons would save about 3px, and that was true of the buttons
  alone. The measured saving is **53px on the member's worst group**, and
  «المساعدة» went from 65 over to 12. His decision was worth more than the
  number I gave it.
- ⚠️ **The visitor did not move, and that is correct** — the «حسابي» group
  was never drawn for a visitor. **The visitor's 195 stays open**, which is
  Rai's own answer to question 4: leave it, the drawer may scroll.
- ⚠️ **The batch file's own baseline was 18px low across the board** (it
  said 147 → 94 and 47 → 0). Its numbers predate V.05.3's taller drawer
  mark, which adds exactly 18 to every group. **The saving it claimed —
  53px — is exactly right**; only the starting line had moved under it.
- **`ACCOUNT_LINKS` in `store.js` is one list, not two menus.** The hub
  reads it and anything built on it later reads it, so they cannot drift
  into two menus saying different things — the same reason `ATTRIBUTES` is
  a registry and not a set of fields.
- `#drOut` kept its id, so the sign-out wiring at the end of the drawer
  function needed no change at all; the new button carries `data-route` and
  `wireRoutes` takes it.

### The picture: three kinds, and I had measured the wrong axis
I argued against ready-made avatars on storage grounds. ⚠️ **I had costed
it as though every reader stored a copy.** Rai's design is that the
pictures live in `js/avatars.js` **once** and the reader stores an id.

```
one vector mark        292 bytes (measured)
twelve of them       3,503 bytes  =  0.052% of the single-file build
what a reader keeps  { kind:'preset', id:'p07' }
```

⚠️ **And the larger gain neither of us saw during the discussion:** an
uploaded photo goes to the admin queue (`setAvatar` writes
`status:'pending'`). **A ready-made mark is our own picture, so it is
never reviewed at all** — the decision takes work *off* the admin.

- **SVG and never PNG**: the single-file build inlines every image as
  base64 and base64 inflates by a third; a vector drawing stays text.
- ⚠️ **Not one of the twelve marks a person's identity** — no flag, no
  sect, no country. Whoever picks a lantern picked it themselves; we did
  not hand it to them. Same rule that forbids tagging a mosque with a
  school.
- **Verified, not taken on trust**: 12 marks · **zero hues in the gold
  band 35–55** · closest pair **12° apart** (80/92) · `fill-rule="evenodd"`
  present in all twelve — without it a door, a flame and a snowcap are
  filled in and vanish.
- `avatarHtml()` is one renderer for the three kinds so no screen invents a
  fourth shape. ⚠️ **The preset's markup is our own svg and is the one
  thing not escaped; the emoji is a reader's value and is.** The name ends
  in `Html`, which is the V.04.1 rule that stopped an `<svg>` being printed
  as words on the two most expensive rows in the app.
- ⚠️ **`[...String(ch)][0]`, never `ch[0]`** — an emoji is two or more
  units in JavaScript and `[0]` cuts it in half, which renders as a box.
- ⚠️ **And the sharpest edge in the batch:** the old save line read
  `u.avatar.url`, which is `undefined` on a preset — so it fell into the
  clear branch and **erased a mark the reader had just chosen, the moment
  they pressed «حفظ»**. Only the photo half is touched now. Measured
  end to end: pick p04 → `{kind:'preset',id:'p04'}`, type 🌙 →
  `{kind:'emoji',ch:'🌙'}` with the preset marks released, press save →
  **still there**, and it draws at 66×66 on `#/profile`.

### The suites
`v5` did not fail, it **crashed** on `[data-toggle="account"]` after a
30-second wait and lost **135 assertions**; the accordion is asserted on
the two groups that remain, which is what that check was ever about. And
the six destinations were **moved into the hub's own check, never
dropped** — a destination nobody checks is one that quietly disappears.
`v7` and `v17` go from eight blocks to six, each naming the reversal.

**And the full run found three more, all of them this batch's:**

| suite | was | now |
|---|---|---|
| v3 | `.avatar img` for an approved photo | the `.avatar` div is the initial-letter fallback only; the photo is a bare `<img>` and still renders at 66×66 — measured before the selector was touched |
| v4 | six personal rows in the drawer · three groups | none in the drawer · two groups — they are asserted on the hub in v5 |
| v41 | clicked `[data-toggle="account"]` | **crashed**, waiting thirty seconds for a group that no longer exists |

⚠️ **`v41` crashed rather than failed, and that is the second time in two
batches** (`v5` here, `v27` in V.05.2). A selector that no longer matches
takes the whole suite down and every assertion after it goes unmeasured —
which is exactly how a batch reports green while it is not. Both halves of
what V.04.8 bought are still checked afterwards: settings is one row and
not buried, and all six account rows are reachable — on the hub.

⚠️ **And this is the third batch running to leave older suites red**, so
the rule is worth stating in its strongest form: *run the full net before
saying a batch is finished, not after.* Its own five suites were green
here while eight assertions across three others were broken or unmeasured.

## V.05.6 — the marks are placed, and WhatsApp says «قريباً» rather than lying

### A button that does nothing is worse than no button
Rai: «حطّ الأيقونة وبعدين بنربطه.» That runs straight into a rule this
project has carried since V.02.1 — and the answer is not one side or the
other, it is what the drawer already does for «إعلانات مميّزة»:

```
url present  →  <a>     navigates · opacity 1
url empty    →  <span>  does not navigate · opacity .42 · title «قريباً»
```

⚠️ **A `<span>` and never a disabled `<a>`.** An anchor with no `href`
stays in the tab order and a screen reader still announces it as a link —
it promises what it cannot do. Measured: pressing it leaves the hash at
`#/about`, opens no tab, and the screen is still drawn.

**And connecting it later is one line in `data.js` and nothing anywhere
else** — `SOCIAL` is a registry, not four hard-coded anchors, the same
shape as `ATTRIBUTES`.

### `xMark`, and why the name is the item
⚠️ **`x` was already taken in `icons.js` — it is the close mark**, used by
the photo picker, the search clear, the filter pills and the admin reject
button. Naming the platform glyph `x` would have turned every close button
in the app into a logo. That collision was checked, not guarded against.

- All four are drawn in this file's own one-stroke 24-grid idiom, with
  `fill="none"` and `stroke="currentColor"` — so they follow the text
  colour and flip with the theme by themselves. **Measured: rgb(214,212,206)
  dark → rgb(30,41,66) light, and not one colour written anywhere.**
- Instagram's dot is a line from a point to itself (`17.5 → 17.51`) —
  this file's own idiom, where `stroke-linecap: round` makes it a circle
  that scales with the stroke. A `<circle>` would not.
- Each platform publishes brand assets under its own rules; these are
  simple recognisable glyphs, and if a platform objects, its own file
  replaces the path and nothing else moves.

### Where the row goes, and where it deliberately does not
**On «عن التطبيق» alone.** ⚠️ **Not on privacy or terms:** a legal page
carries a published address for complaints, not marketing accounts, and a
follow row above «طلبات إزالة المحتوى» reads wrong. ⚠️ **And not in the
drawer:** it is 112 over for a member and 195 for a visitor after V.05.5,
and another row adds to that — Rai's answer to question 4 was to leave the
overflow, not to feed it. Measured: privacy 0, terms 0, help 0, drawer 0
and still 844/844 folded.

**No new word in `i18n.js`** — `soon` has existed since V.02.7, and
`chk_i18n` is unchanged at 416 derived keys and 1747 strings. **And the
email was not added**: it is `SUPPORT_EMAIL` and has been on that screen
for a long time; it is not written twice.

### And v15's one red, which was pressure — with the diagnosis written down
The first full run after this batch came back with `v15` red: eight
failures on the single-file build and a **crash** on the module one. The
second full run, unchanged, came back **82 results, 5146 assertions, zero
red**, and `v15` at 88/0 both times it was run on its own.

⚠️ **All eight failures trace to ONE step, not eight faults.** The suite
grants a Houston point and seeds a listing's coordinates, then measures.
When that one step does not land in its flat `waitForTimeout(1400)`, the
city stays Katy (6.29, 6.30), the seeded listing has no miles (6.31,
6.33), the mile options never appear (6.35), "nearest" picks the wrong row
(6.36), and the export counts **515 lines instead of 514** because that
listing is still waiting (6.46, 6.48). One race, eight symptoms.

**It is recorded and not chased**, which is the precedent `245` set for
`v28`/`v31`/`v37`: pressure on a two-core machine is not a defect. But it
is a *latent* flat-timeout race of exactly the kind `235` removed from
`v37` — **wait for what is measured, never for a number** — and it will
bite again. The fix pattern already exists in the repository; it belongs
in a suite file of its own, not in a batch about social icons.

## V.05.7 — a new email inherited a badge it never earned

### The one exception in the whole file
Measured from the code, not guessed: `updateProfile` wrote
`u.email = email` and **nothing touched `emailVerified`**, while the phone
three lines below had always cleared its own flag correctly.

⚠️ **So a new address inherited «verified».** Whoever reached an open
account for one minute could change the address, and from then on
everything the app sends — a password reset first — goes to them, with no
way back for the owner.

### And the obvious fix is not the right one
Write the address and clear the flag: **one typo then drops the account to
tier 0 at an address no code can ever reach**, and there is no way back
from that either.

> **The new address is held aside until a code confirms it, the old one
> keeps working, and an abandoned change costs nothing.**

⚠️ **That is stronger than what I had promised** — I had offered clearing
the flag alone.

- ⚠️ **`email !== u.email`**, or a «change» is parked every time «حفظ» is
  pressed and a code is demanded for an address that never moved.
  Measured: saving without touching the field goes to `#/profile` with no
  code and no pending.
- ⚠️ **The promotion lives in `confirmEmail()` and nowhere else** — the one
  function never called without a correct code. A promotion anywhere else
  would undo the whole guard.
- **No new screen.** `#/auth/email` exists and works, with its resend
  timer, its ten-minute code life and «تصفّح الآن وأكمل لاحقاً». One line
  in `auth.js` makes it print the **pending** address: showing the old one
  over a code sent to the new one is the app lying at the exact moment the
  reader is checking their inbox.

**Measured end to end:**
```
before             old@a.app · verified · tier 2
after «حفظ»        old@a.app · verified · tier 2 · pending new@b.app
                   → #/auth/email, and the screen prints new@b.app, not the old
abandoned          old@a.app · verified · tier 2 — nothing broke
after the code     new@b.app · pending null · verified · tier 2
```

### The business mark, and the honest part of it
Rai's decision (question 2): **one account, with a flag added at the
moment somebody presses «هذا نشاطي»** — not two kinds at sign-up, where
nobody yet knows which they are and the question only costs registrations.

⚠️ **And the gate he asked for already exists and is stronger than a
flag**: `requireTier(2)` plus a name, a role, a phone and written proof.
**The flag does not buy the gate — it buys the admin's signal.**
`approvedClaims()` says how many of this account's claims were approved
before, and an account with a record is the one that reviews fastest.
**That is the axis, never the name of the business** — the recommendation
I withdrew after his question about one owner trading under three names.

- **The form is the step**: it already asks the four things, so a separate
  «convert» screen would be the same four fields twice.
- **The mark is added on SENDING, not on approval**, deliberately: somebody
  who sent a request and waited a week is not offered «convert your
  account» again on every listing they open. Measured: note shown on
  `#/claim/b30`, `personal` → `business` on send, **note gone on
  `#/claim/b31`**.
- ⚠️ **No new key in `DEFAULTS`** — the flag lives on `state.user`, so
  signing out takes it with no line written anywhere. Measured: `business`
  → `personal` after sign-out. That is V.05.2's rule paying again.

### A product's name is not translated
Rai on the directions sheet: «بفضّل تكتب أسامي البرامج بالإنجليزيّة.» It is
the rule the project already has for «Houston» and every shopfront — and
**the list itself was the proof it had been missed:**

```
mapsGoogle: 'خرائط جوجل'   translated
mapsApple:  'خرائط آبل'     translated
mapsWaze:   'Waze'         ⚠️ not translated
```

Three products in one list and one of them had kept its name. Now all
three keep theirs, and `grep` for «جوجل» or «آبل» in `i18n.js` returns
**zero**.

**The name and not the logo**, for three reasons: those marks belong to
their owners and each has its own usage rules, so drawing them in our
style breaks those rules rather than following them; «Google Maps» in
words is recognised by everyone while an icon in a list of three has to be
learned; and the four marks added in V.05.6 are **our own accounts** —
these are somebody else's products.

⚠️ **`chk_i18n` reads 1753, not the 1748 the batch file predicted** — six
new keys on a base of 1747, and the file's base predated V.05.5's four.
The arithmetic is right, the baseline had moved under it. Again.

## V.05.8 — «قريباً» has to be seen, not hovered

`title` never appears on a phone — there is no hover there. So V.05.6's
dimmed WhatsApp mark stood with **nothing beside it to explain it**, and a
dimmed icon with no explanation reads as a broken icon — **which is the
exact thing the dimming was put there to prevent.**

One line under the row: **«WhatsApp — قريباً»**, «WhatsApp — Soon» in
English.

- ⚠️ **It is built FROM `SOCIAL`, not written.** Connecting WhatsApp
  removes the line by itself and a fifth account added tomorrow joins it
  with no code touched. Verified by flipping the url at runtime: the line
  is there, giving it a url removes it **and turns the `<span class="soc
  soc-soon">` into a real `<a>`**, and taking it away brings the line
  back.
- **`name` on the registry**, so the caption reads «WhatsApp» rather than
  the internal id — and it is still passed through `esc()`, because that
  rule has no exceptions.
- `soonLineHtml` — the `Html` suffix is the V.04.1 rule, private to the
  module because only `socialRowHtml` composes it.

**Measured** — one line, centred, 6px under the row, 12.75px, both
languages:

```
dark    rgb(139,147,172) on rgb(28,42,80)   4.59
light   rgb(69,75,92)  on rgb(243,249,253)  8.19
```

⚠️ **4.59 clears 4.5, and it does so because the ground is `--surface`
(#1C2A50) and not `--surface-2`.** `--muted` on `--surface-2` measures
3.79 and is banned by the V.02.5 rule; this caption sits on the card, not
the tinted pill, so the rule holds and the margin is real but thin. Worth
knowing before anything moves this line onto a darker ground.

**And `#/privacy` and `#/terms` still carry none of it** — zero rows,
zero captions.

## V.05.9 — the flag arrived as half a flag, and nothing was watching

### The gap comes first, because it is the larger fault
**Not one line in the whole net touched the ready-made marks.** Searching
`tools/e2e/` for `av-opt`, `AVATARS`, `avatarSvg` and `data-preset`
returned nothing. ⚠️ **So the biggest feature V.05.5 landed went in with
no guard at all** — and `255` asked for `v5`, `v7` and `v17` to be updated
for the drawer while asking for no coverage of the pictures. That is how
the fault below walked past everybody.

### The comment named the bug and then committed a smaller version of it
`setAvatarEmoji` kept **one code point** and called it a cluster:

```js
const one = [...String(ch || '')][0] || '';
```

The comment above it said «an emoji is two or more units and `[0]` cuts it
in half» — and then the spread iterated **code points**, not grapheme
clusters. Measured on the running app, before anything was changed:

```
U+1F1F8 U+1F1E6              →  U+1F1F8    the Saudi flag, halved
U+1F1F1 U+1F1E7              →  U+1F1F1    Lebanon, the same
U+1F44D U+1F3FD              →  U+1F44D    the skin tone dropped
U+1F468 U+200D U+1F469 …     →  U+1F468    a family became one man
U+1F319                      →  U+1F319    the only kind that worked
```

⚠️ **And the flags are the case that matters for this app in particular.**
It is built for Arabs in Houston, and the flags of Saudi, Lebanon,
Palestine, Egypt, Iraq, Syria and Jordan are the likeliest single
character any of them would pick to stand for themselves. Every one is two
code points, so every one arrived as half.

⚠️ **And nobody would ever have reported it.** The reader types their flag,
sees a box with a letter in it, concludes the app «does not support flags»
and picks something else. **A fault that looks like a design decision is
never reported.**

`Intl.Segmenter` with a spread fallback, so an older browser keeps working
rather than throwing. The old rule is unchanged: one, however much was
pasted.

### The two numbers are one item, not two
`maxlength="4"` counts **UTF-16 units** and a ZWJ family is eight of them,
so fixing the function alone would leave the field refusing to accept one
at all — **and the test would go green on something the reader cannot
do.** 16 fits the longest single cluster, and the function trims to one
regardless, so nothing leaks.

### `test_v44` — and it was proven in both directions
22 assertions in six blocks, covering what had no cover at all: the twelve
marks and their hues, the instant choice with no queue, the emoji kinds,
the uploaded photo that **stays** pending, and the picture leaving with
the account at sign-out.

```
with the fix     22 passed, 0 failed   ·  both builds
without it       18 passed, 4 failed   ·  both builds
   FAIL 3.1 a flag survives whole
   FAIL 3.2 …and so does the second one anybody would pick
   FAIL 3.3 a skin tone is not stripped
   FAIL 3.4 a ZWJ sequence is kept entire
```

⚠️ **The second half is the point.** A check that is green with the fix and
green without it guards nothing — and we walked into that twice this week
(`test_v36`'s written-in port, `test_v37`'s flat wait). **Teeth proven
before the thing is called a net.**

## V.06.0 — the appearance starts from the device on every launch

### Rai's decision, and it reverses half of V.04.8 on purpose
> «خليه كل مرة يفتح تلقائي بغض النظر عن اختياري.»

**The other half stands**: the header button still flips, Settings still
offers the three, and `mountThemeWatch` still follows the device live.
**What changed is only what SURVIVES a launch.**

His reason is the one that settles it: **a phone that dims itself at night
should dim the app with it, and a choice made once at noon should not
outlive the day.**

### One block, at boot, and nowhere else
It sits beside the other two boot migrations and clears a pinned theme
back to `auto`. ⚠️ **So it heals existing devices by itself** — a phone
carrying a pinned theme from an old tap has it cleared on the first launch
after this lands, and nothing is asked of its owner.

⚠️ **`setThemeMode`, `resolvedTheme`, `applyTheme`, the header button and
the Settings screen are untouched.** The whole rule is that one block —
one place decides, and no screen has to remember it, exactly like the
ownership rule of V.05.2.

**Measured before and after:**
```
                                    before            after
device light · nothing saved   light  · auto      light · auto
device dark  · nothing saved   dark   · auto      dark  · auto
device light · «dark» saved    dark   · dark      light · auto   ← healed
device dark  · «light» saved   light  · light     dark  · auto   ← healed

the button inside one session
  clean open on a dark device        dark  · auto
  after the tap                      light · light
  after reopening                    dark  · auto
```

### And the note had to change with it
`themeAutoNote` said «يتبع إعدادات جهازك». It now says the choice is for
this session and the next launch follows the device again.

⚠️ **That is not decoration.** Without it Settings offers three options and
**silently forgets two of them** on the next launch — which is precisely
the «button that does nothing» this project bans. The option stays; the
screen says what it is worth. **No new key** — two strings rewritten, and
`chk_i18n` is unchanged at 416 / 1753.

### Six assertions reversed, none deleted
`v17` (four) and `v41` (one), each carrying a comment naming the reversal.

⚠️ **And `3.8` was not broken in itself** — it measured the gold assuming
light was still applied, and the launch now returns to dark, so light is
re-applied explicitly before the measurement. **The value measured is
unchanged: `#7A5D28`.** That is the kind of collateral a reversal leaves,
and it is worth naming: a check can fail because the step before it moved,
not because what it guards did.

`v17` 46/0 and `v41` 26/0 on both builds.

### And the net found two more, both this batch's — and neither was reversed
⚠️ **`v18` lost six colour assertions to its own HELPER, not to a decision.**
`setTheme` wrote the theme to `localStorage` **and reloaded** — and the boot
now clears it, so every measurement below landed on the device's dark and
read the wrong theme's files. **The behaviour those six guard is unchanged
and still true**, so the helper was fixed to apply the theme live, exactly
as the Settings screen does. **Not one of the six was weakened.** 29/6 → 35/0.

⚠️ **And `v42 · 3.1` guards a rule that is still true.** Device preferences
are not the account's and `signOut` does not touch the theme — that is
V.05.2, and it holds. What changed is that the **boot** clears a pinned
theme, so the seeded «light» was already `auto` before `signOut` ever ran,
and asserting «light» would have been measuring the launch rather than the
sign-out. It now reads the theme before signing out and asserts it came
through unchanged. **The font size, which the boot does not touch, still
carries its real value across.**

**The lesson worth keeping**: a reversal breaks two kinds of check — the
ones that asserted the old behaviour, which get rewritten, and the ones
whose *setup* silently depended on it, which get repaired. The second kind
looks like a failure of what it guards and is not.


## V.06.1 — «من نحن» in Rai's own words, and the real X mark

### The row read «facebook · instagram · close»
`xMark` was two crossed lines — **the close glyph under a different
name**. V.05.6 named it `xMark` precisely so it would not collide with
`x`, the real close mark, and the collision it avoided was in the file
while the one it created was on the screen: a reader met the same two
crossed strokes they press to dismiss a sheet, sitting in a row of
platform accounts.

- `xLogo` is the platform's own mark and is **filled**, so it is drawn
  with `iconFilled(sx.icon, 20)` and the registry row carries
  `filled: true`. Every other row stays on this file's one-stroke idiom.
- **One pixel smaller (20 against 21)** because a filled glyph reads
  heavier than a stroked one in the same box.
- ⚠️ **The name changed, it was not repointed.** Leaving `xMark` in the
  file would leave two symbols named «X» with one of them an
  **abbreviation** — which is exactly the trap the first naming fell into.
  `xMark` was called by the registry and by nothing else, measured across
  `js/`. **And `x` — no suffix — is untouched**; it is the real close mark
  the photo picker, the search clear, the filter pills and the admin
  reject button all use.

### The address is a tile, not a line above a row of tiles
`SOCIAL` grows from four rows to six: the mail and the site join the four
accounts **in the same registry**, because the block's own subject is
where the app lives outside itself and an address is one of those. The
order is the two ways to reach us, then the accounts — Facebook still
first among them, for the audience reason V.05.6 recorded.

- ⚠️ **The address is not written into `data.js` even once.** `data.js`
  must not import from `store.js` — `store.js` imports it, so the arrow
  points one way — so the row carries `mail: true` and **`ui.js` builds the
  `mailto:` from the one `SUPPORT_EMAIL`.** Measured: emptying that
  constant drops the row to the «قريباً» path by itself, exactly as the
  directory drops a call button for a shop with no phone.
- ⚠️ **`target="_blank"` falls off `mailto:`** on purpose — on a desktop
  browser a mail link opened in a new tab leaves an empty window standing.
  The condition is `/^https:/`, so the four accounts and the site keep it
  along with `rel="noopener noreferrer"`.
- **`aria-label` reads `sx.name`**, not `sx.id`: a screen reader was
  saying «إكس» and «واتساب» in lower case. V.05.8 added `name` for the
  caption underneath and never reached the tiles themselves.
- ⚠️ **`soonLineHtml` had to learn the mail row, and without it there is a
  visible fault**: the mail row's own `url` is empty, so the old
  `!sx.url` filter would have printed **«Email · WhatsApp — قريباً»** under
  a working mail icon. **The line and the row must ask the same question**,
  so the filter is `!(sx.mail ? S.SUPPORT_EMAIL : sx.url)` — one source of
  truth, read twice the same way.

### «عن التطبيق» becomes «من نحن», and the page says what the app is
Rai's wording, and the three paragraphs are his own, put into plain MSA
and approved by him — the same rule the newcomer guide's text lives under.
**Nothing is invented**: the need, the two kinds of reader (newly arrived
or settled for years), Houston as the start and every American city as the
aim are all his.

- ⚠️ **The first paragraph grew because it was WRONG, not because he asked
  it to.** It counted three sections while the app has five: prayer and
  mass times and the newcomer's guide were missing from the one sentence
  that defines the app to a stranger.
- **`Houston, Texas` stays English inside the Arabic sentence** — the
  standing rule that a place name is never translated, and it is written
  that way in all 514 addresses.
- ⚠️ **The written-out address leaves «من نحن» and only «من نحن».** It is
  the first tile in the row below, so the block reads as one row of icons
  rather than a line and then a row — and it is **still published in full
  on «الخصوصية» and «الشروط» and «المساعدة»**, which is where a legal page
  has to carry it. `contactBlock` is untouched, and so is the same line in
  `HelpScreen`.
- «سنرد خلال يومَي عمل» left «من نحن» with it and is **still published,
  unchanged**, by `contactBlock` on both legal pages. Measured on all four
  screens rather than assumed.
- **«ابعث» was dialect** — «ما تستخدم العاميّة أبداً» — so `shareApp` is
  «شارك عربنا مع صديق». Six strings changed text and **not one key was
  added**: `chk_i18n` reads 416 derived keys · 1753 strings · 343
  attributes, the same three numbers as before.

### A green that guards nothing is worse than a red
Three suites, and only one of them was a real red.

- **`v14` is the red, and it grew rather than being relaxed.** It checked
  two pages; it checks four. On «من نحن» what must be true is that the
  icon **reaches** the address — an `<a>` with no `mailto:` fails it, which
  is the whole point, since the row must not become six pictures that go
  nowhere. The published-as-**text** duty did not disappear, it **moved**:
  «الشروط», «الخصوصية» and «المساعدة» each assert it now, where only the
  first did before. **107 → 109.** ⚠️ **And it has teeth, proven rather
  than claimed:** the mail link was pointed at `#` and nothing else
  touched, and the run came back **108 passed, 1 failed** — the one red
  being the only assertion in the file that reads that href.
- **`v5` was dying silently.** Its loop guards the V.05.5 rule that the
  account hub does not reprint the drawer's rows, by asserting each row's
  text is absent — and «عن التطبيق» now appears **nowhere in the rendered
  app**, so that member of the loop could not fail whatever the screen did.
  It reads «من نحن». Same shape as v9's `!st.myBusinessId` in V.05.4.
- **`v40`'s assertion NAME had gone stale** — it printed «ابعث عربنا
  لصديقك» on every run while the drawer says «شارك». It measures
  `#drShareApp` and not the text, so it was green before and after; **the
  name is corrected and the check is not deleted**, because a green line
  read six months from now is documentation.

⚠️ **And the count checks itself.** V.06.0 ran 5,190; this batch adds two
assertions × two builds = 4, so 5,194 is what must appear. It did.

## V.06.2 — the drawer's tiles, the mosque, and the duplicated row leaves

### One glyph cannot mean two things
`moon` was the theme button **and** stood for prayer in ten places, so the
same drawing meant «prayer» in a list and «night mode» in the header —
`xMark` again, one symbol with two jobs. `mosque` is new: a dome, a door,
and **one** minaret with a balcony and a crescent, drawn to sit **beside
`church`** — a building, a religious mark above it, a door — so «مواقيت
الصلاة» and «مواعيد القداس» read as a pair rather than two drawings from
two worlds.

- ⚠️ **One minaret, not two.** Two collapse into a pair of ticks at 19px,
  which is the real drawer size. Five alternatives were drawn and thrown
  out **by measurement, not taste**: two minarets, a lone minaret, a
  rosary, a dome with a filled crescent, a mihrab with no mark. **The
  church survives small because its cross is two straight lines**, and a
  straight line survives shrinking where a small curve does not.
- ⚠️ **`moon` is not deleted.** It is the theme button, and it is Ramadan
  and iftar in `data.js` — there a crescent is the right drawing, not a
  stand-in for one.
- ⚠️ **And the trap for anyone who searches and replaces:**
  `suggestWorshipHtml('mosque')` and `mountSuggestWorship(root, 'mosque')`
  take a **kind of place of worship, not the name of a symbol**, and the
  string never reaches `icon()`. The likeness is a coincidence.
- On `#/mass` the feast rows were asked about explicitly, because the
  crescent there is correct in itself — the calendar is Hijri. Measured
  before changing anything: the feast crescent is **gold inside a gold
  square** (`rgb(228,199,126)` dark, `rgb(90,68,24)` light) while the theme
  button's is **grey**, and in dark the theme button shows a sun at all —
  so the two never met. Rai chose the mosque there too. **The line changes
  and no colour is added**, because the colour asked for was already there.

### The tile is opt-in, and a leaf is never given one
`tile(ico, h)` in `js/ui.js`: `h` undefined is the plain icon exactly as
before, a number is a filled tile in that hue, and `'gold'` is the
reserved gold for «أعلن معنا» alone. Both new arguments sit last and
default to absent, so **every existing call works untouched** — and the
group leaves are all of that kind.

- ⚠️ **The leaves get nothing, and that is a measurement, not a taste.**
  Tiles on the leaves take the visitor's overflow **195 → 259**, a full
  row; the top-level rows and the two group heads alone cost 195 → 231.
  So there is **no CSS rule turning a tile off inside `.dr-sub`** — none is
  ever asked for, and a stylesheet undoing what the markup just requested
  is two sources of truth.
- **Every hue comes out of `CAT_HUE`** — realestate 202 · lawyers 232 ·
  sweets 348 · auto 128 · worship 266 — already measured for contrast when
  the categories were built, and **none in the gold band 35–55**: that band
  is the button and the action, and a row wearing it reads as «selected».
- ⚠️ **`--h` is written on the tile, never on a parent** — the V.04.7 rule.
- ⚠️ **`.dr-accent` is untouched**, so if the tile is ever lifted the row
  goes back to gold with nothing written.
- **Measured: 30×30 exactly, glyph 19, ink white on the colours and
  `--on-gold` on the gold** (`rgb(26,18,6)` dark, `rgb(255,253,248)`
  light), **zero tiles inside `.dr-sub`**, zero console errors.

**And a number given to Rai was wrong, so it is written here corrected.**
I told him «no row grows, the cost is 36px». The truth: «اللغة» is 67px
and swallows the tile (+0) **because it is the tallest row in the drawer,
carrying the language disc** — I measured that one and generalised from
it. Every other top-level row grows **+8** and each group head **+10**, so
the real cost is **+36 for a visitor and +44 for a member**. He was then
given the full four-size table and chose 30 again.

### The duplicated row leaves, and the ceiling comes DOWN
«كل التصنيفات» is out of the drawer — **not for space, because it is a
duplicate**: Home already carries it as the computed «+N / شاهد الكل» tile
at the end of the category row, and Home is a permanent bottom-bar tab.
**That is word for word the rule that took «الدليل» and «السوق» out of the
same list at V.02.7.** The route, the screen and the Home tile are all
untouched — what left is a row in a menu, not a destination.

```
              with tiles   after the row left
visitor · الأقسام   231    →    181
member  · الأقسام   156    →    106
folded              0      →      0
```

- ⚠️ **The ceiling in `v20` lands at 191 — lower than the 205 this batch
  started from, and the first fall in five raises.**
- ⚠️ **And a sentence repeated for four batches was measured and is
  false**: «one row removed fixes every measurement at once». A leaf is
  50px and the visitor was 231 over — it takes **five**. It was true when
  written at V.03.2 and nobody re-measured it for four batches. That is
  exactly the stale-number fault this file hunts in the tests, committed
  in the file's own prose.
- ⚠️ **What is true, and is why the ceiling is a watchdog and not an
  alarm:** `.drawer-panel` is `overflow-y: auto` and scrolls the whole
  way — dragged to its end, `scrollTop` reaches 231 of a 231 maximum and
  the version line's bottom lands exactly on 844. **No row is ever out of
  reach.** The promise that matters — folded, it does not scroll — is **0
  for both roles in both themes.**

### Five checks, and every one of them moved rather than died
⚠️ **A destination that leaves a screen must not take its check with it**,
or the destination itself disappears two batches later and nobody knows
when. So the check follows the destination, and a new one guards its
absence from where it left.

- **`v7` — the real red, and the rule was never broken.** «The gold is
  spent on one row» still holds to the letter; **what moved is where the
  gold sits** — it was the glyph's colour, and on a tiled row it is the
  tile's background with `--on-gold` ink on top. So a check counting gold
  SVGs returned **0 on a build that obeys the rule perfectly** (96/2). It
  counts by **row** now, reading the tile first and the bare glyph second,
  and **it knows both themes** where it knew only dark — a second gold in
  light would have passed unseen. Proven with teeth: giving «الإعدادات» a
  gold tile too returns **2 gold rows** and both items go red.
- **`v7`'s other three** — the leaf counter (seven → six) and the label in
  both languages — were **replaced, not deleted**: the count stays a number
  so a leaf added without a decision turns it red, and «كل الأقسام» stays
  in the check because it is the old wording that must not return through
  the Home tile either. **98 items before and after.**
- **`v5` and `v4`** lose `#/categories` from their drawer lists and each
  gain an assertion that it is **absent** from the drawer — while `v3`
  (which taps the Home tile and lands on `#/categories`) and `v16 · 5.10`
  are untouched and are now the destination's real guards.
- **Proven in reverse**: putting the row back makes **five items in three
  suites** go red — `v7` 95/3, `v5` 133/1, `v4` 102/1.

⚠️ **And the count closes itself: 5,194, the same as V.06.1.** `v4` +1 and
`v5` −1 per build, `v7` and `v20` unchanged in number. Nothing was lost and
nothing entered quietly.

⚠️ **Two of the five reds were found by the full net alone.** Running only
the suites this batch touched would have reported green while three items
in two suites it never considered were broken — the third batch in a row
to prove the same rule.

## V.06.3 — the checklist says every condition, and a refusal reads as one

### Rai found it, and the app was right
He opened `#/admin` on his phone to set the panel's password, typed one,
pressed the button — **and nothing happened**. «لوحة الادمن ما بتفتح.»

Reproduced exactly, before touching anything:

```
8 chars ✓   upper ✓   lower ✓   digit ✓   symbol ✓   not common ✗
pressed: no navigation, no visible message, the screen unchanged
```

**And the refusal was correct.** The word he typed is, to the letter, the
one that used to sit inside `store.js` — downloaded by every browser that
opened the app, and still in the repository's history. `PW_BRAND` refused
it, which is exactly its job.

⚠️ **What was broken is that the refusal did not read as a refusal.**

### Half one: the checklist was lying
`passwordChecks` returns **six** conditions the submit refuses on.
`PW_ROWS` — the list the reader watches — held **five**. `common` was not
in it.

⚠️ **So the reader watches five ticks go green, reads «done», presses, and
nothing happens.** The sixth rule refuses from a place they cannot see.

**A list showing SOME of the conditions is worse than no list at all**:
with no list a reader looks for the message; with a partial one they trust
it, and it is lying. `pwReqNotCommon` is the new string and it **names what
the rule actually does** — common words, the app's own name, and the
cities — because somebody refused has to know *why*, not guess.

### Half two: the message did not look like a message
`wirePasswordField` writes the reason into `#e_aNew`, and that box was
written `<div id="e_aNew"></div>` — **with no `class="field-err"`**.
Measured: `rgb(12,20,36)` at **17px**, the body's own ink and size, so the
sentence sat among the grey hints around it and read as advice.

- **Every other screen had it right** — `auth.js` in five places,
  `profile.js`, and `admin.js`'s *other* password field. That one box was
  the exception.
- ⚠️ **And searching rather than guessing found three more**: `e_pTitle`,
  `e_pPrice` and `e_pDesc` in `js/screens/marketplace.js` — **the post-a-
  listing form**. A seller refused could have read the reason in black ink
  among the hints.
- **No CSS was added.** `.field-err` and `.field-err:empty { display:none }`
  have been in `app.css` for a long time; those four boxes were simply
  outside them.

**Measured after: `rgb(176,42,46)` at 12.75px, the empty box still not
drawn, six rows with the sixth unticked — and a password that passes all
six opens the panel.**

### The check that should have caught this had a number typed into it
⚠️ **This is the most important thing in the batch.** `v27 · 4.4` read:

```js
ok('4.4 five conditions, listed from the start', … .count() === 5);
```

**The `5` was typed in the test.** So when `common` was added to
`passwordChecks`, the list kept showing five and **the check stayed
green** — it counted five and found five. *The guard did not catch the
fault it exists to catch.*

The count is now **read from the rules themselves**, so adding a rule
without adding a row turns the line red. `latin` is excluded on purpose:
it is a hint above the list, not a row, and `4.5` says so — and that
item's name was corrected too, because «not a sixth row» became misleading
the moment a sixth row existed.

⚠️ **Proven with teeth**: a seventh condition added to `passwordChecks`
with no row produced **`98 passed, 2 failed`**, both items reading
`-> 6 rows for 7 conditions`. That is precisely the check that was missing
the day the sixth rule went in.

**And `v18`'s stale comment, a debt from V.06.0, is paid**: it said the
theme is set «rather than by importing ui.js» while the code beneath it
imported `ui.js`. The warning is **rewritten, not deleted** — the danger it
describes (a second copy of the module on the single-file build) is still
real and is still why the import is written `arabna/js/…`. What expired was
the method, not the reason.

**84 runs · 5,194 assertions · zero red · zero crash** — unchanged, because
`v27` reworded two items and added none. `chk_i18n` goes 1753 → **1754**:
one new key, intended and measured.

## V.06.4 — what survived `esc()` executed, and a refusal with no reason

### The hole needed no panel, and the file it was reported in was the wrong one
Measured before a line was changed. An ordinary member — **no staff access,
no permission of any kind** — saves a marketplace listing whose title
**somebody else wrote**, and opens «المفضّلة»:

```
index.html              the node entered the page · the code did NOT run
index-single-file.html  the node entered the page · window.__pwn === 1
```

- ⚠️ **The single-file build is the one that decides**, and this file
  already says why: it runs under `script-src 'self' 'unsafe-inline' data:
  blob:` — the condition of that build existing, not a choice — so there is
  **no second layer in it. Whatever escapes `esc()` executes.**
- ⚠️ **The spec called this «the widest of what remains» and then filed it
  under «admin panel fixes».** It is not an admin fault at all: the panel is
  one door into it, and the one that needs no account is «المفضّلة».
- ⚠️ **And the line seventy rows above it in the same file writes
  `esc(L(c.title))` correctly.** «إعلاناتي» escapes and its neighbour
  «المفضّلة» does not — the rule applied on one screen and forgotten on the
  next, which is exactly why V.03.6's pass fixing «the four reported
  places» was not enough. **`js/screens/admin.js` is not closed until every
  `${` in it has been read**, and this batch read them.

**Twenty-six places were named and ten more were found by reading the
rest**, all of them carrying user or external text:

```
named   profile.js  5   ·  admin.js 19  ·  advertise.js 2 (inside an attribute)
found   a photo URL inside src="…"        4 in admin.js + 1 in profile.js
        the reported item's own title     the waiting-list date the buyer typed
        the verification provider's ref
        five importer values straight out of the pasted CSV
```

⚠️ **A photo URL sits inside `src="…"`**, so a value carrying a quote closes
the attribute — V.03.6 wrapped the others and missed these five.
⚠️ **And `esc()` escapes the apostrophe too**, so it is right inside either
kind of quote — which is what the two `value="${…}"` fields in
`advertise.js` needed.

### A refusal with no reason, and an action with no question
The panel's own rule, written since V.02.9: *both outcomes ask for a
reason, an empty one is refused, and the reason reaches its owner
verbatim.* The marketplace tab obeyed it. Five other places did not.

- **`rejectAd(id, '')` — with the empty string written into the code.**
  Measured: a $149 order refused with no sheet, no question, and a
  notification containing no word of explanation. **And that buyer paid.**
- **`rejectPendingBusiness(id, '')`** the same.
- **Refusing a report** called `rejectClassified(f.refId)` **with no reason
  argument at all**, taking somebody's listing down on the strength of a
  report that may itself be malicious.
- **`rejectAvatar()` and `rejectBizPhoto()`** — the first sent a general
  line, and **the second sent nothing whatsoever**: the photo simply
  vanished from the owner's page, which reads as the app losing the picture
  rather than refusing it. Both take a reason now, and both notify.
- **Deleting an event fired on the first tap** while its sibling — deleting
  a business — has named the record in a confirmation since V.02.9.

### The most dangerous action in the panel was the only one that did not ask
`mergeBusinesses(keep, drop)` moves reviews, favourites, ownership and tags
and then **deletes the other record, with no undo.** The manual form has
always confirmed; the two buttons did not.

⚠️ **And the sweep's button is the worse of the two**: its results include
`likely` and `weak` — matches that are **not certain by design** — and each
one sat beside a button that merged on the first tap. `confirmMerge` is
written once and both call it. ⚠️ **It takes the repaint as an argument**,
because `paint` lives inside `AdminScreen` and a module-level helper cannot
see it.

### The panel had no lock, and its password did not guard itself
`setAdminUnlocked(false)` **appeared nowhere in `js/`.** The documented
answer — «a reload asks again» — is true and beside the point: the app
ships a manifest and is **installed**, so it is not reloaded in practice
and the panel stayed open for the session. And `adminUnlocked()` is what
permits editing **any** listing, so this was never a question about a
screen.

- ⚠️ **The lock clears BOTH**: `unlocked` is a module variable in
  `admin.js` and `adminSession` lives in `store.js`. Clearing one leaves
  the other holding a door open.
- ⚠️ **A button, never a timer.** A lock that falls on its own halfway
  through a queue is a nuisance people work around.
- **The change-password form read the new password and its confirmation and
  not the current one**, so anybody reaching an open panel could replace it
  in silence and lock its owner out. It goes through `checkAdmin` now, and
  a wrong current password says so under its own field.

### 514 in one `<select>`, on a 390px screen
The same wall the directory tab hit, and the sentence written there applies
word for word. **The difference is that a mistake here costs money**: a
receipt issued against the wrong shop, and **a receipt is never edited
after issue** — correcting it means a second receipt with a negative
amount. It reuses `adminSearchBusinesses`, so the two cannot drift.

⚠️ **The options are filtered IN PLACE rather than by repainting the tab**:
the operator has already typed an amount, a name and a reference into the
same form, and a repaint on every keystroke would wipe them.

### Three controls were cut, not scrolled to
Measured at 390px, and the correction matters more than the numbers:

```
settings · ar   #ramEid starts at left −19        page scrollWidth 390
settings · en   #ramEid ends at right 409         page scrollWidth 390
events   · en   two .mini-btn end at right 397    page scrollWidth 390
```

⚠️ **The page does not scroll horizontally**, so the part past the edge
**cannot be reached at all** — this is clipping, not overflow, which makes
it heavier rather than lighter. The two date fields stack under 400px
(`stack-narrow`, opt-in, so no other `.action-grid` moves) and the event
buttons wrap. After: nothing outside 0–390 in either language.

### The number the state file carried was wrong
```
everyBusiness()   514      needsGeoList()   514      with lat/lng   0
```
`docs/الحالة.md` said «480 of 514, and the 34 that have them are the
development seeds». **The 34 are ZIP centres and city points in
`js/data.js`, not businesses** — counted, not assumed. The panel was
honest; the document was not, and **the document is the one read first in
every session.** The filter that would narrow nothing is **hidden, never
deleted**: the day the two numbers part it returns by itself.

### And the log answers more than «who changed my phone number?»
`state.adminLog` recorded field edits and nothing else, so «who deleted the
event?» and «who merged the two shops?» had no answer — the same question
it exists for. `logAdminAction` writes **one line per action into the same
log**, same shape, `field` carrying the action's name. ⚠️ **Written in
`store.js` and not in the panel**, for the V.03.3 reason: a record kept by
a screen is missing the moment anything that is not that screen does the
same thing. Approve, reject, delete, merge, the cash order and the demo
purge all leave a line.

### `test_v45` — 35 assertions, and each proven in both directions
Putting **one** `esc` back and taking **one** merge confirmation out turned
**four items red** and made CSP itself log the refusal on the module build.
The suite is in `run.sh`.

**And the full net caught what the batch's own suite could not**: `v3`
**crashed on both builds** — it taps `data-evdel` and then asserts the
event is gone, and this batch put a confirmation in the way, whose scrim
then swallowed the click on the settings tab six lines later. So the crash
surfaced as a TimeoutError on a line that had nothing to do with it. Its
sibling assertion — the password change — needed the current password for
the same reason. **Both were updated with a comment naming the reversal and
neither was softened**: `v3` went **116 → 117**, gaining an assertion that
the confirmation is there and names the event.

```
86 runs · 43 suites · 5,266 assertions · zero red · zero crash
```

⚠️ **The arithmetic: 5,194 + 70 (`v45` × 2) + 2 (`v3` × 2).**

## V.06.5 — the second wave, and the sweep that should have run the first time

⚠️ **This is `307`'s completion, and the reason it was needed is my own
mistake, written here rather than smoothed over.** `307` came from a
session auditing the **admin panel**, so its sweep stopped at that panel;
I widened it to `js/screens/profile.js` and stopped there too. **The sweep
had to cover `js/` entirely, and it did not.** So `ui.js` and
`directory.js` went on printing fields a human types.

### Three, and every one of them executed
Measured on the running app before a line was changed, and all three
**ran** on the single-file build:

```
the advertiser's slide   #/marketplace   node YES · CODE RAN
a reviewer's name        a shop's page   node YES · CODE RAN
a shop's phone           a shop's page   node YES · CODE RAN
```

- **The slide is the worst of them.** It stands above Home and above every
  section — the most-seen surface in the app — and its three fields are
  **the buyer's own words, typed into `#/advertise`.** ⚠️ **The link and
  the colour on the line above were already escaped**, so the rule was
  applied to two fields of one element and missed on three.
- ⚠️ **`adShareBtn(L(a.name), a.link)` on the next line is correctly left
  alone** — it escapes both arguments itself. **It was read before it was
  touched**, which is what the spec asked for.
- **The reviewer's name is today this device's own**, so the harm is small
  now — and the day the server lands it is **somebody else's name printed
  on your screen**, the same family exactly. A line is not deferred
  because its damage is. ⚠️ **The review's own text below it was already
  escaped**: the field somebody noticed and the field nobody did, in one
  card.
- **The initial in the avatar is escaped too.** One character carries no
  attack — but leaving one of four out makes the rule an exception, and an
  exception is what gets forgotten.

### And four more the file itself had cleared
The spec listed seven places and named `prayer.js`, `mass.js`, `home.js`
and the rest as clean. **Sweeping `js/` for every field a human types
turned up four it had passed over:**

- ⚠️ **A MOSQUE'S NAME on `#/prayer`** — and since V.04.0 **a stranger can
  add a mosque through the door on that very screen.** The one place in
  the app where an unknown person's text and a screen nobody may advertise
  on meet.
- **`cityOf(biz)` in `distLabelHtml`** — the city parsed out of a business
  address, printed on every distance line in the app.
- **The «similar businesses» sheet** — the same name and address as the
  rows above it, escaped there and not here.
- ⚠️ **`toast()` builds its body with `innerHTML`, and `home.js` feeds it
  the city that comes back from the REVERSE-GEOCODER** — somebody else's
  server, which V.03.6 names as the same category of trust as a user's own
  typing. Escaped at the two call sites, where the untrusted value is,
  rather than inside `toast`, whose every other caller passes `t()`.

**`mass.js` really is clean** — its feast names come from `t()`. So does
`sponsoredRows` in `ui.js`, which escapes correctly and was not touched;
the comment above it says an unescaped field in a row printing people's
names is the same hole six months later by our own hand, **and the slide
below it in the same file was exactly that.**

### The suite grew rather than a new one appearing
`test_v45` goes **35 → 44**, since `308`'s own instruction is to extend it
while it is open. ⚠️ **Teeth proven again**: undoing the slide title's
`esc` and the mosque name's turned **their own two items red** and made
CSP log the refusal on the module build — each item fails for its own
reason, not as a group.

### The net, run once for the group
```
86 runs · 43 suites · 5,284 assertions · zero red · zero crash
```
⚠️ **The arithmetic: 5,266 + 18 (`v45` × 2).** Nothing else moved, which is
what an escaping pass should look like — it changes what is printed, not
what is counted.

### And the process rule Rai changed on 28 August
> **The full net is no longer run per batch — once at the end of a
> group.** The group here is **307 + 308**. The guarantee is unchanged and
> the sentence moved: «a batch is not finished when its own suite is
> green» is now **«a GROUP is not finished when its suites are green»**,
> paid once instead of four times. A red at the end is attributed **by
> reading** which batch touched which file — each batch names its files at
> its head — never by guessing.

## V.06.6 — the account section, and a sign-out that cleared nothing

### `225` came back through a second door
```js
export const state = Object.assign({}, DEFAULTS, load() || {});
```
`Object.assign` copies **references**. So on a device with nothing saved
yet — **the first session of every new user** — `state.saved` **is**
`DEFAULTS.saved`, and the first `push` writes into the defaults
themselves. `signOut` then does exactly the right thing with
`JSON.parse(JSON.stringify(DEFAULTS))`: **a deep copy of defaults that are
no longer default.**

Measured in the browser with no reload at all:

```
before signOut   saved 2 · reviews 1 · messages 1 · readNotifs 1
after  signOut   saved 2 · reviews 1 · messages 1 · readNotifs 1
on disk          saved 2 · reviews 1 · messages 1
tier()           0        ← so the app LOOKS signed out
```

**The next visitor on that phone opens «المفضّلة» and finds two shops** —
the exact leak V.05.2 was written to close.

- ⚠️ **It disappears after one reload**, because `load()` returns fresh
  objects from `JSON.parse`. **That is why no suite ever saw it**: every
  suite seeds `localStorage` and reloads, which is the one path that hides
  it. So `test_v46` drives the app through its own `signUp` in a single
  session and never seeds a signed-in state.
- ⚠️ **And the surviving keys were not random**, which is what made it
  invisible: what is edited **in place** survived (`saved`, `reviews`,
  `messages`, `readNotifs`, `notifPrefs`) and what is **reassigned** was
  cleared. Signing out looked like it half-worked, not like a bug.
- ⚠️ **The comment above `signOut` describes this danger word for word** —
  «without it the state's arrays ARE `DEFAULTS`'s arrays» — and then guards
  the reset alone, while the poisoning happens earlier, at construction.
- **It is fixed at the construction, not in `signOut`.** Patching the reset
  would leave `deleteAccount` and every restore written after today exposed
  to the same thing. `DEFAULTS` is pure data, so the JSON round-trip is
  correct and is **the same one `signOut` already uses — one pattern, not
  two.**

### Deleting an account cleared LESS than signing out of one
`signOut` was rebuilt in V.05.2 around a list of what **stays**, so every
key added afterwards is cleared by default. `deleteAccount` still named
what it cleared, one by one, and fell behind:

```
cardOnFile      survived a DELETION while an ordinary sign-out removes it
hiddenListings · notifPrefs · readNotifs · pendingVerify   all survived
```

⚠️ **The card is the heavy one** — the privacy page promises deletion in so
many words. It calls `signOut()` itself now rather than a copy of it, and
**the order is binding**: `receipts` are in the keep-list, so the reset
leaves them and the identity is stripped **after** it. Reversed, the names
come back. **The receipts are still never deleted** — separating the person
from the transaction, not erasing that money was taken.

### Six rows, six widths
`.list-row` carries no `width`. Everywhere else it is a `<div>` and fills
its parent; in the account hub it is a **button**, correctly, because it is
an action — and a flex button sizes to its **content**:

```
222 · 158 · 164 · 157 · 163 · 168      inside a parent of 390
```

**One line — `button.list-row { width: 100% }` — and all six are 362.**
⚠️ **The button stays a button**, for the screen reader and for the
keyboard pass; the fault was in the style, not the tag. And the rule covers
every `button.list-row` written from here on, **not the six that exist
today** — a class, not an incident.

### A typo in an email address waited for ever
`updateProfile` wrote `pendingEmail` and **never cleared it in any case**,
while `cancelEmailChange` had existed since V.05.7 with **nothing in the
project calling it** — measured across `js/`: zero.

```
a@b.com → saved typo@b.com   →  pending = typo@b.com
then a@b.com typed back      →  pending = typo@b.com   ← unchanged
```

⚠️ **And this is not stale text.** Any later visit to the code screen with
the right code calls `confirmEmail()` and **moves the account onto the
wrong address.** Retyping the old one now cancels it, and a button in the
edit screen does it explicitly — **drawn on the same condition as the line
above it**, so the two can never disagree. `confirmEmail` is untouched: the
promotion living there alone is the guard.

### The edit screen accepted what sign-up refuses
Sign-up runs `validName` and `validEmail`; the edit screen checked only for
emptiness. **Measured by typing and saving:** «123» saved, «not-an-email»
saved — and the screen then said «we sent a code to not-an-email». The same
two functions now run there, **with the message under its own field** as in
sign-up, never a toast. **No new string**: the three were already there.

### Six more, each small and each measured
- **An empty name took the whole screen down** — `u.name[0].toUpperCase()`
  threw and **nothing rendered at all**. Reachable today, not in theory.
  ⚠️ `[0]` is right here and is **not** `Intl.Segmenter`'s case: this is one
  character being *displayed*, while V.05.9's lesson was about *storing* a
  whole emoji.
- **Your own number was printed raw while every shop's is formatted** —
  `7135550123` against `(713) 555-0142`, and the form asks for
  `(713) 000-0000`, demanding a shape it would not then show. Formatted for
  **display only**; `samePhone` and `phoneTail` still see what was typed.
- **The subscription row always went to the sales page** while Settings
  branched correctly. `ACCOUNT_LINKS` accepts a **function or a string**
  now, and `subscriptionRoute()` in `store.js` is the **one** definition
  both screens read. The cost was one extra tap, not a dead end — the sales
  page already recognises a subscriber.
- **The phone hint announced an event that had not happened**, drawn before
  the field was touched. It is a rule now; `phoneChangedReverify` stays for
  the toast after a save, where it is true.
- **«حذف الحساب» promised a review that does not happen** — measured:
  deletion is immediate. **The text is corrected and the review is not
  added**: immediate deletion is what the app stores require.
- **`.err-msg` is `display:flex; gap:5px`**, so a bare text node and a tag
  beside it became two flex items five pixels apart: «ينتهي بـ 123» where
  the ـ means the two touch. ⚠️ **A class, not an incident** — the template
  would have taken apart any tag put in an `.err-msg` in future.
- **A card could be added and never removed**, and until this batch it
  survived deleting the account. One box that changes its action with the
  state, not two buttons.
- **Three selectors searched the whole page** rather than `root`. ⚠️ **And
  the reason the source file gave is wrong, corrected here**: it claimed
  another `data-share` was mounted at the root. Searched `js/`: `data-share`
  exists **only in this file**. So the item is right as hygiene against a
  future collision, **not as a fault today** — and no reason is written that
  was not measured.

### Item 6 is not in this batch, by its own instruction
The sign-in screen calls `signUp()` with any address typed and then
`confirmEmail()` at once, so **any password — including an empty one — signs
somebody in**, and an existing account's name, verified number and tier are
replaced without a word. `checkUserPassword()` exists in `store.js` and
nothing calls it there. **The file says explicitly that no line is written
for this before Rai's word, and the rest lands without it.** Recorded in
`docs/الحالة.md` rather than left to be rediscovered.

### `test_v46` — 31 assertions, and the teeth are the point
⚠️ Undoing **the deep copy** and **the one CSS line** turned **six items
red**, and the widths came back as **222 · 158 · 164 · 157 · 163 · 168** —
the same six numbers the file measured, reproduced independently.

⚠️ **And the full net is not run here.** Rai's rule of 28 August: once at
the end of a group, and this group is **315 · 325 · 326**. What ran is the
suites this batch touches, on both builds.

## V.06.7 — the account hub says what it holds

Six frozen names, and **every number that would make them useful already
sitting in `store.js` unread.** So this batch connects what was built far
more than it builds.

### «طلباتي» — the queue nobody read
⚠️ **A whole hole, not a missing subtitle.** Somebody who pressed «هذا
نشاطي» raised a record into the admin queue and then **saw nothing**: no
row, no status, not even an acknowledgement that it was sent. The
notification when the decision lands is the only word there is, and a
missed notification is the whole story missed.

**Measured before the batch: `state.claims` and `approvedClaims()` appear
in `js/screens/` exactly ZERO times.** The data was kept and no screen ever
read it.

- **No new queue and no new admin screen** — this is a **reading** of the
  one that exists. The verification badge joins it, so a person looks in
  one place for both requests.
- **The admin's written reason reaches the reader verbatim**, never
  reworded. ⚠️ It is `307` that made a refusal ask for a reason at all;
  before that this screen would have shown empty ones — which is why the
  order of the two batches mattered.
- An **approved** request opens the page it won.

### The rows carry their state
```
نشاطي التجاري   مطعم الشام · مشترك
رسائلي          محادثتان
طلباتي          1 بانتظار الموافقة
الاشتراك        يتجدّد 12 سبتمبر 2026
الإشعارات       2
```
- ⚠️ **Zero is never printed.** «0 رسالة» is noise in a row this narrow and
  **its absence is the signal** — the rule that took the buyers' button off
  a listing with no messages. Measured: a fresh account's receipts row
  carries no subtitle at all.
- ⚠️ **The messages row counts CONVERSATIONS, not «unread».** A message
  record carries **no read state** — measured, there is no such field — and
  a count the app does not have is a number invented on a screen. The file
  asked for unread; the model cannot answer it, and inventing one would be
  the worse reading of the instruction.
- **«محادثتان» is the Arabic dual**, through the existing `arCount`.
- ⚠️ **And the subtitle is built in the SCREEN, not the store.** It needs
  `L()` for a name and `fmtDate()` for a date, and `store.js` must not
  import `i18n` or `ui` — the arrow has pointed one way since V.02.1. So
  `ACCOUNT_LINKS` stays data and the screen renders it.

### Three doors in, three rows out
**In**: notifications, receipts and blocked — all three belong to the
account, and two were buried inside Settings. ⚠️ **Nothing is moved**: the
drawer's notifications row is the fast path and keeps its badge, and the
rule forbids a screen that reprints an existing list, not two doors to one
destination.

**Out**: «إعلاناتي», «المفضّلة» and «تقييماتي» — ⚠️ **they are the three
counters at the top of the very same screen, ten lines above**, so the
reader met them twice. **The counters stay and the rows go: a counter
carries a number and a row carries nothing, and the number is what makes
tapping a decision.**

**Seven rows, and the count was measured rather than argued**: at 390×844
the screen is 1,716px on a new account and 1,556 once the setup steps are
done. **It scrolls, which is what this screen is for** — «حسابي» is not
the drawer and is not held to the drawer's never-scrolls rule.

### «كمّل حسابك» — three steps where there was one
```
وثّق رقمك · حطّ صورتك · سجّل نشاطك
```
⚠️ **Not decoration.** The verified number is the gate on **everything that
earns**: posting, contacting a seller, claiming a business, buying any
advertisement. **Somebody who reaches tier 2 is the only possible customer
there is**, so the step is named rather than left to be discovered.

- **No badges, no points, no progress ring** — a standing decision.
- **A finished step disappears** rather than standing struck through, and
  the whole block goes with the last of them. Measured: 3 → 2 → 0.

### `test_v47` — 27 assertions
⚠️ Printing a zero and putting **one** duplicated row back turns **three
items red**, each for its own reason. And `#/my-requests` joins **both** of
`v37`'s lists — the walk and the known-routes table — because a new screen
with no coverage is how a screen quietly breaks.

**And the touching suites caught one reversal**, which is what they are
for: `v46 · 6.1/6.2` read the **last** hub row to find the subscription,
and this batch reordered the hub, so the last row is «المحظورون» now. **The
check is right and its method was fragile** — it finds the row by its
**route** now, which is what it was ever about. A comment names the
reversal; nothing was softened, and `v46` is back to 31/31.

```
touching suites, both builds: 3 · 5 · 7 · 20 · 37 · 42 · 46 · 47 — all green
```

⚠️ **The full net is not run here** — Rai's rule of 28 August: once at the
end of a group, and this group is **315 · 325 · 326**.

## V.06.8 — the pending number, and a copy of your own data

### The typo locked itself in
Saving a new number wrote it **straight onto the account** and cleared
`phoneVerified` — dropping it out of tier 2. And `#/auth/phone` then
checked what you typed against the number **on file**. So somebody who
saved a typo **could not verify their real number**: to get back in they
had to retype the mistake.

⚠️ **That is narrower than it sounds, and therefore worse.** Tier 2 gates
posting, contacting a seller, claiming a business and buying any
advertisement — so one slip of a finger closed all four, and the way out
was the very thing they had got wrong.

**Rai's decision: the number is parked exactly as the address is.** Measured
after:

```
saved a typo   pending 7135559999 · phone still 7135550123 · verified · tier 2
typed the NEW  accepted — no mismatch   ← refused before this batch
the code       phone becomes the new one · verified · pending cleared
put the old back   the change cancels itself
emptied the field  phone '' · verified false · nothing left waiting
```

- ⚠️ **The promotion lives in `confirmPhone` and only there**, exactly as
  `confirmEmail`'s does — the one function never called without a correct
  code.
- ⚠️ **`phoneTail()` reads the PENDING number first.** Without it the
  mismatch message names the tail of the **old** number while the screen
  asks for the new one — contradicting itself, and it is the very message
  V.06.6 had just repaired.
- ⚠️ **Emptying the field is a removal, not a change waiting on a code.**
  There is nothing to verify, so dropping the mark is right.
- **And the guard in `auth.js` is the whole item.** Without that one line
  the parked number is decoration and the lock stays exactly where it was.

### `exportBackup()` is not a person's copy of their data
The privacy page promises the reader a copy **in so many words**, and there
was no button for it anywhere in the app.

⚠️ **And the function that exists is the wrong one.** `exportBackup()` dumps
the whole state — **and the whole state carries the admin panel's password
hash and salt and its action log.** Handing that out as somebody's personal
data publishes a credential.

- `exportMyData()` **names what it includes**, never what it excludes, so a
  key added to the state tomorrow is left out by default — the same shape
  as `KEEPS_ON_SIGN_OUT`, for the same reason. Measured: no `pwHash`, no
  `pwSalt`, no `adminAuth`, no `adminLog`.
- **A second button inside the delete sheet, above the delete**, because
  that is the last moment the data exists.

### A place held, never half a feature invented
«تسجيل الخروج من كلّ الأجهزة» is a row that does not press, with the reason
beside it. ⚠️ **A `<span>`, not a disabled `<a>`** — an anchor with no
`href` stays in the tab order and a screen reader still calls it a link,
promising what it cannot do. ⚠️ **And the words are READ, not hovered**:
`title` never appears on a phone, which is V.05.8's lesson. Nothing is
invented around it: no device list, no last-seen date.

### «Empty» was the one refusal that took a toast
Every other refusal on these screens puts a red line under its own field
and leaves it there; **empty** took a message that names no field and is
gone in under three seconds. ⚠️ **The difference was never importance — it
was place.** The empty phone and the two unticked boxes now say so where
they happened. **No new string**: `required` already existed, and `310`
had already given `field-err` to the other boxes.

### Two items write nothing, and that is the finding
- **The age question (item 7) is already built.** The `age18` box sits under
  the terms box on the sign-up screen and **is mandatory** — the button
  checks both. So nothing is written for it. ⚠️ **What was actually missing
  was only that its refusal could not be seen**, which is the item above.
- **The badge's search priority (item 9) is not written, and the reason is
  measured**: the ranking chain it would sit on is itself broken. `isPaid`
  is the **third** tiebreak, after city and after a decimal rating that
  practically never ties — so it is a dead condition; a new subscriber with
  no ratings yet sinks below every free listing that has one; `pinSponsored`
  lifts exactly **one** row however many have paid; and the day coordinates
  arrive the order becomes pure distance, with `isPaid` not in it at all.
  ⚠️ **So writing «verified above subscribed» on top of a chain where
  «subscribed» does not work would make both orderings decoration.** The
  chain is fixed once, with both in it, and that needs Rai's decision on
  the model first. **No promise is made that does not work** — the rule that
  turned «قريباً» into a readable line in V.05.8.

### `test_v48` — 28 assertions
⚠️ Undoing the parking and the pending-first guard turns **four items red**,
and `1.4` reads **`false / 1`**: the account out of tier 2 from a typo,
which is the fault in one line.

### And the group closes — the full net, run once for all three
```
92 runs · 46 suites · 5,456 assertions · zero red · zero crash
```
This is the first run under Rai's 28 August rule in its intended shape:
`315` and `325` ran their touching suites only, and the net ran **once**
at the end of **315 · 325 · 326** instead of three times. It grew from 43
suites to 46 across the group (`v46`, `v47`, `v48`) and from 5,284
assertions to 5,456.

## V.06.9 — whoever pays is on top, and among them the nearest first

⚠️ **This batch does not close its group.** The group is **`330` then
`335`**, and `335` is the closer — so the full net runs with that one, and
what ran here is the suites this batch touches. (`330` says so at its own
head, which is the rule Rai set on 29 August.)

### The chain did not deliver what it promised, and the four reasons were all in the code
Measured on V.06.3 — a search with four new subscribers and five rated free
listings put **three paid shops at 8, 9 and 10**, under five free ones and
under the upgrade card:

```
pinSponsored lifted exactly ONE row, however many had paid
isPaid was the THIRD tiebreak, behind a decimal rating that never ties
   — a dead condition
a new subscriber rated 0 sank below every free listing with any rating
and once coordinates arrive the order becomes pure DISTANCE with isPaid
   not in it at all — so a subscriber's place would get WORSE the day the
   data got BETTER
```

**Rai's decision changes the model, not a number in it**: two layers where
there was a chain.

```
layer one   every active subscription, ordered by distance
layer two   everything else, exactly as the existing logic builds it
```

- ⚠️ **A subscriber with no coordinates sinks INSIDE the layer, never out
  of it. They paid.** That is `byNearest`'s own rule — the unknown comes
  after the known and is never dropped.
- ⚠️ **Layer one applies inside the coverage only.** A reader in Dallas
  gets no Houston subscriber lifted for them: the money bought the readers
  of *this* region. That gate was `pinSponsored`'s and is carried over
  rather than lost with it.
- ⚠️ **The loose search is in the model now.** It was excluded from the
  ordering **and** from the lift together, so the promise broke in the
  widest kind of search there is. Layer one applies to it; its layer two
  stays unordered, as before.
- **`isPaid` is deleted from the end of the old chain** — the subscribers
  do not live in that list any more, and leaving it would suggest it does
  something.
- **`paidFirst` is one exported definition** so the suite reads it directly
  instead of re-implementing the ordering.

⚠️ **AND THE MEASUREMENT THAT HAS TO BE SAID BEFORE ANY OF IT: 0 of 514
listings have coordinates today.** So the «nearest» half computes nothing
yet and layer one falls entirely to its fallback — the reader's city, then
the rating. **That is correct and intended**; the decision completes itself
the day the coordinates batch (`160`) lands. The suite seeds coordinates to
prove the machinery works, and measured from a **shuffled** input it comes
back `3.45 · 6.91 · 17.27 · 27.64`.

### The sponsored strip above the directory is gone
It drew two rotated subscribers with a third lifted under them — and every
subscriber now leads the list anyway, so **all three were the same shops
twice on one screen**. ⚠️ The comment that used to sit beside it said
exactly that: «one advertiser three times on one screen reads as a bug».

- **`#sponRows` stays in events, the marketplace and the magazine** — their
  pools are different and none was touched.
- **`pinSponsored` is deleted, not left behind**: a dead export reads in
  every later session as though it works. And the imports it left behind —
  `sponsoredRows`, `historyKey`, `distText` — go with it. ⚠️ **The import
  line is read before anything new is asked for**, which is the lesson
  `307` paid for when `esc()` was requested in a file that did not import
  it.

### The mark stays, and that is a condition
Every row of layer one keeps its «إعلان مموّل» mark **and its full distance
line**. ⚠️ **The money buys the position, not the right to hide how far
away the shop is** — a directory that sells the top without saying so loses
trust worth more than the subscription.

**And a consequence said out loud**: in a category thick with subscribers
the whole first screen would be marked. Today there are **four subscribers
in the entire directory** (measured), so the effect is theoretical. If that
number grows, a cap on layer one is Rai's decision, not this batch's.

### The badge, and two decisions that could not both hold literally
«Verified above subscribed» was decided on the **old single list**, where
both lived in one order. In a two-layer model a subscriber is a layer
above, so the verified cannot precede them without dissolving the layer.

⚠️ **So verification is a tiebreak INSIDE each layer** — a verified shop
leads an unverified one *in its own situation*, and never jumps a layer.
**This is a reading of the two decisions together, not a new one**, and it
is written here so Rai can overturn this one item without the file being
rebuilt. **And paying still verifies nobody**: the badge follows review.

### `test_v49` — 19 assertions
⚠️ Reverting to the single-row lift turns **six items red**, and `2.1`
prints the old fault in one line: **`27.64 · 3.45 · 17.27 · 6.91`** — the
shuffled input straight through, unordered.

**Two older suites reversed, each rewritten with a comment naming it:**
`v21`'s band block moves to a section that still has a band and gains three
assertions about what the directory owes instead; ⚠️ **and `v21 · 4.5`'s
subject is gone rather than relaxed** — it asserted the single pin never
repeated a band row, and there is no band to repeat; the rule underneath
(no shop twice on one screen) is asserted **more strongly** now, over every
route on the screen rather than the one pinned row. `v40 · 2.6` points at
the marketplace, where a band still exists.

### And the eleven the touching suites found — every one attributed by reading
The nine suites this batch touches came back with **three red**, and none
of them was a fault in the app: each was an older assertion written against
the single-row model. **All of them were re-run and re-measured rather than
guessed at**, and each carries a comment naming its reversal.

| suite | asserted | now |
|---|---|---|
| v15 · 6.18 | «the reader's own city leads the list», reading every `.list-row` | ⚠️ **the subscription upsell IS a `.list-row`** — it is sized like a business row and carries the class. With one row lifted it sat at position 6 and fell outside the window **by luck**; with every subscriber lifted it moved into it, and «Katy» was asserted of a card that names no city. Listing rows only, which is what 6.24 and 6.36 already read |
| v15 · 6.36b | «anything above it is the one labelled ad» | everything above the first free listing is labelled **and nothing below it is** — the rule the count was standing in for |
| v15 · 6.39 | «only one place is sold at the top» | ⚠️ the batch's own decision, reversed: the labelled rows are **exactly** the paid ones (no free shop wears the badge, no paid shop leads without it) and they are **contiguous**, so the sold band has a bottom edge somebody can see. Proven: reverting to the single lift prints `badgeIsPaid:false` |
| v15 · 6.40 | the count is 1 | the count is **> 0** — 6.40 was always about the SCOPE, and 6.40b (nobody in Dallas) is the half with the teeth |
| v34 · 1.1–5.2 | `.spon .row-sub` on the directory | ⚠️ **the row Rai photographed still exists on the very screen he photographed** — only its class moved, from a band row to a labelled result. The `.spon` reader stays for the marketplace, the magazine and events. **1.2, 1.4 and 2.1 were passing vacuously** on an empty list, which is worse than red |
| v21 · 4.7 | the band narrows to the chosen category — on a screen with no band | it returned `true` on an empty list and asserted nothing. **Every labelled row on `?cat=restaurants` must be a restaurant**, and an empty list is now a FAIL, never vacuous |
| v21 · 5.1 · 5.2 | the band's seed survives Back and rotates on a fresh visit | moved to the marketplace, and ⚠️ **four listings are boosted there first** — the seed file carries exactly **one**, so a pool of one could not rotate and 5.2 would have been red on inventory rather than on behaviour |
| v21 · 5.3 · 5.4 (new) | — | what the directory owes in the band's place: its paid rows come back **in the very same order**, and a fresh visit does not reshuffle them. ⚠️ Nothing rotates here any more — the order is arithmetic, so «Back gets the same order» stops being a seed that must survive and becomes a computation that must repeat, which is the stronger promise |

⚠️ **Two of the eleven were checks that PASSED while measuring nothing** —
`v21 · 4.7` and three of `v34`'s. A green that asserts an empty list is
worse than a red one, because it is trusted; both now fail on an empty
list by construction.

## V.07.0 — one tool for every occasion, and the date is the local one

⚠️ **This file CLOSES its group.** The group is `330` then `335`, and this
is the second — so the full net ran on both builds at the end of it, which
is Rai's rule of 28 August and the head-of-file rule of the 29th.

### It is a greeting, not «the Eid card»
Rai asked for a button that puts a card in front of whoever opens the app,
between two dates, «for any greeting». **So no occasion is named anywhere
in the code, and the suite asserts that too** — the moment a label says
«العيد», the Hijri new year needs a second tool, and Easter a third.

**Measured before a line was written: a search of `js/` for any greeting
returned zero.** No key, no screen, no text. The whole thing is new.

```js
greetings:     [ { id, title, body, from, to, cta, off } ]   // the panel's work
seenGreetings: [ 'g1' ]                                      // this device's trace
```

- ⚠️ **The two do not live in the same place.** `greetings` joins the
  operator's keys in `KEEPS_ON_SIGN_OUT`; `seenGreetings` does not, and is
  **not in `exportMyData`** — which needed no code, because that function
  names what it includes rather than what it excludes. **What a phone has
  already displayed is not a fact about the person holding it.**
- **Six rules, all in `store.js`**: once per device · the end date is
  binding, so nothing shows after `to` even to somebody who never saw it ·
  one live at a time, refused at the door · never two things in one launch ·
  no HTML in the text · previewed before it is published.

### The card cannot live in `#sheet`, and this was measured
The file asked for it to open inside `catchUp()`, before `render()`.
**`render()` calls `closeSheet()` as its very first act** — on the boot
paint as much as on any navigation — so the card would have been wiped
before anybody saw it. Proven by opening a sheet exactly where `catchUp()`
stands: present, then gone by the first paint.

- **It has its own root, `#greet`.** That also makes «is a sheet open» a
  clean question instead of the card having to know about itself.
- **It runs after `render()`, and is given the route the app is ABOUT to
  show** rather than reading `location.hash`: at boot the hash may still be
  empty and `firstRoute()` is the only thing that knows. The two boot paths
  became one `boot()` so there is one sequence and not two copies.
- ⚠️ **It is postponed, never cancelled.** If something else is standing
  there the greeting waits for the next launch — it ends by a date and
  nothing replaces it, so skipping it once costs nothing and skipping it
  for good costs the whole occasion.
- **And it does not open over the code screen.** `firstRoute()` returns
  `#/auth/email` for a sign-up stopped one step from finished, and a card
  over that costs somebody a step they were about to complete.
- **A visitor sees it exactly as a member does.** It is not an account
  feature.

### The day key is local, and `toISOString()` is the fault it avoids
That call returns UTC. A reader in Houston opening the app at **19:00 on
22 March reads 23 March there** — so a greeting whose last day is the 22nd
**vanishes five hours early**, and one starting on the 23rd appears five
hours before its day.

```
todayKey(ms)              2027-03-22      ← the local date
new Date(ms).toISOString()  2027-03-23      ← what the naive version says
```

- The comparison is then a **string** compare, which is correct because
  `YYYY-MM-DD` sorts in date order — and it is what keeps the whole
  question out of timezone arithmetic rather than solving it there.
- It reads **`now()` and not `Date.now()`**, so the panel's test clock
  winds the greetings forward with everything else that is dated.

### The card: a frame, type, and the mark
```
card 16.2rem · radius 22px · --surface · border --gold-wash-3
frame inset .5rem · radius 16px · 1px --gold-wash-3
title 1.42rem / 600 / 1.55   ·   body .79rem / 1.85 / --text-2
button full width · --gold on --on-gold
```
Measured at 390px: **275px**, which is 16.2rem at the app's 17px root.

- ⚠️ **No ornament, no ribbon, no medal** — and whoever adds one later is
  adding it to a design chosen for having none.
- **The name is the drawing, never the interface font.** The mark is what
  separates a card from عربنا from a card from any app. **No new image
  file**: `logoSrc('wide')` is the lockup already in the repository in both
  themes, which is what `080` had asked to be re-cut before those files
  existed.
- ⚠️ **`data-logo="wide"` is not decoration**: `applyTheme` rewrites the
  `src` of every image carrying it, so flipping the theme with the card
  open swaps this one too. Measured on both builds — and asserted as
  **different bytes**, not a filename, because the single-file build inlines
  every image as a data URI.

### The panel: stop is a switch, and copy is a minute's work
- ⚠️ **«نسخ» is not decoration.** Last year's wording is this year's
  wording and the difference is two dates, so next season's greeting is a
  minute's work rather than a rewrite.
- ⚠️ **Delete for what has not begun, stop for what has.** Deleting a live
  greeting throws its text away for nothing, and a typo everybody is
  seeing has to stop **now**, not on the day its window ends.
- ⚠️ **Stop/start is a SWITCH, not a button with a glyph.** The panel
  already says on/off that way, and there is no pause mark in `icons.js` —
  borrowing `x` for it would make the close mark mean two things, which is
  the collision `xMark` was renamed to avoid in V.06.1. **`copy` is a new
  icon** because `file` reads as «open», which is `eye`.
- **Every refusal under its own field** (`field-err`, from `310`), and the
  clash **names the greeting it collides with** — «تتقاطع مع أخرى» leaves
  the operator hunting a list for which one.
- ⚠️ **The preview is the real card**, drawn by the same function the
  launch draws: this is the one screen everybody sees exactly once, and
  there is no correcting it afterwards.
- Add, edit, delete, stop and start all leave a line in `adminLog` — and
  **the line is written before `save()`**, or it never reaches the disk.

### `test_v50` — 38 assertions, and both teeth proven
```
remove the seenGreetings condition   → 1.7 and 1.8 red
remove esc() from the card           → 6.2, 6.3 and 11.1 red (CSP logs the refusal)
```
⚠️ **And one of the failures was the harness, caught by measuring rather
than by reading:** `addInitScript` runs before **every** navigation, so
seeding unconditionally rewrote `seenGreetings` back to empty on the very
reload item 1.7 depends on — the suite would have reported the app failing
to remember while the harness was erasing the memory. It seeds once now.

## V.07.1 — five things Rai saw on his own phone

All five are interface, all five are local, and not one waits for the
server.

### The button did not grow with its label — and it is the CLASS
He saw «تعديل الملف الشخصي» standing outside its box on «حسابي». The
fault is not that button:

```
.btn    height: 52px    ← fixed
.btn-sm height: 40px    ← fixed
```

**A fixed height does not grow when the label wraps, so the text spills
out top AND bottom at once** — `align-items: center` splits the overflow
across both sides. Measured on `.btn-sm` at 177px wide: **the box stayed
40px with the text outside it, and became 92px once the height was free.**

- ⚠️ **The English screen is why it stayed hidden for so long.** «Edit
  profile» is short and fits; the Arabic is longer and falls out. **So
  shortening the word would have hidden the fault until the next long
  one** — the fix is `height: auto` + `min-height` on the class.
- ⚠️ **`align-items` is NOT touched.** Centring a single line is correct;
  the fault was the fixed height, never the centring. The vertical padding
  keeps a one-line button exactly as it was — measured, `.btn` 52 and
  `.btn-sm` 40, unchanged.
- ⚠️ **And `.btn` is on every screen in the app, which is why this batch
  runs the full net** rather than its own suites. A batch that touches
  every screen is not measured by the suites it happens to name.

### A long review ate the screen
An eight-line review filled the page and the two under it got one line
each that nobody scrolled to. Two lines, then «اقرأ المزيد» — measured
**48px clamped, 333px open**.

- **`-webkit-line-clamp: 2`**, which the project already uses on
  `.list-row.premium .row-title`, so no second truncation idiom is
  invented.
- ⚠️ **The button is drawn only when there is something to read**:
  `scrollHeight` is measured against `clientHeight` while the text is
  clamped, so a short review gets no button at all. **A button that opens
  two lines onto two lines is a small lie.**
- ⚠️ **The open/shut state lives on the page, not in `state`.** Whatever
  was opened stays open until the screen is left, and no storage key is
  added for something that belongs to one moment.
- It is mounted **after** the reviews are in the DOM: an unattached node
  measures zero, and every button would have been drawn.

### The eye meant three things, and one of them left
In `js/screens/profile.js` alone the same drawing carried «show the
password», «hide / republish a listing» and «open the page» — and only
the third was wrong: **an eye over a business reads as VIEWS.** Both wrong
ones were bare icons with no text and no `aria-label`, so a screen reader
said nothing about them at all.

```
«تقييماتي»   building + «صفحة المحل»
«إعلاناتي»   bag      + «افتح الإعلان»
```

- ⚠️ **They move down into the button row.** One button alone above the
  card and two below it read as two different groups, and they are actions
  on the same thing.
- ⚠️ **The hide/republish eye is correct and is not touched.** Two eyes in
  one row meaning two things was the fault, not the icon.
- **The whole row is deliberately not made tappable**: the card carries
  «حذف», and a large surface that opens something with a delete button
  inside it is a mis-tap waiting to happen.

### The tier leaves the drawer line, and nothing else
`«a@b.c · حساب مؤكد بالهاتف»` becomes `«a@b.c»`.

⚠️ **From the DRAWER only.** `S.tier()` is untouched — it is the gate on
posting, contacting a seller, claiming a business and buying any
advertisement. **What left is a line that was displayed, not a condition
that governs**, and the suite asserts `tier()` still answers 2.
`tierLabel` was computed for that one place, so its definition went with
it; the identical name on `#/profile` is that screen's own and stays.

### The arrow displaced the label — and it was two heads, not one
```
                        the tile ends   the label starts   the gap
an ordinary row              372              328            44
a group head                 372              294            78
```
The arrow sat **between the tile and the label**, so a head's text started
**34px further in**. And the answer is not one answer, because the two
heads do not behave alike:

- **«تصنيفات عربنا» stops folding.** Its contents are fixed and are what
  the drawer is for, so it is a **section title**, always open, with no
  arrow. ⚠️ **A non-focusable element, never a disabled button** — a
  button that does nothing stays in the tab order and is announced as a
  control, which is the rule already written for the rows waiting on the
  server.
- **«المساعدة والقوانين» keeps folding** and its arrow moves to the **end
  of the row**, where it displaces nothing. Five legal rows read once in a
  lifetime; opening them always adds a length nobody reads. **The
  difference between the two heads becomes honest: one is always open so
  it has no arrow, one folds so its arrow sits out of the way.**
- ⚠️ **`order: 1`, not a margin alone.** `.dr-item` is a flex row and the
  arrow precedes the label in the markup, so `margin-inline-start: auto`
  pushed the arrow **and everything after it** — measured, the label went
  to **228, further out than it started**. `order` moves the arrow to the
  end of the line and the auto margin then pins it there.
- ⚠️ **And the accordion needed a guard.** Its sweep walks every
  `.dr-group`, and the section is one with no `.dr-head` in it any more —
  without the guard, tapping «المساعدة» stripped the section's own `open`
  class and then threw on `null.setAttribute`, taking the drawer down.
- **`openGroup` is untouched**: it governs one group instead of two, and
  the logic is not rebuilt because the count of what it governs fell.

**Measured after — all three labels start in the same place**, in both
languages (Arabic 328, English 62), and the arrow is at the far end.

**And the drawer's height, measured rather than guessed** — the section
being always open is a real cost, and it is written here rather than
discovered later:

```
            folded (sections always open)    with «المساعدة» open too
member              974 / 844                        1224
visitor            1049 / 844                        1299
```

⚠️ **So the drawer now scrolls even folded**, which the never-scrolls rule
did not allow. `.drawer-panel` is `overflow-y: auto` and reaches its end,
so no row is out of reach — but the promise is spent, and **which row goes
is still the owner's decision, open since V.03.2**.

### `test_v51` — 41 assertions, and both teeth proven
```
put the fixed height back   → 1.1 and 1.2 red (the box stays 40 with the text outside)
put the eye back            → 3.1, 3.4 and 3.6 red (bare unlabelled icons)
```

### And a debt from V.07.0, paid here and named
`v28 · 2.3` asserts that **every rem in the stylesheet maps back to an
exact one-decimal px** — the invariant that made the V.03.5 px→rem
migration provable. The greeting card's `1.42rem` and `.79rem` came
straight out of the design table as rem and broke it. They are
**`1.41875rem` and `.7875rem`** now — 22.7/16 and 12.6/16 — and the
rendered difference is **0.02px**. Verified: 26 distinct rem values, none
failing the round trip, zero px font-sizes.

## V.07.2 — the sort the reader chose governs both layers

⚠️ **This file CLOSES the group `330` + `335`.** The group's net was red
at `v8` from the day `330` landed, and it does not close until the full
net is green on both builds with this in it.

### The hole was in `330`'s specification, not in what was built from it
`330 · 2` said the manual sort «governs layer two», and said nothing about
what it does INSIDE layer one — while `330 · 1` said layer one is ordered
by distance, without condition. **So layer one was ordered by distance
whatever the reader chose, exactly as written.**

Measured on V.07.0 with «مفتوح الآن» chosen:

```
the four subscribers   b1 open · b3 closed · b4 closed · b6 closed
open free listings     87 at the hour this was measured
```

⚠️ **AND THAT NUMBER IS NOT A CONSTANT — it is the hour it was taken in,
and this is the correction, not «176 → 87».** Measured across the day on
the same tree: **272 · 370 · 331 · 258 · 119** free-and-open at 10 · 14 ·
18 · 20 · 22, and **87 late in the evening**. The first figure written
here was 176, which was simply an earlier hour. **A number that moves
every hour becomes wrong the moment it is written down as a fact** — so
the range is written instead of a bare figure. ⚠️ **The argument does not
move with it:** three closed subscribers above 87 open shops is the same
argument as above 370.

**The three closed subscribers were lifted above 176 open shops**, and
`test_v8`'s «once a closed row appears, no open row may follow» fell at
the first row.

⚠️ **And it never reached the public.** All four subscribers are
`demo: true`, there are **zero non-demo subscribers**, and `paidFirst`
returns on its first line when nothing is paid. So the fault showed on
the owner's device with the demo data on, and in the suites — which is
why there was no rollback and the fix went forward in place.

### Two items of `336` could not both be true, and Rai chose
Its item 2 asked for «no open row after the first closed one, **in the
whole list**»; its item 3 asked for the closed subscribers to stand above
everything else. **With one open subscriber, three closed ones and 176
open free listings, item 3 puts a closed shop second with 176 open ones
beneath it — which is precisely what item 2 forbids.**

> **Rai's decision: with «مفتوح الآن» the openness is the primary key and
> the subscription is a tiebreak inside it.**

**Somebody who taps «مفتوح الآن» wants to go now, and a closed shop at the
top is no use to them whoever pays for it.**

- ⚠️ **The promise it costs is named, not hidden.** «A subscriber never
  falls below a free listing» becomes «never below a free listing **in the
  same situation**»: a closed subscriber leads every closed free listing
  and leads no open one. Measured — the first closed row in the list is a
  subscriber. **What the $29 bought — the top of the default view — is
  untouched, and the default is what almost every reader sees.**
- ⚠️ **«الأعلى تقييماً» and «الأقرب» get no buckets, deliberately.** Their
  keys are decimals that practically never tie, so a tiebreak would never
  fire and layer one would disappear — which is `336`'s items 4 and 5,
  both of which ask for the two layers to survive. One bucket is the plain
  partition; `groupOf` is what tells the two cases apart.

### A stable partition inside each bucket, never a second sorter
The list reaches `paidFirst` **already ordered by the reader's choice** —
`directory.js` did that — so `Map` keeps the buckets in the order they
were first met and `filter` keeps each half in the order it arrived.
**The reader's sort therefore applies inside both layers with no
comparison written twice.** A rule written twice has two versions two
batches later; that is `esc()`'s own lesson.

```
manual sort   → buckets (openness, or one bucket), paid first inside each
no manual sort → 330's rule, untouched: distance, then city → verified → rating
```

⚠️ **The default is not a choice, which is why the branches are not
merged.** Our rule governs when the reader has not chosen and theirs
governs when they have; one branch would mean either ignoring them always
or giving up our own rule always. **Measured, and this is the guard that
matters most:** `newest` returns `b3 b1 b4 b6 b2 b5 b7 b8 b9 b10` —
identical to V.07.0. *A fix that corrects a case few readers chose and
changes the one nobody chose is not a fix.*

### The first ten rows under «مفتوح الآن», measured
```
 1  b1   subscriber  open   [إعلان مموّل]
 2  b8   free        open
 3  b13  free        open
 4  b14  free        open
 5  b15  free        open
 6  b25  free        open
 7  b17  free        open
 8  b26  free        open
 9  b31  free        open
10  b32  free        open
```
All four subscribers keep their mark and their distance line. The closed
subscribers sit at the head of the closed group, above every closed free
listing.

### `test_v8` was not touched, and that was the condition
It is **129 passed, 0 failed**. ⚠️ **The easy «fix» here was to soften the
assertion until it accepted what the app did — and that is not a fix, it
is erasing the witness.** The item measured something real and fell
because it was right.

## V.07.3 — the eight reds were right, and the app was wrong

⚠️ **This is a correction of `345 · 5`, and the fault is in that file, not
in what was built from it.** It read:

> «تصنيفات عربنا» — Rai's decision: no arrow, its contents fixed.
> `becomes a section title, not a button · no arrow · rows always shown`

**Rai decided no such thing.** What he said was «take the arrow off, and
when somebody taps categories it opens». **The folding was never in
question; only the arrow was.** So it was built as written and the writing
was wrong.

### What it cost — measured
```
                                   before 345    after 345    now
the drawer folded, visitor          844 / 844    1049 / 844   844 / 844
…and with «المساعدة» open                   —    1299 / 844    1025
```
**The one rule the drawer had kept through every batch — «folded, it does
not scroll» — was gone**, and a visitor met a scrolling panel before
touching anything. ⚠️ **That is heavier than the eight red assertions
themselves, and it is exactly what `v4`, `v5` and `v20` were guarding.**

### And `345 · 5`'s own goal was already met without it
The complaint was that the arrow displaced a head's label by 34px.
Measured now, with the arrow gone from both heads and nothing else:

```
اللغة · الإعدادات · أعلن معنا     the label starts at 328
تصنيفات عربنا                    328
المساعدة والقوانين               328
```

**Taking the arrow out fixed the displacement on its own.** «Always open»
was never needed for it and cost the rule above.

### The correction
- **Both heads fold, both start folded, and neither carries an arrow.**
  They are identical in form and in behaviour — «ما بيصير اتنين بيعملوا
  نفس الإشي وشكلهم مختلف».
- ⚠️ **The arrow is removed from the MARKUP, never hidden with a CSS
  rule** — a stylesheet undoing what the template just asked for is two
  sources of truth. **And its own rules went with it**: leaving
  `.grp-arrow` styled is the same debt as a dead export, since read six
  months from now they say a fold indicator exists. `grep grp-arrow js/`
  returns nothing.
- ⚠️ **The head stays a `<button>` with `data-toggle` and
  `aria-expanded`.** It really folds, so it is a real control — reached by
  keyboard, announced as expanded or collapsed. **What was removed is a
  drawing, not a behaviour.**
- **`section()` is deleted, not left unused** — `group()` serves both, and
  a dead export reads months later as though it works.
- **The `!head` guard in the accordion sweep goes too**: its subject was
  the headless group, and that group is gone.

### Seven of the eight went green by themselves
```
v4 103/0 · v5 134/0 · v7 99/0 · v20 88/0 · v28 77/0
```
⚠️ **`v4`, `v5`, `v20` and `v28` are byte-identical to what they were
before `345`** — nothing was softened and nothing stayed softened. **The
eight reds were the net doing its job, and my first answer to them was to
soften five suites, which is erasing the witness.** They were reverted
wholesale.

**Only `v7`'s «the group arrow survives» changed**, and it carries a
comment naming the reversal: it guarded that the arrow is never deleted
without a decision behind it, and the decision landed. It now asserts the
inverse **with its teeth kept** — no head carries an arrow, *and* every
head is still a `<button>` that folds.

## V.07.4 — two sponsored rows, and the rest by distance

⚠️ **This file closes its own group, and its group is itself.** It touches
the ordering of the most-opened screen in the app, so the full net runs
with it.

### Rai's complaint, and the half of it that is a decision
> «Katy is nearer than Houston — it should show me the nearer one, not the
> further, even if it pays.»

**Measured from `CITY_POINTS` itself: Richmond → Katy 14.6 miles, Richmond
→ Houston 26.5.** ⚠️ **But the app could not have known it: 0 of 514
listings carry coordinates**, so what he saw was not «the further before
the nearer» by decision — it was file order, because there was nothing to
order by. That is file `160` in the queue and this batch does not touch
it.

**His second remark is the decision:** does a payer at 26 miles precede a
free shop at 14?

### From «every subscriber on top» to two rows
`330` gave layer one every active subscription. This bounds it:

```
the top two rows    sponsored · marked «إعلان مموّل»
from the third down the nearest first, with no exception —
                    nothing is lifted for having paid
```

⚠️ **Both promises hold together:** the paying shop gets a **guaranteed
place at the top of the screen**, and the reader gets an **honest
directory from the third row down**.

- **`AD_SLOTS.dirTop` in `js/data.js`, and nowhere else.** Two numbers in
  two files part company after two batches.
- ⚠️ **The rows are CUT FROM the list, not added above it.** A subscriber
  appears exactly once — showing it again in its place by distance is «one
  shop twice on one screen», which is what the comment that deleted the
  old band forbade in as many words. Measured: zero duplicates.

**And the measurement that made the decision free today:**
```
subscribers now:  restaurants 1 · doctors 1 · lawyers 1 · auto 1
```
⚠️ **One in each.** So «every subscriber on top» and «two rows» are
literally the same list right now, and the difference appears the day a
category fills — restaurants holds **138**. A decision taken now at no
cost, and paid for if deferred.

### Who gets the two rows when ten have paid
⚠️ **This is what makes the model fair to the payer or unfair to them.**
Ten restaurants subscribe and there are two rows — do eight pay to be
invisible?

- **`rotate()` fills them**, and it is the function that already existed
  and already served the sponsored band before `330` deleted it. A second
  rotation function would be a rule written twice.
- **It turns on the VISIT key**, not on plain randomness, so the rows do
  not move under the reader's finger and Back brings the same two.
  Measured: **five different pairs over six visits**, and identical
  within one visit and across Back.

### ⚠️ And the rotation turns INSIDE the reader's bucket, never across it
`336` decided the reader's own sort governs both layers, and that has to
survive here. Handing `rotate` every subscriber at once let it **wrap past
the open ones and give both rows to closed shops while an open one was
waiting** — measured, two visits in four before the fix. **That is the
complaint this whole thread began with, shrunk into two rows.** The
buckets are filled in the order the reader's sort left them, and the
rotation is fair within each. Measured after: the open subscriber holds a
row on **4 visits out of 4**.

### The first ten rows, from Richmond, sorted by distance
```
 1  b1   [مموّل] subscriber  26.5 mi
 2  b40          free        11.3
 3  b15          free        12.3
 4  b56          free        14.5
 5  b39          free        14.6
 6  b14          free        19.8
 7  b16          free        22.6
 8  b25          free        —
 9  b30          free        —
10  b31          free        —
```
One sold row, then pure distance, then the ungeocoded — never dropped,
only last. **Katy's 14.6 now leads Houston's 26.5 everywhere below the
band**, which is the item that opened the file.

### What the $29 is sold as
⚠️ **`subFeatures` turned out to be a dead key — nothing reads it**, so
editing it would have changed nothing on screen. The row the subscribe
page actually prints is `planRank`, and it read «أولوية في ترتيب نتائج
تصنيفك». It now reads **«مكان في الصفّين الأولين من تصنيفك»** with
**«بالتناوب بين المشتركين — فلا يحتكرها أحد»** under it.

**«الصفّان الأولان» without «بالتناوب» is «always first»**, which is not
what is delivered once a category holds more than two — and a promise sold
as something other than what is delivered is worse than not selling it.

### `test_v52` — 23 assertions, and both teeth proven
```
remove the bound (every subscriber again)  → 2.1 2.2 2.3 3.1 4.2 6.1 red
freeze the rotation                        → 6.1 red
```
⚠️ **And two of its own assertions were wrong first time and were
corrected, not softened.** `4.2` asserted that a payer never precedes a
nearer free shop *anywhere* — which is the opposite of the batch, since
the two top rows are exactly the place the $29 buys; it now measures what
is promised, that below the band distance decides and nothing else. And
`8.1`'s helper took an id while it was handed a record, so every
subscriber read as closed and the check measured nothing at all.

## V.07.5 — the directory works with no internet

⚠️ **The reason is not the store.** Somebody standing inside a supermarket
with no signal wants a grocer's number: **the app opens and all 514
listings are with them.** Google Play requires a service worker with a
fetch handler and there is no way in without one — **but nothing here was
built to please a reviewer; it is built to serve the reader.**

**Measured before a line was written:** no service worker at all, and
**with no internet the app did not open** — no error page, no line, the
browser's own screen. First load 1,892 KB in 25 requests.

### The precache list is computed, never written
`tools/build_sw.py` walks the files and emits `js/sw-manifest.js` with the
list and the version. ⚠️ **A hand-written list means a new module is added
and not precached — so the app works online and dies offline, and nobody
knows until a reader complains. That is `SUITES` in `395` to the letter.**

- It reads `index.html`, `styles/app.css`, **every module under `js/`**,
  `manifest.json`, and **the manifest's own icons read from the manifest**
  — ⚠️ **measured: it lists SEVEN, not the six the batch file said.**
  Deriving means the file decides.
- ⚠️ **The build aborts below twenty files**, and the floor is **written,
  not computed**: a pattern matching nothing would emit an empty array and
  produce a «service worker» that caches nothing and is taken for one. A
  threshold derived from the thing it guards always agrees with itself.
- ⚠️ **The version comes from `js/data.js`** and goes into the cache name,
  so **raising `APP_VERSION` is what invalidates the old cache** — one
  number, one place, no second copy to drift.
- **A classic script, not an ES module**: `sw.js` reaches it with
  `importScripts`, which every browser that runs a worker supports. A
  module worker is still uneven on Safari, and an app that will not
  install on an iPhone is no use to this community.

**Result: 33 files, 2,042 KB.**

### What stays out, and what it costs
```
precached   index.html · styles/app.css · every js module · manifest.json
            + the manifest's icons
never       assets/ — 4 MB in 22 files, logo.png alone 812 KB
never       index-single-file.html — 6.6 MB, a TEST build
```
⚠️ **Downloading 4 MB on somebody's mobile data before they ask is not
caching, it is an assault on the reader.** The rest of `assets/` is cached
**on first use**. Measured after: the first visit is **1,895 KB** — three
kilobytes heavier, and that is the worker's own registration.

### ⚠️ Three that never touch the cache
```
api.zippopotam.us · nominatim.openstreetmap.org · api.bigdatacloud.net
```
**A coordinate cached from yesterday is worse than no coordinate:** the
reader has moved and the app insists they are where they were. These are
**the same three written into `connect-src` in `vercel.json`** — read from
there, never listed twice.

### The update trap, which is what kills apps
A worker serving from the cache means a reader can sit on an old build for
ever, **and you cannot reach their phone.** And it is not solved by
`skipWaiting()` on install: **that swaps the modules while the reader is
inside a screen, so a new module is imported by an old build and it breaks
in front of them.**

> **The new version waits. One line — «في نسخة جديدة» — with a button, and
> only when the reader presses does it take over and reload.**

- **Shown with the existing `toast()`, extended with an optional action**
  rather than a second component to keep in sync. An actionable toast does
  not auto-dismiss — a prompt that vanishes in 2.4s cannot carry a tap.
- **Old caches are deleted on `activate`**, or a stale one sits on the
  reader's phone costing megabytes never used again.
- The reload waits for `controllerchange`, not for the message.

### ⚠️ https only — and that is what protects the net
A service worker is allowed on `localhost` exactly as on https, **and the
net runs fifty suites there.** Registered, it would live between suites
and serve stale files — **and a red from an old cache is worse than a real
red, because it does not reproduce and nobody can read it.** Google Play
requires https anyway and production is https, so the reader loses
nothing.

> ⚠️ **And the cost is said plainly: the net does not cover the service
> worker.** It is checked by hand on a Vercel preview with the network
> off, and the result goes in the closing line. **A test that does not run
> is said not to run; it is never claimed.**

**And `/sw.js` is served `no-cache`** in `vercel.json`: nothing stopped the
browser caching the worker itself, **and a cached worker means the update
never arrives, with no way to tell why.** The year-long `immutable` on
`assets/` is right for them and wrong for it.

⚠️ **And that entry broke every preview build for two commits, because I
wrote the sentence above INTO the file as a `"//"` key.** `vercel.json` is
validated against a schema before anything is built, and the schema refuses
an unknown property:

```
The `vercel.json` schema validation failed with the following message:
`headers[0]` should NOT have additional property `//`
```

**There were no build logs at all** — the deployment failed before the build
started — which is the signature of a configuration error rather than a code
one, and it is how this was found.

> **THE RULE: `vercel.json` is not a place to explain anything.** JSON has
> no comments, and the `"//"` convention that other tools tolerate is
> rejected here. The reason a header exists belongs in `CLAUDE.md` — this
> paragraph — and in the commit message; **never in the file itself.**

⚠️ **Nothing reached production.** The branch is what Vercel previews, and
`main` stood at the commit before it, deployed and READY the whole time —
which is the deploy rule working, not luck. And the net cannot catch this:
`test_v53 · 5.2` parses `vercel.json` and asserts the header, and an extra
key parses perfectly well. **It is Vercel's own schema that says no, and
the only place that answer appears is a deployment's `errorMessage`.**

### `test_v53` — 20 assertions, and both teeth proven
```
delete a module from the generated list → 1.1 red
make skipWaiting automatic on install   → 4.1 red
```
⚠️ **And 4.1 caught me first time round for the wrong reason:** it matched
the install block's own comment — «NO `skipWaiting()` HERE» — and reported
the fault it exists to prevent. **The comments are stripped before any
«does the code do X» check: a check must read the code, never the prose
about the code.**

**What this batch does NOT do:** the 1,895 KB and 25 requests of the first
load are another item. ⚠️ **A service worker makes the SECOND visit
lighter, not the first, and nothing else is claimed.**

## V.07.6 — «أضِفه إلى شاشتك»: an invite that knows where the reader stands

### Why this is not a polish item
Measured before a line was written: **zero** `beforeinstallprompt`, **zero**
`display-mode` detection, **zero** text anywhere inviting anybody to add the
app. The manifest was sound and the installed-app chrome has been built
since V.01.7 — **so the app accepted being installed and nothing ever told
the reader to install it.**

⚠️ **And on iOS a web app gets NO notifications until it is on the home
screen.** In a Safari tab the count is zero however the app is written.
Most of this community carries an iPhone, so adding the app is not
decoration — **it is the switch that turns the strongest feature on**, the
day the alerts land.

### The likeliest way in is the one way that cannot install
**Facebook and Instagram open links in their own in-app browser, and
«Add to Home Screen» does not exist there.** The commonest route into this
app — a tap on a link in a Facebook post — is the single route where
installing is impossible. ⚠️ **It is the same opponent as the directions
fault in `342`**, the iOS in-app browser, twice over.

So the screen detects it and says what to do: **«افتحه في Safari أوّلاً»
with a copy-link button, and NO add-to-home steps at all** — printing steps
that cannot work there is worse than printing nothing.

### «ثبّته بضغطة» exists on Android and is impossible on iOS
```
Android · Chrome    a real button — beforeinstallprompt opens the system dialog
iOS                 no API exists, and Apple publishes none on purpose
```
⚠️ **So a one-tap install button on an iPhone is a button that does nothing
when pressed, and it is not built.** The request is answered where it can
be answered and refused where it cannot — **and the community that needs it
most is the one where it is impossible.** That is said, not worked around:
what replaces it is the three numbered steps, the sentence «مرِّر للأسفل إن
لم تجده» on step two (the thing everyone asks about), and the Facebook route
solved first.

### Six roads, and the screen changes rather than disappearing
`installMode()` in the new `js/install.js` reads — never guesses:

| what is true | what is offered |
|---|---|
| already installed | **nothing at all, not one line** |
| iPhone · `APPSTORE_URL` set | «نزّله من App Store» |
| iPhone · in-app browser | «افتحه في Safari أوّلاً» + copy link |
| iPhone · real browser | the three Safari steps |
| Android · `PLAY_URL` set | «نزّله من Google Play» |
| Android · no link | the browser's own install dialog |
| a desktop | one honest line, and no steps |

⚠️ **It does not vanish the day the store opens — it CHANGES.** The web
version outlives the store and people keep arriving by link.

- **`PLAY_URL` and `APPSTORE_URL` are `SUPPORT_PHONE`'s pattern to the
  letter**, beside it in `js/store.js`: **empty until there is a real
  link**, and empty means fall back to the web road. One line on the day
  the store opens and the app changes by itself. ⚠️ **No store link is
  written before it exists** — a button opening a page the store does not
  have is worse than no button.
- **The iPad reports itself as a Mac** on iPadOS 13+, so `isIos()` also
  reads `MacIntel` + touch points. Without it every iPad reader falls
  through to «no road».
- **The in-app list is a list of NAMES, not a guess**: each token is one a
  product publishes in its own user-agent.

### Shown once, and a refusal is kept
```
first visit           nothing — somebody who arrived a minute ago is not installing anything
second launch         one line, once
or a shop's page      which is somebody using the app for what it is for
after that            only where it permanently lives
```
- **The line is not in Home's flow.** The fold there is measured and sold —
  the paid slider at 393px — so the strip sits above the bar in its own
  absolutely-placed root and moves nothing.
- **Marked shown when it is DRAWN, not when it is answered**: scrolling past
  it is being asked, and asking twice is the whole thing this avoids.
- **A greeting card wins the launch.** `boot()` runs the greeting first and
  calls the invite afterwards, so the reader meets one thing and never two.
- ⚠️ **The trace is in `KEEPS_ON_SIGN_OUT`** — which phone this is has
  nothing to do with who is signed in on it (V.04.8's rule).

### Its permanent home is Settings, and that is a deliberate divergence
The file says «صفحةٌ في حسابي». ⚠️ **`#/profile` for a visitor is a sign-up
screen**, so the only door there would hide the page from exactly the people
who need it — whoever has not signed up. It is a row in the **device** block
of `#/settings`, which V.04.8 opened to everybody for this same reason.
**Worth Rai's word if he wants it in both.**

### And no promise is sold that is not built
```
said today        full screen · opens faster · works with no internet (since 420)
NOT said          «تنبيهات الأذان» — and NOT LATER EITHER, until it is true
```
⚠️ Somebody who adds the app for an alert that never arrives **has been sold
a promise nobody kept** — `337` and `415`'s rule. Measured: **21 invite
strings, zero naming a notification.**

⚠️ **AND RAI'S OWN MEASUREMENT MOVED THE CONDITION.** This file first wrote
«the reason is added the day the alerts land», which assumes what is missing
is the **permission**. It is not — what is missing is the whole machine:

```
new Notification                 0
Notification.requestPermission   0
showNotification                 0
PushManager · a push event       0        across all of js/ and sw.js
```

**So what this app calls «notifications» is a list inside itself.**
`pushNotif()` writes a row into `state.extraNotifs`; the pre-adhan switch
raises a flag that produces one of those rows — **never an alert that
reaches a locked phone.** Real ones need a push service and a server.

> **THE RULE: the condition is not «when the alerts land» but «WHEN IT
> BECOMES TRUE».** The reason is not written into the invite while the
> machine to keep it does not exist, and it is not added on the day the
> switch appears either.

`test_v54 · 8.6` and `8.7` are the guard: **zero system-notification calls
anywhere in the app**, asserted alongside «no invite string names a
notification». It goes red the day somebody writes the sentence — and the
day somebody adds the API, which is exactly when both halves are revisited
together.

### And two of the three answers were Rai's, with the better argument
- **The iOS steps stand as written**, and one thing is separated that this
  file was blurring: **`#/install` is the WEB road, and the App Store
  wrapper is `430`.** They are not alternatives — `APPSTORE_URL` filled in
  turns the button into the store and the empty value keeps the web road,
  so the two live side by side with no edit.
- **The Settings placement is settled, and his measurement is the one
  recorded, not mine.** I argued «`#/profile` for a visitor is a sign-up
  screen». His is stronger and published: **`#/settings` carries no
  `requireTier` at all, and the app already prints a line telling a visitor
  that language, appearance and text size work without signing in.** The
  door is open there by written text, not by inference. ⚠️ **And it is NOT
  put in both places** — one thing in two places drifts apart after two
  edits.

### ⚠️ And the counter found a fault older than the router's last three fixes
**`boot()` had been running TWICE, since it was written.** A module script
is deferred, so by the time it executes `readyState` is already past
`'loading'` — the line at the foot of `app.js` calls `boot()`, and then
`DOMContentLoaded` fires and calls it again.

Everything `boot()` did was idempotent, so **nothing ever looked wrong**:
two renders of the same screen, two `catchUp()`s whose work is one-shot
keyed. The launch counter is what made it visible — **it read 2 on a first
visit and spent the invite before anybody had returned.** One entry guard,
and both entry points stay: whichever fires first owns the boot.

### ⚠️ And the teeth run committed itself into the branch
Proving a check has teeth means **breaking the app on purpose** — deleting
the in-app detection, filling a store link — and restoring it after. That
run was still between its two halves when I committed, so
`js/install.js` went to the branch reading `inAppBrowser() { return false; }`:
**the Facebook case, the one item in this batch that serves Ramadan,
disabled in the pushed tree.**

⚠️ **And the two builds disagreed**, which is the shape that hides it:
`index-single-file.html` had been generated BEFORE the mutation, so the
single-file build was correct and the module build was not — measured by
decoding the inlined module, not by grepping the file, because the
single-file build base64-encodes every module and a text search over it
finds nothing either way.

> **THE RULE: a teeth run owns the working tree while it runs.** Nothing
> is committed, no other suite is started, and `git status` must come back
> clean before anything is staged. Restoring at the end of the script is
> not enough — the window in the middle is real, and a background run
> makes it minutes long.

⚠️ It also cost the full net a restart: I had started it over the same
mutated tree, and stopped it rather than let it measure a file I had
broken myself. **A green over a tree nobody trusts is worth less than no
run at all.**

### `test_v54` — 36 assertions, and four the net cannot reach
⚠️ **Chromium does not emulate `display-mode`** (recorded here since
V.01.7), it fires no real `beforeinstallprompt`, and there is no share
sheet. So the share sheet, a real Facebook link on an iPhone, and the
Android dialog are **checked by hand and written into the closing line.**
**A test that does not run is said not to run; it is never claimed.**

## V.07.7 — the app gets ready for a native shell, and the data survives first

**This is not the shell.** The shell needs a Mac, Xcode and an Apple
account, and is not something written into a file that gets pasted. Every
item here earns its place on the web **today**, not on the day the store
opens — it is a batch of doors, not of behaviour, and not one line of what
the reader sees changed.

### The biggest danger in the project, and it is one problem in three worlds
Everything a reader owns sits under one key, `arabna.v1`: the account, the
claimed businesses, the favourites, the subscription, the receipts, the
photo waiting for review.

| where | what happens to it |
|---|---|
| a Safari tab | Apple's tracking prevention deletes `localStorage`, IndexedDB **and the service worker's cache** after **seven idle days** |
| added to the home screen | **exempt from the seven days** |
| inside a native shell | the platforms may clear `window.localStorage` periodically; a native storage API replaces it |

⚠️ **So somebody who did not open the app for a week comes back to no
account — having deleted nothing, understanding nothing, and not coming
back a third time.** ⚠️ **And this turns `425` from a nicety into a
survival condition**: on an iPhone, adding the app to the home screen is
what makes the reader's data and `420`'s offline cache live at all.

### One gate, because five identical writes are the rule written five times
`localStorage` was touched in **six places in `js/store.js`** — one read
and **five copies** of `try { setItem } catch`. Five copies means the
fourth is the one nobody edits when the rule changes; that is `esc()`'s own
fault wearing another file's clothes.

```
BACKEND    one line · the only line in the app that touches the browser store
readState  the only read
writeState the only write — the four boot migrations and save() all call it
```

**Measured: `localStorage` code sites in `js/` went 6 → 1.**

- ⚠️ **The gate does not know who stores.** On the day the shell arrives
  its native API goes into that one line and **nowhere else** — not in
  twenty-three modules.
- ⚠️ **The shell's machinery is NOT built today, only the door.** An
  interface written for a machine nobody has tried gets written twice.
- ⚠️ **The key is never changed.** Changing `arabna.v1` means every reader
  opens the app tomorrow and finds nothing. Asserted, not merely intended.

### One way out, and it is `342`'s fault in a native costume
Inside the iOS in-app browser the directions button once left Rai in a
window with no way back. **A native shell does the same thing to
`window.open`** — it may open the map *inside* the app and trap the reader
there.

```
before   window.open( × 2 in ui.js  ·  location.href = 'tel:' × 2 in directory.js
after    openExternal(url) — and window.open( in js/ is ZERO
```

- ⚠️ **It is an anchor, not `window.open`, and that is the better
  implementation rather than a way to satisfy a grep.** It is the same path
  the app already uses for every link it prints (`<a target="_blank"
  rel="noopener">`), so there is one behaviour and not two; a popup blocker
  treats a real anchor click far more kindly; and `rel="noopener"` is
  carried by the element, so the opened page can never reach back through
  `window.opener`.
- **A `tel:` or `mailto:` goes to `location.href`** — the scheme branch is
  the door's job, not the caller's. A popup blocks it in some browsers and
  opens a blank tab in others.
- Today it does exactly what the four calls did. **The value is that four
  doors became one.**

### `persist()` is asked for, and nothing rests on the answer
`navigator.storage.persist()` at boot. ⚠️ **It is not a guarantee, Apple
does not document it, and it does not stop the seven-day rule.** So it is
asked and forgotten — **and no string anywhere tells the reader their data
is safe**, which `test_v55 · 3.3` holds.

⚠️ **That check earned itself immediately:** «سجّل دخولك لننشر إعلانك —
بياناتك محفوظة» meant *what you typed is parked* (true — `state.draft`) but
**reads as «your data is stored safely»**, the one claim this app must not
make. The English side already said «what you wrote is saved»; the Arabic
now matches it.

### The adhan alert does not wait for the server — and the copy said it did
⚠️ **Measured: `js/prayer.js` computes everything with no network request
at all**, and a local notification is scheduled *on the device*. So:

```
times computed on the device  +  alert scheduled on the device  =  no server
```

**The strongest thing the app can offer was waiting for the wrong
milestone.** `prAlertSoon` read «يعمل مع إطلاق السيرفر»; it now reads
**«يحتاج نسخةً أصليّة من البرنامج»**.

⚠️ **And not the web either, which is why `425`'s guard stands.** The one
API that could schedule a future notification — Notification Triggers —
**was abandoned**: «it was not clear we could deliver a consistent and
reliable experience across platforms». On the web an alert arrives only
while the page is open or from a push server, and the adhan's moment is
exactly when the phone is locked and the app closed. **The two halves do
not meet, so the promise is not made** — `test_v54 · 8.6` and `8.7` are not
softened, not edited and not moved. **They were right; the spec was
corrected.**

### ⚠️ Sixty-four, and it kills the feature silently if it is ignored
iOS allows **64 pending local notifications per app** — an Apple engineer's
own words are that this is a system limit with no way around it.

```
5 prayers a day  →  64 ÷ 5 = 12.8 days, then silence
```

**Somebody who does not open the app for a fortnight goes quiet, does not
know why, and concludes the app is broken.** So `alertSchedule()` is a
**rolling window**: every launch rebuilds it as far ahead as the ceiling
allows. Measured from Houston:

| chosen | alerts | reach |
|---|---|---|
| five prayers | 64 | **13 days** |
| two prayers | 64 | **31 days** |
| one prayer | 64 | **64 days** |

- **The arithmetic is built and the scheduling is not.** A function that
  answers «which moments» is testable today and callable by the shell
  tomorrow. **Nothing here fires a notification, and `test_v55 · 4.9` says
  so.**
- **A prayer that cannot exist is skipped, never guessed** — and the loop
  is bounded, so a polar summer where three of five are null cannot spin.
- ⚠️ **«Always» is not promised.** The screen says «افتح البرنامج بين حينٍ
  وآخر ليبقى التنبيه» — `337` and `415`'s rule: an alert that stops with no
  word is worse than no alert.

### ⚠️ And a check read the prose about the code — for the second time
`test_v54 · 8.6` and `8.7` went red on both builds, and the app was
innocent. Their `jsAll` was built from the **raw source**, so the moment
this batch wrote a comment in `js/prayer.js` saying «there is not one call
to `showNotification` or `PushManager` anywhere in this app», the check
matched **the sentence explaining its own rule** and reported the fault it
exists to prevent.

Proven both ways before a line was touched:
```
on the raw source      matches  ← the false red
on the stripped code   no match ← correct
```

**The fix is `test_v53`'s own line, verbatim**, and so is its rule — this
project has now paid for it twice:

> **A check must read the CODE, never the prose about the code.**

⚠️ **Nothing else moved.** The two assertions were not softened, the
ceiling was not shifted, and **the comment in `prayer.js` stays** — it is
correct and it is useful. The check was wrong, and only the check changed.

### `test_v55` — 29 assertions, and the three numbers the batch closes on
```
localStorage code sites in js/   1
window.open( in js/              0
alertSchedule, worst case       64
```

## V.07.8 — a hidden strip drew itself, and swallowed the touch

**Rai found it on his own phone.** A fault this batch put into the
published build in `425`, and it stood on **every screen**.

```html
<div id="installBar" class="install-bar" hidden></div>
```
```css
.install-bar { position: absolute; … display: flex; … }
```

⚠️ **`hidden` comes from the browser's default sheet at the weakest
priority, so any class rule writing `display` cancels it.** The attribute
was set correctly and nothing happened on screen. Measured on all ten
screens walked, on 0.7.6:

```
el.hidden · hasAttribute        true · true
innerHTML.length                0
getComputedStyle.display        flex          ← the fault
drawn                           374 × 22 at y=736
elementFromPoint in its middle  #installBar
```

**374 = 390 − 8 − 8, which is `inset-inline: 8px` exactly** — so what was
drawn was that strip and not something resembling it.

⚠️ **And it was not only a white line: it took the touch.** A 22px strip
directly above the bottom bar, `pointer-events: auto`, `z-index: 120`,
consuming every tap that landed on it. **In the directory it covers the
last visible row — the reader taps a shop and it does not open, taps again
and it does not open.**

### The line, and it is general on purpose
```css
[hidden] { display: none !important; }
```

- ⚠️ **`!important` is deliberate and is not removed.** Without it the very
  class rule that caused this wins again. **It is the one place in the file
  that earns it:** a rule saying «this element is not there» must not be
  beaten by anything.
- ⚠️ **And `.search-clear[hidden] { display: none }` is deleted with it** —
  a local patch for **this same class**, whose own comment said «`display:
  grid` beats the `hidden` attribute». **So it had happened before and was
  fixed where it stood.** The same rule written twice is the `esc()` fault,
  and the second copy is the one nobody updates. **`[hidden]` now appears
  exactly once in the stylesheet.**
- **The code was right and is untouched.** `hideInstallInvite` sets
  `hidden = true` and empties the node — that is correct, and «fixing» it
  with `style.display` would hide this one element and leave the class open
  for whoever comes next.

### ⚠️ And why the net did not catch it — which matters more than the fault
```js
const barShown = p => p.evaluate(() =>
  { const b = document.querySelector('#installBar'); return !!b && !b.hidden; });
```

**The check read the property, not the pixel** — and the property was
perfectly correct. **So `test_v54` was green while the strip stood on ten
screens.** That is «a net that lies about a green build»: the same family
as `SUITES` in `395`, and as `test_v53 · 6.3` measuring the page instead of
the list.

`barShown` now reads `getComputedStyle` and the rectangle. **And a new
check is written generally, never by the name `#installBar`** — a check
named after one element guards one element, and **this is a class of fault,
not an incident**: `10.1` walks all ten screens and asserts that nothing
carrying `[hidden]` is drawn, `10.2` that the rule exists exactly once, and
`10.3` that it keeps its `!important`.

### Measured, before and after
```
[hidden] elements drawn, ten screens   10 → 0
#installBar height                     22px → 0
[hidden] in styles/app.css             2 → 1
the invite itself                      still shows on the second visit, and still dismisses
```

## V.07.9 — a response carrying a redirect does not open an app

⚠️ **A fatal fault, live on the published build.** The app added to an
iPhone's home screen **did not open at all** — a white screen and:

```
Safari can’t open the page.
The error was: “Response served by service worker has redirections”.
```

**Three lines in three files made it together:**

```
manifest.json   start_url = './index.html#/home'
vercel.json     "cleanUrls": true      →  /index.html answers 308 → /
sw.js           cached 'index.html' and served it for every navigation
```

**Measured on a host built to redirect the way `cleanUrls` did** — the
cache was read directly, not inferred:

```
cache                        arabna-0.7.8 · 34 rows
poisoned row                 /index.html  →  /   ·  redirected: true
caches.match('index.html')   redirected: true
the SECOND navigation        ERR_FAILED · #app 0 characters
```

⚠️ **The specification forbids answering a navigation with a redirected
response.** WebKit enforces it literally, and the launch from a home-screen
icon is the hardest case of all — it is a navigation straight to
`start_url`.

⚠️ **AND WHY ONE TRY NEVER FINDS IT.** A service worker does not answer
until it has cached. **The first visit goes to the network and works; the
one after it comes from the poisoned cache.** So the class passes the first
check and fails at the reader — which is what makes it more dangerous than
it looks.

### ⚠️ A measuring error is recorded, because it is why this was late
This exact possibility **was tested before, on a host that reproduced the
`cleanUrls` redirect, and the answer was «the path is sound».** The check
asked the wrong question:

```
asked      does the page open in Chromium        →  it did
should ask what is `redirected` on the cached row →  true
```

> **THE RULE: measure what the specification says, not what one browser
> tolerates.** Chromium is lenient on some paths and WebKit is not, so
> «does it open here» is not an answer about anybody else's phone.

### Three layers, and not one of them is enough alone
1. **`"cleanUrls": true` is deleted** from `vercel.json`. ⚠️ **Nothing in
   the repository depended on it** — every `.html` mention in `index.html`
   and all of `js/` was read: `index.html` itself, and one word inside a
   comment. The key arrived with the file and was never asked for.
   `trailingSlash: false` stays; it has nothing to do with this.
2. **`noRedirect()` in `sw.js`, at BOTH ends.** It rebuilds a response
   without the flag and keeps the body byte for byte. ⚠️ **Guarding the
   store alone leaves every cache already on a reader's phone poisoned;
   guarding the answer alone lets the poison pile up.** It also replaces
   `addAll` at install — `addAll` stores whatever the network returns,
   redirect flag and all — and wraps the offline
   `caches.match('index.html')`, the exact spot the fault landed.
   ⚠️ **This layer stays after `cleanUrls` is gone**: any hosting setting
   tomorrow, or a domain added later, can bring the redirect back, and the
   guard belongs in the app rather than in a host's configuration.
3. **The poisoned cache is erased by raising the version.** The cache name
   is `'arabna-' + SW_VERSION` and `activate` deletes every other name, so
   **the version bump is the eraser** — built in `420`, nothing added.

### ⚠️ `start_url` is identity, not a path — and is not touched
Changing it to `'./'` looks like the shortest fix and is the wrong one:

```
manifest.json   "id":  absent
```

**With no `id`, the app's identity is derived from `start_url` itself.**
Changing it makes the phone treat this as a **different app** — whoever
installed it keeps a dead icon for ever and never receives an update.
**The cure is deleting the redirect, not moving the target.**

### ⚠️ And whoever installed it before this fix
Raising the version repairs everybody the update reaches. **It does not
reach an icon that is already stuck, because the page does not open at
all.** So, for Rai to pass on:

```
1) delete the icon from the home screen
2) Settings → Safari → Advanced → Website Data → remove the host
3) open the link in Safari
4) then add it to the home screen again
```

⚠️ **Never «update the app»** — there is no updating from inside something
that will not open.

### ⚠️ And the teeth proved why BOTH kinds of check are needed
```
put "cleanUrls": true back   →  3.1 red · and 1.1 · 1.2 · 1.3 STAY GREEN
remove noRedirect from the
answer path                  →  3.4 red · and 1.1 · 1.2 STAY GREEN
```

**Each layer alone already saves the reader**, so with either one present
the behavioural checks cannot see the other one missing. **That is the
design working — and it is exactly why the structural assertions stand
beside the behavioural ones.** A suite with only «does it open» would
watch both layers rot one at a time and report green throughout.

### `test_v56` — 14 assertions, and it builds its own host
⚠️ **A plain static server cannot produce this fault**, which is precisely
why it went unfound. The suite starts a server that answers **308 on
`/index.html`**, registers the worker, waits for it, and then reads the
cache itself. **Block 2 runs the same tree on a non-redirecting host and
asserts everything passes there — the proof that the host is the
difference.** And `1.3` navigates a **second** time, because the first
always comes from the network.

## V.08.0 — the city's name is not replaced by the nearest centre

⚠️ **Rai's report: the screen said Sugar Land and he was not in it.**

### Half an old fix, still doing the thing its own comment condemns
`cityNameFor` kept the reverse lookup's answer **only when the directory
covered it**, and threw it away otherwise:

```
resolved city IS one of the 24   →  used. correct.
resolved city is NOT one of them →  discarded, and the nearest of the 24
                                    centres put in its place
```

**So the sentence the comment above it condemns — «nobody says: the
nearest city hall to me is Katy» — was still being carried out**, on
everybody living outside those 24. Measured beside Sugar Land:
**Rosenberg, Fresno, Sienna, Meadows Place and Alief are all off the
list** — and whoever stood in one of them was told Sugar Land while the
correct name had already been fetched and thrown away.

⚠️ **And the condition chose nothing.** Where the city IS covered, `named`
equals `r.city` and both branches return the same value. **It was not
picking between two names — it was picking when to discard the right
one.** The fix deletes it, and the function shrinks:

```js
return (r && r.city) || (near && near.city) || '';
```

**`near` stays** — it is the last resort when there is no name at all.
**And no city is added to `CITY_POINTS`:** coverage is a business decision,
not a cure for naming, and adding a city we have no listings in promises a
directory we do not have.

### ⚠️ Stopping the quiet refresh would have made it worse, and was refused
It was asked for. **The refresh does not invent the name — `cityNameFor`
did** — so stopping it only freezes the wrong name for ever. And it saves
the point **before any network call**, while every distance and every
prayer time is computed from the point: **stopping it freezes the miles on
a place the reader has left.**

### ⚠️ A hand-picked city is no longer frozen — V.04.0 reversed
The old rule: a city somebody chose is never changed, and the quiet
refresh asks «It looks like you are in {city}?» once a session; a «no» is
final. **Rai reversed it with the better argument:**

> «I might pick Houston on purpose, then travel to another city. The
> sensible thing is for it to update by itself so it knows where I am —
> and if I want Houston again I pick it again by hand.»

**He is right: the two are not the same act.** «Show me Houston's shops»
is an intention to browse; «where am I» is a question about location. One
field carried both, **so the browsing answer blocked the location question
for ever.**

- **It updates itself, and it is not silent either:** one transient line —
  «حدّثنا موقعك إلى Rosenberg» — with **a single undo** that gives back
  both the previous city and its «by hand» mark. No sheet, no question.
- ⚠️ **The same `NAME_STALE_MI` — three miles — now governs the
  hand-picked city too**, so an errand across the road never overrides
  what somebody chose. The threshold already existed; nothing was invented.
- **The sheet is deleted, not left dead**: `askToMove`,
  `moveAlreadyAsked`, `markMoveAsked`, `moveAsked` and the four
  `locMoved*` strings. **Measured: zero mentions left in `js/`.** A
  function nobody calls reads two months later as a disabled feature and
  gets revived for no reason.
- **The undo needs no special path**: `setUserLocation(prev)` with no
  point writes `manual: true` and clears the coordinate, which is exactly
  what picking a city by hand has always meant.
- **`toast` gained an optional `ms`** so an action line can expire. News
  with an undo is not a demand, and it must not sit on the screen for the
  rest of the session.

### And the thing this batch could most easily have broken
```
directory rows · Rosenberg   40
directory rows · Houston     40      ← identical
inRegion(Houston · Rosenberg · Dallas)   true · true · false, unchanged
```
**`state.area` defaults to `'all'` and never filters by city**, so an
uncovered name changes nothing about what is listed. ⚠️ **And coverage
stays a separate question, still answered by `inRegion`.**

### ⚠️ And three suites went red on the full net — one of them my own trap
```
v24 · 1.2 · 1.3   a deliberate reversal — rewritten
v33 · 2.6         CRASHED, calling a function this batch deleted — rewritten
v56 · 3.6         MY FAULT: a frozen version literal
```

**`v56 · 3.6` is the one worth writing down.** I pinned `'0.7.9'` into the
check, so raising the version in the very next batch turned it red with
nothing broken.

> **A frozen literal in a check is a red scheduled for a future date.** A
> check on a mechanism measures the mechanism: the cache name carries
> whatever `js/data.js` holds, and `activate` deletes every other name —
> that is what makes the bump the eraser, whatever the number is.

⚠️ **And `v33` CRASHED rather than failed** — the fourth time this session.
A check calling a deleted function takes the whole suite down with it, and
every assertion after it goes unmeasured. What replaced it asserts the
machinery is **gone**, not merely unused.

### ⚠️ And a check that invented its own API measured nothing
`2.2` first read `nearestCity(...).inRegion` — a field that does not
exist; `nearestCity` returns `{city, miles}` or null, and `inRegion` is
its own exported function. **It reported `false` for Houston**, which
looks exactly like a real regression. **A check must call the API the app
has, not the one the check imagined.**

## V.08.1 — the invented data is shown to nobody by default

⚠️ **A publication gate, not an improvement.** Rai bought `arabna.app` and
is about to connect it, and **the first stranger to open the real address
would have seen invented businesses and reviews nobody wrote.**

### The fault was not in the data — it was in who could see it
```js
showDemo: true,      // in DEFAULTS
```
`DEFAULTS` is cloned into `state`, and `writeState` saves the whole of
`state` into **this phone's own store**. ⚠️ **So the switch is a DEVICE
preference, not an application setting**: turning it off on Rai's phone
hid the invented data *on Rai's phone*, and every new visitor started from
the default and saw all of it. With no server, **while the default was
`true` there was no way at all to hide it from people. Not one.**

Measured at 390px on a brand-new device, after the fix:

| | on | off |
|---|---|---|
| directory | 40 rows | **40 rows** |
| marketplace | 10 | 0 |
| magazine | 6 | 0 |
| slider slides | 4 | **1** — the house «إعلانك هنا» alone |
| mini banner | drawn | not drawn |

**Turning it off does not empty the app — it makes it honest.** The 485
real listings are untouched, and the empty sections carry their designed
states.

### ⚠️ And two lines in the panel were saying what was not true
```
demoShowSub   «مُطفأ = لا يراها أحد …»      describes a server that does not exist
demoWarnBar   «بيانات تجريبية ظاهرة للمستخدمين»
```
**The second is the worse one:** the bar is drawn from **this device's**
state, so Rai turning the switch off made the warning vanish **while the
invented data stayed visible to everybody else.** An alarm silenced by an
act that fixes nothing is worse than no alarm — and it is our own rule
verbatim: *a check that goes green without a fix guards nothing.* Both now
name **«هذا الجهاز»**, and the bar is kept: the owner has to know that
what he sees is not what people see, which is exactly what misled him.

### ⚠️ Changing the default reaches nobody who already opened the app
`writeState` put `showDemo: true` into every existing phone's store, Rai's
two included. So it is turned off **once, at boot**, behind a mark.

> **The mark is what makes it a migration rather than a lock.** Without it
> the switch could never be turned on at all: flip it, reopen, find it off.

It lives in `DEFAULTS` **and** in the device-keys list beside `showDemo`
itself — a key forgotten there is lost on sign-out and the migration runs
again. And it writes through `writeState()`, not around it: **`430`'s rule
that exactly one place in the app touches the browser store.**

### The reviews stay, and that is safe now
Rai's decision: `DEMO_BUSINESSES` and `DEMO_REVIEWS` stay in `js/data.js`.
**Safe because of the very thing that caused the fault** — the switch is
per-device, so with the default off **no visitor can turn it on or see
them.** Deleting them is written as a launch-gate item in
`docs/الحالة.md`, with `robots.txt`, the manifest and the CSP.
⚠️ **Their presence in a public repository is text somebody can read, not
a review somebody is shown. The difference is large and is not blurred.**

### `robots.txt` — shut until the domain is connected
`Disallow: /` for everyone, **opened the day `arabna.app` is connected and
not before**: opening it earlier makes the temporary address the one
Google knows, and **moving an indexed result is harder than indexing the
right one first time.** No `sitemap.xml` — no map is drawn for somebody
who is not allowed in.

### ⚠️ And three of this suite's own checks were wrong first
```
2.2  demanded ZERO results for «مطعم الشام» — but that query legitimately
     reaches two REAL shops, Al Shami (Westheimer) and (Katy), through the
     transliteration tags V.02.6 added. The app was right. It now asserts
     the invented record is absent, not that nothing is found.
3.5  counted MATCHES of `localStorage.…Item`, but the one place holds both
     the read and the write on one line, so the honest count is of PLACES.
4.1  swept the whole i18n file and caught two innocents — this batch's own
     comment quoting the sentence it removed, and `greetOffNote`, which
     says «nobody sees it» about a paused greeting and is true.
```

⚠️ **And the tooth for the default did not bite**, which is worth as much
as the ones that did: flipping `showDemo` back to `true` leaves the suite
at 22/22, **because the migration protects a fresh device anyway.** Two
layers again — so the default itself is asserted structurally (`1.1b`),
and that one bites.

### ⚠️ Thirty-eight suites went red, and not one thing was broken
Their fixtures **are** the invented records — a subscribed business, a
boosted listing, a review with a rating. `tools/e2e/_demo.mjs` is one
wrapper that turns the switch on for the suites alone, and it is the
honest shape: **the app's default is what a stranger meets, and the net
says so by having to ask for anything else.**

Two faults in the wrapper itself, measured rather than reasoned about:

- ⚠️ **It forced the flag on unconditionally**, so `v20 · 6.7` — which
  turns the invented data OFF on purpose, to reach the drawer's «no
  subscriber» branch — was overridden. **A helper that breaks a test by
  helping it.** An object already carrying `showDemo` is now left exactly
  as it is: **an explicit choice by a suite outranks the wrapper.**
- ⚠️ **`addInitScript` runs in registration order**, and five suites
  (`v38` · `v39` · `v40` · `v43` · `v45`) seed by **replacing the whole
  state object**, erasing the flags a moment after they were written. So
  the wrapper **intercepts the write** instead — the only point that is
  proof against ordering, whatever shape a suite seeds in.

```
112 runs · 56 suites · 6,010 assertions · zero red · zero crash
```

## V.08.2 — the share card carried the old address

⚠️ **Rai connected `arabna.app` on 1 September and the domain works.**
Measured after connecting: three absolute URLs in `index.html` were still
written, by hand, on the temporary host.

```
og:image        https://arabna-db-prime.vercel.app/assets/share-1200x630.png
og:url          https://arabna-db-prime.vercel.app/
twitter:image   https://arabna-db-prime.vercel.app/assets/share-1200x630.png
```

⚠️ **And the harm is not cosmetic.** `og:url` is what the app declares as
its own address, so whoever shares the link on WhatsApp or Facebook gets
a card built on the old host, and whoever presses it lands there rather
than on `arabna.app` — the image is fetched from there too. **That builds
an audience on an address that will be abandoned**, which is the same
harm that kept Google out in `510`.

- ⚠️ **They stay absolute and are not made relative.** Facebook's and
  WhatsApp's crawlers do not resolve a relative `og:image` — the absolute
  form is correct here, **and the fault was in the host, not in the
  shape.**
- **What was measured and found sound is named so it is not touched**:
  `manifest.json`'s `start_url` is relative, the CSP's `'self'` became
  `arabna.app` by itself, and the image file really exists. **Changing
  what is sound is a cost with nothing bought.**
- **No redirect is built from the temporary address here, and
  `robots.txt` stays shut.** Both belong to the publication batch;
  merging them turns a three-line batch into a migration.

### THE RULE, because nothing was watching
⚠️ **The fault was not that the address was old — it was that three URLs
slept for weeks and only surfaced when the domain was connected.** So the
suite carries a standing item, and it is a negative **on the host**:

```
no absolute URL on a vercel.app host in any published file
```

⚠️ **On the host, never on the old name.** A negative on one name goes
green by itself the day a second preview name is invented — `390`'s rule
exactly. And in `CLAUDE.md`:

> **The absolute URLs in `index.html` are three, and all three move with
> the domain. A fourth is added only for a reason a relative URL cannot
> serve.**

### A comment that denied a feature it had
Above the manifest line stood «installable on the home screen. **No
service worker yet (V.02)**…». The worker landed with `420` and has
`sw.js`, `js/sw-manifest.js` and `tools/build_sw.py`. ⚠️ **A comment
saying what is no longer true is the same fault as a screen saying it:
whoever reads it to decide something decides on a dead fact.** It now
names where the version really lives.

### Text drawn inside an image is never reached by a batch
⚠️ **Measured after the domain was connected:** the card renders in full
on Messenger — and the sentence drawn **inside** it read «كلّ ما تحتاجه
في Houston» while the app's own line had grown to «في أمريكا».

**The rule this exposes matters more than the difference:** the app's
copy was updated when the reach widened from a city to a country **and
the picture's copy was not**, because no batch reaches pixels. It will
happen again with every change.

**Rai's decision of 1 September: the line goes and the lockup stands
alone.** ⚠️ **And that is the better design rather than a way around an
obstacle** — the title and the description are printed **under** the
image by WhatsApp and Facebook alike, so the sentence inside it was a
duplicate, and it was the copy that falls behind.

- `assets/share-1200x630.png` is replaced by **the owner's own file**,
  1200×630, the lockup untouched and re-centred vertically. **Nothing is
  redrawn and no text is generated.**
- ⚠️ **The check for it is derived, not written.** It names no city, no
  colour and no pixel position: the rows are scanned, rows differing from
  the ground are content, and rows separated by a hairline are one object
  (the lockup's own parts sit 2 and 3 rows apart; the sentence stood 60
  rows below). **Measured: two blocks before, one after** — and the
  previous card, restored from git, still reports two.

### The version is raised, and the reason is measured
The worker keeps `index.html` in a cache named after `APP_VERSION`, so
**without a raise an installed reader keeps yesterday's head and
yesterday's card.** ⚠️ **And no version literal is written into the
check** — `test_v56 · 3.6` froze `'0.7.9'` and went red in the next batch
with nothing broken. What is asserted is that the carriers **agree**:
`js/data.js`, `js/sw-manifest.js` and this file's own version line.

### And a suite with a port typed into it, found by running it
⚠️ **`test_v56` built its own host on port 8451, and `run.sh` runs the
two builds AT THE SAME TIME** — so the second run died with `EADDRINUSE`.
It **crashed** rather than failed, which reads as a red that has nothing
to do with what the suite guards, and it survived one full net only
because the two runs drifted apart. The port is `0` now: the kernel picks
it and there is no number to collide. **Same family as `test_v36`'s
written-in port — a number typed into a check is a fault waiting for the
day the timing changes.**

**`test_v59` — 14 assertions, and all three teeth bite:**
```
one URL back on the old host   → 2.1 · 2.2 · 4.1 red (and 5.1, the stale generated build)
the card file deleted          → 3.1 red
yesterday's card restored      → 3.3 red, reporting 2 blocks
```

```
114 runs · 57 suites · 6,038 assertions · zero red · zero crash
```

## V.08.3 — the support number fills its place

**Two values and no new screen.** The machinery was built long ago and was
waiting: `SUPPORT_PHONE` has held `''` since V.03.6 — when `(713) 555-0199`,
a reserved fictional exchange, was printing a `tel:` that rang nowhere —
and the WhatsApp row in `SOCIAL` has stood dimmed behind «قريباً» since
V.05.6. **Rai's number, and it is one number for both.**

- **Nothing was hunted for and filled in.** The three places read the
  constant and appeared by themselves. Measured across seventeen routes:
  **«من نحن» · «الشروط» · «الخصوصية», and no fourth reader** — «المساعدة»
  publishes the email and deliberately not the phone, which is V.02.7's
  own decision.
- ⚠️ **`+1 (346) 353-3322` and not `(346) 353-3322`, and the shape is the
  whole item.** The link is built by stripping everything that is not a
  digit or a `+`, so the short form gives `tel:3463533322` — **no country
  code, and it does not dial for a reader outside the United States or on
  a foreign network. This app is written for a community that travels.**
  `fmtPhone` is not touched: it would change how five hundred listings
  print, and none of them has anything to do with this.
- ⚠️ **The `wa.me` number is digits alone** — country code, no `+`, no
  separators. That is the service's own rule and any other shape opens an
  error page.
- **The ready line is a fixed percent-encoded value**, «مرحباً، أكتب لكم
  من تطبيق عربنا», never built with `encodeURIComponent` at run time: a URL
  does not carry Arabic letters intact through every browser. ⚠️ **And it
  is practical rather than decorative** — the number is Rai's own and the
  support line at once, so the ready line **sorts the app's messages from
  everyone else's on the first line.**
- **WhatsApp left «قريباً» by itself.** `soonLineHtml` builds that line
  from the rows with no `url`, so nothing was deleted from a list and no
  string was edited. Measured: the line is **not drawn at all** now — all
  six rows are real anchors.
- ⚠️ **`scrubContact` is named here to be left alone.** It strips WhatsApp
  links from messages **readers send each other**, which is right and has
  nothing to do with a support channel. No exception is added to it.

### And the check as written would have been red on a clean tree
`495`'s own wording for the guard was «search `js/` for `555-01`, the
answer is zero». **Measured, that is fourteen places and every one of them
is correct**: ten are the demo seeds' phone numbers — invented on purpose,
and they leave with the two arrays at launch — two are the importer's
example rows, and two are comments recording this very fault.

⚠️ **A check written that way demands deleting the seeds and the
documentation, and goes red with nothing wrong.** Same family as `test_v58
· 4.1`, which swept a whole pack and caught the comment explaining its own
rule. So it is scoped to the harm instead: **the number we publish as
ours, and any `tel:` a reader can actually press.**

**Added to `test_v14`, not to a suite of its own** — that is the block that
already reads those three pages — and all four teeth bite:

```
SUPPORT_PHONE emptied        → 495.1 · 2 · 3 · 3b red, and no dead link printed
the wa.me url emptied        → 495.4 · 5 · 5b red, «WhatsApp — قريباً» returns
the number without +1        → 495.2 red
the old fictional number     → 495.6 and 6b red, naming three dead tel: links
```

⚠️ **And one thing is not closed by code and is not claimed:** `wa.me`
opens a conversation only if the number is **registered on WhatsApp**, and
neither our code nor `wa.me` checks it. If it is not, the reader is told
the number is invalid — **worse than no icon, because it says support
exists and then shuts the door.** It is checked by hand, once, from
somebody else's phone.

```
114 runs · 57 suites · 6,056 assertions · zero red · zero crash
```

## V.08.4 — the house slide shows what can be sold, and does not vanish when it cannot

⚠️ **Rai's question is what opened this:** «إذا انباعوا كلُّهم، كيف بيعرف
اللي بيتفرّج إنّه ممكن يعلن هون بالمستقبل؟»

**The capacity is written and respected in the SELLING** — `AD_SLOTS`,
`adSlotsLeft`, the waiting list — **and the DISPLAY knew none of it.**
Three behaviours of one rule, each in a different place:

- **Home appended the house slide unconditionally**, so six sold made
  **seven slides**. ⚠️ **What an advertiser buys is a share of the
  rotation** — `AD_SLOTS`'s own comment says it: at four the cycle is 64
  seconds and each is on screen a quarter of the time, «and the advertiser
  who saw a result is the one who renews». **Six paid for a sixth and got a
  seventh.** And worse, it advertised what could not be bought: the tap
  landed on a page that says «full».
- **A section decided from `ads.length` alone**, so **one sale out of four
  removed the invitation** — three empty slots and nobody left to learn of
  them. ⚠️ **And measured, that was the only road in:** the magazine has a
  permanent button, the marketplace's upsell goes to `#/subscribe` (which
  is not advertising), and events had **nothing at all**.
- **The permanent upsell block on Home does not cover it, and the
  measurement says so:** the slider is at **y=459** and that block at
  **y=1,529 — 1.8 screens of scrolling**, with the articles, the offers and
  the featured strip in between. ⚠️ **«Discovery is guaranteed anyway» is
  literally true and practically false**, and this is the number that
  settles it.

### THE RULE
```
a slot free   →  the house slide is IN the rotation
sold out      →  it leaves the ROTATION, not the SCREEN
                 and a strip under the slider carries the invitation
```

- **The strip sits UNDER the slider**, never above and never inside. Above
  it crowds the first thing anybody sees; inside it is back in the rotation
  and costs an advertiser a turn. **Measured at 390×844: top 673, above the
  fold** — and that item is what protects the reason for the batch, because
  a strip that needs scrolling is the old block in new clothes.
- **It promises nothing it cannot give.** Sold out it offers the **waiting
  list** — `adWaitlist` / `joinWaitlist` were built and simply unreachable
  from the screens people browse — and with room it names **how many are
  left, read from `adSlotsLeft` and never written**.
- ⚠️ **`adCapacityBarHtml` is written ONCE in `ui.js`**, not four times in
  four screens — the `esc()` fault this repository has already paid for in
  four places.
- ⚠️ **And the marketplace and events gain a permanent way in** that
  neither had. That is intended, not a side effect.

### One list, because two readers need the same answer
`slidesFor(product, ads, cat)` in `store.js` decides whether the house
slide is in the rotation, and **both the markup that draws the track and
`startSlider` read it**. ⚠️ **The rotator is driven by the array it is
handed**, so a track carrying one more slide than that array draws a slide
that is never shown, under a dot that never lights. The dots are asserted
against the slides for exactly that reason.

- ⚠️ **`HOUSE_SLIDE` is one object in `data.js`, named once.** Two literals
  drift apart on the first edit.
- ⚠️ **It is filtered out by its `kind`, never by being marked demo.**
  Marking it demo would hide it the day the owner turns the invented
  records off — and it is not invented, it is ours.

### And the inventory itself is untouched
**The batch decides WHEN WHAT IS SHOWN, never HOW MANY THERE ARE.**
`AD_SLOTS`, the prices, `#/advertise`, the waiting list and the ten-second
rotation are all unchanged, and v60 · 8.1 asserts it.

**`test_v60` — 15 assertions, and the teeth:**
```
adSlotsLeft always 0            → 1.1 · 2.1 · 6.1 · 6.2 red
the slide appended always       → 3.1 red at seven slides, 3.2 red
the strip pushed below the fold → 5.1 red at top 2865
```

```
116 runs · 58 suites · 6,086 assertions · zero red · zero crash
```

⚠️ **And the first attempt at that third tooth did not bite, and the fault
was the tooth.** `margin-block-start: 2200px` was inserted at the head of
the rule, **above the block's own `margin-block-start: 8px`, which won by
source order** — so the strip never moved and the check looked toothless.
Measured `getComputedStyle` said `8px`, which is what settled it. **Prove
the break happened before concluding a check is asleep.**

## The «إنشاء الحساب» button was clipped by sixteen pixels, and its guard was green

**A visitor reaches `#/settings` by V.04.8's decision, and that button is
the only door to signing up from that screen.** Measured on both builds,
both languages, four widths:

```
ar · 390   [-16 … 374]  width 390  ·  frame 390
en · 390   [ 16 … 406]  width 390  ·  frame 390
```

⚠️ **The fault changes side with the language**, so it is measured in both
directions and never one. The arithmetic:

```
.btn-block { width: 100% }   → 100% of a container with no padding = 390
style="margin:0 16px 16px"   → +16 each side                       = 422
the box available                                                   = 390
```

⚠️ **And this is CLIPPING, not overflow — heavier, not lighter.**
`.app-main` carries `overflow-x: hidden`, so **what is cut off cannot be
scrolled to and cannot be reached at all.**

- **The answer was one line above it.** The hint took its offset as
  **padding on its own container** and stayed in; the button took it as a
  **margin on itself** while being `width: 100%`, and walked out. Two
  idioms for one job in adjacent lines. The offset now sits on a wrapper,
  and `data-route` stays on the button so `wireRoutes` is untouched.
- ⚠️ **`.btn-block` in `app.css` is NOT touched.** Measured: **120
  `btn-block` elements in `js/`, and exactly one carried an inline margin.**
  Changing the rule to `calc(100% - 32px)` fixes one place and breaks 119;
  the fault was in the call that broke the pattern.
- **After: `[16 … 374]` width 358 at 390 · 428 at 768 · 426 at 900 and
  1280 — identical in both languages, zero elements outside the frame.**

### THE RULE, and it is why the guard slept
> **Horizontal overflow is never measured with
> `documentElement.scrollWidth` in this app.** `.app-main` clips rather
> than scrolls, so that number cannot move for anything inside the content
> area. **Measure the element's own box against `.app-main`'s.**

`test_v41 · 2.5` asserted exactly that number and **stood green over a
button 16px outside the frame**, on four widths in two languages. It is
**kept and not softened** — what it guards is still true — with a comment
above it naming what it does not cover, and **`2.5b` beside it measuring
the boxes at all four widths**. ⚠️ **A horizontal scroller is excluded by
its COMPUTED STYLE, never by a written list of selectors**: the photo
strip, «مميّز هذا الأسبوع» and the sliders are meant to run past the edge,
and a list of names goes stale the first time one is added.

⚠️ **V.06.4 measured the boxes by hand and wrote this same sentence — and
that measurement never became a standing item, so the door reopened.**
This closes it as an item, not a note.

**The teeth, and the second is the whole argument:**
```
the inline margin restored   → 2.5b red at [-16 … 374] on all four widths
a 1400px node injected       → 2.5b red at [-1010 … 390] · AND 2.5 STAYS GREEN
```

```
116 runs · 58 suites · 6,094 assertions · zero red · zero crash
```

**No version raise:** one line in `js/`, and what changed is the position
of a clipped button — no behaviour, no screen, no route. The rule of
`180`, `185` and `210`.

## V.08.5 — the capacity strip counts nothing, and shows only when there is no other door

⚠️ **Rai saw `500` on his phone and refused the strip, and the reason is a
product rule rather than a taste** — written in his words because it will
come up again on other screens:

> أنا ونفسي كثيرٌ من الناس، لو ذهبنا إلى محلٍّ ووجدنا عليه زحمةً أو
> طابوراً، غيّرنا رأينا ولم ندخل. فعرضُ هذه الرسالة قد يُنفّر زبوناً
> محتملاً. دَعْه يدخل ويستكشف ما هو متوفّر.

⚠️ **That reverses the argument `500` built the count on** («the number is
the best reason to buy this week»). **The new decision stands and the old
one is deleted, not softened.**

### THE RULE
> **No count, no «full», no «left» on a screen the reader is browsing.
> The number is said inside `#/advertise` to whoever walked in by choice,
> never to whoever is passing.**

- **With a slot free — no strip at all.** The house slide is in the
  rotation and *is* the invitation; a strip under it saying the same thing
  one line down is a repetition. ⚠️ **Measured on his phone: «ضع إعلانك
  هنا» stood three times on one screen** — the slide, the strip, and the
  permanent block below. It is two now; if he wants one, that is another
  file and is not slipped in here.
- **Sold out — the strip alone, silent.** The house slide has left the
  rotation (`500`), so the strip is the only door and stays — but it reads
  **«ضع إعلانك هنا ›»** and nothing else: no number, no «مكتمل», no
  waiting list. ⚠️ **The text is the house slide's own, by his decision:
  whoever saw one knows the other.** It lands on `#/advertise/{product}`,
  where the whole truth is told to whoever entered — «محجوز بالكامل — أقرب
  تاريخ متاح · احجز دورك» — and that page is untouched.
- ⚠️ **Why the strip does not say «full» even though it would be true:**
  that is the queue at the shop door. **Honesty inside; the door outside is
  silent.**
- **`capAdvertise` is its own key**, not `adCtaSection` reused: that one
  carries `{sec}` and changes with the section, this one is fixed. Two
  keys for two jobs even while their letters coincide today. **The four
  old keys are deleted, not left** — their only reader was
  `adCapacityBarHtml`, and a key with no reader is read a month later as
  approved copy.
- `.cap-text` in `app.css` is left: this batch does not touch `styles/`,
  a rule with no element does no harm, and it goes the day `app.css` is
  opened for another reason.

**`test_v60` — four items reversed, none deleted, and the teeth:**
```
the old count put back on the strip   → 4.2 · 4.3 red
the strip drawn with a slot free      → 6.1 red
7.x untouched and green: with a slot free the house slide reaches #/advertise, sold out the strip does
```

```
116 runs · 58 suites · 6094 assertions · zero red · zero crash
```
## V.08.6 — the advertise page described a place that was not the place, and a second that was not the second

⚠️ **`#/advertise` is the one screen where we describe our product to
somebody about to pay, and a wrong description there is a promise sold and
not kept** — `337`'s rule. Measured on Home at 390 (member view):

```
categories row   ends at 301         the slider starts at 301
mini banner      at 826              525px below the categories · content height 752
```

**Six faults, all on the selling page:**
- **The mini banner's place was written wrong in four strings** — «تحت
  التصنيفات مباشرة» while the whole slider and the offers stand between
  them and the banner is under the fold. ⚠️ **«مباشرة» was the worst
  word**: a shop owner pictures a spot everyone sees on opening, pays, and
  finds their ad only after scrolling — heavier than a high price.
- **«Rotates every 7 seconds» while Home rotates it every 16.** ⚠️ **The 7
  was not invented — it was `mountAdRotator`'s default**, written into the
  copy the day the call still took it; the call moved on and the text did
  not. Same disease as `390` (prices) and `395` (the suite list): **a number
  written in two places parts after one edit.** So correcting 7 to 16 is
  not enough — it would part again.
- **The phone wireframe was inverted in two products**: the slider lit
  *above* the categories, the mini banner *right under* them. **Whoever does
  not read the line sees the picture.**
- **«أول ما يراه كل من يفتح التطبيق»** with the categories row above it —
  right in spirit, wrong in letter.
- ⚠️ **A placement we sell and never mention**: `MINI_ADS` also appears
  inside the magazine list every third article — same inventory, same
  buyer — and the page said nothing of it.

### THE RULE
> **Whatever the advertise page says about a place or a time is READ from
> the app and never written in a text that can part from it.**

- **`AD_ROTATE_MS = 10000` and `MINI_ROTATE_MS = 16000` in `data.js`**;
  Home rotates by them and the copy reads them through `{n}` — the
  substitution idiom the packs already use. **The values did not change:
  ten is ten and sixteen is sixteen. The batch fixes the text, not the
  behaviour.** And the counted noun goes through `arCount` with
  `plSecond`: «16 ثانية» · «10 ثوانٍ» — «16 ثوانٍ» is wrong Arabic.
  ⚠️ **The same `{n}` went into the market, events and magazine bullets**
  — three more written «10 ثوانٍ» that the rule covers equally.
- **The copy**: «أعلى الصفحة الرئيسية، بعد شريط التصنيفات» · «في الصفحة
  الرئيسية أسفل قسم العروض» · «ظهور متكرر بأقل سعر» · «أكبر مساحة في
  الشاشة الأولى» (true: 206px tall, above the fold). The «daily» bullet
  is gone — nothing in the app is daily; the banner sells by the month.
- **The wireframe**: slider `[bar, cats, LIT, block, block]` · mini
  `[bar, cats, block, block, LIT]` — **the mini banner as the last row
  says «below the fold» without a word.**

### The magazine placement is NOT mentioned yet, and that is the safe half
`505` gates the second place on **`sectionOpen`, which `365` builds** — and
`365` has not landed: the queue put `505` ahead of it by the owner's
decision (the drawing was inverted and he asked to see the placement).
⚠️ **Writing a second condition here is what the file forbids, and naming
the magazine while it holds no real article is the very promise this batch
exists to stop** — so the place is described as Home alone, `v61 · 7.1`
asserts the silence, and **`365`'s own file adds the second half behind its
gate.** Written into `docs/الحالة.md` as a deferred gap.

### The spec contradicted itself once, and the measurement settled it
Its §0 says the gap is «more than half a screen» (525) and the banner «140
below the fold»; its test line asked for «more than a whole screen». **The
same numbers refute the test line** (525 against 752), so `v61 · 1.1`
asserts what is true: below the fold, and more than half a screen down.

**`test_v61` — 23 assertions, nothing written as a number, and the teeth:**
```
«تحت التصنيفات» put back           → 2.1 · 4.1 red
a written 7 instead of the constant → 5.1 red
the slider wireframe inverted       → 8.1 red (both languages)
the magazine named with no gate     → 7.1 red
```

```
118 runs · 59 suites · 6140 assertions · zero red · zero crash
```

⚠️ **And `v6` went red on the first net — three items guarding the very copy `505` reversed** (the old place, four points, a total of 32). Rewritten with the reversal named, none deleted.

## V.08.7 — the advertiser sees the ad as people will see it, before paying

⚠️ **Rai's request** — «لمّا يدخل ويختار، يطلعله preview وين مكان الإعلان» —
settled as two things: the wireframe before buying (`505`) and **the real
preview, with his own ad, before paying.** And measuring what would be
previewed found the paid slide breaking its own promise twice:

- **The buyer's photo was collected, stored on the order, and never
  drawn.** Step 3 took it, `addAdOrder` kept it, `orderAsSlide` ignored it,
  and the slide rendered a megaphone over it — while the page promised
  «صورة وعنوان ووصف وزر إجراء».
- **The paid slide led back to Home.** No destination field, no `bizId` on
  the order, `link: '#/home'` — **the dearest product in the app, when
  tapped, returned the reader to the screen they were on.** And `v60` could
  not see it: it measures the rotation, not the destination.

### THE RULE
> **The preview is never built to show anything other than what will be
> shown.** One function draws the paid slide — `adSlideHtml` in `ui.js` —
> and Home, every section, the category strip and the preview all read it.
> **What the slide cannot do, the preview does not promise.**

- ⚠️ **There were THREE hand-written copies, not one.** `sectionSlider`,
  Home's `slideHtml`, and the directory's `catSlideHtml` — **and the third
  was the poorest: it carried no `data-route` at all, so a paid category
  strip led nowhere when tapped.** All three read the one function now;
  `v62 · 5.3` counts `slide-badge` across all of `js/` and demands one.
- **`orderAsSlide` reads `image` and `link` off the order as stored.** The
  photo is not reprocessed there — `mountPhotoPicker` is where it was
  downscaled and stripped of EXIF at capture.
- **Step 3 asks where a tap goes, and the choices are DERIVED**: one
  business → preselected with its name; several → a list, none chosen;
  none → a phone number is the only door; and a phone is offered in every
  case. ⚠️ **`next3` does not pass without a destination — an ad that
  leads nowhere is not sold.**
- **`tel:` in a route needed one line, in `go()`**: `location.hash =
  'tel:…'` is not a call, so a `tel:`/`mailto:`/`sms:` route is handed to
  `openExternal`, the door that already dials for the support number.
- **The preview stands above the invoice in step 4**, drawn by
  `adSlideHtml(previewSlide(), true, { share: false })` — **and `v62 ·
  3.1` compares its markup, after DOM serialisation, letter for letter
  with `adSlideHtml(orderAsSlide(the same content))`.** The day they part,
  the preview is a lie and the check says so. `pointer-events: none`: a
  tap on a real slide would carry the buyer to their own page and lose
  the order.
- **The photo takes the icon's exact place and size (86px)** — a slide
  with a photo and one without measure the same width and the title wraps
  no more (`v62 · 2.3`, by `offsetWidth`: the client rect would measure an
  inactive slide's transform, not its box).
- **Old orders with no image and no link draw as they did** — megaphone
  and `#/home`; `a.link || '#/home'` is a guard for readers' existing
  devices, never a default for new orders.

⚠️ **Two things the suite had to learn.** `script-src 'self'` refuses
`eval` inside `page.evaluate` — the app's own module is reached by a
dynamic import, `arabna/js/…` first (the importmap name that hits the SAME
instance on the single-file build). And `outerHTML` re-serialises
`<polyline …/>` as `<polyline …></polyline>`: **both sides go through a
`<template>` before a letter-for-letter comparison**, or the check measures
serialisation instead of content.

**`test_v62` — 17 assertions, and the teeth:**
```
a hand copy back in sectionSlider, one letter off   → 5.3 red  (3.1 unaffected by design: it compares the preview with orderAsSlide, and a section copy reaches neither)
image dropped from orderAsSlide                      → 1.1 · 1.3 red
```

## Known open items
- **The header image is still far larger than its box.** V.04.7 replaced
  the 831/837 KB lockups with the cropped marks at **333/338 KB** — 60% off
  the header's own asset and off the theme flip — but 659×649 for a 66×65
  box is still ten times the displayed size. The crop is what file `020`
  specified and it is done; **generating the mark at ~3× (roughly 200px)
  belongs to the performance batch**, along with the same question for
  every other image in `assets/`.
- **Nothing in the app is reachable by keyboard**: 515 directory rows with
  no `tabindex` and no Enter handler, Escape closes neither a sheet nor the
  drawer, and only three elements have a visible focus ring. Assigned to
  batch (و), the desktop one.
- **Zero of the 514 listings has coordinates**, so «الأقرب», the mile
  figures, «قريب منك» and the radius filter are all inert — and the
  fallback ranks on a rating that is 0 on all 485 real records. A data job
  outside the app, and half of the later batch-nine files depend on it.
- **`APP_VERSION` in `data.js` is raised by hand** with the version line at
  the top of this file. It is one constant; two hand-typed literals is what
  it replaced.
- **`SUPPORT_PHONE` is empty and needs a real number from Rai.** It held
  `(713) 555-0199` — a reserved fictional exchange — so every legal page
  published a `tel:` link that rang nowhere. One line in `js/store.js`
  brings the line back on all three pages at once; the email is published
  there meanwhile.
- Legal pages are first drafts — a lawyer must review before public launch.
- Push notifications: triggers are defined in Settings but not wired to a real service.
  The prayer settings name a pre-adhan alert as coming later, for the same reason.
- **The jumuah and iqama times are empty on 33 of the 35 places of worship.**
  They cannot be computed and no service publishes them; they arrive from the
  mosques themselves and from the congregation's corrections. Six of the
  masjids are ISGH and three share one central line, so the real number of
  calls is nearer fifteen than thirty-three — that is the owner's job, not
  the code's.
- Admin panel is intentionally minimal (moderation queue, magazine editor, ad approval).
- Prices are placeholders chosen by Claude — the owner will set final pricing.
- The 29 development seeds and every seed review in `data.js` must be deleted
  before launch (FTC rule of October 2024 on reviews). They now carry `demo: true`
  and live in `DEMO_BUSINESSES` / `DEMO_REVIEWS`, so it is two arrays and the
  admin switch, not a hunt.
- The subscription test clock in admin → settings goes with the demo data.
- `personKey()` is a stand-in for real user ids: blocking keys on a listing's
  owner or a review's author until V.02 brings accounts on a server.
- **The admin users section is deferred to the server batch**, and so is any
  count that spans devices. One account exists on one device, so the screen
  would show Rai looking at himself.
- **The receipt has no issuer.** «عربنا — [الاسم القانوني والعنوان]» is a
  literal `[TODO]` on every receipt until Rai gives the registered name
  and address. A receipt with no issuing party is not a receipt, and this
  is not something to invent.
- **Sales tax is unanswered.** The line is on every receipt at `$0.00` and
  the rate belongs in Settings, not in the code — but whether Texas
  charges sales tax on a digital subscription is a question for an
  accountant, and the answer is needed **before the first sale**, not
  after.
- **Email receipts wait for the server.** The button exists and says so.
  Sending mail needs a host and a domain with SPF and DKIM.
- **The password hash is not a substitute for a server.** SHA-256 with a
  salt is enough to stop the word sitting in the clear on a reader's own
  disk; it is not password storage. bcrypt or argon2 on the server, or —
  better — Supabase Auth, which never hands us the password at all.
- **`ADMIN_PASS = 'Arabna@2026!'` is still in `store.js`**, in a file every
  visitor downloads. It satisfies every condition the new rule imposes and
  is known to anybody who opens the file, which is the whole argument that
  a password's strength lives in **where it is kept**.
- **The descriptions repeat the city the address already gives.** «مطعم
  لبناني في Houston» sits two lines above `…, Houston, TX 77081`, and the
  directory card says it as well. Rai asked for the city kept and written
  in English, which is what shipped; dropping it from the descriptions
  entirely is a one-line change to the source file if he prefers it.
- **«فانوس» returns two, and the wrong one leads.** V.03.0 tagged b226
  «استفانوس» (St Stephen), and «فانوس» sits inside it — a real Arabic
  substring collision, not a bad tag: a word the reader typed matches
  anywhere by design, and only a dictionary substitution has to end on a
  boundary. Both results are found; the church is first because stage one
  returns file order. Ranking a name match ahead of an incidental one — the
  tier `adminSearchBusinesses` already uses — would fix it, and is a search
  change that belongs in a search batch, not at the end of this one.
- **The newcomer's guide is a shell with working doorways.** Eight parts,
  eight buttons that all land on real listings, and placeholder copy that
  says so. Rai writes the text; nothing may invent a government procedure.
- **Ramadan has almost no data behind it.** Three seasonal attributes on
  four businesses, all of them demo seeds — no imported record carries one.
  The switch, the bar, the filters and the counts all work; filling
  `iftar` / `suhoor` / `ramadanHours` on the real listings is a data job,
  and its moment is a month before Ramadan, not the night of.
- **The drawer scrolls when a group is open, and V.03.9 made it worse** —
  «مواعيد القداس» costs 50px, so with «تصنيفات عربنا» open the panel is
  **966/844 at base 17** (990 at «كبير», 1024 at «أكبر») against 916
  before. That is **more than two rows past** the drawer's standing rule
  that it never scrolls; «حسابي» has been over since before V.03.1. One
  row anywhere fixes every size at once. **Which row to drop is the
  owner's call, and it has been open since V.03.2** — the section group
  now holds prayer times, mass times, the newcomer guide, events, the
  magazine, featured listings and all-categories.
- **None of the 514 listings has coordinates yet.** That is a data job done
  outside the app (admin → directory exports the addresses). Until they
  arrive the app shows each listing's area name, never a figure in miles,
  the mile options stay out of the filter sheet, and "nearest" falls back to
  the reader's own city and the rating.
