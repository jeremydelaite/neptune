// Charte graphique Neptune — mode sombre + violet électrique
export const colors = {
  bg: "#0F1115",          // fond principal (noir profond)
  surface: "#1A1D24",     // cartes / fiches
  surface2: "#232733",    // éléments imbriqués (barres, inputs)
  line: "#262B36",        // bordures discrètes
  violet: "#7C3AED",      // accent — boutons, badges, état "Vu"
  violetSoft: "rgba(124,58,237,0.14)",
  violetPastel: "#C4B5FD",
  text: "#F3F4F6",        // texte principal
  dim: "#9CA3AF",         // texte secondaire / métadonnées
  danger: "#F87171",      // erreurs, déconnexion
  dangerSoft: "rgba(248,113,113,0.12)",
  dangerLine: "rgba(248,113,113,0.45)",
} as const;
