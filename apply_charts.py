import re

# ============================================================
# 1. Claims837.jsx
# ============================================================
path = r"C:\Users\Admin\.kiro\CleanEDI\stitch\src\pages\Claims837.jsx"
content = open(path, encoding="utf-8").read()

# Add recharts import after existing import line 1
content = content.replace(
    "import { useState, useEffect } from 'react';",
    "import { useState, useEffect } from 'react';\nimport { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';"
)

# Replace SVG chart block with recharts AreaChart
old_svg_claims = """{billedByDate.length > 0 && (
                <div className="mt-8 glass-panel rounded-2xl border border-outline-variant/10 shadow-sm p-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Total Billed by Date</h3>
                  <svg width="100%" height="160" viewBox={`0 0 ${Math.max(billedByDate.length * 80, 400)} 160`} preserveAspectRatio="xMidYMid meet">
                    {(() => {
                      const max = Math.max(...billedByDate.map((d) => d.amount), 1);
                      return billedByDate.map((d, i) => {
                        const barH = Math.max(4, (d.amount / max) * 120);
                        const x = i * 80 + 10;
                        return (
                          <g key={i}>
                            <rect x={x} y={130 - barH} width={50} height={barH} rx={6} fill="var(--color-primary, #4f46e5)" opacity="0.85" />
                            <text x={x + 25} y={148} textAnchor="middle" fontSize="9" fill="#94a3b8">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
                            <text x={x + 25} y={130 - barH - 6} textAnchor="middle" fontSize="9" fill="#4f46e5" fontWeight="bold">${d.amount >= 1000 ? (d.amount / 1000).toFixed(1) + 'k' : d.amount.toFixed(0)}</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
              )}"""

new_area_claims = """{billedByDate.length > 0 && (
                <div className="mt-8 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-base font-bold text-on-surface">Billed Amount Over Time</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Total billed per upload date across all 837 files</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="w-3 h-3 rounded-full bg-primary inline-block"></span>Billed ($)
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={billedByDate} margin={{top:10, right:20, left:0, bottom:0}}>
                      <defs>
                        <linearGradient id="billedGrad837" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                      <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                      <YAxis tickFormatter={v => v >= 1000 ? '$'+(v/1000).toFixed(0)+'k' : '$'+v} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} width={50}/>
                      <Tooltip formatter={(v) => ['$'+v.toLocaleString('en-US',{minimumFractionDigits:2}), 'Billed']} labelFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}}/>
                      <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2.5} fill="url(#billedGrad837)" dot={{fill:'#4f46e5',strokeWidth:0,r:3}} activeDot={{r:5}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-outline-variant/10">
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Files</p>
                      <p className="text-lg font-black text-on-surface">{filteredFiles.length}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Billed</p>
                      <p className="text-lg font-black text-primary">${filteredFiles.reduce((s,f)=>s+(f.totalBilled||0),0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clean Rate</p>
                      <p className="text-lg font-black text-green-600">{filteredFiles.length > 0 ? Math.round((filteredFiles.filter(f=>f.is_valid).length/filteredFiles.length)*100) : 0}%</p>
                    </div>
                  </div>
                </div>
              )}"""

if old_svg_claims in content:
    content = content.replace(old_svg_claims, new_area_claims)
    print("Claims837: SVG chart replaced OK")
else:
    print("Claims837: SVG chart NOT FOUND - trying regex")
    content = re.sub(
        r'\{billedByDate\.length > 0 && \(\s*<div className="mt-8 glass-panel.*?</div>\s*\)\}',
        new_area_claims,
        content,
        flags=re.DOTALL
    )
    print("Claims837: regex replace done")

# Add donut chart after NPI Mismatch button
old_npi = """                  <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> NPI Mismatch</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">0</span>
                  </button>
                </div>
              </div>"""

