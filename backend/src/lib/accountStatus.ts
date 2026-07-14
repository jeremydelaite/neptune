// Statut de compte (pur, sans dépendance DB) — testable isolément
export function accountBlockMessage(u: { bannedAt: Date | null; suspendedUntil: Date | null }): string | null {
  if (u.bannedAt) return "Ce compte a été banni définitivement.";
  if (u.suspendedUntil && u.suspendedUntil > new Date()) {
    const d = u.suspendedUntil.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    return `Ce compte est suspendu jusqu'au ${d}.`;
  }
  return null;
}
