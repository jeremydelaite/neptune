// RECHERCHE : un onglet Films, un onglet Séries — TODO à compléter
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function SearchScreen() {
  // TODO: TextInput → /tmdb/search/movie ou /tmdb/search/tv selon l'onglet actif
  // Grille de PosterCard (FlatList numColumns={3})
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Recherche</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
});
