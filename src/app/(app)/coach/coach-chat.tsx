"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Card, cn } from "@/components/ui";
import { parseMarkdown, type Inline } from "@/lib/coach/markdown";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What's my biggest leak right now?",
  "Which setup should I focus on, and which should I drop?",
  "Do my emotions or rule breaks affect my results?",
  "How should I size risk given my drawdowns and losing streaks?",
  "Review my last 20 trades.",
];

function Inlines({ items, refs }: { items: Inline[]; refs: Record<string, string> }) {
  return (
    <>
      {items.map((it, i) => {
        if (it.type === "bold") return <strong key={i} className="font-semibold text-white">{it.text}</strong>;
        if (it.type === "code") return <code key={i} className="rounded bg-navy-800 px-1 text-[0.9em]">{it.text}</code>;
        if (it.type === "cite") {
          const id = refs[it.ref];
          return id ? (
            <Link key={i} href={`/trades/${id}`} className="mx-0.5 rounded bg-electric/15 px-1 text-xs font-medium text-electric-soft hover:bg-electric/30" title="Open trade">
              {it.ref}
            </Link>
          ) : (
            <span key={i} className="text-navy-400">[{it.ref}]</span>
          );
        }
        return <span key={i}>{it.text}</span>;
      })}
    </>
  );
}

function Answer({ text, refs }: { text: string; refs: Record<string, string> }) {
  const blocks = parseMarkdown(text);
  const out: ReactNode[] = blocks.map((b, i) => {
    if (b.type === "heading") {
      return <p key={i} className="mt-3 font-semibold text-white first:mt-0"><Inlines items={b.content} refs={refs} /></p>;
    }
    if (b.type === "list") {
      const Tag = b.ordered ? "ol" : "ul";
      return (
        <Tag key={i} className={cn("my-2 space-y-1 pl-5", b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((item, j) => <li key={j}><Inlines items={item} refs={refs} /></li>)}
        </Tag>
      );
    }
    return <p key={i} className="my-2 first:mt-0 last:mb-0"><Inlines items={b.content} refs={refs} /></p>;
  });
  return <div className="text-sm leading-relaxed text-navy-200">{out}</div>;
}

export function CoachChat({ remaining }: { remaining: number }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(remaining);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);
  useEffect(() => () => abort.current?.abort(), []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    const history: Msg[] = [...messages, { role: "user" as const, content: q }].slice(-19);
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
        signal: abort.current.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The coach couldn't answer. Please try again.");
      }
      setLeft((n) => Math.max(0, n - 1));
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let headerDone = false;
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        if (!headerDone) {
          const nl = buffer.indexOf("\n");
          if (nl === -1) continue;
          // Parse now: state updaters run later, after `buffer` has moved on.
          const header = JSON.parse(buffer.slice(0, nl)) as { refs: Record<string, string> };
          setRefs((r) => ({ ...r, ...header.refs }));
          buffer = buffer.slice(nl + 1);
          headerDone = true;
        }
        answer += buffer;
        buffer = "";
        const snapshot = answer;
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: snapshot }]);
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setMessages((m) => (m[m.length - 1]?.content ? m : m.slice(0, -2)));
        setInput(q);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex min-h-[32rem] flex-col p-0">
      <div className="flex-1 space-y-5 overflow-y-auto p-5" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-start gap-3">
            <p className="text-sm text-navy-300">Ask anything about your trading. Answers use only your journal and cite the trades they&apos;re based on.</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => ask(s)} disabled={busy || left === 0} className="rounded-full border border-navy-600 px-3 py-1.5 text-left text-sm text-navy-200 hover:border-electric hover:text-white disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-electric/20 px-4 py-2.5 text-sm text-white">{m.content}</div>
            ) : (
              <div key={i} className="max-w-[95%]">
                {m.content ? <Answer text={m.content} refs={refs} /> : <p className="animate-pulse text-sm text-navy-400">Analysing your journal…</p>}
              </div>
            ),
          )
        )}
        <div ref={bottom} />
      </div>
      <form
        className="flex flex-col gap-2 border-t border-navy-700 p-4 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={left === 0 ? "Daily limit reached — back tomorrow." : "Ask your coach… (Enter to send, Shift+Enter for a new line)"}
          disabled={left === 0}
          aria-label="Question for the coach"
          className="flex-1 resize-none rounded-lg border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-white placeholder:text-navy-400 focus:border-electric focus:outline-none focus:ring-1 focus:ring-electric"
        />
        <div className="flex gap-2 sm:flex-col">
          {busy ? (
            <Button type="button" variant="secondary" onClick={() => abort.current?.abort()}>Stop</Button>
          ) : (
            <Button type="submit" disabled={!input.trim() || left === 0}>Ask</Button>
          )}
          {messages.length > 0 && !busy && (
            <Button type="button" variant="ghost" onClick={() => setMessages([])}>New chat</Button>
          )}
        </div>
      </form>
      <div className="flex flex-wrap justify-between gap-2 px-4 pb-3 text-xs text-navy-400">
        <span>{left} question{left === 1 ? "" : "s"} left today</span>
        {error && <span role="alert" className="text-loss">{error}</span>}
      </div>
    </Card>
  );
}
