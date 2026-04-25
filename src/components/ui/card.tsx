import React from "react"
import { cn } from "@/lib/utils"

/**
 * Card base — fundo branco, border, shadow-sm, rounded-xl. Usado
 * como container principal de seções em todas as páginas do admin.
 *
 * Composição:
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Título</CardTitle>
 *       <CardDescription>Opcional</CardDescription>
 *     </CardHeader>
 *     <CardContent>conteúdo</CardContent>
 *     <CardFooter>rodapé</CardFooter>
 *   </Card>
 *
 * Quando quiser separador entre seções, adicione `border-b` no
 * CardHeader ou `border-t` no CardFooter.
 */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground rounded-xl shadow-sm border border-border",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pt-6 pb-4", className)} {...props} />
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn("text-lg font-bold text-foreground leading-tight", className)}
      {...props}
    />
  )
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground mt-1", className)} {...props} />
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-6 py-4 border-t border-border flex items-center", className)}
      {...props}
    />
  )
}
