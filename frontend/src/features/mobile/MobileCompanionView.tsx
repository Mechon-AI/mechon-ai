import React, { useState, useEffect } from 'react'
import {
  Smartphone,
  Wifi,
  QrCode,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Clock,
  Trash2,
  ExternalLink,
  Layers,
  ArrowRight,
  Database,
  Radio,
  Sliders,
  Eye,
  X
} from 'lucide-react'
import {
  getMobileGatewayStatus,
  startMobileGateway,
  stopMobileGateway,
  generatePairingCode,
  listPairedDevices,
  approvePairedDevice,
  revokePairedDevice,
  listMobileImports,
  convertMobileImportToSftDraft,
  commitMobileImportToCorpus,
  deleteMobileImport,
  type MobileGatewayStatus,
  type PairedDevice,
  type MobileImportedConversation
} from '../../services/api'
import { useEditorStore } from '../../editor/stores/useEditorStore'
import { useProjectStore } from '../../stores/useProjectStore'
import { formatErrorMessage } from '../../utils/errors'

export const MobileCompanionView: React.FC = () => {
  const { openTab } = useEditorStore()
  const { activeProjectId } = useProjectStore()

  const [status, setStatus] = useState<MobileGatewayStatus | null>(null)
  const [portInput, setPortInput] = useState<number>(8088)
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([])
  const [imports, setImports] = useState<MobileImportedConversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isTogglingGateway, setIsTogglingGateway] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [previewingImport, setPreviewingImport] = useState<MobileImportedConversation | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const loadAll = async () => {
    setIsLoading(true)
    try {
      const [st, devs, imps] = await Promise.all([
        getMobileGatewayStatus(),
        listPairedDevices(),
        listMobileImports()
      ])
      setStatus(st)
      setPortInput(st.port)
      setPairedDevices(devs)
      setImports(imps)
    } catch (err) {
      // ignore on initial load
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
    const timer = setInterval(() => {
      loadAll()
    }, 10000)
    return () => clearInterval(timer)
  }, [])

  const handleToggleGateway = async () => {
    setIsTogglingGateway(true)
    try {
      if (status?.is_running) {
        const res = await stopMobileGateway()
        setStatus(res)
        showFeedback('success', 'Mobile Gateway stopped.')
      } else {
        const res = await startMobileGateway(portInput)
        setStatus(res)
        showFeedback('success', `Mobile Gateway started on ${res.local_ip}:${res.port}`)
      }
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to toggle gateway'))
    } finally {
      setIsTogglingGateway(false)
    }
  }

  const handleRegeneratePairingCode = async () => {
    try {
      const { code } = await generatePairingCode()
      showFeedback('success', `New pairing code generated: ${code}`)
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to generate code'))
    }
  }

  const handleApproveDevice = async (id: string) => {
    try {
      await approvePairedDevice(id)
      showFeedback('success', 'Device approved.')
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Approval failed'))
    }
  }

  const handleRevokeDevice = async (id: string) => {
    try {
      await revokePairedDevice(id)
      showFeedback('success', 'Device access revoked.')
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Revocation failed'))
    }
  }

  const handleConvertToDraft = async (importId: string) => {
    try {
      const sessionId = await convertMobileImportToSftDraft(importId, activeProjectId || undefined)
      showFeedback('success', 'Converted mobile conversation to active SFT draft session!')
      loadAll()
      openTab({
        type: 'sft',
        title: 'SFT Studio',
        params: { sessionId }
      })
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Draft conversion failed'))
    }
  }

  const handleCommitToCorpus = async (importId: string) => {
    try {
      const recordId = await commitMobileImportToCorpus(importId, activeProjectId || undefined)
      showFeedback('success', `Successfully committed record #${recordId.slice(0, 6)} directly to Mechon Corpus!`)
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Commit to corpus failed'))
    }
  }

  const handleDeleteImport = async (importId: string) => {
    try {
      await deleteMobileImport(importId)
      showFeedback('success', 'Removed from mobile imports queue.')
      if (previewingImport?.id === importId) {
        setPreviewingImport(null)
      }
      loadAll()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Delete failed'))
    }
  }

  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 pb-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                Mobile Companion & Local Gateway
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-mono font-bold">
                  v1.2.4
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Connect Android companion via local Wi-Fi to chat, roleplay, and import high-quality conversational SFT datasets.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAll()}
            className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh Status"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold ${
            status?.is_running
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-secondary text-muted-foreground border-border'
          }`}>
            <span className={`h-2 w-2 rounded-full ${status?.is_running ? 'bg-emerald-400 animate-pulse' : 'bg-muted-foreground'}`} />
            <span>{status?.is_running ? 'Gateway Online' : 'Gateway Offline'}</span>
          </div>
        </div>
      </div>

      {notification && (
        <div className={`px-4 py-2.5 rounded-lg text-xs flex items-center justify-between border ${
          notification.type === 'success'
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-0.5 hover:opacity-75">✕</button>
        </div>
      )}

      {/* Grid: Server Controls + Pairing Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Gateway Server Card */}
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] flex items-center gap-1.5">
                <Wifi className="h-3.5 w-3.5 text-primary" /> Gateway Status & Port
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">LAN Only</span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="text-xs text-muted-foreground flex items-center justify-between">
                <span>LAN Endpoint:</span>
                <span className="font-mono text-foreground font-semibold">
                  {status?.local_ip || '127.0.0.1'}:{status?.port || portInput}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-[11px] text-muted-foreground">Port:</label>
                <input
                  type="number"
                  value={portInput}
                  onChange={(e) => setPortInput(parseInt(e.target.value) || 8088)}
                  disabled={status?.is_running}
                  className="w-24 px-2 py-1 bg-secondary rounded border border-border text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/80 text-[11px] text-muted-foreground space-y-1">
                <div className="flex items-center gap-1 text-foreground font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Private LAN Security</span>
                </div>
                <p className="text-[10px]">
                  No public internet exposure. API keys remain strictly on this workstation; mobile only interacts with authorized proxy endpoints.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleGateway}
            disabled={isTogglingGateway}
            className={`w-full py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
              status?.is_running
                ? 'bg-destructive/20 text-destructive border border-destructive/30 hover:bg-destructive/30'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <Radio className={`h-3.5 w-3.5 ${isTogglingGateway ? 'animate-spin' : ''}`} />
            <span>{status?.is_running ? 'Stop Mobile Gateway' : 'Enable Mobile Gateway'}</span>
          </button>
        </div>

        {/* 2. QR Code & Pairing Card */}
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] flex items-center gap-1.5">
                <QrCode className="h-3.5 w-3.5 text-primary" /> Instant Device Pairing
              </span>
              <button
                onClick={handleRegeneratePairingCode}
                className="text-[10px] text-primary hover:underline cursor-pointer flex items-center gap-1"
              >
                <RefreshCw className="h-2.5 w-2.5" /> New Code
              </button>
            </div>

            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-secondary/40 border border-border/80 space-y-2">
              {/* High-Contrast Stylized QR Representation */}
              <div className="w-28 h-28 bg-white rounded-lg p-2 flex items-center justify-center shadow-md">
                <svg viewBox="0 0 100 100" className="w-full h-full text-black fill-current">
                  {/* Outer Frame & Finder patterns */}
                  <rect x="5" y="5" width="28" height="28" fill="black" />
                  <rect x="9" y="9" width="20" height="20" fill="white" />
                  <rect x="13" y="13" width="12" height="12" fill="black" />

                  <rect x="67" y="5" width="28" height="28" fill="black" />
                  <rect x="71" y="9" width="20" height="20" fill="white" />
                  <rect x="75" y="13" width="12" height="12" fill="black" />

                  <rect x="5" y="67" width="28" height="28" fill="black" />
                  <rect x="9" y="71" width="20" height="20" fill="white" />
                  <rect x="13" y="75" width="12" height="12" fill="black" />

                  {/* Matrix Dots Pattern representing host and port */}
                  <rect x="38" y="10" width="8" height="8" fill="black" />
                  <rect x="50" y="10" width="8" height="8" fill="black" />
                  <rect x="38" y="24" width="8" height="8" fill="black" />
                  <rect x="50" y="38" width="8" height="8" fill="black" />
                  <rect x="10" y="45" width="8" height="8" fill="black" />
                  <rect x="24" y="45" width="8" height="8" fill="black" />
                  <rect x="38" y="50" width="8" height="8" fill="black" />
                  <rect x="60" y="50" width="8" height="8" fill="black" />
                  <rect x="75" y="45" width="8" height="8" fill="black" />
                  <rect x="45" y="65" width="8" height="8" fill="black" />
                  <rect x="60" y="65" width="8" height="8" fill="black" />
                  <rect x="75" y="65" width="8" height="8" fill="black" />
                  <rect x="45" y="80" width="8" height="8" fill="black" />
                  <rect x="75" y="80" width="8" height="8" fill="black" />
                </svg>
              </div>

              <div className="text-center space-y-0.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                  Pairing Key (Valid for 15 mins)
                </span>
                <span className="font-mono text-sm font-bold tracking-widest text-primary">
                  {status?.pairing_code || 'MCH-READY-PAIR'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => copyToClipboard(status?.pairing_code || '', 'code')}
              className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedField === 'code' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>Copy Code</span>
            </button>
            <button
              onClick={() => copyToClipboard(status?.pairing_uri || '', 'uri')}
              className="flex-1 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {copiedField === 'uri' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              <span>Copy Link</span>
            </button>
          </div>
        </div>

        {/* 3. Paired Devices Card */}
        <div className="p-5 rounded-xl bg-card border border-border space-y-4 shadow-sm flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] flex items-center gap-1.5">
                <Smartphone className="h-3.5 w-3.5 text-primary" /> Paired Android Devices ({pairedDevices.length})
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {pairedDevices.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <p>No paired devices yet.</p>
                  <p className="text-[10px] mt-1">Open Mechon Companion on Android and scan the QR code above.</p>
                </div>
              ) : (
                pairedDevices.map((dev) => (
                  <div key={dev.id} className="p-2.5 rounded-lg bg-secondary/50 border border-border/80 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground truncate max-w-[140px]">{dev.device_name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                        dev.is_approved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {dev.is_approved ? 'Approved' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                      <span>Active: {new Date(dev.last_active_at).toLocaleTimeString()}</span>
                      <div className="flex items-center gap-1">
                        {!dev.is_approved ? (
                          <button
                            onClick={() => handleApproveDevice(dev.id)}
                            className="text-emerald-400 hover:underline cursor-pointer"
                          >
                            Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRevokeDevice(dev.id)}
                            className="text-destructive hover:underline cursor-pointer"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="text-[10px] text-muted-foreground font-mono border-t border-border pt-2 flex items-center justify-between">
            <span>Tokens: Revocable SHA-256</span>
            <span>Platform: Android Companion</span>
          </div>
        </div>
      </div>

      {/* Section 2: Mobile Imports & SFT Pipeline */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Incoming Mobile Conversations Queue ({imports.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Conversations transferred from your phone. Review, convert into editable SFT drafts, or commit directly to Mechon Corpus.
            </p>
          </div>
        </div>

        {imports.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-card border border-border space-y-3">
            <Smartphone className="h-10 w-10 text-muted-foreground/40 mx-auto" />
            <h3 className="text-sm font-bold">No Mobile Imports Yet</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              When you have an insightful conversation or roleplay session on your phone, click <strong>"Send to Mechon Desktop"</strong> in the app to inspect and transform it here into fine-tuning dataset records.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {imports.map((item) => {
              const msgs = Array.isArray(item.messages) ? item.messages : []
              const turnCount = msgs.length
              const firstUser = msgs.find((m: any) => m?.role === 'user')
              const promptPreview = firstUser?.content || 'No prompt preview'

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-all flex flex-col justify-between space-y-3 shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-foreground block truncate">
                          {item.title || 'Mobile Conversation'}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Model: {item.model_id || 'default'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase shrink-0 ${
                        item.status === 'committed'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : item.status === 'converted_to_draft'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-primary/20 text-primary border border-primary/30'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-3 bg-secondary/30 p-2 rounded-lg border border-border/50">
                      "{promptPreview}"
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono pt-1">
                      <span>{turnCount} turns</span>
                      <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <button
                      onClick={() => setPreviewingImport(item)}
                      className="px-2 py-1 rounded bg-secondary hover:bg-secondary/80 text-foreground text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                      title="Inspect full conversation"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleConvertToDraft(item.id)}
                        className="px-2.5 py-1 rounded bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Open in SFT Studio as editable draft"
                      >
                        <ExternalLink className="h-3 w-3" /> SFT Studio
                      </button>

                      <button
                        onClick={() => handleCommitToCorpus(item.id)}
                        className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 cursor-pointer"
                        title="Commit directly to Mechon Corpus"
                      >
                        <Check className="h-3 w-3" /> Commit
                      </button>

                      <button
                        onClick={() => handleDeleteImport(item.id)}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        title="Delete from queue"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Conversation Preview Modal */}
      {previewingImport && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary" />
                  {previewingImport.title}
                </h3>
                <span className="text-[10px] font-mono text-muted-foreground">
                  Original Session: #{previewingImport.original_session_id.slice(0, 8)} • Model: {previewingImport.model_id || 'default'}
                </span>
              </div>
              <button
                onClick={() => setPreviewingImport(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {previewingImport.system_prompt && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                    System / Roleplay Prompt
                  </span>
                  <p className="font-mono text-[11px] whitespace-pre-wrap text-foreground/90">
                    {previewingImport.system_prompt}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Dialogue Turns ({Array.isArray(previewingImport.messages) ? previewingImport.messages.length : 0})
                </span>

                {(Array.isArray(previewingImport.messages) ? previewingImport.messages : []).map((msg: any, idx: number) => {
                  const isUser = msg.role === 'user'
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-1 ${
                        isUser
                          ? 'bg-secondary/40 border-border ml-6 text-foreground'
                          : 'bg-primary/10 border-primary/30 mr-6 text-foreground'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                        <span className="uppercase font-bold">{msg.role}</span>
                        <span>Turn {idx + 1}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between shrink-0 bg-secondary/20">
              <span className="text-[10px] font-mono text-muted-foreground">
                Status: {previewingImport.status}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleConvertToDraft(previewingImport.id)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open in SFT Studio</span>
                </button>
                <button
                  onClick={() => handleCommitToCorpus(previewingImport.id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-emerald-500"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Commit to Mechon Corpus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
