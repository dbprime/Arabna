# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + marketplace + events + magazine**, Arabic-first with a full English toggle.
("Classifieds / الإعلانات الشخصية" is now "Marketplace / السوق" — the old `#/classifieds`
routes still resolve so shared links keep working.)
Current version: **V.04.7 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

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
tools/e2e/               the Playwright suites, v3–v27, plus run.sh and the i18n check
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
tests**. The whole set is 37 suites × 2 builds and takes about twenty
minutes; running it after every edit eats the session and leaves the work
unfinished — four calls is an hour and a half of testing before a line is
written. And more parallelism does not help: the machine has two cores and
`run.sh` already has both busy with the two builds, so the way out is
**fewer suites, not faster ones**.

| when | what | measured |
|---|---|---|
| **after every change** | `tools/audit/quick.sh` | **~100s** — the static pass and all 41 screens in both languages |
| **while working on one area** | `SUITES="33 37" tools/e2e/run.sh` | seconds to a minute — only what your change touches |
| **once, at the end of a session** | `tools/audit/daily.sh` | **~20 min** — the second build, the four roles, the admin panel, everything |

`quick.sh` is `index.html` only, on purpose: the single-file build comes
from the same source, and a fault in it alone is rare and of a known kind
(`esc()` and CSP), which `daily.sh` catches at the end. **Doubling the gate's
time for a rare case removes the point of having a gate.** What it does not
check: the second build · the four roles · the admin panel · the calendar ·
the deep cases in the other thirty-six suites.

**Which suites touch what**, for the middle row:

```
the city chip and location   33 · 37        the calendar and feasts   36
the directory list/filters   37 · 38        the admin panel           38
prayer and mass              read each file's own header — it says what it covers
```

**If you do not know which one covers your change, run three, not
thirty-seven** — and the full set at the end catches what you missed.

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

## Testing before you ship a change
```
python3 -m http.server 8099        # from the repo root
node tools/e2e/chk_i18n.mjs        # both packs, every derived key, seconds
tools/audit/quick.sh               # the fast gate — ~100 seconds
tools/audit/daily.sh               # everything, once at the end — ~20 minutes
python3 tools/build_single.py > index-single-file.html
```
1. `tools/e2e/` holds every suite, v3 to v39, one per batch, and `run.sh`
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
