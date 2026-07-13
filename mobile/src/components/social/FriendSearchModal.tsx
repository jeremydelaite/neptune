// Modale : rechercher des utilisateurs et gérer l'amitié
import { useEffect, useState } from "react";
import {
  View, Text, TextInput, Pressable, Modal, Image, ActivityIndicator, ScrollView, Platform, StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Search, X, UserPlus, Check, Clock } from "lucide-react-native";
import { api } from "../../services/api";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

type FriendStatus = "none" | "friends" | "pending_out" | "pending_in";
interface Result { id: string; username: string; avatarUrl: string | null; friendStatus: FriendStatus }

const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

export function FriendSearchModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
    }
  }, [visible]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get<Result[]>(`/users/search?q=${encodeURIComponent(q)}`)
        .then((r) => active && setResults(r))
        .catch(() => active && setResults([]))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  function setState(id: string, friendStatus: FriendStatus) {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, friendStatus } : r)));
  }

  async function act(r: Result) {
    if (r.friendStatus === "none") {
      setState(r.id, "pending_out");
      await api.post(`/friends/request/${r.id}`, {}).catch(() => setState(r.id, "none"));
    } else if (r.friendStatus === "pending_out") {
      setState(r.id, "none");
      await api.delete(`/friends/${r.id}`).catch(() => setState(r.id, "pending_out"));
    } else if (r.friendStatus === "pending_in") {
      setState(r.id, "friends");
      await api.post(`/friends/accept/${r.id}`, {}).catch(() => setState(r.id, "pending_in"));
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>Rechercher des amis</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <X size={22} color={colors.dim} />
            </Pressable>
          </View>

          <View style={[styles.searchBar, focused && styles.searchBarFocused]}>
            <Search size={18} color={focused ? colors.accentPastel : colors.dim} />
            <TextInput
              style={[styles.input, noOutline]}
              value={query}
              onChangeText={setQuery}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Pseudo (2 lettres min.)…"
              placeholderTextColor={colors.dim}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery("")} hitSlop={8}>
                <X size={18} color={colors.dim} />
              </Pressable>
            )}
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
            {loading ? (
              <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
            ) : query.trim().length < 2 ? (
              <Text style={styles.hint}>Tape au moins 2 lettres pour chercher un utilisateur.</Text>
            ) : results.length === 0 ? (
              <Text style={styles.hint}>Aucun utilisateur trouvé.</Text>
            ) : (
              results.map((r) => (
                <View key={r.id} style={styles.resRow}>
                  <Pressable
                    style={styles.resLeft}
                    onPress={() => {
                      onClose();
                      router.push(`/users/${r.id}`);
                    }}
                  >
                    {r.avatarUrl ? (
                      <Image source={{ uri: r.avatarUrl }} style={styles.resAvatar} />
                    ) : (
                      <View style={styles.resFallback}>
                        <Text style={styles.resLetter}>{r.username.charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={styles.resName} numberOfLines={1}>{r.username}</Text>
                  </Pressable>

                  {r.friendStatus === "friends" ? (
                    <View style={[styles.actBtn, styles.actFriends]}>
                      <Check size={14} color={colors.accentPastel} />
                      <Text style={styles.actFriendsText}>Amis</Text>
                    </View>
                  ) : r.friendStatus === "pending_out" ? (
                    <Pressable style={[styles.actBtn, styles.actPending]} onPress={() => act(r)}>
                      <Clock size={14} color={colors.dim} />
                      <Text style={styles.actPendingText}>Envoyée</Text>
                    </Pressable>
                  ) : r.friendStatus === "pending_in" ? (
                    <Pressable style={[styles.actBtn, styles.actAdd]} onPress={() => act(r)}>
                      <Check size={14} color="#fff" />
                      <Text style={styles.actAddText}>Accepter</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={[styles.actBtn, styles.actAdd]} onPress={() => act(r)}>
                      <UserPlus size={14} color="#fff" />
                      <Text style={styles.actAddText}>Ajouter</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    padding: 18, paddingBottom: 34, borderTopWidth: 1, borderColor: colors.line,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 99, backgroundColor: colors.line, marginBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  title: { fontFamily: fonts.heading, fontSize: 18, color: colors.text },

  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line,
    borderRadius: radius.md, paddingHorizontal: 12, height: 46, marginBottom: 8,
  },
  searchBarFocused: { borderColor: colors.accent },
  input: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.text, height: "100%" },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, textAlign: "center", marginTop: 24 },

  resRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  resLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  resAvatar: { width: 42, height: 42, borderRadius: 999, borderWidth: 1, borderColor: colors.accent },
  resFallback: {
    width: 42, height: 42, borderRadius: 999, backgroundColor: colors.accentSoft,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.accent,
  },
  resLetter: { fontFamily: fonts.heading, fontSize: 17, color: colors.accentPastel },
  resName: { flex: 1, fontFamily: fonts.headingSemi, fontSize: 14, color: colors.text },

  actBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
  actAdd: { backgroundColor: colors.accent },
  actAddText: { fontFamily: fonts.headingSemi, fontSize: 12, color: "#fff" },
  actPending: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  actPendingText: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.dim },
  actFriends: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
  actFriendsText: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.accentPastel },
});
