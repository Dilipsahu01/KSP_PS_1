'use client';

import { FileText, BarChart3, Network, ShieldCheck, Clock, Eye } from 'lucide-react';
import type { XAIPayload } from '../app/page';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface ResultsViewProps {
  payload: XAIPayload;
  onOpenXAI: () => void;
}

// MAIN RESULTS VIEW — Switches layout based on visualization_type
export default function ResultsView({ payload, onOpenXAI }: ResultsViewProps) {
  const { response, explainability, security_context, processing_time_ms, intent_routed } = payload;

  return (
    <div className="space-y-5">
      {/* ─── RESPONSE HEADER BAR ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IntentBadge intent={intent_routed} />
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Clock className="w-3 h-3" />
            <span>{processing_time_ms}ms</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-500/80">
            <ShieldCheck className="w-3 h-3" />
            <span>{security_context.applied_filters[0]}</span>
          </div>
        </div>

        <button
          onClick={onOpenXAI}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium rounded-lg bg-cyan-500/8 border border-cyan-500/15 text-cyan-400 hover:bg-cyan-500/15 transition-all"
          id="open-xai-panel-btn"
        >
          <Eye className="w-3.5 h-3.5" />
          View Reasoning & Evidence
        </button>
      </div>

      {/* ─── DYNAMIC CONTENT RENDERER ─── */}
      {(response.visualization_type === 'METRIC_CARD' || intent_routed === 'TEXT_TO_SQL') && (
        <SQLResultsView payload={payload} />
      )}

      {(response.visualization_type === 'INVESTIGATIVE' || intent_routed === 'RAG') && (
        <RAGResultsView payload={payload} />
      )}

      {(response.visualization_type === 'NETWORK' || intent_routed === 'GRAPH') && (
        <GraphResultsView payload={payload} />
      )}
    </div>
  );
}

// SQL / ANALYTICAL VIEW — KPI Cards + Bar Chart
function SQLResultsView({ payload }: { payload: XAIPayload }) {
  // Mock trend data for chart demonstration
  const chartData = [
    { month: 'Jan', count: 42 }, { month: 'Feb', count: 38 },
    { month: 'Mar', count: 55 }, { month: 'Apr', count: 47 },
    { month: 'May', count: 63 }, { month: 'Jun', count: 51 },
    { month: 'Jul', count: 70 }, { month: 'Aug', count: 58 },
    { month: 'Sep', count: 45 }, { month: 'Oct', count: 52 },
    { month: 'Nov', count: 61 }, { month: 'Dec', count: 48 },
  ];

  const barColors = [
    '#22d3ee', '#3b82f6', '#22d3ee', '#3b82f6',
    '#22d3ee', '#3b82f6', '#22d3ee', '#3b82f6',
    '#22d3ee', '#3b82f6', '#22d3ee', '#3b82f6',
  ];

  return (
    <div className="space-y-5 fade-up">
      {/* NLP Answer */}
      <div className="p-4 rounded-xl bg-[#1a1f35]/60 border border-white/[0.06]">
        <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
          {payload.response.nlp_answer}
        </p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-3 gap-4">
        <KPICard label="Total Records" value="142" delta="+12% YoY" deltaType="positive" />
        <KPICard label="Clearance Rate" value="68.4%" delta="-2.1% QoQ" deltaType="negative" />
        <KPICard label="Avg Response" value="4.2 hrs" delta="Stable" deltaType="neutral" />
      </div>

      {/* Bar Chart */}
      <div className="rounded-xl bg-[#1a1f35]/60 border border-white/[0.06] p-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">
          Monthly Trend — District 12
        </h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1e2642',
                border: '1px solid rgba(148,163,184,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#f1f5f9',
              }}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={32}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// RAG / INVESTIGATIVE VIEW — Narrative + Citations
