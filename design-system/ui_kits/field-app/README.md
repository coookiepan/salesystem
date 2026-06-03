# DUSKIN Field-App — UI Kit

A high-fidelity, interactive recreation of the **DUSKIN 銷售系統** field-rep mobile CRM (the six-tab app in [coookiepan/salesystem](https://github.com/coookiepan/salesystem)). It reproduces the product's look and core click-through flows as reusable React components — cosmetic, not production logic.

Open `index.html` to use it: it boots into the **客戶 (Clients)** tab inside a phone frame. Tap a client to see the detail screen, add a visit with a mood, add a new client, switch tabs to **日報 / 待辦 / 查詢 / 庫存 / 設定**, and adjust car-stock with the ±1 steppers.

## What's covered

| Screen | Components | Interactions |
|---|---|---|
| **客戶 list** | `ClientList`, `StatusPill`, `CategoryTag`, hot filter pills | filter by status, live search, open a client, add new |
| **客戶 detail** | `ClientDetail`, trial items, visit log, mood picker, to-dos | record a visit (mood + note), tick to-dos, quote/contract action buttons |
| **新增客戶 form** | `ClientForm` | fill & save a new client (appears in the list) |
| **日報 (daily)** | `DailyReport`, `StatCard` | roll-up stats + conversion bar + recent visits |
| **待辦 (todos)** | `Todos` | all clients' to-dos, filter done/open, tick off |
| **查詢 (search)** | `Shops` | search the company roster |
| **庫存 (inventory)** | `Inventory` | category filter, search, ±1 stock steppers, low-stock amber |
| **設定 (settings)** | `Settings` | product DB, sync status, version |
| chrome | `AppBar`, `StatusBar`, `BottomNav` | six-tab nav, sticky frame |

## Files

- `index.html` — entry; loads React (pinned), the token CSS (`../../colors_and_type.css`), `styles.css`, then the scripts in order.
- `styles.css` — component styles lifted from the source, layered on the design-system tokens.
- `data.js` — seed clients, products, inventory, and the status/category colour maps (plain JS → `window.DUSKIN_DATA`).
- `icons.jsx` — Feather/Lucide line-icon set + the duck monogram (`window.Icon`).
- `components.jsx` — shared building blocks (`StatusPill`, `CategoryTag`, `StatCard`, `AppBar`, `BottomNav`, …).
- `screens.jsx` — the eight screens.
- `app.jsx` — state + tab/view routing + mount.

## Conventions worth copying

- **Status vs. category.** A status is a *live state* → coloured `StatusPill` with a leading dot. A category is a *classification* → uniform hairline `CategoryTag` with a colour swatch. Never style them the same.
- **Actionable filter pills** (`未拜訪`, `試用中`) use the `.pill.hot` treatment: pulsing accent dot + live count. Ordinary pills stay quiet.
- **Icons are line icons** (`Icon.*`), inheriting `currentColor` — no emoji in chrome. Moods are stroked faces, not glossy emoji.
- **Numbers** use `tabular-nums`; keep a thin space between digits and adjacent CJK / currency / units.
- **One green accent.** Green = primary action + "won". Everything structural is warm grey with hairline borders; reach for a semantic hue only for status/alerts.

> Each `<script type="text/babel">` has its own scope — shared pieces are published to `window` (e.g. `Object.assign(window, {…})`) and referenced globally. Keep that pattern when extending.
