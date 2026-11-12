import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown,
  Plus,
  Search,
  Filter,
  DollarSign,
  Truck,
  Fuel,
  Wrench,
  Receipt,
  Download,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelExport';
import { Expense, Machine, ExpenseCategory, ExpenseType } from '@/types';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Diesel/Fuel',
  'Transportation',
  'Repairs',
  'Maintenance',
  'Operator Salary',
  'Employee Salary',
  'Insurance',
  'Permit and Registration',
  'Spare Parts',
  'Office Expenses',
  'Bank Charges',
  'Capital Expenditure',
  'Loan Interest',
  'Loan Principal',
  'Other',
];

export const ExpensesPage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [machineFilter, setMachineFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<ExpenseCategory>('Diesel/Fuel');
  const [formType, setFormType] = useState<ExpenseType>('OpEx');
  const [formMachineId, setFormMachineId] = useState('');
  const [formVendor, setFormVendor] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formGstAmount, setFormGstAmount] = useState('0');
  const [formPaymentMode, setFormPaymentMode] = useState('Bank Transfer');
  const [formReceiptUrl, setFormReceiptUrl] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadExpenses = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: expData } = await supabase
        .from('expenses')
        .select('*, machine:machines(*)')
        .eq('company_id', company.id)
        .order('date', { ascending: false });

      if (expData) setExpenses(expData as Expense[]);

      const { data: machData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false);

      if (machData) setMachines(machData as Machine[]);
    } catch (err) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [company?.id]);

  // Auto-set ExpenseType based on Category to strictly respect accounting standards
  useEffect(() => {
    if (formCategory === 'Capital Expenditure') {
      setFormType('CapEx');
    } else if (formCategory === 'Loan Principal') {
      setFormType('Loan Principal');
    } else if (formCategory === 'Loan Interest') {
      setFormType('Loan Interest');
    } else {
      setFormType('OpEx');
    }
  }, [formCategory]);

  const handleOpenAddModal = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory('Diesel/Fuel');
    setFormType('OpEx');
    setFormMachineId('');
    setFormVendor('');
    setFormDescription('');
    setFormAmount('');
    setFormGstAmount('0');
    setFormPaymentMode('Bank Transfer');
    setFormReceiptUrl('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    const amountNum = Number(formAmount) || 0;
    if (amountNum <= 0) {
      addToast('Please enter a valid expense amount.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        date: formDate,
        category: formCategory,
        expense_type: formType,
        machine_id: formMachineId || null,
        vendor: formVendor || null,
        description: formDescription,
        amount: amountNum,
        gst_amount: Number(formGstAmount) || 0,
        payment_mode: formPaymentMode,
        receipt_url: formReceiptUrl || null,
        notes: formNotes || null,
      };

      const { error } = await supabase.from('expenses').insert(payload);
      if (error) throw error;

      addToast('Expense recorded successfully.', 'success');
      setIsModalOpen(false);
      loadExpenses();
    } catch (err: any) {
      console.error('Error saving expense:', err);
      addToast(err.message || 'Failed to save expense.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const data = filteredExpenses.map((e) => ({
      Date: formatDate(e.date),
      Category: e.category,
      Type: e.expense_type,
      Machine: e.machine?.machine_name || 'General Fleet',
      Vendor: e.vendor || '—',
      Description: e.description,
      'Amount (INR)': e.amount,
      'GST (INR)': e.gst_amount,
      Mode: e.payment_mode,
    }));
    exportToExcel(data, `Expenses_${company?.name || 'LiftLedger'}`);
    addToast('Expenses exported to Excel successfully.', 'success');
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        e.description.toLowerCase().includes(s) ||
        (e.vendor && e.vendor.toLowerCase().includes(s)) ||
        (e.machine?.machine_name && e.machine.machine_name.toLowerCase().includes(s));

      const matchesCat = categoryFilter === 'ALL' || e.category === categoryFilter;
      const matchesType = typeFilter === 'ALL' || e.expense_type === typeFilter;
      const matchesMach = machineFilter === 'ALL' || e.machine_id === machineFilter;

      return matchesSearch && matchesCat && matchesType && matchesMach;
    });
  }, [expenses, searchTerm, categoryFilter, typeFilter, machineFilter]);

  // Totals
  const totalOpEx = expenses
    .filter((e) => e.expense_type === 'OpEx')
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalCapEx = expenses
    .filter((e) => e.expense_type === 'CapEx')
    .reduce((s, e) => s + Number(e.amount), 0);

  const totalLoanRepayments = expenses
    .filter((e) => e.expense_type === 'Loan Principal' || e.expense_type === 'Loan Interest')
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Fleet & Operational Expenses</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log fuel, spare parts, machine repairs, driver salaries, and strictly isolate OpEx from CapEx/Loan EMI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel} leftIcon={<Download className="w-4 h-4" />}>
            Export Excel
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenAddModal} leftIcon={<Plus className="w-4 h-4" />}>
            Record Expense
          </Button>
        </div>
      </div>

      {/* Accounting Distinction KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-rose-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Operational OpEx (P&L Deduction)
            </span>
            <TrendingDown className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{formatCurrency(totalOpEx)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Diesel, repairs, operator wages</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Capital Expenditure (CapEx)
            </span>
            <Truck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(totalCapEx)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">New lift purchase, major retrofits</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Loan Repayments / Principal
            </span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{formatCurrency(totalLoanRepayments)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Principal does not hit P&L expense</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <Input
            placeholder="Search description, vendor, machine..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Accounting Types' },
              { value: 'OpEx', label: 'Operating Expense (OpEx)' },
              { value: 'CapEx', label: 'Capital Expense (CapEx)' },
              { value: 'Loan Principal', label: 'Loan Principal (Balance Sheet)' },
              { value: 'Loan Interest', label: 'Loan Interest' },
            ]}
          />

          <Select
            value={machineFilter}
            onChange={(e) => setMachineFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Machines' },
              ...machines.map((m) => ({ value: m.id, label: m.machine_name })),
            ]}
          />
        </div>
      </Card>

      {/* Expenses Table */}
      {loading ? (
        <LoadingSpinner message="Loading expense journal..." />
      ) : filteredExpenses.length === 0 ? (
        <EmptyState
          icon={<TrendingDown className="w-8 h-8" />}
          title="No Expenses Recorded"
          description="Record fuel purchases, equipment maintenance bills, or yard operations."
          actionLabel="+ Record Expense"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Machine Attributed</th>
                  <th className="py-3.5 px-4">Vendor & Description</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExpenses.map((e) => (
                  <tr key={e.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {formatDate(e.date)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {e.category}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          e.expense_type === 'OpEx'
                            ? 'warning'
                            : e.expense_type === 'CapEx'
                            ? 'info'
                            : 'purple'
                        }
                        size="sm"
                      >
                        {e.expense_type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4">
                      {e.machine ? (
                        <span className="font-semibold text-blue-600">
                          {e.machine.machine_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">General / Yard Overhead</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800 block truncate max-w-[200px]">
                        {e.description}
                      </span>
                      {e.vendor && (
                        <span className="text-[10px] text-slate-400">
                          Vendor: {e.vendor}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{e.payment_mode}</td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Expense Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Fleet or Operational Expense"
        description="Attribute expense to specific boom lift or general operating cost"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Expense Date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <Select
              label="Expense Category"
              required
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value as any)}
              options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />

            <Select
              label="Accounting Classification"
              required
              value={formType}
              onChange={(e) => setFormType(e.target.value as any)}
              options={[
                { value: 'OpEx', label: 'OpEx (Fuel, repairs, parts, salaries)' },
                { value: 'CapEx', label: 'CapEx (Machine purchase / Asset addition)' },
                { value: 'Loan Principal', label: 'Loan Principal (Balance sheet reduction)' },
                { value: 'Loan Interest', label: 'Loan Interest (Financial charge)' },
              ]}
              helperText="Full EMI should NOT be booked as P&L expense."
            />

            <Select
              label="Attribute to Boom Lift (Optional)"
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
              options={[
                { value: '', label: '-- None (General Overhead / Yard) --' },
                ...machines.map((m) => ({ value: m.id, label: m.machine_name })),
              ]}
            />

            <Input
              label="Vendor / Supplier / Fuel Pump"
              placeholder="e.g. Indian Oil / Cummins Spare Parts"
              value={formVendor}
              onChange={(e) => setFormVendor(e.target.value)}
            />

            <Input
              label="Payment Mode"
              value={formPaymentMode}
              onChange={(e) => setFormPaymentMode(e.target.value)}
            />

            <Input
              label="Total Amount (INR)"
              type="number"
              required
              placeholder="e.g. 18500"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <Input
              label="GST Amount Included (INR)"
              type="number"
              placeholder="e.g. 2800"
              value={formGstAmount}
              onChange={(e) => setFormGstAmount(e.target.value)}
              helperText="For GST Input Tax Credit (ITC) reconciliation"
            />

            <div className="sm:col-span-2">
              <Input
                label="Expense Description"
                required
                placeholder="e.g. 200L High-speed diesel filled for site DG & boom lift operations."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Internal Remarks / V/R No."
                placeholder="e.g. Bill # 4983 signed by site operator."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Record Expense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
