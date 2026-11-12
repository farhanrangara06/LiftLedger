-- ============================================================
-- LIFTLEDGER DATABASE SCHEMA
-- Migration: 20261109000001_initial_schema.sql
-- ============================================================

-- 1. Enable required extensions
create extension if not exists "uuid-ossp";

-- 2. Master Table: Companies
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  logo_url text,
  business_address text,
  gstin text,
  pan text,
  state text,
  state_code text,
  city text,
  pincode text,
  mobile text,
  email text,
  setup_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Profiles (Linked to auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  role text not null check (role in ('OWNER', 'ACCOUNTANT', 'EMPLOYEE')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Helper functions for RLS
create or replace function public.current_user_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid() limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() limit 1;
$$;

-- 5. Company Settings
create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade unique,
  invoice_prefix text not null default 'INV',
  challan_prefix text not null default 'CHL',
  default_tax_rate numeric(5,2) not null default 18.00,
  default_sac_code text not null default '997312',
  invoice_terms text default '1. Payment due within 15 days of invoice date. 2. Interest @ 18% p.a. on overdue payments.',
  rental_terms text default 'Standard Boom Lift rental terms apply. Operator fuel and safe site access are customer responsibility.',
  challan_terms text default 'Goods/Equipment received in good working condition along with standard accessories.',
  currency_symbol text not null default '₹',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Bank Accounts
create table if not exists public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  bank_name text not null,
  account_holder_name text not null,
  account_number text not null,
  ifsc_code text not null,
  branch_name text,
  upi_id text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Master standard machine categories
create table if not exists public.machine_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  default_height text,
  sort_order int not null default 0,
  is_standard boolean not null default true
);

-- 8. Company Selected Machine Categories (Owner-selected or custom created)
create table if not exists public.company_machine_categories (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid references public.machine_categories(id) on delete set null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, name)
);

-- 9. Individual Machines
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  category_id uuid not null references public.company_machine_categories(id) on delete restrict,
  machine_name text not null,
  machine_id_code text not null,
  registration_number text,
  serial_number text not null,
  brand text not null,
  model text not null,
  height_capacity text not null,
  purchase_date date,
  purchase_price numeric(12,2) not null default 0,
  monthly_rental_rate numeric(12,2) not null default 0,
  current_location text,
  photo_url text,
  documents jsonb not null default '[]'::jsonb,
  notes text,
  status text not null default 'Available' check (status in ('Available', 'Rented', 'Under Maintenance', 'Inactive')),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, machine_id_code)
);

-- 10. Customers
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  contact_person text,
  mobile text not null,
  email text,
  gstin text,
  billing_address text not null,
  site_address text,
  state text not null,
  state_code text not null,
  city text not null,
  pincode text,
  notes text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 11. Customer Notes
create table if not exists public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  created_by uuid references public.profiles(id),
  note text not null,
  created_at timestamptz not null default now()
);

-- 12. Rentals (Contracts)
create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rental_code text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  machine_id uuid not null references public.machines(id) on delete restrict,
  site_location text not null,
  start_date date not null,
  expected_end_date date not null,
  actual_end_date date,
  monthly_rental numeric(12,2) not null,
  security_deposit numeric(12,2) not null default 0,
  transportation_charges numeric(12,2) not null default 0,
  operator_charges numeric(12,2) not null default 0,
  other_charges numeric(12,2) not null default 0,
  billing_frequency text not null default 'Monthly' check (billing_frequency in ('Monthly', 'Weekly', 'Daily', 'One-time')),
  gst_rate numeric(5,2) not null default 18.00,
  payment_terms text,
  notes text,
  status text not null default 'Active' check (status in ('Draft', 'Active', 'Completed', 'Cancelled', 'On Hold')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, rental_code)
);

