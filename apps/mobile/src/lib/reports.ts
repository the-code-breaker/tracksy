import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { rpc } from "./supabase";
import { formatMoney } from "@tracksy/finance";
import type { Currency } from "@tracksy/domain";
type Report = {
  expenses: {
    description: string;
    amount_minor: number;
    currency: Currency;
    expense_date: string;
    category: string;
    reversed_at: string | null;
  }[];
  start: string;
  end: string;
  generated_at: string;
};
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function exportReport(
  groupId: string,
  groupName: string,
  start: string,
  end: string,
) {
  const report = await rpc<Report>("group_report", {
    p_group: groupId,
    p_start: start,
    p_end: end,
  });
  const rows = report.expenses
    .map(
      (e) =>
        `<tr><td>${escape(e.expense_date)}</td><td>${escape(e.description)}${e.reversed_at ? " (reversed)" : ""}</td><td>${escape(e.category)}</td><td>${escape(formatMoney(e.amount_minor, e.currency))}</td></tr>`,
    )
    .join("");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><style>body{font:12px Arial;padding:32px;color:#142e37}h1{color:#087f70}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #e3e9eb}footer{margin-top:32px;color:#61777f}</style><h1>tracksy / ${escape(groupName)}</h1><p>${escape(report.start)} – ${escape(report.end)}</p><p>All amounts are labeled by currency. Reversed expenses are shown for auditability and excluded from spending totals.</p><table><thead><tr><th>Date</th><th>Expense</th><th>Category</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><footer>Generated ${escape(report.generated_at)} · Tracksy records expenses and does not hold funds.</footer></html>`;
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const file = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is unavailable on this device");
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Tracksy financial report",
    UTI: "com.adobe.pdf",
  });
}
