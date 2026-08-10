export const SITE = {
  name: "realfileeditor",
  tagline: "Your complete online file toolkit",
  description:
    "Convert, compress, merge and split PDFs, images and documents in seconds — and choose the exact output size yourself.",
  url: "https://realfileeditor.com",
};

export type ToolCategory = "pdf" | "image" | "document";

export interface Tool {
  slug: string;
  name: string;
  short: string;
  category: ToolCategory;
  built?: boolean; // has a working page, vs. "coming soon"
}

export const TOOLS: Tool[] = [
  // PDF
  { slug: "compress-pdf", name: "Compress PDF", short: "Shrink a PDF to the exact size you choose.", category: "pdf", built: true },
  { slug: "merge-pdf", name: "Merge PDF", short: "Combine PDFs in the order you drag them.", category: "pdf", built: true },
  { slug: "split-pdf", name: "Split PDF", short: "Pull pages out or break a PDF into parts.", category: "pdf", built: true },
  { slug: "rotate-pdf", name: "Rotate PDF", short: "Fix sideways or upside-down pages.", category: "pdf", built: true },
  { slug: "organize-pdf", name: "Organize PDF", short: "Reorder or delete pages by dragging thumbnails.", category: "pdf", built: true },
  { slug: "watermark-pdf", name: "Add Watermark", short: "Stamp text or a logo across every page.", category: "pdf", built: true },
  { slug: "sign-pdf", name: "Sign PDF", short: "Draw a signature and place it on any page.", category: "pdf", built: true },
  { slug: "pdf-to-word", name: "PDF to Word", short: "Editable .docx text pulled from any PDF.", category: "pdf", built: true },
  { slug: "pdf-to-excel", name: "PDF to Excel", short: "Reconstruct rows and columns into a spreadsheet.", category: "pdf", built: true },
  { slug: "pdf-to-jpg", name: "PDF to JPG", short: "Export every page as an image.", category: "pdf", built: true },
  { slug: "word-to-pdf", name: "Word to PDF", short: "Turn a .docx into a shareable PDF.", category: "document", built: true },
  // Image
  { slug: "compress-image", name: "Compress Image", short: "Dial a photo down to a target size.", category: "image", built: true },
  { slug: "resize-image", name: "Resize Image", short: "Set exact pixel dimensions or a percentage.", category: "image", built: true },
  { slug: "convert-image", name: "Convert Image", short: "JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC.", category: "image", built: true },
  { slug: "remove-background", name: "Remove Background", short: "Cut a subject out cleanly, right in your browser.", category: "image", built: true },
  // Document / general
  { slug: "zip-files", name: "Zip Files", short: "Bundle and compress files into a .zip.", category: "document", built: true },
];

export interface Faq {
  q: string;
  a: string;
}

/**
 * FAQ copy is written around the supplied keyword research so the
 * on-page questions match how people actually search:
 *   compress pdf / compress pdf free / adobe compress pdf /
 *   compress pdf online / compress pdf file / how to compress a pdf /
 *   how to compress a pdf file / how to compress pdf /
 *   how to compress a pdf for free / how to compress pdf file size
 */
export const COMPRESS_PDF_FAQS: Faq[] = [
  {
    q: "How do I compress a PDF file?",
    a: "Drop your PDF into the box above, drag the size gauge to the file size you want, and press compress. realfileeditor rebuilds the PDF at that target instead of guessing at a quality level, so you get a predictable result on the first try.",
  },
  {
    q: "How can I compress a PDF online for free?",
    a: "Compressing a PDF on realfileeditor is free with no sign-up: upload the file, set your target size on the slider, and download the result.",
  },
  {
    q: "How do I compress a PDF file to a specific size, like Adobe's tool does?",
    a: "Most compressors, including Adobe's, only offer 'low, medium, high' presets and leave the final size to chance. realfileeditor flips that: you choose the target file size on a ruler-style gauge and the engine works backward from that number, re-encoding images and streams until it lands on your target.",
  },
  {
    q: "Will compressing my PDF reduce its quality?",
    a: "Some quality loss is unavoidable once you ask for a much smaller file, mostly in embedded images. The live before/after preview and the estimated quality score update as you move the gauge, so you can see the trade-off before you download rather than after.",
  },
  {
    q: "What's the smallest I can compress a PDF file size to?",
    a: "It depends on the source: a text-only PDF is already small and compresses modestly, while a PDF full of high-resolution scans or photos has far more room to shrink. The gauge shows the smallest size the current file can realistically reach as you drag toward it.",
  },
];