-- 13. Rental History
create table if not exists public.rental_history (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rental_id uuid not null references public.rentals(id) on delete cascade,
  event_type text not null,
  notes text,
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 14. Invoice Sequences (Safe incremental numbering per FY)
create table if not exists public.invoice_sequences (
  company_id uuid not null references public.companies(id) on delete cascade,
  financial_year text not null,
  last_number int not null default 0,
  primary key (company_id, financial_year)
);

-- Safe function to generate next invoice number
create or replace function public.get_next_invoice_number(p_company_id uuid, p_prefix text default 'INV')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fy text;
  v_year int;
  v_month int;
  v_num int;
  v_result text;
begin
  v_year := extract(year from current_date);
  v_month := extract(month from current_date);
  
  -- Indian Financial Year: April to March
  if v_month >= 4 then
    v_fy := v_year || '-' || substring((v_year + 1)::text from 3 for 2);
  else
    v_fy := (v_year - 1) || '-' || substring(v_year::text from 3 for 2);
  end if;

  insert into public.invoice_sequences (company_id, financial_year, last_number)
  values (p_company_id, v_fy, 1)
  on conflict (company_id, financial_year)
  do update set last_number = public.invoice_sequences.last_number + 1
  returning last_number into v_num;

  v_result := p_prefix || '/' || v_fy || '/' || lpad(v_num::text, 4, '0');
  return v_result;
end;
$$;

-- 15. Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rental_id uuid references public.rentals(id) on delete set null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  machine_id uuid references public.machines(id) on delete set null,
  invoice_number text not null,
  invoice_date date not null default current_date,
  due_date date not null default (current_date + interval '15 days'),
  period_start date,
  period_end date,
  customer_snapshot jsonb not null default '{}'::jsonb,
  company_snapshot jsonb not null default '{}'::jsonb,
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  taxable_amount numeric(12,2) not null default 0,
  is_interstate boolean not null default false,
  gst_rate numeric(5,2) not null default 18.00,
  cgst_amount numeric(12,2) not null default 0,
  sgst_amount numeric(12,2) not null default 0,
  igst_amount numeric(12,2) not null default 0,
  round_off numeric(6,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  paid_amount numeric(12,2) not null default 0,
  tds_amount numeric(12,2) not null default 0,
  balance_due numeric(12,2) not null default 0,
  status text not null default 'Issued' check (status in ('Draft', 'Issued', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled')),
  notes text,
  terms text,
  bank_details_snapshot jsonb default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, invoice_number)
);

-- 16. Invoice Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  sac_code text default '997312',
  quantity numeric(10,2) not null default 1,
  unit text not null default 'Month',
  rate numeric(12,2) not null,
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

-- 17. Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  payment_number text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  payment_date date not null default current_date,
  amount numeric(12,2) not null,
  tds_deducted numeric(12,2) not null default 0,
  payment_mode text not null check (payment_mode in ('Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other')),
  transaction_reference text,
  bank_account_id uuid references public.bank_accounts(id) on delete set null,
  receipt_url text,
  notes text,
  is_reversal boolean not null default false,
  reversed_payment_id uuid references public.payments(id),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, payment_number)
);

-- 18. Payment Allocations
create table if not exists public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  allocated_amount numeric(12,2) not null,
  allocated_tds numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

-- 19. Expenses
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  machine_id uuid references public.machines(id) on delete set null,
  date date not null default current_date,
  category text not null check (category in (
    'Diesel/Fuel', 'Transportation', 'Repairs', 'Maintenance',
    'Operator Salary', 'Employee Salary', 'Insurance',
    'Permit and Registration', 'Spare Parts', 'Office Expenses',
    'Bank Charges', 'Capital Expenditure', 'Loan Interest', 'Loan Principal', 'Other'
  )),
  expense_type text not null default 'OpEx' check (expense_type in ('OpEx', 'CapEx', 'Loan Principal', 'Loan Interest')),
  vendor text,
  description text not null,
  amount numeric(12,2) not null,
  gst_amount numeric(12,2) not null default 0,
  payment_mode text not null default 'Bank Transfer',
  receipt_url text,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 20. Maintenance Records
create table if not exists public.maintenance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  maintenance_type text not null check (maintenance_type in ('Preventative', 'Breakdown', 'Inspection', 'Statutory / Certification')),
  title text not null,
  description text,
  start_date date not null default current_date,
  completion_date date,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'In Progress', 'Completed', 'Cancelled')),
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High', 'Critical')),
  cost numeric(12,2) not null default 0,
  downtime_hours numeric(8,2) not null default 0,
  meter_reading numeric(10,2),
  performed_by text,
  notes text,
  inspection_checklist jsonb not null default '[]'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 21. Delivery and Return Challans
create table if not exists public.challans (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  challan_number text not null,
  challan_type text not null check (challan_type in ('DELIVERY', 'RETURN')),
  rental_id uuid not null references public.rentals(id) on delete restrict,
  customer_id uuid not null references public.customers(id) on delete restrict,
  machine_id uuid not null references public.machines(id) on delete restrict,
  date date not null default current_date,
  site_address text not null,
  machine_condition text not null,
  accessories_list jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  delivered_or_returned_by text,
  customer_acknowledged_by text,
  customer_signature_notes text,
  damage_notes text,
  additional_charges numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (company_id, challan_number)
);

