import { User, Complaint, AIAnalysis, PythonValidation, ComparisonResult, ReviewAction, AuditLog, PolicyDocument, RuleMatrixItem, AnalyticsReport } from './types';

const TOKEN_KEY = 'supportnova_auth_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  async login(credentials: { email: string; password: string }) {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setStoredToken(res.token);
    return res.user;
  },

  async signup(data: { name: string; email: string; password: string; customer_type?: string }) {
    const res = await request<{ success: boolean; token: string; user: User }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    setStoredToken(res.token);
    return res.user;
  },

  async getMe() {
    const res = await request<{ user: User }>('/api/auth/me');
    return res.user;
  },

  logout() {
    removeStoredToken();
  },

  // Complaints
  async getComplaints(filters?: { search?: string; status?: string; category?: string; urgency?: string }) {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.category) params.append('category', filters.category);
    if (filters?.urgency) params.append('urgency', filters.urgency);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ complaints: Complaint[] }>(`/api/complaints${query}`);
    return res.complaints;
  },

  async getComplaintDetail(id: string) {
    return request<{
      complaint: Complaint;
      ai_analysis: AIAnalysis | null;
      python_validation: PythonValidation | null;
      comparison_result: ComparisonResult | null;
      review_actions: ReviewAction[];
      audit_logs: AuditLog[];
    }>(`/api/complaints/${id}`);
  },

  async submitComplaint(complaintData: any) {
    return request<{
      success: boolean;
      complaint_id: string;
      verification_status: string;
      final_status: string;
      escalation_required: boolean;
      escalation_level: string;
      escalation_reason: string;
      mismatches: string[];
      comparison_score: number;
    }>('/api/complaints/submit', {
      method: 'POST',
      body: JSON.stringify(complaintData),
    });
  },

  // Review Queue
  async getReviewQueue() {
    const res = await request<{ queue: Complaint[] }>('/api/review-queue');
    return res.queue;
  },

  async submitReviewAction(id: string, actionData: { action: string; notes?: string; new_status?: string }) {
    return request<{ success: boolean; old_status: string; new_status: string }>(`/api/review-queue/${id}/action`, {
      method: 'POST',
      body: JSON.stringify(actionData),
    });
  },

  // Documents & KB
  async getDocuments() {
    const res = await request<{ documents: PolicyDocument[] }>('/api/documents');
    return res.documents;
  },

  async uploadDocument(document: {
    id: string;
    title: string;
    type: string;
    section: string;
    version: string;
    effective_date: string;
    source: string;
    status: string;
    content: string;
    filename?: string;
    file_data?: string;
  }) {
    return request<{ success: boolean; document_id: string; chunks_created: number }>('/api/documents/upload', {
      method: 'POST',
      body: JSON.stringify(document),
    });
  },

  // Reports
  async getEvaluationAssets() {
    return request<{ assets: any[]; counts: { rules: number; escalation_conditions: number; benchmark_cases: number; unseen_cases: number; prompt_injection_cases: number; docx_smoke_test: number } }>('/api/evaluation-assets');
  },

  async getReports() {
    return request<AnalyticsReport>('/api/reports');
  },

  // Rule Matrix
  async getRules() {
    const res = await request<{ rules: RuleMatrixItem[] }>('/api/rules');
    return res.rules;
  },

  // Settings
  async getSettings() {
    return request<any>('/api/settings');
  },

  // Export CSV
  async downloadExportCSV() {
    const token = getStoredToken();
    const res = await fetch('/api/export/csv', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SupportNova_Complaints_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // Chat
  async saveChatMessage(payload: {
    conversation_id?: string;
    role: 'user' | 'bot';
    content: string;
    customer_name?: string;
    customer_email?: string;
  }) {
    return request<{ conversation_id: string; message_id: string; created_at: string }>('/api/chat/message', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getChatConversations() {
    return request<{ conversations: Array<{
      id: string;
      customer_id: string | null;
      customer_name: string;
      customer_email: string;
      status: string;
      created_at: string;
      updated_at: string;
      last_message: string | null;
      message_count: number;
    }> }>('/api/chat/conversations');
  },

  async getChatMessages(conversationId: string) {
    return request<{
      conversation: {
        id: string;
        customer_id: string | null;
        customer_name: string;
        customer_email: string;
        status: string;
        created_at: string;
        updated_at: string;
      };
      messages: Array<{ id: string; role: string; content: string; created_at: string }>;
    }>(`/api/chat/conversations/${conversationId}`);
  },

  /** Multi-agent chat query: policy, routing, knowledge retrieval */
  async chatQuery(payload: {
    message: string;
    conversation_id?: string;
    has_attachment?: boolean;
  }) {
    return request<{
      reply: string;
      suggest_complaint?: boolean;
      agents_used?: string[];
      conversation_id?: string;
    }>('/api/chat/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /** Admin: recent customer signups */
  async getRecentCustomers(limit = 20) {
    return request<{
      customers: Array<{
        id: string;
        name: string;
        email: string;
        customer_type: string;
        created_at: string;
      }>;
    }>(`/api/admin/recent-customers?limit=${limit}`);
  },
};
