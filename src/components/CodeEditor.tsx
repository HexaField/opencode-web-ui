import * as monaco from 'monaco-editor'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { readFSFile, writeFile } from '../api/files'
import { useTheme } from '../theme'

// Configure Monaco workers
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

if (!self.MonacoEnvironment) {
  self.MonacoEnvironment = {
    getWorker(_: unknown, label: string) {
      if (label === 'json') {
        return new jsonWorker()
      }
      if (label === 'css' || label === 'scss' || label === 'less') {
        return new cssWorker()
      }
      if (label === 'html' || label === 'handlebars' || label === 'razor') {
        return new htmlWorker()
      }
      if (label === 'typescript' || label === 'javascript') {
        return new tsWorker()
      }
      return new editorWorker()
    }
  }
}

interface Props {
  filePath: string
  folder: string
  onClose?: () => void
  onFocus?: () => void
}

export default function CodeEditor(props: Props) {
  const [editor, setEditor] = createSignal<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const [isDirty, setIsDirty] = createSignal(false)
  let editorContainer: HTMLDivElement | undefined
  const { isDark } = useTheme()

  // Update theme
  createEffect(() => {
    monaco.editor.setTheme(isDark() ? 'vs-dark' : 'vs')
  })

  // Load file content
  createEffect(() => {
    const file = props.filePath
    const ed = editor()
    if (file && ed) {
      readFSFile(file)
        .then((data) => {
          if (data.content !== undefined) {
            const uri = monaco.Uri.file(file)
            let model = monaco.editor.getModel(uri)
            if (!model) {
              model = monaco.editor.createModel(
                data.content,
                undefined, // auto-detect language
                uri
              )
            } else if (model.getValue() !== data.content) {
              // Only update if different to avoid cursor jumping if we were the ones who saved
              // But here we are loading from disk, so maybe we should always update?
              // For now, let's assume if it's dirty we don't overwrite from disk unless forced (not handled here)
              // Simple check:
              if (!isDirty()) {
                model.setValue(data.content)
              }
            }
            ed.setModel(model)
          }
        })
        .catch(console.error)
    }
  })

  // Handle diff highlighting in editor
  createEffect(() => {
    const file = props.filePath
    const ed = editor()
    // We need to fetch the diff and apply decorations
    // Since we don't have the diff here, we can dispatch an event or use a store
    // For now, let's keep it simple and just allow opening the file.
    // The requirement was: "allow Changes tab diff to be opened with diff highlighting in file viewer"
    // This implies we should fetch the diff here if we are in "diff mode" or just always fetch it.
    // Let's try to fetch diff for the current file and show it.

    if (file && ed) {
      void import('../api/files').then(({ getFileDiff }) => {
        getFileDiff(props.folder, file)
          .then(({ diff }) => {
            if (!diff) return

            // Parse unified diff to find added/removed lines
            const lines = diff.split(/\r?\n/)
            const decorations: monaco.editor.IModelDeltaDecoration[] = []

            // Simplified parser - this might need more robust parsing for complex diffs
            // But for highlighting changed lines in the CURRENT file version, we only care about additions/modifications
            // Removals are harder to show in the current file without a side-by-side view.

            // Actually, VSCode shows added lines with green, modified with blue (or similar).

            // Let's just try to highlight lines that are present in the diff as added (+).

            // Standard unified diff header: @@ -old,count +new,count @@
            let newFileIndex = 0

            for (const line of lines) {
              if (line.startsWith('@@')) {
                const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
                if (match) {
                  newFileIndex = parseInt(match[1]) - 1 // 0-based
                }
              } else if (line.startsWith('+') && !line.startsWith('+++')) {
                newFileIndex++
                decorations.push({
                  range: new monaco.Range(newFileIndex, 1, newFileIndex, 1),
                  options: {
                    isWholeLine: true,
                    linesDecorationsClassName: 'w-1 bg-green-600/60 dark:bg-green-500/60', // Gutter decoration - darker green
                    className: 'bg-yellow-100/30 dark:bg-yellow-500/10' // Line background - more yellowy/darker
                  }
                })
              } else if (line.startsWith(' ') || (line.startsWith('-') && !line.startsWith('---'))) {
                if (!line.startsWith('-')) newFileIndex++
                // For removed lines (-), we can't show them in the current file easily as they don't exist
                // VSCode shows a small indicator in the gutter.
                // If we encounter a removal, we could mark the *previous* line or the current line position.

                if (line.startsWith('-') && !line.startsWith('---')) {
                  decorations.push({
                    range: new monaco.Range(newFileIndex + 1, 1, newFileIndex + 1, 1),
                    options: {
                      linesDecorationsClassName: 'w-0 border-t-4 border-red-500 -ml-0.5 z-10' // Attempt to show a red line
                    }
                  })
                }
              }
            }

            const model = ed.getModel()
            if (model) {
              ed.createDecorationsCollection(decorations)
            }
          })
          .catch(() => {
            // Ignore errors (e.g. if file is not in git)
          })
      })
    }
  })

  onMount(() => {
    if (editorContainer) {
      const ed = monaco.editor.create(editorContainer, {
        value: '',
        theme: isDark() ? 'vs-dark' : 'vs',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        padding: { top: 16 }
      })

      ed.onDidChangeModelContent(() => {
        // We need a better way to check dirty state than just "changed"
        // But for now, if it changes, it's dirty.
        // In a real app we'd compare to original content.
        if (!isDirty()) setIsDirty(true)
      })

      ed.onDidFocusEditorText(() => {
        props.onFocus?.()
      })

      // Add keybinding for save
      ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        void saveFile()
      })

      setEditor(ed)
    }
  })

  onCleanup(() => {
    editor()?.dispose()
  })

  const saveFile = async () => {
    const file = props.filePath
    const ed = editor()
    if (!file || !ed) return

    const content = ed.getValue()
    try {
      await writeFile(file, content)
      setIsDirty(false)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div class="h-full w-full flex flex-col relative group">
      <div class="h-9 bg-gray-50 dark:bg-[#161b22] flex items-center px-3 border-b border-gray-200 dark:border-[#30363d] justify-between shrink-0 select-none">
        <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 overflow-hidden">
          <span class="truncate font-medium" title={props.filePath}>
            {props.filePath.split('/').pop()}
          </span>
          <span class="text-xs text-gray-400 truncate dir-rtl text-left" title={props.filePath}>
            {props.filePath.replace(props.folder, '')}
          </span>
          {isDirty() && <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />}
        </div>
        <div class="flex items-center gap-2">
          <button
            onClick={() => void saveFile()}
            class="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            title="Save"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
            </svg>
          </button>
          <button
            onClick={props.onClose}
            class="text-gray-400 hover:text-red-600 dark:hover:text-red-400"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fill-rule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clip-rule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
      <div class="flex-1 overflow-hidden relative bg-white dark:bg-[#0d1117]" ref={editorContainer}></div>
    </div>
  )
}
