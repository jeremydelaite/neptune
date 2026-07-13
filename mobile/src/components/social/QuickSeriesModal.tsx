// Modale raccourcie : "T'es-tu arrêté ?" — coche l'épisode d'arrêt (remplit les saisons
// précédentes) ou "J'ai tout regardé", puis confirmation avant d'ajouter.
import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react-native";
import { api } from "../../services/api";
import { ConfirmModal } from "../ui/ConfirmModal";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

interface Season { season_number: number; episode_count: number; name: string }
interface Ep { episode_number: number; runtime: number | null }
type Sel = { type: "all" } | { type: "ep"; season: number; ep: number } | null;

export function QuickSeriesModal({
  visible, tvId, title, onClose, onDone,
}: {
  visible: boolean;
  tvId: number | null;
  title: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [eps, setEps] = useState<Record<number, Ep[]>>({});
  const [sel, setSel] = useState<Sel>(null);
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || tvId == null) return;
    setLoading(true);
    setOpen(null);
    setEps({});
    setSel(null);
    setConfirm(false);
    api
      .get<{ seasons: Season[] }>(`/tmdb/tv/${tvId}`)
      .then((d) => setSeasons((d.seasons ?? []).filter((s) => s.season_number >= 1 && s.episode_count > 0)))
      .catch(() => setSeasons([]))
      .finally(() => setLoading(false));
  }, [visible, tvId]);

  async function toggleSeason(n: number) {
    if (open === n) {
      setOpen(null);
      return;
    }
    setOpen(n);
    if (!eps[n]) {
      try {
        const d = await api.get<{ episodes: Ep[] }>(`/tmdb/tv/${tvId}/season/${n}`);
        setEps((prev) => ({ ...prev, [n]: d.episodes ?? [] }));
      } catch {
        setEps((prev) => ({ ...prev, [n]: [] }));
      }
    }
  }

  async function markUpTo(targetSeason: number, maxEp: number | null) {
    if (tvId == null) return;
    setSaving(true);
    try {
      const targets = seasons.filter((s) => s.season_number <= targetSeason);
      for (const s of targets) {
        let list = eps[s.season_number];
        if (!list) {
          try {
            const d = await api.get<{ episodes: Ep[] }>(`/tmdb/tv/${tvId}/season/${s.season_number}`);
            list = d.episodes ?? [];
          } catch {
            continue;
          }
        }
        const filtered =
          s.season_number === targetSeason && maxEp != null
            ? list.filter((e) => e.episode_number <= maxEp)
            : list;
        if (filtered.length === 0) continue;
        await api
          .post("/episodes/season", {
            tmdbShowId: tvId,
            seasonNumber: s.season_number,
            episodes: filtered.map((e) => ({ episodeNumber: e.episode_number, runtimeMin: e.runtime ?? undefined })),
          })
          .catch(() => {});
      }
      const lastSeason = Math.max(...seasons.map((s) => s.season_number));
      const complete = targetSeason === lastSeason && maxEp == null;
      await api
        .post("/library", { tmdbId: tvId, mediaType: "TV", status: complete ? "COMPLETED" : "WATCHING" })
        .catch(() => {});
      onDone();
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  }

  function doConfirm() {
    if (!sel) return;
    const lastSeason = seasons.length ? Math.max(...seasons.map((s) => s.season_number)) : 0;
    if (sel.type === "all") markUpTo(lastSeason, null);
    else markUpTo(sel.season, sel.ep);
  }

  const confirmMsg =
    sel?.type === "all"
      ? "Marquer toute la série comme vue ?"
      : sel?.type === "ep"
      ? `Marquer comme vu jusqu'à la saison ${sel.season}, épisode ${sel.ep} ? Les saisons précédentes seront cochées.`
      : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              <Text style={styles.subtitle}>T'es-tu arrêté quelque part ?</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.dim} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} color={colors.accent} />
          ) : (
            <>
              <Pressable
                style={[styles.allBtn, sel?.type === "all" && styles.allBtnActive]}
                onPress={() => setSel({ type: "all" })}
              >
                <Check size={16} color={sel?.type === "all" ? "#fff" : colors.accentPastel} />
                <Text style={[styles.allBtnText, sel?.type === "all" && styles.allBtnTextActive]}>
                  J'ai tout regardé
                </Text>
              </Pressable>

              <Text style={styles.orLabel}>Ou coche l'épisode où tu t'es arrêté :</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {seasons.map((s) => {
                  const isOpen = open === s.season_number;
                  return (
                    <View key={s.season_number}>
                      <Pressable style={styles.seasonRow} onPress={() => toggleSeason(s.season_number)}>
                        {isOpen ? <ChevronDown size={16} color={colors.dim} /> : <ChevronRight size={16} color={colors.dim} />}
                        <Text style={styles.seasonName}>{s.name || `Saison ${s.season_number}`}</Text>
                        <Text style={styles.seasonCount}>{s.episode_count} ép.</Text>
                      </Pressable>
                      {isOpen && (
                        <View style={styles.epList}>
                          {!eps[s.season_number] ? (
                            <ActivityIndicator style={{ marginVertical: 8 }} size="small" color={colors.accent} />
                          ) : (
                            eps[s.season_number].map((e) => {
                              const on = sel?.type === "ep" && sel.season === s.season_number && sel.ep === e.episode_number;
                              return (
                                <Pressable
                                  key={e.episode_number}
                                  style={styles.epRow}
                                  onPress={() => setSel({ type: "ep", season: s.season_number, ep: e.episode_number })}
                                >
                                  <View style={[styles.epCheck, on && styles.epCheckOn]}>
                                    {on && <Check size={12} color="#fff" />}
                                  </View>
                                  <Text style={[styles.epText, on && { color: colors.text }]}>Épisode {e.episode_number}</Text>
                                </Pressable>
                              );
                            })
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <Pressable
                style={[styles.confirmBtn, (!sel || saving) && styles.confirmBtnDisabled]}
                onPress={() => setConfirm(true)}
                disabled={!sel || saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>Ajouter</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>

      <ConfirmModal
        visible={confirm}
        title="Confirmer"
        message={confirmMsg}
        confirmLabel="Ajouter"
        cancelLabel="Annuler"
        onCancel={() => setConfirm(false)}
        onConfirm={doConfirm}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: 30, borderTopWidth: 1, borderColor: colors.line,
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },

  allBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent,
    borderRadius: radius.md, paddingVertical: 13, marginBottom: 16,
  },
  allBtnActive: { backgroundColor: colors.accent },
  allBtnText: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.accentPastel },
  allBtnTextActive: { color: "#fff" },
  orLabel: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim, marginBottom: 8 },

  seasonRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  seasonName: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  seasonCount: { fontFamily: fonts.body, fontSize: 12, color: colors.dim },
  epList: { paddingLeft: 26, paddingBottom: 6 },
  epRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  epCheck: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1, borderColor: colors.line,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.surface2,
  },
  epCheckOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  epText: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },

  confirmBtn: {
    marginTop: 16, backgroundColor: colors.accent, borderRadius: radius.md,
    paddingVertical: 15, alignItems: "center",
  },
  confirmBtnDisabled: { opacity: 0.45 },
  confirmBtnText: { fontFamily: fonts.headingSemi, fontSize: 15, color: "#fff" },
});
