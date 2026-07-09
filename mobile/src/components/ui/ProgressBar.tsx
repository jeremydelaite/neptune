import { View, StyleSheet } from "react-native";
import { colors } from "../../theme/colors";

export function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, progress * 100))}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 5, borderRadius: 99, backgroundColor: colors.surface2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 99, backgroundColor: colors.accent },
});
