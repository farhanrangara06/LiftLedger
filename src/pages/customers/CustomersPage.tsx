import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  Building,
  Eye,
  Edit,
  Archive,
  CreditCard,
  Receipt,
  FileCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, INDIAN_STATES } from '@/lib/utils';
import { Customer } from '@/types';

export const CustomersPage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerBalances, setCustomerBalances] = useState<Record<string, { invoiced: number; paid: number; balance: number }>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formContactPerson, setFormContactPerson] = useState('');
  const [formMobile, setFormMobile] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formGstin, setFormGstin] = useState('');
  const [formBillingAddress, setFormBillingAddress] = useState('');
  const [formSiteAddress, setFormSiteAddress] = useState('');
  const [formStateCode, setFormStateCode] = useState('27');
  const [formCity, setFormCity] = useState('');
  const [formPincode, setFormPincode] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const loadCustomers = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: custList, error } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (!error && custList) {
        setCustomers(custList as Customer[]);

        // Calculate balances from invoices
        const { data: invList } = await supabase
          .from('invoices')
          .select('customer_id, grand_total, paid_amount, balance_due, status')
          .eq('company_id', company.id)
          .neq('status', 'Cancelled');

        const balances: Record<string, { invoiced: number; paid: number; balance: number }> = {};
        (invList || []).forEach((inv) => {
          if (!balances[inv.customer_id]) {
            balances[inv.customer_id] = { invoiced: 0, paid: 0, balance: 0 };
          }
          balances[inv.customer_id].invoiced += Number(inv.grand_total || 0);
          balances[inv.customer_id].paid += Number(inv.paid_amount || 0);
          balances[inv.customer_id].balance += Number(inv.balance_due || 0);
        });

        setCustomerBalances(balances);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, [company?.id]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormContactPerson('');
    setFormMobile('');
    setFormEmail('');
    setFormGstin('');
    setFormBillingAddress('');
    setFormSiteAddress('');
    setFormStateCode(company?.state_code || '27');
    setFormCity(company?.city || '');
    setFormPincode('');
    setFormNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormName(c.name);
    setFormContactPerson(c.contact_person || '');
    setFormMobile(c.mobile);
    setFormEmail(c.email || '');
    setFormGstin(c.gstin || '');
    setFormBillingAddress(c.billing_address);
    setFormSiteAddress(c.site_address || '');
    setFormStateCode(c.state_code);
    setFormCity(c.city);
    setFormPincode(c.pincode || '');
    setFormNotes(c.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSubmitting(true);

    try {
      const stateObj = INDIAN_STATES.find((s) => s.code === formStateCode);
      const payload = {
        company_id: company.id,
        name: formName.trim(),
        contact_person: formContactPerson.trim() || null,
        mobile: formMobile.trim(),
        email: formEmail.trim() || null,
        gstin: formGstin.trim().toUpperCase() || null,
        billing_address: formBillingAddress.trim(),
        site_address: formSiteAddress.trim() || null,
        state: stateObj?.name || 'Maharashtra',
        state_code: formStateCode,
        city: formCity.trim(),
        pincode: formPincode.trim() || null,
        notes: formNotes.trim() || null,
      };

      if (editingCustomer) {
        const { error } = await supabase
          .from('customers')
          .update(payload)
          .eq('id', editingCustomer.id);
        if (error) throw error;
        addToast(`Customer "${formName}" updated successfully.`, 'success');
      } else {
        const { error } = await supabase.from('customers').insert(payload);
        if (error) throw error;
        addToast(`Customer "${formName}" added successfully.`, 'success');
      }

      setIsModalOpen(false);
      loadCustomers();
    } catch (err: any) {
      console.error('Error saving customer:', err);
      addToast(err.message || 'Failed to save customer.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (cust: Customer) => {
    if (!confirm(`Are you sure you want to archive "${cust.name}"? Historical invoices and rentals are preserved.`)) {
      return;
    }
    try {
      const { error } = await supabase
        .from('customers')
        .update({ is_archived: true })
        .eq('id', cust.id);

      if (error) throw error;
      addToast(`Customer "${cust.name}" archived.`, 'info');
      loadCustomers();
    } catch (err: any) {
      addToast(err.message || 'Failed to archive customer.', 'error');
    }
  };

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const s = searchTerm.toLowerCase();
      return (
        c.name.toLowerCase().includes(s) ||
        (c.contact_person && c.contact_person.toLowerCase().includes(s)) ||
        c.mobile.includes(s) ||
        (c.gstin && c.gstin.toLowerCase().includes(s)) ||
        c.city.toLowerCase().includes(s)
      );
    });
  }, [customers, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Customer Accounts & CRM</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Client directory, GST billing profiles, site contacts, and outstanding ledger balances
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenAdd} leftIcon={<Plus className="w-4 h-4" />}>
          Add Customer
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="p-4">
        <Input
          placeholder="Search customers by company name, contact person, mobile, GSTIN, city..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          leftIcon={<Search className="w-4 h-4" />}
        />
      </Card>

      {/* Customers List */}
      {loading ? (
        <LoadingSpinner message="Loading customer directory & ledgers..." />
      ) : filteredCustomers.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          title="No Customers Found"
          description={
            searchTerm
              ? 'No clients match your search query.'
              : 'Add your rental clients to start creating contracts, delivery challans, and GST invoices.'
          }
          actionLabel="+ Add First Customer"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Customer / Enterprise</th>
                  <th className="py-3.5 px-4">Contact Person & Phone</th>
                  <th className="py-3.5 px-4">GSTIN & State</th>
                  <th className="py-3.5 px-4">City / Region</th>
                  <th className="py-3.5 px-4 text-right">Invoiced Total</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCustomers.map((c) => {
                  const bal = customerBalances[c.id] || { invoiced: 0, paid: 0, balance: 0 };
                  return (
                    <tr
                      key={c.id}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                    >
                      <td
                        className="py-3.5 px-4"
                        onClick={() => navigate(`/customers/${c.id}`)}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 font-bold shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
                              {c.name}
                            </span>
                            {c.email && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">
                                {c.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-slate-800 block">
                          {c.contact_person || '—'}
                        </span>
                        <span className="text-slate-500 font-mono text-[11px] flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {c.mobile}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-slate-800 font-semibold block">
                          {c.gstin || 'Unregistered'}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {c.state} ({c.state_code})
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">{c.city}</td>
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                        {formatCurrency(bal.invoiced)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold">
                        <span className={bal.balance > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          {formatCurrency(bal.balance)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => navigate(`/customers/${c.id}`)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="View Customer Profile & Ledger"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Edit Customer"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleArchive(c)}
                            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Archive Customer"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Customer Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCustomer ? 'Edit Customer Information' : 'Add New Customer Profile'}
        description="Company details, GSTIN for tax invoicing, and primary site contact"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <Input
                label="Customer / Enterprise Legal Name"
                required
                placeholder="e.g. Larsen & Toubro Construction Ltd."
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <Input
              label="Contact Person / Site Engineer"
              placeholder="e.g. Vikram Joshi"
              value={formContactPerson}
              onChange={(e) => setFormContactPerson(e.target.value)}
            />

            <Input
              label="Mobile Number (for WhatsApp Alerts)"
              required
              placeholder="e.g. 9820012345"
              value={formMobile}
              onChange={(e) => setFormMobile(e.target.value)}
            />

            <Input
              label="Email Address"
              type="email"
              placeholder="accounts@clientcorp.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
            />

            <Input
              label="GSTIN (15 Digits)"
              placeholder="e.g. 27AABCL1234E1Z8"
              value={formGstin}
              onChange={(e) => setFormGstin(e.target.value)}
              maxLength={15}
              helperText="Determines Intra-state (CGST+SGST) vs Inter-state (IGST)"
            />

            <Select
              label="Customer State (GST Place of Supply)"
              required
              value={formStateCode}
              onChange={(e) => setFormStateCode(e.target.value)}
              options={INDIAN_STATES.map((s) => ({
                value: s.code,
                label: `${s.code} - ${s.name}`,
              }))}
            />

            <Input
              label="City"
              required
              placeholder="e.g. Pune / Mumbai"
              value={formCity}
              onChange={(e) => setFormCity(e.target.value)}
            />

            <Input
              label="PIN Code"
              placeholder="e.g. 411001"
              value={formPincode}
              onChange={(e) => setFormPincode(e.target.value)}
              maxLength={6}
            />

            <div className="sm:col-span-2">
              <Input
                label="Registered Billing Address"
                required
                placeholder="e.g. Tower 3, Cybercity, Magarpatta"
                value={formBillingAddress}
                onChange={(e) => setFormBillingAddress(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Primary Works / Delivery Site Address (Optional)"
                placeholder="e.g. Metro Rail Line 3 Station Site, BKC"
                value={formSiteAddress}
                onChange={(e) => setFormSiteAddress(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Commercial Notes"
                placeholder="e.g. Requires monthly billing cycle on 1st of every month."
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
              {editingCustomer ? 'Update Profile' : 'Save Customer'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
