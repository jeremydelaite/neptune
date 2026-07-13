// Détection des titres non-latins (japonais, chinois, coréen, arabe, cyrillique, thaï, scripts indiens…)
// pour éviter d'afficher des titres illisibles dans les listes de découverte.
const NON_LATIN = new RegExp(
  "[" +
    "\\u0400-\\u04FF" + // cyrillique
    "\\u0590-\\u05FF" + // hébreu
    "\\u0600-\\u06FF" + // arabe
    "\\u0900-\\u097F" + // devanagari
    "\\u0980-\\u09FF" + // bengali
    "\\u0A00-\\u0A7F" + // gurmukhî (pendjabi)
    "\\u0A80-\\u0AFF" + // gujarati
    "\\u0B00-\\u0B7F" + // oriya
    "\\u0B80-\\u0BFF" + // tamoul
    "\\u0C00-\\u0C7F" + // télougou
    "\\u0C80-\\u0CFF" + // kannada
    "\\u0D00-\\u0D7F" + // malayalam
    "\\u0E00-\\u0E7F" + // thaï
    "\\u3040-\\u30FF" + // hiragana + katakana
    "\\u3400-\\u4DBF" + // CJK ext A
    "\\u4E00-\\u9FFF" + // CJK (chinois/kanji)
    "\\uAC00-\\uD7AF" + // hangul (coréen)
    "\\uFF00-\\uFFEF" + // formes pleine chasse
    "]"
);

export function hasNonLatin(text: string | undefined | null): boolean {
  return NON_LATIN.test(text ?? "");
}

// Un média est "latin" si son titre affiché (title ou name) n'a pas d'écriture non-latine
export function isLatinMedia(m: { title?: string; name?: string }): boolean {
  return !hasNonLatin(m.title ?? m.name ?? "");
}
