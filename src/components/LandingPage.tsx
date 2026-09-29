import React, { useEffect } from 'react';
import {
  Zap, Brain, FileCheck, BarChart3, Users, ArrowRight,
  CheckCircle2, Star, MessageSquare, Lock, Layers, GitBranch, Sun, Moon,
  Upload, Bot, ClipboardCheck, Route, MessageCircle, Quote
} from 'lucide-react';
import { useTheme } from '../theme';
import { ChatbotWidget } from './ChatbotWidget';

interface LandingPageProps {
  onLoginClick: () => void;
}

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Multi-Channel Intake',
    desc: 'Seamlessly collect complaints from Web Forms, Emails, Live Chat, and file uploads.',
  },
  {
    icon: Brain,
    title: 'AI Complaint Analysis',
    desc: 'Instant automated parsing of sentiment, urgency, priority, and category via GenAI.',
  },
  {
    icon: FileCheck,
    title: 'Python Ground-Truth Validation',
    desc: 'Independent rule-matrix validation ensuring policy compliance without relying solely on LLMs.',
  },
  {
    icon: Route,
    title: 'Department Routing',
    desc: 'Automatic routing to the correct department based on issue type, urgency, and policy rules.',
  },
  {
    icon: MessageCircle,
    title: 'Automated Responses',
    desc: 'Policy-grounded professional replies, resolution steps, and follow-up communication drafts.',
  },
  {
    icon: Lock,
    title: 'Secure Role-Based Access',
    desc: 'Strict data isolation and dedicated dashboards for Administrators, Managers, Reviewers, Agents, and Customers.',
  },
];

const REVIEWS = [
  {
    name: 'Sarah Khan',
    role: 'Verified Customer',
    quote: "My delivery arrived with a broken item, but SupportNova's automated chat and agent response redelivered a replacement within 48 hours!",
    stars: 5,
    avatar: '/avatars/sarah.jfif',
  },
  {
    name: 'Ali Ahmed',
    role: 'Verified Customer',
    quote: 'Tracking my delayed order and getting a swift refund was effortless through the My Complaints portal. Highly professional platform!',
    stars: 5,
    avatar: './avatars/ali.avif',
  },
  {
    name: 'TechCorp Support Lead',
    role: 'Enterprise Support Lead',
    quote: 'The admin oversight and intelligent complaint routing have reduced our resolution times by over 60%.',
    stars: 5,
    avatar: '/avatars/techcorp support.avif',
  },
];

