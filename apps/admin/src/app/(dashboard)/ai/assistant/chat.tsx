'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, Send, Sparkles, User } from 'lucide-react';
import { sendChatMessage } from './actions';
import type { ChatMessage, ChatToolLink } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const SUGGESTED_QUESTIONS = [
  "What's my revenue this week, and how does it compare to last week?",
  'What are my best-selling products this month?',
  'Which orders are stuck in processing?',
  'Are any SKUs running low on stock?',
  'How many new customers did I get this week?',
];

interface DisplayMessage extends ChatMessage {
  toolsUsed?: ChatToolLink[];
  isError?: boolean;
}

/** No server-side persistence (see actions.ts's own comment) — this is the
 *  entire conversation state, lost on refresh. `sendChatMessage` is called
 *  directly as an async function (not via useActionState/<form>) since the
 *  conversation array, not a single form field, is what accumulates. */
export function AssistantChat() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function send(content: string) {
    const trimmed = content.trim();
    if (!trimmed || pending) return;

    const nextMessages: DisplayMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setPending(true);

    const result = await sendChatMessage(nextMessages.map((m) => ({ role: m.role, content: m.content })));
    if (result.error) {
      setMessages((prev) => [...prev, { role: 'assistant', content: result.error!, isError: true }]);
    } else if (result.data) {
      setMessages((prev) => [...prev, { role: 'assistant', content: result.data!.message, toolsUsed: result.data!.toolsUsed }]);
    }
    setPending(false);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  return (
    <div className="flex h-[calc(100vh-220px)] max-h-[900px] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Ask about your store</p>
              <p className="mt-1 text-xs text-muted-foreground">Answers are grounded in your real orders, products, and customers.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => send(q)}
                  className="rounded-full border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
                <div
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full',
                    m.role === 'user' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {m.role === 'user' ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
                </div>
                <div className={cn('max-w-[75%] rounded-xl px-3 py-2 text-sm', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground', m.isError && 'bg-destructive/10 text-destructive')}>
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.toolsUsed && m.toolsUsed.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.toolsUsed.map((t) => (
                        <Link key={t.tool} href={t.href} className="rounded-full border border-primary/30 bg-background px-2 py-0.5 text-[0.68rem] font-medium text-primary hover:bg-primary/5">
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {pending ? (
              <div className="flex gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Bot className="size-3.5" />
                </div>
                <div className="flex items-center gap-1 rounded-xl bg-muted px-3 py-2.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </div>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask a question about your store…"
          rows={1}
          className="max-h-32 min-h-9 flex-1 resize-none py-2"
          disabled={pending}
        />
        <Button type="submit" size="icon" disabled={pending || !input.trim()}>
          <Send className="size-4" />
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  );
}
