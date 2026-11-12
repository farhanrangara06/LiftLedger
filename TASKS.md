# LiftLedger Task Tracker

## Phase 1: Project Setup & Core Shell
- [x] Initialize Vite + React 19 + TypeScript + Tailwind CSS v4
- [x] Configure `@tailwindcss/vite` and paths alias in `tsconfig.app.json`
- [x] Setup modern SaaS layout: Dark sidebar, responsive top navigation, notification center
- [x] Create reusable UI component library: Button, Input, Select, Card, Badge, Modal, EmptyState, LoadingSpinner

## Phase 2: Supabase Connection, Schema & Authentication
- [x] Connect Supabase project `sbxsgunpmcjpkwhbzazn`
- [x] Create `.env.example` and configured `.env.local`
- [x] Author comprehensive SQL migrations (`supabase/migrations/20261109000001_initial_schema.sql`)
- [x] Execute all 22 database tables, constraints, indexes and security policies via Supabase MCP
- [x] Seed standard boom lift categories (120ft, 135ft, 150ft, 160ft, Scissor, Articulated, Telescopic, Other)
- [x] Run Supabase Database Advisors security audit and resolve all findings
- [x] Create storage buckets: `equipment`, `receipts`, `challans` with RLS policies
- [x] Build `AuthContext` with multi-tenant company isolation, session persistence, and role support (`OWNER`, `ACCOUNTANT`, `EMPLOYEE`)
- [x] Build `ProtectedRoute` with role enforcement

## Phase 3: Company Setup Wizard & Machine Categories
- [x] Build mandatory 3-step Company Setup Wizard (`/setup`)
- [x] Step 1: Registered Company Profile (Legal name, GSTIN, PAN, Address, State code, Mobile, Email)
- [x] Step 2: Primary Settlement Bank Account (Bank name, Account number, IFSC, Branch, UPI)
- [x] Step 3: Owner-Selected Machine Categories (Interactive cards, unselected initially, multiple selection, custom category addition)
- [x] Save selected categories permanently to `company_machine_categories`
- [x] Restrict all downstream machine & rental dropdowns strictly to owner-selected categories

## Phase 4: Individual Machine Management
- [x] Fleet list view with search, category filter, and status filter
- [x] Add/Edit Machine Modal with specifications, serial numbers, monthly rate, and location
- [x] Machine Detail page (`/machines/:id`) with lifetime income, expenses, net profit, and ROI %
- [x] Full deployment & rental history table per machine
- [x] Maintenance & breakdown incident logs per machine

## Phase 5: Customer CRM & Rental Contracts
- [x] Customer CRM directory (`/customers`) with search, filter, and balance tracking
- [x] Customer detail view (`/customers/:id`) with ledger, invoices, payments, and rental contracts
- [x] Customer archival instead of destructive financial deletion
- [x] Rental management (`/rentals`) with unique contract reference generation
- [x] Automatic machine booking overlap prevention & validation
- [x] Rental extension workflow and early return / close contract workflow
- [x] Automatic status synchronization: machine becomes `Rented` upon activation, and `Available` upon return

## Phase 6: GST Invoicing & PDF Generation
- [x] Unique invoice number generator (`INV/YYYY-YY/XXXX`) via safe Postgres sequence
- [x] Dynamic place-of-supply tax logic: Intra-state (CGST + SGST) vs Inter-state (IGST)
- [x] Configurable GST rates (18%, 12%, 28%) and SAC codes (997312)
- [x] Immutable tax, customer, and company snapshots saved to each invoice
- [x] Professional jsPDF tax invoice generator with amount in words, bank details, and signature line
- [x] PDF download, preview, and print capabilities

## Phase 7: Payments & Outstanding Balances
- [x] Payment recording (`/payments`) with full, partial, and advance payments
- [x] Dedicated Section 194C / 194I TDS tracking
- [x] Automated invoice balance reconciliation
- [x] Financial reversal workflow (preserves audit trail without deleting ledger records)
- [x] WhatsApp payment reminder generator with prefilled bank transfer details

## Phase 8: Expenses & Financial Reports
- [x] Multi-category expense tracking (`/expenses`)
- [x] Machine-level expense attribution
- [x] Strict accounting separation: Operating Expenses (OpEx) vs Capital Expenditure (CapEx) vs Loan Principal / Interest
- [x] Comprehensive reporting suite (`/reports`):
  - GSTR-1 compliant GST summary
  - Machine-wise profitability and operating margin %
  - Customer revenue and outstanding ledger
- [x] Report exports to Excel (`.xlsx`) and CSV

## Phase 9: Maintenance & Challans
- [x] Maintenance schedule & breakdown logger (`/maintenance`)
- [x] Safety checklist (hydraulics, emergency lowering, overload alarm, brakes, harness)
- [x] Machine downtime hours tracker
- [x] Lockout enforcement: machines under maintenance cannot be assigned to new rentals
- [x] Delivery Challan generator (`/challans`) with equipment condition and accessories checklist
- [x] Return Challan generator with damage assessment and penalty notes
- [x] Printable and downloadable Challan PDFs

## Phase 10: Security, Verification & Documentation
- [x] Codebase build test (`npm run build`) passing with zero errors
- [x] PWA viewport and meta tags configured
- [x] Created beginner-friendly `README.md` with step-by-step setup and operational guides
