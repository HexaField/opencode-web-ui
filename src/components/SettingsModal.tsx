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
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      >
        <div
          class="w-full max-w-sm bg-white dark:bg-[#161b22] rounded-xl shadow-2xl border border-gray-200 dark:border-[#30363d] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div class="px-4 py-3 border-b border-gray-200 dark:border-[#30363d] flex justify-between items-center bg-gray-50 dark:bg-[#0d1117]">
            <h2 class="font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            <button
              onClick={props.onClose}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ✕
            </button>
          </div>

          <div class="p-4 space-y-6">
            {/* Theme Section */}
            <div>
              <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                Appearance
              </h3>
              <div class="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('light')}
                  class={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    theme() === 'light'
                      ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-400'
                      : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-[#30363d] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#21262d]'
                  }`}
                >
                  Light
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  class={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    theme() === 'dark'
                      ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-400'
                      : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-[#30363d] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#21262d]'
                  }`}
                >
                  Dark
                </button>
                <button
                  onClick={() => setTheme('system')}
                  class={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                    theme() === 'system'
                      ? 'bg-blue-50 border-blue-500 text-blue-600 dark:bg-blue-900/20 dark:border-blue-400 dark:text-blue-400'
                      : 'bg-white dark:bg-[#0d1117] border-gray-300 dark:border-[#30363d] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#21262d]'
                  }`}
                >
                  System
                </button>
              </div>
            </div>

            {/* Workspace Section */}
            <div>
              <h3 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
                Workspace
              </h3>
              <button
                onClick={() => {
                  props.onChangeFolder()
                  props.onClose()
                }}
                class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium text-sm"
              >
                Change Folder
              </button>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}
