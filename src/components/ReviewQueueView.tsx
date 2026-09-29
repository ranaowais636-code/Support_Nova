import React, { useState, useEffect } from 'react';
import { User, Complaint } from '../types';
import { api } from '../api';
import { CheckSquare, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ReviewQueueViewProps {
  user: User;
  onSelectComplaint: (id: string) => void;
}

export const ReviewQueueView: React.FC<ReviewQueueViewProps> = ({ user, onSelectComplaint }) => {
  const [queue, setQueue] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQueue();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const items = await api.getReviewQueue();
      setQueue(items);
    } catch (err) {
      console.error('Failed to load review queue:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-[#E2DCF0]">
        <div className="flex items-center space-x-2">
          <CheckSquare className="w-5 h-5 text-[#6C4AB6]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">Manual Review Queue</h1>
        </div>
        <p className="text-xs text-[#555E7A] mt-1">
          Cases requiring human specialist intervention due to GenAI/Python rule discrepancies, policy ambiguity, or mandatory safety escalations.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center text-xs text-[#79819A]">Loading review queue items...</div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-xl p-16 border border-[#E2DCF0] text-center shadow-xs">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-[#171A3A]">Review Queue is Clear</h3>
          <p className="text-xs text-[#79819A] mt-1">
            All complaints currently satisfy deterministic Python ground-truth verification standards.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {queue.map((item) => (
            <div
              key={item.complaint_id}
              className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs hover:border-[#D3C7EE] transition-all space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#F0EBF9] pb-3">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs font-bold text-[#171A3A] bg-[#F4F1FA] px-2.5 py-1 rounded border border-[#E2DCF0]">
                    {item.complaint_id}
                  </span>
                  <span className="text-xs font-semibold text-[#171A3A]">{item.customer_name}</span>
                  <span className="text-[10px] text-[#79819A]">({item.customer_type})</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      item.urgency === 'Critical'
                        ? 'bg-[#171A3A] text-white'
                        : item.urgency === 'High'
                        ? 'bg-[#EDE7F6] text-[#6C4AB6]'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {item.urgency} ({item.priority || 'P2'})
                  </span>

                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    <span>{item.status === 'Escalated' ? 'ESCALATED' : 'DISAGREEMENT'}</span>
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#171A3A]">{item.title}</h3>
                <p className="text-xs text-[#555E7A] line-clamp-2 mt-1 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {/* Mismatches list */}
              {item.mismatches && item.mismatches.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-50/70 border border-rose-100 text-[11px] text-rose-800 space-y-1">
                  <div className="font-semibold flex items-center space-x-1 text-rose-900">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>Discrepancy Details:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 pl-1">
                    {item.mismatches.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between text-xs">
                <span className="text-[11px] text-[#79819A]">
                  Order Ref: <strong className="font-mono text-[#171A3A]">{item.order_ref}</strong> • Channel: {item.channel}
                </span>

                <button
                  onClick={() => onSelectComplaint(item.complaint_id)}
                  className="inline-flex items-center px-4 py-1.5 bg-[#6C4AB6] hover:bg-[#593A9C] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
                >
                  <span>Review Case</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
