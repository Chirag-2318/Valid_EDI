import type { UploadResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

export async function uploadFile(file: File): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UploadResponse>;
}

export async function batchUpload(file: File): Promise<any> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`${API_BASE}/api/batch`, { method: "POST", body: fd });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function askAi(question: string, context: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, context }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.answer ?? "No response";
}

export async function exportJson(payload: unknown): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/json`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.blob();
}

export async function exportPdf(issues: unknown[]): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/errors-pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ issues }),
  });
  return res.blob();
}

export async function exportCsv(rows: unknown[]): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/export/members-csv`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rows }),
  });
  return res.blob();
}
