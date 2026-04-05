import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { authFetch } from '../auth/api';
import { useAuth } from '../auth/AuthProvider';
import {
  canAny,
  CLAIMS_ACCESS_PERMISSIONS,
  ENROLLMENT_ACCESS_PERMISSIONS,
  REMITTANCE_ACCESS_PERMISSIONS
} from '../auth/permissions';

const ELEMENT_LABELS = {
  ISA: [
    'Authorization Info Qualifier',
    'Authorization Info',
    'Security Info Qualifier',
    'Security Info',
    'Interchange ID Qualifier',
    'Interchange Sender ID',
    'Interchange ID Qualifier',
    'Interchange Receiver ID',
    'Interchange Date',
    'Interchange Time',
    'Repetition Separator',
    'Interchange Control Version Number',
    'Interchange Control Number',
    'Acknowledgment Requested',
    'Usage Indicator',
    'Component Element Separator'
  ],
  GS: [
    'Functional Identifier Code',
    'Application Sender Code',
    'Application Receiver Code',
    'Date',
    'Time',
    'Group Control Number',
    'Responsible Agency Code',
    'Version / Release / Industry ID Code'
  ],
  ST: ['Transaction Set ID', 'Transaction Set Control Number', 'Implementation Convention Reference'],
  BHT: [
    'Hierarchical Structure Code',
    'Transaction Set Purpose Code',
    'Reference Identification',
    'Date',
    'Time',
    'Transaction Type Code'
  ],
  BGN: [
    'Transaction Set Purpose Code',
    'Reference ID',
    'Date',
    'Time',
    'Time Code',
    'Reference ID 2',
    'Transaction Type Code'
  ],
  NM1: [
    'Entity Identifier Code',
    'Entity Type Qualifier',
    'Last Name',
    'First Name',
    'Middle Name',
    'Name Prefix',
    'Name Suffix',
    'Identification Code Qualifier',
    'Identification Code'
  ],
  N3: ['Address Line 1', 'Address Line 2'],
  N4: ['City Name', 'State Code', 'Postal Code', 'Country Code'],
  REF: ['Reference ID Qualifier', 'Reference ID', 'Description'],
  DTP: ['Date/Time Qualifier', 'Date/Time Format Qualifier', 'Date/Time Period'],
  DMG: ['Date/Time Format Qualifier', 'Date/Time Period', 'Gender Code'],
  CLM: [
    'Patient Control Number',
    'Total Claim Charge Amount',
    'Claim Filing Indicator Code',
    'Non-Institutional Claim Type Code',
    'Health Care Service Location Information',
    'Provider Signature on File',
    'Assignment of Benefits',
    'Release of Information Code'
  ],
  CLP: [
    'Patient Control Number',
    'Claim Status Code',
    'Total Claim Charge Amount',
    'Claim Payment Amount',
    'Patient Responsibility Amount',
    'Claim Filing Indicator Code',
    'Payer Claim Control Number'
  ],
  CAS: [
    'Adjustment Group Code',
    'Adjustment Reason Code',
    'Adjustment Amount',
    'Adjustment Quantity',
    'Reason Code 2',
    'Amount 2',
    'Quantity 2'
  ],
  BPR: [
    'Transaction Handling Code',
    'Total Payment Amount',
    'Credit/Debit Flag',
    'Payment Method Code',
    'Payment Format Code',
    'DFI ID Number Qualifier',
    'DFI Identification Number',
    'Account Number Qualifier',
    'Account Number',
    'Originating Company Identifier'
  ],
  TRN: ['Trace Type Code', 'Reference ID', 'Originating Company Identifier'],
  INS: [
    'Subscriber/Dependent Code',
    'Individual Relationship Code',
    'Maintenance Type Code',
    'Maintenance Reason Code',
    'Benefit Status Code',
    'Medicare Status Code',
    'COBRA Qualifying Event Code',
    'Employment Status Code',
    'Student Status Code',
    'Handicap Indicator',
    'Date/Time Format Qualifier',
    'Date/Time Period'
  ],
  HL: ['Hierarchical ID Number', 'Hierarchical Parent ID Number', 'Hierarchical Level Code', 'Hierarchical Child Code'],
  LX: ['Assigned Number'],
  SE: ['Number of Included Segments', 'Transaction Set Control Number'],
  GE: ['Number of Transaction Sets', 'Group Control Number'],
  IEA: ['Number of Included Functional Groups', 'Interchange Control Number']
};

const DOC_DETAILS = {
  '835': [
    {
      title: 'CAS adjustment reason codes',
      body: 'Validate CAS01 group codes and CAS02 reason codes against payer guidance.'
    },
    {
      title: 'PR/CO/OA/PI group codes',
      body: 'Confirm patient vs payer responsibility amounts across CAS segments.'
    },
    {
      title: 'CLP reconciliation',
      body: 'Check CLP02/CLP03/CLP04 totals for billed vs paid consistency.'
    }
  ],
  '834': [
    {
      title: 'INS maintenance type codes',
      body: 'Validate INS03 values for enrollment, change, or termination codes.'
    },
    {
      title: 'Member relationship codes',
      body: 'Verify INS02 relationship codes for subscriber/dependent mapping.'
    },
    {
      title: 'Subscriber group / policy numbers',
      body: 'Review REF qualifiers 0F/1L and ensure policy identifiers are present.'
    },
    {
      title: 'Date consistency',
      body: 'Check DTP and DMG segments for format and logical order.'
    },
    {
      title: 'Duplicate member detection',
      body: 'Scan for repeated subscriber IDs across REF segments.'
    }
  ]
};

const PANE_MIN_SIZES = { raw: 260, tree: 320, errors: 280 };
const SUPPRESSED_ERROR_CODES = new Set(['DIAGNOSIS_CODE_FORMAT', 'CHARGE_TOTAL_CHECK', 'AMOUNT_FORMAT']);

const dismissedStorageKey = (fileId) => `edi:dismissed-errors:${fileId}`;

const readDismissedErrorKeys = (fileId) => {
  if (!fileId) return new Set();
  try {
    const raw = localStorage.getItem(dismissedStorageKey(fileId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (e) {
    return new Set();
  }
};

const persistDismissedErrorKeys = (fileId, keys) => {
  if (!fileId) return;
  try {
    localStorage.setItem(dismissedStorageKey(fileId), JSON.stringify([...keys]));
  } catch (e) {
    // ignore storage failures
  }
};

const formatEdiContent = (text = '') => {
  if (!text) return '';
  const normalized = text.replace(/\r/g, '');
  const segmentSeparator = normalized.includes('~') ? '~' : '\n';
  if (segmentSeparator === '\n') {
    return normalized;
  }
  const segments = normalized
    .split(segmentSeparator)
    .map((seg) => seg.replace(/^\s+/, ''))
    .map((seg) => (seg.startsWith('ISA') ? seg : seg.trim()))
    .filter(Boolean);
  return segments.map((seg) => `${seg}${segmentSeparator}`).join('\n');
};

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

const getElementLabel = (segmentId, index) => {
  const labels = ELEMENT_LABELS[segmentId] || [];
  return labels[index] || `Element ${index + 1}`;
};

const isLibraryCrashError = (msg) => typeof msg === 'string' && msg.includes('raised an unexpected error');

const buildIssueKey = (issue = {}) => {
  const rawId = issue.id || issue.error_id;
  if (rawId) return `id:${rawId}`;
  const code = issue.code || issue.error_code || '';
  const message = issue.message || issue.error_message || '';
  const segment = issue.segmentId || issue.segment || '';
  const element = issue.elementPosition || issue.element_position || '';
  const loop = issue.loop || issue.loop_id || '';
  const current = issue.currentValue || issue.current_value || '';
  return [code, segment, element, loop, message, current].join('|');
};

const normalizeDbIssues = (issues = []) => issues
  .filter((issue) => !isLibraryCrashError(issue.error_message))
  .map((issue) => {
    const normalized = {
      id: issue.id,
      code: issue.error_code || 'Validation Error',
      message: issue.error_message || '',
      severity: String(issue.severity || 'error').toLowerCase(),
      loop: issue.loop_id || '',
      segmentId: issue.segment || '',
      elementPosition: issue.element_position || null,
      currentValue: issue.current_value || '',
      suggestedValue: issue.suggestion || ''
    };
    return { ...normalized, key: buildIssueKey(normalized) };
  });

const normalizeParseIssues = (issues = []) => issues
  .filter((issue) => !isLibraryCrashError(issue.message))
  .map((issue) => {
    const normalized = {
      id: issue.id,
      code: issue.code || 'Validation Error',
      message: issue.message || '',
      severity: String(issue.severity || 'error').toLowerCase(),
      loop: issue.loop_location || '',
      segmentId: issue.segment_id || '',
      elementPosition: issue.element_position || null,
      currentValue: issue.current_value || '',
      suggestedValue: issue.suggested_value || ''
    };
    return { ...normalized, key: buildIssueKey(normalized) };
  });

const buildOverviewFromParse = (parseResult, reportText = '') => {
  if (reportText && reportText.trim()) return reportText;
  if (!parseResult) return 'No overview available.';
  const envelope = parseResult.envelope || {};
  const loopCount = parseResult.loop_tree?.children?.length || 0;
  const segmentCount = parseResult.segments?.length || 0;
  return [
    `EDI REPORT - ${parseResult.transaction_type || 'UNKNOWN'}`,
    '',
    'OVERVIEW',
    '',
    `Sender: ${envelope.sender_id || 'N/A'}`,
    `Receiver: ${envelope.receiver_id || 'N/A'}`,
    `Date: ${envelope.interchange_date || 'N/A'}`,
    `Control #: ${envelope.control_number || 'N/A'}`,
    '',
    'STRUCTURE',
    '',
    `Total Loops: ${loopCount}`,
    `Total Segments: ${segmentCount}`
  ].join('\n');
};

const buildOverviewSections = (text = '') => {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length) {
    return { title: 'Overview', sections: [] };
  }

  const titleLine = lines[0].replace(/=+/g, '').trim();
  const title = titleLine || 'Overview';
  const sections = [];
  let current = { title: 'Overview', items: [] };

  const pushCurrent = () => {
    if (current.items.length) {
      sections.push(current);
      current = { title: '', items: [] };
    }
  };

  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^[-=]{3,}$/.test(line)) {
      continue;
    }
    if (!line.includes(':') && /^[A-Z0-9\s]{3,}$/.test(line)) {
      pushCurrent();
      current = { title: line.replace(/\s+/g, ' ').trim(), items: [] };
      continue;
    }
    const parts = line.split(':');
    if (parts.length > 1) {
      const label = parts.shift().trim();
      const value = parts.join(':').trim();
      current.items.push({ label, value });
    } else {
      current.items.push({ text: line });
    }
  }
  pushCurrent();

  return { title, sections };
};

