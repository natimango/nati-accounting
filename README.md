# NATI Accounting System

**AI-Powered D2C Accounting Software**

A standalone accounting system specifically designed for D2C businesses with AI bill processing, D2C-specific financial metrics, and real-time reporting.

## 🎯 Features

- ✅ **AI Bill Processing** - Upload bills and let Gemini AI extract vendor, amounts, dates, and categorize automatically
- ✅ **D2C Chart of Accounts** - Pre-configured with COGS, contribution margin, LTV, CAC accounts
- ✅ **Real-time Financial Reports** - P&L, Balance Sheet, Cash Flow with D2C metrics
- ✅ **E-commerce Integration** - API endpoints to sync orders, settlements, and returns
- ✅ **SKU-Level Profitability** - Track profit per product and per drop
- ✅ **Double-Entry Bookkeeping** - Proper accounting with journal entries

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                                                          │
│            NATI ACCOUNTING SYSTEM                        │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │         AI BILL PROCESSING ENGINE              │    │
│  │  Upload → Gemini Vision → Parse → Account     │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │       D2C-SPECIFIC ACCOUNTING CORE             │    │
│  │  • Chart of Accounts (D2C optimized)           │    │
│  │  • Double-entry bookkeeping                    │    │
│  │  • COGS tracking                               │    │
│  │  • Contribution margin calculation             │    │
│  └────────────────────────────────────────────────┘    │
│                        ↓                                 │
│  ┌────────────────────────────────────────────────┐    │
│  │         FINANCIAL REPORTS & DASHBOARDS         │    │
│  │  • P&L (with D2C metrics)                      │    │
│  │  • Balance Sheet                               │    │
│  │  • Cash Flow                                   │    │
│  │  • SKU-level profitability                     │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL
- Gemini 2.0 Flash (AI)
- JWT Authentication

**Frontend:**
- Next.js 14
- React 18
- Tailwind CSS
- Recharts

**Infrastructure:**
- Docker (PostgreSQL)
- Cloudinary (Document storage)

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for PostgreSQL)
- Gemini API key (optional, for AI bill processing)
- Cloudinary account (optional, for document storage)

### 1. Clone and Install

```bash
cd nati-accounting

# Install dependencies for all workspaces
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 2. Set Up Environment Variables

**Backend (.env):**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:
```env
DATABASE_URL=postgresql://nati_user:nati_password@localhost:5432/nati_accounting
PORT=3001
NODE_ENV=development

JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Optional: Gemini AI (for bill processing)
GEMINI_API_KEY=your-gemini-api-key

# Optional: Cloudinary (for document storage)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local):**
```bash
cd ../frontend
cp .env.example .env.local
```

Edit `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 3. Start PostgreSQL Database

```bash
# From project root
docker-compose up -d

# Verify database is running
docker ps
```

### 4. Run Database Migrations and Seed

```bash
cd backend

# Run migrations (creates all tables)
npm run db:migrate

# Seed initial data (chart of accounts, admin user, sample data)
npm run db:seed
```

You should see:
```
✅ All migrations completed successfully!
✅ Database seeded successfully!

📋 Default Login Credentials:
   Email: admin@nati.com
   Password: admin123
```

### 5. Start Development Servers

**Option 1: Start both servers together (from project root):**
```bash
npm run dev
```

**Option 2: Start separately:**

Terminal 1 (Backend):
```bash
cd backend
npm run dev
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

### 6. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/api/health

**Login with:**
- Email: `admin@nati.com`
- Password: `admin123`

## 📁 Project Structure

