import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FileCheck2,
  Plus,
  Search,
  Download,
  Printer,
  Truck,
  Users,
  MapPin,
  Calendar,
  AlertCircle,
  FileText,
  CheckSquare,
  Square,
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
import { generateChallanPDF } from '@/lib/pdfGenerator';
import { Challan, Rental, Customer, Machine, ChallanType } from '@/types';

interface AccessoryItem {
  item: string;
  quantity: number;
  included: boolean;
}

const DEFAULT_ACCESSORIES: AccessoryItem[] = [
  { item: 'Full Body Safety Harness (ISI Certified)', quantity: 2, included: true },
  { item: 'Platform Control Box / Joystick Pendant', quantity: 1, included: true },
  { item: 'Key Set (Ignition & Ground Control)', quantity: 2, included: true },
  { item: 'Battery Charger Cable / Plug (if electric/hybrid)', quantity: 1, included: true },
  { item: 'OEM Operator & Safety Manual', quantity: 1, included: true },
  { item: 'Outrigger Pads / Ground Mats (Set of 4)', quantity: 4, included: true },
];

export const ChallansPage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();
  const [searchParams] = useSearchParams();

  const [challans, setChallans] = useState<Challan[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formNumber, setFormNumber] = useState('');
  const [formType, setFormType] = useState<ChallanType>('DELIVERY');
  const [formRentalId, setFormRentalId] = useState(searchParams.get('rentalId') || '');
  const [formCustomerId, setFormCustomerId] = useState(searchParams.get('customerId') || '');
  const [formMachineId, setFormMachineId] = useState(searchParams.get('machineId') || '');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formSiteAddress, setFormSiteAddress] = useState('');
  const [formCondition, setFormCondition] = useState(
    'Inspected and tested. Engine, hydraulics, basket levelling and safety brakes in 100% operational order.'
  );
  const [formDeliveredBy, setFormDeliveredBy] = useState('');
  const [formAcknowledgedBy, setFormAcknowledgedBy] = useState('');
  const [formDamageNotes, setFormDamageNotes] = useState('');
  const [formAdditionalCharges, setFormAdditionalCharges] = useState('0');
  const [accessories, setAccessories] = useState<AccessoryItem[]>(DEFAULT_ACCESSORIES);

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: chlData } = await supabase
        .from('challans')
        .select('*, customer:customers(*), machine:machines(*), rental:rentals(*)')
        .eq('company_id', company.id)
        .order('date', { ascending: false });

      if (chlData) setChallans(chlData as Challan[]);

      const { data: rentData } = await supabase
        .from('rentals')
        .select('*, customer:customers(*), machine:machines(*)')
        .eq('company_id', company.id);

      if (rentData) setRentals(rentData as Rental[]);

      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false);

      if (custData) setCustomers(custData as Customer[]);

      const { data: machData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false);

      if (machData) setMachines(machData as Machine[]);
    } catch (err) {
      console.error('Error fetching challans:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Autofill rental details when rental selected
  useEffect(() => {
    if (formRentalId) {
      const r = rentals.find((rent) => rent.id === formRentalId);
      if (r) {
        setFormCustomerId(r.customer_id);
        setFormMachineId(r.machine_id);
        setFormSiteAddress(r.site_location);
        setFormAcknowledgedBy(r.customer?.contact_person || 'Site Engineer');
      }
    }
  }, [formRentalId, rentals]);

  const handleOpenAddModal = (type: ChallanType) => {
    setFormType(type);
    const prefix = type === 'DELIVERY' ? 'DC' : 'RC';
    setFormNumber(`${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCondition(
      type === 'DELIVERY'
        ? 'Inspected and certified in 100% operational condition at dispatch.'
        : 'Returned from customer site and offloaded at yard.'
    );
    setFormDeliveredBy(company?.name || 'Transport Driver');
    setFormAcknowledgedBy('');
    setFormDamageNotes('');
    setFormAdditionalCharges('0');
    setAccessories(DEFAULT_ACCESSORIES);
    setIsModalOpen(true);
  };

  const handleSaveChallan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formRentalId || !formCustomerId || !formMachineId) {
      addToast('Please select a valid rental contract.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        challan_number: formNumber,
        challan_type: formType,
        rental_id: formRentalId,
        customer_id: formCustomerId,
        machine_id: formMachineId,
        date: formDate,
        site_address: formSiteAddress,
        machine_condition: formCondition,
        accessories_list: accessories,
        delivered_or_returned_by: formDeliveredBy || null,
        customer_acknowledged_by: formAcknowledgedBy || null,
        damage_notes: formDamageNotes || null,
        additional_charges: Number(formAdditionalCharges) || 0,
      };

      const { error } = await supabase.from('challans').insert(payload);
      if (error) throw error;

      addToast(`${formType === 'DELIVERY' ? 'Delivery' : 'Return'} Challan "${formNumber}" issued.`, 'success');
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving challan:', err);
      addToast(err.message || 'Failed to issue challan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = (chl: Challan) => {
    if (!company) return;
    const doc = generateChallanPDF(chl, company);
    const filename = `Challan_${chl.challan_number}.pdf`;
    doc.save(filename);
    addToast(`Downloaded ${filename}`, 'success');
  };

  // Print PDF
  const handlePrintPDF = (chl: Challan) => {
    if (!company) return;
    const doc = generateChallanPDF(chl, company);
    doc.autoPrint();
    const pdfBlobUrl = doc.output('bloburl');
    window.open(pdfBlobUrl, '_blank');
  };

  const filteredChallans = useMemo(() => {
    return challans.filter((chl) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        chl.challan_number.toLowerCase().includes(s) ||
        (chl.customer?.name && chl.customer.name.toLowerCase().includes(s)) ||
        (chl.machine?.machine_name && chl.machine.machine_name.toLowerCase().includes(s)) ||
        chl.site_address.toLowerCase().includes(s);

      const matchesType = typeFilter === 'ALL' || chl.challan_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [challans, searchTerm, typeFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Delivery & Return Challans</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Site dispatch receipts, equipment condition inspections, accessories checklist, and return sign-offs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenAddModal('RETURN')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Issue Return Challan
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleOpenAddModal('DELIVERY')}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Issue Delivery Challan
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search challans by Challan #, Customer, Machine, Worksite..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Challans' },
              { value: 'DELIVERY', label: 'Delivery / Dispatch Challans' },
              { value: 'RETURN', label: 'Return / Offloading Challans' },
            ]}
          />
        </div>
      </Card>

      {/* Challans Table */}
      {loading ? (
        <LoadingSpinner message="Loading equipment challans..." />
      ) : filteredChallans.length === 0 ? (
        <EmptyState
          icon={<FileCheck2 className="w-8 h-8" />}
          title="No Challans Found"
          description="Issue your first site delivery challan with equipment accessories checklist."
          actionLabel="+ Issue Delivery Challan"
          onAction={() => handleOpenAddModal('DELIVERY')}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Challan #</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">Customer & Site</th>
                  <th className="py-3.5 px-4">Machine</th>
                  <th className="py-3.5 px-4">Dispatched / Received By</th>
                  <th className="py-3.5 px-4 text-center">PDF Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredChallans.map((chl) => (
                  <tr key={chl.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600 font-mono">
                      {chl.challan_number}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={chl.challan_type === 'DELIVERY' ? 'info' : 'purple'}
                        size="sm"
                      >
                        {chl.challan_type}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">{formatDate(chl.date)}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                        {chl.customer?.name}
                      </span>
                      <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                        {chl.site_address}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[150px]">
                        {chl.machine?.machine_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {chl.machine?.machine_id_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="block">{chl.delivered_or_returned_by || 'Transport'}</span>
                      {chl.customer_acknowledged_by && (
                        <span className="text-[10px] text-emerald-600 block">
                          Ack: {chl.customer_acknowledged_by}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleDownloadPDF(chl)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Download Challan PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintPDF(chl)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Print Challan"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Issue Challan Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formType === 'DELIVERY' ? 'Issue Site Delivery Challan' : 'Issue Equipment Return Challan'}
        description="Checklist for equipment dispatch, accessories, and customer site sign-off"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveChallan} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Challan Number"
              required
              value={formNumber}
              onChange={(e) => setFormNumber(e.target.value)}
            />

            <Input
              label="Date of Dispatch / Return"
              type="date"
              required
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />

            <div className="sm:col-span-2">
              <Select
                label="Associated Rental Contract"
                required
                value={formRentalId}
                onChange={(e) => setFormRentalId(e.target.value)}
                options={[
                  { value: '', label: '-- Select Active Rental Contract --' },
                  ...rentals.map((r) => ({
                    value: r.id,
                    label: `${r.rental_code} - ${r.customer?.name} (${r.machine?.machine_name}) [Site: ${r.site_location}]`,
                  })),
                ]}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Site / Destination Address"
                required
                value={formSiteAddress}
                onChange={(e) => setFormSiteAddress(e.target.value)}
              />
            </div>

            <Input
              label="Delivered / Returned By"
              placeholder="e.g. Ramesh Patil (Trailer Driver / Tech)"
              value={formDeliveredBy}
              onChange={(e) => setFormDeliveredBy(e.target.value)}
            />

            <Input
              label="Customer Acknowledged By"
              placeholder="e.g. Site Engineer / Safety Officer"
              value={formAcknowledgedBy}
              onChange={(e) => setFormAcknowledgedBy(e.target.value)}
            />

            <div className="sm:col-span-2">
              <Input
                label="Machine Operational Condition"
                required
                value={formCondition}
                onChange={(e) => setFormCondition(e.target.value)}
              />
            </div>

            {formType === 'RETURN' && (
              <>
                <div className="sm:col-span-2">
                  <Input
                    label="Damage / Breakdown Notes (if any on return)"
                    placeholder="e.g. Scratches on counterweight, bent platform guardrail."
                    value={formDamageNotes}
                    onChange={(e) => setFormDamageNotes(e.target.value)}
                  />
                </div>
                <Input
                  label="Additional Penalty / Repair Charges (INR)"
                  type="number"
                  value={formAdditionalCharges}
                  onChange={(e) => setFormAdditionalCharges(e.target.value)}
                />
              </>
            )}
          </div>

          {/* Accessories Checklist */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Equipment Accessories & Tooling Handover Checklist:
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {accessories.map((acc, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    const newAcc = [...accessories];
                    newAcc[idx].included = !newAcc[idx].included;
                    setAccessories(newAcc);
                  }}
                  className="flex items-center justify-between p-1.5 rounded hover:bg-slate-100 text-xs cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    {acc.included ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                    <span className={acc.included ? 'font-medium text-slate-800' : 'text-slate-400'}>
                      {acc.item}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">Qty: {acc.quantity}</span>
                </div>
              ))}
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
              Issue Challan & Generate PDF
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
