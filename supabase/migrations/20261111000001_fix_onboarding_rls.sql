-- ============================================================
-- LIFTLEDGER DATABASE SCHEMA FIX: ONBOARDING RLS & SETUP RPC
-- Migration: 20261111000001_fix_onboarding_rls.sql
-- ============================================================

-- 1. Add created_by column to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) DEFAULT auth.uid();

-- Create index on created_by for performance
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies(created_by);

-- 2. Drop existing restrictive company policies and recreate them with created_by check
DROP POLICY IF EXISTS "Users can view their company" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can create a company during onboarding" ON public.companies;
DROP POLICY IF EXISTS "Owners can update company details" ON public.companies;

CREATE POLICY "Users can view their company"
ON public.companies FOR SELECT
TO authenticated
USING (
  id = public.current_user_company_id()
  OR created_by = (SELECT auth.uid())
);

CREATE POLICY "Authenticated users can create a company during onboarding"
ON public.companies FOR INSERT
TO authenticated
WITH CHECK (
  created_by = (SELECT auth.uid())
  OR (SELECT auth.uid()) IS NOT NULL
);

CREATE POLICY "Owners can update company details"
ON public.companies FOR UPDATE
TO authenticated
USING (
  (id = public.current_user_company_id() AND public.current_user_role() = 'OWNER')
  OR created_by = (SELECT auth.uid())
)
WITH CHECK (
  (id = public.current_user_company_id() AND public.current_user_role() = 'OWNER')
  OR created_by = (SELECT auth.uid())
);

-- 3. Update company_settings policies to allow onboarding creator
DROP POLICY IF EXISTS "Owners can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company members can view settings" ON public.company_settings;
DROP POLICY IF EXISTS "Owners can update company settings" ON public.company_settings;

CREATE POLICY "Company members can view settings"
ON public.company_settings FOR SELECT
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

CREATE POLICY "Owners can insert company settings"
ON public.company_settings FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

CREATE POLICY "Owners can update company settings"
ON public.company_settings FOR UPDATE
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
)
WITH CHECK (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

-- 4. Update bank_accounts policies to allow onboarding creator
DROP POLICY IF EXISTS "Company members can view bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Owners can manage bank accounts" ON public.bank_accounts;

CREATE POLICY "Company members can view bank accounts"
ON public.bank_accounts FOR SELECT
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

CREATE POLICY "Owners can manage bank accounts"
ON public.bank_accounts FOR ALL
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
)
WITH CHECK (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

-- 5. Update company_machine_categories policies to allow onboarding creator
DROP POLICY IF EXISTS "Company members can view company machine categories" ON public.company_machine_categories;
DROP POLICY IF EXISTS "Owners can insert company machine categories" ON public.company_machine_categories;
DROP POLICY IF EXISTS "Owners can update company machine categories" ON public.company_machine_categories;

CREATE POLICY "Company members can view company machine categories"
ON public.company_machine_categories FOR SELECT
TO authenticated
USING (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

CREATE POLICY "Owners can insert company machine categories"
ON public.company_machine_categories FOR INSERT
TO authenticated
WITH CHECK (
  company_id = public.current_user_company_id()
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

CREATE POLICY "Owners can update company machine categories"
ON public.company_machine_categories FOR UPDATE
TO authenticated
USING (
  (company_id = public.current_user_company_id() AND public.current_user_role() = 'OWNER')
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
)
WITH CHECK (
  (company_id = public.current_user_company_id() AND public.current_user_role() = 'OWNER')
  OR EXISTS (SELECT 1 FROM public.companies WHERE id = company_id AND created_by = (SELECT auth.uid()))
);

-- 6. Atomic RPC function for complete company onboarding setup
CREATE OR REPLACE FUNCTION public.complete_company_setup(
  p_name text,
  p_business_address text,
  p_gstin text,
  p_pan text,
  p_state text,
  p_state_code text,
  p_city text,
  p_pincode text,
  p_mobile text,
  p_email text,
  p_logo_url text,
  p_bank_name text,
  p_account_holder_name text,
  p_account_number text,
  p_ifsc_code text,
  p_branch_name text,
  p_upi_id text,
  p_categories jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_cat record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert Company
  INSERT INTO public.companies (
    name,
    business_address,
    gstin,
    pan,
    state,
    state_code,
    city,
    pincode,
    mobile,
    email,
    logo_url,
    setup_completed,
    created_by
  ) VALUES (
    p_name,
    p_business_address,
    p_gstin,
    p_pan,
    p_state,
    p_state_code,
    p_city,
    p_pincode,
    p_mobile,
    p_email,
    p_logo_url,
    true,
    v_user_id
  ) RETURNING id INTO v_company_id;

  -- 2. Link user profile to company as OWNER
  UPDATE public.profiles
  SET 
    company_id = v_company_id,
    role = 'OWNER',
    updated_at = now()
  WHERE id = v_user_id;

  -- If profile didn't exist, create it
  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      id,
      company_id,
      full_name,
      email,
      phone,
      role,
      is_active
    ) VALUES (
      v_user_id,
      v_company_id,
      p_name,
      p_email,
      p_mobile,
      'OWNER',
      true
    );
  END IF;

  -- 3. Insert Primary Bank Account if provided
  IF p_bank_name IS NOT NULL AND p_account_number IS NOT NULL AND p_ifsc_code IS NOT NULL THEN
    INSERT INTO public.bank_accounts (
      company_id,
      bank_name,
      account_holder_name,
      account_number,
      ifsc_code,
      branch_name,
      upi_id,
      is_primary,
      is_active
    ) VALUES (
      v_company_id,
      p_bank_name,
      COALESCE(p_account_holder_name, p_name),
      p_account_number,
      p_ifsc_code,
      p_branch_name,
      p_upi_id,
      true,
      true
    );
  END IF;

  -- 4. Insert Company Default Settings
  INSERT INTO public.company_settings (
    company_id,
    invoice_prefix,
    challan_prefix,
    default_tax_rate,
    default_sac_code,
    invoice_terms,
    rental_terms,
    challan_terms
  ) VALUES (
    v_company_id,
    'INV',
    'CHL',
    18.00,
    '997312',
    '1. Goods/Machinery hired remain company property. 2. Payment due within 15 days of invoice. 3. 18% p.a. interest charged on overdue payments.',
    'Standard Boom Lift hire conditions apply. Diesel fuel, safe crane access and certified ground conditions provided by hirer.',
    'Machinery received at jobsite in good running condition along with standard safety harness & accessories.'
  ) ON CONFLICT (company_id) DO NOTHING;

  -- 5. Insert Selected Categories
  IF p_categories IS NOT NULL AND jsonb_array_length(p_categories) > 0 THEN
    FOR v_cat IN SELECT * FROM jsonb_to_recordset(p_categories) AS x(
      category_id uuid,
      name text,
      description text
    )
    LOOP
      INSERT INTO public.company_machine_categories (
        company_id,
        category_id,
        name,
        description,
        is_active
      ) VALUES (
        v_company_id,
        v_cat.category_id,
        v_cat.name,
        v_cat.description,
        true
      ) ON CONFLICT (company_id, name) DO NOTHING;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true, 'company_id', v_company_id);
END;
$$;

-- Grant execution to authenticated users
REVOKE EXECUTE ON FUNCTION public.complete_company_setup FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_company_setup TO authenticated;
