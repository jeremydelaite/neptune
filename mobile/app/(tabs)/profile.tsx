// COMPTE : profil + statistiques poussées (GET /stats)
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { LogOut, Film, Tv, Clock } from "lucide-react-native";
import { api } from "../../src/services/api";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

interface Stats {
  moviesSeen: number;
  episodesSeen: number;
  seriesTimeMin: number;
  ratingsBreakdown: { score: number; count: number }[];
  monthlyActivity: { month: string; count: number }[];
}

const MONTH_LETTER = ["", "J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api
        .get<Stats>("/stats")
        .then((d) => active && setStats(d))
        .catch(() => active && setStats(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  const maxRating = Math.max(1, ...(stats?.ratingsBreakdown.map((r) => r.count) ?? [1]));
  const maxMonth = Math.max(1, ...(stats?.monthlyActivity.map((m) => m.count) ?? [1]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* En-tête profil */}
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.username ?? "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.violet} />
        ) : !stats ? (
          <Text style={styles.error}>Impossible de charger les statistiques.</Text>
        ) : (
          <>
            {/* Cartes chiffres clés */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Film size={18} color={colors.violetPastel} />
                <Text style={styles.statValue}>{stats.moviesSeen}</Text>
                <Text style={styles.statLabel}>Films vus</Text>
              </View>
              <View style={styles.statCard}>
                <Tv size={18} color={colors.violetPastel} />
                <Text style={styles.statValue}>{stats.episodesSeen}</Text>
                <Text style={styles.statLabel}>Épisodes</Text>
              </View>
              <View style={styles.statCard}>
                <Clock size={18} color={colors.violetPastel} />
                <Text style={styles.statValue}>{formatTime(stats.seriesTimeMin)}</Text>
                <Text style={styles.statLabel}>De séries</Text>
              </View>
            </View>

            {/* Répartition des notes */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Répartition des notes</Text>
              {[5, 4, 3, 2, 1].map((score) => {
                const count = stats.ratingsBreakdown.find((r) => r.score === score)?.count ?? 0;
                return (
                  <View key={score} style={styles.ratingRow}>
                    <Text style={styles.ratingLabel}>{score}★</Text>
                    <View style={styles.ratingTrack}>
                      <View
                        style={[styles.ratingFill, { width: `${(count / maxRating) * 100}%` }]}
                      />
                    </View>
                    <Text style={styles.ratingCount}>{count}</Text>
                  </View>
                );
              })}
            </View>

            {/* Activité mensuelle */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Activité (12 derniers mois)</Text>
              {stats.monthlyActivity.length === 0 ? (
                <Text style={styles.muted}>Pas encore d'activité enregistrée.</Text>
              ) : (
                <View style={styles.chart}>
                  {stats.monthlyActivity.map((m) => {
                    const monthNum = Number(m.month.slice(5, 7));
                    return (
                      <View key={m.month} style={styles.barCol}>
                        <Text style={styles.barCount}>{m.count > 0 ? m.count : ""}</Text>
                        <View
                          style={[
                            styles.bar,
                            { height: `${Math.max(4, (m.count / maxMonth) * 100)}%` },
                          ]}
                        />
                        <Text style={styles.barLabel}>{MONTH_LETTER[monthNum]}</Text>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {/* Déconnexion */}
        <Pressable
          style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
          onPress={logout}
        >
          <LogOut size={18} color={colors.danger} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, paddingBottom: 110 },

  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.violetSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.violet,
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 22, color: colors.violetPastel },
  username: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    alignItems: "flex-start",
    gap: 6,
  },
  statValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },

  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, marginBottom: 14 },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  ratingLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim, width: 24 },
  ratingTrack: {
    flex: 1,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.surface2,
    overflow: "hidden",
  },
  ratingFill: { height: "100%", borderRadius: 99, backgroundColor: colors.violet },
  ratingCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text, width: 24, textAlign: "right" },

  chart: { flexDirection: "row", alignItems: "flex-end", height: 120, gap: 4 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" },
  bar: { width: "70%", minHeight: 4, borderRadius: 4, backgroundColor: colors.violet },
  barCount: { fontFamily: fonts.body, fontSize: 9, color: colors.dim, marginBottom: 3, height: 12 },
  barLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.dim, marginTop: 5 },

  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.md,
    padding: 15,
  },
  logoutPressed: { opacity: 0.7 },
  logoutText: { fontFamily: fonts.headingSemi, fontSize: 15, color: colors.danger },
});
