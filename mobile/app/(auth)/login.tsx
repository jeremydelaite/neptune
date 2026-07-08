// CONNEXION — TODO: formulaire email/mot de passe → useAuth().login
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../../src/theme/colors";
import { fonts } from "../../src/theme/typography";

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NEPTUNE</Text>
      {/* TODO: inputs + bouton violet + lien vers /register */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", alignItems: "center" },
  logo: { fontFamily: fonts.heading, fontSize: 28, letterSpacing: 4, color: colors.text },
});
