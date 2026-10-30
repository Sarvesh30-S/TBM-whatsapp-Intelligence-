"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { postAdminRecord, patchAdminRecord, deleteAdminRecord } from "@/lib/admin-api";

function requiredText(formData: FormData, key: string) {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) throw new Error(`${key} is required.`);
  return value.trim();
}

async function finish(path: string, payload: unknown) {
  try {
    await postAdminRecord(path, payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The request failed.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function createBrand(formData: FormData) {
  const name = requiredText(formData, "name");
  await finish("/api/admin/brands", { name });
}

export async function createCampaign(formData: FormData) {
  const brandId = requiredText(formData, "brandId");
  const name = requiredText(formData, "name");
  await finish("/api/admin/campaigns", { brandId, name });
}

export async function updateCampaign(formData: FormData) {
  const campaignId = requiredText(formData, "campaignId");
  const name = String(formData.get("name") ?? "").trim();
  const status = String(formData.get("status") ?? "").trim();

  try {
    await patchAdminRecord(`/api/admin/campaigns/${encodeURIComponent(campaignId)}`, {
      ...(name ? { name } : {}),
      ...(status ? { status } : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update campaign.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function deleteCampaign(formData: FormData) {
  const campaignId = requiredText(formData, "campaignId");
  try {
    await deleteAdminRecord(`/api/admin/campaigns/${encodeURIComponent(campaignId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete campaign.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function createPod(formData: FormData) {
  const campaignId = requiredText(formData, "campaignId");
  const subject = requiredText(formData, "subject");
  const joinApprovalMode = requiredText(formData, "joinApprovalMode");
  const seats = Number(formData.get("plannedExternalSeats"));
  if (!Number.isInteger(seats) || seats < 0 || seats > 7) {
    redirect("/campaigns?error=Each+pod+can+plan+for+0+to+7+external+participants.");
  }
  await finish(`/api/admin/campaigns/${encodeURIComponent(campaignId)}/pods`, {
    subject,
    joinApprovalMode,
    plannedExternalSeats: seats,
  });
}

export async function linkPodMetaGroup(formData: FormData) {
  const podId = requiredText(formData, "podId");
  const metaGroupId = requiredText(formData, "metaGroupId");
  const inviteLink = String(formData.get("inviteLink") ?? "").trim();

  try {
    await patchAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}/link-meta-group`, {
      metaGroupId,
      inviteLink: inviteLink || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to link WhatsApp Group.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function unlinkPodMetaGroup(formData: FormData) {
  const podId = requiredText(formData, "podId");
  try {
    await deleteAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}/link-meta-group`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unlink WhatsApp Group.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function deletePod(formData: FormData) {
  const podId = requiredText(formData, "podId");
  try {
    await deleteAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete pod.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function recordPodConsent(formData: FormData) {
  const podId = requiredText(formData, "podId");
  try {
    await postAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}/consent`, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to record consent.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function addPodParticipant(formData: FormData) {
  const podId = requiredText(formData, "podId");
  const waId = requiredText(formData, "waId");
  const displayName = String(formData.get("displayName") ?? "").trim();
  const isExternal = formData.get("isExternal") !== "false";

  try {
    await postAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}/participants`, {
      waId,
      displayName: displayName || null,
      isExternal,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add participant to pod.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}

export async function removePodParticipant(formData: FormData) {
  const podId = requiredText(formData, "podId");
  const participantId = requiredText(formData, "participantId");

  try {
    await deleteAdminRecord(`/api/admin/pods/${encodeURIComponent(podId)}/participants/${encodeURIComponent(participantId)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove participant from pod.";
    redirect(`/campaigns?error=${encodeURIComponent(message)}`);
  }
  revalidatePath("/");
  revalidatePath("/campaigns");
}
