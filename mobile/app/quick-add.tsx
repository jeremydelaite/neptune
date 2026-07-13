// AJOUT RAPIDE : marquer d'un coup des films/séries déjà vus (top de tous les temps)
import { useCallback, useEffect, useState } from "react";
import {
  View, Text, Pressable, Image, FlatList, ActivityIndicator, StyleSheet, useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Check } from "lucide-react-native";
import { api, tmdbImage } from "../src/services/api";
import { isLatinMedia } from "../src/lib/text";
import { QuickSeriesModal } from "../src/components/social/QuickSeriesModal";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";
import type { TmdbMedia } from "../src/types";

type Tab = "MOVIE" | "TV";
const GAP = 12;
const PADDING = 16;

export default function QuickAddScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [tab, setTab] = useState<Tab>("MOVIE");
  const [items, setItems] = useState<TmdbMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [seriesTarget, setSeriesTarget] = useState<TmdbMedia | null>(null);

  const load = useCallback(async (t: Tab) => {
    setLoading(true);
    setSelected(new Set());
    // ce qui est déjà dans la bibliothèque (pour ne pas le reproposer)
    const lib = await api
      .get<{ tmdbId: number; mediaType: Tab }[]>("/library")
      .catch(() => [] as { tmdbId: number; mediaType: Tab }[]);
    const owned = new Set(lib.filter((l) => l.mediaType === t).map((l) => l.tmdbId));

    const path = t === "MOVIE" ? "movie" : "tv";
    const out: TmdbMedia[] = [];
    const ids = new Set<number>();
    for (let page = 1; page <= 6 && out.length < 100; page++) {
      try {
        const data = await api.get<{ results: TmdbMedia[] }>(`/tmdb/top/${path}?page=${page}`);
        for (const m of data.results ?? []) {
          if (ids.has(m.id) || owned.has(m.id) || !isLatinMedia(m) || m.adult) continue;
          ids.add(m.id);
          out.push(m);
        }
      } catch {
        break;
      }
    }
    setItems(out.slice(0, 100));
    setLoading(false);
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function addMovies() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    const ids = [...selected];
    for (const id of ids) {
      await api.post("/library", { tmdbId: id, mediaType: "MOVIE", status: "COMPLETED" }).catch(() => {});
    }
    setItems((prev) => prev.filter((m) => !selected.has(m.id)));
    setSelected(new Set());
    setSaving(false);
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Ajout rapide</Text>
      </View>

      <View style={styles.tabs}>
        {(["MOVIE", "TV"] as Tab[]).map((t) => {
          const active = tab === t;
          return (
            <Pressable key={t} style={[styles.tab, active && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, active && styles.tabTextActive]}>{t === "MOVIE" ? "Films" : "Séries"}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.hint}>
        {tab === "MOVIE"
          ? "Appuie pour sélectionner les films déjà vus, puis valide en bas."
          : "Appuie sur une série déjà vue pour indiquer où tu en es."}
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(m) => String(m.id)}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const isSel = selected.has(item.id);
            const uri = tmdbImage(item.poster_path, "w185");
            return (
              <Pressable
                style={{ width: cardWidth }}
                onPress={() => {
                  if (tab === "MOVIE") toggleSelect(item.id);
                  else setSeriesTarget(item);
                }}
              >
                <View style={[styles.poster, { width: cardWidth, height: cardWidth * 1.5 }]}>
                  {uri ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
                  {isSel && (
                    <View style={styles.overlay}>
                      <View style={styles.check}>
                        <Check size={20} color="#fff" />
                      </View>
                    </View>
                  )}
                </View>
                <Text style={styles.name} numberOfLines={1}>{item.title ?? item.name}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {tab === "MOVIE" && selected.size > 0 && (
        <View style={styles.bottomBar}>
          <Pressable style={styles.addBtn} onPress={addMovies} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.addBtnText}>Ajouter {selected.size} film{selected.size > 1 ? "s" : ""}</Text>
            )}
          </Pressable>
        </View>
      )}

      <QuickSeriesModal
        visible={seriesTarget !== null}
        tvId={seriesTarget?.id ?? null}
        title={seriesTarget?.name ?? seriesTarget?.title ?? ""}
        onClose={() => setSeriesTarget(null)}
        onDone={() => {
          if (seriesTarget) setItems((prev) => prev.filter((m) => m.id !== seriesTarget.id));
          setSeriesTarget(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 8 },
  back: {
    width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: PADDING, paddingBottom: 8 },
  tab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.dim },
  tabTextActive: { color: "#fff" },

  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, paddingHorizontal: PADDING, paddingBottom: 10, lineHeight: 17 },

  list: { paddingHorizontal: PADDING, paddingBottom: 120 },
  row: { gap: GAP, marginBottom: GAP },
  poster: { borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(46,155,255,0.45)", alignItems: "center", justifyContent: "center" },
  check: { width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(15,17,21,0.55)", alignItems: "center", justifyContent: "center" },
  name: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: 5 },

  bottomBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, paddingBottom: 28, backgroundColor: "rgba(15,17,21,0.9)", borderTopWidth: 1, borderTopColor: colors.line },
  addBtn: { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: "center" },
  addBtnText: { fontFamily: fonts.headingSemi, fontSize: 15, color: "#fff" },
});
