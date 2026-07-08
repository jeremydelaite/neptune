// INSCRIPTION — TODO: formulaire → useAuth().register
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function RegisterScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Créer un compte</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.heading, fontSize: 22, color: colors.text },
});
