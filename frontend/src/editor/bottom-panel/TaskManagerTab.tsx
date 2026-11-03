import React from 'react'
import { CheckCircle2, Clock, PlayCircle, XCircle, Trash2, StopCircle } from 'lucide-react'
import { useTaskManagerStore } from '../stores/useTaskManagerStore'

export const TaskManagerTab: React.FC = () => {
  const { tasks, cancelTask, clearCompleted } = useTaskManagerStore()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <PlayCircle className="h-3.5 w-3.5 text-primary animate-pulse" />
      case 'completed':
        return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-destructive" />
      default:
        return <Clock className="h-3.5 w-3.5 text-muted-foreground" />
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs">
      <div className="h-7 border-b border-border/80 px-3 flex items-center justify-between bg-secondary/30 shrink-0">
        <span className="text-[11px] font-semibold text-foreground">
          Background Tasks ({tasks.filter((t) => t.status === 'running').length} active)
        </span>

        <button
          onClick={clearCompleted}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Clear Finished
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="p-2.5 rounded-xl border border-border bg-card/60 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {getStatusIcon(task.status)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground truncate">{task.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground uppercase">
                    {task.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono mt-0.5">
                  <span>Started: {task.startedAt}</span>
                  {task.finishedAt && <span>Finished: {task.finishedAt}</span>}
                  {task.error && <span className="text-destructive truncate">{task.error}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {task.progress !== undefined && task.status === 'running' && (
                <div className="w-24 bg-secondary rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              )}

              {task.status === 'running' && (
                <button
                  onClick={() => cancelTask(task.id)}
                  className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-secondary transition-colors"
                  title="Cancel Task"
                >
                  <StopCircle className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-xs">
            No active or recent background tasks.
          </div>
        )}
      </div>
    </div>
  )
}
