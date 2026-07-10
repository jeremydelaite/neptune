// VU : films vus (COMPLETED) + séries en cours (WATCHING) ou à jour (COMPLETED)
// Filtres Tout/Films/Séries + scroll infini (détails TMDB paginés).
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { api } from "../src/services/api";
import { PosterCard } from "../src/components/media/PosterCard";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";
import type { TmdbMedia, MediaType } from "../src/types";

interface LibraryItem {
  tmdbId: number;
  mediaType: MediaType;
  status: string;
}
interface Entry {
  media: TmdbMedia;
  mediaType: MediaType;
}
type Filter = "ALL" | "MOVIE" | "TV";

const GAP = 12;
const PADDING = 16;
const PAGE = 12;

export default function WatchedScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");

  const allRef = useRef<LibraryItem[]>([]); // tous les "vus"
  const idsRef = useRef<LibraryItem[]>([]); // sous-ensemble filtré
  const cursorRef = useRef(0);
  const busyRef = useRef(false);

  const enrich = useCallback(async (slice: LibraryItem[]): Promise<Entry[]> => {
    const built = await Promise.all(
      slice.map(async (it) => {
        try {
          const path = it.mediaType === "MOVIE" ? "movie" : "tv";
          const media = await api.get<TmdbMedia>(`/tmdb/${path}/${it.tmdbId}`);
          return { media, mediaType: it.mediaType } as Entry;
        } catch {
          return null;
        }
      })
    );
    return built.filter((e): e is Entry => e !== null);
  }, []);

  const loadNext = useCallback(async () => {
    if (busyRef.current) return;
    if (cursorRef.current >= idsRef.current.length) return;
    busyRef.current = true;
    setLoadingMore(true);
    const slice = idsRef.current.slice(cursorRef.current, cursorRef.current + PAGE);
    cursorRef.current += slice.length;
    const built = await enrich(slice);
    setEntries((prev) => [...prev, ...built]);
    setLoadingMore(false);
    busyRef.current = false;
  }, [enrich]);

  // (re)construit la liste selon le filtre choisi
  const rebuild = useCallback(
    async (f: Filter) => {
      idsRef.current = allRef.current.filter((l) => f === "ALL" || l.mediaType === f);
      cursorRef.current = 0;
      setEntries([]);
      await loadNext();
    },
    [loadNext]
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lib = await api.get<LibraryItem[]>("/library");
      allRef.current = lib.filter(
        (l) =>
          (l.mediaType === "MOVIE" && l.status === "COMPLETED") ||
          (l.mediaType === "TV" && (l.status === "WATCHING" || l.status === "COMPLETED"))
      );
      await rebuild(filter);
    } catch {
      allRef.current = [];
      idsRef.current = [];
    } finally {
      setLoading(false);
    }
  }, [filter, rebuild]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function selectFilter(f: Filter) {
    if (f === filter) return;
    setFilter(f);
    rebuild(f);
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const hasMore = cursorRef.current < idsRef.current.length;
  const TABS: { key: Filter; label: string }[] = [
    { key: "ALL", label: "Tout" },
    { key: "MOVIE", label: "Films" },
    { key: "TV", label: "Séries" },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Vu</Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = filter === t.key;
          return (
            <Pressable
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => selectFilter(t.key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.mediaType}-${e.media.id}`}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          onEndReached={loadNext}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => (
            <PosterCard media={item.media} mediaType={item.mediaType} width={cardWidth} posterSize="w185" />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {filter === "MOVIE"
                ? "Aucun film vu pour l'instant."
                : filter === "TV"
                ? "Aucune série commencée pour l'instant."
                : "Rien de vu pour l'instant. Marque un film « Vu » ou commence une série."}
            </Text>
          }
          ListFooterComponent={
            loadingMore && hasMore ? (
              <ActivityIndicator style={{ marginVertical: 16 }} color={colors.accent} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 6 },
  back: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: PADDING, paddingBottom: 10 },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim },
  tabTextActive: { color: "#fff" },

  list: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 100 },
  row: { gap: GAP, marginBottom: GAP },
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
