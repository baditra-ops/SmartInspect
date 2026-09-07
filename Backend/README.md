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

### 🏢 Institution Management (`/api/institutions`)

All endpoints require Bearer JWT authentication (`Authorization: Bearer <token>`). Geographic scoping is strictly enforced based on the caller's assigned territory.

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/institutions` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER`, `INSPECTOR`, `INSTITUTION_USER` | Paginated institution list with filters, search, and geographic scoping |
| `POST` | `/api/institutions` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Register a new institution / welfare facility |
| `GET` | `/api/institutions/:id` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER`, `INSPECTOR`, `INSTITUTION_USER` | Detailed institution profile including schemes, counts, and risk status |
| `PATCH` | `/api/institutions/:id` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Update editable fields of an institution |
| `DELETE` | `/api/institutions/:id` | `ADMIN`, `STATE_OFFICER` | Soft-deactivate an institution (`status: CLOSED`, `deletedAt`) |
| `GET` | `/api/institutions/:id/schemes` | All authenticated roles (scoped) | List active welfare schemes linked to the institution |
| `POST` | `/api/institutions/:id/schemes` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Link a government welfare scheme to an institution |
| `DELETE` | `/api/institutions/:id/schemes/:schemeId` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Unlink a scheme from an institution |
| `GET` | `/api/institutions/:id/beneficiaries` | All authenticated roles (scoped) | Paginated list of registered beneficiaries |
| `GET` | `/api/institutions/:id/attendance` | All authenticated roles (scoped) | Historical aggregated daily attendance logs with date filtering |

#### Institution Listing Query Parameters
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `search`: Search query matching institution name or unique code
- `state`: Filter by state (e.g. `Maharashtra`)
- `district`: Filter by district (e.g. `Pune`)
- `type`: Filter by enum `InstitutionType` (`OLD_AGE_HOME`, `DE_ADDICTION_CENTRE`, `CHILD_CARE_INSTITUTION`, `DISABILITY_SHELTER`, `HOSTEL`, `COMMUNITY_CENTRE`, `OTHER`)
- `status`: Filter by enum `InstitutionStatus` (`ACTIVE`, `INACTIVE`, `PROVISIONAL`, `BLACKLISTED`, `CLOSED`)
- `riskLevel`: Filter by enum `RiskLevel` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `sortBy`: Sort column (`name`, `createdAt`, `latestRiskScore`, `capacity`, `currentOccupancy`)
- `sortOrder`: `asc` or `desc` (default: `desc`)

#### Role-Based Geographic Scoping Rules
- **ADMIN**: Unrestricted nationwide visibility and management.
- **STATE_OFFICER**: Automatically scoped to institutions where `state = user.state`. Cannot create, update, or view institutions outside their state.
- **DISTRICT_OFFICER**: Automatically scoped to institutions where `state = user.state` AND `district = user.district`. Cannot access facilities outside their district.
- **INSPECTOR**: Read access across institutions for inspection planning and verification.
- **INSTITUTION_USER**: Scoped strictly to their single assigned facility via `user.institutionId`.

### 📋 Inspection & Inspector Assignment (`/api/inspections`)

All endpoints require Bearer JWT authentication (`Authorization: Bearer <token>`). Geographic scoping and role-based access control are strictly enforced.

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/inspections` | All authenticated roles (scoped) | Paginated list of inspections with filters, date ranges, status, and geographic scoping |
| `POST` | `/api/inspections` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Create a new planned inspection for an institution (auto-generates `INSP-YYYY-XXXXX` code) |
| `GET` | `/api/inspections/my` | `INSPECTOR` | Paginated list of inspections assigned to the authenticated inspector |
| `GET` | `/api/inspections/eligible-inspectors` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Query eligible, active inspectors matching district/state jurisdiction with workload count |
| `GET` | `/api/inspections/:id` | All authenticated roles (scoped) | Detailed inspection view including institution, current inspector, and assignment history |
| `PATCH` | `/api/inspections/:id` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Update administrative metadata (scheduledDate, type, remarks) |
| `POST` | `/api/inspections/:id/assign` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Manually assign an inspector (`MANUAL_DISPATCH`), transitions status to `ASSIGNED` |
| `POST` | `/api/inspections/:id/reassign` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Reassign inspector; old assignment becomes `REASSIGNED`, new is `PENDING` |
| `GET` | `/api/inspections/:id/assignments` | All authenticated roles (scoped) | View historical assignment audit trail for an inspection |
| `POST` | `/api/inspections/:id/accept` | `INSPECTOR` | Assigned inspector accepts task; sets status to `ACCEPTED` |
| `POST` | `/api/inspections/:id/reject` | `INSPECTOR` | Assigned inspector declines with `declineReason`; reverts inspection to `PLANNED` |
| `POST` | `/api/inspections/:id/start` | `INSPECTOR` | Assigned inspector starts audit; sets status to `IN_PROGRESS`, sets inspector `ON_DUTY` |
| `POST` | `/api/inspections/:id/complete` | `INSPECTOR`, `ADMIN` | Complete audit; sets status to `COMPLETED`, increments audits count, resets to `AVAILABLE` |
| `POST` | `/api/inspections/:id/cancel` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Cancel planned/assigned inspection; sets status to `CANCELLED` |

