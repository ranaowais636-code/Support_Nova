/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { api, getStoredToken } from './api';
import { Header } from './components/Header';
import { Sidebar, NavigationPage } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { LandingPage } from './components/LandingPage';
import { DashboardView } from './components/DashboardView';
import { ComplaintsView } from './components/ComplaintsView';
import { SubmitComplaintView } from './components/SubmitComplaintView';
import { MyComplaintsView } from './components/MyComplaintsView';
import { ComplaintDetailView } from './components/ComplaintDetailView';
import { ReviewQueueView } from './components/ReviewQueueView';
import { DocumentsView } from './components/DocumentsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { ChatbotWidget } from './components/ChatbotWidget';
import { ChatLogsView } from './components/ChatLogsView';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [reviewQueueCount, setReviewQueueCount] = useState<number>(0);

  const allowedPagesByRole: Record<UserRole, NavigationPage[]> = {
    Administrator: ['dashboard', 'complaints', 'review_queue', 'chat_logs', 'documents', 'reports', 'settings'],
    Manager: ['dashboard', 'complaints', 'review_queue', 'reports'],
    Reviewer: ['dashboard', 'complaints', 'review_queue', 'reports'],
    Agent: ['dashboard', 'complaints', 'documents', 'reports'],
    Customer: ['dashboard', 'submit_complaint', 'my_complaints', 'documents'],
  };

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser && ['Administrator', 'Manager', 'Reviewer'].includes(currentUser.role)) {
      loadReviewQueueCount();
    }
  }, [currentUser, currentPage]);

  const checkAuth = async () => {
    const token = getStoredToken();
    if (!token) {
      setAuthChecking(false);
      return;
    }
    try {
      const user = await api.getMe();
      setCurrentUser(user);
    } catch {
      api.logout();
      setCurrentUser(null);
    } finally {
      setAuthChecking(false);
    }
  };

  const loadReviewQueueCount = async () => {
    try {
      const items = await api.getReviewQueue();
      setReviewQueueCount(items.length);
    } catch {
      // ignored
    }
  };

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setShowLogin(false);
    setCurrentPage('dashboard');
    setSelectedComplaintId(null);
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
    setShowLogin(false);
    setCurrentPage('dashboard');
    setSelectedComplaintId(null);
  };

  const navigateTo = (page: NavigationPage) => {
    setSelectedComplaintId(null);
    if (currentUser && !allowedPagesByRole[currentUser.role]?.includes(page)) {
      console.warn(`Unauthorized route attempt: ${page} by role ${currentUser.role}`);
      return;
    }
    setCurrentPage(page);
  };

  const handleSelectComplaint = (id: string) => {
    setSelectedComplaintId(id);
  };

  const handleBackFromDetail = () => {
    setSelectedComplaintId(null);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen sn-bg flex items-center justify-center sn-text-muted text-sm sn-font">
        Verifying SupportNova session…
      </div>
    );
  }

  // Unauthenticated: Landing → Login
  if (!currentUser) {
    if (showLogin) {
      return (
        <div className="sn-font">
          <LoginPage
            onLoginSuccess={handleLoginSuccess}
            onBack={() => setShowLogin(false)}
          />
        </div>
      );
    }
    return <LandingPage onLoginClick={() => setShowLogin(true)} />;
  }

  const isPageAuthorized = allowedPagesByRole[currentUser.role]?.includes(currentPage);

  return (
    <div className="sn-role-shell min-h-screen sn-bg flex flex-col sn-font sn-text">
      <Header user={currentUser} onLogout={handleLogout} />

      <div className="flex-1 flex flex-col md:flex-row max-w-[1400px] w-full mx-auto min-w-0">
        <Sidebar
          role={currentUser.role}
          currentPage={currentPage}
          onNavigate={navigateTo}
          reviewQueueCount={reviewQueueCount}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 overflow-y-auto">
          {selectedComplaintId ? (
            <ComplaintDetailView
              complaintId={selectedComplaintId}
              user={currentUser}
              onBack={handleBackFromDetail}
            />
          ) : !isPageAuthorized ? (
            <div className="sn-card p-12 text-center max-w-xl mx-auto space-y-4">
              <ShieldAlert className="w-12 h-12 mx-auto" style={{ color: 'var(--sn-danger)' }} />
              <h2 className="text-lg font-bold sn-text">403 — Access Forbidden</h2>
              <p className="text-sm sn-text-secondary leading-relaxed">
                Your account role <strong className="sn-text">({currentUser.role})</strong> does not
                have permission to access the requested module.
              </p>
              <button onClick={() => setCurrentPage('dashboard')} className="sn-btn sn-btn-primary">
                <ArrowLeft className="w-4 h-4" />
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {currentPage === 'dashboard' && (
                <DashboardView
                  user={currentUser}
                  onSelectComplaint={handleSelectComplaint}
                  onNavigate={navigateTo}
                />
              )}
              {currentPage === 'complaints' && (
                <ComplaintsView user={currentUser} onSelectComplaint={handleSelectComplaint} />
              )}
              {currentPage === 'submit_complaint' && (
                <SubmitComplaintView
                  user={currentUser}
                  onSuccess={(newId) => handleSelectComplaint(newId)}
                />
              )}
              {currentPage === 'my_complaints' && (
                <MyComplaintsView
                  user={currentUser}
                  onSelectComplaint={handleSelectComplaint}
                  onNavigateSubmit={() => navigateTo('submit_complaint')}
                />
              )}
              {currentPage === 'review_queue' && (
                <ReviewQueueView user={currentUser} onSelectComplaint={handleSelectComplaint} />
              )}
              {currentPage === 'documents' && <DocumentsView user={currentUser} />}
              {currentPage === 'reports' && <ReportsView user={currentUser} />}
              {currentPage === 'settings' && <SettingsView user={currentUser} />}
              {currentPage === 'chat_logs' && <ChatLogsView user={currentUser} />}
            </>
          )}
        </main>
      </div>

      {/* Full chatbot only for Customer role — session-aware, no login loop */}
      {currentUser.role === 'Customer' && (
        <ChatbotWidget
          onRequestLogin={() => {}}
          isCustomerPanel
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
