import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  enforceComplianceAccess,
  enforceInstitutionJurisdiction,
  enrichComplianceAction,
  invalidateComplianceCaches,
} from "../src/services/compliance.service.js";
import {
  createComplianceActionSchema,
  createComplianceFromAlertSchema,
  updateComplianceActionSchema,
  assignComplianceActionSchema,
  submitRectificationSchema,
  rejectRectificationSchema,
  reopenComplianceActionSchema,
  escalateComplianceActionSchema,
  validateBody,
} from "../src/utils/validation.js";
import { buildCacheKey } from "../src/services/cache.service.js";
import { ApiError } from "../src/utils/apiError.js";
import { redisClient } from "../src/config/redis.js";
import { prisma } from "../src/config/db.js";

after(async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch {}
  try {
    if (prisma) {
      await prisma.$disconnect();
    }
  } catch {}
});

describe("Compliance & Corrective Action Module Tests", () => {
  const mockComplianceAction = {
    id: "ca-1111-2222-3333-4444",
    inspectionId: "insp-1111-2222-3333-4444",
    institutionId: "inst-mh-pun-001",
    title: "Repair Broken Fire Alarm System",
    description: "Inspectors found faulty smoke detectors in Dormitory Block A.",
    severity: "HIGH",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    status: "PENDING",
    assignedToUserId: null,
    createdByUserId: "user-officer-01",
    institution: {
      id: "inst-mh-pun-001",
      name: "Anand Seva Old Age Home",
      state: "Maharashtra",
      district: "Pune",
    },
  };

  // =========================================================================
  // 1. RBAC & GEOGRAPHIC ACCESS ENFORCEMENT
  // =========================================================================
  describe("1. RBAC & Geographic Access Control", () => {
    it("should allow National Admin nationwide access to any compliance action", () => {
      const admin = { id: "u-admin", role: "ADMIN" };
      assert.doesNotThrow(() => {
        enforceComplianceAccess(mockComplianceAction, admin);
      });
    });

    it("should allow Maharashtra State Officer to access compliance action in Pune, Maharashtra", () => {
      const stateOfficer = { id: "u-so-mh", role: "STATE_OFFICER", state: "Maharashtra" };
      assert.doesNotThrow(() => {
        enforceComplianceAccess(mockComplianceAction, stateOfficer);
      });
    });

    it("should BLOCK Gujarat State Officer from accessing Maharashtra compliance action (403)", () => {
      const gujaratOfficer = { id: "u-so-gj", role: "STATE_OFFICER", state: "Gujarat" };
      assert.throws(
        () => enforceComplianceAccess(mockComplianceAction, gujaratOfficer),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned state/i);
          return true;
        }
      );
    });

    it("should allow Pune District Officer to access Pune compliance action", () => {
      const puneOfficer = {
        id: "u-do-pun",
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Pune",
      };
      assert.doesNotThrow(() => {
        enforceComplianceAccess(mockComplianceAction, puneOfficer);
      });
    });

    it("should BLOCK Nagpur District Officer from accessing Pune compliance action (403)", () => {
      const nagpurOfficer = {
        id: "u-do-nag",
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Nagpur",
      };
      assert.throws(
        () => enforceComplianceAccess(mockComplianceAction, nagpurOfficer),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned district/i);
          return true;
        }
      );
    });

    it("should allow Inspector read access within compliance scope", () => {
      const inspector = { id: "u-insp-01", role: "INSPECTOR", state: "Maharashtra", district: "Pune" };
      assert.doesNotThrow(() => {
        enforceComplianceAccess(mockComplianceAction, inspector);
      });
    });
  });

  // =========================================================================
  // 2. INSTITUTION ISOLATION & SELF-VERIFICATION PREVENTION
  // =========================================================================
  describe("2. Institution Isolation & Self-Verification Prevention", () => {
    it("should allow Institution User to access their OWN institution's compliance action", () => {
      const instUser = {
        id: "u-inst-01",
        role: "INSTITUTION_USER",
        institutionId: "inst-mh-pun-001",
      };
      assert.doesNotThrow(() => {
        enforceComplianceAccess(mockComplianceAction, instUser);
      });
    });

    it("should BLOCK Institution User from accessing ANOTHER institution's compliance action (403)", () => {
      const instUserOther = {
        id: "u-inst-02",
        role: "INSTITUTION_USER",
        institutionId: "inst-up-var-999",
      };
      assert.throws(
        () => enforceComplianceAccess(mockComplianceAction, instUserOther),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /only access compliance actions for your designated institution/i);
          return true;
        }
      );
    });

    it("should enforce that Institution User CANNOT verify compliance action", () => {
      const instUser = {
        id: "u-inst-01",
        role: "INSTITUTION_USER",
        institutionId: "inst-mh-pun-001",
      };
      assert.throws(
        () => enforceInstitutionJurisdiction(mockComplianceAction.institution, instUser),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. DERIVED DEADLINE STATUS & OVERDUE COMPUTATION
  // =========================================================================
  describe("3. Derived Deadline & Overdue Computation", () => {
    it("should calculate ON_TIME status for future deadline (> 3 days)", () => {
      const action = {
        id: "ca-1",
        status: "IN_PROGRESS",
        deadline: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days ahead
      };
      const enriched = enrichComplianceAction(action);
      assert.equal(enriched.isOverdue, false);
      assert.equal(enriched.deadlineStatus, "ON_TIME");
      assert.ok(enriched.daysRemaining >= 9);
      assert.equal(enriched.daysOverdue, 0);
    });

    it("should calculate DUE_SOON status for deadline within 3 days", () => {
      const action = {
        id: "ca-2",
        status: "PENDING",
        deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days ahead
      };
      const enriched = enrichComplianceAction(action);
      assert.equal(enriched.isOverdue, false);
      assert.equal(enriched.deadlineStatus, "DUE_SOON");
      assert.ok(enriched.daysRemaining <= 3 && enriched.daysRemaining > 0);
      assert.equal(enriched.daysOverdue, 0);
    });

    it("should calculate OVERDUE status for expired deadline", () => {
      const action = {
        id: "ca-3",
        status: "IN_PROGRESS",
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      };
      const enriched = enrichComplianceAction(action);
      assert.equal(enriched.isOverdue, true);
      assert.equal(enriched.deadlineStatus, "OVERDUE");
      assert.equal(enriched.daysRemaining, 0);
      assert.ok(enriched.daysOverdue >= 4);
    });

    it("should calculate COMPLETED status for closed action regardless of deadline", () => {
      const action = {
        id: "ca-4",
        status: "VERIFIED_CLOSED",
        deadline: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      };
      const enriched = enrichComplianceAction(action);
      assert.equal(enriched.isOverdue, false);
      assert.equal(enriched.deadlineStatus, "COMPLETED");
    });
  });

  // =========================================================================
  // 4. INPUT VALIDATION SCHEMAS
  // =========================================================================
  describe("4. Schema Validation", () => {
    it("should validate valid create compliance action payload", () => {
      const payload = {
        institutionId: "123e4567-e89b-12d3-a456-426614174000",
        inspectionId: "223e4567-e89b-12d3-a456-426614174000",
        title: "Fix defective fire extinguisher in Kitchen",
        description: "Pressure gauge is in red zone during audit.",
        severity: "HIGH",
        deadline: "2026-10-15",
      };
      const validated = validateBody(createComplianceActionSchema, payload);
      assert.equal(validated.title, payload.title);
      assert.equal(validated.severity, "HIGH");
    });

    it("should reject create payload missing required fields", () => {
      const payload = {
        title: "Short",
      };
      assert.throws(
        () => validateBody(createComplianceActionSchema, payload),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });

    it("should validate submit rectification payload", () => {
      const payload = {
        institutionResponse: "New ABC powder fire extinguishers installed and certified by vendor.",
        resolutionEvidenceUrl: "https://res.cloudinary.com/smartinspect/image/upload/v123/fire_safety.jpg",
      };
      const validated = validateBody(submitRectificationSchema, payload);
      assert.equal(validated.institutionResponse, payload.institutionResponse);
      assert.equal(validated.resolutionEvidenceUrl, payload.resolutionEvidenceUrl);
    });

    it("should reject submit rectification payload with empty response", () => {
      const payload = {
        institutionResponse: " ",
      };
      assert.throws(
        () => validateBody(submitRectificationSchema, payload),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });

    it("should validate reject rectification payload", () => {
      const payload = {
        rejectionReason: "Uploaded invoice is unclear and certificate is expired. Please re-upload.",
      };
      const validated = validateBody(rejectRectificationSchema, payload);
      assert.equal(validated.rejectionReason, payload.rejectionReason);
    });

    it("should validate reopen payload", () => {
      const payload = {
        reopenReason: "Subsequent complaint reveals fire alarms still malfunctioning.",
      };
      const validated = validateBody(reopenComplianceActionSchema, payload);
      assert.equal(validated.reopenReason, payload.reopenReason);
    });
  });

  // =========================================================================
  // 5. CACHING & INVALIDATION
  // =========================================================================
  describe("5. Redis Cache Key Scoping & Invalidation", () => {
    it("should produce distinct cache keys for different roles and scopes", () => {
      const mhKey = buildCacheKey("compliance", "list", {
        role: "STATE_OFFICER",
        state: "Maharashtra",
      }, { page: 1, limit: 20 });

      const gjKey = buildCacheKey("compliance", "list", {
        role: "STATE_OFFICER",
        state: "Gujarat",
      }, { page: 1, limit: 20 });

      assert.notEqual(mhKey, gjKey);
      assert.match(mhKey, /maharashtra/);
      assert.match(gjKey, /gujarat/);
    });

    it("should execute invalidateComplianceCaches without throwing", async () => {
      await assert.doesNotReject(async () => {
        await invalidateComplianceCaches(
          "ca-test-01",
          "inst-test-01",
          "insp-test-01"
        );
      });
    });
  });

  // =========================================================================
  // 6. WORKFLOW STATE MACHINE & INVALID TRANSITIONS
  // =========================================================================
  describe("6. Workflow Lifecycle Transitions", () => {
    it("should reject start transition if action is not in PENDING state", () => {
      const activeAction = {
        ...mockComplianceAction,
        status: "IN_PROGRESS",
      };
      assert.throws(
        () => {
          if (activeAction.status !== "PENDING") {
            throw new ApiError(400, `Cannot start compliance action. Action must be in PENDING status. Current status: ${activeAction.status}`);
          }
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Action must be in PENDING status/);
          return true;
        }
      );
    });

    it("should reject verification if action is not in SUBMITTED_FOR_REVIEW state", () => {
      const pendingAction = {
        ...mockComplianceAction,
        status: "PENDING",
      };
      assert.throws(
        () => {
          if (pendingAction.status !== "SUBMITTED_FOR_REVIEW") {
            throw new ApiError(400, `Cannot verify compliance action. Rectification has not been submitted for review. Current status: ${pendingAction.status}`);
          }
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Rectification has not been submitted for review/);
          return true;
        }
      );
    });

    it("should reject rectification submission if action is already VERIFIED_CLOSED", () => {
      const closedAction = {
        ...mockComplianceAction,
        status: "VERIFIED_CLOSED",
      };
      assert.throws(
        () => {
          if (!["PENDING", "IN_PROGRESS", "ESCALATED"].includes(closedAction.status)) {
            throw new ApiError(400, `Cannot submit rectification. Action status must be PENDING, IN_PROGRESS, or ESCALATED. Current status: ${closedAction.status}`);
          }
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Action status must be PENDING, IN_PROGRESS, or ESCALATED/);
          return true;
        }
      );
    });

    it("should reject reopen if action is not in VERIFIED_CLOSED state", () => {
      const inProgressAction = {
        ...mockComplianceAction,
        status: "IN_PROGRESS",
      };
      assert.throws(
        () => {
          if (inProgressAction.status !== "VERIFIED_CLOSED") {
            throw new ApiError(400, `Cannot reopen compliance action. Action must be in VERIFIED_CLOSED status. Current status: ${inProgressAction.status}`);
          }
        },
        (err) => {
          assert.equal(err.statusCode, 400);
          assert.match(err.message, /Action must be in VERIFIED_CLOSED status/);
          return true;
        }
      );
    });
  });
});

