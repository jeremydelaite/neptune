// COMPTE : profil + statistiques poussées (GET /stats, /stats/activity)
import { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Platform,
  Image,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Film, Tv, Clock, Star, MessageSquare, ShieldAlert, Trash2, CheckCircle2, Bookmark, Eye, Settings, AlertTriangle, Search, X, ImageOff, Bell, Users, Plus } from "lucide-react-native";
import { api } from "../../src/services/api";
import { useAuth } from "../../src/hooks/useAuth";
import { AvatarZoom } from "../../src/components/ui/AvatarZoom";
import { FriendSearchModal } from "../../src/components/social/FriendSearchModal";
import { setUnread as setUnreadStore, subscribeUnread } from "../../src/lib/notifState";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

interface Stats {
  moviesSeen: number;
  episodesSeen: number;
  seriesTimeMin: number;
  friendsCount: number;
  ratingsBreakdown: { score: number; count: number }[];
  monthlyActivity: { month: string; count: number }[];
}

interface ReportedComment {
  id: string;
  content: string;
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  reportCount: number;
  user: { username: string };
}

interface ReportedUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  count: number;
  reasons: Record<string, number>;
}

interface ReportedPhoto {
  id: string;
  username: string;
  avatarUrl: string | null;
  count: number;
}

interface SanctionedUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  bannedAt: string | null;
  suspendedUntil: string | null;
}

interface ActivityItem {
  kind: "rating" | "comment";
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  title: string;
  score?: number;
  content?: string;
  date: string;
}

