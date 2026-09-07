import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import {
  generateAlgorithmSeed,
  selectCandidateBySeed,
} from "../src/services/jit.service.js";
import {
  jitDispatchSchema,
  batchJitDispatchSchema,
  triggerSurpriseInspectionSchema,
  validateBody,
} from "../src/utils/validation.js";
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

describe("Just-In-Time (JIT) & Anti-Collusion Dispatch Engine Tests", () => {
  // Test Mock Candidates in Pune District
  const candidate1 = {
    id: "11111111-1111-1111-1111-111111111111",
    fullName: "Inspector Ramesh Patil",
    role: "INSPECTOR",
    district: "Pune",
    state: "Maharashtra",
    inspectorProfile: { totalInspectionsConducted: 12, status: "AVAILABLE" },
    assignedInspections: [{ id: "insp-001" }],
  };

  const candidate2 = {
    id: "22222222-2222-2222-2222-222222222222",
    fullName: "Inspector Priya Deshmukh",
    role: "INSPECTOR",
    district: "Pune",
    state: "Maharashtra",
    inspectorProfile: { totalInspectionsConducted: 8, status: "AVAILABLE" },
    assignedInspections: [{ id: "insp-002" }],
  };

  const candidate3 = {
    id: "33333333-3333-3333-3333-333333333333",
    fullName: "Inspector Amit Shinde",
    role: "INSPECTOR",
    district: "Pune",
    state: "Maharashtra",
    inspectorProfile: { totalInspectionsConducted: 20, status: "AVAILABLE" },
    assignedInspections: [{ id: "insp-003" }, { id: "insp-004" }, { id: "insp-005" }], // higher workload
  };

  describe("1. Cryptographic Algorithm Seed Generation", () => {
    it("should generate a 32-character hexadecimal seed", () => {
      const seed = generateAlgorithmSeed(
        "123e4567-e89b-12d3-a456-426614174000",
        "223e4567-e89b-12d3-a456-426614174000",
        new Date("2026-10-15")
      );
      assert.strictEqual(typeof seed, "string");
      assert.strictEqual(seed.length, 32);
      assert.match(seed, /^[0-9a-f]{32}$/);
    });

    it("should generate distinct seeds for different timestamps or salt nonces", () => {
      const seed1 = generateAlgorithmSeed("insp-1", "inst-1", new Date());
      const seed2 = generateAlgorithmSeed("insp-1", "inst-1", new Date());
      assert.notStrictEqual(seed1, seed2);
    });
  });

  describe("2. Deterministic Candidate Selection with Workload Balancing", () => {
    it("should prioritize candidates with lowest active workload", () => {
      const candidates = [candidate1, candidate2, candidate3];
      // candidate1 and candidate2 have 1 active inspection; candidate3 has 3
      const seed = "0000000a12345678abcdef0123456789";
      const selected = selectCandidateBySeed(candidates, seed);

      // Must be either candidate1 or candidate2, not overloaded candidate3
      assert.ok(selected.id === candidate1.id || selected.id === candidate2.id);
      assert.notStrictEqual(selected.id, candidate3.id);
    });

    it("should return single candidate when pool has 1 inspector", () => {
      const selected = selectCandidateBySeed([candidate1], "1234567890abcdef1234567890abcdef");
      assert.strictEqual(selected.id, candidate1.id);
    });

    it("should return null for empty candidate pool", () => {
      const selected = selectCandidateBySeed([], "1234567890abcdef1234567890abcdef");
      assert.strictEqual(selected, null);
    });
  });

  describe("3. JIT Dispatch Schema Validation", () => {
    it("should validate valid single JIT dispatch payload with defaults", () => {
      const payload = {};
      const parsed = validateBody(jitDispatchSchema, payload);
      assert.strictEqual(parsed.antiCollusionCooldownDays, 90);
      assert.strictEqual(parsed.allowFallbackToStatePool, false);
    });

    it("should validate single JIT dispatch with custom cooldown and seed override", () => {
      const payload = {
        antiCollusionCooldownDays: 60,
        allowFallbackToStatePool: true,
        algorithmSeedOverride: "custom_audit_seed_001",
      };
      const parsed = validateBody(jitDispatchSchema, payload);
      assert.strictEqual(parsed.antiCollusionCooldownDays, 60);
      assert.strictEqual(parsed.allowFallbackToStatePool, true);
      assert.strictEqual(parsed.algorithmSeedOverride, "custom_audit_seed_001");
    });

    it("should validate valid batch JIT dispatch payload", () => {
      const payload = {
        targetDate: "2026-10-15",
        state: "Maharashtra",
        district: "Pune",
        antiCollusionCooldownDays: 120,
      };
      const parsed = validateBody(batchJitDispatchSchema, payload);
      assert.strictEqual(parsed.targetDate, "2026-10-15");
      assert.strictEqual(parsed.district, "Pune");
      assert.strictEqual(parsed.antiCollusionCooldownDays, 120);
    });

    it("should reject batch JIT dispatch with invalid date format", () => {
      const invalid = { targetDate: "15/10/2026" };
      assert.throws(
        () => validateBody(batchJitDispatchSchema, invalid),
        (err) => err instanceof ApiError && err.statusCode === 400
      );
    });

    it("should validate trigger surprise inspection payload", () => {
      const payload = {
        institutionId: "123e4567-e89b-12d3-a456-426614174000",
        remarks: "Critical risk anomaly detected from attendance feed",
      };
      const parsed = validateBody(triggerSurpriseInspectionSchema, payload);
      assert.strictEqual(parsed.institutionId, payload.institutionId);
      assert.strictEqual(parsed.remarks, payload.remarks);
      assert.strictEqual(parsed.antiCollusionCooldownDays, 90);
    });

    it("should reject trigger surprise inspection with invalid UUID", () => {
      const invalid = { institutionId: "not-a-valid-uuid" };
      assert.throws(
        () => validateBody(triggerSurpriseInspectionSchema, invalid),
        (err) => err instanceof ApiError && err.statusCode === 400
      );
    });
  });
});
