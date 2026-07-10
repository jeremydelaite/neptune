// Détection des titres non-latins (japonais, chinois, coréen, arabe, cyrillique, thaï…)
// pour éviter d'afficher des titres illisibles dans les listes de découverte.
const NON_LATIN = new RegExp(
  "[" +
    "\\u0400-\\u04FF" + // cyrillique
    "\\u0590-\\u05FF" + // hébreu
    "\\u0600-\\u06FF" + // arabe
    "\\u0900-\\u097F" + // devanagari
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
