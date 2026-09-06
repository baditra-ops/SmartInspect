# SmartInspect Backend 🛡️

Backend API server for **SmartInspect (SIH Problem Statement PS-26095 / SIH26095)** — *Smart Real-Time Monitoring & Inspection Platform for the Ministry of Social Justice and Empowerment (MoSJE)*.

---

## 🏗️ Architecture & Folder Structure

```text
Backend/
├── src/
│   ├── config/              # Database (Prisma 7), Redis & external service configurations
│   ├── controllers/         # HTTP request/response handlers (auth, health, etc.)
│   ├── middleware/          # Auth, RBAC, Validation, Error handling
│   ├── routes/              # Express API route declarations
│   ├── services/            # Core business logic (auth, inspection workflows, scoring)
│   ├── sockets/             # Real-time WebSocket handlers (planned)
│   ├── utils/               # Auth, validation, ApiError, ApiResponse helpers
│   ├── app.js               # Express application initialization & middleware pipeline
│   └── server.js            # Server entry point & graceful startup
├── prisma/
│   ├── migrations/          # Version-controlled SQL migration history
│   ├── schema.prisma        # Complete Prisma 7 ORM schema (21 models, 19 enums)
│   └── seed.js              # Development user provisioning seed script
├── generated/
│   └── prisma/              # Generated Prisma 7 client
├── .env.example             # Environment variable template
├── package.json             # Node dependencies and scripts
└── prisma.config.ts         # Prisma 7 configuration file
```

---

## ⚙️ Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and configure your credentials:
```bash
cp .env.example .env
```
> [!WARNING]
> Never commit `.env` or expose live credentials in git repositories. Keep `.env.example` with placeholder strings only.

Key variables:
- `DATABASE_URL`: PostgreSQL / Supabase connection URL.
- `JWT_SECRET`: Secret key for signing and verifying JWT tokens.
- `JWT_EXPIRES_IN`: JWT expiration window (e.g., `7d` or `24h`).
- `REDIS_URL`: Redis connection URL (e.g., `redis://localhost:6379` or cloud Redis instance).
- `CLIENT_URL`: Frontend URL for CORS configuration.
- `CLOUDINARY_*`: Cloudinary credentials for evidence image storage.

### 3. Database & Prisma 7 Workflow (Supabase)
The backend utilizes **Prisma 7** with direct PostgreSQL driver adapters (`@prisma/adapter-pg` with `pg.Pool` connection pooling).

```bash
# Validate Prisma schema
npx prisma validate

# Format Prisma schema
npx prisma format

# Generate typed Prisma Client (output: generated/prisma)
npx prisma generate

# Apply pending migrations to the database
npx prisma migrate deploy

# Seed development demo users
npm run seed
```

> [!NOTE]
> Database migrations are tracked in `prisma/migrations/`. The initial schema is applied via `20260906130500_initial_smartinspect_schema`.

### 4. Provisioned Development Users (Demo Accounts)
The application intentionally does **NOT** expose a public registration endpoint. Government users are provisioned. Run `npm run seed` to create test accounts:

| Role | Email | Password | Scope |
|---|---|---|---|
| `ADMIN` | `admin@smartinspect.gov.in` | `Password@123` | National Headquarters |
| `STATE_OFFICER` | `state.officer@smartinspect.gov.in` | `Password@123` | State Directorate (Maharashtra) |
| `DISTRICT_OFFICER` | `district.officer@smartinspect.gov.in` | `Password@123` | District Social Welfare Officer (Pune) |
| `INSPECTOR` | `inspector@smartinspect.gov.in` | `Password@123` | Field Auditor (`INSP-MH-PUN-001`) |

### 5. Separate AI Service Notice
> [!IMPORTANT]
> The **AI / Computer Vision Service** resides separately in the `Ai-Service/` workspace directory and is developed independently. The backend communicates with the AI service exclusively via API/service boundaries. Do not mix AI service code inside the backend codebase.

### 6. Run Development Server
```bash
npm run dev
```

The server will start at `http://localhost:5000`.

---

## 📡 API Endpoints

### 🔐 Authentication & Identity (`/api/auth`)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticate with email & password; returns JWT and safe user object |
| `GET` | `/api/auth/me` | Bearer JWT | Fetch current authenticated user profile and relations |
| `POST` | `/api/auth/logout` | Bearer JWT | Stateless client-side logout acknowledgment |

#### Role-Based Middleware Example
```javascript
import { authenticate } from "./middleware/auth.middleware.js";
import { requireRole } from "./middleware/role.middleware.js";

// Protected admin-only route
router.get("/admin/audits", authenticate, requireRole("ADMIN"), controller);

// Protected state/district officer route
router.get("/reports", authenticate, requireRole("ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"), controller);
```

### 🩺 System Health (`/api/health`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and overview |
| `GET` | `/api/health` | Comprehensive system health check (Server, DB, Redis) |
| `GET` | `/api/health/db` | Database connectivity health check |
| `GET` | `/api/health/redis` | Redis connectivity status |
| `GET` | `/test-db` | Legacy database test endpoint |

---

## 🗺️ Planned Modules (Upcoming Sprints)

1. **Institutions / Facilities (`/api/institutions`)**: Registry and metadata for MoSJE-aided institutions (Old age homes, de-addiction centers, hostels, etc.).
2. **Inspection Management (`/api/inspections`)**: Geo-fenced audit schedules, checklist submissions, verification workflows.
3. **Evidence & Media (`/api/evidence`)**: Tamper-evident photo uploads with GPS watermarks, SHA-256 hashes, and Cloudinary integration.
4. **Reports & Risk Intelligence (`/api/reports`, `/api/alerts`, `/api/dashboard`)**: AI-assisted anomaly flagging, compliance scoring, and automated PDF dossier generation.
5. **Real-time WebSockets (`/sockets`)**: Live inspector status tracking and instant alert dispatch.
