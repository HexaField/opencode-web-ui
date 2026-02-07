import { Show } from 'solid-js'
import { useTheme } from '../theme'

interface Props {
  isOpen: boolean
  onClose: () => void
  onChangeFolder: () => void
}

export default function SettingsModal(props: Props) {
  const { theme, setTheme } = useTheme()

  return (
    <Show when={props.isOpen}>
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-sm overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-[#30363d] dark:bg-[#161b22]"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-[#30363d] dark:bg-[#0d1117]">
            <h2 class="font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div class="space-y-6 p-4">
            {/* Theme Section */}
            <div>
              <h3 class="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                Appearance
              </h3>
              <div class="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  class={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme() === 'light'
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300 dark:hover:bg-[#21262d]"
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  class={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme() === 'dark'
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300 dark:hover:bg-[#21262d]"
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  class={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    theme() === 'system'
                      ? "border-blue-500 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-400"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300 dark:hover:bg-[#21262d]"
                  }`}
                >
                  System
                </button>
              </div>
            </div>

            {/* Workspace Section */}
            <div>
              <h3 class="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase dark:text-gray-400">
                Workspace
              </h3>
              <button
                onClick={() => {
                  props.onChangeFolder()
                  props.onClose()
                }}
                class="flex w-full items-center justify-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-[#30363d] dark:bg-[#0d1117] dark:text-gray-300 dark:hover:bg-[#21262d]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