const toNumber = (value) => {
  if (value === null || value === undefined) return 0;
  const cleaned = String(value).replace(/[^0-9.\-]/g, '');
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const uniqueCounts = (values) => {
  const map = new Map();
  values.forEach((value) => {
    if (!value) return;
    map.set(value, (map.get(value) || 0) + 1);
  });
  return Array.from(map.entries()).map(([value, count]) => ({ value, count }));
};

const build835Details = (segments) => {
  const casSegments = segments.filter((seg) => seg.id === 'CAS');
  const casGroups = casSegments.map((seg) => seg.elements?.[0]).filter(Boolean);
  const casReasonCodes = [];
  casSegments.forEach((seg) => {
    const elements = seg.elements || [];
    [1, 4, 7, 10].forEach((idx) => {
      if (elements[idx]) {
        casReasonCodes.push(elements[idx]);
      }
    });
  });
  const clpSegments = segments.filter((seg) => seg.id === 'CLP');
  const totals = clpSegments.reduce((acc, seg) => {
    acc.billed += toNumber(seg.elements?.[2]);
    acc.paid += toNumber(seg.elements?.[3]);
    return acc;
  }, { billed: 0, paid: 0 });
  const variance = totals.billed - totals.paid;

  return [
    {
      title: 'CAS adjustment reason codes',
      summary: `${casReasonCodes.length} codes`,
      items: uniqueCounts(casReasonCodes)
        .map((row) => `${row.value} (${row.count})`)
    },
    {
      title: 'PR/CO/OA/PI group codes',
      summary: `${casGroups.length} groups`,
      items: uniqueCounts(casGroups)
        .map((row) => `${row.value} (${row.count})`)
    },
    {
      title: 'CLP reconciliation',
      summary: `${clpSegments.length} claims`,
      items: [
        `Total billed: ${totals.billed.toFixed(2)}`,
        `Total paid: ${totals.paid.toFixed(2)}`,
        `Variance: ${variance.toFixed(2)}`
      ]
    }
  ];
};

const build834Details = (segments) => {
  const insSegments = segments.filter((seg) => seg.id === 'INS');
  const maintCodes = insSegments.map((seg) => seg.elements?.[2]).filter(Boolean);
  const relCodes = insSegments.map((seg) => seg.elements?.[1]).filter(Boolean);
  const refSegments = segments.filter((seg) => seg.id === 'REF');
  const policyRefs = refSegments
    .filter((seg) => ['0F', '1L'].includes(seg.elements?.[0]))
    .map((seg) => seg.elements?.[1])
    .filter(Boolean);

  const dtpSegments = segments.filter((seg) => seg.id === 'DTP');
  const dtpDates = dtpSegments
    .map((seg) => seg.elements?.[2])
    .filter(Boolean);
  const invalidDates = dtpDates.filter((date) => !/^\d{8}$/.test(date));
  const duplicates = uniqueCounts(policyRefs).filter((row) => row.count > 1);

  return [
    {
      title: 'INS maintenance type codes',
      summary: `${maintCodes.length} values`,
      items: uniqueCounts(maintCodes).map((row) => `${row.value} (${row.count})`)
    },
    {
      title: 'Member relationship codes',
      summary: `${relCodes.length} values`,
      items: uniqueCounts(relCodes).map((row) => `${row.value} (${row.count})`)
    },
    {
      title: 'Subscriber group / policy numbers',
      summary: `${policyRefs.length} IDs`,
      items: policyRefs.length ? policyRefs.slice(0, 12) : ['No policy IDs found']
    },
    {
      title: 'Date consistency',
      summary: `${dtpDates.length} dates`,
      items: invalidDates.length
        ? [`Invalid dates: ${invalidDates.join(', ')}`]
        : ['All DTP dates are in CCYYMMDD format']
    },
    {
      title: 'Duplicate member detection',
      summary: `${duplicates.length} duplicates`,
      items: duplicates.length
        ? duplicates.map((row) => `${row.value} (${row.count})`)
        : ['No duplicates detected']
    }
  ];
};

const buildDocDetails = (transactionType, segments) => {
  if (!segments.length) return [];
  if (transactionType === '835') return build835Details(segments);
  if (transactionType === '834') return build834Details(segments);
  return [];
};

const buildRawFromSegments = (segments, delimiters) => {
  const elementSep = delimiters?.element || '*';
  const segmentSep = delimiters?.segment || '~';
  const lines = segments.map((seg) => [seg.id, ...(seg.elements || [])].join(elementSep));
  return lines.join(segmentSep) + segmentSep;
};

const bodyClassName = 'bg-background font-body text-on-background antialiased selection:bg-primary/10 selection:text-primary page-master-parser';

export function MasterParserPage() {
  const { permissions } = useAuth();
  const canClaims = canAny(permissions, CLAIMS_ACCESS_PERMISSIONS);
  const canEnrollment = canAny(permissions, ENROLLMENT_ACCESS_PERMISSIONS);
  const canRemittance = canAny(permissions, REMITTANCE_ACCESS_PERMISSIONS);
  const [copilotData, setCopilotData] = useState(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [activePane, setActivePane] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [fixLoading, setFixLoading] = useState(false);
  const [fixAllLoading, setFixAllLoading] = useState(false);
  const [fixedErrorIds, setFixedErrorIds] = useState(new Set());
  const [correctedEdi, setCorrectedEdi] = useState(null);
  const [changedLineIndices, setChangedLineIndices] = useState(new Set());
  const [appliedChanges, setAppliedChanges] = useState([]);
  const [dismissedErrorIds, setDismissedErrorIds] = useState(new Set());
  const [showSuppressedErrors, setShowSuppressedErrors] = useState(false);
  const [swipingError, setSwipingError] = useState(null);
  const [swipeOffsets, setSwipeOffsets] = useState({});
  const swipeStartRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const isLongPressRef = useRef(false);
  const [currentFileId, setCurrentFileId] = useState(null);
  const [fileName, setFileName] = useState('Loading...');
  const [rawContent, setRawContent] = useState('');
  const [rawDirty, setRawDirty] = useState(false);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawSaving, setRawSaving] = useState(false);
  const [revalidateLoading, setRevalidateLoading] = useState(false);
  const [rawSaveStatus, setRawSaveStatus] = useState('');
  const [parseTree, setParseTree] = useState(null);
  const [parseSegments, setParseSegments] = useState([]);
  const [parseDelimiters, setParseDelimiters] = useState(null);
  const [validationIssues, setValidationIssues] = useState([]);
  const [overviewText, setOverviewText] = useState('');
  const [transactionType, setTransactionType] = useState('');
  const [paneSizes, setPaneSizes] = useState({ raw: 360, tree: 520, errors: 360 });
  const [dragState, setDragState] = useState(null);
  const paneContainerRef = useRef(null);
  const [hasSized, setHasSized] = useState(false);

  const refreshValidationIssues = useCallback(async (fileId, options = {}) => {
    if (!fileId) return;
    const { clearDismissed = false, clearFixed = false, clearSwipe = false, hydrateDismissed = false } = options;
    try {
      const errorsRes = await authFetch('/api/files/' + fileId + '/errors').then((r) => r.json());
      const normalizedIssues = Array.isArray(errorsRes) ? normalizeDbIssues(errorsRes) : [];
      const activeKeys = new Set(normalizedIssues.map((issue) => issue.key));
      setValidationIssues(normalizedIssues);
      setDismissedErrorIds((prev) => {
        if (clearDismissed) return new Set();
        const base = hydrateDismissed ? readDismissedErrorKeys(fileId) : prev;
        const next = new Set([...base].filter((key) => activeKeys.has(key)));
        persistDismissedErrorKeys(fileId, next);
        return next;
      });
    } catch (err) {
      setValidationIssues([]);
    } finally {
      if (clearFixed) setFixedErrorIds(new Set());
      if (clearSwipe) {
        setSwipeOffsets({});
        setSwipingError(null);
      }
    }
  }, []);

  useEffect(() => {
    if (!currentFileId) return;
    persistDismissedErrorKeys(currentFileId, dismissedErrorIds);
  }, [currentFileId, dismissedErrorIds]);

  async function triggerCopilotAnalysis(fileId) {
    if (!fileId) return;
    setCopilotLoading(true);
    try {
      const res = await authFetch('/api/copilot/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: fileId }),
      });
      const data = await res.json();
      setCopilotData(data);
    } catch (e) {
      setCopilotData({ bullets: ['Analysis unavailable — check server connection.'], critical_issues: [], health_score: 0 });
    } finally {
      setCopilotLoading(false);
    }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || !currentFileId) return;
    const userMsg = { role: 'user', content: chatInput };
    const newHistory = [...chatMessages, userMsg];
    setChatMessages(newHistory);
    setChatInput('');
    setChatLoading(true);
    try {
      const res = await authFetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId, question: chatInput, history: chatMessages }),
      });
      const data = await res.json();
      setChatMessages([...newHistory, { role: 'assistant', content: data.answer }]);
    } catch (e) {
      setChatMessages([...newHistory, { role: 'assistant', content: 'Error getting response.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  async function applyFix(fixType, suggestedValue = '') {
    if (!currentFileId) return;
    setFixLoading(true);
    try {
      const res = await authFetch('/api/copilot/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId, fix_type: fixType, suggested_value: suggestedValue }),
      });
      const data = await res.json();
      if (data.success) {
        // Update overview from fresh parse result
        if (data.new_parse_result?.report) {
          setOverviewText(buildOverviewFromParse(null, data.new_parse_result.report));
        }
        // Update validation issues from response
        if (data.remaining_errors) {
          setValidationIssues(normalizeDbIssues(data.remaining_errors));
        } else {
          const errorsRes = await authFetch('/api/files/' + currentFileId + '/errors').then((r) => r.json());
          setValidationIssues(Array.isArray(errorsRes) ? normalizeDbIssues(errorsRes) : []);
        }
        triggerCopilotAnalysis(currentFileId);
      }
    } catch (e) {
      console.error('Fix error:', e);
      alert('Error applying fix.');
    } finally {
      setFixLoading(false);
    }
  }

  async function fixAllErrors() {
    if (!currentFileId || !validationIssues.length) return;
    setFixAllLoading(true);
    try {
      const allErrors = validationIssues.map((issue) => ({
        code: issue.code || issue.error_code,
        message: issue.message || issue.error_message,
        segment: issue.segmentId || issue.segment,
        loop: issue.loop_id || issue.loop,
        severity: issue.severity,
        current_value: issue.currentValue,
      }));
      const res = await authFetch('/api/copilot/fix-with-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: currentFileId, errors: allErrors }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.detail || 'AI fix failed. Make sure your Groq API key is set in Settings.');
        return;
      }
      const remaining = data.remaining_errors || [];
      const remainingKeys = new Set(remaining.map((issue) => buildIssueKey(issue)));

      const actuallyFixed = new Set();
      validationIssues.forEach((issue) => {
        if (!remainingKeys.has(issue.key)) {
          actuallyFixed.add(issue.key);
        }
      });
      // Only mark errors as fixed locally if they actually got resolved
      setFixedErrorIds(actuallyFixed);

      const fixedCount = actuallyFixed.size;
      const unresolvedCount = remaining.length;
      
      // Store applied changes for display
      setAppliedChanges(data.changes || []);
      // Update raw EDI with formatted corrected content and compute highlights
      if (data.corrected_edi) {
        // Ensure both old and new are identically formatted before comparing
        const formattedOld = typeof formatEdiContent === 'function' ? formatEdiContent(rawContent) : rawContent;
        const formattedNew = typeof formatEdiContent === 'function' ? formatEdiContent(data.corrected_edi) : data.corrected_edi;
        const originalLines = formattedOld.split('\n');
        const newLines = formattedNew.split('\n');
        
        const changed = new Set();
        const changesFromServer = data.changes || [];
        
        newLines.forEach((line, i) => {
          if (i >= originalLines.length || line !== originalLines[i]) {
            changed.add(i);
          }
        });
        
        // Try mapping the tooltips by checking if the 'corrected_line' substring is somewhat in the new line
        const mappedExplanations = {};
        changesFromServer.forEach(c => {
           const coreCorr = (c.corrected_line || '').trim().replace(/~$/, '');
           if (!coreCorr) return;
           const matchIdx = newLines.findIndex(l => l.includes(coreCorr));
           if (matchIdx !== -1) {
               mappedExplanations[matchIdx] = c;
           }
        });

        setChangedLineIndices(changed);
        // Overwrite applied changes with the map so it's easy to render
        setAppliedChanges(mappedExplanations);

        setCorrectedEdi(data.corrected_edi);
        setRawContent(formattedNew);
        setRawDirty(false);
        // Re-parse to update Parsed Tree and overview
        try {
          await parseRawContent(formattedNew, '', { setIssues: false, setOverview: true });
        } catch (e) { /* skip parse error */ }
      }
      
      // After showing green state, update error list from server
      setTimeout(() => {
        setValidationIssues(normalizeDbIssues(remaining));
        setFixedErrorIds(new Set());
        void refreshValidationIssues(currentFileId, { clearSwipe: true });
        triggerCopilotAnalysis(currentFileId);

        // Notify user if some errors couldn't be fixed automatically
        if (unresolvedCount > 0 && fixedCount > 0) {
          alert(`AI fixed ${fixedCount} error(s), but ${unresolvedCount} error(s) could not be resolved automatically and may require manual attention or are false-positives.`);
        } else if (fixedCount === 0) {
          alert('AI could not resolve any of the current errors. They might be false-positives by the validator or require manual correction.');
        }
      }, 2000);
    } catch (e) {
      alert('Fix request failed: ' + e.message);
    } finally {
      setFixAllLoading(false);
    }
  }

  async function parseRawContent(content, reportText = '', options = { setIssues: true, setOverview: true }) {
    if (!content || !content.trim()) return null;
    const res = await authFetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) {
      throw new Error('Parse failed');
    }
    const data = await res.json();
    const parseResult = data.parse_result || {};
    setParseTree(parseResult.loop_tree || null);
    setParseSegments(parseResult.segments || []);
    setParseDelimiters(parseResult.delimiters || null);
    setTransactionType(String(parseResult.transaction_type || '').toUpperCase());
    if (options.setOverview) {
      setOverviewText(buildOverviewFromParse(parseResult, reportText));
    }
    if (options.setIssues) {
      setValidationIssues(normalizeParseIssues(data.validation_result?.issues || []));
    }
    return data;
  }

  async function handleSaveEdits() {
    if (!rawContent.trim()) return;
    setRawSaving(true);
    setRawSaveStatus('');
    try {
      if (!currentFileId) return;
      const parseResult = await saveRawToBackend(rawContent);
      const reportText = parseResult?.raw_json?.report || '';
      await parseRawContent(rawContent, reportText, { setIssues: true, setOverview: true });
      setRawDirty(false);
      setRawSaveStatus('Saved to database');
    } catch (err) {
      setRawSaveStatus(err?.message || 'Save failed');
    } finally {
      setRawSaving(false);
    }
  }

  async function handleRevalidate() {
    if (!rawContent.trim()) return;
    setRevalidateLoading(true);
    setRawSaveStatus('');
    try {
      if (currentFileId) {
        await saveRawToBackend(rawContent);
      }
      await parseRawContent(rawContent, '', { setIssues: true, setOverview: false });
      setRawSaveStatus('Revalidated');
    } catch (err) {
      setRawSaveStatus('Revalidate failed');
    } finally {
      setRevalidateLoading(false);
    }
  }

  async function saveRawToBackend(content) {
    const res = await authFetch('/api/files/' + currentFileId + '/raw', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) {
      let detail = 'Save failed';
      try {
        const errorPayload = await res.json();
        if (errorPayload?.detail) {
          detail = errorPayload.detail;
        }
      } catch (err) {
        detail = 'Save failed';
      }
      throw new Error(detail);
    }
    return res.json();
  }

  async function handleAutoFix() {
    if (!parseSegments.length || !validationIssues.length) {
      setRawSaveStatus('No fix suggestions available');
      return;
    }
    const updatedSegments = parseSegments.map((seg) => ({
      ...seg,
      elements: [...(seg.elements || [])]
    }));
    let updates = 0;

    validationIssues.forEach((issue) => {
      if (!issue.suggestedValue || !issue.segmentId || !issue.elementPosition) {
        return;
      }
      const positionIndex = issue.elementPosition - 1;
      updatedSegments.forEach((seg) => {
        if (seg.id !== issue.segmentId) return;
        const current = seg.elements?.[positionIndex];
        if (issue.currentValue && current !== issue.currentValue) return;
        if (typeof seg.elements?.[positionIndex] === 'string') {
          seg.elements[positionIndex] = issue.suggestedValue;
          updates += 1;
        }
      });
    });

    if (!updates) {
      setRawSaveStatus('No fix suggestions available');
      return;
    }

    const rebuilt = buildRawFromSegments(updatedSegments, parseDelimiters);
    const formatted = formatEdiContent(rebuilt);
    setRawContent(formatted);
    setRawDirty(true);
    setRawSaving(true);
    setRawSaveStatus('');
    try {
      const parseResult = await saveRawToBackend(formatted);
      const reportText = parseResult?.raw_json?.report || '';
      await parseRawContent(formatted, reportText, { setIssues: true, setOverview: true });
      setRawDirty(false);
      setRawSaveStatus(`Applied ${updates} fix${updates === 1 ? '' : 'es'}`);
      // Reload errors from DB after fix
      await refreshValidationIssues(currentFileId, { clearSwipe: true });
    } catch (err) {
      setRawSaveStatus(err?.message || 'Fix failed');
    } finally {
      setRawSaving(false);
    }
  }

  useEffect(() => {
    const previous = document.body.className;
    document.body.className = bodyClassName;
    return () => { document.body.className = previous; };
  }, []);

  useEffect(() => {
    const nav = document.getElementById('side-nav');
    const overlay = document.getElementById('nav-overlay');
    const toggle = document.getElementById('nav-toggle');
    const closeButton = document.getElementById('nav-close');
    const navLinks = Array.from(document.querySelectorAll('[data-nav-link="true"]'));
    if (!nav || !overlay || !toggle || !closeButton) return undefined;
    function openNav() { nav.classList.remove('-translate-x-full'); overlay.classList.remove('hidden'); document.body.classList.add('overflow-hidden'); }
    function closeNav() { nav.classList.add('-translate-x-full'); overlay.classList.add('hidden'); document.body.classList.remove('overflow-hidden'); }
    const handleToggle = () => openNav();
    const handleClose = () => closeNav();
    const handleOverlay = () => closeNav();
    toggle.addEventListener('click', handleToggle);
    closeButton.addEventListener('click', handleClose);
    overlay.addEventListener('click', handleOverlay);
    const handleNavLinkClick = () => { if (window.innerWidth < 768) closeNav(); };
    navLinks.forEach((link) => link.addEventListener('click', handleNavLinkClick));
    const handleResize = () => {
      if (window.innerWidth >= 768) { overlay.classList.add('hidden'); nav.classList.remove('-translate-x-full'); document.body.classList.remove('overflow-hidden'); }
      else nav.classList.add('-translate-x-full');
    };
    window.addEventListener('resize', handleResize);
    return () => {
      toggle.removeEventListener('click', handleToggle);
      closeButton.removeEventListener('click', handleClose);
      overlay.removeEventListener('click', handleOverlay);
      navLinks.forEach((link) => link.removeEventListener('click', handleNavLinkClick));
      window.removeEventListener('resize', handleResize);
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  useEffect(() => {
    async function loadFileData() {
      setRawLoading(true);
      try {
        const globalSearch = localStorage.getItem('globalSearch');
        if (globalSearch) {
          localStorage.removeItem('globalSearch');
          try {
            const allFiles = await fetch('/api/files?limit=1000').then((r) => r.json());
            const match = Array.isArray(allFiles) && allFiles.find((f) =>
              f.filename.toLowerCase().includes(globalSearch.toLowerCase()) ||
              (f.original_filename || '').toLowerCase().includes(globalSearch.toLowerCase())
            );
            if (match) {
              localStorage.setItem('selectedFileId', match.id);
            }
          } catch (e) { /* skip */ }
        }
        const selectedFileId = localStorage.getItem('selectedFileId');
        const submissions = JSON.parse(localStorage.getItem('ediSubmissions') || '[]');
        const latest = submissions.length > 0 ? submissions[submissions.length - 1] : null;
        const id = selectedFileId || (latest ? latest.id : null);
        if (!id) {
          setFileName('No file loaded');
          setRawContent('');
          setOverviewText('');
          setValidationIssues([]);
          setFixedErrorIds(new Set());
          setDismissedErrorIds(new Set());
          setSwipeOffsets({});
          setSwipingError(null);
          setParseTree(null);
          setParseSegments([]);
          setParseDelimiters(null);
          return;
        }
        const [fileInfo, parseResult] = await Promise.all([
          authFetch('/api/files/' + id).then((r) => r.json()),
          authFetch('/api/files/' + id + '/parse-result').then((r) => r.json())
        ]);
        setFileName(fileInfo.filename || id);
        setTransactionType(String(fileInfo.transaction_type || '').toUpperCase());
        const reportText = parseResult?.raw_json?.report || '';
        setOverviewText(buildOverviewFromParse(null, reportText));
        setCurrentFileId(id);
        setFixedErrorIds(new Set());
        setDismissedErrorIds(readDismissedErrorKeys(id));
        setSwipeOffsets({});
        setSwipingError(null);
        setCorrectedEdi(null);
        triggerCopilotAnalysis(id);

        // Wire JSON download button
        const jsonBtn = document.getElementById('json-download-btn');
        if (jsonBtn) {
          jsonBtn.onclick = () => {
            const exportData = { file_info: fileInfo, parse_result: parseResult };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = (fileInfo?.filename || 'edi-export') + '.json';
            a.click();
            URL.revokeObjectURL(url);
          };
        }

        let rawText = '';
        try {
          const rawRes = await authFetch('/api/files/' + id + '/raw');
          if (rawRes.ok) {
            rawText = await rawRes.text();
          } else if (fileInfo?.s3_url) {
            const fallbackRes = await fetch(fileInfo.s3_url);
            if (fallbackRes.ok) {
              rawText = await fallbackRes.text();
            }
          }
        } catch (err) {
          rawText = '';
        }

        if (rawText) {
          const formatted = formatEdiContent(rawText);
          setRawContent(formatted);
          setRawDirty(false);
          try {
            await parseRawContent(rawText, reportText, { setIssues: false, setOverview: false });
          } catch (err) { /* skip */ }
        } else {
          setRawContent('Raw EDI content unavailable. Please check the file source.');
        }
        // Load errors from DB as source of truth
        await refreshValidationIssues(id, { hydrateDismissed: true });
      } catch (err) {
        console.error('Failed to load EDI file data:', err);
        setRawContent('Failed to load file data. Please check the server connection.');
        setValidationIssues([]);
      } finally {
        setRawLoading(false);
      }
    }
    loadFileData();
  }, []);

  useEffect(() => {
    if (!paneContainerRef.current || dragState) return undefined;
    if (window.innerWidth < 1280) return undefined;

    const resizerTotal = 20;
    const containerWidth = paneContainerRef.current.clientWidth || 0;
    if (!containerWidth) return undefined;

    const total = containerWidth - resizerTotal;
    const sum = paneSizes.raw + paneSizes.tree + paneSizes.errors;

    if (!hasSized) {
      const base = Math.floor(total / 3);
      const raw = clamp(base, PANE_MIN_SIZES.raw, total);
      const tree = clamp(base, PANE_MIN_SIZES.tree, total - raw);
      const errors = clamp(total - raw - tree, PANE_MIN_SIZES.errors, total - raw);
      setPaneSizes({ raw, tree, errors });
      setHasSized(true);
      return undefined;
    }

    if (Math.abs(sum - total) > 24) {
      const ratio = total / sum;
      const raw = clamp(Math.round(paneSizes.raw * ratio), PANE_MIN_SIZES.raw, total);
      const tree = clamp(Math.round(paneSizes.tree * ratio), PANE_MIN_SIZES.tree, total - raw);
      const errors = clamp(total - raw - tree, PANE_MIN_SIZES.errors, total - raw);
      setPaneSizes({ raw, tree, errors });
    }

    return undefined;
  }, [paneSizes, dragState, hasSized]);

  useEffect(() => {
    if (!dragState) return undefined;
    const handleMove = (event) => {
      const delta = event.clientX - dragState.startX;
      const { raw, tree, errors } = dragState.startSizes;

      if (dragState.pane === 'raw') {
        const total = raw + tree;
        let nextRaw = clamp(raw + delta, PANE_MIN_SIZES.raw, total - PANE_MIN_SIZES.tree);
        let nextTree = total - nextRaw;
        if (nextTree < PANE_MIN_SIZES.tree) {
          nextTree = PANE_MIN_SIZES.tree;
          nextRaw = total - nextTree;
        }
        setPaneSizes({ raw: nextRaw, tree: nextTree, errors });
      }

      if (dragState.pane === 'tree') {
        const total = tree + errors;
        let nextTree = clamp(tree + delta, PANE_MIN_SIZES.tree, total - PANE_MIN_SIZES.errors);
        let nextErrors = total - nextTree;
        if (nextErrors < PANE_MIN_SIZES.errors) {
          nextErrors = PANE_MIN_SIZES.errors;
          nextTree = total - nextErrors;
        }
        setPaneSizes({ raw, tree: nextTree, errors: nextErrors });
      }
    };

    const handleUp = () => setDragState(null);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [dragState]);

  const startResize = (pane) => (event) => {
    event.preventDefault();
    setDragState({ pane, startX: event.clientX, startSizes: { ...paneSizes } });
  };

  const nonWarningIssues = validationIssues.filter((issue) => issue.severity !== 'warning');
  const suppressedIssues = nonWarningIssues.filter((issue) => SUPPRESSED_ERROR_CODES.has(issue.code));
  const visibleIssues = nonWarningIssues.filter((issue) => showSuppressedErrors || !SUPPRESSED_ERROR_CODES.has(issue.code));
  const visibleIssuesAfterDismiss = visibleIssues.filter((issue) => !dismissedErrorIds.has(issue.key));

  const errorStats = visibleIssues.reduce((acc, issue) => {
    if (dismissedErrorIds.has(issue.key)) return acc;
    acc.error += 1;
    return acc;
  }, { error: 0, warning: 0 });

  const activeSwipeOffset = swipingError ? (swipeOffsets[swipingError] || 0) : 0;
  const isTrashArmed = swipingError !== null;
  const isTrashActive = isTrashArmed && activeSwipeOffset > 120;

  const docItems = buildDocDetails(transactionType, parseSegments);
  const suggestionItems = visibleIssues
    .filter((issue) => issue.suggestedValue && !dismissedErrorIds.has(issue.key))
    .slice(0, 4);
  const overview = buildOverviewSections(overviewText || '');

  const togglePane = (pane) => {
    setActivePane((prev) => (prev === pane ? '' : pane));
  };

  const paneButtonClass = (pane) => (
    `w-10 h-10 rounded-full flex items-center justify-center border transition-colors ${
      activePane === pane
        ? 'bg-tertiary text-white border-tertiary'
        : 'bg-white text-slate-500 border-slate-200/70 hover:text-slate-700'
    }`
  );

  const renderSegment = (segment, index) => (
    <details key={`${segment.id}-${segment.line_number}-${index}`} className="parsed-node group rounded-xl border border-slate-200/40 bg-white/70">
      <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-surface-container-highest text-[10px] font-mono font-bold text-outline">{segment.id}</span>
          <span className="text-[11px] font-semibold text-on-surface">Segment {segment.id}</span>
        </div>
        <span className="text-[10px] text-outline">Line {segment.line_number}</span>
      </summary>
      <div className="px-3 pb-3">
        <div className="space-y-2">
          {(segment.elements || []).length === 0 ? (
            <p className="text-[11px] text-outline italic">No elements in this segment.</p>
          ) : (
            (segment.elements || []).map((element, idx) => (
              <div key={`${segment.id}-${idx}`} className="flex items-start gap-3 text-[11px]">
                <span className="text-outline w-40 shrink-0">{getElementLabel(segment.id, idx)}</span>
                <span className="font-mono text-on-surface break-words flex-1 text-right">{element || '—'}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  );

  const renderLoopNode = (node, depth = 0) => (
    <details key={`${node.name}-${depth}`} className="parsed-node group rounded-2xl border border-slate-200/40 bg-white/80">
      <summary className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-base">account_tree</span>
          <div>
            <p className="text-sm font-semibold text-on-surface">{node.label}</p>
            <p className="text-[10px] text-outline">{node.name}</p>
          </div>
        </div>
        <span className="text-[10px] text-outline">{node.segments?.length || 0} segments</span>
      </summary>
      <div className="px-3 pb-3 space-y-2">
        {(node.segments || []).map((segment, idx) => renderSegment(segment, idx))}
        {(node.children || []).map((child, idx) => (
          <div key={`${child.name}-${idx}`} className="pl-3 border-l border-slate-200/40">
            {renderLoopNode(child, depth + 1)}
          </div>
        ))}
      </div>
    </details>
  );

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl flex justify-between items-center px-6 py-3 w-full shadow-sm dark:shadow-none transition-all duration-200">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold tracking-tighter text-slate-900 dark:text-white cursor-pointer flex items-center gap-2" onClick={() => window.location.reload()}>
            <img src="/logo.png" alt="EdiPro logo" className="h-6 w-6 rounded-md object-contain" />
            <span>EdiPro</span>
          </span>
          <nav className="hidden md:flex gap-6">
            <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/dashboard_sleek">Dashboard</a>
            <a className="text-blue-700 dark:text-blue-400 font-semibold border-b-2 border-blue-700 py-1 transition-all" href="/master_parser_sleek">Master Parser</a>
            {canClaims ? (
              <a className="text-slate-500 dark:text-slate-400 hover:text-slate-800 py-1 transition-all" href="/837_claims_view">Reports</a>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center bg-slate-100/50 rounded-full px-3 py-1.5">
            <span className="material-symbols-outlined text-[20px] text-slate-500">search</span>
            <input className="bg-transparent border-none focus:ring-0 text-sm w-48 placeholder:text-slate-400" placeholder="Search files..." type="text" />
          </div>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/notifications" aria-label="Open notifications"><span className="material-symbols-outlined text-slate-600">notifications</span></a>
          <a className="p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" href="/settings" aria-label="Open settings"><span className="material-symbols-outlined text-slate-600">settings</span></a>
          <a className="h-8 w-8 rounded-full overflow-hidden bg-primary/10 ring-2 ring-white shadow-sm" href="/user_profile" aria-label="Open user profile">
            <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCgEW3dXZf1xhBDmpkybJnr21bF6HNiuHphHXF5ZMfTdghbWasho84cnLb8S8iQpaeSBw-fhCGaMQOMakuyIgNossftgFDuvXrrfI8AS1HQ8aXsiiN5jRf5UzMPR3aYhNr7MVZQn2pGVvp51bgB4LzOmkYlr8r84vKcVrNDmd6f9yQ467G7lXlyPhygUgNeyILrY9rjqiqU5HuLzz86Snbq7D27lzvqCYzPfDWO80nIxy6mb85n7yl0OJhP3SQqzcbgwDSKCUiG7ach" alt="User Profile Avatar" />
          </a>
          <button className="md:hidden p-2 hover:bg-slate-100/50 rounded-full transition-all active:scale-95" id="nav-toggle" aria-label="Open navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-700">menu</span>
          </button>
        </div>
      </header>

      <div className="fixed inset-0 bg-slate-900/40 z-30 hidden" id="nav-overlay"></div>

      <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-slate-50/70 dark:bg-slate-950/70 backdrop-blur-2xl border-r border-slate-200/30 shadow-xl flex flex-col py-6 pt-20 transform -translate-x-full md:translate-x-0 transition-transform duration-300" id="side-nav">
        <div className="px-6 mb-8 flex items-center gap-3 cursor-pointer" onClick={() => window.location.reload()}>
          <img
            src="/logo.png"
            alt="EdiPro logo"
            className="h-10 w-10 rounded-xl object-contain shadow-lg shadow-primary/20"
          />
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white leading-none">EdiPro</h2>
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">EDI Gateway</p>
          </div>
          <button className="md:hidden ml-auto p-2 hover:bg-slate-200/50 rounded-full" id="nav-close" aria-label="Close navigation menu" type="button">
            <span className="material-symbols-outlined text-slate-600">close</span>
          </button>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/dashboard_sleek" data-nav-link="true"><span className="material-symbols-outlined">dashboard</span> Dashboard</a>
          <a className="bg-blue-50/50 text-blue-700 rounded-lg mx-2 flex items-center gap-3 px-4 py-3 text-sm font-medium" href="/master_parser_sleek" data-nav-link="true"><span className="material-symbols-outlined">analytics</span> Master Parser</a>
          {canRemittance ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/835_remittance_sleek" data-nav-link="true"><span className="material-symbols-outlined">payments</span> 835 Remittance</a>
          ) : null}
          {canEnrollment ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/834_enrollment_sleek" data-nav-link="true"><span className="material-symbols-outlined">group_add</span> 834 Enrollment</a>
          ) : null}
          {canClaims ? (
            <a className="text-slate-600 hover:bg-slate-200/30 mx-2 rounded-lg flex items-center gap-3 px-4 py-3 text-sm font-medium hover:translate-x-1 transition-transform duration-300" href="/837_claims_view" data-nav-link="true"><span className="material-symbols-outlined">description</span> 837 Claims</a>
          ) : null}
        </nav>
        <div className="mt-auto px-4 pb-4">
          <button className="w-full bg-primary text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-primary/20 flex items-center justify-center gap-2" onClick={() => console.log('New Submission')} type="button">
            <span className="material-symbols-outlined text-[20px]">add_circle</span> New Submission
          </button>
        </div>
        <div className="px-2 pt-4 border-t border-slate-200/30 mx-4 space-y-1">
          <a className="text-slate-600 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium hover:translate-x-1 transition-transform duration-300" href="/help_center" data-nav-link="true"><span className="material-symbols-outlined text-[18px]">help</span> Help Center</a>
          <a className="text-slate-600 hover:bg-slate-200/30 rounded-lg flex items-center gap-3 px-4 py-2 text-xs font-medium hover:translate-x-1 transition-transform duration-300" href="/documentation" data-nav-link="true"><span className="material-symbols-outlined text-[18px]">menu_book</span> Documentation</a>
        </div>
      </aside>

      <main className="ml-0 md:ml-64 pt-20 px-4 md:px-8 pb-8 min-h-screen bg-surface">
        <div className="flex flex-col">
        <div
          ref={paneContainerRef}
          className="flex flex-col xl:flex-row gap-4 xl:gap-0 min-h-[calc(100vh-140px)] xl:h-[calc(100vh-140px)] xl:overflow-hidden"
        >
          <section
            className="pane-resizable pane-animate flex flex-col min-h-0 h-full bg-white/70 border border-slate-200/40 rounded-2xl overflow-hidden"
            style={{ width: paneSizes.raw }}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/30 bg-white/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-slate-500 text-[18px]">receipt_long</span>
                <h3 className="text-sm font-bold text-on-surface">Raw EDI</h3>
                <span className="px-2 py-0.5 bg-surface-container-highest rounded text-[10px] font-mono font-bold text-outline">{fileName}</span>
              </div>
              <div className="flex items-center gap-2">
                {rawSaveStatus ? <span className="text-[10px] text-outline">{rawSaveStatus}</span> : null}
                <div className="flex items-center gap-1 rounded-full bg-slate-100/80 border border-slate-200/60 p-1">
                  <button
                    onClick={handleSaveEdits}
                    disabled={!rawDirty || rawSaving}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-primary text-white shadow-sm hover:shadow-md transition disabled:opacity-40"
                    type="button"
                  >
                    {rawSaving ? 'Saving...' : 'Save edits'}
                  </button>
                  <button
                    onClick={handleRevalidate}
                    disabled={revalidateLoading || rawSaving || !rawContent.trim()}
                    className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-slate-700 hover:bg-white transition disabled:opacity-40"
                    type="button"
                  >
                    {revalidateLoading ? 'Checking...' : 'Revalidate'}
                  </button>
                  <button
                    id="json-download-btn"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-all"
                    title="Download as JSON"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">data_object</span>
                    JSON
                  </button>
                </div>
              </div>
            </div>
            <div className="flex-1 p-4 overflow-auto custom-scrollbar bg-[#fdfdfe]">
              {changedLineIndices.size > 0 ? (
                <div className="raw-editor custom-scrollbar" style={{ cursor: 'text' }}>
                  {rawContent.split('\n').map((line, idx) => (
                    <div
                      key={idx}
                      className={changedLineIndices.has(idx)
                        ? 'bg-red-50 text-red-700 border-l-2 border-red-500 pl-2 -ml-1 rounded-r transition-colors'
                        : ''}
                      title={changedLineIndices.has(idx)
                        ? (appliedChanges[idx]?.explanation || 'Modified by AI fix')
                        : undefined}
                    >
                      {line || '\u00A0'}
                    </div>
                  ))}
                  <button
                    onClick={() => { setChangedLineIndices(new Set()); setAppliedChanges([]); }}
                    className="mt-3 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-semibold transition-colors"
                    type="button"
                  >
                    Dismiss highlights &amp; edit
                  </button>
                </div>
              ) : (
                <textarea
                  value={rawContent}
                  onChange={(event) => {
                    setRawContent(event.target.value);
                    setRawDirty(true);
                    setRawSaveStatus('');
                  }}
                  placeholder={rawLoading ? 'Loading file data...' : 'Paste or edit raw EDI here.'}
                  spellCheck={false}
                  wrap="soft"
                  className="raw-editor custom-scrollbar"
                  disabled={rawLoading}
                />
              )}
            </div>
            <div className="px-4 py-2 border-t border-slate-200/30 text-[10px] text-outline flex flex-wrap gap-3">
              <span>Segments: {parseSegments.length || '—'}</span>
              <span>Element: {parseDelimiters?.element || '*'}</span>
              <span>Segment: {parseDelimiters?.segment || '~'}</span>
            </div>
          </section>

          <div className="pane-resizer hidden xl:block flex-shrink-0" onMouseDown={startResize('raw')} role="separator" aria-label="Resize raw pane" />

          <section
            className="pane-resizable pane-animate flex flex-col min-h-0 h-full bg-white/70 border border-slate-200/40 rounded-2xl overflow-hidden"
            style={{ width: paneSizes.tree }}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/30 bg-white/60">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]">account_tree</span>
                <h3 className="text-sm font-bold text-on-surface">Parsed Tree</h3>
                {transactionType ? (
                  <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{transactionType}</span>
                ) : null}
              </div>
              <span className="text-[10px] text-outline">{parseSegments.length ? `${parseSegments.length} segments` : 'No segments'}</span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-3 custom-scrollbar pane-wrap">
              {parseTree ? renderLoopNode(parseTree) : (
                <p className="text-outline italic text-sm">Load a file to view the parsed tree.</p>
              )}
            </div>
          </section>

          <div className="pane-resizer hidden xl:block flex-shrink-0" onMouseDown={startResize('tree')} role="separator" aria-label="Resize errors pane" />

          <section
            className="pane-resizable pane-animate flex flex-col min-h-0 h-full bg-surface-container-low/30 border border-slate-200/40 rounded-2xl overflow-hidden relative"
            style={{ width: paneSizes.errors }}
          >
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-200/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-error">report</span>
                <h3 className="text-sm font-bold tracking-tight">Errors</h3>
                <span className="text-[10px] text-outline">{errorStats.error} errors</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="px-2 py-0.5 bg-error-container text-on-error-container text-[10px] font-bold rounded-full">CRITICAL {errorStats.error}</span>
                {suppressedIssues.length > 0 ? (
                  <button
                    onClick={() => setShowSuppressedErrors((prev) => !prev)}
                    className="px-2 py-0.5 text-[10px] font-bold rounded-full border border-slate-200 text-slate-600 hover:text-slate-800 hover:border-slate-300 transition"
                    type="button"
                  >
                    {showSuppressedErrors ? `Hide common (${suppressedIssues.length})` : `Show common (${suppressedIssues.length})`}
                  </button>
                ) : null}
              </div>
            </div>
            <div className="relative flex-1 flex flex-col overflow-hidden">
              {isTrashArmed ? (
                <div className="absolute inset-y-0 right-3 z-20 flex items-center pointer-events-none">
                  <div
                    className={[
                      'flex flex-col items-center justify-center w-14 h-14 rounded-2xl border shadow-sm transition-all',
                      isTrashActive ? 'bg-error text-white border-error scale-105' : 'bg-white/90 text-error border-red-200'
                    ].join(' ')}
                  >
                    <span className="material-symbols-outlined text-[22px]">{isTrashActive ? 'delete_forever' : 'delete'}</span>
                    <span className="text-[9px] font-bold mt-0.5">{isTrashActive ? 'Release' : 'Bin'}</span>
                  </div>
                </div>
              ) : null}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar pane-wrap">
                {visibleIssuesAfterDismiss.length === 0 ? (
                  <div className="p-4 bg-white rounded-xl shadow-sm border-l-4 border-green-500 flex items-center gap-4">
                    <span className="material-symbols-outlined text-green-600">check_circle</span>
                    <p className="text-sm font-semibold text-green-700">
                      {suppressedIssues.length > 0 && !showSuppressedErrors
                        ? 'No visible errors. Common issues are hidden.'
                        : 'No validation errors found. This file is clean.'}
                    </p>
                  </div>
                ) : (
                  visibleIssuesAfterDismiss.map((issue) => {
                    const issueKey = issue.key;
                    if (dismissedErrorIds.has(issueKey)) return null;
                    const isFixed = fixedErrorIds.has(issueKey);
                    const offset = swipeOffsets[issueKey] || 0;
                    const isDismissing = offset > 120;
                    const trashOpacity = Math.min(offset / 120, 1);
                    const trashScale = 0.6 + trashOpacity * 0.4;
                    return (
                      <div
                        key={issueKey}
                        className="relative overflow-hidden rounded-xl"
                        style={{ touchAction: 'pan-y' }}
                      >
                        {/* Trash icon reveal behind the card */}
                        <div
                          className="absolute inset-0 flex items-center rounded-xl transition-colors"
                          style={{
                            background: isDismissing
                              ? 'linear-gradient(90deg, #ef4444 0%, #dc2626 100%)'
                              : `linear-gradient(90deg, rgba(239,68,68,${trashOpacity * 0.15}) 0%, rgba(239,68,68,${trashOpacity * 0.05}) 100%)`,
                          }}
                        >
                          <div
                            className="flex flex-col items-center justify-center ml-5 transition-all"
                            style={{
                              opacity: trashOpacity,
                              transform: `scale(${trashScale})`,
                            }}
                          >
                            <span
                              className="material-symbols-outlined transition-colors"
                              style={{
                                fontSize: 28,
                                color: isDismissing ? '#fff' : '#ef4444',
                              }}
                            >
                              delete
                            </span>
                            <span
                              className="text-[9px] font-bold mt-0.5 transition-colors"
                              style={{ color: isDismissing ? '#fff' : '#ef4444' }}
                            >
                              {isDismissing ? 'Release' : 'Dismiss'}
                            </span>
                          </div>
                        </div>
                        {/* Swipeable error card */}
                        <div
                          className={[
                            'error-card p-4 rounded-xl shadow-sm border-l-4 transition-all cursor-grab relative z-10',
                            isFixed ? 'bg-green-50 border-green-500' : issue.severity === 'warning' ? 'bg-white border-amber-400' : 'bg-white border-error',
                            swipingError === issueKey ? 'shadow-lg' : '',
                          ].join(' ')}
                          style={{
                            transform: `translateX(${offset}px)`,
                            transition: swipingError === issueKey ? 'none' : 'transform 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.3s',
                            opacity: isDismissing ? 0.7 : 1,
                          }}
                          onPointerDown={(e) => {
                            e.currentTarget.setPointerCapture(e.pointerId);
                            swipeStartRef.current = { x: e.clientX, y: e.clientY, key: issueKey, pointerId: e.pointerId };
                            isLongPressRef.current = false;
                            longPressTimerRef.current = setTimeout(() => {
                              isLongPressRef.current = true;
                              setSwipingError(issueKey);
                            }, 300);
                          }}
                          onPointerMove={(e) => {
                            if (!swipeStartRef.current || swipeStartRef.current.key !== issueKey) return;
                            const dx = e.clientX - swipeStartRef.current.x;
                            const dy = e.clientY - swipeStartRef.current.y;
                            // Cancel long press if moved too early
                            if (!isLongPressRef.current && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) {
                              clearTimeout(longPressTimerRef.current);
                            }
                            if (!isLongPressRef.current) return;
                            // Only allow right swipe
                            const clampedDx = Math.max(0, dx);
                            setSwipeOffsets((prev) => ({ ...prev, [issueKey]: clampedDx }));
                          }}
                          onPointerUp={() => {
                            clearTimeout(longPressTimerRef.current);
                            const off = swipeOffsets[issueKey] || 0;
                            if (off > 120) {
                              // Dismiss with animation
                              setSwipeOffsets((prev) => ({ ...prev, [issueKey]: 400 }));
                              setTimeout(() => {
                                setDismissedErrorIds((prev) => new Set([...prev, issueKey]));
                                setSwipeOffsets((prev) => { const n = { ...prev }; delete n[issueKey]; return n; });
                              }, 300);
                            } else {
                              setSwipeOffsets((prev) => ({ ...prev, [issueKey]: 0 }));
                            }
                            setSwipingError(null);
                            swipeStartRef.current = null;
                            isLongPressRef.current = false;
                          }}
                          onPointerCancel={() => {
                            clearTimeout(longPressTimerRef.current);
                            setSwipeOffsets((prev) => ({ ...prev, [issueKey]: 0 }));
                            setSwipingError(null);
                            swipeStartRef.current = null;
                            isLongPressRef.current = false;
                          }}
                        >
                          <div className="flex gap-3">
                            <div className={['w-9 h-9 rounded-lg flex items-center justify-center shrink-0', isFixed ? 'bg-green-100 text-green-600' : issue.severity === 'warning' ? 'bg-amber-100 text-amber-600' : 'bg-error-container text-error'].join(' ')}>
                              <span className="material-symbols-outlined">{isFixed ? 'check_circle' : 'report'}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className={isFixed ? 'text-sm font-bold text-green-700' : 'text-sm font-bold text-on-surface'}>{issue.code}</h4>
                                {isFixed
                                  ? <span className="text-[10px] font-bold px-2 py-0.5 bg-green-100 text-green-700 rounded-full">FIXED</span>
                                  : <span className="text-[10px] font-mono px-2 py-0.5 bg-surface-container rounded uppercase">{issue.severity}</span>
                                }
                              </div>
                              <p className={isFixed ? 'text-xs mt-1 break-words text-green-600 line-through opacity-60' : 'text-xs text-on-surface-variant mt-1 break-words'}>{issue.message}</p>
                              {!isFixed && (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  {issue.loop ? <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">LOOP: {issue.loop}</span> : null}
                                  {issue.segmentId ? <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">SEG: {issue.segmentId}</span> : null}
                                  {issue.elementPosition ? <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">ELM: {issue.elementPosition}</span> : null}
                                  {issue.currentValue ? <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface-container rounded">VALUE: {issue.currentValue}</span> : null}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}

                {suggestionItems.length > 0 ? (
                  <div className="mt-4 p-3 bg-white/60 border border-slate-200/40 rounded-xl">
                    <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest mb-2">Suggested Fixes</h4>
                    <div className="space-y-2">
                      {suggestionItems.map((issue, idx) => (
                        <div key={`${issue.code}-suggest-${idx}`} className="flex items-start justify-between gap-3 text-[11px]">
                          <div className="flex-1">
                            <p className="font-semibold text-on-surface">{issue.code}</p>
                            <p className="text-[10px] text-outline break-words">{issue.message}</p>
                          </div>
                          <span className="font-mono text-on-surface break-words">{issue.suggestedValue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {activePane ? (
                <div className="pane-overlay absolute inset-0 z-10 bg-white/95 backdrop-blur-md p-4 pb-16">
                  {activePane === 'copilot' ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-tertiary">auto_awesome</span>
                          <h3 className="text-sm font-bold text-on-surface">Copilot</h3>
                        </div>
                        <button onClick={() => setActivePane('')} className="p-1 rounded-full hover:bg-slate-100" type="button">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pane-wrap pr-1">
                        <div>
                          <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest mb-2">Summary</h4>
                          {copilotLoading ? (
                            <div className="space-y-2">
                              <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-3/4"></div>
                              <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-full"></div>
                              <div className="h-3 bg-outline-variant/20 rounded animate-pulse w-2/3"></div>
                            </div>
                          ) : copilotData ? (
                            <ul className="space-y-2">
                              {(copilotData.bullets || []).map((b, i) => (
                                <li key={i} className="flex gap-2 items-start">
                                  <span className="material-symbols-outlined text-tertiary text-base mt-0.5">check_circle</span>
                                  <p className="text-sm leading-snug text-on-surface">{b}</p>
                                </li>
                              ))}
                              {(copilotData.critical_issues || []).map((issue, i) => (
                                <li key={'err-' + i} className="flex gap-2 items-start">
                                  <span className="material-symbols-outlined text-error text-base mt-0.5">warning</span>
                                  <p className="text-sm leading-snug font-medium text-error">{issue}</p>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-on-surface-variant italic">Load a file to see analysis.</p>
                          )}
                        </div>

                        {copilotData ? (
                          <div>
                            <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest mb-2">Transaction Health</h4>
                            <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden flex">
                              <div className="h-full bg-primary transition-all" style={{ width: (copilotData.health_score || 0) + '%' }}></div>
                              <div className="h-full bg-error transition-all" style={{ width: (100 - (copilotData.health_score || 0)) + '%' }}></div>
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[10px] font-bold text-primary">{copilotData.health_score || 0}% VALID</span>
                              <span className="text-[10px] font-bold text-error">{100 - (copilotData.health_score || 0)}% ERROR</span>
                            </div>
                          </div>
                        ) : null}

                        {chatMessages.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {chatMessages.map((msg, i) => (
                              <div key={i} className={'text-xs p-2.5 rounded-xl ' + (msg.role === 'user' ? 'bg-primary/10 text-on-surface ml-4' : 'bg-white border border-outline-variant/20 text-on-surface mr-4')}>
                                <span className="font-bold text-primary">{msg.role === 'user' ? 'You' : 'Copilot'}:</span>{' '}{msg.role === 'user' ? msg.content : <ReactMarkdown components={{ h1: ({children}) => <span className="block font-bold text-xs mt-1">{children}</span>, h2: ({children}) => <span className="block font-bold text-xs mt-1">{children}</span>, h3: ({children}) => <span className="block font-bold text-xs mt-1 text-on-surface">{children}</span>, strong: ({children}) => <strong className="font-bold text-on-surface">{children}</strong>, ul: ({children}) => <ul className="list-disc list-inside space-y-0.5 mt-0.5">{children}</ul>, li: ({children}) => <li className="text-xs">{children}</li>, p: ({children}) => <span className="block mt-0.5">{children}</span> }}>{msg.content}</ReactMarkdown>}
                              </div>
                            ))}
                            {chatLoading ? (
                              <div className="text-xs p-2.5 rounded-xl bg-white border border-outline-variant/20 text-on-surface-variant mr-4 animate-pulse">
                                Copilot is thinking...
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="pt-3 border-t border-slate-200/40">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                            placeholder={currentFileId ? 'Ask Copilot...' : 'Load a file first...'}
                            disabled={chatLoading || !currentFileId}
                            className="flex-1 px-3 py-2 rounded-xl bg-white border border-tertiary/20 text-sm focus:ring-2 focus:ring-tertiary/20 focus:outline-none placeholder:text-on-surface-variant/50 disabled:opacity-50"
                          />
                          <button
                            onClick={sendChatMessage}
                            disabled={chatLoading || !currentFileId || !chatInput.trim()}
                            className="w-9 h-9 rounded-xl bg-tertiary text-white flex items-center justify-center hover:bg-tertiary/90 transition-colors disabled:opacity-40"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-sm">send</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {activePane === 'docs' ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">menu_book</span>
                          <h3 className="text-sm font-bold text-on-surface">Doc Details</h3>
                        </div>
                        <button onClick={() => setActivePane('')} className="p-1 rounded-full hover:bg-slate-100" type="button">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pane-wrap pr-1">
                        {docItems.length ? (
                          docItems.map((item, idx) => (
                            <details key={`${item.title}-${idx}`} className="doc-dropdown rounded-xl border border-slate-200/50 bg-white">
                              <summary className="flex items-center justify-between gap-3 px-3 py-2 cursor-pointer">
                                <div>
                                  <h4 className="text-sm font-semibold text-on-surface">{item.title}</h4>
                                  <p className="text-[10px] text-outline">{item.summary}</p>
                                </div>
                                <span className="material-symbols-outlined text-base text-primary">expand_more</span>
                              </summary>
                              <div className="px-3 pb-3 text-xs text-on-surface-variant space-y-1">
                                {item.items.map((row, rowIdx) => (
                                  <p key={`${item.title}-${rowIdx}`} className="break-words">{row}</p>
                                ))}
                              </div>
                            </details>
                          ))
                        ) : (
                          <p className="text-sm text-on-surface-variant italic">No doc details mapped for {transactionType || 'this'}.</p>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {activePane === 'overview' ? (
                    <div className="flex flex-col h-full">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-primary">insights</span>
                          <h3 className="text-sm font-bold text-on-surface">{overview.title}</h3>
                        </div>
                        <button onClick={() => setActivePane('')} className="p-1 rounded-full hover:bg-slate-100" type="button">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar pane-wrap pr-1 space-y-3">
                        {overview.sections.length ? (
                          overview.sections.map((section, idx) => (
                            <div key={`${section.title}-${idx}`} className="p-3 bg-white rounded-xl border border-slate-200/40">
                              {section.title ? (
                                <h4 className="text-[11px] font-bold text-outline uppercase tracking-widest mb-2">{section.title}</h4>
                              ) : null}
                              <div className="space-y-1">
                                {section.items.map((item, lineIdx) => (
                                  <div key={`${section.title}-${lineIdx}`} className="flex items-start justify-between gap-3 text-xs">
                                    {item.label ? (
                                      <>
                                        <span className="text-outline w-32 shrink-0">{item.label}</span>
                                        <span className="font-mono text-on-surface text-right break-words flex-1">{item.value}</span>
                                      </>
                                    ) : (
                                      <span className="text-on-surface-variant">{item.text}</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-on-surface-variant italic">No overview available.</p>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="relative z-20 border-t border-slate-200/40 bg-white/90 backdrop-blur-sm px-4 py-3 flex items-center justify-between">
                <button
                  onClick={() => fixAllErrors()}
                  disabled={!currentFileId || validationIssues.length === 0 || fixAllLoading}
                  className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40 flex items-center gap-1.5"
                  type="button"
                >
                  <span className={fixAllLoading ? 'animate-spin material-symbols-outlined text-[14px]' : 'material-symbols-outlined text-[14px]'}>{fixAllLoading ? 'progress_activity' : 'auto_fix_high'}</span>
                  {fixAllLoading ? 'Fixing with AI...' : 'Fix errors'}
                </button>
                <div className="flex gap-2">
                  <button className={paneButtonClass('copilot')} onClick={() => togglePane('copilot')} aria-label="Open Copilot panel" type="button">
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                  </button>
                  <button className={paneButtonClass('docs')} onClick={() => togglePane('docs')} aria-label="Open doc details" type="button">
                    <span className="material-symbols-outlined text-[18px]">menu_book</span>
                  </button>
                  <button className={paneButtonClass('overview')} onClick={() => togglePane('overview')} aria-label="Open overview" type="button">
                    <span className="material-symbols-outlined text-[18px]">insights</span>
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
        <div className="px-6 py-4 border-t border-slate-200/30 bg-white/80 backdrop-blur-sm flex items-center gap-4 flex-wrap">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mr-2">Export</span>
          <button
            disabled={!currentFileId}
            onClick={async () => {
              if (!currentFileId) return;
              try {
                const res = await authFetch('/api/export/summary-pdf/' + currentFileId);
                if (!res.ok) throw new Error('PDF generation failed');
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = (fileName || 'edi-summary') + '.pdf';
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { alert('PDF export failed: ' + e.message); }
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">picture_as_pdf</span>
            Download PDF Summary
          </button>
          <button
            disabled={!currentFileId}
            onClick={async () => {
              if (!currentFileId) return;
              try {
                const text = correctedEdi || rawContent;
                if (!text) throw new Error('No EDI content available');
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = (fileName || 'corrected') + '.edi';
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { alert('Download failed: ' + e.message); }
            }}
            className={['flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-40', correctedEdi ? 'bg-green-600 text-white border-green-700 shadow-md' : 'bg-surface-container-highest text-on-surface border-outline-variant/20 hover:bg-white'].join(' ')}
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">{correctedEdi ? 'verified' : 'download'}</span>
            {correctedEdi ? 'Download Fixed EDI' : 'Download Corrected EDI'}
          </button>
          {rawSaveStatus ? <span className="text-xs text-outline italic ml-2">{rawSaveStatus}</span> : null}
        </div>
        </div>
      </main>

      <footer className="h-8 bg-white border-t border-slate-200/50 flex items-center px-4 justify-between text-[10px] font-medium text-slate-500 z-50">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span> System Online</span>
          <span className="flex items-center gap-1"><span className="material-symbols-outlined text-xs">database</span> Connected to Production Gateway</span>
        </div>
        <div className="flex items-center gap-4 uppercase tracking-tighter">
          <span>Encoding: UTF-8</span>
          <span>Standard: HIPAA 5010</span>
          <span className="text-primary font-bold">Parser v2.4.0-Pro</span>
        </div>
      </footer>
    </>
  );
}


