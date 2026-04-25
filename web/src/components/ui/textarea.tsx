import * as React from "react"

import { cn } from "../../lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[120px] w-full rounded-lg border border-admin-300 bg-card px-3 py-2 text-sm text-admin-900 placeholder:text-admin-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-admin-100 disabled:text-admin-500 transition-colors resize-none",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Textarea.displayName = "Textarea"

export { Textarea }
