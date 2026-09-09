import {
  Bell,
  Lock,
  Settings as SettingsIcon,
  ShieldCheck,
} from "lucide-react";
import AppShell from "../../components/AppShell";

export default function InspectorSettings() {
  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              ACCOUNT CONTROL
            </span>
            <h2>Settings</h2>
            <p>
              Manage inspection account preferences and
              security settings.
            </p>
          </div>
        </div>

        <section className="settings-grid">
          <SettingCard
            icon={<ShieldCheck size={21} />}
            title="Account & Security"
            description="Manage account security and authentication preferences."
          />

          <SettingCard
            icon={<Bell size={21} />}
            title="Notifications"
            description="Configure alerts and inspection assignment notifications."
          />

          <SettingCard
            icon={<Lock size={21} />}
            title="Privacy"
            description="Review location and field-data privacy settings."
          />

          <SettingCard
            icon={<SettingsIcon size={21} />}
            title="Application"
            description="View application preferences and configuration."
          />
        </section>

        <section className="info-strip">
          <ShieldCheck size={19} />
          <div>
            <strong>Secure field operations</strong>
            <span>
              Inspector access and inspection activities are
              protected through authenticated sessions and
              role-based access control.
            </span>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function SettingCard({ icon, title, description }) {
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