# 🚜 LIFTLEDGER – Boom Lift & Equipment Rental Management SaaS

**LiftLedger** is a commercial-grade, multi-tenant SaaS application purpose-built for Boom Lift and high-reach equipment rental companies. It provides full-lifecycle fleet management, automated Indian GST tax billing, customer accounts & ledger tracking, preventative & breakdown maintenance with safety checklists, machine-level profitability analysis, and delivery/return challans.

---

## 🌟 Key Features

1. **Owner-Selected Machine Categories (Mandatory Setup Rule)**
   - During company onboarding, the business owner manually selects which boom lift categories their company owns or manages (e.g., *120 ft Boom Lift*, *135 ft Boom Lift*, *150 ft Boom Lift*, *160 ft Boom Lift*, *Scissor Lift*, *Articulated Boom Lift*, *Telescopic Boom Lift*, or custom equipment).
   - Custom machine categories can be added on the fly.
   - Only owner-selected categories appear throughout the application in machine registration and rental contract dropdowns.
   - Deactivating a category hides it from new dropdowns without deleting historical rental or invoice records.

2. **Fleet Asset Management & Machine-wise Profitability**
   - Individual boom lift registration (Brand, Model, Serial Number, Working Reach, Purchase Price, Monthly Rental Rate, Current Location).
   - Real-time asset statuses: `Available`, `Rented`, `Under Maintenance`, `Inactive`.
   - Comprehensive machine detail page calculating **Lifetime Revenue**, **Operating Expenses (OpEx)**, **Net Machine Profit**, and **Capital ROI %**.

3. **Rental Contract Management & Overlap Prevention**
   - Prevent machine double-booking: Automated date-range validation alerts the user and blocks contract activation if a machine is already booked or is under maintenance.
   - Manages monthly billing rates, refundable security deposits, mobilization charges, and operator fees.
   - One-click rental extensions and return workflows.
   - Automatic status synchronization: marking a contract `Active` sets the machine to `Rented`; completing the contract automatically releases the machine back to `Available`.

4. **Statutory Indian GST Invoicing & PDF Generation**
   - Automatic tax determination:
     - **Intra-State Sale** (Company State == Customer State): splits tax into **CGST + SGST**.
     - **Inter-State Sale** (Company State != Customer State): calculates **IGST**.
   - Safe sequential invoice numbering (`INV/YYYY-YY/XXXX`) using a PostgreSQL stored sequence.
   - Immutable tax snapshots stored with every invoice.
   - Professional PDF invoice export featuring company branding, tax breakup, amount in words, bank transfer details, terms & conditions, and signature line.

5. **Payment Collections, Allocations & TDS Tracking**
   - Record customer payments across multiple modes: *Bank Transfer (NEFT/RTGS/IMPS)*, *UPI*, *Cheque*, *Cash*.
   - Dedicated **Section 194C / 194I TDS** receivable tracking for clean financial accounting.
   - **Immutable Financial Ledger**: Reversal transactions are recorded instead of permanently deleting financial history.
   - **WhatsApp Payment Reminders**: One-click generation of professional payment reminder messages pre-filled with invoice summary and bank details.

6. **Fleet & Operating Expenses (OpEx vs CapEx Separation)**
   - Track fuel (diesel), repairs, spare parts, operator salaries, insurance, and permits.
   - Strict accounting compliance: isolates operating expenses (OpEx) from capital expenditure (CapEx) and loan principal to avoid distorting profit-and-loss statements.

7. **Maintenance & Breakdown Tracking**
   - Periodic servicing and emergency breakdown logging.
   - Machine downtime hours tracker.
   - Mandatory lockout: machines with active breakdown or maintenance records cannot be rented.
   - Pre-operation safety and quality inspection checklist (hydraulics, emergency lowering, overload alarm, brakes, safety harness).

8. **Delivery & Return Challans**
   - Site delivery challans and return offloading challans with accessories checklist (safety harness, charger cables, control pendants, outrigger pads).
   - Generates printable and downloadable PDF Challans.

9. **Financial Reports & Exports**
   - GSTR-1 compliant GST summary.
   - Machine-wise revenue, expense, and operating margin breakdown.
   - Customer-wise sales and outstanding balances.
   - One-click export to **Excel (`.xlsx`)** and **CSV**.

10. **Role-Based Security (Supabase PostgreSQL RLS)**
    - Three user roles: `OWNER` (full administrative control), `ACCOUNTANT` (invoices, payments, expenses, reports), `EMPLOYEE` (fleet operations, challans, maintenance).
    - Multi-tenant company isolation enforced via PostgreSQL Row-Level Security policies.

