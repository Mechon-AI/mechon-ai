export interface EditorCommand {
  id: string
  title: string
  category: 'File' | 'Edit' | 'View' | 'Project' | 'Tools' | 'Window' | 'Help'
  description?: string
  shortcut?: string
  handler: () => any | Promise<any>
  isAvailable?: () => boolean
}

let commandRegistry: EditorCommand[] = []

export function registerCommand(command: EditorCommand) {
  const index = commandRegistry.findIndex((c) => c.id === command.id)
  if (index !== -1) {
    commandRegistry[index] = command
  } else {
    commandRegistry.push(command)
  }
}

export function registerCommands(commands: EditorCommand[]) {
  commands.forEach(registerCommand)
}

export function unregisterCommand(id: string) {
  commandRegistry = commandRegistry.filter((c) => c.id !== id)
}

export function getCommands(): EditorCommand[] {
  return commandRegistry.filter((c) => (c.isAvailable ? c.isAvailable() : true))
}

export function executeCommand(id: string) {
  const cmd = commandRegistry.find((c) => c.id === id)
  if (cmd && (!cmd.isAvailable || cmd.isAvailable())) {
    cmd.handler()
  }
}