new_npi = """                  <button className="w-full flex justify-between items-center p-2 text-sm font-medium text-slate-600 hover:text-primary group" type="button">
                    <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"></span> NPI Mismatch</span>
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded">0</span>
                  </button>
                </div>
              </div>
              {allFiles.length > 0 && (() => {
                const cleanCount = allFiles.filter(f=>f.is_valid).length;
                const errCount = allFiles.filter(f=>!f.is_valid).length;
                const donutData = [{name:'Clean', value:cleanCount, color:'#22c55e'},{name:'Errors', value:errCount, color:'#ef4444'}].filter(d=>d.value>0);
                return (
                  <div className="mt-6 pt-4 border-t border-outline-variant/10">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Validation Breakdown</h4>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={donutData} cx="50%" cy="50%" innerRadius={38} outerRadius={55} paddingAngle={3} dataKey="value">
                          {donutData.map((entry,i) => <Cell key={i} fill={entry.color}/>)}
                        </Pie>
                        <Tooltip formatter={(v,n)=>[v+' files', n]} contentStyle={{borderRadius:'10px',border:'1px solid #e2e8f0',fontSize:'11px'}}/>
                        <Legend iconType="circle" iconSize={8} formatter={(v,e) => <span style={{fontSize:'11px',color:'#64748b'}}>{v}: {e.payload.value}</span>}/>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}"""

if old_npi in content:
    content = content.replace(old_npi, new_npi)
    print("Claims837: donut chart added OK")
else:
    print("Claims837: NPI section NOT FOUND")

open(path, "w", encoding="utf-8").write(content)
print("Claims837: saved")

# ============================================================
# 2. Remittance835.jsx
# ============================================================
path = r"C:\Users\Admin\.kiro\CleanEDI\stitch\src\pages\Remittance835.jsx"
content = open(path, encoding="utf-8").read()

content = content.replace(
    "import { useState, useEffect } from 'react';",
    "import { useState, useEffect } from 'react';\nimport { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';"
)

old_svg_835 = """{billedByDate.length > 0 && (
          <div className="mt-8 glass-panel rounded-2xl border border-outline-variant/10 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Total Billed by Date</h3>
            <svg width="100%" height="160" viewBox={`0 0 ${Math.max(billedByDate.length * 80, 400)} 160`} preserveAspectRatio="xMidYMid meet">
              {(() => {
                const max = Math.max(...billedByDate.map((d) => d.amount), 1);
                return billedByDate.map((d, i) => {
                  const barH = Math.max(4, (d.amount / max) * 120);
                  const x = i * 80 + 10;
                  return (
                    <g key={i}>
                      <rect x={x} y={130 - barH} width={50} height={barH} rx={6} fill="var(--color-primary, #4f46e5)" opacity="0.85" />
                      <text x={x + 25} y={148} textAnchor="middle" fontSize="9" fill="#94a3b8">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</text>
                      <text x={x + 25} y={130 - barH - 6} textAnchor="middle" fontSize="9" fill="#4f46e5" fontWeight="bold">${d.amount >= 1000 ? (d.amount / 1000).toFixed(1) + 'k' : d.amount.toFixed(0)}</text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>
        )}"""

new_bar_835 = """{billedByDate.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-on-surface">Payment Activity Over Time</h3>
                <p className="text-xs text-slate-400 mt-0.5">835 remittance files processed per date</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-tertiary inline-block"></span>Files Processed</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={billedByDate} margin={{top:10, right:20, left:0, bottom:0}} barSize={28}>
                <defs>
                  <linearGradient id="barGrad835" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.9}/>
                    <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tickFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric'})} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis tickFormatter={v => v >= 1000 ? '$'+(v/1000).toFixed(0)+'k' : '$'+v} tick={{fontSize:11, fill:'#94a3b8'}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip formatter={(v) => ['$'+v.toLocaleString('en-US',{minimumFractionDigits:2}), 'Amount']} labelFormatter={d => new Date(d).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})} contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}} cursor={{fill:'rgba(14,165,233,0.05)'}}/>
                <Bar dataKey="amount" fill="url(#barGrad835)" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-outline-variant/10">
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Files</p>
                <p className="text-lg font-black text-on-surface">{metrics.totalFiles}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Paid</p>
                <p className="text-lg font-black text-sky-600">${metrics.totalPaid.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Collection Rate</p>
                <p className="text-lg font-black text-green-600">{metrics.collectionRate}%</p>
              </div>
            </div>
          </div>
        )}"""

if old_svg_835 in content:
    content = content.replace(old_svg_835, new_bar_835)
    print("Remittance835: SVG chart replaced OK")
else:
    print("Remittance835: SVG chart NOT FOUND - trying regex")
    content = re.sub(
        r'\{billedByDate\.length > 0 && \(\s*<div className="mt-8 glass-panel.*?</div>\s*\)\}',
        new_bar_835,
        content,
        flags=re.DOTALL
    )
    print("Remittance835: regex replace done")