-- 22. Documents
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  entity_type text not null check (entity_type in ('MACHINE', 'CUSTOMER', 'RENTAL', 'CHALLAN', 'COMPANY')),
  entity_id uuid not null,
  file_name text not null,
  file_url text not null,
  file_type text,
  file_size int,
  description text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- 23. Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  reminder_type text not null check (reminder_type in ('INVOICE_DUE', 'OVERDUE_PAYMENT', 'RENTAL_END', 'MAINTENANCE_DUE', 'CUSTOM')),
  title text not null,
  message text not null,
  due_date date not null,
  entity_id uuid,
  is_read boolean not null default false,
  is_dismissed boolean not null default false,
  created_at timestamptz not null default now()
);

-- 24. Audit Logs
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
create index if not exists idx_profiles_company_id on public.profiles(company_id);
create index if not exists idx_company_settings_company_id on public.company_settings(company_id);
create index if not exists idx_bank_accounts_company_id on public.bank_accounts(company_id);
create index if not exists idx_company_machine_categories_company on public.company_machine_categories(company_id);
create index if not exists idx_machines_company on public.machines(company_id);
create index if not exists idx_machines_category on public.machines(category_id);
create index if not exists idx_machines_status on public.machines(status);
create index if not exists idx_customers_company on public.customers(company_id);
create index if not exists idx_rentals_company on public.rentals(company_id);
create index if not exists idx_rentals_customer on public.rentals(customer_id);
create index if not exists idx_rentals_machine on public.rentals(machine_id);
create index if not exists idx_rentals_status on public.rentals(status);
create index if not exists idx_invoices_company on public.invoices(company_id);
create index if not exists idx_invoices_customer on public.invoices(customer_id);
create index if not exists idx_invoices_rental on public.invoices(rental_id);
create index if not exists idx_invoices_status on public.invoices(status);
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);
create index if not exists idx_payments_company on public.payments(company_id);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_expenses_company on public.expenses(company_id);
create index if not exists idx_expenses_machine on public.expenses(machine_id);
create index if not exists idx_maintenance_company on public.maintenance(company_id);
create index if not exists idx_maintenance_machine on public.maintenance(machine_id);
create index if not exists idx_challans_company on public.challans(company_id);
create index if not exists idx_challans_rental on public.challans(rental_id);

-- ============================================================
-- SEED STANDARD MACHINE CATEGORIES
-- ============================================================
insert into public.machine_categories (name, description, default_height, sort_order)
values
  ('120 ft Boom Lift', 'Ultra-high reach telescopic/articulated boom lift for industrial & construction sites', '120 ft (36.5 m)', 1),
  ('135 ft Boom Lift', 'Extended working envelope boom lift for heavy industrial maintenance', '135 ft (41.1 m)', 2),
  ('150 ft Boom Lift', 'High-altitude self-propelled boom lift for mega infrastructure projects', '150 ft (45.7 m)', 3),
  ('160 ft Boom Lift', 'Maximum reach straight telescopic boom lift for power plants & refineries', '160 ft (48.8 m)', 4),
  ('Scissor Lift', 'High-capacity vertical lift for indoor electrical, HVAC, and warehouse installation', '19 ft – 53 ft', 5),
  ('Articulated Boom Lift', 'Up-and-over reach knuckle boom lift for hard-to-access obstacles', '45 ft – 80 ft', 6),
  ('Telescopic Boom Lift', 'Direct straight reach boom lift with maximum horizontal outreach', '60 ft – 86 ft', 7),
  ('Other Equipment', 'Ancillary lifting, cranes, telehandlers or specialized material handling gear', 'Variable', 8)
on conflict (name) do nothing;

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.machine_categories enable row level security;
alter table public.company_machine_categories enable row level security;
alter table public.machines enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.rentals enable row level security;
alter table public.rental_history enable row level security;
alter table public.invoice_sequences enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.expenses enable row level security;
alter table public.maintenance enable row level security;
alter table public.challans enable row level security;
alter table public.documents enable row level security;
alter table public.reminders enable row level security;
alter table public.audit_logs enable row level security;

-- Machine Categories (Public read for authenticated users)
create policy "Allow authenticated users to read standard machine categories"
on public.machine_categories for select
to authenticated
using (true);

-- Profiles policies
create policy "Users can view their own profile or profiles in same company"
on public.profiles for select
to authenticated
using (
  id = auth.uid()
  or company_id = public.current_user_company_id()
);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can insert their own initial profile"
on public.profiles for insert
to authenticated
with check (id = auth.uid());

-- Companies policies
create policy "Users can view their company"
on public.companies for select
to authenticated
using (id = public.current_user_company_id());

create policy "Authenticated users can create a company during onboarding"
on public.companies for insert
to authenticated
with check (true);

