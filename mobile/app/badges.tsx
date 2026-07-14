// SUCCÈS : badges débloqués selon l'activité, avec progression
import { useCallback, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  ArrowLeft, Rocket, Film, Tv, CheckCircle2, ListChecks, Clock, Star, MessageSquare, Users, Bookmark, Lock, X,
} from "lucide-react-native";
import { api } from "../src/services/api";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface Badge {
  key: string;
  title: string;
  description: string;
  icon: string;
  value: number;
  target: number;
  unlocked: boolean;
  unlockedAt?: string | null;
}
interface BadgesResp {
  unlocked: number;
  total: number;
  badges: Badge[];
}

const ICONS: Record<string, any> = {
  Rocket, Film, Tv, CheckCircle2, ListChecks, Clock, Star, MessageSquare, Users, Bookmark,
};

export default function BadgesScreen() {
  const router = useRouter();
  const [data, setData] = useState<BadgesResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Badge | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<BadgesResp>("/stats/badges")
        .then((d) => active && setData(d))
        .catch(() => active && setData(null))
        .finally(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Succès</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : !data ? (
        <Text style={styles.error}>Impossible de charger les succès.</Text>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.count}>{data.unlocked} / {data.total} débloqués</Text>
          <View style={styles.grid}>
            {data.badges.map((b) => {
              const Icon = ICONS[b.icon] ?? Star;
              const pct = Math.min(1, b.value / b.target);
              return (
                <Pressable key={b.key} style={[styles.badge, b.unlocked && styles.badgeOn]} onPress={() => setSelected(b)}>
                  <View style={[styles.iconWrap, b.unlocked ? styles.iconOn : styles.iconOff]}>
                    {b.unlocked ? (
                      <Icon size={24} color={colors.accentPastel} />
                    ) : (
                      <Lock size={20} color={colors.dim} />
                    )}
                  </View>
                  <Text style={[styles.badgeTitle, !b.unlocked && { color: colors.dim }]} numberOfLines={1}>
                    {b.title}
                  </Text>
                  <Text style={styles.badgeDesc} numberOfLines={2}>{b.description}</Text>
                  {!b.unlocked && (
                    <>
                      <View style={styles.track}>
                        <View style={[styles.fill, { width: `${pct * 100}%` }]} />
                      </View>
                      <Text style={styles.progress}>{b.value} / {b.target}</Text>
                    </>
                  )}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal visible={selected !== null} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.mBackdrop} onPress={() => setSelected(null)}>
          <Pressable style={styles.mSheet} onPress={() => {}}>
            {selected && (() => {
              const Icon = ICONS[selected.icon] ?? Star;
              return (
                <>
                  <Pressable style={styles.mClose} onPress={() => setSelected(null)} hitSlop={10}>
                    <X size={20} color={colors.dim} />
                  </Pressable>
                  <View style={[styles.mIcon, selected.unlocked ? styles.iconOn : styles.iconOff]}>
                    {selected.unlocked ? <Icon size={30} color={colors.accentPastel} /> : <Lock size={26} color={colors.dim} />}
                  </View>
                  <Text style={styles.mTitle}>{selected.title}</Text>
                  <Text style={styles.mDesc}>{selected.description}</Text>
                  {selected.unlocked ? (
                    <View style={styles.mStatusOk}>
                      <CheckCircle2 size={15} color={colors.accentPastel} />
                      <Text style={styles.mStatusOkText}>
                        Débloqué{selected.unlockedAt ? ` le ${new Date(selected.unlockedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}` : ""}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <View style={styles.mTrack}>
                        <View style={[styles.fill, { width: `${Math.min(1, selected.value / selected.target) * 100}%` }]} />
                      </View>
                      <Text style={styles.mProgress}>Progression : {selected.value} / {selected.target}</Text>
                    </>
                  )}
                </>
              );
            })()}
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
    width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  error: { fontFamily: fonts.body, fontSize: 13, color: colors.danger, textAlign: "center", marginTop: 40 },

  content: { padding: 16, paddingBottom: 100 },
  count: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.accentPastel, marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badge: {
    width: "47.5%",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 14,
    gap: 6,
  },
  badgeOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  iconWrap: { width: 46, height: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  iconOn: { backgroundColor: "rgba(46,155,255,0.15)", borderWidth: 1, borderColor: colors.accent },
  iconOff: { backgroundColor: colors.surface2 },
  badgeTitle: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  badgeDesc: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, lineHeight: 15 },
  track: { height: 6, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden", marginTop: 4 },
  fill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
  progress: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.dim, textAlign: "right" },

  mBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 32 },
  mSheet: {
    width: "100%", maxWidth: 340, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.lg, padding: 22, alignItems: "center", gap: 10,
  },
  mClose: { position: "absolute", top: 12, right: 12 },
  mIcon: { width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", marginTop: 4 },
  mTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text, textAlign: "center" },
  mDesc: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: "center" },
  mStatusOk: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  mStatusOkText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.accentPastel },
  mTrack: { width: "100%", height: 8, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden", marginTop: 6 },
  mProgress: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim },
});
