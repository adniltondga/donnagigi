import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const key = process.env.ASAAS_API_KEY
  return NextResponse.json({
    ASAAS_API_KEY: key ? `${key.slice(0, 10)}... (${key.length} chars)` : "NOT SET",
    ASAAS_API_URL: process.env.ASAAS_API_URL || "NOT SET",
  })
}
