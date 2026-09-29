import React, { useEffect, useState } from 'react';
import { MessageSquare, User, Bot, Loader2, ChevronRight, Search } from 'lucide-react';
import { User as AppUser } from '../types';
import { api } from '../api';

interface ChatLogsViewProps {
  user: AppUser;
}

interface ConversationRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  status: string;
  created_at: string;
  updated_at: string;
  last_message: string | null;
  message_count: number;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

const getInitials = (name: string) =>
  (name || 'Guest')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'G';

export const ChatLogsView: React.FC<ChatLogsViewProps> = ({ user }) => {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedMeta, setSelectedMeta] = useState<ConversationRow | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const res = await api.getChatConversations();
      setConversations(res.conversations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openConversation = async (conv: ConversationRow) => {
    setSelectedId(conv.id);
    setSelectedMeta(conv);
    setMsgLoading(true);
    try {
      const res = await api.getChatMessages(conv.id);
      setMessages(res.messages || []);
    } catch (err) {
      console.error(err);
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  };

  const filtered = conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (c.customer_name || '').toLowerCase().includes(q) ||
      (c.customer_email || '').toLowerCase().includes(q) ||
      (c.last_message || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="sn-heading text-2xl font-bold sn-text">Chat Logs / Conversations</h1>
        <p className="text-sm sn-text-secondary mt-1">
          Administrator-only view of customer chatbot transcripts. Customer full name and email address are shown with every conversation.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 520 }}>
        {/* List */}
        <div className="lg:col-span-2 sn-card overflow-hidden flex flex-col">
          <div className="p-3 border-b" style={{ borderColor: 'var(--sn-border)' }}>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 sn-text-muted" />
              <input
                className="sn-input w-full pl-9 text-sm"
                placeholder="Search by customer name, email, or message…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin sn-text-muted" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 sn-text-muted text-sm">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                No conversations yet
              </div>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c)}
                  className="w-full text-left px-4 py-3 border-b transition-colors hover:opacity-90"
                  style={{
                    borderColor: 'var(--sn-border)',
                    backgroundColor:
                      selectedId === c.id ? 'var(--sn-primary-soft)' : 'transparent',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                        style={{ backgroundColor: 'var(--sn-primary-soft)', color: 'var(--sn-primary)' }}
                        aria-hidden="true"
                      >
                        {getInitials(c.customer_name)}
                      </div>
                      <div className="font-semibold text-sm sn-text truncate">
                        {c.customer_name || 'Guest'}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 sn-text-muted flex-shrink-0" />
                  </div>
                  <div className="text-[11px] sn-text-muted mt-0.5 truncate">
                    {c.customer_email || '—'} · {c.message_count} msgs
                  </div>
                  <div className="text-xs sn-text-secondary mt-1 line-clamp-2">
                    {c.last_message || 'No messages'}
                  </div>
                  <div className="text-[10px] sn-text-muted mt-1">
                    {c.updated_at ? new Date(c.updated_at).toLocaleString() : ''}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="lg:col-span-3 sn-card overflow-hidden flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center sn-text-muted text-sm">
              Select a conversation to view the full transcript
            </div>
          ) : (
            <>
              <div
                className="px-4 py-3 border-b flex items-center gap-3"
                style={{ borderColor: 'var(--sn-border)', backgroundColor: 'var(--sn-bg-muted)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ backgroundColor: 'var(--sn-primary-soft)', color: 'var(--sn-primary)' }}
                  aria-hidden="true"
                >
                  {getInitials(selectedMeta?.customer_name || 'Guest')}
                </div>
                <div>
                  <div className="font-semibold text-sm sn-text">
                    {selectedMeta?.customer_name || 'Guest'}
                  </div>
                  <div className="text-[11px] sn-text-muted">
                    {selectedMeta?.customer_email || '—'} · Status: {selectedMeta?.status}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {msgLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin sn-text-muted" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center sn-text-muted text-sm py-12">No messages</div>
                ) : (
                  messages.map((m) => (
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
                        className="max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
                        style={{
                          backgroundColor:
                            m.role === 'user' ? 'var(--sn-primary)' : 'var(--sn-bg-elevated)',
                          color: m.role === 'user' ? '#111111' : 'var(--sn-text)',
                          border: m.role === 'bot' ? '1px solid var(--sn-border)' : 'none',
                        }}
                      >
                        {m.content}
                        <div
                          className="text-[10px] mt-1 opacity-60"
                          style={{ color: m.role === 'user' ? '#333' : undefined }}
                        >
                          {m.created_at ? new Date(m.created_at).toLocaleString() : ''}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
