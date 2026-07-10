// PARAMÈTRES : modifier pseudo / email / mot de passe + infos du compte
import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Pencil } from "lucide-react-native";
import { api } from "../src/services/api";
import { useAuth } from "../src/hooks/useAuth";
import { ConfirmModal } from "../src/components/ui/ConfirmModal";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

interface Me {
  id: string;
  username: string;
  email: string;
  isAdmin?: boolean;
  createdAt: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatJoined(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

type Feedback = { type: "ok" | "err"; text: string } | null;

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [username, setUsername] = useState(user?.username ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingPassword, setEditingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Feedback>(null);
  const [passwordMsg, setPasswordMsg] = useState<Feedback>(null);
  const [confirmKind, setConfirmKind] = useState<null | "profile" | "password">(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      api
        .get<Me>("/auth/me")
        .then((me) => {
          if (!active) return;
          setCreatedAt(me.createdAt);
          if (!editingProfile) {
            setUsername(me.username);
            setEmail(me.email);
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [editingProfile])
  );

  function cancelProfile() {
    setUsername(user?.username ?? "");
    setEmail(user?.email ?? "");
    setProfileMsg(null);
    setEditingProfile(false);
  }

  function requestSaveProfile() {
    setProfileMsg(null);
    const u = username.trim();
    const e = email.trim();
    if (u.length < 3) return setProfileMsg({ type: "err", text: "Pseudo : 3 caractères minimum" });
    if (u.length > 30) return setProfileMsg({ type: "err", text: "Pseudo : 30 caractères maximum" });
    if (!EMAIL_RE.test(e)) return setProfileMsg({ type: "err", text: "Email invalide" });
    if (u === user?.username && e === user?.email) {
      setEditingProfile(false);
      return;
    }
    setConfirmKind("profile");
  }

  async function doSaveProfile() {
    const u = username.trim();
    const e = email.trim();
    setSavingProfile(true);
    try {
      const body: { username?: string; email?: string } = {};
      if (u !== user?.username) body.username = u;
      if (e !== user?.email) body.email = e;
      const me = await api.patch<Me>("/auth/profile", body);
      await updateUser({ username: me.username, email: me.email });
      setProfileMsg({ type: "ok", text: "Profil mis à jour" });
      setEditingProfile(false);
    } catch (err) {
      setProfileMsg({ type: "err", text: err instanceof Error ? err.message : "Échec de la mise à jour" });
    } finally {
      setSavingProfile(false);
    }
  }

  function cancelPassword() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMsg(null);
    setEditingPassword(false);
  }

  function requestSavePassword() {
    setPasswordMsg(null);
    if (!currentPassword) return setPasswordMsg({ type: "err", text: "Mot de passe actuel requis" });
    if (newPassword.length < 8) return setPasswordMsg({ type: "err", text: "Nouveau : 8 caractères minimum" });
    if (newPassword !== confirmPassword)
      return setPasswordMsg({ type: "err", text: "Les mots de passe ne correspondent pas" });
    setConfirmKind("password");
  }

  async function doSavePassword() {
    setSavingPassword(true);
    try {
      await api.patch("/auth/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMsg({ type: "ok", text: "Mot de passe modifié" });
      setEditingPassword(false);
    } catch (err) {
      setPasswordMsg({ type: "err", text: err instanceof Error ? err.message : "Échec de la modification" });
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Paramètres</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Profil */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Profil</Text>

            <Text style={styles.label}>Pseudo</Text>
            <TextInput
              style={[styles.input, !editingProfile && styles.inputLocked]}
              value={username}
              onChangeText={setUsername}
              editable={editingProfile}
              autoCapitalize="none"
              placeholder="Pseudo"
              placeholderTextColor={colors.dim}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, !editingProfile && styles.inputLocked]}
              value={email}
              onChangeText={setEmail}
              editable={editingProfile}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.dim}
            />

            {profileMsg && (
              <Text style={profileMsg.type === "ok" ? styles.ok : styles.err}>{profileMsg.text}</Text>
            )}

            {editingProfile ? (
              <View style={styles.btnRow}>
                <Pressable style={[styles.button, styles.btnGhost]} onPress={cancelProfile} disabled={savingProfile}>
                  <Text style={styles.btnGhostText}>Annuler</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.btnFill, savingProfile && styles.buttonDisabled]} onPress={requestSaveProfile} disabled={savingProfile}>
                  {savingProfile ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.buttonText}>Enregistrer</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <Pressable style={[styles.button, styles.btnOutline]} onPress={() => { setProfileMsg(null); setEditingProfile(true); }}>
                <Pencil size={15} color={colors.accentPastel} />
                <Text style={styles.btnOutlineText}>Modifier</Text>
              </Pressable>
            )}
          </View>

          {/* Mot de passe */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Mot de passe</Text>

            {editingPassword ? (
              <>
                <Text style={styles.label}>Mot de passe actuel</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.dim}
                />

                <Text style={styles.label}>Nouveau mot de passe</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="8 caractères minimum"
                  placeholderTextColor={colors.dim}
                />
                <Text style={styles.hint}>Au moins 8 caractères.</Text>

                <Text style={styles.label}>Confirmer</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Répéter le nouveau"
                  placeholderTextColor={colors.dim}
                />

                {passwordMsg && (
                  <Text style={passwordMsg.type === "ok" ? styles.ok : styles.err}>{passwordMsg.text}</Text>
                )}

                <View style={styles.btnRow}>
                  <Pressable style={[styles.button, styles.btnGhost]} onPress={cancelPassword} disabled={savingPassword}>
                    <Text style={styles.btnGhostText}>Annuler</Text>
                  </Pressable>
                  <Pressable style={[styles.button, styles.btnFill, savingPassword && styles.buttonDisabled]} onPress={requestSavePassword} disabled={savingPassword}>
                    {savingPassword ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>Enregistrer</Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mot de passe</Text>
                  <Text style={styles.infoValue}>••••••••</Text>
                </View>
                {passwordMsg && (
                  <Text style={passwordMsg.type === "ok" ? styles.ok : styles.err}>{passwordMsg.text}</Text>
                )}
                <Pressable style={[styles.button, styles.btnOutline]} onPress={() => { setPasswordMsg(null); setEditingPassword(true); }}>
                  <Pencil size={15} color={colors.accentPastel} />
                  <Text style={styles.btnOutlineText}>Modifier</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* Informations du compte */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Informations du compte</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
            <View style={[styles.infoRow, styles.infoRowBorder]}>
              <Text style={styles.infoLabel}>Membre depuis</Text>
              <Text style={styles.infoValue}>{formatJoined(createdAt)}</Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={confirmKind !== null}
        title={confirmKind === "password" ? "Changer le mot de passe" : "Enregistrer les modifications"}
        message={
          confirmKind === "password"
            ? "Confirmer le changement de ton mot de passe ?"
            : "Confirmer la mise à jour de ton profil ?"
        }
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
        onCancel={() => setConfirmKind(null)}
        onConfirm={() => {
          const kind = confirmKind;
          setConfirmKind(null);
          if (kind === "profile") doSaveProfile();
          else if (kind === "password") doSavePassword();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  back: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },

  content: { padding: 16, paddingBottom: 60 },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.text, marginBottom: 14 },

  label: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim, marginBottom: 6 },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 13,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 14,
    marginBottom: 14,
  },
  inputLocked: { color: colors.dim, backgroundColor: colors.surface2, borderColor: "transparent" },
  hint: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: -8, marginBottom: 14 },

  ok: { color: colors.accentPastel, fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 10 },
  err: { color: "#F87171", fontSize: 12, fontFamily: fonts.bodyMedium, marginBottom: 10 },

  btnRow: { flexDirection: "row", gap: 10 },
  button: {
    borderRadius: radius.md,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  btnFill: { flex: 1, backgroundColor: colors.accent },
  btnGhost: { flex: 1, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  btnGhostText: { color: colors.dim, fontFamily: fonts.headingSemi, fontSize: 14 },
  btnOutline: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  btnOutlineText: { color: colors.accentPastel, fontFamily: fonts.headingSemi, fontSize: 14 },
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontFamily: fonts.headingSemi, fontSize: 14 },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  infoLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.dim },
  infoValue: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.text, flexShrink: 1, textAlign: "right", marginLeft: 12 },
});
