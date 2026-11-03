import { registerCommands } from './CommandRegistry'
import { useEditorStore } from '../stores/useEditorStore'
import { useThemeStore } from '../../stores/useThemeStore'
import { useInspectorStore } from '../stores/useInspectorStore'
import { useProjectStore } from '../../stores/useProjectStore'

export function initializeDefaultCommands(callbacks: {
  openShortcuts: () => void
  openAbout: () => void
  openQuickOpen: () => void
  saveActive: () => void
}) {
  const store = useEditorStore.getState

  registerCommands([
    // File
    {
      id: 'file.new-project',
      title: 'New Project...',
      category: 'File',
      description: 'Create a new dataset engineering project',
      handler: () => store().openTab({ type: 'projects', title: 'Projects' })
    },
    {
      id: 'file.open-project',
      title: 'Open Project...',
      category: 'File',
      description: 'Switch or manage active workspace projects',
      handler: () => store().openTab({ type: 'projects', title: 'Projects' })
    },
    {
      id: 'file.save',
      title: 'Save Active Editor',
      category: 'File',
      shortcut: 'Ctrl+S',
      description: 'Save changes in the currently focused editor',
      handler: callbacks.saveActive
    },
    {
      id: 'file.export',
      title: 'Export Center',
      category: 'File',
      description: 'Export SFT and DPO datasets in JSONL, CSV, and Parquet',
      handler: () => store().openTab({ type: 'export', title: 'Export Center' })
    },
    {
      id: 'file.preferences',
      title: 'Preferences',
      category: 'File',
      shortcut: 'Ctrl+,',
      description: 'Open application settings and configuration',
      handler: () => store().openTab({ type: 'settings', title: 'Settings' })
    },

    // View
    {
      id: 'view.toggle-explorer',
      title: 'Toggle Project Explorer',
      category: 'View',
      shortcut: 'Ctrl+B',
      description: 'Show or hide left project explorer panel',
      handler: () => store().toggleLeftPanel()
    },
    {
      id: 'view.toggle-inspector',
      title: 'Toggle Property Inspector',
      category: 'View',
      shortcut: 'Ctrl+Shift+I',
      description: 'Show or hide right contextual inspector panel',
      handler: () => store().toggleRightPanel()
    },
    {
      id: 'view.toggle-console',
      title: 'Toggle Bottom Console',
      category: 'View',
      shortcut: 'Ctrl+J',
      description: 'Show or hide bottom console and diagnostics panel',
      handler: () => store().toggleBottomPanel()
    },
    {
      id: 'view.preset-dataset',
      title: 'Preset: Dataset Engineering',
      category: 'View',
      description: 'Switch layout to Corpus, Inspector, and Dataset Preview',
      handler: () => store().applyPreset('dataset-engineering')
    },
    {
      id: 'view.preset-agent',
      title: 'Preset: Agent Engineering',
      category: 'View',
      description: 'Switch layout to Story Architect, Agent Inspector, and Agent Logs',
      handler: () => store().applyPreset('agent-engineering')
    },
    {
      id: 'view.preset-sft',
      title: 'Preset: SFT Engineering',
      category: 'View',
      description: 'Switch layout to SFT Studio, Conversation Inspector, and Preview',
      handler: () => store().applyPreset('sft-engineering')
    },
    {
      id: 'view.preset-dpo',
      title: 'Preset: DPO Evaluation',
      category: 'View',
      description: 'Switch layout to DPO Studio and Generation Logs',
      handler: () => store().applyPreset('dpo-evaluation')
    },
    {
      id: 'view.preset-qa',
      title: 'Preset: Quality Assurance',
      category: 'View',
      description: 'Switch layout to Quality Control and Validation Diagnostics',
      handler: () => store().applyPreset('quality-assurance')
    },
    {
      id: 'view.preset-provider',
      title: 'Preset: Provider Engineering',
      category: 'View',
      description: 'Switch layout to Model Playground and Connection Diagnostics',
      handler: () => store().applyPreset('provider-engineering')
    },
    {
      id: 'view.reset-layout',
      title: 'Reset Workspace Layout',
      category: 'View',
      description: 'Restore default panel dimensions and layout',
      handler: () => store().resetLayout()
    },
    {
      id: 'view.toggle-theme',
      title: 'Toggle Dark / Light Theme',
      category: 'View',
      description: 'Switch application color theme',
      handler: () => useThemeStore.getState().toggleTheme()
    },

    // Tools
    {
      id: 'tools.story-architect',
      title: 'Open Story Architect',
      category: 'Tools',
      description: 'Autonomous multi-turn roleplay dataset generation',
      handler: () => store().openTab({ type: 'story-architect', title: 'Story Architect' })
    },
    {
      id: 'tools.sft-studio',
      title: 'Open SFT Studio',
      category: 'Tools',
      description: 'Curate and edit multi-turn conversation training data',
      handler: () => store().openTab({ type: 'sft', title: 'SFT Studio' })
    },
    {
      id: 'tools.dpo-studio',
      title: 'Open DPO Studio',
      category: 'Tools',
      description: 'Pairwise preference ranking and direct preference optimization',
      handler: () => store().openTab({ type: 'dpo', title: 'DPO Studio' })
    },
    {
      id: 'tools.dataset-forge',
      title: 'Open Dataset Forge',
      category: 'Tools',
      description: 'Document ingestion, chunking, and semantic dataset synthesis',
      handler: () => store().openTab({ type: 'forge', title: 'Dataset Forge' })
    },
    {
      id: 'tools.corpus',
      title: 'Open Mechon Corpus',
      category: 'Tools',
      description: 'Universal dataset repository and record manager',
      handler: () => store().openTab({ type: 'datasets', title: 'Mechon Corpus' })
    },
    {
      id: 'tools.playground',
      title: 'Open Model Playground',
      category: 'Tools',
      description: 'Test inference with connected local and remote LLM providers',
      handler: () => store().openTab({ type: 'playground', title: 'Model Playground' })
    },
    {
      id: 'tools.readiness',
      title: 'Open Training Readiness Audit',
      category: 'Tools',
      description: 'Audit dataset completeness, balance, and fine-tuning readiness',
      handler: () => store().openTab({ type: 'readiness', title: 'Training Readiness' })
    },
    {
      id: 'tools.chat-templates',
      title: 'Open Chat Template Validator',
      category: 'Tools',
      description: 'Verify model tokenizers and chat templates',
      handler: () => store().openTab({ type: 'engineering/templates', title: 'Chat Templates' })
    },
    {
      id: 'tools.sequence-analytics',
      title: 'Open Sequence Analytics',
      category: 'Tools',
      description: 'Token length distributions and sequence histograms',
      handler: () => store().openTab({ type: 'engineering/sequence', title: 'Sequence Analytics' })
    },
    {
      id: 'tools.dedup',
      title: 'Open Semantic Deduplication',
      category: 'Tools',
      description: 'Find duplicate and near-duplicate training examples',
      handler: () => store().openTab({ type: 'engineering/dedup', title: 'Deduplication' })
    },
    {
      id: 'tools.splits',
      title: 'Open Train / Eval Splits',
      category: 'Tools',
      description: 'Partition datasets into deterministic train/test splits',
      handler: () => store().openTab({ type: 'engineering/splits', title: 'Partition Splits' })
    },
    {
      id: 'tools.validation',
      title: 'Run Dataset Validation',
      category: 'Tools',
      description: 'Execute automated schema and quality checks',
      handler: () => store().setBottomActiveTab('validation')
    },
    {
      id: 'tools.diagnostics',
      title: 'Run Provider Diagnostics',
      category: 'Tools',
      description: 'Test connectivity to inference endpoints and key vaults',
      handler: () => store().setBottomActiveTab('diagnostics')
    },

    // Window
    {
      id: 'window.close-tab',
      title: 'Close Active Tab',
      category: 'Window',
      shortcut: 'Ctrl+W',
      description: 'Close the current editor tab',
      handler: () => {
        const id = store().activeTabId
        if (id) store().closeTab(id)
      }
    },
    {
      id: 'window.close-other-tabs',
      title: 'Close Other Tabs',
      category: 'Window',
      description: 'Close all tabs except the currently active one',
      handler: () => {
        const id = store().activeTabId
        if (id) store().closeOtherTabs(id)
      }
    },
    {
      id: 'window.reopen-tab',
      title: 'Reopen Closed Tab',
      category: 'Window',
      description: 'Reopen the most recently closed tab',
      handler: () => store().reopenClosedTab()
    },

    // Help
    {
      id: 'help.shortcuts',
      title: 'Keyboard Shortcuts Reference',
      category: 'Help',
      shortcut: 'Ctrl+/',
      description: 'Display all application keyboard shortcuts',
      handler: callbacks.openShortcuts
    },
    {
      id: 'help.about',
      title: 'About Mechon AI',
      category: 'Help',
      description: 'Show architecture information and version',
      handler: callbacks.openAbout
    }
  ])
}
