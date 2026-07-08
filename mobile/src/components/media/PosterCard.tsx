// Affiche cliquable : image TMDB + dégradé charte + badge type + titre superposé
import { Pressable, Image, Text, View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { tmdbImage } from "../../services/api";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";
import type { TmdbMedia, MediaType } from "../../types";

interface Props {
  media: TmdbMedia;
  mediaType: MediaType;
  width?: number;
}

export function PosterCard({ media, mediaType, width = 106 }: Props) {
  const router = useRouter();
  const title = media.title ?? media.name ?? "";
  const year = (media.release_date ?? media.first_air_date ?? "").slice(0, 4);

  return (
    <Pressable
      style={{ width }}
      onPress={() => router.push(`/media/${mediaType.toLowerCase()}/${media.id}`)}
    >
      <View style={[styles.poster, { width, height: width * 1.45 }]}>
        <Image
          source={{ uri: tmdbImage(media.poster_path) ?? undefined }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
        {/* Dégradé charte pour superposer le texte proprement */}
        <LinearGradient
          colors={["rgba(15,17,21,0)", "rgba(15,17,21,0.9)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.badge, mediaType === "TV" && { backgroundColor: colors.violet }]}>
          <Text style={styles.badgeText}>{mediaType === "TV" ? "SÉRIE" : "FILM"}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      <Text style={styles.year}>{year}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  poster: {
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    justifyContent: "flex-end",
  },
  badge: {
    position: "absolute", top: 8, left: 8,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 7, backgroundColor: "rgba(15,17,21,0.65)",
  },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: fonts.headingSemi, letterSpacing: 0.6 },
  title: { color: "#fff", fontFamily: fonts.heading, fontSize: 13, margin: 9 },
  year: { color: colors.dim, fontSize: 11, marginTop: 6, fontFamily: fonts.body },
});
