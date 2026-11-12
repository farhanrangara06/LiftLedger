import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, Challan, Quotation, Company, BankAccount } from '@/types';
import { formatDate, numberToWordsINR, formatSequentialNotes } from './utils';

// ─────────────────────────────────────────────────────────────────
// PROFESSIONAL GST TAX INVOICE PDF GENERATOR
// Exact Box-Grid Alignment matching Reference Excel Invoice
// (M/S Dynamic Lifters & Rentals - Sheet 'a')
// ─────────────────────────────────────────────────────────────────
export function generateInvoicePDF(
  invoice: Invoice,
  company: Company,
  bankAccount?: BankAccount | null
) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const W = 210; // A4 width mm
  const L = 10;  // left margin
  const R = 200; // right margin (total width = 190mm)
  const MID = 122; // vertical split between left block (112mm) and right block (78mm)

  // ── Colour palette ──────────────────────────────────────────────
  const BLACK:    [number, number, number] = [15,  23,  42];
  const GREY:     [number, number, number] = [51,  65,  85];
  const DARKBLUE: [number, number, number] = [23,  37,  84];
  const LTBLUE:   [number, number, number] = [226, 238, 255];
  const BORDER:   [number, number, number] = [148, 163, 184];
  const WHITE:    [number, number, number] = [255, 255, 255];

  const fmtNum = (n: number, decimals = 2) =>
    Number(n || 0).toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });

  const inr = (n: number) => 'Rs. ' + fmtNum(n, 2);

  const compSnap = invoice.company_snapshot || {};
  const custSnap = invoice.customer_snapshot || {};

  const compName = (compSnap.name || company.name || 'COMPANY').toUpperCase();
  const compAddress = compSnap.business_address || company.business_address || '';
  const compCity = compSnap.city || company.city || '';
  const compState = compSnap.state || company.state || '';
  const compPin = compSnap.pincode || company.pincode || '';
  const compEmail = compSnap.email || company.email || '';
  const compGstin = compSnap.gstin || company.gstin || '';
  const compMsme = compSnap.msme_number || company.msme_number || '';
  const compMobile = compSnap.mobile || company.mobile || '';

  // ═══════════════════════════════════════════════════════════════
  // 1. TOP BANNER — "TAX   INVOICE"
  // ═══════════════════════════════════════════════════════════════
  let y = 10;
  const bannerH = 9;
  doc.setFillColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.setLineWidth(0.35);
  doc.rect(L, y, R - L, bannerH, 'FD');

  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TAX   INVOICE', W / 2, y + 6.2, { align: 'center' });
  y += bannerH;

  // ═══════════════════════════════════════════════════════════════
  // 2. COMPANY HEADER (Left: L..MID) + INVOICE META (Right: MID..R)
  // ═══════════════════════════════════════════════════════════════
  const sec2Top = y;
  let compY = sec2Top + 5;

  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(compName.startsWith('M/S') ? compName : `M/S ${compName}`, L + 2.5, compY);
  compY += 4.8;

  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);

  if (compAddress) {
    const addrLines = doc.splitTextToSize(compAddress.toUpperCase(), MID - L - 5);
    doc.text(addrLines, L + 2.5, compY);
    compY += addrLines.length * 4;
  }

  const cityStateLine = [compCity, compState].filter(Boolean).join(', ').toUpperCase() + (compPin ? ` - ${compPin}` : '');
  if (cityStateLine.trim()) {
    doc.text(cityStateLine, L + 2.5, compY);
    compY += 4;
  }

  if (compEmail) {
    doc.text(`Email : ${compEmail}`, L + 2.5, compY);
    compY += 4;
  }

  if (compGstin) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GST no :   ${compGstin}`, L + 2.5, compY);
    doc.setFont('helvetica', 'normal');
    compY += 4;
  }

  if (compMsme) {
    doc.setFont('helvetica', 'bold');
    doc.text(`MSME / Udyam Number : ${compMsme}`, L + 2.5, compY);
    doc.setFont('helvetica', 'normal');
    compY += 4;
  }

  if (compMobile) {
    doc.text(`Mobile : ${compMobile}`, L + 2.5, compY);
    compY += 4;
  }

  // Right side: Invoice No, Inv Date, Due Date, Billing Period
  const metaRows: [string, string][] = [
    ['Invoice No', invoice.invoice_number],
    ['Inv Date', formatDate(invoice.invoice_date)],
    ['Due Date', formatDate(invoice.due_date)],
  ];
  if (invoice.period_start && invoice.period_end) {
    metaRows.push(['Billing Period', `${formatDate(invoice.period_start)} to ${formatDate(invoice.period_end)}`]);
  }

  const metaRowH = 7;
  const metaLabelW = 26;
  let metaY = sec2Top;

  metaRows.forEach(([label, val]) => {
    doc.setFillColor(LTBLUE[0], LTBLUE[1], LTBLUE[2]);
    doc.rect(MID, metaY, metaLabelW, metaRowH, 'F');
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.rect(MID, metaY, metaLabelW, metaRowH);
    doc.rect(MID + metaLabelW, metaY, R - MID - metaLabelW, metaRowH);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
    doc.text(label, MID + 2, metaY + 4.7);

    doc.setFont('helvetica', label === 'Invoice No' ? 'bold' : 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(String(val || '—'), MID + metaLabelW + 2, metaY + 4.7);

    metaY += metaRowH;
  });

  const sec2Bottom = Math.max(compY + 1.5, metaY);
  // Draw outer box & vertical separator for Section 2
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.rect(L, sec2Top, MID - L, sec2Bottom - sec2Top);
  doc.rect(MID, sec2Top, R - MID, sec2Bottom - sec2Top);

  // ═══════════════════════════════════════════════════════════════
  // 3. BILL TO + MACHINE DETAILS (Left) | CONSIGNEE SITE + PAYMENT TERM (Right)
  // ═══════════════════════════════════════════════════════════════
  const sec3Top = sec2Bottom;
  const subHdrH = 5.8;

  // Top sub-headers: "Bill to" (left) | "Consignee Site Address" (right)
  doc.setFillColor(LTBLUE[0], LTBLUE[1], LTBLUE[2]);
  doc.rect(L, sec3Top, MID - L, subHdrH, 'FD');
  doc.rect(MID, sec3Top, R - MID, subHdrH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Bill to', L + 2.5, sec3Top + 4.1);
  doc.text('Consignee Site Address', MID + 2.5, sec3Top + 4.1);

  // Left: Customer Bill To details
  let billY = sec3Top + subHdrH + 4.5;
  const rawCustName = (custSnap.name || invoice.customer?.name || 'Customer').toUpperCase();
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(rawCustName.startsWith('M/S') ? rawCustName : `M/S ${rawCustName}`, L + 2.5, billY);
  billY += 4.2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);

  const custBillAddr = custSnap.billing_address || invoice.customer?.billing_address || '';
  if (custBillAddr) {
    const cLines = doc.splitTextToSize(String(custBillAddr).toUpperCase(), MID - L - 5);
    doc.text(cLines, L + 2.5, billY);
    billY += cLines.length * 3.9;
  }

  const custCity = custSnap.city || invoice.customer?.city || '';
  const custState = custSnap.state || invoice.customer?.state || '';
  const custPin = custSnap.pincode || invoice.customer?.pincode || '';
  if (custCity) {
    doc.text(`City : ${custCity.toUpperCase()}`, L + 2.5, billY);
    billY += 3.9;
  }
  if (custState || custPin) {
    doc.text(
      `State : ${(custState || '').toUpperCase()}${custPin ? ' , Pin code : ' + custPin : ''}`,
      L + 2.5,
      billY
    );
    billY += 3.9;
  }

  const custGstin = custSnap.gstin || invoice.customer?.gstin || '';
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(`GST no :  ${custGstin || 'Unregistered'}`, L + 2.5, billY);
  billY += 2.5;

  // Machine Details sub-box inside Left Column (matching rows 18-21 of Excel)
  const machHdrY = billY;
  doc.setFillColor(LTBLUE[0], LTBLUE[1], LTBLUE[2]);
  doc.rect(L, machHdrY, MID - L, subHdrH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Machine Details', L + 2.5, machHdrY + 4.1);

  let machY = machHdrY + subHdrH + 4.2;
  const m = invoice.machine;
  const serialNo = custSnap.machine_serial || m?.serial_number || '—';
  const modelNo = custSnap.machine_model || (m ? `${m.brand || ''} ${m.model || ''}`.trim() : '—');
  const monthlyRate =
    custSnap.monthly_rental ??
    invoice.rental?.monthly_rental ??
    m?.monthly_rental_rate ??
    0;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(`Serial no : ${serialNo}`, L + 2.5, machY);
  machY += 4;
  doc.text(`Model : ${modelNo}`, L + 2.5, machY);
  machY += 4;
  doc.text(`Monthly Rental : ${monthlyRate ? fmtNum(Number(monthlyRate), 0) : '—'}`, L + 2.5, machY);
  machY += 2.5;

  // Right: Consignee Site Address + Payments Term
  let siteY = sec3Top + subHdrH + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  const siteAddr =
    custSnap.site_address ||
    invoice.rental?.site_location ||
    invoice.customer?.site_address ||
    custBillAddr ||
    '(Same as Billing Address)';

  const siteLines = doc.splitTextToSize(String(siteAddr).toUpperCase(), R - MID - 5);
  doc.text(siteLines, MID + 2.5, siteY);
  siteY += Math.max(siteLines.length * 4.2, 14);

  // Payments Term sub-header on Right
  const payTermHdrY = Math.max(siteY + 1, machHdrY);
  doc.setFillColor(LTBLUE[0], LTBLUE[1], LTBLUE[2]);
  doc.rect(MID, payTermHdrY, R - MID, subHdrH, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Payments Term', MID + 2.5, payTermHdrY + 4.1);

  let payTermY = payTermHdrY + subHdrH + 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  const payTermsText =
    custSnap.payment_terms ||
    invoice.rental?.payment_terms ||
    'After Invoice Submission within 15 days';
  const ptLines = doc.splitTextToSize(String(payTermsText), R - MID - 5);
  doc.text(ptLines, MID + 2.5, payTermY);
  payTermY += ptLines.length * 4.2 + 2;

  const sec3Bottom = Math.max(machY, payTermY);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.rect(L, sec3Top, MID - L, sec3Bottom - sec3Top);
  doc.rect(MID, sec3Top, R - MID, sec3Bottom - sec3Top);

  // ═══════════════════════════════════════════════════════════════
  // 4. LINE ITEMS TABLE (Exact Excel Columns)
  //    Sr. | Description of Service | SAC | Shift /HRS | Rate | Amount
  // ═══════════════════════════════════════════════════════════════
  const rawItems = invoice.items || [];
  const tableRows: string[][] = rawItems.map((item, idx) => {
    const qtyNum = Number(item.quantity || 0);
    const qtyStr = Number.isInteger(qtyNum) ? String(qtyNum) : qtyNum.toFixed(2);
    const unitStr = item.unit && item.unit !== 'Month' && item.unit !== 'Shift' ? ` ${item.unit}` : '';
    return [
      String(idx + 1),
      item.description || '',
      item.sac_code || '',
      `${qtyStr}${unitStr}`,
      fmtNum(Number(item.rate || 0), 2),
      fmtNum(Number(item.amount || 0), 2),
    ];
  });

  if (tableRows.length === 0) {
    tableRows.push([
      '1',
      'HIRING Charges',
      '997319',
      '1',
      fmtNum(invoice.taxable_amount, 2),
      fmtNum(invoice.taxable_amount, 2),
    ]);
  }

  // Pad with blank rows up to at least 3 rows so the invoice table looks balanced like the Excel sheet
  while (tableRows.length < 3) {
    tableRows.push(['', '', '', '', '', '']);
  }

  // Column widths sum to 190mm (R - L = 190):
  // Col 0 (Sr.): 10mm
  // Col 1 (Description): 82mm
  // Col 2 (SAC): 20mm
  // Col 3 (Shift /HRS): 22mm -> Left 4 cols = 134mm (ends at x = 144)
  // Col 4 (Rate): 26mm (x = 144..170)
  // Col 5 (Amount): 30mm (x = 170..200) -> Right 2 cols = 56mm
  autoTable(doc, {
    startY: sec3Bottom,
    margin: { left: L, right: W - R },
    head: [['Sr.', 'Description of Service', 'SAC', 'Shift /HRS', 'Rate', 'Amount']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: DARKBLUE,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      lineColor: BORDER,
      lineWidth: 0.3,
    },
    styles: {
      fontSize: 8.2,
      cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 },
      textColor: BLACK,
      lineColor: BORDER,
      lineWidth: 0.3,
      minCellHeight: 7,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 82, halign: 'left', fontStyle: 'bold' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  const afterTableY = (doc as any).lastAutoTable.finalY;

  // ═══════════════════════════════════════════════════════════════
  // 5. TOTALS BLOCK (Aligned with Rate [x=144..170] & Amount [x=170..200])
  // ═══════════════════════════════════════════════════════════════
  const totLabelX = 134; // x = 134..170 (width 36mm)
  const totValX = 170;   // x = 170..200 (width 30mm)
  const totRowH = 6.2;
  let totY = afterTableY;

  const salaryAdj = Number(
    invoice.salary_adjustment ?? custSnap.salary_adjustment ?? 0
  );

  const summaryRows: Array<{
    label: string;
    value: string;
    bold?: boolean;
    fill?: [number, number, number];
    text?: [number, number, number];
  }> = [];

  summaryRows.push({
    label: 'Total  Value',
    value: fmtNum(invoice.taxable_amount, 2),
    bold: true,
  });

  if (invoice.discount > 0) {
    summaryRows.push({
      label: 'Less: Discount',
      value: '- ' + fmtNum(invoice.discount, 2),
    });
  }

  if (invoice.is_interstate) {
    summaryRows.push({
      label: `IGST ${Number(invoice.gst_rate)}%`,
      value: fmtNum(invoice.igst_amount, 2),
    });
  } else {
    const half = (Number(invoice.gst_rate) / 2).toFixed(1).replace(/\.0$/, '');
    summaryRows.push({
      label: `CGST ${half}%`,
      value: fmtNum(invoice.cgst_amount, 2),
    });
    summaryRows.push({
      label: `SGST ${half}%`,
      value: fmtNum(invoice.sgst_amount, 2),
    });
  }

  // Operator Salary row (matches Row 29 of reference Excel: "Salary | 25000.00")
  if (salaryAdj !== 0) {
    summaryRows.push({
      label: 'Salary',
      value: fmtNum(Math.abs(salaryAdj), 2),
    });
  }

  summaryRows.push({
    label: 'Round off',
    value: fmtNum(Math.abs(invoice.round_off || 0), 2),
  });

  summaryRows.push({
    label: 'GRAND TOTAL',
    value: fmtNum(invoice.grand_total, 2),
    bold: true,
    fill: DARKBLUE,
    text: WHITE,
  });

  if (invoice.paid_amount > 0) {
    summaryRows.push({
      label: 'Amount Received',
      value: fmtNum(invoice.paid_amount, 2),
    });
    if (invoice.tds_amount > 0) {
      summaryRows.push({
        label: 'TDS Deducted',
        value: fmtNum(invoice.tds_amount, 2),
      });
    }
    summaryRows.push({
      label: 'BALANCE DUE',
      value: inr(invoice.balance_due),
      bold: true,
      fill: [220, 38, 38],
      text: WHITE,
    });
  }

  summaryRows.forEach((row) => {
    if (row.fill) {
      doc.setFillColor(row.fill[0], row.fill[1], row.fill[2]);
      doc.rect(totLabelX, totY, R - totLabelX, totRowH, 'F');
    } else {
      doc.setFillColor(248, 250, 252);
      doc.rect(totLabelX, totY, totValX - totLabelX, totRowH, 'F');
    }
    doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
    doc.rect(totLabelX, totY, totValX - totLabelX, totRowH);
    doc.rect(totValX, totY, R - totValX, totRowH);

    const tc = row.text || BLACK;
    doc.setTextColor(tc[0], tc[1], tc[2]);
    doc.setFont('helvetica', row.bold ? 'bold' : 'normal');
    doc.setFontSize(row.bold ? 8.8 : 8.2);
    doc.text(row.label, totLabelX + 2.5, totY + 4.3);
    doc.text(row.value, R - 2.5, totY + 4.3, { align: 'right' });

    totY += totRowH;
  });

  // Left box adjacent to totals (L..totLabelX, afterTableY..totY)
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.rect(L, afterTableY, totLabelX - L, totY - afterTableY);

  // Inside that left box, show GST Tax Summary / Place of Supply note cleanly
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text(
    `Tax Type : ${invoice.is_interstate ? `Inter-State (IGST @ ${invoice.gst_rate}%)` : `Intra-State (CGST + SGST @ ${invoice.gst_rate / 2}% each)`}`,
    L + 2.5,
    afterTableY + 5.5
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text(
    `Place of Supply : ${(custState || compState || 'India').toUpperCase()}`,
    L + 2.5,
    afterTableY + 10.5
  );
  if (salaryAdj < 0) {
    doc.text(
      `Operator Salary Deduction : Rs. ${fmtNum(Math.abs(salaryAdj), 2)} (Adjusted in Grand Total)`,
      L + 2.5,
      afterTableY + 15.5
    );
  } else if (salaryAdj > 0) {
    doc.text(
      `Operator Salary Addition : Rs. ${fmtNum(salaryAdj, 2)} (Included in Grand Total)`,
      L + 2.5,
      afterTableY + 15.5
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // 6. INVOICE VALUE IN WORDS BAR (Full width L..R, Row 32 of Excel)
  // ═══════════════════════════════════════════════════════════════
  const wordsBarY = totY;
  const wordsText = `Invoice Value in words :   ${numberToWordsINR(Math.round(invoice.grand_total))}`;
  const wordsLines = doc.splitTextToSize(wordsText, R - L - 6);
  const wordsBarH = Math.max(7.5, wordsLines.length * 4.5 + 3);

  doc.setFillColor(LTBLUE[0], LTBLUE[1], LTBLUE[2]);
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.rect(L, wordsBarY, R - L, wordsBarH, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(wordsLines, L + 2.5, wordsBarY + 5);

  // ═══════════════════════════════════════════════════════════════
  // 7. BANK DETAILS + NOTE (Left: L..134) | SIGNATURE BOX (Right: 134..R)
  // ═══════════════════════════════════════════════════════════════
  const footTopY = wordsBarY + wordsBarH;
  let leftY = footTopY + 5;

  const bank = bankAccount || (invoice.bank_details_snapshot as any);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Bank Details :', L + 2.5, leftY);
  leftY += 4.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  if (bank && (bank.bank_name || bank.account_number)) {
    doc.text(`Acc name :  ${(bank.account_holder_name || compName).toUpperCase()}`, L + 2.5, leftY);
    leftY += 4.2;
    doc.text(`Bank name :  ${(bank.bank_name || '—').toUpperCase()}`, L + 2.5, leftY);
    leftY += 4.2;
    doc.text(`Acc no : ${bank.account_number || '—'}`, L + 2.5, leftY);
    leftY += 4.2;
    doc.text(`IFSC code : ${bank.ifsc_code || '—'}`, L + 2.5, leftY);
    leftY += 4.2;
    if (bank.branch_name) {
      doc.text(`Branch name :   ${bank.branch_name.toUpperCase()}`, L + 2.5, leftY);
      leftY += 4.2;
    }
    if (bank.upi_id) {
      doc.text(`UPI ID :   ${bank.upi_id}`, L + 2.5, leftY);
      leftY += 4.2;
    }
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text(`Acc name :  ${compName}`, L + 2.5, leftY);
    leftY += 4.2;
  }

  leftY += 2;
  // Note section (Sequential numbered manner: 1., 2., 3.)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Note :', L + 2.5, leftY);
  leftY += 4.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  const seqNotes = formatSequentialNotes(invoice.notes || invoice.terms);
  seqNotes.forEach((numberedItem) => {
    const wrapped = doc.splitTextToSize(numberedItem, totLabelX - L - 6);
    doc.text(wrapped, L + 2.5, leftY);
    leftY += wrapped.length * 4;
  });
  leftY += 3;

  const footBottomY = Math.max(leftY, footTopY + 42);

  // Draw borders for Bottom Left (Bank + Note) and Bottom Right (Authorised Signatory)
  doc.setDrawColor(BORDER[0], BORDER[1], BORDER[2]);
  doc.rect(L, footTopY, totLabelX - L, footBottomY - footTopY);
  doc.rect(totLabelX, footTopY, R - totLabelX, footBottomY - footTopY);

  // Signature Box content (Right: totLabelX..R)
  const sigCenterX = totLabelX + (R - totLabelX) / 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  const forCompanyLines = doc.splitTextToSize(`For ${compName}`, R - totLabelX - 4);
  doc.text(forCompanyLines, sigCenterX, footTopY + 6, { align: 'center' });

  const sigImageUrl = compSnap.signature_url || company.signature_url;
  let sigRendered = false;
  if (sigImageUrl && typeof sigImageUrl === 'string' && sigImageUrl.startsWith('data:image/')) {
    try {
      const imgW = 42;
      const imgH = 16;
      const imgX = sigCenterX - imgW / 2;
      const imgY = footTopY + (footBottomY - footTopY) / 2 - imgH / 2 + 1;
      doc.addImage(sigImageUrl, 'PNG', imgX, imgY, imgW, imgH);
      sigRendered = true;
    } catch {
      sigRendered = false;
    }
  }

  if (!sigRendered) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text('(Authorised Seal & Sign)', sigCenterX, footTopY + (footBottomY - footTopY) / 2 + 2, {
      align: 'center',
    });
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('PROPRIETOR', sigCenterX, footBottomY - 4, { align: 'center' });

  return doc;
}

// ─────────────────────────────────────────────────────────────────
// DELIVERY / RETURN CHALLAN PDF GENERATOR
// ─────────────────────────────────────────────────────────────────
export function generateChallanPDF(challan: Challan, company: Company) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const L = 10;
  const R = W - 10;
  const DARKBLUE: [number, number, number] = [23, 37, 84];
  const BLACK:    [number, number, number] = [15, 23, 42];
  const GREY:     [number, number, number] = [71, 85, 105];
  const WHITE:    [number, number, number] = [255, 255, 255];

  const isDelivery = challan.challan_type === 'DELIVERY';
  const title = isDelivery ? 'DELIVERY & DISPATCH CHALLAN' : 'EQUIPMENT RETURN CHALLAN';
  const bannerColor: [number, number, number] = isDelivery ? [30, 64, 175] : [120, 53, 15];

  // Header banner
  doc.setFillColor(bannerColor[0], bannerColor[1], bannerColor[2]);
  doc.rect(0, 0, W, 12, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, W / 2, 8, { align: 'center' });

  // Company name & meta
  let y = 18;
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`M/S ${company.name.toUpperCase()}`, L, y);
  y += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  if (company.business_address) { doc.text(company.business_address, L, y); y += 4; }
  const cl = [company.city, company.state, company.pincode].filter(Boolean).join(', ');
  if (cl) { doc.text(cl, L, y); y += 4; }
  if (company.gstin) { doc.text(`GSTIN: ${company.gstin}`, L, y); y += 4; }

  // Right meta
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Challan No: ${challan.challan_number}`, R, 18, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(challan.date)}`, R, 23, { align: 'right' });

  // Divider
  doc.setDrawColor(bannerColor[0], bannerColor[1], bannerColor[2]);
  doc.setLineWidth(0.5);
  doc.line(L, y + 2, R, y + 2);

  // Customer & Machine
  const col2 = W / 2;
  let partyY = y + 7;

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.rect(L, partyY, col2 - L - 2, 5.5, 'F');
  doc.rect(col2 + 1, partyY, R - col2 - 1, 5.5, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.text('CUSTOMER / SITE DETAILS', L + 2, partyY + 3.8);
  doc.text('MACHINE DETAILS', col2 + 3, partyY + 3.8);
  partyY += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(challan.customer?.name || 'Customer', L, partyY);
  partyY += 4.5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  if (challan.customer?.mobile) { doc.text(`Mobile: ${challan.customer.mobile}`, L, partyY); partyY += 4; }
  if (challan.site_address) {
    const sl = doc.splitTextToSize(challan.site_address, 85);
    doc.text(sl, L, partyY);
    partyY += sl.length * 4;
  }

  // Machine side
  const m = challan.machine;
  let mY = y + 15;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  if (m) {
    doc.text(m.machine_name || '—', col2 + 2, mY); mY += 4.5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GREY[0], GREY[1], GREY[2]);
    doc.text(`Model: ${m.brand || ''} ${m.model || ''}`, col2 + 2, mY); mY += 4;
    doc.text(`Machine ID: ${m.machine_id_code || '—'}`, col2 + 2, mY); mY += 4;
    doc.text(`Serial No: ${m.serial_number || '—'}`, col2 + 2, mY); mY += 4;
    doc.text(`Working Height: ${m.height_capacity || '—'}`, col2 + 2, mY); mY += 4;
  }

  // Condition
  const condY = Math.max(partyY, mY) + 4;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Equipment Working Condition:', L, condY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(challan.machine_condition || 'Inspected and found in good operational condition.', L, condY + 5);

  // Accessories
  const accRows = (challan.accessories_list || []).map(a => [
    a.item,
    String(a.quantity),
    a.included ? 'Included' : 'Missing',
  ]);
  if (accRows.length > 0) {
    autoTable(doc, {
      startY: condY + 10,
      head: [['Accessory / Attachment', 'Qty', 'Status']],
      body: accRows,
      theme: 'grid',
      headStyles: { fillColor: DARKBLUE, textColor: WHITE, fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: { 2: { halign: 'center' } },
    });
  }

  const finalY = (doc as any).lastAutoTable?.finalY
    ? (doc as any).lastAutoTable.finalY + 8
    : condY + 20;

  // Damage notes (return only)
  if (!isDelivery && challan.damage_notes) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text('Damage / Incident Notes:', L, finalY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
    doc.text(challan.damage_notes, L, finalY + 5);
  }

  // Signatures
  const sigY = 250;
  doc.setDrawColor(180, 200, 220);
  doc.setLineWidth(0.3);
  doc.line(L, sigY - 2, 90, sigY - 2);
  doc.line(col2 + 10, sigY - 2, R, sigY - 2);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(isDelivery ? 'Dispatched By' : 'Received By', L, sigY + 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text(challan.delivered_or_returned_by || company.name, L, sigY + 6);
  doc.text('Signature: _____________________', L, sigY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('Customer Acknowledged By', col2 + 10, sigY + 2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  doc.text(challan.customer_acknowledged_by || 'Site Engineer / Supervisor', col2 + 10, sigY + 6);
  doc.text('Signature & Stamp: _____________', col2 + 10, sigY + 14);

  // Footer bar
  doc.setFillColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.rect(0, 287, W, 10, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFontSize(7);
  doc.text(`${company.name} | GSTIN: ${company.gstin || '—'} | ${company.mobile || ''}`, W / 2, 293, { align: 'center' });

  return doc;
}

// ─────────────────────────────────────────────────────────────────
// COMMERCIAL QUOTATION / PROFORMA OFFER LETTER PDF GENERATOR
// ─────────────────────────────────────────────────────────────────
export function generateQuotationPDF(quotation: Quotation, company: Company) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const L = 12;
  const R = W - 12;
  const DARKBLUE: [number, number, number] = [23, 37, 84];
  const BLACK:    [number, number, number] = [15, 23, 42];
  const GREY:     [number, number, number] = [71, 85, 105];
  const WHITE:    [number, number, number] = [255, 255, 255];

  const fmt = (n: number) =>
    'Rs. ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Banner
  doc.setFillColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.rect(0, 0, W, 13, 'F');
  doc.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('COMMERCIAL RENTAL QUOTATION / OFFER LETTER', W / 2, 8.5, { align: 'center' });

  // Company Header
  let y = 20;
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`M/S ${company.name.toUpperCase()}`, L, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  if (company.business_address) { doc.text(company.business_address, L, y); y += 4.2; }
  const cl = [company.city, company.state, company.pincode].filter(Boolean).join(', ');
  if (cl) { doc.text(cl, L, y); y += 4.2; }
  if (company.gstin) { doc.text(`GSTIN: ${company.gstin}`, L, y); y += 4.2; }
  if (company.msme_number) { doc.text(`MSME / Udyam: ${company.msme_number}`, L, y); y += 4.2; }

  // Right Meta
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(`Quotation No: ${quotation.quotation_number}`, R, 20, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(quotation.quotation_date)}`, R, 25, { align: 'right' });
  doc.text(`Valid Until: ${formatDate(quotation.valid_until)}`, R, 30, { align: 'right' });

  y = Math.max(y, 35) + 3;
  doc.setDrawColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);
  y += 6;

  // Client Block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('To,', L, y);
  y += 4.5;
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text(`M/S ${(quotation.customer?.name || 'Valued Client').toUpperCase()}`, L, y);
  y += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(GREY[0], GREY[1], GREY[2]);
  if (quotation.customer?.billing_address) {
    doc.text(quotation.customer.billing_address, L, y);
    y += 4.2;
  }
  doc.text(`Project / Site Location: ${quotation.site_location}`, L, y);
  y += 8;

  // Subject
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text(
    `SUB: COMMERCIAL OFFER FOR HIRING OF ${quotation.equipment_description.toUpperCase()}`,
    L,
    y
  );
  y += 6;

  // Commercial Offer Table
  const bodyRows: string[][] = [
    [
      '1',
      `${quotation.equipment_description}${quotation.working_height ? ' (' + quotation.working_height + ')' : ''}\nWorking Hours: ${quotation.working_terms}`,
      '1 Month (26 Shifts)',
      fmt(quotation.monthly_rental_rate),
    ],
  ];

  if (quotation.transport_mobilization > 0) {
    bodyRows.push([
      String(bodyRows.length + 1),
      'Transportation — Mobilization Charges (To Site)',
      'At Actual / One-way',
      fmt(quotation.transport_mobilization),
    ]);
  }
  if (quotation.transport_demobilization > 0) {
    bodyRows.push([
      String(bodyRows.length + 1),
      'Transportation — Demobilization Charges (Return)',
      'At Actual / One-way',
      fmt(quotation.transport_demobilization),
    ]);
  }
  if (quotation.operator_charges > 0) {
    bodyRows.push([
      String(bodyRows.length + 1),
      'Trained Boom Lift Operator Charges / Salary',
      'Per Month',
      fmt(quotation.operator_charges),
    ]);
  }
  if (quotation.security_deposit > 0) {
    bodyRows.push([
      String(bodyRows.length + 1),
      'Refundable Security Deposit / Advance',
      'Lump-sum',
      fmt(quotation.security_deposit),
    ]);
  }

  autoTable(doc, {
    startY: y,
    margin: { left: L, right: W - R },
    head: [['Sr.', 'Equipment & Commercial Particulars', 'Unit / Basis', 'Quoted Rate (Excl. GST)']],
    body: bodyRows,
    theme: 'grid',
    headStyles: { fillColor: DARKBLUE, textColor: WHITE, fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3, textColor: BLACK },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 96 },
      2: { cellWidth: 38, halign: 'center' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
  });

  let afterY = (doc as any).lastAutoTable.finalY + 8;

  // Commercial Terms & Conditions (Sequential 1., 2., 3.)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text('Terms & Conditions :', L, afterY);
  afterY += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);

  const termsList = [
    `GST @ ${quotation.gst_rate}% extra as applicable on hiring & transportation charges.`,
    `Working Hours: ${quotation.working_terms}. Overtime will be charged on pro-rata basis.`,
    `Payment Terms: ${quotation.payment_terms || 'Within 30 days of invoice submission'}.`,
    ...formatSequentialNotes(quotation.notes).map((n) => n.replace(/^\d+\.\s*/, '')),
  ];

  termsList.forEach((t, idx) => {
    const wrapped = doc.splitTextToSize(`${idx + 1}. ${t}`, R - L);
    doc.text(wrapped, L, afterY);
    afterY += wrapped.length * 4.2 + 1;
  });

  // Signatory Box
  const sigY = Math.max(afterY + 10, 235);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(DARKBLUE[0], DARKBLUE[1], DARKBLUE[2]);
  doc.text(`For ${company.name.toUpperCase()}`, R - 30, sigY, { align: 'center' });

  if (company.signature_url && company.signature_url.startsWith('data:image/')) {
    try {
      doc.addImage(company.signature_url, 'PNG', R - 50, sigY + 3, 40, 15);
    } catch {
      // ignore image error
    }
  }

  doc.setTextColor(BLACK[0], BLACK[1], BLACK[2]);
  doc.text('PROPRIETOR / AUTHORISED SIGNATORY', R - 30, sigY + 23, { align: 'center' });

  return doc;
}
