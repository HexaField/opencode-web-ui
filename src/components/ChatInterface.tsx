import { createSignal, createEffect, For, Show } from 'solid-js';

interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

interface Props {
  folder: string;
  sessionId: string;
}

export default function ChatInterface(props: Props) {
  const [messages, setMessages] = createSignal<Message[]>([]);
  const [input, setInput] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  createEffect(() => {
    if (props.sessionId) {
        setMessages([]); 
        setLoading(true);
        fetch(`/sessions/${props.sessionId}?folder=${encodeURIComponent(props.folder)}`)
            .then(res => res.json())
            .then((data: any) => {
                if (data && Array.isArray(data.history)) {
                    const history = data.history.map((msg: any) => {
                        let content = '';
                        if (msg.parts) {
                            content = msg.parts
                                .filter((p: any) => p.type === 'text' && p.text)
                                .map((p: any) => p.text)
                                .join('\n');
                        }
                        return {
                            role: msg.info?.role || 'assistant',
                            content: content || JSON.stringify(msg)
                        };
                    });
                    setMessages(history);
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }
  });

  const sendMessage = async () => {
    if (!input().trim() || loading()) return;
    const text = input();
    setInput('');
    setLoading(true);
    
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const res = await fetch(`/sessions/${props.sessionId}/prompt?folder=${encodeURIComponent(props.folder)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts: [{ type: 'text', text }] })
      });
      const data = await res.json() as { parts?: { type: string; text?: string }[] };
      
      // Handle response structure
      let content = '';
      if (data.parts) {
        content = data.parts
            .filter(p => p.type === 'text' && p.text)
            .map(p => p.text)
            .join('\n');
      } else {
        content = JSON.stringify(data, null, 2);
      }

      setMessages(prev => [...prev, { role: 'assistant', content }]); 
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error: ' + String(err) }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="flex flex-col h-full bg-white">
      <div class="flex-1 overflow-y-auto p-2 md:p-4 flex flex-col">
        <For each={messages()}>
          {(msg, index) => {
            const isUser = msg.role === 'user';
            const isConsecutive = index() > 0 && messages()[index() - 1].role === msg.role;
            return (
              <div 
                class={`
                  max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 md:px-4 md:py-2
                  ${isUser 
                    ? 'bg-blue-500 text-white self-end rounded-br-sm' 
                    : 'bg-gray-100 text-gray-800 self-start rounded-bl-sm'
                  }
                  ${isConsecutive ? 'mt-1' : 'mt-4'}
                `}
              >
                <pre class="whitespace-pre-wrap font-sans text-xs md:text-sm">{msg.content}</pre>
              </div>
            );
          }}
        </For>
        <Show when={loading()}>
          <div class="text-gray-500 italic text-xs md:text-sm p-2 self-start ml-2">Thinking...</div>
        </Show>
      </div>
      <div class="p-2 md:p-4 border-t bg-gray-50">
        <div class="flex gap-2">
          <textarea 
            class="flex-1 border rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
            rows={3}
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void sendMessage();
                }
            }}
            placeholder="Type a message..."
          />
          <button 
            class="bg-blue-500 text-white px-6 rounded hover:bg-blue-600 font-medium disabled:opacity-50"
            onClick={() => void sendMessage()}
            disabled={loading()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
