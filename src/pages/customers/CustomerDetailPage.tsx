import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building,
  Receipt,
  CreditCard,
  CalendarCheck,
  Clock,
  Send,
  Plus,
  FileText,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { formatCurrency, formatDate } from '@/lib/utils';
import { generateInvoiceWhatsAppMessage, openWhatsAppLink } from '@/lib/whatsapp';
import { Customer, Invoice, Rental, Payment, BankAccount } from '@/types';

export const CustomerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { company } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [primaryBank, setPrimaryBank] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id || !company?.id) return;

    const loadCustomerData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Customer
        const { data: cData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', id)
          .eq('company_id', company.id)
          .single();

        if (cData) setCustomer(cData as Customer);

        // 2. Fetch Customer Invoices
        const { data: invData } = await supabase
          .from('invoices')
          .select('*, machine:machines(*)')
          .eq('customer_id', id)
          .eq('company_id', company.id)
          .order('invoice_date', { ascending: false });

        if (invData) setInvoices(invData as Invoice[]);

        // 3. Fetch Customer Rentals
        const { data: rData } = await supabase
          .from('rentals')
          .select('*, machine:machines(*)')
          .eq('customer_id', id)
          .eq('company_id', company.id)
          .order('start_date', { ascending: false });

        if (rData) setRentals(rData as Rental[]);

        // 4. Fetch Customer Payments
        const { data: pData } = await supabase
          .from('payments')
          .select('*')
          .eq('customer_id', id)
          .eq('company_id', company.id)
          .order('payment_date', { ascending: false });

        if (pData) setPayments(pData as Payment[]);

        // 5. Fetch primary bank for whatsapp reminder
        const { data: bData } = await supabase
          .from('bank_accounts')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_primary', true)
          .maybeSingle();

        if (bData) setPrimaryBank(bData as BankAccount);
      } catch (err) {
        console.error('Error loading customer:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCustomerData();
  }, [id, company?.id]);

  if (loading) {
    return <LoadingSpinner message="Loading customer statement & contracts..." size="lg" />;
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-bold text-slate-800">Customer Not Found</h3>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/customers')}>
          Back to Directory
        </Button>
      </div>
    );
  }

  // Financial summary
  const totalInvoiced = invoices
    .filter((inv) => inv.status !== 'Cancelled')
    .reduce((sum, inv) => sum + Number(inv.grand_total || 0), 0);

  const totalPaid = payments
    .filter((p) => !p.is_reversal)
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const totalTDS = payments
    .filter((p) => !p.is_reversal)
    .reduce((sum, p) => sum + Number(p.tds_deducted || 0), 0);

  const totalOutstanding = invoices
    .filter((inv) => inv.status !== 'Paid' && inv.status !== 'Cancelled')
    .reduce((sum, inv) => sum + Number(inv.balance_due || 0), 0);

  const handleSendWhatsAppReminder = (inv: Invoice) => {
    if (!company) return;
    const msg = generateInvoiceWhatsAppMessage(inv, company, primaryBank || undefined);
    openWhatsAppLink(customer.mobile, msg);
    addToast(`Prepared WhatsApp reminder for ${customer.name}.`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/customers')}
            className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">{customer.name}</h2>
              {customer.gstin ? (
                <Badge variant="purple" size="sm">
                  GSTIN: {customer.gstin}
                </Badge>
              ) : (
                <Badge variant="outline" size="sm">
                  Unregistered
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Contact: {customer.contact_person || 'N/A'} | Tel: {customer.mobile} | State:{' '}
              {customer.state} ({customer.state_code})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/rentals?customerId=${customer.id}`)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            New Rental
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/invoices?customerId=${customer.id}`)}
            leftIcon={<FileText className="w-3.5 h-3.5" />}
          >
            Create Invoice
          </Button>
        </div>
      </div>

      {/* Financial Statement Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatCurrency(totalInvoiced)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Gross GST invoices</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-emerald-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Collected</span>
            <CreditCard className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-extrabold text-emerald-600">{formatCurrency(totalPaid)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Bank & cash remittances</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-purple-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">TDS Receivable</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-extrabold text-slate-900">{formatCurrency(totalTDS)}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">TDS 194C / 194I deducted</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Outstanding Due</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div
            className={`text-xl font-extrabold ${
              totalOutstanding > 0 ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {formatCurrency(totalOutstanding)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Current pending balance</span>
        </Card>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>Invoices & Payment Reminders</CardTitle>
        </CardHeader>
        {invoices.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No invoices issued to this customer yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Invoice #</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3 text-right">Taxable</th>
                  <th className="py-2.5 px-3 text-right">Grand Total</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">WhatsApp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-blue-600">
                      {inv.invoice_number}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{formatDate(inv.invoice_date)}</td>
                    <td className="py-2.5 px-3 text-slate-700">
                      {inv.machine?.machine_name || 'Boom Lift'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-700">
                      {formatCurrency(inv.taxable_amount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(inv.grand_total)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      <span className={inv.balance_due > 0 ? 'text-amber-600' : 'text-slate-400'}>
                        {formatCurrency(inv.balance_due)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
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
                    <td className="py-2.5 px-3 text-center">
                      {inv.balance_due > 0 && (
                        <button
                          onClick={() => handleSendWhatsAppReminder(inv)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors text-[11px] font-semibold cursor-pointer"
                          title="Generate WhatsApp Payment Reminder"
                        >
                          <Send className="w-3 h-3" /> Remind
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

      {/* Rentals History */}
      <Card>
        <CardHeader>
          <CardTitle>Rental Contracts History</CardTitle>
        </CardHeader>
        {rentals.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No equipment contracts found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Rental ID</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Site Location</th>
                  <th className="py-2.5 px-3">Duration</th>
                  <th className="py-2.5 px-3 text-right">Monthly Rental</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rentals.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-semibold text-blue-600">{r.rental_code}</td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {r.machine?.machine_name || 'Machine'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{r.site_location}</td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {formatDate(r.start_date)} – {formatDate(r.expected_end_date)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCurrency(r.monthly_rental)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
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
    </div>
  );
};
