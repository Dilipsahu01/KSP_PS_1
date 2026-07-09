'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Mic, MicOff, Send, Loader2 } from 'lucide-react';

interface OmniSearchProps {
  onSubmit: (query: string) => void;
  isLoading: boolean;
}

export default function OmniSearch({ onSubmit, isLoading }: OmniSearchProps) {
  const [query, setQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [query]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    onSubmit(trimmed);
    setQuery('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Voice Recognition (Web Speech API) ──
  const toggleVoice = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('');
      setQuery(transcript);
    };

    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  };

  return (
    <div
      className={`
        relative glass rounded-2xl transition-all duration-300
        ${isFocused ? 'border-cyan-500/30 shadow-[0_0_30px_rgba(34,211,238,0.08)]' : 'border-white/[0.06]'}
        ${isListening ? 'border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.1)]' : ''}
      `}
    >
      {/* Voice Listening Indicator */}
      {isListening && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-[3px] rounded-full bg-amber-400"
                style={{
                  animation: `ksp-wave 0.8s ease-in-out infinite`,
                  animationDelay: `${i * 0.1}s`,
                  height: '8px',
                }}
              />
            ))}
          </div>
          <span className="text-[11px] text-amber-400 font-medium">Listening...</span>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {/* Search Icon */}
        <div className="flex items-center justify-center w-9 h-9 flex-shrink-0">
          <Search className="w-4 h-4 text-slate-500" />
        </div>

        {/* Text Input */}
        <textarea
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Ask about crimes, arrests, case narratives, or criminal networks..."
          disabled={isLoading}
          rows={1}
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 resize-none outline-none min-h-[36px] py-2 leading-snug disabled:opacity-50"
          id="omni-search-input"
        />

        {/* Voice Button */}
        <button
          onClick={toggleVoice}
          disabled={isLoading}
          className={`
            w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
            ${isListening
              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
              : 'bg-white/[0.04] text-slate-500 border border-transparent hover:text-slate-300 hover:bg-white/[0.06]'
            }
            disabled:opacity-30 disabled:cursor-not-allowed
          `}
          aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          id="voice-input-btn"
        >
          {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !query.trim()}
          className={`
            w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200
            ${query.trim() && !isLoading
              ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25'
              : 'bg-white/[0.03] text-slate-600 border border-transparent'
            }
            disabled:cursor-not-allowed
          `}
          aria-label="Submit query"
          id="submit-query-btn"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Subtle gradient line at bottom during loading */}
      {isLoading && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden rounded-b-2xl">
          <div className="h-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />
        </div>
      )}
    </div>
  );
}
