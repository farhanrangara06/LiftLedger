-- ============================================================
-- LIFTLEDGER DATABASE SCHEMA MIGRATION: MSME & INVOICE SALARY ADJUSTMENT
-- Migration: 20261111000002_add_msme_and_invoice_salary_fields.sql
-- ============================================================

-- Add msme_number to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS msme_number text;

-- Add salary_adjustment to invoices table (supports operator salary deduction/addition as in standard boom lift invoices)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS salary_adjustment numeric(12,2) NOT NULL DEFAULT 0;
