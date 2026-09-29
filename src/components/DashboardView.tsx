import React, { useEffect, useState } from 'react';
import { User, Complaint } from '../types';
import { api } from '../api';
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  FilePlus2,
  ChevronRight,
  UserPlus,
  Loader2,
} from 'lucide-react';

interface DashboardViewProps {
  user: User;
  onSelectComplaint: (complaintId: string) => void;
  onNavigate: (page: any) => void;
}

interface RecentCustomer {
  id: string;
  name: string;
  email: string;
  customer_type: string;
  created_at: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ user, onSelectComplaint, onNavigate }) => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  useEffect(() => {
    loadComplaints();
    if (user.role === 'Administrator') {
      loadRecentCustomers();
    }
  }, [user]);

  const loadComplaints = async () => {
    setLoading(true);
    try {
      const data = await api.getComplaints();
      setComplaints(data);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await api.getRecentCustomers(15);
      setRecentCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load recent customers:', err);
    } finally {
      setCustomersLoading(false);
    }
  };

  const total = complaints.length;
  const resolved = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;
  const escalated = complaints.filter((c) => c.status === 'Escalated').length;
  const pending = complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length;

  const isCustomer = user.role === 'Customer';

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

  const getUrgencyBadge = (urgency?: string) => {
    switch (urgency) {
      case 'Critical':
        return 'bg-[#171A3A] text-white border border-[#232854] font-bold';
      case 'High':
        return 'bg-[#EDE7F6] text-[#6C4AB6] border border-[#D1C4E9] font-medium';
      case 'Medium':
        return 'bg-[#F4F1FA] text-[#555E7A] border border-[#E2DCF0]';
      default:
        return 'bg-white text-gray-600 border border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-2 border-b border-[#E2DCF0]">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">
            {isCustomer ? 'Customer Support Portal' : `${user.role} Dashboard`}
          </h1>
          <p className="text-xs text-[#555E7A] mt-1">
            {isCustomer
              ? 'Track personal complaint status, submit inquiries, and view resolution updates.'
              : 'Enterprise triage overview, ground-truth verification status, and complaint lifecycle.'}
          </p>
        </div>

        <div className="mt-3 sm:mt-0 flex items-center space-x-3">
          {isCustomer ? (
            <button
              onClick={() => onNavigate('submit_complaint')}
              className="inline-flex items-center px-4 py-2 bg-[#6C4AB6] hover:bg-[#593A9C] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
            >
              <FilePlus2 className="w-4 h-4 mr-2" />
              <span>Submit New Complaint</span>
            </button>
          ) : (
            <button
              onClick={() => onNavigate(user.role === 'Agent' ? 'complaints' : 'review_queue')}
              className="inline-flex items-center px-3.5 py-1.5 bg-white border border-[#D3C7EE] hover:bg-[#F4F1FA] text-[#171A3A] text-xs font-medium rounded-lg transition-colors shadow-xs"
            >
              <span>{user.role === 'Agent' ? 'View All Complaints' : 'Go to Review Queue'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 ml-1.5 text-[#6C4AB6]" />
            </button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#555E7A]">
              {isCustomer ? 'My Complaints' : 'Total Complaints'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0] flex items-center justify-center">
              <Inbox className="w-4 h-4 text-[#6C4AB6]" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#171A3A]">{loading ? '...' : total}</div>
          <div className="mt-1 text-[11px] text-[#79819A]">
            {isCustomer ? 'All tickets submitted by your account' : 'System intake volume across all channels'}
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#555E7A]">
              {isCustomer ? 'In Progress / Open' : 'Pending Resolution'}
            </span>
            <div className="w-8 h-8 rounded-lg bg-[#F4F1FA] border border-[#E2DCF0] flex items-center justify-center">
              <Clock className="w-4 h-4 text-[#6C4AB6]" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#171A3A]">{loading ? '...' : pending}</div>
          <div className="mt-1 text-[11px] text-[#79819A]">
            {isCustomer ? 'Active cases under review' : 'Tickets currently progressing within SLA'}
          </div>
        </div>

        {/* Resolved */}
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#555E7A]">Resolved Cases</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#171A3A]">{loading ? '...' : resolved}</div>
          <div className="mt-1 text-[11px] text-[#79819A]">
            {isCustomer ? 'Cases marked complete with resolution' : 'Closed tickets with verified compliance'}
          </div>
        </div>

        {/* Escalated */}
        <div className="bg-white rounded-xl p-5 border border-[#E2DCF0] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#555E7A]">Escalated Cases</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-[#171A3A]">{loading ? '...' : escalated}</div>
          <div className="mt-1 text-[11px] text-[#79819A]">
            {isCustomer ? 'High priority supervisor assignments' : 'Mandatory safety, legal or VIP escalations'}
          </div>
        </div>
      </div>

      {/* Recent Complaints Table */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F0EBF9] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[#171A3A]">
              {isCustomer ? 'Recent Complaints by Your Account' : 'Recent Incoming Complaints'}
            </h2>
            <p className="text-xs text-[#79819A] mt-0.5">
              {isCustomer ? 'Customer data isolated to your user ID' : 'Synchronized pipeline status'}
            </p>
          </div>
          <button
            onClick={() => onNavigate(isCustomer ? 'my_complaints' : 'complaints')}
            className="text-xs text-[#6C4AB6] hover:text-[#171A3A] font-semibold flex items-center space-x-1"
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#79819A]">Loading complaints...</div>
        ) : complaints.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-8 h-8 text-[#9D84D9] mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-[#171A3A]">No complaints found</h3>
            <p className="text-xs text-[#79819A] mt-1">
              {isCustomer ? 'You have not submitted any complaints yet.' : 'The complaints intake queue is empty.'}
            </p>
            {isCustomer && (
              <button
                onClick={() => onNavigate('submit_complaint')}
                className="mt-4 inline-flex items-center px-3.5 py-1.5 bg-[#6C4AB6] text-white text-xs font-semibold rounded-lg"
              >
                Submit Your First Complaint
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Complaint ID</th>
                  {!isCustomer && <th className="px-4 py-3 font-semibold uppercase tracking-wider">Customer</th>}
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Title</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Urgency</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Verification</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EBF9]">
                {complaints.slice(0, 7).map((c) => (
                  <tr key={c.complaint_id} className="hover:bg-[#F9F8FC] transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{c.complaint_id}</td>
                    {!isCustomer && (
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#171A3A]">{c.customer_name}</div>
                        <div className="text-[10px] text-[#79819A]">{c.customer_type}</div>
                      </td>
                    )}
                    <td className="px-4 py-3 font-medium text-[#171A3A] max-w-xs truncate" title={c.title}>
                      {c.title}
                    </td>
                    <td className="px-4 py-3 text-[#555E7A]">{c.category || 'General'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${getUrgencyBadge(c.urgency)}`}>
                        {c.urgency || 'Medium'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] ${getStatusBadge(c.status)}`}>
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
                          REVIEW REQ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#79819A]">{c.date}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onSelectComplaint(c.complaint_id)}
                        className="px-2.5 py-1 text-xs font-semibold text-[#6C4AB6] hover:bg-[#EDE7F6] rounded border border-[#D3C7EE] transition-colors"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin: New Customer Signups */}
      {user.role === 'Administrator' && (
        <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-[#F0EBF9] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#171A3A] flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-[#6C4AB6]" />
                New Customer Signups
              </h2>
              <p className="text-xs text-[#79819A] mt-0.5">
                Live feed of newly registered customer accounts (newest first)
              </p>
            </div>
          </div>
          {customersLoading ? (
            <div className="p-8 flex items-center justify-center text-xs text-[#79819A]">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Loading recent signups...
            </div>
          ) : recentCustomers.length === 0 ? (
            <div className="p-10 text-center">
              <UserPlus className="w-8 h-8 text-[#9D84D9] mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-[#171A3A]">No customer signups yet</h3>
              <p className="text-xs text-[#79819A] mt-1">
                New customer registrations will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Email</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Type</th>
                    <th className="px-4 py-3 font-semibold uppercase tracking-wider">Signed Up</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EBF9]">
                  {recentCustomers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-[#F9F8FC] transition-colors">
                      <td className="px-4 py-3 font-medium text-[#171A3A]">{cust.name}</td>
                      <td className="px-4 py-3 text-[#555E7A]">{cust.email}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4F1FA] text-[#555E7A] border border-[#E2DCF0]">
                          {cust.customer_type || 'Regular'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#79819A]">
                        {cust.created_at
                          ? new Date(cust.created_at).toLocaleString()
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
