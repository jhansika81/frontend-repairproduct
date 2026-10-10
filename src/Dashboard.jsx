
import { useEffect, useState } from "react";
import Products from "./Products";
import Repairs from "./Repairs";
import TechnicianRepairs from "./TechnicianRepairs";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./api";
import { clearAuthSession, getCurrentUser, setAuthSession, setAuthUser } from "./auth";

function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(getCurrentUser);
  const [page, setPage] = useState("dashboard");
  const [dashboardStats, setDashboardStats] = useState({
    customers: 0,
    technicians: 0,
    products: 0,
    repairs: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
  });
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch("http://localhost:8080/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          const error = new Error(
            response.status === 401 || response.status === 403
              ? "Your session has expired. Please sign in again."
              : `Unable to verify your session (HTTP ${response.status}).`
          );
          error.status = response.status;
          throw error;
        }
        return response.json();
      })
      .then((currentUser) => {
        if (!active) return;
        if (!currentUser?.id || !currentUser?.role || !currentUser?.email) {
          throw new Error("The server returned an invalid authenticated profile.");
        }
        setAuthUser(currentUser);
        setUser(currentUser);
        setDashboardError("");
        setSessionVerified(true);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          clearAuthSession();
          navigate("/", {
            replace: true,
            state: { message: error.message },
          });
          return;
        }
        setDashboardError(error instanceof TypeError
          ? "Unable to connect to the server. Check that the backend is running."
          : error.message || "Unable to verify your session.");
        setSessionVerified(false);
      });
    return () => { active = false; };
  }, [navigate]);

  useEffect(() => {
    if (!sessionVerified || !user || user.role !== "ADMIN") {
      return;
    }

    async function loadDashboardStats() {
      try {
        setDashboardLoading(true);

        const [customersResponse, techniciansResponse, productsResponse, repairsResponse] = await Promise.all([
          apiFetch("http://localhost:8080/users/customers"),
          apiFetch("http://localhost:8080/users/technicians"),
          apiFetch("http://localhost:8080/products/all"),
          apiFetch("http://localhost:8080/repairs/admin/all"),
        ]);

        const failedResponse = [
          customersResponse,
          techniciansResponse,
          productsResponse,
          repairsResponse,
        ].find((response) => !response.ok);
        if (failedResponse) {
          throw new Error(failedResponse.status === 401
            ? "Your session has expired. Please sign in again."
            : failedResponse.status === 403
              ? "You are not authorized to view the dashboard summary."
              : `Unable to load dashboard summary (HTTP ${failedResponse.status}).`);
        }

        const [customers, technicians, products, repairs] = await Promise.all([
          customersResponse.json(),
          techniciansResponse.json(),
          productsResponse.json(),
          repairsResponse.json(),
        ]);

        const pending = repairs.filter((repair) => String(repair.status).toUpperCase() === "REQUESTED").length;
        const inProgress = repairs.filter((repair) => String(repair.status).toUpperCase() === "IN_PROGRESS").length;
        const completed = repairs.filter((repair) => String(repair.status).toUpperCase() === "COMPLETED").length;

        setDashboardStats({
          customers: Array.isArray(customers) ? customers.length : 0,
          technicians: Array.isArray(technicians) ? technicians.length : 0,
          products: Array.isArray(products) ? products.length : 0,
          repairs: Array.isArray(repairs) ? repairs.length : 0,
          pending,
          inProgress,
          completed,
        });
      } catch (error) {
        setDashboardError(error instanceof TypeError
          ? "Unable to connect to the server while loading the dashboard."
          : error.message || "Unable to load dashboard summary.");
      } finally {
        setDashboardLoading(false);
      }
    }

    loadDashboardStats();
  }, [user, sessionVerified]);

  if (!sessionVerified) {
    return (
      <main className="dashboard-main">
        <div className="dashboard-body">
          <p role={dashboardError ? "alert" : "status"}>
            {dashboardError || "Verifying your session..."}
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return <h2>Please login first</h2>;
  }

  if (user.role === "TECHNICIAN" && user.applicationStatus !== "APPROVED") {
    return <TechnicianApplicationStatusPage user={user} onUpdate={(updatedUser) => {
      setAuthUser(updatedUser);
      setUser(updatedUser);
    }} />;
  }

  const logout = async () => {
    let message;
    try {
      const response = await apiFetch("http://localhost:8080/auth/logout", { method: "POST" });
      if (!response.ok) {
        message = `The server could not confirm logout (HTTP ${response.status}).`;
      }
    } catch {
      message = "Unable to contact the server to end the session.";
    }
    clearAuthSession();
    navigate("/", { replace: true, state: message ? { message } : null });
  };

  const menus = {
    CUSTOMER: [
      { id: "dashboard", label: "Overview", icon: "⌂" },
      { id: "products", label: "My Products", icon: "▣" },
      { id: "warranty", label: "Warranty", icon: "✓" },
      { id: "repairs", label: "Repair Requests", icon: "⚒" },
      { id: "history", label: "Service History", icon: "◷" },
      { id: "profile", label: "My Profile", icon: "○" }
    ],
    TECHNICIAN: [
      { id: "dashboard", label: "Overview", icon: "⌂" },
      { id: "assigned", label: "Assigned Repairs", icon: "⚒" },
      { id: "history", label: "Repair History", icon: "◷" },
      { id: "profile", label: "My Profile", icon: "○" }
    ],
    ADMIN: [
      { id: "dashboard", label: "Overview", icon: "⌂" },
      { id: "customers", label: "Customers", icon: "♙" },
      { id: "technicians", label: "Technicians", icon: "⚒" },
      { id: "applications", label: "Technician Applications", icon: "✓" },
      { id: "products", label: "Products", icon: "▣" },
      { id: "warranty", label: "Warranty", icon: "✓" },
      { id: "repairs", label: "Repair Requests", icon: "◷" },
      { id: "payments", label: "Payments", icon: "$" },
      { id: "reports", label: "Reports", icon: "▤" }
    ]
  };

  const titles = {
    dashboard: "Dashboard Overview",
    products: "My Products",
    warranty: "Warranty Management",
    repairs: "Repair Requests",
    history: user.role === "TECHNICIAN" ? "Repair History" : "Service History",
    profile: "My Profile",
    assigned: "Assigned Repairs",
    customers: "Customer Management",
    technicians: "Technician Management",
    applications: "Technician Applications",
    payments: "Payments",
    reports: "Reports"
  };

  const currentMenus = menus[user.role] || menus.CUSTOMER;

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <div className="dashboard-brand-icon">R</div>
          <div>
            <strong>RepairCare</strong>
            <span>Service management</span>
          </div>
        </div>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {currentMenus.map((item) => (
            <button
              key={item.id}
              className={page === item.id ? "sidebar-link active" : "sidebar-link"}
              onClick={() => setPage(item.id)}
            >
              <span className="sidebar-icon">{item.icon}</span>
              {item.label}
              {page === item.id && <span className="active-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-avatar">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user-info">
            <strong>{user.name || "User"}</strong>
            <span>{user.role}</span>
          </div>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span className="header-breadcrumb">Workspace / {titles[page]}</span>
            <h2>{titles[page]}</h2>
          </div>
          <div className="header-user">
            <div className="header-avatar">
              {(user.name || user.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{user.name || "User"}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        </header>

        <div className="dashboard-body">
          {dashboardError && (
            <div className="form-message error" role="alert">
              {dashboardError}
            </div>
          )}
          {page === "dashboard" && (
            <>
              {user.role === "TECHNICIAN" && user.applicationStatus === "APPROVED" && (
                <div className="form-message success" role="status">
                  Congratulations! Your technician application has been approved. You can now log in to your technician dashboard.
                </div>
              )}
              <section className="welcome-banner">
                <div>
                  <span className="welcome-tag">YOUR SERVICE WORKSPACE</span>
                  <h1>Welcome back, {user.name || "there"}!</h1>
                  <p>
                    {user.role === "CUSTOMER"
                      ? "Keep track of your products, warranties and repair requests in one place."
                      : user.role === "TECHNICIAN"
                      ? "Review your assigned repairs and keep service work moving."
                      : "Manage customers, products, technicians and service requests."}
                  </p>
                </div>
                <div className="welcome-art">✳</div>
              </section>

              {user.role === "ADMIN" && (
                <section className="dashboard-overview">
                  {[
                    { label: "Customers", value: dashboardStats.customers, accent: "overview-icon-1" },
                    { label: "Technicians", value: dashboardStats.technicians, accent: "overview-icon-2" },
                    { label: "Products", value: dashboardStats.products, accent: "overview-icon-3" },
                    { label: "Repair Requests", value: dashboardStats.repairs, accent: "overview-icon-4" },
                    { label: "Pending", value: dashboardStats.pending, accent: "overview-icon-5" },
                    { label: "In Progress", value: dashboardStats.inProgress, accent: "overview-icon-6" },
                    { label: "Completed", value: dashboardStats.completed, accent: "overview-icon-7" },
                  ].map((card) => (
                    <div key={card.label} className="overview-card">
                      <span className={`overview-icon ${card.accent}`}>✓</span>
                      <span className="overview-card-title">{card.label}</span>
                      <span className="overview-card-footer">
                        {dashboardLoading ? "Loading..." : card.value}
                      </span>
                    </div>
                  ))}
                </section>
              )}

              <div className="section-heading">
                <div>
                  <h3>Your workspace</h3>
                  <p>Quick access to your service management tools.</p>
                </div>
              </div>

              <section className="dashboard-overview">
                {currentMenus
                  .filter((item) => item.id !== "dashboard" && item.id !== "profile")
                  .slice(0, 3)
                  .map((item, index) => (
                    <button
                      key={item.id}
                      className="overview-card"
                      onClick={() => setPage(item.id)}
                    >
                      <span className={`overview-icon overview-icon-${index + 1}`}>
                        {item.icon}
                      </span>
                      <span className="overview-card-title">{item.label}</span>
                      <span className="overview-card-footer">
                        Open section <span>→</span>
                      </span>
                    </button>
                  ))}
              </section>

              <section className="dashboard-info-panel">
                <div className="info-panel-icon">✓</div>
                <div>
                  <h3>Everything in one place</h3>
                  <p>
                    Select a section from the sidebar to manage your account
                    and access the tools available for your role.
                  </p>
                </div>
              </section>
            </>
          )}

          {page === "products" && <Products />}
          {page === "repairs" && (
            user.role === "ADMIN" ? <AdminRepairs /> : <Repairs />
          )}
          {page === "assigned" && <TechnicianRepairs />}
          {page === "warranty" && <Warranty />}
          {page === "history" && (
            user.role === "TECHNICIAN"
              ? <TechnicianHistory />
              : <CustomerServiceHistory />
          )}
          {page === "profile" && <Profile user={user} onUpdate={(updatedUser) => setUser(updatedUser)} />}
          {page === "customers" && <Customers />}
          {page === "technicians" && <TechnicianApplications />}
          {page === "applications" && <TechnicianApplications />}

          {page === "payments" && (
            <section className="dashboard-content">
              <h3>Payments</h3>
              <p>Payment management will be added next.</p>
            </section>
          )}

          {page === "reports" && (
            <section className="dashboard-content">
              <h3>Reports</h3>
              <p>System reports will be added next.</p>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

function TechnicianApplicationStatusPage({ user, onUpdate }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function reapply() {
    setSubmitting(true);
    setMessage("");
    try {
      const response = await apiFetch("http://localhost:8080/auth/reapply", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to resubmit application");
      onUpdate(data);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-form-section">
        <div className="auth-form-wrapper">
          <div className="mobile-brand">
            <div className="brand-icon">R</div>
            <span>RepairCare</span>
          </div>
          <div className="form-heading">
            <span className="form-label">TECHNICIAN VERIFICATION</span>
            <h2>Application {user.applicationStatus === "PENDING" ? "under review" : "not approved"}</h2>
            <p>{user.applicationStatus === "PENDING"
              ? "Your technician application is awaiting verification. Technician tools and repair assignments will be available after approval."
              : "Your technician application was rejected. Review the reason below and contact support if you need help."}</p>
          </div>
          {user.rejectionReason && <div className="form-message error">{user.rejectionReason}</div>}
          {message && <div className="form-message error">{message}</div>}
          {user.applicationStatus === "REJECTED" && (
            <button className="auth-submit" disabled={submitting} onClick={reapply}>
              {submitting ? "Submitting..." : "Reapply for verification"} <span>→</span>
            </button>
          )}
          <button className="auth-switch" onClick={() => {
            clearAuthSession();
            window.location.assign("/");
          }}>Sign out</button>
        </div>
      </section>
    </main>
  );
}

function Profile({ user, onUpdate }) {
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [message, setMessage] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setMessage("");
    try {
      const response = await apiFetch("http://localhost:8080/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update profile");
      if (!data.token || !data.user) throw new Error("The server returned an invalid profile response.");
      setAuthSession(data.token, data.user);
      onUpdate(data.user);
      setMessage("Contact details updated.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="dashboard-content">
      <div className="profile-heading">
        <div className="profile-avatar">
          {(user.name || "U").charAt(0).toUpperCase()}
        </div>
        <div>
          <h3>{user.name}</h3>
          <p>{user.role} account</p>
        </div>
      </div>
      <form className="profile-details" onSubmit={saveProfile}>
        <div><span>Full name</span><strong>{user.name}</strong></div>
        <label><span>Email address</span><input type="email" value={email}
          onChange={(event) => setEmail(event.target.value)} required /></label>
        <label><span>Phone number</span><input type="tel" value={phone}
          onChange={(event) => setPhone(event.target.value)} required /></label>
        <div><span>Account role</span><strong>{user.role}</strong></div>
        {message && <p role="status">{message}</p>}
        <button className="product-primary-btn" type="submit">Save contact details</button>
      </form>
    </section>
  );
}

function Warranty() {
  const user = getCurrentUser();
  const userId = user?.id;
  const userRole = user?.role;
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState(user?.role === "CUSTOMER"
    ? "Loading warranty details..."
    : "Warranty details are available for customers.");

  useEffect(() => {
    async function loadWarranty() {
      try {
        const response = await apiFetch(
          `http://localhost:8080/warranty/user/${userId}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error("Unable to load warranty details");
        setProducts(data);
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      }
    }
    if (userId && userRole === "CUSTOMER") loadWarranty();
  }, [userId, userRole]);

  return (
    <section className="dashboard-content">
      <h3>Warranty Details</h3>
      {message && <p>{message}</p>}
      {!message && products.length === 0 && <p>No registered products found.</p>}
      {products.map((product) => (
        <div className="data-card" key={product.id}>
          <h4>{product.name}</h4>
          <p><strong>Brand:</strong> {product.brand}</p>
          <p><strong>Purchase Date:</strong> {product.purchaseDate}</p>
          <p><strong>Warranty Period:</strong> {product.warrantyPeriod} months</p>
          <p><strong>Warranty Status:</strong> {product.warrantyStatus}</p>
        </div>
      ))}
    </section>
  );
}

function CustomerServiceHistory() {
  const user = getCurrentUser();
  const userId = user?.id;
  const [repairs, setRepairs] = useState([]);
  const [message, setMessage] = useState("Loading service history...");

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await apiFetch(
          `http://localhost:8080/repairs/customer/${userId}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error("Unable to load service history");
        setRepairs(data.filter((repair) =>
          ["COMPLETED", "DELIVERED"].includes(repair.status)
        ));
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      }
    }
    if (userId) loadHistory();
  }, [userId]);

  return (
    <section className="dashboard-content">
      <h3>Service History</h3>
      {message && <p>{message}</p>}
      {!message && repairs.length === 0 && <p>No completed services found.</p>}
      {repairs.map((repair) => (
        <div className="data-card" key={repair.id}>
          <h4>Repair #{repair.id}</h4>
          <p>Product: {repair.product?.name || "Unknown"}</p>
          <p>Issue: {repair.issue}</p>
          <p>Status: {repair.status}</p>
          <p>Request Date: {repair.requestDate}</p>
        </div>
      ))}
    </section>
  );
}

function TechnicianHistory() {
  const user = getCurrentUser();
  const userId = user?.id;
  const userRole = user?.role;
  const [repairs, setRepairs] = useState([]);
  const [message, setMessage] = useState("Loading repair history...");

  useEffect(() => {
    async function loadHistory() {
      try {
        const response = await apiFetch(
          `http://localhost:8080/repairs/technician/${userId}`
        );
        const data = await response.json();
        if (!response.ok) throw new Error("Unable to load repair history");
        setRepairs(data.filter((repair) =>
          ["COMPLETED", "DELIVERED"].includes(repair.status)
        ));
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      }
    }
    if (userId && userRole === "TECHNICIAN") loadHistory();
  }, [userId, userRole]);

  return (
    <section className="dashboard-content">
      <h3>Completed Repair History</h3>
      {message && <p>{message}</p>}
      {!message && repairs.length === 0 && <p>No completed repairs found.</p>}
      {repairs.map((repair) => (
        <div className="data-card" key={repair.id}>
          <h4>Repair #{repair.id}</h4>
          <p>Product: {repair.product?.name || "Unknown"}</p>
          <p>Issue: {repair.issue}</p>
          <p>Status: {repair.status}</p>
          <p>Request Date: {repair.requestDate}</p>
        </div>
      ))}
    </section>
  );
}

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [message, setMessage] = useState("Loading customers...");

  useEffect(() => {
    async function loadCustomers() {
      try {
        const response = await apiFetch("http://localhost:8080/users/customers");
        const data = await response.json();
        if (!response.ok) throw new Error("Unable to load customers");
        setCustomers(data);
        setMessage("");
      } catch (error) {
        setMessage(error.message);
      }
    }
    loadCustomers();
  }, []);

  return (
    <section className="dashboard-content">
      <h3>Customers</h3>
      {message && <p>{message}</p>}
      {customers.map((customer) => (
        <div className="data-card" key={customer.id}>
          <h4>{customer.name}</h4>
          <p>{customer.email}</p>
        </div>
      ))}
    </section>
  );
}

function TechnicianApplications() {
  const [applications, setApplications] = useState([]);
  const [reasons, setReasons] = useState({});
  const [filter, setFilter] = useState("ALL");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [documentLoading, setDocumentLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    if (documentUrl) URL.revokeObjectURL(documentUrl);
  }, [documentUrl]);

  useEffect(() => {
    let active = true;
    async function loadApplications() {
      setLoading(true);
      try {
        const response = await apiFetch("http://localhost:8080/technician-applications");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.message || `Unable to load technician applications (HTTP ${response.status}).`);
        }
        if (!active) return;
        setApplications(data);
        setSelectedApplication((selected) =>
          selected ? data.find((item) => item.id === selected.id) || selected : null
        );
        setMessage(data.length === 0 ? "No technician applications have been submitted." : "");
      } catch (error) {
        if (active) setMessage(error.message || "Unable to load technician applications.");
      } finally {
        if (active) setLoading(false);
      }
    }
    loadApplications();
    return () => { active = false; };
  }, []);

  async function updateApplication(applicationId, action) {
    const reason = reasons[applicationId]?.trim();
    if (action === "reject" && !reason) {
      setMessage("Enter a rejection reason before rejecting an application.");
      return;
    }
    try {
      setUpdatingId(applicationId);
      setMessage("");
      const response = await apiFetch(
        `http://localhost:8080/technician-applications/${applicationId}/${action}`,
        {
          method: "POST",
          ...(action === "reject"
            ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }
            : {}),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to update application");
      setApplications((current) => current.map((application) =>
        application.id === applicationId ? data : application
      ));
      setSelectedApplication(data);
      setMessage(`Application ${action === "approve" ? "approved" : "rejected"} and technician details refreshed.`);
      const refreshed = await apiFetch("http://localhost:8080/technician-applications");
      const applicationsData = await refreshed.json();
      if (!refreshed.ok) {
        throw new Error(applicationsData.message || "Status updated, but the application list could not be refreshed.");
      }
      setApplications(applicationsData);
      setSelectedApplication(applicationsData.find((application) => application.id === applicationId) || data);
    } catch (error) {
      setMessage(error.message || "Unable to update application.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function openDocument(application) {
    setDocumentLoading(true);
    setMessage("");
    try {
      const response = await apiFetch(
        `http://localhost:8080/technician-applications/${application.id}/document`
      );
      if (!response.ok) {
        throw new Error(response.status === 404
          ? "The verification document is unavailable."
          : response.status === 403
            ? "You are not authorized to view this document."
            : `Unable to load the verification document (HTTP ${response.status}).`);
      }
      const blobUrl = URL.createObjectURL(await response.blob());
      setDocumentUrl(blobUrl);
    } catch (error) {
      setMessage(error.message || "Unable to load the verification document.");
    } finally {
      setDocumentLoading(false);
    }
  }

  const visibleApplications = applications.filter((application) =>
    filter === "ALL" || application.status === filter
  );

  return (
    <section className="dashboard-content">
      <h3>Technician Applications and Management</h3>
      {message && <p role="status">{message}</p>}
      <div className="assign-row">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
          <button
            key={status}
            type="button"
            className={filter === status ? "sidebar-link active" : "sidebar-link"}
            onClick={() => setFilter(status)}
          >
            {status === "ALL" ? "All applications" : `${status[0]}${status.slice(1).toLowerCase()}`}
          </button>
        ))}
      </div>
      {loading && <p role="status">Loading technician applications...</p>}
      {!loading && visibleApplications.length === 0 && (
        <p>No {filter === "ALL" ? "" : filter.toLowerCase() + " "}technician applications found.</p>
      )}
      {visibleApplications.map((application) => (
        <article className="data-card" key={application.id}>
          <h4>{application.name}</h4>
          <p><strong>Email:</strong> {application.email}</p>
          <p><strong>Technician ID:</strong> {application.userId ?? "Unavailable"}</p>
          <p><strong>Status:</strong> {application.status}</p>
          <div className="assign-row">
            <button type="button" onClick={() => {
              setSelectedApplication(application);
              setDocumentUrl("");
            }}>View details</button>
            {application.status === "PENDING" && (
              <>
                <input type="text" maxLength={1000} placeholder="Reason required to reject"
                  value={reasons[application.id] || ""}
                  onChange={(event) => setReasons({ ...reasons, [application.id]: event.target.value })} />
                <button disabled={updatingId === application.id}
                  onClick={() => updateApplication(application.id, "approve")}>
                  {updatingId === application.id ? "Updating..." : "Approve"}
                </button>
                <button disabled={updatingId === application.id}
                  onClick={() => updateApplication(application.id, "reject")}>
                  Reject
                </button>
              </>
            )}
          </div>
        </article>
      ))}
      {selectedApplication && (
        <section className="dashboard-content">
          <h3>Technician details</h3>
          <p><strong>Full name:</strong> {selectedApplication.name || "Not provided"}</p>
          <p><strong>Technician ID:</strong> {selectedApplication.userId ?? "Unavailable"}</p>
          <p><strong>Email:</strong> {selectedApplication.email || "Not provided"}</p>
          <p><strong>Phone:</strong> {selectedApplication.phone || "Not provided"}</p>
          <p><strong>Address:</strong> {selectedApplication.address || "Not provided"}</p>
          <p><strong>Skills and specialization:</strong> {selectedApplication.skills || "Not provided"}</p>
          <p><strong>Years of experience:</strong> {selectedApplication.yearsExperience ?? "Unavailable"}</p>
          <p><strong>Qualifications:</strong> {selectedApplication.qualifications || "Not provided"}</p>
          <p><strong>Service categories:</strong> Not separately collected by the current application form.</p>
          <p><strong>Service location / coverage:</strong> {selectedApplication.serviceLocation || "Not provided"}</p>
          <p><strong>Submitted:</strong> {selectedApplication.submittedAt
            ? new Date(selectedApplication.submittedAt).toLocaleString()
            : "Unavailable"}</p>
          <p><strong>Application status:</strong> {selectedApplication.status || "Unavailable"}</p>
          {selectedApplication.approvedAt && (
            <p><strong>Approved:</strong> {new Date(selectedApplication.approvedAt).toLocaleString()}</p>
          )}
          {selectedApplication.rejectedAt && (
            <p><strong>Rejected:</strong> {new Date(selectedApplication.rejectedAt).toLocaleString()}</p>
          )}
          {selectedApplication.rejectionReason && (
            <p><strong>Rejection reason:</strong> {selectedApplication.rejectionReason}</p>
          )}
          {selectedApplication.documentName ? (
            <div>
              <p><strong>Verification document:</strong> {selectedApplication.documentName}</p>
              <p>Submitted; a separate verification result is not stored.</p>
              <button type="button" disabled={documentLoading}
                onClick={() => openDocument(selectedApplication)}>
                {documentLoading ? "Loading document..." : "Load verification document"}
              </button>
              {documentUrl && (
                <p><a href={documentUrl} target="_blank" rel="noreferrer">Open authorized document</a></p>
              )}
            </div>
          ) : (
            <p>No verification document was submitted.</p>
          )}
          <button type="button" onClick={() => {
            setSelectedApplication(null);
            setDocumentUrl("");
          }}>Close details</button>
        </section>
      )}
    </section>
  );
}

function AdminRepairs() {
  const [repairs, setRepairs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedTechnicians, setSelectedTechnicians] = useState({});

  useEffect(() => {
    loadRepairs();
    loadTechnicians();
  }, []);

  async function loadRepairs() {
    try {
      const response = await apiFetch("http://localhost:8080/repairs/admin/all");
      const data = await response.json();
      if (!response.ok) throw new Error("Unable to load repair requests");
      setRepairs(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadTechnicians() {
    try {
      const response = await apiFetch("http://localhost:8080/users/technicians");
      const data = await response.json();
      if (!response.ok) throw new Error("Unable to load technicians");
      setTechnicians(data);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function assignTechnician(repairId) {
    const technicianId = selectedTechnicians[repairId];
    if (!technicianId) {
      setMessage("Please select a technician.");
      return;
    }

    try {
      const response = await apiFetch(
        `http://localhost:8080/repairs/${repairId}/assign/${technicianId}`,
        { method: "PUT" }
      );
      if (!response.ok) throw new Error("Unable to assign technician");
      setMessage(`Technician assigned to repair #${repairId}.`);
      await loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  }

  return (
    <section className="dashboard-content">
      <h3>Repair Request Management</h3>
      {message && <p>{message}</p>}
      {repairs.length === 0 && <p>No repair requests found.</p>}
      {repairs.map((repair) => (
        <div className="data-card" key={repair.id}>
          <h4>Repair #{repair.id}</h4>
          <p><strong>Product:</strong> {repair.product?.name || "Unknown"}</p>
          <p><strong>Issue:</strong> {repair.issue}</p>
          <p><strong>Status:</strong> {repair.status}</p>
          <p><strong>Customer:</strong> {repair.customer?.name || "Unknown"}</p>
          <p><strong>Technician:</strong> {repair.technician?.name || "Not assigned"}</p>
          <div className="assign-row">
            <select
              value={selectedTechnicians[repair.id] || ""}
              onChange={(e) => setSelectedTechnicians({
                ...selectedTechnicians,
                [repair.id]: e.target.value
              })}
            >
              <option value="">Select technician</option>
              {technicians.map((technician) => (
                <option key={technician.id} value={technician.id}>
                  {technician.name}
                </option>
              ))}
            </select>
            <button onClick={() => assignTechnician(repair.id)}>
              Assign Technician
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

export default Dashboard;
