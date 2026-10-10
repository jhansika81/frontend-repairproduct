
import { useEffect, useState } from "react";
import { apiFetch } from "./api";
import { getCurrentUser } from "./auth";
import RepairCommunication from "./RepairCommunication";

function TechnicianRepairs() {
  const user = getCurrentUser();
  const userId = user?.id;
  const userRole = user?.role;

  const [repairs, setRepairs] = useState([]);
  const [message, setMessage] = useState("");
  const [contacts, setContacts] = useState({});
  const [openRepairs, setOpenRepairs] = useState({});
  const [pendingStatuses, setPendingStatuses] = useState({});

  const loadRepairs = async () => {
    try {
      const response = await apiFetch(
        `http://localhost:8080/repairs/technician/${user.id}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Unable to load assigned repairs");
      }

      setRepairs(data);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    if (userId && userRole === "TECHNICIAN") {
      apiFetch(`http://localhost:8080/repairs/technician/${userId}`)
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error("Unable to load assigned repairs");
          if (!Array.isArray(data)) throw new Error("The repairs API did not return a repair list");
          return data;
        })
        .then(setRepairs)
        .catch((error) => setMessage(error.message));
    }
  }, [userId, userRole]);

  const updateStatus = async (repairId, status, note) => {
    try {
      const response = await apiFetch(
        `http://localhost:8080/repairs/${repairId}/status?status=${status}&note=${encodeURIComponent(note)}`,
        {
          method: "PUT"
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error("Unable to update repair status");
      }

      setMessage(`Repair #${repairId} updated to ${data.status}`);
      loadRepairs();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const loadContact = async (repairId) => {
    try {
      const response = await apiFetch(`http://localhost:8080/repairs/${repairId}/contact`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load customer contact");
      setContacts((current) => ({ ...current, [repairId]: data }));
      setOpenRepairs((current) => ({ ...current, [repairId]: true }));
    } catch (error) {
      setMessage(error.message);
    }
  };

  if (!user) {
    return <h2>Please login first</h2>;
  }

  if (user.role !== "TECHNICIAN") {
    return <h2>Only technicians can access this page.</h2>;
  }

  return (
    <section className="technician-repairs-page">
      <div className="technician-repairs-heading">
        <div>
          <span className="products-eyebrow">SERVICE WORKSPACE</span>
          <h2>Assigned Repairs</h2>
          <p>Review repair requests, contact customers, and keep each job up to date.</p>
        </div>
        <span className="repair-count-badge">{repairs.length} assigned</span>
      </div>

      {message && (
        <div className="form-message" role="status">
          {message}
        </div>
      )}
      {repairs.length === 0 ? (
        <div className="repairs-empty">
          <div className="repair-empty-icon">🔧</div>
          <h3>No repairs assigned yet</h3>
          <p>New service requests assigned to you will appear here.</p>
        </div>
      ) : (
        <div className="technician-repair-list">
          {repairs.map((repair) => {
            const selectedStatus = pendingStatuses[repair.id] || repair.status;
            const statusClass = ["COMPLETED", "DELIVERED"].includes(repair.status)
              ? "repair-status-completed"
              : ["ASSIGNED", "IN_PROGRESS"].includes(repair.status)
                ? "repair-status-progress"
                : ["CANCELLED", "REJECTED"].includes(repair.status)
                  ? "repair-status-cancelled"
                  : "repair-status-pending";

            return (
              <article className="technician-repair-card" key={repair.id}>
                <div className="technician-repair-card-header">
                  <div className="technician-repair-product-icon">🔧</div>
                  <div className="technician-repair-title">
                    <span className="repair-ticket-number">REPAIR REQUEST #{repair.id}</span>
                    <h3>{repair.product?.name || "Unknown product"}</h3>
                    <p>{repair.product?.brand || "Brand unavailable"} · {repair.issue || "Issue not specified"}</p>
                  </div>
                  <span className={`repair-status-badge ${statusClass}`}>
                    <span className="status-dot" />
                    {repair.status?.replaceAll("_", " ") || "Status unavailable"}
                  </span>
                </div>

                <div className="technician-repair-description">
                  <span>Issue description</span>
                  <p>{repair.description || "No additional description provided."}</p>
                </div>

                <div className="technician-repair-meta">
                  <div><span>Request date</span><strong>{repair.requestDate || "Unavailable"}</strong></div>
                  <div><span>Service address</span><strong>{repair.serviceAddress || "Not provided"}</strong></div>
                  <div><span>Preferred contact</span><strong>{repair.preferredContactMethod || "Phone"}</strong></div>
                </div>

                <div className="repair-contact-section">
                  <h4>Customer contact</h4>
                  {contacts[repair.id] ? (
                    <div className="technician-contact-details">
                      <p><strong>{contacts[repair.id].customerName || "Customer"}</strong></p>
                      <p>{contacts[repair.id].phone || "Phone unavailable"} · {contacts[repair.id].email || "Email unavailable"}</p>
                      <a className="product-secondary-btn" href={`tel:${(contacts[repair.id].phone || "").replace(/[^\d+]/g, "")}`}>Call customer</a>
                      <a className="product-secondary-btn" href={`mailto:${encodeURIComponent(contacts[repair.id].email || "")}`}>Email customer</a>
                    </div>
                  ) : (
                    <button className="product-secondary-btn" type="button" onClick={() => loadContact(repair.id)}>
                      Show contact details
                    </button>
                  )}
                </div>

                {openRepairs[repair.id] && <RepairCommunication repairId={repair.id} />}

                <div className="technician-repair-actions">
                  <label htmlFor={`repair-status-${repair.id}`}>Update repair status</label>
                  <div className="technician-status-controls">
                    <select
                      id={`repair-status-${repair.id}`}
                      value={selectedStatus}
                      onChange={(event) => setPendingStatuses((current) => ({
                        ...current,
                        [repair.id]: event.target.value,
                      }))}
                    >
                      <option value="ASSIGNED">Assigned</option>
                      <option value="IN_PROGRESS">In progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="DELIVERED">Delivered</option>
                    </select>
                    <button
                      className="product-primary-btn"
                      type="button"
                      disabled={selectedStatus === repair.status}
                      onClick={() => {
                        const note = selectedStatus === "IN_PROGRESS"
                          ? "Technician on the way"
                          : selectedStatus === "COMPLETED"
                            ? "Repair completed"
                            : selectedStatus === "DELIVERED"
                              ? "Repair delivered"
                              : "Repair assigned";
                        updateStatus(repair.id, selectedStatus, note);
                      }}
                    >
                      Save status
                    </button>
                    <button
                      className="product-secondary-btn"
                      type="button"
                      onClick={() => updateStatus(repair.id, "IN_PROGRESS", "Inspection completed")}
                    >
                      Record inspection
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TechnicianRepairs;
