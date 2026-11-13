import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  CalendarCheck,
  Users,
  Receipt,
  CreditCard,
  TrendingDown,
  Wrench,
  FileCheck2,
  Handshake,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  ShieldCheck,
  FileSpreadsheet,
  ClipboardCheck,
  HardHat,
  Landmark,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { UserRole } from '@/types';

interface SidebarProps {
  onCloseMobile?: () => void;
}

interface NavItem {
  name: string;
  to: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Boom Lifts & Fleet', to: '/machines', icon: Truck, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Quotations & Offers', to: '/quotations', icon: FileSpreadsheet, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Rentals', to: '/rentals', icon: CalendarCheck, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Site Logsheets (Shifts/OT)', to: '/logsheets', icon: ClipboardCheck, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Challans (Dispatch/Return)', to: '/challans', icon: FileCheck2, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Customers', to: '/customers', icon: Users, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'GST Invoices', to: '/invoices', icon: Receipt, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Payments & TDS', to: '/payments', icon: CreditCard, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Expenses', to: '/expenses', icon: TrendingDown, roles: ['OWNER', 'ACCOUNTANT', 'EMPLOYEE'] },
  { name: 'Operators & Staff', to: '/staff', icon: HardHat, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Machine Loans & EMI', to: '/loans', icon: Landmark, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Maintenance', to: '/maintenance', icon: Wrench, roles: ['OWNER', 'EMPLOYEE'] },
  { name: 'Partnership Profit Split', to: '/partners', icon: Handshake, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Financial Reports', to: '/reports', icon: BarChart3, roles: ['OWNER', 'ACCOUNTANT'] },
  { name: 'Company Settings', to: '/settings', icon: Settings, roles: ['OWNER'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const { profile, company, role, signOut } = useAuth();

  const userRole = role || 'OWNER';
  const filteredNav = navItems.filter((item) => item.roles.includes(userRole));

  return (
    <aside className="w-64 bg-slate-950 text-slate-300 flex flex-col h-full border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/50">
        <img
          src="/liftledger-logo.jpg"
          alt="LiftLedger Logo"
          className="w-9 h-9 rounded-xl object-cover shadow-md shadow-blue-500/20 border border-slate-700"
        />
        <div>
          <span className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
            LIFT<span className="text-blue-500">LEDGER</span>
          </span>
          <span className="text-[10px] text-slate-400 block tracking-wider uppercase font-semibold">
            Fleet & Rental SaaS
          </span>
        </div>
      </div>

      {/* Company Info Box */}
      {company && (
        <div className="px-4 py-3 mx-3 my-3 rounded-lg bg-slate-900/80 border border-slate-800/90 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-blue-950/60 border border-blue-800/50 flex items-center justify-center text-blue-400 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white truncate">{company.name}</p>
            <p className="text-[10px] text-slate-400 truncate">
              {company.city ? `${company.city}, ${company.state || ''}` : 'Boom Lift Rental'}
            </p>
          </div>
        </div>
      )}

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Main Menu
        </div>
        {filteredNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all group',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                )
              }
            >
              <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-105" />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer with Role Badge */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-3 px-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-bold shrink-0">
              {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white truncate">
                {profile?.full_name || 'Account'}
              </p>
              <div className="flex items-center gap-1 text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3" />
                {role || 'OWNER'}
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
