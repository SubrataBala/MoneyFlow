# 🏗️ Labour ERP System

A mobile-first construction labour management system with attendance tracking, wage calculations, and daily summaries.

---

## 📁 Project Structure

```
erp-system/
├── backend/               # Node.js + Express + PostgreSQL
│   ├── config/
│   │   └── database.js    # Sequelize connection
│   ├── controllers/       # Business logic
│   ├── middleware/        # JWT auth middleware
│   ├── models/            # Sequelize ORM models
│   ├── routes/            # API routes
│   ├── utils/             # Seed scripts
│   ├── server.js          # Entry point
│   └── .env.example
└── frontend/              # React.js + Mobile-first UI
    ├── public/
    └── src/
        ├── components/    # Layout, shared components
        ├── context/       # Auth context
        ├── pages/         # All pages
        └── utils/         # API client, helpers
```

---

## 🚀 Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm or yarn

---

### 1. PostgreSQL Setup

```sql
-- Open PostgreSQL shell (psql)
CREATE DATABASE erp_labour;
CREATE USER erp_user WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE erp_labour TO erp_user;
```

---

### 2. Backend Setup

```bash
cd erp-system/backend

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your DB credentials

# Start backend (auto-syncs DB and seeds admin)
npm run dev
```

Backend runs at: `http://localhost:5000`

---

### 3. Frontend Setup

```bash
cd erp-system/frontend

# Install dependencies
npm install

# Start frontend
npm start
```

Frontend runs at: `http://localhost:3000`

---

## 🔑  Credentials

| Role  | Username | Password  |
|-------|----------|-----------|


> ⚠️ Change the admin password in `.env` before production!

---

## 📱 Pages & Features

| Page | Role | Description |
|------|------|-------------|
| Login | All | Role-based login (Owner/Admin) |
| Dashboard | Owner | Today's overview, summary cards |
| Attendance | Owner | Mark present/absent, set wages, daily entries |
| Wages | Owner | Individual labour wage tracking |
| Daily Summary | Owner | Quick entry mode for bulk workers |
| Reports | Owner | Date range reports + CSV export |
| Admin Panel | Admin | Create/manage owner accounts |

---

## 🌐 API Endpoints

### Auth
- `POST /api/auth/login` - Login (admin or owner)
- `GET /api/auth/me` - Get current user

### Admin (Admin only)
- `POST /api/admin/owners` - Create owner
- `GET /api/admin/owners` - List all owners
- `PUT /api/admin/owners/:id/toggle-status` - Activate/deactivate
- `PUT /api/admin/owners/:id/reset-password` - Reset password
- `DELETE /api/admin/owners/:id` - Delete owner

### Labour (Owner only)
- `GET /api/labour` - List labours (with search)
- `POST /api/labour` - Add labour
- `DELETE /api/labour/:id` - Delete labour
- `POST /api/labour/attendance` - Mark attendance + wage
- `GET /api/labour/attendance?date=` - Get attendance by date
- `GET /api/labour/wages` - All wage summaries
- `GET /api/labour/:id/wages` - Individual wage detail

### Daily Worker Summary (Owner only)
- `POST /api/daily-worker` - Create/update daily entry
- `GET /api/daily-worker` - Get history
- `GET /api/daily-worker/today` - Today's summary

---

## ☁️ Deployment

### Option A: Render.com (Free Tier)

**Backend:**
1. Create a new "Web Service" on Render
2. Connect your GitHub repo
3. Root directory: `backend`
4. Build command: `npm install`
5. Start command: `node server.js`
6. Add environment variables from `.env`
7. Add a PostgreSQL database service

**Frontend:**
1. Create a new "Static Site" on Render
2. Root directory: `frontend`
3. Build command: `npm install && npm run build`
4. Publish directory: `build`
5. Add env: `REACT_APP_API_URL=https://your-backend.onrender.com/api`

### Option B: Railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login

# Backend
cd backend
railway init
railway add postgresql
railway up

# Frontend
cd ../frontend
railway init
railway up
```

### Option C: VPS (Ubuntu)

```bash
# Install dependencies
sudo apt update && sudo apt install nodejs npm postgresql nginx

# Setup PostgreSQL (same as local)

# Clone and setup project
git clone your-repo
cd erp-system/backend && npm install
cd ../frontend && npm install && npm run build

# Install PM2
npm install -g pm2
cd ../backend
pm2 start server.js --name erp-backend

# Nginx config (serve frontend build from /etc/nginx/sites-available/default)
# Proxy /api to localhost:5000
```

---

## 🔒 Security Features

- ✅ bcrypt password hashing (12 rounds)
- ✅ JWT authentication (7-day expiry)
- ✅ Role-based route protection
- ✅ Rate limiting (100/15min general, 10/15min auth)
- ✅ Helmet.js security headers
- ✅ CORS configuration
- ✅ Input validation
- ✅ SQL injection prevention (Sequelize ORM)
- ✅ Environment variable secrets

---

## ⚙️ Environment Variables

```env
PORT=5000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_NAME=erp_labour
DB_USER=postgres
DB_PASSWORD=yourpassword

JWT_SECRET=a_very_long_random_secret_string_here
JWT_EXPIRES_IN=7d

ADMIN_USERNAME=
ADMIN_PASSWORD=

FRONTEND_URL=http://localhost:3000
```
MoneyFlow