#### Inspection Lifecycle State Machine
```text
  ┌───────────┐
  │  PLANNED  │◄─────────────────────────────┐
  └─────┬─────┘                              │
        │ assign                             │ reject (declineReason)
        ▼                                    │
  ┌───────────┐                              │
  │ ASSIGNED  ├──────────────────────────────┘
  └─────┬─────┘
        │ accept (or reassign)
        ▼
  ┌───────────┐
  │ ACCEPTED  │
  └─────┬─────┘
        │ start
        ▼
  ┌─────────────┐
  │ IN_PROGRESS │
  └─────┬───────┘
        │ complete
        ▼
  ┌───────────┐
  │ COMPLETED │
  └───────────┘
```
*(Any non-completed inspection may also transition to `CANCELLED` by administrative roles).*

#### Query Parameters for `GET /api/inspections`
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `status`: `PLANNED`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, etc.
- `type`: `SCHEDULED`, `SURPRISE`, `FOLLOW_UP`, `COMPLAINT_DRIVEN`
- `institutionId`: Filter by target institution UUID
- `inspectorId`: Filter by assigned inspector UUID
- `state`: Filter by state
- `district`: Filter by district
- `scheduledDate`: Exact date match (`YYYY-MM-DD`)
- `startDate` / `endDate`: Date range filter (`YYYY-MM-DD`)
- `search`: Search by inspection code or institution name
- `sortBy`: `scheduledDate`, `createdAt`, `status`, `type`, `overallScore`
- `sortOrder`: `asc` or `desc` (default: `desc`)

---

### 📍 GPS Verification & Geofencing (`/api/inspections/:id/gps`)

