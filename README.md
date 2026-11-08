1. Open `index.html` by double-clicking (works offline, file://). Language toggle NO | EN.
2. Tabs: **Pakking** (live queue, JSON import, scanner, result, SVG views, steps, Passet / Passet ikke, missing dims), **Leder** (6-order table, bar chart, missing-box finder), **Selvtest** (T1-T20; T14 fuzz runs on button).
3. Assumptions (all "testverdier", also in the in-app "Antakelser" panel): fragile +1 cm/axis, filler 0.12 NOK/L, outer = inner+1 cm, volumetric kg = outer cm³/5000, freight brackets 49-219 NOK, max 25 kg, baseline box B5.
4. Reset learning and entered dims: button "Nullstill læring" (or clear localStorage keys `pakkbevis_rejects`, `pakkbevis_dims`).
5. Edit the DATA section of `src/core.js` (ITEMS, BOXES, ORDERS), then `node build.js` to regenerate `index.html`; `node test.js` runs the tests; `node scripts/e2e.js` runs the browser checks.
# PakkBevis
