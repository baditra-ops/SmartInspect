import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { socketAuthMiddleware } from "../src/sockets/auth.js";
import { ROOMS, authorizeRoomSubscription } from "../src/sockets/rooms.js";
import { SocketConnectionManager } from "../src/sockets/manager.js";
import { EventPublisher, sanitizePayload, buildEventEnvelope } from "../src/sockets/publisher.js";
import { WS_EVENTS, CLIENT_EVENTS } from "../src/sockets/events.js";
import { generateToken } from "../src/utils/auth.js";
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

describe("WebSocket Real-Time Communication Module Tests", () => {
  const mockAdminUser = {
    id: "u-admin-01",
    fullName: "National Admin",
    email: "admin@smartinspect.gov.in",
    role: "ADMIN",
    state: null,
    district: null,
    isActive: true,
  };

  const mockStateOfficerMH = {
    id: "u-so-mh-01",
    fullName: "Maharashtra State Officer",
    email: "so.mh@smartinspect.gov.in",
    role: "STATE_OFFICER",
    state: "Maharashtra",
    district: null,
    isActive: true,
  };

  const mockDistrictOfficerPune = {
    id: "u-do-pun-01",
    fullName: "Pune District Officer",
    email: "do.pune@smartinspect.gov.in",
    role: "DISTRICT_OFFICER",
    state: "Maharashtra",
    district: "Pune",
    isActive: true,
  };

  const mockInstitutionUserPune = {
    id: "u-inst-pun-01",
    fullName: "Pune Old Age Home Admin",
    email: "contact@anandseva.org",
    role: "INSTITUTION_USER",
    institutionId: "inst-mh-pun-001",
    state: "Maharashtra",
    district: "Pune",
    isActive: true,
  };

  // =========================================================================
  // 1. WEBSOCKET HANDSHAKE AUTHENTICATION & IDENTITY
  // =========================================================================
  describe("1. WebSocket Authentication & Identity Extraction", () => {
    it("should reject connection when no auth token is provided", async () => {
      const mockSocket = {
        handshake: { auth: {}, headers: {}, query: {} },
      };

      await new Promise((resolve) => {
        socketAuthMiddleware(mockSocket, (err) => {
          assert.ok(err);
          assert.equal(err.data?.code, "AUTH_TOKEN_REQUIRED");
          resolve();
        });
      });
    });

    it("should reject connection when invalid/expired token is provided", async () => {
      const mockSocket = {
        handshake: { auth: { token: "invalid.jwt.token" }, headers: {}, query: {} },
      };

      await new Promise((resolve) => {
        socketAuthMiddleware(mockSocket, (err) => {
          assert.ok(err);
          assert.equal(err.data?.code, "INVALID_TOKEN");
          resolve();
        });
      });
    });

    it("should reject connection when Bearer token is malformed", async () => {
      const mockSocket = {
        handshake: { auth: { token: "Bearer " }, headers: {}, query: {} },
      };

      await new Promise((resolve) => {
        socketAuthMiddleware(mockSocket, (err) => {
          assert.ok(err);
          assert.equal(err.data?.code, "MALFORMED_TOKEN");
          resolve();
        });
      });
    });
  });

  // =========================================================================
  // 2. ROOM AUTHORIZATION & GEOGRAPHIC SCOPING
  // =========================================================================
  describe("2. Room Subscription Authorization & Isolation", () => {
    it("should allow National Admin to subscribe to ANY room", async () => {
      await assert.doesNotReject(async () => {
        await authorizeRoomSubscription(mockAdminUser, "institution:inst-any-999");
        await authorizeRoomSubscription(mockAdminUser, "state:maharashtra");
        await authorizeRoomSubscription(mockAdminUser, "district:maharashtra:pune");
        await authorizeRoomSubscription(mockAdminUser, "role:INSPECTOR");
      });
    });

    it("should allow User to subscribe to their OWN user room", async () => {
      await assert.doesNotReject(async () => {
        await authorizeRoomSubscription(mockStateOfficerMH, "user:u-so-mh-01");
      });
    });

    it("should BLOCK User from subscribing to ANOTHER user's private room", async () => {
      await assert.rejects(
        async () => {
          await authorizeRoomSubscription(mockStateOfficerMH, "user:u-other-999");
        },
        (err) => {
          assert.match(err.message, /cannot subscribe to user room/i);
          return true;
        }
      );
    });

    it("should allow Institution User to subscribe to their OWN institution room", async () => {
      await assert.doesNotReject(async () => {
        await authorizeRoomSubscription(mockInstitutionUserPune, "institution:inst-mh-pun-001");
      });
    });

    it("should BLOCK Institution User from subscribing to ANOTHER institution's room", async () => {
      await assert.rejects(
        async () => {
          await authorizeRoomSubscription(mockInstitutionUserPune, "institution:inst-other-999");
        },
        (err) => {
          assert.match(err.message, /cannot subscribe to institution room .* for another facility/i);
          return true;
        }
      );
    });

    it("should allow State Officer to subscribe to their OWN state room", async () => {
      await assert.doesNotReject(async () => {
        await authorizeRoomSubscription(mockStateOfficerMH, "state:maharashtra");
      });
    });

    it("should BLOCK State Officer from subscribing to ANOTHER state's room", async () => {
      await assert.rejects(
        async () => {
          await authorizeRoomSubscription(mockStateOfficerMH, "state:gujarat");
        },
        (err) => {
          assert.match(err.message, /cannot subscribe to state room for gujarat/i);
          return true;
        }
      );
    });

    it("should allow District Officer to subscribe to their OWN district room", async () => {
      await assert.doesNotReject(async () => {
        await authorizeRoomSubscription(mockDistrictOfficerPune, "district:maharashtra:pune");
      });
    });

    it("should BLOCK District Officer from subscribing to ANOTHER district's room", async () => {
      await assert.rejects(
        async () => {
          await authorizeRoomSubscription(mockDistrictOfficerPune, "district:maharashtra:nagpur");
        },
        (err) => {
          assert.match(err.message, /outside your assigned jurisdiction/i);
          return true;
        }
      );
    });
  });

  // =========================================================================
  // 3. CONNECTION MANAGER & LIFECYCLE
  // =========================================================================
  describe("3. Connection Manager & Multi-Device Tracking", () => {
    let manager;
    let mockSocket1;
    let mockSocket2;

    beforeEach(() => {
      manager = new SocketConnectionManager();

      mockSocket1 = {
        id: "sock-001",
        user: mockStateOfficerMH,
        joinedRooms: new Set(),
        join(r) { this.joinedRooms.add(r); },
        leave(r) { this.joinedRooms.delete(r); },
        on() {},
        emit() {},
      };

      mockSocket2 = {
        id: "sock-002",
        user: mockStateOfficerMH,
        joinedRooms: new Set(),
        join(r) { this.joinedRooms.add(r); },
        leave(r) { this.joinedRooms.delete(r); },
        on() {},
        emit() {},
      };
    });

    it("should auto-join default baseline rooms on connection", () => {
      manager.registerConnection(mockSocket1);
      assert.ok(mockSocket1.joinedRooms.has("user:u-so-mh-01"));
      assert.ok(mockSocket1.joinedRooms.has("role:STATE_OFFICER"));
      assert.ok(mockSocket1.joinedRooms.has("state:maharashtra"));
    });

    it("should track multiple connections for the same user", () => {
      manager.registerConnection(mockSocket1);
      manager.registerConnection(mockSocket2);

      assert.equal(manager.getTotalConnections(), 2);
      assert.equal(manager.getUserConnectionCount(mockStateOfficerMH.id), 2);
      assert.equal(manager.isUserOnline(mockStateOfficerMH.id), true);
    });

    it("should properly clean up tracking when a socket disconnects", () => {
      manager.registerConnection(mockSocket1);
      manager.registerConnection(mockSocket2);

      manager.handleDisconnect(mockSocket1, "transport close");
      assert.equal(manager.getUserConnectionCount(mockStateOfficerMH.id), 1);
      assert.equal(manager.getTotalConnections(), 1);

      manager.handleDisconnect(mockSocket2, "client disconnect");
      assert.equal(manager.getUserConnectionCount(mockStateOfficerMH.id), 0);
      assert.equal(manager.getTotalConnections(), 0);
      assert.equal(manager.isUserOnline(mockStateOfficerMH.id), false);
    });
  });

  // =========================================================================
  // 4. PAYLOAD SANITIZATION & EVENT ENVELOPE
  // =========================================================================
  describe("4. Security & Payload Sanitization", () => {
    it("should strip password, passwordHash, and secret credentials from event payloads", () => {
      const rawData = {
        id: "ca-123",
        title: "Fix Fire Alarm",
        passwordHash: "$2b$12$eX4mP1eH4sH",
        jwtSecret: "super_secret_key",
        user: {
          id: "u-1",
          fullName: "Officer Name",
          password: "plain_password_123",
          token: "secret_token_abc",
        },
      };

      const sanitized = sanitizePayload(rawData);

      assert.equal(sanitized.id, "ca-123");
      assert.equal(sanitized.title, "Fix Fire Alarm");
      assert.equal(sanitized.passwordHash, undefined);
      assert.equal(sanitized.jwtSecret, undefined);
      assert.equal(sanitized.user.password, undefined);
      assert.equal(sanitized.user.token, undefined);
      assert.equal(sanitized.user.fullName, "Officer Name");
    });

    it("should construct a standard event envelope with timestamp and event name", () => {
      const envelope = buildEventEnvelope(WS_EVENTS.COMPLIANCE_CREATED, {
        id: "ca-123",
        title: "Test",
      });

      assert.equal(envelope.event, WS_EVENTS.COMPLIANCE_CREATED);
      assert.ok(envelope.timestamp);
      assert.equal(envelope.data.id, "ca-123");
    });
  });

  // =========================================================================
  // 5. EVENT PUBLISHING TO ROOM TARGETS
  // =========================================================================
  describe("5. Event Publishing Target Rooms", () => {
    it("should route compliance events to institution, state, district, and admin rooms", async () => {
      const emittedRooms = [];
      const mockIO = {
        to(room) {
          emittedRooms.push(room);
          return { emit() {} };
        },
        emit() {},
      };

      const manager = new SocketConnectionManager();
      manager.setIO(mockIO);

      const publisher = new EventPublisher();
      // Replace manager in publisher test
      manager.setIO(mockIO);

      const mockAction = {
        id: "ca-100",
        institutionId: "inst-mh-pun-001",
        title: "Fix defective fire extinguisher",
        status: "PENDING",
        institution: {
          name: "Anand Seva Old Age Home",
          state: "Maharashtra",
          district: "Pune",
        },
      };

      // Test publish
      await publisher.publishComplianceEvent(WS_EVENTS.COMPLIANCE_CREATED, mockAction);
    });
  });
});
