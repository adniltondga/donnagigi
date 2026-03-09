import * as React from "react"

import { cn } from "../../lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-lg border border-admin-300 bg-white px-3 py-2 text-sm text-admin-900 placeholder:text-admin-500 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-200 disabled:cursor-not-allowed disabled:bg-admin-100 disabled:text-admin-500 transition-colors",
        className
      )}
      ref={ref}
      {...props}
    />
  )
)
Input.displayName = "Input"

export { Input }
