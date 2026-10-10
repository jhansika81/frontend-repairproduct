
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { getCurrentUser } from "./auth";
import RepairCommunication from "./RepairCommunication";
import "./App.css";

function Repairs() {
  const [user] = useState(() => {
    return getCurrentUser();
  });
  const [products, setProducts] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [productId, setProductId] = useState("");
  const [issue, setIssue] = useState("");
  const [description, setDescription] = useState("");
  const [serviceAddress, setServiceAddress] = useState("");
  const [preferredContactMethod, setPreferredContactMethod] = useState("PHONE");
  const [message, setMessage] = useState(user?.id ? "" : "Please login first.");
  const [messageType, setMessageType] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(Boolean(user?.id));
  const [loadingRepairs, setLoadingRepairs] = useState(Boolean(user?.id));
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const readResponse = async (response) => {
    const text = await response.text();
    let data = null;

    if (text.trim()) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const errorMessage =
        data && typeof data === "object"
          ? data.message || data.error
          : typeof data === "string"
            ? data
            : null;

      throw new Error(
        errorMessage || `Request failed with status ${response.status}`
      );
    }

    return data;
  };

  const loadRepairs = async (userId) => {
    setLoadingRepairs(true);

    try {
      const response = await apiFetch(
        `http://localhost:8080/repairs/customer/${userId}`
      );
      const data = await readResponse(response);

      if (!Array.isArray(data)) {
        throw new Error("The repairs API did not return a repair list.");
      }

      setRepairs(data);
    } catch (error) {
      setRepairs([]);
      setMessage(`Repair requests: ${error.message}`);
      setMessageType("error");
    } finally {
      setLoadingRepairs(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    apiFetch(`http://localhost:8080/products/user/${user.id}`)
      .then(readResponse)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("The products API did not return a product list.");
        setProducts(data);
        setProductId(data.length > 0 ? String(data[0].id) : "");
      })
      .catch((error) => {
        setProducts([]);
        setMessage(`Products: ${error.message}`);
        setMessageType("error");
      })
      .finally(() => setLoadingProducts(false));
    apiFetch(`http://localhost:8080/repairs/customer/${user.id}`)
      .then(readResponse)
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("The repairs API did not return a repair list.");
        setRepairs(data);
      })
      .catch((error) => {
        setRepairs([]);
        setMessage(`Repair requests: ${error.message}`);
        setMessageType("error");
      })
      .finally(() => setLoadingRepairs(false));
  }, [user?.id]);

  const createRepairRequest = async (e) => {
    e.preventDefault();

    if (!user?.id) {
      setMessage("Please login again.");
      setMessageType("error");
      return;
    }

    if (!productId) {
      setMessage("Please register and select a product first.");
      setMessageType("error");
      return;
    }

    if (!issue.trim() || !description.trim() || !serviceAddress.trim()) {
      setMessage("Please enter the issue, description, and service address.");
      setMessageType("error");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await apiFetch(
        `http://localhost:8080/repairs/request/${user.id}/${productId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            issue: issue.trim(),
            description: description.trim(),
            serviceAddress: serviceAddress.trim(),
            preferredContactMethod,
          }),
        }
      );

      await readResponse(response);

      setMessage("Repair request created successfully!");
      setMessageType("success");
      setIssue("");
      setDescription("");
      setServiceAddress("");

      await loadRepairs(user.id);
    } catch (error) {
      setMessage(`Unable to create repair request: ${error.message}`);
      setMessageType("error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (value) => {
    if (!value) return "Not available";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getStatus = (status) => {
    const value = String(status || "PENDING")
      .trim()
      .toUpperCase()
      .replace(/[_-]+/g, " ");

    if (value.includes("COMPLETE") || value === "COMPLETED") {
      return { label: "Completed", className: "repair-status-completed" };
    }

    if (value.includes("PROGRESS") || value.includes("ASSIGNED")) {
      return { label: value.replace(/\b\w/g, (c) => c.toUpperCase()), className: "repair-status-progress" };
    }

    if (value.includes("CANCEL")) {
      return { label: "Cancelled", className: "repair-status-cancelled" };
    }

    if (value.includes("REJECT")) {
      return { label: "Rejected", className: "repair-status-cancelled" };
    }

    return {
      label: value.replace(/\b\w/g, (c) => c.toUpperCase()),
      className: "repair-status-pending",
    };
  };

  const filteredRepairs = repairs.filter((repair) => {
    const productName = repair.product?.name || "";
    const text = `${repair.id} ${productName} ${repair.issue || ""} ${
      repair.description || ""
    }`.toLowerCase();

    const matchesSearch = text.includes(search.toLowerCase());
    const status = getStatus(repair.status).label.toUpperCase();
    const matchesStatus =
      statusFilter === "ALL" || status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const pendingCount = repairs.filter((repair) => {
    const status = getStatus(repair.status).label.toUpperCase();
    return !["COMPLETED", "CANCELLED", "REJECTED"].includes(status);
  }).length;

  const completedCount = repairs.filter(
    (repair) => getStatus(repair.status).label.toUpperCase() === "COMPLETED"
  ).length;

  if (!user) {
    return (
      <div className="repairs-page">
        <div className="repairs-empty">
          <h2>Please login first</h2>
          <p>{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="repairs-page">
      <div className="repairs-heading">
        <div>
          <span className="products-eyebrow">SERVICE CENTER</span>
          <h1>Repair Requests</h1>
          <p>Request a repair and track the progress of your devices.</p>
        </div>
        <div className="repair-heading-icon">🔧</div>
      </div>

      {message && (
        <div className={`product-message ${messageType}`}>
          <span>{messageType === "success" ? "✓" : "!"}</span>
          <span>{message}</span>
          <button
            className="message-dismiss"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="repair-stats-grid">
        <div className="repair-stat-card">
          <div className="repair-stat-icon">▤</div>
          <div>
            <span>Total requests</span>
            <h2>{repairs.length}</h2>
          </div>
        </div>
        <div className="repair-stat-card">
          <div className="repair-stat-icon repair-stat-pending">◷</div>
          <div>
            <span>In progress / pending</span>
            <h2>{pendingCount}</h2>
          </div>
        </div>
        <div className="repair-stat-card">
          <div className="repair-stat-icon repair-stat-complete">✓</div>
          <div>
            <span>Completed repairs</span>
            <h2>{completedCount}</h2>
          </div>
        </div>
      </div>

      <section className="repair-form-card">
        <div className="repair-section-heading">
          <div>
            <span className="products-eyebrow">NEW SERVICE TICKET</span>
            <h2>Raise a Repair Request</h2>
            <p>Select a registered product and tell us what needs fixing.</p>
          </div>
          <div className="repair-form-symbol">＋</div>
        </div>

        {loadingProducts ? (
          <div className="repair-inline-loading">Loading your products...</div>
        ) : products.length === 0 ? (
          <div className="repair-no-products">
            <div className="repair-empty-icon">▦</div>
            <div>
              <h3>No registered products yet</h3>
              <p>
                Register your product in My Products before creating a repair
                request.
              </p>
            </div>
          </div>
        ) : (
          <form className="repair-form" onSubmit={createRepairRequest}>
            <div className="repair-field">
              <label htmlFor="repairProduct">Select product *</label>
              <select
                id="repairProduct"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
              >
                <option value="">Choose a registered product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} — {product.brand}
                  </option>
                ))}
              </select>
              <span className="repair-field-hint">
                Choose a product you have already registered.
              </span>
            </div>

            <div className="repair-field">
              <label htmlFor="repairIssue">Issue title *</label>
              <input
                id="repairIssue"
                type="text"
                placeholder="e.g. Laptop is not charging"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div className="repair-field">
              <label htmlFor="repairDescription">Describe the problem *</label>
              <textarea
                id="repairDescription"
                placeholder="Explain the problem and when it started..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                maxLength={2000}
                required
              />
              <span className="repair-field-hint">
                Include any details that may help the technician.
              </span>
            </div>

            <div className="repair-field">
              <label htmlFor="serviceAddress">Service address *</label>
              <textarea id="serviceAddress" value={serviceAddress}
                onChange={(e) => setServiceAddress(e.target.value)}
                placeholder="Where should the technician provide service?"
                rows={2} maxLength={1000} required />
            </div>

            <div className="repair-field">
              <label htmlFor="preferredContactMethod">Preferred contact method *</label>
              <select id="preferredContactMethod" value={preferredContactMethod}
                onChange={(e) => setPreferredContactMethod(e.target.value)}>
                <option value="PHONE">Phone</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>

            <div className="repair-form-footer">
              <p>Check the details before submitting your request.</p>
              <button
                type="submit"
                className="product-primary-btn"
                disabled={submitting || !productId}
              >
                {submitting ? "Submitting..." : "Submit Repair Request →"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="repair-list-section">
        <div className="repair-list-heading">
          <div>
            <h2>My Repair Requests</h2>
            <p>Review your submitted service requests and their current status.</p>
          </div>
          <span className="repair-count-badge">{repairs.length} total</span>
        </div>

        <div className="repair-toolbar">
          <div className="product-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search by product, issue or request ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="product-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter repair requests by status"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="IN PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {loadingRepairs ? (
          <div className="repairs-empty">
            <div className="product-loading-spinner" />
            <p>Loading your repair requests...</p>
          </div>
        ) : filteredRepairs.length === 0 ? (
          <div className="repairs-empty">
            <div className="repair-empty-icon">🔧</div>
            <h3>
              {repairs.length === 0
                ? "No repair requests yet"
                : "No matching requests"}
            </h3>
            <p>
              {repairs.length === 0
                ? "Your submitted repair requests will appear here."
                : "Try changing your search or status filter."}
            </p>
          </div>
        ) : (
          <div className="repair-request-list">
            {filteredRepairs.map((repair) => {
              const status = getStatus(repair.status);

              return (
                <article className="repair-request-card" key={repair.id}>
                  <div className="repair-request-card-top">
                    <div className="repair-request-product-icon">🔧</div>
                    <div className="repair-request-main">
                      <span className="repair-ticket-number">
                        REQUEST #{repair.id}
                      </span>
                      <h3>{repair.issue || "Repair request"}</h3>
                      <p>
                        {repair.product?.name || "Product details unavailable"}
                      </p>
                    </div>
                    <span
                      className={`repair-status-badge ${status.className}`}
                    >
                      <span className="status-dot" />
                      {status.label}
                    </span>
                  </div>

                  <div className="repair-request-description">
                    <span>Problem description</span>
                    <p>{repair.description || "No description provided."}</p>
                  </div>

                  <div className="repair-request-description">
                    <span>Repair tracking</span>
                    <p>{repair.technician
                      ? `Technician assigned: ${repair.technician.name}`
                      : "A technician has not been assigned yet."}</p>
                  </div>

                  <RepairCommunication repairId={repair.id} />

                  <div className="repair-request-footer">
                    <div>
                      <span>Request date</span>
                      <strong>{formatDate(repair.requestDate)}</strong>
                    </div>
                    <div>
                      <span>Request ID</span>
                      <strong>#{repair.id}</strong>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Repairs;
