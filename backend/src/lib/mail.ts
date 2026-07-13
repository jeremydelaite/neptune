// Envoi d'email — pluggable : Resend si RESEND_API_KEY est défini, sinon on logue le lien (dev).
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.MAIL_FROM ?? "Neptune <onboarding@resend.dev>";

export async function sendVerificationEmail(to: string, link: string, username: string) {
  const subject = "Confirme ton adresse email — Neptune";
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:auto">
      <h2>Bienvenue sur Neptune, ${username} 🪐</h2>
      <p>Confirme ton adresse email pour activer ton compte :</p>
      <p><a href="${link}" style="display:inline-block;background:#2E9BFF;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Valider mon compte</a></p>
      <p style="color:#666;font-size:12px">Ou copie ce lien : ${link}</p>
      <p style="color:#666;font-size:12px">Ce lien expire dans 24 h.</p>
    </div>`;

  if (!RESEND_API_KEY) {
    // Mode dev : pas de fournisseur configuré → on affiche le lien dans la console
    console.log("\n📧 [DEV] Lien de vérification email pour", to, "\n   ", link, "\n");
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
    if (!res.ok) console.error("Resend a échoué:", res.status, await res.text().catch(() => ""));
  } catch (e) {
    console.error("Envoi email impossible:", e);
  }
}
