---
name: duskin-design
description: Use this skill to generate well-branded interfaces and assets for DUSKIN 銷售系統 (a Traditional-Chinese, mobile-first field-sales CRM), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Where things are
- `README.md` — product context, content & visual foundations, iconography. **Start here.**
- `colors_and_type.css` — all design tokens (colours, type scale, radius, shadow, motion) as CSS vars. Link it or copy the `:root` block; never hard-code hexes.
- `assets/` — `logo-mark.svg` (the "P"-form duck monogram), `icon.svg` (original "D" reference).
- `preview/` — small specimen cards (colours, type, components, status language) — handy reference for exact values.
- `ui_kits/field-app/` — interactive recreation of the six-tab CRM; reusable React components for real screens. Read its `README.md`.

## Non-negotiables when designing for DUSKIN
- **One green accent.** `--green #12A673` (deep `--theme #085041`) for action and "won"; everything structural is warm grey on hairline borders. Semantic hues only for status/alerts.
- **Border-led, not shadow-led.** Hairline `--border` surfaces; deepen the border on hover; shadows only on overlays (modals/popovers).
- **Status vs. category.** Status = a coloured state pill with a leading dot. Category = a uniform hairline tag with a colour swatch. Keep them visually distinct.
- **Line icons, not emoji, in chrome.** Feather/Lucide at `1.8–2` stroke, `currentColor`. Moods are stroked faces. Emoji are acceptable only in doc-style headings.
- **Type:** Inter (Latin) + Noto Sans TC (CJK); weight-led hierarchy, titles 600 (not 700). Numbers use `tabular-nums` with a thin space between digits and adjacent CJK / currency / units.
- **Motion:** `.12s` ease-out, no bounce; press signals with colour, not scale.
- **Language:** Traditional Chinese (Taiwan), warm and practical, addresses the user as 你.

## Source
Reverse-engineered from https://github.com/coookiepan/salesystem (+ the quote/contract generator https://github.com/coookiepan/contractmaker). Explore those repos to go deeper.
