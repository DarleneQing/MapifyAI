import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UserRole = "personal" | "merchant";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  /** Merchant-only fields */
  shopName?: string;
  shopCategory?: string;
}

interface AuthContextValue {
  user: MockUser | null;
  isAuthenticated: boolean;
  isMerchant: boolean;
  login: (email: string, password: string, role: UserRole, extra?: Partial<MockUser>) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MockUser | null>(() => {
    const saved = localStorage.getItem("mock_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = useCallback(
    (email: string, _password: string, role: UserRole, extra?: Partial<MockUser>) => {
      const mockUser: MockUser = {
        id: "user_" + Date.now(),
        name: role === "merchant" ? (extra?.shopName || "My Shop") : email.split("@")[0],
        email,
        role,
        ...extra,
      };
      setUser(mockUser);
      localStorage.setItem("mock_user", JSON.stringify(mockUser));
    },
    []
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("mock_user");
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isMerchant: user?.role === "merchant",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