function formatTime(min: number): string {
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j ${hours % 24} h`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
}

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [hasMoreActivity, setHasMoreActivity] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reported, setReported] = useState<ReportedComment[]>([]);
  const [reportedUsers, setReportedUsers] = useState<ReportedUser[]>([]);
  const [sanctioned, setSanctioned] = useState<SanctionedUser[]>([]);
  const [reportedPhotos, setReportedPhotos] = useState<ReportedPhoto[]>([]);
  const [sanctionQuery, setSanctionQuery] = useState("");
  const [sanctionFocused, setSanctionFocused] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoaded = useRef(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const [friendSearch, setFriendSearch] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const unsub = subscribeUnread(setUnread);
      return unsub;
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!hasLoaded.current) setLoading(true); // loader seulement au 1er affichage
      Promise.all([
        api.get<Stats>("/stats"),
        api.get<{ items: ActivityItem[]; hasMore: boolean }>("/stats/activity?offset=0&limit=5"),
      ])
        .then(([s, a]) => {
          if (!active) return;
          setStats(s);
          setActivity(a.items ?? []);
          setHasMoreActivity(a.hasMore ?? false);
          hasLoaded.current = true;
        })
        .catch(() => active && !hasLoaded.current && setStats(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<{ count: number }>("/notifications/unread-count")
        .then((c) => active && setUnreadStore(c.count))
        .catch(() => {});
      api
        .get<{ warning: string | null; avatarUrl: string | null; username: string; email: string; isAdmin?: boolean }>("/auth/me")
        .then((m) => {
          if (!active) return;
          setWarning(m.warning ?? null);
          // resynchronise le profil local (ex. avatar changé depuis un autre appareil)
          if (
            m.avatarUrl !== user?.avatarUrl ||
            m.username !== user?.username ||
            m.email !== user?.email
          ) {
            updateUser({ avatarUrl: m.avatarUrl, username: m.username, email: m.email, isAdmin: m.isAdmin });
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [])
  );

  async function dismissWarning() {
    setWarning(null);
    await api.post("/auth/dismiss-warning", {}).catch(() => {});
  }

  useFocusEffect(
    useCallback(() => {
      if (!user?.isAdmin) return;
      let active = true;
      api
        .get<ReportedComment[]>("/comments/reported")
        .then((r) => active && setReported(r))
        .catch(() => {});
      api
        .get<ReportedUser[]>("/users/reported")
        .then((r) => active && setReportedUsers(r))
        .catch(() => {});
      api
        .get<SanctionedUser[]>("/users/sanctioned")
        .then((r) => active && setSanctioned(r))
        .catch(() => {});
      api
        .get<ReportedPhoto[]>("/users/reported-photos")
        .then((r) => active && setReportedPhotos(r))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [user?.isAdmin])
  );

  async function dismissReportedUser(id: string) {
    setReportedUsers((prev) => prev.filter((u) => u.id !== id));
    await api.post(`/users/${id}/dismiss-reports`, {}).catch(() => {});
  }

  async function liftSanction(id: string) {
    setSanctioned((prev) => prev.filter((u) => u.id !== id));
    await api.post(`/users/${id}/lift`, {}).catch(() => {});
  }

  async function deletePhoto(id: string) {
    setReportedPhotos((prev) => prev.filter((u) => u.id !== id));
    await api.delete(`/users/${id}/avatar`).catch(() => {});
  }

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const q = sanctionQuery.trim();
  const filteredSanctioned = q ? sanctioned.filter((u) => norm(u.username).includes(norm(q))) : sanctioned;

  const REASON_LABELS: Record<string, string> = {
    SPAM: "Spam",
    HARASSMENT: "Harcèlement",
    FAKE: "Faux compte",
    INAPPROPRIATE: "Inapproprié",
    OTHER: "Autre",
  };

  async function deleteReported(id: string) {
    setReported((prev) => prev.filter((c) => c.id !== id));
    await api.delete(`/comments/${id}`).catch(() => {});
  }

  async function dismissReported(id: string) {
    setReported((prev) => prev.filter((c) => c.id !== id));
    await api.post(`/comments/${id}/dismiss`, {}).catch(() => {});
  }

  async function refreshAll() {
    setRefreshing(true);
    try {
      const [s, a] = await Promise.all([
        api.get<Stats>("/stats"),
        api.get<{ items: ActivityItem[]; hasMore: boolean }>("/stats/activity?offset=0&limit=5"),
      ]);
      setStats(s);
      setActivity(a.items ?? []);
      setHasMoreActivity(a.hasMore ?? false);
      if (user?.isAdmin) {
        const r = await api.get<ReportedComment[]>("/comments/reported").catch(() => []);
        setReported(r);
        const ru = await api.get<ReportedUser[]>("/users/reported").catch(() => []);
        setReportedUsers(ru);
        const sn = await api.get<SanctionedUser[]>("/users/sanctioned").catch(() => []);
        setSanctioned(sn);
        const rp = await api.get<ReportedPhoto[]>("/users/reported-photos").catch(() => []);
        setReportedPhotos(rp);
      }
    } catch {
      /* ignore */
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMoreActivity() {
    setLoadingMore(true);
    try {
      const res = await api.get<{ items: ActivityItem[]; hasMore: boolean }>(
        `/stats/activity?offset=${activity.length}&limit=10`
      );
      setActivity((prev) => [...prev, ...res.items]);
      setHasMoreActivity(res.hasMore);
    } catch {
      /* ignore */
    } finally {
      setLoadingMore(false);
    }
  }

  const maxRating = Math.max(1, ...(stats?.ratingsBreakdown.map((r) => r.count) ?? [1]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={colors.accent} />
        }
      >
        {/* En-tête profil */}
        <View style={styles.profileRow}>
          <AvatarZoom
            uri={user?.avatarUrl}
            fallback={(user?.username ?? "?").charAt(0).toUpperCase()}
            size={56}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.username}>{user?.username}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
          <Pressable onPress={() => router.push("/notifications")} hitSlop={12} style={styles.gear}>
            <Bell size={22} color={colors.dim} />
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 9 ? "9+" : unread}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push("/settings")} hitSlop={12} style={styles.gear}>
            <Settings size={22} color={colors.dim} />
          </Pressable>
        </View>

        {warning && (
          <View style={styles.warnBanner}>
            <AlertTriangle size={18} color="#FBBF24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Avertissement de la modération</Text>
              <Text style={styles.warnText}>{warning}</Text>
            </View>
            <Pressable onPress={dismissWarning} hitSlop={8} style={styles.warnDismiss}>
              <Text style={styles.warnDismissText}>J'ai compris</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
        ) : !stats ? (
          <Text style={styles.error}>Impossible de charger les statistiques.</Text>
        ) : (
          <>
            {/* Cartes chiffres clés */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Film size={18} color={colors.accentPastel} />
                <Text style={styles.statValue}>{stats.moviesSeen}</Text>
                <Text style={styles.statLabel}>Films vus</Text>
              </View>
              <View style={styles.statCard}>
                <Tv size={18} color={colors.accentPastel} />
                <Text style={styles.statValue}>{stats.episodesSeen}</Text>
                <Text style={styles.statLabel}>Épisodes</Text>
              </View>
              <View style={styles.statCard}>
                <Clock size={18} color={colors.accentPastel} />
                <Text style={styles.statValue}>{formatTime(stats.seriesTimeMin)}</Text>
                <Text style={styles.statLabel}>De séries</Text>
              </View>
            </View>

            {/* Amis + ajout rapide */}
            <View style={styles.friendsRow}>
              <Pressable style={styles.friendsCard} onPress={() => setFriendSearch(true)}>
                <View style={styles.linkIcon}>
                  <Users size={18} color={colors.accentPastel} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.friendsValue}>
                    {stats.friendsCount} ami{stats.friendsCount > 1 ? "s" : ""}
                  </Text>
                  <Text style={styles.friendsSub}>Voir mes amis · rechercher</Text>
                </View>
                <Search size={18} color={colors.dim} />
              </Pressable>
              <Pressable style={styles.quickAddBtn} onPress={() => router.push("/quick-add")}>
                <Plus size={22} color={colors.accentPastel} />
                <Text style={styles.quickAddText}>Ajout{"\n"}rapide</Text>
              </Pressable>
            </View>

            {/* Accès aux listes À voir / Vu */}
            <View style={styles.linksRow}>
              <Pressable style={styles.linkCard} onPress={() => router.push("/watchlist")}>
                <View style={styles.linkIcon}>
                  <Bookmark size={18} color={colors.accentPastel} />
                </View>
                <Text style={styles.linkLabel}>À voir</Text>
              </Pressable>
              <Pressable style={styles.linkCard} onPress={() => router.push("/watched")}>
                <View style={styles.linkIcon}>
                  <Eye size={18} color={colors.accentPastel} />
                </View>
                <Text style={styles.linkLabel}>Vu</Text>
              </Pressable>
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

            {/* Dernière activité : notes + commentaires */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dernière activité</Text>
              {activity.length === 0 ? (
                <Text style={styles.muted}>
                  Aucune note ni commentaire pour l'instant.
                </Text>
              ) : (
                activity.map((it, i) => (
                  <Pressable
                    key={`${it.kind}-${it.tmdbId}-${i}`}
                    style={[styles.actRow, i > 0 && styles.actRowBorder]}
                    onPress={() =>
                      router.push(`/media/${it.mediaType.toLowerCase()}/${it.tmdbId}`)
                    }
                  >
                    <View style={styles.actIcon}>
                      {it.kind === "rating" ? (
                        <Star size={15} color={colors.accent} fill={colors.accent} />
                      ) : (
                        <MessageSquare size={15} color={colors.accentPastel} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actTitle} numberOfLines={1}>
                        {it.title}
                      </Text>
                      {it.kind === "rating" ? (
                        <Text style={styles.actStars}>
                          {"★".repeat(it.score ?? 0)}
                          <Text style={styles.actStarsEmpty}>
                            {"★".repeat(5 - (it.score ?? 0))}
                          </Text>
                        </Text>
                      ) : (
                        <Text style={styles.actComment} numberOfLines={2}>
                          {it.content}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.actDate}>{formatDate(it.date)}</Text>
                  </Pressable>
                ))
              )}
              {hasMoreActivity && (
                <Pressable
                  style={styles.moreBtn}
                  onPress={loadMoreActivity}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color={colors.accentPastel} />
                  ) : (
                    <Text style={styles.moreText}>Afficher plus</Text>
                  )}
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Modération (admin) */}
        {!loading && stats && user?.isAdmin && (
          <View style={styles.card}>
            <View style={styles.modHeader}>
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={styles.cardTitle}>Modération</Text>
            </View>
            {reported.length === 0 ? (
              <Text style={styles.muted}>Aucun commentaire signalé.</Text>
            ) : (
              reported.map((c, i) => (
                <View key={c.id} style={[styles.actRow, i > 0 && styles.actRowBorder]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.actTitle} numberOfLines={1}>
                      {c.user.username} · {c.reportCount} signalement{c.reportCount > 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.actComment} numberOfLines={2}>
                      {c.content}
                    </Text>
                  </View>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      onPress={() => dismissReported(c.id)}
                      hitSlop={8}
                      style={{ padding: 4 }}
                    >
                      <CheckCircle2 size={16} color={colors.accentPastel} />
                    </Pressable>
                    <Pressable onPress={() => deleteReported(c.id)} hitSlop={8} style={{ padding: 4 }}>
                      <Trash2 size={16} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}

            <View style={styles.modSubHeader}>
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={styles.cardTitle}>Comptes signalés</Text>
            </View>
            {reportedUsers.length === 0 ? (
              <Text style={styles.muted}>Aucun compte signalé.</Text>
            ) : (
              reportedUsers.map((u, i) => (
                <View key={u.id} style={[styles.actRow, i > 0 && styles.actRowBorder]}>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/users/${u.id}`)}>
                    <Text style={styles.actTitle} numberOfLines={1}>
                      {u.username} · {u.count} signalement{u.count > 1 ? "s" : ""}
                    </Text>
                    <Text style={styles.actComment} numberOfLines={1}>
                      {Object.entries(u.reasons)
                        .map(([k, n]) => `${REASON_LABELS[k] ?? k} (${n})`)
                        .join(" · ")}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => dismissReportedUser(u.id)} hitSlop={8} style={{ padding: 4 }}>
                    <CheckCircle2 size={16} color={colors.accentPastel} />
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.modSubHeader}>
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={styles.cardTitle}>Photos signalées</Text>
            </View>
            {reportedPhotos.length === 0 ? (
              <Text style={styles.muted}>Aucune photo signalée.</Text>
            ) : (
              reportedPhotos.map((u, i) => (
                <View key={u.id} style={[styles.actRow, i > 0 && styles.actRowBorder]}>
                  <Pressable onPress={() => router.push(`/users/${u.id}`)}>
                    {u.avatarUrl ? (
                      <Image source={{ uri: u.avatarUrl }} style={styles.photoThumb} />
                    ) : (
                      <View style={styles.photoThumbFallback}>
                        <Text style={styles.photoThumbLetter}>{u.username.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </Pressable>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/users/${u.id}`)}>
                    <Text style={styles.actTitle} numberOfLines={1}>{u.username}</Text>
                    <Text style={styles.actComment} numberOfLines={1}>
                      {u.count} signalement{u.count > 1 ? "s" : ""}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => deletePhoto(u.id)} hitSlop={8} style={{ padding: 4 }}>
                    <ImageOff size={16} color={colors.danger} />
                  </Pressable>
                </View>
              ))
            )}

            <View style={styles.modSubHeader}>
              <ShieldAlert size={16} color={colors.danger} />
              <Text style={styles.cardTitle}>Comptes sanctionnés</Text>
            </View>
            {sanctioned.length === 0 ? (
              <Text style={styles.muted}>Aucun compte sanctionné.</Text>
            ) : (
              <>
                <View style={[styles.searchBar, sanctionFocused && styles.searchBarFocused]}>
                  <Search size={18} color={sanctionFocused ? colors.accentPastel : colors.dim} />
                  <TextInput
                    style={[styles.searchInput, noOutline]}
                    value={sanctionQuery}
                    onChangeText={setSanctionQuery}
                    onFocus={() => setSanctionFocused(true)}
                    onBlur={() => setSanctionFocused(false)}
                    placeholder="Rechercher un compte…"
                    placeholderTextColor={colors.dim}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {sanctionQuery.length > 0 && (
                    <Pressable onPress={() => setSanctionQuery("")} hitSlop={8}>
                      <X size={18} color={colors.dim} />
                    </Pressable>
                  )}
                </View>
                {filteredSanctioned.length === 0 ? (
                  <Text style={styles.muted}>Aucun résultat pour « {q} ».</Text>
                ) : null}
                {filteredSanctioned.map((u, i) => (
                <View key={u.id} style={[styles.actRow, i > 0 && styles.actRowBorder]}>
                  <Pressable style={{ flex: 1 }} onPress={() => router.push(`/users/${u.id}`)}>
                    <Text style={styles.actTitle} numberOfLines={1}>{u.username}</Text>
                    <Text style={[styles.actComment, u.bannedAt && { color: "#F87171" }]} numberOfLines={1}>
                      {u.bannedAt
                        ? `Banni le ${fmtDate(u.bannedAt)}`
                        : u.suspendedUntil
                        ? `Suspendu jusqu'au ${fmtDate(u.suspendedUntil)}`
                        : ""}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => liftSanction(u.id)} hitSlop={8} style={styles.reactivateBtn}>
                    <Text style={styles.reactivateText}>Réactiver</Text>
                  </Pressable>
                </View>
                ))}
              </>
            )}
          </View>
        )}

      </ScrollView>

      <FriendSearchModal visible={friendSearch} onClose={() => setFriendSearch(false)} />
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
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.accent,
  },
  avatarText: { fontFamily: fonts.heading, fontSize: 22, color: colors.accentPastel },
  avatarImg: { width: 56, height: 56, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  badge: {
    position: "absolute", top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 999,
    backgroundColor: colors.danger, alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
    borderWidth: 2, borderColor: colors.bg,
  },
  badgeText: { fontFamily: fonts.headingSemi, fontSize: 10, color: "#fff" },
  friendsRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  friendsCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: 14,
  },
  quickAddBtn: {
    width: 84, alignItems: "center", justifyContent: "center", gap: 4,
    backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent, borderRadius: radius.lg,
  },
  quickAddText: { fontFamily: fonts.headingSemi, fontSize: 11, color: colors.accentPastel, textAlign: "center", lineHeight: 13 },
  friendsValue: { fontFamily: fonts.heading, fontSize: 16, color: colors.text },
  friendsSub: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
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
  ratingFill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
  ratingCount: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.text, width: 24, textAlign: "right" },

  actRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  actRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  actIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  actTitle: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.text },
  actStars: { fontSize: 12, color: colors.accent, marginTop: 2 },
  actStarsEmpty: { color: "#4B5262" },
  actComment: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },
  actDate: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },

  moreBtn: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface2,
    alignItems: "center",
  },
  moreText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.accentPastel },
  linksRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  linkCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  linkLabel: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  modHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  modSubHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, marginBottom: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 },
  reactivateBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.sm, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  reactivateText: { fontFamily: fonts.headingSemi, fontSize: 11, color: colors.accentPastel },
  photoThumb: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.line },
  photoThumbFallback: {
    width: 40, height: 40, borderRadius: 999, backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent,
  },
  photoThumbLetter: { fontFamily: fonts.heading, fontSize: 16, color: colors.accentPastel },
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
    marginBottom: 8,
  },
  searchBarFocused: { borderColor: colors.accent },
  searchInput: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, height: "100%" },
  muted: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },
  warnBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: "rgba(251,191,36,0.10)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
    marginBottom: 14,
  },
  warnTitle: { fontFamily: fonts.headingSemi, fontSize: 13, color: "#FBBF24" },
  warnText: { fontFamily: fonts.body, fontSize: 12, color: colors.text, marginTop: 2 },
  warnDismiss: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.surface2 },
  warnDismissText: { fontFamily: fonts.headingSemi, fontSize: 11, color: colors.accentPastel },
});
