import {
  Bell,
  Database,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
  Users,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function AdminSettings() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              SYSTEM CONTROL
            </span>
            <h2>Settings</h2>
            <p>
              Manage administrative controls, security,
              notifications, and platform configuration.
            </p>
          </div>
        </div>

        <section className="settings-grid">
          <AdminSettingCard
            icon={<Users size={21} />}
            title="User & Role Management"
            description="Manage administrative users, inspectors, and access roles."
          />

          <AdminSettingCard
            icon={<ShieldCheck size={21} />}
            title="Security"
            description="Configure authentication and platform security controls."
          />

          <AdminSettingCard
            icon={<Bell size={21} />}
            title="Notifications"
            description="Configure alerts and administrative notification preferences."
          />

          <AdminSettingCard
            icon={<Database size={21} />}
            title="Data & Integration"
            description="Review platform data and connected service configuration."
          />

          <AdminSettingCard
            icon={<Lock size={21} />}
            title="Access Control"
            description="Manage role-based access and protected platform areas."
          />

          <AdminSettingCard
            icon={<SettingsIcon size={21} />}
            title="System Preferences"
            description="Configure general platform behaviour and preferences."
          />
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Administrative controls</strong>
            <span>
              Changes made in this area affect platform
              access and monitoring behaviour.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function AdminSettingCard({
  icon,
  title,
  description,
}) {
  return (
    <section className="section-card setting-card">
      <div className="setting-icon">
        {icon}
      </div>

      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>

      <button className="ghost-button">
        Manage
      </button>
    </section>
  );
}