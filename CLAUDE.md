# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + marketplace + events + magazine**, Arabic-first with a full English toggle.
("Classifieds / الإعلانات الشخصية" is now "Marketplace / السوق" — the old `#/classifieds`
routes still resolve so shared links keep working.)
Current version: **V.01.7 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

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
| Directory | $29/month business subscription (reviews, 10 photos, 3 videos, verified badge) |
| Marketplace | free + paid "Boost" ($2–8); the Handyman section caps at 1 listing / 14 days and upsells the directory subscription |
| Magazine | native banners between articles + sponsored stories ($199+) |
| Events | "Featured Event" pin at the top of the section ($99+/week, `AD_PRODUCTS.event`) |
| Accounts | paid blue verification badge — price lives in `VERIFY_BADGE_PRICE` (currently 0 = free while unpriced) |

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

## Testing before you ship a change
1. Serve locally (`python3 -m http.server`) and click through: home → directory → listing →
   classifieds → post → magazine → advertise → admin.
2. Check **both** languages (the AR/EN button in the header) — layout must mirror correctly.
3. Confirm the logo renders and no console errors.
4. Regenerate the single-file build if you changed any source file.

## Known open items
- Legal pages are first drafts — a lawyer must review before public launch.
- Push notifications: triggers are defined in Settings but not wired to a real service.
- Admin panel is intentionally minimal (moderation queue, magazine editor, ad approval).
- Prices are placeholders chosen by Claude — the owner will set final pricing.
