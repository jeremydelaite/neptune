// À PROPOS : version, crédits (TMDB obligatoire), mentions légales, contact
import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, ExternalLink } from "lucide-react-native";
import { colors } from "../src/theme/colors";
import { fonts, radius } from "../src/theme/typography";

const APP_VERSION = "1.0.0";

export default function AboutScreen() {
  const router = useRouter();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/profile");
  };
  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={goBack} hitSlop={16} style={styles.back}>
          <ArrowLeft size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>À propos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.brandBlock}>
          <Text style={styles.brand}>NEPTUNE</Text>
          <Text style={styles.version}>Version {APP_VERSION}</Text>
          <Text style={styles.tagline}>Tes films et séries, suivis simplement 🪐</Text>
        </View>

        {/* Crédit TMDB — obligatoire pour l'usage gratuit de l'API */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Données</Text>
          <Text style={styles.body}>
            Les films, séries, affiches et informations proviennent de The Movie Database (TMDB).
          </Text>
          <Text style={styles.disclaimer}>
            Ce produit utilise l'API TMDB mais n'est ni approuvé ni certifié par TMDB.
          </Text>
          <Pressable style={styles.linkRow} onPress={() => open("https://www.themoviedb.org")}>
            <Text style={styles.linkText}>themoviedb.org</Text>
            <ExternalLink size={15} color={colors.accentPastel} />
          </Pressable>
        </View>

        {/* Modération */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modération des images</Text>
          <Text style={styles.body}>
            Les photos de profil peuvent être analysées automatiquement afin de préserver un espace sûr.
          </Text>
        </View>

        {/* Mentions légales (à venir) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mentions légales</Text>
          <Pressable style={styles.legalRow} onPress={() => open("https://neptune.app/confidentialite")}>
            <Text style={styles.legalText}>Politique de confidentialité</Text>
            <ExternalLink size={15} color={colors.dim} />
          </Pressable>
          <Pressable style={[styles.legalRow, styles.legalBorder]} onPress={() => open("https://neptune.app/cgu")}>
            <Text style={styles.legalText}>Conditions d'utilisation</Text>
            <ExternalLink size={15} color={colors.dim} />
          </Pressable>
          <Text style={styles.soon}>Liens à mettre à jour avant publication.</Text>
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Contact</Text>
          <Pressable style={styles.linkRow} onPress={() => open("mailto:support@neptune.app")}>
            <Text style={styles.linkText}>support@neptune.app</Text>
          </Pressable>
        </View>

        <Text style={styles.copyright}>© {new Date().getFullYear()} Neptune</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  back: {
    width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line,
  },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.text },
  content: { padding: 16, paddingBottom: 60 },

  brandBlock: { alignItems: "center", marginVertical: 18, gap: 4 },
  brand: { fontFamily: fonts.heading, fontSize: 30, letterSpacing: 5, color: colors.accentPastel },
  version: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.dim },
  tagline: { fontFamily: fonts.body, fontSize: 13, color: colors.dim, marginTop: 6 },

  card: {
    backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1,
    borderRadius: radius.lg, padding: 16, marginBottom: 14,
  },
  cardTitle: { fontFamily: fonts.heading, fontSize: 14, color: colors.text, marginBottom: 10 },
  body: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.dim },
  disclaimer: { fontFamily: fonts.body, fontSize: 12, lineHeight: 18, color: colors.dim, fontStyle: "italic", marginTop: 8 },

  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  linkText: { fontFamily: fonts.headingSemi, fontSize: 13, color: colors.accentPastel },

  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  legalBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  legalText: { fontFamily: fonts.bodyMedium, fontSize: 14, color: colors.text },
  soon: { fontFamily: fonts.body, fontSize: 11, color: colors.dim, marginTop: 8 },

  copyright: { fontFamily: fonts.body, fontSize: 12, color: colors.dim, textAlign: "center", marginTop: 10 },
});
