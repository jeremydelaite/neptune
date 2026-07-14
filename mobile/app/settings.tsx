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
  Image,
  Alert,
  Modal,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Pencil, LogOut, Camera, Trash2, ChevronRight, EyeOff, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
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
interface BlockedUser { id: string; username: string; avatarUrl: string | null }
interface MyReport {
  type: "account" | "photo";
  reason: string | null;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
}
const REASON_LABELS: Record<string, string> = {
  SPAM: "Spam", HARASSMENT: "Harcèlement", FAKE: "Faux compte", INAPPROPRIATE: "Inapproprié", OTHER: "Autre",
};

export default function SettingsScreen() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuth();

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
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [myReports, setMyReports] = useState<MyReport[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<Feedback>(null);

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
      api
        .get<BlockedUser[]>("/users/blocked")
        .then((list) => active && setBlockedUsers(list))
        .catch(() => {});
      api
        .get<MyReport[]>("/users/my-reports")
        .then((list) => active && setMyReports(list))
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [editingProfile])
  );

  async function unblock(id: string) {
    setBlockedUsers((prev) => prev.filter((u) => u.id !== id));
    await api.delete(`/users/${id}/block`).catch(() => {});
  }

  async function withdrawReport(r: MyReport) {
    setMyReports((prev) => prev.filter((x) => !(x.user.id === r.user.id && x.type === r.type)));
    const path = r.type === "photo" ? `/users/${r.user.id}/report-photo` : `/users/${r.user.id}/report`;
    await api.delete(path).catch(() => {});
  }

  async function pickAvatar() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Autorisation requise", "Autorise l'accès à tes photos pour changer ta photo de profil.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;

    setAvatarBusy(true);
    setAvatarMsg(null);
    try {
      const manip = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const dataUri = `data:image/jpeg;base64,${manip.base64}`;
      const r = await api.patch<{ avatarUrl: string | null }>("/auth/avatar", { avatar: dataUri });
      await updateUser({ avatarUrl: r.avatarUrl });
      setAvatarMsg({ type: "ok", text: "Photo mise à jour" });
    } catch (e) {
      setAvatarMsg({ type: "err", text: e instanceof Error ? e.message : "Impossible de changer la photo." });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setAvatarMsg(null);
    try {
      await api.patch("/auth/avatar", { avatar: null });
      await updateUser({ avatarUrl: null });
    } catch {
      /* ignore */
    } finally {
      setAvatarBusy(false);
    }
  }

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
          {/* Photo de profil */}
          <View style={[styles.card, styles.avatarCard]}>
            <View style={styles.avatarWrap}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{(user?.username ?? "?").charAt(0).toUpperCase()}</Text>
                </View>
              )}
              {avatarBusy && (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Pressable style={[styles.button, styles.btnOutline]} onPress={pickAvatar} disabled={avatarBusy}>
                <Camera size={15} color={colors.accentPastel} />
                <Text style={styles.btnOutlineText}>{user?.avatarUrl ? "Changer la photo" : "Ajouter une photo"}</Text>
              </Pressable>
              {user?.avatarUrl && (
                <Pressable style={[styles.button, styles.btnGhost]} onPress={removeAvatar} disabled={avatarBusy}>
                  <Trash2 size={15} color={colors.dim} />
                  <Text style={styles.btnGhostText}>Supprimer</Text>
                </Pressable>
              )}
              {avatarMsg && (
                <Text style={avatarMsg.type === "ok" ? styles.ok : styles.err}>{avatarMsg.text}</Text>
              )}
            </View>
          </View>

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
            <Pressable style={[styles.infoRow, styles.infoRowBorder]} onPress={() => setBlockedOpen(true)}>
              <Text style={styles.infoLabel}>Comptes masqués</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.infoValue}>{blockedUsers.length}</Text>
                <ChevronRight size={16} color={colors.dim} />
              </View>
            </Pressable>
            <Pressable style={[styles.infoRow, styles.infoRowBorder]} onPress={() => setReportsOpen(true)}>
              <Text style={styles.infoLabel}>Mes signalements</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={styles.infoValue}>{myReports.length}</Text>
                <ChevronRight size={16} color={colors.dim} />
              </View>
            </Pressable>
          </View>

          {/* Déconnexion */}
          <Pressable
            style={({ pressed }) => [styles.logout, pressed && styles.logoutPressed]}
            onPress={logout}
          >
            <LogOut size={18} color={colors.danger} />
            <Text style={styles.logoutText}>Se déconnecter</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={blockedOpen} transparent animationType="fade" onRequestClose={() => setBlockedOpen(false)}>
        <View style={styles.mBackdrop}>
          <View style={styles.mSheet}>
            <View style={styles.mHeader}>
              <Text style={styles.mTitle}>Comptes masqués</Text>
              <Pressable onPress={() => setBlockedOpen(false)} hitSlop={10}>
                <X size={22} color={colors.dim} />
              </Pressable>
            </View>
            {blockedUsers.length === 0 ? (
              <Text style={styles.mHint}>Tu n'as masqué aucun compte.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                {blockedUsers.map((b, i) => (
                  <View key={b.id} style={[styles.blockedRow, i > 0 && styles.blockedRowBorder]}>
                    <View style={styles.blockedAvatar}>
                      {b.avatarUrl ? (
                        <Image source={{ uri: b.avatarUrl }} style={styles.blockedAvatarImg} />
                      ) : (
                        <Text style={styles.blockedAvatarText}>{b.username.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={styles.blockedName} numberOfLines={1}>{b.username}</Text>
                    <Pressable style={styles.unblockBtn} onPress={() => unblock(b.id)}>
                      <EyeOff size={13} color={colors.accentPastel} />
                      <Text style={styles.unblockText}>Ne plus masquer</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={reportsOpen} transparent animationType="fade" onRequestClose={() => setReportsOpen(false)}>
        <View style={styles.mBackdrop}>
          <View style={styles.mSheet}>
            <View style={styles.mHeader}>
              <Text style={styles.mTitle}>Mes signalements</Text>
              <Pressable onPress={() => setReportsOpen(false)} hitSlop={10}>
                <X size={22} color={colors.dim} />
              </Pressable>
            </View>
            {myReports.length === 0 ? (
              <Text style={styles.mHint}>Tu n'as effectué aucun signalement.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
                {myReports.map((r, i) => (
                  <View key={`${r.type}-${r.user.id}`} style={[styles.blockedRow, i > 0 && styles.blockedRowBorder]}>
                    <View style={styles.blockedAvatar}>
                      {r.user.avatarUrl ? (
                        <Image source={{ uri: r.user.avatarUrl }} style={styles.blockedAvatarImg} />
                      ) : (
                        <Text style={styles.blockedAvatarText}>{r.user.username.charAt(0).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.blockedName} numberOfLines={1}>{r.user.username}</Text>
                      <Text style={styles.reportKind} numberOfLines={1}>
                        {r.type === "photo" ? "Photo de profil" : `Compte · ${REASON_LABELS[r.reason ?? ""] ?? "Signalé"}`}
                      </Text>
                    </View>
                    <Pressable style={styles.unblockBtn} onPress={() => withdrawReport(r)}>
                      <Trash2 size={13} color={colors.danger} />
                      <Text style={[styles.unblockText, { color: colors.danger }]}>Retirer</Text>
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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
  avatarCard: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { width: 76, height: 76 },
  avatarImg: { width: 76, height: 76, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  avatarFallback: {
    width: 76, height: 76, borderRadius: 999, backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent,
  },
  avatarLetter: { fontFamily: fonts.heading, fontSize: 30, color: colors.accentPastel },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject, borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center",
  },

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

  blockedRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  blockedRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  blockedAvatar: {
    width: 34, height: 34, borderRadius: 999,
    backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.accent,
  },
  blockedAvatarText: { fontFamily: fonts.heading, fontSize: 14, color: colors.accentPastel },
  blockedName: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },
  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1,
    borderColor: colors.dangerLine,
    borderRadius: radius.md,
    padding: 15,
  },
  logoutPressed: { opacity: 0.7 },
  logoutText: { fontFamily: fonts.headingSemi, fontSize: 15, color: colors.danger },
  unblockBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line,
  },
  unblockText: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.accentPastel },

  mBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  mSheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: 30, borderTopWidth: 1, borderColor: colors.line,
  },
  mHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  mTitle: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },
  mHint: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: "center", marginVertical: 20 },
  blockedAvatarImg: { width: 34, height: 34, borderRadius: 999 },
  reportKind: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginTop: 2 },
});
