# aglivre-app — CLAUDE.md

App mobile do AgLivre. **Expo SDK 54 + Expo Router v6 + Axios + SecureStore**. Sem state manager global, sem TanStack Query — só Context API + fetches manuais por screen.

> Backend Next.js em `/Users/2480dtidigital/projetos/aglivre/web`.

---

## Stack

- **Expo SDK 54** (`expo@54.0.0`) + **React Native 0.81** + **React 19**
- **expo-router v6** — roteamento file-based (typed routes ON)
- **expo-secure-store** — token + user data (NÃO usar AsyncStorage)
- **axios 1.7** — client HTTP com interceptors
- **react-native-reanimated v4** — animações (spring, fade)
- **react-native-toast-message** — notificações
- **@expo/vector-icons** (Ionicons) — ícones
- **StyleSheet nativo** — **não tem NativeWind/Tailwind**, é tudo `StyleSheet.create`
- **Sem form libs** — validação manual com `useState` + regex

---

## Estrutura de pastas

```
app/                              # Expo Router (file-based)
├── _layout.tsx                   # Root: SafeAreaProvider + ThemeProvider + AuthProvider + Toast
├── index.tsx                     # Gate de auth → /home ou login
├── home.tsx                      # Wrapper do HomeScreen
├── forgot-password.tsx
├── reset-password.tsx
└── verify-email.tsx

src/
├── components/                   # Button, Input, Card, Checkbox, Animated (FadeInView, SlideUpView), Logo, ConfirmDialog
├── screens/                      # LoginScreen, HomeScreen, ForgotPasswordScreen, ResetPasswordScreen, VerifyEmailScreen
├── services/
│   ├── api.ts                    # axios instance + interceptors + apiCall<T>()
│   └── authService.ts
├── operations/                   # Camada fina sobre services (authOperations orquestra login + storage)
├── contexts/
│   ├── AuthContext.tsx           # user, token, login, register, logout, checkAuth
│   └── ThemeContext.tsx          # mode, isDark, colors
├── types/                        # User, AuthResponse, OperationResult, Paginated, ApiError
├── utils/                        # storage (SecureStore wrapper), toast, format
└── constants/
    └── index.ts                  # API_CONFIG, COLORS, SPACING, FONT_SIZE, BORDER_RADIUS, STORAGE_KEYS
```

**Alias:** `@/*` → `src/*` (babel-plugin-module-resolver + tsconfig paths).

---

## Padrões obrigatórios

### Roteamento (Expo Router)

Rotas são arquivos dentro de `app/`. Typed routes está ON em `app.json` — use `router.push('/...')` tipado.

Convenção sugerida ao adicionar módulo CRUD:
- `app/<modulo>/index.tsx` — lista
- `app/<modulo>/new.tsx` — criar
- `app/<modulo>/[id].tsx` — editar (recebe `id` via `useLocalSearchParams<{ id: string }>()`)

Cada arquivo em `app/` deve ser **wrapper fino** que importa uma screen de `src/screens/`. A lógica fica em `src/screens/`.

```tsx
// app/clients/[id].tsx
import { useLocalSearchParams } from 'expo-router';
import { ClientFormScreen } from '@/screens/ClientFormScreen';

export default function ClientEditRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientFormScreen clientId={id} />;
}
```

### HTTP

**Sempre** use `apiClient` de `src/services/api.ts` ou o service correspondente. Os interceptors já tratam:
- Token injection (SecureStore) exceto para rotas `/auth/`
- 401 → limpa auth e força logout
- 403, 500/502/503, sem conexão → toast apropriado

**Não** chame `fetch` direto. **Não** adicione novo axios instance.

```ts
// exemplo de novo service
import { apiClient, apiCall } from './api';
import { API_CONFIG } from '@/constants';

export const fooService = {
  list: () => apiCall<Foo[]>(() => apiClient.get('/api/v1/foos')),
  // ...
};
```

`apiCall<T>()` retorna discriminated union `{ success: true; data: T } | { success: false; error: string }` — **sempre** checar `success` antes de usar `data`.

