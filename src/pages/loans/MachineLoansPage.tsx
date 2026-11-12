import React, { useState, useEffect, useMemo } from 'react';
import {
  Landmark,
  Plus,
  Edit,
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
import { MachineLoan, LoanEmiPayment, Machine } from '@/types';

export const MachineLoansPage: React.FC = () => {
  const { company, user } = useAuth();
  const { addToast } = useNotification();

  const [loans, setLoans] = useState<MachineLoan[]>([]);
  const [emiHistory, setEmiHistory] = useState<LoanEmiPayment[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit Loan Modal
  const [isLoanModalOpen, setIsLoanModalOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<MachineLoan | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formMachineId, setFormMachineId] = useState('');
  const [formLenderName, setFormLenderName] = useState('HDFC Bank Equipment Finance');
  const [formAccountNumber, setFormAccountNumber] = useState('');
  const [formLoanAmount, setFormLoanAmount] = useState('3500000');
  const [formInterestRate, setFormInterestRate] = useState('9.5');
  const [formTenureMonths, setFormTenureMonths] = useState('48');
  const [formEmiAmount, setFormEmiAmount] = useState('87930');
  const [formEmiDueDay, setFormEmiDueDay] = useState('5');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<MachineLoan['status']>('Active');
  const [formNotes, setFormNotes] = useState('');

  // Record Monthly EMI Payment Modal
  const [isEmiModalOpen, setIsEmiModalOpen] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<MachineLoan | null>(null);
  const [emiDate, setEmiDate] = useState(new Date().toISOString().split('T')[0]);
  const [emiTotal, setEmiTotal] = useState('0');
  const [emiPrincipal, setEmiPrincipal] = useState('0');
  const [emiInterest, setEmiInterest] = useState('0');
  const [emiMode, setEmiMode] = useState('Bank Transfer');
  const [emiRef, setEmiRef] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [loansRes, emiRes, machRes] = await Promise.all([
        supabase
          .from('machine_loans')
          .select('*, machine:machines(*)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('loan_emi_payments')
          .select('*, loan:machine_loans(*), machine:machines(*)')
          .eq('company_id', company.id)
          .order('payment_date', { ascending: false }),
        supabase
          .from('machines')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
      ]);

      if (loansRes.data) setLoans(loansRes.data as MachineLoan[]);
      if (emiRes.data) setEmiHistory(emiRes.data as LoanEmiPayment[]);
      if (machRes.data) setMachines(machRes.data as Machine[]);
    } catch (err) {
      console.error('Error loading machine loans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Auto-calculate standard monthly EMI when principal, rate, or tenure changes
  const recalculateStandardEmi = (principalStr: string, rateStr: string, monthsStr: string) => {
    const P = Number(principalStr) || 0;
    const annualRate = Number(rateStr) || 0;
    const n = Number(monthsStr) || 1;
    if (P <= 0 || n <= 0) return;
    if (annualRate <= 0) {
      setFormEmiAmount(String(Math.round(P / n)));
      return;
    }
    const r = annualRate / 12 / 100;
    const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    setFormEmiAmount(String(Math.round(emi)));
  };

  const handleOpenAddLoan = () => {
    if (machines.length === 0) {
      addToast('Please register at least one Boom Lift in Fleet before adding a machine loan.', 'warning');
      return;
    }
    setEditingLoan(null);
    setFormMachineId(machines[0]?.id || '');
    setFormLenderName('HDFC Bank Equipment Finance');
    setFormAccountNumber(`LAN-${Math.floor(100000 + Math.random() * 900000)}`);
    setFormLoanAmount('3500000');
    setFormInterestRate('9.5');
    setFormTenureMonths('48');
    setFormEmiAmount('87930');
    setFormEmiDueDay('5');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormStatus('Active');
    setFormNotes('');
    setIsLoanModalOpen(true);
  };

  const handleOpenEditLoan = (loan: MachineLoan) => {
    setEditingLoan(loan);
    setFormMachineId(loan.machine_id);
    setFormLenderName(loan.lender_name);
    setFormAccountNumber(loan.loan_account_number);
    setFormLoanAmount(String(loan.loan_amount));
    setFormInterestRate(String(loan.interest_rate_pa));
    setFormTenureMonths(String(loan.tenure_months));
    setFormEmiAmount(String(loan.emi_amount));
    setFormEmiDueDay(String(loan.emi_due_day || 5));
    setFormStartDate(loan.start_date);
    setFormStatus(loan.status);
    setFormNotes(loan.notes || '');
    setIsLoanModalOpen(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formMachineId) {
      addToast('Please select the financed Boom Lift.', 'warning');
      return;
    }

    const loanAmt = Number(formLoanAmount) || 0;
    const tenure = Number(formTenureMonths) || 48;

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        machine_id: formMachineId,
        lender_name: formLenderName,
        loan_account_number: formAccountNumber || 'LAN-001',
        loan_amount: loanAmt,
        interest_rate_pa: Number(formInterestRate) || 0,
        tenure_months: tenure,
        emi_amount: Number(formEmiAmount) || 0,
        emi_due_day: Number(formEmiDueDay) || 5,
        start_date: formStartDate,
        outstanding_principal: editingLoan ? editingLoan.outstanding_principal : loanAmt,
        status: formStatus,
        notes: formNotes || null,
      };

      if (editingLoan) {
        const { error } = await supabase
          .from('machine_loans')
          .update(payload)
          .eq('id', editingLoan.id);
        if (error) throw error;
        addToast('Equipment loan updated.', 'success');
      } else {
        const { error } = await supabase.from('machine_loans').insert(payload);
        if (error) throw error;
        addToast('New Equipment Bank Loan registered.', 'success');
      }

      setIsLoanModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save loan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRecordEmi = (loan: MachineLoan) => {
    setSelectedLoan(loan);
    const totalEmi = Number(loan.emi_amount) || 0;
    // Estimate current month interest = Outstanding Principal * (Annual Rate / 12 / 100)
    const monthlyRate = (Number(loan.interest_rate_pa) || 9.5) / 12 / 100;
    const estInterest = Math.round(Number(loan.outstanding_principal || loan.loan_amount) * monthlyRate);
    const estPrincipal = Math.max(0, Math.round(totalEmi - estInterest));

    setEmiDate(new Date().toISOString().split('T')[0]);
    setEmiTotal(String(totalEmi));
    setEmiInterest(String(estInterest));
    setEmiPrincipal(String(estPrincipal));
    setEmiMode('Bank Transfer');
    setEmiRef('');
    setIsEmiModalOpen(true);
  };

  const handleRecordEmiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !selectedLoan) return;

    const total = Number(emiTotal) || 0;
    const principal = Number(emiPrincipal) || 0;
    const interest = Number(emiInterest) || 0;
    const nextEmiNo = (selectedLoan.emis_paid_count || 0) + 1;

    setSubmitting(true);
    try {
      // 1. Insert EMI Payment record
      const { error: emiErr } = await supabase.from('loan_emi_payments').insert({
        company_id: company.id,
        loan_id: selectedLoan.id,
        machine_id: selectedLoan.machine_id,
        payment_date: emiDate,
        installment_number: nextEmiNo,
        total_emi_amount: total,
        principal_component: principal,
        interest_component: interest,
        payment_mode: emiMode,
        reference_number: emiRef || null,
      });
      if (emiErr) throw emiErr;

      // 2. Update Loan's outstanding principal & paid count
      const newOutstanding = Math.max(0, Number(selectedLoan.outstanding_principal) - principal);
      const newStatus = newOutstanding <= 0 || nextEmiNo >= selectedLoan.tenure_months ? 'Closed' : 'Active';

      await supabase
        .from('machine_loans')
        .update({
          emis_paid_count: nextEmiNo,
          outstanding_principal: newOutstanding,
          status: newStatus,
        })
        .eq('id', selectedLoan.id);

      // 3. Automatically split and log into Expenses table:
      //    - Loan Interest -> expense_type: 'Loan Interest' (Deductible in P&L & Partnership Split)
      //    - Loan Principal -> expense_type: 'Loan Principal' (Balance Sheet Debt Repayment, excluded from P&L expense)
      const expensePayloads = [];
      if (interest > 0) {
        expensePayloads.push({
          company_id: company.id,
          machine_id: selectedLoan.machine_id,
          category: 'Loan Interest',
          expense_type: 'Loan Interest',
          amount: interest,
          date: emiDate,
          vendor_name: selectedLoan.lender_name,
          payment_mode: 'Bank Transfer',
          reference_number: emiRef || null,
          notes: `EMI #${nextEmiNo} Interest Component (${selectedLoan.lender_name})`,
          created_by: user?.id || null,
        });
      }
      if (principal > 0) {
        expensePayloads.push({
          company_id: company.id,
          machine_id: selectedLoan.machine_id,
          category: 'Loan Principal',
          expense_type: 'Loan Principal',
          amount: principal,
          date: emiDate,
          vendor_name: selectedLoan.lender_name,
          payment_mode: 'Bank Transfer',
          reference_number: emiRef || null,
          notes: `EMI #${nextEmiNo} Principal Repayment (${selectedLoan.lender_name})`,
          created_by: user?.id || null,
        });
      }

      if (expensePayloads.length > 0) {
        await supabase.from('expenses').insert(expensePayloads);
      }

      addToast(
        `EMI #${nextEmiNo} recorded! Split ${formatCurrency(interest)} Interest (P&L) & ${formatCurrency(principal)} Principal automatically.`,
        'success'
      );
      setIsEmiModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to record EMI payment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const summary = useMemo(() => {
    const activeLoans = loans.filter((l) => l.status === 'Active');
    const monthlyEmiCommitment = activeLoans.reduce((s, l) => s + Number(l.emi_amount || 0), 0);
    const totalOutstanding = activeLoans.reduce((s, l) => s + Number(l.outstanding_principal || 0), 0);
    const totalInterestPaid = emiHistory.reduce((s, e) => s + Number(e.interest_component || 0), 0);
    return { activeCount: activeLoans.length, monthlyEmiCommitment, totalOutstanding, totalInterestPaid };
  }, [loans, emiHistory]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Equipment Bank Loans & Monthly EMI Tracker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track boom lift bank loans, EMI due dates, and auto-split EMI into Principal (Balance Sheet) vs. Interest (P&L Deductible)
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenAddLoan}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Add Machine Loan
        </Button>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-bold uppercase text-slate-400">Active Equipment Loans</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{summary.activeCount}</div>
          <span className="text-[11px] text-slate-500">Financed boom lifts</span>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold uppercase text-slate-400">Monthly EMI Outflow</span>
          <div className="text-xl font-black text-amber-600 mt-1">
            {formatCurrency(summary.monthlyEmiCommitment)}
          </div>
          <span className="text-[11px] text-slate-500">Total monthly NACH commitment</span>
        </Card>
        <Card className="p-4 border-l-4 border-l-rose-600">
          <span className="text-[11px] font-bold uppercase text-slate-400">Outstanding Principal</span>
          <div className="text-xl font-black text-rose-600 mt-1">
            {formatCurrency(summary.totalOutstanding)}
          </div>
          <span className="text-[11px] text-slate-500">Remaining loan balance</span>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Interest Paid (YTD)</span>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {formatCurrency(summary.totalInterestPaid)}
          </div>
          <span className="text-[11px] text-slate-500">Tax-deductible P&L finance cost</span>
        </Card>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading equipment finance & EMI schedules..." />
      ) : loans.length === 0 ? (
        <EmptyState
          icon={<Landmark className="w-8 h-8" />}
          title="No Machine Bank Loans Registered"
          description="Add your HDFC, ICICI, Tata Capital, or Sundaram Finance equipment loans to track monthly EMIs and automatically separate Principal from Interest in your P&L."
          actionLabel="+ Add First Equipment Loan"
          onAction={handleOpenAddLoan}
        />
      ) : (
        <div className="space-y-6">
          {/* Active Loans Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">Bank / Financer</th>
                    <th className="py-3.5 px-4">Financed Boom Lift</th>
                    <th className="py-3.5 px-4 text-right">Loan Amount</th>
                    <th className="py-3.5 px-4 text-right">Monthly EMI</th>
                    <th className="py-3.5 px-4 text-center">EMIs Paid</th>
                    <th className="py-3.5 px-4 text-right">Principal Balance</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-slate-50/70">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">{loan.lender_name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          A/C: {loan.loan_account_number || 'N/A'} | Due: {loan.emi_due_day}th of month
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {loan.machine ? (
                          <div>
                            <span className="font-bold text-slate-800 block">
                              {loan.machine.machine_name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {loan.machine.machine_id_code}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">Boom Lift Asset</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(loan.loan_amount)}
                        <span className="block text-[10px] text-slate-400">
                          @ {loan.interest_rate_pa}% p.a.
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-amber-700">
                        {formatCurrency(loan.emi_amount)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-800">
                          {loan.emis_paid_count} / {loan.tenure_months}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                        {formatCurrency(loan.outstanding_principal)}
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge variant={loan.status === 'Active' ? 'info' : 'success'}>
                          {loan.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {loan.status === 'Active' && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleOpenRecordEmi(loan)}
                            >
                              Record EMI
                            </Button>
                          )}
                          <button
                            onClick={() => handleOpenEditLoan(loan)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                            title="Edit Loan"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* EMI History Ledger */}
          {emiHistory.length > 0 && (
            <Card className="p-5 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">
                Recent EMI Repayments (Principal vs. Interest Split)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">EMI #</th>
                      <th className="py-2.5 px-3">Bank & Machine</th>
                      <th className="py-2.5 px-3 text-right">Principal (Debt)</th>
                      <th className="py-2.5 px-3 text-right">Interest (P&L Cost)</th>
                      <th className="py-2.5 px-3 text-right">Total EMI Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {emiHistory.map((e) => (
                      <tr key={e.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-700">
                          {formatDate(e.payment_date)}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                          #{e.installment_number}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-slate-900">
                            {e.loan?.lender_name || 'Bank'}
                          </span>{' '}
                          {e.machine && (
                            <span className="text-slate-500">({e.machine.machine_name})</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-blue-700">
                          {formatCurrency(e.principal_component)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-semibold text-rose-600">
                          {formatCurrency(e.interest_component)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {formatCurrency(e.total_emi_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Add/Edit Loan Modal */}
      <Modal
        isOpen={isLoanModalOpen}
        onClose={() => setIsLoanModalOpen(false)}
        title={editingLoan ? 'Edit Equipment Bank Loan' : 'Register Equipment Bank Loan'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveLoan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Select
              label="Financed Boom Lift"
              required
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
              options={machines.map((m) => ({
                value: m.id,
                label: `${m.machine_name} (${m.machine_id_code})`,
              }))}
            />
            <Input
              label="Bank / NBFC Lender Name"
              required
              placeholder="e.g. HDFC Bank / Tata Capital"
              value={formLenderName}
              onChange={(e) => setFormLenderName(e.target.value)}
            />
            <Input
              label="Loan Account Number"
              required
              placeholder="e.g. LAN-88392019"
              value={formAccountNumber}
              onChange={(e) => setFormAccountNumber(e.target.value)}
            />
            <Input
              label="Sanctioned Loan Amount (INR)"
              type="number"
              step="any"
              required
              value={formLoanAmount}
              onChange={(e) => {
                setFormLoanAmount(e.target.value);
                recalculateStandardEmi(e.target.value, formInterestRate, formTenureMonths);
              }}
            />
            <Input
              label="Interest Rate (% per annum)"
              type="number"
              step="any"
              required
              value={formInterestRate}
              onChange={(e) => {
                setFormInterestRate(e.target.value);
                recalculateStandardEmi(formLoanAmount, e.target.value, formTenureMonths);
              }}
            />
            <Input
              label="Tenure (Months)"
              type="number"
              required
              value={formTenureMonths}
              onChange={(e) => {
                setFormTenureMonths(e.target.value);
                recalculateStandardEmi(formLoanAmount, formInterestRate, e.target.value);
              }}
            />
            <Input
              label="Monthly EMI Amount (INR)"
              type="number"
              step="any"
              required
              value={formEmiAmount}
              onChange={(e) => setFormEmiAmount(e.target.value)}
              helperText="Auto-calculated from reducing-balance formula; editable if needed"
            />
            <Input
              label="Monthly NACH / EMI Due Day (1-28)"
              type="number"
              min={1}
              max={28}
              value={formEmiDueDay}
              onChange={(e) => setFormEmiDueDay(e.target.value)}
            />
            <Input
              label="First EMI Start Date"
              type="date"
              required
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
            />
            <Select
              label="Loan Status"
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as MachineLoan['status'])}
              options={[
                { value: 'Active', label: 'Active (Running EMI)' },
                { value: 'Closed', label: 'Closed (NOC Received)' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsLoanModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {editingLoan ? 'Save Loan' : 'Register Loan'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Monthly EMI Modal */}
      <Modal
        isOpen={isEmiModalOpen}
        onClose={() => setIsEmiModalOpen(false)}
        title="Record Monthly EMI Repayment (Auto P&L Split)"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordEmiSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-900">
            <strong>Accounting Best Practice:</strong> LiftLedger automatically logs the{' '}
            <strong>Interest Component</strong> under P&L Finance Cost and the{' '}
            <strong>Principal Component</strong> under Debt Repayment so your Partnership Profit Split and P&L remain 100% accurate.
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="EMI Payment Date"
              type="date"
              required
              value={emiDate}
              onChange={(e) => setEmiDate(e.target.value)}
            />
            <Input
              label="Total EMI Paid (INR)"
              type="number"
              step="any"
              required
              value={emiTotal}
              onChange={(e) => {
                const tot = Number(e.target.value) || 0;
                const intr = Number(emiInterest) || 0;
                setEmiTotal(e.target.value);
                setEmiPrincipal(String(Math.max(0, tot - intr)));
              }}
            />
            <Input
              label="Interest Component (P&L Expense)"
              type="number"
              step="any"
              required
              value={emiInterest}
              onChange={(e) => {
                const intr = Number(e.target.value) || 0;
                const tot = Number(emiTotal) || 0;
                setEmiInterest(e.target.value);
                setEmiPrincipal(String(Math.max(0, tot - intr)));
              }}
            />
            <Input
              label="Principal Component (Loan Reduction)"
              type="number"
              step="any"
              required
              value={emiPrincipal}
              onChange={(e) => setEmiPrincipal(e.target.value)}
            />
            <Select
              label="Payment Mode"
              value={emiMode}
              onChange={(e) => setEmiMode(e.target.value)}
              options={[
                { value: 'Bank Transfer', label: 'Auto-Debit / NACH / NEFT' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'UPI', label: 'UPI' },
              ]}
            />
            <Input
              label="Bank Reference / UTR"
              placeholder="Optional"
              value={emiRef}
              onChange={(e) => setEmiRef(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsEmiModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Record EMI & Split to Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
