import React, { useState, useEffect } from 'react';
import { User, Complaint, AIAnalysis, PythonValidation, ComparisonResult, ReviewAction, AuditLog } from '../types';
import { api } from '../api';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Bot,
  Terminal,
  Scale,
  History,
  Send,
  FileCheck,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

interface ComplaintDetailViewProps {
  complaintId: string;
  user: User;
  onBack: () => void;
  onStatusUpdated?: () => void;
}

export const ComplaintDetailView: React.FC<ComplaintDetailViewProps> = ({
  complaintId,
  user,
  onBack,
  onStatusUpdated,
}) => {
  const [data, setData] = useState<{
    complaint: Complaint;
    ai_analysis: AIAnalysis | null;
    python_validation: PythonValidation | null;
    comparison_result: ComparisonResult | null;
    review_actions: ReviewAction[];
    audit_logs: AuditLog[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reviewer action state
  const [reviewAction, setReviewAction] = useState('Approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadDetails();
  }, [complaintId]);

  const loadDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getComplaintDetail(complaintId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  };

  const handleReviewAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionSubmitting(true);
    setActionSuccess(null);
    try {
      let newStatus: string | undefined = undefined;
      if (reviewAction === 'Approve') newStatus = 'In Progress';
      if (reviewAction === 'Escalate') newStatus = 'Escalated';
      if (reviewAction === 'Resolve') newStatus = 'Resolved';

      await api.submitReviewAction(complaintId, {
        action: reviewAction,
        notes: reviewNotes,
        new_status: newStatus,
      });

      setActionSuccess(`Review decision '${reviewAction}' successfully logged in audit trail.`);
      setReviewNotes('');
      await loadDetails();
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to submit review action.');
    } finally {
      setActionSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-[#79819A]">
        Loading complaint intelligence & validation trail...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="inline-flex items-center text-xs text-[#6C4AB6] hover:text-[#171A3A] font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </button>
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
          {error || 'Complaint record not available.'}
        </div>
      </div>
    );
  }

  const { complaint, ai_analysis, python_validation, comparison_result, review_actions, audit_logs } = data;
  const isStaff = user.role !== 'Customer';
  const canReview = ['Administrator', 'Manager', 'Reviewer'].includes(user.role);

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-[#E2DCF0]">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-white border border-[#D3C7EE] text-[#171A3A] hover:bg-[#F4F1FA] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#6C4AB6]" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold bg-[#171A3A] text-white px-2 py-0.5 rounded">
                {complaint.complaint_id}
              </span>
              <h1 className="text-xl font-bold tracking-tight text-[#171A3A] truncate max-w-md sm:max-w-xl">
                {complaint.title}
              </h1>
            </div>
            <p className="text-xs text-[#79819A] mt-0.5">
              Order Ref: <span className="font-mono text-[#171A3A]">{complaint.order_ref}</span> • Submitted on {complaint.date} via {complaint.channel}
            </p>
          </div>
        </div>

        <div className="mt-3 sm:mt-0 flex items-center space-x-2">
          {/* Status Badge */}
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-[#171A3A] text-white">
            {complaint.status}
          </span>

          {/* Verification Badge */}
          {comparison_result?.verification_status === 'VERIFIED' ? (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-[#EDE7F6] text-[#171A3A] border border-[#D1C4E9]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#6C4AB6] mr-1.5" />
              VERIFIED
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 mr-1.5" />
              MANUAL REVIEW REQUIRED
            </span>
          )}
        </div>
      </div>

      {/* Comparison Engine Banner if Mismatch */}
      {comparison_result && comparison_result.verification_status !== 'VERIFIED' && (
        <div className="bg-rose-50 rounded-xl p-4 border border-rose-200 text-xs text-rose-900 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-rose-800">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Comparison Engine Discrepancy Flagged ({comparison_result.mismatch_count} Mismatch):</span>
          </div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-rose-800">
            {comparison_result.mismatches?.map((m, idx) => (
              <li key={idx}>{m}</li>
            ))}
          </ul>
          <p className="text-[11px] font-medium text-rose-700">
            Automated approval withheld. This ticket requires human specialist assessment.
          </p>
        </div>
      )}

      {/* Customer Intake Record */}
      <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-3">
          <div className="text-xs font-bold uppercase tracking-wider text-[#171A3A] flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-[#6C4AB6]" />
            <span>Complaint Intake Record</span>
          </div>
          <div className="text-xs text-[#79819A]">
            Customer: <strong className="text-[#171A3A]">{complaint.customer_name}</strong> ({complaint.customer_type})
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="text-[#79819A] block">Product or Service:</span>
            <span className="font-semibold text-[#171A3A]">{complaint.product_service}</span>
          </div>
          <div>
            <span className="text-[#79819A] block">Order Reference:</span>
            <span className="font-mono font-semibold text-[#171A3A]">{complaint.order_ref}</span>
          </div>
          <div>
            <span className="text-[#79819A] block">Repeat History:</span>
            <span className="font-semibold text-[#171A3A]">
              {complaint.is_repeat ? `Repeat Complaint (#${complaint.repeat_count})` : 'First-time incident'}
            </span>
          </div>
        </div>

        <div className="pt-2">
          <span className="text-[#79819A] block text-xs mb-1 font-semibold uppercase tracking-wider">
            Customer Statement:
          </span>
          <div className="p-3.5 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0] text-xs text-[#171A3A] leading-relaxed whitespace-pre-wrap font-sans">
            {complaint.description}
          </div>
        </div>
      </div>

      {/* Pipeline 1: GenAI Analysis & Generated Communication */}
      {ai_analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: AI Structured Triage */}
          <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#171A3A] flex items-center space-x-2">
                <Bot className="w-4 h-4 text-[#6C4AB6]" />
                <span>Pipeline 1 — GenAI Structured Intelligence</span>
              </div>
              <span className="text-[10px] font-mono text-[#79819A] bg-[#F4F1FA] px-2 py-0.5 rounded border border-[#E2DCF0]">
                {ai_analysis.model}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0]">
                <span className="text-[#79819A] text-[10px] uppercase font-bold block">Category</span>
                <span className="font-semibold text-[#171A3A]">{ai_analysis.category}</span>
                <span className="text-[10px] text-[#555E7A] block mt-0.5">({ai_analysis.subcategory})</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0]">
                <span className="text-[#79819A] text-[10px] uppercase font-bold block">Assigned Dept</span>
                <span className="font-semibold text-[#171A3A]">{ai_analysis.department}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0]">
                <span className="text-[#79819A] text-[10px] uppercase font-bold block">Urgency & Priority</span>
                <span className="font-semibold text-[#171A3A]">
                  {ai_analysis.urgency} ({ai_analysis.priority})
                </span>
                <span className="text-[10px] text-[#79819A] block mt-0.5">Sentiment: {ai_analysis.sentiment}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0]">
                <span className="text-[#79819A] text-[10px] uppercase font-bold block">Policy Reference</span>
                <span className="font-mono font-semibold text-[#171A3A]">{ai_analysis.policy_id}</span>
                <span className="text-[10px] text-[#79819A] block mt-0.5">Sec. {ai_analysis.policy_section}</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#444D6E] block mb-1.5">
                Resolution Steps:
              </span>
              <ul className="space-y-1.5 text-xs text-[#171A3A]">
                {ai_analysis.resolution_steps?.map((step, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-4 h-4 rounded-full bg-[#EDE7F6] text-[#6C4AB6] text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {ai_analysis.agent_guidance && (
              <div className="p-3 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0] text-xs">
                <span className="font-semibold text-[#171A3A] block mb-1">Internal Agent Guidance:</span>
                <p className="text-[#555E7A] leading-relaxed">{ai_analysis.agent_guidance}</p>
              </div>
            )}
          </div>

          {/* Right: Generated Customer Response */}
          <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-[#171A3A] flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#6C4AB6]" />
                <span>Generated Customer Communication</span>
              </div>
              <span className="text-[10px] text-[#6C4AB6] bg-[#EDE7F6] px-2 py-0.5 rounded font-semibold">
                {ai_analysis.response_type}
              </span>
            </div>

            <div>
              <div className="p-4 rounded-lg bg-[#F4F1FA] border border-[#D3C7EE] text-xs text-[#171A3A] leading-relaxed whitespace-pre-wrap font-sans">
                {ai_analysis.professional_response}
              </div>
            </div>

            {ai_analysis.follow_up_communication && (
              <div className="p-3 rounded-lg bg-white border border-[#E2DCF0] text-xs">
                <span className="font-semibold text-[#171A3A] block mb-1">Follow-Up Protocol:</span>
                <p className="text-[#555E7A]">{ai_analysis.follow_up_communication}</p>
              </div>
            )}

            <div className="pt-2 text-[11px] text-[#79819A] flex items-center justify-between">
              <span>Escalation Flag: {ai_analysis.escalation_required ? 'Yes' : 'No'}</span>
              <span>Level: {ai_analysis.escalation_level}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pipeline 2: Independent Python Ground-Truth Validation Checklist */}
      {python_validation && (
        <div className="bg-white rounded-xl p-6 border border-[#E2DCF0] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#F0EBF9] pb-3">
            <div className="flex items-center space-x-2">
              <Terminal className="w-4 h-4 text-[#6C4AB6]" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#171A3A]">
                Pipeline 2 — Independent Python Ground-Truth Validation
              </h2>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                python_validation.overall_status === 'PASSED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {python_validation.overall_status === 'PASSED' ? 'ALL CHECKS PASSED' : 'DISAGREEMENTS DETECTED'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {/* 1. Category Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.category_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">1. Category Check</span>
                {python_validation.category_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.category_check?.reason}
              </p>
            </div>

            {/* 2. Department Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.department_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">2. Department Routing</span>
                {python_validation.department_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.department_check?.reason}
              </p>
            </div>

            {/* 3. Objective Urgency Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.urgency_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">3. Objective Urgency</span>
                {python_validation.urgency_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.urgency_check?.reason}
              </p>
            </div>

            {/* 4. Priority Tier Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.priority_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">4. SLA Priority Check</span>
                {python_validation.priority_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.priority_check?.reason}
              </p>
            </div>

            {/* 5. Policy & Version Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.policy_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">5. Policy Precedence & Version</span>
                {python_validation.policy_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.policy_check?.reason}
              </p>
            </div>

            {/* 6. Authoritative Escalation Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.escalation_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">6. Deterministic Escalation</span>
                {python_validation.escalation_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.escalation_check?.reason}
              </p>
            </div>

            {/* 7. Resolution & Unsupported Promise Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.resolution_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">7. Resolution Promise Check</span>
                {python_validation.resolution_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.resolution_check?.reason}
              </p>
            </div>

            {/* 8. Source Grounding Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.source_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">8. Source Traceability</span>
                {python_validation.source_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.source_check?.reason}
              </p>
            </div>

            {/* 9. Follow-Up Protocol Check */}
            <div
              className={`p-3.5 rounded-lg border text-xs ${
                python_validation.follow_up_check?.passed ? 'bg-white border-[#E2DCF0]' : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#171A3A]">9. Follow-Up Schedule</span>
                {python_validation.follow_up_check?.passed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <p className="text-[#555E7A] text-[11px] leading-relaxed">
                {python_validation.follow_up_check?.reason}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reviewer Action Panel (For Administrator, Manager, Reviewer) */}
      {canReview && (
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#F0EBF9] pb-3">
            <Scale className="w-4 h-4 text-[#6C4AB6]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#171A3A]">
              Reviewer Decision & Governance Panel
            </h2>
          </div>

          {actionSuccess && (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
              {actionSuccess}
            </div>
          )}

          <form onSubmit={handleReviewAction} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
                  Action
                </label>
                <select
                  value={reviewAction}
                  onChange={(e) => setReviewAction(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
                >
                  <option value="Approve">Approve Case (Confirm Resolution & Verified)</option>
                  <option value="Escalate">Escalate to Senior Management</option>
                  <option value="Reclassify">Reclassify Category / Reassign Department</option>
                  <option value="Resolve">Mark as Resolved & Close</option>
                  <option value="Add Note">Add Internal Review Note Only</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
                  Reviewer Notes & Justification
                </label>
                <input
                  type="text"
                  required
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Provide audit rationale for this review action..."
                  className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={actionSubmitting}
                className="px-5 py-2.5 bg-[#171A3A] hover:bg-[#252A56] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
              >
                {actionSubmitting ? 'Recording Action...' : 'Record Review Decision'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Review Actions & Audit Trail (Staff Only) */}
      {isStaff && (
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs space-y-4">
          <div className="flex items-center space-x-2 border-b border-[#F0EBF9] pb-3">
            <History className="w-4 h-4 text-[#6C4AB6]" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#171A3A]">
              Immutable Governance Audit Trail
            </h2>
          </div>

          {audit_logs.length === 0 ? (
            <p className="text-xs text-[#79819A]">No audit entries recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {audit_logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0] text-xs flex items-start justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-[#171A3A]">{log.action}</span>
                      <span className="text-[10px] text-[#79819A]">by {log.user_email} ({log.role})</span>
                    </div>
                    <p className="text-[11px] text-[#555E7A]">{log.details}</p>
                  </div>
                  <span className="text-[10px] font-mono text-[#79819A] shrink-0 ml-4">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
