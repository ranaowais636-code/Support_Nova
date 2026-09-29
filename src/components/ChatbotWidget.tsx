import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Bot,
  User,
  Loader2,
  Paperclip,
  Mic,
  MicOff,
  Image as ImageIcon,
  Mail,
} from 'lucide-react';
import { api, getStoredToken } from '../api';
import { User as AppUser } from '../types';

interface Message {
  id: string;
  role: 'bot' | 'user';
  text: string;
  timestamp: Date;
  attachmentName?: string;
}

interface ChatIdentity {
  name: string;
  email: string;
}

/** Official SupportNova FAQ — exact questions and answers */
const FAQ_OPTIONS = [
  'How can I submit a complaint about my order?',
  'What information should I provide if my product is damaged or defective?',
  'Can I explain multiple issues in one complaint?',
  'Can I check the status of my complaint after my complaint?',
];

const FAQ_ANSWERS: Record<string, string> = {
  'How can I submit a complaint about my order?':
    'Go to Submit Complaint and provide: Complaint title, Complaint description, Order Number or Transaction Reference, Product/Service name, Date of the issue, Requested resolution, and Supporting evidence if available. You can also upload supporting evidence such as photos or screenshots to help our support team better understand and verify your complaint. Providing complete information and relevant evidence helps SupportNova analyze and route your complaint correctly.',
  'What information should I provide if my product is damaged or defective?':
    'Please provide your Order Number, product name, a clear description of the problem, and supporting photos or documents if available. Also mention what resolution you are requesting, such as a replacement or refund.',
  'Can I explain multiple issues in one complaint?':
    'Yes. Clearly describe all related issues in the Complaint Description and provide the relevant order or transaction information for each issue when applicable.',
  'Can I check the status of my complaint after my complaint?':
    'Yes. Go to My Complaints, where you can use your Complaint ID to check the current status and follow-up information of your complaint.',
};

type ComplaintStep =
  | null
  | 'title'
  | 'description'
  | 'order_ref'
  | 'category'
  | 'product_service'
  | 'confirm';

interface ComplaintFormState {
  title: string;
  description: string;
  order_ref: string;
  category: string;
  product_service: string;
  attachment_name?: string;
  attachment_data?: string;
}

interface ChatbotWidgetProps {
  onRequestLogin: () => void;
  isCustomerPanel?: boolean;
  currentUser?: AppUser | null;
  initialHistory?: Message[];
}

const CATEGORY_HINTS = [
  'Billing',
  'Shipping / Delivery',
  'Product Quality',
  'Refund / Return',
  'Account / Access',
  'Other',
];

