import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { homeForRole, useAuth } from "../context/AuthContext";
import { apiError } from "../services/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();
  const selectedRole = searchParams.get("role");

  const roleLabels = {
    admin: "Government Admin",
    inspector: "Field Inspector",
    institute: "Institute",
  };

  const portalName = roleLabels[selectedRole];

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email.trim(), password);
      navigate(homeForRole(user.role), { replace: true });
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-visual">
        <div className="login-visual-inner">
          <div className="brand light">
            <div className="brand-mark"><img src="/nirikshan.jpg" alt="Logo" /></div>
            <div><strong>NIRIKSHAN</strong><span>Government Inspection Platform</span></div>
          </div>
          <div className="hero-copy">
            <span className="pill">REAL-TIME OVERSIGHT</span>
            <h1>Inspect smarter.<br />Respond faster.</h1>
            <p>Centralized monitoring, surprise inspections and evidence-backed compliance for government-supported institutions.</p>
          </div>
          <div className="hero-metrics">
            <div><strong>24/7</strong><span>Monitoring</span></div>
            <div><strong>AI</strong><span>Risk Intelligence</span></div>
            <div><strong>GPS</strong><span>Verified Presence</span></div>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <div className="login-form-wrap">
          <div className="mobile-brand brand">
            <div className="brand-mark"><img src="/nirikshan.jpg" alt="Logo" /></div>
            <strong>SmartInspect</strong>
          </div>
          <div className="login-heading">
            <span>SECURE ACCESS</span>
            <h2>
              {portalName ? `${portalName} Login` : "Welcome"}
            </h2>
            <p>
              {portalName
                ? `Sign in to access the ${portalName} workspace.`
                : "Sign in to access your inspection workspace."}
            </p>

          </div>

          <form onSubmit={submit}>
            <label>Email address</label>
            <div className="input-wrap"><Mail size={18} /><input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></div>

            <label>Password</label>
            <div className="input-wrap"><LockKeyhole size={18} /><input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></div>

            {error && <div className="error-box">{error}</div>}

            <button className="primary-button login-button" disabled={busy}>
              {busy ? "Authenticating…" : "Sign in"} <ArrowRight size={18} />
            </button>
          </form>

          <div className="login-note">
            <ShieldCheck size={16} />
            <span>Access is provisioned by authorized government administrators.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
