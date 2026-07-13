// AJOUT RAPIDE : marquer d'un coup des films/séries déjà vus (top de tous les temps)
import { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, Pressable, Image, FlatList, ActivityIndicator, RefreshControl, StyleSheet, useWindowDimensions,
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
const TARGET = 100;

export default function QuickAddScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [tab, setTab] = useState<Tab>("MOVIE");
  const [items, setItems] = useState<TmdbMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [seriesTarget, setSeriesTarget] = useState<TmdbMedia | null>(null);

  const seenRef = useRef<Set<number>>(new Set()); // déjà en biblio + affichés + ajoutés
  const pageRef = useRef(0);

  // Récupère des pages TMDB jusqu'à obtenir "need" nouveaux titres (hors seenRef)
  const fetchPages = useCallback(async (t: Tab, need: number): Promise<TmdbMedia[]> => {
    const path = t === "MOVIE" ? "movie" : "tv";
    const out: TmdbMedia[] = [];
    while (out.length < need && pageRef.current < 20) {
      pageRef.current += 1;
      try {
        const data = await api.get<{ results: TmdbMedia[] }>(`/tmdb/top/${path}?page=${pageRef.current}`);
        const results = data.results ?? [];
        if (results.length === 0) break;
        for (const m of results) {
          if (seenRef.current.has(m.id) || !isLatinMedia(m) || m.adult) continue;
          seenRef.current.add(m.id);
          out.push(m);
        }
      } catch {
        break;
      }
    }
    return out;
  }, []);

  const load = useCallback(
    async (t: Tab) => {
      setLoading(true);
      setSelected(new Set());
      seenRef.current = new Set();
      pageRef.current = 0;
      const lib = await api
        .get<{ tmdbId: number; mediaType: Tab }[]>("/library")
        .catch(() => [] as { tmdbId: number; mediaType: Tab }[]);
      lib.filter((l) => l.mediaType === t).forEach((l) => seenRef.current.add(l.tmdbId));
      const first = await fetchPages(t, TARGET);
      setItems(first);
      setLoading(false);
    },
    [fetchPages]
  );

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // Complète la liste pour rester autour de TARGET après un retrait
  const refill = useCallback(
    async (t: Tab, need: number) => {
      const more = await fetchPages(t, need);
      if (more.length) setItems((prev) => [...prev, ...more]);
    },
    [fetchPages]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setSelected(new Set());
    let more = await fetchPages(tab, TARGET);
    if (more.length === 0) {
      // top épuisé → on recommence depuis le début (en excluant la biblio)
      seenRef.current = new Set();
      pageRef.current = 0;
      const lib = await api
        .get<{ tmdbId: number; mediaType: Tab }[]>("/library")
        .catch(() => [] as { tmdbId: number; mediaType: Tab }[]);
      lib.filter((l) => l.mediaType === tab).forEach((l) => seenRef.current.add(l.tmdbId));
      more = await fetchPages(tab, TARGET);
    }
    setItems(more);
    setRefreshing(false);
  }, [tab, fetchPages]);

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
    refill("MOVIE", ids.length); // nouvelles propositions
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
          }
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
          const done = seriesTarget;
          setSeriesTarget(null);
          if (done) {
            setItems((prev) => prev.filter((m) => m.id !== done.id));
            refill("TV", 1);
          }
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
