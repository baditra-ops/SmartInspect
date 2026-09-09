import { createContext, useContext, useEffect, useState } from "react";
import api, { unwrap } from "../services/api";


const AuthContext = createContext(null);

const ROLE_HOME = {
  ADMIN: "/admin",
  STATE_OFFICER: "/admin",
  DISTRICT_OFFICER: "/admin",
  INSPECTOR: "/inspector",
  INSTITUTION_USER: "/institute",
};


export function homeForRole(role) {
  return ROLE_HOME[role] || "/login";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("smartinspect_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api.get("/auth/me")
      .then((res) => setUser(unwrap(res)))
      .catch(() => {
        localStorage.removeItem("smartinspect_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const payload = unwrap(res);
    const token = payload?.token || payload?.accessToken || payload?.jwt;

    if (!token) throw new Error("Login succeeded but no JWT was returned by the backend.");

    localStorage.setItem("smartinspect_token", token);
    const loggedUser = payload.user || payload.profile || payload;
    setUser(loggedUser);
    return loggedUser;
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Token disposal is client-side by design.
    }
    localStorage.removeItem("smartinspect_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
