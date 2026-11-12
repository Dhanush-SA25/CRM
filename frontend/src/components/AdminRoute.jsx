import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps admin-only routes — renders child routes if the user's role is
 * "admin", otherwise redirects to /dashboard.
 *
 * Note: `role` is exposed on the AuthContext by the auth context changes
 * (task 6.2); this guard reads it directly from the context.
 */
export default function AdminRoute() {
  const { role } = useAuth();

  return role === "admin" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
