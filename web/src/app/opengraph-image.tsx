import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt =
  "agLivre — Gestão financeira para vendedores do Mercado Livre"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * OG image gerada dinamicamente pelo Next 14.
 *
 * Apontado automaticamente em <meta property="og:image"> e
 * <meta name="twitter:image"> da home — substitui a necessidade
 * de manter um PNG estático em public/og-image.png.
 *
 * Edita o JSX abaixo pra ajustar o visual; Next regera no build
 * (e cacheia em runtime).
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "72px",
          color: "white",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          backgroundImage:
            "linear-gradient(135deg, #6d28d9 0%, #a21caf 60%, #c026d3 100%)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
          }}
        >
          <div
            style={{
              width: "84px",
              height: "84px",
              background: "white",
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              color: "#6d28d9",
              fontSize: "40px",
              letterSpacing: "-0.02em",
            }}
          >
            aL
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "52px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            <span>ag</span>
            <span style={{ opacity: 0.8 }}>Livre</span>
          </div>
        </div>

        {/* Spacer */}
        <div style={{ display: "flex", flex: 1 }} />

        {/* Headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "84px",
              fontWeight: 800,
              lineHeight: 1.02,
              letterSpacing: "-0.03em",
              maxWidth: "1000px",
            }}
          >
            Gestão financeira para vendedores do Mercado Livre
          </div>
          <div
            style={{
              fontSize: "30px",
              opacity: 0.9,
              fontWeight: 500,
              maxWidth: "1000px",
            }}
          >
            Lucro real · Taxas e devoluções · Liberações do Mercado Pago
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "56px",
            fontSize: "26px",
          }}
        >
          <div style={{ opacity: 0.85 }}>aglivre.dgadigital.com.br</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 22px",
              background: "rgba(255,255,255,0.18)",
              borderRadius: "999px",
              fontWeight: 600,
            }}
          >
            14 dias grátis
          </div>
        </div>
      </div>
    ),
    size,
  )
}
