import { exec } from 'child_process'
import { promisify } from 'util'
import * as os from 'os'

const execAsync = promisify(exec)

export async function shell_exec(args: { command: string }) {
  try {
    const { stdout, stderr } = await execAsync(args.command)
    if (stderr && !stdout) {
      return `Stderr: ${stderr}`
    }
    return stdout + (stderr ? `\nStderr: ${stderr}` : '')
  } catch (error: any) {
    return `Error: ${error.message}\n${error.stderr || ''}`
  }
}

export async function system_open(args: { target: string, app?: string }) {
  const platform = os.platform()
  let command = ''

  if (platform === 'darwin') {
    command = `open "${args.target}"`
    if (args.app) {
      command += ` -a "${args.app}"`
    }
  } else if (platform === 'linux') {
    command = `xdg-open "${args.target}"`
  } else if (platform === 'win32') {
    command = `start "${args.target}"`
  } else {
    return 'Error: Unsupported platform for system_open'
  }

  try {
    await execAsync(command)
    return `Opened: ${args.target}`
  } catch (error: any) {
    return `Error opening target: ${error.message}`
  }
}

export async function system_notify(args: { message: string, title?: string }) {
  const platform = os.platform()
  const title = args.title || 'Personal Agent'
  
  // Sanitize inputs to prevent injection (basic)
  const safeMessage = args.message.replace(/"/g, '\\"')
  const safeTitle = title.replace(/"/g, '\\"')

  let command = ''

  if (platform === 'darwin') {
    command = `osascript -e 'display notification "${safeMessage}" with title "${safeTitle}"'`
  } else {
    // Linux/Windows fallback (mock for now or console log)
    console.log(`[Notification] ${title}: ${args.message}`)
    return `Notification logged (OS not fully supported): ${args.message}`
  }

  try {
    await execAsync(command)
    return `Notification sent.`
  } catch (error: any) {
    return `Error sending notification: ${error.message}`
  }
}
