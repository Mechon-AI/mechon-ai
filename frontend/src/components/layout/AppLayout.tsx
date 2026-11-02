import React, { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquareCode,
  GitCompare,
  Database,
  Terminal,
  ShieldCheck,
  BarChart3,
  History,
  FileDown,
  Cpu,
  Settings,
  Sun,
  Moon,
  ChevronDown,
  Circle,
  Plus,
  Layers,
  Info,
  X,
  ExternalLink,
  Code
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'

export const AppLayout: React.FC = () => {
  const navigate = useNavigate()
  const { projects, activeProjectId, setActiveProjectId, fetchProjects, getActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, isOnline, fetchProviders } = useProviderStore()
  const [isDark, setIsDark] = useState(true)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchProviders()
  }, [])

  const activeProject = getActiveProject()
  const activeProvider = providers.find(p => p.id === activeProviderId)

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle('dark', !isDark)
    document.documentElement.classList.toggle('light', isDark)
  }

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Projects', path: '/projects', icon: FolderKanban },
    { label: 'Mechon SFT', path: '/sft', icon: MessageSquareCode, badge: activeProject?.active_draft_count },
    { label: 'Mechon DPO', path: '/dpo', icon: GitCompare, badge: activeProject?.dpo_task_count },
    { label: 'Mechon Corpus', path: '/datasets', icon: Database },
    { label: 'Model Playground', path: '/playground', icon: Terminal },
    { label: 'Quality Control', path: '/quality', icon: ShieldCheck },
    { label: 'Analytics', path: '/analytics', icon: BarChart3 },
    { label: 'Version History', path: '/versions', icon: History },
    { label: 'Export Center', path: '/export', icon: FileDown },
    { label: 'Provider Manager', path: '/providers', icon: Cpu },
    { label: 'Settings', path: '/settings', icon: Settings },
  ]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 flex flex-col border-r border-border bg-card/60 backdrop-blur-md select-none shrink-0">
        {/* Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-2.5">
            <img src="/mechon-icon.svg" alt="Mechon AI Logo" className="h-7 w-7 drop-shadow-sm" />
            <div>
              <span className="font-bold text-sm tracking-tight block leading-tight font-mono">
                MECHON <span className="text-primary font-normal">AI</span>
              </span>
              <span className="text-[9px] text-muted-foreground font-mono tracking-tighter uppercase block">
                Dataset Workstation
              </span>
            </div>
          </div>
          <button
            onClick={() => setAboutOpen(true)}
            className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded border border-border/60 hover:bg-secondary transition-colors font-mono"
            title="About Mechon AI"
          >
            v1.0
          </button>
        </div>

        {/* Project Selector in Sidebar */}
        <div className="p-3 border-b border-border/70 relative">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5 px-1">
            Active Workspace
          </label>
          <button
            onClick={() => setProjectDropdownOpen(!projectDropdownOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-secondary/70 hover:bg-secondary text-sm border border-border/80 transition-colors text-left"
          >
            <span className="truncate font-medium text-xs">
              {activeProject ? activeProject.name : 'Select a Project'}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
          </button>

          {projectDropdownOpen && (
            <div className="absolute top-full left-3 right-3 mt-1 bg-popover border border-border rounded-lg shadow-xl py-1 z-50">
              <div className="max-h-56 overflow-y-auto">
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActiveProjectId(p.id)
                      setProjectDropdownOpen(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-accent/60 flex items-center justify-between ${
                      p.id === activeProjectId ? 'bg-primary/10 text-primary font-medium' : ''
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {p.sft_record_count + p.dpo_task_count} rec
                    </span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border mt-1 pt-1 px-2">
                <button
                  onClick={() => {
                    setProjectDropdownOpen(false)
                    navigate('/projects')
                  }}
                  className="w-full text-left px-2 py-1.5 text-xs text-primary hover:bg-primary/10 rounded flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Manage Projects
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Navigation List */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {navItems.map(item => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-accent/80 font-mono">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Footer / Provider Status */}
        <div className="p-3 border-t border-border/80 bg-secondary/30">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[11px] text-muted-foreground">Inference:</span>
            <div className="flex items-center gap-1.5">
              <Circle className={`h-2 w-2 fill-current ${isOnline ? 'text-emerald-500' : 'text-amber-500'}`} />
              <span className="text-[11px] font-medium truncate max-w-[100px]">
                {activeProvider?.name || 'Mock LLM'}
              </span>
            </div>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground/80 truncate">
            {activeModel || 'mock-llama-3-8b'}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-border px-6 flex items-center justify-between bg-card/40 backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-foreground">
              {activeProject ? activeProject.name : 'All Projects'}
            </h1>
            {activeProject?.description && (
              <span className="text-xs text-muted-foreground max-w-md truncate hidden md:inline">
                — {activeProject.description}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              100% Local Offline
            </span>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Toggle Theme"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* View Content */}
        <main className="flex-1 overflow-auto bg-background/50">
          <Outlet />
        </main>
      </div>

      {/* About Mechon AI Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <button
              onClick={() => setAboutOpen(false)}
              className="absolute right-4 top-4 p-1.5 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3.5 pb-4 border-b border-border/80">
              <img src="/mechon-icon.svg" alt="Mechon AI Logo" className="h-10 w-10 drop-shadow-md" />
              <div>
                <h3 className="text-base font-bold text-foreground font-mono">MECHON AI</h3>
                <p className="text-[11px] text-primary font-medium tracking-wide">
                  Engineer the Data. Shape the Intelligence.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-muted-foreground leading-relaxed">
              <p>
                <strong>Mechon AI</strong> is a professional, local-first desktop workstation for engineering high-quality AI training datasets, specializing in Supervised Fine-Tuning (SFT) and Direct Preference Optimization (DPO).
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px] py-1">
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60">
                  <span className="font-semibold text-foreground block">Mechon SFT</span>
                  <span className="text-[10px]">Multi-turn conversation curation</span>
                </div>
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60">
                  <span className="font-semibold text-foreground block">Mechon DPO</span>
                  <span className="text-[10px]">Pairwise preference alignment</span>
                </div>
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60">
                  <span className="font-semibold text-foreground block">Mechon Corpus</span>
                  <span className="text-[10px]">Unified dataset repository</span>
                </div>
                <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/60">
                  <span className="font-semibold text-foreground block">Mechon Train</span>
                  <span className="text-[10px]">Local fine-tuning pipeline (Planned)</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-secondary/30 border border-border/70 text-[10px] space-y-1 font-mono">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="text-foreground">1.0.0 (Release)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Architecture:</span>
                  <span className="text-foreground">Tauri 2 • React • Python 3.11 • SQLite WAL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Security:</span>
                  <span className="text-emerald-400">100% Local Loopback (Zero Telemetry)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">License:</span>
                  <span className="text-foreground">Apache-2.0</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-border/60 text-xs">
                <a
                  href="https://github.com/Mechon-AI"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> github.com/Mechon-AI
                </a>
                <button
                  onClick={() => setAboutOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent text-foreground font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
