import * as fs from 'fs/promises'

export async function fs_read_file(args: { path: string }) {
  // Security check: ensure path is absolute (or whatever policy we want)
  // For now, raw access as "Personal OS" implies owner access.
  return await fs.readFile(args.path, 'utf8')
}

export async function fs_write_file(args: { path: string; content: string }) {
  await fs.writeFile(args.path, args.content, 'utf8')
  return `Successfully wrote to ${args.path}`
}

export async function fs_list_dir(args: { path: string }) {
  const files = await fs.readdir(args.path)
  return files.join('\n')
}
