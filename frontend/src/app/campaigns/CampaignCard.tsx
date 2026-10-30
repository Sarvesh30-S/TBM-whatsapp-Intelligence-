"use client";

import { useState } from "react";
import {
  updateCampaign,
  deleteCampaign,
  createPod,
  deletePod,
  linkPodMetaGroup,
  unlinkPodMetaGroup,
  recordPodConsent,
  addPodParticipant,
  removePodParticipant,
} from "./actions";

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

type Campaign = {
  id: string;
  brandId: string;
  name: string;
  slug: string;
  status: string;
};

function PodRowItem({ pod }: { pod: Pod }) {
  const [isLinking, setIsLinking] = useState(false);
  const [metaGroupId, setMetaGroupId] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isAddingEntity, setIsAddingEntity] = useState(false);
  const [newWaId, setNewWaId] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

  const copyInvite = () => {
    if (pod.inviteLink) {
      navigator.clipboard.writeText(pod.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const filledCount = pod.filledSeats ?? (pod.participants ? pod.participants.length : 0);
  const plannedCount = pod.plannedExternalSeats || 0;
  const availableCount = Math.max(0, plannedCount - filledCount);
  const seatFillPercentage = plannedCount > 0 ? Math.min(100, (filledCount / plannedCount) * 100) : 0;

  return (
    <div className="pod-row-container">
      <div className="pod-row">
        <span className="pod-symbol">◉</span>
        <div className="pod-copy">
          <div className="pod-title-line">
            <strong>{pod.subject}</strong>
            {pod.metaGroupId ? (
              <span className="meta-linked-badge">
                <i className="dot green" /> {pod.metaGroupId}
              </span>
            ) : (
              <span className="meta-unlinked-badge">
                <i className="dot gray" /> Unlinked Group
              </span>
            )}
          </div>

          {/* Seat Status & Filled Info */}
          <div className="pod-seats-summary">
            <div className="seats-count-badge">
              <span className="seats-icon">💺</span>
              <strong>Seats: {filledCount} / {plannedCount} filled</strong>
              <span className="seats-avail-tag">({availableCount} available)</span>
            </div>
            <div className="seats-progress-track" title={`${filledCount} of ${plannedCount} seats filled`}>
              <div
                className="seats-progress-bar"
                style={{
                  width: `${seatFillPercentage}%`,
                  backgroundColor: filledCount >= plannedCount && plannedCount > 0 ? "#2ba84a" : "#2d8cf0",
                }}
              />
            </div>
          </div>

          <span className="pod-subcopy">
            Join: {pod.joinApprovalMode} &bull; Consent:{" "}
            {pod.consentSent ? (
              <b className="text-success">Recorded</b>
            ) : (
              <b className="text-warning">Pending</b>
            )}
            {" "}&bull;{" "}
            <button
              type="button"
              className="toggle-entities-link"
              onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            >
              {isParticipantsOpen ? "▲ Hide seated entities" : `▼ View seated entities (${pod.participants?.length || 0})`}
            </button>
          </span>

          {pod.inviteLink && (
            <div className="pod-invite-line">
              <span className="invite-url">{pod.inviteLink}</span>
              <button type="button" className="copy-link-btn" onClick={copyInvite}>
                {copied ? "✓ Copied!" : "📋 Copy Link"}
              </button>
            </div>
          )}
        </div>

        <div className="pod-actions">
          <span className={`status-pill ${pod.status.toLowerCase()}`}>
            {pod.status.replaceAll("_", " ")}
          </span>

          {pod.metaGroupId ? (
            <>
              {!pod.consentSent && (
                <form action={recordPodConsent}>
                  <input type="hidden" name="podId" value={pod.id} />
                  <button
                    type="submit"
                    className="pod-btn-action consent-btn"
                    title="Record pinned consent notice and activate pod"
                  >
                    ✓ Record Consent
                  </button>
                </form>
              )}
              <form
                action={unlinkPodMetaGroup}
                onSubmit={(e) => {
                  if (!confirm(`Unlink WhatsApp group from pod "${pod.subject}"?`)) {
                    e.preventDefault();
                  }
                }}
              >
                <input type="hidden" name="podId" value={pod.id} />
                <button
                  type="submit"
                  className="pod-btn-action unlink-btn"
                  title="Unlink Meta Group ID"
                >
                  ✕ Unlink
                </button>
              </form>
            </>
          ) : (
            <button
              type="button"
              className="pod-btn-action link-btn"
              onClick={() => setIsLinking(!isLinking)}
            >
              {isLinking ? "Cancel" : "🔗 Link WhatsApp Group"}
            </button>
          )}

          <form
            action={deletePod}
            onSubmit={(e) => {
              if (!confirm(`Delete pod "${pod.subject}"?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="podId" value={pod.id} />
            <button
              type="submit"
              className="pod-btn-action delete-pod-btn"
              title="Delete Pod"
            >
              🗑
            </button>
          </form>
        </div>
      </div>

      {/* Seated Entities Section */}
      {isParticipantsOpen && (
        <div className="pod-entities-panel">
          <div className="entities-header">
            <div>
              <h4>Entities Sitting in this Pod</h4>
              <p className="entities-sub">Showing specific WhatsApp IDs and names of assigned or active members.</p>
            </div>
            <button
              type="button"
              className="add-entity-btn"
              onClick={() => setIsAddingEntity(!isAddingEntity)}
            >
              {isAddingEntity ? "Cancel" : "+ Assign Seat"}
            </button>
          </div>

          {isAddingEntity && (
            <form
              action={async (formData) => {
                await addPodParticipant(formData);
                setIsAddingEntity(false);
                setNewWaId("");
                setNewDisplayName("");
              }}
              className="add-entity-form"
            >
              <input type="hidden" name="podId" value={pod.id} />
              <div className="add-entity-inputs">
                <label>
                  WhatsApp Phone / ID *
                  <input
                    name="waId"
                    required
                    placeholder="e.g. 919876543210"
                    value={newWaId}
                    onChange={(e) => setNewWaId(e.target.value)}
                  />
                </label>
                <label>
                  Entity / Contact Name
                  <input
                    name="displayName"
                    placeholder="e.g. Rahul Sharma"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" name="isExternal" defaultChecked />
                  External Entity
                </label>
              </div>
              <div className="add-entity-actions">
                <button type="submit" className="save-entity-btn">Confirm Seat</button>
                <button type="button" className="cancel-entity-btn" onClick={() => setIsAddingEntity(false)}>Cancel</button>
              </div>
            </form>
          )}

          {(!pod.participants || pod.participants.length === 0) ? (
            <div className="empty-entities">
              <span className="empty-icon-sm">👤</span>
              <p>No entities currently seated in this pod. Members who send messages in the linked group will automatically appear here, or you can assign seats manually.</p>
            </div>
          ) : (
            <div className="entities-grid">
              {pod.participants.map((p) => (
                <div className="entity-card" key={p.id}>
                  <div className="entity-avatar">
                    {(p.displayName || p.waId || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="entity-info">
                    <div className="entity-name-line">
                      <strong className="entity-name">{p.displayName || `+${p.waId}`}</strong>
                      <span className={`entity-role-badge ${p.isExternal ? "external" : "internal"}`}>
                        {p.isExternal ? "External" : "Internal"}
                      </span>
                    </div>
                    <div className="entity-id-line">
                      <span className="entity-waid" title="WhatsApp ID">ID: +{p.waId}</span>
                      <span className="entity-status">{p.status}</span>
                    </div>
                  </div>
                  <form
                    action={removePodParticipant}
                    onSubmit={(e) => {
                      if (!confirm(`Remove entity "${p.displayName || p.waId}" from this seat?`)) {
                        e.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="podId" value={pod.id} />
                    <input type="hidden" name="participantId" value={p.id} />
                    <button type="submit" className="entity-remove-btn" title="Remove entity from seat">
                      ✕
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isLinking && !pod.metaGroupId && (
        <form
          action={async (formData) => {
            await linkPodMetaGroup(formData);
            setIsLinking(false);
          }}
          className="pod-link-form"
        >
          <input type="hidden" name="podId" value={pod.id} />
          <div className="link-form-fields">
            <label>
              WhatsApp Group ID *
              <input
                name="metaGroupId"
                required
                maxLength={128}
                placeholder="e.g. 120363025555555555@g.us"
                value={metaGroupId}
                onChange={(e) => setMetaGroupId(e.target.value)}
              />
            </label>
            <label>
              Invite Link (optional)
              <input
                name="inviteLink"
                type="url"
                maxLength={1000}
                placeholder="https://chat.whatsapp.com/..."
                value={inviteLink}
                onChange={(e) => setInviteLink(e.target.value)}
              />
            </label>
          </div>
          <div className="link-form-btns">
            <button type="submit" className="save-btn">
              Link Group
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => setIsLinking(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function CampaignCard({
  campaign,
  brandName,
  pods,
  loadError,
}: {
  campaign: Campaign;
  brandName: string;
  pods: Pod[];
  loadError: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [status, setStatus] = useState(campaign.status);

  const statusClass =
    campaign.status === "ACTIVE"
      ? "active"
      : campaign.status === "PAUSED"
      ? "paused"
      : campaign.status === "COMPLETED"
      ? "completed"
      : "draft";

  return (
    <article className="campaign-card">
      <div className="campaign-card-head">
        <div className="campaign-head-info">
          <span className="brand-label">{brandName}</span>
          <h3>{campaign.name}</h3>
        </div>

        <div className="campaign-actions">
          <span className={`status-pill ${statusClass}`}>{campaign.status}</span>
          <button
            type="button"
            className="campaign-btn-subtle"
            onClick={() => setIsEditing(!isEditing)}
            title="Edit Campaign"
          >
            {isEditing ? "Close" : "✎ Edit"}
          </button>
          <form
            action={deleteCampaign}
            onSubmit={(e) => {
              if (
                !confirm(
                  `Delete campaign "${campaign.name}"? This will remove all planned pods under it.`
                )
              ) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="campaignId" value={campaign.id} />
            <button type="submit" className="campaign-btn-delete" title="Delete Campaign">
              🗑 Delete
            </button>
          </form>
        </div>
      </div>

      {isEditing && (
        <form
          action={async (formData) => {
            await updateCampaign(formData);
            setIsEditing(false);
          }}
          className="campaign-edit-form"
        >
          <input type="hidden" name="campaignId" value={campaign.id} />
          <div className="edit-field">
            <label className="edit-label">Name</label>
            <input
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </div>
          <div className="edit-field">
            <label className="edit-label">Status</label>
            <select
              name="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PAUSED">PAUSED</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
          </div>
          <div className="edit-buttons">
            <button type="submit" className="save-btn">
              Save Changes
            </button>
            <button
              type="button"
              className="cancel-btn"
              onClick={() => {
                setName(campaign.name);
                setStatus(campaign.status);
                setIsEditing(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="pod-list">
        {pods.map((pod) => (
          <PodRowItem key={pod.id} pod={pod} />
        ))}
        {!pods.length && <p className="no-pods">No pods planned for this campaign yet.</p>}
      </div>

      <form action={createPod} className="pod-form">
        <input type="hidden" name="campaignId" value={campaign.id} />
        <label>
          Pod name
          <input
            name="subject"
            required
            maxLength={255}
            placeholder={`${campaign.name} · Pod ${pods.length + 1}`}
          />
        </label>
        <label>
          External seats
          <input
            name="plannedExternalSeats"
            type="number"
            min={0}
            max={7}
            defaultValue={7}
            required
          />
        </label>
        <label>
          Join approval
          <select name="joinApprovalMode" defaultValue="approval_required">
            <option value="approval_required">Approval required</option>
            <option value="auto_approve">Auto approve</option>
          </select>
        </label>
        <button type="submit" disabled={loadError}>
          Plan pod
        </button>
      </form>
    </article>
  );
}