GPS geofencing ensures transparent, tamper-resistant proof of physical inspector presence at designated welfare institutions before or during field audits.

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/inspections/:id/gps/verify` | `INSPECTOR` (assigned), `ADMIN` | Submit GPS coordinates (`latitude`, `longitude`, `accuracyMeters`, `verificationType`, `deviceInfo`); calculates distance and records verification |
| `GET` | `/api/inspections/:id/gps` | All authenticated roles (scoped) | List chronological GPS verification attempts and pings for an inspection |
| `GET` | `/api/inspections/:id/gps/latest` | All authenticated roles (scoped) | Retrieve the most recent GPS verification record for an inspection |

#### Verification Rules & Math
- **Haversine Distance**: Computes great-circle distance between inspector device coordinates and the target institution's registered coordinates ($R = 6,371,000$ meters).
- **Geofence Check**: Verified if $\text{distanceMeters} \le \text{Institution.geofenceRadiusMeters}$ (or default fallback `GPS_GEOFENCE_RADIUS_METERS=150` meters).
- **Automatic Check-In Update**: When a `CHECK_IN` verification succeeds within the geofence, `Inspection.isGeofenceVerified` is automatically set to `true`.
- **Accuracy & Anti-Spoofing**: Coordinates with `accuracyMeters > 500m` trigger an automated `tamperFlag: true`.
- **Audit Logging**: Every verification attempt generates an immutable `AuditLog` entry (`GPS_VERIFICATION_SUCCESS` or `GPS_VERIFICATION_OUTSIDE_GEOFENCE`).

---

### 📸 Evidence Capture & Secure Media Storage (`/api/inspections/:id/evidence`, `/api/evidence`)

Tamper-evident media capture, Cloudinary cloud storage, and cryptographic SHA-256 fingerprinting for field inspection audits.

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/inspections/:id/evidence` | `INSPECTOR` (assigned), `ADMIN` | Upload photo/video/document evidence (`file`, `category`, `mediaType`, `latitude`, `longitude`, `checklistItemId`, `isWatermarked`); computes SHA-256 hash and uploads to Cloudinary |
| `GET` | `/api/inspections/:id/evidence` | All authenticated roles (scoped) | List all evidence media records attached to an inspection with uploader and category metadata |
| `GET` | `/api/evidence/:id` | All authenticated roles (scoped) | Fetch a single evidence record by ID with linked inspection and institution details |
| `GET` | `/api/evidence/:id/integrity` | All authenticated roles (scoped) | Re-hashes the remote Cloudinary asset and verifies integrity against the stored SHA-256 fingerprint |
| `DELETE` | `/api/evidence/:id` | `ADMIN`, `STATE_OFFICER` (scoped) | Administrative deletion; removes the asset from Cloudinary and deletes the database record with audit logging |

#### Supported Formats & Categories
- **Media Types (`MediaType`)**: `IMAGE` (JPEG, PNG, WEBP, HEIC), `VIDEO` (MP4, MOV, WEBM), `DOCUMENT_PDF` (PDF), `DIGITAL_SIGNATURE`.
- **Media Categories (`MediaCategory`)**: `KITCHEN_FOOD`, `WASHROOM_SANITATION`, `DORMITORY`, `FIRE_SAFETY`, `ATTENDANCE_REGISTER`, `SUPERINTENDENT_SIGNATURE`, `INSPECTOR_SIGNATURE`, `GENERAL`.
- **File Limits**: Single file up to 50MB per upload.

#### Cryptographic Integrity & Anti-Tamper Design
- **SHA-256 Fingerprint**: Every evidence file is hashed directly on the raw uploaded byte buffer before cloud storage and stored immutably in `Evidence.fileHash`.
- **Remote Verification**: `/api/evidence/:id/integrity` downloads the asset from the stored secure URL, re-computes its SHA-256 hash, and compares it with `Evidence.fileHash` to ensure zero file tampering or silent alteration in storage.
- **Compensating Rollback**: If database record insertion fails after uploading to Cloudinary, the uploaded Cloudinary asset is immediately cleaned up to prevent orphaned files.
- **Audit Trail**: All evidence capture, integrity checks, and administrative deletions generate immutable `AuditLog` records.

---

### 📋 Compliance & Corrective Action Management (`/api/compliance`)

End-to-end management of deficiency rectifications, corrective action plans, deadline tracking, officer verification, and reopening lifecycle for institutions monitored under MoSJE schemes.

