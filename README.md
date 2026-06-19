# AI Lead Qualification Benchmark Dashboard

Next.js App Router dashboard for visualizing lead-qualification benchmark outputs.

## Data files

Place these files in `public/data/`:

- `vanilla_slm_evaluation.json`
- `vanilla_slm_results.json`

The dashboard loads them client-side from:

```ts
fetch('/data/vanilla_slm_evaluation.json')
fetch('/data/vanilla_slm_results.json')
```

Future approach files can be added to the same folder without code changes to the core dashboard configuration.

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```
