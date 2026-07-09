// Commentaires d'une fiche — un seul par utilisateur/titre, modifiable & supprimable
import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Trash2, Send, Pencil, Check, X } from "lucide-react-native";
import { api } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";
import type { MediaType } from "../../types";

interface CommentItem {
  id: string;
  content: string;
  createdAt: string;
  userId: string;
  user: { username: string; avatarUrl: string | null };
}

const noOutline = Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null;

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function Comments({ mediaType, tmdbId }: { mediaType: MediaType; tmdbId: number }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<"recent" | "old">("recent");

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const path = mediaType.toLowerCase();
  const myComment = comments.find((c) => c.userId === user?.id);

  const load = useCallback(
    async (s: "recent" | "old") => {
      setLoading(true);
      try {
        const data = await api.get<CommentItem[]>(`/comments/${path}/${tmdbId}?sort=${s}`);
        setComments(data);
      } catch {
        setComments([]);
      } finally {
        setLoading(false);
      }
    },
    [path, tmdbId]
  );

  useFocusEffect(
    useCallback(() => {
      load(sort);
    }, [load, sort])
  );

  async function submit() {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/comments", { tmdbId, mediaType, content });
      setText("");
      await load(sort);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible");
    } finally {
      setSending(false);
    }
  }

  async function saveEdit(id: string) {
    const content = editText.trim();
    if (!content) return;
    setComments((prev) => prev.map((c) => (c.id === id ? { ...c, content } : c)));
    setEditingId(null);
    await api.patch(`/comments/${id}`, { content }).catch(() => {});
  }

  async function remove(id: string) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    await api.delete(`/comments/${id}`).catch(() => {});
  }

  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Commentaires</Text>
        <View style={styles.sortRow}>
          {(["recent", "old"] as const).map((s) => (
            <Pressable key={s} onPress={() => setSort(s)}>
              <Text style={[styles.sortText, sort === s && styles.sortActive]}>
                {s === "recent" ? "Récents" : "Anciens"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Saisie : seulement si l'utilisateur n'a pas encore commenté */}
      {!myComment && (
        <>
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, noOutline]}
              placeholder="Écrire un commentaire…"
              placeholderTextColor={colors.dim}
              value={text}
              onChangeText={setText}
              multiline
            />
            <Pressable style={styles.send} onPress={submit} disabled={sending || !text.trim()}>
              {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
            </Pressable>
          </View>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </>
      )}
      {myComment && (
        <Text style={styles.hint}>Tu as déjà commenté ce titre — tu peux le modifier ou le supprimer.</Text>
      )}

      {/* Liste */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 16 }} color={colors.accent} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>Aucun commentaire pour l'instant. Sois le premier !</Text>
      ) : (
        comments.map((c) => {
          const mine = c.userId === user?.id;
          const editing = editingId === c.id;
          return (
            <View key={c.id} style={[styles.comment, mine && styles.commentMine]}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{c.user.username.charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.commentHead}>
                  <Text style={styles.author}>{c.user.username}</Text>
                  <Text style={styles.date}>{shortDate(c.createdAt)}</Text>
                </View>
                {editing ? (
                  <View style={styles.editRow}>
                    <TextInput
                      style={[styles.editInput, noOutline]}
                      value={editText}
                      onChangeText={setEditText}
                      multiline
                      autoFocus
                    />
                    <Pressable onPress={() => saveEdit(c.id)} hitSlop={6} style={styles.editBtn}>
                      <Check size={16} color={colors.accent} />
                    </Pressable>
                    <Pressable onPress={() => setEditingId(null)} hitSlop={6} style={styles.editBtn}>
                      <X size={16} color={colors.dim} />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={styles.content}>{c.content}</Text>
                )}
              </View>
              {mine && !editing && (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => {
                      setEditingId(c.id);
                      setEditText(c.content);
                    }}
                    hitSlop={8}
                    style={styles.actionBtn}
                  >
                    <Pencil size={15} color={colors.accentPastel} />
                  </Pressable>
                  <Pressable onPress={() => remove(c.id)} hitSlop={8} style={styles.actionBtn}>
                    <Trash2 size={15} color={colors.dim} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontFamily: fonts.heading, fontSize: 14, color: colors.text },
  sortRow: { flexDirection: "row", gap: 14 },
  sortText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.dim },
  sortActive: { color: colors.accentPastel },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 10 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: { fontFamily: fonts.body, fontSize: 12, color: colors.danger, marginBottom: 10 },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, marginBottom: 12 },

  empty: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginTop: 4 },
  comment: { flexDirection: "row", gap: 10, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.line },
  commentMine: {},
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: fonts.headingSemi, fontSize: 14, color: colors.accentPastel },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  author: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.text },
  date: { fontFamily: fonts.body, fontSize: 11, color: colors.dim },
  content: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.text },
  actions: { flexDirection: "row", gap: 4 },
  actionBtn: { padding: 4 },

  editRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 2 },
  editInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  editBtn: { padding: 6 },
});
