// ACCUEIL : recommandations, nouveaux films, nouvelles séries, populaires
import { useEffect, useState } from "react";
import { ScrollView, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../src/services/api";
import { MediaRow } from "../../src/components/media/MediaRow";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";
import type { TmdbMedia } from "../../src/types";

interface TmdbList { results: TmdbMedia[] }

export default function HomeScreen() {
  const [newMovies, setNewMovies] = useState<TmdbMedia[]>([]);
  const [newShows, setNewShows] = useState<TmdbMedia[]>([]);
  const [popMovies, setPopMovies] = useState<TmdbMedia[]>([]);
  const [popShows, setPopShows] = useState<TmdbMedia[]>([]);
  // TODO: recommandations via /recommendations

  useEffect(() => {
    api.get<TmdbList>("/tmdb/movies/new").then((d) => setNewMovies(d.results));
    api.get<TmdbList>("/tmdb/tv/new").then((d) => setNewShows(d.results));
    api.get<TmdbList>("/tmdb/movies/popular").then((d) => setPopMovies(d.results));
    api.get<TmdbList>("/tmdb/tv/popular").then((d) => setPopShows(d.results));
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hello}>Quoi ce soir&nbsp;?</Text>
        <MediaRow title="Nouveaux films" items={newMovies} mediaType="MOVIE" />
        <MediaRow title="Nouvelles séries" items={newShows} mediaType="TV" />
        <MediaRow title="Films populaires" items={popMovies} mediaType="MOVIE" />
        <MediaRow title="Séries populaires" items={popShows} mediaType="TV" />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 100 },
  hello: { fontFamily: fonts.heading, fontSize: 24, color: colors.text, marginBottom: 20 },
});
