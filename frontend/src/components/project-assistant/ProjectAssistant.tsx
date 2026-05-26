"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { matchQuery, getSuggestedQuestions } from "@/lib/project-assistant/matcher";

type Message = {
  role: "assistant" | "user";
  text: string;
  links?: { label: string; href: string }[];
  qualifier?: string;
};

const INTRO: Message = {
  role: "assistant",
  text:
    "Hi, I'm the LedgerLens project guide. I can answer questions about " +
    "how this demo works, what the trust metric means, what the tech stack " +
    "is, and what is intentionally out of scope. I do not use an external " +
    "AI API — I answer from a curated internal knowledge base.",
};

export function ProjectAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([INTRO]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const suggestions = getSuggestedQuestions(pathname);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ask = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      const userMsg: Message = { role: "user", text: q };
      const result = matchQuery(q);
      const assistantMsg: Message = {
        role: "assistant",
        text: result.entry?.answer ?? "I don't have an answer for that.",
        links: result.entry?.links,
        qualifier:
          result.confidence === "medium"
            ? "This is the closest match I found."
            : undefined,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Open project guide"
        className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-brand-500 active:scale-95 sm:h-14 sm:w-14"
      >
        <span className="text-[20px] leading-none">?</span>
      </button>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-0 z-50 flex h-[min(85vh,600px)] w-full flex-col border-l border-t border-surface-border bg-surface-page shadow-2xl sm:bottom-5 sm:right-5 sm:w-[380px] sm:rounded-xl sm:border"
      role="dialog"
      aria-label="LedgerLens project guide"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-border bg-brand-600 px-4 py-3 text-white sm:rounded-t-xl">
        <p className="text-[14px] font-medium">LedgerLens Guide</p>
        <button
          onClick={() => setOpen(false)}
          aria-label="Close guide"
          className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[90%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "ml-auto bg-brand-100 text-brand-900"
                : "bg-surface-sunken text-text-primary"
            }`}
          >
            <p>{msg.text}</p>
            {msg.qualifier && (
              <p className="mt-1 text-[11px] italic text-text-subtle">
                {msg.qualifier}
              </p>
            )}
            {msg.links && msg.links.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.links.map((link) =>
                  link.href.startsWith("/") ? (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="inline-block rounded bg-brand-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-brand-500"
                      onClick={() => setOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block rounded bg-surface-panel px-2 py-0.5 text-[11px] font-medium text-brand-700 hover:bg-brand-100"
                    >
                      {link.label}
                    </a>
                  ),
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-1.5 border-t border-surface-border bg-surface-sunken/40 px-3 py-2">
        {suggestions.map((q) => (
          <button
            key={q}
            onClick={() => ask(q)}
            className="rounded-full border border-surface-border bg-surface-page px-2.5 py-1 text-[11px] text-text-secondary hover:bg-brand-100 hover:text-brand-800"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-surface-border px-3 py-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the project..."
          className="min-w-0 flex-1 rounded-md border border-surface-border bg-surface-page px-3 py-1.5 text-[13px] text-text-primary placeholder:text-text-subtle focus:border-brand-600 focus:outline-none"
          aria-label="Ask the project guide"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
