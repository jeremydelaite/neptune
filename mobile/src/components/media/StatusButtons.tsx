// Boutons "À voir / En cours / Vu" — accent violet sur l'état actif
import { View, Pressable, Text, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";
import type { TrackStatus, MediaType } from "../../types";

const LABELS: Record<MediaType, [TrackStatus, string][]> = {
  MOVIE: [["TO_WATCH", "À voir"], ["COMPLETED", "Vu"]],
  TV: [["TO_WATCH", "À voir"], ["WATCHING", "En cours"], ["COMPLETED", "Terminée"]],
};

interface Props {
  mediaType: MediaType;
  status: TrackStatus | null;
  onSelect: (status: TrackStatus) => void;
}

export function StatusButtons({ mediaType, status, onSelect }: Props) {
  return (
    <View style={styles.row}>
      {LABELS[mediaType].map(([key, label]) => {
        const active = status === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            style={[styles.btn, active && styles.btnActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, marginBottom: 14 },
  btn: {
    flex: 1, paddingVertical: 10, alignItems: "center",
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: colors.line, backgroundColor: colors.surface,
  },
  btnActive: { borderColor: colors.violet, backgroundColor: colors.violet },
  label: { fontFamily: fonts.headingSemi, fontSize: 12, color: colors.dim },
  labelActive: { color: "#fff" },
});
