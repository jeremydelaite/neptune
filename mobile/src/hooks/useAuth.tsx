import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, setAccountBlockedHandler } from "../services/api";

interface User { id: string; username: string; email: string; isAdmin?: boolean }
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaure la session au démarrage
    AsyncStorage.getItem("neptune_user")
      .then((raw) => raw && setUser(JSON.parse(raw)))
      .finally(() => setLoading(false));
  }, []);

  // Déconnexion forcée si le backend signale un compte banni/suspendu
  useEffect(() => {
    setAccountBlockedHandler((message) => {
      AsyncStorage.multiRemove(["neptune_token", "neptune_user"]);
      setUser(null);
      Alert.alert("Accès restreint", message);
    });
    return () => setAccountBlockedHandler(null);
  }, []);

  async function handleAuth(payload: { token: string; user: User }) {
    await AsyncStorage.multiSet([
      ["neptune_token", payload.token],
      ["neptune_user", JSON.stringify(payload.user)],
    ]);
    setUser(payload.user);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login: async (email, password) =>
          handleAuth(await api.post("/auth/login", { email, password })),
        register: async (email, username, password) =>
          handleAuth(await api.post("/auth/register", { email, username, password })),
        logout: async () => {
          await AsyncStorage.multiRemove(["neptune_token", "neptune_user"]);
          setUser(null);
        },
        updateUser: async (partial) => {
          setUser((prev) => {
            const next = prev ? { ...prev, ...partial } : prev;
            if (next) AsyncStorage.setItem("neptune_user", JSON.stringify(next));
            return next;
          });
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
