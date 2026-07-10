// ACCUEIL : recommandations, nouveaux films, nouvelles séries, populaires
import { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, View, Text, Image, Pressable, ActivityIndicator, RefreshControl, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { MediaRow } from "../../src/components/media/MediaRow";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";
import type { TmdbMedia, MediaType } from "../../src/types";
import { isLatinMedia } from "../../src/lib/text";

interface TmdbList {
  results: TmdbMedia[];
}
interface LibraryItem { tmdbId: number; mediaType: MediaType; status: string }
interface Genre { id: number; name: string; count: number }
interface GenreRow { key: string; title: string; mediaType: MediaType; items: TmdbMedia[] }

// Accroches de l'Accueil — une au hasard à chaque ouverture (thème spatial / Neptune)
const GREETINGS = [
  "Cap sur ta prochaine séance",
  "En orbite\u00A0: on vise quoi\u00A0?",
  "Décollage dans 3, 2, 1\u2026",
  "Explore la galaxie de films/séries",
  "Mets le cap sur l'inconnu",
  "Plonge dans l'immensité du catalogue",
  "Gravite autour de ta prochaine obsession",
  "Cap sur des galaxies inexplorées",
  "Une odyssée stellaire t'attend",
];
const pickGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export default function HomeScreen() {
  const [newMovies, setNewMovies] = useState<TmdbMedia[]>([]);
  const [newShows, setNewShows] = useState<TmdbMedia[]>([]);
  const [popMovies, setPopMovies] = useState<TmdbMedia[]>([]);
  const [popShows, setPopShows] = useState<TmdbMedia[]>([]);
  const [greeting] = useState(pickGreeting);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [genreRows, setGenreRows] = useState<GenreRow[]>([]);
  const excludeRef = useRef<Set<string>>(new Set());

  // Récupère les données sans toucher à l'état "chargement" plein écran
  // retire les titres non-latins ET ceux déjà vus / séries en cours ou à jour
  const clean = useCallback((list: TmdbMedia[], mediaType: MediaType) => {
    return list.filter(
      (m) => isLatinMedia(m) && !m.adult && !excludeRef.current.has(`${mediaType}-${m.id}`)
    );
  }, []);

  // Récupère plusieurs pages TMDB et nettoie, jusqu'à ~18 titres (remplit la ligne)
  const fetchRow = useCallback(
    async (base: string, mediaType: MediaType, target = 18): Promise<TmdbMedia[]> => {
      const out: TmdbMedia[] = [];
      const ids = new Set<number>();
      for (let page = 1; page <= 5 && out.length < target; page++) {
        const sep = base.includes("?") ? "&" : "?";
        let data: TmdbList;
        try {
          data = await api.get<TmdbList>(`${base}${sep}page=${page}`);
        } catch {
          break;
        }
        const items = clean(data.results ?? [], mediaType).filter((m) => !ids.has(m.id));
        items.forEach((m) => ids.add(m.id));
        out.push(...items);
        if (!data.results || data.results.length === 0) break;
      }
      return out;
    },
    [clean]
  );

  const fetchData = useCallback(async () => {
    // La bibliothèque d'abord (pour connaître ce qui est déjà vu)
    const lib = await api.get<LibraryItem[]>("/library").catch(() => [] as LibraryItem[]);
    excludeRef.current = new Set(
      lib
        .filter(
          (l) =>
            (l.mediaType === "MOVIE" && l.status === "COMPLETED") ||
            (l.mediaType === "TV" &&
              (l.status === "WATCHING" || l.status === "COMPLETED" || l.status === "ARCHIVED"))
        )
        .map((l) => `${l.mediaType}-${l.tmdbId}`)
    );
    const [nm, ns, pm, ps] = await Promise.all([
      fetchRow("/tmdb/movies/new", "MOVIE"),
      fetchRow("/tmdb/tv/new", "TV"),
      fetchRow("/tmdb/movies/popular", "MOVIE"),
      fetchRow("/tmdb/tv/popular", "TV"),
    ]);
    setNewMovies(nm);
    setNewShows(ns);
    setPopMovies(pm);
    setPopShows(ps);
    setError(nm.length === 0 && ns.length === 0 && pm.length === 0 && ps.length === 0);
    loadGenres();
  }, [fetchRow]);

  // Rangées personnalisées selon les genres les plus regardés
  const loadGenres = useCallback(async () => {
    try {
      const tg = await api.get<{ movie: Genre[]; tv: Genre[] }>("/stats/top-genres");
      const picks = [
        ...tg.movie.slice(0, 2).map((g) => ({ mediaType: "MOVIE" as MediaType, g })),
        ...tg.tv.slice(0, 2).map((g) => ({ mediaType: "TV" as MediaType, g })),
      ];
      const rows = await Promise.all(
        picks.map(async ({ mediaType, g }) => {
          const path = mediaType === "MOVIE" ? "movie" : "tv";
          const items = await fetchRow(`/tmdb/discover/${path}?genre=${g.id}`, mediaType);
          return {
            key: `${mediaType}-${g.id}`,
            title: `${mediaType === "MOVIE" ? "Films" : "Séries"} · ${g.name}`,
            mediaType,
            items,
          } as GenreRow;
        })
      );
      setGenreRows(rows.filter((r) => r.items.length > 0));
    } catch {
      setGenreRows([]);
    }
  }, [fetchRow]);

  // Chargement initial (loader plein écran)
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    await fetchData();
    setLoading(false);
  }, [fetchData]);

  // Pull-to-refresh : garde le contenu affiché, juste le spinner du RefreshControl
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.hint}>Chargement…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorTitle}>Impossible de charger le catalogue</Text>
          <Text style={styles.hint}>Vérifie ta connexion ou que le serveur est démarré.</Text>
          <Pressable style={styles.retry} onPress={load}>
            <Text style={styles.retryText}>Réessayer</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.hello}>{greeting}</Text>
          <MediaRow title="Nouveaux films" items={newMovies} mediaType="MOVIE" />
          <MediaRow title="Nouvelles séries" items={newShows} mediaType="TV" />
          <MediaRow title="Films populaires" items={popMovies} mediaType="MOVIE" />
          <MediaRow title="Séries populaires" items={popShows} mediaType="TV" />
          {genreRows.map((row) => (
            <MediaRow key={row.key} title={row.title} items={row.items} mediaType={row.mediaType} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 100 },
  logo: { width: 190, height: 190 / 3.89, alignSelf: "flex-start", marginBottom: 18 },
  hello: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginBottom: 20 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: "center" },
  errorTitle: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, textAlign: "center" },
  retry: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  retryText: { fontFamily: fonts.headingSemi, fontSize: 13, color: "#fff" },
});
