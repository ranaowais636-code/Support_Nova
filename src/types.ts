export type UserRole = 'Administrator' | 'Manager' | 'Reviewer' | 'Agent' | 'Customer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  customer_type?: 'Regular' | 'VIP' | 'Staff';
}

export interface Complaint {
  id: string;
  complaint_id: string;
  customer_id: string;
  customer_name: string;
  customer_type: string;
  title: string;
  description: string;
  product_service: string;
  order_ref: string;
  channel: string;
  date: string;
  attachment_name?: string;
  attachment_data?: string;
  prev_complaint_ref?: string;
  requested_resolution?: string;
  status: 'New' | 'Analyzed' | 'In Progress' | 'Awaiting Customer' | 'Escalated' | 'Resolved' | 'Closed';
  is_duplicate?: number;
  duplicate_of?: string;
  is_repeat?: number;
  repeat_count?: number;
  created_at: string;
  // Joined fields
  category?: string;
  urgency?: 'Low' | 'Medium' | 'High' | 'Critical';
  priority?: 'P0' | 'P1' | 'P2' | 'P3';
  department?: string;
  verification_status?: 'VERIFIED' | 'MANUAL REVIEW REQUIRED';
  mismatch_count?: number;
  mismatches?: string[];
}

export interface AIAnalysis {
  id: string;
  complaint_id: string;
  prompt_version: string;
  provider: string;
  model: string;
  primary_issue: string;
  secondary_issue?: string | null;
  category: string;
  subcategory: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Strongly Negative';
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  department: string;
  supporting_department?: string | null;
  policy_id: string;
  policy_section: string;
  resolution_steps: string[];
  escalation_required: boolean;
  escalation_level: string;
  escalation_notes: string;
  professional_response: string;
  response_type: string;
  follow_up_required: boolean;
  follow_up_communication: string;
  agent_guidance: string;
  clarification_questions?: string | null;
  analyzed_at: string;
}

export interface ValidationCheck {
  passed: boolean;
  reason: string;
  genai_value?: any;
  expected_value?: any;
  policy_status?: string;
  expected_policy?: string;
  python_authoritative_decision?: boolean;
  escalation_reason?: string;
  unsupported_promises?: string[];
  hallucinations?: string[];
  traceable_policy?: string;
  recommended_follow_up?: string;
}

export interface PythonValidation {
  id: string;
  complaint_id: string;
  category_check: ValidationCheck;
  department_check: ValidationCheck;
  urgency_check: ValidationCheck;
  priority_check: ValidationCheck;
  policy_check: ValidationCheck;
  resolution_check: ValidationCheck;
  escalation_check: ValidationCheck;
  follow_up_check: ValidationCheck;
  source_check: ValidationCheck;
  unsupported_promises?: string[];
  hallucinations?: string[];
  overall_status: 'PASSED' | 'FAILED';
  validation_summary: string;
  checked_at: string;
}

export interface ComparisonResult {
  id: string;
  complaint_id: string;
  verification_status: 'VERIFIED' | 'MANUAL REVIEW REQUIRED';
  mismatch_count: number;
  mismatches: string[];
  comparison_score: number;
  decided_at: string;
}

export interface ReviewAction {
  id: string;
  complaint_id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_role: string;
  action: string;
  notes?: string;
  old_status?: string;
  new_status?: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  timestamp: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  section: string;
  heading: string;
  page_ref?: string;
  version: string;
  chunk_text: string;
}

export interface PolicyDocument {
  id: string;
  title: string;
  doc_type: string;
  section: string;
  version: string;
  effective_date: string;
  source: string;
  status: 'Active' | 'Superseded' | 'Outdated' | 'Draft';
  summary?: string;
  content: string;
  created_at: string;
  created_by: string;
  chunks?: DocumentChunk[];
}

export interface RuleMatrixItem {
  id: string;
  rule_id: string;
  category: string;
  subcategory: string;
  conditions: string;
  department: string;
  urgency: string;
  priority: string;
  policy_id: string;
  mandatory_escalation: number;
  escalation_reason?: string;
  required_actions: string[];
  prohibited_actions: string[];
  follow_up: string;
}

export interface AnalyticsReport {
  metrics: {
    total_complaints: number;
    resolved_count: number;
    escalated_count: number;
    pending_count: number;
    mismatch_count: number;
    repeat_count: number;
    sla_compliance_rate: number;
  };
  category_dist: Array<{ category: string; count: number }>;
  sentiment_dist: Array<{ sentiment: string; count: number }>;
  urgency_dist: Array<{ urgency: string; count: number }>;
  department_dist: Array<{ department: string; count: number }>;
  verification_dist: Array<{ verification_status: string; count: number }>;
  resolution_trend: Array<{ date: string; volume: number; avg_resolution_hours: number }>;
}
