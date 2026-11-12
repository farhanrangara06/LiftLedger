import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
}

export function formatDate(dateStr: string | null | undefined, fmt: string = 'dd MMM yyyy'): string {
  if (!dateStr) return '—';
  try {
    const d = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) ? format(d, fmt) : '—';
  } catch {
    return '—';
  }
}

// Convert numbers to Indian Rupees in words (e.g., "One Lakh Fifty Thousand Rupees Only")
export function numberToWordsINR(num: number): string {
  if (isNaN(num) || num === 0) return 'Zero Rupees Only';

  const a = [
    '',
    'One ',
    'Two ',
    'Three ',
    'Four ',
    'Five ',
    'Six ',
    'Seven ',
    'Eight ',
    'Nine ',
    'Ten ',
    'Eleven ',
    'Twelve ',
    'Thirteen ',
    'Fourteen ',
    'Fifteen ',
    'Sixteen ',
    'Seventeen ',
    'Eighteen ',
    'Nineteen ',
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    const str = ('000000000' + n).substr(-9);
    const match = str.match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!match) return '';

    let out = '';
    out += Number(match[1]) !== 0 ? (a[Number(match[1])] || b[match[1][0] as any] + ' ' + a[match[1][1] as any]) + 'Crore ' : '';
    out += Number(match[2]) !== 0 ? (a[Number(match[2])] || b[match[2][0] as any] + ' ' + a[match[2][1] as any]) + 'Lakh ' : '';
    out += Number(match[3]) !== 0 ? (a[Number(match[3])] || b[match[3][0] as any] + ' ' + a[match[3][1] as any]) + 'Thousand ' : '';
    out += Number(match[4]) !== 0 ? (a[Number(match[4])] || b[match[4][0] as any] + ' ' + a[match[4][1] as any]) + 'Hundred ' : '';
    out += Number(match[5]) !== 0 ? (out !== '' ? 'and ' : '') + (a[Number(match[5])] || b[match[5][0] as any] + ' ' + a[match[5][1] as any]) : '';

    return out.trim();
  }

  const rounded = Math.round(num * 100) / 100;
  const whole = Math.floor(rounded);
  const paise = Math.round((rounded - whole) * 100);

  let result = inWords(whole) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + inWords(paise) + ' Paise';
  }
  return result + ' Only';
}

// Parse notes string into clean array of individual note items (stripping leading *, -, or 1. prefixes)
export function parseNotesList(rawNotes?: string | null): string[] {
  const defaultNotes = [
    'Working hour of 10+1 hrs for 26 working days per month',
    'Additional working hours will paid on Pro rate basis',
    'Payment due within 15-60 days of invoice submission',
  ];
  if (!rawNotes || !rawNotes.trim()) return defaultNotes;

  const lines = rawNotes
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[\*\-\•]|\d+[\.\)])\s*/, '').trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : defaultNotes;
}

// Format notes into sequential numbered lines: ["1. ...", "2. ...", "3. ..."]
export function formatSequentialNotes(rawNotes?: string | null): string[] {
  return parseNotesList(rawNotes).map((text, idx) => `${idx + 1}. ${text}`);
}

// Indian States and GST State Codes
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu and Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
];
