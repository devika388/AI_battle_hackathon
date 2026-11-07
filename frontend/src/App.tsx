import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/routeGuards";
import {
  AuthCallbackPage,
  ForgotPasswordPage,
  ResetPasswordPage,
} from "./pages/AuthFlowPages";
import { RegistrationPendingPage } from "./pages/DashboardPages";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PublicSitePage } from "./pages/PublicSitePage";
import { RegistrationPage } from "./pages/RegistrationPage";
const DonorDashboard = lazy(() =>
  import("./pages/dashboard/DonorDashboard").then((module) => ({
    default: module.DonorDashboard,
  })),
);
const NgoDashboard = lazy(() =>
  import("./pages/dashboard/NgoDashboard").then((module) => ({
    default: module.NgoDashboard,
  })),
);
const DeliveryPartnerDashboard = lazy(() =>
  import("./pages/dashboard/DeliveryPartnerDashboard").then((module) => ({
    default: module.DeliveryPartnerDashboard,
  })),
);
const AdminDashboard = lazy(() =>
  import("./pages/dashboard/AdminDashboard").then((module) => ({
    default: module.AdminDashboard,
  })),
);

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
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={null} />
            <Route path="/dashboard/pending" element={<RegistrationPendingPage />} />
          </Route>
          <Route element={<ProtectedRoute role="donor" />}>
            <Route path="/dashboard/donor" element={<Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading donor dashboard…</p>}><DonorDashboard /></Suspense>} />
            <Route path="/dashboard/donor/donations/:donationId" element={<Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading donation…</p>}><DonorDashboard /></Suspense>} />
          </Route>
          <Route element={<ProtectedRoute role="ngo" />}>
            <Route path="/dashboard/ngo" element={<Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading NGO dashboard…</p>}><NgoDashboard /></Suspense>} />
            <Route path="/dashboard/ngo/donations/:donationId" element={<Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading donation…</p>}><NgoDashboard /></Suspense>} />
          </Route>
          <Route element={<ProtectedRoute role="delivery_partner" />}>
            <Route path="/dashboard/delivery-partner" element={
              <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading delivery dashboard…</p>}>
                <DeliveryPartnerDashboard />
              </Suspense>
            } />
          </Route>
          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/dashboard/admin" element={
              <Suspense fallback={<p className="p-8 text-sm text-slate-500">Loading admin dashboard…</p>}>
                <AdminDashboard />
              </Suspense>
            } />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
