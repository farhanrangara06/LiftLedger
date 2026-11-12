import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck,
  Plus,
  Search,
  Filter,
  Truck,
  Users,
  MapPin,
  Calendar,
  DollarSign,
  AlertCircle,
  Clock,
  CheckCircle,
  FileText,
  FileCheck2,
  ArrowRight,
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
import { Rental, Customer, Machine, RentalStatus } from '@/types';

export const RentalsPage: React.FC = () => {
  const { company, role } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [rentals, setRentals] = useState<Rental[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Create Form State
  const [formRentalCode, setFormRentalCode] = useState('');
  const [formCustomerId, setFormCustomerId] = useState(searchParams.get('customerId') || '');
  const [formMachineId, setFormMachineId] = useState('');
  const [formSiteLocation, setFormSiteLocation] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formEndDate, setFormEndDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formMonthlyRental, setFormMonthlyRental] = useState('0');
  const [formSecurityDeposit, setFormSecurityDeposit] = useState('0');
  const [formTransportCharges, setFormTransportCharges] = useState('0');
  const [formOperatorCharges, setFormOperatorCharges] = useState('0');
  const [formBillingFreq, setFormBillingFreq] = useState<'Monthly' | 'Weekly' | 'Daily' | 'One-time'>('Monthly');
  const [formGstRate, setFormGstRate] = useState('18.00');
  const [formPaymentTerms, setFormPaymentTerms] = useState('30 days net from invoice date');
  const [formNotes, setFormNotes] = useState('');
  const [overlapWarning, setOverlapWarning] = useState<string | null>(null);

  // Extend State
  const [newEndDate, setNewEndDate] = useState('');
  const [extensionNotes, setExtensionNotes] = useState('');

  // Close State
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [closeNotes, setCloseNotes] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Rentals
      const { data: rentData } = await supabase
        .from('rentals')
        .select('*, customer:customers(*), machine:machines(*)')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      if (rentData) setRentals(rentData as Rental[]);

      // 2. Fetch Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (custData) setCustomers(custData as Customer[]);

      // 3. Fetch Machines
      const { data: machData } = await supabase
        .from('machines')
        .select('*, category:company_machine_categories(*)')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('machine_name', { ascending: true });

      if (machData) setMachines(machData as Machine[]);
    } catch (err) {
      console.error('Error fetching rentals:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  // Autofill monthly rental rate and check site when machine selected
  useEffect(() => {
    if (formMachineId) {
      const selectedM = machines.find((m) => m.id === formMachineId);
      if (selectedM) {
        setFormMonthlyRental(String(selectedM.monthly_rental_rate || 0));
      }
    }
  }, [formMachineId, machines]);

  // Autofill site address from customer if available
  useEffect(() => {
    if (formCustomerId && !formSiteLocation) {
      const selectedC = customers.find((c) => c.id === formCustomerId);
      if (selectedC?.site_address) {
        setFormSiteLocation(selectedC.site_address);
      }
    }
  }, [formCustomerId, customers, formSiteLocation]);

  // Overlap check validation
  useEffect(() => {
    if (!formMachineId || !formStartDate || !formEndDate) {
      setOverlapWarning(null);
      return;
    }

    const machineObj = machines.find((m) => m.id === formMachineId);
    if (machineObj?.status === 'Under Maintenance') {
      setOverlapWarning('This machine is currently Under Maintenance and cannot be rented!');
      return;
    }
    if (machineObj?.status === 'Inactive') {
      setOverlapWarning('This machine is Inactive and cannot be rented!');
      return;
    }

    // Check existing active rentals for date overlap
    const conflict = rentals.find((r) => {
      if (r.machine_id !== formMachineId || r.status !== 'Active') return false;
      const startA = new Date(formStartDate);
      const endA = new Date(formEndDate);
      const startB = new Date(r.start_date);
      const endB = new Date(r.expected_end_date);
      return startA <= endB && endA >= startB;
    });

    if (conflict) {
      setOverlapWarning(
        `Machine is already booked under active contract ${conflict.rental_code} (${formatDate(conflict.start_date)} to ${formatDate(conflict.expected_end_date)}). Please choose another machine or adjust dates.`
      );
    } else {
      setOverlapWarning(null);
    }
  }, [formMachineId, formStartDate, formEndDate, rentals, machines]);

  const handleOpenCreateModal = () => {
    setFormRentalCode(`RNT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    setFormCustomerId(customers[0]?.id || '');
    setFormMachineId('');
    setFormSiteLocation('');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormEndDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    setFormMonthlyRental('0');
    setFormSecurityDeposit('50000');
    setFormTransportCharges('15000');
    setFormOperatorCharges('0');
    setFormBillingFreq('Monthly');
    setFormGstRate('18.00');
    setFormPaymentTerms('15 days from invoice date');
    setFormNotes('');
    setOverlapWarning(null);
    setIsCreateModalOpen(true);
  };

  const handleCreateRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (overlapWarning) {
      addToast(overlapWarning, 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        rental_code: formRentalCode,
        customer_id: formCustomerId,
        machine_id: formMachineId,
        site_location: formSiteLocation,
        start_date: formStartDate,
        expected_end_date: formEndDate,
        monthly_rental: Number(formMonthlyRental) || 0,
        security_deposit: Number(formSecurityDeposit) || 0,
        transportation_charges: Number(formTransportCharges) || 0,
        operator_charges: Number(formOperatorCharges) || 0,
        billing_frequency: formBillingFreq,
        gst_rate: Number(formGstRate) || 18.0,
        payment_terms: formPaymentTerms,
        notes: formNotes || null,
        status: 'Active' as RentalStatus,
      };

      const { data: createdRental, error: rentErr } = await supabase
        .from('rentals')
        .insert(payload)
        .select()
        .single();

      if (rentErr) throw rentErr;

      // Update machine status to 'Rented'
      await supabase
        .from('machines')
        .update({ status: 'Rented', current_location: formSiteLocation })
        .eq('id', formMachineId);

      // Log to rental_history
      if (createdRental) {
        await supabase.from('rental_history').insert({
          company_id: company.id,
          rental_id: createdRental.id,
          event_type: 'CREATED',
          notes: `Rental contract initiated for site ${formSiteLocation} at ${formatCurrency(Number(formMonthlyRental))}/month.`,
        });
      }

      addToast(`Rental contract "${formRentalCode}" created successfully.`, 'success');
      setIsCreateModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error creating rental:', err);
      addToast(err.message || 'Failed to create rental.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Extend Rental
  const handleExtendRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental || !company?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          expected_end_date: newEndDate,
          notes: selectedRental.notes
            ? `${selectedRental.notes}\n[Extended to ${newEndDate}: ${extensionNotes}]`
            : `Extended to ${newEndDate}: ${extensionNotes}`,
        })
        .eq('id', selectedRental.id);

      if (error) throw error;

      await supabase.from('rental_history').insert({
        company_id: company.id,
        rental_id: selectedRental.id,
        event_type: 'EXTENDED',
        notes: `Contract extended to ${formatDate(newEndDate)}. Reason: ${extensionNotes}`,
      });

      addToast(`Rental ${selectedRental.rental_code} extended to ${formatDate(newEndDate)}.`, 'success');
      setIsExtendModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to extend rental.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Close Rental
  const handleCloseRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental || !company?.id) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('rentals')
        .update({
          status: 'Completed',
          actual_end_date: returnDate,
          notes: selectedRental.notes
            ? `${selectedRental.notes}\n[Closed on ${returnDate}: ${closeNotes}]`
            : `Closed on ${returnDate}: ${closeNotes}`,
        })
        .eq('id', selectedRental.id);

      if (error) throw error;

      // Update machine status back to 'Available'
      await supabase
        .from('machines')
        .update({ status: 'Available', current_location: 'Central Yard' })
        .eq('id', selectedRental.machine_id);

      await supabase.from('rental_history').insert({
        company_id: company.id,
        rental_id: selectedRental.id,
        event_type: 'CLOSED',
        notes: `Machine returned on ${formatDate(returnDate)}. Contract closed.`,
      });

      addToast(`Rental ${selectedRental.rental_code} closed. Machine is now Available.`, 'success');
      setIsCloseModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to close rental.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        r.rental_code.toLowerCase().includes(s) ||
        (r.customer?.name && r.customer.name.toLowerCase().includes(s)) ||
        (r.machine?.machine_name && r.machine.machine_name.toLowerCase().includes(s)) ||
        r.site_location.toLowerCase().includes(s);

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rentals, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Rental Contracts & Site Deployments</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage hire agreements, prevent machine booking overlaps, extend tenures, and issue challans
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreateModal}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          New Rental Contract
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by Rental ID, Customer, Machine, Site Location..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Contracts' },
              { value: 'Active', label: 'Active Deployments' },
              { value: 'Completed', label: 'Completed / Returned' },
              { value: 'On Hold', label: 'On Hold' },
              { value: 'Draft', label: 'Draft' },
            ]}
          />
        </div>
      </Card>

      {/* Rentals Table */}
      {loading ? (
        <LoadingSpinner message="Loading rental contracts..." />
      ) : filteredRentals.length === 0 ? (
        <EmptyState
          icon={<CalendarCheck className="w-8 h-8" />}
          title="No Rental Contracts Found"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'No contracts match the selected search criteria.'
              : 'Create your first boom lift rental contract to start monthly billing.'
          }
          actionLabel="+ New Rental Contract"
          onAction={handleOpenCreateModal}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Contract #</th>
                  <th className="py-3.5 px-4">Customer & Site</th>
                  <th className="py-3.5 px-4">Machine Deployed</th>
                  <th className="py-3.5 px-4">Rental Period</th>
                  <th className="py-3.5 px-4 text-right">Monthly Rate</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions & Challans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRentals.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      {r.rental_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block truncate max-w-[150px]">
                        {r.customer?.name}
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5 truncate max-w-[150px]">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        {r.site_location}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[150px]">
                        {r.machine?.machine_name}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {r.machine?.machine_id_code} • {r.machine?.height_capacity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-800 block">
                        {formatDate(r.start_date)} to {formatDate(r.expected_end_date)}
                      </span>
                      {r.actual_end_date && (
                        <span className="text-[10px] text-emerald-600 block">
                          Returned: {formatDate(r.actual_end_date)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(r.monthly_rental)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          r.status === 'Active'
                            ? 'success'
                            : r.status === 'Completed'
                            ? 'default'
                            : 'warning'
                        }
                        size="sm"
                      >
                        {r.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {r.status === 'Active' && (
                          <>
                            <button
                              onClick={() => {
                                setSelectedRental(r);
                                setNewEndDate(
                                  new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
                                    .toISOString()
                                    .split('T')[0]
                                );
                                setExtensionNotes('');
                                setIsExtendModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-[11px] transition-colors cursor-pointer"
                              title="Extend Contract Tenure"
                            >
                              Extend
                            </button>
                            <button
                              onClick={() => {
                                setSelectedRental(r);
                                setReturnDate(new Date().toISOString().split('T')[0]);
                                setCloseNotes('');
                                setIsCloseModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold text-[11px] transition-colors cursor-pointer"
                              title="Close Rental & Return Machine"
                            >
                              Close
                            </button>
                          </>
                        )}
                        <button
                          onClick={() =>
                            navigate(
                              `/invoices?rentalId=${r.id}&customerId=${r.customer_id}&machineId=${r.machine_id}`
                            )
                          }
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition-colors cursor-pointer"
                          title="Generate GST Tax Invoice"
                        >
                          Invoice
                        </button>
                        <button
                          onClick={() =>
                            navigate(
                              `/challans?rentalId=${r.id}&customerId=${r.customer_id}&machineId=${r.machine_id}`
                            )
                          }
                          className="px-2 py-1 rounded bg-purple-50 text-purple-700 hover:bg-purple-100 font-semibold text-[11px] transition-colors cursor-pointer"
                          title="Issue Delivery/Return Challan"
                        >
                          Challan
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

      {/* Create Rental Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create Equipment Rental Agreement"
        description="Deploy boom lift to client worksite with terms, security deposit and monthly billing"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateRental} className="space-y-4">
          {overlapWarning && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{overlapWarning}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Contract Reference ID"
              required
              value={formRentalCode}
              onChange={(e) => setFormRentalCode(e.target.value)}
            />

            <Select
              label="Select Customer"
              required
              value={formCustomerId}
              onChange={(e) => setFormCustomerId(e.target.value)}
              options={customers.map((c) => ({ value: c.id, label: c.name }))}
            />

            <div className="sm:col-span-2">
              <Select
                label="Assign Machine (Boom Lift)"
                required
                value={formMachineId}
                onChange={(e) => setFormMachineId(e.target.value)}
                options={[
                  { value: '', label: '-- Choose Available Boom Lift --' },
                  ...machines.map((m) => ({
                    value: m.id,
                    label: `${m.machine_name} [${m.machine_id_code}] • ${m.height_capacity} • ${m.status === 'Available' ? '🟢 Available' : `🔴 ${m.status}`}`,
                  })),
                ]}
                helperText="Inactive or Under Maintenance machines cannot be selected."
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Deployment Worksite Address"
                required
                placeholder="e.g. Metro Rail Line 3 Station Site, BKC, Mumbai"
                value={formSiteLocation}
                onChange={(e) => setFormSiteLocation(e.target.value)}
              />
            </div>

            <Input
              label="Start Date"
              type="date"
              required
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
            />

            <Input
              label="Expected End Date"
              type="date"
              required
              value={formEndDate}
              onChange={(e) => setFormEndDate(e.target.value)}
            />

            <Input
              label="Monthly Base Rental Rate (INR)"
              type="number"
              required
              value={formMonthlyRental}
              onChange={(e) => setFormMonthlyRental(e.target.value)}
            />

            <Input
              label="Refundable Security Deposit (INR)"
              type="number"
              value={formSecurityDeposit}
              onChange={(e) => setFormSecurityDeposit(e.target.value)}
            />

            <Input
              label="Mobilization / Transportation Charges (INR)"
              type="number"
              value={formTransportCharges}
              onChange={(e) => setFormTransportCharges(e.target.value)}
            />

            <Input
              label="Certified Operator Charges / Month (INR)"
              type="number"
              value={formOperatorCharges}
              onChange={(e) => setFormOperatorCharges(e.target.value)}
            />

            <Select
              label="Billing Frequency"
              value={formBillingFreq}
              onChange={(e) => setFormBillingFreq(e.target.value as any)}
              options={[
                { value: 'Monthly', label: 'Monthly Advance / Arrears' },
                { value: 'Weekly', label: 'Weekly' },
                { value: 'Daily', label: 'Daily Rental' },
                { value: 'One-time', label: 'One-time Project Lumpsum' },
              ]}
            />

            <Input
              label="Applicable GST Rate (%)"
              type="number"
              value={formGstRate}
              onChange={(e) => setFormGstRate(e.target.value)}
            />

            <div className="sm:col-span-2">
              <Input
                label="Commercial Terms & Conditions"
                value={formPaymentTerms}
                onChange={(e) => setFormPaymentTerms(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              isLoading={submitting}
              disabled={!!overlapWarning || !formMachineId || !formCustomerId}
            >
              Confirm & Activate Contract
            </Button>
          </div>
        </form>
      </Modal>

      {/* Extend Rental Modal */}
      <Modal
        isOpen={isExtendModalOpen}
        onClose={() => setIsExtendModalOpen(false)}
        title={`Extend Rental Contract: ${selectedRental?.rental_code}`}
        description="Update expected completion date and log extension amendment"
        maxWidth="md"
      >
        <form onSubmit={handleExtendRental} className="space-y-4">
          <Input
            label="New Expected End Date"
            type="date"
            required
            value={newEndDate}
            onChange={(e) => setNewEndDate(e.target.value)}
          />
          <Input
            label="Reason / Extension Notes"
            placeholder="e.g. Customer site excavation work extended by 1 month."
            value={extensionNotes}
            onChange={(e) => setExtensionNotes(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsExtendModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Extension
            </Button>
          </div>
        </form>
      </Modal>

      {/* Close Rental Modal */}
      <Modal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        title={`Close Rental: ${selectedRental?.rental_code}`}
        description="Mark machine returned and release asset back into Available fleet"
        maxWidth="md"
      >
        <form onSubmit={handleCloseRental} className="space-y-4">
          <Input
            label="Actual Machine Return Date"
            type="date"
            required
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
          />
          <Input
            label="Closing Inspection Remarks"
            placeholder="e.g. Returned to Central Yard. Machine verified undamaged."
            value={closeNotes}
            onChange={(e) => setCloseNotes(e.target.value)}
          />
          <div className="p-3 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
            Closing this contract will automatically change machine <strong>{selectedRental?.machine?.machine_name}</strong> status back to <strong>Available</strong>.
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="ghost" onClick={() => setIsCloseModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" isLoading={submitting}>
              Close Contract & Release Machine
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
