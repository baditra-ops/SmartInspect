import { prisma } from "./src/config/db.js";
import bcrypt from "bcrypt";

/**
 * Utility script to create/seed new Field Inspectors in any State/District
 * Usage: node create_inspector.mjs
 */

const DEFAULT_INSPECTORS = [
  {
    email: "inspector.varanasi@smartinspect.gov.in",
    fullName: "Aarav Mishra (Field Auditor)",
    phone: "+919811000001",
    state: "Uttar Pradesh",
    district: "Varanasi",
    badgeNumber: "INSP-UP-VAR-001",
    designation: "District Social Welfare Inspector",
  },
  {
    email: "inspector.delhi@smartinspect.gov.in",
    fullName: "Pooja Sharma (Field Auditor)",
    phone: "+919811000002",
    state: "Delhi",
    district: "Central Delhi",
    badgeNumber: "INSP-DL-CEN-001",
    designation: "Statutory Monitoring Inspector",
  },
  {
    email: "inspector.mumbai@smartinspect.gov.in",
    fullName: "Kunal Deshmukh (Field Auditor)",
    phone: "+919811000003",
    state: "Maharashtra",
    district: "Mumbai",
    badgeNumber: "INSP-MH-MUM-001",
    designation: "Field Inspection Officer",
  },
];

async function createInspectors() {
  console.log("Adding field inspectors to database...");
  const passwordHash = await bcrypt.hash("Password@123", 10);

  for (const data of DEFAULT_INSPECTORS) {
    const user = await prisma.user.upsert({
      where: { email: data.email },
      update: {
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        state: data.state,
        district: data.district,
        isActive: true,
        deletedAt: null,
      },
      create: {
        email: data.email,
        passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        role: "INSPECTOR",
        state: data.state,
        district: data.district,
        isActive: true,
        inspectorProfile: {
          create: {
            badgeNumber: data.badgeNumber,
            designation: data.designation,
            assignedDistrict: data.district,
            status: "AVAILABLE",
          },
        },
      },
    });

    // Ensure profile is present if user already existed
    const profile = await prisma.inspectorProfile.upsert({
      where: { userId: user.id },
      update: {
        assignedDistrict: data.district,
        status: "AVAILABLE",
      },
      create: {
        userId: user.id,
        badgeNumber: data.badgeNumber,
        designation: data.designation,
        assignedDistrict: data.district,
        status: "AVAILABLE",
      },
    });

    console.log(`✔ Registered Inspector: ${data.fullName} (${data.email}) in ${data.district}, ${data.state} [Badge: ${profile.badgeNumber}]`);
  }

  console.log("\nAll inspectors created successfully! Default password for all inspectors is: Password@123");
  await prisma.$disconnect();
}

createInspectors().catch(async (err) => {
  console.error("Error creating inspectors:", err);
  await prisma.$disconnect();
  process.exit(1);
});
