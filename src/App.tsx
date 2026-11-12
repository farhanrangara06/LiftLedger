import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/context/AuthContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppLayout } from '@/components/layout/AppLayout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

// Lazy-loaded Pages
const SignInPage = lazy(() => import('@/pages/auth/SignInPage').then((m) => ({ default: m.SignInPage })));
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage').then((m) => ({ default: m.SignUpPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));

const CompanySetupWizard = lazy(() => import('@/pages/setup/CompanySetupWizard').then((m) => ({ default: m.CompanySetupWizard })));

const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MachinesPage = lazy(() => import('@/pages/machines/MachinesPage').then((m) => ({ default: m.MachinesPage })));
const MachineDetailPage = lazy(() => import('@/pages/machines/MachineDetailPage').then((m) => ({ default: m.MachineDetailPage })));
const RentalsPage = lazy(() => import('@/pages/rentals/RentalsPage').then((m) => ({ default: m.RentalsPage })));
const CustomersPage = lazy(() => import('@/pages/customers/CustomersPage').then((m) => ({ default: m.CustomersPage })));
const CustomerDetailPage = lazy(() => import('@/pages/customers/CustomerDetailPage').then((m) => ({ default: m.CustomerDetailPage })));
const InvoicesPage = lazy(() => import('@/pages/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const PaymentsPage = lazy(() => import('@/pages/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const ExpensesPage = lazy(() => import('@/pages/expenses/ExpensesPage').then((m) => ({ default: m.ExpensesPage })));
const MaintenancePage = lazy(() => import('@/pages/maintenance/MaintenancePage').then((m) => ({ default: m.MaintenancePage })));
const ChallansPage = lazy(() => import('@/pages/challans/ChallansPage').then((m) => ({ default: m.ChallansPage })));
const QuotationsPage = lazy(() => import('@/pages/quotations/QuotationsPage').then((m) => ({ default: m.QuotationsPage })));
const SiteLogsheetsPage = lazy(() => import('@/pages/logsheets/SiteLogsheetsPage').then((m) => ({ default: m.SiteLogsheetsPage })));
const StaffOperatorsPage = lazy(() => import('@/pages/staff/StaffOperatorsPage').then((m) => ({ default: m.StaffOperatorsPage })));
const MachineLoansPage = lazy(() => import('@/pages/loans/MachineLoansPage').then((m) => ({ default: m.MachineLoansPage })));
const PartnersPage = lazy(() => import('@/pages/partners/PartnersPage').then((m) => ({ default: m.PartnersPage })));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <NotificationProvider>
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <LoadingSpinner message="Loading LiftLedger..." size="lg" />
              </div>
            }
          >
            <Routes>
              {/* Public Auth Routes */}
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/signup" element={<SignUpPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />

              {/* Mandatory Company Setup Wizard (Owner enters info & selects categories) */}
              <Route
                path="/setup"
                element={
                  <ProtectedRoute>
                    <CompanySetupWizard />
                  </ProtectedRoute>
                }
              />

              {/* Protected SaaS Application Shell */}
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<DashboardPage />} />
                <Route path="machines" element={<MachinesPage />} />
                <Route path="machines/:id" element={<MachineDetailPage />} />
                <Route path="rentals" element={<RentalsPage />} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="customers/:id" element={<CustomerDetailPage />} />
                <Route path="invoices" element={<InvoicesPage />} />
                <Route path="payments" element={<PaymentsPage />} />
                <Route path="expenses" element={<ExpensesPage />} />
                <Route path="maintenance" element={<MaintenancePage />} />
                <Route path="challans" element={<ChallansPage />} />
                <Route path="quotations" element={<QuotationsPage />} />
                <Route path="logsheets" element={<SiteLogsheetsPage />} />
                <Route path="staff" element={<StaffOperatorsPage />} />
                <Route
                  path="loans"
                  element={
                    <ProtectedRoute allowedRoles={['OWNER', 'ACCOUNTANT']}>
                      <MachineLoansPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="partners"
                  element={
                    <ProtectedRoute allowedRoles={['OWNER', 'ACCOUNTANT']}>
                      <PartnersPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="reports" element={<ReportsPage />} />
                <Route
                  path="settings"
                  element={
                    <ProtectedRoute allowedRoles={['OWNER']}>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
