# AgLivre App

App mobile do AgLivre. Expo SDK 54 + React Native + TypeScript + Expo Router.

Conecta ao backend Next.js em `/Users/2480dtidigital/projetos/aglivre/web`.

## Setup

```bash
cd /Users/2480dtidigital/projetos/aglivre/app
npm install
cp .env.example .env
# Ajustar EXPO_PUBLIC_API_URL no .env para o IP/host do aglivre/web
npm start
```

Depois pressione:
- `i` para iOS simulator
- `a` para Android emulator
- escaneie QR para device físico (Expo Go)

## URL da API

Edite `.env`:

- **iOS simulator**: `http://localhost:3000`
- **Android emulator**: `http://10.0.2.2:3000`
- **Device físico**: `http://<IP_DA_MAQUINA_NA_REDE>:3000` (ex: `http://192.168.1.10:3000`)

⚠️ Em device físico, o back-end (aglivre/web) precisa aceitar conexões em `0.0.0.0`.

## Estrutura

```
app/                    # Expo Router routes (file-based)
├── _layout.tsx         # Root providers
├── index.tsx           # Login ou redirect /home
├── home.tsx
├── forgot-password.tsx
├── reset-password.tsx
└── verify-email.tsx

src/
├── components/         # Button, Input, Card, Checkbox, Logo, ConfirmDialog, Animated
├── constants/          # API_CONFIG, STORAGE_KEYS, COLORS, SPACING
├── contexts/           # Auth, Theme
├── operations/         # authOperations
├── screens/            # Login, Home, ForgotPassword, ResetPassword, VerifyEmail
├── services/           # api.ts + authService
├── types/              # Tipos TypeScript
└── utils/              # storage (SecureStore), toast, format
```

## Fluxo de autenticação

1. Login via `POST /api/v1/auth/login` → token JWT salvo em SecureStore (`aglivre_auth_token`)
2. Interceptor Axios injeta `Authorization: Bearer <token>` automaticamente
3. Em 401 → limpa token e redireciona para login
4. Cadastro requer verificação por email (código de 6 dígitos)
5. Esqueci senha → código de 6 dígitos → reset
