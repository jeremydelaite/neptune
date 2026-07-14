// STATISTIQUES DÉTAILLÉES : activité mensuelle, genres favoris, temps total, note moyenne
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Film, Tv } from "lucide-react-native";
import { api } from "../src/services/api";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface Stats {
  moviesSeen: number;
  seriesSeen: number;
  episodesSeen: number;
  seriesTimeMin: number;
  ratingsBreakdown: { score: number; count: number }[];
  monthlyActivity: { month: string; count: number }[];
}
interface Genre { id: number; name: string; count: number }
interface TopGenres { movie: Genre[]; tv: Genre[] }

function monthLabel(ym: string): string {
  const d = new Date(`${ym}-01T00:00:00`);
  return d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", "");
}

export default function StatsScreen() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [genres, setGenres] = useState<TopGenres | null>(null);
  const [loading, setLoading] = useState(true);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        api.get<Stats>("/stats"),
        api.get<TopGenres>("/stats/top-genres").catch(() => ({ movie: [], tv: [] })),
      ])
        .then(([s, g]) => {
          if (!active) return;
          setStats(s);
          setGenres(g);
        })
        .catch(() => active && setStats(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  const months = stats?.monthlyActivity ?? [];
  const maxMonth = Math.max(1, ...months.map((m) => m.count));
  const maxGenre = Math.max(1, ...(genres?.movie ?? []).map((g) => g.count), ...(genres?.tv ?? []).map((g) => g.count));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Statistiques</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : !stats ? (
        <Text style={styles.error}>Impossible de charger les statistiques.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Activité mensuelle */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activité (épisodes / mois)</Text>
            {months.length === 0 ? (
              <Text style={styles.muted}>Pas encore d'activité de séries.</Text>
            ) : (
              <View style={styles.chart}>
                {months.map((m) => (
                  <View key={m.month} style={styles.barCol}>
                    <Text style={styles.barValue}>{m.count > 0 ? m.count : ""}</Text>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${(m.count / maxMonth) * 100}%` }]} />
                    </View>
                    <Text style={styles.barLabel}>{monthLabel(m.month)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Genres favoris */}
          <View style={styles.card}>
            <View style={styles.gHeader}>
              <Film size={15} color={colors.accentPastel} />
              <Text style={styles.cardTitle}>Genres favoris — Films</Text>
            </View>
            {(genres?.movie ?? []).length === 0 ? (
              <Text style={styles.muted}>Regarde des films pour voir tes genres.</Text>
            ) : (
              genres!.movie.map((g) => (
                <View key={g.id} style={styles.gRow}>
                  <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                  <View style={styles.gTrack}>
                    <View style={[styles.gFill, { width: `${(g.count / maxGenre) * 100}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={styles.card}>
            <View style={styles.gHeader}>
              <Tv size={15} color={colors.accentPastel} />
              <Text style={styles.cardTitle}>Genres favoris — Séries</Text>
            </View>
            {(genres?.tv ?? []).length === 0 ? (
              <Text style={styles.muted}>Regarde des séries pour voir tes genres.</Text>
            ) : (
              genres!.tv.map((g) => (
                <View key={g.id} style={styles.gRow}>
                  <Text style={styles.gName} numberOfLines={1}>{g.name}</Text>
                  <View style={styles.gTrack}>
                    <View style={[styles.gFill, { width: `${(g.count / maxGenre) * 100}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  back: {
    width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },

  content: { padding: 16, paddingBottom: 100 },
  row: { flexDirection: "row", gap: 10, marginBottom: 14 },
  mini: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: 14, alignItems: "flex-start", gap: 6,
  },
  miniValue: { fontFamily: fonts.heading, fontSize: 17, color: colors.text },
  miniLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.dim },

  card: {
    backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1,
    borderRadius: radius.lg, padding: 16, marginBottom: 14,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, marginBottom: 14 },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },

  chart: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 150 },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: 4 },
  barValue: { fontFamily: fonts.bodyMedium, fontSize: 9, color: colors.dim },
  barTrack: { width: "100%", flex: 1, justifyContent: "flex-end", backgroundColor: colors.surface2, borderRadius: 6, overflow: "hidden" },
  bar: { width: "100%", backgroundColor: colors.accent, borderRadius: 6, minHeight: 2 },
  barLabel: { fontFamily: fonts.body, fontSize: 9, color: colors.dim },

  gHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  gRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  gName: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text, width: 90 },
  gTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden" },
  gFill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
});
