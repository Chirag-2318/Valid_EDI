path = r'C:\Users\Admin\.kiro\CleanEDI\stitch\src\pages\MasterParser.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

start = 50031
end = 52386

NEW = (
    "                  validationIssues.map((issue, idx) => {\n"
    "                    const isFixed = fixedErrorIds.has(idx);\n"
    "                    const isLoading = !!llmFixLoading[idx];\n"
    "                    const errObj = {\n"
    "                      code: issue.code || issue.error_code,\n"
    "                      message: issue.message || issue.error_message,\n"
    "                      segment: issue.segmentId || issue.segment,\n"
    "                      loop: issue.loop_id || issue.loop,\n"
    "                      severity: issue.severity,\n"
    "                      current_value: issue.currentValue,\n"
    "                    };\n"
    "                    return (\n"
    "                      <div key={issue.code + idx} className={['error-card p-4 rounded-xl shadow-sm border-l-4 transition-all duration-300', isFixed ? 'bg-green-50 border-green-500' : issue.severity === 'warning' ? 'bg-white border-amber-400' : 'bg-white border-error'].join(' ')}>\n"
    "                        <div className=\"flex gap-3\">\n"
    "                          <div className={['w-9 h-9 rounded-lg flex items-center justify-center shrink-0', isFixed ? 'bg-green-100 text-green-600' : issue.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-error-container text-error'].join(' ')}>\n"
    "                            <span className=\"material-symbols-outlined\">{isFixed ? 'check_circle' : 'report'}</span>\n"
    "                          </div>\n"
    "                          <div className=\"flex-1 min-w-0\">\n"
    "                            <div className=\"flex items-center justify-between gap-2\">\n"
    "                              <h4 className={isFixed ? 'text-sm font-bold text-green-700' : 'text-sm font-bold text-on-surface'}>{issue.code}</h4>\n"
    "                              {isFixed\n"
    "                                ? <span className=\"text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full\">FIXED</span>\n"
    "                                : <span className=\"text-[10px] font-mono px-2 py-0.5 bg-surface-container rounded uppercase\">{issue.severity}</span>\n"
    "                              }\n"
    "                            </div>\n"
    "                            <p className={isFixed ? 'text-xs mt-1 break-words text-green-600 line-through opacity-60' : 'text-xs text-on-surface-variant mt-1 break-words'}>{issue.message}</p>\n"
    "                            {!isFixed && (\n"
    "                              <div className=\"mt-2 flex flex-wrap items-center gap-2\">\n"
    "                                {issue.loop ? <span className=\"text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded\">LOOP: {issue.loop}</span> : null}\n"
    "                                {issue.segmentId ? <span className=\"text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded\">SEG: {issue.segmentId}</span> : null}\n"
    "                                {issue.elementPosition ? <span className=\"text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded\">ELM: {issue.elementPosition}</span> : null}\n"
    "                                {issue.currentValue ? <span className=\"text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded\">VALUE: {issue.currentValue}</span> : null}\n"
    "                              </div>\n"
    "                            )}\n"
    "                            {!isFixed && (\n"
    "                              <button\n"
    "                                onClick={() => fixErrorWithLLM(errObj, idx)}\n"
    "                                disabled={isLoading || !currentFileId}\n"
    "                                className=\"mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[11px] font-bold hover:bg-primary/90 active:scale-95 disabled:opacity-40 transition-all\"\n"
    "                                type=\"button\"\n"
    "                              >\n"
    "                                {isLoading\n"
    "                                  ? <><span className=\"animate-spin material-symbols-outlined text-[14px]\">progress_activity</span><span>Fixing with AI...</span></>\n"
    "                                  : <><span className=\"material-symbols-outlined text-[14px]\">auto_fix_high</span><span>Fix with AI</span></>\n"
    "                                }\n"
    "                              </button>\n"
    "                            )}\n"
    "                          </div>\n"
    "                        </div>\n"
    "                      </div>\n"
    "                    );\n"
    "                  })\n"
    "                )}"
)

content = content[:start] + NEW + content[end:]
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done. File length:', len(content))
