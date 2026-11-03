import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  MessageSquareCode,
  Plus,
  Send,
  Square,
  Sparkles,
  Edit2,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  CheckCircle,
  Sliders,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  BookmarkPlus,
  Tag,
  Search,
  ExternalLink,
  Layers,
  Cpu,
  X,
  AlertCircle,
  Languages,
  CheckCheck,
  ArrowRight,
  Database,
  Code2,
  UserPlus
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { useProjectStore } from '../../stores/useProjectStore'
import { useProviderStore } from '../../stores/useProviderStore'
import { useInspectorStore } from '../../editor/stores/useInspectorStore'
import { useSubsystemConfigStore } from '../../editor/stores/useSubsystemConfigStore'
import { useConsoleStore } from '../../editor/stores/useConsoleStore'
import {
  getSFTSessions,
  getSFTSession,
  createSFTSession,
  updateSFTSession,
  deleteSFTSession,
  duplicateSFTSession,
  addSFTMessage,
  updateSFTMessage,
  deleteSFTMessage,
  truncateSFTDownstream,
  commitSFTSession,
  generateCompletion,
  translateSFTSession,
  translateSFTMessage,
  retrySFTTranslations,
  updateSFTMessageTranslation,
  batchUpdateTranslationStatus,
  loadCorpusRecordIntoSession,
  reorderSFTMessages,
  removeSFTMessageTranslation,
  approveAllTranslations
} from '../../services/api'
import type { SFTSession, SFTMessage, SFTCommitInput } from '../../types'
import { formatErrorMessage } from '../../utils/errors'
import { lookupLanguage, isRTL } from '../../types/languages'
import { LoadFromCorpusModal } from './LoadFromCorpusModal'
import { DynamicLanguageBar } from './DynamicLanguageBar'
import { TranslateModal } from './TranslateModal'
import { LiveDatasetPreviewDrawer } from './LiveDatasetPreviewDrawer'

