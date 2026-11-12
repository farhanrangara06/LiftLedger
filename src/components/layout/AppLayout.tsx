import React, { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const AppLayout: React.FC = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  // Determine current page title from path
  const getPageTitle = (path: string) => {
    if (path === '/') return 'Operational Dashboard';
    if (path.startsWith('/machines')) return 'Boom Lifts & Equipment Fleet';
    if (path.startsWith('/quotations')) return 'Commercial Quotations & Offer Letters';
    if (path.startsWith('/rentals')) return 'Equipment Rental Contracts';
    if (path.startsWith('/logsheets')) return 'Daily Site Logsheets (Shifts & Overtime)';
    if (path.startsWith('/challans')) return 'Dispatch & Return Challans';
    if (path.startsWith('/customers')) return 'Customer Directory & Accounts';
    if (path.startsWith('/invoices')) return 'GST Tax Invoicing & Billing';
    if (path.startsWith('/payments')) return 'Payments, Collections & TDS';
    if (path.startsWith('/expenses')) return 'Operational & Fleet Expenses';
    if (path.startsWith('/staff')) return 'Operators, Field Staff & Team Roles';
    if (path.startsWith('/loans')) return 'Equipment Bank Loans & Monthly EMI';
    if (path.startsWith('/maintenance')) return 'Equipment Maintenance & Health';
    if (path.startsWith('/partners')) return 'Partnership Firm Profit & Revenue Split';
    if (path.startsWith('/reports')) return 'Financial Reports & Profitability';
    if (path.startsWith('/settings')) return 'Company Profile & Settings';
    return 'LiftLedger';
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 z-50 flex shadow-2xl">
            <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
          title={getPageTitle(location.pathname)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
