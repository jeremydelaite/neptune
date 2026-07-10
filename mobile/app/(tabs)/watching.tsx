// EN COURS : séries commencées mais pas terminées (calcul d'après les épisodes vus)
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, Archive, Package, ChevronRight } from "lucide-react-native";
import { api, tmdbImage } from "../../src/services/api";
import { ProgressBar } from "../../src/components/ui/ProgressBar";
import { SwipeArchive } from "../../src/components/ui/SwipeArchive";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

interface LibraryItem {
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  status: string;
}
interface TmdbSeason {
  season_number: number;
  episode_count: number;
}
interface TvDetail {
  id: number;
  name: string;
  poster_path: string | null;
  seasons: TmdbSeason[];
}
interface WatchedEp {
  seasonNumber: number;
  episodeNumber: number;
}

interface Show {
  id: number;
  name: string;
  poster: string | null;
  next: { season: number; ep: number; runtime: number | null } | null;
  watchedCount: number;
  total: number;
}

const epKey = (s: number, e: number) => `${s}-${e}`;

interface BaseInfo {
  detail: TvDetail;
  watched: Set<string>;
  total: number;
  watchedCount: number;
  nextSeason: number | null; // 1re saison incomplète
}

// Comptage d'après les VRAIS numéros d'épisodes vus (numérotation TMDB variable)
function baseInfo(detail: TvDetail, eps: WatchedEp[]): BaseInfo {
  const regularEps = eps.filter((e) => e.seasonNumber >= 1);
  const watched = new Set(regularEps.map((e) => epKey(e.seasonNumber, e.episodeNumber)));
  const regular = detail.seasons
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  const total = regular.reduce((n, s) => n + s.episode_count, 0);
  const watchedCount = watched.size;

  let nextSeason: number | null = null;
  for (const s of regular) {
    const w = [...watched].filter((k) => k.startsWith(`${s.season_number}-`)).length;
    if (w < s.episode_count) {
      nextSeason = s.season_number;
      break;
    }
  }
  return { detail, watched, total, watchedCount, nextSeason };
}

