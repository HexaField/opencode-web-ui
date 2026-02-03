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
  targetPosition?: { line: number; character: number } | null
  onNavigationComplete?: () => void
}

export default function CodeEditor(props: Props) {
  const [editor, setEditor] = createSignal<monaco.editor.IStandaloneCodeEditor | undefined>(undefined)
  const [isDirty, setIsDirty] = createSignal(false)
  const [isLoaded, setIsLoaded] = createSignal(false)
  let editorContainer: HTMLDivElement | undefined = undefined
  const { isDark } = useTheme()

  // Update theme
  createEffect(() => {
    monaco.editor.setTheme(isDark() ? 'vs-dark' : 'vs')
  })

  // Load file content
  createEffect(() => {
    const file = props.filePath
    const ed = editor()
    setIsLoaded(false)
    if (file && ed) {
      readFSFile(file)
        .then((data) => {
          if (data.content !== undefined) {
            const uri = monaco.Uri.file(file)
            let model = monaco.editor.getModel(uri)
            if (!model) {
              model = monaco.editor.createModel(data.content, undefined, uri)
            } else if (model.getValue() !== data.content) {
              if (!isDirty()) {
                model.setValue(data.content)
              }
            }
            ed.setModel(model)
            setIsLoaded(true)

            // Initial navigation if pending
            if (props.targetPosition) {
              ed.revealPositionInCenter({
                lineNumber: props.targetPosition.line,
                column: props.targetPosition.character + 1
              })
              ed.setPosition({ lineNumber: props.targetPosition.line, column: props.targetPosition.character + 1 })
              ed.focus()
              props.onNavigationComplete?.()
            }
          }
        })
        .catch(console.error)
    }
  })

  // Handle navigation requests when already loaded
  createEffect(() => {
    const target = props.targetPosition
    const ed = editor()
    if (isLoaded() && target && ed) {
      ed.revealPositionInCenter({ lineNumber: target.line, column: target.character + 1 })
      ed.setPosition({ lineNumber: target.line, column: target.character + 1 })
      ed.focus()
      props.onNavigationComplete?.()
    }
  })

  // Handle diff highlighting in editor
  let decorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined

  const applyDiffDecorations = async () => {
    const file = props.filePath
    const ed = editor()
    if (!file || !ed) return

    // Clear previous decorations
    try {
      decorationsCollection?.clear()
    } catch {
      // ignore
    }

    try {
      const { getFileDiff } = await import('../api/files')
      const { diff } = await getFileDiff(props.folder, file)
      if (!diff) return

      const lines = diff.split(/\r?\n/)
      const decorations: monaco.editor.IModelDeltaDecoration[] = []

      let newFileIndex = 0
      for (const line of lines) {
        if (line.startsWith('@@')) {
          const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line)
          if (match) {
            newFileIndex = parseInt(match[1]) - 1
          }
        } else if (line.startsWith('+') && !line.startsWith('+++')) {
          newFileIndex++
          decorations.push({
            range: new monaco.Range(newFileIndex, 1, newFileIndex, 1),
            options: {
              isWholeLine: true,
              linesDecorationsClassName: 'w-1 bg-green-600/60 dark:bg-green-500/60',
              className: 'bg-yellow-100/30 dark:bg-yellow-500/10'
            }
          })
        } else if (line.startsWith(' ') || (line.startsWith('-') && !line.startsWith('---'))) {
          if (!line.startsWith('-')) newFileIndex++
          if (line.startsWith('-') && !line.startsWith('---')) {
            decorations.push({
              range: new monaco.Range(newFileIndex + 1, 1, newFileIndex + 1, 1),
              options: {
                linesDecorationsClassName: 'w-0 border-t-4 border-red-500 -ml-0.5 z-10'
              }
            })
          }
        }
      }

      const model = ed.getModel()
      if (model) {
        decorationsCollection = ed.createDecorationsCollection(decorations)
      }
    } catch {
      // ignore errors (e.g. file not in git)
    }
  }

  createEffect(() => {
    // Run when file or editor changes - read reactive values here so Solid tracks them
    void props.filePath
    void editor()
    void applyDiffDecorations()
  })

  // Refresh decorations when git state changes (commit/stage/unstage, etc.)
  onMount(() => {
    const handler = () => void applyDiffDecorations()
    window.addEventListener('git-updated', handler)
    onCleanup(() => window.removeEventListener('git-updated', handler))
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
    <div class="group relative flex h-full w-full flex-col">
      <div class="flex h-9 shrink-0 items-center justify-between border-b border-gray-200 bg-gray-50 px-3 select-none dark:border-[#30363d] dark:bg-[#161b22]">
        <div class="flex items-center gap-2 overflow-hidden text-sm text-gray-700 dark:text-gray-300">
          <span class="truncate font-medium" title={props.filePath}>
            {props.filePath.split('/').pop()}
          </span>
          <span class="dir-rtl truncate text-left text-xs text-gray-400" title={props.filePath}>
            {props.filePath.replace(props.folder, '')}
          </span>
          {isDirty() && <span class="h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" />}
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
      <div class="relative flex-1 overflow-hidden bg-white dark:bg-[#0d1117]" ref={editorContainer}></div>
    </div>
  )
}