create policy "Owners can update company details"
on public.companies for update
to authenticated
using (
  id = public.current_user_company_id()
  and public.current_user_role() = 'OWNER'
)
with check (
  id = public.current_user_company_id()
  and public.current_user_role() = 'OWNER'
);

-- Company Settings policies
create policy "Company members can view settings"
on public.company_settings for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners can insert company settings"
on public.company_settings for insert
to authenticated
with check (
  company_id = public.current_user_company_id()
  or public.current_user_company_id() is null
);

create policy "Owners can update company settings"
on public.company_settings for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Bank Accounts policies
create policy "Company members can view bank accounts"
on public.bank_accounts for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners can manage bank accounts"
on public.bank_accounts for all
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Company Machine Categories policies
create policy "Company members can view company machine categories"
on public.company_machine_categories for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners can insert company machine categories"
on public.company_machine_categories for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Owners can update company machine categories"
on public.company_machine_categories for update
to authenticated
using (
  company_id = public.current_user_company_id()
  and public.current_user_role() = 'OWNER'
)
with check (
  company_id = public.current_user_company_id()
  and public.current_user_role() = 'OWNER'
);

-- Machines policies
create policy "Company members can view machines"
on public.machines for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners and authorized staff can insert machines"
on public.machines for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Owners and authorized staff can update machines"
on public.machines for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Customers policies
create policy "Company members can view customers"
on public.customers for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can insert customers"
on public.customers for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Company members can update customers"
on public.customers for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Customer Notes policies
create policy "Company members can view customer notes"
on public.customer_notes for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can add customer notes"
on public.customer_notes for insert
to authenticated
with check (company_id = public.current_user_company_id());

-- Rentals policies
create policy "Company members can view rentals"
on public.rentals for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can create rentals"
on public.rentals for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Company members can update rentals"
on public.rentals for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Invoices policies
create policy "Company members can view invoices"
on public.invoices for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners and accountants can create invoices"
on public.invoices for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Owners and accountants can update invoices"
on public.invoices for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Invoice Items policies
create policy "Company members can view invoice items"
on public.invoice_items for select
to authenticated
using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
    and invoices.company_id = public.current_user_company_id()
  )
);

create policy "Owners and accountants can manage invoice items"
on public.invoice_items for all
to authenticated
using (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
    and invoices.company_id = public.current_user_company_id()
  )
)
with check (
  exists (
    select 1 from public.invoices
    where invoices.id = invoice_items.invoice_id
    and invoices.company_id = public.current_user_company_id()
  )
);

-- Payments policies
create policy "Company members can view payments"
on public.payments for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Owners and accountants can create payments"
on public.payments for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Owners and accountants can update payments"
on public.payments for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Payment Allocations policies
create policy "Company members can view payment allocations"
on public.payment_allocations for select
to authenticated
using (
  exists (
    select 1 from public.payments
    where payments.id = payment_allocations.payment_id
    and payments.company_id = public.current_user_company_id()
  )
);

create policy "Owners and accountants can manage payment allocations"
on public.payment_allocations for all
to authenticated
using (
  exists (
    select 1 from public.payments
    where payments.id = payment_allocations.payment_id
    and payments.company_id = public.current_user_company_id()
  )
)
with check (
  exists (
    select 1 from public.payments
    where payments.id = payment_allocations.payment_id
    and payments.company_id = public.current_user_company_id()
  )
);

-- Expenses policies
create policy "Company members can view expenses"
on public.expenses for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can record expenses"
on public.expenses for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Owners and accountants can update expenses"
on public.expenses for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Maintenance policies
create policy "Company members can view maintenance"
on public.maintenance for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can record maintenance"
on public.maintenance for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Company members can update maintenance"
on public.maintenance for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Challans policies
create policy "Company members can view challans"
on public.challans for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can create challans"
on public.challans for insert
to authenticated
with check (company_id = public.current_user_company_id());

create policy "Company members can update challans"
on public.challans for update
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Documents policies
create policy "Company members can view documents"
on public.documents for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can upload documents"
on public.documents for insert
to authenticated
with check (company_id = public.current_user_company_id());

-- Reminders policies
create policy "Company members can view reminders"
on public.reminders for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can manage reminders"
on public.reminders for all
to authenticated
using (company_id = public.current_user_company_id())
with check (company_id = public.current_user_company_id());

-- Audit logs policies
create policy "Company members can view audit logs"
on public.audit_logs for select
to authenticated
using (company_id = public.current_user_company_id());

create policy "Company members can insert audit logs"
on public.audit_logs for insert
to authenticated
with check (company_id = public.current_user_company_id() or company_id is null);
