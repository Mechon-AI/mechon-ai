import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  FileDown,
  Upload,
  FileCode,
  Download,
  Copy,
  Check,
  RefreshCw,
  Eye,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Languages
} from 'lucide-react'
import { useProjectStore } from '../../stores/useProjectStore'
import { useSelectionStore } from '../../stores/useSelectionStore'
import {
  exportSFTDataset,
  exportDPODataset,
  importDatasetFile,
  exportDatasetToFile,
  exportConversationalDPO,
  listDatasetSplits,
  type ExportToFileResult
} from '../../services/api'
import type { SplitSummary } from '../../types'
import { formatErrorMessage } from '../../utils/errors'

export const ExportCenterView: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { activeProjectId, getActiveProject, ensureActiveProject } = useProjectStore()
  const { selectedSftIds, selectedDpoIds } = useSelectionStore()
  const activeProject = getActiveProject()

  const initialPipeline = searchParams.get('pipeline') === 'dpo' ? 'dpo' : 'sft'
  const initialSource = searchParams.get('source') === 'selected' ? 'selected' : 'entire'

  const [pipeline, setPipeline] = useState<'sft' | 'dpo'>(initialPipeline)
  const [exportSource, setExportSource] = useState<'entire' | 'selected'>(initialSource)
  const [bilingualMode, setBilingualMode] = useState<'canonical_aligned' | 'primary_only' | 'secondary_only'>('canonical_aligned')
  const [dpoFormat, setDpoFormat] = useState<'standard' | 'conversational'>('conversational')
  const [format, setFormat] = useState('jsonl')
  const [includeMetadata, setIncludeMetadata] = useState(true)
  const [previewContent, setPreviewContent] = useState('')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [copied, setCopied] = useState(false)
  const [availableSplits, setAvailableSplits] = useState<SplitSummary[]>([])

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importReport, setImportReport] = useState<any>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const selectedCount = pipeline === 'sft' ? selectedSftIds.length : selectedDpoIds.length
  const isSelectiveEmpty = exportSource === 'selected' && selectedCount === 0

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    initView()
  }, [activeProjectId, pipeline, dpoFormat, format, includeMetadata, exportSource, bilingualMode, selectedSftIds, selectedDpoIds])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadSplits(pId)
      loadPreview(pId)
    }
  }

  const loadSplits = async (pId: string) => {
    try {
      const splits = await listDatasetSplits(pId)
      setAvailableSplits(splits)
    } catch (e) {
      // ignore
    }
  }

  const loadPreview = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return

    if (exportSource === 'selected' && selectedCount === 0) {
      setPreviewContent('(No examples selected. Select records from Mechon Corpus first to use selective export.)')
      return
    }

    setIsLoadingPreview(true)
    try {
      let text = ''
      const targetIds = exportSource === 'selected' ? (pipeline === 'sft' ? selectedSftIds : selectedDpoIds) : undefined

      if (pipeline === 'sft') {
        text = await exportSFTDataset(targetProject, format, includeMetadata, targetIds, bilingualMode)
      } else if (dpoFormat === 'conversational') {
        text = await exportConversationalDPO(targetProject, format, true)
      } else {
        text = await exportDPODataset(targetProject, format, includeMetadata, true, targetIds)
      }
      setPreviewContent(text || '(No matching records in this dataset. Create and commit records first.)')
    } catch (err: any) {
      setPreviewContent(`Export preview: ${formatErrorMessage(err)}`)
    } finally {
      setIsLoadingPreview(false)
    }
  }

  const [isExporting, setIsExporting] = useState(false)
  const [lastExportResult, setLastExportResult] = useState<ExportToFileResult | null>(null)

  const handleExportToFile = async () => {
    if (isSelectiveEmpty) {
      showFeedback('error', 'No examples selected. Select records from Mechon Corpus first.')
      return
    }

    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (!pId) {
      showFeedback('error', 'No active project selected.')
      return
    }

    setIsExporting(true)
    try {
      const targetIds = exportSource === 'selected' ? (pipeline === 'sft' ? selectedSftIds : selectedDpoIds) : undefined

      const res = await exportDatasetToFile({
        project_id: pId,
        pipeline,
        format_type: format,
        include_metadata: includeMetadata,
        only_completed: true,
        record_ids: targetIds,
        bilingual_mode: bilingualMode
      })

      if (res.cancelled) {
        showFeedback('error', 'Export was cancelled (no file selected).')
        return
      }

      if (res.success && res.file_path) {
        setLastExportResult(res)
        showFeedback(
          'success',
          `Successfully exported ${res.record_count} records to ${res.file_path} (${res.file_size_bytes} bytes). Integrity verified.`
        )
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Export failed'))
    } finally {
      setIsExporting(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(previewContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeProjectId || !importFile) return
    setIsImporting(true)
    try {
      const res = await importDatasetFile(activeProjectId, importFile)
      setImportReport(res)
      setImportFile(null)
      loadPreview()
      showFeedback('success', `Import completed: ${res.total_imported || 0} records imported successfully.`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Import failed'))
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
          <FileDown className="h-5 w-5 text-primary" /> Import & Export Center
        </h2>
        <p className="text-xs text-muted-foreground">
          Export verified fine-tuning and alignment datasets in canonical JSONL, JSON, CSV formats, or export selective records.
        </p>
      </div>

      {notification && (
        <div
          className={`px-4 py-2.5 rounded-lg text-xs flex items-center justify-between border ${
            notification.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-0.5 hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Export Pipeline Controls */}
        <div className="space-y-4">
          <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block">
              1. Select Pipeline
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPipeline('sft')}
                className={`py-2 rounded-lg font-medium border text-xs transition-all ${
                  pipeline === 'sft'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary hover:bg-accent border-border text-muted-foreground'
                }`}
              >
                SFT Conversations
              </button>
              <button
                onClick={() => setPipeline('dpo')}
                className={`py-2 rounded-lg font-medium border text-xs transition-all ${
                  pipeline === 'dpo'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary hover:bg-accent border-border text-muted-foreground'
                }`}
              >
                DPO Pairs (TRL)
              </button>
            </div>

            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block pt-2 border-t border-border">
              2. Export Scope
            </span>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setExportSource('entire')}
                className={`py-2 rounded-lg font-medium border text-xs transition-all ${
                  exportSource === 'entire'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary hover:bg-accent border-border text-muted-foreground'
                }`}
              >
                Entire Corpus
              </button>
              <button
                onClick={() => setExportSource('selected')}
                className={`py-2 rounded-lg font-medium border text-xs transition-all relative ${
                  exportSource === 'selected'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary hover:bg-accent border-border text-muted-foreground'
                }`}
              >
                Selected Examples ({selectedCount})
              </button>
            </div>

            {isSelectiveEmpty && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  No examples selected. Go to <strong>Mechon Corpus</strong> to select individual records first.
                </span>
              </div>
            )}

            {pipeline === 'sft' && (
              <>
                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block pt-2 border-t border-border">
                  3. Bilingual Dataset Mode
                </span>
                <div className="space-y-1.5">
                  {[
                    { id: 'canonical_aligned', label: 'Aligned Bilingual (Canonical v2.0)', desc: 'Canonical multilingual schema with full language metadata & translations map' },
                    { id: 'primary_only', label: 'Primary Language Only', desc: 'Export source language conversations only' },
                    { id: 'secondary_only', label: 'Secondary Language Only', desc: 'Export target translated conversations only' }
                  ].map(m => (
                    <label key={m.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer">
                      <input
                        type="radio"
                        name="bilingualMode"
                        value={m.id}
                        checked={bilingualMode === m.id}
                        onChange={() => setBilingualMode(m.id as any)}
                        className="accent-primary"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold">{m.label}</span>
                        <span className="text-[10px] text-muted-foreground">{m.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            {pipeline === 'dpo' && (
              <>
                <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block pt-2 border-t border-border">
                  3. Preference Schema Format
                </span>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="dpoFormat"
                      value="conversational"
                      checked={dpoFormat === 'conversational'}
                      onChange={() => setDpoFormat('conversational')}
                      className="accent-primary"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">Conversational DPO (TRL Schema)</span>
                      <span className="text-[10px] text-muted-foreground">
                        prompt: [...], chosen: [...], rejected: [...]
                      </span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer">
                    <input
                      type="radio"
                      name="dpoFormat"
                      value="standard"
                      checked={dpoFormat === 'standard'}
                      onChange={() => setDpoFormat('standard')}
                      className="accent-primary"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold">Flat Preference Pairs</span>
                      <span className="text-[10px] text-muted-foreground">
                        instruction / prompt, response_chosen, response_rejected
                      </span>
                    </div>
                  </label>
                </div>
              </>
            )}

            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block pt-2 border-t border-border">
              {pipeline === 'sft' ? '4.' : '4.'} Target Format
            </span>

            <div className="space-y-1.5">
              {['jsonl', 'json', 'csv', 'txt'].map(f => (
                <label key={f} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 hover:bg-secondary cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                    className="accent-primary"
                  />
                  <span className="font-mono uppercase text-xs font-semibold">{f}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {f === 'jsonl' ? 'Standard Training' : f === 'json' ? 'Raw Array' : f === 'csv' ? 'Spreadsheet' : 'Plain Text'}
                  </span>
                </label>
              ))}
            </div>

            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block pt-2 border-t border-border">
              {pipeline === 'sft' ? '5.' : '4.'} Metadata Options
            </span>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMetadata}
                onChange={e => setIncludeMetadata(e.target.checked)}
                className="accent-primary rounded"
              />
              <span>Include Provenance & Tags Metadata</span>
            </label>

            <button
              onClick={handleExportToFile}
              disabled={isLoadingPreview || isExporting || isSelectiveEmpty}
              className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 pt-2 cursor-pointer"
            >
              <Download className={`h-4 w-4 ${isExporting ? 'animate-spin' : ''}`} />
              {isExporting ? 'Exporting to File...' : exportSource === 'selected' ? `Export ${selectedCount} Selected (Native Dialog)` : 'Export Entire Dataset (Native Dialog)'}
            </button>

            {lastExportResult && lastExportResult.success && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> File Written & Verified!
                </div>
                <div className="truncate font-mono text-[10px] text-foreground" title={lastExportResult.file_path}>
                  {lastExportResult.file_path}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lastExportResult.record_count} records • {lastExportResult.file_size_bytes} bytes
                </div>
              </div>
            )}
          </div>

          {/* Import Card */}
          <div className="p-5 rounded-xl bg-card border border-border space-y-3 shadow-sm text-xs">
            <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block flex items-center gap-1.5">
              <Upload className="h-3.5 w-3.5 text-primary" /> Import Dataset File
            </span>

            <form onSubmit={handleImport} className="space-y-3">
              <input
                type="file"
                accept=".jsonl,.json,.csv"
                onChange={e => setImportFile(e.target.files ? e.target.files[0] : null)}
                className="w-full text-[11px] text-muted-foreground file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-border file:text-xs file:bg-secondary hover:file:bg-accent cursor-pointer"
              />

              <button
                type="submit"
                disabled={!importFile || isImporting}
                className="w-full py-2 rounded-lg bg-secondary hover:bg-accent border border-border text-xs font-semibold text-foreground flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? 'Parsing & Importing...' : 'Upload & Import'}
              </button>
            </form>

            {importReport && (
              <div className="p-3 rounded-lg bg-secondary/50 border border-border text-[11px] space-y-1 font-mono text-muted-foreground">
                <div className="text-emerald-400 font-bold">Import Complete!</div>
                <div>SFT Records: +{importReport.imported_sft_records}</div>
                <div>DPO Tasks: +{importReport.imported_dpo_tasks}</div>
                <div>Skipped: {importReport.skipped_records}</div>
              </div>
            )}
          </div>
        </div>

        {/* Live Schema & Content Preview */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-card border border-border flex flex-col justify-between shadow-sm min-h-[460px]">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/80 pb-2">
              <div className="flex items-center gap-2">
                <FileCode className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Live Output Preview ({format.toUpperCase()} • {exportSource === 'selected' ? `Selected (${selectedCount})` : 'Entire'})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => loadPreview()}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                  title="Refresh Preview"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={handleCopy}
                  className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground text-xs flex items-center gap-1 cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <pre className="p-4 rounded-xl bg-secondary/50 border border-border text-[11px] font-mono overflow-auto max-h-[460px] whitespace-pre-wrap leading-relaxed text-foreground/90">
              {isLoadingPreview ? 'Generating export preview...' : previewContent || 'Dataset is empty.'}
            </pre>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground font-mono">
            <span>Encoding: UTF-8</span>
            <span>Lines: {previewContent ? previewContent.split('\n').length : 0}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
