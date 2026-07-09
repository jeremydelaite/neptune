// Barre d'onglets — glassmorphism charte (fond semi-transparent + blur)
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Home, Search, MonitorPlay, User } from "lucide-react-native";
import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          position: "absolute",
          borderTopColor: colors.line,
          backgroundColor: "rgba(15,17,21,0.72)",
        },
        tabBarBackground: () => (
          <BlurView intensity={30} tint="dark" style={{ flex: 1 }} />
        ),
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil", tabBarIcon: ({ color, size }) => <Home color={color} size={size} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="search" options={{ title: "Recherche", tabBarIcon: ({ color, size }) => <Search color={color} size={size} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="watching" options={{ title: "En cours", tabBarIcon: ({ color, size }) => <MonitorPlay color={color} size={size} strokeWidth={1.6} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Compte", tabBarIcon: ({ color, size }) => <User color={color} size={size} strokeWidth={1.6} /> }} />
    </Tabs>
  );
}
