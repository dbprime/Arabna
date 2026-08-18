# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + marketplace + events + magazine**, Arabic-first with a full English toggle.
("Classifieds / الإعلانات الشخصية" is now "Marketplace / السوق" — the old `#/classifieds`
routes still resolve so shared links keep working.)
Current version: **V.02.1 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

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
js/ui.js              toast / sheet / drawer / header / nav primitives
js/icons.js           inline SVG icons
js/screens/*.js       home · categories · directory · marketplace · events · magazine ·
                      auth · advertise · profile · admin
manifest.json         PWA manifest (installable; NO service worker until V.02)
assets/icons/         32 · 180 · 192 · 512 · 1024 icons generated from logo.png,
                      solid navy background (iOS rejects transparency)
index-single-file.html  generated single-file build (backup / offline demo)
```

## Design language
Navy `#0B1526` · surface `#141F3B` / `#1C2A4D` · gold `#C6A15B` / `#E4C77E` ·
ivory `#F3F1EC` · muted `#8B93AC` · success `#4E8B6B`.
Base font-size 16px, generous spacing, large tap targets (buttons ≥ 52px).
Icons are sized inline via `icon('name', size)`.

## Monetization map
| Section | Revenue |
|---|---|
| Home main slider | highest-priced ad placement ($149+/week) |
| Home mini banner | cheaper ad tier ($49+/week) |
| Directory | $29/month business subscription — unlimited photos + video, eligibility for the gold badge, category ranking, "featured this week", **"your page, only yours"**, stats, offers. **Reviews are NOT on it** (see below) |
| Marketplace | free + paid "Boost" ($2–8); the Handyman section caps at 1 listing / 14 days and upsells the directory subscription |
| Magazine | native banners between articles + sponsored stories ($199+) |
| Events | "Featured Event" pin at the top of the section ($99+/week, `AD_PRODUCTS.event`) |
| Accounts | paid blue verification badge — price lives in `VERIFY_BADGE_PRICE` (currently 0 = free while unpriced) |
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
admin panel reachable **only** by typing `#/admin` (not linked from the drawer or profile),
username `arabna.admin` password `Arabna@2026!` — defaults in `js/store.js`, and the owner can
change the password from the panel's Settings tab (stored in `state.adminAuth`). The username
compare is case-insensitive + trimmed so iOS auto-capitalisation cannot lock you out ·
payments are simulated.

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
  time. Visitor: guest head · one invite card (sign up + "have an account?") · language ·
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
  plan, verified, rating, reviewCount, dist, claimed, photos, videos,
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

## Testing before you ship a change
1. Serve locally (`python3 -m http.server`) and click through: home → directory → listing →
   classifieds → post → magazine → advertise → admin.
2. Check **both** languages (the AR/EN button in the header) — layout must mirror correctly.
3. Confirm the logo renders and no console errors.
4. Regenerate the single-file build if you changed any source file.

## What is actually in `data.js` now (V.02.1)
**515 businesses**: 29 invented development seeds (`b1`–`b29`) and **486 real
Houston listings** entered by the owner and brought in through the admin
importer — 412 businesses as `b30`–`b441` and 74 outings as `b442`–`b515`.
Both export files began at `b30`, so the outings ids were shifted by 412
rather than renumbered by hand.

| | | | |
|---|---|---|---|
| restaurants 139 | grocery 42 | worship 35 | cafe 32 |
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

## Known open items
- Legal pages are first drafts — a lawyer must review before public launch.
- Push notifications: triggers are defined in Settings but not wired to a real service.
- Admin panel is intentionally minimal (moderation queue, magazine editor, ad approval).
- Prices are placeholders chosen by Claude — the owner will set final pricing.
- The 29 development seeds and every seed review in `data.js` must be deleted
  before launch (FTC rule of October 2024 on reviews).
- `dist` is 0 on all 486 imported listings until geocoding lands, so "nearest"
  sorting and the radius filter do nothing for them.
