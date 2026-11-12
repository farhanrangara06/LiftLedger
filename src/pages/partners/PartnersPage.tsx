import React, { useState, useEffect, useMemo } from 'react';
import {
  Handshake,
  Plus,
  Users,
  TrendingUp,
  Wallet,
  Scale,
  FileSpreadsheet,
  Send,
  Edit2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Landmark,
  ArrowDownRight,
  ArrowUpRight,
  Calculator,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelExport';
import { openWhatsAppLink } from '@/lib/whatsapp';
import {
  Partner,
  PartnerTransaction,
  PartnerDesignation,
  PartnerTransactionType,
  Invoice,
  Payment,
  Expense,
  PaymentMode,
} from '@/types';

type SplitBasis = 'NET_PROFIT' | 'REALIZED_CASH_PROFIT' | 'GROSS_REVENUE';

const CHART_COLORS = ['#2563eb', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

export const PartnersPage: React.FC = () => {
  const { company, user } = useAuth();
  const { addToast } = useNotification();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Database state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [transactions, setTransactions] = useState<PartnerTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

  // Date & Distribution Basis Controls
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [splitBasis, setSplitBasis] = useState<SplitBasis>('NET_PROFIT');
  const [includePartnerAppropriations, setIncludePartnerAppropriations] = useState(true);

  // Add / Edit Partner Modal
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<Partner | null>(null);
  const [formName, setFormName] = useState('');
  const [formDesignation, setFormDesignation] = useState<PartnerDesignation>('Working Partner');
  const [formPan, setFormPan] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formSharePercent, setFormSharePercent] = useState('50');
  const [formCapital, setFormCapital] = useState('0');
  const [formInterestRate, setFormInterestRate] = useState('12');
  const [formMonthlyRemuneration, setFormMonthlyRemuneration] = useState('0');
  const [formBankName, setFormBankName] = useState('');
  const [formAccountNo, setFormAccountNo] = useState('');
  const [formIfsc, setFormIfsc] = useState('');
  const [formUpi, setFormUpi] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Record Partner Payout / Drawing / Capital Transaction Modal
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txPartnerId, setTxPartnerId] = useState('');
  const [txType, setTxType] = useState<PartnerTransactionType>('PROFIT_PAYOUT');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [txAmount, setTxAmount] = useState('');
  const [txMode, setTxMode] = useState<PaymentMode>('Bank Transfer');
  const [txRef, setTxRef] = useState('');
  const [txNotes, setTxNotes] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [partRes, txRes, invRes, payRes, expRes] = await Promise.all([
        supabase
          .from('partners')
          .select('*')
          .eq('company_id', company.id)
          .order('profit_share_percent', { ascending: false }),
        supabase
          .from('partner_transactions')
          .select('*, partner:partners(*)')
          .eq('company_id', company.id)
          .gte('transaction_date', startDate)
          .lte('transaction_date', endDate)
          .order('transaction_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('*')
          .eq('company_id', company.id)
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate),
        supabase
          .from('payments')
          .select('*, invoice:invoices(gst_rate, taxable_amount, grand_total)')
          .eq('company_id', company.id)
          .gte('payment_date', startDate)
          .lte('payment_date', endDate),
        supabase
          .from('expenses')
          .select('*')
          .eq('company_id', company.id)
          .gte('date', startDate)
          .lte('date', endDate),
      ]);

      if (partRes.data) setPartners(partRes.data as Partner[]);
      if (txRes.data) setTransactions(txRes.data as PartnerTransaction[]);
      if (invRes.data) setInvoices(invRes.data as Invoice[]);
      if (payRes.data) setPayments(payRes.data as Payment[]);
      if (expRes.data) setExpenses(expRes.data as Expense[]);
    } catch (err) {
      console.error('Error loading partnership data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id, startDate, endDate]);

  const activePartners = useMemo(() => partners.filter((p) => p.is_active), [partners]);

  const totalRatioPercent = useMemo(
    () =>
      Math.round(
        activePartners.reduce((sum, p) => sum + Number(p.profit_share_percent || 0), 0) * 100
      ) / 100,
    [activePartners]
  );

  // Number of months in selected date range (for pro-rating partner remuneration & interest on capital)
  const monthsInPeriod = useMemo(() => {
    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    const diffDays = Math.max(1, (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24) + 1);
    return Math.max(0.5, Math.round((diffDays / 30.4375) * 10) / 10);
  }, [startDate, endDate]);

  // Firm Financial Pool Calculations
  const firmFinancials = useMemo(() => {
    const validInvoices = invoices.filter((i) => i.status !== 'Cancelled');

    // 1. Gross Taxable Revenue (Excl. GST, since GST belongs to the Government, not Partner Profit)
    const grossTaxableRevenue = validInvoices.reduce(
      (sum, inv) => sum + Number(inv.taxable_amount || 0),
      0
    );
    const totalBilledWithGst = validInvoices.reduce(
      (sum, inv) => sum + Number(inv.grand_total || 0),
      0
    );

    // 2. Realized Cash Collections (Net of reversals, and net of embedded GST proportion)
    const rawCashCollected = payments.reduce((sum, p) => {
      const amt = Number(p.amount || 0) + Number(p.tds_deducted || 0);
      return p.is_reversal ? sum - amt : sum + amt;
    }, 0);

    // Estimate net-of-GST realized revenue using effective GST ratio (standard ~18%)
    const effectiveTaxableRatio =
      totalBilledWithGst > 0 ? grossTaxableRevenue / totalBilledWithGst : 1 / 1.18;
    const realizedNetCashRevenue = Math.round(rawCashCollected * effectiveTaxableRatio);

    // 3. Operating Expenses (OpEx) + Loan Interest (Excludes Loan Principal & CapEx per accounting standards)
    const opExTotal = expenses
      .filter((e) => e.expense_type === 'OpEx')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const loanInterestTotal = expenses
      .filter((e) => e.expense_type === 'Loan Interest')
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const totalDeductibleExpenses = opExTotal + loanInterestTotal;

    // 4. Book Operating Profit vs Realized Cash Profit
    const bookOperatingProfit = grossTaxableRevenue - totalDeductibleExpenses;
    const realizedCashProfit = realizedNetCashRevenue - totalDeductibleExpenses;

    // 5. Partner Interest on Capital & Working Partner Remuneration (Section 40(b) Appropriations)
    const totalInterestOnCapital = includePartnerAppropriations
      ? activePartners.reduce((sum, p) => {
          const annualInterest =
            (Number(p.capital_contributed || 0) * Number(p.interest_on_capital_rate || 0)) / 100;
          return sum + Math.round((annualInterest * monthsInPeriod) / 12);
        }, 0)
      : 0;

    const totalPartnerRemuneration = includePartnerAppropriations
      ? activePartners.reduce((sum, p) => {
          return sum + Math.round(Number(p.monthly_remuneration || 0) * monthsInPeriod);
        }, 0)
      : 0;

    // Base Pool before partner appropriations
    const basePool =
      splitBasis === 'GROSS_REVENUE'
        ? grossTaxableRevenue
        : splitBasis === 'REALIZED_CASH_PROFIT'
        ? realizedCashProfit
        : bookOperatingProfit;

    // Final Divisible Pool split by Partnership Ratio
    const divisiblePool =
      splitBasis === 'GROSS_REVENUE'
        ? grossTaxableRevenue
        : basePool - totalInterestOnCapital - totalPartnerRemuneration;

    return {
      grossTaxableRevenue,
      totalBilledWithGst,
      rawCashCollected,
      realizedNetCashRevenue,
      opExTotal,
      loanInterestTotal,
      totalDeductibleExpenses,
      bookOperatingProfit,
      realizedCashProfit,
      totalInterestOnCapital,
      totalPartnerRemuneration,
      basePool,
      divisiblePool,
    };
  }, [
    invoices,
    payments,
    expenses,
    activePartners,
    splitBasis,
    includePartnerAppropriations,
    monthsInPeriod,
  ]);

  // Per-Partner Statement & Split Calculation
  const partnerBreakdowns = useMemo(() => {
    const ratioDenominator = totalRatioPercent > 0 ? totalRatioPercent : 100;

    return activePartners.map((p) => {
      const shareRatio = Number(p.profit_share_percent || 0) / ratioDenominator;

      // 1. Ratio Share of Divisible Pool (Profit or Revenue)
      const ratioShareAmount = Math.round(firmFinancials.divisiblePool * shareRatio);

      // 2. Partner's Interest on Capital & Working Remuneration
      const interestOnCapital =
        includePartnerAppropriations && splitBasis !== 'GROSS_REVENUE'
          ? Math.round(
              (((Number(p.capital_contributed || 0) * Number(p.interest_on_capital_rate || 0)) /
                100) *
                monthsInPeriod) /
                12
            )
          : 0;

      const remuneration =
        includePartnerAppropriations && splitBasis !== 'GROSS_REVENUE'
          ? Math.round(Number(p.monthly_remuneration || 0) * monthsInPeriod)
          : 0;

      // 3. Total Entitlement for Period
      const totalEntitlement = ratioShareAmount + interestOnCapital + remuneration;

      // 4. Partner Transactions in Period
      const pTxs = transactions.filter((t) => t.partner_id === p.id);

      const drawingsAndPayouts = pTxs
        .filter((t) =>
          ['PROFIT_PAYOUT', 'DRAWING', 'REMUNERATION_PAYOUT'].includes(t.transaction_type)
        )
        .reduce((s, t) => (t.is_reversal ? s - Number(t.amount) : s + Number(t.amount)), 0);

      const capitalNetAdded = pTxs
        .filter((t) => ['CAPITAL_INJECTION', 'CAPITAL_WITHDRAWAL'].includes(t.transaction_type))
        .reduce((s, t) => {
          const signed =
            t.transaction_type === 'CAPITAL_INJECTION' ? Number(t.amount) : -Number(t.amount);
          return t.is_reversal ? s - signed : s + signed;
        }, 0);

      const closingCapital = Number(p.capital_contributed || 0) + capitalNetAdded;
      const netPayableDue = totalEntitlement - drawingsAndPayouts;

      return {
        partner: p,
        effectivePercent: Math.round(shareRatio * 10000) / 100,
        ratioShareAmount,
        interestOnCapital,
        remuneration,
        totalEntitlement,
        drawingsAndPayouts,
        closingCapital,
        netPayableDue,
      };
    });
  }, [
    activePartners,
    totalRatioPercent,
    firmFinancials,
    includePartnerAppropriations,
    splitBasis,
    monthsInPeriod,
    transactions,
  ]);

  // Open Partner Modal (Add or Edit)
  const handleOpenAddPartner = () => {
    setEditingPartner(null);
    const remainingShare = Math.max(0, Math.round((100 - totalRatioPercent) * 100) / 100);
    setFormName('');
    setFormDesignation('Working Partner');
    setFormPan('');
    setFormMobile('');
    setFormEmail('');
    setFormSharePercent(String(remainingShare > 0 ? remainingShare : 50));
    setFormCapital('0');
    setFormInterestRate('12');
    setFormMonthlyRemuneration('0');
    setFormBankName('');
    setFormAccountNo('');
    setFormIfsc('');
    setFormUpi('');
    setFormNotes('');
    setIsPartnerModalOpen(true);
  };

  const handleOpenEditPartner = (p: Partner) => {
    setEditingPartner(p);
    setFormName(p.name);
    setFormDesignation((p.designation as PartnerDesignation) || 'Working Partner');
    setFormPan(p.pan || '');
    setFormMobile(p.mobile || '');
    setFormEmail(p.email || '');
    setFormSharePercent(String(p.profit_share_percent));
    setFormCapital(String(p.capital_contributed || 0));
    setFormInterestRate(String(p.interest_on_capital_rate || 0));
    setFormMonthlyRemuneration(String(p.monthly_remuneration || 0));
    setFormBankName(p.bank_name || '');
    setFormAccountNo(p.account_number || '');
    setFormIfsc(p.ifsc_code || '');
    setFormUpi(p.upi_id || '');
    setFormNotes(p.notes || '');
    setIsPartnerModalOpen(true);
  };

  // Save Partner
  const handleSavePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formName.trim()) return;

    const shareVal = Number(formSharePercent) || 0;
    if (shareVal <= 0 || shareVal > 100) {
      addToast('Partnership ratio percentage must be between 0.01% and 100%.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        name: formName.trim(),
        designation: formDesignation,
        pan: formPan.trim().toUpperCase() || null,
        mobile: formMobile.trim() || null,
        email: formEmail.trim() || null,
        profit_share_percent: shareVal,
        capital_contributed: Number(formCapital) || 0,
        interest_on_capital_rate: Number(formInterestRate) || 0,
        monthly_remuneration: Number(formMonthlyRemuneration) || 0,
        bank_name: formBankName.trim() || null,
        account_number: formAccountNo.trim() || null,
        ifsc_code: formIfsc.trim().toUpperCase() || null,
        upi_id: formUpi.trim() || null,
        notes: formNotes.trim() || null,
        is_active: true,
      };

      if (editingPartner) {
        const { error } = await supabase
          .from('partners')
          .update(payload)
          .eq('id', editingPartner.id);
        if (error) throw error;
        addToast(`Partner "${formName}" updated.`, 'success');
      } else {
        const { error } = await supabase.from('partners').insert(payload);
        if (error) throw error;
        addToast(`Partner "${formName}" added with ${shareVal}% share.`, 'success');
      }

      setIsPartnerModalOpen(false);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save partner.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Equalize Partnership Ratios (e.g., 50:50, 33.33:33.33:33.34, 25:25:25:25)
  const handleEqualizeRatios = async () => {
    if (activePartners.length === 0) return;
    setSubmitting(true);
    try {
      const count = activePartners.length;
      const baseShare = Math.floor((100 / count) * 100) / 100;
      for (let i = 0; i < count; i++) {
        const share =
          i === count - 1
            ? Math.round((100 - baseShare * (count - 1)) * 100) / 100
            : baseShare;
        await supabase
          .from('partners')
          .update({ profit_share_percent: share })
          .eq('id', activePartners[i].id);
      }
      addToast(`Equalized profit sharing ratio across all ${count} active partners (Total = 100%).`, 'success');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to equalize ratios.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Record Partner Payout / Drawing / Capital Transaction
  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !txPartnerId) {
      addToast('Please select a partner.', 'warning');
      return;
    }
    const amt = Number(txAmount) || 0;
    if (amt <= 0) {
      addToast('Please enter a valid positive amount.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('partner_transactions').insert({
        company_id: company.id,
        partner_id: txPartnerId,
        transaction_date: txDate,
        transaction_type: txType,
        amount: amt,
        payment_mode: txMode,
        reference_number: txRef.trim() || null,
        notes: txNotes.trim() || null,
        is_reversal: false,
        created_by: user?.id || null,
      });

      if (error) throw error;
      addToast('Partner transaction recorded in ledger.', 'success');
      setIsTxModalOpen(false);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to record transaction.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Reverse a Partner Transaction (Audit-safe reversal, never deletes!)
  const handleReverseTransaction = async (tx: PartnerTransaction) => {
    if (!company?.id) return;
    try {
      const { error } = await supabase.from('partner_transactions').insert({
        company_id: company.id,
        partner_id: tx.partner_id,
        transaction_date: new Date().toISOString().split('T')[0],
        transaction_type: tx.transaction_type,
        amount: tx.amount,
        payment_mode: tx.payment_mode,
        reference_number: `REV-${tx.reference_number || tx.id.slice(0, 6)}`,
        notes: `Reversal of entry dated ${formatDate(tx.transaction_date)}`,
        is_reversal: true,
        created_by: user?.id || null,
      });
      if (error) throw error;
      addToast('Reversal entry recorded cleanly.', 'info');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to reverse entry.', 'error');
    }
  };

  // Export Partnership Appropriation & Capital Statement to Excel
  const handleExportStatement = () => {
    const rows = partnerBreakdowns.map((b) => ({
      'Partner Name': b.partner.name,
      Designation: b.partner.designation,
      PAN: b.partner.pan || '—',
      'Partnership Ratio (%)': `${b.partner.profit_share_percent}%`,
      'Contributed Capital (INR)': b.closingCapital,
      'Share of Profit / Revenue (INR)': b.ratioShareAmount,
      'Interest on Capital (INR)': b.interestOnCapital,
      'Partner Remuneration (INR)': b.remuneration,
      'Total Period Entitlement (INR)': b.totalEntitlement,
      'Less: Drawings & Payouts Taken (INR)': b.drawingsAndPayouts,
      'Net Payable / Balance Due (INR)': b.netPayableDue,
    }));
    exportToExcel(
      rows,
      `Partnership_Profit_Split_${startDate}_to_${endDate}`,
      'Partner Appropriation'
    );
    addToast('Downloaded Partnership Profit Split Statement (.xlsx)', 'success');
  };

  // Send WhatsApp Partner Settlement Statement
  const handleSendPartnerWhatsApp = (b: (typeof partnerBreakdowns)[number]) => {
    if (!b.partner.mobile) {
      addToast(`Please add a mobile number for ${b.partner.name} first.`, 'warning');
      return;
    }
    const basisLabel =
      splitBasis === 'NET_PROFIT'
        ? 'Net Operating Profit'
        : splitBasis === 'REALIZED_CASH_PROFIT'
        ? 'Realized Cash Profit'
        : 'Gross Taxable Revenue';

    const msg =
      `*${company?.name || 'LiftLedger'} — Partner Profit & Capital Statement*\n` +
      `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n` +
      `Partner: *${b.partner.name}* (${b.partner.designation})\n` +
      `Partnership Share Ratio: *${b.partner.profit_share_percent}%*\n` +
      `Basis: ${basisLabel}\n\n` +
      `• Firm Divisible Pool: ${formatCurrency(firmFinancials.divisiblePool)}\n` +
      `• Your Ratio Share (${b.partner.profit_share_percent}%): *${formatCurrency(b.ratioShareAmount)}*\n` +
      (b.interestOnCapital > 0
        ? `• Interest on Capital: ${formatCurrency(b.interestOnCapital)}\n`
        : '') +
      (b.remuneration > 0 ? `• Partner Remuneration: ${formatCurrency(b.remuneration)}\n` : '') +
      `• *Total Period Entitlement: ${formatCurrency(b.totalEntitlement)}*\n` +
      `• Less Drawings / Payouts Taken: ${formatCurrency(b.drawingsAndPayouts)}\n` +
      `• *Net Payable Balance: ${formatCurrency(b.netPayableDue)}*`;

    openWhatsAppLink(b.partner.mobile, msg);
  };

  if (loading) {
    return <LoadingSpinner message="Calculating partnership profit & revenue distribution..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Partnership Firm Profit & Revenue Split
            </h2>
            <Badge variant={Math.abs(totalRatioPercent - 100) < 0.05 ? 'success' : 'warning'} size="sm">
              Total Ratio: {totalRatioPercent}%
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            P&L Appropriation Account, Section 40(b) Partner Capital Interest & Remuneration, Cash vs Accrual Profit Split & Drawings Ledger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activePartners.length > 1 && Math.abs(totalRatioPercent - 100) >= 0.05 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEqualizeRatios}
              leftIcon={<Scale className="w-4 h-4" />}
            >
              Equalize Ratios (100%)
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportStatement}
            disabled={activePartners.length === 0}
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Export Excel (.xlsx)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTxPartnerId(activePartners[0]?.id || '');
              setTxAmount('');
              setTxRef('');
              setTxNotes('');
              setIsTxModalOpen(true);
            }}
            disabled={activePartners.length === 0}
            leftIcon={<Wallet className="w-4 h-4" />}
          >
            Record Payout / Drawing
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddPartner}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Partner
          </Button>
        </div>
      </div>

      {/* Period Filter & Distribution Basis Selector Bar */}
      <Card className="p-4 bg-slate-900 text-white border-slate-800">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              Distribution Basis (Business Accounting Mode)
            </label>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSplitBasis('NET_PROFIT')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  splitBasis === 'NET_PROFIT'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Net Operating Profit
              </button>
              <button
                type="button"
                onClick={() => setSplitBasis('REALIZED_CASH_PROFIT')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  splitBasis === 'REALIZED_CASH_PROFIT'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Realized Cash Profit
              </button>
              <button
                type="button"
                onClick={() => setSplitBasis('GROSS_REVENUE')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  splitBasis === 'GROSS_REVENUE'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Gross Revenue Split
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              To Date ({monthsInPeriod} mos)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="md:col-span-3 flex items-center pb-1">
            <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePartnerAppropriations}
                onChange={(e) => setIncludePartnerAppropriations(e.target.checked)}
                className="rounded border-slate-600 text-blue-500 focus:ring-blue-500 w-4 h-4"
              />
              <span>
                Apply Sec 40(b) Capital Interest & Partner Salary before Ratio Split
              </span>
            </label>
          </div>
        </div>
      </Card>

      {/* Firm-Level Waterfall KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            1. Taxable Revenue (Excl. GST)
          </div>
          <div className="text-lg font-black text-slate-900 mt-1">
            {formatCurrency(firmFinancials.grossTaxableRevenue)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Realized Cash: {formatCurrency(firmFinancials.realizedNetCashRevenue)}
          </div>
        </Card>

        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            2. Less: OpEx & Loan Interest
          </div>
          <div className="text-lg font-black text-rose-600 mt-1">
            - {formatCurrency(firmFinancials.totalDeductibleExpenses)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            OpEx: {formatCurrency(firmFinancials.opExTotal)} | Int: {formatCurrency(firmFinancials.loanInterestTotal)}
          </div>
        </Card>

        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            3. Net Operating Profit
          </div>
          <div className="text-lg font-black text-blue-600 mt-1">
            {formatCurrency(firmFinancials.bookOperatingProfit)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Cash Profit: {formatCurrency(firmFinancials.realizedCashProfit)}
          </div>
        </Card>

        <Card>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            4. Partner Salary & Cap. Int.
          </div>
          <div className="text-lg font-black text-amber-600 mt-1">
            {formatCurrency(
              firmFinancials.totalInterestOnCapital + firmFinancials.totalPartnerRemuneration
            )}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Int: {formatCurrency(firmFinancials.totalInterestOnCapital)} | Sal: {formatCurrency(firmFinancials.totalPartnerRemuneration)}
          </div>
        </Card>

        <Card className="bg-emerald-50/70 border-emerald-200">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
            5. Divisible Pool (Ratio Split)
          </div>
          <div className="text-xl font-black text-emerald-700 mt-1">
            {formatCurrency(firmFinancials.divisiblePool)}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            {splitBasis === 'NET_PROFIT'
              ? 'Net Profit Appropriation'
              : splitBasis === 'REALIZED_CASH_PROFIT'
              ? 'Realized Cash Pool'
              : 'Gross Revenue Pool'}
          </div>
        </Card>
      </div>

      {/* Ratio Warning Banner if != 100% */}
      {activePartners.length > 0 && Math.abs(totalRatioPercent - 100) >= 0.05 && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Note:</strong> Total Partnership Ratio across active partners is currently{' '}
              <strong>{totalRatioPercent}%</strong> (instead of 100%). Shares are automatically normalized proportionally, or you can click <strong>Equalize Ratios</strong>.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={handleEqualizeRatios}>
            Fix to 100%
          </Button>
        </div>
      )}

      {/* Partner Cards & Appropriation Table */}
      {activePartners.length === 0 ? (
        <EmptyState
          icon={<Handshake className="w-8 h-8" />}
          title="No Partners Configured in Partnership Deed"
          description="Add the partners of your Boom Lift rental firm along with their Profit/Revenue Sharing Ratio (e.g., 50% : 50% or 60% : 40%) and Capital Contribution to automatically split profits and track drawings."
          actionLabel="+ Add First Partner"
          onAction={handleOpenAddPartner}
        />
      ) : (
        <>
          {/* Partner Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partnerBreakdowns.map((b, idx) => (
              <Card key={b.partner.id} className="relative overflow-hidden border-slate-200/90">
                <div
                  className="h-1.5 w-full absolute top-0 left-0"
                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                />
                <div className="pt-2 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-slate-900">{b.partner.name}</h3>
                        <Badge variant="info" size="sm">
                          {b.partner.profit_share_percent}% Share
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {b.partner.designation} {b.partner.pan ? `• PAN: ${b.partner.pan}` : ''}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditPartner(b.partner)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="Edit Partner Ratio & Capital"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleSendPartnerWhatsApp(b)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="Send Settlement Statement on WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Capital Account
                      </span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(b.closingCapital)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Ratio Split ({b.effectivePercent}%)
                      </span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency(b.ratioShareAmount)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Salary + Cap. Interest
                      </span>
                      <span className="font-semibold text-slate-700">
                        {formatCurrency(b.interestOnCapital + b.remuneration)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Drawings Taken
                      </span>
                      <span className="font-semibold text-rose-600">
                        {formatCurrency(b.drawingsAndPayouts)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Net Payable to Partner
                      </span>
                      <span
                        className={`text-base font-black ${
                          b.netPayableDue >= 0 ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(b.netPayableDue)}
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTxPartnerId(b.partner.id);
                        setTxType('PROFIT_PAYOUT');
                        setTxAmount(String(Math.max(0, Math.round(b.netPayableDue))));
                        setIsTxModalOpen(true);
                      }}
                    >
                      Settle Payout
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Detailed P&L Appropriation & Capital Account Table */}
          <Card className="p-0 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Partnership Profit & Loss Appropriation Schedule
                </h3>
                <p className="text-[11px] text-slate-500">
                  Complete partner-wise breakdown of Capital, Ratio Share, Section 40(b) Remuneration, Drawings, and Closing Balance
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Partner & PAN</th>
                    <th className="py-3 px-3 text-center">Ratio (%)</th>
                    <th className="py-3 px-3 text-right">Capital Account</th>
                    <th className="py-3 px-3 text-right">Share of Pool</th>
                    <th className="py-3 px-3 text-right">Interest on Cap.</th>
                    <th className="py-3 px-3 text-right">Remuneration</th>
                    <th className="py-3 px-3 text-right">Total Entitlement</th>
                    <th className="py-3 px-3 text-right">Less: Drawings</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerBreakdowns.map((b) => (
                    <tr key={b.partner.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{b.partner.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {b.partner.designation} {b.partner.pan ? `• ${b.partner.pan}` : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-blue-600">
                        {b.partner.profit_share_percent}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(b.closingCapital)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(b.ratioShareAmount)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(b.interestOnCapital)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {formatCurrency(b.remuneration)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                        {formatCurrency(b.totalEntitlement)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        {formatCurrency(b.drawingsAndPayouts)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                        {formatCurrency(b.netPayableDue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Visual Charts + Partner Drawings Ledger */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Partner Entitlement vs Drawings</CardTitle>
              </CardHeader>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={partnerBreakdowns.map((b) => ({
                      name: b.partner.name,
                      Entitlement: b.totalEntitlement,
                      Drawings: b.drawingsAndPayouts,
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => formatCurrency(Number(val))} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Entitlement" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Drawings" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Partner Drawings, Payouts & Capital Ledger */}
            <Card className="lg:col-span-7 p-0 overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Partner Drawings, Profit Payouts & Capital Ledger
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Immutable audit trail of all partner withdrawals, settlements, and capital injections
                  </p>
                </div>
              </div>
              {transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No partner drawings or profit payouts recorded in this period.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Partner</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Mode / Ref</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3 text-center">Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {transactions.map((tx) => (
                        <tr
                          key={tx.id}
                          className={tx.is_reversal ? 'bg-rose-50/40 line-through text-slate-400' : ''}
                        >
                          <td className="py-2.5 px-3">{formatDate(tx.transaction_date)}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {tx.partner?.name || 'Partner'}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge
                              variant={
                                tx.transaction_type === 'CAPITAL_INJECTION'
                                  ? 'success'
                                  : tx.transaction_type === 'PROFIT_PAYOUT'
                                  ? 'info'
                                  : 'warning'
                              }
                              size="sm"
                            >
                              {tx.transaction_type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {tx.payment_mode}
                            {tx.reference_number ? ` (${tx.reference_number})` : ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold">
                            {formatCurrency(tx.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {!tx.is_reversal && (
                              <button
                                onClick={() => handleReverseTransaction(tx)}
                                className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                                title="Create Reversal Entry"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ADD / EDIT PARTNER MODAL                                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        title={editingPartner ? `Edit Partner — ${editingPartner.name}` : 'Add Firm Partner'}
        description="Configure Partnership Deed profit/revenue sharing ratio, capital contribution, and Section 40(b) remuneration"
        maxWidth="2xl"
      >
        <form onSubmit={handleSavePartner} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Partner Full Legal Name"
              required
              placeholder="e.g., Rajesh Sharma"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Select
              label="Partner Role / Designation"
              value={formDesignation}
              onChange={(e) => setFormDesignation(e.target.value as PartnerDesignation)}
              options={[
                { value: 'Managing Partner', label: 'Managing Partner (Active)' },
                { value: 'Working Partner', label: 'Working Partner (Active)' },
                { value: 'Investing / Sleeping Partner', label: 'Investing / Sleeping Partner' },
              ]}
            />
            <Input
              label="Profit / Revenue Share Ratio (%)"
              type="number"
              step="any"
              required
              min="0.01"
              max="100"
              value={formSharePercent}
              onChange={(e) => setFormSharePercent(e.target.value)}
              helperText="e.g., 50 for 50:50 split, or 33.33 for 3-partner equal split"
            />
            <Input
              label="Capital Contributed (INR)"
              type="number"
              step="any"
              min="0"
              value={formCapital}
              onChange={(e) => setFormCapital(e.target.value)}
              helperText="Partner's fixed/opening capital invested in boom lifts"
            />
            <Input
              label="Interest on Capital (% p.a.)"
              type="number"
              step="any"
              min="0"
              max="24"
              value={formInterestRate}
              onChange={(e) => setFormInterestRate(e.target.value)}
              helperText="Sec 40(b) allows up to 12% p.a. (Set 0 if none)"
            />
            <Input
              label="Working Partner Monthly Salary (INR)"
              type="number"
              step="any"
              min="0"
              value={formMonthlyRemuneration}
              onChange={(e) => setFormMonthlyRemuneration(e.target.value)}
              helperText="Monthly remuneration before profit ratio split (Set 0 if none)"
            />
            <Input
              label="Partner PAN"
              placeholder="ABCDE1234F"
              maxLength={10}
              value={formPan}
              onChange={(e) => setFormPan(e.target.value)}
            />
            <Input
              label="WhatsApp / Mobile Number"
              placeholder="9876543210"
              value={formMobile}
              onChange={(e) => setFormMobile(e.target.value)}
            />
            <Input
              label="Bank Name (For Partner Payouts)"
              placeholder="HDFC Bank"
              value={formBankName}
              onChange={(e) => setFormBankName(e.target.value)}
            />
            <Input
              label="Bank Account Number"
              value={formAccountNo}
              onChange={(e) => setFormAccountNo(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsPartnerModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {editingPartner ? 'Update Partner' : 'Save Partner'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* RECORD PARTNER PAYOUT / DRAWING / CAPITAL MODAL                */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isTxModalOpen}
        onClose={() => setIsTxModalOpen(false)}
        title="Record Partner Payout, Drawing or Capital Entry"
        description="Updates the partner's capital or current account balance with full audit history"
        maxWidth="lg"
      >
        <form onSubmit={handleRecordTransaction} className="space-y-4">
          <Select
            label="Select Partner"
            required
            value={txPartnerId}
            onChange={(e) => setTxPartnerId(e.target.value)}
            options={[
              { value: '', label: '-- Select Partner --' },
              ...activePartners.map((p) => ({
                value: p.id,
                label: `${p.name} (${p.profit_share_percent}% Share)`,
              })),
            ]}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Transaction Type"
              value={txType}
              onChange={(e) => setTxType(e.target.value as PartnerTransactionType)}
              options={[
                { value: 'PROFIT_PAYOUT', label: 'Profit Share Payout / Distribution' },
                { value: 'DRAWING', label: 'Partner Drawing (Personal Withdrawal)' },
                { value: 'REMUNERATION_PAYOUT', label: 'Partner Salary / Remuneration Payout' },
                { value: 'CAPITAL_INJECTION', label: 'Additional Capital Injection (+)' },
                { value: 'CAPITAL_WITHDRAWAL', label: 'Capital Reduction / Withdrawal (-)' },
              ]}
            />
            <Input
              label="Transaction Date"
              type="date"
              required
              value={txDate}
              onChange={(e) => setTxDate(e.target.value)}
            />
            <Input
              label="Amount (INR)"
              type="number"
              step="any"
              required
              min="1"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
            />
            <Select
              label="Payment Mode"
              value={txMode}
              onChange={(e) => setTxMode(e.target.value as PaymentMode)}
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer (NEFT/RTGS/IMPS)' },
                { value: 'UPI', label: 'UPI' },
                { value: 'Cheque', label: 'Cheque' },
                { value: 'Cash', label: 'Cash' },
              ]}
            />
          </div>

          <Input
            label="UTR / Reference Number"
            placeholder="e.g., HDFC2510128891"
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
          />

          <Input
            label="Remarks / Narration"
            placeholder="e.g., Q3 Profit distribution settlement"
            value={txNotes}
            onChange={(e) => setTxNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsTxModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={submitting}>
              Record Partner Entry
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
