// RECHERCHE : onglets Films/Séries — cache client, anti-race, scroll infini
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";
import { api } from "../../src/services/api";
import { PosterCard } from "../../src/components/media/PosterCard";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";
import type { TmdbMedia, MediaType } from "../../src/types";
import { isLatinMedia } from "../../src/lib/text";

interface TmdbList {
  results: TmdbMedia[];
  page: number;
  total_pages: number;
}

interface CacheEntry {
  results: TmdbMedia[];
  page: number;
  totalPages: number;
}

const GAP = 12;
const PADDING = 16;
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [tab, setTab] = useState<MediaType>("MOVIE");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<TmdbMedia[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const cache = useRef<Map<string, CacheEntry>>(new Map());
  const reqId = useRef(0); // garde anti-race
  const prevTab = useRef<MediaType>("MOVIE"); // détecte le changement d'onglet
  const loadingMoreRef = useRef(false); // verrou page suivante (évite les doublons)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cacheKey = (t: MediaType, q: string) => `${t}:${q.toLowerCase()}`;

  const fetchPage = useCallback(
    async (t: MediaType, q: string, pageNum: number, append: boolean) => {
      const myId = ++reqId.current;
      const path = t === "MOVIE" ? "movie" : "tv";
      try {
        const data = await api.get<TmdbList>(
          `/tmdb/search/${path}?q=${encodeURIComponent(q)}&page=${pageNum}`
        );
        if (myId !== reqId.current) return; // réponse périmée → ignorée

        setResults((prev) => {
          const base = append ? prev : [];
          const seen = new Set(base.map((m) => m.id));
          const merged = [
            ...base,
            ...data.results.filter((m) => !seen.has(m.id) && isLatinMedia(m)),
          ];
          // Les plus populaires d'abord (évite les films/séries B au titre exact)
          merged.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
          cache.current.set(cacheKey(t, q), {
            results: merged,
            page: data.page,
            totalPages: data.total_pages,
          });
          return merged;
        });
        setPage(data.page);
        setTotalPages(data.total_pages);
      } catch {
        if (myId === reqId.current && !append) setResults([]);
      } finally {
        if (myId === reqId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
        loadingMoreRef.current = false;
      }
    },
    []
  );

  // Nouvelle recherche quand query ou onglet change
  useEffect(() => {
    const q = query.trim();
    if (debounce.current) clearTimeout(debounce.current);

    if (q.length < 2) {
      reqId.current++; // annule toute réponse en vol
      loadingMoreRef.current = false;
      setResults([]);
      setPage(1);
      setTotalPages(1);
      setLoading(false);
      return;
    }

    // Cache client : affichage instantané si déjà cherché
    const cached = cache.current.get(cacheKey(tab, q));
    if (cached) {
      prevTab.current = tab;
      reqId.current++;
      setResults(cached.results);
      setPage(cached.page);
      setTotalPages(cached.totalPages);
      setLoading(false);
      return;
    }

    const tabChanged = prevTab.current !== tab;
    prevTab.current = tab;
    if (tabChanged) {
      // Onglet différent = autre type : on vide pour ne pas relabelliser les affiches
      reqId.current++;
      setResults([]);
    }
    setLoading(true); // sinon (même onglet) les anciens résultats restent visibles
    debounce.current = setTimeout(() => fetchPage(tab, q, 1, false), 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, tab, fetchPage]);

  const loadMore = () => {
    const q = query.trim();
    if (loading || loadingMoreRef.current || q.length < 2 || page >= totalPages) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    fetchPage(tab, q, page + 1, true);
  };

  const trimmed = query.trim();
  const showInitialSpinner = loading && results.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Recherche</Text>
          {loading && results.length > 0 && (
            <ActivityIndicator size="small" color={colors.accentPastel} />
          )}
        </View>

        <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
          <Search size={18} color={focused ? colors.accentPastel : colors.dim} />
          <TextInput
            style={[styles.input, noOutline]}
            placeholder={tab === "MOVIE" ? "Rechercher un film…" : "Rechercher une série…"}
            placeholderTextColor={colors.dim}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={18} color={colors.dim} />
            </Pressable>
          )}
        </View>

        <View style={styles.tabs}>
          {(["MOVIE", "TV"] as MediaType[]).map((t) => {
            const active = tab === t;
            return (
              <Pressable
                key={t}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(t)}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {t === "MOVIE" ? "Films" : "Séries"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {showInitialSpinner ? (
        <ActivityIndicator style={styles.center} color={colors.accent} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          removeClippedSubviews
          initialNumToRender={12}
          windowSize={7}
          renderItem={({ item }) => (
            <PosterCard media={item} mediaType={tab} width={cardWidth} posterSize="w185" />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {trimmed.length < 2
                ? "Tape au moins 2 caractères pour lancer la recherche."
                : "Aucun résultat."}
            </Text>
          }
          ListFooterComponent={
            loadingMore ? (
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
  header: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    height: 46,
  },
  searchBarFocused: { borderColor: colors.accent },
  input: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    height: "100%",
  },
  tabs: { flexDirection: "row", gap: 8, marginTop: 14 },
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
  center: { marginTop: 40 },
  list: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 100 },
  row: { gap: GAP, marginBottom: GAP },
  empty: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
