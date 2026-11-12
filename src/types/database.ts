export type UserRole = 'OWNER' | 'ACCOUNTANT' | 'EMPLOYEE';

export type MachineStatus = 'Available' | 'Rented' | 'Under Maintenance' | 'Inactive';

export type RentalStatus = 'Draft' | 'Active' | 'Completed' | 'Cancelled' | 'On Hold';

export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';

export type PaymentMode = 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'Other';

export type ExpenseCategory =
  | 'Diesel/Fuel'
  | 'Transportation'
  | 'Repairs'
  | 'Maintenance'
  | 'Operator Salary'
  | 'Employee Salary'
  | 'Insurance'
  | 'Permit and Registration'
  | 'Spare Parts'
  | 'Office Expenses'
  | 'Bank Charges'
  | 'Capital Expenditure'
  | 'Loan Interest'
  | 'Loan Principal'
  | 'Other';

export type ExpenseType = 'OpEx' | 'CapEx' | 'Loan Principal' | 'Loan Interest';

export type MaintenanceType = 'Preventative' | 'Breakdown' | 'Inspection' | 'Statutory / Certification';

export type MaintenanceStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type ChallanType = 'DELIVERY' | 'RETURN';

export interface Company {
  id: string;
  name: string;
  logo_url?: string | null;
  signature_url?: string | null;
  business_address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  msme_number?: string | null;
  state?: string | null;
  state_code?: string | null;
  city?: string | null;
  pincode?: string | null;
  mobile?: string | null;
  email?: string | null;
  setup_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: string;
  company_id: string;
  invoice_prefix: string;
  challan_prefix: string;
  default_tax_rate: number;
  default_sac_code: string;
  invoice_terms?: string | null;
  rental_terms?: string | null;
  challan_terms?: string | null;
  currency_symbol: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  company_id: string;
  bank_name: string;
  account_holder_name: string;
  account_number: string;
  ifsc_code: string;
  branch_name?: string | null;
  upi_id?: string | null;
  is_primary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MachineCategory {
  id: string;
  name: string;
  description?: string | null;
  default_height?: string | null;
  sort_order: number;
  is_standard: boolean;
}

export interface CompanyMachineCategory {
  id: string;
  company_id: string;
  category_id?: string | null;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  company_id: string;
  category_id: string;
  machine_name: string;
  machine_id_code: string;
  registration_number?: string | null;
  serial_number: string;
  brand: string;
  model: string;
  height_capacity: string;
  purchase_date?: string | null;
  purchase_price: number;
  monthly_rental_rate: number;
  current_location?: string | null;
  photo_url?: string | null;
  documents: Array<{ name: string; url: string; date: string }>;
  tpi_certificate_no?: string | null;
  tpi_expiry_date?: string | null;
  insurance_policy_no?: string | null;
  insurance_expiry_date?: string | null;
  fitness_expiry_date?: string | null;
  puc_expiry_date?: string | null;
  notes?: string | null;
  status: MachineStatus;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // joined fields
  category?: CompanyMachineCategory;
}

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  contact_person?: string | null;
  mobile: string;
  email?: string | null;
  gstin?: string | null;
  billing_address: string;
  site_address?: string | null;
  state: string;
  state_code: string;
  city: string;
  pincode?: string | null;
  notes?: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerNote {
  id: string;
  company_id: string;
  customer_id: string;
  created_by?: string | null;
  note: string;
  created_at: string;
}

export interface Rental {
  id: string;
  company_id: string;
  rental_code: string;
  customer_id: string;
  machine_id: string;
  site_location: string;
  start_date: string;
  expected_end_date: string;
  actual_end_date?: string | null;
  monthly_rental: number;
  security_deposit: number;
  transportation_charges: number;
  operator_charges: number;
  other_charges: number;
  billing_frequency: 'Monthly' | 'Weekly' | 'Daily' | 'One-time';
  gst_rate: number;
  payment_terms?: string | null;
  notes?: string | null;
  status: RentalStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // joined fields
  customer?: Customer;
  machine?: Machine;
}

export interface RentalHistory {
  id: string;
  company_id: string;
  rental_id: string;
  event_type: string;
  notes?: string | null;
  changed_by?: string | null;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  sac_code: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  rental_id?: string | null;
  customer_id: string;
  machine_id?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  period_start?: string | null;
  period_end?: string | null;
  customer_snapshot: Record<string, any>;
  company_snapshot: Record<string, any>;
  subtotal: number;
  discount: number;
  taxable_amount: number;
  is_interstate: boolean;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  salary_adjustment?: number;
  round_off: number;
  grand_total: number;
  paid_amount: number;
  tds_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  notes?: string | null;
  terms?: string | null;
  bank_details_snapshot?: Record<string, any> | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  items?: InvoiceItem[];
  customer?: Customer;
  machine?: Machine;
  rental?: Rental;
}

export interface Payment {
  id: string;
  company_id: string;
  payment_number: string;
  customer_id: string;
  invoice_id?: string | null;
  payment_date: string;
  amount: number;
  tds_deducted: number;
  payment_mode: PaymentMode;
  transaction_reference?: string | null;
  bank_account_id?: string | null;
  receipt_url?: string | null;
  notes?: string | null;
  is_reversal: boolean;
  reversed_payment_id?: string | null;
  created_by?: string | null;
  created_at: string;
  // joined
  customer?: Customer;
  invoice?: Invoice;
  bank_account?: BankAccount;
}

export interface PaymentAllocation {
  id: string;
  payment_id: string;
  invoice_id: string;
  allocated_amount: number;
  allocated_tds: number;
  created_at: string;
}

export interface Expense {
  id: string;
  company_id: string;
  machine_id?: string | null;
  date: string;
  category: ExpenseCategory;
  expense_type: ExpenseType;
  vendor?: string | null;
  description: string;
  amount: number;
  gst_amount: number;
  payment_mode: string;
  receipt_url?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  // joined
  machine?: Machine;
}

export interface Maintenance {
  id: string;
  company_id: string;
  machine_id: string;
  maintenance_type: MaintenanceType;
  title: string;
  description?: string | null;
  start_date: string;
  completion_date?: string | null;
  status: MaintenanceStatus;
  priority: PriorityLevel;
  cost: number;
  downtime_hours: number;
  meter_reading?: number | null;
  performed_by?: string | null;
  notes?: string | null;
  inspection_checklist: Array<{ task: string; passed: boolean; remarks?: string }>;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  // joined
  machine?: Machine;
}

export interface Challan {
  id: string;
  company_id: string;
  challan_number: string;
  challan_type: ChallanType;
  rental_id: string;
  customer_id: string;
  machine_id: string;
  date: string;
  site_address: string;
  machine_condition: string;
  accessories_list: Array<{ item: string; quantity: number; included: boolean }>;
  photos: Array<{ url: string; caption?: string }>;
  delivered_or_returned_by?: string | null;
  customer_acknowledged_by?: string | null;
  customer_signature_notes?: string | null;
  damage_notes?: string | null;
  additional_charges: number;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  // joined
  customer?: Customer;
  machine?: Machine;
  rental?: Rental;
}

export interface Reminder {
  id: string;
  company_id: string;
  reminder_type: 'INVOICE_DUE' | 'OVERDUE_PAYMENT' | 'RENTAL_END' | 'MAINTENANCE_DUE' | 'CUSTOM';
  title: string;
  message: string;
  due_date: string;
  entity_id?: string | null;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface AuditLog {
  id: string;
  company_id?: string | null;
  user_id?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  details?: Record<string, any> | null;
  created_at: string;
}

export type PartnerDesignation =
  | 'Managing Partner'
  | 'Working Partner'
  | 'Investing / Sleeping Partner';

export type PartnerTransactionType =
  | 'PROFIT_PAYOUT'
  | 'DRAWING'
  | 'REMUNERATION_PAYOUT'
  | 'CAPITAL_INJECTION'
  | 'CAPITAL_WITHDRAWAL';

export interface Partner {
  id: string;
  company_id: string;
  name: string;
  designation: PartnerDesignation | string;
  pan?: string | null;
  mobile?: string | null;
  email?: string | null;
  profit_share_percent: number;
  capital_contributed: number;
  interest_on_capital_rate: number;
  monthly_remuneration: number;
  bank_name?: string | null;
  account_number?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerTransaction {
  id: string;
  company_id: string;
  partner_id: string;
  transaction_date: string;
  transaction_type: PartnerTransactionType;
  amount: number;
  payment_mode: PaymentMode | string;
  reference_number?: string | null;
  notes?: string | null;
  is_reversal: boolean;
  created_by?: string | null;
  created_at: string;
  // joined
  partner?: Partner;
}

export type SiteLogStatus = 'Working' | 'Breakdown' | 'Idle / Stand-by' | 'Holiday / Sunday';

export interface SiteLogsheet {
  id: string;
  company_id: string;
  rental_id?: string | null;
  machine_id: string;
  customer_id?: string | null;
  log_date: string;
  status: SiteLogStatus;
  shift_count: number;
  regular_hours: number;
  overtime_hours: number;
  breakdown_hours: number;
  diesel_liters: number;
  operator_name?: string | null;
  site_supervisor_name?: string | null;
  notes?: string | null;
  created_by?: string | null;
  created_at: string;
  // joined
  rental?: Rental;
  machine?: Machine;
  customer?: Customer;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Approved' | 'Converted' | 'Rejected';

export interface Quotation {
  id: string;
  company_id: string;
  quotation_number: string;
  quotation_date: string;
  valid_until: string;
  customer_id: string;
  machine_id?: string | null;
  equipment_description: string;
  working_height?: string | null;
  site_location: string;
  monthly_rental_rate: number;
  working_terms: string;
  transport_mobilization: number;
  transport_demobilization: number;
  operator_charges: number;
  security_deposit: number;
  gst_rate: number;
  payment_terms?: string | null;
  notes?: string | null;
  status: QuotationStatus;
  converted_rental_id?: string | null;
  created_by?: string | null;
  created_at: string;
  // joined
  customer?: Customer;
  machine?: Machine;
}

export interface OperatorStaff {
  id: string;
  company_id: string;
  full_name: string;
  role_type:
    | 'Boom Lift Operator'
    | 'Service Technician / Mechanic'
    | 'Site Supervisor'
    | 'Accountant'
    | 'Office Staff';
  mobile: string;
  license_or_id_no?: string | null;
  safety_pass_expiry?: string | null;
  assigned_machine_id?: string | null;
  assigned_site?: string | null;
  monthly_salary: number;
  daily_bhatta: number;
  salary_paid_by: 'Client at Site (Deducted on Invoice)' | 'Firm (Company Expense)';
  bank_account_no?: string | null;
  ifsc_code?: string | null;
  upi_id?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  // joined
  assigned_machine?: Machine;
}

export interface OperatorSalaryPayment {
  id: string;
  company_id: string;
  staff_id: string;
  machine_id?: string | null;
  payment_date: string;
  month_label: string;
  payment_type: 'Monthly Salary' | 'Site Advance / Kharcha' | 'Overtime Bonus' | 'Daily Bhatta';
  amount: number;
  paid_by: string;
  payment_mode: string;
  notes?: string | null;
  created_at: string;
  // joined
  staff?: OperatorStaff;
  machine?: Machine;
}

export interface MachineLoan {
  id: string;
  company_id: string;
  machine_id: string;
  lender_name: string;
  loan_account_number: string;
  loan_amount: number;
  interest_rate_pa: number;
  tenure_months: number;
  emi_amount: number;
  emi_due_day: number;
  start_date: string;
  emis_paid_count: number;
  outstanding_principal: number;
  status: 'Active' | 'Closed';
  notes?: string | null;
  created_at: string;
  // joined
  machine?: Machine;
}

export interface LoanEmiPayment {
  id: string;
  company_id: string;
  loan_id: string;
  machine_id: string;
  payment_date: string;
  installment_number: number;
  total_emi_amount: number;
  principal_component: number;
  interest_component: number;
  payment_mode: string;
  reference_number?: string | null;
  created_at: string;
  // joined
  loan?: MachineLoan;
  machine?: Machine;
}
