// EN COURS : prochains épisodes des séries suivies (statut WATCHING)
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { api, tmdbImage } from "../../src/services/api";
import { ProgressBar } from "../../src/components/ui/ProgressBar";
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
  next: { season: number; ep: number } | null;
  watchedCount: number;
  total: number;
}

const epKey = (s: number, e: number) => `${s}-${e}`;

function buildShow(detail: TvDetail, eps: WatchedEp[]): Show {
  const watched = new Set(eps.map((e) => epKey(e.seasonNumber, e.episodeNumber)));
  const regular = detail.seasons
    .filter((s) => s.season_number >= 1 && s.episode_count > 0)
    .sort((a, b) => a.season_number - b.season_number);

  let next: { season: number; ep: number } | null = null;
  let total = 0;
  let watchedCount = 0;
  for (const s of regular) {
    total += s.episode_count;
    for (let ep = 1; ep <= s.episode_count; ep++) {
      const seen = watched.has(epKey(s.season_number, ep));
      if (seen) watchedCount++;
      else if (!next) next = { season: s.season_number, ep };
    }
  }
  return { id: detail.id, name: detail.name, poster: tmdbImage(detail.poster_path, "w185"), next, watchedCount, total };
}

export default function WatchingScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const library = await api.get<LibraryItem[]>("/library?status=WATCHING");
      const tvItems = library.filter((l) => l.mediaType === "TV");
      const built = await Promise.all(
        tvItems.map(async (item) => {
          const [detail, eps] = await Promise.all([
            api.get<TvDetail>(`/tmdb/tv/${item.tmdbId}`),
            api.get<WatchedEp[]>(`/episodes/${item.tmdbId}`).catch(() => [] as WatchedEp[]),
          ]);
          return buildShow(detail, eps);
        })
      );
      // À jour en bas, les séries avec un prochain épisode en haut
      built.sort((a, b) => (a.next ? 0 : 1) - (b.next ? 0 : 1));
      setShows(built);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const [checking, setChecking] = useState<number | null>(null);

  async function checkNext(show: Show) {
    if (!show.next) return;
    const { season, ep } = show.next;
    setChecking(show.id);
    await api
      .post("/episodes/toggle", { tmdbShowId: show.id, seasonNumber: season, episodeNumber: ep })
      .catch(() => {});
    await load(); // recalcule le prochain épisode exact
    setChecking(null);
  }

  const renderItem = ({ item }: { item: Show }) => {
    const progress = item.total > 0 ? item.watchedCount / item.total : 0;
    return (
      <View style={styles.card}>
        <Pressable onPress={() => router.push(`/media/tv/${item.id}`)}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]} />
          )}
        </Pressable>

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {item.name}
          </Text>
          {item.next ? (
            <Text style={styles.next}>
              Prochain : S{item.next.season}·E{item.next.ep}
            </Text>
          ) : (
            <Text style={styles.upToDate}>À jour ✓</Text>
          )}
          <View style={styles.progressRow}>
            <ProgressBar progress={progress} />
          </View>
          <Text style={styles.count}>
            {item.watchedCount}/{item.total} épisodes
          </Text>
        </View>

        {item.next && (
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
        )}
      </View>
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
          renderItem={renderItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Aucune série en cours. Marque une série « En cours » depuis sa fiche pour la suivre ici.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
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
  upToDate: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim },
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
