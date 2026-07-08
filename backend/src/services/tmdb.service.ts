// Proxy vers l'API TMDB : la clé reste côté serveur, jamais dans l'app mobile.
// Cache mémoire simple (TTL 1h) pour économiser le quota TMDB.

const BASE = "https://api.themoviedb.org/3";
const TTL_MS = 60 * 60 * 1000; // 1 heure

const cache = new Map<string, { data: unknown; expires: number }>();

export async function tmdbFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(BASE + path);
  url.searchParams.set("api_key", process.env.TMDB_API_KEY!);
  url.searchParams.set("language", "fr-FR");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const key = url.toString();
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;

  const res = await fetch(key);
  if (!res.ok) throw new Error(`TMDB ${res.status} sur ${path}`);
  const data = await res.json();

  cache.set(key, { data, expires: Date.now() + TTL_MS });
  return data;
}
