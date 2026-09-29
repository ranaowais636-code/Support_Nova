import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Paperclip,
  Send,
  Loader2,
  CheckCircle2,
  Info,
} from 'lucide-react';

interface SubmitComplaintViewProps {
  user: User;
  onSuccess: (complaintId: string) => void;
}

export const SubmitComplaintView: React.FC<SubmitComplaintViewProps> = ({ user, onSuccess }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [productService, setProductService] = useState('');
  const [orderRef, setOrderRef] = useState('');
  const [channel, setChannel] = useState('Web Form');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [customerType, setCustomerType] = useState(user.customer_type || 'Regular');
  const [prevComplaintRef, setPrevComplaintRef] = useState('');
  const [requestedResolution, setRequestedResolution] = useState('');
  const [attachmentName, setAttachmentName] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim() || title.length < 5) {
      setError('Please provide a descriptive complaint title (minimum 5 characters).');
      return;
    }
    if (!description.trim() || description.length < 15) {
      setError('Please provide detailed complaint facts in the description (minimum 15 characters).');
      return;
    }
    if (!orderRef.trim()) {
      setError('Order or Transaction Reference is mandatory.');
      return;
    }

    setSubmitting(true);
    setPipelineStage('1/4: Pre-processing input & adversarial sanitization...');

    try {
      setTimeout(() => {
        setPipelineStage('2/4: Generating GenAI structured intelligence...');
      }, 700);

      setTimeout(() => {
        setPipelineStage('3/4: Executing independent Python Ground-Truth validation...');
      }, 1500);

      const result = await api.submitComplaint({
        title,
        description,
        product_service: productService || 'General Item',
        order_ref: orderRef,
        channel,
        date,
        customer_type: customerType,
        prev_complaint_ref: prevComplaintRef || undefined,
        requested_resolution: requestedResolution || undefined,
        attachment_name: attachmentName || undefined,
      });

      setPipelineStage('4/4: Comparison Engine completed.');
      setTimeout(() => {
        onSuccess(result.complaint_id);
      }, 500);
    } catch (err: any) {
      setError(err.message || 'An error occurred during complaint submission.');
      setSubmitting(false);
      setPipelineStage(null);
    }
  };

  const handleFileUploadSim = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentName(e.target.files[0].name);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="pb-3 border-b border-[#E2DCF0]">
        <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">Submit Customer Complaint</h1>
        <p className="text-xs text-[#555E7A] mt-1">
          Formal complaint intake. All submissions are processed through the dual-pipeline verification system.
        </p>
      </div>

      {/* Security notice regarding untrusted data envelope */}
      <div className="bg-white rounded-xl p-4 border border-[#E2DCF0] flex items-start space-x-3 text-xs text-[#555E7A]">
        <ShieldCheck className="w-5 h-5 text-[#6C4AB6] shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold text-[#171A3A]">Prompt-Injection Immune Architecture:</span> Complaint text is treated strictly as untrusted data within an isolated evaluation envelope. GenAI policy grounding and Python business rules are enforced independently.
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Submission Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 border border-[#E2DCF0] shadow-xs space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Complaint Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Broken display glass upon delivery of smart tablet"
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            />
          </div>

          {/* Product / Service */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Product or Service *
            </label>
            <input
              type="text"
              required
              value={productService}
              onChange={(e) => setProductService(e.target.value)}
              placeholder="e.g. Galaxy Ultra Tablet 12"
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            />
          </div>

          {/* Order / Transaction Reference */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Order / Transaction Reference *
            </label>
            <input
              type="text"
              required
              value={orderRef}
              onChange={(e) => setOrderRef(e.target.value)}
              placeholder="e.g. ORD-98214 or INV-2026-004"
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] font-mono focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            />
          </div>

          {/* Submission Channel */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Complaint Channel
            </label>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            >
              <option value="Web Form">Web Form</option>
              <option value="Email">Email</option>
              <option value="Chat">Chat</option>
              <option value="Upload">Uploaded Complaint</option>
            </select>
          </div>

          {/* Customer Type */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Customer Tier
            </label>
            <select
              value={customerType}
              onChange={(e) => setCustomerType(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            >
              <option value="Regular">Regular Customer</option>
              <option value="VIP">VIP Customer (Priority SLA)</option>
            </select>
          </div>

          {/* Previous Complaint Reference (Triggers Repeat Detection) */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Previous Complaint Reference (Optional)
            </label>
            <input
              type="text"
              value={prevComplaintRef}
              onChange={(e) => setPrevComplaintRef(e.target.value)}
              placeholder="e.g. CMP-00101 (If repeating unresolved case)"
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] font-mono focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            />
            <p className="text-[10px] text-[#79819A] mt-1">If specified, triggers automatic repeat escalation logic.</p>
          </div>

          {/* Requested Resolution */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Requested Resolution (Optional)
            </label>
            <input
              type="text"
              value={requestedResolution}
              onChange={(e) => setRequestedResolution(e.target.value)}
              placeholder="e.g. Replacement unit / Full refund / Shipping fee credit"
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            />
          </div>

          {/* Supporting Document / Attachment */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E] mb-1.5">
              Supporting Document / Attachment (Optional)
            </label>
            <div className="flex items-center space-x-3">
              <label className="cursor-pointer inline-flex items-center px-3.5 py-2 border border-[#D3C7EE] rounded-lg bg-[#F4F1FA] hover:bg-[#EAE4F7] text-xs font-semibold text-[#171A3A] transition-colors">
                <Paperclip className="w-3.5 h-3.5 mr-2 text-[#6C4AB6]" />
                <span>Choose Attachment</span>
                <input type="file" onChange={handleFileUploadSim} className="hidden" />
              </label>
              {attachmentName ? (
                <span className="text-xs text-[#171A3A] font-medium bg-[#EDE7F6] px-2.5 py-1 rounded border border-[#D1C4E9]">
                  {attachmentName}
                </span>
              ) : (
                <span className="text-xs text-[#79819A]">PDF, PNG, JPG, or invoice document</span>
              )}
            </div>
          </div>

          {/* Complaint Description */}
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#444D6E]">
                Complaint Description *
              </label>
              <span className="text-[11px] text-[#79819A]">Minimum 15 characters</span>
            </div>
            <textarea
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Please describe the issue in detail, including dates, what occurred, and any actions taken so far..."
              className="w-full px-3.5 py-2.5 bg-white border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] placeholder-[#99A2BD] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6] leading-relaxed"
            />
          </div>
        </div>

        {/* Pipeline Stage Notification */}
        {submitting && (
          <div className="p-4 rounded-xl bg-[#171A3A] text-white space-y-2">
            <div className="flex items-center space-x-3 text-xs font-semibold">
              <Loader2 className="w-4 h-4 text-[#9D84D9] animate-spin" />
              <span>Dual Pipeline Execution:</span>
              <span className="text-[#9D84D9] font-normal">{pipelineStage}</span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center px-6 py-2.5 bg-[#6C4AB6] hover:bg-[#593A9C] text-white text-xs font-semibold rounded-lg shadow-xs hover:shadow transition-all disabled:opacity-50"
          >
            {submitting ? (
              <span>Processing Intake...</span>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 mr-2" />
                <span>Submit Complaint</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
