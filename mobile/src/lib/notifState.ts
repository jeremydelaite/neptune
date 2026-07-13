// Petit store partagé du nombre de notifications non lues (pour synchroniser
// la pastille de l'onglet Compte, l'en-tête et l'écran Notifications).
type Listener = (count: number) => void;

let value = 0;
const listeners = new Set<Listener>();

export function setUnread(count: number) {
  value = count;
  listeners.forEach((l) => l(count));
}

export function getUnread(): number {
  return value;
}

export function subscribeUnread(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
