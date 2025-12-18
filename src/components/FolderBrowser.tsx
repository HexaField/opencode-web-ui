import { createSignal, createEffect, For } from 'solid-js';

interface Entry {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface Props {
  onSelectFolder: (path: string) => void;
}

export default function FolderBrowser(props: Props) {
  const [currentPath, setCurrentPath] = createSignal('');
  const [inputPath, setInputPath] = createSignal('');
  const [entries, setEntries] = createSignal<Entry[]>([]);
  const [ignoreDotFiles, setIgnoreDotFiles] = createSignal(true);

  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const path = currentPath();
    console.log('Effect running, path:', path);
    // Sync input with current path when it changes externally (e.g. clicking folder)
    setInputPath(path);
    setError(null);
    
    const url = path ? `http://127.0.0.1:3001/fs/list?path=${encodeURIComponent(path)}` : 'http://127.0.0.1:3001/fs/list';
    fetch(url)
      .then(res => {
          if (!res.ok) throw new Error(res.statusText);
          const serverPath = res.headers.get('x-current-path');
          if (serverPath && !path) {
              setCurrentPath(serverPath);
          }
          return res.json();
      })
      .then(data => {
        console.log('Folder entries:', data);
        if (Array.isArray(data)) {
          setEntries(data);
        }
      })
      .catch(err => {
          console.error(err);
          setError(String(err));
      });
  });

  const handleEntryClick = (entry: Entry) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
    }
  };

  const handleUp = () => {
    const p = currentPath();
    if (p && p !== '/') {
        const parent = p.split('/').slice(0, -1).join('/') || '/';
        setCurrentPath(parent);
    }
  };

  const handleGo = () => {
      setCurrentPath(inputPath());
  };

  return (
    <div class="p-4 bg-white rounded shadow">
      <div class="mb-4 flex flex-col gap-2">
        <div class="flex justify-between items-center">
            <div class="flex items-center gap-2">
                <button onClick={handleUp} class="px-2 py-1 bg-gray-200 rounded" disabled={!currentPath()}>⬆️</button>
                <h2 class="text-xl font-bold">Select Folder</h2>
            </div>
            <button 
            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => props.onSelectFolder(currentPath())}
            >
            Select this folder
            </button>
        </div>
        <div class="flex gap-2">
            <input 
                class="flex-1 border rounded px-2 py-1 text-sm" 
                value={inputPath()} 
                onInput={(e) => setInputPath(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGo()}
                placeholder="Enter path..."
            />
            <button 
                class="bg-gray-200 px-3 py-1 rounded text-sm"
                onClick={handleGo}
            >
                Go
            </button>
            <button 
                class={`px-3 py-1 rounded text-sm transition-colors ${ignoreDotFiles() ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-700'}`}
                onClick={() => setIgnoreDotFiles(!ignoreDotFiles())}
                title="Toggle ignoring dot files"
            >
                {ignoreDotFiles() ? 'Hidden' : 'Shown'}
            </button>
        </div>
      </div>
      <div class="text-sm text-gray-500 mb-2">Current: {currentPath() || 'Root'}</div>
      {error() && <div class="text-red-500 text-sm mb-2">Error: {error()}</div>}
      <div class="border rounded p-2 h-96 overflow-y-auto">
        <For each={entries().filter(e => !ignoreDotFiles() || !e.name.startsWith('.'))}>
          {(entry) => (
            <div 
              class="cursor-pointer p-2 hover:bg-gray-100 flex items-center border-b last:border-b-0"
              onClick={() => handleEntryClick(entry)}
            >
              <span class="mr-2">{entry.isDirectory ? '📁' : '📄'}</span>
              {entry.name}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
