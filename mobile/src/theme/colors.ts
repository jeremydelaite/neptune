// Charte graphique Neptune — mode sombre + bleu néon (planète Neptune)
export const colors = {
  bg: "#0F1115",           // fond principal (noir profond)
  surface: "#1A1D24",      // cartes / fiches
  surface2: "#232733",     // éléments imbriqués (barres, inputs)
  line: "#262B36",         // bordures discrètes
  accent: "#2E9BFF",       // accent — bleu néon (boutons, badges, état "Vu", étoiles)
  accentSoft: "rgba(46,155,255,0.14)",
  accentPastel: "#8FD3FF",
  text: "#F3F4F6",         // texte principal
  dim: "#9CA3AF",          // texte secondaire / métadonnées
  danger: "#F87171",       // erreurs, déconnexion
  dangerSoft: "rgba(248,113,113,0.12)",
  dangerLine: "rgba(248,113,113,0.45)",
} as const;
