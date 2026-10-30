"use client";

import { useState } from "react";

type SourceMessage = {
  id: string;
  senderId: string | null;
  type: string;
  text: string | null;
  mediaKind: string | null;
  filename: string | null;
  attachmentText: string | null;
  messageTimestamp: string | null;
  receivedAt: string;
};

type Props = {
  campaignId: string;
  summaryId: string;
  itemId?: string;
  count: number;
};

function displayTime(value: string | null, fallback: string) {
  const parsed = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(parsed.valueOf())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

export function SourceMessages({ campaignId, summaryId, itemId, count }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState<SourceMessage[] | null>(null);

  async function showSources() {
    setOpen(true);
    if (messages || loading) return;
    setLoading(true);
    setError("");
    const query = new URLSearchParams({ campaignId, summaryId });
    if (itemId) query.set("itemId", itemId);
    try {
      const response = await fetch(`/api/dashboard/source-messages?${query.toString()}`);
      const body = await response.json() as SourceMessage[] | { message?: string };
      if (!response.ok || !Array.isArray(body)) {
        throw new Error(!Array.isArray(body) ? body.message ?? "Could not load source messages." : "Could not load source messages.");
      }
      setMessages(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load source messages.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button className="source-link" type="button" onClick={showSources}>
        View {count} source message{count === 1 ? "" : "s"}
      </button>
      {open && (
        <div className="source-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <section className="source-drawer" role="dialog" aria-modal="true" aria-labelledby="source-drawer-title">
            <div className="source-drawer-head">
              <div><p className="eyebrow">EVIDENCE</p><h2 id="source-drawer-title">Source messages</h2></div>
              <button className="source-close" type="button" onClick={() => setOpen(false)} aria-label="Close source messages">×</button>
            </div>
            {loading ? <div className="source-state">Loading cited messages…</div>
              : error ? <div className="source-state error">{error}</div>
                : messages?.length ? <div className="source-message-list">{messages.map((message) => (
                  <article className="source-message" key={message.id}>
                    <div className="source-message-meta"><strong>{message.senderId ?? "Unknown sender"}</strong><time>{displayTime(message.messageTimestamp, message.receivedAt)}</time></div>
                    <span className="source-message-type">{message.type.replaceAll("_", " ")}{message.filename ? ` · ${message.filename}` : ""}</span>
                    {message.text && <p>{message.text}</p>}
                    {message.attachmentText && <div className="source-attachment-text">{message.attachmentText}</div>}
                    {!message.text && !message.attachmentText && <p className="source-no-text">No text content was stored for this message.</p>}
                  </article>
                ))}</div>
                  : <div className="source-state">No cited messages were found for this row.</div>}
          </section>
        </div>
      )}
    </>
  );
}
