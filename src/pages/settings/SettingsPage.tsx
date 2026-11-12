import React, { useState, useEffect } from 'react';
import {
  Settings,
  Building2,
  Landmark,
  Layers,
  FileText,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
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
import { SignaturePadInput } from '@/components/ui/SignaturePadInput';
import { INDIAN_STATES } from '@/lib/utils';
import { Company, CompanySettings, BankAccount, CompanyMachineCategory, MachineCategory } from '@/types';

export const SettingsPage: React.FC = () => {
  const { company, role, refreshAuth } = useAuth();
  const { addToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'COMPANY' | 'BANKS' | 'CATEGORIES' | 'TERMS'>('COMPANY');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company Form
  const [companyName, setCompanyName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [msmeNumber, setMsmeNumber] = useState('');
  const [stateCode, setStateCode] = useState('27');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');

  // Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [bankName, setBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');

  // Categories
  const [categories, setCategories] = useState<CompanyMachineCategory[]>([]);
  const [masterCategories, setMasterCategories] = useState<MachineCategory[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [selectedMasterId, setSelectedMasterId] = useState('');

  // Terms & Tax Settings
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [invPrefix, setInvPrefix] = useState('INV');
  const [defaultTaxRate, setDefaultTaxRate] = useState('18.00');
  const [defaultSac, setDefaultSac] = useState('997312');
  const [invTerms, setInvTerms] = useState('');
  const [rentalTerms, setRentalTerms] = useState('');
  const [challanTerms, setChallanTerms] = useState('');

  const loadSettingsData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Company
      setCompanyName(company.name);
      setBusinessAddress(company.business_address || '');
      setGstin(company.gstin || '');
      setPan(company.pan || '');
      setMsmeNumber(company.msme_number || '');
      setStateCode(company.state_code || '27');
      setCity(company.city || '');
      setPincode(company.pincode || '');
      setMobile(company.mobile || '');
      setEmail(company.email || '');
      setLogoUrl(company.logo_url || '');
      setSignatureUrl(company.signature_url || '');

      // 2. Bank Accounts
      const { data: bData } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', company.id)
        .order('is_primary', { ascending: false });

      if (bData) setBankAccounts(bData as BankAccount[]);

      // 3. Company Machine Categories
      const { data: cData } = await supabase
        .from('company_machine_categories')
        .select('*')
        .eq('company_id', company.id)
        .order('name', { ascending: true });

      if (cData) setCategories(cData as CompanyMachineCategory[]);

      // 4. Master Categories
      const { data: mData } = await supabase
        .from('machine_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (mData) setMasterCategories(mData as MachineCategory[]);

      // 5. Company Settings
      const { data: sData } = await supabase
        .from('company_settings')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (sData) {
        setSettings(sData as CompanySettings);
        setInvPrefix(sData.invoice_prefix || 'INV');
        setDefaultTaxRate(String(sData.default_tax_rate || 18));
        setDefaultSac(sData.default_sac_code || '997312');
        setInvTerms(sData.invoice_terms || '');
        setRentalTerms(sData.rental_terms || '');
        setChallanTerms(sData.challan_terms || '');
      }
    } catch (err) {
      console.error('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, [company?.id]);

  // Save Company Details
  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    try {
      const stateObj = INDIAN_STATES.find((s) => s.code === stateCode);
      const { error } = await supabase
        .from('companies')
        .update({
          name: companyName,
          business_address: businessAddress,
          gstin: gstin.toUpperCase(),
          pan: pan.toUpperCase(),
          msme_number: msmeNumber.toUpperCase() || null,
          state: stateObj?.name || 'Maharashtra',
          state_code: stateCode,
          city: city,
          pincode: pincode,
          mobile: mobile,
          email: email,
          logo_url: logoUrl || null,
          signature_url: signatureUrl || null,
        })
        .eq('id', company.id);

      if (error) throw error;
      await refreshAuth();
      addToast('Company profile updated successfully.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update company profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Add Bank Account
  const handleAddBank = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    try {
      const isFirst = bankAccounts.length === 0;
      const { error } = await supabase.from('bank_accounts').insert({
        company_id: company.id,
        bank_name: bankName,
        account_holder_name: accountHolder || companyName,
        account_number: accountNumber,
        ifsc_code: ifscCode.toUpperCase(),
        branch_name: branchName,
        upi_id: upiId,
        is_primary: isFirst,
        is_active: true,
      });

      if (error) throw error;
      addToast('Bank account added.', 'success');
      setIsBankModalOpen(false);
      setBankName('');
      setAccountNumber('');
      setIfscCode('');
      setBranchName('');
      setUpiId('');
      loadSettingsData();
    } catch (err: any) {
      addToast(err.message || 'Failed to add bank account.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Set Bank Primary
  const handleSetPrimaryBank = async (bankId: string) => {
    if (!company?.id) return;
    try {
      await supabase
        .from('bank_accounts')
        .update({ is_primary: false })
        .eq('company_id', company.id);

      await supabase
        .from('bank_accounts')
        .update({ is_primary: true })
        .eq('id', bankId);

      addToast('Primary bank account updated.', 'success');
      loadSettingsData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update primary bank.', 'error');
    }
  };

  // Add Category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !newCatName.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase.from('company_machine_categories').insert({
        company_id: company.id,
        category_id: selectedMasterId || null,
        name: newCatName.trim(),
        description: newCatDesc.trim() || null,
        is_active: true,
      });

      if (error) throw error;
      addToast(`Category "${newCatName}" added.`, 'success');
      setIsCategoryModalOpen(false);
      setNewCatName('');
      setNewCatDesc('');
      setSelectedMasterId('');
      loadSettingsData();
    } catch (err: any) {
      addToast(err.message || 'Failed to add category.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Toggle Category Active / Inactive (Preserves historical data!)
  const handleToggleCategoryActive = async (cat: CompanyMachineCategory) => {
    try {
      const { error } = await supabase
        .from('company_machine_categories')
        .update({ is_active: !cat.is_active })
        .eq('id', cat.id);

      if (error) throw error;
      addToast(
        `Category "${cat.name}" is now ${!cat.is_active ? 'Active' : 'Inactive (Hidden from new dropdowns)'}.`,
        'info'
      );
      loadSettingsData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update category status.', 'error');
    }
  };

  // Save Terms and Taxes
  const handleSaveTerms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('company_settings').upsert({
        company_id: company.id,
        invoice_prefix: invPrefix,
        default_tax_rate: Number(defaultTaxRate) || 18.0,
        default_sac_code: defaultSac,
        invoice_terms: invTerms,
        rental_terms: rentalTerms,
        challan_terms: challanTerms,
      });

      if (error) throw error;
      addToast('Terms and tax settings saved.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Failed to update terms.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading enterprise settings..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Company Profile & Enterprise Settings</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure business identity, bank details, equipment categories, and standard GST invoice terms
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('COMPANY')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'COMPANY'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Company & GST Profile
        </button>
        <button
          onClick={() => setActiveTab('BANKS')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'BANKS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Bank Accounts ({bankAccounts.length})
        </button>
        <button
          onClick={() => setActiveTab('CATEGORIES')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'CATEGORIES'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          Boom Lift Categories ({categories.length})
        </button>
        <button
          onClick={() => setActiveTab('TERMS')}
          className={`py-3 px-5 border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'TERMS'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          Tax & Invoice Terms
        </button>
      </div>

      {/* ================= TAB 1: COMPANY PROFILE ================= */}
      {activeTab === 'COMPANY' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>Business Identification & Tax Details</CardTitle>
          </CardHeader>
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Company / Firm Legal Name"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Registered Business Address"
                  required
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                />
              </div>

              <Input
                label="GSTIN"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                maxLength={15}
              />

              <Input
                label="PAN"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                maxLength={10}
              />

              <Input
                label="MSME / Udyam Registration Number"
                placeholder="e.g., UDYAM-MH-33-0530937"
                value={msmeNumber}
                onChange={(e) => setMsmeNumber(e.target.value)}
              />

              <Select
                label="State (GST Code)"
                required
                value={stateCode}
                onChange={(e) => setStateCode(e.target.value)}
                options={INDIAN_STATES.map((s) => ({
                  value: s.code,
                  label: `${s.code} - ${s.name}`,
                }))}
              />

              <Input
                label="City"
                required
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />

              <Input
                label="PIN Code"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                maxLength={6}
              />

              <Input
                label="Contact Mobile"
                required
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Billing Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <Input
                  label="Company Logo URL"
                  placeholder="https://..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <SignaturePadInput
                  value={signatureUrl}
                  onChange={setSignatureUrl}
                  companyName={companyName || company?.name}
                  label="Proprietor / Authorised E-Signature & Stamp (Auto-attached to all GST Invoices)"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                Save Company Details
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* ================= TAB 2: BANK ACCOUNTS ================= */}
      {activeTab === 'BANKS' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500">
              Bank accounts printed on customer tax invoices for RTGS/NEFT/UPI payment remittance
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setAccountHolder(companyName);
                setIsBankModalOpen(true);
              }}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Bank Account
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {bankAccounts.map((b) => (
              <Card key={b.id} className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{b.bank_name}</h4>
                      <span className="text-[11px] text-slate-400 font-mono">
                        A/C: {b.account_number}
                      </span>
                    </div>
                  </div>
                  {b.is_primary ? (
                    <Badge variant="success" size="sm">
                      Primary
                    </Badge>
                  ) : (
                    <button
                      onClick={() => handleSetPrimaryBank(b.id)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline cursor-pointer"
                    >
                      Make Primary
                    </button>
                  )}
                </div>

                <div className="space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <p>
                    <span className="text-slate-400">Holder:</span> {b.account_holder_name}
                  </p>
                  <p>
                    <span className="text-slate-400">IFSC:</span> <span className="font-mono">{b.ifsc_code}</span>
                  </p>
                  {b.branch_name && (
                    <p>
                      <span className="text-slate-400">Branch:</span> {b.branch_name}
                    </p>
                  )}
                  {b.upi_id && (
                    <p>
                      <span className="text-slate-400">UPI ID:</span> {b.upi_id}
                    </p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Add Bank Modal */}
          <Modal
            isOpen={isBankModalOpen}
            onClose={() => setIsBankModalOpen(false)}
            title="Add Company Settlement Bank Account"
            maxWidth="md"
          >
            <form onSubmit={handleAddBank} className="space-y-4">
              <Input
                label="Bank Name"
                required
                placeholder="e.g. State Bank of India / HDFC"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <Input
                label="Account Holder Name"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
              />
              <Input
                label="Account Number"
                required
                placeholder="e.g. 30982341231"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
              />
              <Input
                label="IFSC Code"
                required
                placeholder="e.g. SBIN0001234"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value)}
                maxLength={11}
              />
              <Input
                label="Branch Name"
                placeholder="e.g. MIDC Industrial Branch"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
              />
              <Input
                label="UPI ID (Optional)"
                placeholder="e.g. yourcompany@okaxis"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="ghost" onClick={() => setIsBankModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={saving}>
                  Save Bank Account
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* ================= TAB 3: MACHINE CATEGORIES ================= */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Owner-Selected Equipment Categories</h3>
              <p className="text-xs text-slate-500">
                Only active categories appear in machine and rental creation dropdowns. Deactivating never deletes historical records.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCategoryModalOpen(true)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Add Category
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className={`p-4 rounded-xl border-2 transition-all flex items-start justify-between ${
                  cat.is_active
                    ? 'border-slate-200 bg-white shadow-xs'
                    : 'border-slate-200 bg-slate-50 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                    <Badge variant={cat.is_active ? 'success' : 'default'} size="sm">
                      {cat.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  {cat.description && (
                    <p className="text-xs text-slate-500 mt-1">{cat.description}</p>
                  )}
                </div>
                <button
                  onClick={() => handleToggleCategoryActive(cat)}
                  className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                >
                  {cat.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            ))}
          </div>

          {/* Add Category Modal */}
          <Modal
            isOpen={isCategoryModalOpen}
            onClose={() => setIsCategoryModalOpen(false)}
            title="Add Machine Category"
            description="Select from standard templates or register a custom equipment category"
            maxWidth="md"
          >
            <form onSubmit={handleAddCategory} className="space-y-4">
              <Select
                label="Choose Standard Template (Optional)"
                value={selectedMasterId}
                onChange={(e) => {
                  setSelectedMasterId(e.target.value);
                  const found = masterCategories.find((m) => m.id === e.target.value);
                  if (found) {
                    setNewCatName(found.name);
                    setNewCatDesc(found.description || '');
                  }
                }}
                options={[
                  { value: '', label: '-- Custom Category / Non-Standard --' },
                  ...masterCategories.map((m) => ({ value: m.id, label: m.name })),
                ]}
              />

              <Input
                label="Category Name"
                required
                placeholder="e.g. Spider Lift (Crawler)"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />

              <Input
                label="Description"
                placeholder="e.g. Track-mounted boom lift for fragile ground"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
              />

              <div className="flex justify-end gap-2 pt-3">
                <Button type="button" variant="ghost" onClick={() => setIsCategoryModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" isLoading={saving}>
                  Save Category
                </Button>
              </div>
            </form>
          </Modal>
        </div>
      )}

      {/* ================= TAB 4: TERMS & TAX SETTINGS ================= */}
      {activeTab === 'TERMS' && (
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle>GST Rates, SAC Codes & Terms and Conditions</CardTitle>
          </CardHeader>
          <form onSubmit={handleSaveTerms} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Invoice Prefix"
                required
                value={invPrefix}
                onChange={(e) => setInvPrefix(e.target.value)}
                helperText="e.g. INV -> INV/2026-27/0001"
              />
              <Input
                label="Default GST Rate (%)"
                required
                type="number"
                value={defaultTaxRate}
                onChange={(e) => setDefaultTaxRate(e.target.value)}
                helperText="Standard equipment rental tax rate"
              />
              <Input
                label="Default SAC Code"
                required
                value={defaultSac}
                onChange={(e) => setDefaultSac(e.target.value)}
                helperText="997312 for Leasing of lifting machinery"
              />
            </div>

            <Input
              label="Default Tax Invoice Terms"
              value={invTerms}
              onChange={(e) => setInvTerms(e.target.value)}
            />

            <Input
              label="Standard Rental Contract Terms"
              value={rentalTerms}
              onChange={(e) => setRentalTerms(e.target.value)}
            />

            <Input
              label="Delivery & Return Challan Terms"
              value={challanTerms}
              onChange={(e) => setChallanTerms(e.target.value)}
            />

            <div className="flex justify-end pt-4 border-t border-slate-100">
              <Button type="submit" variant="primary" isLoading={saving} leftIcon={<Save className="w-4 h-4" />}>
                Save Tax & Terms Settings
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
};