```text
Alert / Inspection Finding
         ↓
Create Compliance Action (PENDING)
         ↓
Assign Responsible Officer / User
         ↓
Set Hard Deadline & Track Progress (IN_PROGRESS)
         ↓
Institution Submits Rectification (SUBMITTED_FOR_REVIEW)
         ↓
Government Officer Verification
    ├── [Approved]  → VERIFIED_CLOSED
    ├── [Rejected]  → IN_PROGRESS (Rework required)
    └── [Reopened]  → IN_PROGRESS (From closed state if deficiencies recur)
```

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/compliance` | All authenticated roles (scoped) | List compliance actions with filtering by `status`, `severity`, `institutionId`, `inspectionId`, `assignedToUserId`, `isOverdue`, `search`, and pagination |
| `GET` | `/api/compliance/stats` | All authenticated roles (scoped) | Summary counts (total, pending, in progress, submitted for review, verified closed, escalated, overdue) |
| `GET` | `/api/compliance/:id` | All authenticated roles (scoped) | Retrieve full details of a compliance action with institution, inspection, checklist item, assignee, creator, and derived deadline metrics |
| `POST` | `/api/compliance` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Create a new compliance action linked to an inspection and institution with deadline and severity |
| `POST` | `/api/compliance/from-alert` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Create a compliance action directly from an alert, transitioning alert status to `IN_PROGRESS` |
| `PATCH` | `/api/compliance/:id` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Update metadata (`title`, `description`, `severity`, `deadline`, `checklistItemId`) on non-closed actions |
| `POST` | `/api/compliance/:id/assign` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Assign or reassign responsible officer/user with active-status and jurisdiction validation |
| `POST` | `/api/compliance/:id/start` | All authenticated roles (scoped) | Transition status `PENDING` → `IN_PROGRESS` when work begins |
| `POST` | `/api/compliance/:id/submit` | `INSTITUTION_USER`, `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER`, `INSPECTOR` | Submit rectification explanation (`institutionResponse`) and optional proof URL (`resolutionEvidenceUrl`), transitioning to `SUBMITTED_FOR_REVIEW` |
| `POST` | `/api/compliance/:id/verify` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Government officer verification & approval, transitioning `SUBMITTED_FOR_REVIEW` → `VERIFIED_CLOSED` and setting `verifiedAt` and `verifiedById` |
| `POST` | `/api/compliance/:id/reject` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Reject unsatisfactory rectification, returning action to `IN_PROGRESS` for rework (does NOT close) |
| `POST` | `/api/compliance/:id/close` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Direct administrative close & verification |
| `POST` | `/api/compliance/:id/reopen` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Reopen a `VERIFIED_CLOSED` action back to `IN_PROGRESS` with audit logging |
| `POST` | `/api/compliance/:id/escalate` | `ADMIN`, `STATE_OFFICER`, `DISTRICT_OFFICER` | Escalate high-risk or overdue actions to `ESCALATED` |

#### Key Security & Scoping Rules
- **No Self-Verification**: Institution users and staff can NEVER approve or verify their own institution's corrective actions (HTTP 403).
- **Geographic Scoping**: State officers are strictly restricted to institutions in their assigned state; District officers to their assigned district.
- **Derived Deadline Metrics**: Real-time computation of `isOverdue`, `daysRemaining`, `daysOverdue`, and `deadlineStatus` (`OVERDUE`, `DUE_SOON`, `ON_TIME`, `COMPLETED`).
- **Audit Trails**: All mutations generate immutable `AuditLog` records (`COMPLIANCE_ACTION_CREATED`, `COMPLIANCE_ACTION_ASSIGNED`, `COMPLIANCE_ACTION_STARTED`, `COMPLIANCE_ACTION_SUBMITTED`, `COMPLIANCE_ACTION_VERIFIED`, `COMPLIANCE_ACTION_REJECTED`, `COMPLIANCE_ACTION_CLOSED`, `COMPLIANCE_ACTION_REOPENED`, `COMPLIANCE_ACTION_ESCALATED`).
- **Redis Cache Invalidation**: Automatic invalidation of `compliance:list:*`, `compliance:stats:*`, `compliance:detail:<id>`, and parent institution/inspection cache entries on any mutation.

---

## 🗺️ Planned Modules (Upcoming Sprints)

1. **Reports & Risk Intelligence (`/api/reports`, `/api/alerts`, `/api/dashboard`)**: AI-assisted anomaly flagging, compliance scoring, and automated PDF dossier generation.
2. **Real-time WebSockets (`/sockets`)**: Live inspector status tracking and instant alert dispatch.




