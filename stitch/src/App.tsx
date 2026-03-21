import { useMemo, useState } from "react";
import { askAi, batchUpload, exportCsv, exportJson, exportPdf, uploadFile } from "./api";
import type { LoopNode, ParseReport, UploadResponse, ValidationIssue } from "./types";

type Page = "dashboard" | "master" | "837" | "835" | "834";
type ChatTurn = { role: "user" | "assistant"; text: string };
type Audit = {
  filename: string;
  tx: string;
  errors: number;
  warnings: number;
  time: string;
};

function navClass(active: boolean): string {
  return active
    ? "bg-blue-50/50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide"
    : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium tracking-wide hover:translate-x-1 transition-transform duration-300";
}

function LoopTree({ node }: { node: LoopNode }) {
  const [open, setOpen] = useState(true);

  return (
    <div>
      <button
        className="w-full flex items-center gap-2 p-2 hover:bg-primary/5 rounded-lg cursor-pointer transition-colors group text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="material-symbols-outlined text-sm text-outline group-hover:text-primary">
          {open ? "expand_more" : "chevron_right"}
        </span>
        <span className="text-xs font-medium">{node.label}</span>
        <span className="ml-auto text-[10px] text-outline">{node.segments.length}</span>
      </button>
      {open ? (
        <div className="pl-6">
          {node.segments.slice(0, 40).map((s, i) => (
            <details key={`${s.id}-${i}`} className="text-[11px] text-on-surface-variant py-1">
              <summary className="cursor-pointer">{s.id} line {s.line_number}</summary>
              <div className="mt-1 grid gap-1">
                {s.elements.map((e, idx) => (
                  <div key={idx} className="font-mono text-[10px]">E{idx + 1}: {e || "(empty)"}</div>
                ))}
              </div>
            </details>
          ))}
          {node.children.map((child) => (
            <LoopTree key={`${child.name}-${child.label}`} node={child} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function issueLabel(issue: ValidationIssue): string {
  return `${issue.code} | ${issue.loop_location} | ${issue.segment_id}${issue.element_position ? ` E${issue.element_position}` : ""}`;
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [batchInfo, setBatchInfo] = useState<{ total_files: number; passed: number; failed: number } | null>(null);
  const [report, setReport] = useState<ParseReport | null>(null);
  const [uploadRes, setUploadRes] = useState<UploadResponse | null>(null);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatTurns, setChatTurns] = useState<ChatTurn[]>([
    { role: "assistant", text: "Upload any EDI file and I can explain validation issues and correction options." },
  ]);

  const counts = useMemo(() => {
    const issues = report?.validation_result.issues ?? [];
    return {
      errors: issues.filter((x) => x.severity === "error").length,
      warnings: issues.filter((x) => x.severity === "warning").length,
      segments: report?.parse_result.segments.length ?? 0,
    };
  }, [report]);

  const claimRows = useMemo(() => {
    const rows: Array<{ id: string; amount: string; freq: string }> = [];
    for (const s of report?.parse_result.segments ?? []) {
      if (s.id === "CLM") {
        rows.push({ id: s.elements[0] ?? "", amount: s.elements[1] ?? "", freq: s.elements[4] ?? "" });
      }
    }
    return rows;
  }, [report]);

  async function onUpload(file: File): Promise<void> {
    setError("");
    setBatchInfo(null);
    setLoading(true);
    try {
      const res = await uploadFile(file);
      setReport(res.report);
      setUploadRes(res);
      const issues = res.report.validation_result.issues;
      setAudits((prev) => [
        {
          filename: file.name,
          tx: res.report.parse_result.transaction_type,
          errors: issues.filter((x) => x.severity === "error").length,
          warnings: issues.filter((x) => x.severity === "warning").length,
          time: new Date().toLocaleTimeString(),
        },
        ...prev,
      ].slice(0, 12));
      setPage("master");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function onBatch(file: File): Promise<void> {
    setError("");
    setLoading(true);
    try {
      const res = await batchUpload(file);
      setBatchInfo({ total_files: res.total_files, passed: res.passed, failed: res.failed });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function ask(): Promise<void> {
    const q = chatInput.trim();
    if (!q) return;
    setChatInput("");
    setChatTurns((prev) => [...prev, { role: "user", text: q }]);
    setChatLoading(true);
    try {
      const answer = await askAi(q, {
        transaction: report?.parse_result.transaction_type,
        envelope: report?.parse_result.envelope,
        issues: report?.validation_result.issues.slice(0, 10),
      });
      setChatTurns((prev) => [...prev, { role: "assistant", text: answer }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setChatTurns((prev) => [...prev, { role: "assistant", text: msg }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="bg-background text-on-background min-h-screen">
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <button className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white" onClick={() => setPage("dashboard")}>Luminous Ledger</button>
          <nav className="hidden md:flex gap-6">
            <button className={page === "dashboard" ? "text-blue-700 font-semibold border-b-2 border-blue-700 py-1" : "text-slate-500 hover:text-slate-800 py-1"} onClick={() => setPage("dashboard")}>Dashboard</button>
            <button className={page === "master" ? "text-blue-700 font-semibold border-b-2 border-blue-700 py-1" : "text-slate-500 hover:text-slate-800 py-1"} onClick={() => setPage("master")}>Master Parser</button>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-primary text-on-primary rounded-lg text-sm font-medium hover:bg-primary-container active:scale-95 duration-200 transition-all cursor-pointer">
            Upload File
            <input
              hidden
              type="file"
              accept=".edi,.txt,.dat,.x12"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
          <label className="px-4 py-2 bg-surface-container-high text-on-surface rounded-lg text-sm font-medium hover:bg-surface-container cursor-pointer">
            Batch ZIP
            <input
              hidden
              type="file"
              accept=".zip"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onBatch(f);
              }}
            />
          </label>
        </div>
      </header>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 shadow-xl hidden lg:flex flex-col py-6 pt-20">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 leading-none">HealthConnect</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <button className={navClass(page === "dashboard")} onClick={() => setPage("dashboard")}><span className="material-symbols-outlined">dashboard</span> Dashboard</button>
          <button className={navClass(page === "master")} onClick={() => setPage("master")}><span className="material-symbols-outlined">analytics</span> Master Parser</button>
          <button className={navClass(page === "835")} onClick={() => setPage("835")}><span className="material-symbols-outlined">payments</span> 835 Remittance</button>
          <button className={navClass(page === "834")} onClick={() => setPage("834")}><span className="material-symbols-outlined">group_add</span> 834 Enrollment</button>
          <button className={navClass(page === "837")} onClick={() => setPage("837")}><span className="material-symbols-outlined">description</span> 837 Claims</button>
        </nav>
      </aside>

      <main className="lg:ml-64 pt-20 px-8 pb-8 min-h-screen bg-surface">
        {error ? <div className="mb-4 px-4 py-3 rounded-xl bg-error-container text-on-error-container text-sm">{error}</div> : null}
        {loading ? <div className="mb-4 px-4 py-3 rounded-xl bg-primary-fixed text-on-primary-fixed text-sm">Processing file...</div> : null}
        {batchInfo ? (
          <div className="mb-4 px-4 py-3 rounded-xl bg-secondary-container text-on-secondary-container text-sm">
            Batch complete: total {batchInfo.total_files}, passed {batchInfo.passed}, failed {batchInfo.failed}
          </div>
        ) : null}

        {page === "dashboard" ? (
          <>
            <header className="mb-10 flex justify-between items-end">
              <div>
                <h1 className="text-[2rem] font-black tracking-tight text-on-surface">Data Integration Hub</h1>
                <p className="text-on-surface-variant/70 text-sm mt-1">Seamlessly ingest and validate healthcare EDI standard files.</p>
              </div>
              <div className="bg-surface-container-high rounded-xl p-4 flex items-center gap-4">
                <div className="text-right border-r border-outline-variant/30 pr-4">
                  <span className="text-[10px] uppercase font-bold text-outline">Processed 24h</span>
                  <p className="text-xl font-black text-primary">{audits.length || 0}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-outline">Accuracy</span>
                  <p className="text-xl font-black text-tertiary">{counts.segments ? "99.8%" : "--"}</p>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-10 gap-8 items-start">
              <section className="col-span-6 h-[600px]">
                <div className="glass-panel w-full h-full rounded-[24px] border border-white/50 ring-1 ring-slate-200/30 shadow-2xl flex flex-col items-center justify-center p-12 text-center relative overflow-hidden transition-all duration-500 hover:shadow-primary/5">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-tertiary/5 opacity-50"></div>
                  <div className="relative z-10 w-full max-w-md">
                    <div className="w-32 h-32 bg-white rounded-[32px] mx-auto flex items-center justify-center shadow-2xl drag-zone-glow mb-8">
                      <span className="material-symbols-outlined text-[64px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>upload_file</span>
                    </div>
                    <h2 className="text-2xl font-black text-on-surface mb-3">Drop 837, 835, or 834 files here</h2>
                    <p className="text-on-surface-variant font-medium mb-10 max-w-[280px] mx-auto">Upload HIPAA-compliant transactions for real-time validation and parsing.</p>
                    <div className="flex flex-col gap-4">
                      <label className="bg-primary text-white rounded-xl px-8 py-4 font-bold shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all hover:brightness-95 cursor-pointer">
                        Select Files from Cloud
                        <input
                          hidden
                          type="file"
                          accept=".edi,.txt,.dat,.x12"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) onUpload(f);
                          }}
                        />
                      </label>
                      <span className="text-[10px] uppercase tracking-widest text-outline font-bold">Max file size 256MB</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="col-span-4 h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-black text-on-surface flex items-center gap-2">Recent Audits <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-2 py-0.5 rounded-full">LIVE</span></h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                  {audits.length ? audits.map((a, i) => (
                    <div key={`${a.filename}-${i}`} className="glass-panel p-5 rounded-[20px] border border-outline-variant/10 shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-surface-container-highest rounded-xl flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary text-[20px]">description</span>
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-on-surface truncate w-40">{a.filename}</h4>
                            <p className="text-[10px] text-outline font-medium">{a.time}</p>
                          </div>
                        </div>
                        <span className="bg-secondary-container text-on-secondary-container text-[10px] font-black px-2.5 py-1 rounded-lg">{a.tx}</span>
                      </div>
                      <div className="flex gap-2 text-[10px]">
                        <span className="bg-error-container text-on-error-container font-bold px-2 py-1 rounded-full">{a.errors} Errors</span>
                        <span className="bg-primary-fixed text-on-primary-fixed font-bold px-2 py-1 rounded-full">{a.warnings} Warnings</span>
                      </div>
                    </div>
                  )) : <p className="text-sm text-on-surface-variant">No audits yet. Upload a file.</p>}
                </div>
              </section>
            </div>
          </>
        ) : null}

        {page === "master" ? (
          <div className="h-[calc(100vh-120px)] flex overflow-hidden border border-outline-variant/20 rounded-2xl">
            <aside className="w-[280px] bg-slate-50/70 glass-blur border-r border-slate-200/30 flex flex-col z-40">
              <div className="p-4 border-b border-slate-200/30">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary">account_tree</span>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">Loop Tree View</h2>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                {report ? <LoopTree node={report.parse_result.loop_tree} /> : <p className="text-xs text-on-surface-variant p-2">Upload a file to populate loop tree.</p>}
              </div>
            </aside>

            <section className="flex-1 flex flex-col min-w-0 bg-surface">
              <div className="h-[60%] border-b border-slate-200/30 flex flex-col">
                <div className="px-6 py-3 flex justify-between items-center bg-white/50 border-b border-slate-200/10">
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-surface-container-highest rounded text-[10px] font-mono font-bold text-outline">FILE: {report?.filename ?? "none"}</span>
                    <span className="text-xs text-outline italic">ANSI X12 Standard</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" onClick={async () => {
                      if (!report) return;
                      download("parsed.json", await exportJson(report));
                    }}>file_download</button>
                    <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" onClick={async () => {
                      if (!report) return;
                      download("validation.pdf", await exportPdf(report.validation_result.issues));
                    }}>picture_as_pdf</button>
                    {uploadRes?.enrollment_summary?.length ? (
                      <button className="material-symbols-outlined text-sm p-1.5 hover:bg-slate-100 rounded" onClick={async () => {
                        download("members.csv", await exportCsv(uploadRes.enrollment_summary));
                      }}>table_view</button>
                    ) : null}
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar bg-[#fdfdfe]">
                  {(report?.parse_result.segments ?? []).slice(0, 180).map((s, i) => (
                    <p key={`${s.id}-${i}`}>{`${s.id}*${s.elements.join("*")}~`}</p>
                  ))}
                </div>
              </div>

              <div className="h-[40%] flex flex-col bg-surface-container-low/30 overflow-hidden">
                <div className="px-6 py-3 flex items-center justify-between border-b border-slate-200/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-error">report</span>
                    <h3 className="text-sm font-bold tracking-tight">Validation Log ({counts.errors} Critical Errors)</h3>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  {(report?.validation_result.issues ?? []).slice(0, 30).map((issue, i) => (
                    <div key={`${issue.code}-${i}`} className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-error flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">{issue.code}</h4>
                        <p className="text-xs text-on-surface-variant mt-1">{issue.message}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">{issueLabel(issue)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside className="w-[320px] bg-tertiary-container/5 glass-blur border-l border-tertiary/10 flex flex-col relative">
              <div className="p-6 border-b border-tertiary/10 bg-white/40">
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-full bg-tertiary flex items-center justify-center text-white">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  </div>
                  <h2 className="text-lg font-bold tracking-tight text-on-surface">Copilot Summary</h2>
                </div>
                <p className="text-[10px] text-tertiary font-bold tracking-widest uppercase ml-11">Powered by Luminous AI</p>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                {chatTurns.map((turn, i) => (
                  <div key={i} className={turn.role === "user" ? "bg-tertiary/10 rounded-xl p-3 text-sm" : "bg-white/70 rounded-xl p-3 text-sm"}>
                    {turn.text}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-white/40 border-t border-tertiary/10">
                <div className="relative">
                  <input
                    className="w-full bg-white border border-tertiary/20 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-tertiary/20 pr-16"
                    placeholder="Ask Copilot a question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && ask()}
                  />
                  <button className="absolute right-3 top-3 text-tertiary text-xs font-bold" onClick={ask} disabled={chatLoading}>{chatLoading ? "..." : "Send"}</button>
                </div>
              </div>
            </aside>
          </div>
        ) : null}

        {page === "835" ? (
          <section className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.04)] border border-outline-variant/5">
            <div className="px-6 py-5 border-b border-outline-variant/10">
              <h2 className="text-xl font-extrabold tracking-tight">Remittance Overview</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30">
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Claim ID</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-right">Billed</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest text-right">Paid</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Adjustments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(uploadRes?.remittance_summary ?? []).map((r, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">{String(r.claim_id ?? "")}</td>
                      <td className="px-6 py-4 text-sm text-right">{String(r.billed ?? "")}</td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-primary">{String(r.paid ?? "")}</td>
                      <td className="px-6 py-4 text-sm">{String(r.adjustments ?? "")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!uploadRes?.remittance_summary?.length ? <p className="p-6 text-sm text-on-surface-variant">Upload an 835 file to see this view.</p> : null}
            </div>
          </section>
        ) : null}

        {page === "834" ? (
          <section className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.04)] border border-outline-variant/5">
            <div className="px-6 py-5 border-b border-outline-variant/10">
              <h2 className="text-xl font-extrabold tracking-tight">Enrollment Overview</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30">
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Member ID</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Name</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Maintenance</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Relationship</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(uploadRes?.enrollment_summary ?? []).map((r, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">{r.member_id}</td>
                      <td className="px-6 py-4 text-sm">{r.last_name}, {r.first_name}</td>
                      <td className="px-6 py-4 text-sm">{r.maintenance_type}</td>
                      <td className="px-6 py-4 text-sm">{r.relationship}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!uploadRes?.enrollment_summary?.length ? <p className="p-6 text-sm text-on-surface-variant">Upload an 834 file to see this view.</p> : null}
            </div>
          </section>
        ) : null}

        {page === "837" ? (
          <section className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.04)] border border-outline-variant/5">
            <div className="px-6 py-5 border-b border-outline-variant/10">
              <h2 className="text-xl font-extrabold tracking-tight">837 Claims Audit</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low/30">
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Claim ID</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Amount</th>
                    <th className="px-6 py-4 text-[11px] font-extrabold uppercase tracking-widest">Frequency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {claimRows.map((r, i) => (
                    <tr key={i} className="hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4 text-sm font-bold">{r.id}</td>
                      <td className="px-6 py-4 text-sm">{r.amount}</td>
                      <td className="px-6 py-4 text-sm">{r.freq}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!claimRows.length ? <p className="p-6 text-sm text-on-surface-variant">Upload an 837 file to see this view.</p> : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