const WORKFLOW = [
  { step: '01', title: 'Complaint Input', desc: 'Customer submits via form or chatbot with optional voice and image evidence.', icon: Upload },
  { step: '02', title: 'Submission & Validation', desc: 'Input is sanitized, structured, and protected against prompt injection.', icon: ClipboardCheck },
  { step: '03', title: 'GenAI Analysis', desc: 'Sentiment, urgency, entities, and response drafts are generated as structured JSON.', icon: Bot },
  { step: '04', title: 'Python Ground-Truth', desc: 'Independent rule matrix validates departments, urgency, and policy eligibility.', icon: FileCheck },
  { step: '05', title: 'Verification Decision', desc: 'GenAI output is compared to rules — verified or sent to manual review.', icon: CheckCircle2 },
  { step: '06', title: 'Resolution & Dashboard', desc: 'Agents act, customers track status, and admins monitor SLA and trends.', icon: BarChart3 },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick }) => {
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible');
        });
      },
      { threshold: 0.12 }
    );
    // Observe every reveal element, including cards inside Features, Workflow,
    // and Reviews. Previously only the three section elements were observed,
    // while the cards themselves stayed at opacity: 0 forever.
    const revealElements = document.querySelectorAll<HTMLElement>('.sn-reveal');
    revealElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, []);


  return (
    <div className="min-h-screen sn-bg sn-font">
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b sn-border"
        style={{ backgroundColor: 'var(--sn-header)', borderColor: 'var(--sn-border)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
            >
              <img src={theme === 'dark' ? '/logo%20white.png' : '/logo.png'} alt="SupportNova logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <div className="text-base font-bold sn-text leading-tight">SupportNova</div>
              <div className="text-[10px] font-semibold uppercase tracking-wider sn-text-muted">
                Complaint Resolution Intelligence
              </div>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium sn-text-secondary">
            <a href="#features" className="hover:sn-text transition-colors">Features</a>
            <a href="#workflow" className="hover:sn-text transition-colors">Workflow</a>
            <a href="#reviews" className="hover:sn-text transition-colors">Clients</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="sn-btn sn-btn-ghost p-2"
              aria-label="Toggle theme"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button onClick={onLoginClick} className="sn-btn sn-btn-primary">
              Login
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="sn-hero-canvas relative">
        <div className="sn-hero-grid" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <div className="sn-animate-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6"
            style={{ backgroundColor: 'var(--sn-primary-soft)', color: theme === 'dark' ? 'var(--sn-primary)' : '#111111' }}>
            <Zap className="w-3.5 h-3.5" />
            Dual-Pipeline · Policy-Grounded · Enterprise RBAC
          </div>

          <h1 className="sn-animate-fade-up sn-delay-100 text-4xl sm:text-5xl lg:text-6xl font-bold sn-text tracking-tight max-w-4xl mx-auto leading-[1.1]">
            Intelligent Complaint Resolution,{' '}
            <span style={{ color: 'var(--sn-primary)' }}>Verified</span>
          </h1>

          <p className="sn-animate-fade-up sn-delay-200 mt-6 text-lg sn-text-secondary max-w-2xl mx-auto leading-relaxed">
            SupportNova combines generative AI analysis with an independent Python validation engine.
            Every recommendation is policy-aligned, auditable, and role-controlled.
          </p>

          <div className="sn-animate-fade-up sn-delay-300 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button onClick={onLoginClick} className="sn-btn sn-btn-primary text-base px-8 py-3">
              Access Platform
              <ArrowRight className="w-5 h-5" />
            </button>
            <a href="#workflow" className="sn-btn sn-btn-ghost text-base px-8 py-3">
              See How It Works
            </a>
          </div>

          {/* Floating 3D-style cards */}
          <div className="sn-animate-fade-up sn-delay-400 mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { label: 'Rule Matrix', value: '136 Rules', icon: Layers },
              { label: 'Escalation Paths', value: '265+ Conditions', icon: GitBranch },
              { label: 'Verification', value: 'Dual Pipeline', icon: CheckCircle2 },
            ].map((stat) => (
              <div key={stat.label} className="sn-card p-5 text-left">
                <stat.icon className="w-5 h-5 mb-2" style={{ color: 'var(--sn-primary)' }} />
                <div className="text-xl font-bold sn-text">{stat.value}</div>
                <div className="text-xs sn-text-muted mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 sn-reveal">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--sn-primary)' }}>
              Capabilities
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold sn-text">Platform Features</h2>
            <p className="mt-3 sn-text-secondary max-w-2xl mx-auto text-sm sm:text-base">
              Core capabilities tailored for customer support agents and administrators.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className="sn-card sn-feature-card group p-6 sm:p-7 sn-reveal flex flex-col h-full hover:-translate-y-1"
                style={{ transitionDelay: `${i * 70}ms` }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 shrink-0 transition-transform duration-200 group-hover:scale-105"
                  style={{ backgroundColor: 'var(--sn-primary-soft)' }}
                >
                  <f.icon className="w-6 h-6" style={{ color: theme === 'dark' ? 'var(--sn-primary)' : '#111111' }} />
                </div>
                <h3 className="text-base sm:text-lg font-bold sn-text mb-2 leading-snug">{f.title}</h3>
                <p className="text-sm sn-text-secondary leading-relaxed flex-1">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section id="workflow" className="py-20 sm:py-24 sn-bg-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 sn-reveal">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--sn-primary)' }}>
              Dual Pipeline
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold sn-text">How SupportNova Works</h2>
            <p className="mt-3 sn-text-secondary max-w-2xl mx-auto text-sm sm:text-base">
              From customer intake through GenAI analysis and independent Python validation to final resolution.
            </p>
          </div>

          {/* Responsive workflow: never more than three cards per row on laptop/desktop. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {WORKFLOW.map((w, i) => (
              <div
                key={w.step}
                className="sn-card sn-workflow-card p-5 sm:p-6 sn-reveal flex flex-col hover:-translate-y-1"
                style={{ transitionDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ backgroundColor: 'var(--sn-primary-soft)', borderColor: 'color-mix(in srgb, var(--sn-primary) 35%, var(--sn-border))', color: theme === 'dark' ? 'var(--sn-primary)' : '#111111' }}
                  >
                    <w.icon className="w-5 h-5" />
                  </div>
                  <span className="sn-step-pill">STEP {w.step}</span>
                </div>
                <div className="text-base font-bold sn-text mb-2 leading-snug">{w.title}</div>
                <div className="text-sm sn-text-muted leading-relaxed flex-1">{w.desc}</div>
                <div className="mt-5 pt-4 border-t flex items-center gap-2 text-[11px] font-semibold sn-text-muted" style={{ borderColor: 'var(--sn-border)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 'var(--sn-primary)' }} />
                  Verified workflow stage
                </div>
              </div>
            ))}
          </div>

          {/* Compact mobile connector */}
          <div className="mt-5 sm:hidden text-center text-xs sn-text-muted">
            6 stages · dual-pipeline validation · auditable resolution
          </div>

        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-20 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16 sn-reveal">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--sn-primary)' }}>
              Testimonials
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold sn-text">Happy Clients & Reviews</h2>
            <p className="mt-3 sn-text-secondary max-w-2xl mx-auto text-sm sm:text-base">
              Real feedback highlighting swift resolutions and customer satisfaction.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
            {REVIEWS.map((r, i) => (
              <div
                key={r.name}
                className="sn-card sn-review-card group p-6 sm:p-7 sn-reveal flex flex-col h-full hover:-translate-y-1 relative overflow-hidden"
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                <Quote
                  className="absolute top-4 right-4 w-10 h-10 opacity-[0.08] pointer-events-none"
                  style={{ color: '#D0E073' }}
                />
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: r.stars }).map((_, j) => (
                    <Star key={j} className="w-4 h-4 fill-current" style={{ color: '#D0E073' }} />
                  ))}
                </div>
                <p className="text-sm sn-text-secondary leading-relaxed mb-6 flex-1 relative z-10">
                  &ldquo;{r.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-4 border-t" style={{ borderColor: 'var(--sn-border)' }}>
                  <div className="sn-review-avatar shrink-0" aria-hidden="true">
                    <img src={r.avatar} alt="" loading="lazy" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold sn-text truncate">{r.name}</div>
                    <div className="text-xs sn-text-muted truncate">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ backgroundColor: 'var(--sn-primary-soft)' }}>
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: theme === 'dark' ? 'var(--sn-primary)' : '#111111' }}>
            Ready to modernize complaint resolution?
          </h2>
          <p className="mt-3 text-sm" style={{ color: theme === 'dark' ? 'var(--sn-text-secondary)' : '#4A4A42' }}>
            Log in to your role-based workspace or explore the platform with a demo account.
          </p>
          <button onClick={onLoginClick} className="sn-btn sn-btn-primary mt-8 text-base px-8 py-3">
            Login to SupportNova
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t sn-border py-12" style={{ borderColor: 'var(--sn-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center"
              >
                <img src={theme === 'dark' ? '/logo%20white.png' : '/logo.png'} alt="SupportNova logo" className="w-7 h-7 object-contain" />
              </div>
              <div>
                <div className="text-sm font-bold sn-text">SupportNova</div>
                <div className="text-[10px] sn-text-muted">Complaint Resolution Intelligence</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-xs sn-text-muted">
              <a href="#" className="hover:sn-text">Privacy Policy</a>
              <a href="#" className="hover:sn-text">Terms of Service</a>
              <a href="#" className="hover:sn-text">Security</a>
              <a href="#" className="hover:sn-text">Status</a>
            </div>
            <div className="flex items-center gap-2 text-xs sn-text-muted">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              All systems operational
            </div>
          </div>
          <div className="mt-8 pt-6 border-t text-xs sn-text-muted text-center" style={{ borderColor: 'var(--sn-border)' }}>
            © {new Date().getFullYear()} SupportNova. All rights reserved.
          </div>
        </div>
      </footer>

      <ChatbotWidget onRequestLogin={onLoginClick} currentUser={null} />
    </div>
  );
};
