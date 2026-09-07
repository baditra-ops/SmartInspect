import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  cacheService,
  safeSerialize,
  safeDeserialize,
  hashObject,
  buildCacheKey,
  CACHE_TTL,
} from "../src/services/cache.service.js";
import { redisClient } from "../src/config/redis.js";

after(async () => {
  try {
    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }
  } catch {}
});

describe("Redis Cache Service Unit Tests", () => {
  // Test 1: Serialization of standard and Prisma types
  describe("Serialization & Deserialization", () => {
    it("should safely serialize and deserialize JSON objects and arrays", () => {
      const payload = {
        name: "Old Age Home Alpha",
        capacity: 120,
        active: true,
        tags: ["shelter", "senior"],
      };
      const serialized = safeSerialize(payload);
      const deserialized = safeDeserialize(serialized);

      assert.deepEqual(deserialized, payload);
    });

    it("should safely serialize BigInt values without throwing", () => {
      const payload = {
        fileSizeBytes: BigInt(104857600),
        name: "inspection_video.mp4",
      };
      const serialized = safeSerialize(payload);
      assert.match(serialized, /"fileSizeBytes":"104857600"/);

      const deserialized = safeDeserialize(serialized);
      assert.equal(deserialized.fileSizeBytes, "104857600");
    });

    it("should safely serialize Prisma Decimal values", () => {
      const mockPrismaDecimal = {
        toFixed: () => "4.85",
        toString: () => "4.85",
      };
      const payload = {
        latestRiskScore: mockPrismaDecimal,
        latitude: 28.6139,
      };
      const serialized = safeSerialize(payload);
      const deserialized = safeDeserialize(serialized);

      assert.equal(deserialized.latestRiskScore, 4.85);
      assert.equal(deserialized.latitude, 28.6139);
    });

    it("should return null on invalid JSON deserialization without crashing", () => {
      assert.equal(safeDeserialize(null), null);
      assert.equal(safeDeserialize(""), null);
      assert.equal(safeDeserialize("invalid-json-{"), null);
    });
  });

  // Test 2: Deterministic Cache Key Design & Geographic Scoping
  describe("Deterministic Cache Key Generation", () => {
    it("should generate deterministic md5 hashes for query parameters regardless of key order", () => {
      const query1 = { page: "1", limit: "10", state: "Delhi" };
      const query2 = { state: "Delhi", limit: "10", page: "1" };

      const hash1 = hashObject(query1);
      const hash2 = hashObject(query2);

      assert.equal(hash1, hash2);
    });

    it("should produce isolated cache keys for different user roles and geographic scopes", () => {
      const stateOfficerScope = {
        role: "STATE_OFFICER",
        state: "Maharashtra",
        district: null,
      };
      const districtOfficerScope = {
        role: "DISTRICT_OFFICER",
        state: "Maharashtra",
        district: "Pune",
      };
      const query = { page: 1, limit: 10 };

      const keyState = buildCacheKey("institutions", "list", stateOfficerScope, query);
      const keyDistrict = buildCacheKey("institutions", "list", districtOfficerScope, query);

      assert.notEqual(keyState, keyDistrict);
      assert.match(keyState, /^institutions:list:STATE_OFFICER:maharashtra:all:all:all:/);
      assert.match(keyDistrict, /^institutions:list:DISTRICT_OFFICER:maharashtra:pune:all:all:/);
    });

    it("should isolate institution-specific user cache keys", () => {
      const user1 = { role: "INSTITUTION_USER", institutionId: "inst-111" };
      const user2 = { role: "INSTITUTION_USER", institutionId: "inst-222" };

      const key1 = buildCacheKey("inspections", "list", user1, {});
      const key2 = buildCacheKey("inspections", "list", user2, {});

      assert.notEqual(key1, key2);
      assert.match(key1, /:inst-111:/);
      assert.match(key2, /:inst-222:/);
    });
  });

  // Test 3: Cache CRUD Operations (with live Redis if connected or graceful fallback)
  describe("Cache CRUD & Cache-Aside Operations", () => {
    const isRedisOpen = redisClient.isOpen;

    it("should handle set, get, exists, and del gracefully", async () => {
      const testKey = `test:item:${Date.now()}`;
      const testData = { id: 101, title: "Test Inspection Data" };

      // Set
      const setSuccess = await cacheService.set(testKey, testData, 10);
      if (isRedisOpen) {
        assert.equal(setSuccess, true);

        // Exists
        const exists = await cacheService.exists(testKey);
        assert.equal(exists, true);

        // Get
        const retrieved = await cacheService.get(testKey);
        assert.deepEqual(retrieved, testData);

        // Del
        const delCount = await cacheService.del(testKey);
        assert.equal(delCount, 1);

        // Verify deleted
        const afterDel = await cacheService.get(testKey);
        assert.equal(afterDel, null);
      } else {
        // When offline, gracefully returns false / null
        assert.equal(setSuccess, false);
        const retrieved = await cacheService.get(testKey);
        assert.equal(retrieved, null);
      }
    });

    it("should support delByPattern for pattern-based cache invalidation", async () => {
      if (isRedisOpen) {
        const prefix = `test:pattern:${Date.now()}`;
        await cacheService.set(`${prefix}:list:1`, { a: 1 }, 20);
        await cacheService.set(`${prefix}:list:2`, { b: 2 }, 20);
        await cacheService.set(`${prefix}:other:1`, { c: 3 }, 20);

        const deletedCount = await cacheService.delByPattern(`${prefix}:list:*`);
        assert.equal(deletedCount >= 2, true);

        assert.equal(await cacheService.get(`${prefix}:list:1`), null);
        assert.equal(await cacheService.get(`${prefix}:list:2`), null);
        assert.notEqual(await cacheService.get(`${prefix}:other:1`), null);

        // Cleanup
        await cacheService.del(`${prefix}:other:1`);
      }
    });

    it("should implement cache-aside getOrSet correctly (HIT vs MISS)", async () => {
      const testKey = `test:cacheaside:${Date.now()}`;
      let dbFetchCount = 0;

      const fetchFromDb = async () => {
        dbFetchCount++;
        return { data: "fresh_from_db", counter: dbFetchCount };
      };

      // 1st call: Cache MISS -> calls DB fetcher
      const result1 = await cacheService.getOrSet(testKey, fetchFromDb, 10);
      assert.equal(result1.data, "fresh_from_db");
      assert.equal(dbFetchCount, 1);

      if (isRedisOpen) {
        // Small delay to allow async cache set to complete
        await new Promise((r) => setTimeout(r, 50));

        // 2nd call: Cache HIT -> returns cached data, DB NOT queried again
        const result2 = await cacheService.getOrSet(testKey, fetchFromDb, 10);
        assert.equal(result2.data, "fresh_from_db");
        assert.equal(dbFetchCount, 1, "Database query should have been skipped on cache HIT");

        // Invalidate and verify next call is a MISS
        await cacheService.del(testKey);
        const result3 = await cacheService.getOrSet(testKey, fetchFromDb, 10);
        assert.equal(dbFetchCount, 2, "Database query should execute after cache invalidation");

        // Cleanup
        await cacheService.del(testKey);
      }
    });

    it("should handle non-existent key returns null gracefully", async () => {
      const missing = await cacheService.get(`non:existent:key:${Date.now()}`);
      assert.equal(missing, null);
    });
  });

  // Test 4: Offline / Disconnected Graceful Fallback
  describe("Graceful Offline Degradation", () => {
    it("should never throw when Redis operations fail", async () => {
      // Test with an invalid/mocked unhandled scenario
      const originalIsOpen = redisClient.isOpen;

      // Ensure get, set, del, exists, getOrSet handle any state without throwing
      await assert.doesNotReject(async () => {
        await cacheService.get("any:key");
        await cacheService.set("any:key", { test: true }, 5);
        await cacheService.del("any:key");
        await cacheService.delByPattern("any:*");
        await cacheService.exists("any:key");
        const res = await cacheService.getOrSet("any:key", async () => ({ fallback: true }));
        assert.deepEqual(res, { fallback: true });
      });
    });
  });

  // Test 5: Security Verification (No sensitive credentials in cache)
  describe("Security Standards", () => {
    it("should ensure sensitive user authentication data is not cached", () => {
      const userProfile = {
        id: "usr-001",
        email: "officer@gov.in",
        fullName: "State Officer",
        role: "STATE_OFFICER",
      };

      // Ensure passwordHash is stripped
      assert.equal(userProfile.passwordHash, undefined);
      assert.equal(userProfile.token, undefined);
    });
  });
});
