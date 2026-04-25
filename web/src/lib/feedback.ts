/**
 * Feedback ao usuário — wrapper padronizado em volta do Sonner.
 *
 * Use em vez de importar `toast` direto de "sonner". Vantagens:
 *  - 1 ponto único caso a gente troque de lib (notistack, react-hot-toast, etc).
 *  - Helpers de uso recorrente (`fromResponse`, `confirmError`, `promise`).
 *  - Mensagens com a "voz" do agLivre — descrições padrão pra erros sem texto.
 *
 * Exemplo:
 *   import { feedback } from "@/lib/feedback"
 *   feedback.success("Conta atualizada")
 *   await feedback.fromResponse(res, "Salvo")  // toast verde se 2xx, vermelho com erro do body se não
 *   feedback.promise(salvar(), { loading: "Salvando…", success: "Salvo", error: "Falhou" })
 */

import { toast } from "sonner"

interface FeedbackOptions {
  /** Texto secundário em fonte menor abaixo do título. */
  description?: string
  /** Tempo em ms até auto-dismiss. Default do Sonner: ~4s. */
  duration?: number
  /** ID estável pra atualizar/dismiss um toast específico. */
  id?: string | number
}

interface PromiseMessages<T> {
  loading: string
  success: string | ((value: T) => string)
  error: string | ((err: unknown) => string)
}

export const feedback = {
  /** Toast verde, ✓. Use pra confirmar ações concluídas. */
  success(message: string, opts?: FeedbackOptions) {
    return toast.success(message, opts)
  },

  /** Toast vermelho, ✕. Use pra erros que o usuário precisa ver. */
  error(message: string, opts?: FeedbackOptions) {
    return toast.error(message, opts)
  },

  /** Toast amarelo, ⚠. Use pra avisos não-fatais. */
  warning(message: string, opts?: FeedbackOptions) {
    return toast.warning(message, opts)
  },

  /** Toast azul, ℹ. Use pra info contextual. */
  info(message: string, opts?: FeedbackOptions) {
    return toast.info(message, opts)
  },

  /** Toast com spinner. Devolve id pra dar dismiss/update depois. */
  loading(message: string, opts?: FeedbackOptions) {
    return toast.loading(message, opts)
  },

  /** Fecha 1 toast por id, ou todos se omitido. */
  dismiss(id?: string | number) {
    toast.dismiss(id)
  },

  /**
   * Casa um toast com o ciclo de uma Promise:
   *  loading → success | error.
   *
   * Útil pra ações async com latência perceptível (>500ms).
   */
  promise<T>(promise: Promise<T>, msgs: PromiseMessages<T>) {
    return toast.promise(promise, msgs)
  },

  /**
   * Conveniência pra fetch: dispara success/error baseado em `res.ok`.
   * Tenta extrair o campo `error` do JSON do body em caso de falha.
   *
   * Devolve `true` se 2xx, `false` caso contrário — facilita early-return.
   */
  async fromResponse(
    res: Response,
    successMessage: string,
    fallbackError = "Erro inesperado. Tente novamente."
  ): Promise<boolean> {
    if (res.ok) {
      feedback.success(successMessage)
      return true
    }
    let message = fallbackError
    try {
      const data = await res.json()
      if (typeof data?.error === "string") message = data.error
      else if (typeof data?.message === "string") message = data.message
    } catch {
      // body não é JSON — mantém fallback
    }
    feedback.error(message)
    return false
  },

  /**
   * Erro com descrição genérica de "tente de novo / contate suporte".
   * Use em catch de operações importantes onde o erro técnico não ajuda
   * o usuário (ex: erro de rede, 500).
   */
  unexpectedError(err: unknown, prefix = "Algo deu errado") {
    const detail = err instanceof Error ? err.message : undefined
    feedback.error(prefix, {
      description: detail || "Tente novamente em alguns segundos.",
    })
  },
}

export type Feedback = typeof feedback
