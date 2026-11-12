import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Layers,
  FileSpreadsheet,
  Receipt,
  Users,
  Truck,
  CheckCircle2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToExcel, exportToCSV } from '@/lib/excelExport';
import { Invoice, Payment, Expense, Machine, Customer, Rental } from '@/types';

export const ReportsPage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'GST' | 'MACHINE_PROFIT' | 'CUSTOMER_LEDGER' | 'MONTHLY_PL'>('GST');
  const [loading, setLoading] = useState(true);

  // Raw database records
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Date filters
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!company?.id) return;
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [invRes, payRes, expRes, machRes, custRes] = await Promise.all([
          supabase
            .from('invoices')
            .select('*, customer:customers(*), machine:machines(*)')
            .eq('company_id', company.id)
            .gte('invoice_date', startDate)
            .lte('invoice_date', endDate),
          supabase
            .from('payments')
            .select('*, customer:customers(*)')
            .eq('company_id', company.id)
            .gte('payment_date', startDate)
            .lte('payment_date', endDate),
          supabase
            .from('expenses')
            .select('*, machine:machines(*)')
            .eq('company_id', company.id)
            .gte('date', startDate)
            .lte('date', endDate),
          supabase
            .from('machines')
            .select('*')
            .eq('company_id', company.id)
            .eq('is_archived', false),
          supabase
            .from('customers')
            .select('*')
            .eq('company_id', company.id)
            .eq('is_archived', false),
        ]);

        if (invRes.data) setInvoices(invRes.data as Invoice[]);
        if (payRes.data) setPayments(payRes.data as Payment[]);
        if (expRes.data) setExpenses(expRes.data as Expense[]);
        if (machRes.data) setMachines(machRes.data as Machine[]);
        if (custRes.data) setCustomers(custRes.data as Customer[]);
      } catch (err) {
        console.error('Reports load error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [company?.id, startDate, endDate]);

  // 1. GST Summary Totals
  const gstSummary = useMemo(() => {
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    let totalTax = 0;
    let invoiceCount = 0;

    invoices.forEach((inv) => {
      if (inv.status !== 'Cancelled') {
        taxable += Number(inv.taxable_amount || 0);
        cgst += Number(inv.cgst_amount || 0);
        sgst += Number(inv.sgst_amount || 0);
        igst += Number(inv.igst_amount || 0);
        totalTax += Number(inv.cgst_amount || 0) + Number(inv.sgst_amount || 0) + Number(inv.igst_amount || 0);
        invoiceCount += 1;
      }
    });

    return { taxable, cgst, sgst, igst, totalTax, invoiceCount };
  }, [invoices]);

  // 2. Machine Profitability Analysis
  const machineProfitability = useMemo(() => {
    return machines.map((m) => {
      const machInvoices = invoices.filter((i) => i.machine_id === m.id && i.status !== 'Cancelled');
      const machRevenue = machInvoices.reduce((s, i) => s + Number(i.taxable_amount || 0), 0);

      const machExpenses = expenses.filter((e) => e.machine_id === m.id && e.expense_type === 'OpEx');
      const machOpEx = machExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

      const netProfit = machRevenue - machOpEx;
      const profitMargin = machRevenue > 0 ? Math.round((netProfit / machRevenue) * 100) : 0;

      return {
        id: m.id,
        name: m.machine_name,
        code: m.machine_id_code,
        category: m.brand + ' ' + m.model,
        revenue: machRevenue,
        expenses: machOpEx,
        profit: netProfit,
        margin: profitMargin,
      };
    });
  }, [machines, invoices, expenses]);

  // 3. Customer-wise Revenue and Outstanding
  const customerBreakdown = useMemo(() => {
    return customers.map((c) => {
      const custInvoices = invoices.filter((i) => i.customer_id === c.id && i.status !== 'Cancelled');
      const invoiced = custInvoices.reduce((s, i) => s + Number(i.grand_total || 0), 0);
      const balance = custInvoices.reduce((s, i) => s + Number(i.balance_due || 0), 0);

      const custPayments = payments.filter((p) => p.customer_id === c.id && !p.is_reversal);
      const collected = custPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const tds = custPayments.reduce((s, p) => s + Number(p.tds_deducted || 0), 0);

      return {
        id: c.id,
        name: c.name,
        gstin: c.gstin || 'Unregistered',
        city: c.city,
        invoiced,
        collected,
        tds,
        balance,
      };
    });
  }, [customers, invoices, payments]);

  // Export handlers
  const handleExportCurrentTab = (type: 'EXCEL' | 'CSV') => {
    let dataToExport: any[] = [];
    let reportName = 'Report';

    if (activeTab === 'GST') {
      reportName = 'GST_GSTR1_Summary';
      dataToExport = invoices.map((i) => ({
        'Invoice #': i.invoice_number,
        'Date': formatDate(i.invoice_date),
        'Customer': i.customer_snapshot?.name || i.customer?.name,
        'Customer GSTIN': i.customer_snapshot?.gstin || 'Unregistered',
        'Place of Supply': i.customer_snapshot?.state,
        'Interstate': i.is_interstate ? 'YES (IGST)' : 'NO (CGST+SGST)',
        'Taxable Amount': i.taxable_amount,
        'CGST': i.cgst_amount,
        'SGST': i.sgst_amount,
        'IGST': i.igst_amount,
        'Grand Total': i.grand_total,
      }));
    } else if (activeTab === 'MACHINE_PROFIT') {
      reportName = 'Machine_Wise_Profitability';
      dataToExport = machineProfitability.map((m) => ({
        'Machine': m.name,
        'ID': m.code,
        'Model': m.category,
        'Revenue (INR)': m.revenue,
        'Operational Expenses (INR)': m.expenses,
        'Net Operating Profit (INR)': m.profit,
        'Profit Margin %': m.margin + '%',
      }));
    } else if (activeTab === 'CUSTOMER_LEDGER') {
      reportName = 'Customer_Revenue_and_Outstanding';
      dataToExport = customerBreakdown.map((c) => ({
        'Customer': c.name,
        'GSTIN': c.gstin,
        'City': c.city,
        'Total Invoiced': c.invoiced,
        'Collections Received': c.collected,
        'TDS Deducted': c.tds,
        'Outstanding Balance': c.balance,
      }));
    }

    if (type === 'EXCEL') {
      exportToExcel(dataToExport, `${reportName}_${startDate}_to_${endDate}`);
      addToast('Exported report to Excel.', 'success');
    } else {
      exportToCSV(dataToExport, `${reportName}_${startDate}_to_${endDate}`);
      addToast('Exported report to CSV.', 'success');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Financial Reports & Profitability</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready GST liabilities, machine-level returns, customer receivables, and cashflow reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExportCurrentTab('CSV')}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export CSV
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleExportCurrentTab('EXCEL')}
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Export Excel
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              Reporting Period:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              />
              <span className="text-xs text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const now = new Date();
                setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
                setEndDate(now.toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              This Month
            </button>
            <button
              onClick={() => {
                setStartDate(`${currentYear}-04-01`); // Indian FY start
                setEndDate(new Date().toISOString().split('T')[0]);
              }}
              className="px-2.5 py-1 text-xs font-medium rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              Current FY
            </button>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('GST')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'GST'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Receipt className="w-4 h-4" />
          GST Summary (GSTR-1 Ready)
        </button>
        <button
          onClick={() => setActiveTab('MACHINE_PROFIT')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'MACHINE_PROFIT'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Truck className="w-4 h-4" />
          Machine-wise Profitability & OpEx
        </button>
        <button
          onClick={() => setActiveTab('CUSTOMER_LEDGER')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'CUSTOMER_LEDGER'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Customer Revenue & Outstanding
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Calculating financial aggregates & tax figures..." />
      ) : (
        <>
          {/* ================= TAB 1: GST SUMMARY ================= */}
          {activeTab === 'GST' && (
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Taxable Turnover
                  </span>
                  <div className="text-2xl font-extrabold text-slate-900">
                    {formatCurrency(gstSummary.taxable)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Across {gstSummary.invoiceCount} issued invoices
                  </span>
                </Card>

                <Card>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                    CGST Liability
                  </span>
                  <div className="text-2xl font-extrabold text-blue-600">
                    {formatCurrency(gstSummary.cgst)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Central GST component</span>
                </Card>

                <Card>
                  <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider block mb-1">
                    SGST Liability
                  </span>
                  <div className="text-2xl font-extrabold text-blue-600">
                    {formatCurrency(gstSummary.sgst)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">State GST component</span>
                </Card>

                <Card>
                  <span className="text-xs font-semibold text-purple-600 uppercase tracking-wider block mb-1">
                    IGST Liability
                  </span>
                  <div className="text-2xl font-extrabold text-purple-600">
                    {formatCurrency(gstSummary.igst)}
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1 block">Inter-state sales component</span>
                </Card>
              </div>

              {/* Total GST Liability Callout */}
              <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold">Total Gross GST Output Liability</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consult with your Chartered Accountant for monthly GSTR-3B offset against input tax credit (ITC).
                  </p>
                </div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {formatCurrency(gstSummary.totalTax)}
                </div>
              </div>

              {/* Invoices GST Breakup Table */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Customer & GSTIN</th>
                        <th className="py-3 px-4 text-center">Interstate</th>
                        <th className="py-3 px-4 text-right">Taxable</th>
                        <th className="py-3 px-4 text-right">CGST</th>
                        <th className="py-3 px-4 text-right">SGST</th>
                        <th className="py-3 px-4 text-right">IGST</th>
                        <th className="py-3 px-4 text-right">Invoice Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70">
                          <td className="py-3 px-4 font-bold text-blue-600">{inv.invoice_number}</td>
                          <td className="py-3 px-4 text-slate-600">{formatDate(inv.invoice_date)}</td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-800 block">
                              {inv.customer_snapshot?.name || inv.customer?.name}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {inv.customer_snapshot?.gstin || 'Unregistered'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {inv.is_interstate ? (
                              <Badge variant="purple" size="sm">
                                IGST
                              </Badge>
                            ) : (
                              <Badge variant="info" size="sm">
                                CGST+SGST
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-medium text-slate-700">
                            {formatCurrency(inv.taxable_amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(inv.cgst_amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-slate-600">
                            {formatCurrency(inv.sgst_amount)}
                          </td>
                          <td className="py-3 px-4 text-right text-purple-700 font-semibold">
                            {formatCurrency(inv.igst_amount)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(inv.grand_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: MACHINE-WISE PROFITABILITY ================= */}
          {activeTab === 'MACHINE_PROFIT' && (
            <div className="space-y-6 animate-fade-in">
              {/* Profitability Bar Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Fleet Asset Profitability Comparison (Revenue vs OpEx)</CardTitle>
                </CardHeader>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={machineProfitability} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `₹${val / 1000}k`} />
                      <Tooltip formatter={(value: any) => [formatCurrency(Number(value)), 'Amount']} />
                      <Legend />
                      <Bar dataKey="revenue" name="Rental Revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="expenses" name="Operational OpEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Net Operating Profit" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Machine Profitability Table */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-3.5 px-4">Boom Lift & ID</th>
                        <th className="py-3.5 px-4">Brand / Model</th>
                        <th className="py-3.5 px-4 text-right">Rental Revenue</th>
                        <th className="py-3.5 px-4 text-right">Operational OpEx</th>
                        <th className="py-3.5 px-4 text-right">Net Operating Profit</th>
                        <th className="py-3.5 px-4 text-center">Operating Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {machineProfitability.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-900 block">{m.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono">ID: {m.code}</span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">{m.category}</td>
                          <td className="py-3.5 px-4 text-right font-medium text-blue-600">
                            {formatCurrency(m.revenue)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-rose-600">
                            {formatCurrency(m.expenses)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold">
                            <span className={m.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {formatCurrency(m.profit)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                m.margin >= 40
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : m.margin >= 10
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {m.margin}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: CUSTOMER REVENUE & OUTSTANDING ================= */}
          {activeTab === 'CUSTOMER_LEDGER' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                      <tr>
                        <th className="py-3.5 px-4">Customer Enterprise</th>
                        <th className="py-3.5 px-4">GSTIN & Location</th>
                        <th className="py-3.5 px-4 text-right">Total Invoiced</th>
                        <th className="py-3.5 px-4 text-right">Collections Received</th>
                        <th className="py-3.5 px-4 text-right">TDS Withheld</th>
                        <th className="py-3.5 px-4 text-right">Balance Outstanding</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {customerBreakdown.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-50/70">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{c.name}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono text-slate-700 block">{c.gstin}</span>
                            <span className="text-[10px] text-slate-400">{c.city}</span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-slate-800">
                            {formatCurrency(c.invoiced)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                            {formatCurrency(c.collected)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-purple-700">
                            {formatCurrency(c.tds)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold">
                            <span className={c.balance > 0 ? 'text-amber-600' : 'text-slate-400'}>
                              {formatCurrency(c.balance)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
