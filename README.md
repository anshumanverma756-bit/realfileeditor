# realfileeditor

A file toolkit — compress, merge, split and convert PDFs, images and documents —
built with Astro, React islands, TypeScript and Tailwind CSS.

Design direction: a "precision instrument" for files. Every compressor uses a
calibrated ruler/gauge to pick an **exact target output size** instead of a
low/medium/high preset. See `src/styles/global.css` for the token system
(Space Grotesk / Inter / IBM Plex Mono, blueprint-blue + amber accents).

## Quick start

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # serve the production build locally
```

Node 22+ is required (set in `package.json` engines).

## What's live right now

All of these are real, working, client-side tools — not mockups:

| Page | What it does |
|---|---|
| `/compress-pdf` | Compresses a PDF toward a **target size you pick**, by re-encoding embedded JPEGs via canvas and re-saving with `pdf-lib` object streams. See "Known limitation" below. |
| `/compress-image` | Compresses JPG/PNG/WEBP/GIF/BMP/TIFF toward a target size using `browser-image-compression`, which genuinely iterates quality/dimensions. |
| `/merge-pdf` | Combine multiple PDFs, drag to reorder before merging. |
| `/split-pdf` | Extract a page range, or split every N pages into separate files. |
| `/rotate-pdf` | Rotate every page 90° / 180° / 270°. |
| `/watermark-pdf` | Stamp diagonal text across every page, with adjustable opacity. |
| `/convert-image` | Convert between JPG / PNG / WEBP via canvas re-encoding. |

The homepage embeds the Compress PDF tool directly in the hero.

### Known limitation: PDF compression ceiling

`compressPdfToTarget()` in `src/lib/compress-pdf.ts` only re-encodes images
whose PDF `Filter` is `DCTDecode` (i.e. already JPEG-compressed) — that
covers most scanned documents and photo-heavy PDFs. It does **not**
re-encode raw/Flate-encoded pixel data or touch vector content, so
text-heavy or vector-heavy PDFs will hit a floor above very small targets.
The UI is honest about this: if the target isn't reachable, it says so and
reports the smallest size actually achieved.

For a lower floor in production, add a **server-side pass** (Ghostscript or
`qpdf --optimize-images`) as a fallback when the client-side result doesn't
hit the target — see "Next steps" below.

## Architecture

```
src/
  components/       Astro components (static) + .tsx islands (interactive)
  layouts/
    BaseLayout.astro   SEO meta, OG/Twitter tags, JSON-LD injection, theme init
  lib/
    site.ts            Tool catalog, nav data, FAQ copy (see SEO section)
    compress-pdf.ts     PDF target-size compression engine
    compress-image.ts    Image target-size compression wrapper
    theme-init.ts        No-flash dark/light init script
  pages/
    index.astro           Homepage
    compress-pdf.astro    Flagship SEO landing page
    merge-pdf.astro
    split-pdf.astro
    rotate-pdf.astro
    watermark-pdf.astro
    compress-image.astro
    convert-image.astro
public/
  robots.txt
astro.config.mjs   React + sitemap integrations, Tailwind vite plugin, site URL
```

Every tool follows the same shape: an Astro `.astro` page for SEO-indexable
markup (title/description/JSON-LD/FAQ), with a `client:load` React island for
the interactive part. Reuse `<UploadDrop>`, `<GaugeSlider>` and the
`formatBytes()` helper when adding new tools.

## SEO

- `src/lib/site.ts` holds the FAQ copy, written directly against the keyword
  research you supplied:
  - **`HOME_COMPRESS_FAQS`** targets the head terms (compress pdf, compress
    pdf free, adobe compress pdf, compress pdf online, compress pdf file) —
    rendered on the homepage.
  - **`COMPRESS_PDF_FAQS`** targets the long-tail "how to" questions (how to
    compress a pdf, how to compress a pdf file, how to compress pdf, how to
    compress a pdf for free, how to compress pdf file size) — rendered on
    `/compress-pdf`, which also carries those phrases in its `<title>`,
    meta description and H1/H2 copy.
  - Every FAQ block also emits `FAQPage` JSON-LD via `toFaqJsonLd()` for
    rich-result eligibility.
- `astro.config.mjs` sets `site: 'https://realfileeditor.com'` — **update
  this to your real domain**, since it feeds the sitemap and canonical URLs.
- `@astrojs/sitemap` generates `sitemap-index.xml` on every build
  automatically; `public/robots.txt` already points to it.
- Add a real Open Graph image at `public/og-default.png` (1200×630) — the
  layout already references that path.

## Next steps (not built yet)

Roughly in priority order for an iLovePDF-scale toolkit:

1. **Remaining PDF tools**: organize/reorder pages, protect/unlock (needs a
   server — `pdf-lib` cannot encrypt PDFs), sign, OCR, PDF↔Word/Excel/
   PowerPoint/HTML conversion (all need a backend service; consider
   LibreOffice headless or a conversion API).
2. **Backend**: Node/Express + PostgreSQL/Prisma for accounts, file history,
   collections, sharing links, and the admin panel described in the brief.
   Needed for anything beyond single-file, in-browser processing.
3. **Object storage**: S3-compatible storage for uploaded/processed files
   once there's a backend, with the configurable auto-delete windows (30
   min / 1 hr / 24 hr / 7 days) from the brief.
4. **Auth**: Clerk or Auth.js, gating the dashboard, batch workspace and
   history features.
5. **Batch workspace**: queue + background processing for 100+ files at
   once, building on the per-tool components already in `src/components`.
6. **Remaining landing pages**: one per tool slug in `TOOLS` (`src/lib/
   site.ts`) that isn't `built: true` yet — each should follow the pattern in
   `compress-pdf.astro` (hero → tool → how-it-works → FAQ → related tools).
7. **HEIC/SVG support**: needs a WASM decoder (e.g. `heic2any`) since browsers
   can't decode HEIC natively.
8. **Accessibility/perf polish**: PWA manifest, image optimization pipeline,
   `prefers-reduced-motion` audit beyond the base CSS rule already in place.

## Notes on the design system

- Colors, fonts and the `.bracket-card` / `.tick-rule` utility classes live
  in `src/styles/global.css` — reuse these rather than introducing new ad hoc
  styles so new pages stay visually consistent.
- `<GaugeSlider>` is the site's signature control. Reuse it (not a plain
  `<input type="range">`) anywhere a person picks a target size, quality, or
  similar continuous value.
