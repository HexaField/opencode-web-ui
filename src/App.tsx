import { createSignal, createEffect } from 'solid-js';
import FolderBrowser from './components/FolderBrowser';
import Workspace from './components/Workspace';

function App() {
  const params = new URLSearchParams(window.location.search);
  const [folder, setFolder] = createSignal<string | null>(params.get('folder'));

  createEffect(() => {
    const f = folder();
    const url = new URL(window.location.href);
    if (f) {
      url.searchParams.set('folder', f);
    } else {
      url.searchParams.delete('folder');
      url.searchParams.delete('session');
    }
    window.history.replaceState({}, '', url);
  });

  return (
    <div class="h-screen w-screen bg-gray-100 text-gray-900 font-sans">
      {folder() ? (
        <Workspace folder={folder()!} onBack={() => setFolder(null)} />
      ) : (
        <div class="flex items-center justify-center h-full p-4">
            <div class="w-full max-w-2xl">
                <FolderBrowser onSelectFolder={setFolder} />
            </div>
        </div>
      )}
    </div>
  );
}

export default App;