export const ChatbotWidget: React.FC<ChatbotWidgetProps> = ({
  onRequestLogin,
  isCustomerPanel = false,
  currentUser = null,
  initialHistory = [],
}) => {
  const isAuthenticated = Boolean(currentUser) || Boolean(getStoredToken());
  const isCustomer =
    isCustomerPanel ||
    currentUser?.role === 'Customer' ||
    (isAuthenticated && !currentUser); // token present; treat as able to submit when Customer panel

  const [chatIdentity, setChatIdentity] = useState<ChatIdentity | null>(() => {
    try {
      const raw = sessionStorage.getItem('supportnova_chat_identity');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [identityDraft, setIdentityDraft] = useState<ChatIdentity>({ name: '', email: '' });
  const [identityError, setIdentityError] = useState('');
  const isIdentityReady = Boolean(currentUser?.name && currentUser?.email) || Boolean(chatIdentity?.name && chatIdentity?.email);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(
    initialHistory.length
      ? initialHistory
      : [
          {
            id: 'welcome',
            role: 'bot',
            text: isAuthenticated
              ? `Hello${currentUser?.name ? `, ${currentUser.name}` : ''}! I'm the SupportNova assistant. Choose an FAQ, ask a policy/routing question, or say "file a complaint" to start an interactive complaint.`
              : "Hello! I'm the SupportNova assistant. Choose an FAQ or describe a complaint issue (include order ID if available).",
            timestamp: new Date(),
          },
        ]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [complaintStep, setComplaintStep] = useState<ComplaintStep>(null);
  const [complaintForm, setComplaintForm] = useState<ComplaintFormState>({
    title: '',
    description: '',
    order_ref: '',
    category: '',
    product_service: '',
  });
  const [pendingAttachment, setPendingAttachment] = useState<{
    name: string;
    data?: string;
  } | null>(null);
  const [listening, setListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const conversationIdRef = useRef<string | undefined>(undefined);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Web Speech API setup (Chrome / Edge; graceful no-op elsewhere)
  useEffect(() => {
    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput((prev) => (prev ? `${prev} ${transcript}`.trim() : transcript.trim()));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const addMessage = useCallback((role: 'bot' | 'user', text: string, attachmentName?: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        role,
        text,
        timestamp: new Date(),
        attachmentName,
      },
    ]);

    persistQueueRef.current = persistQueueRef.current
      .then(async () => {
        const identity = currentUser?.name && currentUser?.email
          ? { name: currentUser.name, email: currentUser.email }
          : chatIdentity;
        const res = await api.saveChatMessage({
          conversation_id: conversationIdRef.current,
          role,
          content: attachmentName ? `${text}\n[Attachment: ${attachmentName}]` : text,
          customer_name: identity?.name,
          customer_email: identity?.email,
        });
        if (res.conversation_id) {
          conversationIdRef.current = res.conversation_id;
          setConversationId(res.conversation_id);
        }
      })
      .catch(() => {
        /* non-blocking */
      });
  }, []);

  const submitChatIdentity = () => {
    const name = identityDraft.name.trim();
    const email = identityDraft.email.trim().toLowerCase();
    if (name.length < 2) {
      setIdentityError('Please enter your full name.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIdentityError('Please enter a valid email address.');
      return false;
    }
    const identity = { name, email };
    setChatIdentity(identity);
    try {
      sessionStorage.setItem('supportnova_chat_identity', JSON.stringify(identity));
    } catch {
      /* session storage may be unavailable in privacy mode */
    }
    setIdentityError('');
    return true;
  };

  const handleFaq = (q: string) => {
    if (!isIdentityReady && !currentUser) {
      setIdentityError('Please add your name and email before starting the chat.');
      return;
    }
    addMessage('user', q);
    setTimeout(() => {
      addMessage('bot', FAQ_ANSWERS[q] || 'Please log in for more detailed assistance.');
    }, 400);
  };

  const startComplaintFlow = () => {
    setComplaintStep('title');
    setComplaintForm({
      title: '',
      description: '',
      order_ref: '',
      category: '',
      product_service: '',
      attachment_name: pendingAttachment?.name,
      attachment_data: pendingAttachment?.data,
    });
    addMessage(
      'bot',
      "Let's file a complaint. I'll collect the details step by step.\n\n1/5 — What is a short title for your complaint? (e.g. \"Delayed delivery for order #12345\")"
    );
  };

  const advanceComplaint = async (userText: string) => {
    const text = userText.trim();
    if (!text && complaintStep !== 'confirm') {
      addMessage('bot', 'Please provide a response to continue, or type "cancel" to abort.');
      return;
    }
    if (/^cancel$/i.test(text)) {
      setComplaintStep(null);
      setComplaintForm({
        title: '',
        description: '',
        order_ref: '',
        category: '',
        product_service: '',
      });
      addMessage('bot', 'Complaint filing cancelled. How else can I help?');
      return;
    }

    if (complaintStep === 'title') {
      setComplaintForm((f) => ({ ...f, title: text }));
      setComplaintStep('description');
      addMessage(
        'bot',
        '2/5 — Please describe the issue in detail (what happened, when, impact).'
      );
      return;
    }
    if (complaintStep === 'description') {
      setComplaintForm((f) => ({ ...f, description: text }));
      setComplaintStep('order_ref');
      addMessage(
        'bot',
        '3/5 — What is the order / transaction reference ID? (required)'
      );
      return;
    }
    if (complaintStep === 'order_ref') {
      setComplaintForm((f) => ({ ...f, order_ref: text }));
      setComplaintStep('category');
      addMessage(
        'bot',
        `4/5 — Category? Choose one or type your own:\n${CATEGORY_HINTS.map((c) => `• ${c}`).join('\n')}`
      );
      return;
    }
    if (complaintStep === 'category') {
      setComplaintForm((f) => ({ ...f, category: text, product_service: text }));
      setComplaintStep('product_service');
      addMessage(
        'bot',
        '5/5 — Product or service name (or reply "skip" to use the category).'
      );
      return;
    }
    if (complaintStep === 'product_service') {
      const product = /^skip$/i.test(text) ? complaintForm.category || 'General' : text;
      const nextForm = {
        ...complaintForm,
        product_service: product,
        attachment_name: pendingAttachment?.name || complaintForm.attachment_name,
        attachment_data: pendingAttachment?.data || complaintForm.attachment_data,
      };
      setComplaintForm(nextForm);
      setComplaintStep('confirm');
      addMessage(
        'bot',
        `Please confirm your complaint:\n\n• Title: ${nextForm.title}\n• Order: ${nextForm.order_ref}\n• Category: ${nextForm.category}\n• Product/Service: ${nextForm.product_service}\n• Description: ${nextForm.description.slice(0, 160)}${nextForm.description.length > 160 ? '…' : ''}${nextForm.attachment_name ? `\n• Attachment: ${nextForm.attachment_name}` : ''}\n\nReply "confirm" to submit, or "cancel" to abort.`
      );
      return;
    }
    if (complaintStep === 'confirm') {
      if (!/confirm|yes|submit|file it|go ahead/i.test(text)) {
        addMessage('bot', 'Reply "confirm" to submit, or "cancel" to abort.');
        return;
      }
      // Submit
      if (!isAuthenticated && !isCustomerPanel) {
        addMessage(
          'bot',
          'To finalize complaint submission, please log in to your Customer account. Your draft is ready after login.'
        );
        setTimeout(() => onRequestLogin(), 1000);
        setComplaintStep(null);
        return;
      }
      try {
        const result = await api.submitComplaint({
          title: complaintForm.title,
          description: complaintForm.description,
          order_ref: complaintForm.order_ref,
          product_service: complaintForm.product_service || complaintForm.category || 'General',
          channel: 'Chatbot',
          date: new Date().toISOString().slice(0, 10),
          attachment_name: complaintForm.attachment_name,
          attachment_data: complaintForm.attachment_data,
        });
        addMessage(
          'bot',
          `Complaint submitted successfully (ID: ${result.complaint_id}). Status: ${result.final_status || result.verification_status}. You can track it under My Complaints.`
        );
      } catch (err: any) {
        const msg = err?.message || '';
        if (/auth|sign in|401|login/i.test(msg) || !getStoredToken()) {
          addMessage(
            'bot',
            'Session expired or not authorized. Please log in as a Customer to submit the complaint.'
          );
          setTimeout(() => onRequestLogin(), 1000);
        } else {
          addMessage('bot', `Could not submit complaint: ${msg}. Please try again or use the Submit Complaint form.`);
        }
      }
      setComplaintStep(null);
      setComplaintForm({
        title: '',
        description: '',
        order_ref: '',
        category: '',
        product_service: '',
      });
      setPendingAttachment(null);
      return;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && !pendingAttachment) || loading) return;
    if (!isIdentityReady && !currentUser) {
      setIdentityError('Please add your name and email before sending a message.');
      return;
    }
    const displayText = text || (pendingAttachment ? `[Attached: ${pendingAttachment.name}]` : '');
    setInput('');
    const attachName = pendingAttachment?.name;
    addMessage('user', displayText, attachName);
    if (pendingAttachment && complaintStep) {
      setComplaintForm((f) => ({
        ...f,
        attachment_name: pendingAttachment.name,
        attachment_data: pendingAttachment.data,
      }));
    }
    setPendingAttachment(null);
    setLoading(true);

    try {
      // Active multi-step complaint flow
      if (complaintStep) {
        await advanceComplaint(text);
        setLoading(false);
        return;
      }

      // FAQ exact match — preserve existing behaviour
      if (FAQ_ANSWERS[text]) {
        addMessage('bot', FAQ_ANSWERS[text]);
        setLoading(false);
        return;
      }

      // Intent: start complaint
      if (
        /file (a )?complaint|submit (a )?complaint|i want to complain|raise (a )?complaint|lodge (a )?complaint/i.test(
          text
        )
      ) {
        startComplaintFlow();
        setLoading(false);
        return;
      }

      // Multi-agent intelligent reply via backend
      try {
        const res = await api.chatQuery({
          message: text,
          conversation_id: conversationIdRef.current,
          has_attachment: Boolean(attachName),
        });
        if (res.reply) {
          addMessage('bot', res.reply);
          if (res.suggest_complaint) {
            setTimeout(() => {
              addMessage(
                'bot',
                'Would you like me to guide you through filing a formal complaint? Say "file a complaint" to start.'
              );
            }, 600);
          }
        } else {
          addMessage(
            'bot',
            'I can help with FAQs, policy questions, or guide you through filing a complaint. Include an order ID and describe the issue, or pick an FAQ option below.'
          );
        }
      } catch {
        // Offline / API fallback — keep useful local behaviour
        const orderMatch = text.match(/(?:order|ref|reference|id)[#:\s]*([A-Z0-9-]{4,})/i);
        const hasProblem =
          /problem|issue|broken|delay|missing|wrong|refund|damaged|not received|complaint/i.test(
            text
          );
        if (orderMatch || (hasProblem && text.length > 30)) {
          addMessage(
            'bot',
            `I noticed a potential issue${orderMatch ? ` for order ${orderMatch[1]}` : ''}. Would you like to file a formal complaint? Reply "file a complaint" and I'll collect the details step by step.${isAuthenticated ? '' : ' You will need to be logged in as a Customer to submit.'}`
          );
        } else {
          addMessage(
            'bot',
            'I can help with FAQs or draft a complaint. Include an order ID and describe the issue, or pick an FAQ option below. For full access, please log in.'
          );
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      addMessage('bot', 'Attachment is too large (max 4 MB). Please choose a smaller file.');
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      setPendingAttachment({ name: file.name, data: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      addMessage(
        'bot',
        'Voice input is not supported in this browser. Please type your message or use Chrome/Edge with microphone permission.'
      );
      return;
    }
    if (listening) {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      setListening(false);
      return;
    }
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="sn-chat-widget">
      {open && (
        <div className="sn-chat-panel mb-3 sn-animate-fade-up">
          {/* Header — unchanged visual language */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{
              backgroundColor: 'var(--sn-primary)',
              borderColor: 'var(--sn-border)',
            }}
          >
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-[#111111]" />
              <div>
                <div className="text-sm font-bold text-[#111111]">SupportNova Assistant</div>
                <div className="text-[10px] text-[#333]">
                  {isAuthenticated ? 'Session active · Multi-agent ready' : 'Always here to help'}
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-black/10">
              <X className="w-4 h-4 text-[#111111]" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3"
            style={{ backgroundColor: 'var(--sn-bg)' }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor:
                      m.role === 'bot' ? 'var(--sn-primary-soft)' : 'var(--sn-bg-muted)',
                  }}
                >
                  {m.role === 'bot' ? (
                    <Bot className="w-3.5 h-3.5" style={{ color: 'var(--sn-primary)' }} />
                  ) : (
                    <User className="w-3.5 h-3.5 sn-text-muted" />
                  )}
                </div>
                <div
                  className="max-w-[75%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                  style={{
                    backgroundColor:
                      m.role === 'user' ? 'var(--sn-primary)' : 'var(--sn-bg-elevated)',
                    color: m.role === 'user' ? '#111111' : 'var(--sn-text)',
                    border: m.role === 'bot' ? '1px solid var(--sn-border)' : 'none',
                  }}
                >
                  {m.text}
                  {m.attachmentName && (
                    <div
                      className="mt-1.5 flex items-center gap-1 text-[11px] opacity-80"
                      style={{ color: m.role === 'user' ? '#222' : 'var(--sn-text-secondary)' }}
                    >
                      <ImageIcon className="w-3 h-3" />
                      {m.attachmentName}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--sn-primary-soft)' }}
                >
                  <Loader2
                    className="w-3.5 h-3.5 animate-spin"
                    style={{ color: 'var(--sn-primary)' }}
                  />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Customer identity — required for anonymous chats so Admin transcripts are traceable. */}
          {!isIdentityReady && !currentUser && (
            <div
              className="px-3 py-3 border-t"
              style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg-elevated)' }}
            >
              <div className="text-xs font-bold sn-text mb-1">Before we start</div>
              <div className="text-[11px] sn-text-muted mb-2.5">Enter your name and email so our support team can identify your chat.</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className="sn-input text-xs"
                  placeholder="Full name"
                  value={identityDraft.name}
                  onChange={(e) => { setIdentityDraft((v) => ({ ...v, name: e.target.value })); setIdentityError(''); }}
                />
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 sn-text-muted" />
                  <input
                    type="email"
                    className="sn-input text-xs pl-8 w-full"
                    placeholder="Email address"
                    value={identityDraft.email}
                    onChange={(e) => { setIdentityDraft((v) => ({ ...v, email: e.target.value })); setIdentityError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitChatIdentity(); }}
                  />
                </div>
              </div>
              {identityError && <div className="text-[10px] text-red-600 mt-1.5">{identityError}</div>}
              <button
                type="button"
                onClick={submitChatIdentity}
                className="sn-btn sn-btn-primary w-full justify-center mt-2 text-xs"
              >
                Continue to Support Chat
              </button>
            </div>
          )}

          {/* FAQ chips — preserved */}
          {!complaintStep && (
            <div
              className="sn-chat-faq border-t"
              style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg-elevated)' }}
            >
              <div className="px-3 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider sn-text-muted">
                Quick FAQs
              </div>
              <div className="px-3 pb-2.5 space-y-1.5">
                {FAQ_OPTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => handleFaq(q)}
                    disabled={!isIdentityReady && !currentUser}
                    className="sn-chat-faq-btn w-full text-left text-[11px] sm:text-xs px-2.5 py-2 rounded-lg border transition-all hover:opacity-80"
                    style={{
                      borderColor: 'var(--sn-border)',
                      color: 'var(--sn-text-secondary)',
                      backgroundColor: 'var(--sn-bg)',
                    }}
                  >
                    <span className="leading-snug">{q}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pending attachment chip */}
          {pendingAttachment && (
            <div
              className="px-3 py-1.5 border-t flex items-center gap-2 text-xs"
              style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg-muted)' }}
            >
              <Paperclip className="w-3.5 h-3.5" style={{ color: 'var(--sn-primary)' }} />
              <span className="truncate flex-1 sn-text-secondary">{pendingAttachment.name}</span>
              <button
                type="button"
                className="text-[11px] underline sn-text-muted"
                onClick={() => setPendingAttachment(null)}
              >
                Remove
              </button>
            </div>
          )}

          {/* Input row with multi-modal controls */}
          <div
            className="p-3 border-t flex gap-1.5 items-center"
            style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg-elevated)' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg)' }}
              title="Attach image or document"
              aria-label="Attach file"
            >
              <Paperclip className="w-4 h-4 sn-text-muted" />
            </button>
            <button
              type="button"
              onClick={toggleVoice}
              className="p-2 rounded-lg border transition-colors hover:opacity-80"
              style={{
                borderColor: listening ? 'var(--sn-primary)' : 'var(--sn-border)',
                backgroundColor: listening ? 'var(--sn-primary-soft)' : 'var(--sn-bg)',
              }}
              title={listening ? 'Stop listening' : 'Voice to text'}
              aria-label={listening ? 'Stop voice input' : 'Start voice input'}
            >
              {listening ? (
                <MicOff className="w-4 h-4" style={{ color: 'var(--sn-primary)' }} />
              ) : (
                <Mic className="w-4 h-4 sn-text-muted" />
              )}
            </button>
            <input
              className="sn-input flex-1 text-sm"
              placeholder={
                listening
                  ? 'Listening…'
                  : complaintStep
                    ? 'Type your reply…'
                    : 'Type a message…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={(!input.trim() && !pendingAttachment) || loading}
              className="sn-btn sn-btn-primary px-3"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle button — unchanged */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{ backgroundColor: 'var(--sn-primary)' }}
        aria-label="Open chat"
      >
        {open ? (
          <X className="w-6 h-6 text-[#111111]" />
        ) : (
          <MessageSquare className="w-6 h-6 text-[#111111]" />
        )}
      </button>
    </div>
  );
};
