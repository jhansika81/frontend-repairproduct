
import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";
import { clearAuthSession, getAuthToken, setAuthSession } from "./auth";
import { apiFetch } from "./api";
import "./App.css";

function ProtectedRoute({ children }) {
  return getAuthToken() ? children : <Navigate to="/" replace />;
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isRegister, setIsRegister] = useState(false);
  const [isCheckingApplication, setIsCheckingApplication] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [document, setDocument] = useState(null);
  const [role, setRole] = useState("CUSTOMER");
  const [message, setMessage] = useState(location.state?.message || "");
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const submitForm = async (e) => {
    e.preventDefault();
    setMessage("");
    setApplicationStatus(null);
    setLoading(true);

    try {
      const isTechnicianApplication = isRegister && role === "TECHNICIAN";
      const isApplicationStatusCheck = isCheckingApplication && !isRegister;
      if (!isRegister && !isApplicationStatusCheck) {
        clearAuthSession();
      }
      const body = isTechnicianApplication ? new FormData() : {
        ...(isRegister ? { name, phone, role: "CUSTOMER" } : {}),
        email,
        password,
      };
      if (isTechnicianApplication) {
        body.append("name", name);
        body.append("email", email);
        body.append("phone", phone);
        body.append("password", password);
        body.append("address", address);
        body.append("serviceLocation", serviceLocation);
        body.append("skills", skills);
        body.append("yearsExperience", yearsExperience);
        body.append("qualifications", qualifications);
        if (document) body.append("document", document);
      }
      const response = await apiFetch(
        isApplicationStatusCheck
          ? "http://localhost:8080/auth/application-status"
          : isRegister
          ? `http://localhost:8080/auth/${isTechnicianApplication ? "apply" : "register"}`
          : "http://localhost:8080/auth/login",
        {
          method: "POST",
          ...(isTechnicianApplication
            ? { body }
            : {
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              }),
        }
      );
      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      if (isApplicationStatusCheck) {
        const statusMessages = {
          PENDING: "Your application is awaiting admin approval.",
          APPROVED: "Congratulations! Your technician application has been approved. You can now log in to your technician dashboard.",
          REJECTED: "Your technician application was rejected.",
        };
        setApplicationStatus(data.status);
        setMessage([
          statusMessages[data.status] || "Unable to determine your application status.",
          data.status === "REJECTED" && data.rejectionReason
            ? `Reason: ${data.rejectionReason}`
            : "",
        ].filter(Boolean).join(" "));
      } else if (isRegister) {
        setMessage(isTechnicianApplication
          ? data.message
          : "Account created successfully! Please log in.");
        setIsRegister(false);
        setPassword("");
      } else {
        if (!data.token || !data.user?.id || !data.user?.email || !data.user?.role) {
          throw new Error("The server returned an invalid login response.");
        }
        setAuthSession(data.token, data.user);
        navigate("/dashboard", { replace: true });
      }
    } catch (error) {
      setMessage(error instanceof TypeError
        ? "Unable to connect to the server. Check that the backend is running."
        : error.message || "Unable to complete the request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-showcase">
        <div className="brand">
          <div className="brand-icon">R</div>
          <span>RepairCare</span>
        </div>

        <div className="showcase-content">
          <span className="eyebrow">SMART REPAIR MANAGEMENT</span>
          <h1>
            Keep your products
            <br />
            <span>in good hands.</span>
          </h1>
          <p>
            One simple place to manage repairs, track service requests,
            and keep your product warranties organized.
          </p>

          <div className="showcase-features">
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Track repair requests in real time</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Keep product details organized</span>
            </div>
            <div className="feature-item">
              <span className="feature-check">✓</span>
              <span>Manage service and warranty information</span>
            </div>
          </div>
        </div>

        <div className="showcase-footer">
          Product care, made simple.
        </div>
        <div className="decor-circle decor-circle-one" />
        <div className="decor-circle decor-circle-two" />
      </section>

      <section className="auth-form-section">
        <div className="auth-form-wrapper">
          <div className="mobile-brand">
            <div className="brand-icon">R</div>
            <span>RepairCare</span>
          </div>

          <div className="form-heading">
            <span className="form-label">
              {isRegister
                ? "GET STARTED"
                : isCheckingApplication
                  ? "APPLICATION STATUS"
                  : "WELCOME BACK"}
            </span>
            <h2>{isRegister
              ? "Create your account"
              : isCheckingApplication
                ? "Check your technician application"
                : "Sign in to your account"}</h2>
            <p>
              {isRegister
                ? role === "TECHNICIAN"
                  ? "Submit your details for technician verification."
                  : "Enter your details to get started."
                : isCheckingApplication
                  ? "Enter the email and password you used when applying."
                  : "Enter your details to continue to your dashboard."}
            </p>
          </div>

          <form className="auth-form" onSubmit={submitForm}>
            {isRegister && (
              <div className="form-group">
                <label htmlFor="name">Full name</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={150}
                  required
                />
              </div>
            )}

            {isRegister && (
              <div className="form-group">
                <label htmlFor="phone">Phone number</label>
                <input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="Enter your phone number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={40}
                  required
                />
              </div>
            )}

            {isRegister && role === "TECHNICIAN" && (
              <>
                <div className="form-group">
                  <label htmlFor="address">Residential address</label>
                  <textarea id="address" rows={2} maxLength={1000} value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Enter your address" required />
                </div>
                <div className="form-group">
                  <label htmlFor="serviceLocation">Service location</label>
                  <input id="serviceLocation" value={serviceLocation}
                    maxLength={1500}
                    onChange={(e) => setServiceLocation(e.target.value)}
                    placeholder="Cities or areas you serve" required />
                </div>
                <div className="form-group">
                  <label htmlFor="skills">Technical skills and specializations</label>
                  <textarea id="skills" rows={3} value={skills}
                    maxLength={2000}
                    onChange={(e) => setSkills(e.target.value)}
                    placeholder="e.g. laptops, mobile devices, home appliances" required />
                </div>
                <div className="form-group">
                  <label htmlFor="yearsExperience">Years of experience</label>
                  <input id="yearsExperience" type="number" min="0" max="60"
                    value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)}
                    required />
                </div>
                <div className="form-group">
                  <label htmlFor="qualifications">Certificates or qualifications</label>
                  <textarea id="qualifications" rows={2} maxLength={2000} value={qualifications}
                    onChange={(e) => setQualifications(e.target.value)}
                    placeholder="List relevant certifications" />
                </div>
                <div className="form-group">
                  <label htmlFor="identityDocument">Identity document (optional)</label>
                  <input id="identityDocument" type="file" accept=".pdf,.png,.jpg,.jpeg"
                    onChange={(e) => setDocument(e.target.files?.[0] || null)} />
                  <small>PDF, PNG, or JPEG; maximum 5 MB.</small>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className="form-group">
                <label htmlFor="role">Account type</label>
                <select
                  id="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="CUSTOMER">Customer</option>
                  <option value="TECHNICIAN">Technician</option>
                </select>
              </div>
            )}

            {message && (
              <div
                className={`form-message ${
                  applicationStatus === "REJECTED"
                    ? "error"
                    : applicationStatus === "PENDING" || applicationStatus === "APPROVED" ||
                      message.toLowerCase().includes("successfully") ||
                      message.toLowerCase().includes("awaiting verification") ||
                      message.toLowerCase().includes("congratulations")
                    ? "success"
                    : "error"
                }`}
                role="status"
              >
                {message}
              </div>
            )}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : isCheckingApplication
                    ? "Check status"
                  : "Sign in"}
              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="auth-switch">
            {isRegister
              ? "Already have an account?"
              : isCheckingApplication
                ? "Already know your status?"
                : "Don't have an account?"}
            <button
              type="button"
              onClick={() => {
                if (isRegister) {
                  setIsRegister(false);
                } else if (isCheckingApplication) {
                  setIsCheckingApplication(false);
                } else {
                  setIsRegister(true);
                }
                setMessage("");
              }}
            >
              {isRegister ? "Sign in" : isCheckingApplication ? "Sign in" : "Create account"}
            </button>
          </div>
          {!isRegister && (
            <div className="auth-switch">
              <span>
                {isCheckingApplication
                  ? "Want to check your application again?"
                  : "Applied as a technician?"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCheckingApplication(!isCheckingApplication);
                  setMessage("");
                }}
              >
                {isCheckingApplication ? "Check status" : "Check application status"}
              </button>
            </div>
          )}

          <p className="auth-note">
            Secure access to your product care workspace.
          </p>
        </div>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

export default App;
