// PROFIL PUBLIC : stats + activité publique d'un utilisateur (clic sur un pseudo)
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Film, Tv, Clock, MessageSquare, Star, ShieldCheck, Flag, EyeOff, Eye, Check } from "lucide-react-native";
import { api } from "../../src/services/api";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

interface PublicProfile {
  id: string;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  createdAt: string;
  isSelf: boolean;
  isBlocked: boolean;
  stats: {
    moviesSeen: number;
    episodesSeen: number;
    seriesTimeMin: number;
    commentsCount: number;
    ratingsBreakdown: { score: number; count: number }[];
  };
  activity: {
    kind: "rating" | "comment";
    tmdbId: number;
    mediaType: "MOVIE" | "TV";
    title: string;
    score?: number;
    content?: string;
    date: string;
  }[];
}

function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

function formatJoined(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export default function PublicProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api
        .get<PublicProfile>(`/users/${id}/public`)
        .then((p) => {
          if (!active) return;
          setProfile(p);
          setBlocked(p.isBlocked);
        })
        .catch(() => active && setProfile(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [id])
  );

  async function toggleBlock() {
    if (!profile || busy) return;
    setBusy(true);
    const next = !blocked;
    setBlocked(next); // optimiste
    try {
      if (next) await api.post(`/users/${profile.id}/block`, {});
      else await api.delete(`/users/${profile.id}/block`);
    } catch {
      setBlocked(!next); // rollback
    } finally {
      setBusy(false);
    }
  }

  const REPORT_REASONS: { key: string; label: string }[] = [
    { key: "SPAM", label: "Spam" },
    { key: "HARASSMENT", label: "Harcèlement" },
    { key: "FAKE", label: "Faux compte" },
    { key: "INAPPROPRIATE", label: "Contenu inapproprié" },
    { key: "OTHER", label: "Autre" },
  ];

  async function submitReport(reason: string) {
    if (!profile) return;
    setReportOpen(false);
    try {
      await api.post(`/users/${profile.id}/report`, { reason });
      setReportDone(true);
    } catch {
      /* ignore */
    }
  }

  const maxRating = Math.max(1, ...(profile?.stats.ratingsBreakdown.map((r) => r.count) ?? [1]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : !profile ? (
        <Text style={styles.error}>Profil introuvable.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* En-tête */}
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{profile.username.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.username}>{profile.username}</Text>
                {profile.isAdmin && <ShieldCheck size={16} color={colors.accentPastel} />}
              </View>
              <Text style={styles.joined}>Membre depuis {formatJoined(profile.createdAt)}</Text>
            </View>
          </View>

          {!profile.isSelf && (
            <View style={styles.actionsRow}>
              <Pressable style={[styles.actionBtn, blocked && styles.actionBtnActive]} onPress={toggleBlock} disabled={busy}>
                {blocked ? <Eye size={16} color={colors.accentPastel} /> : <EyeOff size={16} color={colors.dim} />}
                <Text style={[styles.actionText, blocked && styles.actionTextActive]}>
                  {blocked ? "Ne plus masquer" : "Masquer"}
                </Text>
              </Pressable>
              <Pressable
                style={styles.actionBtn}
                onPress={() => (reportDone ? undefined : setReportOpen(true))}
                disabled={reportDone}
              >
                {reportDone ? <Check size={16} color={colors.accentPastel} /> : <Flag size={16} color={colors.danger} />}
                <Text style={[styles.actionText, reportDone && styles.actionTextActive]}>
                  {reportDone ? "Signalé" : "Signaler"}
                </Text>
              </Pressable>
            </View>
          )}

          {blocked && (
            <Text style={styles.blockedNote}>
              Tu masques ce compte : ses commentaires n'apparaissent plus sur les fiches.
            </Text>
          )}

          {/* Chiffres clés */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Film size={18} color={colors.accentPastel} />
              <Text style={styles.statValue}>{profile.stats.moviesSeen}</Text>
              <Text style={styles.statLabel}>Films vus</Text>
            </View>
            <View style={styles.statCard}>
              <Tv size={18} color={colors.accentPastel} />
              <Text style={styles.statValue}>{profile.stats.episodesSeen}</Text>
              <Text style={styles.statLabel}>Épisodes</Text>
            </View>
            <View style={styles.statCard}>
              <Clock size={18} color={colors.accentPastel} />
              <Text style={styles.statValue}>{formatTime(profile.stats.seriesTimeMin)}</Text>
              <Text style={styles.statLabel}>De séries</Text>
            </View>
          </View>

          <View style={[styles.statCard, styles.commentsCard]}>
            <MessageSquare size={18} color={colors.accentPastel} />
            <Text style={styles.statValue}>{profile.stats.commentsCount}</Text>
            <Text style={styles.statLabel}>Commentaires publiés</Text>
          </View>

          {/* Répartition des notes */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Répartition des notes</Text>
            {[5, 4, 3, 2, 1].map((score) => {
              const count = profile.stats.ratingsBreakdown.find((r) => r.score === score)?.count ?? 0;
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

          {/* Activité publique */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Activité publique</Text>
            {profile.activity.length === 0 ? (
              <Text style={styles.muted}>Aucune activité publique pour l'instant.</Text>
            ) : (
              profile.activity.map((it, i) => (
                <Pressable
                  key={`${it.kind}-${it.tmdbId}-${i}`}
                  style={[styles.actRow, i > 0 && styles.actRowBorder]}
                  onPress={() => router.push(`/media/${it.mediaType.toLowerCase()}/${it.tmdbId}`)}
                >
                  <View style={styles.actIcon}>
                    {it.kind === "rating" ? (
                      <Star size={15} color={colors.accent} fill={colors.accent} />
                    ) : (
                      <MessageSquare size={15} color={colors.accentPastel} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actTitle} numberOfLines={1}>{it.title}</Text>
                    {it.kind === "rating" ? (
                      <Text style={styles.actStars}>
                        {"★".repeat(it.score ?? 0)}
                        <Text style={styles.actStarsEmpty}>{"★".repeat(5 - (it.score ?? 0))}</Text>
                      </Text>
                    ) : (
                      <Text style={styles.actComment} numberOfLines={2}>{it.content}</Text>
                    )}
                  </View>
                  <Text style={styles.actDate}>{shortDate(it.date)}</Text>
                </Pressable>
              ))
            )}
          </View>
        </ScrollView>
      )}

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setReportOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Signaler ce compte</Text>
            <Text style={styles.sheetSub}>Pour quelle raison ?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable key={r.key} style={styles.reasonRow} onPress={() => submitReport(r.key)}>
                <Text style={styles.reasonText}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.cancelRow} onPress={() => setReportOpen(false)}>
              <Text style={styles.cancelText}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  headerTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  content: { padding: 16, paddingBottom: 100 },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },

  profileRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 22 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 22, color: colors.accentPastel },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  username: { fontFamily: fonts.heading, fontSize: 20, color: colors.text },
  joined: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginTop: 2 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
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
  commentsCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
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
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },

  ratingRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  ratingLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim, width: 24 },
  ratingTrack: { flex: 1, height: 8, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden" },
  ratingFill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
  ratingCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text, width: 24, textAlign: "right" },

  actRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  actRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  actIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.surface2, alignItems: "center", justifyContent: "center" },
  actTitle: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.text },
  actStars: { fontSize: 12, color: colors.accent, marginTop: 2 },
  actStarsEmpty: { color: "#4B5262" },
  actComment: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },
  actDate: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },

  actionsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actionBtnActive: { backgroundColor: colors.accentSoft, borderColor: colors.accent },
  actionText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim },
  actionTextActive: { color: colors.accentPastel },
  blockedNote: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 14, marginTop: -4 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 28 },
  sheet: { width: "100%", maxWidth: 380, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, padding: 18 },
  sheetTitle: { fontFamily: fonts.heading, fontSize: 17, color: colors.text, marginBottom: 4 },
  sheetSub: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginBottom: 14 },
  reasonRow: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: colors.line },
  reasonText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  cancelRow: { paddingTop: 14, alignItems: "center" },
  cancelText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim },
});
