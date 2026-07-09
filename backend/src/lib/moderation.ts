// Filtre de gros mots simple (FR/EN). Barrage immédiat, hors-ligne.
// Volontairement basique : complète la modération humaine (signalement/admin).
const BANNED = [
  // FR
  "connard", "connasse", "salope", "salaud", "enculé", "encule", "pute", "putain",
  "merde", "bâtard", "batard", "trouduc", "ta gueule", "tg", "ferme ta gueule",
  "abruti", "débile", "debile", "crétin", "cretin", "pédé", "pede", "tapette",
  "négro", "negro", "bougnoule", "youpin", "sale race", "nique", "niquer", "ntm",
  // EN
  "fuck", "fucker", "fucking", "shit", "bitch", "asshole", "bastard", "cunt",
  "dick", "faggot", "nigger", "retard", "slut", "whore", "motherfucker",
];

// Normalise pour limiter les contournements (accents, leet, espaces/ponctuation)
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s");
}

// true si le texte contient un terme interdit
export function containsProfanity(text: string): boolean {
  const norm = normalize(text);
  // compact = sans caractères non alphabétiques (contre "c o n n a r d")
  const compact = norm.replace(/[^a-z]/g, "");
  return BANNED.some((word) => {
    const w = normalize(word);
    if (norm.includes(w)) return true;
    const wCompact = w.replace(/[^a-z]/g, "");
    return wCompact.length >= 4 && compact.includes(wCompact);
  });
}
