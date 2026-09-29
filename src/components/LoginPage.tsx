import React, { useState } from 'react';
import { User } from '../types';
import { api } from '../api';
import {
  Lock, Mail, User as UserIcon, AlertCircle, ArrowRight, ArrowLeft, Sun, Moon
} from 'lucide-react';
import { useTheme } from '../theme';

interface LoginPageProps {
  onLoginSuccess: (user: User) => void;
  onBack?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, onBack }) => {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupType, setSignupType] = useState<'Regular' | 'VIP'>('Regular');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.login({ email, password });
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await api.signup({
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        customer_type: signupType,
      });
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again with valid information.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen sn-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8 sn-font">
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        {onBack ? (
          <button onClick={onBack} className="sn-btn sn-btn-ghost text-sm">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
        ) : (
          <div />
        )}
        <button onClick={toggleTheme} className="sn-btn sn-btn-ghost p-2" aria-label="Toggle theme">
          {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-4xl">
        <div className="sn-card overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px]">
          {/* Left brand panel */}
          <div
            className="md:col-span-5 p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden"
            style={{ backgroundColor: theme === 'dark' ? '#0A0A08' : '#11110F' }}
          >
            <div
              className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 rounded-full blur-2xl pointer-events-none"
              style={{ backgroundColor: 'rgba(198,255,0,0.12)' }}
            />
            <div
              className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
              style={{ backgroundColor: 'rgba(198,255,0,0.08)' }}
            />

            <div className="relative z-10">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md mb-6"
              >
                <img src="/logo%20white.png" alt="SupportNova logo" className="w-12 h-12 object-contain" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">SupportNova</h1>
              <p className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: 'var(--sn-primary)' }}>
                Complaint Resolution Intelligence
              </p>

              <div className="mt-8 space-y-4 text-sm text-gray-300 leading-relaxed">
                <p>
                  Enterprise-grade customer complaint triage combining dual-pipeline Generative AI
                  analysis with independent, deterministic Python ground-truth verification.
                </p>
                <ul className="space-y-2 text-xs text-gray-400">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--sn-primary)' }} />
                    136-rule deterministic matrix
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--sn-primary)' }} />
                    Prompt-injection hardened intake
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--sn-primary)' }} />
                    Full audit trail & SLA tracking
                  </li>
                </ul>
              </div>
            </div>

            <div className="relative z-10 mt-8 text-[11px] text-gray-500">
              Secure role-based access · Customer · Agent · Reviewer · Manager · Admin
            </div>
          </div>

          {/* Right form panel */}
          <div className="md:col-span-7 p-8 sm:p-10 flex flex-col justify-center sn-bg-elevated">
            <div className="flex gap-1 p-1 rounded-lg mb-8 sn-bg-muted w-fit">
              <button
                onClick={() => { setActiveTab('signin'); setError(null); }}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'signin' ? 'sn-primary-bg' : 'sn-text-secondary'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setActiveTab('signup'); setError(null); }}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
                  activeTab === 'signup' ? 'sn-primary-bg' : 'sn-text-secondary'
                }`}
              >
                Customer Sign Up
              </button>
            </div>

            {error && (
              <div
                className="mb-5 flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--sn-danger) 10%, transparent)',
                  color: 'var(--sn-danger)',
                }}
              >
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {activeTab === 'signin' ? (
              <form onSubmit={handleSignIn} className="space-y-5 sn-login-form">
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sn-text-muted" />
                    <input
                      type="email"
                      required
                      className="sn-input pl-10"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sn-text-muted" />
                    <input
                      type="password"
                      required
                      className="sn-input pl-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="sn-btn sn-btn-primary w-full py-3">
                  {loading ? 'Signing in…' : 'Sign In'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="space-y-4 sn-login-form">
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sn-text-muted" />
                    <input
                      type="text"
                      required
                      className="sn-input pl-10"
                      placeholder="Jane Doe"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sn-text-muted" />
                    <input
                      type="email"
                      required
                      className="sn-input pl-10"
                      placeholder="you@email.com"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 sn-text-muted" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="sn-input pl-10"
                      placeholder="Min. 6 characters"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold sn-text-secondary mb-1.5">Customer Type</label>
                  <select
                    className="sn-input"
                    value={signupType}
                    onChange={(e) => setSignupType(e.target.value as 'Regular' | 'VIP')}
                  >
                    <option value="Regular">Regular</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>
                <button type="submit" disabled={loading} className="sn-btn sn-btn-primary w-full py-3">
                  {loading ? 'Creating account…' : 'Create Customer Account'}
                  {!loading && <ArrowRight className="w-4 h-4" />}
                </button>
              </form>
            )}

            <p className="mt-6 text-[11px] sn-text-muted text-center leading-relaxed">
              Demo accounts are pre-seeded. Contact your administrator for staff credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
