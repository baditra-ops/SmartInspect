import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import Login from "./pages/Login";

import AdminDashboard from "./pages/AdminDashboard";
import AdminAlerts from "./pages/admin/AdminAlerts";
import AdminInspections from "./pages/admin/AdminInspections";
import AdminInstitutes from "./pages/admin/AdminInstitutes";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";

import InspectorDashboard from "./pages/InspectorDashboard";
import InspectorInspections from "./pages/inspector/InspectorInspections";
import InspectorReports from "./pages/inspector/InspectorReports";
import InspectorLocations from "./pages/inspector/InspectorLocations";
import InspectorSettings from "./pages/inspector/InspectorSettings";

import InstituteDashboard from "./pages/InstituteDashboard";
import InstituteComplaints from './pages/institute/InstituteComplaints'
import InstituteReports from "./pages/institute/InstituteReports";
import InstituteProfile from "./pages/institute/InstituteProfile";

import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth, homeForRole } from "./context/AuthContext";




export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="screen-loader">Loading SmartInspect…</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route
        path="/login"
        element={
          user ? (
            <Navigate to={homeForRole(user.role)} replace />
          ) : (
            <Login />
          )
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspector"
        element={
          <ProtectedRoute allowedRoles={["INSPECTOR"]}>
            <InspectorDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/institute"
        element={
          <ProtectedRoute allowedRoles={["INSTITUTION_USER"]}>
            <InstituteDashboard />
          </ProtectedRoute>
        }
      />

      {/* <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/inspector" element={<InspectorDashboard />} />
      <Route path="/institute" element={<InstituteDashboard />} />



      <Route path="/institute/complaint" element={<InstituteComplaints />} />
      <Route path="/institute/report" element={<InstituteReports />} />
      <Route path="/institute/profile" element={<InstituteProfile />} /> */}

      <Route
        path="/institute/complaint"
        element={
          <ProtectedRoute allowedRoles={["INSTITUTION_USER"]}>
            <InstituteComplaints />
          </ProtectedRoute>
        }
      />

      <Route
        path="/institute/report"
        element={
          <ProtectedRoute allowedRoles={["INSTITUTION_USER"]}>
            <InstituteReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/institute/profile"
        element={
          <ProtectedRoute allowedRoles={["INSTITUTION_USER"]}>
            <InstituteProfile />
          </ProtectedRoute>
        }
      />

      {/* <Route path="/inspector/location" element={<InspectorLocations />} />
      <Route path="/inspector/report" element={<InspectorReports />} />
      <Route path="/inspector/setting" element={<InspectorSettings />} />
      <Route path="/inspector/inspection" element={<InspectorInspections />} /> */}

      <Route
        path="/inspector/location"
        element={
          <ProtectedRoute allowedRoles={["INSPECTOR"]}>
            <InspectorLocations />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspector/report"
        element={
          <ProtectedRoute allowedRoles={["INSPECTOR"]}>
            <InspectorReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspector/setting"
        element={
          <ProtectedRoute allowedRoles={["INSPECTOR"]}>
            <InspectorSettings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/inspector/inspection"
        element={
          <ProtectedRoute allowedRoles={["INSPECTOR"]}>
            <InspectorInspections />
          </ProtectedRoute>
        }
      />
      {/* <Route path="/admin/alert" element={<AdminAlerts />} />
      <Route path="/admin/inspection" element={<AdminInspections />} />
      <Route path="/admin/institutes" element={<AdminInstitutes />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="/admin/settings" element={<AdminSettings />} /> */}

      <Route
        path="/admin/alert"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminAlerts />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/inspection"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminInspections />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/institutes"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminInstitutes />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminReports />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute
            allowedRoles={["ADMIN", "STATE_OFFICER", "DISTRICT_OFFICER"]}
          >
            <AdminSettings />
          </ProtectedRoute>
        }
      />


      <Route
        path="*"
        element={
          <Navigate
            to={user ? homeForRole(user.role) : "/login"}
            replace
          />
        }
      />
    </Routes>
  );
}




// import { NavLink, useNavigate } from "react-router-dom";
// import {
//   LayoutDashboard,
//   LogOut,
//   Building2,
//   ClipboardCheck,
//   MapPin,
//   FileText,
//   Bell,
//   BarChart3,
//   Settings,
//   UserCircle,
//   MessageSquare,
//   CalendarCheck,
// } from "lucide-react";
// import { useAuth } from "../context/AuthContext";

// export default function AppShell({ children }) {
//   const { user, logout } = useAuth();
//   const navigate = useNavigate();

//   const isInspector = user?.role === "INSPECTOR";
//   const isInstitute = user?.role === "INSTITUTION_USER";
//   const isAdmin = !isInspector && !isInstitute;


//   async function handleLogout() {
//     await logout();
//     navigate("/login", { replace: true });
//   }

//   return (
//     <div className={`app-shell ${isInspector ? "inspector-shell" : ""}`}>
//       <aside className="sidebar">
//         <div className="brand">
//           <div className="brand-icon">
//             <img src="/nirikshan.jpg" alt="Logo" />
//           </div>

//           <div>
//             <strong>Nirikshan</strong>
//             <span>Inspection Intelligence</span>
//           </div>
//         </div>

//         <nav>
//           {/* ================= ADMIN ================= */}
//           {isAdmin && (
//             <>
//               <NavLink to="/admin" end className="nav-item">
//                 <LayoutDashboard size={18} />
//                 Dashboard
//               </NavLink>

//               <NavLink to="/admin/institutes" className="nav-item">
//                 <Building2 size={18} />
//                 Institutes
//               </NavLink>

//               <NavLink to="/admin/inspections" className="nav-item">
//                 <ClipboardCheck size={18} />
//                 Inspections
//               </NavLink>

//               <NavLink to="/admin/alerts" className="nav-item">
//                 <Bell size={18} />
//                 Alerts
//               </NavLink>

//               <NavLink to="/admin/reports" className="nav-item">
//                 <BarChart3 size={18} />
//                 Reports
//               </NavLink>

//               <NavLink to="/admin/settings" className="nav-item">
//                 <Settings size={18} />
//                 Settings
//               </NavLink>
//             </>
//           )}

//           {/* ================= INSPECTOR ================= */}
//           {isInspector && (
//             <>
//               <NavLink to="/inspector" end className="nav-item">
//                 <LayoutDashboard size={18} />
//                 Dashboard
//               </NavLink>

//               <NavLink to="/inspector/locations" className="nav-item">
//                 <MapPin size={18} />
//                 Locations
//               </NavLink>

//               <NavLink to="/inspector/inspections" className="nav-item">
//                 <ClipboardCheck size={18} />
//                 Assigned Inspections
//               </NavLink>

//               <NavLink to="/inspector/reports" className="nav-item">
//                 <FileText size={18} />
//                 Reports
//               </NavLink>

//               <NavLink to="/inspector/settings" className="nav-item">
//                 <Settings size={18} />
//                 Settings
//               </NavLink>
//             </>
//           )}

//           {/* ================= INSTITUTE ================= */}
//           {isInstitute && (
//             <>
//               <NavLink to="/institute" end className="nav-item">
//                 <LayoutDashboard size={18} />
//                 Dashboard
//               </NavLink>

//               <NavLink to="/institute/reports" className="nav-item">
//                 <FileText size={18} />
//                 Inspection Reports
//               </NavLink>

//               <NavLink to="/institute/complaints" className="nav-item">
//                 <MessageSquare size={18} />
//                 Complaints
//               </NavLink>

//               <NavLink to="/institute/profile" className="nav-item">
//                 <UserCircle size={18} />
//                 Profile
//               </NavLink>
//             </>
//           )}
//         </nav>

//         <div className="sidebar-bottom">
//           <div className="user-mini">
//             <div className="avatar">
//               {(user?.fullName || "U").charAt(0)}
//             </div>

//             <div>
//               <strong>{user?.fullName || "User"}</strong>
//               <span>{formatRole(user?.role)}</span>
//             </div>
//           </div>

//           <button className="ghost-button full" onClick={handleLogout}>
//             <LogOut size={17} />
//             Sign out
//           </button>
//         </div>
//       </aside>

//       <main className="main-content">
//         <header className="topbar">
//           <div>
//             <div className="eyebrow">MINISTRY MONITORING PLATFORM</div>
//             <h1>{pageTitle(user?.role)}</h1>
//           </div>

//           <div className="topbar-user">
//             <span className="status-dot" />
//             Secure session
//           </div>
//         </header>

//         {children}
//       </main>
//     </div>
//   );
// }

// function pageTitle(role) {
//   if (role === "INSPECTOR") return "Field Inspection Console";
//   if (role === "INSTITUTION_USER") return "Institution Overview";
//   return "Government Monitoring Dashboard";
// }

// function formatRole(role = "") {
//   return role
//     .replaceAll("_", " ")
//     .toLowerCase()
//     .replace(/\b\w/g, (c) => c.toUpperCase());
// }
