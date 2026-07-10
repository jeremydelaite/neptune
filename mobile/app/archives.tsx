// SÉRIES ARCHIVÉES — glisser vers la gauche pour désarchiver
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, ArchiveRestore } from "lucide-react-native";
import { api, tmdbImage } from "../src/services/api";
import { SwipeArchive } from "../src/components/ui/SwipeArchive";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface LibraryItem {
  tmdbId: number;
  mediaType: "MOVIE" | "TV";
  status: string;
}
interface Show {
  id: number;
  name: string;
  poster: string | null;
}

export default function ArchivesScreen() {
  const router = useRouter();
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const lib = await api.get<LibraryItem[]>("/library?status=ARCHIVED");
      const tv = lib.filter((l) => l.mediaType === "TV");
      const built = await Promise.all(
        tv.map(async (item) => {
          try {
            const d = await api.get<{ id: number; name: string; poster_path: string | null }>(
              `/tmdb/tv/${item.tmdbId}`
            );
            return { id: d.id, name: d.name, poster: tmdbImage(d.poster_path, "w185") } as Show;
          } catch {
            return null;
          }
        })
      );
      setShows(built.filter((s): s is Show => s !== null).sort((a, b) => a.name.localeCompare(b.name)));
    } catch {
      setShows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function unarchive(id: number) {
    setShows((prev) => prev.filter((s) => s.id !== id));
    await api.post("/library", { tmdbId: id, mediaType: "TV", status: "WATCHING" }).catch(() => {});
  }

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/watching");
  };

  const renderItem = ({ item }: { item: Show }) => (
    <SwipeArchive
      onAction={() => unarchive(item.id)}
      bgColor="rgba(52,211,153,0.18)"
      tintColor="#34D399"
      label="Désarchiver"
      icon={<ArchiveRestore size={18} color="#34D399" />}
    >
      <Pressable style={styles.card} onPress={() => router.push(`/media/tv/${item.id}`)}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]} />
        )}
        <Text style={styles.title} numberOfLines={2}>
          {item.name}
        </Text>
      </Pressable>
    </SwipeArchive>
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>Séries archivées</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={shows}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          alwaysBounceVertical
          renderItem={renderItem}
          ListHeaderComponent={
            shows.length > 0 ? (
              <Text style={styles.hint}>Glisse une série vers la gauche pour la désarchiver.</Text>
            ) : null
          }
          ListEmptyComponent={<Text style={styles.empty}>Aucune série archivée.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  back: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  screenTitle: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 10 },
  list: { paddingHorizontal: 16, paddingBottom: 100, gap: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 10,
  },
  poster: { width: 54, height: 80, borderRadius: 8, backgroundColor: colors.surface2 },
  posterEmpty: { borderWidth: 1, borderColor: colors.line },
  title: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.dim,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
  },
});
