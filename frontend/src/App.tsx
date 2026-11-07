import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/routeGuards";
import {
  AuthCallbackPage,
  ForgotPasswordPage,
  ResetPasswordPage,
  VerificationPage,
} from "./pages/AuthFlowPages";
import { DashboardPage, RegistrationPendingPage } from "./pages/DashboardPages";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicSitePage } from "./pages/PublicSitePage";
import { RegistrationPage } from "./pages/RegistrationPage";

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PublicSitePage />} />
          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/auth/verify" element={<VerificationPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={null} />
            <Route path="/dashboard/pending" element={<RegistrationPendingPage />} />
          </Route>
          <Route element={<ProtectedRoute role="donor" />}>
            <Route
              path="/dashboard/donor"
              element={<DashboardPage kind="donor" />}
            />
          </Route>
          <Route element={<ProtectedRoute role="ngo" />}>
            <Route path="/dashboard/ngo" element={<DashboardPage kind="ngo" />} />
          </Route>
          <Route element={<ProtectedRoute role="delivery_partner" />}>
            <Route
              path="/dashboard/delivery-partner"
              element={<DashboardPage kind="delivery_partner" />}
            />
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route
              path="/dashboard/admin"
              element={<DashboardPage kind="admin" />}
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