open(path, "w", encoding="utf-8").write(content)
print("Remittance835: saved")

# ============================================================
# 3. Dashboard.jsx
# ============================================================
path = r"C:\Users\Admin\.kiro\CleanEDI\stitch\src\pages\Dashboard.jsx"
content = open(path, encoding="utf-8").read()

# Add useState + recharts imports
content = content.replace(
    "import { useEffect } from 'react';",
    "import { useEffect, useState } from 'react';\nimport { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';"
)

# Add uploadTrend state after component opens (after isAdmin line)
content = content.replace(
    "  const isAdmin = canAny(permissions, ADMIN_PERMISSIONS);",
    "  const isAdmin = canAny(permissions, ADMIN_PERMISSIONS);\n  const [uploadTrend, setUploadTrend] = useState([]);"
)

# Add setUploadTrend call inside hydrateFromAPI after renderAudits(items)
content = content.replace(
    "        renderAudits(items);\n      } catch(e) {",
    """        renderAudits(items);
        // Build upload trend
        const byDate = {};
        items.forEach(f => {
          const d = f.timeLabel || 'Unknown';
          if (!byDate[d]) byDate[d] = {date:d, count:0, errors:0};
          byDate[d].count++;
          if (f.errorCount > 0) byDate[d].errors++;
        });
        setUploadTrend(Object.values(byDate).slice(-7));
      } catch(e) {"""
)

# Replace the bottom section (Recent Audits section closing + main closing) with chart added
old_bottom = """          <section className="col-span-4 h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                Recent Audits
                <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-2 py-0.5 rounded-full">LIVE</span>
              </h3>
              <button className="text-primary text-xs font-bold hover:underline" type="button" id="clear-audits">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2" id="recent-audits">
              <div className="glass-panel p-8 rounded-[20px] border border-outline-variant/10 text-center">
                <p className="text-sm font-semibold text-on-surface">No files processed yet.</p>
                <p className="text-xs text-outline mt-2">Upload a 837, 835, or 834 file to start seeing audits.</p>
              </div>
            </div>
          </section>
        </div>


      </main>
    </div>
  );
}"""

new_bottom = """          <section className="col-span-4 h-[600px] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black text-on-surface flex items-center gap-2">
                Recent Audits
                <span className="bg-primary-fixed text-on-primary-fixed text-[10px] px-2 py-0.5 rounded-full">LIVE</span>
              </h3>
              <button className="text-primary text-xs font-bold hover:underline" type="button" id="clear-audits">
                Clear
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2" id="recent-audits">
              <div className="glass-panel p-8 rounded-[20px] border border-outline-variant/10 text-center">
                <p className="text-sm font-semibold text-on-surface">No files processed yet.</p>
                <p className="text-xs text-outline mt-2">Upload a 837, 835, or 834 file to start seeing audits.</p>
              </div>
            </div>
          </section>
        </div>

        {uploadTrend.length > 0 && (
          <div className="mt-10 bg-white rounded-2xl border border-outline-variant/10 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-on-surface">Upload Activity</h3>
                <p className="text-xs text-slate-400 mt-0.5">Files processed per day - last 7 days</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-primary inline-block"></span>Total</span>
                <span className="flex items-center gap-1.5 text-slate-400"><span className="w-3 h-3 rounded-full bg-error inline-block"></span>Errors</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={uploadTrend} margin={{top:5,right:20,left:0,bottom:0}} barGap={4} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false}/>
                <XAxis dataKey="date" tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false}/>
                <YAxis allowDecimals={false} tick={{fontSize:11,fill:'#94a3b8'}} axisLine={false} tickLine={false} width={30}/>
                <Tooltip contentStyle={{borderRadius:'12px',border:'1px solid #e2e8f0',boxShadow:'0 4px 24px rgba(0,0,0,0.08)',fontSize:'12px'}} cursor={{fill:'rgba(79,70,229,0.04)'}}/>
                <Bar dataKey="count" name="Total Files" fill="#4f46e5" radius={[4,4,0,0]} opacity={0.85}/>
                <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4,4,0,0]} opacity={0.7}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

      </main>
    </div>
  );
}"""

if old_bottom in content:
    content = content.replace(old_bottom, new_bottom)
    print("Dashboard: bottom section replaced OK")
else:
    print("Dashboard: bottom section NOT FOUND - check manually")

open(path, "w", encoding="utf-8").write(content)
print("Dashboard: saved")