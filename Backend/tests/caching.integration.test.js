import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { cacheService, buildCacheKey } from "../src/services/cache.service.js";
import { enforceInstitutionAccess } from "../src/services/institution.service.js";
import { enforceInspectionAccess, invalidateInspectionCaches } from "../src/services/inspection.service.js";
import { getRedisStatus, redisClient } from "../src/config/redis.js";
import { prisma } from "../src/config/db.js";
import { ApiError } from "../src/utils/apiError.js";

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

describe("Caching & Invalidation Integration Tests", () => {
  // Test 1: RBAC is not bypassed by cached institution data
  describe("RBAC & Geographic Access Enforcement with Caching", () => {
    const mockCachedInstitution = {
      id: "inst-pune-001",
      name: "Pune Senior Care Center",
      state: "Maharashtra",
      district: "Pune",
      deletedAt: null,
    };

    it("should allow National Admin to access cached institution", () => {
      const adminUser = { id: "u-admin", role: "ADMIN" };
      assert.doesNotThrow(() => {
        enforceInstitutionAccess(mockCachedInstitution, adminUser);
      });
    });

    it("should allow Maharashtra State Officer to access cached Pune institution", () => {
      const stateOfficer = { id: "u-so-mh", role: "STATE_OFFICER", state: "Maharashtra" };
      assert.doesNotThrow(() => {
        enforceInstitutionAccess(mockCachedInstitution, stateOfficer);
      });
    });

    it("should BLOCK Gujarat State Officer from accessing cached Maharashtra institution with 403 ApiError", () => {
      const gujaratOfficer = { id: "u-so-gj", role: "STATE_OFFICER", state: "Gujarat" };
      assert.throws(
        () => {
          enforceInstitutionAccess(mockCachedInstitution, gujaratOfficer);
        },
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned state/i);
          return true;
        }
      );
    });

    it("should BLOCK Mumbai District Officer from accessing cached Pune institution with 403 ApiError", () => {
      const mumbaiOfficer = {
        id: "u-do-mum",
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Mumbai",
      };
      assert.throws(
        () => {
          enforceInstitutionAccess(mockCachedInstitution, mumbaiOfficer);
        },
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          assert.match(err.message, /outside your assigned district jurisdiction/i);
          return true;
        }
      );
    });

    it("should BLOCK unauthorized Institution User from accessing another facility's cached data", () => {
      const institutionUser = {
        id: "u-inst-other",
        role: "INSTITUTION_USER",
        institutionId: "inst-other-999",
      };
      assert.throws(
        () => {
          enforceInstitutionAccess(mockCachedInstitution, institutionUser);
        },
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  // Test 2: Inspection access control with cached objects
  describe("Inspection RBAC Access with Caching", () => {
    const mockCachedInspection = {
      id: "insp-001",
      institutionId: "inst-delhi-001",
      institution: {
        id: "inst-delhi-001",
        state: "Delhi",
        district: "North Delhi",
      },
    };

    it("should allow Delhi State Officer access to cached inspection", () => {
      const delhiOfficer = { id: "u-so-delhi", role: "STATE_OFFICER", state: "Delhi" };
      assert.doesNotThrow(() => {
        enforceInspectionAccess(mockCachedInspection, delhiOfficer);
      });
    });

    it("should BLOCK UP State Officer from accessing cached Delhi inspection", () => {
      const upOfficer = { id: "u-so-up", role: "STATE_OFFICER", state: "Uttar Pradesh" };
      assert.throws(
        () => {
          enforceInspectionAccess(mockCachedInspection, upOfficer);
        },
        (err) => {
          assert.equal(err instanceof ApiError, true);
          assert.equal(err.statusCode, 403);
          return true;
        }
      );
    });
  });

  // Test 3: Invalidation Helper Operations
  describe("Invalidation Triggers", () => {
    it("should execute invalidateInspectionCaches without throwing", async () => {
      await assert.doesNotReject(async () => {
        await invalidateInspectionCaches("test-insp-123", "test-inst-456");
      });
    });
  });

  // Test 4: Health Status Inspection
  describe("Health & Observability", () => {
    it("should provide structured Redis status without exposing sensitive URLs or credentials", () => {
      const status = getRedisStatus();

      assert.equal(typeof status.connected, "boolean");
      assert.equal(typeof status.isOpen, "boolean");
      assert.equal(typeof status.status, "string");
      assert.equal(status.url, undefined, "Redis URL must not be leaked in health status");
      assert.equal(status.password, undefined, "Redis credentials must not be leaked in health status");
    });
  });
});
