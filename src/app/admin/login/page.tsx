import { isRegistrationOpen } from "@/lib/registration"
import LoginClient from "./LoginClient"

// Server Component — lê o estado do registro em request time e passa
// pro client component como prop. Sem fetch posterior + sem flicker
// "tab Entrar → Criar conta → waitlist" entre renders.
export const dynamic = "force-dynamic"

export default function LoginPage() {
  const registrationOpen = isRegistrationOpen()
  return <LoginClient registrationOpen={registrationOpen} />
}
