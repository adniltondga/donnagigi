import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoadingStateProps {
  label?: string
  size?: "sm" | "md" | "lg"
  variant?: "page" | "card" | "inline"
  className?: string
}

const SPINNER_SIZE: Record<NonNullable<LoadingStateProps["size"]>, string> = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
}

const VARIANT_WRAPPER: Record<NonNullable<LoadingStateProps["variant"]>, string> = {
  page: "flex items-center justify-center py-20 text-muted-foreground",
  card: "flex items-center justify-center py-12 text-muted-foreground",
  inline: "flex items-center justify-center p-6 text-muted-foreground text-sm",
}

export function LoadingState({
  label = "Carregando...",
  size,
  variant = "page",
  className,
}: LoadingStateProps) {
  const spinnerSize = size ?? (variant === "page" ? "lg" : "md")
  return (
    <div className={cn(VARIANT_WRAPPER[variant], className)}>
      <Loader2 className={cn(SPINNER_SIZE[spinnerSize], "animate-spin mr-2")} />
      {label}
    </div>
  )
}