```
nati-accounting/
├── backend/
│   ├── src/
│   │   ├── config/          # Database & environment config
│   │   ├── controllers/     # Request handlers
│   │   ├── db/              # Migrations and seeds
│   │   ├── middleware/      # Auth, error handling, uploads
│   │   ├── routes/          # API routes
│   │   ├── services/        # Gemini AI, Cloudinary
│   │   ├── types/           # TypeScript types
│   │   └── server.ts        # Main entry point
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   │   ├── dashboard/   # Dashboard page
│   │   │   ├── bills/       # Bills management
│   │   │   ├── reports/     # Financial reports
│   │   │   └── login/       # Login page
│   │   ├── components/      # Reusable components
│   │   ├── contexts/        # React contexts (Auth)
│   │   └── lib/             # API client, types, utils
│   ├── package.json
│   └── tailwind.config.js
│
├── docker-compose.yml       # PostgreSQL setup
├── package.json             # Root workspace config
└── README.md
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user

### Bills
- `POST /api/bills/upload` - Upload and process bill (AI extraction)
- `GET /api/bills` - List all bills
- `GET /api/bills/:id` - Get bill details
- `POST /api/bills/:id/approve` - Approve and post bill to accounting

### Orders (E-commerce Integration)
- `POST /api/orders` - Create order from e-commerce
- `POST /api/orders/settlements` - Record payment settlement

### Reports
- `GET /api/reports/dashboard` - Dashboard summary
- `GET /api/reports/profit-loss` - P&L statement
- `GET /api/reports/balance-sheet` - Balance sheet

## 💡 How to Use

### 1. Upload Bills

1. Go to **Upload Bill** page
2. Drag & drop or select a bill (PDF/JPG/PNG)
3. Click **Upload & Process**
4. AI extracts vendor, amount, date, category
5. Review if confidence < 90%
6. Approve to post to accounting

### 2. View Financial Reports

1. Go to **Reports** page
2. Select date range
3. View P&L with D2C metrics:
   - Gross margin
   - Contribution margin
   - MER (Marketing Efficiency Ratio)
   - CAC, AOV
   - Profit per order

### 3. Integrate E-commerce

Your e-commerce platform can send webhooks:

```javascript
// When order is placed
await fetch('http://localhost:3001/api/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    order_id: 'ORD123',
    order_date: '2025-03-15',
    gross_amount: 4500,
    discount: 450,
    gateway_charges: 90,
    net_amount: 3960,
    items: [{
      sku: 'SKU001',
      quantity: 1,
      price: 4500,
      cogs: 1350
    }]
  })
});

// When payment settles
await fetch('http://localhost:3001/api/orders/settlements', {
  method: 'POST',
  body: JSON.stringify({
    settlement_id: 'SETT789',
    settlement_date: '2025-03-17',
    amount: 3960,
    orders: ['ORD123']
  })
});
```

## 🔧 Configuration

### Getting Gemini API Key

1. Go to https://ai.google.dev/
2. Sign in and create API key
3. Add to `backend/.env`: `GEMINI_API_KEY=your-key`

### Getting Cloudinary Account

1. Sign up at https://cloudinary.com
2. Get cloud name, API key, and secret
3. Add to `backend/.env`

## 🗄️ Database Management

### Reset Database
```bash
cd backend
npm run db:reset  # Runs migrations + seed
```

### Access PostgreSQL
```bash
docker exec -it nati-accounting-db psql -U nati_user -d nati_accounting
```

### Backup Database
```bash
docker exec nati-accounting-db pg_dump -U nati_user nati_accounting > backup.sql
```

### Restore Database
```bash
docker exec -i nati-accounting-db psql -U nati_user nati_accounting < backup.sql
```

## 📈 D2C Chart of Accounts

The system comes pre-configured with D2C-specific accounts:

**Revenue (4000-4999)**
- 4000: Gross Revenue
- 4010: Returns & Refunds
- 4020: Discounts Given
- 4030: Payment Gateway Charges

**COGS (5000-5999)**
- 5000: Raw Materials - Fabric
- 5010: Artist Royalties
- 5020: Packaging Materials
- 5030: Stitching/Production Labor
- 5040: Printing/Embroidery

**Operating Expenses (6000-6999)**
- 6000: Shipping Costs
- 6020-6050: Marketing (Meta, Google, Influencer, Content)
- 6300: Salaries
- 6400: Rent
- 6500: Utilities

## 🐛 Troubleshooting

### Database connection failed
```bash
# Check if PostgreSQL is running
docker ps

# Restart database
docker-compose restart

# Check logs
docker logs nati-accounting-db
```

### Port already in use
```bash
# Backend (3001)
lsof -ti:3001 | xargs kill -9

# Frontend (3000)
lsof -ti:3000 | xargs kill -9
```

### Gemini API not working
- Bills will still be created, just without AI extraction
- You can manually enter bill details
- Add API key later and re-process

## 🚢 Deployment

### Build for Production

```bash
# Build backend
cd backend
npm run build

# Build frontend
cd ../frontend
npm run build
```

### Deploy to Railway/Render

1. Create PostgreSQL database
2. Set environment variables
3. Deploy backend
4. Deploy frontend
5. Update `NEXT_PUBLIC_API_URL` in frontend

## 🔐 Security Notes

- Change JWT_SECRET in production
- Use strong passwords
- Enable HTTPS in production
- Restrict CORS origins
- Never commit .env files

## 📝 License

MIT

## 🤝 Support

For issues or questions, please create an issue on GitHub.

---

**Built with ❤️ for D2C businesses**
