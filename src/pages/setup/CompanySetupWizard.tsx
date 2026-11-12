import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Landmark,
  Layers,
  CheckCircle2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Truck,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { MachineCategory } from '@/types';
import { INDIAN_STATES } from '@/lib/utils';

export const CompanySetupWizard: React.FC = () => {
  const { user, profile, refreshAuth } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: Company Details
  const [companyName, setCompanyName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [pan, setPan] = useState('');
  const [selectedState, setSelectedState] = useState('27'); // Maharashtra default code
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [mobile, setMobile] = useState('');
  const [companyEmail, setCompanyEmail] = useState(user?.email || '');
  const [logoUrl, setLogoUrl] = useState('');

  // Step 2: Bank Details
  const [bankName, setBankName] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');
  const [upiId, setUpiId] = useState('');

  // Step 3: Owner-Selected Machine Categories
  const [standardCategories, setStandardCategories] = useState<MachineCategory[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [customCategories, setCustomCategories] = useState<
    Array<{ name: string; description: string; default_height: string }>
  >([]);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomDesc, setNewCustomDesc] = useState('');
  const [newCustomHeight, setNewCustomHeight] = useState('');
  const [showAddCustom, setShowAddCustom] = useState(false);

  // Load standard master categories from Supabase
  useEffect(() => {
    const fetchMasterCategories = async () => {
      const { data, error } = await supabase
        .from('machine_categories')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!error && data) {
        setStandardCategories(data);
      }
    };
    fetchMasterCategories();
  }, []);

  // Autofill account holder from company name if empty
  useEffect(() => {
    if (companyName && !accountHolderName) {
      setAccountHolderName(companyName);
    }
  }, [companyName, accountHolderName]);

  const toggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
  };

  const handleAddCustomCategory = () => {
    if (!newCustomName.trim()) return;
    setCustomCategories((prev) => [
      ...prev,
      {
        name: newCustomName.trim(),
        description: newCustomDesc.trim() || 'Custom boom lift equipment category',
        default_height: newCustomHeight.trim() || 'Variable',
      },
    ]);
    setNewCustomName('');
    setNewCustomDesc('');
    setNewCustomHeight('');
    setShowAddCustom(false);
  };

  const handleFinishSetup = async () => {
    if (selectedCategoryIds.length === 0 && customCategories.length === 0) {
      setErrorMsg('Please select at least one machine category your company operates.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const stateObj = INDIAN_STATES.find((s) => s.code === selectedState);

      const selectedStandard = standardCategories.filter((cat) =>
        selectedCategoryIds.includes(cat.id)
      );

      const categoriesPayload = [
        ...selectedStandard.map((c) => ({
          category_id: c.id,
          name: c.name,
          description: c.description || '',
        })),
        ...customCategories.map((c) => ({
          category_id: null,
          name: c.name,
          description: c.description || '',
        })),
      ];

      // Call atomic complete_company_setup RPC
      const { data: rpcResult, error: rpcErr } = await supabase.rpc('complete_company_setup', {
        p_name: companyName.trim(),
        p_business_address: businessAddress.trim(),
        p_gstin: gstin.trim().toUpperCase() || null,
        p_pan: pan.trim().toUpperCase() || null,
        p_state: stateObj?.name || 'Maharashtra',
        p_state_code: selectedState,
        p_city: city.trim(),
        p_pincode: pincode.trim() || null,
        p_mobile: mobile.trim(),
        p_email: companyEmail.trim(),
        p_logo_url: logoUrl || null,
        p_bank_name: bankName.trim() || null,
        p_account_holder_name: accountHolderName.trim() || companyName.trim(),
        p_account_number: accountNumber.trim() || null,
        p_ifsc_code: ifscCode.trim().toUpperCase() || null,
        p_branch_name: branchName.trim() || null,
        p_upi_id: upiId.trim() || null,
        p_categories: categoriesPayload,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Failed to complete company onboarding.');
      }

      await refreshAuth();
      addToast('Company setup successfully completed! Welcome to LiftLedger.', 'success');
      navigate('/', { replace: true });
    } catch (err: any) {
      console.error('Setup error:', err);
      setErrorMsg(err.message || 'An error occurred during company registration.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-lg mb-3">
            <Truck className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Company Onboarding & Setup
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Configure your boom lift rental enterprise and specify machine categories
          </p>
        </div>

        {/* Steps Progress Indicator */}
        <div className="mb-8 flex items-center justify-between relative max-w-xl mx-auto">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          
          {/* Step 1 Pill */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 1
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              1
            </div>
            <span className="text-[11px] font-semibold text-slate-700 mt-1">Company Profile</span>
          </div>

          {/* Step 2 Pill */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 2
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              2
            </div>
            <span className="text-[11px] font-semibold text-slate-700 mt-1">Bank Details</span>
          </div>

          {/* Step 3 Pill */}
          <div className="relative z-10 flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= 3
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              3
            </div>
            <span className="text-[11px] font-semibold text-slate-700 mt-1">Machine Categories</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-sm text-rose-700 shadow-xs">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Wizard Card Body */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 p-6 sm:p-8">
          {/* ================= STEP 1: COMPANY PROFILE ================= */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  Business & GST Identity
                </h3>
                <p className="text-xs text-slate-500">
                  Enter your official registered firm information for GST invoices and challans
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <Input
                    label="Company / Enterprise Name"
                    required
                    placeholder="e.g. Apex High-Reach Equipment Rentals LLP"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Input
                    label="Registered Business Address"
                    required
                    placeholder="e.g. Plot 42, MIDC Industrial Area, Phase II"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>

                <Input
                  label="GSTIN (15 Digits)"
                  placeholder="e.g. 27AABCA1234F1Z5"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  maxLength={15}
                  helperText="Required for GST tax invoicing"
                />

                <Input
                  label="PAN Number"
                  placeholder="e.g. AABCA1234F"
                  value={pan}
                  onChange={(e) => setPan(e.target.value)}
                  maxLength={10}
                />

                <Select
                  label="Registered State (GST Code)"
                  required
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  options={INDIAN_STATES.map((s) => ({
                    value: s.code,
                    label: `${s.code} - ${s.name}`,
                  }))}
                />

                <Input
                  label="City"
                  required
                  placeholder="e.g. Mumbai / Pune"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />

                <Input
                  label="PIN Code"
                  placeholder="e.g. 400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  maxLength={6}
                />

                <Input
                  label="Mobile Number"
                  required
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                />

                <div className="sm:col-span-2">
                  <Input
                    label="Company Billing Email"
                    type="email"
                    required
                    placeholder="billing@apexrentals.com"
                    value={companyEmail}
                    onChange={(e) => setCompanyEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!companyName.trim() || !businessAddress.trim() || !city.trim() || !mobile.trim()) {
                      setErrorMsg('Please fill in all mandatory fields (Company Name, Address, City, Mobile).');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(2);
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next: Bank Details
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 2: BANK DETAILS ================= */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 mb-4">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-blue-600" />
                  Primary Settlement Bank Account
                </h3>
                <p className="text-xs text-slate-500">
                  Printed automatically on customer tax invoices for direct RTGS/NEFT/UPI remittance
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Bank Name"
                  required
                  placeholder="e.g. HDFC Bank / ICICI Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />

                <Input
                  label="Account Holder Name"
                  required
                  placeholder="e.g. Apex High-Reach Equipment Rentals"
                  value={accountHolderName}
                  onChange={(e) => setAccountHolderName(e.target.value)}
                />

                <Input
                  label="Account Number"
                  required
                  placeholder="e.g. 50200012345678"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                />

                <Input
                  label="IFSC Code"
                  required
                  placeholder="e.g. HDFC0001234"
                  value={ifscCode}
                  onChange={(e) => setIfscCode(e.target.value)}
                  maxLength={11}
                />

                <Input
                  label="Branch Name"
                  placeholder="e.g. Andheri East Commercial Branch"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                />

                <Input
                  label="Company UPI ID (Optional)"
                  placeholder="e.g. apexrentals@okaxis"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (!bankName.trim() || !accountNumber.trim() || !ifscCode.trim()) {
                      setErrorMsg('Please enter Bank Name, Account Number, and IFSC code.');
                      return;
                    }
                    setErrorMsg(null);
                    setStep(3);
                  }}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next: Machine Categories
                </Button>
              </div>
            </div>
          )}

          {/* ================= STEP 3: OWNER-SELECTED MACHINE CATEGORIES ================= */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-3 mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-600" />
                    Select Boom Lift & Equipment Categories Owned/Managed
                  </h3>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Mandatory Selection
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Select only the categories of equipment your company owns or leases out. You can also add custom categories. Only selected categories will appear in machine registration and rental contracts.
                </p>
              </div>

              {/* Category Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {standardCategories.map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  return (
                    <div
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`relative p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{cat.name}</h4>
                          <span className="inline-block mt-1 text-[11px] font-semibold text-blue-600 bg-blue-100/60 px-2 py-0.5 rounded">
                            {cat.default_height || 'Variable'}
                          </span>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                        {cat.description}
                      </p>
                    </div>
                  );
                })}

                {/* Custom Categories Added by Owner */}
                {customCategories.map((custom, idx) => (
                  <div
                    key={idx}
                    className="relative p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50/40 shadow-xs"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900">{custom.name}</h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Custom
                          </span>
                        </div>
                        <span className="inline-block mt-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded">
                          {custom.default_height}
                        </span>
                      </div>
                      <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 mt-2">{custom.description}</p>
                  </div>
                ))}
              </div>

              {/* Add Custom Category Trigger */}
              {!showAddCustom ? (
                <button
                  type="button"
                  onClick={() => setShowAddCustom(true)}
                  className="w-full py-3 px-4 border border-dashed border-slate-300 rounded-xl text-xs font-semibold text-blue-600 hover:bg-blue-50/50 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  + Add Custom Equipment Category (e.g. Spider Lift, Mast Climber, Truck Mounted)
                </button>
              ) : (
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 space-y-3">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Add Custom Category
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Category Name"
                      placeholder="e.g. Spider Lift (Track Mounted)"
                      value={newCustomName}
                      onChange={(e) => setNewCustomName(e.target.value)}
                    />
                    <Input
                      label="Working Reach / Height"
                      placeholder="e.g. 70 ft (21m)"
                      value={newCustomHeight}
                      onChange={(e) => setNewCustomHeight(e.target.value)}
                    />
                    <div className="sm:col-span-2">
                      <Input
                        label="Description"
                        placeholder="e.g. Compact crawler lift with non-marking rubber tracks for fragile indoor flooring"
                        value={newCustomDesc}
                        onChange={(e) => setNewCustomDesc(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setShowAddCustom(false)}>
                      Cancel
                    </Button>
                    <Button variant="primary" size="sm" onClick={handleAddCustomCategory}>
                      Save Custom Category
                    </Button>
                  </div>
                </div>
              )}

              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5 text-xs text-amber-800">
                <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Note:</strong> You can add or deactivate machine categories anytime later from{' '}
                  <strong>Company Settings</strong>. Deactivating a category will never delete historical machines, rentals or invoices.
                </span>
              </div>

              {/* Wizard Actions */}
              <div className="pt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back
                </Button>
                <Button
                  variant="success"
                  size="md"
                  onClick={handleFinishSetup}
                  isLoading={loading}
                  rightIcon={<CheckCircle2 className="w-4 h-4" />}
                >
                  Finish Setup & Launch LiftLedger
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
