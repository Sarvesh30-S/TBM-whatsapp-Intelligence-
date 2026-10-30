import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { LiveUpdates } from "./LiveUpdates";
import { SourceMessages } from "./SourceMessages";
import { MetaTokenHealthWidget } from "./MetaTokenHealthWidget";
import { DeleteMessageButton } from "./DeleteMessageButton";

type Health = {
  status: string;
  storedWebhookEvents: string;
  storedMessages: string;
  storedStatuses: string;
};

type SummaryItem = {
  id: string;
  category: string;
  title: string;
  detail: string;
  confidence: number;
  reviewStatus: string;
  sourceMessageIds: string[];
  dueAt: string | null;
};

type CampaignInsight = {
  id: string;
  campaignId: string;
  campaignName: string;
  brandName: string;
  podName: string;
  summary: string;
  confidence: number;
  reviewStatus: string;
  windowEnd: string;
  sourceMessageIds: string[];
  items: SummaryItem[];
};

type OperationsBoard = {
  brandId: string;
  silenceAfterHours: number;
  openTaskCount: number;
  overdueTaskCount: number;
  silentPodCount: number;
  completedTaskCount: number;
  averageTurnaroundSeconds: number;
  tasks: Array<{ id: string; title: string; detail: string; dueAt: string | null; status: string; overdue: boolean }>;
  silentPods: Array<{ podId: string; subject: string; lastActivityAt: string; silentSeconds: number }>;
};

type Message = {
  id: string;
  providerMessageId: string;
  senderId: string | null;
  groupId: string | null;
  type: string;
  text: string | null;
  messageTimestamp: string | null;
  receivedAt: string;
  brandName?: string | null;
  brandGroupName?: string | null;
  campaignName?: string | null;
};

const apiUrl = process.env.BACKEND_API_URL ?? "http://localhost:8081";

export const dynamic = "force-dynamic";

async function loadSnapshot() {
  try {
    const [healthResponse, messagesResponse] = await Promise.all([
      fetch(`${apiUrl}/api/health`, { cache: "no-store" }),
      adminFetch("/api/messages?limit=50"),
    ]);

    if (!healthResponse.ok || !messagesResponse.ok) throw new Error("API unavailable");

    const health = (await healthResponse.json()) as Health;
    const messages = (await messagesResponse.json()) as Message[];
    return { health, messages, connected: true };
  } catch {
    return { health: null, messages: [], connected: false };
  }
}

async function loadInsights(): Promise<{ insights: CampaignInsight[]; available: boolean; brandIds: string[]; operations: OperationsBoard[]; operationsAvailable: boolean }> {
  try {
    const [brandResponse, campaignResponse] = await Promise.all([
      adminFetch("/api/admin/brands"),
      adminFetch("/api/admin/campaigns"),
    ]);
    if (!brandResponse.ok || !campaignResponse.ok) throw new Error("Insight API unavailable");
    const [brands, campaigns] = await Promise.all([
      brandResponse.json() as Promise<Array<{ id: string; name: string }>>,
      campaignResponse.json() as Promise<Array<{ id: string; brandId: string; name: string }>>,
    ]);
    const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]));
    const grouped = await Promise.all(campaigns.map(async (campaign) => {
      const [summaryResponse, podResponse] = await Promise.all([
        adminFetch(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}/summaries?limit=10`),
        adminFetch(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}/pods`),
      ]);
      if (!summaryResponse.ok || !podResponse.ok) return [];
      const [summaries, pods] = await Promise.all([
        summaryResponse.json() as Promise<Array<Omit<CampaignInsight, "campaignName" | "brandName" | "podName"> & { podId: string }>>,
        podResponse.json() as Promise<Array<{ id: string; subject: string }>>,
      ]);
      const podNames = new Map(pods.map((pod) => [pod.id, pod.subject]));
      return summaries.map((summary) => ({
        ...summary,
        campaignId: campaign.id,
        campaignName: campaign.name,
        brandName: brandNames.get(campaign.brandId) ?? "Brand",
        podName: podNames.get(summary.podId) ?? "Pod",
      }));
    }));
    const operationsResult = await Promise.allSettled(brands.map(async (brand) => {
      const response = await adminFetch(`/api/admin/brands/${encodeURIComponent(brand.id)}/operations`);
      if (!response.ok) throw new Error("Operations API unavailable");
      return response.json() as Promise<OperationsBoard>;
    }));
    return {
      insights: grouped.flat().sort((a, b) => b.windowEnd.localeCompare(a.windowEnd)),
      available: true,
      brandIds: brands.map((brand) => brand.id),
      operations: operationsResult.flatMap((result) => result.status === "fulfilled" ? [result.value] : []),
      operationsAvailable: operationsResult.every((result) => result.status === "fulfilled"),
    };
  } catch {
    return { insights: [], available: false, brandIds: [], operations: [], operationsAvailable: false };
  }
}

function formatDate(value: string | null) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Time unavailable"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(seconds / 60)}m`;
}

