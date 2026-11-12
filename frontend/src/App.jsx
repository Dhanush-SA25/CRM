import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AppLayout from "./components/layout/AppLayout";

// Pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import LeadsPage from "./pages/LeadsPage";
import DealsPage from "./pages/DealsPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import TasksPage from "./pages/TasksPage";
import ActivitiesPage from "./pages/ActivitiesPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminEmployeesPage from "./pages/AdminEmployeesPage";
import AdminTargetsPage from "./pages/AdminTargetsPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected routes — wrapped in sidebar layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="leads" element={<LeadsPage />} />
            <Route path="deals" element={<DealsPage />} />
            <Route path="followups" element={<FollowUpsPage />} />
            <Route path="tasks" element={<TasksPage />} />
            <Route path="activities" element={<ActivitiesPage />} />

            {/* Admin-only routes */}
            <Route element={<AdminRoute />}>
              <Route path="admin/users" element={<AdminUsersPage />} />
              <Route path="admin/employees" element={<AdminEmployeesPage />} />
              <Route path="admin/targets" element={<AdminTargetsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