Endpoints novos → adicionar em `src/constants/index.ts` em `API_CONFIG.ENDPOINTS`.

### Auth

- `useAuth()` de `AuthContext` expõe `{ user, token, isAuthenticated, isLoading, login, register, logout }`.
- Token e user data vivem em **SecureStore** com chaves de `STORAGE_KEYS` (`aglivre_auth_token`, `aglivre_user_data`).
- Ao abrir o app, `_layout.tsx` dispara `checkAuth()` → restaura sessão.
- `app/index.tsx` redireciona baseado em `isAuthenticated`.

### Tema

- `useTheme()` retorna `{ mode, isDark, colors, setMode, toggleTheme }`.
- Screens devem pegar cores do contexto, não de `COLORS` estático. `COLORS` é só o fallback/base.
- Modo persistido em SecureStore com chave `aglivre_theme_mode`.

### Estilo (StyleSheet)

Cada screen/componente tem `StyleSheet.create` no fim do arquivo. Use tokens de `src/constants/index.ts`:

```ts
import { SPACING, FONT_SIZE, BORDER_RADIUS } from '@/constants';

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACING.md },
  title: { fontSize: FONT_SIZE.xl, fontWeight: '600' },
  card: { borderRadius: BORDER_RADIUS.md, padding: SPACING.lg },
});
```

Cores devem vir do tema (`colors.background`, `colors.text`, `colors.primary`) quando a tela respeita dark mode.

### Componentes

Reutilizáveis vão em `src/components/`. Siga `Button` como referência:
- Variantes via prop `variant`
- Animação spring com reanimated em interações
- Estado de loading interno

Ícones: `<Ionicons name="..." size={...} color={...} />`.

### Forms

**Sem biblioteca de form.** Padrão:

```tsx
const [email, setEmail] = useState('');
const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

const validate = () => {
  const next: typeof errors = {};
  if (!email) next.email = 'E-mail obrigatório';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'E-mail inválido';
  setErrors(next);
  return Object.keys(next).length === 0;
};
```

Sempre envolver formulários em `KeyboardAvoidingView` + `ScrollView`.

### Toasts

Use `toast` de `src/utils/toast.ts` (wrapper de react-native-toast-message). Mensagens em português.

---

## Checklist ao adicionar feature nova

1. Types em `src/types/` batem com response do back.
2. Endpoint em `API_CONFIG.ENDPOINTS` (`src/constants/index.ts`).
3. Service em `src/services/` usa `apiCall<T>`.
4. Screen em `src/screens/`, rotas em `app/<modulo>/`.
5. Forms validam antes do submit e mostram toasts.
6. Telas respeitam `useTheme()` (dark mode).
7. `npm run lint` passa.

---

## Variáveis de ambiente

```
EXPO_PUBLIC_API_URL=http://localhost:3000     # Em device físico, usar IP da máquina, não localhost
```

⚠️ **Device físico não enxerga `localhost`.** Use o IP da sua máquina na LAN (ex: `http://192.168.0.10:3000`). O back precisa estar com `CORS_ORIGIN` permitindo esse IP ou `*` em dev.

---

## Scripts

```bash
npm start              # expo start
npm run ios            # expo run:ios
npm run android        # expo run:android
npm run web
npm run lint
```

---

## Pegadinhas

- **SecureStore ≠ AsyncStorage.** Chaves aceitam só `[A-Za-z0-9._-]` e valor até ~2KB no iOS. Não salve objetos grandes.
- **Expo Router typed routes** — mudou rota? Rode o dev server pra regenerar os types (`.expo/types/router.d.ts`).
- **Reanimated v4** precisa do plugin Babel ser o **último** em `babel.config.js`. Não remova.
- **React 19 + RN 0.81** — alguns libs antigas quebram. Antes de instalar nova dep, cheque compat com Expo SDK 54.
- **Axios interceptor de 401** faz logout automático → se o back retornar 401 por motivo não-auth, isso desloga o user.
- Em dev, `EXPO_PUBLIC_API_URL=http://localhost:3000` só funciona no simulador iOS. Android emulador usa `10.0.2.2`, device físico usa IP real.
