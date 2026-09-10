/**
 * Task 8 Automated Test Suite: Reports & Compliance / Corrective Actions Integration
 */

const BASE_URL = "http://127.0.0.1:5000/api";

const ADMIN_CREDENTIALS = {
  email: "admin@smartinspect.gov.in",
  password: "Password@123",
};

const INSPECTOR_CREDENTIALS = {
  email: "inspector@smartinspect.gov.in",
  password: "Password@123",
};

const INSTITUTION_CREDENTIALS = {
  email: "superintendent@anandseva.org",
  password: "Password@123",
};

async function login(credentials) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
    throw new Error(`Login failed (${res.status}): ${await res.text()}`);
  }
  const data = await res.json();
  return { token: data.data.token, user: data.data.user };
}

async function runTests() {
  console.log("=== Task 8: Reports & Compliance Integration Test ===\n");

  // 1. Authenticate Admin
  console.log("1. Authenticating Admin...");
  const admin = await login(ADMIN_CREDENTIALS);
  console.log(`✔ Admin authenticated: ${admin.user.fullName} (${admin.user.role})`);

  // 2. Query Completed Inspection Reports
  console.log("\n2. Testing Admin Reports API (GET /api/inspections)...");
  const reportsRes = await fetch(`${BASE_URL}/inspections?page=1&limit=50&sortBy=scheduledDate&sortOrder=desc`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  console.log(`Reports query status: ${reportsRes.status}`);
  if (!reportsRes.ok) throw new Error("Failed to query reports");
  const reportsData = await reportsRes.json();
  const inspections = reportsData.data || [];
  console.log(`✔ Retrieved ${inspections.length} inspection records.`);

  const completed = inspections.filter((x) => x.status === "COMPLETED");
  console.log(`✔ Found ${completed.length} completed inspection reports available for dossiers.`);

  // 3. Query Compliance Metrics & Actions
  console.log("\n3. Testing Compliance Summary Stats (GET /api/compliance/stats)...");
  const statsRes = await fetch(`${BASE_URL}/compliance/stats`, {
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  console.log(`Stats query status: ${statsRes.status}`);
  if (!statsRes.ok) throw new Error("Failed to fetch compliance stats");
  const statsData = await statsRes.json();
  console.log("✔ Compliance metrics:", statsData.data);

  // 4. Authenticate Institution User
  console.log("\n4. Authenticating Institution User...");
  const instUser = await login(INSTITUTION_CREDENTIALS);
  console.log(`✔ Institution user authenticated: ${instUser.user.fullName} (${instUser.user.role})`);

  // 5. Query Compliance Actions as Institution User
  console.log("\n5. Querying Compliance Actions as Institution (GET /api/compliance)...");
  const instActionsRes = await fetch(`${BASE_URL}/compliance?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${instUser.token}` },
  });
  console.log(`Institution compliance query status: ${instActionsRes.status}`);
  if (!instActionsRes.ok) throw new Error("Failed to fetch institution compliance actions");
  const instActionsData = await instActionsRes.json();
  console.log(`✔ Institution actions retrieved: ${(instActionsData.data || []).length} items`);

  // 6. Test Corrective Action Creation by Admin
  console.log("\n6. Creating a Corrective Action as Admin (POST /api/compliance)...");
  const testInspection = inspections[0];
  if (!testInspection) throw new Error("No inspection found for compliance testing");

  const newActionPayload = {
    inspectionId: testInspection.id,
    institutionId: testInspection.institution?.id || testInspection.institutionId,
    title: "Task 8 Automated Test: Fix Kitchen Ventilation & Fire Safety",
    description: "Inspection audit identified inadequate kitchen exhaust filtration and an expired fire extinguisher.",
    severity: "HIGH",
    deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
  };

  const createActionRes = await fetch(`${BASE_URL}/compliance`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(newActionPayload),
  });
  console.log(`Create action status: ${createActionRes.status}`);
  if (!createActionRes.ok) {
    throw new Error(`Failed to create action: ${await createActionRes.text()}`);
  }
  const createActionData = await createActionRes.json();
  const createdAction = createActionData.data;
  console.log(`✔ Created Action ID: ${createdAction.id} [Status: ${createdAction.status}, Severity: ${createdAction.severity}]`);

  // 7. Transition Lifecycle: PENDING -> IN_PROGRESS (start)
  console.log("\n7. Transitioning Status: PENDING -> IN_PROGRESS (POST /api/compliance/:id/start)...");
  const startRes = await fetch(`${BASE_URL}/compliance/${createdAction.id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${admin.token}` },
  });
  console.log(`Start action status: ${startRes.status}`);
  if (!startRes.ok) throw new Error("Failed to start action");
  const startData = await startRes.json();
  console.log(`✔ Action status after start: ${startData.data.status}`);

  // 8. Transition Lifecycle: IN_PROGRESS -> SUBMITTED_FOR_REVIEW (submit)
  console.log("\n8. Submitting Rectification (POST /api/compliance/:id/submit)...");
  const submitRes = await fetch(`${BASE_URL}/compliance/${createdAction.id}/submit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      institutionResponse: "New stainless steel exhaust hood installed and fire extinguisher refilled and recertified.",
      resolutionEvidenceUrl: "https://res.cloudinary.com/demo/image/upload/v1/sample.jpg",
    }),
  });
  console.log(`Submit rectification status: ${submitRes.status}`);
  if (!submitRes.ok) throw new Error("Failed to submit rectification");
  const submitData = await submitRes.json();
  console.log(`✔ Action status after submission: ${submitData.data.status}`);

  // 9. Transition Lifecycle: SUBMITTED_FOR_REVIEW -> VERIFIED_CLOSED (verify)
  console.log("\n9. Officer Verification & Closure (POST /api/compliance/:id/verify)...");
  const verifyRes = await fetch(`${BASE_URL}/compliance/${createdAction.id}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${admin.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      notes: "Verified compliance with MoSJE fire safety standards. Remediation approved.",
    }),
  });
  console.log(`Verify action status: ${verifyRes.status}`);
  if (!verifyRes.ok) throw new Error("Failed to verify action");
  const verifyData = await verifyRes.json();
  console.log(`✔ Action status after officer verification: ${verifyData.data.status}`);

  // 10. Role-Based Security Test: Institution user cannot close/verify
  console.log("\n10. Testing RBAC Security: Institution user attempting unauthorized verification...");
  const unauthorizedRes = await fetch(`${BASE_URL}/compliance/${createdAction.id}/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${instUser.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notes: "Unauthorized closing" }),
  });
  console.log(`Unauthorized verification status (expected 403): ${unauthorizedRes.status}`);
  if (unauthorizedRes.status === 403) {
    console.log("✔ Backend correctly enforced RBAC and rejected unauthorized verification.");
  } else {
    throw new Error(`Expected HTTP 403, received: ${unauthorizedRes.status}`);
  }

  // 11. Authenticate Inspector & Test My Reports
  console.log("\n11. Testing Inspector Reports (GET /api/inspections/my)...");
  const inspector = await login(INSPECTOR_CREDENTIALS);
  const myReportsRes = await fetch(`${BASE_URL}/inspections/my?page=1&limit=50`, {
    headers: { Authorization: `Bearer ${inspector.token}` },
  });
  console.log(`Inspector reports status: ${myReportsRes.status}`);
  if (!myReportsRes.ok) throw new Error("Failed to fetch inspector reports");
  const myReportsData = await myReportsRes.json();
  console.log(`✔ Inspector has ${(myReportsData.data || []).length} assigned audits.`);

  console.log("\n=== ALL TASK 8 REPORTS & COMPLIANCE INTEGRATION TESTS PASSED WITH 100% SUCCESS ===");
}

runTests().catch((err) => {
  console.error("❌ Test Failed:", err.message);
  process.exit(1);
});
