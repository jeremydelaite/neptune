// Notation 1-5 étoiles (entiers). Étoiles violettes fidèles à la charte.
import { View, Pressable, StyleSheet } from "react-native";
import { Star } from "lucide-react-native";
import { colors } from "../../theme/colors";

interface Props {
  value: number;                    // 0-5
  onChange?: (score: number) => void; // absent = lecture seule
  size?: number;
}

export function StarRating({ value, onChange, size = 28 }: Props) {
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={6}>
          <Star
            size={size}
            color={i <= value ? colors.accent : "#4B5262"}
            fill={i <= value ? colors.accent : "transparent"}
            strokeWidth={1.6}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, justifyContent: "center" },
});
