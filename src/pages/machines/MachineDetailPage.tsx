import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Truck,
  ArrowLeft,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wrench,
  Clock,
  MapPin,
  FileText,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Machine, Rental, Maintenance, Expense, Invoice } from '@/types';

export const MachineDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { company } = useAuth();
  const navigate = useNavigate();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [maintenanceRecords, setMaintenanceRecords] = useState<Maintenance[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !company?.id) return;

    const loadMachineDetail = async () => {
      setLoading(true);
      try {
        // 1. Fetch Machine
        const { data: mData } = await supabase
          .from('machines')
          .select('*, category:company_machine_categories(*)')
          .eq('id', id)
          .eq('company_id', company.id)
          .single();

        if (mData) setMachine(mData as Machine);

        // 2. Fetch Rentals for this machine
        const { data: rData } = await supabase
          .from('rentals')
          .select('*, customer:customers(*)')
          .eq('machine_id', id)
          .eq('company_id', company.id)
          .order('start_date', { ascending: false });

        if (rData) setRentals(rData as Rental[]);

        // 3. Fetch Maintenance logs
        const { data: maintData } = await supabase
          .from('maintenance')
          .select('*')
          .eq('machine_id', id)
          .eq('company_id', company.id)
          .order('start_date', { ascending: false });

        if (maintData) setMaintenanceRecords(maintData as Maintenance[]);

        // 4. Fetch Expenses attributed to this machine
        const { data: expData } = await supabase
          .from('expenses')
          .select('*')
          .eq('machine_id', id)
          .eq('company_id', company.id)
          .order('date', { ascending: false });

        if (expData) setExpenses(expData as Expense[]);

        // 5. Fetch Invoices for this machine
        const { data: invData } = await supabase
          .from('invoices')
          .select('*')
          .eq('machine_id', id)
          .eq('company_id', company.id);

        if (invData) setInvoices(invData as Invoice[]);
      } catch (err) {
        console.error('Error loading machine detail:', err);
      } finally {
        setLoading(false);
      }
    };

    loadMachineDetail();
  }, [id, company?.id]);

  if (loading) {
    return <LoadingSpinner message="Loading machine history & financials..." size="lg" />;
  }

  if (!machine) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-bold text-slate-800">Machine Not Found</h3>
        <p className="text-xs text-slate-500 mt-1">This equipment may have been archived or deleted.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/machines')}>
          Back to Fleet
        </Button>
      </div>
    );
  }

  // Financial calculations
  const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.taxable_amount || 0), 0);
  const totalOpEx = expenses
    .filter((e) => e.expense_type === 'OpEx')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netMachineProfit = totalRevenue - totalOpEx;
  const roiPercent =
    machine.purchase_price > 0
      ? Math.round((netMachineProfit / Number(machine.purchase_price)) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* Back button & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/machines')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {machine.machine_name}
              </h2>
              <Badge
                variant={
                  machine.status === 'Available'
                    ? 'success'
                    : machine.status === 'Rented'
                    ? 'info'
                    : machine.status === 'Under Maintenance'
                    ? 'warning'
                    : 'danger'
                }
              >
                {machine.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              Asset ID: {machine.machine_id_code} | SN: {machine.serial_number} | Category:{' '}
              {machine.category?.name}
            </p>
          </div>
        </div>
      </div>

      {/* Machine Financial Profitability Snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Lifetime Revenue</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-blue-600">
            {formatCurrency(totalRevenue)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">From issued invoices</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Operational Expenses</span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {formatCurrency(totalOpEx)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Fuel, spares, repairs</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Machine Profit</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div
            className={`text-xl font-extrabold ${
              netMachineProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(netMachineProfit)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Revenue minus OpEx</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Capital ROI</span>
            <Clock className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">
            {roiPercent !== null ? `${roiPercent}%` : '—'}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Cost: {formatCurrency(machine.purchase_price)}
          </span>
        </Card>
      </div>

      {/* Specifications & Location Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 space-y-4">
          <CardHeader>
            <CardTitle>Equipment Specifications</CardTitle>
          </CardHeader>

          {machine.photo_url && (
            <div className="rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100 mb-4">
              <img
                src={machine.photo_url}
                alt={machine.machine_name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Brand / Make</span>
              <span className="font-semibold text-slate-900">{machine.brand}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Model</span>
              <span className="font-semibold text-slate-900">{machine.model}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Working Height</span>
              <span className="font-semibold text-slate-900">{machine.height_capacity}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Registration / RTO</span>
              <span className="font-semibold text-slate-900">{machine.registration_number || 'N/A'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Base Monthly Rate</span>
              <span className="font-bold text-slate-900">{formatCurrency(machine.monthly_rental_rate)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-500">Current Site / Yard</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {machine.current_location || 'Central Yard'}
              </span>
            </div>
            {machine.notes && (
              <div className="pt-2">
                <span className="text-slate-500 block mb-1">Asset Notes:</span>
                <p className="text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 leading-relaxed">
                  {machine.notes}
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Tabbed History: Rentals, Maintenance, Expenses */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rental History */}
          <Card>
            <CardHeader>
              <CardTitle>Rental Contracts & Deployment History</CardTitle>
            </CardHeader>
            {rentals.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No rental contracts logged for this machine yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Contract #</th>
                      <th className="py-2.5 px-3">Customer</th>
                      <th className="py-2.5 px-3">Site Location</th>
                      <th className="py-2.5 px-3">Rental Period</th>
                      <th className="py-2.5 px-3 text-right">Monthly Rate</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rentals.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-semibold text-blue-600">{r.rental_code}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{r.customer?.name}</td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[120px]">
                          {r.site_location}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {formatDate(r.start_date, 'dd MMM yyyy')} – {formatDate(r.expected_end_date, 'dd MMM yyyy')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(r.monthly_rental)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant={r.status === 'Active' ? 'success' : 'default'} size="sm">
                            {r.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Maintenance History */}
          <Card>
            <CardHeader>
              <CardTitle>Maintenance & Breakdown History</CardTitle>
            </CardHeader>
            {maintenanceRecords.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                No maintenance incidents or preventative servicings recorded.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Title / Description</th>
                      <th className="py-2.5 px-3">Downtime</th>
                      <th className="py-2.5 px-3 text-right">Repair Cost</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {maintenanceRecords.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500">{formatDate(m.start_date)}</td>
                        <td className="py-2.5 px-3">
                          <Badge variant={m.maintenance_type === 'Breakdown' ? 'danger' : 'purple'} size="sm">
                            {m.maintenance_type}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{m.title}</td>
                        <td className="py-2.5 px-3 text-slate-600">{m.downtime_hours || 0} hrs</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                          {formatCurrency(m.cost)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Badge variant={m.status === 'Completed' ? 'success' : 'warning'} size="sm">
                            {m.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
