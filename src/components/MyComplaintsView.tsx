import React, { useState, useEffect } from 'react';
import { User, Complaint } from '../types';
import { api } from '../api';
import { FolderOpen, ShieldCheck, AlertTriangle, FilePlus2, Eye } from 'lucide-react';

interface MyComplaintsViewProps {
  user: User;
  onSelectComplaint: (id: string) => void;
  onNavigateSubmit: () => void;
}

export const MyComplaintsView: React.FC<MyComplaintsViewProps> = ({
  user,
  onSelectComplaint,
  onNavigateSubmit,
}) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadComplaints();
  }, []);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await api.getComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load my complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
      case 'Closed':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'Escalated':
        return 'bg-rose-50 text-rose-700 border border-rose-200 font-semibold';
      case 'In Progress':
        return 'bg-blue-50 text-blue-700 border border-blue-200';
      case 'Analyzed':
        return 'bg-[#EDE7F6] text-[#6C4AB6] border border-[#D1C4E9]';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#E2DCF0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">My Complaints</h1>
          <p className="text-xs text-[#555E7A] mt-1">
            Personal complaints portfolio. Isolated strictly to your user account ({user.email}).
          </p>
        </div>

        <button
          onClick={onNavigateSubmit}
          className="mt-3 sm:mt-0 inline-flex items-center px-4 py-2 bg-[#6C4AB6] hover:bg-[#593A9C] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
        >
          <FilePlus2 className="w-3.5 h-3.5 mr-2" />
          <span>Submit New Complaint</span>
        </button>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#79819A]">Loading your complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="p-16 text-center">
            <FolderOpen className="w-10 h-10 text-[#9D84D9] mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-[#171A3A]">No complaints submitted</h3>
            <p className="text-xs text-[#79819A] mt-1">You currently have no active or historical complaints.</p>
            <button
              onClick={onNavigateSubmit}
              className="mt-4 inline-flex items-center px-4 py-2 bg-[#6C4AB6] text-white text-xs font-semibold rounded-lg"
            >
              Submit a Complaint
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Complaint ID</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Order Reference</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Submission Date</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Verification</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBF9]">
                {complaints.map((c) => (
                  <tr key={c.complaint_id} className="hover:bg-[#F9F8FC] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{c.complaint_id}</td>
                    <td className="px-4 py-3 font-medium text-[#171A3A] max-w-sm truncate" title={c.title}>
                      {c.title}
                    </td>
                    <td className="px-4 py-3 font-mono text-[#555E7A]">{c.order_ref}</td>
                    <td className="px-4 py-3 text-[#79819A]">{c.date}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-0.5 rounded text-[10px] ${getStatusBadge(c.status)}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {c.verification_status === 'VERIFIED' ? (
                        <span className="inline-flex items-center text-[10px] font-semibold text-[#171A3A] bg-[#EDE7F6] px-2 py-0.5 rounded border border-[#D1C4E9]">
                          <ShieldCheck className="w-3 h-3 text-[#6C4AB6] mr-1" />
                          VERIFIED
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600 mr-1" />
                          UNDER REVIEW
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectComplaint(c.complaint_id)}
                        className="inline-flex items-center px-2.5 py-1 text-xs font-semibold text-[#6C4AB6] hover:bg-[#EDE7F6] rounded border border-[#D3C7EE] transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" />
                        <span>Track</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
