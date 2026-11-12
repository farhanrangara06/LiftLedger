import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  Plus,
  Search,
  Filter,
  DollarSign,
  TrendingUp,
  AlertCircle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Building,
  FileText,
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
import { Payment, Customer, Invoice, BankAccount, PaymentMode } from '@/types';

export const PaymentsPage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [paymentToReverse, setPaymentToReverse] = useState<Payment | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Record Form
  const [formPaymentNumber, setFormPaymentNumber] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formInvoiceId, setFormInvoiceId] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formTds, setFormTds] = useState('0');
  const [formMode, setFormMode] = useState<PaymentMode>('Bank Transfer');
  const [formRef, setFormRef] = useState('');
  const [formBankId, setFormBankId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Payments
      const { data: pData } = await supabase
        .from('payments')
        .select('*, customer:customers(*), invoice:invoices(*), bank_account:bank_accounts(*)')
        .eq('company_id', company.id)
        .order('payment_date', { ascending: false });

      if (pData) setPayments(pData as Payment[]);

      // 2. Fetch Customers
      const { data: cData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (cData) setCustomers(cData as Customer[]);

      // 3. Fetch Invoices
      const { data: invData } = await supabase
        .from('invoices')
        .select('*')
        .eq('company_id', company.id)
        .order('invoice_date', { ascending: false });

      if (invData) setInvoices(invData as Invoice[]);

      // 4. Fetch Bank Accounts
      const { data: bData } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true);

      if (bData) {
        setBankAccounts(bData as BankAccount[]);
        const primary = bData.find((b) => b.is_primary);
        if (primary) setFormBankId(primary.id);
      }
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Open Record Modal
  const handleOpenRecordModal = () => {
    setFormPaymentNumber(`PAY-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCustomerId(customers[0]?.id || '');
    setFormInvoiceId('');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormAmount('');
    setFormTds('0');
    setFormMode('Bank Transfer');
    setFormRef('');
    setFormNotes('');
    setIsRecordModalOpen(true);
  };

  // Filter invoices for selected customer
  const customerPendingInvoices = useMemo(() => {
    if (!formCustomerId) return [];
    return invoices.filter(
      (inv) =>
        inv.customer_id === formCustomerId &&
        inv.status !== 'Paid' &&
        inv.status !== 'Cancelled'
    );
  }, [invoices, formCustomerId]);

  // Autofill amount when invoice selected
  useEffect(() => {
    if (formInvoiceId) {
      const selectedInv = invoices.find((inv) => inv.id === formInvoiceId);
      if (selectedInv) {
        setFormAmount(String(selectedInv.balance_due || 0));
      }
    }
  }, [formInvoiceId, invoices]);

  // Record Payment Submit
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formCustomerId) return;

    const amountNum = Number(formAmount) || 0;
    const tdsNum = Number(formTds) || 0;

    if (amountNum <= 0) {
      addToast('Please enter a valid positive payment amount.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Insert Payment Record
      const { data: createdPayment, error: payErr } = await supabase
        .from('payments')
        .insert({
          company_id: company.id,
          payment_number: formPaymentNumber,
          customer_id: formCustomerId,
          invoice_id: formInvoiceId || null,
          payment_date: formDate,
          amount: amountNum,
          tds_deducted: tdsNum,
          payment_mode: formMode,
          transaction_reference: formRef || null,
          bank_account_id: formBankId || null,
          notes: formNotes || null,
          is_reversal: false,
        })
        .select()
        .single();

      if (payErr) throw payErr;

      // 2. If allocated to an invoice, update invoice balances
      if (formInvoiceId) {
        const inv = invoices.find((i) => i.id === formInvoiceId);
        if (inv) {
          const newPaid = Number(inv.paid_amount || 0) + amountNum;
          const newTds = Number(inv.tds_amount || 0) + tdsNum;
          const newBalance = Math.max(0, Number(inv.grand_total) - newPaid - newTds);
          const newStatus = newBalance === 0 ? 'Paid' : 'Partially Paid';

          await supabase
            .from('invoices')
            .update({
              paid_amount: newPaid,
              tds_amount: newTds,
              balance_due: newBalance,
              status: newStatus,
            })
            .eq('id', formInvoiceId);

          // Insert allocation record
          await supabase.from('payment_allocations').insert({
            payment_id: createdPayment.id,
            invoice_id: formInvoiceId,
            allocated_amount: amountNum,
            allocated_tds: tdsNum,
          });
        }
      }

      addToast(`Payment "${formPaymentNumber}" recorded successfully.`, 'success');
      setIsRecordModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error recording payment:', err);
      addToast(err.message || 'Failed to record payment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reversal Submit (Does NOT delete, creates reversal entry!)
  const handleReversePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentToReverse || !company?.id) return;

    setSubmitting(true);
    try {
      // 1. Create Reversal Payment Record
      const reversalNumber = `REV-${paymentToReverse.payment_number}`;
      await supabase.from('payments').insert({
        company_id: company.id,
        payment_number: reversalNumber,
        customer_id: paymentToReverse.customer_id,
        invoice_id: paymentToReverse.invoice_id || null,
        payment_date: new Date().toISOString().split('T')[0],
        amount: paymentToReverse.amount,
        tds_deducted: paymentToReverse.tds_deducted,
        payment_mode: paymentToReverse.payment_mode,
        transaction_reference: `Reversal of ${paymentToReverse.payment_number}`,
        notes: `Reversal Reason: ${reversalReason}`,
        is_reversal: true,
        reversed_payment_id: paymentToReverse.id,
      });

      // 2. If it was linked to an invoice, reinstate the balance due
      if (paymentToReverse.invoice_id) {
        const inv = invoices.find((i) => i.id === paymentToReverse.invoice_id);
        if (inv) {
          const reinstatedPaid = Math.max(0, Number(inv.paid_amount || 0) - Number(paymentToReverse.amount));
          const reinstatedTds = Math.max(0, Number(inv.tds_amount || 0) - Number(paymentToReverse.tds_deducted));
          const reinstatedBalance = Number(inv.grand_total) - reinstatedPaid - reinstatedTds;

          await supabase
            .from('invoices')
            .update({
              paid_amount: reinstatedPaid,
              tds_amount: reinstatedTds,
              balance_due: reinstatedBalance,
              status: reinstatedBalance === Number(inv.grand_total) ? 'Issued' : 'Partially Paid',
            })
            .eq('id', paymentToReverse.invoice_id);
        }
      }

      addToast(`Payment reversed cleanly. Ledger updated.`, 'info');
      setIsReverseModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to process payment reversal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Totals calculations
  const totalInvoicedSum = invoices
    .filter((inv) => inv.status !== 'Cancelled')
    .reduce((s, inv) => s + Number(inv.grand_total || 0), 0);

  const totalCollectedSum = payments
    .filter((p) => !p.is_reversal)
    .reduce((s, p) => s + Number(p.amount || 0), 0);

  const totalTdsSum = payments
    .filter((p) => !p.is_reversal)
    .reduce((s, p) => s + Number(p.tds_deducted || 0), 0);

  const totalOutstandingSum = invoices
    .filter((inv) => inv.status !== 'Paid' && inv.status !== 'Cancelled')
    .reduce((s, inv) => s + Number(inv.balance_due || 0), 0);

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        p.payment_number.toLowerCase().includes(s) ||
        (p.customer?.name && p.customer.name.toLowerCase().includes(s)) ||
        (p.transaction_reference && p.transaction_reference.toLowerCase().includes(s));

      const matchesMode = modeFilter === 'ALL' || p.payment_mode === modeFilter;
      return matchesSearch && matchesMode;
    });
  }, [payments, searchTerm, modeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Payments & TDS Collections</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log bank remittances, UPI, cheques, track section 194C/194I TDS receivables, and audit adjustments
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenRecordModal}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Record Payment
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
            <FileText className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatCurrency(totalInvoicedSum)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">All issued GST bills</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600">{formatCurrency(totalCollectedSum)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Realized bank & cash</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">TDS Receivable</span>
            <DollarSign className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatCurrency(totalTdsSum)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">TDS certificate credit (26AS)</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pending Balance</span>
            <AlertCircle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-xl font-extrabold text-amber-600">{formatCurrency(totalOutstandingSum)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Current unpaid balances</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search payments by Ref #, Customer, UTR, Cheque No..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Payment Modes' },
              { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS)' },
              { value: 'UPI', label: 'UPI' },
              { value: 'Cheque', label: 'Cheque' },
              { value: 'Cash', label: 'Cash' },
            ]}
          />
        </div>
      </Card>

      {/* Payments Table */}
      {loading ? (
        <LoadingSpinner message="Loading financial transactions..." />
      ) : filteredPayments.length === 0 ? (
        <EmptyState
          icon={<CreditCard className="w-8 h-8" />}
          title="No Payment Records"
          description="Record incoming customer bank transfers, advance deposits, or UPI payments."
          actionLabel="+ Record Payment"
          onAction={handleOpenRecordModal}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Receipt #</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Invoice Allocated</th>
                  <th className="py-3.5 px-4">Date & Mode</th>
                  <th className="py-3.5 px-4">UTR / Cheque Ref</th>
                  <th className="py-3.5 px-4 text-right">Amount (INR)</th>
                  <th className="py-3.5 px-4 text-right">TDS (INR)</th>
                  <th className="py-3.5 px-4 text-center">Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.map((p) => (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      p.is_reversal ? 'bg-rose-50/30 text-rose-800' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-slate-900 font-mono">
                      {p.payment_number}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {p.customer?.name}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.invoice ? (
                        <span className="text-blue-600 font-medium">
                          {p.invoice.invoice_number}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">Unallocated Advance</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-800 block">{formatDate(p.payment_date)}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{p.payment_mode}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {p.transaction_reference || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {p.is_reversal ? (
                        <span className="text-rose-600">- {formatCurrency(p.amount)}</span>
                      ) : (
                        <span className="text-emerald-600">{formatCurrency(p.amount)}</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-purple-700">
                      {p.tds_deducted > 0 ? formatCurrency(p.tds_deducted) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {p.is_reversal ? (
                        <Badge variant="danger" size="sm">
                          Reversal Entry
                        </Badge>
                      ) : (
                        <button
                          onClick={() => {
                            setPaymentToReverse(p);
                            setReversalReason('Cheque bounced or transaction reversal requested');
                            setIsReverseModalOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-[11px] font-semibold transition-colors cursor-pointer"
                          title="Reverse this payment entry safely"
                        >
                          <RotateCcw className="w-3 h-3 inline mr-1" />
                          Reverse
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      <Modal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        title="Record Customer Payment Receipt"
        description="Log bank transfer, NEFT, Cheque or UPI collection and apply to invoice"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Payment Reference #"
              required
              value={formPaymentNumber}
              onChange={(e) => setFormPaymentNumber(e.target.value)}
            />

            <Input
              label="Receipt Date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <div className="sm:col-span-2">
              <Select
                label="Customer / Client"
                required
                value={formCustomerId}
                onChange={(e) => {
                  setFormCustomerId(e.target.value);
                  setFormInvoiceId('');
                }}
                options={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>

            <div className="sm:col-span-2">
              <Select
                label="Apply to Pending Invoice (Optional)"
                value={formInvoiceId}
                onChange={(e) => setFormInvoiceId(e.target.value)}
                options={[
                  { value: '', label: '-- None (Record as Advance Deposit) --' },
                  ...customerPendingInvoices.map((inv) => ({
                    value: inv.id,
                    label: `${inv.invoice_number} (Due Date: ${formatDate(inv.due_date)} | Balance: ${formatCurrency(inv.balance_due)})`,
                  })),
                ]}
                helperText="Applying automatically updates invoice balance and status"
              />
            </div>

            <Input
              label="Amount Received (INR)"
              type="number"
              required
              placeholder="e.g. 295000"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
            />

            <Input
              label="TDS Deducted (Sec 194C / 194I INR)"
              type="number"
              placeholder="e.g. 5000"
              value={formTds}
              onChange={(e) => setFormTds(e.target.value)}
              helperText="Tracked separately for tax audit"
            />

            <Select
              label="Payment Mode"
              required
              value={formMode}
              onChange={(e) => setFormMode(e.target.value as any)}
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer (NEFT / RTGS / IMPS)' },
                { value: 'UPI', label: 'UPI / QR Payment' },
                { value: 'Cheque', label: 'Bank Cheque' },
                { value: 'Cash', label: 'Cash' },
                { value: 'Other', label: 'Other' },
              ]}
            />

            <Select
              label="Credited Bank Account"
              value={formBankId}
              onChange={(e) => setFormBankId(e.target.value)}
              options={bankAccounts.map((b) => ({
                value: b.id,
                label: `${b.bank_name} - ${b.account_number}`,
              }))}
            />

            <div className="sm:col-span-2">
              <Input
                label="Transaction Reference / Cheque No. / UTR"
                placeholder="e.g. UTR # HDFC240982341 or Chq # 000432"
                value={formRef}
                onChange={(e) => setFormRef(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Notes / Remarks"
                placeholder="e.g. Advance mobilization payment for October."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsRecordModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={submitting}>
              Save Payment Record
            </Button>
          </div>
        </form>
      </Modal>

      {/* Reverse Payment Modal */}
      <Modal
        isOpen={isReverseModalOpen}
        onClose={() => setIsReverseModalOpen(false)}
        title="Confirm Payment Reversal"
        description="Creates a balancing reversal transaction in the ledger without deleting history"
        maxWidth="md"
      >
        <form onSubmit={handleReversePayment} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 space-y-1">
            <p>
              Reversing payment <strong>{paymentToReverse?.payment_number}</strong> of{' '}
              <strong>{formatCurrency(paymentToReverse?.amount)}</strong>.
            </p>
            <p>
              This will reinstate any allocated invoice balance and create an immutable audit trail.
            </p>
          </div>

          <Input
            label="Reason for Reversal"
            required
            placeholder="e.g. Cheque returned by bank due to signature mismatch."
            value={reversalReason}
            onChange={(e) => setReversalReason(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsReverseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={submitting}>
              Execute Reversal
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
