// Avatar cliquable : s'agrandit en plein écran s'il y a une photo
import { useState } from "react";
import { View, Text, Image, Pressable, Modal, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { fonts } from "../../theme/typography";

interface Props {
  uri: string | null | undefined;
  fallback: string;
  size: number;
  borderColor?: string;
}

export function AvatarZoom({ uri, fallback, size, borderColor = colors.accent }: Props) {
  const [open, setOpen] = useState(false);

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

  return (
    <>
      <Pressable onPress={() => setOpen(true)}>{avatar}</Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
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
});
