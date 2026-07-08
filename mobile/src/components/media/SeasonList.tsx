// Liste des saisons (accordéon) avec cases à cocher par épisode et par saison
import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { ChevronDown, ChevronRight, Check } from "lucide-react-native";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

export interface TmdbSeason {
  season_number: number;
  name: string;
  episode_count: number;
}

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  runtime: number | null;
}

interface Props {
  showId: number;
  seasons: TmdbSeason[];
  watched: Set<string>;
  onToggle: (season: number, ep: number, runtime: number | null) => void;
  onMarkSeason: (season: number, episodes: { episodeNumber: number; runtimeMin?: number }[]) => void;
  onUnmarkSeason: (season: number) => void;
}

export const epKey = (s: number, e: number) => `${s}-${e}`;

export function SeasonList({ showId, seasons, watched, onToggle, onMarkSeason, onUnmarkSeason }: Props) {
  const [open, setOpen] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<Record<number, Episode[]>>({});
  const [loading, setLoading] = useState<number | null>(null);

  async function fetchSeason(season: number): Promise<Episode[]> {
    if (episodes[season]) return episodes[season];
    const data = await api.get<{ episodes: Episode[] }>(`/tmdb/tv/${showId}/season/${season}`);
    setEpisodes((prev) => ({ ...prev, [season]: data.episodes }));
    return data.episodes;
  }

  async function toggleOpen(season: number) {
    if (open === season) {
      setOpen(null);
      return;
    }
    setOpen(season);
    if (!episodes[season]) {
      setLoading(season);
      try {
        await fetchSeason(season);
      } catch {
        /* ignore */
      } finally {
        setLoading(null);
      }
    }
  }

  async function handleMarkAll(season: number, total: number, watchedCount: number) {
    const eps = await fetchSeason(season).catch(() => [] as Episode[]);
    if (watchedCount >= total && total > 0) {
      onUnmarkSeason(season);
    } else {
      onMarkSeason(
        season,
        eps.map((e) => ({
          episodeNumber: e.episode_number,
          runtimeMin: e.runtime ?? undefined,
        }))
      );
    }
  }

  return (
    <View style={{ gap: 8 }}>
      {seasons.map((s) => {
        const list = episodes[s.season_number];
        const watchedCount = [...watched].filter((k) =>
          k.startsWith(`${s.season_number}-`)
        ).length;
        const total = s.episode_count;
        const allWatched = total > 0 && watchedCount >= total;
        const isOpen = open === s.season_number;

        return (
          <View key={s.season_number} style={styles.season}>
            <Pressable style={styles.seasonHeader} onPress={() => toggleOpen(s.season_number)}>
              {isOpen ? (
                <ChevronDown size={18} color={colors.dim} />
              ) : (
                <ChevronRight size={18} color={colors.dim} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.seasonName}>{s.name}</Text>
                <Text style={styles.seasonMeta}>
                  {watchedCount}/{total} épisode{total > 1 ? "s" : ""} vu{total > 1 ? "s" : ""}
                </Text>
              </View>
              <Pressable
                style={[styles.markBtn, allWatched && styles.markBtnActive]}
                onPress={() => handleMarkAll(s.season_number, total, watchedCount)}
                hitSlop={6}
              >
                <Text style={[styles.markText, allWatched && styles.markTextActive]}>
                  {allWatched ? "Tout retirer" : "Tout vu"}
                </Text>
              </Pressable>
            </Pressable>

            {isOpen && (
              <View style={styles.epList}>
                {loading === s.season_number ? (
                  <ActivityIndicator color={colors.violet} style={{ marginVertical: 12 }} />
                ) : (
                  (list ?? []).map((e) => {
                    const on = watched.has(epKey(s.season_number, e.episode_number));
                    return (
                      <Pressable
                        key={e.id}
                        style={styles.epRow}
                        onPress={() => onToggle(s.season_number, e.episode_number, e.runtime)}
                      >
                        <View style={[styles.check, on && styles.checkOn]}>
                          {on && <Check size={13} color="#fff" strokeWidth={3} />}
                        </View>
                        <Text style={styles.epNum}>{e.episode_number}</Text>
                        <Text style={styles.epName} numberOfLines={1}>
                          {e.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  season: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  seasonHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  seasonName: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  seasonMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },
  markBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.violet,
  },
  markBtnActive: { borderColor: colors.dangerLine, backgroundColor: colors.dangerSoft },
  markText: { fontFamily: fonts.headingSemi, fontSize: 11, color: colors.violetPastel },
  markTextActive: { color: colors.danger },
  epList: { borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 14, paddingBottom: 6 },
  epRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.violet, borderColor: colors.violet },
  epNum: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim, width: 20 },
  epName: { fontFamily: fonts.body, fontSize: 13, color: colors.text, flex: 1 },
});
