export type TransactionType = "837P" | "837I" | "835" | "834" | "UNKNOWN";

export type Segment = {
  id: string;
  elements: string[];
  line_number: number;
};

export type LoopNode = {
  name: string;
  label: string;
  segments: Segment[];
  children: LoopNode[];
};

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  loop_location: string;
  segment_id: string;
  element_position?: number;
  current_value?: string;
  suggested_value?: string;
};

export type ParseReport = {
  filename: string;
  parse_result: {
    transaction_type: TransactionType;
    envelope: {
      sender_id?: string;
      receiver_id?: string;
      interchange_date?: string;
      gs_functional_group?: string;
      transaction_set_count: number;
      control_number?: string;
    };
    segments: Segment[];
    loop_tree: LoopNode;
  };
  validation_result: {
    valid: boolean;
    issues: ValidationIssue[];
  };
};

export type UploadResponse = {
  report: ParseReport;
  remittance_summary: Array<Record<string, string | number>>;
  enrollment_summary: Array<Record<string, string>>;
};
