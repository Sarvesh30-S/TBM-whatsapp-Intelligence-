"use client";

import { useEffect, useState, useCallback } from "react";

type MetaStatusResponse = {
  status: "ACTIVE" | "EXPIRED" | "ERROR" | "BACKEND_UNAVAILABLE" | "CHECKING";
  connected: boolean;
  isExpired?: boolean;
  phoneNumber?: {
    display_phone_number?: string;
    verified_name?: string;
    id?: string;
  } | null;
  error?: string | null;
  statusCode?: number;
  checkedAt?: string;
};

export function MetaTokenHealthWidget() {
  const [data, setData] = useState<MetaStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/meta/status", { cache: "no-store" });
      const json = (await res.json()) as MetaStatusResponse;
      setData(json);
      setLastChecked(new Date());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error";
      setData({
        status: "BACKEND_UNAVAILABLE",
        connected: false,
        isExpired: false,
        error: `Could not reach status API: ${msg}`,
      });
      setLastChecked(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();

    // Auto-check every 5 minutes (300,000 ms) so expiration is caught in real-time
    const interval = setInterval(() => {
      checkStatus();
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [checkStatus]);

  const isExpired = data?.status === "EXPIRED" || data?.isExpired;
  const isActive = data?.status === "ACTIVE" && data?.connected;
  const isBackendDown = data?.status === "BACKEND_UNAVAILABLE";

  const formatTime = (date: Date | null) => {
    if (!date) return "";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className={`token-status-card ${isExpired ? "is-expired" : isActive ? "is-active" : "is-warning"}`}>
      <div className="token-status-head">
        <div className="token-status-title-row">
          <span className={`status-dot ${loading ? "checking" : isExpired ? "expired" : isActive ? "active" : "warning"}`} />
          <div>
            <div className="token-status-title">
              <strong>
                {loading
                  ? "Checking Meta API Token..."
                  : isExpired
                  ? "Meta WhatsApp Token Expired"
                  : isActive
                  ? "Meta WhatsApp Cloud API Active"
                  : isBackendDown
                  ? "Backend API Offline"
                  : "Meta Connection Warning"}
              </strong>
              <span className={`token-badge ${isExpired ? "badge-danger" : isActive ? "badge-success" : "badge-neutral"}`}>
                {loading ? "VERIFYING" : isExpired ? "EXPIRED (24h)" : isActive ? "AUTHENTICATED" : "CHECK REQUIRED"}
              </span>
            </div>
            <p className="token-status-desc">
              {loading ? (
                "Querying Meta Graph API endpoint..."
              ) : isExpired ? (
                "Your temporary Meta access token has expired. Inbound webhooks may be received, but Graph API calls, media fetching, and profile verification will fail until updated."
              ) : isActive && data?.phoneNumber ? (
                <>
                  Connected as <b>{data.phoneNumber.verified_name || "Test Profile"}</b> ({data.phoneNumber.display_phone_number || "Phone ID: " + data.phoneNumber.id}) &bull; Graph API v23.0
                </>
              ) : isBackendDown ? (
                "The Spring Boot API server on port 8081 is not responding. Ensure the backend is running."
              ) : (
                data?.error || "Meta connection status could not be confirmed."
              )}
            </p>
          </div>
        </div>

        <div className="token-status-actions">
          {lastChecked && (
            <span className="last-checked-label">
              Checked {formatTime(lastChecked)}
            </span>
          )}
          <button
            type="button"
            className="token-recheck-btn"
            onClick={() => checkStatus()}
            disabled={loading}
          >
            {loading ? "Checking..." : isExpired ? "⟳ Re-check Token" : "⟳ Check Health"}
          </button>
        </div>
      </div>

      {isExpired && (
        <div className="token-expired-instructions">
          <div className="instructions-title">Steps to refresh your token:</div>
          <ol className="instructions-list">
            <li>
              Go to your{" "}
              <a
                href="https://developers.facebook.com/apps"
                target="_blank"
                rel="noreferrer"
                className="token-link"
              >
                Meta App Dashboard &rarr; WhatsApp &rarr; API Setup
              </a>.
            </li>
            <li>Copy the fresh <b>Temporary access token</b> (or generate a permanent System User token).</li>
            <li>
              Replace <code>META_ACCESS_TOKEN=...</code> in your <code>.env</code> file.
            </li>
            <li>Restart the backend (or ask the assistant to update it), then click <b>Re-check Token</b> above.</li>
          </ol>
          {data?.error && (
            <div className="token-error-details">
              <strong>Meta API response:</strong> {data.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
