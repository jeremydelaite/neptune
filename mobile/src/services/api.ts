// Client HTTP unique vers l'API Neptune.
// Le token JWT est injecté automatiquement s'il existe.
// EXPO_PUBLIC_API_URL peut contenir PLUSIEURS URL séparées par des virgules
// (ex. deux réseaux Wi-Fi) : le client choisit automatiquement celle qui répond.
import AsyncStorage from "@react-native-async-storage/async-storage";

const CANDIDATES = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

let activeBase: string | null = CANDIDATES.length === 1 ? CANDIDATES[0] : null;

// Teste si une base répond (endpoint léger /health) avec un court délai
async function reachable(base: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    const res = await fetch(`${base}/health`, { signal: ctrl.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// Renvoie la base active (celle qui répond), en la mémorisant
async function resolveBase(): Promise<string> {
  if (activeBase) return activeBase;
  for (const c of CANDIDATES) {
    if (await reachable(c)) {
      activeBase = c;
      return c;
    }
  }
  return CANDIDATES[0]; // rien ne répond : on tente la première quand même
}

// Déconnexion forcée quand le backend signale un compte banni/suspendu (403 ACCOUNT_BLOCKED)
let onAccountBlocked: ((message: string) => void) | null = null;
export function setAccountBlockedHandler(fn: ((message: string) => void) | null) {
  onAccountBlocked = fn;
}

async function request<T>(path: string, options: RequestInit = {}, retried = false): Promise<T> {
  const token = await AsyncStorage.getItem("neptune_token");
  const base = await resolveBase();
  let res: Response;
  try {
    res = await fetch(base + path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (e) {
    // Échec réseau : la base active ne répond plus → on réessaie une fois en re-sélectionnant
    if (!retried && CANDIDATES.length > 1) {
      activeBase = null;
      return request<T>(path, options, true);
    }
    throw e;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body as { error?: string; code?: string };
    if (res.status === 403 && err.code === "ACCOUNT_BLOCKED") {
      onAccountBlocked?.(err.error ?? "Ton accès a été suspendu.");
    }
    throw new Error(err.error ?? `Erreur ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

// Helper images TMDB (CDN gratuit)
export const tmdbImage = (
  path: string | null,
  size: "w154" | "w185" | "w342" | "w780" = "w342"
) =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
