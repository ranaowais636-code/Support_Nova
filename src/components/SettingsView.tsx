import React, { useState, useEffect } from 'react';
import { User, RuleMatrixItem } from '../types';
import { api } from '../api';
import { Settings as SettingsIcon, ShieldCheck, Database, Cpu, Terminal, Sliders, ChevronDown, ChevronUp } from 'lucide-react';

interface SettingsViewProps {
  user: User;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ user }) => {
  const [settings, setSettings] = useState<any>(null);
  const [rules, setRules] = useState<RuleMatrixItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [sData, rData] = await Promise.all([api.getSettings(), api.getRules()]);
      setSettings(sData);
      setRules(rData);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="p-16 text-center text-xs text-[#79819A]">
        Loading system configuration & ground-truth parameters...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-2 border-b border-[#E2DCF0]">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-5 h-5 text-[#6C4AB6]" />
          <h1 className="text-2xl font-bold tracking-tight text-[#171A3A]">System Settings & Rule Matrix</h1>
        </div>
        <p className="text-xs text-[#555E7A] mt-1">
          Administrator configuration, SLA commitment policies, and ground-truth complaint resolution matrix.
        </p>
      </div>

      {/* System Infrastructure Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="bg-white rounded-xl p-4 border border-[#E2DCF0] shadow-xs space-y-2">
          <div className="flex items-center space-x-2 text-[#171A3A] font-bold">
            <Cpu className="w-4 h-4 text-[#6C4AB6]" />
            <span>Generative AI Engine</span>
          </div>
          <div className="space-y-1 text-[#555E7A]">
            <div>Model: <strong className="text-[#171A3A] font-mono">{settings.gemini_model}</strong></div>
            <div>Prompt Template: <strong className="text-[#171A3A] font-mono">{settings.prompt_version}</strong></div>
            <div>Output Mode: <strong className="text-[#171A3A]">Strict JSON Schema</strong></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E2DCF0] shadow-xs space-y-2">
          <div className="flex items-center space-x-2 text-[#171A3A] font-bold">
            <Terminal className="w-4 h-4 text-[#6C4AB6]" />
            <span>Python Ground-Truth Engine</span>
          </div>
          <div className="space-y-1 text-[#555E7A]">
            <div>Status: <strong className="text-emerald-600 font-bold">Active & Independent</strong></div>
            <div>Matrix Rules: <strong className="text-[#171A3A]">{rules.length} configured rules</strong></div>
            <div>Enforcement: <strong className="text-[#171A3A]">Deterministic Python Pipeline</strong></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-[#E2DCF0] shadow-xs space-y-2">
          <div className="flex items-center space-x-2 text-[#171A3A] font-bold">
            <Database className="w-4 h-4 text-[#6C4AB6]" />
            <span>Data & Isolation Tier</span>
          </div>
          <div className="space-y-1 text-[#555E7A]">
            <div>Database: <strong className="text-[#171A3A]">{settings.database}</strong></div>
            <div>Security: <strong className="text-[#171A3A]">PBKDF2 Salted Password Hashes</strong></div>
            <div>Isolation: <strong className="text-[#171A3A]">Strict Customer-Level Segregation</strong></div>
          </div>
        </div>
      </div>

      {/* SLA Thresholds Table */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EBF9] flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#171A3A]">
            Service Level Agreement (SLA) Targets
          </h2>
          <span className="text-[10px] text-[#79819A]">Enforced across all complaint priorities</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Priority Tier</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Target Response Time</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Target Resolution Time</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Escalation Trigger Threshold</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBF9]">
              {settings.sla_thresholds?.map((sla: any) => (
                <tr key={sla.priority} className="hover:bg-[#F9F8FC]">
                  <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{sla.priority}</td>
                  <td className="px-4 py-3 text-[#555E7A]">{sla.response_target_hours} Hours</td>
                  <td className="px-4 py-3 text-[#555E7A]">{sla.resolution_target_hours} Hours</td>
                  <td className="px-4 py-3 text-[#79819A]">2 hours prior to deadline breach</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ground-Truth Complaint Resolution Rule Matrix */}
      <div className="bg-white rounded-xl border border-[#E2DCF0] shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-[#F0EBF9] flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#171A3A]">
              Complaint Resolution Rule Matrix (Ground-Truth Source)
            </h2>
            <p className="text-[11px] text-[#79819A] mt-0.5">
              Deterministic rules used by Python Pipeline 2 to verify GenAI output and detect unsupported promises.
            </p>
          </div>
          <span className="text-xs font-bold font-mono text-[#6C4AB6] bg-[#EDE7F6] px-2.5 py-1 rounded">
            {rules.length} Active Rules
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#F4F1FA] text-[#555E7A] border-b border-[#E2DCF0]">
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Rule ID</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Category / Subcategory</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Department</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Urgency & Priority</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Policy ID</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider">Mandatory Escalation</th>
                <th className="px-4 py-3 font-semibold uppercase tracking-wider text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBF9]">
              {rules.map((rule) => {
                const isExpanded = expandedRule === rule.rule_id;
                return (
                  <React.Fragment key={rule.rule_id}>
                    <tr className="hover:bg-[#F9F8FC]">
                      <td className="px-4 py-3 font-mono font-bold text-[#171A3A]">{rule.rule_id}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#171A3A]">{rule.category}</div>
                        <div className="text-[10px] text-[#79819A]">{rule.subcategory}</div>
                      </td>
                      <td className="px-4 py-3 text-[#555E7A]">{rule.department}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-[#F4F1FA] text-[#171A3A] font-semibold border border-[#E2DCF0]">
                          {rule.urgency} ({rule.priority})
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[#6C4AB6]">{rule.policy_id}</td>
                      <td className="px-4 py-3">
                        {rule.mandatory_escalation === 1 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            YES (MANDATORY)
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500">Conditional</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedRule(isExpanded ? null : rule.rule_id)}
                          className="px-2 py-1 text-xs text-[#6C4AB6] hover:bg-[#EDE7F6] rounded border border-[#D3C7EE] transition-colors"
                        >
                          {isExpanded ? 'Hide' : 'Inspect'}
                        </button>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-[#FAF9FD]">
                        <td colSpan={7} className="px-6 py-4 border-b border-[#E2DCF0] space-y-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 bg-white rounded-lg border border-[#E2DCF0]">
                              <span className="font-bold text-emerald-800 block mb-1">Required Actions:</span>
                              <ul className="list-disc list-inside space-y-1 text-[#555E7A]">
                                {rule.required_actions?.map((act, i) => (
                                  <li key={i}>{act}</li>
                                ))}
                              </ul>
                            </div>

                            <div className="p-3 bg-white rounded-lg border border-[#E2DCF0]">
                              <span className="font-bold text-rose-800 block mb-1">Prohibited Actions:</span>
                              <ul className="list-disc list-inside space-y-1 text-[#555E7A]">
                                {rule.prohibited_actions?.map((act, i) => (
                                  <li key={i}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          </div>

                          <div className="text-[11px] text-[#79819A]">
                            Follow-Up Protocol: <strong className="text-[#171A3A]">{rule.follow_up}</strong>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
