import "dotenv/config";
import { prisma } from "../src/config/db.js";
import { hashPassword } from "../src/utils/auth.js";

async function seed() {
  console.log("🌱 Starting development seed...");

  const defaultPassword = "Password@123";
  const passwordHash = await hashPassword(defaultPassword);

  // 1. Schemes
  const scheme1 = await prisma.scheme.upsert({
    where: { code: "AVAY-2026" },
    update: { name: "Atal Vayo Abhyuday Yojana (Senior Citizen Welfare)" },
    create: {
      code: "AVAY-2026",
      name: "Atal Vayo Abhyuday Yojana (Senior Citizen Welfare)",
      description: "Comprehensive central grant scheme for old age homes and assisted living.",
      sponsoringDepartment: "Department of Social Justice and Empowerment",
    },
  });

  const scheme2 = await prisma.scheme.upsert({
    where: { code: "NAPDDR-2026" },
    update: { name: "National Action Plan for Drug Demand Reduction" },
    create: {
      code: "NAPDDR-2026",
      name: "National Action Plan for Drug Demand Reduction",
      description: "Financial assistance for Integrated Rehabilitation Centres for Addicts (IRCA).",
      sponsoringDepartment: "Department of Social Justice and Empowerment",
    },
  });
  console.log("✅ Schemes seeded");

  // 2. Institutions
  // Institution 1: Pune Senior Home (Maharashtra)
  const inst1 = await prisma.institution.upsert({
    where: { code: "INST-MH-PUN-001" },
    update: {
      name: "Anand Seva Old Age Home & Care Centre",
      state: "Maharashtra",
      district: "Pune",
      latestRiskScore: 12.5,
      latestRiskLevel: "LOW",
    },
    create: {
      code: "INST-MH-PUN-001",
      name: "Anand Seva Old Age Home & Care Centre",
      type: "SENIOR_CITIZEN_HOME",
      registrationNumber: "MH/PUN/SR/2018/0094",
      address: "Plot 45, Kothrud Social Welfare Complex",
      state: "Maharashtra",
      district: "Pune",
      pincode: "411038",
      latitude: 18.5074,
      longitude: 73.8077,
      geofenceRadiusMeters: 150,
      contactPerson: "Dr. Suresh Joshi",
      contactPhone: "+919822001122",
      contactEmail: "contact@anandseva.org",
      capacity: 100,
      currentOccupancy: 84,
      status: "ACTIVE",
      latestRiskScore: 12.5,
      latestRiskLevel: "LOW",
      isAidedByGovt: true,
    },
  });

  // Institution 2: Varanasi De-Addiction Center (Uttar Pradesh)
  const inst2 = await prisma.institution.upsert({
    where: { code: "INST-UP-VAR-001" },
    update: {
      name: "Nav Chetna Drug Rehabilitation Centre",
      state: "Uttar Pradesh",
      district: "Varanasi",
      latestRiskScore: 78.0,
      latestRiskLevel: "HIGH",
    },
    create: {
      code: "INST-UP-VAR-001",
      name: "Nav Chetna Drug Rehabilitation Centre",
      type: "DE_ADDICTION_CENTRE",
      registrationNumber: "UP/VAR/IRCA/2021/0412",
      address: "NH-19, Shivpur Rehabilitation Enclave",
      state: "Uttar Pradesh",
      district: "Varanasi",
      pincode: "221003",
      latitude: 25.3582,
      longitude: 82.9712,
      geofenceRadiusMeters: 200,
      contactPerson: "Manoj Tripathi",
      contactPhone: "+919415003344",
      contactEmail: "director@navchetna-up.org",
      capacity: 50,
      currentOccupancy: 48,
      status: "ACTIVE",
      latestRiskScore: 78.0,
      latestRiskLevel: "HIGH",
      isAidedByGovt: true,
    },
  });
  console.log("✅ Institutions seeded");

  // Link Schemes to Institutions
  await prisma.institutionScheme.upsert({
    where: {
      institutionId_schemeId_grantYear: {
        institutionId: inst1.id,
        schemeId: scheme1.id,
        grantYear: "2025-2026",
      },
    },
    update: { grantSanctionedAmount: 2500000.0 },
    create: {
      institutionId: inst1.id,
      schemeId: scheme1.id,
      grantSanctionedAmount: 2500000.0,
      grantYear: "2025-2026",
      approvalStatus: "SANCTIONED",
    },
  });

  // 3. Beneficiaries for Institution 1
  await prisma.beneficiary.upsert({
    where: {
      institutionId_enrollmentNumber: {
        institutionId: inst1.id,
        enrollmentNumber: "BEN-PUN-001",
      },
    },
    update: { fullName: "Ramesh Narayan Kulkarni" },
    create: {
      institutionId: inst1.id,
      schemeId: scheme1.id,
      enrollmentNumber: "BEN-PUN-001",
      fullName: "Ramesh Narayan Kulkarni",
      gender: "MALE",
      category: "SENIOR_CITIZEN",
      age: 74,
      admissionDate: new Date("2023-04-10"),
      status: "ENROLLED",
    },
  });

  // 4. Daily Attendance for Institution 1
  await prisma.institutionAttendance.upsert({
    where: {
      institutionId_attendanceDate: {
        institutionId: inst1.id,
        attendanceDate: new Date("2026-09-06"),
      },
    },
    update: { totalPresent: 82, totalEnrolled: 84 },
    create: {
      institutionId: inst1.id,
      attendanceDate: new Date("2026-09-06"),
      totalPresent: 82,
      totalEnrolled: 84,
      anomalyFlag: false,
      notes: "Regular morning roll-call conducted.",
    },
  });

  // 5. Users
  // Ministry Admin
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

  // State Officer (Maharashtra)
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

  // District Officer (Pune, Maharashtra)
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

  // Field Inspector (Pune, Maharashtra)
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

  // Institution Superintendent (linked to Pune Home: inst1.id)
  const instUser = await prisma.user.upsert({
    where: { email: "superintendent@anandseva.org" },
    update: { passwordHash, institutionId: inst1.id, isActive: true, deletedAt: null },
    create: {
      email: "superintendent@anandseva.org",
      passwordHash,
      fullName: "Dr. Suresh Joshi (Superintendent)",
      phone: "+919800000007",
      role: "INSTITUTION_USER",
      state: "Maharashtra",
      district: "Pune",
      institutionId: inst1.id,
      isActive: true,
    },
  });

  // Inactive User
  await prisma.user.upsert({
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

  // Deactivated User
  await prisma.user.upsert({
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

  console.log("🌱 Development seeding complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
