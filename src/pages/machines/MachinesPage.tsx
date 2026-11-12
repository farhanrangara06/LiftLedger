import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Truck,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Wrench,
  AlertOctagon,
  Eye,
  Edit,
  Copy,
  Trash2,
  FileText,
  DollarSign,
  TrendingUp,
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
import { Machine, CompanyMachineCategory, MachineStatus } from '@/types';

export const MachinesPage: React.FC = () => {
  const { company, role } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [categories, setCategories] = useState<CompanyMachineCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formQuantity, setFormQuantity] = useState<number>(1);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formMachineId, setFormMachineId] = useState('');
  const [formRegNo, setFormRegNo] = useState('');
  const [formSerialNo, setFormSerialNo] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formHeight, setFormHeight] = useState('');
  const [formPurchaseDate, setFormPurchaseDate] = useState('');
  const [formPurchasePrice, setFormPurchasePrice] = useState('0');
  const [formMonthlyRate, setFormMonthlyRate] = useState('0');
  const [formLocation, setFormLocation] = useState('');
  const [formStatus, setFormStatus] = useState<MachineStatus>('Available');
  const [formNotes, setFormNotes] = useState('');
  const [formPhotoUrl, setFormPhotoUrl] = useState('');
  const [formTpiCertNo, setFormTpiCertNo] = useState('');
  const [formTpiExpiry, setFormTpiExpiry] = useState('');
  const [formInsurancePolicyNo, setFormInsurancePolicyNo] = useState('');
  const [formInsuranceExpiry, setFormInsuranceExpiry] = useState('');
  const [formFitnessExpiry, setFormFitnessExpiry] = useState('');

  // Common boom lift presets for rapid entry
  const BOOM_PRESETS = [
    { name: 'Genie SX-135 XC (135 ft Telescopic)', brand: 'Genie', model: 'SX-135 XC', height: '135 ft (41.1 m)', rate: '280000', keywords: ['135', 'telescopic'] },
    { name: 'Genie ZX-135/70 (135 ft Articulated)', brand: 'Genie', model: 'ZX-135/70', height: '135 ft (41.1 m)', rate: '290000', keywords: ['135', 'articulated'] },
    { name: 'JLG 1250AJP (125 ft Articulated)', brand: 'JLG', model: '1250AJP', height: '125 ft (38.1 m)', rate: '260000', keywords: ['120', 'articulated'] },
    { name: 'JLG 1350SJP (135 ft Telescopic)', brand: 'JLG', model: '1350SJP', height: '135 ft (41.1 m)', rate: '280000', keywords: ['135', 'telescopic'] },
    { name: 'Genie SX-150 (150 ft Telescopic)', brand: 'Genie', model: 'SX-150', height: '150 ft (45.7 m)', rate: '350000', keywords: ['150', 'telescopic'] },
    { name: 'JLG 1500SJ (150 ft Telescopic)', brand: 'JLG', model: '1500SJ', height: '150 ft (45.7 m)', rate: '360000', keywords: ['150', 'telescopic'] },
    { name: 'Haulotte HA41 RTJ PRO (135 ft)', brand: 'Haulotte', model: 'HA41 RTJ PRO', height: '135 ft (41.5 m)', rate: '275000', keywords: ['135', 'articulated'] },
    { name: '19ft Electric Scissor Lift', brand: 'Genie / Skyjack', model: 'GS-1930 / SJ3219', height: '19 ft (5.8 m)', rate: '35000', keywords: ['scissor'] },
    { name: '32ft Electric Scissor Lift', brand: 'Genie / Skyjack', model: 'GS-3246 / SJ4632', height: '32 ft (9.8 m)', rate: '55000', keywords: ['scissor'] },
  ];

  const loadFleetData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Company Selected Categories
      const { data: catData } = await supabase
        .from('company_machine_categories')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      setCategories(catData || []);

      // 2. Fetch Machines with Category Join
      const { data: machineData, error } = await supabase
        .from('machines')
        .select('*, category:company_machine_categories(*)')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('created_at', { ascending: false });

      if (!error && machineData) {
        setMachines(machineData as Machine[]);
      }
    } catch (err) {
      console.error('Error fetching machines:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleetData();
  }, [company?.id]);

  const handleOpenAddModal = () => {
    setEditingMachine(null);
    setFormQuantity(1);
    setFormName('');
    setFormCategory(categories[0]?.id || '');
    setFormMachineId(`BL-${Math.floor(100 + Math.random() * 900)}`);
    setFormRegNo('');
    setFormSerialNo('');
    setFormBrand('Genie');
    setFormModel('SX-135 XC');
    setFormHeight('135 ft (41.1m)');
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormPurchasePrice('4500000');
    setFormMonthlyRate('280000');
    setFormLocation('Central Yard / Head Office');
    setFormStatus('Available');
    setFormNotes('');
    setFormPhotoUrl('');
    setFormTpiCertNo('');
    setFormTpiExpiry('');
    setFormInsurancePolicyNo('');
    setFormInsuranceExpiry('');
    setFormFitnessExpiry('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (machine: Machine) => {
    setEditingMachine(machine);
    setFormQuantity(1);
    setFormName(machine.machine_name);
    setFormCategory(machine.category_id);
    setFormMachineId(machine.machine_id_code);
    setFormRegNo(machine.registration_number || '');
    setFormSerialNo(machine.serial_number);
    setFormBrand(machine.brand);
    setFormModel(machine.model);
    setFormHeight(machine.height_capacity);
    setFormPurchaseDate(machine.purchase_date || '');
    setFormPurchasePrice(String(machine.purchase_price || 0));
    setFormMonthlyRate(String(machine.monthly_rental_rate || 0));
    setFormLocation(machine.current_location || '');
    setFormStatus(machine.status);
    setFormNotes(machine.notes || '');
    setFormPhotoUrl(machine.photo_url || '');
    setFormTpiCertNo(machine.tpi_certificate_no || '');
    setFormTpiExpiry(machine.tpi_expiry_date || '');
    setFormInsurancePolicyNo(machine.insurance_policy_no || '');
    setFormInsuranceExpiry(machine.insurance_expiry_date || '');
    setFormFitnessExpiry(machine.fitness_expiry_date || '');
    setIsModalOpen(true);
  };

  // Clone an existing machine to register another unit of the same boom lift
  const handleCloneMachine = (m: Machine) => {
    // Count how many matching units exist to calculate next sequence number
    const baseName = m.machine_name.replace(/\s*#\d+.*$/, '');
    const baseCode = m.machine_id_code.replace(/-\d+.*$/, '');
    const countSame = machines.filter(
      (x) =>
        x.machine_name.toLowerCase().startsWith(baseName.toLowerCase()) ||
        x.model.toLowerCase() === m.model.toLowerCase()
    ).length;
    const nextSeq = countSame + 1;
    const pad = String(nextSeq).padStart(2, '0');

    setEditingMachine(null); // Creating a new machine unit
    setFormQuantity(1);
    setFormName(`${baseName} #${pad}`);
    setFormCategory(m.category_id);
    setFormMachineId(`${baseCode}-${pad}`);
    setFormRegNo('');
    setFormSerialNo(`${baseCode}-SN${pad}`);
    setFormBrand(m.brand);
    setFormModel(m.model);
    setFormHeight(m.height_capacity);
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormPurchasePrice(String(m.purchase_price || 0));
    setFormMonthlyRate(String(m.monthly_rental_rate || 0));
    setFormLocation(m.current_location || 'Central Yard / Head Office');
    setFormStatus('Available');
    setFormNotes(m.notes || '');
    setFormPhotoUrl(m.photo_url || '');
    setFormTpiCertNo('');
    setFormTpiExpiry(m.tpi_expiry_date || '');
    setFormInsurancePolicyNo('');
    setFormInsuranceExpiry(m.insurance_expiry_date || '');
    setFormFitnessExpiry(m.fitness_expiry_date || '');
    setIsModalOpen(true);
    addToast(`Pre-filled specifications from "${m.machine_name}". Adjust ID or serial and save.`, 'info');
  };

  const handleSelectPreset = (presetName: string) => {
    const preset = BOOM_PRESETS.find((p) => p.name === presetName);
    if (!preset) return;
    setFormName(preset.name);
    setFormBrand(preset.brand);
    setFormModel(preset.model);
    setFormHeight(preset.height);
    setFormMonthlyRate(preset.rate);

    // Try finding matching category
    const matchedCategory = categories.find((c) =>
      preset.keywords.some((k) => c.name.toLowerCase().includes(k))
    );
    if (matchedCategory) {
      setFormCategory(matchedCategory.id);
    }
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (!formCategory) {
      addToast('Please select a valid machine category.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      if (editingMachine) {
        // Single update
        const payload = {
          company_id: company.id,
          category_id: formCategory,
          machine_name: formName,
          machine_id_code: formMachineId,
          registration_number: formRegNo || null,
          serial_number: formSerialNo,
          brand: formBrand,
          model: formModel,
          height_capacity: formHeight,
          purchase_date: formPurchaseDate || null,
          purchase_price: Number(formPurchasePrice) || 0,
          monthly_rental_rate: Number(formMonthlyRate) || 0,
          current_location: formLocation || null,
          photo_url: formPhotoUrl || null,
          notes: formNotes || null,
          status: formStatus,
          tpi_certificate_no: formTpiCertNo || null,
          tpi_expiry_date: formTpiExpiry || null,
          insurance_policy_no: formInsurancePolicyNo || null,
          insurance_expiry_date: formInsuranceExpiry || null,
          fitness_expiry_date: formFitnessExpiry || null,
        };

        const { error } = await supabase
          .from('machines')
          .update(payload)
          .eq('id', editingMachine.id);

        if (error) throw error;
        addToast(`Machine "${formName}" updated successfully.`, 'success');
      } else if (formQuantity > 1) {
        // Multi-unit batch insert for fleet owners with multiple identical boom lifts
        const cleanBaseName = formName.replace(/\s*#\d+.*$/, '');
        const cleanBaseCode = formMachineId.replace(/-\d+.*$/, '');
        const payloads = [];

        for (let i = 1; i <= formQuantity; i++) {
          const pad = String(i).padStart(2, '0');
          const unitName = `${cleanBaseName} #${pad}`;
          const unitCode = `${cleanBaseCode}-${pad}`;
          const unitSerial = formSerialNo
            ? `${formSerialNo}-${pad}`
            : `${cleanBaseCode}-SN${pad}`;
          const unitReg = formRegNo ? `${formRegNo} #${pad}` : null;

          payloads.push({
            company_id: company.id,
            category_id: formCategory,
            machine_name: unitName,
            machine_id_code: unitCode,
            registration_number: unitReg,
            serial_number: unitSerial,
            brand: formBrand,
            model: formModel,
            height_capacity: formHeight,
            purchase_date: formPurchaseDate || null,
            purchase_price: Number(formPurchasePrice) || 0,
            monthly_rental_rate: Number(formMonthlyRate) || 0,
            current_location: formLocation || null,
            photo_url: formPhotoUrl || null,
            notes: formNotes || null,
            status: formStatus,
            tpi_certificate_no: formTpiCertNo ? `${formTpiCertNo}-${pad}` : null,
            tpi_expiry_date: formTpiExpiry || null,
            insurance_policy_no: formInsurancePolicyNo ? `${formInsurancePolicyNo}-${pad}` : null,
            insurance_expiry_date: formInsuranceExpiry || null,
            fitness_expiry_date: formFitnessExpiry || null,
          });
        }

        const { error } = await supabase.from('machines').insert(payloads);
        if (error) throw error;
        addToast(
          `Successfully registered ${formQuantity} identical units of "${cleanBaseName}" into your fleet!`,
          'success'
        );
      } else {
        // Single unit insert
        const payload = {
          company_id: company.id,
          category_id: formCategory,
          machine_name: formName,
          machine_id_code: formMachineId,
          registration_number: formRegNo || null,
          serial_number: formSerialNo || `${formMachineId}-SN01`,
          brand: formBrand,
          model: formModel,
          height_capacity: formHeight,
          purchase_date: formPurchaseDate || null,
          purchase_price: Number(formPurchasePrice) || 0,
          monthly_rental_rate: Number(formMonthlyRate) || 0,
          current_location: formLocation || null,
          photo_url: formPhotoUrl || null,
          notes: formNotes || null,
          status: formStatus,
          tpi_certificate_no: formTpiCertNo || null,
          tpi_expiry_date: formTpiExpiry || null,
          insurance_policy_no: formInsurancePolicyNo || null,
          insurance_expiry_date: formInsuranceExpiry || null,
          fitness_expiry_date: formFitnessExpiry || null,
        };

        const { error } = await supabase.from('machines').insert(payload);
        if (error) throw error;
        addToast(`Machine "${formName}" registered successfully.`, 'success');
      }

      setIsModalOpen(false);
      loadFleetData();
    } catch (err: any) {
      console.error('Error saving machine:', err);
      addToast(err.message || 'Failed to save machine.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered machines
  const filteredMachines = useMemo(() => {
    return machines.filter((m) => {
      const matchesSearch =
        m.machine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.machine_id_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.model.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;
      const matchesCategory = categoryFilter === 'ALL' || m.category_id === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [machines, searchTerm, statusFilter, categoryFilter]);

  const getStatusBadge = (status: MachineStatus) => {
    switch (status) {
      case 'Available':
        return <Badge variant="success">Available</Badge>;
      case 'Rented':
        return <Badge variant="info">Rented</Badge>;
      case 'Under Maintenance':
        return <Badge variant="warning">Under Maintenance</Badge>;
      case 'Inactive':
        return <Badge variant="danger">Inactive</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Boom Lift & Fleet Fleet</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage individual machines, categories, current rental status, and asset profitability
          </p>
        </div>
        {role !== 'EMPLOYEE' && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add New Machine
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search by Machine Name, ID, Serial #, Brand, Model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSearchParams({ status: e.target.value });
            }}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'Available', label: 'Available for Hire' },
              { value: 'Rented', label: 'Currently Rented' },
              { value: 'Under Maintenance', label: 'Under Maintenance' },
              { value: 'Inactive', label: 'Inactive / Standby' },
            ]}
          />

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Machine Categories' },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </div>
      </Card>

      {/* Fleet Table or Grid */}
      {loading ? (
        <LoadingSpinner message="Loading fleet database..." />
      ) : filteredMachines.length === 0 ? (
        <EmptyState
          icon={<Truck className="w-8 h-8" />}
          title="No Machines Found"
          description={
            searchTerm || statusFilter !== 'ALL' || categoryFilter !== 'ALL'
              ? 'No boom lifts match the current filter criteria.'
              : 'Your equipment inventory is currently empty. Add your first boom lift to start operations.'
          }
          actionLabel={role !== 'EMPLOYEE' ? '+ Add First Boom Lift' : undefined}
          onAction={role !== 'EMPLOYEE' ? handleOpenAddModal : undefined}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Machine & ID</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Brand & Model</th>
                  <th className="py-3.5 px-4">Working Reach</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">TPI & Insurance</th>
                  <th className="py-3.5 px-4">Current Location</th>
                  <th className="py-3.5 px-4 text-right">Monthly Rate</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMachines.map((m) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const in30DaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
                  const tpiExpired = m.tpi_expiry_date && m.tpi_expiry_date < todayStr;
                  const tpiSoon = m.tpi_expiry_date && !tpiExpired && m.tpi_expiry_date <= in30DaysStr;
                  const insExpired = m.insurance_expiry_date && m.insurance_expiry_date < todayStr;
                  const insSoon = m.insurance_expiry_date && !insExpired && m.insurance_expiry_date <= in30DaysStr;

                  return (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/70 transition-colors cursor-pointer group"
                  >
                    <td
                      className="py-3.5 px-4"
                      onClick={() => navigate(`/machines/${m.id}`)}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-600 shrink-0">
                          <Truck className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors block">
                            {m.machine_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ID: {m.machine_id_code} | SN: {m.serial_number}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {m.category?.name || 'Standard'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="font-semibold text-slate-800">{m.brand}</span> {m.model}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800">
                        {m.height_capacity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(m.status)}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        {m.tpi_expiry_date ? (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block w-fit ${
                              tpiExpired
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : tpiSoon
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            TPI: {formatDate(m.tpi_expiry_date, 'dd MMM yy')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">TPI: Not Set</span>
                        )}
                        {m.insurance_expiry_date ? (
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded inline-block w-fit ${
                              insExpired
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : insSoon
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            Ins: {formatDate(m.insurance_expiry_date, 'dd MMM yy')}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Ins: Not Set</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 truncate max-w-[140px]">
                      {m.current_location || '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(m.monthly_rental_rate)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => navigate(`/machines/${m.id}`)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View Details & Profitability"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {role !== 'EMPLOYEE' && (
                          <>
                            <button
                              onClick={() => handleCloneMachine(m)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Clone Unit (Add Another Like This)"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleOpenEditModal(m)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Edit Machine"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </>
                        )}
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

      {/* Add / Edit Machine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMachine ? 'Edit Machine Specifications' : 'Register New Boom Lift / Machine'}
        description="Individual fleet asset details, technical specifications, and rental pricing"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveMachine} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Quick Preset Selector for Standard Industry Models */}
            {!editingMachine && (
              <div className="sm:col-span-2 bg-slate-50 border border-slate-200/90 rounded-xl p-3">
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  ⚡ Quick Autofill from Popular Boom Models (Optional)
                </label>
                <select
                  className="w-full text-xs rounded-lg border border-slate-300 py-2 px-2.5 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  onChange={(e) => handleSelectPreset(e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>-- Select a standard boom model to autofill specifications --</option>
                  {BOOM_PRESETS.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Batch / Multi-Unit Quantity for Identical Fleet Units */}
            {!editingMachine && (
              <div className="sm:col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl p-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-blue-950">
                        Fleet Batch Registration
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-200/80 text-blue-900">
                        Multi-Unit Support
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700 mt-0.5">
                      Have multiple units of this same lifter? LiftLedger will register all numbered units automatically.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <label className="text-xs font-bold text-slate-700">Units Quantity:</label>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={formQuantity}
                      onChange={(e) =>
                        setFormQuantity(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))
                      }
                      className="w-16 px-2 py-1 text-sm font-bold text-center border-2 border-blue-400 rounded-lg bg-white text-blue-950 shadow-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                    />
                  </div>
                </div>

                {formQuantity > 1 && (
                  <div className="mt-2.5 pt-2 border-t border-blue-200/60 text-[11px] text-blue-900 flex items-center justify-between flex-wrap gap-1">
                    <span>
                      <strong>Will register {formQuantity} machines:</strong> {formName || 'Machine'} #01 through #{String(formQuantity).padStart(2, '0')}
                    </span>
                    <span className="font-mono text-[10px] bg-white/80 px-2 py-0.5 rounded border border-blue-200 text-blue-800">
                      IDs: {formMachineId || 'BL'}-01 to {formMachineId || 'BL'}-{String(formQuantity).padStart(2, '0')}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="sm:col-span-2">
              <Input
                label="Machine Display Name"
                required
                placeholder="e.g. Genie S-125 Super Boom #01"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <Select
              label="Machine Category"
              required
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              helperText="Only categories selected during setup or settings appear here."
            />

            <Input
              label="Internal Machine ID"
              required
              placeholder="e.g. BL-120-01"
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
            />

            <Input
              label="Brand / Manufacturer"
              required
              placeholder="e.g. Genie / JLG / Haulotte / Snorkel"
              value={formBrand}
              onChange={(e) => setFormBrand(e.target.value)}
            />

            <Input
              label="Model Number"
              required
              placeholder="e.g. SX-135 XC / 1250AJP"
              value={formModel}
              onChange={(e) => setFormModel(e.target.value)}
            />

            <Input
              label="Serial Number (Chassis / VIN)"
              required
              placeholder="e.g. S1250-982341"
              value={formSerialNo}
              onChange={(e) => setFormSerialNo(e.target.value)}
            />

            <Input
              label="Working Height / Platform Capacity"
              required
              placeholder="e.g. 135 ft (41.1 m) / 300 kg"
              value={formHeight}
              onChange={(e) => setFormHeight(e.target.value)}
            />

            <Input
              label="RTO / Registration Number (if any)"
              placeholder="e.g. MH 04 AB 1234"
              value={formRegNo}
              onChange={(e) => setFormRegNo(e.target.value)}
            />

            <Input
              label="Purchase Date"
              type="date"
              value={formPurchaseDate}
              onChange={(e) => setFormPurchaseDate(e.target.value)}
            />

            <Input
              label="Purchase Price (Capital Asset INR)"
              type="number"
              placeholder="0.00"
              value={formPurchasePrice}
              onChange={(e) => setFormPurchasePrice(e.target.value)}
            />

            <Input
              label="Monthly Base Rental Rate (INR)"
              required
              type="number"
              placeholder="e.g. 250000"
              value={formMonthlyRate}
              onChange={(e) => setFormMonthlyRate(e.target.value)}
              helperText="Default monthly rate autofilled when creating rentals"
            />

            <Input
              label="Current Location / Base Yard"
              placeholder="e.g. Navi Mumbai Yard / L&T Project Site"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
            />

            <Select
              label="Current Operational Status"
              required
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as MachineStatus)}
              options={[
                { value: 'Available', label: 'Available (Ready for Rental)' },
                { value: 'Rented', label: 'Rented (Deployed on site)' },
                { value: 'Under Maintenance', label: 'Under Maintenance (Cannot be rented)' },
                { value: 'Inactive', label: 'Inactive / Standby (Cannot be rented)' },
              ]}
              helperText="Rules prevent assigning maintenance or inactive machines to new rentals."
            />

            <div className="sm:col-span-2 bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 space-y-3">
              <div>
                <h4 className="text-xs font-extrabold text-amber-950 uppercase tracking-wider">
                  🛡️ Statutory Site Safety & Compliance Certificates (TPI Form-10 & Insurance)
                </h4>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  EPC sites require valid Third-Party Load Test (TPI Form-10) & Equipment Insurance. LiftLedger alerts you 30 days before expiry.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="TPI (Form-10) Certificate No."
                  placeholder="e.g. TPI/2025/BL-104"
                  value={formTpiCertNo}
                  onChange={(e) => setFormTpiCertNo(e.target.value)}
                />
                <Input
                  label="TPI Load Test Expiry Date"
                  type="date"
                  value={formTpiExpiry}
                  onChange={(e) => setFormTpiExpiry(e.target.value)}
                />
                <Input
                  label="RTO Fitness Expiry (if road-reg)"
                  type="date"
                  value={formFitnessExpiry}
                  onChange={(e) => setFormFitnessExpiry(e.target.value)}
                />
                <Input
                  label="CPM / Equipment Insurance Policy No."
                  placeholder="e.g. OG-25-1901-4402"
                  value={formInsurancePolicyNo}
                  onChange={(e) => setFormInsurancePolicyNo(e.target.value)}
                />
                <Input
                  label="Insurance Policy Expiry Date"
                  type="date"
                  value={formInsuranceExpiry}
                  onChange={(e) => setFormInsuranceExpiry(e.target.value)}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Machine Photo URL (Optional)"
                placeholder="https://..."
                value={formPhotoUrl}
                onChange={(e) => setFormPhotoUrl(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Internal Notes / Safety Inspection Info"
                placeholder="e.g. Annual load test certified on 15-Jan. Fitted with spark arrestor."
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
              {editingMachine
                ? 'Save Changes'
                : formQuantity > 1
                ? `Register All ${formQuantity} Machines`
                : 'Register Machine'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
