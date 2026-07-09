// Modale de confirmation générique (charte Neptune)
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onCancel}>
              <Text style={styles.btnGhostText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary]} onPress={onConfirm}>
              <Text style={styles.btnPrimaryText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  sheet: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    padding: 20,
  },
  title: { fontFamily: fonts.heading, fontSize: 17, color: colors.text, marginBottom: 8 },
  message: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.dim, marginBottom: 20 },
  actions: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: radius.md, alignItems: "center" },
  btnGhost: { backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.line },
  btnGhostText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.text },
  btnPrimary: { backgroundColor: colors.violet },
  btnPrimaryText: { fontFamily: fonts.headingSemi, fontSize: 13, color: "#fff" },
});
