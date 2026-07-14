// Modération d'image (avatars) — pluggable : Sightengine si clé fournie, sinon désactivé (dev).
const API_USER = process.env.SIGHTENGINE_API_USER;
const API_SECRET = process.env.SIGHTENGINE_API_SECRET;

export interface ModerationResult {
  ok: boolean;
  reason?: string;
}

// Décode un data URI base64 en Buffer
function dataUriToBuffer(dataUri: string): { buffer: Buffer; mime: string } | null {
  const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], "base64") };
}

// Vérifie un avatar. Retourne { ok:false, reason } si l'image doit être refusée.
export async function moderateAvatar(dataUri: string): Promise<ModerationResult> {
  if (!API_USER || !API_SECRET) return { ok: true }; // modération désactivée (pas de clé)

  const decoded = dataUriToBuffer(dataUri);
  if (!decoded) return { ok: false, reason: "Format d'image invalide." };

  try {
    const form = new FormData();
    form.append("media", new Blob([decoded.buffer], { type: decoded.mime }), "avatar.jpg");
    form.append("models", "nudity-2.1,gore,offensive,weapon");
    form.append("api_user", API_USER);
    form.append("api_secret", API_SECRET);

    const res = await fetch("https://api.sightengine.com/1.0/check.json", { method: "POST", body: form });
    const data = (await res.json()) as any;
    if (data.status !== "success") return { ok: true }; // en cas de souci API, on ne bloque pas

    const nud = data.nudity ?? {};
    const sexual = Math.max(nud.sexual_activity ?? 0, nud.sexual_display ?? 0, nud.erotica ?? 0);
    const gore = data.gore?.prob ?? 0;
    const offensive = Math.max(
      ...Object.values(data.offensive ?? {}).filter((v): v is number => typeof v === "number"),
      0
    );
    const weapon =
      typeof data.weapon === "number"
        ? data.weapon
        : Math.max(...Object.values(data.weapon?.classes ?? {}).filter((v): v is number => typeof v === "number"), 0);

    if (sexual > 0.5) return { ok: false, reason: "Image à caractère sexuel refusée." };
    if (gore > 0.6) return { ok: false, reason: "Image violente/choquante refusée." };
    if (offensive > 0.6) return { ok: false, reason: "Contenu offensant refusé (symbole haineux, etc.)." };
    if (weapon > 0.7) return { ok: false, reason: "Image d'arme refusée." };

    return { ok: true };
  } catch {
    return { ok: true }; // erreur réseau modération → on n'empêche pas l'upload
  }
}
