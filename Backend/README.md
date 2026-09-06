# SmartInspect Backend 🛡️

Backend API server for **SmartInspect (SIH Problem Statement PS-26095 / SIH26095)** — *Smart Real-Time Monitoring & Inspection Platform for the Ministry of Social Justice and Empowerment (MoSJE)*.

---

## 🏗️ Architecture & Folder Structure

```text
Backend/
├── src/
│   ├── config/              # Database (Prisma 7), Redis & external service configurations
│   ├── controllers/         # HTTP request/response handlers
│   ├── middleware/          # Auth, RBAC, Validation, Error handling
│   ├── routes/              # Express API route declarations
│   ├── services/            # Core business logic (inspection workflows, scoring, etc.)
│   ├── sockets/             # Real-time WebSocket handlers (planned)
│   ├── utils/               # Common helper classes and functions
│   ├── app.js               # Express application initialization & middleware pipeline
│   └── server.js            # Server entry point & graceful startup
├── prisma/
│   └── schema.prisma        # Prisma ORM schema
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
Key variables:
- `DATABASE_URL`: PostgreSQL / Supabase connection string.
- `REDIS_URL`: Redis connection URL (e.g., `redis://localhost:6379` or cloud Redis instance).

### 3. Redis Setup & Infrastructure
* **Role:** Redis serves as an infrastructure component for background job queuing (BullMQ), cache layers, and real-time pub/sub synchronization in later sprints.
* **Resilience:** The backend connects to Redis gracefully on startup (`src/config/redis.js`). If Redis is not currently running locally during early development, the server will log a warning and continue operating without crashing.
* **Note:** Feature-specific queues, caching, and rate-limiting are planned for subsequent modules and are not yet active.

### 4. Prisma Commands
```bash
# Validate Prisma schema
npx prisma validate

# Generate Prisma Client
npx prisma generate
```

### 5. Run Development Server
```bash
npm run dev
```

The server will start at `http://localhost:5000`.

---

## 📡 API Endpoints (Current Foundation)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | API status and overview |
| `GET` | `/api/health` | Comprehensive system health check (Server, DB, Redis) |
| `GET` | `/api/health/db` | Database connectivity health check |
| `GET` | `/api/health/redis` | Redis connectivity status |
| `GET` | `/test-db` | Legacy database test endpoint |

---

## 🗺️ Planned Modules (Upcoming Sprints)

1. **Authentication & RBAC (`/api/auth`)**: JWT-based login and role management (Ministry Admin, Field Inspector, Facility Superintendent).
2. **Institutions / Facilities (`/api/institutions`)**: Registry and metadata for MoSJE-aided institutions (Old age homes, de-addiction centers, hostels, etc.).
3. **Inspection Management (`/api/inspections`)**: Geo-fenced audit schedules, checklist submissions, verification workflows.
4. **Evidence & Media (`/api/evidence`)**: Tamper-proof photo uploads with GPS watermarks and Cloudinary integration.
5. **Reports & Risk Intelligence (`/api/reports`, `/api/alerts`, `/api/dashboard`)**: AI-assisted anomaly flagging, compliance scoring, and automated PDF dossier generation.
6. **Real-time WebSockets (`/sockets`)**: Live inspector status tracking and instant alert dispatch.
