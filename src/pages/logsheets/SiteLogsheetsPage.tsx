import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Plus,
  Receipt,
  Sparkles,
  Trash2,
  FileSpreadsheet,
  Truck,
  Edit,
  Check,
  X,
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
import { formatDate } from '@/lib/utils';
import { exportToExcel } from '@/lib/excelExport';
import { SiteLogsheet, SiteLogStatus, Rental, Machine, Customer } from '@/types';

export const SiteLogsheetsPage: React.FC = () => {
  const { company, user } = useAuth();
  const { addToast } = useNotification();
  const navigate = useNavigate();

  const [logs, setLogs] = useState<SiteLogsheet[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filters: Month Start & End, Rental Filter
  const now = new Date();
  const [startDate, setStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]
  );
  const [selectedRentalFilter, setSelectedRentalFilter] = useState('ALL');

  // Add / Edit Daily Log Modal
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<SiteLogsheet | null>(null);
  const [formRentalId, setFormRentalId] = useState('');
  const [formMachineId, setFormMachineId] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formLogDate, setFormLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<SiteLogStatus>('Working');
  const [formShifts, setFormShifts] = useState('1');
  const [formRegularHrs, setFormRegularHrs] = useState('10');
  const [formOvertimeHrs, setFormOvertimeHrs] = useState('0');
  const [formBreakdownHrs, setFormBreakdownHrs] = useState('0');
  const [formDieselLiters, setFormDieselLiters] = useState('0');
  const [formOperatorName, setFormOperatorName] = useState('');
  const [formSupervisor, setFormSupervisor] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Inline Quick-Edit State for instant working hours / OT changes directly in the table
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineStatus, setInlineStatus] = useState<SiteLogStatus>('Working');
  const [inlineShifts, setInlineShifts] = useState('1');
  const [inlineRegularHrs, setInlineRegularHrs] = useState('10');
  const [inlineOvertimeHrs, setInlineOvertimeHrs] = useState('0');
  const [inlineBreakdownHrs, setInlineBreakdownHrs] = useState('0');
  const [inlineOperator, setInlineOperator] = useState('');
  const [savingInline, setSavingInline] = useState(false);

  // Quick Bulk Month Log Generator Modal
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkRentalId, setBulkRentalId] = useState('');
  const [bulkTotalShifts, setBulkTotalShifts] = useState('25');
  const [bulkTotalOvertime, setBulkTotalOvertime] = useState('29');
  const [bulkOperatorName, setBulkOperatorName] = useState('');

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      const [logRes, rentRes, machRes, custRes] = await Promise.all([
        supabase
          .from('site_logsheets')
          .select('*, rental:rentals(*), machine:machines(*), customer:customers(*)')
          .eq('company_id', company.id)
          .gte('log_date', startDate)
          .lte('log_date', endDate)
          .order('log_date', { ascending: false }),
        supabase
          .from('rentals')
          .select('*, customer:customers(*), machine:machines(*)')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('machines')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
        supabase
          .from('customers')
          .select('*')
          .eq('company_id', company.id)
          .eq('is_archived', false),
      ]);

      if (logRes.data) setLogs(logRes.data as SiteLogsheet[]);
      if (rentRes.data) setRentals(rentRes.data as Rental[]);
      if (machRes.data) setMachines(machRes.data as Machine[]);
      if (custRes.data) setCustomers(custRes.data as Customer[]);
    } catch (err) {
      console.error('Error loading site logsheets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [company?.id, startDate, endDate]);

  // Autofill machine & customer when rental selected in modal (only when creating or changing rental)
  const handleRentalSelectChange = (rentalId: string) => {
    setFormRentalId(rentalId);
    if (rentalId) {
      const r = rentals.find((rent) => rent.id === rentalId);
      if (r) {
        setFormMachineId(r.machine_id);
        setFormCustomerId(r.customer_id);
      }
    }
  };

  // Auto-adjust shift count based on status
  const handleStatusChange = (newStatus: SiteLogStatus) => {
    setFormStatus(newStatus);
    if (newStatus === 'Working') {
      setFormShifts('1');
      setFormRegularHrs('10');
      setFormBreakdownHrs('0');
    } else if (newStatus === 'Breakdown') {
      setFormShifts('0');
      setFormRegularHrs('0');
      setFormBreakdownHrs('10');
    } else if (newStatus === 'Holiday / Sunday') {
      setFormShifts('0');
      setFormRegularHrs('0');
      setFormBreakdownHrs('0');
    } else {
      setFormShifts('1');
      setFormRegularHrs('10');
    }
  };

  const handleOpenAddModal = () => {
    setEditingLog(null);
    const firstR = rentals.find((r) => r.status === 'Active') || rentals[0];
    if (firstR) {
      setFormRentalId(firstR.id);
      setFormMachineId(firstR.machine_id);
      setFormCustomerId(firstR.customer_id);
    } else if (machines[0]) {
      setFormRentalId('');
      setFormMachineId(machines[0].id);
      setFormCustomerId('');
    }
    setFormLogDate(new Date().toISOString().split('T')[0]);
    setFormStatus('Working');
    setFormShifts('1');
    setFormRegularHrs('10');
    setFormOvertimeHrs('0');
    setFormBreakdownHrs('0');
    setFormDieselLiters('0');
    setFormOperatorName('');
    setFormSupervisor('');
    setFormNotes('');
    setIsLogModalOpen(true);
  };

  const handleOpenEditModal = (log: SiteLogsheet) => {
    setEditingLog(log);
    setFormRentalId(log.rental_id || '');
    setFormMachineId(log.machine_id);
    setFormCustomerId(log.customer_id || log.rental?.customer_id || '');
    setFormLogDate(log.log_date);
    setFormStatus(log.status);
    setFormShifts(String(log.shift_count ?? 1));
    setFormRegularHrs(String(log.regular_hours ?? 10));
    setFormOvertimeHrs(String(log.overtime_hours ?? 0));
    setFormBreakdownHrs(String(log.breakdown_hours ?? 0));
    setFormDieselLiters(String(log.diesel_liters ?? 0));
    setFormOperatorName(log.operator_name || '');
    setFormSupervisor(log.site_supervisor_name || '');
    setFormNotes(log.notes || '');
    setIsLogModalOpen(true);
  };

  const handleStartInlineEdit = (log: SiteLogsheet) => {
    setInlineEditId(log.id);
    setInlineStatus(log.status);
    setInlineShifts(String(log.shift_count ?? 1));
    setInlineRegularHrs(String(log.regular_hours ?? 10));
    setInlineOvertimeHrs(String(log.overtime_hours ?? 0));
    setInlineBreakdownHrs(String(log.breakdown_hours ?? 0));
    setInlineOperator(log.operator_name || '');
  };

  const handleSaveInlineEdit = async (logId: string) => {
    setSavingInline(true);
    try {
      const { error } = await supabase
        .from('site_logsheets')
        .update({
          status: inlineStatus,
          shift_count: Number(inlineShifts) || 0,
          regular_hours: Number(inlineRegularHrs) || 0,
          overtime_hours: Number(inlineOvertimeHrs) || 0,
          breakdown_hours: Number(inlineBreakdownHrs) || 0,
          operator_name: inlineOperator.trim() || null,
        })
        .eq('id', logId);

      if (error) throw error;
      addToast('Working hours & shift log updated!', 'success');
      setInlineEditId(null);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to update logsheet.', 'error');
    } finally {
      setSavingInline(false);
    }
  };

  const handleSaveLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !formMachineId) {
      addToast('Please select a machine or active rental contract.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        company_id: company.id,
        rental_id: formRentalId || null,
        machine_id: formMachineId,
        customer_id: formCustomerId || null,
        log_date: formLogDate,
        status: formStatus,
        shift_count: Number(formShifts) || 0,
        regular_hours: Number(formRegularHrs) || 0,
        overtime_hours: Number(formOvertimeHrs) || 0,
        breakdown_hours: Number(formBreakdownHrs) || 0,
        diesel_liters: Number(formDieselLiters) || 0,
        operator_name: formOperatorName.trim() || null,
        site_supervisor_name: formSupervisor.trim() || null,
        notes: formNotes.trim() || null,
      };

      if (editingLog) {
        const { error } = await supabase
          .from('site_logsheets')
          .update(payload)
          .eq('id', editingLog.id);

        if (error) throw error;
        addToast(`Site logsheet updated for ${formatDate(formLogDate)}.`, 'success');
      } else {
        const { error } = await supabase.from('site_logsheets').insert({
          ...payload,
          created_by: user?.id || null,
        });

        if (error) throw error;
        addToast(`Site logsheet entry recorded for ${formatDate(formLogDate)}.`, 'success');
      }

      setIsLogModalOpen(false);
      setEditingLog(null);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to save logsheet entry.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk Generate Monthly Shifts & Overtime for a Rental
  const handleBulkGenerateLogs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !bulkRentalId) {
      addToast('Please select a Rental Contract first.', 'warning');
      return;
    }

    const r = rentals.find((rent) => rent.id === bulkRentalId);
    if (!r) return;

    const totalShifts = Math.max(1, Math.min(31, Number(bulkTotalShifts) || 25));
    const totalOt = Math.max(0, Number(bulkTotalOvertime) || 0);

    setSubmitting(true);
    try {
      const baseDate = new Date(startDate);
      const entries = [];

      for (let i = 0; i < totalShifts; i++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];

        // Put overtime on the first day or distribute cleanly
        const otForDay = i === 0 ? totalOt : 0;

        entries.push({
          company_id: company.id,
          rental_id: r.id,
          machine_id: r.machine_id,
          customer_id: r.customer_id,
          log_date: dateStr,
          status: 'Working' as SiteLogStatus,
          shift_count: 1,
          regular_hours: 10,
          overtime_hours: otForDay,
          breakdown_hours: 0,
          diesel_liters: 0,
          operator_name: bulkOperatorName.trim() || null,
          notes:
            otForDay > 0
              ? `Monthly logbook (${totalShifts} shifts + ${totalOt} HRS OT)`
              : `Standard 10+1 hr shift`,
          created_by: user?.id || null,
        });
      }

      const { error } = await supabase.from('site_logsheets').insert(entries);
      if (error) throw error;

      addToast(
        `Generated ${totalShifts} working shift logs + ${totalOt} OT hours for ${r.rental_code}!`,
        'success'
      );
      setIsBulkModalOpen(false);
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to generate bulk logs.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await supabase.from('site_logsheets').delete().eq('id', id);
      addToast('Logsheet entry removed.', 'info');
      await loadData();
    } catch (err: any) {
      addToast(err.message || 'Failed to delete log.', 'error');
    }
  };

  const filteredLogs = useMemo(() => {
    if (selectedRentalFilter === 'ALL') return logs;
    return logs.filter((l) => l.rental_id === selectedRentalFilter);
  }, [logs, selectedRentalFilter]);

  // Aggregate per-Rental Summary for 1-click GST Invoicing
  const rentalSummaries = useMemo(() => {
    const map = new Map<
      string,
      {
        rentalId: string;
        rentalCode: string;
        customerId: string;
        customerName: string;
        machineId: string;
        machineName: string;
        totalShifts: number;
        totalOvertimeHrs: number;
        totalBreakdownHrs: number;
        totalDiesel: number;
      }
    >();

    logs.forEach((l) => {
      const key = l.rental_id || `mach_${l.machine_id}`;
      const existing = map.get(key) || {
        rentalId: l.rental_id || '',
        rentalCode: l.rental?.rental_code || 'Direct Machine Log',
        customerId: l.customer_id || l.rental?.customer_id || '',
        customerName: l.customer?.name || 'Site Client',
        machineId: l.machine_id,
        machineName: l.machine?.machine_name || 'Boom Lift',
        totalShifts: 0,
        totalOvertimeHrs: 0,
        totalBreakdownHrs: 0,
        totalDiesel: 0,
      };

      existing.totalShifts += Number(l.shift_count || 0);
      existing.totalOvertimeHrs += Number(l.overtime_hours || 0);
      existing.totalBreakdownHrs += Number(l.breakdown_hours || 0);
      existing.totalDiesel += Number(l.diesel_liters || 0);

      map.set(key, existing);
    });

    return Array.from(map.values());
  }, [logs]);

  const handleExportLogsheet = () => {
    const rows = filteredLogs.map((l) => ({
      Date: formatDate(l.log_date),
      'Rental Contract': l.rental?.rental_code || '—',
      Customer: l.customer?.name || '—',
      Machine: l.machine?.machine_name || '—',
      'Serial No': l.machine?.serial_number || '—',
      Status: l.status,
      Shifts: l.shift_count,
      'Regular Hours': l.regular_hours,
      'Overtime (HRS)': l.overtime_hours,
      'Breakdown (HRS)': l.breakdown_hours,
      'Diesel (Liters)': l.diesel_liters,
      Operator: l.operator_name || '—',
      Notes: l.notes || '',
    }));
    exportToExcel(rows, `Site_Logsheet_${startDate}_to_${endDate}`, 'Site Logsheet');
    addToast('Exported Site Logsheet to Excel (.xlsx)', 'success');
  };

  if (loading) {
    return <LoadingSpinner message="Loading site shift & overtime logsheets..." size="lg" />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Site Logsheets — Daily Shifts & Overtime Attendance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Track daily 10+1 hr working shifts, edit working hours & overtime anytime, and generate exact monthly GST Invoices in 1 click
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportLogsheet}
            disabled={filteredLogs.length === 0}
            leftIcon={<FileSpreadsheet className="w-4 h-4" />}
          >
            Export Logsheet
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setBulkRentalId(rentals[0]?.id || '');
              setIsBulkModalOpen(true);
            }}
            leftIcon={<Sparkles className="w-4 h-4" />}
          >
            Bulk Month Logbook
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAddModal}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Log Daily Shift / OT
          </Button>
        </div>
      </div>

      {/* Date Range & Contract Filter */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Period From"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Period To"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <Select
            label="Filter by Rental Agreement"
            value={selectedRentalFilter}
            onChange={(e) => setSelectedRentalFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Deployed Machines & Contracts' },
              ...rentals.map((r) => ({
                value: r.id,
                label: `${r.rental_code} — ${r.customer?.name || ''} (${r.machine?.machine_name || ''})`,
              })),
            ]}
          />
        </div>
      </Card>

      {/* Rental-Wise Monthly Summary Cards with 1-Click GST Invoice Generation */}
      {rentalSummaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rentalSummaries.map((s, idx) => (
            <Card key={idx} className="bg-slate-900 text-white border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-blue-400">{s.rentalCode}</span>
                    <span className="text-slate-500">•</span>
                    <span className="text-xs font-semibold text-slate-300">{s.customerName}</span>
                  </div>
                  <h3 className="text-sm font-black text-white mt-0.5 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    {s.machineName}
                  </h3>
                </div>

                <Button
                  variant="success"
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/invoices?rentalId=${s.rentalId}&customerId=${s.customerId}&machineId=${s.machineId}&shifts=${s.totalShifts}&otHours=${s.totalOvertimeHrs}&from=${startDate}&to=${endDate}`
                    )
                  }
                  leftIcon={<Receipt className="w-4 h-4" />}
                >
                  Bill {s.totalShifts} Shifts + {s.totalOvertimeHrs} OT HRS
                </Button>
              </div>

              <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-slate-800 text-center">
                <div className="bg-slate-800/80 rounded-lg p-2">
                  <span className="text-[10px] text-slate-400 uppercase block">Total Shifts</span>
                  <span className="text-base font-black text-emerald-400">{s.totalShifts}</span>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2">
                  <span className="text-[10px] text-slate-400 uppercase block">Overtime (HRS)</span>
                  <span className="text-base font-black text-blue-400">{s.totalOvertimeHrs}</span>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2">
                  <span className="text-[10px] text-slate-400 uppercase block">Breakdown (HRS)</span>
                  <span className="text-base font-black text-rose-400">{s.totalBreakdownHrs}</span>
                </div>
                <div className="bg-slate-800/80 rounded-lg p-2">
                  <span className="text-[10px] text-slate-400 uppercase block">Diesel (L)</span>
                  <span className="text-base font-black text-amber-400">{s.totalDiesel}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Daily Logsheets Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8" />}
          title="No Site Logsheet Entries for Selected Period"
          description="Log daily boom lift working shifts (10+1 hrs) and overtime hours, or use 'Bulk Month Logbook' to generate a month's shifts and auto-bill your GST Invoice."
          actionLabel="+ Log Daily Shift / OT"
          onAction={handleOpenAddModal}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Machine & Contract</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Shifts</th>
                  <th className="py-3 px-3 text-center">Reg. Hours</th>
                  <th className="py-3 px-3 text-center">Overtime (HRS)</th>
                  <th className="py-3 px-3 text-center">Breakdown</th>
                  <th className="py-3 px-3">Operator</th>
                  <th className="py-3 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLogs.map((l) => {
                  const isInlineEditing = inlineEditId === l.id;

                  return (
                    <tr
                      key={l.id}
                      className={
                        isInlineEditing
                          ? 'bg-blue-50/70 transition-colors'
                          : 'hover:bg-slate-50/70 transition-colors'
                      }
                    >
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {formatDate(l.log_date)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-800 block">
                          {l.machine?.machine_name || 'Boom Lift'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {l.rental?.rental_code || 'Direct'} • {l.customer?.name || ''}
                        </span>
                      </td>

                      {isInlineEditing ? (
                        <>
                          <td className="py-2 px-2 text-center">
                            <select
                              value={inlineStatus}
                              onChange={(e) => {
                                const st = e.target.value as SiteLogStatus;
                                setInlineStatus(st);
                                if (st === 'Breakdown' || st === 'Holiday / Sunday') {
                                  setInlineShifts('0');
                                  setInlineRegularHrs('0');
                                  if (st === 'Breakdown') setInlineBreakdownHrs('10');
                                } else {
                                  setInlineShifts('1');
                                  setInlineRegularHrs('10');
                                  setInlineBreakdownHrs('0');
                                }
                              }}
                              className="text-xs border border-blue-300 rounded-md px-2 py-1 bg-white font-semibold text-slate-800"
                            >
                              <option value="Working">Working</option>
                              <option value="Idle / Stand-by">Idle / Stand-by</option>
                              <option value="Breakdown">Breakdown</option>
                              <option value="Holiday / Sunday">Holiday / Sunday</option>
                            </select>
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max="2"
                              value={inlineShifts}
                              onChange={(e) => setInlineShifts(e.target.value)}
                              className="w-16 text-center text-xs font-bold border border-blue-300 rounded-md px-1.5 py-1 bg-white text-slate-900"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inlineRegularHrs}
                              onChange={(e) => setInlineRegularHrs(e.target.value)}
                              className="w-16 text-center text-xs font-bold border border-blue-300 rounded-md px-1.5 py-1 bg-white text-slate-900"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inlineOvertimeHrs}
                              onChange={(e) => setInlineOvertimeHrs(e.target.value)}
                              className="w-16 text-center text-xs font-bold border border-blue-400 rounded-md px-1.5 py-1 bg-white text-blue-700"
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number"
                              step="any"
                              min="0"
                              value={inlineBreakdownHrs}
                              onChange={(e) => setInlineBreakdownHrs(e.target.value)}
                              className="w-16 text-center text-xs font-bold border border-rose-300 rounded-md px-1.5 py-1 bg-white text-rose-700"
                            />
                          </td>
                          <td className="py-2 px-2">
                            <input
                              type="text"
                              value={inlineOperator}
                              onChange={(e) => setInlineOperator(e.target.value)}
                              placeholder="Operator"
                              className="w-28 text-xs border border-blue-300 rounded-md px-2 py-1 bg-white text-slate-800"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleSaveInlineEdit(l.id)}
                                disabled={savingInline}
                                className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                                title="Save Working Hours"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setInlineEditId(null)}
                                className="p-1.5 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition-colors cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-3 text-center">
                            <Badge
                              variant={
                                l.status === 'Working'
                                  ? 'success'
                                  : l.status === 'Breakdown'
                                  ? 'danger'
                                  : 'default'
                              }
                              size="sm"
                            >
                              {l.status}
                            </Badge>
                          </td>
                          <td
                            onClick={() => handleStartInlineEdit(l)}
                            className="py-3 px-3 text-center font-mono font-bold text-slate-900 cursor-pointer hover:bg-blue-50/60"
                            title="Click to quick-edit working hours"
                          >
                            {l.shift_count}
                          </td>
                          <td
                            onClick={() => handleStartInlineEdit(l)}
                            className="py-3 px-3 text-center font-mono text-slate-600 cursor-pointer hover:bg-blue-50/60"
                            title="Click to quick-edit working hours"
                          >
                            {l.regular_hours} hrs
                          </td>
                          <td
                            onClick={() => handleStartInlineEdit(l)}
                            className="py-3 px-3 text-center font-mono font-bold text-blue-600 cursor-pointer hover:bg-blue-50/60"
                            title="Click to quick-edit overtime hours"
                          >
                            {l.overtime_hours > 0 ? `+${l.overtime_hours} HRS` : '—'}
                          </td>
                          <td
                            onClick={() => handleStartInlineEdit(l)}
                            className="py-3 px-3 text-center font-mono text-rose-600 cursor-pointer hover:bg-blue-50/60"
                            title="Click to quick-edit breakdown hours"
                          >
                            {l.breakdown_hours > 0 ? `${l.breakdown_hours} hrs` : '—'}
                          </td>
                          <td className="py-3 px-3 text-slate-700">{l.operator_name || '—'}</td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleStartInlineEdit(l)}
                                className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors cursor-pointer flex items-center gap-1"
                                title="Quick Edit Working Hours Inline"
                              >
                                <Edit className="w-3 h-3" />
                                Edit Hrs
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(l)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                                title="Full Edit Modal (Date, Diesel, Notes)"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteLog(l.id)}
                                className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                title="Delete Log Entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Daily Log Modal */}
      <Modal
        isOpen={isLogModalOpen}
        onClose={() => {
          setIsLogModalOpen(false);
          setEditingLog(null);
        }}
        title={editingLog ? 'Edit Site Logsheet & Working Hours' : 'Log Daily Site Shift & Overtime'}
        description="Record or update machine working shift (10+1 hrs), overtime hours, breakdown, and diesel usage"
        maxWidth="xl"
      >
        <form onSubmit={handleSaveLog} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Rental Contract"
              value={formRentalId}
              onChange={(e) => handleRentalSelectChange(e.target.value)}
              options={[
                { value: '', label: '-- Direct / Select Rental --' },
                ...rentals.map((r) => ({
                  value: r.id,
                  label: `${r.rental_code} — ${r.customer?.name || ''} (${r.machine?.machine_name || ''})`,
                })),
              ]}
            />
            <Select
              label="Boom Lift Machine"
              required
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
              options={[
                { value: '', label: '-- Select Machine * --' },
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} [${m.machine_id_code}]`,
                })),
              ]}
            />
            <Input
              label="Log Date"
              type="date"
              required
              value={formLogDate}
              onChange={(e) => setFormLogDate(e.target.value)}
            />
            <Select
              label="Day Operational Status"
              value={formStatus}
              onChange={(e) => handleStatusChange(e.target.value as SiteLogStatus)}
              options={[
                { value: 'Working', label: 'Working (Billable Shift)' },
                { value: 'Idle / Stand-by', label: 'Idle / Stand-by at Site (Billable)' },
                { value: 'Breakdown', label: 'Breakdown (Non-Billable)' },
                { value: 'Holiday / Sunday', label: 'Holiday / Sunday Off' },
              ]}
            />
            <Input
              label="Billable Shifts (1 or 0.5 or 0)"
              type="number"
              step="any"
              min="0"
              max="2"
              value={formShifts}
              onChange={(e) => setFormShifts(e.target.value)}
            />
            <Input
              label="Regular Shift Hours"
              type="number"
              step="any"
              min="0"
              value={formRegularHrs}
              onChange={(e) => setFormRegularHrs(e.target.value)}
            />
            <Input
              label="Overtime Hours (HRS)"
              type="number"
              step="any"
              min="0"
              value={formOvertimeHrs}
              onChange={(e) => setFormOvertimeHrs(e.target.value)}
            />
            <Input
              label="Breakdown Hours (HRS)"
              type="number"
              step="any"
              min="0"
              value={formBreakdownHrs}
              onChange={(e) => setFormBreakdownHrs(e.target.value)}
            />
            <Input
              label="Diesel Filled (Liters)"
              type="number"
              step="any"
              min="0"
              value={formDieselLiters}
              onChange={(e) => setFormDieselLiters(e.target.value)}
            />
            <Input
              label="Operator Name"
              placeholder="e.g., Ramesh Kumar"
              value={formOperatorName}
              onChange={(e) => setFormOperatorName(e.target.value)}
            />
            <Input
              label="Site Engineer / Supervisor Sign"
              placeholder="e.g., Verified by L&T Site Eng."
              value={formSupervisor}
              onChange={(e) => setFormSupervisor(e.target.value)}
            />
            <Input
              label="Remarks / Notes"
              placeholder="e.g., Worked extra 3 hours for night girder erection"
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsLogModalOpen(false);
                setEditingLog(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={submitting}>
              {editingLog ? 'Update Site Logsheet' : 'Save Site Log Entry'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Month Logbook Generator Modal */}
      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Generate Monthly Site Logbook"
        description="Quickly populate a month's working shifts and total overtime hours from a signed site logsheet"
        maxWidth="lg"
      >
        <form onSubmit={handleBulkGenerateLogs} className="space-y-4">
          <Select
            label="Select Active Rental Agreement"
            required
            value={bulkRentalId}
            onChange={(e) => setBulkRentalId(e.target.value)}
            options={[
              { value: '', label: '-- Select Rental Contract --' },
              ...rentals.map((r) => ({
                value: r.id,
                label: `${r.rental_code} — ${r.customer?.name || ''} (${r.machine?.machine_name || ''})`,
              })),
            ]}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Total Shifts Worked in Month"
              type="number"
              step="any"
              required
              min="1"
              max="31"
              value={bulkTotalShifts}
              onChange={(e) => setBulkTotalShifts(e.target.value)}
              helperText="e.g., 25 shifts (out of 26 working days)"
            />
            <Input
              label="Total Overtime Hours (HRS)"
              type="number"
              step="any"
              required
              min="0"
              value={bulkTotalOvertime}
              onChange={(e) => setBulkTotalOvertime(e.target.value)}
              helperText="e.g., 29 HRS"
            />
          </div>
          <Input
            label="Operator Name"
            placeholder="e.g., Suresh Yadav"
            value={bulkOperatorName}
            onChange={(e) => setBulkOperatorName(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button type="button" variant="ghost" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="success" isLoading={submitting}>
              Generate Monthly Logbook
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
