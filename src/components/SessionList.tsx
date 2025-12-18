import { createSignal, createEffect, For } from 'solid-js';

interface Session {
  id: string;
  title: string;
}

interface Props {
  folder: string;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
}

export default function SessionList(props: Props) {
  const [sessions, setSessions] = createSignal<Session[]>([]);
  const [error, setError] = createSignal<string | null>(null);

  const fetchSessions = () => {
    setError(null);
    fetch(`/sessions?folder=${encodeURIComponent(props.folder)}`)
      .then(res => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) setSessions(data as Session[]);
      })
      .catch(err => setError(String(err)));
  };

  createEffect(() => {
    if (props.folder) fetchSessions();
  });

  const createSession = () => {
    setError(null);
    fetch(`/sessions?folder=${encodeURIComponent(props.folder)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Session' })
    })
      .then(async res => {
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Failed to create session: ${res.status} ${text}`);
        }
        return res.json();
      })
      .then((data: unknown) => {
        const session = data as Session;
        if (session.id) {
          fetchSessions();
          props.onSelectSession(session.id);
        } else {
            console.error('Session created but no ID returned', data);
            setError('Session created but no ID returned');
        }
      })
      .catch(err => {
          console.error('Error creating session:', err);
          setError(String(err));
      });
  };

  return (
    <div class="w-64 border-r bg-gray-50 flex flex-col h-full">
      <div class="p-4 border-b flex justify-between items-center">
        <h3 class="font-bold">Sessions</h3>
        <button onClick={createSession} class="text-blue-500 text-xl hover:bg-blue-100 rounded px-2">+</button>
      </div>
      {error() && <div class="p-2 text-red-500 text-xs bg-red-50 border-b">{error()}</div>}
      <div class="overflow-y-auto flex-1">
        <For each={sessions()}>
          {(session) => (
            <div 
              class={`p-3 cursor-pointer hover:bg-gray-200 border-b ${props.currentSessionId === session.id ? 'bg-blue-100' : ''}`}
              onClick={() => props.onSelectSession(session.id)}
            >
              <div class="font-medium truncate">{session.title || session.id}</div>
              <div class="text-xs text-gray-500 truncate">{session.id}</div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
