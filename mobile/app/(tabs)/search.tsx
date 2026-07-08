// RECHERCHE : un onglet Films, un onglet Séries
import { useEffect, useRef, useState } from "react";
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

interface TmdbList {
  results: TmdbMedia[];
}

const GAP = 12;
const PADDING = 16;
// Supprime le contour bleu par défaut du navigateur (react-native-web)
const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

export default function SearchScreen() {
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [tab, setTab] = useState<MediaType>("MOVIE");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<TmdbMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (debounce.current) clearTimeout(debounce.current);

    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const path = tab === "MOVIE" ? "movie" : "tv";
        const data = await api.get<TmdbList>(
          `/tmdb/search/${path}?q=${encodeURIComponent(q)}`
        );
        setResults(data.results ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query, tab]);

  const trimmed = query.trim();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>

        <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
          <Search size={18} color={focused ? colors.violetPastel : colors.dim} />
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

      {loading ? (
        <ActivityIndicator style={styles.center} color={colors.violet} />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <PosterCard media={item} mediaType={tab} width={cardWidth} />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {trimmed.length < 2
                ? "Tape au moins 2 caractères pour lancer la recherche."
                : "Aucun résultat."}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 8 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginBottom: 16 },
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
  searchBarFocused: { borderColor: colors.violet },
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
  tabActive: { backgroundColor: colors.violet, borderColor: colors.violet },
  tabText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim },
  tabTextActive: { color: "#fff" },
  center: { marginTop: 40 },
  list: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 100 },
  row: { justifyContent: "space-between", marginBottom: GAP },
  empty: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