export default async function Home() {
  const [{ health, messages, connected }, { insights, available: insightsAvailable, brandIds, operations, operationsAvailable }] = await Promise.all([
    loadSnapshot(),
    loadInsights(),
  ]);
  const incomingCount = Number(health?.storedMessages ?? 0);
  const statusCount = Number(health?.storedStatuses ?? 0);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#top" aria-label="TBM home">
          <span className="brand-mark">t</span>
          <span>TBM<span className="brand-light"> / intelligence</span></span>
        </a>
        <p className="nav-label">WORKSPACE</p>
        <nav className="navigation" aria-label="Main navigation">
          <a className="nav-item active" href="#overview"><span>▦</span> Overview</a>
          <a className="nav-item" href="#inbox"><span>◉</span> Messages <b>{incomingCount}</b></a>
          <a className="nav-item" href="#insights"><span>✳</span> Insights</a>
          <Link className="nav-item" href="/campaigns"><span>◫</span> Campaigns</Link>
          <a className="nav-item" href="#tasks"><span>✓</span> Tasks</a>
        </nav>
        <div className="sidebar-foot">
          <span className={`connection-dot ${connected ? "online" : "offline"}`} />
          <div><strong>{connected ? "API connected" : "API disconnected"}</strong><span>Meta test environment</span></div>
        </div>
      </aside>

      <main className="main-content" id="top">
        <header className="topbar">
          <div><span className="crumb">Workspace</span><span className="crumb-separator">/</span><strong>Overview</strong></div>
          <div className="topbar-right"><span className="environment-pill"><i /> TEST MODE</span><LiveUpdates brandIds={brandIds} /><span className="avatar">V</span></div>
        </header>

        <section className="page-heading" id="overview">
          <div>
            <p className="eyebrow">CAMPAIGN OPERATIONS</p>
            <h1>Good to see you.</h1>
            <p className="subtitle">Your WhatsApp activity, gathered in one place.</p>
          </div>
          <span className="date-label">LOCAL DEVELOPMENT</span>
        </section>

        {!connected && <div className="alert-card">The backend could not be reached. Start the Spring Boot API on port 8081 and refresh this page.</div>}

        <MetaTokenHealthWidget />

        <section className="metric-grid" aria-label="Workspace metrics">
          <article className="metric-card"><div className="metric-top"><span>INCOMING MESSAGES</span><span className="metric-icon green">↙</span></div><strong>{incomingCount}</strong><p>Messages received and stored</p></article>
          <article className="metric-card"><div className="metric-top"><span>DELIVERY UPDATES</span><span className="metric-icon blue">↗</span></div><strong>{statusCount}</strong><p>Sent, delivered, read, or failed</p></article>
          <article className="metric-card"><div className="metric-top"><span>WEBHOOK EVENTS</span><span className="metric-icon amber">⌁</span></div><strong>{health?.storedWebhookEvents ?? "—"}</strong><p>Signed events retained for review</p></article>
        </section>

        <section className="panel" id="inbox">
          <div className="panel-heading">
            <div><p className="eyebrow">INBOX</p><h2>Recent messages</h2><p className="panel-subtitle">Messages received from your Meta test number setup.</p></div>
            <span className="live-pill"><i /> LIVE DATA</span>
          </div>
          {!connected ? (
            <div className="empty-state"><span className="empty-icon">⌁</span><strong>Waiting for the API</strong><p>Once the backend is available, recent messages will appear here.</p></div>
          ) : messages.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">⌁</span><strong>No messages yet</strong><p>Send a WhatsApp message to your Meta test number to see it here.</p></div>
          ) : (
            <div className="message-list">
              {messages.map((message) => {
                const brandLabel = message.brandName || "Unassigned Brand";
                const groupLabel = message.brandGroupName || (message.groupId ? message.groupId : "Direct Message");

                return (
                  <article className="message-row" key={message.id}>
                    <div className="sender-avatar">{(message.brandName ?? message.senderId ?? "?").slice(0, 1).toUpperCase()}</div>
                    <div className="message-main">
                      {/* Identity row: Brand Name & Brand Group Name */}
                      <div className="message-identity-bar">
                        <span className="brand-badge" title="Brand">
                          <span className="badge-icon">🏢</span>
                          <strong>{brandLabel}</strong>
                        </span>
                        <span className="group-badge" title="Brand Group / Pod">
                          <span className="badge-icon">👥</span>
                          <span>{groupLabel}</span>
                        </span>
                        {message.campaignName && (
                          <span className="campaign-badge" title="Campaign">
                            <span>{message.campaignName}</span>
                          </span>
                        )}
                        <span className="type-pill">{message.type}</span>
                      </div>

                      {/* The Message */}
                      <p className="message-body">{message.text || `[${message.type} message]`}</p>

                      {/* Meta Footer */}
                      <div className="message-meta-footer">
                        <span className="sender-tag">From: {message.senderId ? `+${message.senderId}` : "Unknown sender"}</span>
                        {message.groupId && message.brandGroupName && (
                          <span className="group-id-tag">Group JID: {message.groupId}</span>
                        )}
                        <span className="message-id">{message.providerMessageId}</span>
                      </div>
                    </div>
                    <div className="message-actions-col">
                      <time dateTime={message.messageTimestamp ?? message.receivedAt}>
                        {formatDate(message.messageTimestamp ?? message.receivedAt)}
                      </time>
                      <DeleteMessageButton messageId={message.id} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <footer className="panel-footer"><span>Showing the latest {messages.length} stored {messages.length === 1 ? "message" : "messages"}</span><span>Refresh the page to reload</span></footer>
        </section>

        <section className="panel insights-panel" id="insights">
          <div className="panel-heading">
            <div><p className="eyebrow">AI REVIEW QUEUE</p><h2>Conversation summaries</h2><p className="panel-subtitle">Summaries are tied to source messages; low-confidence results are held for review.</p></div>
            <Link className="text-link" href="/campaigns">Campaigns and pods →</Link>
          </div>
          {!insightsAvailable ? (
            <div className="empty-state"><span className="empty-icon">⌁</span><strong>Summary service unavailable</strong><p>Check the protected campaign API connection.</p></div>
          ) : insights.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">✳</span><strong>No summaries generated yet</strong><p>Summaries appear after a pod has a linked group, messages, and configured AI provider keys.</p></div>
          ) : (
            <div className="insight-list">
              {insights.map((insight) => (
                <article className="insight-card" key={insight.id}>
                  <div className="insight-head"><div><span className="brand-label">{insight.brandName} · {insight.campaignName}</span><h3>{insight.podName}</h3></div><span className={`status-pill ${insight.reviewStatus === "NEEDS_REVIEW" ? "pending" : ""}`}>{insight.reviewStatus.replaceAll("_", " ")}</span></div>
                  <p className="insight-summary">{insight.summary}</p>
                  <div className="insight-meta"><span>{Math.round(insight.confidence * 100)}% confidence</span><SourceMessages campaignId={insight.campaignId} summaryId={insight.id} count={insight.sourceMessageIds.length} /><time>{formatDate(insight.windowEnd)}</time></div>
                  {insight.items.length > 0 && <div className="important-list">{insight.items.map((item) => (
                    <div className="important-item" key={item.id}>
                      <span className="category-pill">{item.category.replaceAll("_", " ")}</span>
                      <div><strong>{item.title}</strong><p>{item.detail}</p><small>{Math.round(item.confidence * 100)}%{item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ""}</small><SourceMessages campaignId={insight.campaignId} summaryId={insight.id} itemId={item.id} count={item.sourceMessageIds.length} /></div>
                    </div>
                  ))}</div>}
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel operations-panel" id="tasks">
          <div className="panel-heading">
            <div><p className="eyebrow">OPERATIONS</p><h2>Tasks and group activity</h2><p className="panel-subtitle">Overdue tasks, turnaround time, and group silence are calculated by the backend.</p></div>
          </div>
          {!operationsAvailable ? (
            <div className="empty-state"><span className="empty-icon">⌁</span><strong>Operations metrics unavailable</strong><p>Check the protected operations API connection.</p></div>
          ) : operations.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">✓</span><strong>No brand operations yet</strong><p>Create a brand to see task and pod metrics.</p></div>
          ) : (
            <div className="operations-list">
              {operations.map((board) => (
                <article className="operations-card" key={board.brandId}>
                  <div className="operations-metrics">
                    <div><span>OPEN TASKS</span><strong>{board.openTaskCount}</strong></div>
                    <div><span>OVERDUE</span><strong className={board.overdueTaskCount ? "metric-danger" : ""}>{board.overdueTaskCount}</strong></div>
                    <div><span>SILENT PODS</span><strong>{board.silentPodCount}</strong><small>after {board.silenceAfterHours}h</small></div>
                    <div><span>AVG TASK TAT</span><strong>{board.completedTaskCount ? formatDuration(board.averageTurnaroundSeconds) : "—"}</strong><small>{board.completedTaskCount} completed</small></div>
                  </div>
                  {board.tasks.length > 0 && <div className="operation-items"><h3>Tasks</h3>{board.tasks.slice(0, 8).map((task) => (
                    <div className="operation-row" key={task.id}>
                      <div><strong>{task.title}</strong><p>{task.detail}</p><small>{task.status.replaceAll("_", " ")}{task.dueAt ? ` · due ${formatDate(task.dueAt)}` : " · no due date"}</small></div>
                      <span className={`status-pill ${task.overdue ? "pending" : ""}`}>{task.overdue ? "OVERDUE" : task.status.replaceAll("_", " ")}</span>
                    </div>
                  ))}</div>}
                  {board.silentPods.length > 0 && <div className="operation-items"><h3>Silent pods</h3>{board.silentPods.slice(0, 8).map((pod) => (
                    <div className="operation-row" key={pod.podId}>
                      <div><strong>{pod.subject}</strong><p>Last group message {formatDate(pod.lastActivityAt)}</p></div>
                      <span className="status-pill pending">{formatDuration(pod.silentSeconds)}</span>
                    </div>
                  ))}</div>}
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="page-footer"><span>TBM WhatsApp Intelligence</span><span>Development workspace · Meta test API</span></footer>
      </main>
    </div>
  );
}
