import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Receipt,
  Plus,
  Search,
  Download,
  Printer,
  Send,
  Eye,
  AlertCircle,
  Calculator,
  FileSpreadsheet,
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
import { SignaturePadInput } from '@/components/ui/SignaturePadInput';
import { formatCurrency, formatDate, numberToWordsINR, formatSequentialNotes } from '@/lib/utils';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { exportInvoiceToExcel } from '@/lib/excelExport';
import { generateInvoiceWhatsAppMessage, openWhatsAppLink } from '@/lib/whatsapp';
import { Invoice, Customer, Machine, Rental, BankAccount, InvoiceStatus } from '@/types';

interface NewItemRow {
  description: string;
  sac_code: string;
  quantity: number;
  unit: string;
  rate: number;
}

export const InvoicesPage: React.FC = () => {
  const { company, user, refreshAuth } = useAuth();
  const { addToast } = useNotification();
  const [searchParams] = useSearchParams();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'ALL');

  // Create Invoice Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Preview Invoice Modal State
  const [previewInvoice, setPreviewInvoice] = useState<Invoice | null>(null);

  // Form Fields
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState(
    new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [formCustomerId, setFormCustomerId] = useState(searchParams.get('customerId') || '');
  const [formRentalId, setFormRentalId] = useState(searchParams.get('rentalId') || '');
  const [formMachineId, setFormMachineId] = useState(searchParams.get('machineId') || '');
  const [formPeriodStart, setFormPeriodStart] = useState('');
  const [formPeriodEnd, setFormPeriodEnd] = useState('');
  const [formGstRate, setFormGstRate] = useState('18.00');
  const [formDiscount, setFormDiscount] = useState('0');
  const [formBankAccountId, setFormBankAccountId] = useState('');

  // Excel-aligned extra fields: Consignee Site Address, Payment Terms, Machine Details, Salary Adjustment, Notes
  const [formSiteAddress, setFormSiteAddress] = useState('');
  const [formPaymentTerms, setFormPaymentTerms] = useState('After Invoice Submission within 60 days');
  const [formMachineSerial, setFormMachineSerial] = useState('');
  const [formMachineModel, setFormMachineModel] = useState('');
  const [formMonthlyRentalRate, setFormMonthlyRentalRate] = useState('210000');

  // Pro-rata Shift & Overtime Calculator (26 working days, 10 hrs/shift)
  const [calcShiftsWorked, setCalcShiftsWorked] = useState('26');
  const [calcOvertimeHours, setCalcOvertimeHours] = useState('0');

  // Operator Salary adjustment (Row 29 of reference Excel: "Salary | 25000")
  const [formSalaryAmount, setFormSalaryAmount] = useState('0');
  const [formSalaryType, setFormSalaryType] = useState<'DEDUCT' | 'ADD'>('DEDUCT');

  // Sequential numbered notes (1., 2., 3.)
  const [noteItems, setNoteItems] = useState<string[]>([
    'Working hour of 10+1 hrs for 26 working days per month',
    'Additional working hours will paid on Pro rate basis',
    'Payment due within 15-60 days of invoice submission',
  ]);
  const [formSignatureUrl, setFormSignatureUrl] = useState<string>('');
  const [formTerms, setFormTerms] = useState(
    '1. Payment due within 15-60 days of invoice submission. 2. 18% p.a. interest applicable on overdue accounts.'
  );

  // Dynamic Item Rows
  const [items, setItems] = useState<NewItemRow[]>([
    {
      description: 'HIRING Charges',
      sac_code: '997319',
      quantity: 1,
      unit: 'Month',
      rate: 210000,
    },
  ]);

  const loadData = async () => {
    if (!company?.id) return;
    setLoading(true);
    try {
      // 1. Fetch Invoices with Items, Customer, Machine, and Rental
      const { data: invData } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*), customer:customers(*), machine:machines(*), rental:rentals(*)')
        .eq('company_id', company.id)
        .order('invoice_date', { ascending: false });

      if (invData) setInvoices(invData as Invoice[]);

      // 2. Fetch Customers
      const { data: custData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false)
        .order('name', { ascending: true });

      if (custData) {
        setCustomers(custData as Customer[]);
        if (!formCustomerId && custData.length > 0) {
          const defaultCustId = searchParams.get('customerId') || custData[0].id;
          setFormCustomerId(defaultCustId);
        }
      }

      // 3. Fetch Machines
      const { data: machData } = await supabase
        .from('machines')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_archived', false);

      if (machData) setMachines(machData as Machine[]);

      // 4. Fetch Rentals
      const { data: rentData } = await supabase
        .from('rentals')
        .select('*, customer:customers(*), machine:machines(*)')
        .eq('company_id', company.id);

      if (rentData) setRentals(rentData as Rental[]);

      // 5. Fetch Bank Accounts
      const { data: bankData } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true);

      if (bankData && bankData.length > 0) {
        setBankAccounts(bankData as BankAccount[]);
        const primary = bankData.find((b) => b.is_primary) || bankData[0];
        if (primary && !formBankAccountId) {
          setFormBankAccountId(primary.id);
        }
      }
    } catch (err) {
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    if (company?.signature_url) {
      setFormSignatureUrl(company.signature_url);
    }
  }, [company?.id, company?.signature_url]);

  // Auto-open Create Modal when navigated from Rentals or Site Logsheets page
  useEffect(() => {
    const paramRentalId = searchParams.get('rentalId');
    const paramShifts = searchParams.get('shifts');
    const paramOt = searchParams.get('otHours');
    const paramFrom = searchParams.get('from');
    const paramTo = searchParams.get('to');

    if ((paramRentalId || paramShifts) && !loading) {
      if (paramRentalId) setFormRentalId(paramRentalId);
      if (paramFrom) setFormPeriodStart(paramFrom);
      if (paramTo) setFormPeriodEnd(paramTo);
      if (paramShifts) setCalcShiftsWorked(paramShifts);
      if (paramOt) setCalcOvertimeHours(paramOt);
      handleOpenCreateModal();
    }
  }, [searchParams, rentals.length, loading]);

  // Autofill customer site address when customer changes
  useEffect(() => {
    if (formCustomerId) {
      const c = customers.find((cust) => cust.id === formCustomerId);
      if (c && !formRentalId) {
        setFormSiteAddress(c.site_address || `${c.billing_address}, ${c.city}, ${c.state}`);
      }
    }
  }, [formCustomerId, customers, formRentalId]);

  // Autofill machine details when machine changes
  useEffect(() => {
    if (formMachineId) {
      const m = machines.find((mach) => mach.id === formMachineId);
      if (m) {
        setFormMachineSerial(m.serial_number || '');
        setFormMachineModel(`${m.brand || ''} ${m.model || ''}`.trim());
        if (m.monthly_rental_rate > 0) {
          setFormMonthlyRentalRate(String(m.monthly_rental_rate));
        }
      }
    }
  }, [formMachineId, machines]);

  // Autofill rental details when rental selected
  useEffect(() => {
    if (formRentalId) {
      const selectedR = rentals.find((r) => r.id === formRentalId);
      if (selectedR) {
        setFormCustomerId(selectedR.customer_id);
        if (selectedR.machine_id) {
          setFormMachineId(selectedR.machine_id);
        }
        if (selectedR.site_location) {
          setFormSiteAddress(selectedR.site_location);
        }
        if (selectedR.payment_terms) {
          setFormPaymentTerms(selectedR.payment_terms);
        }
        if (selectedR.start_date) {
          setFormPeriodStart(selectedR.start_date);
        }
        if (selectedR.expected_end_date) {
          setFormPeriodEnd(selectedR.expected_end_date);
        }
        if (selectedR.gst_rate) {
          setFormGstRate(String(selectedR.gst_rate));
        }
        const monthlyRate = Number(selectedR.monthly_rental || 0);
        if (monthlyRate > 0) {
          setFormMonthlyRentalRate(String(monthlyRate));
        }
        if (selectedR.operator_charges > 0) {
          setFormSalaryAmount(String(selectedR.operator_charges));
        }

        const pStart = (searchParams.get('from') || selectedR.start_date)
          ? formatDate(searchParams.get('from') || selectedR.start_date)
          : '';
        const pEnd = (searchParams.get('to') || selectedR.expected_end_date)
          ? formatDate(searchParams.get('to') || selectedR.expected_end_date)
          : '';
        const periodLabel = pStart && pEnd ? ` ( ${pStart} to ${pEnd})` : '';

        const paramShifts = Number(searchParams.get('shifts') || 0);
        const paramOt = Number(searchParams.get('otHours') || 0);

        if (paramShifts > 0 && monthlyRate > 0) {
          const perShiftRate = Math.round((monthlyRate / 26) * 100) / 100;
          const perHourRate = Math.round((perShiftRate / 10) * 100) / 100;
          const logRows: NewItemRow[] = [
            {
              description: `HIRING Charges${periodLabel}`,
              sac_code: '997319',
              quantity: paramShifts,
              unit: 'Shift',
              rate: perShiftRate,
            },
          ];
          if (paramOt > 0) {
            logRows.push({
              description: 'Over Time',
              sac_code: '997319',
              quantity: paramOt,
              unit: 'HRS',
              rate: perHourRate,
            });
          }
          setItems(logRows);
        } else {
          setItems([
            {
              description: `HIRING Charges${periodLabel}`,
              sac_code: '997319',
              quantity: 1,
              unit: 'Month',
              rate: monthlyRate,
            },
          ]);
        }
      }
    }
  }, [formRentalId, rentals]);

  // Apply Pro-rata Shifts & Overtime Calculator (Exact Excel Formula: Monthly / 26 days, Shift / 10 hrs)
  const handleApplyProRataCalculator = () => {
    const monthly = Number(formMonthlyRentalRate) || 0;
    if (monthly <= 0) {
      addToast('Please enter a valid Monthly Rental amount first.', 'warning');
      return;
    }
    const shifts = Number(calcShiftsWorked) || 26;
    const otHours = Number(calcOvertimeHours) || 0;

    // 26 working days per month standard boom lift formula
    const perShiftRate = Math.round((monthly / 26) * 100) / 100;
    // 10 working hours per shift
    const perHourRate = Math.round((perShiftRate / 10) * 100) / 100;

    const pStart = formPeriodStart ? formatDate(formPeriodStart).replace(/\s/g, '.') : '';
    const pEnd = formPeriodEnd ? formatDate(formPeriodEnd).replace(/\s/g, '.') : '';
    const rangeText = pStart && pEnd ? ` ( ${pStart} to ${pEnd})` : '';

    const newRows: NewItemRow[] = [
      {
        description: `HIRING Charges${rangeText}`,
        sac_code: '997319',
        quantity: shifts,
        unit: 'Shift',
        rate: perShiftRate,
      },
    ];

    if (otHours > 0) {
      newRows.push({
        description: 'Over Time',
        sac_code: '',
        quantity: otHours,
        unit: 'HRS',
        rate: perHourRate,
      });
    }

    setItems(newRows);
    addToast(
      `Applied pro-rata calculation: ${shifts} Shifts @ ₹${perShiftRate}/shift${
        otHours > 0 ? ` + ${otHours} OT HRS @ ₹${perHourRate}/hr` : ''
      }`,
      'info'
    );
  };

  // Open Create Modal and generate unique invoice number
  const handleOpenCreateModal = async () => {
    if (!company?.id) return;

    try {
      const { data: nextNumber, error } = await supabase.rpc('get_next_invoice_number', {
        p_company_id: company.id,
        p_prefix: 'DLR',
      });

      if (!error && nextNumber) {
        setFormInvoiceNumber(nextNumber);
      } else {
        const fy = new Date().getFullYear();
        setFormInvoiceNumber(`DLR/${fy.toString().slice(2)}-${(fy + 1).toString().slice(2)}/${Math.floor(10 + Math.random() * 90)}`);
      }
    } catch {
      const fy = new Date().getFullYear();
      setFormInvoiceNumber(`DLR/${fy.toString().slice(2)}-${(fy + 1).toString().slice(2)}/${Math.floor(10 + Math.random() * 90)}`);
    }

    setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormDueDate(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

    if (!formCustomerId && customers.length > 0) {
      const firstCust = customers[0];
      setFormCustomerId(firstCust.id);
      setFormSiteAddress(firstCust.site_address || `${firstCust.billing_address}, ${firstCust.city}, ${firstCust.state}`);
    }

    if (!formMachineId && machines.length > 0) {
      const firstMach = machines[0];
      setFormMachineId(firstMach.id);
      setFormMachineSerial(firstMach.serial_number || '');
      setFormMachineModel(`${firstMach.brand || ''} ${firstMach.model || ''}`.trim());
      if (firstMach.monthly_rental_rate > 0) {
        setFormMonthlyRentalRate(String(firstMach.monthly_rental_rate));
      }
    }

    if (!formBankAccountId && bankAccounts.length > 0) {
      const primary = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
      if (primary) setFormBankAccountId(primary.id);
    }

    if (!formPeriodStart) {
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      setFormPeriodStart(firstDay);
      setFormPeriodEnd(lastDay);
    }

    setIsCreateModalOpen(true);
  };

  // Tax & Grand Total calculations (matching reference Excel formulas)
  const selectedCustomer = customers.find((c) => c.id === formCustomerId);
  const isInterstate =
    company?.state_code && selectedCustomer?.state_code
      ? company.state_code !== selectedCustomer.state_code
      : false;

  const rawSubtotal = items.reduce(
    (sum, item) => sum + Math.round((Number(item.quantity) || 0) * (Number(item.rate) || 0) * 100) / 100,
    0
  );
  const discountVal = Number(formDiscount) || 0;
  const taxableSubtotal = Math.max(0, Math.round((rawSubtotal - discountVal) * 100) / 100);
  const taxRate = Number(formGstRate) || 18.0;

  const calculatedTax = Math.round(((taxableSubtotal * taxRate) / 100) * 100) / 100;
  const cgstVal = isInterstate ? 0 : Math.round((calculatedTax / 2) * 100) / 100;
  const sgstVal = isInterstate ? 0 : Math.round((calculatedTax / 2) * 100) / 100;
  const igstVal = isInterstate ? calculatedTax : 0;

  const rawSalary = Math.max(0, Number(formSalaryAmount) || 0);
  const signedSalaryAdjustment = formSalaryType === 'DEDUCT' ? -rawSalary : rawSalary;

  const rawGrandTotal = taxableSubtotal + calculatedTax + signedSalaryAdjustment;
  const grandTotalRounded = Math.max(0, Math.round(rawGrandTotal));
  const roundOffVal = Math.round((grandTotalRounded - rawGrandTotal) * 100) / 100;

  // Add Item Row
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        description: 'Over Time',
        sac_code: '997319',
        quantity: 1,
        unit: 'HRS',
        rate: 807.69,
      },
    ]);
  };

  // Remove Item Row
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Submit Invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!company?.id) {
      addToast('Company details not loaded. Please refresh the page.', 'error');
      return;
    }

    if (!formCustomerId) {
      addToast('Please select a customer for this invoice.', 'warning');
      return;
    }

    if (!selectedCustomer) {
      addToast('Selected customer not found. Please choose a valid customer.', 'warning');
      return;
    }

    if (!formInvoiceNumber.trim()) {
      addToast('Please provide an invoice number.', 'warning');
      return;
    }

    if (taxableSubtotal <= 0) {
      addToast('Gross taxable amount must be greater than zero. Please enter line item rates.', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const selectedBank = bankAccounts.find((b) => b.id === formBankAccountId);

      // 1. Prepare Invoice Header Payload
      const invoicePayload = {
        company_id: company.id,
        invoice_number: formInvoiceNumber.trim(),
        rental_id: formRentalId || null,
        customer_id: formCustomerId,
        machine_id: formMachineId || null,
        invoice_date: formInvoiceDate,
        due_date: formDueDate,
        period_start: formPeriodStart || null,
        period_end: formPeriodEnd || null,
        customer_snapshot: {
          name: selectedCustomer.name,
          gstin: selectedCustomer.gstin || null,
          billing_address: selectedCustomer.billing_address || '',
          site_address: formSiteAddress || selectedCustomer.site_address || selectedCustomer.billing_address || '',
          payment_terms: formPaymentTerms || 'After Invoice Submission within 60 days',
          machine_serial: formMachineSerial || null,
          machine_model: formMachineModel || null,
          monthly_rental: Number(formMonthlyRentalRate) || 0,
          salary_adjustment: signedSalaryAdjustment,
          city: selectedCustomer.city || '',
          state: selectedCustomer.state || '',
          state_code: selectedCustomer.state_code || '27',
          pincode: selectedCustomer.pincode || null,
          contact_person: selectedCustomer.contact_person || null,
          mobile: selectedCustomer.mobile || '',
        },
        company_snapshot: {
          name: company.name,
          gstin: company.gstin || null,
          pan: company.pan || null,
          msme_number: company.msme_number || null,
          signature_url: formSignatureUrl || company.signature_url || null,
          business_address: company.business_address || '',
          city: company.city || '',
          state: company.state || '',
          state_code: company.state_code || '27',
          pincode: company.pincode || null,
          mobile: company.mobile || '',
          email: company.email || '',
        },
        subtotal: rawSubtotal,
        discount: discountVal,
        taxable_amount: taxableSubtotal,
        is_interstate: isInterstate,
        gst_rate: taxRate,
        cgst_amount: cgstVal,
        sgst_amount: sgstVal,
        igst_amount: igstVal,
        salary_adjustment: signedSalaryAdjustment,
        round_off: roundOffVal,
        grand_total: grandTotalRounded,
        paid_amount: 0,
        tds_amount: 0,
        balance_due: grandTotalRounded,
        status: 'Issued' as InvoiceStatus,
        notes: noteItems
          .map((n) => n.trim())
          .filter(Boolean)
          .map((n, idx) => `${idx + 1}. ${n.replace(/^\d+[\.\)]\s*/, '')}`)
          .join('\n'),
        terms: formTerms,
        bank_details_snapshot: selectedBank
          ? {
              bank_name: selectedBank.bank_name,
              account_holder_name: selectedBank.account_holder_name,
              account_number: selectedBank.account_number,
              ifsc_code: selectedBank.ifsc_code,
              branch_name: selectedBank.branch_name,
              upi_id: selectedBank.upi_id,
            }
          : null,
        created_by: user?.id || null,
      };

      const { data: createdInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert(invoicePayload)
        .select()
        .single();

      if (invErr) throw invErr;

      // 2. Insert Invoice Items
      const itemInserts = items.map((item) => {
        const q = Math.max(0.01, Number(item.quantity) || 1);
        const r = Number(item.rate) || 0;
        return {
          invoice_id: createdInvoice.id,
          description: item.description.trim() || 'HIRING Charges',
          sac_code: item.sac_code.trim() || '997319',
          quantity: q,
          unit: item.unit.trim() || 'Shift',
          rate: r,
          amount: Math.round(q * r * 100) / 100,
        };
      });

      const { error: itemsErr } = await supabase.from('invoice_items').insert(itemInserts);
      if (itemsErr) throw itemsErr;

      // Save E-Signature / Stamp photo permanently to company profile if newly added or updated
      if (formSignatureUrl && formSignatureUrl !== company.signature_url) {
        await supabase
          .from('companies')
          .update({ signature_url: formSignatureUrl })
          .eq('id', company.id);
        await refreshAuth();
      }

      addToast(`GST Tax Invoice "${formInvoiceNumber}" issued successfully!`, 'success');
      setIsCreateModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error creating invoice:', err);
      if (err.message?.includes('invoices_company_id_invoice_number_key') || err.code === '23505') {
        addToast(`Invoice number "${formInvoiceNumber}" has already been used. Please assign a new number.`, 'error');
      } else {
        addToast(err.message || 'Failed to issue invoice.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Download PDF
  const handleDownloadPDF = (inv: Invoice) => {
    if (!company) return;
    const primaryBank = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
    const doc = generateInvoicePDF(inv, company, primaryBank);
    const filename = `Invoice_${inv.invoice_number.replace(/[\/\\]/g, '_')}.pdf`;
    doc.save(filename);
    addToast(`Downloaded ${filename}`, 'success');
  };

  // Download Excel (.xlsx)
  const handleDownloadExcel = (inv: Invoice) => {
    if (!company) return;
    const primaryBank = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
    exportInvoiceToExcel(inv, company, primaryBank);
    addToast(`Downloaded Excel Invoice ${inv.invoice_number}`, 'success');
  };

  // Print PDF Preview
  const handlePrintPDF = (inv: Invoice) => {
    if (!company) return;
    const primaryBank = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
    const doc = generateInvoicePDF(inv, company, primaryBank);
    doc.autoPrint();
    const pdfBlobUrl = doc.output('bloburl');
    window.open(pdfBlobUrl, '_blank');
  };

  // Send WhatsApp
  const handleSendWhatsApp = (inv: Invoice) => {
    if (!company) return;
    const primaryBank = bankAccounts.find((b) => b.is_primary) || bankAccounts[0];
    const text = generateInvoiceWhatsAppMessage(inv, company, primaryBank);
    const mobile = inv.customer_snapshot?.mobile || inv.customer?.mobile || '';
    if (!mobile) {
      addToast('Customer mobile number not found for WhatsApp dispatch.', 'warning');
      return;
    }
    openWhatsAppLink(mobile, text);
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const s = searchTerm.toLowerCase();
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(s) ||
        (inv.customer_snapshot?.name && inv.customer_snapshot.name.toLowerCase().includes(s)) ||
        (inv.customer?.name && inv.customer.name.toLowerCase().includes(s));

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchTerm, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">GST Tax Invoices & Billing</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Commercial Boom Lift GST Invoicing with Shift/Overtime pro-rata calculator, PDF & Excel (.xlsx) export
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreateModal}
          leftIcon={<Plus className="w-4 h-4" />}
        >
          Issue GST Invoice
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Input
              placeholder="Search invoices by Number, Customer Name, Worksite..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: 'ALL', label: 'All Invoices' },
              { value: 'Issued', label: 'Issued (Pending Payment)' },
              { value: 'Partially Paid', label: 'Partially Paid' },
              { value: 'Paid', label: 'Fully Paid' },
              { value: 'Overdue', label: 'Overdue (Action Required)' },
            ]}
          />
        </div>
      </Card>

      {/* Invoices Table */}
      {loading ? (
        <LoadingSpinner message="Loading GST tax invoices..." />
      ) : filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="w-8 h-8" />}
          title="No GST Invoices Found"
          description={
            searchTerm || statusFilter !== 'ALL'
              ? 'No invoices match the filter criteria.'
              : 'Issue your first commercial boom lift rental tax invoice with automated GST breakdown.'
          }
          actionLabel="+ Issue GST Invoice"
          onAction={handleOpenCreateModal}
        />
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200/80">
                <tr>
                  <th className="py-3.5 px-4">Invoice #</th>
                  <th className="py-3.5 px-4">Customer & Site</th>
                  <th className="py-3.5 px-4">Machine Details</th>
                  <th className="py-3.5 px-4">Invoice / Due Date</th>
                  <th className="py-3.5 px-4 text-right">Taxable (INR)</th>
                  <th className="py-3.5 px-4 text-center">Tax Type</th>
                  <th className="py-3.5 px-4 text-right">Grand Total</th>
                  <th className="py-3.5 px-4 text-right">Balance Due</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-blue-600">
                      <button
                        type="button"
                        onClick={() => setPreviewInvoice(inv)}
                        className="hover:underline text-left cursor-pointer"
                      >
                        {inv.invoice_number}
                      </button>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block truncate max-w-[160px]">
                        {inv.customer_snapshot?.name || inv.customer?.name}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        GST: {inv.customer_snapshot?.gstin || 'Unregistered'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800 block truncate max-w-[140px]">
                        {inv.customer_snapshot?.machine_model ||
                          (inv.machine ? `${inv.machine.brand} ${inv.machine.model}` : '—')}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        SN: {inv.customer_snapshot?.machine_serial || inv.machine?.serial_number || '—'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-slate-800 font-medium block">
                        {formatDate(inv.invoice_date)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Due: {formatDate(inv.due_date)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium text-slate-700">
                      {formatCurrency(inv.taxable_amount)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {inv.is_interstate ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                          IGST ({inv.gst_rate}%)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          CGST + SGST ({(inv.gst_rate / 2).toFixed(1)}% each)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(inv.grand_total)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold">
                      <span className={inv.balance_due > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {formatCurrency(inv.balance_due)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge
                        variant={
                          inv.status === 'Paid'
                            ? 'success'
                            : inv.status === 'Overdue'
                            ? 'danger'
                            : inv.status === 'Partially Paid'
                            ? 'warning'
                            : 'default'
                        }
                        size="sm"
                      >
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setPreviewInvoice(inv)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Preview Tax Invoice"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadPDF(inv)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="Download Tax Invoice PDF"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadExcel(inv)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Download Excel (.xlsx) Invoice"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePrintPDF(inv)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Print Invoice"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleSendWhatsApp(inv)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="Send WhatsApp Payment Alert"
                        >
                          <Send className="w-4 h-4" />
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

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ISSUE GST INVOICE MODAL                                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Issue Commercial GST Tax Invoice"
        description="Aligned with industry-standard Boom Lift Tax Invoice format (Shifts, Overtime, Machine Details & GST)"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          {/* Header row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Invoice Number"
              required
              value={formInvoiceNumber}
              onChange={(e) => setFormInvoiceNumber(e.target.value)}
              helperText="e.g., DLR/25-26/13"
            />
            <Input
              label="Invoice Date (Inv Date)"
              type="date"
              required
              value={formInvoiceDate}
              onChange={(e) => setFormInvoiceDate(e.target.value)}
            />
            <Input
              label="Payment Due Date"
              type="date"
              required
              value={formDueDate}
              onChange={(e) => setFormDueDate(e.target.value)}
            />
          </div>

          {/* Customer, Rental, Machine, Bank Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Select
              label="Bill To (Customer)"
              required
              value={formCustomerId}
              onChange={(e) => {
                const newCustId = e.target.value;
                setFormCustomerId(newCustId);
                if (formRentalId) {
                  const matchR = rentals.find((r) => r.id === formRentalId);
                  if (matchR && matchR.customer_id !== newCustId) {
                    setFormRentalId('');
                  }
                }
              }}
              options={[
                { value: '', label: '-- Select Customer * --' },
                ...customers.map((c) => ({
                  value: c.id,
                  label: `${c.name} (${c.gstin ? `GST: ${c.gstin}` : 'Unregistered'})`,
                })),
              ]}
            />

            <Select
              label="Rental Agreement"
              value={formRentalId}
              onChange={(e) => setFormRentalId(e.target.value)}
              options={[
                { value: '', label: '-- None (Direct Billing) --' },
                ...rentals
                  .filter((r) => !formCustomerId || r.customer_id === formCustomerId)
                  .map((r) => ({
                    value: r.id,
                    label: `${r.rental_code} - ${r.machine?.machine_name || 'Boom Lift'} (${r.site_location})`,
                  })),
              ]}
            />

            <Select
              label="Machine Deployed"
              value={formMachineId}
              onChange={(e) => setFormMachineId(e.target.value)}
              options={[
                { value: '', label: '-- Select Machine --' },
                ...machines.map((m) => ({
                  value: m.id,
                  label: `${m.machine_name} [${m.machine_id_code}] • SN: ${m.serial_number}`,
                })),
              ]}
            />

            <Select
              label="Bank Account on Invoice"
              value={formBankAccountId}
              onChange={(e) => setFormBankAccountId(e.target.value)}
              options={[
                { value: '', label: '-- None --' },
                ...bankAccounts.map((b) => ({
                  value: b.id,
                  label: `${b.bank_name} - ${b.account_number}${b.is_primary ? ' [Primary]' : ''}`,
                })),
              ]}
            />
          </div>

          {/* Consignee Site Address, Payment Terms & Machine Details Box */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
            <div className="sm:col-span-2">
              <Input
                label="Consignee Site Address"
                placeholder="e.g., AMNS PROJECT HAZIRA SITE, SURAT, GUJARAT"
                value={formSiteAddress}
                onChange={(e) => setFormSiteAddress(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Payments Term"
                placeholder="After Invoice Submission within 60 days"
                value={formPaymentTerms}
                onChange={(e) => setFormPaymentTerms(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Machine Model"
                placeholder="e.g., 1350 SJP"
                value={formMachineModel}
                onChange={(e) => setFormMachineModel(e.target.value)}
              />
            </div>
            <div>
              <Input
                label="Machine Serial No"
                placeholder="e.g., 0300231528"
                value={formMachineSerial}
                onChange={(e) => setFormMachineSerial(e.target.value)}
              />
            </div>
          </div>

          {/* Place of Supply & Tax Type Indicator */}
          {selectedCustomer ? (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-500">Place of Supply: </span>
                <span className="font-bold text-slate-800">
                  {selectedCustomer.state} (Code: {selectedCustomer.state_code})
                </span>
                <span className="text-slate-400 mx-2">|</span>
                <span className="text-slate-500">Company State: </span>
                <span className="font-bold text-slate-800">
                  {company?.state} (Code: {company?.state_code})
                </span>
              </div>
              <div>
                {isInterstate ? (
                  <Badge variant="purple" size="sm">
                    Inter-State Sale: IGST ({formGstRate}%) Applicable
                  </Badge>
                ) : (
                  <Badge variant="info" size="sm">
                    Intra-State Sale: CGST + SGST Applicable
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Please select a Customer above to determine GST tax rules and Place of Supply.</span>
            </div>
          )}

          {/* Billing Period, Monthly Rental & Pro-Rata Shift/OT Calculator */}
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-950">
                  Boom Lift Pro-Rata Shift & Overtime Calculator (26 Shifts / Month • 10 Hrs / Shift)
                </span>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleApplyProRataCalculator}
                leftIcon={<Calculator className="w-3.5 h-3.5" />}
              >
                Auto-Fill Shifts & Overtime Rows
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Input
                label="Period From"
                type="date"
                value={formPeriodStart}
                onChange={(e) => setFormPeriodStart(e.target.value)}
              />
              <Input
                label="Period To"
                type="date"
                value={formPeriodEnd}
                onChange={(e) => setFormPeriodEnd(e.target.value)}
              />
              <Input
                label="Monthly Rental (INR)"
                type="number"
                step="any"
                min="0"
                value={formMonthlyRentalRate}
                onChange={(e) => setFormMonthlyRentalRate(e.target.value)}
              />
              <Input
                label="Shifts Worked (out of 26)"
                type="number"
                step="any"
                min="0"
                value={calcShiftsWorked}
                onChange={(e) => setCalcShiftsWorked(e.target.value)}
              />
              <Input
                label="Overtime (HRS)"
                type="number"
                step="any"
                min="0"
                value={calcOvertimeHours}
                onChange={(e) => setCalcOvertimeHours(e.target.value)}
              />
            </div>
          </div>

          {/* Dynamic Item Rows */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Line Items (Description of Service | SAC | Shift / HRS | Unit | Rate | Amount)
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                leftIcon={<Plus className="w-3 h-3" />}
              >
                Add Line Item
              </Button>
            </div>
            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto p-2">
              {items.map((item, index) => {
                const lineAmount = Math.round((Number(item.quantity) || 0) * (Number(item.rate) || 0) * 100) / 100;
                return (
                  <div key={index} className="grid grid-cols-12 gap-2 p-2 items-center text-xs">
                    <div className="col-span-4">
                      <Input
                        placeholder="e.g., HIRING Charges (01.09.2025 to 30.09.2025)"
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].description = e.target.value;
                          setItems(newItems);
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        placeholder="SAC 997319"
                        value={item.sac_code}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].sac_code = e.target.value;
                          setItems(newItems);
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantity = Number(e.target.value) || 0;
                          setItems(newItems);
                        }}
                      />
                    </div>
                    <div className="col-span-1">
                      <Select
                        value={item.unit}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].unit = e.target.value;
                          setItems(newItems);
                        }}
                        options={[
                          { value: 'Shift', label: 'Shift' },
                          { value: 'HRS', label: 'HRS' },
                          { value: 'Month', label: 'Month' },
                          { value: 'Days', label: 'Days' },
                          { value: 'Trip', label: 'Trip' },
                        ]}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        step="any"
                        placeholder="Rate (INR)"
                        value={item.rate}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].rate = Number(e.target.value) || 0;
                          setItems(newItems);
                        }}
                      />
                    </div>
                    <div className="col-span-1 text-right font-mono font-bold text-slate-800">
                      ₹{lineAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </div>
                    <div className="col-span-1 text-center">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* GST Rate, Discount & Operator Salary Adjustment */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
            <Select
              label="GST Tax Rate (%)"
              value={formGstRate}
              onChange={(e) => setFormGstRate(e.target.value)}
              options={[
                { value: '18.00', label: '18% Standard GST' },
                { value: '12.00', label: '12% GST' },
                { value: '5.00', label: '5% GST' },
                { value: '28.00', label: '28% GST' },
                { value: '0.00', label: '0% Nil / Exempt' },
              ]}
            />
            <Input
              label="Discount (INR)"
              type="number"
              step="any"
              min="0"
              placeholder="0.00"
              value={formDiscount}
              onChange={(e) => setFormDiscount(e.target.value)}
            />
            <Input
              label="Operator Salary (INR)"
              type="number"
              step="any"
              min="0"
              placeholder="e.g., 25000"
              value={formSalaryAmount}
              onChange={(e) => setFormSalaryAmount(e.target.value)}
            />
            <Select
              label="Salary Adjustment Mode"
              value={formSalaryType}
              onChange={(e) => setFormSalaryType(e.target.value as 'DEDUCT' | 'ADD')}
              options={[
                { value: 'DEDUCT', label: 'Less: Deduct from Total (Excel Style)' },
                { value: 'ADD', label: 'Add: Charge to Customer' },
              ]}
            />
          </div>

          {/* Tax Calculation Summary Box */}
          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-2 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Total Value (Taxable):</span>
              <span className="font-mono">{formatCurrency(taxableSubtotal)}</span>
            </div>

            {isInterstate ? (
              <div className="flex justify-between text-purple-300 font-semibold">
                <span>IGST @ {taxRate}%:</span>
                <span className="font-mono">{formatCurrency(igstVal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-blue-300 font-semibold">
                  <span>CGST @ {(taxRate / 2).toFixed(1)}%:</span>
                  <span className="font-mono">{formatCurrency(cgstVal)}</span>
                </div>
                <div className="flex justify-between text-blue-300 font-semibold">
                  <span>SGST @ {(taxRate / 2).toFixed(1)}%:</span>
                  <span className="font-mono">{formatCurrency(sgstVal)}</span>
                </div>
              </>
            )}

            {rawSalary > 0 && (
              <div className="flex justify-between text-amber-300 font-semibold">
                <span>Salary ({formSalaryType === 'DEDUCT' ? 'Less: Deduction' : 'Addition'}):</span>
                <span className="font-mono">
                  {formSalaryType === 'DEDUCT' ? '- ' : '+ '}
                  {formatCurrency(rawSalary)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-slate-400">
              <span>Round Off:</span>
              <span className="font-mono">₹{Math.abs(roundOffVal).toFixed(2)}</span>
            </div>

            <div className="pt-2 border-t border-slate-700 flex justify-between text-base font-bold text-white">
              <span>GRAND TOTAL:</span>
              <span className="text-emerald-400 font-mono">{formatCurrency(grandTotalRounded)}</span>
            </div>
            <div className="text-[11px] text-slate-400 italic">
              In Words: {numberToWordsINR(grandTotalRounded)}
            </div>
          </div>

          {/* Sequential Numbered Notes (1., 2., 3.) & E-Signature / Stamp */}
          <div className="space-y-3">
            <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-800">
                    Invoice Notes (Sequential Numbered: 1., 2., 3.)
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Printed in sequence under Bank Details on the GST Invoice
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNoteItems((prev) => [...prev, ''])}
                  leftIcon={<Plus className="w-3 h-3" />}
                >
                  Add Note ({noteItems.length + 1}.)
                </Button>
              </div>

              <div className="space-y-2">
                {noteItems.map((noteText, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200">
                      {idx + 1}.
                    </span>
                    <div className="flex-1">
                      <Input
                        placeholder={`Enter note point ${idx + 1}...`}
                        value={noteText}
                        onChange={(e) => {
                          const updated = [...noteItems];
                          updated[idx] = e.target.value;
                          setNoteItems(updated);
                        }}
                      />
                    </div>
                    {noteItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setNoteItems((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-600 px-1.5 cursor-pointer"
                        title="Remove Note"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <SignaturePadInput
              value={formSignatureUrl}
              onChange={setFormSignatureUrl}
              companyName={company?.name || 'COMPANY'}
              label="Proprietor E-Signature / Stamp Photo (Saved permanently for all future invoices)"
            />
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
              variant="success"
              isLoading={submitting}
            >
              Finalize & Issue GST Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* INTERACTIVE TAX INVOICE PREVIEW MODAL (EXACT EXCEL LAYOUT)     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {previewInvoice && company && (
        <Modal
          isOpen={!!previewInvoice}
          onClose={() => setPreviewInvoice(null)}
          title={`Tax Invoice Preview — ${previewInvoice.invoice_number}`}
          description="Exact commercial GST Tax Invoice alignment matching your reference Excel sheet"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Top Action Bar */}
            <div className="flex flex-wrap items-center justify-end gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleDownloadPDF(previewInvoice)}
                leftIcon={<Download className="w-4 h-4" />}
              >
                Download PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDownloadExcel(previewInvoice)}
                leftIcon={<FileSpreadsheet className="w-4 h-4" />}
              >
                Download Excel (.xlsx)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePrintPDF(previewInvoice)}
                leftIcon={<Printer className="w-4 h-4" />}
              >
                Print Invoice
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleSendWhatsApp(previewInvoice)}
                leftIcon={<Send className="w-4 h-4" />}
              >
                WhatsApp
              </Button>
            </div>

            {/* Excel-Style Bordered Invoice Sheet */}
            <div className="bg-white border-2 border-slate-400 text-slate-900 text-xs font-sans shadow-sm overflow-hidden">
              {/* Row 1: TAX INVOICE Banner */}
              <div className="bg-slate-900 text-white text-center font-black text-base py-2 tracking-widest border-b border-slate-400">
                TAX &nbsp;&nbsp; INVOICE
              </div>

              {/* Row 2: Company Info (Left) + Invoice Meta (Right) */}
              <div className="grid grid-cols-12 border-b border-slate-400">
                <div className="col-span-7 p-3 border-r border-slate-400 space-y-0.5">
                  <div className="font-black text-sm text-blue-950 uppercase">
                    {(previewInvoice.company_snapshot?.name || company.name).toUpperCase().startsWith('M/S')
                      ? (previewInvoice.company_snapshot?.name || company.name).toUpperCase()
                      : `M/S ${(previewInvoice.company_snapshot?.name || company.name).toUpperCase()}`}
                  </div>
                  <div className="text-slate-700 uppercase">
                    {previewInvoice.company_snapshot?.business_address || company.business_address}
                  </div>
                  <div className="text-slate-700 uppercase">
                    {[
                      previewInvoice.company_snapshot?.city || company.city,
                      previewInvoice.company_snapshot?.state || company.state,
                    ]
                      .filter(Boolean)
                      .join(', ')}
                    {(previewInvoice.company_snapshot?.pincode || company.pincode)
                      ? ` - ${previewInvoice.company_snapshot?.pincode || company.pincode}`
                      : ''}
                  </div>
                  <div>Email : {previewInvoice.company_snapshot?.email || company.email || '—'}</div>
                  <div className="font-bold">
                    GST no : &nbsp; {previewInvoice.company_snapshot?.gstin || company.gstin || '—'}
                  </div>
                  {(previewInvoice.company_snapshot?.msme_number || company.msme_number) && (
                    <div className="font-bold">
                      MSME / Udyam Number : {previewInvoice.company_snapshot?.msme_number || company.msme_number}
                    </div>
                  )}
                </div>

                <div className="col-span-5 divide-y divide-slate-300">
                  <div className="grid grid-cols-5">
                    <div className="col-span-2 bg-blue-50 p-2 font-bold border-r border-slate-300">Invoice No</div>
                    <div className="col-span-3 p-2 font-bold text-slate-900">{previewInvoice.invoice_number}</div>
                  </div>
                  <div className="grid grid-cols-5">
                    <div className="col-span-2 bg-blue-50 p-2 font-bold border-r border-slate-300">Inv Date</div>
                    <div className="col-span-3 p-2">{formatDate(previewInvoice.invoice_date)}</div>
                  </div>
                  <div className="grid grid-cols-5">
                    <div className="col-span-2 bg-blue-50 p-2 font-bold border-r border-slate-300">Due Date</div>
                    <div className="col-span-3 p-2">{formatDate(previewInvoice.due_date)}</div>
                  </div>
                  {previewInvoice.period_start && previewInvoice.period_end && (
                    <div className="grid grid-cols-5">
                      <div className="col-span-2 bg-blue-50 p-2 font-bold border-r border-slate-300">Period</div>
                      <div className="col-span-3 p-2">
                        {formatDate(previewInvoice.period_start)} to {formatDate(previewInvoice.period_end)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Bill To + Machine Details (Left) | Consignee Site Address + Payments Term (Right) */}
              <div className="grid grid-cols-12 border-b border-slate-400">
                <div className="col-span-7 border-r border-slate-400 flex flex-col justify-between">
                  <div>
                    <div className="bg-blue-100/80 px-3 py-1 font-bold text-blue-950 border-b border-slate-300">
                      Bill to
                    </div>
                    <div className="p-3 space-y-0.5">
                      <div className="font-bold text-slate-900 uppercase">
                        {(previewInvoice.customer_snapshot?.name || previewInvoice.customer?.name || 'Customer')
                          .toUpperCase()
                          .startsWith('M/S')
                          ? (previewInvoice.customer_snapshot?.name || previewInvoice.customer?.name).toUpperCase()
                          : `M/S ${(previewInvoice.customer_snapshot?.name || previewInvoice.customer?.name || 'Customer').toUpperCase()}`}
                      </div>
                      <div className="text-slate-700 uppercase">
                        {previewInvoice.customer_snapshot?.billing_address || previewInvoice.customer?.billing_address}
                      </div>
                      <div>
                        City : {previewInvoice.customer_snapshot?.city || previewInvoice.customer?.city || '—'}
                      </div>
                      <div>
                        State : {previewInvoice.customer_snapshot?.state || previewInvoice.customer?.state || '—'}
                        {previewInvoice.customer_snapshot?.pincode
                          ? ` , Pin code : ${previewInvoice.customer_snapshot.pincode}`
                          : ''}
                      </div>
                      <div className="font-bold">
                        GST no : &nbsp; {previewInvoice.customer_snapshot?.gstin || previewInvoice.customer?.gstin || 'Unregistered'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="bg-blue-100/80 px-3 py-1 font-bold text-blue-950 border-y border-slate-300">
                      Machine Details
                    </div>
                    <div className="p-3 space-y-0.5 font-semibold">
                      <div>
                        Serial no :{' '}
                        {previewInvoice.customer_snapshot?.machine_serial ||
                          previewInvoice.machine?.serial_number ||
                          '—'}
                      </div>
                      <div>
                        Model :{' '}
                        {previewInvoice.customer_snapshot?.machine_model ||
                          (previewInvoice.machine
                            ? `${previewInvoice.machine.brand} ${previewInvoice.machine.model}`
                            : '—')}
                      </div>
                      <div>
                        Monthly Rental :{' '}
                        {previewInvoice.customer_snapshot?.monthly_rental ||
                          previewInvoice.rental?.monthly_rental ||
                          previewInvoice.machine?.monthly_rental_rate ||
                          '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-span-5 flex flex-col justify-between">
                  <div>
                    <div className="bg-blue-100/80 px-3 py-1 font-bold text-blue-950 border-b border-slate-300">
                      Consignee Site Address
                    </div>
                    <div className="p-3 font-semibold text-slate-800 uppercase whitespace-pre-line">
                      {previewInvoice.customer_snapshot?.site_address ||
                        previewInvoice.rental?.site_location ||
                        previewInvoice.customer?.site_address ||
                        previewInvoice.customer_snapshot?.billing_address ||
                        '—'}
                    </div>
                  </div>

                  <div>
                    <div className="bg-blue-100/80 px-3 py-1 font-bold text-blue-950 border-y border-slate-300">
                      Payments Term
                    </div>
                    <div className="p-3 font-semibold text-slate-800">
                      {previewInvoice.customer_snapshot?.payment_terms ||
                        previewInvoice.rental?.payment_terms ||
                        'After Invoice Submission within 60 days'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 4: Line Items Table */}
              <table className="w-full border-collapse border-b border-slate-400 text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-2 px-2 border-r border-slate-400 text-center w-10">Sr.</th>
                    <th className="py-2 px-3 border-r border-slate-400 text-left">Description of Service</th>
                    <th className="py-2 px-2 border-r border-slate-400 text-center w-24">SAC</th>
                    <th className="py-2 px-2 border-r border-slate-400 text-center w-24">Shift /HRS</th>
                    <th className="py-2 px-3 border-r border-slate-400 text-right w-28">Rate</th>
                    <th className="py-2 px-3 text-right w-32">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {(previewInvoice.items || []).map((it, idx) => (
                    <tr key={idx} className="font-semibold">
                      <td className="py-2 px-2 border-r border-slate-300 text-center">{idx + 1}</td>
                      <td className="py-2 px-3 border-r border-slate-300">{it.description}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center">{it.sac_code}</td>
                      <td className="py-2 px-2 border-r border-slate-300 text-center">{it.quantity}</td>
                      <td className="py-2 px-3 border-r border-slate-300 text-right font-mono">
                        {Number(it.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        {Number(it.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Row 5: Totals Block */}
              <div className="grid grid-cols-12 border-b border-slate-400">
                <div className="col-span-7 p-3 border-r border-slate-400 text-slate-600 flex flex-col justify-center">
                  <div className="font-bold text-slate-800">
                    Tax Regime:{' '}
                    {previewInvoice.is_interstate
                      ? `Inter-State IGST @ ${previewInvoice.gst_rate}%`
                      : `Intra-State CGST + SGST`}
                  </div>
                </div>
                <div className="col-span-5 divide-y divide-slate-300 font-semibold">
                  <div className="flex justify-between p-2">
                    <span>Total Value</span>
                    <span className="font-mono">
                      {Number(previewInvoice.taxable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {previewInvoice.is_interstate ? (
                    <div className="flex justify-between p-2">
                      <span>IGST {previewInvoice.gst_rate}%</span>
                      <span className="font-mono">
                        {Number(previewInvoice.igst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between p-2">
                        <span>CGST {previewInvoice.gst_rate / 2}%</span>
                        <span className="font-mono">
                          {Number(previewInvoice.cgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="flex justify-between p-2">
                        <span>SGST {previewInvoice.gst_rate / 2}%</span>
                        <span className="font-mono">
                          {Number(previewInvoice.sgst_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </>
                  )}
                  {Number(previewInvoice.salary_adjustment ?? previewInvoice.customer_snapshot?.salary_adjustment ?? 0) !== 0 && (
                    <div className="flex justify-between p-2">
                      <span>Salary</span>
                      <span className="font-mono">
                        {Math.abs(
                          Number(previewInvoice.salary_adjustment ?? previewInvoice.customer_snapshot?.salary_adjustment ?? 0)
                        ).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between p-2">
                    <span>Round off</span>
                    <span className="font-mono">{Math.abs(Number(previewInvoice.round_off || 0)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-900 text-white font-black text-sm">
                    <span>GRAND TOTAL</span>
                    <span className="font-mono">
                      {Number(previewInvoice.grand_total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 6: Invoice Value in Words */}
              <div className="bg-blue-50 px-3 py-2 font-bold border-b border-slate-400">
                Invoice Value in words : &nbsp; {numberToWordsINR(Math.round(previewInvoice.grand_total))}
              </div>

              {/* Row 7: Bank Details + Note (Left) | Signature (Right) */}
              <div className="grid grid-cols-12">
                <div className="col-span-7 p-3 border-r border-slate-400 space-y-2">
                  <div className="space-y-0.5 font-semibold">
                    <div className="font-bold text-blue-950">Bank Details :</div>
                    <div>
                      Acc name : &nbsp;{' '}
                      {(previewInvoice.bank_details_snapshot as any)?.account_holder_name ||
                        company.name.toUpperCase()}
                    </div>
                    <div>
                      Bank name : &nbsp; {(previewInvoice.bank_details_snapshot as any)?.bank_name || '—'}
                    </div>
                    <div>
                      Acc no : {(previewInvoice.bank_details_snapshot as any)?.account_number || '—'}
                    </div>
                    <div>
                      IFSC code : {(previewInvoice.bank_details_snapshot as any)?.ifsc_code || '—'}
                    </div>
                    <div>
                      Branch name : &nbsp; {(previewInvoice.bank_details_snapshot as any)?.branch_name || '—'}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 space-y-1 font-semibold">
                    <div className="font-bold text-blue-950">Note :</div>
                    <div className="space-y-0.5 text-slate-800">
                      {formatSequentialNotes(previewInvoice.notes || previewInvoice.terms).map((line, idx) => (
                        <div key={idx}>{line}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="col-span-5 p-3 flex flex-col justify-between items-center text-center font-bold">
                  <div className="text-blue-950 uppercase">
                    For {previewInvoice.company_snapshot?.name || company.name}
                  </div>
                  {(previewInvoice.company_snapshot?.signature_url || company.signature_url) ? (
                    <div className="my-2 flex items-center justify-center">
                      <img
                        src={previewInvoice.company_snapshot?.signature_url || company.signature_url || ''}
                        alt="Authorised Signature"
                        className="max-h-16 max-w-[180px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-[10px] font-normal text-slate-400 my-6">(Authorised Signatory & Seal)</div>
                  )}
                  <div className="text-slate-900 tracking-wider">PROPRIETOR</div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
