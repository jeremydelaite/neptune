// ACCUEIL : recommandations, nouveaux films, nouvelles séries, populaires
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { MediaRow } from "../../src/components/media/MediaRow";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";
import type { TmdbMedia } from "../../src/types";

interface TmdbList {
  results: TmdbMedia[];
}

// Accroches de l'Accueil — une au hasard à chaque ouverture
const GREETINGS = [
  "Qu'est-ce qu'on regarde\u00A0?",
  "Ce soir, on regarde quoi\u00A0?",
  "Prêt pour une séance\u00A0?",
  "Cap sur ta prochaine séance",
  "Explore ta galaxie de films",
  "Ta prochaine obsession est ici",
  "Trouve ta pépite du soir",
  "En orbite. On vise quoi\u00A0?",
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

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    const results = await Promise.allSettled([
      api.get<TmdbList>("/tmdb/movies/new"),
      api.get<TmdbList>("/tmdb/tv/new"),
      api.get<TmdbList>("/tmdb/movies/popular"),
      api.get<TmdbList>("/tmdb/tv/popular"),
    ]);
    const [nm, ns, pm, ps] = results;
    if (nm.status === "fulfilled") setNewMovies(nm.value.results);
    if (ns.status === "fulfilled") setNewShows(ns.value.results);
    if (pm.status === "fulfilled") setPopMovies(pm.value.results);
    if (ps.status === "fulfilled") setPopShows(ps.value.results);
    setError(results.every((r) => r.status === "rejected"));
    setLoading(false);
  }, []);

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
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.hello}>{greeting}</Text>
          <MediaRow title="Nouveaux films" items={newMovies} mediaType="MOVIE" />
          <MediaRow title="Nouvelles séries" items={newShows} mediaType="TV" />
          <MediaRow title="Films populaires" items={popMovies} mediaType="MOVIE" />
          <MediaRow title="Séries populaires" items={popShows} mediaType="TV" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 100 },
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
