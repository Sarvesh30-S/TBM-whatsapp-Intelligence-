import Link from "next/link";
import { adminFetch } from "@/lib/admin-api";
import { createBrand, createCampaign } from "./actions";
import { MetaTokenHealthWidget } from "../MetaTokenHealthWidget";
import { CampaignCard } from "./CampaignCard";

type Brand = { id: string; name: string; slug: string };
type Campaign = { id: string; brandId: string; name: string; slug: string; status: string };

export type Participant = {
  id: string;
  personId: string;
  waId: string;
  displayName: string;
  isExternal: boolean;
  status: string;
  joinedAt: string;
};

export type Pod = {
  id: string;
  campaignId: string;
  metaGroupId: string | null;
  subject: string;
  inviteLink?: string | null;
  joinApprovalMode: string;
  plannedExternalSeats: number;
  filledSeats: number;
  participants: Participant[];
  status: string;
  consentSent: boolean;
};
type Workspace = {
  brands: Brand[];
  campaigns: Campaign[];
  podsByCampaign: Record<string, Pod[]>;
  error: string | null;
};

export const dynamic = "force-dynamic";

async function getList<T>(path: string): Promise<T[]> {
  const response = await adminFetch(path);
  if (!response.ok) throw new Error("Campaign workspace API is unavailable.");
  return response.json() as Promise<T[]>;
}

async function loadWorkspace(): Promise<Workspace> {
  try {
    const [brands, campaigns] = await Promise.all([
      getList<Brand>("/api/admin/brands"),
      getList<Campaign>("/api/admin/campaigns"),
    ]);
    const podEntries = await Promise.all(campaigns.map(async (campaign): Promise<[string, Pod[]]> => [
      campaign.id,
      await getList<Pod>(`/api/admin/campaigns/${encodeURIComponent(campaign.id)}/pods`),
    ]));
    const podsByCampaign = Object.fromEntries(podEntries);
    return { brands, campaigns, podsByCampaign, error: null };
  } catch {
    return { brands: [], campaigns: [], podsByCampaign: {}, error: "The protected campaign API is unavailable. Check that both local services are running and restart them after saving environment changes." };
  }
}

export default async function CampaignsPage(props: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const resolvedParams = props.searchParams ? await props.searchParams : {};
  const { brands, campaigns, podsByCampaign, error: loadError } = await loadWorkspace();
  const brandNames = new Map(brands.map((brand) => [brand.id, brand.name]));

  return (
    <div className="management-shell">
      <header className="topbar management-topbar">
        <div><Link className="crumb-link" href="/">Overview</Link><span className="crumb-separator">/</span><strong>Campaigns &amp; pods</strong></div>
        <span className="environment-pill"><i /> LOCAL PLANNING</span>
      </header>

      <section className="page-heading management-heading">
        <div><p className="eyebrow">CAMPAIGN OPERATIONS</p><h1>Campaigns &amp; pods</h1><p className="subtitle">Organize brands and plan small WhatsApp groups before connecting Meta Groups API.</p></div>
      </section>

      <MetaTokenHealthWidget />

      {loadError && <div className="alert-card">{loadError}</div>}
      {resolvedParams.error && <div className="alert-card">{resolvedParams.error}</div>}
      <div className="notice-card"><strong>Test environment:</strong> saving here creates local planning records only. It does not create a WhatsApp group, send a consent message, or invite participants.</div>

      <section className="management-grid" aria-label="Create brand and campaign">
        <article className="management-card">
          <div className="card-kicker">STEP 1</div><h2>Add a brand</h2><p>Brands are the top-level clients used to scope campaigns.</p>
          <form action={createBrand} className="form-stack">
            <label>Brand name<input name="name" required maxLength={160} placeholder="e.g. Acme Retail" /></label>
            <button type="submit" disabled={Boolean(loadError)}>Create brand</button>
          </form>
        </article>
        <article className="management-card">
          <div className="card-kicker">STEP 2</div><h2>Add a campaign</h2><p>Every campaign belongs to one brand. Pods are planned under a campaign.</p>
          <form action={createCampaign} className="form-stack">
            <label>Brand<select name="brandId" required disabled={!brands.length || Boolean(loadError)} defaultValue=""><option value="" disabled>Select a brand</option>{brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}</select></label>
            <label>Campaign name<input name="name" required maxLength={160} placeholder="e.g. October service pilot" /></label>
            <button type="submit" disabled={!brands.length || Boolean(loadError)}>Create campaign</button>
          </form>
        </article>
      </section>

      <section className="campaign-list-section">
        <div className="section-title"><div><p className="eyebrow">PLANNING BOARD</p><h2>Campaigns</h2></div><span className="count-badge">{campaigns.length}</span></div>
        {!campaigns.length ? (
          <div className="empty-state management-empty"><span className="empty-icon">◫</span><strong>No campaigns yet</strong><p>Create a brand, then add your first campaign.</p></div>
        ) : campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            brandName={brandNames.get(campaign.brandId) ?? "Brand"}
            pods={podsByCampaign[campaign.id] ?? []}
            loadError={Boolean(loadError)}
          />
        ))}
      </section>

      <footer className="page-footer"><span>Local campaign workspace</span><span>Meta group creation stays disabled until eligibility is confirmed</span></footer>
    </div>
  );
}
