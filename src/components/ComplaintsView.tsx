import React, { useState, useEffect } from 'react';
import { User, Complaint } from '../types';
import { api } from '../api';
import { Search, Download, ShieldCheck, AlertTriangle, Filter, RotateCcw } from 'lucide-react';

interface ComplaintsViewProps {
  user: User;
  onSelectComplaint: (id: string) => void;
}

export const ComplaintsView: React.FC<ComplaintsViewProps> = ({ user, onSelectComplaint }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [category, setCategory] = useState('All');
  const [urgency, setUrgency] = useState('All');

  useEffect(() => {
    loadComplaints();
  }, [status, category, urgency]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await api.getComplaints({
        search,
        status,
        category,
        urgency,
      });
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load complaints:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadComplaints();
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('All');
    setCategory('All');
    setUrgency('All');
  };

  const handleExportCSV = async () => {
    try {
      await api.downloadExportCSV();
    } catch (err) {
      console.error('Export CSV error:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#E2DCF0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">Complaints Repository</h1>
          <p className="text-xs text-[#555E7A] mt-1">
            Enterprise case records, dual-pipeline verification outcomes, and triage states.
          </p>
        </div>

        <div className="mt-3 sm:mt-0 flex items-center space-x-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2 bg-white border border-[#D3C7EE] hover:bg-[#F4F1FA] text-[#171A3A] text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 mr-1.5 text-[#6C4AB6]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2DCF0] shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-[#79819A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Complaint ID, Title, Order Ref, Customer..."
              className="w-full pl-9 pr-3 py-2 bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6] focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Status Filter */}
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            >
              <option value="All">All Statuses</option>
              <option value="New">New</option>
              <option value="Analyzed">Analyzed</option>
              <option value="In Progress">In Progress</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>

            {/* Category Filter */}
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="px-3 py-2 bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            >
              <option value="All">All Categories</option>
              <option value="Delivery">Delivery</option>
              <option value="Billing">Billing</option>
              <option value="Product Defect">Product Defect</option>
              <option value="Refund">Refund</option>
              <option value="Warranty">Warranty</option>
              <option value="Technical Support">Technical Support</option>
              <option value="Safety">Safety</option>
              <option value="Privacy">Privacy</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>

            {/* Urgency Filter */}
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value)}
              className="px-3 py-2 bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg text-xs text-[#171A3A] focus:outline-none focus:ring-2 focus:ring-[#6C4AB6]"
            >
              <option value="All">All Urgency Tiers</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            <button
              type="submit"
              className="px-3.5 py-2 bg-[#6C4AB6] text-white text-xs font-semibold rounded-lg hover:bg-[#593A9C] transition-colors"
            >
              Filter
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              title="Reset Filters"
              className="p-2 text-[#79819A] hover:text-[#171A3A] bg-[#F4F1FA] border border-[#D3C7EE] rounded-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>

      {/* Complaints Table */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-[#79819A]">Loading complaints repository...</div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center text-xs text-[#79819A]">
            No complaints match the specified search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Complaint ID</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Customer</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Dept</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Urgency</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Priority</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Verification</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBF9]">
                {complaints.map((c) => (
                  <tr key={c.complaint_id} className="hover:bg-[#F9F8FC] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{c.complaint_id}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[#171A3A]">{c.customer_name}</div>
                      <div className="text-[10px] text-[#79819A] flex items-center space-x-1">
                        <span>{c.customer_type}</span>
                        {c.is_repeat === 1 && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] px-1 rounded font-bold">
                            REPEAT ({c.repeat_count})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-[#171A3A] max-w-xs truncate" title={c.title}>
                      <div>{c.title}</div>
                      <div className="text-[10px] text-[#79819A] font-mono">Ref: {c.order_ref}</div>
                    </td>
                    <td className="px-4 py-3 text-[#555E7A]">{c.category || 'General'}</td>
                    <td className="px-4 py-3 text-[#555E7A]">{c.department || 'Triage'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          c.urgency === 'Critical'
                            ? 'bg-[#171A3A] text-white font-bold'
                            : c.urgency === 'High'
                            ? 'bg-[#EDE7F6] text-[#6C4AB6] font-semibold'
                            : 'bg-[#F4F1FA] text-[#555E7A]'
                        }`}
                      >
                        {c.urgency || 'Medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{c.priority || 'P2'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          c.status === 'Resolved'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : c.status === 'Escalated'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
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
                          REVIEW REQ ({c.mismatch_count || 1})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectComplaint(c.complaint_id)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#6C4AB6] hover:bg-[#EDE7F6] rounded border border-[#D3C7EE] transition-colors"
                      >
                        Details
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
