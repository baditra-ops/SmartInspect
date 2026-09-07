import { prisma } from "../config/db.js";

/**
 * Room naming helpers
 */
export const ROOMS = {
  user: (userId) => `user:${userId}`,
  institution: (institutionId) => `institution:${institutionId}`,
  district: (state, district) => `district:${(state || "all").toLowerCase().replace(/\s+/g, "_")}:${(district || "all").toLowerCase().replace(/\s+/g, "_")}`,
  state: (state) => `state:${(state || "all").toLowerCase().replace(/\s+/g, "_")}`,
  role: (role) => `role:${role}`,
  inspection: (inspectionId) => `inspection:${inspectionId}`,
};

/**
 * Authorize client subscription request to a specific room
 * @param {object} user Sanitized user profile attached to socket
 * @param {string} room Target room string
 * @returns {Promise<boolean>} True if authorized, throws Error if unauthorized
 */
export const authorizeRoomSubscription = async (user, room) => {
  if (!user || !room) {
    throw new Error("Invalid subscription request: missing user or room identifier");
  }

  // 1. National Admin has unrestricted room authorization
  if (user.role === "ADMIN") {
    return true;
  }

  const parts = room.split(":");
  const roomType = parts[0];
  const targetId = parts[1];

  switch (roomType) {
    case "user": {
      // Users may only subscribe to their own personal room
      if (targetId !== user.id) {
        throw new Error(`Access forbidden. You cannot subscribe to user room "${room}" for another user.`);
      }
      return true;
    }

    case "role": {
      // Users may only subscribe to their assigned role room
      if (targetId !== user.role) {
        throw new Error(`Access forbidden. You cannot subscribe to role room "${room}". Current role: ${user.role}`);
      }
      return true;
    }

    case "institution": {
      // Institution Users can ONLY subscribe to their designated institution room
      if (user.role === "INSTITUTION_USER") {
        if (!user.institutionId || user.institutionId !== targetId) {
          throw new Error(`Access forbidden. You cannot subscribe to institution room "${room}" for another facility.`);
        }
        return true;
      }

      // Government Officers: Verify institution exists and is within officer jurisdiction
      const institution = await prisma.institution.findUnique({
        where: { id: targetId },
        select: { id: true, state: true, district: true },
      });

      if (!institution) {
        throw new Error(`Institution with ID ${targetId} not found.`);
      }

      if (user.role === "STATE_OFFICER") {
        if (!user.state || user.state.toLowerCase() !== institution.state.toLowerCase()) {
          throw new Error(`Access forbidden. Institution (${institution.state}) is outside your state jurisdiction (${user.state}).`);
        }
        return true;
      }

      if (user.role === "DISTRICT_OFFICER") {
        const isStateMatch = user.state && user.state.toLowerCase() === institution.state.toLowerCase();
        const isDistrictMatch = user.district && user.district.toLowerCase() === institution.district.toLowerCase();
        if (!isStateMatch || !isDistrictMatch) {
          throw new Error(
            `Access forbidden. Institution (${institution.district}, ${institution.state}) is outside your district jurisdiction (${user.district}, ${user.state}).`
          );
        }
        return true;
      }

      if (user.role === "INSPECTOR") {
        return true;
      }

      throw new Error("Access forbidden. Insufficient permissions for institution room subscription.");
    }

    case "state": {
      const stateName = targetId;
      if (user.role === "STATE_OFFICER") {
        if (!user.state || user.state.toLowerCase().replace(/\s+/g, "_") !== stateName.toLowerCase()) {
          throw new Error(`Access forbidden. You cannot subscribe to state room for ${stateName}. Your state: ${user.state}`);
        }
        return true;
      }

      throw new Error(`Access forbidden. Role ${user.role} is not permitted to subscribe to state-wide broadcast rooms.`);
    }

    case "district": {
      // Format: district:state:district or district:districtName
      const districtName = parts.length > 2 ? parts[2] : targetId;
      const stateName = parts.length > 2 ? parts[1] : null;

      if (user.role === "DISTRICT_OFFICER") {
        const userDistrictClean = (user.district || "").toLowerCase().replace(/\s+/g, "_");
        if (userDistrictClean !== districtName.toLowerCase()) {
          throw new Error(`Access forbidden. District "${districtName}" is outside your assigned jurisdiction (${user.district}).`);
        }
        return true;
      }

      if (user.role === "STATE_OFFICER") {
        if (stateName) {
          const userStateClean = (user.state || "").toLowerCase().replace(/\s+/g, "_");
          if (userStateClean !== stateName.toLowerCase()) {
            throw new Error(`Access forbidden. State "${stateName}" is outside your assigned jurisdiction (${user.state}).`);
          }
        }
        return true;
      }

      throw new Error(`Access forbidden. Role ${user.role} is not permitted to subscribe to district broadcast rooms.`);
    }

    case "inspection": {
      const inspection = await prisma.inspection.findUnique({
        where: { id: targetId },
        include: { institution: true },
      });

      if (!inspection) {
        throw new Error(`Inspection with ID ${targetId} not found.`);
      }

      if (user.role === "INSTITUTION_USER") {
        if (!user.institutionId || user.institutionId !== inspection.institutionId) {
          throw new Error("Access forbidden. You cannot view inspections of other institutions.");
        }
        return true;
      }

      if (user.role === "INSPECTOR") {
        return true;
      }

      if (user.role === "STATE_OFFICER") {
        if (!user.state || user.state.toLowerCase() !== inspection.institution.state.toLowerCase()) {
          throw new Error("Access forbidden. Inspection is outside your state jurisdiction.");
        }
        return true;
      }

      if (user.role === "DISTRICT_OFFICER") {
        const isStateMatch = user.state && user.state.toLowerCase() === inspection.institution.state.toLowerCase();
        const isDistrictMatch = user.district && user.district.toLowerCase() === inspection.institution.district.toLowerCase();
        if (!isStateMatch || !isDistrictMatch) {
          throw new Error("Access forbidden. Inspection is outside your district jurisdiction.");
        }
        return true;
      }

      throw new Error("Access forbidden for inspection room.");
    }

    default:
      throw new Error(`Unknown or unsupported room type "${roomType}"`);
  }
};

export default ROOMS;
