-- ============================================================
-- LIFTLEDGER PARTNERSHIP FIRM PROFIT, REVENUE & CAPITAL MODULE
-- Migration: 20261112000001_add_partnership_profit_split.sql
-- ============================================================

-- 1. Partners Master Table
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  designation text NOT NULL DEFAULT 'Working Partner',
  pan text,
  mobile text,
  email text,
  profit_share_percent numeric(6,2) NOT NULL DEFAULT 50.00,
  capital_contributed numeric(14,2) NOT NULL DEFAULT 0,
  interest_on_capital_rate numeric(5,2) NOT NULL DEFAULT 0,
  monthly_remuneration numeric(12,2) NOT NULL DEFAULT 0,
  bank_name text,
  account_number text,
  ifsc_code text,
  upi_id text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_company_id ON public.partners(company_id);

-- 2. Partner Transactions (Drawings, Profit Distributions, Capital Injections)
CREATE TABLE IF NOT EXISTS public.partner_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  transaction_date date NOT NULL DEFAULT current_date,
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'PROFIT_PAYOUT',
    'DRAWING',
    'REMUNERATION_PAYOUT',
    'CAPITAL_INJECTION',
    'CAPITAL_WITHDRAWAL'
  )),
  amount numeric(14,2) NOT NULL,
  payment_mode text NOT NULL DEFAULT 'Bank Transfer',
  reference_number text,
  notes text,
  is_reversal boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_transactions_company_id ON public.partner_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_partner_transactions_partner_id ON public.partner_transactions(partner_id);

-- 3. Enable RLS
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for partners
DROP POLICY IF EXISTS "Company members can view partners" ON public.partners;
CREATE POLICY "Company members can view partners"
ON public.partners FOR SELECT
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Owners and Accountants can manage partners" ON public.partners;
CREATE POLICY "Owners and Accountants can manage partners"
ON public.partners FOR ALL
TO authenticated
USING (
  (company_id = public.current_user_company_id() AND public.current_user_role() IN ('OWNER', 'ACCOUNTANT'))
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
)
WITH CHECK (
  (company_id = public.current_user_company_id() AND public.current_user_role() IN ('OWNER', 'ACCOUNTANT'))
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

-- 5. RLS Policies for partner_transactions
DROP POLICY IF EXISTS "Company members can view partner transactions" ON public.partner_transactions;
CREATE POLICY "Company members can view partner transactions"
ON public.partner_transactions FOR SELECT
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

DROP POLICY IF EXISTS "Owners and Accountants can manage partner transactions" ON public.partner_transactions;
CREATE POLICY "Owners and Accountants can manage partner transactions"
ON public.partner_transactions FOR ALL
TO authenticated
USING (
  (company_id = public.current_user_company_id() AND public.current_user_role() IN ('OWNER', 'ACCOUNTANT'))
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
)
WITH CHECK (
  (company_id = public.current_user_company_id() AND public.current_user_role() IN ('OWNER', 'ACCOUNTANT'))
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);
