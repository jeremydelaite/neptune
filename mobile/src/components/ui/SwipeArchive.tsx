// Ligne "swipe vers la gauche pour agir" — sans dépendance (PanResponder + Animated)
import { ReactNode, useRef } from "react";
import { Animated, PanResponder, View, Text, StyleSheet, Dimensions } from "react-native";
import { fonts, radius } from "../../theme/typography";

const W = Dimensions.get("window").width;
const TRIGGER = W * 0.32; // distance de déclenchement (proportionnelle à l'écran)

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
      // ne prend le geste que si mouvement clairement horizontal vers la gauche
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx < -6 && Math.abs(g.dx) > Math.abs(g.dy) * 1.2,
      onPanResponderTerminationRequest: () => false, // ne cède pas le geste au scroll
      onPanResponderMove: (_, g) => {
        if (g.dx <= 0) {
          // suivi 1:1, avec résistance au-delà du seuil de déclenchement
          const d = g.dx < -TRIGGER ? -TRIGGER + (g.dx + TRIGGER) * 0.35 : g.dx;
          tx.setValue(d);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -TRIGGER || g.vx < -0.6) {
          Animated.timing(tx, {
            toValue: -W,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onAction());
        } else {
          Animated.spring(tx, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
            speed: 18,
          }).start();
        }
      },
    })
  ).current;

  // l'action apparaît progressivement au fur et à mesure du swipe
  const actionOpacity = tx.interpolate({
    inputRange: [-TRIGGER, -20, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.action, { backgroundColor: bgColor, opacity: actionOpacity }]}>
        {icon}
        <Text style={[styles.label, { color: tintColor }]}>{label}</Text>
      </Animated.View>
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
