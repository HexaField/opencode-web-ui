import { createSignal, createEffect } from 'solid-js';
import SessionList from './SessionList';
import ChatInterface from './ChatInterface';
import DiffView from './DiffView';

interface Props {
  folder: string;
  onBack: () => void;
}

export default function Workspace(props: Props) {
  const params = new URLSearchParams(window.location.search);
  const [currentSessionId, setCurrentSessionId] = createSignal<string | null>(params.get('session'));
  const [view, setView] = createSignal<'chat' | 'changes'>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(false);

  createEffect(() => {
    const sid = currentSessionId();
    const url = new URL(window.location.href);
    if (sid) {
      url.searchParams.set('session', sid);
    } else {
      url.searchParams.delete('session');
    }
    window.history.replaceState({}, '', url);
  });

  return (
    <div class="flex h-screen w-screen overflow-hidden relative">
      {/* Mobile Sidebar Overlay */}
      <div 
        class={`fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity ${isSidebarOpen() ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div class={`
        fixed md:relative z-30 h-full bg-white border-r w-64 transform transition-transform duration-200 ease-in-out
        ${isSidebarOpen() ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <SessionList 
            folder={props.folder} 
            currentSessionId={currentSessionId()} 
            onSelectSession={(id) => { 
                setCurrentSessionId(id); 
                setView('chat'); 
                setIsSidebarOpen(false);
            }} 
        />
      </div>

      <div class="flex-1 flex flex-col h-full w-full">
        <div class="h-12 border-b flex items-center px-4 bg-white justify-between shrink-0 gap-2">
            <div class="flex items-center gap-2 md:gap-4 overflow-hidden">
                <button 
                    class="md:hidden p-1 -ml-2 text-gray-600"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    ☰
                </button>
                <div class="font-medium truncate text-gray-700 text-sm md:text-base">Folder: {props.folder}</div>
                <div class="flex bg-gray-100 rounded p-1">
                    <button 
                        class={`px-3 py-1 rounded text-sm transition-colors ${view() === 'chat' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setView('chat')}
                    >
                        Chat
                    </button>
                    <button 
                        class={`px-3 py-1 rounded text-sm transition-colors ${view() === 'changes' ? 'bg-white shadow text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setView('changes')}
                    >
                        Changes
                    </button>
                </div>
            </div>
            <button onClick={props.onBack} class="text-sm text-blue-500 hover:underline">Change Folder</button>
        </div>
        <div class="flex-1 overflow-hidden relative">
            {view() === 'chat' ? (
                currentSessionId() ? (
                    <ChatInterface folder={props.folder} sessionId={currentSessionId()!} />
                ) : (
                    <div class="flex items-center justify-center h-full text-gray-400">
                        Select or create a session to start
                    </div>
                )
            ) : (
                <DiffView folder={props.folder} />
            )}
        </div>
      </div>
    </div>
  );
}
