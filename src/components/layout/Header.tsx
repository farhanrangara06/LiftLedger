import React, { useState, useEffect } from 'react';
import { Menu, Bell, Plus, Calendar, AlertCircle, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Reminder } from '@/types';
import { formatDate } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onOpenMobileSidebar: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileSidebar, title = 'Dashboard' }) => {
  const { company, role } = useAuth();
  const navigate = useNavigate();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  useEffect(() => {
    if (!company?.id) return;
    const fetchReminders = async () => {
      const { data } = await supabase
        .from('reminders')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_dismissed', false)
        .order('due_date', { ascending: true })
        .limit(6);
      if (data) setReminders(data);
    };
    fetchReminders();
  }, [company?.id]);

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile trigger & Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 hidden sm:block">
            Boom Lift & High-Reach Equipment Rental Management
          </p>
        </div>
      </div>

      {/* Right: Actions, Notifications & User */}
      <div className="flex items-center gap-3">
        {installPrompt && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleInstallPwa}
            leftIcon={<Download className="w-3.5 h-3.5 text-blue-600" />}
            className="border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100"
          >
            Install App
          </Button>
        )}

        {/* Quick Action Button for Owner/Accountant */}
        {role !== 'EMPLOYEE' && (
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/rentals')}
            >
              New Rental
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              onClick={() => navigate('/invoices')}
            >
              GST Invoice
            </Button>
          </div>
        )}

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {reminders.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-slate-200 py-3 z-50 animate-slide-in">
              <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Operational Alerts ({reminders.length})
                </span>
                <span className="text-[11px] text-blue-600 font-medium">Automatic</span>
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {reminders.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No urgent pending reminders or maintenance alerts.
                  </div>
                ) : (
                  reminders.map((r) => (
                    <div key={r.id} className="p-3 hover:bg-slate-50 text-xs transition-colors">
                      <div className="flex items-center gap-2 font-semibold text-slate-800">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>{r.title}</span>
                      </div>
                      <p className="text-slate-600 mt-1 pl-5">{r.message}</p>
                      <div className="mt-1 pl-5 flex items-center gap-1 text-[10px] text-slate-400">
                        <Calendar className="w-3 h-3" />
                        Due: {formatDate(r.due_date)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
