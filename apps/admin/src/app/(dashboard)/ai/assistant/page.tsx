import { Bot } from 'lucide-react';
import { AssistantChat } from './chat';

export default function AiAssistantPage() {
  return (
    <div>
      <div>
        <h1 className="flex items-center gap-2 text-[1.32rem] font-extrabold tracking-tight">
          <Bot className="size-5 text-primary" />
          AI Assistant
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ask questions about your store in plain language — every answer is looked up from your real data, never
          invented.
        </p>
      </div>

      <div className="mt-6">
        <AssistantChat />
      </div>
    </div>
  );
}
