import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Download,
  Send,
  CheckCircle2,
  ArrowRight,
  Truck,
  MapPin,
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
import { generateQuotationPDF } from '@/lib/pdfGenerator';
import { openWhatsAppLink } from '@/lib/whatsapp';
import { Quotation, Customer, Machine, QuotationStatus } from '@/types';

export const QuotationsPage: React.FC = () => {
  const { company, user } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formQuoteNo, setFormQuoteNo] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formValidUntil, setFormValidUntil] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formMachineId, setFormMachineId] = useState('');
  const [formEquipDesc, setFormEquipDesc] = useState('JLG 1350SJP Telescopic Boom Lift');
  const [formHeight, setFormHeight] = useState('135 ft');
  const [formSiteLocation, setFormSiteLocation] = useState('');
  const [formMonthlyRate, setFormMonthlyRate] = useState('210000');
  const [formWorkingTerms, setFormWorkingTerms] = useState(
    '10+1 hrs per shift for 26 working days per month'
  );
  const [formMobTransport, setFormMobTransport] = useState('15000');
  const [formDemobTransport, setFormDemobTransport] = useState('15000');
  const [formOperatorCharges, setFormOperatorCharges] = useState('25000');
  const [formSecurityDeposit, setFormSecurityDeposit] = useState('0');
  const [formGstRate, setFormGstRate] = useState('18.00');
  const [formPaymentTerms, setFormPaymentTerms] = useState(
    'After Invoice Submission within 30 days'
  );
  const [formNotes, setFormNotes] = useState(
    'Diesel & safe site working platform to be provided by client.\nMachine mobilization upon receipt of confirmed Work Order / LOI.'
  );

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [qRes, cRes, mRes] = await Promise.all([
        supabase
          .from('quotations')
          .select('*, customer:customers(*), machine:machines(*)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
        supabase
          .from('machines')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
      ]);

      if (qRes.data) setQuotations(qRes.data as Quotation[]);
      if (cRes.data) setCustomers(cRes.data as Customer[]);
      if (mRes.data) setMachines(mRes.data as Machine[]);
    } catch (err) {
      console.error('Error loading quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Autofill machine description & rate when machine selected
  useEffect(() => {
    if (formMachineId) {
      const m = machines.find((mach) => mach.id === formMachineId);
      if (m) {
        setFormEquipDesc(`${m.brand} ${m.model} (${m.machine_name})`);
        setFormHeight(m.height_capacity || '');
        if (m.monthly_rental_rate > 0) {
          setFormMonthlyRate(String(m.monthly_rental_rate));
        }
      }
    }
  }, [formMachineId, machines]);

  const handleOpenCreate = () => {
    const fy = new Date().getFullYear();
    setFormQuoteNo(`QTN/${fy}-${(fy + 1).toString().slice(2)}/${Math.floor(100 + Math.random() * 900)}`);
    if (customers[0]) {
      setFormCustomerId(customers[0].id);
      setFormSiteLocation(customers[0].site_address || customers[0].city || '');
    }
    if (machines[0]) {
      setFormMachineId(machines[0].id);
    }
    setIsModalOpen(true);
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formCustomerId) {
      addToast('Please select a customer.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('quotations').insert({
        company_id: company.id,
        quotation_number: formQuoteNo.trim(),
        quotation_date: formDate,
        valid_until: formValidUntil,
        customer_id: formCustomerId,
        machine_id: formMachineId || null,
        equipment_description: formEquipDesc.trim(),
        working_height: formHeight.trim() || null,
        site_location: formSiteLocation.trim() || 'Client Project Site',
        monthly_rental_rate: Number(formMonthlyRate) || 0,
        working_terms: formWorkingTerms.trim(),
        transport_mobilization: Number(formMobTransport) || 0,
        transport_demobilization: Number(formDemobTransport) || 0,
        operator_charges: Number(formOperatorCharges) || 0,
        security_deposit: Number(formSecurityDeposit) || 0,
        gst_rate: Number(formGstRate) || 18,
        payment_terms: formPaymentTerms.trim(),
        notes: formNotes.trim(),
        status: 'Sent',
        created_by: user?.id || null,
      });

      if (error) throw error;
      addToast(`Quotation "${formQuoteNo}" created!`, 'success');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to create quotation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 1-Click Convert Quotation to Active Rental Agreement
  const handleConvertToRental = async (q: Quotation) => {
    if (!company?.id) return;
    const machId = q.machine_id || machines.find((m) => m.status === 'Available')?.id || machines[0]?.id;
    if (!machId) {
      addToast('Please add at least one machine in Fleet before converting to a Rental Contract.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const rentalCode = `RNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const start = new Date().toISOString().split('T')[0];
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data: createdRental, error: rErr } = await supabase
        .from('rentals')
        .insert({
          company_id: company.id,
          rental_code: rentalCode,
          customer_id: q.customer_id,
          machine_id: machId,
          site_location: q.site_location,
          start_date: start,
          expected_end_date: end,
          monthly_rental: q.monthly_rental_rate,
          security_deposit: q.security_deposit,
          transportation_charges: Number(q.transport_mobilization || 0) + Number(q.transport_demobilization || 0),
          operator_charges: q.operator_charges,
          other_charges: 0,
          billing_frequency: 'Monthly',
          gst_rate: q.gst_rate,
          payment_terms: q.payment_terms,
          notes: `Converted from Quotation ${q.quotation_number} (${q.working_terms})`,
          status: 'Active',
          created_by: user?.id || null,
        })
        .select()
        .single();

      if (rErr) throw rErr;

      await supabase
        .from('quotations')
        .update({ status: 'Converted' as QuotationStatus, converted_rental_id: createdRental.id })
        .eq('id', q.id);

      await supabase
        .from('machines')
        .update({ status: 'Rented', current_location: q.site_location })
        .eq('id', machId);

      addToast(`Quotation converted to Active Rental Contract ${rentalCode}!`, 'success');
      navigate('/rentals');
    } catch (err: any) {
      addToast(err.message || 'Failed to convert quotation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPDF = (q: Quotation) => {
    if (!company) return;
    const doc = generateQuotationPDF(q, company);
    doc.save(`Quotation_${q.quotation_number.replace(/[\/\\]/g, '_')}.pdf`);
    addToast('Downloaded Commercial Quotation PDF', 'success');
  };

  const handleSendWhatsApp = (q: Quotation) => {
    const mobile = q.customer?.mobile;
    if (!mobile) {
      addToast('Customer mobile number not found.', 'warning');
      return;
    }
    const text =
      `*${company?.name || 'LiftLedger'} — Commercial Rental Offer*\n` +
      `Quotation No: *${q.quotation_number}*\n` +
      `Equipment: *${q.equipment_description}* (${q.working_height || ''})\n` +
      `Site: ${q.site_location}\n` +
      `Monthly Rental Rate: *${formatCurrency(q.monthly_rental_rate)}* + GST (${q.gst_rate}%)\n` +
      `Working Hours: ${q.working_terms}\n` +
      (q.operator_charges > 0 ? `Operator Charges: ${formatCurrency(q.operator_charges)}/mo\n` : '') +
      `Payment Terms: ${q.payment_terms}`;

    openWhatsAppLink(mobile, text);
  };

  if (loading) {
    return <LoadingSpinner message="Loading commercial quotations..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Commercial Quotations & Offer Letters
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Send professional Boom Lift rental offers (with Shift/Overtime & Mobilization terms) and convert to Active Rentals in 1 click
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Quotation
        </Button>
      </div>

      {quotations.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-8 h-8" />}
          title="No Commercial Quotations Issued Yet"
          description="Create your first Boom Lift rental quotation with PDF export and 1-click conversion into an Active Rental Contract."
          actionLabel="+ Create Quotation"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Quotation #</th>
                  <th className="py-3.5 px-4">Client & Site</th>
                  <th className="py-3.5 px-4">Equipment & Shift Terms</th>
                  <th className="py-3.5 px-4 text-right">Monthly Rate</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions & Convert</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {q.quotation_number}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {formatDate(q.quotation_date)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{q.customer?.name}</span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" /> {q.site_location}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">{q.equipment_description}</span>
                      <span className="text-[10px] text-slate-500">{q.working_terms}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(q.monthly_rental_rate)}
                      <span className="block text-[10px] text-slate-400">+ {q.gst_rate}% GST</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          q.status === 'Converted'
                            ? 'success'
                            : q.status === 'Approved'
                            ? 'info'
                            : 'default'
                        }
                        size="sm"
                      >
                        {q.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(q)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 cursor-pointer"
                          title="Download Quotation PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(q)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 cursor-pointer"
                          title="Share on WhatsApp"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                        {q.status !== 'Converted' && (
                          <button
                            onClick={() => handleConvertToRental(q)}
                            disabled={submitting}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                            title="Convert to Active Rental Contract"
                          >
                            Convert to Rental <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Quotation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Issue Commercial Boom Lift Rental Quotation"
        description="Generates a formal PDF Offer Letter with shift rules, mobilization charges, and proprietor E-Sign"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateQuotation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Quotation Number"
              required
              value={formQuoteNo}
              onChange={(e) => setFormQuoteNo(e.target.value)}
            />
            <Input
              label="Quotation Date"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
            <Input
              label="Valid Until"
              type="date"
              required
              value={formValidUntil}
              onChange={(e) => setFormValidUntil(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Client / Customer"
              required
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              options={[
                { value: '', label: '-- Select Customer * --' },
                ...customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <Select
              label="Select Fleet Machine (Optional)"
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
              options={[
                { value: '', label: '-- Any / General Boom Lift --' },
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} (${m.height_capacity})`,
                })),
              ]}
            />
            <Input
              label="Equipment Description"
              required
              value={formEquipDesc}
              onChange={(e) => setFormEquipDesc(e.target.value)}
            />
            <Input
              label="Working Height / Capacity"
              value={formHeight}
              onChange={(e) => setFormHeight(e.target.value)}
            />
            <Input
              label="Project Site Location"
              required
              value={formSiteLocation}
              onChange={(e) => setFormSiteLocation(e.target.value)}
            />
            <Input
              label="Monthly Rental Rate (INR)"
              type="number"
              step="any"
              required
              value={formMonthlyRate}
              onChange={(e) => setFormMonthlyRate(e.target.value)}
            />
            <Input
              label="Working Shift Terms"
              value={formWorkingTerms}
              onChange={(e) => setFormWorkingTerms(e.target.value)}
            />
            <Input
              label="Operator Salary / Charges (INR)"
              type="number"
              step="any"
              value={formOperatorCharges}
              onChange={(e) => setFormOperatorCharges(e.target.value)}
            />
            <Input
              label="Mobilization Transport (INR)"
              type="number"
              step="any"
              value={formMobTransport}
              onChange={(e) => setFormMobTransport(e.target.value)}
            />
            <Input
              label="Demobilization Transport (INR)"
              type="number"
              step="any"
              value={formDemobTransport}
              onChange={(e) => setFormDemobTransport(e.target.value)}
            />
          </div>

          <Input
            label="Payment Terms"
            value={formPaymentTerms}
            onChange={(e) => setFormPaymentTerms(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Create Quotation
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
