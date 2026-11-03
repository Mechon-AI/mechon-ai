import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled rendering error:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-background text-foreground select-none">
          <div className="max-w-md w-full p-6 rounded-2xl bg-card border border-destructive/30 shadow-xl space-y-4 text-center">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
              <AlertTriangle className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <h3 className="font-bold text-sm text-foreground">
                {this.props.fallbackTitle || 'View Rendering Error'}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {this.props.fallbackMessage ||
                  'An unexpected rendering issue occurred while displaying this module. The application state is safe and preserved.'}
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-lg bg-secondary/80 border border-border text-[11px] font-mono text-destructive text-left overflow-x-auto max-h-28">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 shadow-sm hover:opacity-90 transition-all cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reload View
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/'
                }}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
