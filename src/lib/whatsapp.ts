import { Invoice, Company } from '@/types';
import { formatCurrency, formatDate } from './utils';

export function generateInvoiceWhatsAppMessage(
  invoice: Invoice,
  company: Company,
  bankDetails?: { bank_name?: string | null; account_number?: string | null; ifsc_code?: string | null; upi_id?: string | null }
): string {
  const customerName = invoice.customer_snapshot?.name || 'Valued Customer';
  const invNumber = invoice.invoice_number;
  const invDate = formatDate(invoice.invoice_date);
  const dueDate = formatDate(invoice.due_date);
  const totalAmount = formatCurrency(invoice.grand_total);
  const balanceDue = formatCurrency(invoice.balance_due);
  const isOverdue = invoice.status === 'Overdue' || new Date(invoice.due_date) < new Date();

  let message = `*PAYMENT REMINDER – ${company.name.toUpperCase()}*\n\n`;
  message += `Dear ${customerName},\n\n`;

  if (isOverdue) {
    message += `This is an urgent reminder that payment for Invoice *#${invNumber}* dated ${invDate} was due on *${dueDate}*.\n\n`;
  } else {
    message += `This is a friendly reminder regarding your pending Invoice *#${invNumber}* dated ${invDate}, due on *${dueDate}*.\n\n`;
  }

  message += `*Invoice Summary:*\n`;
  message += `• Invoice No: ${invNumber}\n`;
  message += `• Total Amount: ${totalAmount}\n`;
  message += `• Balance Due: *${balanceDue}*\n\n`;

  if (bankDetails?.account_number) {
    message += `*Bank Details for Direct Transfer (NEFT/RTGS/IMPS):*\n`;
    message += `• Bank: ${bankDetails.bank_name || '—'}\n`;
    message += `• A/C No: ${bankDetails.account_number}\n`;
    message += `• IFSC Code: ${bankDetails.ifsc_code || '—'}\n`;
    if (bankDetails.upi_id) {
      message += `• UPI ID: ${bankDetails.upi_id}\n`;
    }
    message += `\n`;
  }

  message += `Kindly clear the outstanding balance and reply with the payment confirmation / UTR reference.\n\n`;
  message += `Thank you for your business!\n`;
  message += `*${company.name}*\n`;
  if (company.mobile) {
    message += `Contact: ${company.mobile}\n`;
  }

  return message;
}

export function openWhatsAppLink(mobile: string, text: string) {
  // Clean phone number (remove +, spaces, dashes)
  const cleanedMobile = mobile.replace(/[^0-9]/g, '');
  // Prepend 91 if 10-digit Indian number without country code
  const phone = cleanedMobile.length === 10 ? `91${cleanedMobile}` : cleanedMobile;
  const encodedText = encodeURIComponent(text);
  const url = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedText}`;
  window.open(url, '_blank');
}
