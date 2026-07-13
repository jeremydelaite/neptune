// Modale raccourcie : marquer une série comme vue (tout, ou "j'en suis là S·E")
import { useEffect, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { Check, X, ChevronDown, ChevronRight } from "lucide-react-native";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

interface Season { season_number: number; episode_count: number; name: string }
interface Ep { episode_number: number; runtime: number | null }

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
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || tvId == null) return;
    setLoading(true);
    setOpen(null);
    setEps({});
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

  // Marque comme vus tous les épisodes jusqu'à (targetSeason, maxEp) inclus
  async function markUpTo(targetSeason: number, maxEp: number | null) {
    if (tvId == null || saving) return;
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
    }
  }

  const lastSeason = seasons.length ? Math.max(...seasons.map((s) => s.season_number)) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.headerRow}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.dim} />
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 30 }} color={colors.accent} />
          ) : saving ? (
            <View style={{ paddingVertical: 30, alignItems: "center", gap: 10 }}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.hint}>Enregistrement…</Text>
            </View>
          ) : (
            <>
              <Pressable style={styles.allBtn} onPress={() => markUpTo(lastSeason, null)}>
                <Check size={16} color="#fff" />
                <Text style={styles.allBtnText}>J'ai tout regardé</Text>
              </Pressable>

              <Text style={styles.orLabel}>Ou indique où tu en es :</Text>
              <ScrollView style={{ maxHeight: 340 }}>
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
                            eps[s.season_number].map((e) => (
                              <Pressable
                                key={e.episode_number}
                                style={styles.epRow}
                                onPress={() => markUpTo(s.season_number, e.episode_number)}
                              >
                                <Text style={styles.epText}>Épisode {e.episode_number}</Text>
                                <Text style={styles.epHint}>j'en suis là</Text>
                              </Pressable>
                            ))
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
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
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },

  allBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 14, marginBottom: 16,
  },
  allBtnText: { fontFamily: fonts.headingSemi, fontSize: 14, color: "#fff" },
  orLabel: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim, marginBottom: 8 },

  seasonRow: {
    flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
  seasonName: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  seasonCount: { fontFamily: fonts.body, fontSize: 12, color: colors.dim },
  epList: { paddingLeft: 26, paddingBottom: 6 },
  epRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  epText: { fontFamily: fonts.body, fontSize: 13, color: colors.text },
  epHint: { fontFamily: fonts.body, fontSize: 11, color: colors.accentPastel },
});
