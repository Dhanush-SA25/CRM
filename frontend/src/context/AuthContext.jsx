import { createContext, useContext, useEffect, useReducer, useCallback } from "react";
import { authService } from "../services/authService";

const AuthContext = createContext(null);

/**
 * Decode the `role` claim from a JWT access token.
 *
 * The token is not verified client-side — the backend verifies it on every
 * request. The decoded role is used purely for UI gating (admin nav, admin
 * routes) per Requirements 2.6 / 2.7. Returns `null` for a missing/invalid
 * token or a token without a `role` claim.
 */
function decodeRole(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).role ?? null;
  } catch {
    return null;
  }
}

const initialState = {
  user: null,
  role: null,
  isAuthenticated: false,
  isLoading: true,
};

function authReducer(state, action) {
  switch (action.type) {
    case "INIT":
      return {
        ...state,
        user: action.payload.user,
        role: action.payload.role,
        isAuthenticated: !!action.payload.user,
        isLoading: false,
      };
    case "LOGIN":
      return {
        ...state,
        user: action.payload.user,
        role: action.payload.role,
        isAuthenticated: true,
        isLoading: false,
      };
    case "LOGOUT":
      return {
        ...state,
        user: null,
        role: null,
        isAuthenticated: false,
        isLoading: false,
      };
    // Issued when the access token is refreshed (see services/api.js). The
    // user identity is unchanged, so only the role is re-derived from the new
    // token. If the refreshed token carries no `role` claim, keep the existing
    // role rather than wiping UI gating.
    case "REFRESH":
      return action.payload == null ? state : { ...state, role: action.payload };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // On mount — restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      dispatch({ type: "INIT", payload: { user: null, role: null } });
      return;
    }
    authService
      .getMe()
      .then((user) =>
        dispatch({ type: "INIT", payload: { user, role: decodeRole(token) } })
      )
      .catch(() => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        dispatch({ type: "INIT", payload: { user: null, role: null } });
      });
  }, []);

  // Keep the role in sync when the access token is refreshed by the axios
  // interceptor (which lives outside React). The interceptor dispatches a
  // window "auth:token-refreshed" event after storing the new token.
  useEffect(() => {
    function handleTokenRefresh() {
      const token = localStorage.getItem("access_token");
      const role = token ? decodeRole(token) : null;
      dispatch({ type: "REFRESH", payload: role });
    }
    window.addEventListener("auth:token-refreshed", handleTokenRefresh);
    return () => window.removeEventListener("auth:token-refreshed", handleTokenRefresh);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user, access_token, refresh_token } = await authService.login(email, password);
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    dispatch({ type: "LOGIN", payload: { user, role: decodeRole(access_token) } });
    return user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const { user, access_token, refresh_token } = await authService.register(name, email, password);
    localStorage.setItem("access_token", access_token);
    localStorage.setItem("refresh_token", refresh_token);
    dispatch({ type: "LOGIN", payload: { user, role: decodeRole(access_token) } });
    return user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    dispatch({ type: "LOGOUT" });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
