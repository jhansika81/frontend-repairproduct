
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "./api";
import { getCurrentUser } from "./auth";
import "./App.css";

function Products() {
  const user = getCurrentUser();

  const [products, setProducts] = useState([]);
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyPeriod, setWarrantyPeriod] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");

  const loadProducts = async () => {
    try {
      const endpoint = user.role === "ADMIN"
        ? "http://localhost:8080/products/all"
        : `http://localhost:8080/products/user/${user.id}`;

      const response = await apiFetch(endpoint);

      if (!response.ok) {
        throw new Error("Unable to load products.");
      }

      const data = await response.json();
      setProducts(Array.isArray(data) ? data : []);
      setMessage("");
    } catch (error) {
      setMessage(error.message || "Unable to load products.");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const endpoint = user.role === "ADMIN"
      ? "http://localhost:8080/products/all"
      : `http://localhost:8080/products/user/${user.id}`;
    apiFetch(endpoint)
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load products.");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("The products API did not return a product list.");
        return data;
      })
      .then((data) => {
        setProducts(data);
        setMessage("");
      })
      .catch((error) => {
        setMessage(error.message || "Unable to load products.");
        setMessageType("error");
      })
      .finally(() => setLoading(false));
  }, [user?.id, user?.role]);

  // Calculate warranty dates without timezone shifting date-only values.
  const getWarrantyInfo = (product) => {
    if (!product.purchaseDate || product.warrantyPeriod == null) {
      return {
        status: "UNKNOWN",
        expiryDate: null,
        daysLeft: null,
      };
    }

    const parts = String(product.purchaseDate).slice(0, 10).split("-");
    if (parts.length !== 3 || parts.some((part) => !part)) {
      return {
        status: "UNKNOWN",
        expiryDate: null,
        daysLeft: null,
      };
    }

    const [year, month, day] = parts.map(Number);
    const start = new Date(Date.UTC(year, month - 1, day));

    if (Number.isNaN(start.getTime())) {
      return {
        status: "UNKNOWN",
        expiryDate: null,
        daysLeft: null,
      };
    }

    const months = Number(product.warrantyPeriod);
    if (!Number.isFinite(months) || months < 0) {
      return {
        status: "UNKNOWN",
        expiryDate: null,
        daysLeft: null,
      };
    }

    const expiry = new Date(start);
    const originalDay = expiry.getUTCDate();

    expiry.setUTCDate(1);
    expiry.setUTCMonth(expiry.getUTCMonth() + months);

    const lastDay = new Date(
      Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth() + 1, 0)
    ).getUTCDate();

    expiry.setUTCDate(Math.min(originalDay, lastDay));

    const today = new Date();
    const todayUtc = Date.UTC(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    const daysLeft = Math.ceil((expiry.getTime() - todayUtc) / 86400000);

    let status = "ACTIVE";

    if (daysLeft < 0) {
      status = "EXPIRED";
    } else if (daysLeft <= 30) {
      status = "EXPIRING SOON";
    }

    return {
      status,
      expiryDate: expiry,
      daysLeft,
    };
  };

  const formatDate = (date) => {
    if (!date) return "Not available";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  };

  const productStats = useMemo(() => {
    const stats = {
      total: products.length,
      active: 0,
      expired: 0,
      expiring: 0,
    };

    products.forEach((product) => {
      const info = getWarrantyInfo(product);

      if (info.status === "ACTIVE") stats.active++;
      if (info.status === "EXPIRED") stats.expired++;
      if (info.status === "EXPIRING SOON") stats.expiring++;
    });

    return stats;
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const info = getWarrantyInfo(product);
      const matchesSearch = [
        product.name,
        product.brand,
        product.category,
      ].some((value) =>
        String(value || "").toLowerCase().includes(search.toLowerCase())
      );

      const matchesFilter =
        filter === "ALL" || info.status === filter;

      return matchesSearch && matchesFilter;
    });
  }, [products, search, filter]);

  const registerProduct = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await apiFetch(
        `http://localhost:8080/products/register/${user.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: name.trim(),
            brand: brand.trim(),
            category: category.trim(),
            purchaseDate,
            warrantyPeriod: Number(warrantyPeriod),
            warrantyStatus: "ACTIVE",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to register product.");
      }

      setMessage("Product registered successfully!");
      setMessageType("success");

      setName("");
      setBrand("");
      setCategory("");
      setPurchaseDate("");
      setWarrantyPeriod("");
      setShowForm(false);

      await loadProducts();
    } catch (error) {
      setMessage(error.message || "Unable to register product.");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) return;

    try {
      const response = await apiFetch(
        `http://localhost:8080/products/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.text();

      if (!response.ok) {
        throw new Error(data || "Unable to delete product.");
      }

      setProducts((current) =>
        current.filter((product) => product.id !== id)
      );
      setMessage("Product deleted successfully.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message || "Unable to delete product.");
      setMessageType("error");
    }
  };

  if (!user) {
    return (
      <div className="products-page">
        <div className="products-empty">
          <h2>Please log in first</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="products-page">
      <div className="products-heading">
        <div>
          <span className="products-eyebrow">{user.role === "ADMIN" ? "SYSTEM INVENTORY" : "YOUR INVENTORY"}</span>
          <h1>{user.role === "ADMIN" ? "All Products" : "My Products"}</h1>
          <p>
            {user.role === "ADMIN"
              ? "Review customer registrations, product ownership and warranty status."
              : "Manage your registered devices and warranty coverage."}
          </p>
        </div>

        {user.role !== "ADMIN" && (
          <button
            className="product-primary-btn"
            onClick={() => {
              setShowForm((current) => !current);
              setMessage("");
            }}
          >
            <span>{showForm ? "−" : "+"}</span>
            {showForm ? "Close Form" : "Register Product"}
          </button>
        )}
      </div>

      {message && (
        <div className={`product-message ${messageType}`}>
          <span>{messageType === "success" ? "✓" : "!"}</span>
          {message}
          <button
            className="message-dismiss"
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <div className="product-stats-grid">
        <div className="product-stat-card">
          <div className="product-stat-icon green-icon">▦</div>
          <div>
            <p>Total products</p>
            <h2>{productStats.total}</h2>
            <span>Registered devices</span>
          </div>
        </div>

        <div className="product-stat-card">
          <div className="product-stat-icon active-icon">✓</div>
          <div>
            <p>Active warranties</p>
            <h2>{productStats.active}</h2>
            <span>Coverage available</span>
          </div>
        </div>

        <div className="product-stat-card">
          <div className="product-stat-icon expired-icon">!</div>
          <div>
            <p>Expired warranties</p>
            <h2>{productStats.expired}</h2>
            <span>Coverage ended</span>
          </div>
        </div>

        <div className="product-stat-card">
          <div className="product-stat-icon soon-icon">◷</div>
          <div>
            <p>Expiring soon</p>
            <h2>{productStats.expiring}</h2>
            <span>Within 30 days</span>
          </div>
        </div>
      </div>

      {showForm && (
        <section className="product-form-card">
          <div className="product-section-heading">
            <div>
              <span className="products-eyebrow">PRODUCT DETAILS</span>
              <h2>Register a new product</h2>
              <p>Enter the details of the device you want to register.</p>
            </div>
            <div className="product-form-icon">＋</div>
          </div>

          <form onSubmit={registerProduct} className="product-form">
            <div className="product-form-grid">
              <div className="product-field">
                <label htmlFor="productName">Product name *</label>
                <input
                  id="productName"
                  type="text"
                  placeholder="e.g. Laptop, Washing Machine"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="product-field">
                <label htmlFor="productBrand">Brand *</label>
                <input
                  id="productBrand"
                  type="text"
                  placeholder="e.g. HP, Samsung"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  required
                />
              </div>

              <div className="product-field">
                <label htmlFor="productCategory">Category *</label>
                <select
                  id="productCategory"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select category</option>
                  <option value="Electronics">Electronics</option>
                  <option value="Home Appliances">Home Appliances</option>
                  <option value="Mobile & Tablets">Mobile & Tablets</option>
                  <option value="Computers & Laptops">Computers & Laptops</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="product-field">
                <label htmlFor="purchaseDate">Purchase date *</label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  max={new Date().toLocaleDateString("en-CA")}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  required
                />
              </div>

              <div className="product-field">
                <label htmlFor="warrantyPeriod">Warranty period (months) *</label>
                <input
                  id="warrantyPeriod"
                  type="number"
                  min="0"
                  max="120"
                  placeholder="e.g. 12"
                  value={warrantyPeriod}
                  onChange={(e) => setWarrantyPeriod(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="product-form-actions">
              <button
                type="button"
                className="product-secondary-btn"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="product-primary-btn"
                disabled={saving}
              >
                {saving ? "Registering..." : "+ Register Product"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="registered-products-section">
        <div className="registered-products-heading">
          <div>
            <h2>Registered Products</h2>
            <p>
              {products.length} {products.length === 1 ? "device" : "devices"} in
              your inventory
            </p>
          </div>
        </div>

        <div className="product-toolbar">
          <div className="product-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search products, brands or categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            className="product-filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by warranty status"
          >
            <option value="ALL">All warranties</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRING SOON">Expiring soon</option>
            <option value="EXPIRED">Expired</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        {loading ? (
          <div className="products-empty">
            <div className="product-loading-spinner" />
            <p>Loading your products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="products-empty">
            <div className="products-empty-icon">▦</div>
            <h3>
              {products.length === 0
                ? "No products registered yet"
                : "No matching products"}
            </h3>
            <p>
              {products.length === 0
                ? "Register your first product to keep its warranty details in one place."
                : "Try a different search term or warranty filter."}
            </p>
            {products.length === 0 && (
              <button
                className="product-primary-btn"
                onClick={() => setShowForm(true)}
              >
                + Register your first product
              </button>
            )}
          </div>
        ) : (
          <div className="registered-products-grid">
            {filteredProducts.map((product) => {
              const info = getWarrantyInfo(product);
              const badgeClass =
                info.status === "ACTIVE"
                  ? "badge-active"
                  : info.status === "EXPIRED"
                  ? "badge-expired"
                  : info.status === "EXPIRING SOON"
                  ? "badge-soon"
                  : "badge-unknown";
              const ownerName = product.user?.name || "Unknown owner";

              return (
                <article className="registered-product-card" key={product.id}>
                  <div className="registered-product-top">
                    <div className="registered-product-icon">▦</div>
                    <span className={`product-status-badge ${badgeClass}`}>
                      <span className="status-dot" />
                      {info.status === "UNKNOWN" ? "Unknown" : info.status}
                    </span>
                  </div>

                  <h3>{product.name}</h3>
                  <p className="registered-product-subtitle">
                    {product.brand} · {product.category}
                  </p>

                  {user.role === "ADMIN" && (
                    <p className="registered-product-subtitle">
                      Owner: {ownerName}
                    </p>
                  )}

                  <div className="registered-product-details">
                    <div>
                      <span>Purchase date</span>
                      <strong>{formatDate(
                        product.purchaseDate
                          ? new Date(`${String(product.purchaseDate).slice(0, 10)}T00:00:00Z`)
                          : null
                      )}</strong>
                    </div>
                    <div>
                      <span>Warranty period</span>
                      <strong>{product.warrantyPeriod} months</strong>
                    </div>
                    <div>
                      <span>Warranty expiry</span>
                      <strong>{formatDate(info.expiryDate)}</strong>
                    </div>
                  </div>

                  {info.status === "ACTIVE" && (
                    <div className="product-warranty-note">
                      Your warranty is active.
                    </div>
                  )}

                  {info.status === "EXPIRING SOON" && (
                    <div className="product-warranty-note soon-note">
                      {info.daysLeft === 0
                        ? "Warranty expires today."
                        : `${info.daysLeft} days left on your warranty.`}
                    </div>
                  )}

                  {info.status === "EXPIRED" && (
                    <div className="product-warranty-note expired-note">
                      Warranty coverage has ended.
                    </div>
                  )}

                  {user.role !== "ADMIN" && (
                    <div className="registered-product-actions">
                      <button
                        className="product-delete-btn"
                        onClick={() => deleteProduct(product.id)}
                      >
                        Delete product
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default Products;
