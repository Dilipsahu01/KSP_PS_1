'use client';

import { useState, useCallback } from 'react';
import { Shield, Activity, Database, Radio } from 'lucide-react';
import OmniSearch from '../components/OmniSearch';
import ResultsView from '../components/ResultsView';
import XAIPanel from '../components/XAIPanel';

// ============================================================================
// XAI PAYLOAD TYPE (mirrors backend response)
// ============================================================================
export interface XAIPayload {
  query_id: string;
  intent_routed: 'TEXT_TO_SQL' | 'RAG' | 'GRAPH';
  processing_time_ms: number;
  response: {
    nlp_answer: string;
    visualization_type: string;
  };
  explainability: {
    reasoning_path: string[];
    execution_details: {
      engine?: string;
      query_executed?: string;
      parameters?: any[];
      rls_enforcement?: string;
      scoped_to_district?: number;
    } | null;
    citations: Array<{
      source_type: string;
      reference: string;
      confidence_score: number;
    }>;
  };
  security_context: {
    applied_filters: string[];
    user_role: string;
  };
}

type QueryState = 'idle' | 'routing' | 'executing' | 'complete' | 'error';

// ============================================================================
// MAIN DASHBOARD PAGE
// ============================================================================
export default function DashboardPage() {
  const [queryState, setQueryState] = useState<QueryState>('idle');
  const [payload, setPayload] = useState<XAIPayload | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isXAIOpen, setIsXAIOpen] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');

  const handleQuery = useCallback(async (query: string) => {
    setCurrentQuery(query);
    setErrorMessage('');
    setPayload(null);
    setQueryState('routing');

    try {
      // Simulate routing delay for visual feedback
      await new Promise(r => setTimeout(r, 600));
      setQueryState('executing');

      const res = await fetch('/api/orchestrator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer demo_token_district_12',
        },
        body: JSON.stringify({ query }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Server responded with ${res.status}`);
      }

      const data: XAIPayload = await res.json();
      setPayload(data);
      setQueryState('complete');
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
      setQueryState('error');
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Ambient Background Grid */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 20% 50%, rgba(34,211,238,0.03) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.03) 0%, transparent 50%),
            linear-gradient(rgba(148,163,184,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* ─── TOP BAR ─── */}
      <header className="relative z-10 border-b border-white/[0.06] px-6 py-3">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wide text-slate-100">
                KSP CRIME INTELLIGENCE
              </h1>
              <p className="text-[10px] tracking-[0.2em] text-slate-500 uppercase">
                Command Center v2.0 — Zero Trust Architecture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* System Status Indicators */}
            <StatusPill icon={<Database className="w-3 h-3" />} label="MySQL" status="online" />
            <StatusPill icon={<Activity className="w-3 h-3" />} label="Vector DB" status="online" />
            <StatusPill icon={<Radio className="w-3 h-3" />} label="Router" status="online" />

            {/* User Badge */}
            <div className="flex items-center gap-2 pl-5 border-l border-white/[0.06]">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold">
                DS
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-slate-300">Inspector Sahu</p>
                <p className="text-[10px] text-slate-500">District 12 • Central</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ─── MAIN CONTENT ─── */}
      <main className="relative z-10 flex-1 flex flex-col max-w-[1440px] w-full mx-auto px-6 pt-6 pb-28">
        {/* Idle State — Hero */}
        {queryState === 'idle' && !payload && (
          <div className="flex-1 flex flex-col items-center justify-center fade-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/10 flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-cyan-400" />
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              Crime Intelligence Query Engine
            </h2>
            <p className="text-sm text-slate-400 max-w-md text-center mb-8 leading-relaxed">
              Ask any question about crime records, case narratives, or criminal networks.
              Your queries are scoped to your district and fully audited.
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              {[
                'How many arrests in 2024?',
                'Find robbery cases involving vehicles',
                'Show crime trends by month',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => handleQuery(example)}
                  className="px-3 py-1.5 text-xs rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/5 transition-all duration-200"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {(queryState === 'routing' || queryState === 'executing') && (
          <div className="flex-1 flex flex-col items-center justify-center fade-up">
            <LoadingIndicator stage={queryState} />
          </div>
        )}

        {/* Error State */}
        {queryState === 'error' && (
          <div className="flex-1 flex flex-col items-center justify-center fade-up">
            <div className="max-w-md text-center">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Shield className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-red-400 mb-2">Query Failed</h3>
              <p className="text-sm text-slate-400 mb-4">{errorMessage}</p>
              <button
                onClick={() => setQueryState('idle')}
                className="px-4 py-2 text-xs rounded-lg bg-white/[0.05] border border-white/[0.1] text-slate-300 hover:bg-white/[0.08] transition-all"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Results State */}
        {queryState === 'complete' && payload && (
          <div className="flex-1 fade-up">
            <ResultsView payload={payload} onOpenXAI={() => setIsXAIOpen(true)} />
          </div>
        )}
      </main>

      {/* ─── OMNI-SEARCH BAR (Fixed Bottom) ─── */}
      <div className="fixed bottom-0 left-0 right-0 z-30">
        <div className="max-w-[800px] mx-auto px-4 pb-5">
          <OmniSearch
            onSubmit={handleQuery}
            isLoading={queryState === 'routing' || queryState === 'executing'}
          />
        </div>
      </div>

      {/* ─── XAI SLIDE-OUT PANEL ─── */}
      {isXAIOpen && payload && (
        <XAIPanel
          payload={payload}
          query={currentQuery}
          onClose={() => setIsXAIOpen(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================
function StatusPill({ icon, label, status }: { icon: React.ReactNode; label: string; status: 'online' | 'offline' }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'online' ? 'bg-emerald-400' : 'bg-red-400'}`} />
      <span className="text-[10px] text-slate-500 font-medium">{label}</span>
    </div>
  );
}

function LoadingIndicator({ stage }: { stage: 'routing' | 'executing' }) {
  const steps = [
    { key: 'routing', label: 'Analyzing Intent (Hybrid Router)', sublabel: 'Rule-based + ML classification' },
    { key: 'executing', label: 'Executing Secure Query', sublabel: 'RLS enforced • Scoped to District 12' },
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Animated Ring */}
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
        <div className="absolute inset-2 rounded-full bg-cyan-500/5 flex items-center justify-center">
          <Shield className="w-5 h-5 text-cyan-400 ksp-pulse" />
        </div>
      </div>

      {/* Step Timeline */}
      <div className="flex flex-col gap-3">
        {steps.map((step, i) => {
          const isActive = step.key === stage;
          const isDone = steps.findIndex(s => s.key === stage) > i;
          return (
            <div key={step.key} className="flex items-start gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 border ${
                isDone ? 'bg-cyan-500/20 border-cyan-500/40' :
                isActive ? 'border-cyan-400 ksp-glow' :
                'border-white/10'
              }`}>
                {isDone && <span className="text-[10px] text-cyan-400">✓</span>}
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ksp-pulse" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${isActive ? 'text-cyan-400' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-slate-600">{step.sublabel}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
