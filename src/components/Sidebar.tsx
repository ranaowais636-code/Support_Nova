import React from 'react';
import { UserRole } from '../types';
import {
  LayoutDashboard, FileText, PlusCircle, FolderOpen, ClipboardList,
  BookOpen, BarChart3, Settings, MessageSquare
} from 'lucide-react';

export type NavigationPage =
  | 'dashboard'
  | 'complaints'
  | 'submit_complaint'
  | 'my_complaints'
  | 'review_queue'
  | 'documents'
  | 'reports'
  | 'settings'
  | 'chat_logs';

interface SidebarProps {
  role: UserRole;
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  reviewQueueCount?: number;
}

interface NavItem {
  id: NavigationPage;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  currentPage,
  onNavigate,
  reviewQueueCount = 0,
}) => {
  const getNavItems = (): NavItem[] => {
    switch (role) {
      case 'Administrator':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'Complaints', icon: FileText },
          { id: 'review_queue', label: 'Review Queue', icon: ClipboardList, badge: reviewQueueCount },
          { id: 'chat_logs', label: 'Chat Logs', icon: MessageSquare },
          { id: 'documents', label: 'Documents & KB', icon: BookOpen },
          { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
          { id: 'settings', label: 'Settings', icon: Settings },
        ];
      case 'Manager':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'Complaints', icon: FileText },
          { id: 'review_queue', label: 'Review Queue', icon: ClipboardList, badge: reviewQueueCount },
          { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
        ];
      case 'Reviewer':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'Complaints', icon: FileText },
          { id: 'review_queue', label: 'Review Queue', icon: ClipboardList, badge: reviewQueueCount },
          { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
        ];
      case 'Agent':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'complaints', label: 'Complaints', icon: FileText },
          { id: 'documents', label: 'Documents & KB', icon: BookOpen },
          { id: 'reports', label: 'Analytics & Reports', icon: BarChart3 },
        ];
      case 'Customer':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'submit_complaint', label: 'Submit Complaint', icon: PlusCircle },
          { id: 'my_complaints', label: 'My Complaints', icon: FolderOpen },
          { id: 'documents', label: 'Documents & KB', icon: BookOpen },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  return (
    <aside
      className="w-full md:w-64 shrink-0 md:min-h-[calc(100vh-4rem)] flex md:flex-col justify-between py-2 md:py-6 border-b md:border-b-0 md:border-r"
      style={{ backgroundColor: 'var(--sn-sidebar)', borderColor: 'var(--sn-border)' }}
    >
      <div className="px-3 w-full min-w-0">
        <div className="px-3 pb-3 mb-2 border-b" style={{ borderColor: 'var(--sn-border)' }}>
          <div className="text-[11px] font-bold uppercase tracking-wider sn-text-muted">Navigation</div>
        </div>

        <nav className="flex md:block gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`sn-nav-item shrink-0 md:w-full justify-between ${isActive ? 'active' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${item.id === 'review_queue' ? 'review-queue-badge' : ''}`}
                    style={{
                      backgroundColor: isActive ? 'var(--sn-primary)' : 'var(--sn-primary-soft)',
                      color: '#111111',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="hidden md:block px-4 pt-4 border-t" style={{ borderColor: 'var(--sn-border)' }}>
        <div
          className="rounded-lg p-3 text-xs border"
          style={{ backgroundColor: 'var(--sn-bg-muted)', borderColor: 'var(--sn-border)' }}
        >
          <div className="sn-text font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Ground-Truth Active</span>
          </div>
          <p className="text-[11px] sn-text-muted mt-1 leading-relaxed">
            Deterministic rule validation running independently from GenAI.
          </p>
        </div>
      </div>
    </aside>
  );
};
