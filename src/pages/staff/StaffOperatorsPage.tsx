import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  HardHat,
  Wallet,
  Edit,
  Phone,
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
import {
  OperatorStaff,
  OperatorSalaryPayment,
  Machine,
  Profile,
  UserRole,
} from '@/types';

export const StaffOperatorsPage: React.FC = () => {
  const { company, user, role } = useAuth();
  const { addToast } = useNotification();

  const [activeTab, setActiveTab] = useState<'operators' | 'salaries' | 'users'>('operators');
  const [staffList, setStaffList] = useState<OperatorStaff[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<OperatorSalaryPayment[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [teamUsers, setTeamUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add/Edit Operator Modal
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<OperatorStaff | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formName, setFormName] = useState('');
  const [formRoleType, setFormRoleType] = useState<OperatorStaff['role_type']>('Boom Lift Operator');
  const [formMobile, setFormMobile] = useState('');
  const [formLicenseNo, setFormLicenseNo] = useState('');
  const [formSafetyExpiry, setFormSafetyExpiry] = useState('');
  const [formMonthlySalary, setFormMonthlySalary] = useState('25000');
  const [formDailyBhatta, setFormDailyBhatta] = useState('0');
  const [formSalaryPaidBy, setFormSalaryPaidBy] = useState<OperatorStaff['salary_paid_by']>(
    'Client at Site (Deducted on Invoice)'
  );
  const [formAssignedMachineId, setFormAssignedMachineId] = useState('');
  const [formAssignedSite, setFormAssignedSite] = useState('');
  const [formUpiId, setFormUpiId] = useState('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formNotes, setFormNotes] = useState('');

  // Record Salary / Advance Modal
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [salStaffId, setSalStaffId] = useState('');
  const [salPaymentDate, setSalPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [salMonthLabel, setSalMonthLabel] = useState(new Date().toISOString().slice(0, 7));
  const [salPaymentType, setSalPaymentType] = useState<OperatorSalaryPayment['payment_type']>('Monthly Salary');
  const [salAmount, setSalAmount] = useState('25000');
  const [salMode, setSalMode] = useState('Bank Transfer');
  const [salPaidBy, setSalPaidBy] = useState<'Firm (Company Expense)' | 'Client at Site (Deducted on Invoice)'>(
    'Firm (Company Expense)'
  );
  const [salAutoExpense, setSalAutoExpense] = useState(true);
  const [salNotes, setSalNotes] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [staffRes, salRes, machRes, profRes] = await Promise.all([
        supabase
          .from('operators_staff')
          .select('*, assigned_machine:machines(*)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('operator_salary_payments')
          .select('*, staff:operators_staff(*), machine:machines(*)')
          .eq('company_id', company.id)
          .order('payment_date', { ascending: false }),
        supabase
          .from('machines')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
        supabase
          .from('profiles')
          .select('*')
          .eq('company_id', company.id)
          .order('created_at', { ascending: true }),
      ]);

      if (staffRes.data) setStaffList(staffRes.data as OperatorStaff[]);
      if (salRes.data) setSalaryPayments(salRes.data as OperatorSalaryPayment[]);
      if (machRes.data) setMachines(machRes.data as Machine[]);
      if (profRes.data) setTeamUsers(profRes.data as Profile[]);
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id]);

  const handleOpenAddStaff = () => {
    setEditingStaff(null);
    setFormName('');
    setFormRoleType('Boom Lift Operator');
    setFormMobile('');
    setFormLicenseNo('');
    setFormSafetyExpiry('');
    setFormMonthlySalary('25000');
    setFormDailyBhatta('0');
    setFormSalaryPaidBy('Client at Site (Deducted on Invoice)');
    setFormAssignedMachineId('');
    setFormAssignedSite('');
    setFormUpiId('');
    setFormIsActive(true);
    setFormNotes('');
    setIsStaffModalOpen(true);
  };

  const handleOpenEditStaff = (s: OperatorStaff) => {
    setEditingStaff(s);
    setFormName(s.full_name);
    setFormRoleType(s.role_type);
    setFormMobile(s.mobile);
    setFormLicenseNo(s.license_or_id_no || '');
    setFormSafetyExpiry(s.safety_pass_expiry || '');
    setFormMonthlySalary(String(s.monthly_salary || 25000));
    setFormDailyBhatta(String(s.daily_bhatta || 0));
    setFormSalaryPaidBy(s.salary_paid_by);
    setFormAssignedMachineId(s.assigned_machine_id || '');
    setFormAssignedSite(s.assigned_site || '');
    setFormUpiId(s.upi_id || '');
    setFormIsActive(s.is_active);
    setFormNotes(s.notes || '');
    setIsStaffModalOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        full_name: formName,
        role_type: formRoleType,
        mobile: formMobile,
        license_or_id_no: formLicenseNo || null,
        safety_pass_expiry: formSafetyExpiry || null,
        monthly_salary: Number(formMonthlySalary) || 0,
        daily_bhatta: Number(formDailyBhatta) || 0,
        salary_paid_by: formSalaryPaidBy,
        assigned_machine_id: formAssignedMachineId || null,
        assigned_site: formAssignedSite || null,
        upi_id: formUpiId || null,
        is_active: formIsActive,
        notes: formNotes || null,
      };

      if (editingStaff) {
        const { error } = await supabase
          .from('operators_staff')
          .update(payload)
          .eq('id', editingStaff.id);
        if (error) throw error;
        addToast(`Operator/Staff "${formName}" updated.`, 'success');
      } else {
        const { error } = await supabase.from('operators_staff').insert(payload);
        if (error) throw error;
        addToast(`Operator/Staff "${formName}" registered.`, 'success');
      }

      setIsStaffModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save operator/staff.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSalaryModal = (staff?: OperatorStaff) => {
    const target = staff || staffList[0];
    setSalStaffId(target?.id || '');
    setSalAmount(String(target?.monthly_salary || 25000));
    setSalPaidBy(
      target?.salary_paid_by === 'Client at Site (Deducted on Invoice)'
        ? 'Client at Site (Deducted on Invoice)'
        : 'Firm (Company Expense)'
    );
    setSalPaymentDate(new Date().toISOString().split('T')[0]);
    setSalMonthLabel(new Date().toISOString().slice(0, 7));
    setSalPaymentType('Monthly Salary');
    setSalMode('Bank Transfer');
    setSalAutoExpense(true);
    setSalNotes('');
    setIsSalaryModalOpen(true);
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !salStaffId) return;

    const op = staffList.find((s) => s.id === salStaffId);
    const amt = Number(salAmount) || 0;
    if (amt <= 0) {
      addToast('Please enter a valid salary/advance amount.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('operator_salary_payments').insert({
        company_id: company.id,
        staff_id: salStaffId,
        machine_id: op?.assigned_machine_id || null,
        payment_date: salPaymentDate,
        month_label: salMonthLabel,
        payment_type: salPaymentType,
        amount: amt,
        payment_mode: salMode,
        paid_by: salPaidBy,
        notes: salNotes || null,
      });

      if (error) throw error;

      // If paid by Firm and auto-expense is checked, record in expenses as OpEx
      if (salPaidBy === 'Firm (Company Expense)' && salAutoExpense) {
        await supabase.from('expenses').insert({
          company_id: company.id,
          machine_id: op?.assigned_machine_id || null,
          category: 'Operator Salary',
          expense_type: 'OpEx',
          amount: amt,
          date: salPaymentDate,
          vendor_name: op?.full_name || 'Operator',
          payment_mode: 'Bank Transfer',
          notes: `${salPaymentType} (${salMonthLabel}) for ${op?.full_name || 'Staff'}. ${salNotes}`,
          created_by: user?.id || null,
        });
      }

      addToast(`Recorded ${formatCurrency(amt)} ${salPaymentType} for ${op?.full_name}.`, 'success');
      setIsSalaryModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to record salary payment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleUpdate = async (profileId: string, newRole: UserRole) => {
    if (role !== 'OWNER') {
      addToast('Only the Company Owner can change system user roles.', 'warning');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId);
      if (error) throw error;
      addToast(`User role updated to ${newRole}.`, 'success');
      loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update user role.', 'error');
    }
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter(
      (s) =>
        s.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.mobile.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.assigned_machine?.machine_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [staffList, searchTerm]);

  const stats = useMemo(() => {
    const activeOperators = staffList.filter(
      (s) => s.role_type === 'Boom Lift Operator' && s.is_active
    ).length;
    const clientPaidCount = staffList.filter(
      (s) => s.is_active && s.salary_paid_by === 'Client at Site (Deducted on Invoice)'
    ).length;
    const totalSalPaid = salaryPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    return { activeOperators, clientPaidCount, totalSalPaid };
  }, [staffList, salaryPayments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Boom Lift Operators, Mechanics & Team Roles
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign operators to boom lifts, track Client-Paid vs. Firm-Paid salaries (Rs. 25,000 adjustment), and manage system access roles
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenSalaryModal()}
            leftIcon={<Wallet className="w-4 h-4 text-emerald-600" />}
            disabled={staffList.length === 0}
          >
            Record Salary / Advance
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddStaff}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Operator / Staff
          </Button>
        </div>
      </div>

      {/* KPI Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-l-4 border-l-blue-600">
          <span className="text-[11px] font-bold uppercase text-slate-400">Active Boom Operators</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.activeOperators}</div>
          <span className="text-[11px] text-slate-500">Out of {staffList.length} total staff members</span>
        </Card>
        <Card className="p-4 border-l-4 border-l-amber-500">
          <span className="text-[11px] font-bold uppercase text-slate-400">Client-Paid at Site (Invoice Adjusted)</span>
          <div className="text-2xl font-black text-amber-600 mt-1">{stats.clientPaidCount}</div>
          <span className="text-[11px] text-slate-500">Salary deducted on monthly GST invoice</span>
        </Card>
        <Card className="p-4 border-l-4 border-l-emerald-600">
          <span className="text-[11px] font-bold uppercase text-slate-400">Total Salary & Bhatta Logged</span>
          <div className="text-2xl font-black text-emerald-700 mt-1">{formatCurrency(stats.totalSalPaid)}</div>
          <span className="text-[11px] text-slate-500">{salaryPayments.length} salary/advance vouchers</span>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('operators')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'operators'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Operators & Field Staff ({staffList.length})
        </button>
        <button
          onClick={() => setActiveTab('salaries')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'salaries'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Salary, Advance & Site Bhatta Ledger ({salaryPayments.length})
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
            activeTab === 'users'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          App Login Users & Roles ({teamUsers.length})
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading operators & team records..." />
      ) : activeTab === 'operators' ? (
        <div className="space-y-4">
          <Card className="p-4">
            <Input
              placeholder="Search by Operator Name, Mobile, or Assigned Boom Lift..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </Card>

          {filteredStaff.length === 0 ? (
            <EmptyState
              icon={<HardHat className="w-8 h-8" />}
              title="No Boom Lift Operators Registered"
              description="Add your machine operators and mechanics to track which boom lift they operate and whether their salary (e.g. Rs. 25,000) is paid by the client at site or by your firm."
              actionLabel="+ Add First Operator"
              onAction={handleOpenAddStaff}
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                    <tr>
                      <th className="py-3.5 px-4">Operator / Staff</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Assigned Boom Lift</th>
                      <th className="py-3.5 px-4 text-right">Monthly Salary</th>
                      <th className="py-3.5 px-4">Salary Payment Mode</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredStaff.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{s.full_name}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {s.mobile}
                            </span>
                            {s.license_or_id_no && <span>| ID: {s.license_or_id_no}</span>}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={s.role_type === 'Boom Lift Operator' ? 'info' : 'default'}>
                            {s.role_type}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4">
                          {s.assigned_machine ? (
                            <div>
                              <span className="font-bold text-slate-800 block">
                                {s.assigned_machine.machine_name}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {s.assigned_site || s.assigned_machine.current_location || 'Assigned'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">Unassigned / Floater</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(s.monthly_salary)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                              s.salary_paid_by.includes('Client')
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {s.salary_paid_by}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge variant={s.is_active ? 'success' : 'default'}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenSalaryModal(s)}
                            >
                              Pay Salary
                            </Button>
                            <button
                              onClick={() => handleOpenEditStaff(s)}
                              className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                              title="Edit Operator"
                            >
                              <Edit className="w-4 h-4" />
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
        </div>
      ) : activeTab === 'salaries' ? (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          {salaryPayments.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-8 h-8" />}
              title="No Salary or Advance Vouchers Yet"
              description="Record monthly operator salary, site food allowance (bhatta), or overtime incentives."
              actionLabel="Record Salary Payment"
              onAction={() => handleOpenSalaryModal()}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Operator / Staff</th>
                    <th className="py-3.5 px-4">Salary Month</th>
                    <th className="py-3.5 px-4">Voucher Type</th>
                    <th className="py-3.5 px-4">Paid By Source</th>
                    <th className="py-3.5 px-4">Mode</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {formatDate(p.payment_date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">
                          {p.staff?.full_name || 'Operator'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {p.machine?.machine_name || ''}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700">{p.month_label}</td>
                      <td className="py-3 px-4">
                        <Badge variant="default">{p.payment_type}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={p.paid_by.includes('Client') ? 'warning' : 'info'}
                        >
                          {p.paid_by}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.payment_mode}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        {formatCurrency(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Registered System Users & Access Control
              </h3>
              <p className="text-xs text-slate-500">
                Manage whether team members have OWNER, ACCOUNTANT, or EMPLOYEE (Site Supervisor) permissions.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Current System Role</th>
                  <th className="py-3 px-4">Permissions Summary</th>
                  <th className="py-3 px-4 text-right">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {teamUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {u.full_name} {u.id === user?.id && <span className="text-blue-600">(You)</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          u.role === 'OWNER'
                            ? 'info'
                            : u.role === 'ACCOUNTANT'
                            ? 'success'
                            : 'default'
                        }
                      >
                        {u.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {u.role === 'OWNER'
                        ? 'Full access including Partnership Profit Split, Settings & Role Management'
                        : u.role === 'ACCOUNTANT'
                        ? 'Can create Invoices, Quotations, Rentals, Payments, Expenses & Reports'
                        : 'Site Supervisor: Can view fleet & log daily Shifts/OT Logsheets'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <select
                        disabled={role !== 'OWNER' || u.id === user?.id}
                        value={u.role}
                        onChange={(e) => handleRoleUpdate(u.id, e.target.value as UserRole)}
                        className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold text-slate-800 disabled:opacity-50"
                      >
                        <option value="OWNER">OWNER (Partner)</option>
                        <option value="ACCOUNTANT">ACCOUNTANT (Billing & Accounts)</option>
                        <option value="EMPLOYEE">EMPLOYEE (Site Supervisor)</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit Operator Modal */}
      <Modal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        title={editingStaff ? 'Edit Operator / Staff Member' : 'Register Boom Lift Operator / Staff'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveStaff} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Full Name"
              required
              placeholder="e.g. Ramesh Yadav"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Select
              label="Designation / Role"
              value={formRoleType}
              onChange={(e) => setFormRoleType(e.target.value as OperatorStaff['role_type'])}
              options={[
                { value: 'Boom Lift Operator', label: 'Boom Lift Operator' },
                { value: 'Service Technician / Mechanic', label: 'Service Technician / Mechanic' },
                { value: 'Site Supervisor', label: 'Site Supervisor' },
                { value: 'Accountant', label: 'Accountant' },
                { value: 'Office Staff', label: 'Office Staff' },
              ]}
            />
            <Input
              label="Mobile Number (WhatsApp)"
              required
              placeholder="e.g. +91 9876543210"
              value={formMobile}
              onChange={(e) => setFormMobile(e.target.value)}
            />
            <Select
              label="Assigned Boom Lift"
              value={formAssignedMachineId}
              onChange={(e) => setFormAssignedMachineId(e.target.value)}
              options={[
                { value: '', label: '-- Unassigned / Spare Operator --' },
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} (${m.machine_id_code})`,
                })),
              ]}
            />
            <Input
              label="Monthly Salary Fixed (INR)"
              type="number"
              step="any"
              required
              value={formMonthlySalary}
              onChange={(e) => setFormMonthlySalary(e.target.value)}
            />
            <Select
              label="Who Pays Operator Salary at Site?"
              value={formSalaryPaidBy}
              onChange={(e) => setFormSalaryPaidBy(e.target.value as OperatorStaff['salary_paid_by'])}
              options={[
                {
                  value: 'Client at Site (Deducted on Invoice)',
                  label: 'Client Pays at Site (Deducted on GST Invoice like Rs. 25,000)',
                },
                {
                  value: 'Firm (Company Expense)',
                  label: 'Firm Pays Directly (Company OpEx)',
                },
              ]}
            />
            <Input
              label="Driving License / Aadhaar ID No."
              placeholder="e.g. MH14-2019002938"
              value={formLicenseNo}
              onChange={(e) => setFormLicenseNo(e.target.value)}
            />
            <Input
              label="Safety Gate Pass Expiry Date"
              type="date"
              value={formSafetyExpiry}
              onChange={(e) => setFormSafetyExpiry(e.target.value)}
            />
            <Input
              label="Current Project Site"
              placeholder="e.g. Keystone / L&T Site"
              value={formAssignedSite}
              onChange={(e) => setFormAssignedSite(e.target.value)}
            />
            <Select
              label="Employment Status"
              value={formIsActive ? 'true' : 'false'}
              onChange={(e) => setFormIsActive(e.target.value === 'true')}
              options={[
                { value: 'true', label: 'Active on Duty' },
                { value: 'false', label: 'Inactive / On Leave' },
              ]}
            />
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsStaffModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {editingStaff ? 'Save Changes' : 'Register Operator'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Salary / Advance Modal */}
      <Modal
        isOpen={isSalaryModalOpen}
        onClose={() => setIsSalaryModalOpen(false)}
        title="Record Operator Salary / Advance / Site Bhatta"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveSalary} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <Select
                label="Select Operator / Staff"
                required
                value={salStaffId}
                onChange={(e) => {
                  const op = staffList.find((s) => s.id === e.target.value);
                  setSalStaffId(e.target.value);
                  if (op) {
                    setSalAmount(String(op.monthly_salary || 25000));
                    setSalPaidBy(op.salary_paid_by);
                  }
                }}
                options={staffList.map((s) => ({
                  value: s.id,
                  label: `${s.full_name} (${s.role_type} - ${formatCurrency(s.monthly_salary)}/mo)`,
                }))}
              />
            </div>
            <Input
              label="Payment Date"
              type="date"
              required
              value={salPaymentDate}
              onChange={(e) => setSalPaymentDate(e.target.value)}
            />
            <Input
              label="Salary Month"
              type="month"
              required
              value={salMonthLabel}
              onChange={(e) => setSalMonthLabel(e.target.value)}
            />
            <Select
              label="Voucher Type"
              value={salPaymentType}
              onChange={(e) => setSalPaymentType(e.target.value as OperatorSalaryPayment['payment_type'])}
              options={[
                { value: 'Monthly Salary', label: 'Monthly Salary' },
                { value: 'Site Advance / Kharcha', label: 'Site Advance / Kharcha' },
                { value: 'Overtime Bonus', label: 'Overtime Bonus' },
                { value: 'Daily Bhatta', label: 'Daily Bhatta' },
              ]}
            />
            <Input
              label="Amount (INR)"
              type="number"
              step="any"
              required
              value={salAmount}
              onChange={(e) => setSalAmount(e.target.value)}
            />
            <Select
              label="Paid By Source"
              value={salPaidBy}
              onChange={(e) => setSalPaidBy(e.target.value as any)}
              options={[
                { value: 'Firm (Company Expense)', label: 'Firm (Company Expense)' },
                {
                  value: 'Client at Site (Deducted on Invoice)',
                  label: 'Client at Site (Deducted on Invoice)',
                },
              ]}
            />
            <Select
              label="Payment Mode"
              value={salMode}
              onChange={(e) => setSalMode(e.target.value)}
              options={[
                { value: 'Bank Transfer', label: 'Bank Transfer / UPI' },
                { value: 'Cash', label: 'Cash at Site' },
                { value: 'Adjusted in Invoice', label: 'Adjusted in Client Invoice' },
              ]}
            />
          </div>

          {salPaidBy === 'Firm (Company Expense)' && (
            <label className="flex items-center gap-2 text-xs text-slate-700 bg-emerald-50 border border-emerald-200 p-3 rounded-xl cursor-pointer">
              <input
                type="checkbox"
                checked={salAutoExpense}
                onChange={(e) => setSalAutoExpense(e.target.checked)}
                className="rounded text-emerald-600"
              />
              <span>
                Automatically log this payment in <strong>Operating Expenses (OpEx)</strong> for P&L and Machine Profitability
              </span>
            </label>
          )}

          <Input
            label="Remarks / Reference"
            placeholder="e.g. Paid via GPay for Oct 2025 shift duty"
            value={salNotes}
            onChange={(e) => setSalNotes(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsSalaryModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              Save Salary Voucher
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
