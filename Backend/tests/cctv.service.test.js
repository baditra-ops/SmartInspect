import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  enforceCctvAccess,
  enforceInstitutionJurisdiction,
  invalidateCctvCaches,
} from "../src/services/cctv.service.js";
import {
  createCctvDeviceSchema,
  updateCctvDeviceSchema,
  updateCctvStatusSchema,
  cctvQuerySchema,
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

describe("CCTV Device & Live Stream Management Module Tests", () => {
  const mockCctvDevice = {
    id: "cctv-1111-2222-3333-4444",
    institutionId: "inst-mh-pun-001",
    deviceName: "Main Entrance Gate Camera",
    cameraLocation: "Perimeter Gate 1",
    streamUrl: "https://stream.smartinspect.gov.in/live/pune_gate1.m3u8",
    status: "ONLINE",
    lastPingAt: new Date(),
    isAiMonitoringEnabled: true,
    institution: {
      id: "inst-mh-pun-001",
      name: "Anand Seva Old Age Home",
      state: "Maharashtra",
      district: "Pune",
    },
  };

  // =========================================================================
  // 1. RBAC & GEOGRAPHIC ACCESS CONTROL
  // =========================================================================
  describe("1. RBAC & Geographic Access Control", () => {
    it("should allow National Admin nationwide access to any CCTV device", () => {
      const admin = { id: "u-admin", role: "ADMIN" };
      assert.doesNotThrow(() => {
        enforceCctvAccess(mockCctvDevice, admin);
      });
    });

    it("should allow Maharashtra State Officer to access CCTV in Pune, Maharashtra", () => {
      const stateOfficer = { id: "u-so-mh", role: "STATE_OFFICER", state: "Maharashtra" };
      assert.doesNotThrow(() => {
        enforceCctvAccess(mockCctvDevice, stateOfficer);
      });
    });

    it("should BLOCK Gujarat State Officer from accessing Maharashtra CCTV (403)", () => {
      const gujaratOfficer = { id: "u-so-gj", role: "STATE_OFFICER", state: "Gujarat" };
      assert.throws(
        () => enforceCctvAccess(mockCctvDevice, gujaratOfficer),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned state jurisdiction/i);
          return true;
        }
      );
    });

    it("should allow Pune District Officer to access Pune CCTV device", () => {
      const puneOfficer = {
        id: "u-do-pun",
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Pune",
      };
      assert.doesNotThrow(() => {
        enforceCctvAccess(mockCctvDevice, puneOfficer);
      });
    });

    it("should BLOCK Nagpur District Officer from accessing Pune CCTV device (403)", () => {
      const nagpurOfficer = {
        id: "u-do-nag",
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Nagpur",
      };
      assert.throws(
        () => enforceCctvAccess(mockCctvDevice, nagpurOfficer),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned district jurisdiction/i);
          return true;
        }
      );
    });

    it("should allow Inspector read access within compliance/inspection scope", () => {
      const inspector = { id: "u-insp-01", role: "INSPECTOR", state: "Maharashtra", district: "Pune" };
      assert.doesNotThrow(() => {
        enforceCctvAccess(mockCctvDevice, inspector);
      });
    });
  });

  // =========================================================================
  // 2. INSTITUTION ISOLATION & STREAM SECURITY
  // =========================================================================
  describe("2. Institution Isolation & Stream Security", () => {
    it("should allow Institution User to access their OWN institution's CCTV", () => {
      const instUser = {
        id: "u-inst-01",
        role: "INSTITUTION_USER",
        institutionId: "inst-mh-pun-001",
      };
      assert.doesNotThrow(() => {
        enforceCctvAccess(mockCctvDevice, instUser);
      });
    });

    it("should BLOCK Institution User from accessing ANOTHER institution's CCTV (403)", () => {
      const instUserOther = {
        id: "u-inst-02",
        role: "INSTITUTION_USER",
        institutionId: "inst-up-var-999",
      };
      assert.throws(
        () => enforceCctvAccess(mockCctvDevice, instUserOther),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /only view CCTV devices belonging to your designated institution/i);
          return true;
        }
      );
    });

    it("should BLOCK unauthorized user without credentials (401)", () => {
      assert.throws(
        () => enforceCctvAccess(mockCctvDevice, null),
        (err) => {
          assert.equal(err.statusCode, 401);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. SCHEMA VALIDATION
  // =========================================================================
  describe("3. CCTV Schema Validation", () => {
    it("should validate valid create CCTV payload", () => {
      const payload = {
        institutionId: "123e4567-e89b-12d3-a456-426614174000",
        deviceName: "Dining Hall Camera",
        cameraLocation: "Block B First Floor",
        streamUrl: "https://streams.smartinspect.gov.in/live/dining.m3u8",
        status: "ONLINE",
        isAiMonitoringEnabled: true,
      };
      const validated = validateBody(createCctvDeviceSchema, payload);
      assert.equal(validated.deviceName, payload.deviceName);
      assert.equal(validated.status, "ONLINE");
      assert.equal(validated.isAiMonitoringEnabled, true);
    });

    it("should reject create CCTV payload missing required fields", () => {
      const payload = {
        deviceName: "Camera 1",
      };
      assert.throws(
        () => validateBody(createCctvDeviceSchema, payload),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });

    it("should validate valid update status payload", () => {
      const payload = { status: "FAULTY" };
      const validated = validateBody(updateCctvStatusSchema, payload);
      assert.equal(validated.status, "FAULTY");
    });

    it("should reject invalid status payload", () => {
      const payload = { status: "BROKEN_CAMERA" };
      assert.throws(
        () => validateBody(updateCctvStatusSchema, payload),
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 400);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 4. CACHE SCOPING & INVALIDATION
  // =========================================================================
  describe("4. Redis Cache Key Scoping & Invalidation", () => {
    it("should produce distinct cache keys for different roles and scopes", () => {
      const mhKey = buildCacheKey("cctv", "list", {
        role: "STATE_OFFICER",
        state: "Maharashtra",
      }, { page: 1, limit: 20 });

      const gjKey = buildCacheKey("cctv", "list", {
        role: "STATE_OFFICER",
        state: "Gujarat",
      }, { page: 1, limit: 20 });

      assert.notEqual(mhKey, gjKey);
      assert.match(mhKey, /maharashtra/);
      assert.match(gjKey, /gujarat/);
    });

    it("should execute invalidateCctvCaches without throwing", async () => {
      await assert.doesNotReject(async () => {
        await invalidateCctvCaches("cctv-123", "inst-123");
      });
    });
  });
});
