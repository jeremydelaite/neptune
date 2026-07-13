// Avatar cliquable : ouvre un menu (Afficher la photo + actions) puis plein écran
import { useState } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet } from "react-native";
import { Maximize2, Flag, Check } from "lucide-react-native";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

export interface AvatarAction {
  label: string;
  onPress: () => void;
  danger?: boolean;
  done?: boolean;
}

interface Props {
  uri: string | null | undefined;
  fallback: string;
  size: number;
  borderColor?: string;
  actions?: AvatarAction[];
}

export function AvatarZoom({ uri, fallback, size, borderColor = colors.accent, actions }: Props) {
  const [menu, setMenu] = useState(false);
  const [viewer, setViewer] = useState(false);

  const avatar = uri ? (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius: 999, borderWidth: 1, borderColor }}
    />
  ) : (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        backgroundColor: colors.accentSoft,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor,
      }}
    >
      <Text style={{ fontFamily: fonts.heading, fontSize: size * 0.4, color: colors.accentPastel }}>
        {fallback}
      </Text>
    </View>
  );

  if (!uri) return avatar;

  const hasActions = !!actions && actions.length > 0;

  return (
    <>
      <Pressable onPress={() => (hasActions ? setMenu(true) : setViewer(true))}>{avatar}</Pressable>

      {/* Menu contextuel */}
      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenu(false)}>
          <Pressable style={styles.menuSheet} onPress={() => {}}>
            <Pressable
              style={styles.menuRow}
              onPress={() => {
                setMenu(false);
                setViewer(true);
              }}
            >
              <Maximize2 size={18} color={colors.text} />
              <Text style={styles.menuText}>Afficher la photo</Text>
            </Pressable>
            {actions?.map((a, i) => (
              <Pressable
                key={i}
                style={[styles.menuRow, styles.menuRowBorder]}
                onPress={() => {
                  setMenu(false);
                  a.onPress();
                }}
              >
                {a.done ? (
                  <Check size={18} color={colors.accentPastel} />
                ) : (
                  <Flag size={18} color={a.danger ? colors.danger : colors.text} />
                )}
                <Text style={[styles.menuText, a.danger && !a.done && { color: colors.danger }]}>{a.label}</Text>
              </Pressable>
            ))}
            <Pressable style={[styles.menuRow, styles.menuRowBorder]} onPress={() => setMenu(false)}>
              <Text style={[styles.menuText, styles.menuCancel]}>Annuler</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Plein écran */}
      <Modal visible={viewer} transparent animationType="fade" onRequestClose={() => setViewer(false)}>
        <Pressable style={styles.backdrop} onPress={() => setViewer(false)}>
          <Image source={{ uri }} style={styles.big} resizeMode="contain" />
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  big: { width: "100%", height: "70%", borderRadius: 16 },

  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 32 },
  menuSheet: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 15, paddingHorizontal: 18 },
  menuRowBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  menuText: { fontFamily: fonts.headingSemi, fontSize: 15, color: colors.text },
  menuCancel: { color: colors.dim, flex: 1, textAlign: "center" },
});
