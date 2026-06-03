# DUSKIN 銷售系統 — Design System

A field-sales CRM design system, reverse-engineered from the **DUSKIN 銷售系統** ("DUSKIN Sales System") web app. This folder gives a design agent everything it needs to produce on-brand interfaces, screens, and assets for the product — colours, type, iconography, components, and high-fidelity UI-kit recreations.

---

## What is this product?

**DUSKIN 銷售系統** is a mobile-first **PWA CRM built for outside-sales reps** at a DUSKIN cleaning-products franchise in Taiwan. DUSKIN runs a **rental / route-service model**: customers don't buy mops and mats outright — they rent them on a recurring **2-week (2W) or 4-week (4W) cycle**, and a rep swaps fresh product on a regular visit route.

The app helps a rep do the whole job from a phone, often offline in the field:

- **客戶 (Clients)** — customer records with a sales-pipeline status, address, contact, environment notes; list **and** map views.
- **日報 (Daily report)** — auto-rolled-up summary of a day's visits.
- **待辦 (Todos)** — every customer's open to-dos in one place.
- **查詢 (Search)** — search the company's existing customer roster (`shops`) and an industrial-zone prospect list (`prospects`).
- **庫存 (Inventory)** — track stock carried in the rep's car (mats / mops / fragrance), quick ±1, low-stock list.
- **設定 (Settings)** — product database, Google Sheets sync, version, JSON backup.
- **報價/合約 (Quote / Contract)** — one-tap Word `.docx` quote & service-contract generator, integrated from the sibling [contractmaker](https://github.com/coookiepan/contractmaker) repo.
- **長官儀表板 (Manager dashboard)** — read-only roll-up across multiple reps' spreadsheets (`?admin=1`).

It is a single self-contained `index.html` (~6,800 lines) that stores data in `localStorage` and syncs to **Google Sheets via Apps Script** — zero-cost deploy on GitHub Pages, no build step, no framework.

### Product surfaces represented here
There is effectively **one product** with several surfaces. The UI kit recreates the primary one:
- **Field-rep app** (`ui_kits/field-app/`) — the six-tab mobile CRM. This is the heart of the system.

---

## Sources

Everything here was lifted from real source code. The reader is encouraged to explore these repositories to build more accurately:

- **Primary app** — https://github.com/coookiepan/salesystem
  - `index.html` — the entire app (design tokens, components, screens, data). Lifted into `_source/index.html` for reference.
  - `GUIDE.md` — non-technical setup + feature guide (great product-copy reference). In `_source/GUIDE.md`.
  - `manifest.webmanifest`, `icon.svg` — PWA identity.
- **Quote / contract generator** — https://github.com/coookiepan/contractmaker (`報價產生器`), integrated into the app as the `📄 報價／合約` modal.

> The reader may or may not have access to these repos. They are recorded here so the design system can be regenerated or deepened later.

---

## Content Fundamentals

**Language.** Traditional Chinese (Taiwan / 繁體中文). Product nouns mix Chinese with industry codes (`S-20`, `DECSLR`, `AFDW`) and unit shorthand (`2W`, `4W`, `300ml`).

**Voice.** Plain, warm, practical — written *for a busy non-technical salesperson on their feet*. The setup guide literally opens "不需要任何技術背景，只要照著做就好！" ("No technical background needed, just follow along!"). It addresses the reader directly as **你 (you)**.

**Tone in the UI vs. the docs.**
- **In-app UI copy is terse and functional**: nav labels are single words (`客戶`, `日報`, `待辦`, `查詢`, `庫存`, `設定`); buttons are short verbs (`+ 新增`, `編輯`, `刪除`, `返回`, `重新載入`); placeholders are concrete examples (`陳小姐 / 老闆`, `06-1234567`, `門口有無地墊、廁所...`).
- **Docs / release notes are friendly and reassuring**, framed around *what the user will feel*: section titles like "更不會掉資料、更穩、更快" ("less data loss, more stable, faster") and "你需要做什麼？" ("What do you need to do?" → usually "nothing").

**Casing & punctuation.** Chinese has no casing; the one place Latin casing matters — uppercase eyebrow labels (`基本資料`, section headers) — uses `text-transform:uppercase` + wide letter-spacing on Latin/symbol runs. Full-width Chinese punctuation （、，。「」）is used in prose. Interpuncts `·` separate inline meta.

**Emoji.** Used **liberally and deliberately** as wayfinding and status, never as decoration-for-decoration's-sake:
- Feature/action affordances: `📄 報價／合約`, `⚡ 快速報價`, `🗺 地圖`, `🔄 重新載入`, `⚙️` (filter), `🩺` (diagnostics), `🏭` (industrial list), `🆕` (new item).
- Mood ratings on a visit log: `😞 😐 😊 😄`.
- Doc structure: `📋 ✅ 🔍 📦 👥 📅 ☁️ 📱`.
- Sync/state: `🌥` (cloud-stale banner), `🎉 🎊` (success).
> When designing **new** DUSKIN material, emoji are on-brand in headings, buttons, and status — but the underlying UI chrome (nav, cards) leans on **line icons**, not emoji.

**Examples of real copy:**
- Empty/helper: `公司現有客戶名單（從雲端載入）` ("Company's existing customer list (loaded from cloud)").
- Warning: `⚠ 本機儲存空間已滿，最新修改可能無法保存…請先點「推送到雲端」備份資料` .
- Pipeline statuses (the product's spine): `未拜訪 · 初訪 · 複訪 · 試用中 · 報價 · 將成約 · 已成約 · 已轉交 · 拒絕`.

---

## Visual Foundations

A **calm, warm, single-accent, near-flat** system. It reads like a well-built native iOS/Android utility app, not a marketing site. Restraint is the whole point — one green does all the "brand" work; everything else is warm grey.

**Colour vibe.** Backgrounds are **warm off-whites** (`--bg #fff` → `--bg2 #F8F8F5` → `--bg3 #EFEEE9`) — paper-ish, slightly green-shifted, never cold blue-grey. Text is **near-black warm** (`#14140F`), not pure `#000`. The single brand accent is a confident **teal-green** (`--green #12A673`, deep `--theme #085041`). Semantic colours (red/amber/blue/purple) are **muted and desaturated** — used only in status badges, alerts, and the map legend, never as fills competing with the green. A full **dark mode** ships via `prefers-color-scheme`.

**Type.** The product's own stack is **system fonts** — `-apple-system / SF Pro / PingFang TC / Microsoft JhengHei`. For consistent, comfortable rendering everywhere (the bare CJK fallback can look rough on non-Apple OSes), `colors_and_type.css` **web-loads `Inter` (Latin) + `Noto Sans TC` (Traditional Chinese)** ahead of that native stack — Inter was already named in the product's own font list, so this is a faithful, not invented, choice. *(Substitution flag: Noto Sans TC stands in for PingFang TC / Microsoft JhengHei, which can't be web-delivered — swap back to the system stack for production if you prefer the native look.)* Hierarchy comes from **size + weight**, not family: 600 for titles/stats (deliberately not 700 — it reads heavy), 500 for buttons/labels, 400 body. Base `14.5px`, line-height `1.55`. Negative letter-spacing on big text; wide positive tracking on uppercase eyebrows (`.1em`). Numbers (prices, codes, stats, stock) use **`font-variant-numeric:tabular-nums`**, with a thin space kept between digits and adjacent CJK / currency / units so figures breathe.

**Spacing & radius.** Compact, mobile-first density. Radius scale is small and consistent: **`6px` (controls), `10px` (cards), `14px` (modals)**. Pills are full-round `999px`. Card padding `14–18px`; gaps `6–12px`.

**Backgrounds.** Flat fills only. **No gradients, no images, no patterns, no textures** anywhere in chrome. The only "image" surfaces are the Leaflet map tiles (client map) and user-added customer photos. Depth comes from borders + faint shadows, not colour washes.

**Borders.** The workhorse of the system. Almost every surface is a `1px solid var(--border)` (`#E8E7E0`) hairline on white. Hover deepens the border to `--border2` (`#D4D3CB`) rather than adding shadow. Dividers between rows are the same hairline. This is a **border-led, not shadow-led** system.

**Shadows.** Deliberately **minimal and low-alpha**, neutral-tinted (`rgba(20,20,15,…)`), reserved almost entirely for **overlays** (modals `--shadow-lg`, popovers `--shadow-md`, the floating version badge). Resting cards get **no shadow** — just a border. There are no glows.

**Elevation / transparency / blur.** Used sparingly and only on **floating chrome**: the bottom nav, the version badge, and the desktop sticky tab bar use `backdrop-filter: saturate(180%) blur(18px)` over a `color-mix(...92%,transparent)` translucent surface — a frosted-glass system bar. Modals dim the page with `rgba(10,10,10,.42)` + a light `blur(3px)`. Body content itself is never blurred or translucent.

**Corner radii recap.** Controls/inputs/buttons `6px` · cards/list items/inventory `10px` · modals/contract panel `14px` · badges `4px` (squarer, tag-like) · pills & avatars/dots `full`.

**What a card looks like.** White (`--bg`) · `1px` hairline border · `10px` radius · `14–18px` padding · **no shadow at rest**. A *clickable* card (`.cc`, customer card) adds `cursor:pointer` and, on hover, deepens the border **and** shifts background to `--surface-hover`; on `:active` it drops to `--bg2`. Trial-item rows are inset on `--bg2` with a 2px left accent that greens on hover.

**Animation.** Subtle and fast. Standard transition is **`.12s var(--ease)`** where `--ease = cubic-bezier(.22,.61,.36,1)` (a gentle ease-out, **no bounce, no overshoot**). Entrances are small: modals `fadeIn .15s` + `translateY(8px)→0`; toasts/banners slide `~12–16px`; panels cross-fade `.15s`. Looping animation is confined to **status indicators** — a sync shimmer, a pulsing sync dot. Respect a quiet, utilitarian feel: motion confirms, it never performs.

**Hover states.** Surfaces deepen their **border** and/or shift to a faint warm tint (`--surface-hover`). Primary button → darker green (`--green-d`). Outline button → `--surface-hover` bg + darker border. Icon buttons → `--bg3` background. Links/edit affordances → from `--text3` to `--text`. Hover is always a *small step*, never a colour pop.

**Press / active states.** Buttons darken one more step (primary uses `filter:brightness(.95)`); outline/cards drop to `--bg2`; nav buttons flash `--bg2`. **No scale-down/“squish”** — this system signals press with **colour, not transform**. `-webkit-tap-highlight-color:transparent` kills the mobile blue flash.

**Focus.** A consistent **green focus ring** `0 0 0 3px rgba(18,166,115,.18)` plus a green border on inputs; `:focus-visible` on buttons. Accessible and unmistakably brand.

**Status colour language (the system's signature).** Pipeline statuses each map to a muted **tint-bg + deep-fg** badge pair — this is the most recognisable DUSKIN-app pattern:

| Status | bg / fg | Hue |
|---|---|---|
| 未拜訪 (unvisited) | `#F1EFE8 / #444441` | warm grey |
| 初訪 / 試用中 (first visit / trialing) | `#E6F1FB / #0C447C` | blue |
| 複訪 / 報價 (revisit / quoted) | `#FAEEDA / #633806` | amber |
| 將成約 (closing) | `#EEEDFE / #3C3489` | purple |
| 已成約 (closed-won) | `#E1F5EE / #085041` | green |
| 已轉交 (handed-off) | `#D4EDDA / #155724` | green |
| 拒絕 (refused) | `#FCEBEB / #A32D2D` | red |

Product **category** badges follow the same recipe: 拖把 (mops) purple `#EEEDFE/#3C3489` · 地墊 (mats) blue `#E6F1FB/#0C447C` · 芳香 (fragrance) green `#E1F5EE/#085041`. Map pins use solid versions of the same hues.

**Layout rules.** Mobile-first single column, `max-width:880px` content well centred on desktop. **Fixed chrome:** bottom tab nav (mobile) that becomes a **sticky top tab bar** at `≥700px`; a floating centered version badge; a 2px top sync-progress bar. Safe-area insets (`env(safe-area-inset-bottom)`) are honoured for notched phones. Content padding accounts for the fixed nav.

---

## Iconography

**Primary icon system: inline line icons, Feather/Lucide family.** The app draws its UI icons as **inline `<svg viewBox="0 0 24 24">` with `stroke:currentColor; fill:none; stroke-width:1.8` (nav) / `2` (controls), round caps & joins** — i.e. the **Feather** visual language (Lucide is the maintained successor and a 1:1 substitute). They inherit colour from text, so an active nav icon turns green simply via `color`.

Real examples in the source: `users` (客戶), `calendar` (日報), `check-square` (待辦), `search` (查詢/放大鏡), `box`/package (庫存), `settings` gear (設定), `chevron-left` (返回), `list` + `map-pin` (list/map toggle).

> **For new DUSKIN work, use [Lucide](https://lucide.dev) (CDN) at `stroke-width:1.8–2`, `currentColor`.** It is stroke-compatible with the Feather icons already in the product. The UI kit links Lucide from CDN and is documented in `ui_kits/field-app/README.md`. *(Substitution flag: the source inlines hand-picked Feather paths rather than importing a library; Lucide is the closest maintained match and is used here intentionally.)*

**Emoji as a second icon layer.** Alongside line icons, the product uses **emoji as glyphs** for features, moods, and status (see Content Fundamentals). Treat emoji as legitimate iconography here — they appear in real buttons (`📄 ⚡ 🗺 🔄`), the mood picker (`😞😐😊😄`), and section headers.

**Unicode symbols.** A few non-emoji unicode marks are used as micro-icons: `×` (close), `·` (meta separator), `←`/chevrons (back), `±`/`+1`/`-1` (inventory steppers), `✓` (done).

**Logo / app mark.** `assets/logo-mark.svg` — a `512×512` **rounded-square (116px radius) plate in `--theme #085041`** carrying a **“P”-form duck monogram**: a bold white letterform (the letter “D” turned so it reads as a P) whose **bowl doubles as a duck’s head** — the round counter becomes the **eye**, and an **amber `#EF9F27` bill** protrudes from the right. It fuses the brand initial with the duck mascot, stays legible at any size, and works as a `purpose:"any maskable"` PWA icon. The PWA `theme_color` is the same `#085041`. The original repo shipped a plain "D" monogram (`assets/icon.svg`, kept for reference); this mark supersedes it. The mark plus the words "DUSKIN 銷售系統" function as the lockup.

---

## Index — what's in this folder

| Path | What |
|---|---|
| `README.md` | This file — product context, content & visual foundations, iconography. |
| `colors_and_type.css` | All design tokens as CSS vars (brand, semantic, neutral, radius, shadow, motion) + semantic type scale. Import this first. |
| `SKILL.md` | Agent-Skill manifest so this folder works as a downloadable Claude skill. |
| `assets/` | Brand assets — `logo-mark.svg` (“P”-form duck monogram), `icon.svg` (original "D" monogram, reference). |
| `preview/` | Small design-system specimen cards (colours, type, components, status language) shown in the Design System tab. |
| `ui_kits/field-app/` | High-fidelity, interactive recreation of the six-tab field-rep CRM. `index.html` + JSX components. Start here to build real screens. |
| `_source/` | Read-only reference copies of the original repo files (`index.html`, `GUIDE.md`, `manifest.webmanifest`). |

### UI kits
- **`ui_kits/field-app/`** — the field-rep mobile CRM: bottom/sticky nav, client list + status pills, client detail with trial items & visit log, inventory, daily report. See its own `README.md`.

---

## Quick start for a designer

1. Link `colors_and_type.css` (or copy the `:root` block) — never hard-code hexes.
2. Stay **border-led**: hairline `--border` surfaces, deepen border on hover, shadows only on overlays.
3. One accent. Green is for **action and "won"**; everything structural is warm grey. Reach for a semantic hue **only** for status/alerts.
4. Icons: Lucide line icons at `1.8–2` stroke, `currentColor`. Emoji are fine for feature/mood/status.
5. Numbers get `tabular-nums`. Statuses get the tint-bg/deep-fg badge pair from the table above.
6. Keep motion to `.12s` ease-out, colour-not-scale press, no bounce.