function RAGResultsView({ payload }: { payload: XAIPayload }) {
  return (
    <div className="grid grid-cols-5 gap-5 fade-up">
      {/* Left: NLP Summary (60%) */}
      <div className="col-span-3 rounded-xl bg-[#1a1f35]/60 border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Case Narrative Summary
          </h3>
        </div>
        <div className="prose prose-invert prose-sm max-w-none">
          <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
            {payload.response.nlp_answer}
          </p>
        </div>
      </div>

      {/* Right: Source Citations (40%) */}
      <div className="col-span-2 rounded-xl bg-[#1a1f35]/60 border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Source Evidence
          </h3>
        </div>

        <div className="space-y-3">
          {payload.explainability.citations.length > 0 ? (
            payload.explainability.citations.map((citation, i) => (
              <div
                key={i}
                className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:border-cyan-500/20 transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-5 h-5 rounded bg-cyan-500/10 text-cyan-400 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="text-[11px] font-medium text-slate-300">
                    {citation.source_type}
                  </span>
                  <span className="ml-auto text-[10px] text-emerald-400">
                    {(citation.confidence_score * 100).toFixed(0)}% match
                  </span>
                </div>
                <p className="text-[12px] text-slate-500 leading-relaxed">
                  {citation.reference}
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-600">No citations available for this response.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// GRAPH / NETWORK VIEW — Placeholder for Cytoscape
function GraphResultsView({ payload }: { payload: XAIPayload }) {
  return (
    <div className="fade-up">
      <div className="rounded-xl bg-[#1a1f35]/60 border border-white/[0.06] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Criminal Network Graph
          </h3>
        </div>
        <p className="text-sm text-slate-300 mb-4">{payload.response.nlp_answer}</p>

        {/* Placeholder network visualization */}
        <div className="relative h-[350px] rounded-lg bg-[#0d1220] border border-white/[0.04] flex items-center justify-center overflow-hidden">
          {/* Mock network nodes */}
          <svg width="400" height="300" viewBox="0 0 400 300">
            {/* Edges */}
            <line x1="200" y1="100" x2="100" y2="200" stroke="rgba(34,211,238,0.2)" strokeWidth="1.5" />
            <line x1="200" y1="100" x2="300" y2="200" stroke="rgba(34,211,238,0.2)" strokeWidth="1.5" />
            <line x1="100" y1="200" x2="200" y2="250" stroke="rgba(167,139,250,0.2)" strokeWidth="1.5" />
            <line x1="300" y1="200" x2="200" y2="250" stroke="rgba(167,139,250,0.2)" strokeWidth="1.5" />
            <line x1="200" y1="100" x2="200" y2="250" stroke="rgba(239,68,68,0.15)" strokeWidth="1" strokeDasharray="4 4" />

            {/* Nodes */}
            <circle cx="200" cy="100" r="18" fill="rgba(34,211,238,0.15)" stroke="rgba(34,211,238,0.5)" strokeWidth="1.5" />
            <text x="200" y="104" textAnchor="middle" fill="#22d3ee" fontSize="9" fontWeight="600">CASE</text>

            <circle cx="100" cy="200" r="16" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
            <text x="100" y="204" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="600">ACC-1</text>

            <circle cx="300" cy="200" r="16" fill="rgba(239,68,68,0.12)" stroke="rgba(239,68,68,0.4)" strokeWidth="1.5" />
            <text x="300" y="204" textAnchor="middle" fill="#ef4444" fontSize="8" fontWeight="600">ACC-2</text>

            <circle cx="200" cy="250" r="14" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.4)" strokeWidth="1.5" />
            <text x="200" y="254" textAnchor="middle" fill="#10b981" fontSize="8" fontWeight="600">VIC</text>
          </svg>

          <p className="absolute bottom-3 text-[10px] text-slate-600">
            Integrate react-cytoscapejs for interactive graph in production
          </p>
        </div>
      </div>
    </div>
  );
}

// KPI CARD
function KPICard({ label, value, delta, deltaType }: {
  label: string;
  value: string;
  delta: string;
  deltaType: 'positive' | 'negative' | 'neutral';
}) {
  const deltaColor = deltaType === 'positive' ? 'text-emerald-400' :
                     deltaType === 'negative' ? 'text-red-400' : 'text-slate-500';

  return (
    <div className="rounded-xl bg-[#1a1f35]/60 border border-white/[0.06] p-4 hover:border-cyan-500/10 transition-all">
      <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-100 mb-1">{value}</p>
      <p className={`text-[11px] font-medium ${deltaColor}`}>{delta}</p>
    </div>
  );
}

// INTENT BADGE
function IntentBadge({ intent }: { intent: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
    TEXT_TO_SQL: {
      icon: <BarChart3 className="w-3 h-3" />,
      label: 'Analytical',
      color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    },
    RAG: {
      icon: <FileText className="w-3 h-3" />,
      label: 'Investigative',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    },
    GRAPH: {
      icon: <Network className="w-3 h-3" />,
      label: 'Network',
      color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    },
  };

  const c = config[intent] || config.RAG;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
}
