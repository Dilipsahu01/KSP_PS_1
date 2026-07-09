'use client';

import { X, ShieldCheck, AlertTriangle, CheckCircle2, Code, Lock, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import type { XAIPayload } from '../app/page';

interface XAIPanelProps {
  payload: XAIPayload;
  query: string;
  onClose: () => void;
}

// ============================================================================
// XAI SLIDE-OUT PANEL
// ============================================================================
export default function XAIPanel({ payload, query, onClose }: XAIPanelProps) {
  const { explainability, security_context, intent_routed, processing_time_ms } = payload;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[440px] max-w-[90vw] z-50 bg-[#0f1629] border-l border-white/[0.06] shadow-2xl shadow-black/50 slide-in-right overflow-y-auto"
        id="xai-panel"
      >
        {/* ─── Header ─── */}
        <div className="sticky top-0 z-10 bg-[#0f1629]/95 backdrop-blur-md border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100">Reasoning & Evidence</h2>
                <p className="text-[10px] text-slate-500">Explainable AI Transparency Panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-white/[0.04] flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/[0.08] transition-all"
              aria-label="Close XAI Panel"
              id="close-xai-btn"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* ─── User Query ─── */}
          <Section title="Original Query">
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <p className="text-sm text-slate-300 italic">"{query}"</p>
            </div>
          </Section>

          {/* ─── Security Context ─── */}
          <Section title="Security Context">
            <div className="space-y-2">
              <SecurityRow
                icon={<Lock className="w-3.5 h-3.5" />}
                label="Role"
                value={security_context.user_role}
                type="info"
              />
              {security_context.applied_filters.map((filter, i) => (
                <SecurityRow
                  key={i}
                  icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  label="RLS Filter"
                  value={filter}
                  type="success"
                />
              ))}
              {/* Cross-District Warning Detection */}
              {explainability.reasoning_path.some(r => r.includes('⚠️')) && (
                <SecurityRow
                  icon={<AlertTriangle className="w-3.5 h-3.5" />}
                  label="Warning"
                  value="Cross-district mention detected. Results scoped to authorized jurisdiction."
                  type="warning"
                />
              )}
              <SecurityRow
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                label="Latency"
                value={`${processing_time_ms}ms`}
                type="info"
              />
            </div>
          </Section>

          {/* ─── Reasoning Path (Timeline) ─── */}
          <Section title="Reasoning Path">
            <div className="relative pl-5">
              {/* Vertical line */}
              <div className="absolute left-[7px] top-1 bottom-1 w-[1.5px] bg-gradient-to-b from-cyan-500/30 via-blue-500/20 to-transparent" />

              <div className="space-y-4">
                {explainability.reasoning_path.map((step, i) => {
                  const isWarning = step.includes('⚠️');
                  return (
                    <div key={i} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-5 top-1 w-3 h-3 rounded-full border-2 ${
                        isWarning
                          ? 'bg-amber-500/20 border-amber-500/60'
                          : 'bg-cyan-500/20 border-cyan-500/40'
                      }`} />

                      <div className={`flex-1 p-2.5 rounded-lg text-[12px] leading-relaxed ${
                        isWarning
                          ? 'bg-amber-500/5 border border-amber-500/15 text-amber-300'
                          : 'bg-white/[0.02] border border-white/[0.04] text-slate-400'
                      }`}>
                        <span className="text-[10px] font-semibold text-slate-600 mr-2">STEP {i + 1}</span>
                        {step}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* ─── Execution Details (SQL / Engine) ─── */}
          {explainability.execution_details && (
            <Section title="Execution Details">
              <div className="space-y-3">
                {/* Engine */}
                {explainability.execution_details.engine && (
                  <DetailRow label="Engine" value={explainability.execution_details.engine} />
                )}

                {/* RLS Enforcement Level */}
                {explainability.execution_details.rls_enforcement && (
                  <DetailRow
                    label="RLS Enforcement"
                    value={explainability.execution_details.rls_enforcement}
                    highlight
                  />
                )}

                {/* Scoped District */}
                {explainability.execution_details.scoped_to_district && (
                  <DetailRow
                    label="Scoped District"
                    value={`District ${explainability.execution_details.scoped_to_district}`}
                  />
                )}

                {/* SQL Query (Syntax Highlighted) */}
                {explainability.execution_details.query_executed && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                          Executed SQL
                        </span>
                      </div>
                      <CopyButton text={explainability.execution_details.query_executed} />
                    </div>
                    <SQLBlock sql={explainability.execution_details.query_executed} />
                  </div>
                )}

                {/* Parameters */}
                {explainability.execution_details.parameters && explainability.execution_details.parameters.length > 0 && (
                  <div>
                    <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block mb-2">
                      Bound Parameters
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {explainability.execution_details.parameters.map((param, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 text-[11px] rounded bg-blue-500/10 border border-blue-500/15 text-blue-300 font-mono"
                        >
                          ?{i + 1} = {JSON.stringify(param)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* ─── Citations ─── */}
          {explainability.citations.length > 0 && (
            <Section title="Source Citations">
              <div className="space-y-2">
                {explainability.citations.map((cite, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-[9px] font-bold">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-[11px] text-slate-300">{cite.reference}</p>
                        <p className="text-[10px] text-slate-600">{cite.source_type}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400">
                      {(cite.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.1em] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

function SecurityRow({ icon, label, value, type }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  type: 'success' | 'warning' | 'info';
}) {
  const colors = {
    success: 'bg-emerald-500/8 border-emerald-500/15 text-emerald-400',
    warning: 'bg-amber-500/8 border-amber-500/15 text-amber-400',
    info: 'bg-slate-500/8 border-slate-500/15 text-slate-400',
  };

  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${colors[type]}`}>
      {icon}
      <span className="text-[11px] text-slate-500 font-medium">{label}:</span>
      <span className="text-[11px] font-medium">{value}</span>
    </div>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <span className="text-[11px] text-slate-500">{label}</span>
      <span className={`text-[11px] font-medium ${highlight ? 'text-emerald-400' : 'text-slate-300'}`}>
        {value}
      </span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-0.5 text-[10px] rounded bg-white/[0.04] text-slate-500 hover:text-slate-300 transition-all"
      id="copy-sql-btn"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ============================================================================
// SQL SYNTAX HIGHLIGHTER (Lightweight, no external dependency)
// ============================================================================
function SQLBlock({ sql }: { sql: string }) {
  const highlighted = highlightSQL(sql);

  return (
    <pre className="p-3 rounded-lg bg-[#0d1220] border border-white/[0.04] overflow-x-auto">
      <code
        className="sql-highlight text-[12px]"
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </pre>
  );
}

function highlightSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT', 'RIGHT', 'INNER',
    'ON', 'GROUP BY', 'ORDER BY', 'ASC', 'DESC', 'COUNT', 'SUM', 'AVG', 'MAX', 'MIN',
    'AS', 'BETWEEN', 'IN', 'NOT', 'NULL', 'IS', 'LIKE', 'DISTINCT', 'HAVING',
    'LIMIT', 'OFFSET', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'YEAR', 'MONTH',
  ];

  let result = sql
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight ? parameter placeholders
  result = result.replace(/\?/g, '<span style="color:#f59e0b;font-weight:600">?</span>');

  // Highlight string literals
  result = result.replace(/'([^']*)'/g, '<span style="color:#10b981">\'$1\'</span>');

  // Highlight keywords (case-insensitive, whole-word)
  for (const kw of keywords) {
    const regex = new RegExp(`\\b(${kw})\\b`, 'gi');
    result = result.replace(regex, '<span style="color:#22d3ee;font-weight:600">$1</span>');
  }

  return result;
}
