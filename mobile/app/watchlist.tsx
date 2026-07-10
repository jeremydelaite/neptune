// À VOIR : films et séries de la watchlist (statut TO_WATCH)
import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { api } from "../src/services/api";
import { PosterCard } from "../src/components/media/PosterCard";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";
import type { TmdbMedia, MediaType } from "../src/types";

interface LibraryItem {
  tmdbId: number;
  mediaType: MediaType;
  status: string;
  addedAt: string;
}
interface Entry {
  media: TmdbMedia;
  mediaType: MediaType;
}

const GAP = 12;
const PADDING = 16;

export default function WatchlistScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const cardWidth = (width - PADDING * 2 - GAP * 2) / 3;

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const library = await api.get<LibraryItem[]>("/library?status=TO_WATCH");
      const built = await Promise.all(
        library.map(async (item) => {
          try {
            const path = item.mediaType === "MOVIE" ? "movie" : "tv";
            const media = await api.get<TmdbMedia>(`/tmdb/${path}/${item.tmdbId}`);
            return { media, mediaType: item.mediaType } as Entry;
          } catch {
            return null;
          }
        })
      );
      setEntries(built.filter((e): e is Entry => e !== null));
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={10} style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>À voir</Text>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => `${e.mediaType}-${e.media.id}`}
          numColumns={3}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <PosterCard media={item.media} mediaType={item.mediaType} width={cardWidth} posterSize="w185" />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              Ta liste « À voir » est vide. Ajoute un film ou une série depuis sa fiche.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 10 },
  back: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  list: { paddingHorizontal: PADDING, paddingTop: 4, paddingBottom: 100 },
  row: { gap: GAP, marginBottom: GAP },
  empty: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.dim,
    textAlign: "center",
    marginTop: 40,
    paddingHorizontal: 24,
    lineHeight: 20,
  },
});
