import React, { useState, useEffect } from 'react'
import {
  FolderKanban,
  Plus,
  Copy,
  Archive,
  Trash2,
  CheckCircle2,
  ExternalLink,
  MessageSquareCode,
  GitCompare
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import {
  createProject,
  deleteProject,
  duplicateProject,
  updateProject
} from '../../services/api'

export const ProjectsView: React.FC = () => {
  const { projects, activeProjectId, setActiveProjectId, fetchProjects } = useProjectStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      const created = await createProject({ name, description })
      await fetchProjects()
      setActiveProjectId(created.id)
      setShowCreateModal(false)
      setName('')
      setDescription('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDuplicate = async (projectId: string) => {
    await duplicateProject(projectId)
    await fetchProjects()
  }

  const handleArchive = async (projectId: string, current: boolean) => {
    await updateProject(projectId, { is_archived: !current })
    await fetchProjects()
  }

  const handleDelete = async (projectId: string) => {
    if (confirm('Are you sure you want to delete this project and all its datasets? This cannot be undone.')) {
      await deleteProject(projectId)
      await fetchProjects()
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Project Management</h2>
          <p className="text-xs text-muted-foreground">
            Isolated environments for SFT conversations, DPO pairs, model configs, and version snapshots.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map(p => {
          const isActive = p.id === activeProjectId
          return (
            <div
              key={p.id}
              className={`p-5 rounded-xl bg-card border transition-all flex flex-col justify-between ${
                isActive ? 'border-primary ring-1 ring-primary/40 shadow-md' : 'border-border hover:border-border/80'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate max-w-[200px]">{p.name}</h3>
                      {isActive && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-primary/20 text-primary border border-primary/30 rounded">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {p.description || 'No description provided.'}
                    </p>
                  </div>

                  <FolderKanban className={`h-5 w-5 shrink-0 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </div>

                {/* Counts */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/60">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                    <MessageSquareCode className="h-3.5 w-3.5 text-primary" />
                    <div>
                      <div className="font-mono font-bold">{p.sft_record_count}</div>
                      <div className="text-[10px] text-muted-foreground">SFT Records</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 text-xs">
                    <GitCompare className="h-3.5 w-3.5 text-indigo-400" />
                    <div>
                      <div className="font-mono font-bold">{p.dpo_task_count}</div>
                      <div className="text-[10px] text-muted-foreground">DPO Tasks</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-4 mt-4 border-t border-border/80 flex items-center justify-between">
                {!isActive ? (
                  <button
                    onClick={() => setActiveProjectId(p.id)}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    Select Project
                  </button>
                ) : (
                  <span className="text-xs font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(p.id)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Duplicate Project"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchive(p.id, p.is_archived)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title={p.is_archived ? 'Unarchive' : 'Archive'}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    title="Delete Project"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold">Create New Dataset Project</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ChatML Math & Reasoning"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Goals, target model family, licensing, or notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-secondary border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
