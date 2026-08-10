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
| `/pdf-to-jpg` | Renders every page as a JPG (via `pdfjs-dist`), downloadable individually or as a `.zip`. |
| `/zip-files` | Bundles any mix of files into a single `.zip` (via `jszip`) — the site's "free file compressor" tool. |
| `/organize-pdf` | Drag page thumbnails (rendered via `pdfjs-dist`) to reorder or delete, then rebuilds the PDF with `pdf-lib`. |
| `/sign-pdf` | Draw a signature on a canvas, choose a page/corner/size, embeds it as a PNG via `pdf-lib`. |
| `/pdf-to-word` | Extracts the text layer per page (`pdfjs-dist`) into a real, editable `.docx` (via `docx`'s `Packer.toBlob`). Text only — no layout/image reproduction; says so on the page. |
| `/pdf-to-excel` | Groups text items by position into rows/columns (`pdfjs-dist`) and writes a real `.xlsx`, one sheet per page (via `xlsx`/SheetJS). Works well on simple tables; documented as a heuristic, not true table detection. |
| `/word-to-pdf` | `mammoth` converts `.docx` → HTML, `jsPDF` + `html2canvas` render that HTML to a PDF. Text/headings/lists/basic formatting only. |
| `/resize-image` | Canvas resize to exact pixel dimensions or a percentage, with an aspect-ratio lock. |
| `/remove-background` | Real on-device background removal via `@imgly/background-removal` (WASM/ONNX) — the model downloads once to the browser at runtime; no server involved. |

Every tool listed on the site (`TOOLS` in `src/lib/site.ts`) now has `built: true` — there are no more "Soon" placeholders. Tools that weren't requested for this pass (Protect/Unlock PDF, OCR PDF, Crop Image) were removed from the catalog rather than left as unbuilt promises.

The homepage embeds the Compress PDF tool directly in the hero.

## Bug fix: language switcher not doing anything

**Root cause**: `LanguageSwitcher.astro` is rendered twice per page (desktop header, mobile footer), and both instances used the same `id="lang-select"`. Astro dedupes identical inline component scripts, so the (single) script's `document.getElementById("lang-select")` only ever found the *first* matching element in the DOM — the other dropdown had no listener attached at all, so changing it did nothing.

**Fix**: switched to a shared `class="lang-select"` instead of a duplicate `id`, and the script now uses `querySelectorAll` to wire up *every* instance on the page and keep them in sync (`src/components/LanguageSwitcher.astro`, `src/lib/i18n-script.ts`). Also added a couple more translated landmarks (the "PDF tools / Image tools / Document tools" section headings) so the fix is easy to see working.

## Site-wide additions in this pass

- **Mega-menu nav** (`AllToolsMenu.astro`) grouping every tool by category, plus a slimmer top-level nav — replaces the old flat PDF/Image/Document links.
- **Pricing removed** from the homepage and header/footer nav (`Pricing.astro` is kept in `src/components/` for when you want to reintroduce it — just re-import it in `index.astro`).
- **Language switcher** (`LanguageSwitcher.astro` + `src/lib/i18n.ts` + `src/lib/i18n-script.ts`): translates the header, hero and footer chrome into English, Hindi, French, Spanish, German and Japanese, auto-detected from the browser and stored in `localStorage`. This is an honest MVP, not full-site translation — see the scope note in `src/lib/i18n.ts` for how to extend it to individual tool pages.
- **Legal & company pages**: `/about`, `/contact`, `/privacy-policy`, `/terms-and-conditions`, all linked from the footer (visible on every page, including the homepage).
- **Error pages**: `/404` (Astro serves this automatically for unmatched routes) and `/500`. Note: since this is a static export (`output: "static"`), `/500` won't be triggered automatically by a server error — wire it up via your host's error-page config (e.g. a Netlify `_redirects` rule or a Vercel `error` route) once deployed.
- **Google Analytics** (`GoogleAnalytics.astro`) wired into `BaseLayout.astro`'s `<head>` with the provided measurement ID (`G-D3Y1VS1XKD`).
- **Homepage SEO copy** (`AboutContent.astro`): ~650 words targeting the "file editor" / "file compressor" keyword cluster you supplied (file editor, pdf file editor, free file editor, file editor online, free file compressor, zip file compressor, discord file compressor), plus matching FAQ entries in `src/lib/site.ts` (`FILE_EDITOR_FAQS`, `FILE_COMPRESSOR_FAQS`) with `FAQPage` JSON-LD.
- **Note on "Online Ruler"**: one keyword group you sent referenced "Online Ruler" as the main target term. That doesn't match what this site does (a file editor/compressor), so it wasn't used — targeting it would mean writing content the site can't back up, which hurts SEO rather than helping it. The file-editor/file-compressor keyword list was used instead, since it matches the actual product.

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

1. **Remaining conversions**: PowerPoint↔PDF, HTML to PDF, PSD/audio/STL/JSON
   editors (out of scope for this toolkit — see the homepage SEO copy for
   why). Protect/Unlock PDF still need a real server, since `pdf-lib`
   cannot encrypt PDFs client-side.
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
