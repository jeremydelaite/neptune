// Carte standard de la charte : surface #1A1D24, radius 16, bordure fine
import { View, Text, StyleSheet, ViewProps } from "react-native";
import { colors } from "../../theme/colors";
import { fonts, radius } from "../../theme/typography";

interface Props extends ViewProps {
  title?: string;
}

export function Card({ title, children, style, ...rest }: Props) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 14,
  },
  title: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, marginBottom: 12 },
});
