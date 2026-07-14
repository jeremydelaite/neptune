// CARTE DE VISITE : image stylisée des stats, exportable / partageable
import { useCallback, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Share2, Film, Tv, Clock, MessageSquare, Star, ListChecks } from "lucide-react-native";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { api } from "../src/services/api";
import { useAuth } from "../src/hooks/useAuth";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface Stats {
  moviesSeen: number;
  seriesSeen: number;
  episodesSeen: number;
  seriesTimeMin: number;
  friendsCount: number;
  commentsCount: number;
  ratingsBreakdown: { score: number; count: number }[];
}

function formatHours(min: number): string {
  const h = Math.round(min / 60);
  return `${h} h`;
}

export default function CardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<Stats>("/stats")
        .then((s) => active && setStats(s))
        .catch(() => active && setStats(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  async function share() {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: "png", quality: 1 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Ma carte Neptune" });
      }
    } catch {
      /* ignore */
    } finally {
      setSharing(false);
    }
  }

  const maxRating = Math.max(1, ...(stats?.ratingsBreakdown.map((r) => r.count) ?? [1]));
  const totalRatings = stats?.ratingsBreakdown.reduce((a, r) => a + r.count, 0) ?? 0;
  const avgRating = totalRatings
    ? (stats!.ratingsBreakdown.reduce((a, r) => a + r.score * r.count, 0) / totalRatings)
    : 0;

  const STATS = stats
    ? [
        { icon: Film, value: stats.moviesSeen, label: "Films" },
        { icon: Tv, value: stats.seriesSeen, label: "Séries" },
        { icon: ListChecks, value: stats.episodesSeen, label: "Épisodes" },
        { icon: Clock, value: formatHours(stats.seriesTimeMin), label: "De séries" },
        { icon: Star, value: totalRatings ? `${avgRating.toFixed(1)}/5` : "—", label: "Note moy." },
        { icon: MessageSquare, value: stats.commentsCount, label: "Commentaires" },
      ]
    : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Carte de visite</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : !stats ? (
        <Text style={styles.error}>Impossible de charger tes statistiques.</Text>
      ) : (
        <View style={styles.wrap}>
          {/* Carte capturée */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <LinearGradient colors={["#12233f", "#0F1115"]} style={StyleSheet.absoluteFill} />
            <View style={styles.cardTop}>
              <Text style={styles.brand}>NEPTUNE</Text>
              <View style={styles.userRow}>
                {user?.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{(user?.username ?? "?").charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <Text style={styles.username} numberOfLines={1}>{user?.username}</Text>
              </View>
            </View>

            <View style={styles.grid}>
              {STATS.map((s, i) => (
                <View key={i} style={styles.cell}>
                  <s.icon size={18} color={colors.accentPastel} />
                  <Text style={styles.cellValue}>{s.value}</Text>
                  <Text style={styles.cellLabel}>{s.label}</Text>
                </View>
              ))}
            </View>

            <Text style={styles.ratingTitle}>Répartition des notes</Text>
            <View style={styles.ratingBox}>
              {[5, 4, 3, 2, 1].map((score) => {
                const count = stats.ratingsBreakdown.find((r) => r.score === score)?.count ?? 0;
                return (
                  <View key={score} style={styles.ratingRow}>
                    <Text style={styles.ratingLabel}>{score}★</Text>
                    <View style={styles.ratingTrack}>
                      <View style={[styles.ratingFill, { width: `${(count / maxRating) * 100}%` }]} />
                    </View>
                    <Text style={styles.ratingCount}>{count}</Text>
                  </View>
                );
              })}
            </View>

            <Text style={styles.footer}>Mes films & séries, suivis sur Neptune 🪐</Text>
          </View>

          <Pressable style={styles.shareBtn} onPress={share} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Share2 size={18} color="#fff" />
                <Text style={styles.shareText}>Partager ma carte</Text>
              </>
            )}
          </Pressable>
        </View>
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
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },

  wrap: { padding: 16, gap: 16 },
  card: {
    borderRadius: 20, padding: 20, overflow: "hidden",
    borderWidth: 1, borderColor: colors.accent,
  },
  cardTop: { marginBottom: 18 },
  brand: { fontFamily: fonts.heading, fontSize: 20, letterSpacing: 4, color: colors.accentPastel },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 14 },
  avatar: { width: 52, height: 52, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  avatarFallback: {
    width: 52, height: 52, borderRadius: 999, backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent,
  },
  avatarLetter: { fontFamily: fonts.heading, fontSize: 22, color: colors.accentPastel },
  username: { flex: 1, fontFamily: fonts.heading, fontSize: 22, color: "#fff" },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "33.33%", alignItems: "center", paddingVertical: 12, gap: 4 },
  cellValue: { fontFamily: fonts.heading, fontSize: 19, color: "#fff" },
  cellLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },

  ratingTitle: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim, marginTop: 14, marginBottom: 10 },
  ratingBox: { gap: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  ratingLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim, width: 24 },
  ratingTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  ratingFill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
  ratingCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: "#fff", width: 24, textAlign: "right" },

  footer: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, textAlign: "center", marginTop: 20 },

  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15,
  },
  shareText: { fontFamily: fonts.headingSemi, fontSize: 15, color: "#fff" },
});
