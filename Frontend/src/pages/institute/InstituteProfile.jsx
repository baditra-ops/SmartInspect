import {
  Building2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";

export default function InstituteProfile() {
  const { user } = useAuth();

  return (
    <AppShell>
      <div className="dashboard-body">
        <div className="page-intro">
          <div>
            <span className="section-kicker">
              INSTITUTION MANAGEMENT
            </span>
            <h2>Profile</h2>
            <p>
              View the registered information associated
              with your institution.
            </p>
          </div>
        </div>

        <section className="profile-page-grid">
          <div className="section-card profile-summary-card">
            <div className="profile-avatar">
              <Building2 size={28} />
            </div>

            <h2>Institution Profile</h2>

            <p>
              Registered institution account
            </p>

            <div className="profile-status">
              <ShieldCheck size={16} />
              Account active
            </div>
          </div>

          <div className="section-card">
            <div className="section-head">
              <div>
                <span className="section-kicker">
                  REGISTERED DETAILS
                </span>
                <h2>Institution information</h2>
              </div>
            </div>

            <div className="profile-detail-grid">
              <ProfileField
                label="Institution name"
                value="—"
              />

              <ProfileField
                label="Institution ID"
                value={user?.institutionId || "—"}
              />

              <ProfileField
                label="District"
                value="—"
              />

              <ProfileField
                label="State"
                value="—"
              />

              <ProfileField
                label="Capacity"
                value="—"
              />

              <ProfileField
                label="Current occupancy"
                value="—"
              />
            </div>
          </div>
        </section>

        <section className="section-card">
          <div className="section-head">
            <div>
              <span className="section-kicker">
                ACCOUNT CONTACT
              </span>
              <h2>Authorized user</h2>
            </div>
          </div>

          <div className="profile-contact-grid">
            <div className="contact-item">
              <Users size={18} />
              <div>
                <span>Name</span>
                <strong>
                  {user?.fullName || "—"}
                </strong>
              </div>
            </div>

            <div className="contact-item">
              <ShieldCheck size={18} />
              <div>
                <span>Role</span>
                <strong>
                  Institution User
                </strong>
              </div>
            </div>

            <div className="contact-item">
              <MapPin size={18} />
              <div>
                <span>Institution ID</span>
                <strong>
                  {user?.institutionId || "—"}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function ProfileField({ label, value }) {
  return (
    <div className="profile-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}