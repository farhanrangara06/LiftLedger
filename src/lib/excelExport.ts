import * as XLSX from 'xlsx';
import { Invoice, Company, BankAccount } from '@/types';
import { formatDate, numberToWordsINR, formatSequentialNotes } from './utils';

export function exportToExcel(data: Record<string, any>[], filename: string, sheetName: string = 'Data') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportToCSV(data: Record<string, any>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ─────────────────────────────────────────────────────────────────
// EXPORT SINGLE GST INVOICE TO EXCEL (.xlsx)
// Matches the exact layout & cell structure of Sheet 'a' from
// 13_Oct_2025_Keystone_(Sep_2025)_.xlsx
// ─────────────────────────────────────────────────────────────────
export function exportInvoiceToExcel(
  invoice: Invoice,
  company: Company,
  bankAccount?: BankAccount | null
) {
  const compSnap = invoice.company_snapshot || {};
  const custSnap = invoice.customer_snapshot || {};

  const compName = (compSnap.name || company.name || 'COMPANY').toUpperCase();
  const compAddr = compSnap.business_address || company.business_address || '';
  const compCity = compSnap.city || company.city || '';
  const compState = compSnap.state || company.state || '';
  const compPin = compSnap.pincode || company.pincode || '';
  const compEmail = compSnap.email || company.email || '';
  const compGstin = compSnap.gstin || company.gstin || '';
  const compMsme = compSnap.msme_number || company.msme_number || '';

  const custName = (custSnap.name || invoice.customer?.name || 'Customer').toUpperCase();
  const custAddr = custSnap.billing_address || invoice.customer?.billing_address || '';
  const custCity = custSnap.city || invoice.customer?.city || '';
  const custState = custSnap.state || invoice.customer?.state || '';
  const custPin = custSnap.pincode || invoice.customer?.pincode || '';
  const custGstin = custSnap.gstin || invoice.customer?.gstin || '';

  const siteAddr =
    custSnap.site_address ||
    invoice.rental?.site_location ||
    invoice.customer?.site_address ||
    custAddr;

  const payTerms =
    custSnap.payment_terms ||
    invoice.rental?.payment_terms ||
    'After Invoice Submission within 15 days';

  const m = invoice.machine;
  const serialNo = custSnap.machine_serial || m?.serial_number || '—';
  const modelNo = custSnap.machine_model || (m ? `${m.brand || ''} ${m.model || ''}`.trim() : '—');
  const monthlyRental =
    custSnap.monthly_rental ??
    invoice.rental?.monthly_rental ??
    m?.monthly_rental_rate ??
    0;

  const bank = bankAccount || (invoice.bank_details_snapshot as any) || {};
  const salaryAdj = Number(invoice.salary_adjustment ?? custSnap.salary_adjustment ?? 0);

  // Build rows matching Columns A..F (Col A blank margin, B..F main invoice grid)
  const rows: any[][] = [];
  rows.push([]); // Row 1 blank
  rows.push(['', 'TAX   INVOICE', '', '', '', '']); // Row 2
  rows.push([
    '',
    compName.startsWith('M/S') ? compName : `M/S ${compName}`,
    '',
    '',
    'Invoice No',
    invoice.invoice_number,
  ]); // Row 3
  rows.push(['', compAddr, '', '', 'Inv Date', formatDate(invoice.invoice_date)]); // Row 4
  rows.push([
    '',
    [compCity, compState].filter(Boolean).join(', ') + (compPin ? ` - ${compPin}` : ''),
    '',
    '',
    'Due Date',
    formatDate(invoice.due_date),
  ]); // Row 5
  rows.push(['', `Email : ${compEmail}`, '', '', '', '']); // Row 6
  rows.push(['', `GST no :   ${compGstin}`, '', '', '', '']); // Row 7
  rows.push(['', compMsme ? `MSME / Udyam Number : ${compMsme}` : '', '', '', '', '']); // Row 8
  rows.push(['', 'Bill to', '', '', 'Consignee Site Address', '']); // Row 9
  rows.push([
    '',
    custName.startsWith('M/S') ? custName : `M/S ${custName}`,
    '',
    '',
    siteAddr,
    '',
  ]); // Row 10
  rows.push(['', custAddr, '', '', `${custCity ? custCity + ', ' : ''}${custState}`, '']); // Row 11
  rows.push(['', `City : ${custCity}`, '', '', '', '']); // Row 12
  rows.push([
    '',
    `State :  ${custState}${custPin ? ' , Pin code : ' + custPin : ''}`,
    '',
    '',
    'Payments Term',
    '',
  ]); // Row 13
  rows.push(['', `GST no :  ${custGstin || 'Unregistered'}`, '', '', payTerms, '']); // Row 14
  rows.push(['', 'Machine Details', '', '', '', '']); // Row 15
  rows.push(['', `Serial no : ${serialNo}`, '', '', '', '']); // Row 16
  rows.push(['', `Model : ${modelNo}`, '', '', '', '']); // Row 17
  rows.push(['', `Monthly Rental : ${monthlyRental || ''}`, '', '', '', '']); // Row 18

  // Line items header
  rows.push(['', 'Description of Service', 'SAC', 'Shift /HRS', 'Rate', 'Amount']); // Row 19

  const items = invoice.items || [];
  if (items.length > 0) {
    items.forEach((it) => {
      rows.push([
        '',
        it.description,
        it.sac_code || '997319',
        Number(it.quantity),
        Number(it.rate),
        Number(it.amount),
      ]);
    });
  } else {
    rows.push([
      '',
      'HIRING Charges',
      '997319',
      1,
      Number(invoice.taxable_amount),
      Number(invoice.taxable_amount),
    ]);
  }

  // Blank spacer row
  rows.push(['', '', '', '', '', '']);

  // Totals
  rows.push(['', '', '', '', 'Total  Value', Number(invoice.taxable_amount)]);
  if (invoice.discount > 0) {
    rows.push(['', '', '', '', 'Discount', Number(invoice.discount)]);
  }
  if (invoice.is_interstate) {
    rows.push(['', '', '', '', `IGST ${invoice.gst_rate}%`, Number(invoice.igst_amount)]);
  } else {
    rows.push(['', '', '', '', `CGST ${invoice.gst_rate / 2}%`, Number(invoice.cgst_amount)]);
    rows.push(['', '', '', '', `SGST ${invoice.gst_rate / 2}%`, Number(invoice.sgst_amount)]);
  }
  if (salaryAdj !== 0) {
    rows.push(['', '', '', '', 'Salary', Math.abs(salaryAdj)]);
  }
  rows.push(['', '', '', '', 'Round off', Number(invoice.round_off || 0)]);
  rows.push(['', '', '', '', 'GRAND TOTAL', Number(invoice.grand_total)]);

  // Words
  rows.push([
    '',
    `Invoice Value in words :  ${numberToWordsINR(Math.round(invoice.grand_total))}`,
    '',
    '',
    '',
    '',
  ]);

  // Bank Details & Signature
  rows.push(['', 'Bank Details :', '', '', '', '']);
  rows.push([
    '',
    `Acc name :  ${bank.account_holder_name || compName}`,
    '',
    '',
    '',
    '',
  ]);
  rows.push(['', `Bank name :  ${bank.bank_name || ''}`, '', '', '', '']);
  rows.push(['', `Acc no : ${bank.account_number || ''}`, '', '', '', '']);
  rows.push([
    '',
    `IFSC code : ${bank.ifsc_code || ''}`,
    '',
    '',
    `For ${compName}`,
    '',
  ]);
  rows.push(['', `Branch name :   ${bank.branch_name || ''}`, '', '', '', '']);
  rows.push(['', '', '', '', '', '']);

  // Notes (Sequential numbered manner: 1., 2., 3.)
  const seqNotes = formatSequentialNotes(invoice.notes || invoice.terms);

  rows.push(['', 'Note :', '', '', '', '']);
  seqNotes.forEach((line) => {
    rows.push(['', ` ${line.trim()}`, '', '', '', '']);
  });
  rows.push(['', '', '', '', 'PROPRIETOR', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 3 },  // Col A margin
    { wch: 46 }, // Col B Description / Party
    { wch: 12 }, // Col C SAC
    { wch: 14 }, // Col D Shift/HRS
    { wch: 18 }, // Col E Rate / Label
    { wch: 18 }, // Col F Amount / Value
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tax Invoice');
  const safeNum = invoice.invoice_number.replace(/[\/\\]/g, '_');
  XLSX.writeFile(wb, `Invoice_${safeNum}.xlsx`);
}
