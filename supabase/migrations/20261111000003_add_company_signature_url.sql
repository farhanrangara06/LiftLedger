-- ============================================================
-- LIFTLEDGER DATABASE SCHEMA MIGRATION: COMPANY E-SIGN / STAMP PHOTO
-- Migration: 20261111000003_add_company_signature_url.sql
-- ============================================================

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS signature_url text;
