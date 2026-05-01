"use client"

import { useEffect, useState } from "react"
import { Loader2, PiggyBank, Save } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CashPoolsCard } from "@/components/CashPoolsCard"
import CurrencyInput from "@/components/CurrencyInput"
import { PeriodFilter, resolvePreset, type PeriodPreset } from "@/components/admin/PeriodFilter"
import { feedback } from "@/lib/feedback"

interface Settings {
  saldoCaixaAtual: number | null
  saldoAtualizadoEm: string | null
}

export default function CaixasPage() {
  const initial = resolvePreset("mes")
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [preset, setPreset] = useState<PeriodPreset>("mes")
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="💰 Caixas Virtuais"
        description="Visão de envelopes do seu caixa: o que pode gastar (Operacional), o que precisa repor (Reposição) e a sua reserva (Reserva)."
      />

      <Card className="p-4">
        <PeriodFilter
          from={from}
          to={to}
          preset={preset}
          exclude={["hoje", "7dias"]}
          customLabel="Custom"
          onChange={(next) => {
            setFrom(next.from)
            setTo(next.to)
            setPreset(next.preset)
          }}
        />
        {preset === "custom" && (
          <p className="text-xs text-muted-foreground mt-3">
            Caixa Operacional reflete o mês de início do período (DRE base caixa é mensal).
          </p>
        )}
      </Card>

      <CashPoolsCard key={`${from}-${to}-${refreshKey}`} start={from} end={to} />

      <ReservaCard onSaved={() => setRefreshKey((k) => k + 1)} />
    </div>
  )
}

function ReservaCard({ onSaved }: { onSaved: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [saldo, setSaldo] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/financial-settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s: Settings | null) => {
        if (!s) return
        setSettings(s)
        setSaldo(s.saldoCaixaAtual ?? 0)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch("/api/financial-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldoCaixaAtual: saldo }),
      })
      if (!res.ok) throw new Error("falha ao salvar")
      const updated = (await res.json()) as Settings
      setSettings(updated)
      feedback.success("Saldo atualizado")
      onSaved()
    } catch {
      feedback.error("Erro ao salvar saldo")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-lg flex items-center justify-center shrink-0">
          <PiggyBank className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Atualizar Caixa de Reserva</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Saldo manual da sua reserva (conta bancária + MP disponível). É a única
            das 3 caixas que você edita à mão — as outras duas são calculadas
            automaticamente do seu DRE e CMV.
          </p>
        </div>
      </div>

      <form onSubmit={save} className="space-y-3 max-w-md">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            Saldo em caixa atual (R$)
          </label>
          <CurrencyInput
            value={saldo}
            onChange={setSaldo}
            placeholder="R$ 0,00"
            className="w-full px-3 py-2 border border-border rounded-lg focus:ring-2 focus:ring-primary-600 outline-none"
          />
          {settings?.saldoAtualizadoEm && (
            <p className="text-xs text-muted-foreground mt-1">
              Última atualização:{" "}
              {new Date(settings.saldoAtualizadoEm).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
        <Button type="submit" disabled={saving || loading}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar
        </Button>
      </form>
    </Card>
  )
}