export function toFaqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: f.a,
      },
    })),
  };
}

/**
 * Homepage FAQ copy targets the higher-volume head terms:
 *   compress pdf / compress pdf free / adobe compress pdf /
 *   compress pdf online / compress pdf file
 */
export const HOME_COMPRESS_FAQS: Faq[] = [
  {
    q: "What's the fastest way to compress a PDF online?",
    a: "Use the compress PDF tool at the top of this page: drop the file in, set a target size on the gauge and download. It runs in your browser, so there's no queue and no waiting on a server.",
  },
  {
    q: "Is there a free way to compress a PDF file?",
    a: "Yes — compressing a PDF file on realfileeditor is free, with no watermark and no account required.",
  },
  {
    q: "How is this different from Adobe's compress PDF tool?",
    a: "Adobe and most compressors give you a 'low, medium, high' preset and whatever size comes out. realfileeditor works the other way: you set the target file size first, and the compressor works toward that number.",
  },
];

export const GLOBAL_FAQS: Faq[] = [
  {
    q: "Is realfileeditor really free to use?",
    a: "Yes. Every tool on realfileeditor — the file editor and the compressor — is free to use, with no account and no watermark on your files.",
  },
  {
    q: "Are my files deleted after processing?",
    a: "Yes. Every uploaded file is removed automatically after processing on a schedule you choose — 30 minutes, 1 hour, 24 hours, or 7 days — and everything moves over HTTPS.",
  },
  {
    q: "Which file types are supported?",
    a: "PDF, PNG, JPG, JPEG, WEBP, SVG, GIF, BMP, TIFF, HEIC, DOCX, PPTX, XLSX, TXT and HTML, across editing, conversion, compression, merging and splitting.",
  },
];

/**
 * Homepage FAQ copy targeting the "file editor" keyword cluster:
 *   file editor / pdf file editor / free pdf file editor /
 *   free file editor / file editor online / adobe file editor
 *
 * Note: a few keywords in the supplied research (audio/mp3/wav file
 * editor, stl file editor, psd file editor, json file editor) describe
 * formats this toolkit doesn't handle. Rather than target those with
 * content the tool can't back up, this FAQ sticks to the document,
 * PDF and image formats realfileeditor actually supports — see the
 * README for the reasoning.
 */
export const FILE_EDITOR_FAQS: Faq[] = [
  {
    q: "Is there a free online file editor for PDFs?",
    a: "Yes — realfileeditor's PDF tools (compress, merge, split, rotate, watermark, convert to JPG) work directly in your browser, free, with no account and no software to install.",
  },
  {
    q: "Can I edit a PDF file online without Adobe?",
    a: "Yes. realfileeditor covers the everyday PDF edits — merging, splitting, rotating, watermarking and compressing to an exact size — without an Adobe subscription. Full text editing inside a PDF is on the roadmap.",
  },
  {
    q: "Does the file editor work on any device?",
    a: "Yes — it runs in the browser on desktop, laptop, tablet or phone, and doesn't require installing an app.",
  },
];

/**
 * FAQ copy targeting the "file compressor" keyword cluster:
 *   free file compressor / zip file compressor / discord file compressor
 *
 * Note: mp4/video compression and true .zip re-compression of already
 * packed archives aren't built yet — seen honestly in the FAQ below
 * rather than implied.
 */
export const FILE_COMPRESSOR_FAQS: Faq[] = [
  {
    q: "What's a free file compressor I can use online?",
    a: "realfileeditor compresses PDFs and images for free, right in your browser, and also bundles multiple files into a single .zip with the Zip Files tool.",
  },
  {
    q: "How do I compress a file to fit Discord's upload limit?",
    a: "Use the compress PDF or compress image tool and drag the gauge to just under your server's upload limit (commonly 10–50 MB). Video/mp4 compression isn't supported yet.",
  },
  {
    q: "How do I make a .zip file smaller?",
    a: "A .zip is already compressed, so re-zipping rarely shrinks it further. For a smaller download, compress the individual PDFs or images to a target size first, then bundle them with the Zip Files tool.",
  },
];
