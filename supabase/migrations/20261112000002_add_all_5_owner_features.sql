-- ============================================================
-- LIFTLEDGER 5 OWNER MODULES MIGRATION
-- Migration: 20261112000002_add_all_5_owner_features.sql
-- ============================================================

-- 1. Statutory Safety & Compliance Expiry Columns on machines
ALTER TABLE public.machines
ADD COLUMN IF NOT EXISTS tpi_certificate_no text,
ADD COLUMN IF NOT EXISTS tpi_expiry_date date,
ADD COLUMN IF NOT EXISTS insurance_policy_no text,
ADD COLUMN IF NOT EXISTS insurance_expiry_date date,
ADD COLUMN IF NOT EXISTS fitness_expiry_date date,
ADD COLUMN IF NOT EXISTS puc_expiry_date date;

-- 2. Daily Site Logsheets Table
CREATE TABLE IF NOT EXISTS public.site_logsheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  log_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'Working' CHECK (status IN ('Working', 'Breakdown', 'Idle / Stand-by', 'Holiday / Sunday')),
  shift_count numeric(4,2) NOT NULL DEFAULT 1.00,
  regular_hours numeric(5,2) NOT NULL DEFAULT 10.00,
  overtime_hours numeric(5,2) NOT NULL DEFAULT 0.00,
  breakdown_hours numeric(5,2) NOT NULL DEFAULT 0.00,
  diesel_liters numeric(8,2) NOT NULL DEFAULT 0.00,
  operator_name text,
  site_supervisor_name text,
  notes text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Commercial Quotations / Proforma Invoices Table
CREATE TABLE IF NOT EXISTS public.quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quotation_number text NOT NULL,
  quotation_date date NOT NULL DEFAULT current_date,
  valid_until date NOT NULL DEFAULT (current_date + interval '15 days'),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  equipment_description text NOT NULL,
  working_height text,
  site_location text NOT NULL,
  monthly_rental_rate numeric(12,2) NOT NULL DEFAULT 210000,
  working_terms text NOT NULL DEFAULT '10+1 hrs per shift for 26 working days per month',
  transport_mobilization numeric(12,2) NOT NULL DEFAULT 0,
  transport_demobilization numeric(12,2) NOT NULL DEFAULT 0,
  operator_charges numeric(12,2) NOT NULL DEFAULT 0,
  security_deposit numeric(12,2) NOT NULL DEFAULT 0,
  gst_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  payment_terms text DEFAULT 'Within 30 days of invoice submission',
  notes text,
  status text NOT NULL DEFAULT 'Sent' CHECK (status IN ('Draft', 'Sent', 'Approved', 'Converted', 'Rejected')),
  converted_rental_id uuid REFERENCES public.rentals(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Staff & Machine Operators Table + Salary Payments
CREATE TABLE IF NOT EXISTS public.operators_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  role_type text NOT NULL DEFAULT 'Boom Lift Operator',
  mobile text NOT NULL,
  license_or_id_no text,
  safety_pass_expiry date,
  assigned_machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  assigned_site text,
  monthly_salary numeric(12,2) NOT NULL DEFAULT 25000,
  daily_bhatta numeric(8,2) NOT NULL DEFAULT 0,
  salary_paid_by text NOT NULL DEFAULT 'Client at Site (Deducted on Invoice)',
  bank_account_no text,
  ifsc_code text,
  upi_id text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.operator_salary_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.operators_staff(id) ON DELETE RESTRICT,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  month_label text NOT NULL,
  payment_type text NOT NULL DEFAULT 'Monthly Salary',
  amount numeric(12,2) NOT NULL,
  paid_by text NOT NULL DEFAULT 'Firm (Company Expense)',
  payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Machine Equipment Loans & EMI Tracker
CREATE TABLE IF NOT EXISTS public.machine_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  lender_name text NOT NULL,
  loan_account_number text NOT NULL,
  loan_amount numeric(14,2) NOT NULL,
  interest_rate_pa numeric(5,2) NOT NULL DEFAULT 9.50,
  tenure_months int NOT NULL DEFAULT 48,
  emi_amount numeric(12,2) NOT NULL,
  emi_due_day int NOT NULL DEFAULT 5,
  start_date date NOT NULL DEFAULT current_date,
  emis_paid_count int NOT NULL DEFAULT 0,
  outstanding_principal numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.loan_emi_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  loan_id uuid NOT NULL REFERENCES public.machine_loans(id) ON DELETE CASCADE,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  payment_date date NOT NULL DEFAULT current_date,
  installment_number int NOT NULL DEFAULT 1,
  total_emi_amount numeric(12,2) NOT NULL,
  principal_component numeric(12,2) NOT NULL,
  interest_component numeric(12,2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  reference_number text,
  created_at timestamptz NOT NULL DEFAULT now()
);
