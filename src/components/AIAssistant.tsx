import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send } from 'lucide-react';

interface Msg { role: 'user' | 'assistant'; content: string }

export const AIAssistant: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: "Hey! I'm Pulse AI ⚡ Ask me for caption ideas, trending hashtags, content tips, or anything creator-related." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text } as Msg];
    setMessages(next);
    setLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to get a response.');
      setMessages([...next, { role: 'assistant', content: data.reply }]);
    } catch (err: any) {
      setMessages([...next, { role: 'assistant', content: '⚠️ ' + (err.message || 'Could not reach the AI. Try again.') }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="absolute bottom-[74px] right-3 z-50 w-12 h-12 rounded-full bg-gradient-to-br from-[#ffbd1a] to-[#ff7a1a] text-black flex items-center justify-center shadow-[0_4px_20px_rgba(255,189,26,.45)] active:scale-90 transition-transform cursor-pointer"
          title="Pulse AI"
        >
          <Sparkles className="w-6 h-6" strokeWidth={2.2} />
        </button>
      )}

      {open && (
        <div className="absolute inset-0 z-[80] bg-[#050506] flex flex-col animate-in fade-in">
          <header className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0a0a0c]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ffbd1a] to-[#ff7a1a] flex items-center justify-center text-black shrink-0">
              <Sparkles className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[15px] text-white">Pulse AI</div>
              <div className="text-[11px] text-[#25f4ee]">Online · here to help</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white p-1.5 rounded-full hover:bg-white/10 cursor-pointer shrink-0">
              <X className="w-5 h-5" />
            </button>
          </header>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 scrollbar-none">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words ${
                  m.role === 'user'
                    ? 'bg-[#ffbd1a] text-black rounded-br-md'
                    : 'bg-[#151517] text-white rounded-bl-md border border-white/[.06]'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#151517] text-neutral-400 px-4 py-3 rounded-2xl rounded-bl-md border border-white/[.06] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
          </div>

          <div className="px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] border-t border-white/10 bg-[#0a0a0c] flex items-center gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask Pulse AI…"
              className="flex-1 h-11 rounded-full bg-[#151517] border border-white/[.08] px-4 text-[14px] text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#ffbd1a]/60"
            />
            <button onClick={send} disabled={loading || !input.trim()} className="w-11 h-11 rounded-full bg-[#ffbd1a] text-black flex items-center justify-center disabled:opacity-40 active:scale-90 transition-transform cursor-pointer shrink-0">
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
