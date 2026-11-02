import React, { useState, useEffect } from 'react'
import {
  FolderKanban,
  Plus,
  Copy,
  Archive,
  Trash2,
  CheckCircle2,
  Edit2,
  ExternalLink,
  MessageSquareCode,
  GitCompare,
  X,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import {
  createProject,
  deleteProject,
  duplicateProject,
  updateProject
} from '../../services/api'
import type { Project } from '../../types'

export const ProjectsView: React.FC = () => {
  const { projects, activeProjectId, setActiveProjectId, fetchProjects } = useProjectStore()
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const openCreateModal = () => {
    setName('')
    setDescription('')
    setShowCreateModal(true)
  }

  const openRenameModal = (p: Project) => {
    setEditingProject(p)
    setName(p.name)
    setDescription(p.description || '')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      const created = await createProject({ name: name.trim(), description: description.trim() })
      await fetchProjects()
      setActiveProjectId(created.id)
      setShowCreateModal(false)
      setName('')
      setDescription('')
      showFeedback('success', `Project "${created.name}" created and set as active.`)
    } catch (err: any) {
      showFeedback('error', `Failed to create project: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject || !name.trim()) return
    setIsSubmitting(true)
    try {
      await updateProject(editingProject.id, {
        name: name.trim(),
        description: description.trim()
      })
      await fetchProjects()
      setEditingProject(null)
      showFeedback('success', `Project updated successfully.`)
    } catch (err: any) {
      showFeedback('error', `Failed to update project: ${err.message}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDuplicate = async (projectId: string) => {
    try {
      const cloned = await duplicateProject(projectId)
      await fetchProjects()
      showFeedback('success', `Project duplicated as "${cloned.name}".`)
    } catch (err: any) {
      showFeedback('error', `Duplicate failed: ${err.message}`)
    }
  }

  const handleArchive = async (projectId: string, current: boolean) => {
    try {
      await updateProject(projectId, { is_archived: !current })
      await fetchProjects()
      showFeedback('success', `Project ${current ? 'unarchived' : 'archived'}.`)
    } catch (err: any) {
      showFeedback('error', `Archive failed: ${err.message}`)
    }
  }

  const handleDelete = async (projectId: string, projectName: string) => {
    if (confirm(`Are you sure you want to delete project "${projectName}" and all its SFT/DPO dataset records? This action is permanent.`)) {
      try {
        await deleteProject(projectId)
        await fetchProjects()
        showFeedback('success', `Project "${projectName}" deleted.`)
      } catch (err: any) {
        showFeedback('error', `Delete failed: ${err.message}`)
      }
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Project Workspaces</h2>
          <p className="text-xs text-muted-foreground">
            Isolated environments for SFT conversations, DPO pairs, model configs, and version snapshots.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4" /> New Project
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between border shadow-sm ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-destructive/10 text-destructive border-destructive/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-75">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

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
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm truncate">{p.name}</h3>
                      {isActive && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/20 text-primary border border-primary/30 rounded uppercase font-mono">
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
              <div className="pt-4 mt-4 border-t border-border/80 flex items-center justify-between text-xs">
                {!isActive ? (
                  <button
                    onClick={() => {
                      setActiveProjectId(p.id)
                      showFeedback('success', `Switched active workspace to "${p.name}".`)
                    }}
                    className="font-semibold text-primary hover:underline"
                  >
                    Select Project
                  </button>
                ) : (
                  <span className="font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Selected
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openRenameModal(p)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename / Edit Project"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(p.id)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Duplicate Project"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleArchive(p.id, p.is_archived)}
                    className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title={p.is_archived ? 'Unarchive Project' : 'Archive Project'}
                  >
                    <Archive className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">Create New Dataset Project</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Reasoning SFT & DPO Alignment"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="Objectives, target model family, licensing, or methodology notes..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-secondary border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename / Edit Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <h3 className="text-base font-bold text-foreground">Rename / Edit Project</h3>
              <button onClick={() => setEditingProject(null)} className="p-1 rounded-lg hover:bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Project Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-secondary border border-border"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !name.trim()}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shadow-sm"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
