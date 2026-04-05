import { useEffect } from 'react';

const bodyClassName = 'bg-background text-on-surface selection:bg-primary-fixed page-documentation';

export function DocumentationPage() {
  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;

    return () => {
      document.body.className = previous;
    };
  }, []);

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-72 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl flex flex-col p-6 z-40 border-r border-slate-200/20 glass-nav">
        <div className="mb-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="EdiPro logo" className="h-6 w-6 rounded-md object-contain" />
            <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase">EdiPro</h1>
          </div>
          <p className="text-[10px] font-bold tracking-widest text-slate-500 mt-1 uppercase">EDI Management Documentation</p>
        </div>
        <nav className="flex-1 space-y-8 overflow-y-auto pr-2">
          <div>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Introduction</h2>
            <ul className="space-y-3">
              <li>
                <a className="flex items-center gap-3 text-blue-600 font-semibold bg-white/50 px-3 py-2 rounded-lg shadow-sm group" href="#architecture">
                  <span className="material-symbols-outlined text-sm">hub</span>
                  System Architecture
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#x12-versions">
                  <span className="material-symbols-outlined text-sm">terminal</span>
                  X12 Versions
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">API Reference</h2>
            <ul className="space-y-3">
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#auth">
                  <span className="material-symbols-outlined text-sm">key</span>
                  Authentication
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#endpoints">
                  <span className="material-symbols-outlined text-sm">api</span>
                  Endpoints
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#response-codes">
                  <span className="material-symbols-outlined text-sm">code_off</span>
                  Response Codes
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Implementation</h2>
            <ul className="space-y-3">
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#snip-rules">
                  <span className="material-symbols-outlined text-sm">fact_check</span>
                  SNIP Levels 1-7
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#validator-guides">
                  <span className="material-symbols-outlined text-sm">rule</span>
                  Validator Rulesets
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-4">Governance</h2>
            <ul className="space-y-3">
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#compliance">
                  <span className="material-symbols-outlined text-sm">verified_user</span>
                  Compliance &amp; Security
                </a>
              </li>
              <li>
                <a className="flex items-center gap-3 text-slate-500 hover:text-slate-900 transition-colors px-3 py-2 rounded-lg" href="#release-notes">
                  <span className="material-symbols-outlined text-sm">history</span>
                  Release Notes
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <div className="mt-auto pt-6 border-t border-slate-200/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-white">
              <span className="material-symbols-outlined">person</span>
            </div>
            <div>
              <p className="text-sm font-bold">Developer Docs</p>
              <p className="text-[10px] text-slate-500">v4.12.0 Stable</p>
            </div>
          </div>
        </div>
      </aside>

      <header className="fixed top-0 left-72 right-0 bg-white/80 backdrop-blur-xl z-30 px-10 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-6">
          <span className="text-sm font-medium text-slate-500">Documentation</span>
          <span className="material-symbols-outlined text-slate-300">chevron_right</span>
          <span className="text-sm font-semibold text-blue-600">Developer Portal</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 text-lg">search</span>
            <input
              className="bg-surface-container-low border-none rounded-xl pl-10 pr-4 py-2 text-sm w-64 focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Search documentation..."
              type="text"
            />
          </div>
          <button className="bg-primary text-white text-sm font-medium px-4 py-2 rounded-xl hover:opacity-90 transition-all flex items-center gap-2" type="button">
            <span className="material-symbols-outlined text-sm">cloud_upload</span>
            Upload File
          </button>
        </div>
      </header>

      <main className="ml-72 pt-24 pb-20 px-16 max-w-6xl">
        <section className="mb-24" id="architecture">
          <div className="mb-8">
            <span className="text-tertiary font-bold tracking-widest text-[10px] uppercase bg-tertiary/10 px-2 py-1 rounded">Getting Started</span>
            <h2 className="text-4xl font-extrabold tracking-tight mt-4 text-on-surface">System Architecture</h2>
            <p className="text-lg text-on-surface-variant mt-4 leading-relaxed max-w-3xl">
              EdiPro is built on a distributed microservices framework designed specifically for high-throughput Healthcare EDI processing. It
              leverages specialized parsing engines to handle X12 payloads with sub-millisecond latency.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm mb-6">
                  <span className="material-symbols-outlined text-primary">schema</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Event-Driven Core</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  Utilizes Apache Kafka for durable message queuing and real-time streaming of EDI interchanges across SNIP validation tiers.
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-[120px] font-thin">hub</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm mb-6">
                  <span className="material-symbols-outlined text-tertiary">memory</span>
                </div>
                <h3 className="text-xl font-bold mb-3">Hybrid Parser</h3>
                <p className="text-on-surface-variant text-sm leading-relaxed">
                  A proprietary Rust-based engine that converts raw EDI to JSON/FHIR formats while maintaining full structural lineage.
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <span className="material-symbols-outlined text-[120px] font-thin">settings_input_component</span>
              </div>
            </div>
          </div>
          <div className="mt-12 pt-12 border-t border-outline-variant/20" id="x12-versions">
            <h3 className="text-2xl font-bold mb-6">Supported X12 Versions</h3>
            <div className="overflow-hidden rounded-xl border border-outline-variant/10">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-container-high text-on-surface font-semibold">
                  <tr>
                    <th className="px-6 py-4">Transaction Set</th>
                    <th className="px-6 py-4">Description</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr className="bg-white hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary">837 P/I/D</td>
                    <td className="px-6 py-4 text-on-surface-variant">Health Care Claims (Professional/Institutional/Dental)</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">Stable</span>
                    </td>
                  </tr>
                  <tr className="bg-white hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary">835</td>
                    <td className="px-6 py-4 text-on-surface-variant">Electronic Remittance Advice (ERA)</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold uppercase">Stable</span>
                    </td>
                  </tr>
                  <tr className="bg-white hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-primary">270/271</td>
                    <td className="px-6 py-4 text-on-surface-variant">Eligibility Benefit Inquiry and Response</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase">Beta</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-24 scroll-mt-24" id="auth">
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface mb-8">API Reference</h2>
          <div className="mb-12">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">lock_open</span> Authentication
            </h3>
            <p className="text-on-surface-variant mb-6 leading-relaxed">
              EdiPro uses OAuth 2.0 Client Credentials flow. All API requests must be made over HTTPS. Calls made over plain HTTP will fail. API
              requests without authentication will also fail.
            </p>
            <div className="edi-code-block rounded-xl p-6 relative group">
              <button className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-xs px-3 py-1 rounded transition-colors flex items-center gap-2 text-white/70" type="button">
                <span className="material-symbols-outlined text-xs">content_copy</span> Copy
              </button>
              <pre className="text-sm">
                <code>{`curl -X POST https://api.luminousledger.com/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"`}</code>
              </pre>
            </div>
          </div>
          <div className="mb-12" id="endpoints">
            <h3 className="text-xl font-bold mb-6">Available Endpoints</h3>
            <div className="space-y-4">
              <div className="bg-surface-container-low p-5 rounded-xl border-l-4 border-primary">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-primary text-white px-2 py-0.5 rounded">POST</span>
                    <code className="text-sm font-bold">/v1/parser/x12/validate</code>
                  </div>
                  <span className="text-xs text-on-surface-variant">Validate EDI without persisting</span>
                </div>
                <p className="text-xs text-on-surface-variant">Primary endpoint for real-time SNIP validation of claim files.</p>
              </div>
              <div className="bg-surface-container-low p-5 rounded-xl border-l-4 border-tertiary">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black bg-tertiary text-white px-2 py-0.5 rounded">GET</span>
                    <code className="text-sm font-bold">{`/v1/claims/{claimId}/status`}</code>
                  </div>
                  <span className="text-xs text-on-surface-variant">Retrieve claim lifecycle status</span>
                </div>
                <p className="text-xs text-on-surface-variant">Fetch the current clearinghouse status and ACK records.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-24 scroll-mt-24" id="snip-rules">
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface mb-8">Validator Implementation</h2>
          <p className="text-on-surface-variant mb-12 max-w-3xl">
            Our engine performs WEDI SNIP validation up to Level 7. Each level is processed in a sequential pipeline to ensure data integrity and
            compliance.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-start">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">1</div>
              <h4 className="font-bold mb-2">Integrity Check</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Basic structural integrity including segment order and envelope balancing (ISA/IEA, GS/GE).
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-start">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">2</div>
              <h4 className="font-bold mb-2">Requirement Check</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Validation of mandatory segments and data elements based on the TR3 implementation guide.
              </p>
            </div>
            <div className="p-6 rounded-2xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col items-start">
              <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold mb-4">3</div>
              <h4 className="font-bold mb-2">Balancing Check</h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Validation of claim amounts against service line items and hierarchical level counts.
              </p>
            </div>
          </div>
          <div className="mt-12 bg-white/50 p-8 rounded-2xl border border-dashed border-outline-variant">
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-tertiary">psychology</span>
              AI-Driven Parsing Hint (SNIP 7)
            </h4>
            <p className="text-sm text-on-surface-variant mb-6">
              Our AI models analyze historical trading partner behavior to predict "Unwritten Rules" of specific clearinghouses, effectively
              providing Level 7 Custom Validation.
            </p>
            <div className="edi-code-block rounded-xl p-6 relative">
              <div className="text-[10px] uppercase font-bold text-tertiary-fixed-dim mb-2">Sample EDI String (837P)</div>
              <pre className="text-xs leading-relaxed overflow-x-auto">
                <code>{`ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     *230915*1200*^*00501*000000001*0*P*:~
GS*HC*SUBMITTERID*RECEIVERID*20230915*1200*1*X*005010X222A1~
ST*837*0001*005010X222A1~
BHT*0019*00*0123*20230915*1200*CH~`}</code>
              </pre>
            </div>
          </div>
        </section>

        <section className="mb-24 scroll-mt-24" id="compliance">
          <h2 className="text-4xl font-extrabold tracking-tight text-on-surface mb-8">Compliance &amp; Security</h2>
          <div className="bg-primary/5 p-10 rounded-3xl border border-primary/10">
            <div className="flex flex-col md:flex-row gap-12">
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-6">HIPAA &amp; HITECH Alignment</h3>
                <p className="text-on-surface-variant leading-relaxed mb-6">
                  EdiPro is architected from the ground up for full HIPAA/HITECH compliance. All data at rest is encrypted using AES-256-GCM, and
                  data in transit is protected via TLS 1.3 with Perfect Forward Secrecy.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                    <span className="text-sm">HITRUST CSF Certified infrastructure.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                    <span className="text-sm">Automated PHI redaction for testing environments.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                    <span className="text-sm">Immutable audit logs for every data access event.</span>
                  </li>
                </ul>
              </div>
              <div className="w-full md:w-80 h-64 bg-white rounded-2xl shadow-inner flex items-center justify-center p-8 text-center border border-primary/5">
                <div className="space-y-4">
                  <span className="material-symbols-outlined text-6xl text-primary/20">verified_user</span>
                  <div className="text-lg font-black text-slate-800">SOC 2 Type II</div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Compliance Audit: 2024</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="pt-12 border-t border-outline-variant/20 flex flex-col items-center" id="release-notes">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-4">Latest Updates</h2>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full text-xs font-semibold text-slate-600 mb-8">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              Systems Operational
            </div>
          </div>
          <div className="w-full max-w-2xl space-y-8">
            <div className="flex gap-6">
              <div className="text-right w-24 flex-shrink-0">
                <span className="text-xs font-bold text-slate-400">SEPT 24</span>
              </div>
              <div className="relative pb-8 border-l-2 border-slate-100 pl-8">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary border-4 border-white shadow-sm"></div>
                <h4 className="font-bold text-sm mb-2">v4.12.0 - Core Engine Upgrade</h4>
                <p className="text-xs text-on-surface-variant">Optimized ISA envelope processing for large batches. Improved performance by 22% for files &gt; 500MB.</p>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="text-right w-24 flex-shrink-0">
                <span className="text-xs font-bold text-slate-400">AUG 12</span>
              </div>
              <div className="relative pb-8 border-l-2 border-slate-100 pl-8">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-slate-300 border-4 border-white shadow-sm"></div>
                <h4 className="font-bold text-sm mb-2">v4.11.2 - Stability Patch</h4>
                <p className="text-xs text-on-surface-variant">Resolved segment truncation issues in 835 Remittance responses for specific payer IDs.</p>
              </div>
            </div>
          </div>
          <div className="mt-20 py-10 w-full text-center border-t border-slate-100">
            <p className="text-xs text-slate-400">&copy; 2024 EdiPro Systems. All rights reserved. HIPAA Compliance Guaranteed.</p>
          </div>
        </footer>
      </main>

      <div className="fixed bottom-8 right-8 z-50">
        <button className="bg-white/70 backdrop-blur-xl shadow-2xl p-4 rounded-2xl flex items-center gap-4 border border-slate-200/50 hover:scale-105 transition-all" type="button">
          <div className="w-8 h-8 rounded-lg bg-tertiary flex items-center justify-center text-white">
            <span className="material-symbols-outlined text-lg">chat_bubble</span>
          </div>
          <div className="text-left pr-4">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developer Help</div>
            <div className="text-sm font-bold text-slate-900">Ask the AI Docs</div>
          </div>
        </button>
      </div>
    </>
  );
}

