// EN COURS : prochains épisodes des séries suivies — TODO à compléter
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function WatchingScreen() {
  // TODO: /library?status=WATCHING → pour chaque série, croiser avec
  // /episodes/:tmdbShowId et /tmdb/tv/:id pour trouver le prochain épisode.
  // Composants : ProgressBar + bouton check (toggle /episodes/toggle)
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>Séries en cours</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
});
