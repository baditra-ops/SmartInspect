import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  mapAiRiskToPrisma,
  enforceInstitutionAccess,
  aiService,
} from "../src/services/ai.service.js";
import {
  calculateRiskSchema,
  analyzeAttendanceSchema,
  riskHistoryQuerySchema,
  validateBody,
  validateQuery,
} from "../src/utils/validation.js";
import { WS_EVENTS } from "../src/sockets/events.js";
import { sanitizePayload, buildEventEnvelope } from "../src/sockets/publisher.js";
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

describe("AI & Machine Learning Module Tests (SIH26-26095 / MoSJE)", () => {
  // Test Mock Users with different roles and geographic scopes
  const adminUser = {
    id: "99999999-9999-9999-9999-999999999999",
    fullName: "National Administrator",
    role: "ADMIN",
    state: null,
    district: null,
    institutionId: null,
  };

  const maharashtraStateOfficer = {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "Maharashtra State Officer",
    role: "STATE_OFFICER",
    state: "Maharashtra",
    district: null,
    institutionId: null,
  };

  const gujaratStateOfficer = {
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "Gujarat State Officer",
    role: "STATE_OFFICER",
    state: "Gujarat",
    district: null,
    institutionId: null,
  };

  const puneDistrictOfficer = {
    id: "33333333-3333-3333-3333-333333333333",
    fullName: "Pune District Officer",
    role: "DISTRICT_OFFICER",
    state: "Maharashtra",
    district: "Pune",
    institutionId: null,
  };

  const nagpurDistrictOfficer = {
    id: "44444444-4444-4444-4444-444444444444",
    fullName: "Nagpur District Officer",
    role: "DISTRICT_OFFICER",
    state: "Maharashtra",
    district: "Nagpur",
    institutionId: null,
  };

  const inspectorUser = {
    id: "55555555-5555-5555-5555-555555555555",
    fullName: "Field Inspector",
    role: "INSPECTOR",
    state: "Maharashtra",
    district: "Pune",
    institutionId: null,
  };

  const puneInstUser = {
    id: "66666666-6666-6666-6666-666666666666",
    fullName: "Pune Shelter Superintendent",
    role: "INSTITUTION_USER",
    state: "Maharashtra",
    district: "Pune",
    institutionId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  };

  const mumbaiInstUser = {
    id: "77777777-7777-7777-7777-777777777777",
    fullName: "Mumbai Shelter Superintendent",
    role: "INSTITUTION_USER",
    state: "Maharashtra",
    district: "Mumbai",
    institutionId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  };

  const puneInstitution = {
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    code: "INST-MH-PUN-001",
    name: "Pune Senior Care Home",
    state: "Maharashtra",
    district: "Pune",
  };

  describe("1. AI Risk Score Mapping & Clamping", () => {
    it("should map score >= 70 or CRITICAL_HIGH to CRITICAL", () => {
      const result1 = mapAiRiskToPrisma(78.5, "CRITICAL_HIGH");
      assert.strictEqual(result1.level, "CRITICAL");
      assert.strictEqual(result1.score, 78.5);

      const result2 = mapAiRiskToPrisma(70.0, "MODERATE");
      assert.strictEqual(result2.level, "CRITICAL");
    });

    it("should map score 50.0 - 69.9 to HIGH", () => {
      const result = mapAiRiskToPrisma(55.2, "MODERATE");
      assert.strictEqual(result.level, "HIGH");
      assert.strictEqual(result.score, 55.2);
    });

    it("should map score 25.0 - 49.9 or MODERATE to MEDIUM", () => {
      const result = mapAiRiskToPrisma(35.0, "MODERATE");
      assert.strictEqual(result.level, "MEDIUM");
      assert.strictEqual(result.score, 35.0);
    });

    it("should map score < 25.0 to LOW", () => {
      const result = mapAiRiskToPrisma(12.4, "COMPLIANT_LOW");
      assert.strictEqual(result.level, "LOW");
      assert.strictEqual(result.score, 12.4);
    });

    it("should strictly clamp out-of-bounds scores between 0 and 100", () => {
      const highCapped = mapAiRiskToPrisma(150.0, "CRITICAL_HIGH");
      assert.strictEqual(highCapped.score, 100);

      const lowCapped = mapAiRiskToPrisma(-20.0, "COMPLIANT_LOW");
      assert.strictEqual(lowCapped.score, 0);
    });
  });

  describe("2. RBAC & Geographic Access Control", () => {
    it("should allow National Admin nationwide access to any institution", () => {
      assert.doesNotThrow(() => enforceInstitutionAccess(adminUser, puneInstitution));
    });

    it("should allow Maharashtra State Officer to access institution in Pune, Maharashtra", () => {
      assert.doesNotThrow(() => enforceInstitutionAccess(maharashtraStateOfficer, puneInstitution));
    });

    it("should BLOCK Gujarat State Officer from accessing Maharashtra institution (403)", () => {
      assert.throws(
        () => enforceInstitutionAccess(gujaratStateOfficer, puneInstitution),
        (err) => err instanceof ApiError && err.statusCode === 403
      );
    });

    it("should allow Pune District Officer to access Pune institution", () => {
      assert.doesNotThrow(() => enforceInstitutionAccess(puneDistrictOfficer, puneInstitution));
    });

    it("should BLOCK Nagpur District Officer from accessing Pune institution (403)", () => {
      assert.throws(
        () => enforceInstitutionAccess(nagpurDistrictOfficer, puneInstitution),
        (err) => err instanceof ApiError && err.statusCode === 403
      );
    });

    it("should allow Inspector read access within inspection scope", () => {
      assert.doesNotThrow(() => enforceInstitutionAccess(inspectorUser, puneInstitution));
    });

    it("should allow Institution User access to their OWN institution", () => {
      assert.doesNotThrow(() => enforceInstitutionAccess(puneInstUser, puneInstitution));
    });

    it("should BLOCK Institution User from accessing ANOTHER institution (403)", () => {
      assert.throws(
        () => enforceInstitutionAccess(mumbaiInstUser, puneInstitution),
        (err) => err instanceof ApiError && err.statusCode === 403
      );
    });

    it("should BLOCK unauthenticated access (401)", () => {
      assert.throws(
        () => enforceInstitutionAccess(null, puneInstitution),
        (err) => err instanceof ApiError && err.statusCode === 401
      );
    });
  });

  describe("3. Schema Validation", () => {
    it("should validate valid risk calculation payload", () => {
      const payload = {
        institutionId: "123e4567-e89b-12d3-a456-426614174000",
        historicalDiscrepancyPct: 20.5,
        daysSinceLastAudit: 45,
        cctvDowntimePct: 15.0,
        openComplaints: 2,
        unusualEnrollmentSpikePct: 10.0,
      };
      const parsed = validateBody(calculateRiskSchema, payload);
      assert.strictEqual(parsed.institutionId, payload.institutionId);
      assert.strictEqual(parsed.historicalDiscrepancyPct, 20.5);
    });

    it("should reject risk calculation payload with invalid UUID", () => {
      const invalid = { institutionId: "not-a-uuid" };
      assert.throws(
        () => validateBody(calculateRiskSchema, invalid),
        (err) => err instanceof ApiError && err.statusCode === 400
      );
    });

    it("should reject risk calculation payload with out-of-range percentage", () => {
      const invalid = {
        institutionId: "123e4567-e89b-12d3-a456-426614174000",
        cctvDowntimePct: 125.0,
      };
      assert.throws(
        () => validateBody(calculateRiskSchema, invalid),
        (err) => err instanceof ApiError && err.statusCode === 400
      );
    });

    it("should validate valid attendance analysis payload", () => {
      const payload = {
        evidenceId: "223e4567-e89b-12d3-a456-426614174000",
        claimedAttendance: 45,
        sampleIntervalSec: 2,
      };
      const parsed = validateBody(analyzeAttendanceSchema, payload);
      assert.strictEqual(parsed.evidenceId, payload.evidenceId);
      assert.strictEqual(parsed.claimedAttendance, 45);
      assert.strictEqual(parsed.sampleIntervalSec, 2);
    });

    it("should validate risk history query parameters", () => {
      const query = {
        page: "2",
        limit: "15",
        riskLevel: "CRITICAL",
      };
      const parsed = validateQuery(riskHistoryQuerySchema, query);
      assert.strictEqual(parsed.page, 2);
      assert.strictEqual(parsed.limit, 15);
      assert.strictEqual(parsed.riskLevel, "CRITICAL");
    });
  });

  describe("4. Observability & Graceful AI Microservice Offline Handling", () => {
    it("should report OFFLINE status gracefully without crashing if AI microservice is not responding", async () => {
      const health = await aiService.getAiHealthStatus();
      assert.ok(health.status === "ONLINE" || health.status === "OFFLINE");
      assert.ok(health.microserviceUrl);
    });
  });

  describe("5. Security & Payload Sanitization", () => {
    it("should sanitize passwords, hashes, and internal tokens from event envelopes", () => {
      const raw = {
        id: "risk-001",
        riskScore: 82.5,
        password: "super_secret_password",
        passwordHash: "$2b$10$abcdefgh...",
        jwtSecret: "some_secret_key",
        institution: {
          id: "inst-001",
          name: "Test Center",
          token: "bearer_xyz",
        },
      };

      const sanitized = sanitizePayload(raw);
      assert.strictEqual(sanitized.id, "risk-001");
      assert.strictEqual(sanitized.riskScore, 82.5);
      assert.strictEqual(sanitized.password, undefined);
      assert.strictEqual(sanitized.passwordHash, undefined);
      assert.strictEqual(sanitized.jwtSecret, undefined);
      assert.strictEqual(sanitized.institution.token, undefined);
      assert.strictEqual(sanitized.institution.name, "Test Center");
    });

    it("should construct valid event envelopes with standard metadata", () => {
      const envelope = buildEventEnvelope(WS_EVENTS.AI_RISK_ASSESSED, {
        institutionId: "inst-001",
        riskScore: 75.0,
      });

      assert.strictEqual(envelope.event, WS_EVENTS.AI_RISK_ASSESSED);
      assert.ok(envelope.timestamp);
      assert.strictEqual(envelope.data.institutionId, "inst-001");
      assert.strictEqual(envelope.data.riskScore, 75.0);
    });
  });
});
