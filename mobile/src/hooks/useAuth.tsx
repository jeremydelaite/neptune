import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../services/api";

interface User { id: string; username: string; email: string }
interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
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