---

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Lucide Icons, Recharts
- **Backend / Database**: Supabase PostgreSQL with Row Level Security (RLS)
- **Authentication**: Supabase Auth (Email & Password with profile linking)
- **Storage**: Supabase Storage (`equipment`, `receipts`, `challans` buckets)
- **Document Generation**: jsPDF, jspdf-autotable, SheetJS (XLSX)

---

## 🚀 Beginner-Friendly Setup Instructions

### Prerequisites
Make sure you have **Node.js** (v18 or higher) installed on your computer. You can check by running in your terminal:
```bash
node -v
npm -v
```

---

### Step 1: Clone or Open the Project
Open your terminal (PowerShell, Command Prompt, or Terminal) in the project directory:
```bash
cd LiftLedger
```

---

### Step 2: Install Dependencies
Install all required packages:
```bash
npm install
```

---

### Step 3: Configure Supabase Credentials
Create a file named `.env.local` in the root of the project (or copy `.env.example`):
```bash
cp .env.example .env.local
```

Inside `.env.local`, enter your Supabase Project URL and Anon/Publishable Key:
```env
VITE_SUPABASE_URL=https://sbxsgunpmcjpkwhbzazn.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```
*(Your active Supabase backend has already been created and verified with all 22 database tables and RLS security policies.)*

---

### Step 4: Run the Development Server
Start the local development server:
```bash
npm run dev
```
Open your browser and navigate to:
```
http://localhost:5173
```

---

### Step 5: Test the End-to-End Workflow

1. **Sign Up**:
   - Go to `/signup`.
   - Enter your Full Name, Email, and Password, and choose the role **Owner**.
2. **Complete Company Setup Wizard**:
   - You will automatically be redirected to the 3-step setup wizard (`/setup`).
   - **Step 1**: Enter your company name, GSTIN, business address, and mobile number.
   - **Step 2**: Enter your primary bank details (for RTGS/NEFT payment instructions on invoices).
   - **Step 3 (Mandatory)**: Select the machine categories your company owns (e.g. *120 ft Boom Lift*, *135 ft Boom Lift*, *Scissor Lift*) or add a custom category.
   - Click **Finish Setup & Launch LiftLedger**.
3. **Register Fleet Machines**:
   - Navigate to **Boom Lifts & Fleet** (`/machines`) and click **+ Add New Machine**.
   - Select one of your approved categories, enter the Machine ID, serial number, and monthly rental rate.
4. **Add Customers**:
   - Navigate to **Customers** (`/customers`) and click **+ Add Customer**.
   - Enter client enterprise details and GSTIN.
5. **Create a Rental Contract**:
   - Navigate to **Rentals** (`/rentals`) and click **+ New Rental Contract**.
   - Pick your customer and assign a machine. Notice that double-booking overlaps are automatically prevented.
6. **Generate a GST Invoice**:
   - Navigate to **GST Invoices** (`/invoices`) and click **+ Issue GST Invoice**.
   - Pick the customer; notice whether CGST+SGST or IGST is applied based on the place of supply.
   - Click the **Download PDF** icon to inspect the invoice.
7. **Record Payment & Send WhatsApp Reminder**:
   - Click **Send WhatsApp** to prepare a pre-filled WhatsApp payment reminder with your bank account details.
   - Navigate to **Payments & TDS** (`/payments`) and click **+ Record Payment** to record bank receipts and deduct Section 194C/194I TDS.
8. **Issue Delivery & Return Challans**:
   - Navigate to **Challans** (`/challans`) and issue site dispatch or return challans with the accessories checklist.
9. **View Machine Profitability & Export Reports**:
   - Navigate to **Financial Reports** (`/reports`) to view machine-level profitability, GSTR-1 summaries, and export records to Excel (`.xlsx`).

---

## 🔒 Security Architecture

- **Row Level Security (RLS)**: Every database table has RLS enabled with tenant isolation based on `company_id`.
- **Protected Database Code**: Functions like `get_next_invoice_number` and `current_user_company_id` have public access revoked and enforce authenticated session validation.
- **Frontend Keys**: Only the Supabase `anon` / publishable key is used in the frontend; service-role keys are never exposed.

---

## 🚢 Production Deployment

To build the application for production hosting (e.g. Netlify, Vercel, or custom CDN):
```bash
npm run build
```
This produces an optimized production bundle in the `dist/` directory ready for deployment.
