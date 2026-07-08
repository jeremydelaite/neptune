// COMPTE : stats poussées — TODO à compléter (GET /stats, graphiques)
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LogOut } from "lucide-react-native";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.content}>
        <Text style={styles.title}>{user?.username}</Text>
        <Text style={styles.email}>{user?.email}</Text>

        <Pressable style={styles.logout} onPress={logout}>
          <LogOut size={18} color={colors.violetPastel} />
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, flex: 1 },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
  email: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginTop: 4 },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: "auto",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 14,
  },
  logoutText: {
    fontFamily: fonts.headingSemi,
    fontSize: 14,
    color: colors.violetPastel,
  },
});
