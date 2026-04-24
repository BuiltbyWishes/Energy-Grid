# Energy Grid — Project Notes

## Stack
- Vite + React
- `react-simple-maps` (SVG, not tile-based) — chosen for glowing SVG filter aesthetics
- `prop-types` — required peer dep of react-simple-maps (installed)
- `recharts` — reserved for Session 4 detail panel charts
- EIA API v2 — key in `.env` as `VITE_EIA_API_KEY`

## Critical EIA API Notes
- `row.value` comes back as a **string** — always cast with unary `+` before arithmetic
- Net generation (NG type) has a ~24h data lag — "—" in the UI is expected and correct
- Fuel mix (`/electricity/rto/fuel-type-data/data/`) can return empty outside business hours
- `fetchPlantGeneration` is non-fatal — seed data shows if API errors

## Architecture
```
src/
  api/eia.js         — EIA fetch helpers + REGIONS constant
  data/plants.js     — 15 real plants (seed data + live merge)
  data/dataCenters.js — 20 hyperscale DCs with mock metrics
  components/
    GridMap.jsx      — SVG US map (react-simple-maps)
    FuelMixPanel.jsx — National fuel mix stacked bar + legend (hides if empty)
    RegionPanel.jsx  — 7 RTO demand/netGen rows with utilization bars
    DcRankings.jsx   — 20 DCs sorted by MW draw with load-color bars
    EcoPanel.jsx     — 15 plants sorted by eco_score with SVG arc gauges
  App.jsx            — Data loading, derived stats, layout shell
  index.css          — Design tokens + all global styles
```

## Sessions Done
### Session 1 — Foundation
- Design system tokens, layout shell, EIA API module

### Session 2 — Map
- `react-simple-maps` SVG map with glow filters
- State borders (`feGaussianBlur` SVG filter), plant/DC markers, flow lines
- Filter bar (fuel type toggle), hover tooltips

### Session 3 — Sidebar Panels
- `FuelMixPanel` — national fuel mix (hidden when EIA returns empty)
- `RegionPanel` — demand/netGen per RTO with utilization bar
- `DcRankings` — all 20 DCs ranked by MW draw, load-tier color
- `EcoPanel` — plants sorted by eco_score, SVG arc gauge, grade badge

## Next: Session 4 — Interactions
- Click region marker → slide-in detail panel (24h Recharts demand chart, fuel mix)
- Click plant/DC → highlight connected network on map
- Hover tooltip on flow lines showing MW transfer
- Filter toggle: show/hide plants by fuel type (already done in Session 2)

## launch.json Note
Must use `cmd /c "cd energy-grid && npm run dev"` — preview tool runs from parent dir.
