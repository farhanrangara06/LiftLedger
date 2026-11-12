import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  CheckCircle,
  Clock,
  Wrench,
  Users,
  CalendarCheck,
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  Layers,
  FileText,
  Plus,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Machine, Invoice, Rental, Maintenance } from '@/types';

export const DashboardPage: React.FC = () => {
  const { company } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Metrics
  const [stats, setStats] = useState({
    totalMachines: 0,
    availableMachines: 0,
    rentedMachines: 0,
    maintenanceMachines: 0,
    totalCustomers: 0,
    activeRentals: 0,
    monthlyRevenue: 0,
    totalPayments: 0,
    outstandingAmount: 0,
    overdueInvoicesCount: 0,
    monthlyExpenses: 0,
    operatingProfit: 0,
  });

  // Recent records
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [activeRentalsList, setActiveRentalsList] = useState<Rental[]>([]);
  const [pendingMaintenance, setPendingMaintenance] = useState<Maintenance[]>([]);
  const [machineProfitabilityData, setMachineProfitabilityData] = useState<any[]>([]);
  const [complianceAlerts, setComplianceAlerts] = useState<
    { id: string; machine_name: string; machine_id_code: string; type: string; expiry_date: string; isExpired: boolean }[]
  >([]);

  useEffect(() => {
    if (!company?.id) return;

    const loadDashboardData = async () => {
      setLoading(true);
      try {
        const companyId = company.id;

        // 1. Machines stats
        const { data: machines } = await supabase
          .from('machines')
          .select('id, machine_name, machine_id_code, status, monthly_rental_rate, tpi_expiry_date, insurance_expiry_date, fitness_expiry_date')
          .eq('company_id', companyId)
          .eq('is_archived', false);

        const totalM = machines?.length || 0;
        const availableM = machines?.filter((m) => m.status === 'Available').length || 0;
        const rentedM = machines?.filter((m) => m.status === 'Rented').length || 0;
        const maintenanceM = machines?.filter((m) => m.status === 'Under Maintenance').length || 0;

        // Check TPI / Insurance / Fitness expiry within 30 days or already expired
        const todayDateStr = new Date().toISOString().split('T')[0];
        const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const alerts: { id: string; machine_name: string; machine_id_code: string; type: string; expiry_date: string; isExpired: boolean }[] = [];

        (machines || []).forEach((m: any) => {
          if (m.tpi_expiry_date && m.tpi_expiry_date <= in30DaysStr) {
            alerts.push({
              id: `${m.id}-tpi`,
              machine_name: m.machine_name,
              machine_id_code: m.machine_id_code,
              type: 'TPI (Form-10) Load Test',
              expiry_date: m.tpi_expiry_date,
              isExpired: m.tpi_expiry_date < todayDateStr,
            });
          }
          if (m.insurance_expiry_date && m.insurance_expiry_date <= in30DaysStr) {
            alerts.push({
              id: `${m.id}-ins`,
              machine_name: m.machine_name,
              machine_id_code: m.machine_id_code,
              type: 'Equipment Insurance',
              expiry_date: m.insurance_expiry_date,
              isExpired: m.insurance_expiry_date < todayDateStr,
            });
          }
          if (m.fitness_expiry_date && m.fitness_expiry_date <= in30DaysStr) {
            alerts.push({
              id: `${m.id}-fit`,
              machine_name: m.machine_name,
              machine_id_code: m.machine_id_code,
              type: 'RTO Fitness Certificate',
              expiry_date: m.fitness_expiry_date,
              isExpired: m.fitness_expiry_date < todayDateStr,
            });
          }
        });
        setComplianceAlerts(alerts);

        // 2. Customers count
        const { count: customerCount } = await supabase
          .from('customers')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', companyId)
          .eq('is_archived', false);

        // 3. Rentals
        const { data: rentals } = await supabase
          .from('rentals')
          .select('*, customer:customers(*), machine:machines(*)')
          .eq('company_id', companyId)
          .eq('status', 'Active')
          .order('start_date', { ascending: false });

        const activeRentalsCount = rentals?.length || 0;
        const monthlyRunRate = rentals?.reduce((sum, r) => sum + Number(r.monthly_rental || 0), 0) || 0;

        // 4. Invoices (Outstanding, Overdue, Recent)
        const { data: invoices } = await supabase
          .from('invoices')
          .select('*, customer:customers(*), machine:machines(*)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false });

        let outstanding = 0;
        let overdueCount = 0;
        const today = new Date().toISOString().split('T')[0];

        (invoices || []).forEach((inv) => {
          if (inv.status !== 'Paid' && inv.status !== 'Cancelled') {
            outstanding += Number(inv.balance_due || 0);
            if (inv.due_date < today) {
              overdueCount += 1;
            }
          }
        });

        // 5. Total Payments Collected
        const { data: payments } = await supabase
          .from('payments')
          .select('amount, is_reversal')
          .eq('company_id', companyId);

        const totalCollected = (payments || []).reduce((sum, p) => {
          return p.is_reversal ? sum - Number(p.amount) : sum + Number(p.amount);
        }, 0);

        // 6. Expenses this month (OpEx)
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split('T')[0];

        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount, expense_type, date, machine_id')
          .eq('company_id', companyId)
          .gte('date', startOfMonth);

        const monthlyExpensesTotal = (expenses || [])
          .filter((e) => e.expense_type === 'OpEx')
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);

        // Operating profit = Active monthly rental revenue - OpEx
        const operatingProfitEst = monthlyRunRate - monthlyExpensesTotal;

        setStats({
          totalMachines: totalM,
          availableMachines: availableM,
          rentedMachines: rentedM,
          maintenanceMachines: maintenanceM,
          totalCustomers: customerCount || 0,
          activeRentals: activeRentalsCount,
          monthlyRevenue: monthlyRunRate,
          totalPayments: totalCollected,
          outstandingAmount: outstanding,
          overdueInvoicesCount: overdueCount,
          monthlyExpenses: monthlyExpensesTotal,
          operatingProfit: operatingProfitEst,
        });

        setRecentInvoices((invoices || []).slice(0, 5));
        setActiveRentalsList((rentals || []).slice(0, 5));

        // 7. Maintenance pending
        const { data: maint } = await supabase
          .from('maintenance')
          .select('*, machine:machines(*)')
          .eq('company_id', companyId)
          .in('status', ['Scheduled', 'In Progress'])
          .order('start_date', { ascending: true })
          .limit(4);

        setPendingMaintenance(maint || []);

        // 8. Machine Profitability Calculation
        if (machines && machines.length > 0) {
          // Machine wise income from invoices and expenses
          const { data: allMachineInvoices } = await supabase
            .from('invoices')
            .select('machine_id, taxable_amount')
            .eq('company_id', companyId)
            .not('machine_id', 'is', null);

          const { data: allMachineExpenses } = await supabase
            .from('expenses')
            .select('machine_id, amount')
            .eq('company_id', companyId)
            .not('machine_id', 'is', null);

          const profitData = machines.slice(0, 6).map((m) => {
            const rev = (allMachineInvoices || [])
              .filter((inv) => inv.machine_id === m.id)
              .reduce((s, inv) => s + Number(inv.taxable_amount || 0), 0);

            const exp = (allMachineExpenses || [])
              .filter((e) => e.machine_id === m.id)
              .reduce((s, e) => s + Number(e.amount || 0), 0);

            return {
              name: m.machine_name.length > 15 ? m.machine_name.substring(0, 15) + '...' : m.machine_name,
              Revenue: rev,
              Expenses: exp,
              Profit: rev - exp,
            };
          });

          setMachineProfitabilityData(profitData);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, [company?.id]);

  if (loading) {
    return <LoadingSpinner message="Calculating real-time fleet analytics & revenue..." size="lg" />;
  }

  // Machine status pie chart data
  const machinePieData = [
    { name: 'Available', value: stats.availableMachines, color: '#10b981' },
    { name: 'Rented', value: stats.rentedMachines, color: '#2563eb' },
    { name: 'Under Maintenance', value: stats.maintenanceMachines, color: '#f59e0b' },
  ].filter((d) => d.value > 0);

  // Financial comparative bar chart data
  const financialBarData = [
    { name: 'Monthly Run Rate', amount: stats.monthlyRevenue, fill: '#2563eb' },
    { name: 'Collections (Total)', amount: stats.totalPayments, fill: '#10b981' },
    { name: 'Monthly Expenses', amount: stats.monthlyExpenses, fill: '#ef4444' },
    { name: 'Outstanding Due', amount: stats.outstandingAmount, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl border border-slate-700/60">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
            Commercial Fleet Management
          </span>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-1">
            {company?.name || 'Boom Lift Fleet Operations'}
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Live fleet availability, monthly billing run-rate, and maintenance status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/machines')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Boom Lift
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-white border-slate-600 hover:bg-slate-700"
            onClick={() => navigate('/invoices')}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Create GST Invoice
          </Button>
        </div>
      </div>

      {/* 12 Key Business KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {/* Total Machines */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/machines')}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Fleet</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalMachines}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Registered high-reach lifts</span>
        </Card>

        {/* Available Machines */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/machines?status=Available')}>
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-emerald-600">{stats.availableMachines}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Ready for deployment</span>
        </Card>

        {/* Rented Machines */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/rentals')}>
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Rented Out</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-600">{stats.rentedMachines}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {stats.totalMachines > 0
              ? `${Math.round((stats.rentedMachines / stats.totalMachines) * 100)}% utilization`
              : '0% utilization'}
          </span>
        </Card>

        {/* Maintenance */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/maintenance')}>
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Maintenance</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-amber-600">{stats.maintenanceMachines}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">In repair / inspection</span>
        </Card>

        {/* Active Rentals */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/rentals')}>
          <div className="flex items-center justify-between text-indigo-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Rentals</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.activeRentals}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Ongoing customer contracts</span>
        </Card>

        {/* Total Customers */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/customers')}>
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Clients</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{stats.totalCustomers}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Companies in CRM</span>
        </Card>

        {/* Monthly Rental Revenue */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/reports')}>
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly Run Rate</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-emerald-600 truncate">
            {formatCurrency(stats.monthlyRevenue)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Active rental billings</span>
        </Card>

        {/* Payments Collected */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/payments')}>
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 truncate">
            {formatCurrency(stats.totalPayments)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Lifetime bank & cash</span>
        </Card>

        {/* Outstanding Amount */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/invoices')}>
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Due</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-amber-600 truncate">
            {formatCurrency(stats.outstandingAmount)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Unpaid invoice balances</span>
        </Card>

        {/* Overdue Invoices */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/invoices?status=Overdue')}>
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Overdue Invoices</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{stats.overdueInvoicesCount}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Exceeded payment due date</span>
        </Card>

        {/* Monthly Expenses */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/expenses')}>
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Monthly OpEx</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-slate-900 truncate">
            {formatCurrency(stats.monthlyExpenses)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Fuel, spares & operations</span>
        </Card>

        {/* Estimated Operating Profit */}
        <Card hoverable className="cursor-pointer" onClick={() => navigate('/reports')}>
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operating Profit</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div
            className={`text-xl font-extrabold truncate ${
              stats.operatingProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {formatCurrency(stats.operatingProfit)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Monthly Revenue − OpEx</span>
        </Card>
      </div>

      {/* Analytics Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Machine Utilization Status */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Fleet Utilization Status</CardTitle>
          </CardHeader>
          <div className="h-64 flex items-center justify-center">
            {machinePieData.length === 0 ? (
              <div className="text-center text-xs text-slate-400">
                No machines added yet. Register machines in Fleet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={machinePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {machinePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Financial Flow Overview */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Financial Cashflow & Exposure Overview</CardTitle>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={financialBarData} margin={{ top: 10, right: 10, left: 0, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Amount']} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tables Row: Recent Invoices & Active Rentals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent GST Invoices</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/invoices')}>
              View All
            </Button>
          </CardHeader>
          {recentInvoices.length === 0 ? (
            <EmptyState
              title="No Invoices Yet"
              description="Generate your first GST rental invoice to start tracking payments."
              actionLabel="Create Invoice"
              onAction={() => navigate('/invoices')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Customer</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Grand Total</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      onClick={() => navigate('/invoices')}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-semibold text-blue-600">
                        {inv.invoice_number}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 truncate max-w-[120px]">
                        {inv.customer_snapshot?.name || inv.customer?.name || 'Customer'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.due_date)}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(inv.grand_total)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Badge
                          variant={
                            inv.status === 'Paid'
                              ? 'success'
                              : inv.status === 'Overdue'
                              ? 'danger'
                              : inv.status === 'Partially Paid'
                              ? 'warning'
                              : 'default'
                          }
                          size="sm"
                        >
                          {inv.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Active Rentals */}
        <Card>
          <CardHeader>
            <CardTitle>Active Equipment Deployments</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/rentals')}>
              View All
            </Button>
          </CardHeader>
          {activeRentalsList.length === 0 ? (
            <EmptyState
              title="No Active Deployments"
              description="Deploy a boom lift to a customer worksite to start earning rental income."
              actionLabel="New Rental Contract"
              onAction={() => navigate('/rentals')}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Machine</th>
                    <th className="py-2.5 px-3">Customer & Site</th>
                    <th className="py-2.5 px-3">Period</th>
                    <th className="py-2.5 px-3 text-right">Monthly Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {activeRentalsList.map((rent) => (
                    <tr
                      key={rent.id}
                      onClick={() => navigate('/rentals')}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 block truncate max-w-[130px]">
                          {rent.machine?.machine_name || 'Machine'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {rent.machine?.machine_id_code}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-800 block truncate max-w-[130px]">
                          {rent.customer?.name || 'Customer'}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px] block">
                          {rent.site_location}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {formatDate(rent.start_date, 'dd MMM')} – {formatDate(rent.expected_end_date, 'dd MMM')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                        {formatCurrency(rent.monthly_rental)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Statutory TPI & Insurance Compliance Alerts */}
      {complianceAlerts.length > 0 && (
        <Card className="border-rose-200 bg-rose-50/40">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <CardTitle className="text-rose-950">
                Statutory Site Safety (TPI Form-10) & Insurance Expiry Alerts ({complianceAlerts.length})
              </CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/machines')}>
              Update Certificates
            </Button>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {complianceAlerts.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate('/machines')}
                className="p-3.5 bg-white rounded-xl border border-rose-200/80 shadow-xs cursor-pointer hover:border-rose-400 transition-colors"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant={item.isExpired ? 'danger' : 'warning'} size="sm">
                    {item.isExpired ? 'EXPIRED' : 'EXPIRING SOON'}
                  </Badge>
                  <span className="text-[11px] font-bold text-slate-600">
                    {formatDate(item.expiry_date)}
                  </span>
                </div>
                <h5 className="text-xs font-bold text-slate-900">{item.type}</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Machine: <span className="font-semibold text-slate-800">{item.machine_name}</span> ({item.machine_id_code})
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Maintenance Alerts */}
      {pendingMaintenance.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <CardTitle className="text-amber-900">Upcoming Equipment Health & Maintenance Alerts</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate('/maintenance')}>
              Maintenance Log
            </Button>
          </CardHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {pendingMaintenance.map((m) => (
              <div key={m.id} className="p-3.5 bg-white rounded-xl border border-amber-200/80 shadow-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <Badge variant={m.priority === 'Critical' ? 'danger' : 'warning'} size="sm">
                    {m.priority}
                  </Badge>
                  <span className="text-[11px] text-slate-400">{formatDate(m.start_date)}</span>
                </div>
                <h5 className="text-xs font-bold text-slate-900">{m.title}</h5>
                <p className="text-[11px] text-slate-500 mt-1">
                  Machine: <span className="font-semibold text-slate-700">{m.machine?.machine_name}</span>
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
