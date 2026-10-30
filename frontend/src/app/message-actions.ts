"use server";

import { revalidatePath } from "next/cache";
import { deleteAdminRecord } from "@/lib/admin-api";

export async function deleteMessageAction(messageId: string) {
  if (!messageId || typeof messageId !== "string") {
    throw new Error("Message ID is required.");
  }

  await deleteAdminRecord(`/api/messages/${encodeURIComponent(messageId)}`);
  revalidatePath("/");
}
