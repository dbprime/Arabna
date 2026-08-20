# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + marketplace + events + magazine**, Arabic-first with a full English toggle.
("Classifieds / الإعلانات الشخصية" is now "Marketplace / السوق" — the old `#/classifieds`
routes still resolve so shared links keep working.)
Current version: **V.02.8 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

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
js/synonyms.js        the search dictionary — expands the QUERY, never the data
tools/synonyms.test.mjs  runs all 989 words against the real listings
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
| Directory | $29/month business subscription — unlimited photos + video, eligibility for the gold badge, category ranking, "featured this week", **"your page, only yours"**, stats, offers. **Reviews are NOT on it** (see below) |
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

## Testing before you ship a change
1. Serve locally (`python3 -m http.server`) and click through: home → directory → listing →
   classifieds → post → magazine → advertise → admin.
2. Check **both** languages (the AR/EN button in the header) — layout must mirror correctly.
3. Confirm the logo renders and no console errors.
4. Regenerate the single-file build if you changed any source file.

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
`js/synonyms.js` — **100 groups, 989 words**. Every array is a set of words
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

## Known open items
- Legal pages are first drafts — a lawyer must review before public launch.
- Push notifications: triggers are defined in Settings but not wired to a real service.
- Admin panel is intentionally minimal (moderation queue, magazine editor, ad approval).
- Prices are placeholders chosen by Claude — the owner will set final pricing.
- The 29 development seeds and every seed review in `data.js` must be deleted
  before launch (FTC rule of October 2024 on reviews). They now carry `demo: true`
  and live in `DEMO_BUSINESSES` / `DEMO_REVIEWS`, so it is two arrays and the
  admin switch, not a hunt.
- The subscription test clock in admin → settings goes with the demo data.
- `personKey()` is a stand-in for real user ids: blocking keys on a listing's
  owner or a review's author until V.02 brings accounts on a server.
- **None of the 514 listings has coordinates yet.** That is a data job done
  outside the app (admin → directory exports the addresses). Until they
  arrive the app shows each listing's area name, never a figure in miles,
  the mile options stay out of the filter sheet, and "nearest" falls back to
  the reader's own city and the rating.
