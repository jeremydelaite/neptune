import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useAuth } from "../../src/hooks/useAuth";
import { colors } from "../../src/theme/colors";
import { fonts, radius } from "../../src/theme/typography";

// Validation alignée sur le backend (registerSchema Zod) :
// email valide · username 3-30 · password >= 8 caractères.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen() {
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!EMAIL_RE.test(email.trim())) return "Email invalide";
    if (username.trim().length < 3) return "Nom d'utilisateur : 3 caractères minimum";
    if (username.trim().length > 30) return "Nom d'utilisateur : 30 caractères maximum";
    if (password.length < 8) return "Mot de passe : 8 caractères minimum";
    if (password !== confirm) return "Les mots de passe ne correspondent pas";
    return null;
  }

  async function handleRegister() {
    setError(null);
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), username.trim(), password);
      // La redirection vers (tabs) est gérée par le RootNavigator
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inscription impossible");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>NEPTUNE</Text>
      <Text style={styles.tagline}>Créez votre compte en quelques secondes</Text>

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
        placeholder="Nom d'utilisateur"
        placeholderTextColor={colors.dim}
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Mot de passe"
        placeholderTextColor={colors.dim}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <TextInput
        style={styles.input}
        placeholder="Confirmer le mot de passe"
        placeholderTextColor={colors.dim}
        value={confirm}
        onChangeText={setConfirm}
        secureTextEntry
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={handleRegister} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Créer mon compte</Text>
        )}
      </Pressable>

      <Link href="/(auth)/login" style={styles.link}>
        Déjà un compte ? <Text style={{ color: colors.accentPastel }}>Se connecter</Text>
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