export const SFTStudioView: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { activeProjectId, ensureActiveProject } = useProjectStore()
  const { providers, activeProviderId, activeModel, setActiveProviderId, setActiveModel, fetchProviders } = useProviderStore()

  const [sessions, setSessions] = useState<SFTSession[]>([])
  const [activeSession, setActiveSession] = useState<SFTSession | null>(null)
  const [sessionSearch, setSessionSearch] = useState('')
  const [inputContent, setInputContent] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Multilingual & Review state
  const [studioMode, setStudioMode] = useState<'chat' | 'multilingual'>('chat')
  const [activeLanguageTab, setActiveLanguageTab] = useState<string>('id')
  const [isTranslating, setIsTranslating] = useState(false)
  const [editingTranslationId, setEditingTranslationId] = useState<string | null>(null)
  const [translationEditText, setTranslationEditText] = useState('')
  const [isRegeneratingTurnId, setIsRegeneratingTurnId] = useState<string | null>(null)

  // Modals & Drawers state
  const [showCorpusModal, setShowCorpusModal] = useState(false)
  const [showTranslateModal, setShowTranslateModal] = useState(false)
  const [showLivePreviewDrawer, setShowLivePreviewDrawer] = useState(false)
  const [showSystemPrompt, setShowSystemPrompt] = useState(false)
  const [showManualAddModal, setShowManualAddModal] = useState(false)
  const [manualRole, setManualRole] = useState<'user' | 'assistant' | 'system' | 'developer' | 'tool'>('user')
  const [manualContent, setManualContent] = useState('')

  // Commit state
  const [showCommitModal, setShowCommitModal] = useState(false)
  const [commitTags, setCommitTags] = useState('dialogue, instruction')
  const [commitTitle, setCommitTitle] = useState('')
  const [commitSaveAsNew, setCommitSaveAsNew] = useState(false)
  const [commitCreateSnapshot, setCommitCreateSnapshot] = useState(false)
  const [commitVersionTag, setCommitVersionTag] = useState('')
  const [commitVersionDesc, setCommitVersionDesc] = useState('')
  const [isCommitting, setIsCommitting] = useState(false)
  const [isTranslatingAll, setIsTranslatingAll] = useState(false)
  const [selectedTurnIds, setSelectedTurnIds] = useState<string[]>([])
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    fetchProviders()
    initView()
  }, [activeProjectId])

  useEffect(() => {
    if (activeSession) {
      useInspectorStore.getState().inspect({
        type: 'sft_session',
        id: activeSession.id,
        title: activeSession.title,
        data: activeSession
      })
    }
  }, [activeSession?.id])

  // Handle URL query parameter `recordId` to auto-load from Corpus
  useEffect(() => {
    const recordId = searchParams.get('recordId')
    if (recordId) {
      handleLoadFromCorpus(recordId, false)
    }
  }, [searchParams])

  useEffect(() => {
    if (!activeSession || providers.length === 0) return
    const currentP = providers.find(p => p.id === (activeSession.provider_id || activeProviderId))
    if (!currentP) return
    const validModels = currentP.models_cache || []
    if (validModels.length > 0 && !validModels.includes(activeSession.model)) {
      const fixedModel = (currentP.default_model && validModels.includes(currentP.default_model))
        ? currentP.default_model
        : validModels[0]
      setActiveSession(prev => prev ? { ...prev, model: fixedModel } : null)
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, model: fixedModel } : s))
      updateSFTSession(activeSession.id, { model: fixedModel })
    }
  }, [providers, activeSession?.id, activeSession?.provider_id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeSession?.messages, isGenerating])

  // Keep activeLanguageTab aligned with session primary language initially
  useEffect(() => {
    if (activeSession) {
      if (!activeLanguageTab || activeLanguageTab === 'id' || activeLanguageTab === 'en') {
        setActiveLanguageTab(activeSession.primary_language || 'id')
      }
    }
  }, [activeSession?.primary_language])

  const initView = async () => {
    let pId = activeProjectId
    if (!pId) {
      pId = await ensureActiveProject()
    }
    if (pId) {
      loadSessions(pId)
    }
  }

  const loadSessions = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const list = await getSFTSessions(targetProject)
      setSessions(list)
      if (list.length > 0) {
        if (!activeSession || !list.some(s => s.id === activeSession.id)) {
          loadSessionDetails(list[0].id)
        }
      } else {
        handleNewSession(targetProject)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Could not load sessions'))
    }
  }

  const loadSessionDetails = async (sessionId: string) => {
    try {
      const full = await getSFTSession(sessionId)
      if (full) {
        const pId = full.provider_id || activeProviderId
        const prov = providers.find(p => p.id === pId)
        if (prov && prov.models_cache && prov.models_cache.length > 0 && !prov.models_cache.includes(full.model)) {
          const validM = prov.models_cache[0]
          full.model = validM
          updateSFTSession(full.id, { model: validM })
        }
      }
      setActiveSession(full)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to load conversation details'))
    }
  }

  const handleNewSession = async (projectId?: string) => {
    const targetProject = projectId || activeProjectId
    if (!targetProject) return
    try {
      const created = await createSFTSession({
        project_id: targetProject,
        title: 'New Conversation Draft',
        system_prompt: 'You are a helpful, respectful, and honest assistant.',
        provider_id: activeProviderId,
        model: activeModel,
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2048,
        language_mode: 'monolingual',
        primary_language: 'id',
        secondary_language: 'en'
      })
      setSessions(prev => [created, ...prev])
      setActiveSession(created)
      setActiveLanguageTab(created.primary_language || 'id')
      showFeedback('success', 'New conversation draft created.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to create conversation'))
    }
  }

  const handleLoadFromCorpus = async (recordId: string, asNewDraft: boolean) => {
    try {
      const loaded = await loadCorpusRecordIntoSession(recordId, asNewDraft)
      setSessions(prev => [loaded, ...prev])
      setActiveSession(loaded)
      setActiveLanguageTab(loaded.primary_language || 'id')
      showFeedback('success', `Loaded Corpus record #${recordId.slice(0, 8)} into editor.`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to load record from Corpus'))
    }
  }

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Delete this conversation draft?')) {
      try {
        await deleteSFTSession(sessionId)
        setSessions(prev => prev.filter(s => s.id !== sessionId))
        if (activeSession?.id === sessionId) {
          const remaining = sessions.filter(s => s.id !== sessionId)
          if (remaining.length > 0) {
            loadSessionDetails(remaining[0].id)
          } else {
            setActiveSession(null)
          }
        }
        showFeedback('success', 'Conversation draft deleted.')
      } catch (err: any) {
        showFeedback('error', formatErrorMessage(err, 'Failed to delete session'))
      }
    }
  }

  const handleSendMessage = async (e?: React.FormEvent, retryUserText?: string) => {
    if (e) e.preventDefault()
    if (!activeSession || isGenerating) return

    const userText = retryUserText || inputContent.trim()
    if (!userText) return
    if (!retryUserText) setInputContent('')

    const inferenceConfig = useSubsystemConfigStore.getState().configs.main_inference
    const pId = inferenceConfig?.provider_id || activeProviderId || activeSession.provider_id
    const targetProviderObj = providers.find(p => p.id === pId)
    const availableModels = targetProviderObj?.models_cache && targetProviderObj.models_cache.length > 0
      ? targetProviderObj.models_cache
      : []

    let targetModel = inferenceConfig?.model_id || activeModel || activeSession.model
    if (availableModels.length > 0 && targetModel && !availableModels.includes(targetModel)) {
      targetModel = (targetProviderObj?.default_model && availableModels.includes(targetProviderObj.default_model))
        ? targetProviderObj.default_model
        : availableModels[0]
    }

    if (!pId) {
      showFeedback('error', 'Please select an active provider before generating.')
      return
    }

    if (activeSession.provider_id !== pId || activeSession.model !== targetModel) {
      setActiveSession(prev => prev ? { ...prev, provider_id: pId, model: targetModel } : null)
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, provider_id: pId, model: targetModel } : s))
      updateSFTSession(activeSession.id, { provider_id: pId, model: targetModel })
    }

    setIsGenerating(true)
    try {
      let currentMessages = activeSession.messages || []

      if (!retryUserText) {
        const userMsg = await addSFTMessage(activeSession.id, {
          role: 'user',
          content: userText,
          model: targetModel
        })
        currentMessages = [...currentMessages, userMsg as SFTMessage]
        setActiveSession({ ...activeSession, messages: currentMessages, status: 'in_progress' })
      }

      const history = currentMessages.map(m => ({ role: m.role, content: m.content }))

      const res = await generateCompletion({
        provider_id: pId,
        model: targetModel,
        prompt: userText,
        messages: history,
        system_prompt: activeSession.system_prompt,
        temperature: activeSession.temperature,
        top_p: activeSession.top_p,
        max_tokens: activeSession.max_tokens
      })

      const assistantText = res.content || 'No response generated.'

      const assistantMsg = await addSFTMessage(activeSession.id, {
        role: 'assistant',
        content: assistantText,
        model: res.model || targetModel
      })

      setActiveSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, assistantMsg as SFTMessage]
      } : null)

      loadSessions()
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Generation failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleManualAddTurn = async () => {
    if (!activeSession || !manualContent.trim()) return
    try {
      const added = await addSFTMessage(activeSession.id, {
        role: manualRole,
        content: manualContent.trim(),
        model: activeSession.model || activeModel
      })
      setActiveSession(prev => prev ? {
        ...prev,
        messages: [...prev.messages, added as SFTMessage]
      } : null)
      setManualContent('')
      setShowManualAddModal(false)
      showFeedback('success', `Added ${manualRole} turn.`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to add manual turn'))
    }
  }

  const handleMoveTurn = async (messageId: string, direction: 'up' | 'down') => {
    if (!activeSession) return
    const msgs = [...activeSession.messages]
    const idx = msgs.findIndex(m => m.id === messageId)
    if (idx === -1) return
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= msgs.length) return

    const [moved] = msgs.splice(idx, 1)
    msgs.splice(targetIdx, 0, moved)

    try {
      const reordered = await reorderSFTMessages(activeSession.id, msgs.map(m => m.id))
      setActiveSession({ ...activeSession, messages: reordered })
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to reorder turns'))
    }
  }

  const handleEditSave = async (messageId: string) => {
    if (!editContent.trim()) return
    try {
      await updateSFTMessage(messageId, editContent.trim())
      if (activeSession) {
        await loadSessionDetails(activeSession.id)
      }
      setEditingMessageId(null)
      setEditContent('')
      showFeedback('success', 'Message updated.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to update message'))
    }
  }

  const handleRegenerateFrom = async (sequenceOrder: number) => {
    if (!activeSession) return
    try {
      await truncateSFTDownstream(activeSession.id, sequenceOrder)
      const refreshed = await getSFTSession(activeSession.id)
      setActiveSession(refreshed)

      const msgs = refreshed.messages || []
      const lastUser = [...msgs].reverse().find(m => m.role === 'user')
      if (lastUser) {
        setIsGenerating(true)
        const inferenceConfig = useSubsystemConfigStore.getState().configs.main_inference
        const pId = inferenceConfig?.provider_id || activeProviderId || activeSession.provider_id
        const targetModel = inferenceConfig?.model_id || activeModel || activeSession.model
        if (activeSession.provider_id !== pId || activeSession.model !== targetModel) {
          updateSFTSession(activeSession.id, { provider_id: pId, model: targetModel })
        }
        const history = msgs.map(m => ({ role: m.role, content: m.content }))
        const res = await generateCompletion({
          provider_id: pId,
          model: targetModel,
          prompt: lastUser.content,
          messages: history,
          system_prompt: activeSession.system_prompt,
          temperature: activeSession.temperature
        })
        const asstMsg = await addSFTMessage(activeSession.id, {
          role: 'assistant',
          content: res.content,
          model: targetModel
        })
        setActiveSession(prev => prev ? {
          ...prev,
          messages: [...prev.messages, asstMsg as SFTMessage]
        } : null)
      }
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Regeneration failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await deleteSFTMessage(messageId)
      if (activeSession) {
        await loadSessionDetails(activeSession.id)
      }
      showFeedback('success', 'Turn deleted.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Delete failed'))
    }
  }

  // Dynamic Language Management
  const targetLanguages = Array.from(
    new Set([
      ...(activeSession?.secondary_language ? [activeSession.secondary_language] : []),
      ...(activeSession?.messages?.flatMap(m => (m.translations ? Object.keys(m.translations) : [])) || [])
    ])
  ).filter(code => code !== activeSession?.primary_language)

  const handleModeChange = async (newMode: 'monolingual' | 'bilingual' | 'multilingual') => {
    if (!activeSession) return
    await updateSFTSession(activeSession.id, { language_mode: newMode })
    setActiveSession(prev => prev ? { ...prev, language_mode: newMode } : null)
  }

  const handlePrimaryLanguageChange = async (langCode: string) => {
    if (!activeSession) return
    await updateSFTSession(activeSession.id, { primary_language: langCode })
    setActiveSession(prev => prev ? { ...prev, primary_language: langCode } : null)
    setActiveLanguageTab(langCode)
  }

  const handleAddTargetLanguage = async (newLang: string) => {
    if (!activeSession) return
    const updatedTargets = Array.from(new Set([...targetLanguages, newLang]))
    const newMode = updatedTargets.length > 1 ? 'multilingual' : 'bilingual'
    await updateSFTSession(activeSession.id, {
      language_mode: newMode,
      secondary_language: newLang
    })
    setActiveSession(prev => prev ? {
      ...prev,
      language_mode: newMode,
      secondary_language: newLang
    } : null)
    setActiveLanguageTab(newLang)
    showFeedback('success', `Added language ${lookupLanguage(newLang).name}.`)
  }

  const handleRemoveTargetLanguage = async (langToRemove: string) => {
    if (!activeSession) return
    for (const m of activeSession.messages) {
      if (m.translations && m.translations[langToRemove]) {
        await removeSFTMessageTranslation(m.id, langToRemove)
      }
    }
    const remaining = targetLanguages.filter(l => l !== langToRemove)
    const newMode = remaining.length === 0 ? 'monolingual' : remaining.length === 1 ? 'bilingual' : 'multilingual'
    const newSec = remaining[0] || ''
    await updateSFTSession(activeSession.id, {
      language_mode: newMode,
      secondary_language: newSec
    })
    await loadSessionDetails(activeSession.id)
    setActiveLanguageTab(activeSession.primary_language || 'id')
    showFeedback('success', `Removed language ${lookupLanguage(langToRemove).name}.`)
  }

  const handleTranslateAll = async (forceRegenerate = false) => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const transConfig = useSubsystemConfigStore.getState().configs.translation
    const pId = transConfig?.provider_id || activeProviderId
    const targetModel = transConfig?.model_id || activeModel

    setIsTranslatingAll(true)
    try {
      const updated = await translateSFTSession({
        session_id: activeSession.id,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel,
        force_regenerate: forceRegenerate
      })
      setActiveSession(updated)
      showFeedback('success', `Translation completed for ${lookupLanguage(targetLang).name}.`)
      useConsoleStore.getState().addLog('info', 'inference', `Translated conversation into ${targetLang} using ${targetModel}`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Translation failed'))
      useConsoleStore.getState().addLog('error', 'inference', `Translation failed: ${err?.message || err}`)
    } finally {
      setIsTranslatingAll(false)
    }
  }

  const handleTranslateSelected = async () => {
    if (!activeSession || selectedTurnIds.length === 0) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const transConfig = useSubsystemConfigStore.getState().configs.translation
    const pId = transConfig?.provider_id || activeProviderId
    const targetModel = transConfig?.model_id || activeModel

    setIsTranslatingAll(true)
    try {
      const updated = await translateSFTSession({
        session_id: activeSession.id,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel,
        message_ids: selectedTurnIds,
        force_regenerate: true
      })
      setActiveSession(updated)
      const count = selectedTurnIds.length
      setSelectedTurnIds([])
      showFeedback('success', `Translated ${count} selected turns.`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Selected turns translation failed'))
    } finally {
      setIsTranslatingAll(false)
    }
  }

  const handleRetryFailedTurns = async () => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const transConfig = useSubsystemConfigStore.getState().configs.translation
    const pId = transConfig?.provider_id || activeProviderId
    const targetModel = transConfig?.model_id || activeModel

    setIsTranslatingAll(true)
    try {
      const updated = await retrySFTTranslations({
        session_id: activeSession.id,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel
      })
      setActiveSession(updated)
      showFeedback('success', 'Retried failed translations.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Retry failed'))
    } finally {
      setIsTranslatingAll(false)
    }
  }

  const handleTranslateSingleTurn = async (messageId: string) => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const transConfig = useSubsystemConfigStore.getState().configs.translation
    const pId = transConfig?.provider_id || activeProviderId
    const targetModel = transConfig?.model_id || activeModel

    setIsRegeneratingTurnId(messageId)
    try {
      const updatedMsg = await translateSFTMessage({
        session_id: activeSession.id,
        message_id: messageId,
        target_language: targetLang,
        provider_id: pId,
        model: targetModel
      })
      setActiveSession(prev => prev ? {
        ...prev,
        messages: prev.messages.map(m => m.id === messageId ? updatedMsg : m)
      } : null)
      showFeedback('success', 'Turn translated.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Turn translation failed'))
    } finally {
      setIsRegeneratingTurnId(null)
    }
  }

  const handleApproveTurn = async (messageId: string, content?: string) => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const msg = activeSession.messages.find(m => m.id === messageId)
    const text = content !== undefined ? content : (msg?.translations?.[targetLang] || '')
    const status = content !== undefined ? 'edited' : 'approved'

    try {
      await updateSFTMessageTranslation({
        message_id: messageId,
        target_language: targetLang,
        content: text,
        status: status
      })
      await loadSessionDetails(activeSession.id)
      showFeedback('success', status === 'edited' ? 'Translation updated.' : 'Turn translation approved.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Approval failed'))
    }
  }

  const handleRejectTurn = async (messageId: string) => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    const msg = activeSession.messages.find(m => m.id === messageId)
    const text = msg?.translations?.[targetLang] || ''

    try {
      await updateSFTMessageTranslation({
        message_id: messageId,
        target_language: targetLang,
        content: text,
        status: 'rejected'
      })
      await loadSessionDetails(activeSession.id)
      showFeedback('success', 'Turn translation marked as rejected.')
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Reject failed'))
    }
  }

  const handleApproveAllTurns = async () => {
    if (!activeSession) return
    const targetLang = activeLanguageTab !== activeSession.primary_language
      ? activeLanguageTab
      : activeSession.secondary_language || 'en'
    try {
      const updated = await approveAllTranslations(activeSession.id, targetLang)
      setActiveSession(updated)
      showFeedback('success', `All turns in ${lookupLanguage(targetLang).name} marked as approved.`)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Failed to approve all turns'))
    }
  }

  const handleCommitConfirm = async () => {
    if (!activeSession) return
    setIsCommitting(true)
    try {
      const tagsArray = commitTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const isMulti = activeSession.language_mode === 'multilingual' || targetLanguages.length > 1
      const isBilingual = activeSession.language_mode === 'bilingual' || targetLanguages.length === 1

      const input: SFTCommitInput = {
        title_override: commitTitle.trim() || activeSession.title,
        tags: tagsArray,
        metadata: {
          model: activeSession.model || activeModel,
          provider_id: activeSession.provider_id || activeProviderId,
          temperature: activeSession.temperature,
          language_mode: isMulti ? 'multilingual' : isBilingual ? 'bilingual' : 'monolingual',
          primary_language: activeSession.primary_language || 'id',
          secondary_language: activeSession.secondary_language || 'en'
        },
        save_as_new: commitSaveAsNew,
        create_version_snapshot: commitCreateSnapshot,
        version_tag: commitVersionTag.trim() || undefined,
        version_description: commitVersionDesc.trim() || undefined
      }

      const record = await commitSFTSession(activeSession.id, input)

      showFeedback(
        'success',
        commitSaveAsNew
          ? `Created new Corpus record #${record.id.slice(0, 8)}!`
          : `Updated Corpus record #${record.id.slice(0, 8)} (v${record.revision})!`
      )
      setShowCommitModal(false)
      await loadSessions()
      await loadSessionDetails(activeSession.id)
    } catch (err: any) {
      showFeedback('error', formatErrorMessage(err, 'Commit failed'))
    } finally {
      setIsCommitting(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(sessionSearch.toLowerCase())
  )

  const activeTargetLanguage = activeLanguageTab !== (activeSession?.primary_language || 'id')
    ? activeLanguageTab
    : (activeSession?.secondary_language || targetLanguages[0] || 'en')

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left Panel: Conversations & Corpus Loader */}
      <aside className="w-72 border-r border-border bg-card/40 flex flex-col shrink-0 select-none">
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Conversations</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowCorpusModal(true)}
                className="p-1.5 rounded-lg bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs flex items-center gap-1 font-semibold transition-all cursor-pointer"
                title="Load existing conversation from Corpus"
              >
                <Database className="h-3.5 w-3.5 text-primary" />
                <span>Corpus</span>
              </button>

              <button
                onClick={() => handleNewSession()}
                className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs flex items-center gap-1 shadow-sm font-semibold transition-all cursor-pointer"
                title="New Conversation Draft"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter sessions..."
              value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-md bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSessions.map(s => {
            const isSelected = activeSession?.id === s.id
            const isCommitted = s.status === 'committed' || s.committed_record_id
            return (
              <div
                key={s.id}
                onClick={() => loadSessionDetails(s.id)}
                className={`p-2.5 rounded-lg text-xs cursor-pointer border transition-all space-y-1 group ${
                  isSelected
                    ? 'bg-primary/10 border-primary text-foreground shadow-sm'
                    : 'bg-card/50 hover:bg-secondary/60 border-border/50 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-medium truncate text-foreground text-xs flex-1">{s.title}</span>
                  <div className="flex items-center gap-1">
                    {isCommitted ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        CORPUS
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-accent text-muted-foreground">
                        DRAFT
                      </span>
                    )}
                    <button
                      onClick={e => handleDeleteSession(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity"
                      title="Delete Draft"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span className="truncate max-w-[120px]">{s.model || 'mock-llama-3-8b'}</span>
                  <span>{s.messages ? s.messages.length : 0} turns</span>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main Conversation Workspace */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
        {activeSession ? (
          <>
            {/* Top Bar: Title, Workspace Mode Switcher & Commit */}
            <div className="h-10 border-b border-border px-4 flex items-center justify-between bg-card/60 backdrop-blur-sm shrink-0 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="text"
                  value={activeSession.title}
                  onChange={e => {
                    const updated = { ...activeSession, title: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { title: e.target.value })
                  }}
                  className="font-semibold text-xs bg-transparent hover:bg-secondary/50 px-1.5 py-0.5 rounded border border-transparent hover:border-border focus:border-primary focus:outline-none transition-all truncate max-w-xs text-foreground"
                />

                {/* Workspace Mode Switcher */}
                <div className="flex items-center rounded-md bg-secondary/80 p-0.5 border border-border shrink-0">
                  <button
                    onClick={() => setStudioMode('chat')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      studioMode === 'chat'
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <MessageSquareCode className="h-3 w-3" />
                    <span>Chat</span>
                  </button>
                  <button
                    onClick={() => setStudioMode('multilingual')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 transition-all cursor-pointer ${
                      studioMode === 'multilingual'
                        ? 'bg-sky-600/30 text-sky-400 font-semibold'
                        : 'text-muted-foreground hover:text-sky-400'
                    }`}
                  >
                    <Languages className="h-3 w-3" />
                    <span>Multilingual</span>
                  </button>
                </div>

                {activeSession.committed_record_id && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 shrink-0">
                    <CheckCircle className="h-2.5 w-2.5" /> LINKED
                  </span>
                )}
              </div>

              {/* Top Controls */}
              <div className="flex items-center gap-1.5">
                {/* Active Model Indicator Badge */}
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-secondary/80 border border-border text-[11px] font-mono text-muted-foreground">
                  <Cpu className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate max-w-[130px]" title="Active generation model">{useSubsystemConfigStore.getState().configs.main_inference?.model_id || activeModel || activeSession.model || 'default'}</span>
                </div>

                <button
                  onClick={() => setShowSystemPrompt(!showSystemPrompt)}
                  className={`px-2 py-1 rounded text-xs font-medium border transition-colors cursor-pointer ${
                    showSystemPrompt
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary hover:bg-accent border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Edit System Instructions"
                >
                  Prompt
                </button>

                <button
                  onClick={() => setShowLivePreviewDrawer(!showLivePreviewDrawer)}
                  className={`p-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                    showLivePreviewDrawer
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-secondary hover:bg-accent border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="Toggle Live Dataset JSON/JSONL preview & statistics"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  onClick={() => {
                    setCommitTitle(activeSession.title)
                    setCommitSaveAsNew(false)
                    setShowCommitModal(true)
                  }}
                  disabled={activeSession.messages.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                  title="Commit to Mechon Corpus"
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  <span>Save to Corpus</span>
                </button>
              </div>
            </div>

            {/* Dynamic Multilingual Bar */}
            <DynamicLanguageBar
              languageMode={activeSession.language_mode || 'monolingual'}
              primaryLanguage={activeSession.primary_language || 'id'}
              targetLanguages={targetLanguages}
              activeLanguageTab={activeLanguageTab}
              onChangeMode={handleModeChange}
              onChangePrimaryLanguage={handlePrimaryLanguageChange}
              onAddTargetLanguage={handleAddTargetLanguage}
              onRemoveTargetLanguage={handleRemoveTargetLanguage}
              onSelectLanguageTab={code => setActiveLanguageTab(code)}
              onOpenTranslateModal={() => setShowTranslateModal(true)}
            />

            {/* Notification Banner */}
            {notification && (
              <div
                className={`px-6 py-2 text-xs flex items-center justify-between border-b ${
                  notification.type === 'success'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-destructive/10 text-destructive border-destructive/20'
                }`}
              >
                <span>{notification.message}</span>
                <button onClick={() => setNotification(null)} className="p-0.5 hover:opacity-75">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* System Prompt Collapsible Banner */}
            {showSystemPrompt && (
              <div className="p-4 border-b border-border bg-card/60 backdrop-blur-sm space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">System Instructions</span>
                  <span className="text-[10px]">Applied at generation start</span>
                </div>
                <textarea
                  rows={2}
                  value={activeSession.system_prompt}
                  onChange={e => {
                    const updated = { ...activeSession, system_prompt: e.target.value }
                    setActiveSession(updated)
                    updateSFTSession(activeSession.id, { system_prompt: e.target.value })
                  }}
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  placeholder="Enter system prompt for model behavior..."
                />
              </div>
            )}

            {/* Main Content Area: Chat Mode vs Multilingual Review Mode */}
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                {studioMode === 'chat' ? (
                  <>
                    {/* Messages Chat Flow */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {activeSession.messages && activeSession.messages.length > 0 ? (
                        activeSession.messages.map((m, index) => {
                          const isUser = m.role === 'user'
                          const isEditing = editingMessageId === m.id
                          const isPrimaryTab = activeLanguageTab === (activeSession.primary_language || 'id')
                          const displayedContent = isPrimaryTab
                            ? m.content
                            : (m.translations?.[activeLanguageTab] || m.content)

                          return (
                            <div
                              key={m.id || index}
                              className={`flex flex-col gap-1.5 group max-w-4xl mx-auto ${
                                isUser ? 'items-end' : 'items-start'
                              }`}
                            >
                              {/* Turn Meta Header */}
                              <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
                                <span className="font-bold uppercase tracking-wider font-mono text-foreground">
                                  {m.role}
                                </span>
                                <span>•</span>
                                <span>Turn {index + 1}</span>
                                {!isPrimaryTab && (
                                  <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-400 text-[9px] font-bold">
                                    {activeLanguageTab.toUpperCase()}
                                  </span>
                                )}
                                {m.translations && Object.keys(m.translations).length > 0 && (
                                  <span className="px-1.5 py-0.2 rounded bg-primary/20 text-primary text-[9px] font-bold">
                                    {Object.keys(m.translations).length} trans
                                  </span>
                                )}
                              </div>

                              <div
                                className={`relative rounded-2xl p-4 text-xs leading-relaxed max-w-[85%] border shadow-sm transition-all ${
                                  isUser
                                    ? 'bg-primary text-primary-foreground border-primary/40'
                                    : 'bg-card text-foreground border-border'
                                }`}
                              >
                                {isEditing ? (
                                  <div className="space-y-2 min-w-[320px]">
                                    <textarea
                                      rows={4}
                                      value={editContent}
                                      onChange={e => setEditContent(e.target.value)}
                                      className="w-full p-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setEditingMessageId(null)}
                                        className="px-2.5 py-1 rounded text-[11px] hover:bg-secondary border border-border cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={() => handleEditSave(m.id)}
                                        className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground shadow-sm cursor-pointer"
                                      >
                                        Save Turn
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="prose prose-invert prose-xs max-w-none break-words">
                                    <ReactMarkdown>{displayedContent}</ReactMarkdown>
                                  </div>
                                )}

                                {/* Floating Turn Actions Toolbar */}
                                {!isEditing && (
                                  <div className="absolute right-2 -bottom-3.5 hidden group-hover:flex items-center gap-1 bg-card border border-border rounded-lg shadow-md px-1.5 py-0.5 text-muted-foreground text-[10px]">
                                    {/* Reorder Up */}
                                    <button
                                      onClick={() => handleMoveTurn(m.id, 'up')}
                                      disabled={index === 0}
                                      className="p-1 hover:text-foreground hover:bg-secondary rounded disabled:opacity-30 cursor-pointer"
                                      title="Move Turn Up"
                                    >
                                      <ChevronUp className="h-3 w-3" />
                                    </button>

                                    {/* Reorder Down */}
                                    <button
                                      onClick={() => handleMoveTurn(m.id, 'down')}
                                      disabled={index === activeSession.messages.length - 1}
                                      className="p-1 hover:text-foreground hover:bg-secondary rounded disabled:opacity-30 cursor-pointer"
                                      title="Move Turn Down"
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </button>

                                    <button
                                      onClick={() => copyToClipboard(displayedContent, m.id)}
                                      className="p-1 hover:text-foreground hover:bg-secondary rounded cursor-pointer"
                                      title="Copy Turn Content"
                                    >
                                      {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                    </button>

                                    <button
                                      onClick={() => {
                                        setEditingMessageId(m.id)
                                        setEditContent(m.content)
                                      }}
                                      className="p-1 hover:text-foreground hover:bg-secondary rounded cursor-pointer"
                                      title="Edit Turn"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>

                                    {!isUser && (
                                      <button
                                        onClick={() => handleRegenerateFrom(m.sequence_order)}
                                        className="p-1 hover:text-primary hover:bg-secondary rounded cursor-pointer"
                                        title="Regenerate from this turn"
                                      >
                                        <RefreshCw className="h-3 w-3" />
                                      </button>
                                    )}

                                    <button
                                      onClick={() => handleDeleteMessage(m.id)}
                                      className="p-1 hover:text-destructive hover:bg-destructive/10 rounded cursor-pointer"
                                      title="Delete Turn"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="h-full flex items-center justify-center text-center text-xs text-muted-foreground py-16">
                          <div className="space-y-2 max-w-md">
                            <MessageSquareCode className="h-10 w-10 text-primary/40 mx-auto" />
                            <h3 className="font-bold text-foreground text-sm">Empty Conversation Draft</h3>
                            <p className="leading-relaxed">
                              Type your prompt below or click "+ Add Turn" to construct manual dialogues. You can also load existing datasets from Mechon Corpus.
                            </p>
                          </div>
                        </div>
                      )}

                      {isGenerating && (
                        <div className="flex items-center gap-2 text-xs text-primary animate-pulse p-4 max-w-4xl mx-auto">
                          <Sparkles className="h-4 w-4 animate-spin" />
                          <span>Model is generating completion...</span>
                        </div>
                      )}

                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Input & Manual Turn Toolbar */}
                    <div className="p-4 border-t border-border bg-card/40 shrink-0">
                      {activeSession.messages &&
                        activeSession.messages.length > 0 &&
                        activeSession.messages[activeSession.messages.length - 1].role === 'user' &&
                        !isGenerating && (
                          <div className="max-w-4xl mx-auto mb-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-300">
                            <span className="flex items-center gap-1.5">
                              <AlertCircle className="h-3.5 w-3.5" /> Last user turn has no assistant response.
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const lastUserMsg = activeSession.messages[activeSession.messages.length - 1]
                                handleSendMessage(undefined, lastUserMsg.content)
                              }}
                              className="px-2.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <RefreshCw className="h-3 w-3" /> Retry Generation
                            </button>
                          </div>
                        )}

                      <div className="max-w-4xl mx-auto mb-2 flex items-center justify-between text-xs">
                        <button
                          onClick={() => setShowManualAddModal(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border text-[11px] font-medium transition-colors cursor-pointer"
                          title="Add a custom dialogue turn manually (user, assistant, system, developer, tool)"
                        >
                          <UserPlus className="w-3.5 h-3.5 text-primary" />
                          <span>+ Add Turn Manually</span>
                        </button>

                        <span className="text-[11px] text-muted-foreground font-mono">
                          Generating via: {activeSession.model || activeModel}
                        </span>
                      </div>

                      <form onSubmit={handleSendMessage} className="relative max-w-4xl mx-auto flex items-end gap-2">
                        <textarea
                          rows={2}
                          value={inputContent}
                          onChange={e => setInputContent(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                          placeholder="Type message to continue conversation (Enter to send, Shift+Enter for newline)..."
                          className="flex-1 p-3 rounded-xl bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none text-foreground"
                        />

                        <button
                          type="submit"
                          disabled={isGenerating || !inputContent.trim()}
                          className="h-10 px-5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-xs flex items-center gap-2 shadow-sm disabled:opacity-50 transition-all shrink-0 cursor-pointer"
                        >
                          {isGenerating ? <Square className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          <span>Send</span>
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  /* Side-by-Side Multilingual Review Interface */
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="max-w-5xl mx-auto space-y-4">
                      {/* Translation Agent Control Bar */}
                      {(() => {
                        const transConfig = useSubsystemConfigStore.getState().configs.translation
                        const transProvider = providers.find(p => p.id === transConfig?.provider_id) || providers[0]
                        const transModel = transConfig?.model_id || transProvider?.default_model || 'default'
                        const targetInfo = lookupLanguage(activeTargetLanguage)
                        
                        const untranslatedCount = activeSession.messages.filter(m => {
                          const st = m.translation_status?.[activeTargetLanguage]
                          const text = m.translations?.[activeTargetLanguage]
                          return !text || st === 'pending'
                        }).length
                        const failedCount = activeSession.messages.filter(m => m.translation_status?.[activeTargetLanguage] === 'failed').length

                        return (
                          <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3 text-xs shadow-sm">
                            {/* Left: Translation Agent Configuration */}
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400 font-semibold text-xs">
                                <Languages className="w-4 h-4" />
                                <span>Translation Agent:</span>
                              </div>

                              <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/80 border border-border font-mono text-[11px] text-foreground">
                                <Cpu className="w-3.5 h-3.5 text-primary shrink-0" />
                                <span className="font-semibold">{transProvider?.name || 'Default'}:</span>
                                <span className="text-muted-foreground">{transModel}</span>
                              </div>
                            </div>

                            {/* Right: Actions */}
                            <div className="flex items-center gap-2">
                              {selectedTurnIds.length > 0 && (
                                <button
                                  onClick={handleTranslateSelected}
                                  disabled={isTranslatingAll}
                                  className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                  {isTranslatingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                  <span>Translate Selected ({selectedTurnIds.length})</span>
                                </button>
                              )}

                              {failedCount > 0 && (
                                <button
                                  onClick={handleRetryFailedTurns}
                                  disabled={isTranslatingAll}
                                  className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                  <RefreshCw className={`w-3.5 h-3.5 ${isTranslatingAll ? 'animate-spin' : ''}`} />
                                  <span>Retry Failed ({failedCount})</span>
                                </button>
                              )}

                              <button
                                onClick={() => handleTranslateAll(false)}
                                disabled={isTranslatingAll || activeSession.messages.length === 0}
                                className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                                title={`Translate all pending turns to ${targetInfo.name}`}
                              >
                                {isTranslatingAll ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                <span>{untranslatedCount > 0 ? `Translate All (${untranslatedCount} pending)` : 'Translate All Turns'}</span>
                              </button>

                              <button
                                onClick={() => handleTranslateAll(true)}
                                disabled={isTranslatingAll || activeSession.messages.length === 0}
                                className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-accent border border-border text-foreground text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Force regenerate all translations in conversation"
                              >
                                <RefreshCw className={`w-3 h-3 ${isTranslatingAll ? 'animate-spin' : ''}`} />
                                <span>Force Regenerate</span>
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Comparison Columns Header */}
                      {(() => {
                        const pLang = lookupLanguage(activeSession.primary_language || 'id')
                        const sLang = lookupLanguage(activeTargetLanguage)
                        const approvedCount = activeSession.messages.filter(m => m.translation_status?.[activeTargetLanguage] === 'approved').length
                        const totalCount = activeSession.messages.length
                        const percent = totalCount > 0 ? Math.round((approvedCount / totalCount) * 100) : 0

                        return (
                          <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="grid grid-cols-2 gap-6 flex-1 text-xs font-bold uppercase tracking-wider">
                              <span className="text-primary flex items-center gap-1.5">
                                Source ({pLang.name} - {pLang.code.toUpperCase()})
                                {pLang.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                              </span>
                              <span className="text-sky-400 flex items-center gap-1.5">
                                Translation ({sLang.name} - {sLang.code.toUpperCase()})
                                {sLang.rtl && <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/10 text-amber-500 font-mono">RTL</span>}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 shrink-0 ml-4">
                              <span className="text-[11px] font-mono text-muted-foreground">
                                Approved: <strong className="text-foreground">{approvedCount}</strong>/{totalCount} ({percent}%)
                              </span>
                              <button
                                onClick={handleApproveAllTurns}
                                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                                title={`Approve all turns in ${sLang.name}`}
                              >
                                <CheckCheck className="w-3.5 h-3.5" />
                                <span>Approve All ({sLang.code.toUpperCase()})</span>
                              </button>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Turn Cards */}
                      {activeSession.messages && activeSession.messages.length > 0 ? (
                        activeSession.messages.map((m, index) => {
                          const transText = m.translations?.[activeTargetLanguage] || ''
                          const status = (m.translation_status?.[activeTargetLanguage] || (transText ? 'completed' : 'pending')).toLowerCase()
                          const isEditing = editingTranslationId === m.id
                          const isRegenerating = isRegeneratingTurnId === m.id
                          const isChecked = selectedTurnIds.includes(m.id)
                          const pInfo = lookupLanguage(activeSession.primary_language || 'id')
                          const sInfo = lookupLanguage(activeTargetLanguage)

                          return (
                            <div key={m.id || index} className="grid grid-cols-2 gap-6 items-start">
                              {/* Left Column: Original Primary Text */}
                              <div className="p-4 rounded-xl bg-card border border-border space-y-2 text-xs shadow-sm">
                                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        setSelectedTurnIds(prev =>
                                          prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id]
                                        )
                                      }}
                                      className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5 cursor-pointer"
                                      title="Select turn for translation"
                                    />
                                    <span className="font-bold text-foreground">{m.role}</span>
                                  </div>
                                  <span>Turn {index + 1}</span>
                                </div>
                                <div
                                  dir={pInfo.rtl ? 'rtl' : 'ltr'}
                                  className={`prose prose-invert prose-xs max-w-none break-words ${
                                    pInfo.rtl ? 'text-right' : 'text-left'
                                  }`}
                                >
                                  <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                              </div>

                              {/* Right Column: Aligned Translation Text */}
                              <div className={`p-4 rounded-xl bg-card space-y-3 text-xs shadow-sm border ${
                                status === 'failed'
                                  ? 'border-rose-500/50'
                                  : status === 'approved'
                                  ? 'border-emerald-500/40'
                                  : status === 'edited'
                                  ? 'border-purple-500/40'
                                  : status === 'completed'
                                  ? 'border-sky-500/40'
                                  : 'border-border'
                              }`}>
                                <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground uppercase border-b border-border/60 pb-1">
                                  <span className="font-bold text-sky-400">{m.role} ({sInfo.code.toUpperCase()})</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      status === 'approved'
                                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                        : status === 'edited'
                                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                                        : status === 'completed' || status === 'generated'
                                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                                        : status === 'rejected'
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                        : status === 'failed'
                                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse'
                                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </div>

                                {isEditing ? (
                                  <div className="space-y-2">
                                    <textarea
                                      rows={4}
                                      value={translationEditText}
                                      onChange={e => setTranslationEditText(e.target.value)}
                                      dir={sInfo.rtl ? 'rtl' : 'ltr'}
                                      className={`w-full p-2.5 rounded-lg bg-secondary border border-border text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-primary ${
                                        sInfo.rtl ? 'text-right' : 'text-left'
                                      }`}
                                    />
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setEditingTranslationId(null)}
                                        className="px-2.5 py-1 rounded text-[11px] border border-border hover:bg-secondary cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        onClick={async () => {
                                          await handleApproveTurn(m.id, translationEditText)
                                          setEditingTranslationId(null)
                                        }}
                                        className="px-3 py-1 rounded text-[11px] font-bold bg-primary text-primary-foreground shadow-sm cursor-pointer"
                                      >
                                        Save Changes
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    dir={sInfo.rtl ? 'rtl' : 'ltr'}
                                    className={`prose prose-invert prose-xs max-w-none break-words min-h-[40px] ${
                                      sInfo.rtl ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {transText ? (
                                      <ReactMarkdown>{transText}</ReactMarkdown>
                                    ) : (
                                      <span className="text-muted-foreground italic">
                                        No translation for {sInfo.name} yet. Click "Translate All" above or "Regenerate" below.
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Turn Actions */}
                                {!isEditing && (
                                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        onClick={() => {
                                          setEditingTranslationId(m.id)
                                          setTranslationEditText(transText)
                                        }}
                                        className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 cursor-pointer"
                                        title="Edit translated text"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                        <span>Edit</span>
                                      </button>
                                      <button
                                        onClick={() => handleTranslateSingleTurn(m.id)}
                                        disabled={isRegenerating}
                                        className="px-2 py-1 rounded bg-secondary hover:bg-accent border border-border text-foreground flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                        title="Regenerate single turn translation in context"
                                      >
                                        <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin text-sky-400' : ''}`} />
                                        <span>Regenerate</span>
                                      </button>
                                      {status === 'failed' && (
                                        <button
                                          onClick={() => handleTranslateSingleTurn(m.id)}
                                          disabled={isRegenerating}
                                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                                          title="Retry this failed turn"
                                        >
                                          <RefreshCw className={`h-3 w-3 ${isRegenerating ? 'animate-spin' : ''}`} />
                                          <span>Retry</span>
                                        </button>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5">
                                      {transText && status !== 'rejected' && (
                                        <button
                                          onClick={() => handleRejectTurn(m.id)}
                                          className="px-2 py-1 rounded bg-secondary hover:bg-rose-500/10 text-muted-foreground hover:text-rose-400 border border-border transition-colors cursor-pointer"
                                          title="Reject this translation"
                                        >
                                          Reject
                                        </button>
                                      )}
                                      {transText && status !== 'approved' && (
                                        <button
                                          onClick={() => handleApproveTurn(m.id)}
                                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1 shadow-sm cursor-pointer"
                                          title="Approve turn translation"
                                        >
                                          <Check className="h-3 w-3" />
                                          <span>Approve</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="p-12 text-center text-xs text-muted-foreground">
                          No messages to review. Add conversation turns in Chat mode first.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Side Live Dataset Inspector Drawer */}
              <LiveDatasetPreviewDrawer
                session={activeSession}
                isOpen={showLivePreviewDrawer}
                onClose={() => setShowLivePreviewDrawer(false)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground p-8">
            <div className="space-y-3">
              <MessageSquareCode className="h-10 w-10 text-muted-foreground/40 mx-auto" />
              <p>No active conversation. Select a session or click New Chat to start.</p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setShowCorpusModal(true)}
                  className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 font-bold border border-border cursor-pointer flex items-center gap-1.5"
                >
                  <Database className="w-4 h-4 text-primary" />
                  <span>Load from Corpus</span>
                </button>
                <button
                  onClick={() => handleNewSession()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-bold cursor-pointer"
                >
                  Create New Conversation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Turn Add Modal */}
      {showManualAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-5 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <span>Add Dialogue Turn Manually</span>
              </h3>
              <button onClick={() => setShowManualAddModal(false)} className="p-1 rounded-lg hover:bg-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Role</label>
                <select
                  value={manualRole}
                  onChange={e => setManualRole(e.target.value as any)}
                  className="w-full px-3 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                >
                  <option value="user">User</option>
                  <option value="assistant">Assistant</option>
                  <option value="system">System</option>
                  <option value="developer">Developer</option>
                  <option value="tool">Tool</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">Message Content</label>
                <textarea
                  rows={4}
                  value={manualContent}
                  onChange={e => setManualContent(e.target.value)}
                  placeholder="Enter message text..."
                  className="w-full p-2.5 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowManualAddModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs hover:bg-secondary border border-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleManualAddTurn}
                disabled={!manualContent.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs disabled:opacity-50 cursor-pointer"
              >
                Add Turn
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Corpus Loader Modal */}
      <LoadFromCorpusModal
        projectId={activeProjectId || ''}
        isOpen={showCorpusModal}
        onClose={() => setShowCorpusModal(false)}
        onLoadRecord={handleLoadFromCorpus}
      />

      {/* Translation Modal */}
      {activeSession && (
        <TranslateModal
          session={activeSession}
          providers={providers}
          isOpen={showTranslateModal}
          onClose={() => setShowTranslateModal(false)}
          onSuccess={updated => {
            setActiveSession(updated)
            showFeedback('success', 'Full conversation translated.')
          }}
        />
      )}

      {/* Commit Session Modal */}
      {showCommitModal && activeSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl p-6 space-y-4 text-foreground">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">Save / Commit to Mechon Corpus</h3>
                <p className="text-xs text-muted-foreground">
                  Save conversation ({activeSession.messages.length} turns) as an atomic dataset record.
                </p>
              </div>
              <button onClick={() => setShowCommitModal(false)} className="p-1 rounded-lg hover:bg-secondary cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Record Title</label>
                <input
                  type="text"
                  value={commitTitle}
                  onChange={e => setCommitTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Tags (comma-separated)</label>
                <input
                  type="text"
                  value={commitTags}
                  onChange={e => setCommitTags(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-secondary/80 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
                  placeholder="e.g. reasoning, customer-support, bilingual"
                />
              </div>

              {/* Save As New Option */}
              {activeSession.committed_record_id && (
                <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer font-medium">
                    <input
                      type="checkbox"
                      checked={commitSaveAsNew}
                      onChange={e => setCommitSaveAsNew(e.target.checked)}
                      className="rounded accent-primary"
                    />
                    <span>Save As New Record (fork from original #{activeSession.committed_record_id.slice(0, 8)})</span>
                  </label>
                  <p className="text-[10px] text-muted-foreground pl-5">
                    Unchecked: overwrites the existing record and increments revision (v2, v3, etc.).
                  </p>
                </div>
              )}

              {/* Version Snapshot Option */}
              <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <input
                    type="checkbox"
                    checked={commitCreateSnapshot}
                    onChange={e => setCommitCreateSnapshot(e.target.checked)}
                    className="rounded accent-primary"
                  />
                  <span>Create Dataset Version Snapshot</span>
                </label>

                {commitCreateSnapshot && (
                  <div className="space-y-2 pl-5 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-0.5">Version Tag</label>
                      <input
                        type="text"
                        value={commitVersionTag}
                        onChange={e => setCommitVersionTag(e.target.value)}
                        placeholder="e.g. v1.1.0"
                        className="w-full px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase font-mono text-muted-foreground block mb-0.5">Version Description</label>
                      <input
                        type="text"
                        value={commitVersionDesc}
                        onChange={e => setCommitVersionDesc(e.target.value)}
                        placeholder="Summary of changes in this version..."
                        className="w-full px-2.5 py-1 rounded bg-background border border-border text-xs text-foreground"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-secondary/40 border border-border text-[11px] space-y-1 font-mono text-muted-foreground">
                <div>Model: {activeSession.model || activeModel}</div>
                <div>Turns: {activeSession.messages.length} messages (Canonical ChatML Schema)</div>
                <div>Language Mode: {activeSession.language_mode || 'monolingual'}</div>
                <div>Source: {lookupLanguage(activeSession.primary_language || 'id').name}</div>
                {targetLanguages.length > 0 && (
                  <div>Targets: {targetLanguages.map(l => lookupLanguage(l).name).join(', ')}</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowCommitModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium hover:bg-secondary border border-border cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommitConfirm}
                disabled={isCommitting}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <BookmarkPlus className="h-4 w-4" />
                {isCommitting ? 'Saving...' : 'Confirm & Save to Corpus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
