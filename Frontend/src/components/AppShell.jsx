import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LogOut,
  Building2,
  ClipboardCheck,
  MapPin,
  FileText,
  Bell,
  BarChart3,
  Menu,
  X,
  Settings,
  UserCircle,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useState } from "react";

export default function AppShell({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);


  const { user, logout } = useAuth();
  const navigate = useNavigate();

    const isAdmin = [
    "ADMIN",
    "STATE_OFFICER",
    "DISTRICT_OFFICER",
  ].includes(user?.role);

  const isInspector = user?.role === "INSPECTOR";
  const isInstitute = user?.role === "INSTITUTION_USER";

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`app-shell ${isInspector ? "inspector-shell" : ""}`}>
      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <button
          className="mobile-close-button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>

        <div className="brand">
          <div className="brand-icon">
            <img src="/nirikshan.jpg" alt="Logo" />
          </div>

          <div>
            <strong>Nirikshan</strong>
            <span>Inspection Intelligence</span>
          </div>
        </div>

        <nav>
          {/* ================= ADMIN ================= */}
          {isAdmin && (
            <>
              <NavLink to="/admin" end className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>

              <NavLink to="/admin/institutes" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <Building2 size={18} />
                Institutes
              </NavLink>

              <NavLink to="/admin/inspection" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <ClipboardCheck size={18} />
                Inspections
              </NavLink>

              <NavLink to="/admin/alert" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <Bell size={18} />
                Alerts
              </NavLink>

              <NavLink to="/admin/reports" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <BarChart3 size={18} />
                Reports
              </NavLink>

              <NavLink to="/admin/settings" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <Settings size={18} />
                Settings
              </NavLink>
            </>
          )}

          {/* ================= INSPECTOR ================= */}
          {isInspector && (
            <>
              <NavLink to="/inspector" end className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>

              <NavLink to="/inspector/location" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <MapPin size={18} />
                Locations
              </NavLink>

              <NavLink to="/inspector/inspection" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <ClipboardCheck size={18} />
                Assigned Inspections
              </NavLink>

              <NavLink to="/inspector/report" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <FileText size={18} />
                Reports
              </NavLink>

              <NavLink to="/inspector/setting" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <Settings size={18} />
                Settings
              </NavLink>
            </>
          )}

          {/* ================= INSTITUTE ================= */}
          {isInstitute && (
            <>
              <NavLink to="/institute" end className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <LayoutDashboard size={18} />
                Dashboard
              </NavLink>

              <NavLink to="/institute/report" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <FileText size={18} />
                Inspection Reports
              </NavLink>

              <NavLink to="/institute/complaint" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <MessageSquare size={18} />
                Complaints
              </NavLink>

              <NavLink to="/institute/profile" className="nav-item" onClick={() => setMobileMenuOpen(false)}>
                <UserCircle size={18} />
                Profile
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">
              {(user?.fullName || "U").charAt(0)}
            </div>

            <div>
              <strong>{user?.fullName || "User"}</strong>
              <span>{formatRole(user?.role)}</span>
            </div>
          </div>

          <button className="ghost-button full" onClick={handleLogout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>

      </aside>

      {mobileMenuOpen && (
        <button
          className="sidebar-overlay"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <main className="main-content">
        
        <button
          className="mobile-menu-button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={21} />
        </button>

        <header className="topbar">
          <div>
            <div className="eyebrow">MINISTRY MONITORING PLATFORM</div>
            <h1>{pageTitle(user?.role)}</h1>
          </div>

          <div className="topbar-user">
            <span className="status-dot" />
            Secure session
          </div>
        </header>

        {children}
      </main>
    </div>
  );
}

function pageTitle(role) {
  if (role === "INSPECTOR") return "Field Inspection Console";
  if (role === "INSTITUTION_USER") return "Institution Overview";
  return "Government Monitoring Dashboard";
}

function formatRole(role = "") {
  return role
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}