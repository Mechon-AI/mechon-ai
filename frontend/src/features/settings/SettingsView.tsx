import React, { useState, useEffect } from 'react'
import {
  Settings,
  Database,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sun,
  Moon,
  FolderOpen
} from 'lucide-react'
import {
  getSettings,
  updateSettings,
  checkDatabaseIntegrity,
  createDatabaseBackup,
  restoreDatabaseBackup
} from '../../services/api'

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [integrityStatus, setIntegrityStatus] = useState<any>(null)
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const res = await getSettings()
      setSettings(res)
    } catch {
      // ignore
    }
  }

  const handleIntegrityCheck = async () => {
    setIsChecking(true)
    try {
      const res = await checkDatabaseIntegrity()
      setIntegrityStatus(res)
    } finally {
      setIsChecking(false)
    }
  }

  const handleBackup = async () => {
    try {
      const res = await createDatabaseBackup()
      setBackupMessage(res.message)
      setTimeout(() => setBackupMessage(null), 3000)
    } catch (err: any) {
      alert(`Backup failed: ${err.message}`)
    }
  }

  const handleRestore = async () => {
    if (confirm('Restore SQLite database from the latest hot backup file?')) {
      try {
        const res = await restoreDatabaseBackup()
        alert(res.message)
      } catch (err: any) {
        alert(`Restore failed: ${err.message}`)
      }
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" /> System Settings & Storage
        </h2>
        <p className="text-xs text-muted-foreground">
          Local SQLite engine controls, integrity audits, and hot offline backups.
        </p>
      </div>

      {/* Database Maintenance Card */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-4 shadow-sm text-xs">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/80 pb-3">
          <Database className="h-4 w-4 text-primary" />
          <span>SQLite Database Health & Operations</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 font-mono text-[11px]">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase">Engine Status</span>
              <span className="text-emerald-400 font-bold">WAL Mode Enabled • Foreign Keys ON</span>
            </div>
            <button
              onClick={handleIntegrityCheck}
              disabled={isChecking}
              className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-semibold text-foreground flex items-center gap-1.5"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {isChecking ? 'Checking...' : 'Run PRAGMA Integrity Check'}
            </button>
          </div>

          {integrityStatus && (
            <div className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
              integrityStatus.is_ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-destructive/10 text-destructive'
            }`}>
              <CheckCircle className="h-4 w-4" />
              <span>Database Integrity: {integrityStatus.status} ({integrityStatus.db_path})</span>
            </div>
          )}

          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleBackup}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" /> Hot Online Backup
            </button>
            <button
              onClick={handleRestore}
              className="px-4 py-2 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-semibold flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5 text-amber-400" /> Restore From Backup
            </button>
          </div>

          {backupMessage && (
            <div className="text-xs text-emerald-400 font-medium">{backupMessage}</div>
          )}
        </div>
      </div>

      {/* Security & Isolation Card */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-3 shadow-sm text-xs">
        <div className="flex items-center gap-2 text-foreground font-bold text-sm border-b border-border/80 pb-3">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Local Isolation & Security Boundary</span>
        </div>

        <div className="space-y-2 text-muted-foreground leading-relaxed">
          <p>
            • <strong>Native Desktop Engine:</strong> In-process Rust core with direct IPC commands and SQLite WAL. No external ports or remote interfaces exposed.
          </p>
          <p>
            • <strong>Zero Telemetry:</strong> No tracking, cloud logging, or remote calls. Dataset files remain on local disk.
          </p>
          <p>
            • <strong>Standards Compliant:</strong> XDG Base Directory specification supported (<code className="text-foreground font-mono">~/.local/share/mechon-ai</code>).
          </p>
        </div>
      </div>

      {/* About Mechon AI System Card */}
      <div className="p-6 rounded-xl bg-card border border-border space-y-4 shadow-sm text-xs">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-3">
            <img src="/mechon-icon.svg" alt="Mechon AI Logo" className="h-6 w-6 drop-shadow-sm" />
            <div>
              <span className="text-sm font-bold text-foreground font-mono">Mechon AI</span>
              <span className="text-[11px] text-primary ml-2 font-medium">Engineer the Data. Shape the Intelligence.</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-secondary border border-border">v1.1.0</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-muted-foreground">
          <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
            <span className="font-semibold text-foreground block">Mechon SFT</span>
            <p className="text-[11px]">Human-in-the-loop multi-turn conversation curation with token accounting, live tree branching, and schema validation.</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
            <span className="font-semibold text-foreground block">Mechon DPO</span>
            <p className="text-[11px]">Direct Preference Optimization pair generator with dual-model sampling, criteria matrices, and pairwise ranking.</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
            <span className="font-semibold text-foreground block">Mechon Corpus</span>
            <p className="text-[11px]">Unified dataset index with full-text search, regex filtering, metadata tags, and duplicate detection.</p>
          </div>
          <div className="p-3 rounded-lg bg-secondary/40 space-y-1">
            <span className="font-semibold text-foreground block">Mechon Train</span>
            <p className="text-[11px]">Planned local offline LoRA/QLoRA trainer integration for native fine-tuning execution.</p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between border-t border-border/60 text-xs text-muted-foreground">
          <span>License: Apache License 2.0</span>
          <a
            href="https://github.com/Mechon-AI/mechon-ai"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline font-mono text-[11px]"
          >
            github.com/Mechon-AI/mechon-ai
          </a>
        </div>
      </div>
    </div>
  )
}
