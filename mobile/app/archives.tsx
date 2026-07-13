// SÉRIES ARCHIVÉES — progression visible, glisser vers la gauche pour désarchiver
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
import { ArrowLeft, ArchiveRestore } from "lucide-react-native";
import { api, tmdbImage } from "../src/services/api";
import { SwipeArchive } from "../src/components/ui/SwipeArchive";
import { ProgressBar } from "../src/components/ui/ProgressBar";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

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

export default function ArchivesScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [swiping, setSwiping] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lib = await api.get<LibraryItem[]>("/library?status=ARCHIVED");
      const tv = lib.filter((l) => l.mediaType === "TV");
      const built = await Promise.all(
        tv.map(async (item): Promise<Show | null> => {
          try {
            const [detail, eps] = await Promise.all([
              api.get<TvDetail>(`/tmdb/tv/${item.tmdbId}`),
              api.get<WatchedEp[]>(`/episodes/${item.tmdbId}`).catch(() => [] as WatchedEp[]),
            ]);
            const watched = new Set(eps.map((e) => epKey(e.seasonNumber, e.episodeNumber)));
            const regular = detail.seasons
              .filter((s) => s.season_number >= 1 && s.episode_count > 0)
              .sort((a, b) => a.season_number - b.season_number);
            const total = regular.reduce((n, s) => n + s.episode_count, 0);
            const watchedCount = [...watched].filter((k) => Number(k.split("-")[0]) >= 1).length;
            let nextSeason: number | null = null;
            for (const s of regular) {
              const w = [...watched].filter((k) => k.startsWith(`${s.season_number}-`)).length;
              if (w < s.episode_count) {
                nextSeason = s.season_number;
                break;
              }
            }
            let next: { season: number; ep: number } | null = null;
            if (nextSeason !== null) {
              try {
                const season = await api.get<{ episodes: { episode_number: number }[] }>(
                  `/tmdb/tv/${item.tmdbId}/season/${nextSeason}`
                );
                const ep = season.episodes.find(
                  (e) => !watched.has(epKey(nextSeason!, e.episode_number))
                );
                if (ep) next = { season: nextSeason, ep: ep.episode_number };
              } catch {
                /* ignore */
              }
            }
            return {
              id: detail.id,
              name: detail.name,
              poster: tmdbImage(detail.poster_path, "w185"),
              next,
              watchedCount,
              total,
            };
          } catch {
            return null;
          }
        })
      );
      setShows(built.filter((s): s is Show => s !== null).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setShows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function unarchive(id: number) {
    setShows((prev) => prev.filter((s) => s.id !== id));
    await api.post("/library", { tmdbId: id, mediaType: "TV", status: "WATCHING" }).catch(() => {});
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/watching");
  };

  const renderItem = ({ item }: { item: Show }) => {
    const progress = item.total > 0 ? item.watchedCount / item.total : 0;
    return (
      <SwipeArchive
        onAction={() => unarchive(item.id)}
        onSwipeStateChange={setSwiping}
        bgColor="rgba(52,211,153,0.18)"
        tintColor="#34D399"
        label="Désarchiver"
        icon={<ArchiveRestore size={18} color="#34D399" />}
      >
        <Pressable style={styles.card} onPress={() => router.push(`/media/tv/${item.id}`)}>
          {item.poster ? (
            <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.posterEmpty]} />
          )}
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
        </Pressable>
      </SwipeArchive>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Séries archivées</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={shows}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          scrollEnabled={!swiping}
          alwaysBounceVertical
          renderItem={renderItem}
          ListHeaderComponent={
            shows.length > 0 ? (
              <Text style={styles.hint}>Glisse une série vers la gauche pour la désarchiver.</Text>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucune série archivée.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  back: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 10 },
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
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.dim,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
