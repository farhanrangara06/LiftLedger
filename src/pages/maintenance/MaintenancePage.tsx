import React, { useState, useEffect, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Truck,
  FileCheck,
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
import { Maintenance, Machine, MaintenanceType, MaintenanceStatus, PriorityLevel } from '@/types';

interface ChecklistItem {
  task: string;
  passed: boolean;
  remarks?: string;
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { task: 'Hydraulic system & fluid level check (no hose leaks)', passed: true },
  { task: 'Emergency lowering valve & ground control functioning', passed: true },
  { task: 'Platform tilt sensor & overload audio alarm verified', passed: true },
  { task: 'Engine oil, coolant & battery voltage check', passed: true },
  { task: 'Tyres / track condition & lug nut torque inspection', passed: true },
  { task: 'Safety harness anchorage points inspected & certified', passed: true },
];

export const MaintenancePage: React.FC = () => {
  const { company } = useAuth();
  const { addToast } = useNotification();

  const [records, setRecords] = useState<Maintenance[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [formMachineId, setFormMachineId] = useState('');
  const [formType, setFormType] = useState<MaintenanceType>('Preventative');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [formPriority, setFormPriority] = useState<PriorityLevel>('Medium');
  const [formStatus, setFormStatus] = useState<MaintenanceStatus>('In Progress');
  const [formCost, setFormCost] = useState('0');
  const [formDowntime, setFormDowntime] = useState('4');
  const [formPerformedBy, setFormPerformedBy] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST);

  const loadMaintenance = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const { data: maintData } = await supabase
        .from('maintenance')
        .select('*, machine:machines(*)')
        .eq('company_id', company.id)
        .order('start_date', { ascending: false });

      if (maintData) setRecords(maintData as Maintenance[]);

      const { data: machData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false);

      if (machData) setMachines(machData as Machine[]);
    } catch (err) {
      console.error('Error fetching maintenance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMaintenance();
  }, [company?.id]);

  const handleOpenAdd = () => {
    setFormMachineId(machines[0]?.id || '');
    setFormType('Preventative');
    setFormTitle('250-Hour Periodic Service & Load Test');
    setFormDescription('Engine oil change, hydraulic filter replacement, boom lubrication and safety test.');
    setFormStartDate(new Date().toISOString().split('T')[0]);
    setFormPriority('Medium');
    setFormStatus('In Progress');
    setFormCost('8500');
    setFormDowntime('4');
    setFormPerformedBy('Apex Certified Senior Technician');
    setFormNotes('');
    setChecklist(DEFAULT_CHECKLIST);
    setIsModalOpen(true);
  };

  const handleToggleChecklist = (index: number) => {
    setChecklist((prev) =>
      prev.map((item, i) => (i === index ? { ...item, passed: !item.passed } : item))
    );
  };

  const handleSaveMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formMachineId) {
      addToast('Please select a valid machine.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        machine_id: formMachineId,
        maintenance_type: formType,
        title: formTitle,
        description: formDescription || null,
        start_date: formStartDate,
        completion_date: formStatus === 'Completed' ? new Date().toISOString().split('T')[0] : null,
        status: formStatus,
        priority: formPriority,
        cost: Number(formCost) || 0,
        downtime_hours: Number(formDowntime) || 0,
        performed_by: formPerformedBy || null,
        notes: formNotes || null,
        inspection_checklist: checklist,
      };

      const { error } = await supabase.from('maintenance').insert(payload);
      if (error) throw error;

      // Update machine status accordingly
      // Rule: Machines under maintenance must NOT be assigned to new rentals!
      if (formStatus === 'In Progress' || formStatus === 'Scheduled') {
        await supabase
          .from('machines')
          .update({ status: 'Under Maintenance' })
          .eq('id', formMachineId);
      } else if (formStatus === 'Completed') {
        await supabase
          .from('machines')
          .update({ status: 'Available' })
          .eq('id', formMachineId);
      }

      // Also record as maintenance expense if cost > 0
      if (Number(formCost) > 0) {
        await supabase.from('expenses').insert({
          company_id: company.id,
          machine_id: formMachineId,
          date: formStartDate,
          category: 'Maintenance',
          expense_type: 'OpEx',
          vendor: formPerformedBy || 'Maintenance Contractor',
          description: `Maintenance: ${formTitle}`,
          amount: Number(formCost),
          payment_mode: 'Bank Transfer',
        });
      }

      addToast('Maintenance logged and machine status updated.', 'success');
      setIsModalOpen(false);
      loadMaintenance();
    } catch (err: any) {
      console.error('Error saving maintenance:', err);
      addToast(err.message || 'Failed to save maintenance.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkCompleted = async (m: Maintenance) => {
    try {
      await supabase
        .from('maintenance')
        .update({
          status: 'Completed',
          completion_date: new Date().toISOString().split('T')[0],
        })
        .eq('id', m.id);

      // Return machine to Available status
      await supabase
        .from('machines')
        .update({ status: 'Available' })
        .eq('id', m.machine_id);

      addToast(`Maintenance completed. Machine is now Available.`, 'success');
      loadMaintenance();
    } catch (err: any) {
      addToast(err.message || 'Failed to complete maintenance.', 'error');
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        r.title.toLowerCase().includes(s) ||
        (r.machine?.machine_name && r.machine.machine_name.toLowerCase().includes(s));

      const matchesType = typeFilter === 'ALL' || r.maintenance_type === typeFilter;
      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [records, searchTerm, typeFilter, statusFilter]);

  // Aggregate stats
  const totalDowntime = records.reduce((s, r) => s + Number(r.downtime_hours || 0), 0);
  const totalMaintenanceCost = records.reduce((s, r) => s + Number(r.cost || 0), 0);
  const activeBreakdowns = records.filter(
    (r) => r.maintenance_type === 'Breakdown' && r.status !== 'Completed'
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Equipment Maintenance & Health</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log breakdowns, schedule preventative servicings, verify safety checklists, and track downtime hours
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={handleOpenAdd} leftIcon={<Plus className="w-4 h-4" />}>
          Log Maintenance / Breakdown
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center justify-between text-amber-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Breakdowns
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-extrabold text-rose-600">{activeBreakdowns}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Machines currently immobilized</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-blue-600 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Cumulative Downtime
            </span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{totalDowntime} hrs</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Total fleet repair downtime</span>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Repair Expenses
            </span>
            <Wrench className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">
            {formatCurrency(totalMaintenanceCost)}
          </div>
          <span className="text-[11px] text-slate-400 mt-1 block">Spares & service charges</span>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            placeholder="Search by title, description, boom lift name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Maintenance Types' },
              { value: 'Preventative', label: 'Preventative Servicing' },
              { value: 'Breakdown', label: 'Site Breakdown / Emergency Repair' },
              { value: 'Inspection', label: 'Safety / Pre-hire Inspection' },
              { value: 'Statutory / Certification', label: 'Third-Party Load Testing' },
            ]}
          />

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Statuses' },
              { value: 'In Progress', label: 'In Progress (Machine Locked)' },
              { value: 'Scheduled', label: 'Scheduled Ahead' },
              { value: 'Completed', label: 'Completed' },
            ]}
          />
        </div>
      </Card>

      {/* Maintenance Table */}
      {loading ? (
        <LoadingSpinner message="Loading maintenance records..." />
      ) : filteredRecords.length === 0 ? (
        <EmptyState
          icon={<Wrench className="w-8 h-8" />}
          title="No Maintenance Records"
          description="Log preventative servicings or site breakdown reports to keep your boom lift fleet certified."
          actionLabel="+ Log Maintenance"
          onAction={handleOpenAdd}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Start Date</th>
                  <th className="py-3.5 px-4">Machine</th>
                  <th className="py-3.5 px-4">Type & Priority</th>
                  <th className="py-3.5 px-4">Work Performed / Issue</th>
                  <th className="py-3.5 px-4">Technician</th>
                  <th className="py-3.5 px-4 text-right">Downtime</th>
                  <th className="py-3.5 px-4 text-right">Cost</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-slate-700">{formatDate(m.start_date)}</td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block truncate max-w-[140px]">
                        {m.machine?.machine_name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {m.machine?.machine_id_code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={m.maintenance_type === 'Breakdown' ? 'danger' : 'purple'}
                        size="sm"
                      >
                        {m.maintenance_type}
                      </Badge>
                      <span
                        className={`inline-block ml-1 text-[10px] font-bold ${
                          m.priority === 'Critical'
                            ? 'text-rose-600'
                            : m.priority === 'High'
                            ? 'text-amber-600'
                            : 'text-slate-500'
                        }`}
                      >
                        [{m.priority}]
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[200px]">
                        {m.title}
                      </span>
                      {m.description && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-[200px]">
                          {m.description}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{m.performed_by || '—'}</td>
                    <td className="py-3.5 px-4 text-right font-semibold text-slate-800">
                      {m.downtime_hours || 0} hrs
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(m.cost)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          m.status === 'Completed'
                            ? 'success'
                            : m.status === 'In Progress'
                            ? 'warning'
                            : 'default'
                        }
                        size="sm"
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {m.status !== 'Completed' && (
                        <button
                          onClick={() => handleMarkCompleted(m)}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-[11px] transition-colors cursor-pointer"
                        >
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Log Maintenance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Log Equipment Maintenance or Breakdown"
        description="Records technical inspection checklist and sets machine status"
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveMaintenance} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <Select
                label="Select Machine (Boom Lift)"
                required
                value={formMachineId}
                onChange={(e) => setFormMachineId(e.target.value)}
                options={machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} (${m.brand} ${m.model} - ${m.height_capacity})`,
                }))}
              />
            </div>

            <Select
              label="Maintenance Type"
              required
              value={formType}
              onChange={(e) => setFormType(e.target.value as any)}
              options={[
                { value: 'Preventative', label: 'Periodic Preventative Servicing' },
                { value: 'Breakdown', label: 'Emergency Site Breakdown' },
                { value: 'Inspection', label: 'Pre-Delivery Safety Inspection' },
                { value: 'Statutory / Certification', label: 'Third-Party Annual Load Test' },
              ]}
            />

            <Select
              label="Priority Level"
              required
              value={formPriority}
              onChange={(e) => setFormPriority(e.target.value as any)}
              options={[
                { value: 'Low', label: 'Low (Scheduled routine)' },
                { value: 'Medium', label: 'Medium' },
                { value: 'High', label: 'High (Immediate attention)' },
                { value: 'Critical', label: 'Critical (Safety hazard / Machine immobilized)' },
              ]}
            />

            <div className="sm:col-span-2">
              <Input
                label="Incident / Maintenance Title"
                required
                placeholder="e.g. Hydraulic Boom Cylinder Seal Replacement"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
              />
            </div>

            <Input
              label="Service Date"
              type="date"
              required
              value={formStartDate}
              onChange={(e) => setFormStartDate(e.target.value)}
            />

            <Select
              label="Operational Status"
              required
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as any)}
              options={[
                { value: 'In Progress', label: 'In Progress (Locks machine from rentals)' },
                { value: 'Scheduled', label: 'Scheduled Ahead' },
                { value: 'Completed', label: 'Completed (Makes machine Available)' },
              ]}
            />

            <Input
              label="Total Cost (Spares & Labor INR)"
              type="number"
              value={formCost}
              onChange={(e) => setFormCost(e.target.value)}
              helperText="Automatically recorded as OpEx expense"
            />

            <Input
              label="Estimated Downtime (Hours)"
              type="number"
              value={formDowntime}
              onChange={(e) => setFormDowntime(e.target.value)}
            />

            <div className="sm:col-span-2">
              <Input
                label="Service Engineer / Vendor Name"
                placeholder="e.g. In-house Master Tech / Haulotte Service Centre"
                value={formPerformedBy}
                onChange={(e) => setFormPerformedBy(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <Input
                label="Detailed Technical Description"
                placeholder="e.g. Replaced leaking hydraulic fittings on secondary boom arm. Pressure tested to 250 bar."
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Safety Checklist */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
              Pre-Operation Safety & Quality Checklist:
            </span>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {checklist.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleToggleChecklist(idx)}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900 select-none"
                >
                  {item.passed ? (
                    <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span className={item.passed ? 'font-medium' : 'text-slate-400'}>
                    {item.task}
                  </span>
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
              Save Maintenance Log
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
