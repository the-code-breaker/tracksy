import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import { supabase, rpc } from "./supabase";
export async function pickReceipt(
  groupId: string,
  expenseId: string,
  userId: string,
) {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return;
  const asset = result.assets[0]!;
  if ((asset.size ?? 0) > 10485760)
    throw new Error("Receipts must be smaller than 10 MB");
  const extension =
    asset.mimeType === "application/pdf"
      ? "pdf"
      : asset.mimeType === "image/png"
        ? "png"
        : asset.mimeType === "image/webp"
          ? "webp"
          : "jpg";
  const path = `${groupId}/${userId}/${Crypto.randomUUID()}.${extension}`;
  const bytes = await (await fetch(asset.uri)).arrayBuffer();
  if (bytes.byteLength > 10485760)
    throw new Error("Receipts must be smaller than 10 MB");
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, bytes, {
      contentType: asset.mimeType || "image/jpeg",
      upsert: false,
    });
  if (error) throw error;
  try {
    await rpc("attach_receipt", { p_expense: expenseId, p_path: path });
  } catch (e) {
    /* Private orphan retained for operator cleanup; no financial record is created. */ throw e;
  }
}
