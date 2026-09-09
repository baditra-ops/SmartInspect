import { useNavigate } from "react-router-dom";
import {
    ShieldCheck,
    ArrowRight,
    MapPin,
    Activity,
    BrainCircuit,
    Building2,
    UserRoundCheck,
    Landmark,
    CheckCircle2,
    Navigation,
    AlertTriangle,
} from "lucide-react";

import "./Landing.css";

function Landing() {
    const navigate = useNavigate();

    return (
        <div className="landing-page">

            {/* ==================== HEADER ==================== */}
            <header className="landing-header">

                <div className="brand">
                    <div className="brand-icon">
                        <img src="/nirikshan.jpg" alt="Logo" />
                    </div>

                    <div className="brand-text">
                        <span className="brand-name">NIRIKSHAN</span>
                        <span className="brand-subtitle">
                            Government Inspection Platform
                        </span>
                    </div>
                </div>

                <nav className="landing-nav">
                    <a href="#overview">Overview</a>
                    <a href="#framework">Framework</a>
                    <a href="#portals">Portal Access</a>
                    <a href="#support">Support</a>
                </nav>

                <button
                    className="header-login-button"
                    onClick={() => navigate("/login")}
                >
                    Enter Portal
                    <ArrowRight size={17} />
                </button>

            </header>


            <main>
                {/* ==================== HERO ==================== */}
                <section className="hero-section" id="overview">

                    {/* ---------- HERO LEFT ---------- */}
                    <div className="hero-content">

                        <div className="hero-eyebrow">
                            <span className="eyebrow-dot"></span>
                            REAL-TIME INSTITUTIONAL OVERSIGHT
                        </div>

                        <h1>
                            Intelligent, Real-Time
                            <span>Institutional Monitoring</span>
                            <span>& Surprise Inspection</span>
                        </h1>

                        <p className="hero-description">
                            AI-powered risk assessment, geo-verified inspections,
                            evidence capture, and transparent monitoring for
                            government-supported institutions.
                        </p>

                        <div className="hero-actions">

                            <button
                                className="primary-button"
                                onClick={() => navigate("/login")}
                            >
                                Access Portal
                                <ArrowRight size={18} />
                            </button>

                            <a
                                href="#framework"
                                className="secondary-button"
                            >
                                Explore Framework
                            </a>

                        </div>

                        {/* ---------- HERO STATS ---------- */}
                        <div className="hero-stats">

                            <div className="hero-stat">
                                <div className="stat-icon">
                                    <Activity size={17} />
                                </div>

                                <div>
                                    <strong>24/7</strong>
                                    <span>Monitoring</span>
                                </div>
                            </div>

                            <div className="hero-stat">
                                <div className="stat-icon">
                                    <BrainCircuit size={17} />
                                </div>

                                <div>
                                    <strong>AI</strong>
                                    <span>Risk Intelligence</span>
                                </div>
                            </div>

                            <div className="hero-stat">
                                <div className="stat-icon">
                                    <MapPin size={17} />
                                </div>

                                <div>
                                    <strong>GPS</strong>
                                    <span>Verified Presence</span>
                                </div>
                            </div>

                        </div>

                    </div>


                    {/* ---------- HERO VISUAL ---------- */}
                    <div className="hero-visual">

                        <div className="visual-glow"></div>

                        <div className="inspection-panel">

                            <div className="panel-header">

                                <div>
                                    <span className="panel-label">
                                        LIVE OVERSIGHT
                                    </span>

                                    <h3>Inspection Overview</h3>
                                </div>

                                <div className="live-status">
                                    <span></span>
                                    Active
                                </div>

                            </div>


                            {/* ---------- MAP ---------- */}
                            <div className="map-card">

                                <div className="map-grid"></div>

                                <div className="map-route"></div>

                                <div className="map-marker marker-one">
                                    <MapPin size={16} />
                                </div>

                                <div className="map-marker marker-two">
                                    <MapPin size={16} />
                                </div>

                                <div className="map-current-location">
                                    <div className="location-pulse"></div>
                                    <div className="location-dot"></div>
                                </div>

                                <div className="map-label">
                                    <Navigation size={13} />
                                    Pune, Maharashtra
                                </div>

                            </div>


                            {/* ---------- INSPECTION INFO ---------- */}
                            <div className="inspection-info">

                                <div className="info-item">
                                    <span>Inspection</span>
                                    <strong>Surprise Visit</strong>
                                </div>

                                <div className="info-item">
                                    <span>GPS Status</span>

                                    <strong className="verified">
                                        <CheckCircle2 size={14} />
                                        Verified
                                    </strong>
                                </div>

                            </div>


                            {/* ---------- RISK ---------- */}
                            <div className="risk-card">

                                <div className="risk-heading">
                                    <div className="risk-icon">
                                        <AlertTriangle size={16} />
                                    </div>

                                    <div>
                                        <span>AI RISK ASSESSMENT</span>
                                        <strong>Institution Risk</strong>
                                    </div>
                                </div>

                                <div className="risk-score">
                                    <strong>78</strong>
                                    <span>HIGH</span>
                                </div>

                            </div>

                        </div>


                        {/* floating verification card */}
                        <div className="floating-verification">

                            <div className="verification-icon">
                                <CheckCircle2 size={17} />
                            </div>

                            <div>
                                <strong>Location Verified</strong>
                                <span>Inspector presence confirmed</span>
                            </div>

                        </div>

                    </div>

                </section>


                {/* ==================== FRAMEWORK ==================== */}
                <section
                    className="framework-section"
                    id="framework"
                >

                    <div className="section-heading">

                        <span className="section-eyebrow">
                            ONE PLATFORM. THREE ROLES.
                        </span>

                        <h2>Role-Based Access</h2>

                        <p>
                            Every stakeholder gets the tools required to
                            monitor, inspect, and maintain institutional
                            compliance.
                        </p>

                    </div>


                    <div
                        className="role-grid"
                        id="portals"
                    >

                        {/* ADMIN */}
                        <button
                            className="role-card"
                            onClick={() => navigate("/login?role=admin")}
                        >

                            <div className="role-card-top">

                                <div className="role-icon">
                                    <Landmark size={22} />
                                </div>

                                <ArrowRight
                                    className="role-arrow"
                                    size={19}
                                />

                            </div>

                            <div className="role-number">01</div>

                            <h3>Government Admin Portal</h3>

                            <p>
                                Risk analytics, institute monitoring,
                                inspection oversight and inspector dispatch.
                            </p>

                            <div className="role-features">
                                <span>
                                    <CheckCircle2 size={14} />
                                    Risk Intelligence
                                </span>

                                <span>
                                    <CheckCircle2 size={14} />
                                    Inspector Dispatch
                                </span>
                            </div>

                        </button>


                        {/* INSPECTOR */}
                        <button
                            className="role-card"
                            onClick={() => navigate("/login?role=inspector")}
                        >

                            <div className="role-card-top">

                                <div className="role-icon">
                                    <UserRoundCheck size={22} />
                                </div>

                                <ArrowRight
                                    className="role-arrow"
                                    size={19}
                                />

                            </div>

                            <div className="role-number">02</div>

                            <h3>Field Inspector Portal</h3>

                            <p>
                                Surprise inspections, geo-verification,
                                evidence capture and inspection reporting.
                            </p>

                            <div className="role-features">
                                <span>
                                    <CheckCircle2 size={14} />
                                    GPS Verification
                                </span>

                                <span>
                                    <CheckCircle2 size={14} />
                                    Evidence Capture
                                </span>
                            </div>

                        </button>


                        {/* INSTITUTE */}
                        <button
                            className="role-card"
                            onClick={() => navigate("/login?role=institute")}
                        >

                            <div className="role-card-top">

                                <div className="role-icon">
                                    <Building2 size={22} />
                                </div>

                                <ArrowRight
                                    className="role-arrow"
                                    size={19}
                                />

                            </div>

                            <div className="role-number">03</div>

                            <h3>Institute Portal</h3>

                            <p>
                                Inspection history, compliance status,
                                findings and institutional risk trends.
                            </p>

                            <div className="role-features">
                                <span>
                                    <CheckCircle2 size={14} />
                                    Compliance Status
                                </span>

                                <span>
                                    <CheckCircle2 size={14} />
                                    Risk Trends
                                </span>
                            </div>

                        </button>

                    </div>

                </section>

            </main>


            {/* ==================== FOOTER ==================== */}
            <footer
                className="landing-footer"
                id="support"
            >
                <div className="brand">
                    <div className="brand-icon">
                        <img src="/nirikshan.jpg" alt="Logo" />
                    </div>

                    <div className="brand-text">
                        <span className="brand-name">NIRIKSHAN</span>
                        <span className="brand-subtitle">
                            Intelligent institutional monitoring and surprise
                            inspection framework.
                        </span>
                    </div>
                </div>

                <span>
                    Government Technology Platform
                </span>

            </footer>

        </div>
    );
}

export default Landing;