// Rangée horizontale de la page d'accueil (Nouveautés, Populaires, Recos…)
import { View, Text, FlatList, StyleSheet } from "react-native";
import { PosterCard } from "./PosterCard";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";
import type { TmdbMedia, MediaType } from "../../types";

interface Props {
  title: string;
  subtitle?: string;
  items: TmdbMedia[];
  mediaType: MediaType;
  itemParams?: Record<string, string>;
}

export function MediaRow({ title, subtitle, items, mediaType, itemParams }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <FlatList
        horizontal
        data={items}
        keyExtractor={(m) => String(m.id)}
        renderItem={({ item }) => <PosterCard media={item} mediaType={mediaType} extraParams={itemParams} />}
        contentContainerStyle={{ gap: 10 }}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 26 },
  title: { fontFamily: fonts.heading, fontSize: 16, color: colors.text, marginBottom: 4 },
  subtitle: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginBottom: 12 },
});
