# LIFTLEDGER – Development Plan

## Project Overview
LiftLedger is an enterprise-grade Boom Lift & Equipment Rental Management SaaS application designed for equipment rental companies. It provides full lifecycle management of high-reach equipment (boom lifts, scissor lifts, telescopic lifts), end-to-end GST billing, customer relationship management, rental contracts with conflict prevention, preventative and breakdown maintenance, operational expense tracking, machine-level profitability analysis, and delivery/return challans.

## Architecture
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, React Router v6/v7, Lucide Icons, Recharts, React Hook Form, Zod, TanStack Query, date-fns, jsPDF, SheetJS (XLSX).
- **Backend / DB**: Supabase PostgreSQL with strict Row Level Security (RLS), multi-tenant isolation with `company_id`, database triggers, stored functions, and constraints.
- **Auth**: Supabase Auth (email/password with secure profile link, role enforcement for Owner, Accountant, Employee).
- **Storage**: Supabase Storage buckets for machine photos, equipment documents, expense receipts, and signed challans.

---

## 10-Phase Roadmap

### Phase 1: Project Setup & Core Shell
- Initialize Vite + React + TypeScript + Tailwind CSS
- Setup responsive layouts: Dark sidebar, top navigation with breadcrumbs, role badges, notifications, and mobile drawer
- Modern SaaS aesthetic: Cards, tables, empty states, modals, search/filter bars, toast notifications
- Router configuration with lazy loading and route protection

### Phase 2: Supabase Connection, Schema & Authentication
- Connect to Supabase project (`sbxsgunpmcjpkwhbzazn`)
- Configure Supabase client with auth state listener
- Implement Supabase Auth (Sign Up, Sign In, Reset Password, Sign Out)
- Profile management with 3 distinct roles: `OWNER`, `ACCOUNTANT`, `EMPLOYEE`
- Setup full PostgreSQL database schema with migration files in `supabase/migrations/`
- Enable Row-Level Security (RLS) on all tables with tenant isolation (`company_id`)

### Phase 3: Company Setup Wizard & Machine Categories
- Mandatory post-registration setup flow for new owners
- Company profile: Name, logo, GSTIN, business address, state, city, PIN, mobile, email, bank details
- **Owner-Selected Machine Categories**:
  - Interactive selection cards (120 ft Boom Lift, 135 ft Boom Lift, 150 ft Boom Lift, 160 ft Boom Lift, Scissor Lift, Articulated Boom Lift, Telescopic Boom Lift, Custom)
  - Rules: Multiple selections allowed, custom additions supported, saved permanently in Supabase, dynamic (not hardcoded), category deactivation preserves historical data
  - Settings page for category management later

### Phase 4: Individual Machine Management
- Add, edit, view, archive individual boom lifts and machines under selected categories
- Comprehensive specs: Registration #, Serial #, Brand, Model, Height/Capacity, Purchase Date, Purchase Price, Monthly Rate, Location, Status (Available, Rented, Under Maintenance, Inactive)
- Document & photo management
- Machine detail view with real-time stats: Rental history, maintenance logs, lifetime income, expenses, and net profit

### Phase 5: Customer Management & Rental Contracts
- Customer CRM: Company name, GSTIN, contact person, mobile, email, billing & site addresses, state code
- Customer profile with ledger, rental history, invoice history, and balance tracking
- Rental Contract Management:
  - Overlap check & conflict prevention for machine booking
  - Rates, security deposits, transportation, operator charges
  - Rental statuses: Draft, Active, Completed, Cancelled, On Hold
  - Extension and early return handling with partial month billing logic

### Phase 6: GST Invoicing & PDF Generation
- Statutory Indian GST compliance (Intra-state: CGST + SGST, Inter-state: IGST)
- Safe unique invoice number generation (`INV-YYYY-XXXX`) without reuse
- Immutable tax snapshots on finalized invoices
- High-quality PDF invoice generator:
  - Company & Customer details, GSTIN, SAC codes, tax breakup
  - Amount in words, bank details for NEFT/RTGS/UPI, signature section, terms & conditions
  - Download, print, and preview

### Phase 7: Payment Tracking & Outstanding Balances
- Payment recording: Full, partial, advance, multiple allocations
- Modes: Cash, UPI, Bank Transfer (NEFT/RTGS/IMPS), Cheque
- Dedicated TDS receivable tracking (Section 194C / 194I)
- Immutable financial ledger (reversals and adjustments instead of silent deletions)
- Real-time customer balance calculations

### Phase 8: Expense Management & Financial Reports
- Multi-category expenses: Fuel/Diesel, Transportation, Maintenance, Repairs, Operator Salary, Staff Salary, Insurance, Spares, Office, Bank Charges
- Strict separation: Operating Expenses (OpEx) vs Capital Expenditure (CapEx) vs Loan Principal / Interest (avoiding P&L distortion)
- Machine-wise expense tracking
- Comprehensive Reports:
  - Revenue (Invoiced vs Collected)
  - GST Summary (GSTR-1 format for CA verification)
  - Machine Profitability & Utilization Rate
  - Export to Excel (XLSX) and CSV

### Phase 9: Maintenance & Challans
- Maintenance scheduling, breakdown logging, machine downtime tracker
- Lockout: Machines under maintenance cannot be assigned to new rentals
- Delivery Challan: Site address, equipment condition checklist, accessories, delivered by, PDF export
- Return Challan: Return inspection, damages, missing accessories, penalty charges, PDF export

### Phase 10: Security Hardening, Audit & Delivery
- Supabase RLS security audit & advisors verification
- WhatsApp payment reminder generator with prefilled professional messages
- Automated UI tests & validation
- README with step-by-step beginner setup guide