export default function WatchingScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState<number | null>(null);
  const [archivedCount, setArchivedCount] = useState(0);

  // Récupère toutes les séries de la bibliothèque et ne garde que celles
  // commencées mais pas terminées (peu importe le statut stocké).
  const fetchShows = useCallback(async () => {
    // Source = union des séries de la bibliothèque ET de celles avec des épisodes vus
    const [library, watchedShowIds] = await Promise.all([
      api.get<LibraryItem[]>("/library").catch(() => [] as LibraryItem[]),
      api.get<number[]>("/episodes/shows").catch(() => [] as number[]),
    ]);
    const archived = new Set(
      library.filter((l) => l.mediaType === "TV" && l.status === "ARCHIVED").map((l) => l.tmdbId)
    );
    setArchivedCount(archived.size);
    const ids = new Set<number>();
    library.filter((l) => l.mediaType === "TV").forEach((l) => ids.add(l.tmdbId));
    watchedShowIds.forEach((id) => ids.add(id));
    archived.forEach((id) => ids.delete(id)); // séries archivées exclues de "En cours"

    const built = await Promise.all(
      [...ids].map(async (tmdbId) => {
        try {
          const [detail, eps] = await Promise.all([
            api.get<TvDetail>(`/tmdb/tv/${tmdbId}`),
            api.get<WatchedEp[]>(`/episodes/${tmdbId}`).catch(() => [] as WatchedEp[]),
          ]);
          return baseInfo(detail, eps);
        } catch {
          return null;
        }
      })
    );
    // Commencées mais pas terminées
    const inProgress = built.filter(
      (b): b is BaseInfo => b !== null && b.watchedCount > 0 && b.nextSeason !== null
    );

    // Récupère le VRAI prochain épisode (une requête saison par série en cours)
    const shows = await Promise.all(
      inProgress.map(async (b): Promise<Show | null> => {
        let next: { season: number; ep: number; runtime: number | null } | null = null;
        try {
          const season = await api.get<{ episodes: { episode_number: number; runtime: number | null }[] }>(
            `/tmdb/tv/${b.detail.id}/season/${b.nextSeason}`
          );
          const ep = season.episodes.find(
            (e) => !b.watched.has(epKey(b.nextSeason!, e.episode_number))
          );
          if (ep) next = { season: b.nextSeason!, ep: ep.episode_number, runtime: ep.runtime ?? null };
        } catch {
          /* ignore */
        }
        if (!next) return null;
        return {
          id: b.detail.id,
          name: b.detail.name,
          poster: tmdbImage(b.detail.poster_path, "w185"),
          next,
          watchedCount: b.watchedCount,
          total: b.total,
        };
      })
    );
    const finalShows = shows.filter((s): s is Show => s !== null);
    finalShows.sort((a, b) => a.name.localeCompare(b.name));
    setShows(finalShows);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      await fetchShows();
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [fetchShows]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchShows();
      setError(false);
    } catch {
      setError(true);
    } finally {
      setRefreshing(false);
    }
  }, [fetchShows]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function checkNext(show: Show) {
    if (!show.next) return;
    const { season, ep, runtime } = show.next;
    setChecking(show.id);
    await api
      .post("/episodes/toggle", {
        tmdbShowId: show.id,
        seasonNumber: season,
        episodeNumber: ep,
        ...(runtime ? { runtimeMin: runtime } : {}),
      })
      .catch(() => {});
    await fetchShows().catch(() => {});
    setChecking(null);
  }

  async function archive(id: number) {
    setShows((prev) => prev.filter((s) => s.id !== id));
    setArchivedCount((c) => c + 1);
    await api.post("/library", { tmdbId: id, mediaType: "TV", status: "ARCHIVED" }).catch(() => {});
  }

  const renderItem = ({ item }: { item: Show }) => {
    const progress = item.total > 0 ? item.watchedCount / item.total : 0;
    return (
      <SwipeArchive
        onAction={() => archive(item.id)}
        bgColor="rgba(255,138,61,0.18)"
        tintColor="#FF9D4D"
        label="Archiver"
        icon={<Archive size={18} color="#FF9D4D" />}
      >
      <View style={styles.card}>
        <Pressable onPress={() => router.push(`/media/tv/${item.id}`)}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]} />
          )}
        </Pressable>

        <Pressable style={styles.info} onPress={() => router.push(`/media/tv/${item.id}`)}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.next}>
            Prochain : S{item.next!.season}·E{item.next!.ep}
          </Text>
          <View style={styles.progressRow}>
            <ProgressBar progress={progress} />
          </View>
          <Text style={styles.count}>
            {item.watchedCount}/{item.total} épisodes
          </Text>
        </Pressable>

        <Pressable
          style={styles.check}
          onPress={() => checkNext(item)}
          disabled={checking === item.id}
          hitSlop={8}
        >
          {checking === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Check size={18} color="#fff" strokeWidth={3} />
          )}
        </Pressable>
      </View>
      </SwipeArchive>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.screenTitle}>En cours</Text>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Impossible de charger tes séries.</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={shows}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          alwaysBounceVertical
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ListHeaderComponent={
            shows.length > 0 ? (
              <Text style={styles.hint}>Glisse une série vers la gauche pour l'archiver.</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>
              Aucune série en cours. Commence à cocher des épisodes d'une série pour la voir apparaître ici.
            </Text>
          }
        />
      )}

      {archivedCount > 0 && (
        <Pressable style={styles.archiveBar} onPress={() => router.push("/archives")}>
          <Package size={18} color="#FF9D4D" />
          <Text style={styles.archiveEntryText}>Séries archivées ({archivedCount})</Text>
          <ChevronRight size={18} color={colors.dim} />
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 10 },
  archiveBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 90,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  archiveEntryText: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  list: { paddingHorizontal: 16, paddingBottom: 160, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
  },
  poster: { width: 54, height: 80, borderRadius: 8, backgroundColor: colors.surface2 },
  posterEmpty: { borderWidth: 1, borderColor: colors.line },
  info: { flex: 1, gap: 5 },
  title: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  next: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.accentPastel },
  progressRow: { marginTop: 2 },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  check: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  errorText: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },
  retry: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: radius.md, backgroundColor: colors.accent },
  retryText: { fontFamily: fonts.headingSemi, fontSize: 13, color: "#fff" },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.dim,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
});
