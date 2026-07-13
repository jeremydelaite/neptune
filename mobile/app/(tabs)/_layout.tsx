// Barre d'onglets — glassmorphism charte (fond semi-transparent + blur)
import { useEffect, useRef, useState } from "react";
import { View, AppState, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { BlurView } from "expo-blur";
import { Home, Search, MonitorPlay, User } from "lucide-react-native";
import { api } from "../../src/services/api";
import { setUnread, subscribeUnread, getUnread } from "../../src/lib/notifState";
import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  const [hasUnread, setHasUnread] = useState(getUnread() > 0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const check = () =>
      api
        .get<{ count: number }>("/notifications/unread-count")
        .then((c) => setUnread(c.count))
        .catch(() => {});
    const unsub = subscribeUnread((count) => setHasUnread(count > 0)); // réagit immédiatement
    check();
    timer.current = setInterval(check, 20000); // rafraîchit toutes les 20 s
    const sub = AppState.addEventListener("change", (st) => st === "active" && check());
    return () => {
      if (timer.current) clearInterval(timer.current);
      sub.remove();
      unsub();
    };
  }, []);

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
      <Tabs.Screen
        name="profile"
        options={{
          title: "Compte",
          tabBarIcon: ({ color, size }) => (
            <View>
              <User color={color} size={size} strokeWidth={1.6} />
              {hasUnread && <View style={styles.dot} />}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 999,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.bg,
  },
});
