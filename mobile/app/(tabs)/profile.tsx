// COMPTE : stats poussées — TODO à compléter
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function ProfileScreen() {
  const { user } = useAuth();
  // TODO: GET /stats → compteurs, répartition des notes, activité mensuelle
  // Graphiques : react-native-gifted-charts ou Victory Native
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{user?.username}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
});
