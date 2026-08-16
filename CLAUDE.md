# ARABNA — project context for Claude (Claude Code / Cowork)

اقرأ هذا الملف أولاً قبل أي تعديل. This file is the handoff context — read it before editing.

## What this is
ARABNA · عربنا — a mobile-first web app for the Arab community in the U.S.:
**business directory + personal classifieds + magazine**, Arabic-first with a full English toggle.
Current version: **V.01 (prototype)**. Owner: Rai Elby (@dbprime). Deploys to Vercel (team DB Prime).

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
js/screens/*.js       home · directory · classifieds · magazine · auth · advertise · profile · admin
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
| Classifieds | free + paid "Boost" ($2–8) |
| Magazine | native banners between articles + sponsored stories ($199+) |

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
| Cloudflare R2 (media) | upload buttons in `screens/classifieds.js`, `screens/advertise.js` |
| Geocoding | `lookupZip` in `screens/home.js` (currently local table + api.zippopotam.us) |

Screens never touch storage directly — they only call `store.js`.

## Demo credentials (prototype only)
Verification code `123456` · accepted mobile `(713) 466-9182` · rejected as VOIP: anything
starting 555/800/888 · admin panel `#/admin` password `arabna2026` · payments are simulated.

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
