// FICHE DÉTAIL film/série : statut, note 5 étoiles, saisons, commentaires
import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, StyleSheet } from "react-native";
import { colors } from "../../../src/theme/colors";
import { fonts } from "../../../src/theme/typography";

export default function MediaDetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  // TODO:
  // - GET /tmdb/{type}/{id} → bannière (backdrop + LinearGradient charte), titre, genres
  // - <StatusButtons /> → POST /library
  // - <StarRating /> → PUT /ratings
  // - Saisons (séries) : GET /tmdb/tv/:id/season/:n + bouton "Tout marquer vu"
  // - Commentaires : GET /comments/{type}/{id}?sort=recent|old, tri par date
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Fiche {type} #{id}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
});
