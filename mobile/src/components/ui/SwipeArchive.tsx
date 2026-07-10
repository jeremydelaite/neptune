// Ligne "swipe vers la gauche pour agir" — sans dépendance (PanResponder + Animated)
import { ReactNode, useRef } from "react";
import { Animated, PanResponder, View, Text, StyleSheet, Dimensions } from "react-native";
import { fonts, radius } from "../../theme/typography";

const THRESHOLD = 90; // distance de déclenchement
const MAX = 150;
const OUT = Dimensions.get("window").width;

interface Props {
  children: ReactNode;
  onAction: () => void;
  bgColor: string;
  tintColor: string;
  label: string;
  icon: ReactNode;
}

export function SwipeArchive({ children, onAction, bgColor, tintColor, label, icon }: Props) {
  const tx = useRef(new Animated.Value(0)).current;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) tx.setValue(Math.max(g.dx, -MAX));
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -THRESHOLD) {
          Animated.timing(tx, { toValue: -OUT, duration: 200, useNativeDriver: true }).start(() =>
            onAction()
          );
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        }
      },
    })
  ).current;

  return (
    <View style={styles.wrap}>
      <View style={[styles.action, { backgroundColor: bgColor }]}>
        {icon}
        <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
      </View>
      <Animated.View style={{ transform: [{ translateX: tx }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: radius.md, overflow: "hidden" },
  action: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    paddingRight: 22,
    borderRadius: radius.md,
  },
  label: { fontFamily: fonts.headingSemi, fontSize: 13 },
});
