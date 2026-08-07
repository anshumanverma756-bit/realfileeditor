export interface Language {
  code: string;
  label: string;
}

export const LANGUAGES: Language[] = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
];

/**
 * MVP translation dictionary.
 *
 * Scope note: this translates the header, hero and footer chrome
 * (the strings every page shares) so a visitor from any of the six
 * languages above sees a translated shell immediately. Deep,
 * page-by-page translation of every tool's copy is a larger project —
 * see README "Next steps" for how to extend this dictionary and wire
 * it into individual pages using the same data-i18n pattern.
 */
export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    "nav.pdf": "PDF",
    "nav.image": "Image",
    "nav.document": "Document",
    "nav.allTools": "All tools",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.cta": "Open a tool",
    "hero.eyebrow": "No sign-up · files auto-delete",
    "hero.title1": "Your complete",
    "hero.title2": "online file toolkit.",
    "hero.subtitle":
      "Convert, compress, merge and split files in seconds — and instead of guessing at \"low, medium, high,\" you drag a gauge to the exact size you want and we hit it.",
    "footer.tagline": "A precision toolkit for PDFs, images and documents — you set the target, we hit it.",
    "footer.rights": "All rights reserved.",
  },
  hi: {
    "nav.pdf": "पीडीएफ़",
    "nav.image": "इमेज",
    "nav.document": "डॉक्यूमेंट",
    "nav.allTools": "सभी टूल्स",
    "nav.about": "हमारे बारे में",
    "nav.contact": "संपर्क करें",
    "nav.cta": "टूल खोलें",
    "hero.eyebrow": "साइन-अप की ज़रूरत नहीं · फ़ाइलें अपने आप डिलीट",
    "hero.title1": "आपकी संपूर्ण",
    "hero.title2": "ऑनलाइन फ़ाइल टूलकिट।",
    "hero.subtitle":
      "फ़ाइलों को सेकंडों में बदलें, कंप्रेस करें, जोड़ें या बाँटें — प्रीसेट चुनने के बजाय, अपनी मनचाही साइज़ खुद तय करें।",
    "footer.tagline": "पीडीएफ़, इमेज और डॉक्यूमेंट्स के लिए एक सटीक टूलकिट।",
    "footer.rights": "सर्वाधिकार सुरक्षित।",
  },
  fr: {
    "nav.pdf": "PDF",
    "nav.image": "Image",
    "nav.document": "Document",
    "nav.allTools": "Tous les outils",
    "nav.about": "À propos",
    "nav.contact": "Contact",
    "nav.cta": "Ouvrir un outil",
    "hero.eyebrow": "Sans inscription · suppression automatique des fichiers",
    "hero.title1": "Votre boîte à outils",
    "hero.title2": "de fichiers en ligne.",
    "hero.subtitle":
      "Convertissez, compressez, fusionnez et divisez vos fichiers en quelques secondes — choisissez la taille exacte que vous voulez.",
    "footer.tagline": "Un outil de précision pour vos PDF, images et documents.",
    "footer.rights": "Tous droits réservés.",
  },
  es: {
    "nav.pdf": "PDF",
    "nav.image": "Imagen",
    "nav.document": "Documento",
    "nav.allTools": "Todas las herramientas",
    "nav.about": "Acerca de",
    "nav.contact": "Contacto",
    "nav.cta": "Abrir una herramienta",
    "hero.eyebrow": "Sin registro · los archivos se eliminan solos",
    "hero.title1": "Tu caja de herramientas",
    "hero.title2": "de archivos en línea.",
    "hero.subtitle":
      "Convierte, comprime, une y divide archivos en segundos — elige tú mismo el tamaño exacto que necesitas.",
    "footer.tagline": "Una herramienta de precisión para tus PDF, imágenes y documentos.",
    "footer.rights": "Todos los derechos reservados.",
  },
  de: {
    "nav.pdf": "PDF",
    "nav.image": "Bild",
    "nav.document": "Dokument",
    "nav.allTools": "Alle Tools",
    "nav.about": "Über uns",
    "nav.contact": "Kontakt",
    "nav.cta": "Tool öffnen",
    "hero.eyebrow": "Keine Anmeldung · Dateien löschen sich automatisch",
    "hero.title1": "Dein komplettes",
    "hero.title2": "Online-Datei-Toolkit.",
    "hero.subtitle":
      "Konvertiere, komprimiere, füge zusammen und teile Dateien in Sekunden — bestimme die genaue Zielgröße selbst.",
    "footer.tagline": "Ein präzises Werkzeug für PDFs, Bilder und Dokumente.",
    "footer.rights": "Alle Rechte vorbehalten.",
  },
  ja: {
    "nav.pdf": "PDF",
    "nav.image": "画像",
    "nav.document": "ドキュメント",
    "nav.allTools": "すべてのツール",
    "nav.about": "会社概要",
    "nav.contact": "お問い合わせ",
    "nav.cta": "ツールを開く",
    "hero.eyebrow": "登録不要 · ファイルは自動削除",
    "hero.title1": "オンラインで完結する",
    "hero.title2": "ファイルツールキット。",
    "hero.subtitle":
      "変換・圧縮・結合・分割を数秒で。プリセットではなく、狙ったファイルサイズを自分で指定できます。",
    "footer.tagline": "PDF、画像、ドキュメントのための精密なツールキット。",
    "footer.rights": "全著作権所有。",
  },
};
