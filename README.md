# PakkBevis – Riktig eske. Bevist. / Right box. Proven.

Warehouse tool for Holio challenge #5 ("Wrong box size"): it suggests the cheapest box that fits an order's items and **proves** the layout with an independent checker. One offline `index.html`, no server, no network, no AI. Norwegian and English UI. Synthetic test data only.

## Run

```bash
open index.html        # or double-click; works offline (file://)
```

## What it does

- **Packer (phone, 360–390 px):** pick or scan an order, get the box, cost, chargeable weight and air %, numbered packing steps and a layer view. "Passet" confirms; "Passet ikke" adds 1 cm of room (up to +3), "For stor" packs 1 cm tighter (down to -2) and may switch to a smaller box. The app learns per item combination and explains what changed.
- **Manager (PC):** all orders in one table, savings vs the default box B5, air before/after chart, and a "missing box" finder that proposes one new box size.
- **Edge cases:** orders that need splitting (max 4 parcels), missing item dimensions (enter once, or try-and-press), fragile items, live order queue, JSON order import, barcode/SKU scanner field.
- **Selvtest tab:** 24 built-in tests (T14 is a fuzz test run on demand).

## How it decides

1. Deterministic 3D packing (extreme points, 6 rotations, fragile padding) tries each box.
2. A separate verifier re-checks bounds, overlaps, items, orientation, weight and fragile rules. A box is shown as machine-verified only if it passes; otherwise the order is amber or red.
3. Boxes are ranked by total cost: box + filler + freight (by chargeable weight, including volumetric).

"Maskinkontrollert ✓" means the software check passed. The packer's tap on "Passet" is the physical confirmation.

## Assumptions (all test values)

Fragile +1 cm per axis · filler 0.12 NOK/L · outer box = inner + 1 cm · volumetric kg = outer cm³ / 5000 · freight 49–219 NOK in weight brackets, max 25 kg · baseline box B5. Also listed in the app under "Antakelser".

## Develop

Needs Node 22+. Edit `src/` (data lives in `src/core.js`), then:

```bash
node build.js            # inlines src/ into index.html
node test.js             # 24 unit tests
npm i && npx playwright install chromium
node scripts/e2e.js      # browser checks (phone, desktop, blocked storage)
node scripts/e2e-flow.js # one-tap flow checks
```

Reset learning and entered dimensions with "Nullstill læring", or clear the localStorage keys `pakkbevis_rejects` and `pakkbevis_dims`.

## Limits

The packer is a heuristic: it may miss a smaller box a perfect solver would find. Data is synthetic; real item sizes, box prices and freight rates will change the results.
