import React from 'react'
import { GripVertical, GripHorizontal } from 'lucide-react'

interface ResizeDividerProps {
  direction?: 'horizontal' | 'vertical'
  isDragging?: boolean
  onMouseDown: (e: React.MouseEvent) => void
  onDoubleClick?: () => void
  className?: string
  title?: string
}

export const ResizeDivider: React.FC<ResizeDividerProps> = ({
  direction = 'horizontal',
  isDragging = false,
  onMouseDown,
  onDoubleClick,
  className = '',
  title = 'Drag to resize panel. Double-click to reset to default.'
}) => {
  if (direction === 'horizontal') {
    return (
      <div
        className={`group relative flex items-center justify-center w-1.5 hover:w-2 shrink-0 cursor-col-resize transition-all select-none z-10 ${
          isDragging ? 'bg-primary w-2' : 'bg-transparent hover:bg-primary/20'
        } ${className}`}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        title={title}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
        <div
          className={`h-8 w-1 rounded-full flex items-center justify-center transition-colors ${
            isDragging ? 'bg-primary' : 'bg-border group-hover:bg-primary/60'
          }`}
        >
          <GripVertical className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
    )
  }

  return (
    <div
      className={`group relative flex items-center justify-center h-1.5 hover:h-2 shrink-0 cursor-row-resize transition-all select-none z-10 ${
        isDragging ? 'bg-primary h-2' : 'bg-transparent hover:bg-primary/20'
      } ${className}`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title={title}
    >
      <div className="absolute inset-x-0 -top-1 -bottom-1" />
      <div
        className={`w-8 h-1 rounded-full flex items-center justify-center transition-colors ${
          isDragging ? 'bg-primary' : 'bg-border group-hover:bg-primary/60'
        }`}
      >
        <GripHorizontal className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  )
}
