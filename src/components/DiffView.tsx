import { createSignal, createEffect, For } from 'solid-js';

interface FileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked';
}

interface Props {
  folder: string;
}

export default function DiffView(props: Props) {
  const [files, setFiles] = createSignal<FileStatus[]>([]);

  createEffect(() => {
    fetch(`/files/status?folder=${encodeURIComponent(props.folder)}`)
      .then(res => res.json())
      .then((data: unknown) => {
        if (Array.isArray(data)) {
            const mapped = data.map((f: string | FileStatus) => 
                typeof f === 'string' ? { path: f, status: 'modified' as const } : f
            );
            setFiles(mapped);
        }
      })
      .catch(console.error);
  });

  return (
    <div class="h-full flex flex-col bg-white">
      <div class="p-4 border-b font-bold bg-gray-50">Changes</div>
      <div class="flex-1 overflow-y-auto">
        <For each={files()}>
          {(file) => (
            <div class="p-3 border-b flex items-center hover:bg-gray-50 cursor-pointer">
              <span class={`mr-3 font-bold w-4 text-center ${
                  file.status === 'modified' ? 'text-yellow-600' :
                  file.status === 'added' ? 'text-green-600' :
                  file.status === 'deleted' ? 'text-red-600' : 'text-gray-400'
              }`}>
                {file.status === 'modified' && 'M'}
                {file.status === 'added' && 'A'}
                {file.status === 'deleted' && 'D'}
                {file.status === 'untracked' && '?'}
              </span>
              <span class="font-mono text-sm text-gray-700">{file.path}</span>
            </div>
          )}
        </For>
        {files().length === 0 && (
            <div class="p-10 text-gray-400 text-center flex flex-col items-center">
                <div class="text-4xl mb-2">✓</div>
                <div>No changes detected</div>
            </div>
        )}
      </div>
    </div>
  );
}
