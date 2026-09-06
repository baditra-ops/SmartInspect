import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { hashPassword } from "../src/utils/auth.js";

async function seed() {
  console.log("🌱 Starting development seed...");

  const defaultPassword = "Password@123";
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Ministry Admin
  const admin = await prisma.user.upsert({
    where: { email: "admin@smartinspect.gov.in" },
    update: { passwordHash, isActive: true, deletedAt: null },
    create: {
      email: "admin@smartinspect.gov.in",
      passwordHash,
      fullName: "National Ministry Admin",
      phone: "+919800000001",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log(`✅ Admin user seeded: ${admin.email}`);

  // 2. State Officer
  const stateOfficer = await prisma.user.upsert({
    where: { email: "state.officer@smartinspect.gov.in" },
    update: { passwordHash, isActive: true, deletedAt: null },
    create: {
      email: "state.officer@smartinspect.gov.in",
      passwordHash,
      fullName: "Rajesh Sharma (State Director)",
      phone: "+919800000002",
      role: "STATE_OFFICER",
      state: "Maharashtra",
      isActive: true,
    },
  });
  console.log(`✅ State Officer seeded: ${stateOfficer.email}`);

  // 3. District Officer
  const districtOfficer = await prisma.user.upsert({
    where: { email: "district.officer@smartinspect.gov.in" },
    update: { passwordHash, isActive: true, deletedAt: null },
    create: {
      email: "district.officer@smartinspect.gov.in",
      passwordHash,
      fullName: "Sunita Deshmukh (DSWO Pune)",
      phone: "+919800000003",
      role: "DISTRICT_OFFICER",
      state: "Maharashtra",
      district: "Pune",
      isActive: true,
    },
  });
  console.log(`✅ District Officer seeded: ${districtOfficer.email}`);

  // 4. Field Inspector
  const inspector = await prisma.user.upsert({
    where: { email: "inspector@smartinspect.gov.in" },
    update: { passwordHash, isActive: true, deletedAt: null },
    create: {
      email: "inspector@smartinspect.gov.in",
      passwordHash,
      fullName: "Amit Verma (Field Auditor)",
      phone: "+919800000004",
      role: "INSPECTOR",
      state: "Maharashtra",
      district: "Pune",
      isActive: true,
      inspectorProfile: {
        create: {
          badgeNumber: "INSP-MH-PUN-001",
          designation: "Senior Social Welfare Inspector",
          assignedDistrict: "Pune",
          status: "AVAILABLE",
        },
      },
    },
  });
  console.log(`✅ Inspector seeded: ${inspector.email}`);

  // 5. Inactive Test User
  const inactiveUser = await prisma.user.upsert({
    where: { email: "inactive@smartinspect.gov.in" },
    update: { passwordHash, isActive: false, deletedAt: null },
    create: {
      email: "inactive@smartinspect.gov.in",
      passwordHash,
      fullName: "Disabled Inspector",
      phone: "+919800000005",
      role: "INSPECTOR",
      isActive: false,
    },
  });
  console.log(`✅ Inactive test user seeded: ${inactiveUser.email}`);

  // 6. Soft-Deleted Test User
  const deletedUser = await prisma.user.upsert({
    where: { email: "deleted@smartinspect.gov.in" },
    update: { passwordHash, deletedAt: new Date() },
    create: {
      email: "deleted@smartinspect.gov.in",
      passwordHash,
      fullName: "Deactivated Officer",
      phone: "+919800000006",
      role: "INSPECTOR",
      isActive: true,
      deletedAt: new Date(),
    },
  });
  console.log(`✅ Deactivated test user seeded: ${deletedUser.email}`);

  console.log("🌱 Development seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
