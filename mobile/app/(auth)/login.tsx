import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { api } from "../../src/services/api";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needVerify, setNeedVerify] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleLogin() {
    setError(null);
    setNeedVerify(false);
    setResent(false);
    setLoading(true);
    try {
      await login(email.trim(), password);
      // La redirection vers (tabs) est gérée par le RootNavigator
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connexion impossible";
      setError(msg);
      if (/email/i.test(msg) && /valide/i.test(msg)) setNeedVerify(true);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    await api.post("/auth/resend-verification", { email: email.trim() }).catch(() => {});
    setResent(true);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NEPTUNE</Text>
      <Text style={styles.tagline}>Vos films et séries, suivis simplement</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.dim}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={colors.dim}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}
      {needVerify && (
        <Pressable onPress={resend} style={{ marginBottom: 10 }}>
          <Text style={styles.resend}>
            {resent ? "Email de vérification renvoyé ✓" : "Renvoyer l'email de vérification"}
          </Text>
        </Pressable>
      )}

      <Pressable style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Se connecter</Text>
        )}
      </Pressable>

      <Link href="/(auth)/register" style={styles.link}>
        Pas encore de compte ? <Text style={{ color: colors.accentPastel }}>Créer un compte</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, justifyContent: "center", padding: 24 },
  logo: {
    fontFamily: fonts.heading, fontSize: 32, letterSpacing: 4,
    color: colors.text, textAlign: "center",
  },
  tagline: {
    fontFamily: fonts.body, fontSize: 13, color: colors.dim,
    textAlign: "center", marginTop: 6, marginBottom: 36,
  },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, padding: 14, color: colors.text,
    fontFamily: fonts.body, fontSize: 14, marginBottom: 12,
  },
  error: { color: "#F87171", fontSize: 12, marginBottom: 10, textAlign: "center", fontFamily: fonts.body },
  resend: { color: colors.accentPastel, fontSize: 13, textAlign: "center", fontFamily: fonts.headingSemi },
  button: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: 15, alignItems: "center", marginTop: 6,
  },
  buttonText: { color: "#fff", fontFamily: fonts.headingSemi, fontSize: 15 },
  link: {
    color: colors.dim, fontSize: 13, textAlign: "center",
    marginTop: 20, fontFamily: fonts.body,
  },
});