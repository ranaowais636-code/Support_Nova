import React from 'react';
import { User } from '../types';
import { LogOut, User as UserIcon, Sun, Moon } from 'lucide-react';
import { useTheme } from '../theme';

interface HeaderProps {
  user: User;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="sticky top-0 z-30 border-b"
      style={{ backgroundColor: 'var(--sn-header)', borderColor: 'var(--sn-border)' }}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
          >
            <img src={theme === 'dark' ? '/logo%20white.png' : '/logo.png'} alt="SupportNova logo" className="w-8 h-8 object-contain" />
          </div>
          <div>
            <div className="text-base font-bold sn-text leading-tight">SupportNova</div>
            <p className="hidden sm:block text-[10px] font-semibold uppercase tracking-wider sn-text-muted">
              Complaint Resolution Intelligence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={toggleTheme} className="sn-btn sn-btn-ghost p-2" aria-label="Toggle theme">
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          <div className="hidden sm:flex items-center gap-3 border-r pr-4" style={{ borderColor: 'var(--sn-border)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center border"
              style={{ backgroundColor: 'var(--sn-bg-muted)', borderColor: 'var(--sn-border)' }}
            >
              <UserIcon className="w-4 h-4 sn-text-muted" />
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold sn-text leading-tight">{user.name}</div>
              <div className="text-[11px] sn-text-muted flex items-center gap-1.5 mt-0.5">
                <span>{user.email}</span>
                <span
                  className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--sn-primary-soft)', color: theme === 'dark' ? 'var(--sn-primary)' : '#111111' }}
                >
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <button onClick={onLogout} className="sn-btn sn-btn-ghost text-sm">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
