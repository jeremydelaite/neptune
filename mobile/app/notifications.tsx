// NOTIFICATIONS : demandes d'ami, amis acceptés, avertissements / sanctions
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, UserPlus, UserCheck, AlertTriangle, Clock3, Ban, X, Check, Trash2, Trophy } from "lucide-react-native";
import { api } from "../src/services/api";
import { setUnread } from "../src/lib/notifState";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface Notif {
  id: string;
  type: "FRIEND_REQUEST" | "FRIEND_ACCEPTED" | "WARNING" | "SUSPENSION" | "BAN" | "BADGE";
  message: string;
  read: boolean;
  createdAt: string;
  actor: { id: string; username: string; avatarUrl: string | null } | null;
  actionable: boolean;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

const ICONS = {
  FRIEND_REQUEST: UserPlus,
  FRIEND_ACCEPTED: UserCheck,
  WARNING: AlertTriangle,
  SUSPENSION: Clock3,
  BAN: Ban,
  BADGE: Trophy,
} as const;

const ICON_COLORS: Record<Notif["type"], string> = {
  FRIEND_REQUEST: "#2E9BFF",
  FRIEND_ACCEPTED: "#34D399",
  WARNING: "#FBBF24",
  SUSPENSION: "#FBBF24",
  BAN: "#F87171",
  BADGE: "#2E9BFF",
};

export default function NotificationsScreen() {
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  const load = useCallback(async () => {
    try {
      const list = await api.get<Notif[]>("/notifications");
      setNotifs(list);
      await api.post("/notifications/read-all", {}).catch(() => {});
      setUnread(0); // la pastille (onglet + en-tête) disparaît aussitôt
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (active) load();
      return () => {
        active = false;
      };
    }, [load])
  );

  async function accept(n: Notif) {
    if (!n.actor) return;
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, actionable: false } : x)));
    await api.post(`/friends/accept/${n.actor.id}`, {}).catch(() => {});
  }

  async function decline(n: Notif) {
    if (!n.actor) return;
    setNotifs((prev) => prev.filter((x) => x.id !== n.id));
    await api.post(`/friends/decline/${n.actor.id}`, {}).catch(() => {});
    await api.delete(`/notifications/${n.id}`).catch(() => {});
  }

  async function removeOne(id: string) {
    setNotifs((prev) => prev.filter((x) => x.id !== id));
    await api.delete(`/notifications/${id}`).catch(() => {});
  }

  async function clearAll() {
    setNotifs([]);
    await api.delete("/notifications").catch(() => {});
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        {notifs.length > 0 && (
          <Pressable onPress={clearAll} hitSlop={12} style={styles.clearAll}>
            <Trash2 size={20} color={colors.danger} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : notifs.length === 0 ? (
        <Text style={styles.empty}>Aucune notification.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {notifs.map((n) => {
            const Icon = ICONS[n.type];
            const isFriend = n.type === "FRIEND_REQUEST" || n.type === "FRIEND_ACCEPTED";
            return (
              <View key={n.id} style={styles.row}>
                <Pressable
                  onPress={() => n.actor && router.push(`/users/${n.actor.id}`)}
                  disabled={!isFriend || !n.actor}
                >
                  {isFriend && n.actor?.avatarUrl ? (
                    <Image source={{ uri: n.actor.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.iconWrap, { backgroundColor: colors.surface2 }]}>
                      <Icon size={18} color={ICON_COLORS[n.type]} />
                    </View>
                  )}
                </Pressable>

                <View style={{ flex: 1 }}>
                  <Text style={styles.message}>{n.message}</Text>
                  <Text style={styles.time}>{timeAgo(n.createdAt)}</Text>
                  {n.actionable && (
                    <View style={styles.actions}>
                      <Pressable style={[styles.actBtn, styles.actAccept]} onPress={() => accept(n)}>
                        <Check size={14} color="#fff" />
                        <Text style={styles.actAcceptText}>Accepter</Text>
                      </Pressable>
                      <Pressable style={[styles.actBtn, styles.actDecline]} onPress={() => decline(n)}>
                        <Text style={styles.actDeclineText}>Refuser</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <Pressable onPress={() => removeOne(n.id)} hitSlop={8} style={{ padding: 4 }}>
                  <X size={16} color={colors.dim} />
                </Pressable>
              </View>
            );
          })}
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
  title: { flex: 1, fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  clearAll: {
    width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  content: { padding: 16, paddingBottom: 100 },
  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: "center", marginTop: 40 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: 14, marginBottom: 10,
  },
  avatar: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  iconWrap: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  message: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text },
  time: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: 3 },

  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  actBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.sm },
  actAccept: { backgroundColor: colors.accent },
  actAcceptText: { fontFamily: fonts.headingSemi, fontSize: 12, color: "#fff" },
  actDecline: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  actDeclineText: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.dim },
});
