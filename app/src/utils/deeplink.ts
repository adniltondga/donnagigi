import type { Href } from 'expo-router';

/**
 * Mapa de links do backend (rotas do /admin no web) pra rotas
 * equivalentes no app. Retorna `null` quando não há equivalente —
 * o caller pode fazer fallback (toast, ignorar, abrir no browser).
 *
 * Exemplos:
 *  - `/admin/financeiro/bills/abc123` → `{ pathname: '/contas/[id]', params: { id: 'abc123' } }`
 *  - `/admin/financeiro/painel`       → `/financeiro`
 *  - `/admin/produtos`                → `/produtos`
 *  - `/admin/configuracoes?tab=ml`    → `/anuncios`
 *  - `/admin/billing/planos`          → `null` (sem equivalente no app)
 */
export function backendLinkToAppRoute(link: string | null | undefined): Href | null {
  if (!link) return null;

  // Normaliza: remove host se vier absoluto, garante começar com /
  let path = link.trim();
  try {
    if (/^https?:\/\//i.test(path)) {
      path = new URL(path).pathname + (new URL(path).search ?? '');
    }
  } catch {
    // path malformado — segue com o valor original
  }
  if (!path.startsWith('/')) path = `/${path}`;

  // Separa querystring
  const [pathname, search = ''] = path.split('?');
  const params = new URLSearchParams(search);

  // /admin/financeiro/bills/<id>
  const billMatch = pathname.match(/^\/admin\/financeiro\/bills\/([^/]+)$/);
  if (billMatch) {
    return { pathname: '/contas/[id]', params: { id: billMatch[1] } } as unknown as Href;
  }
  if (pathname === '/admin/financeiro/bills') {
    return '/contas' as Href;
  }

  if (pathname === '/admin/financeiro/cash-pools' || pathname === '/admin/financeiro/caixa') {
    return '/caixas' as Href;
  }

  if (pathname === '/admin/financeiro/painel' || pathname === '/admin/financeiro') {
    return '/financeiro' as Href;
  }

  // /admin/produtos/<id>
  const productMatch = pathname.match(/^\/admin\/produtos\/([^/]+)$/);
  if (productMatch) {
    return { pathname: '/produtos/[id]', params: { id: productMatch[1] } } as unknown as Href;
  }
  if (pathname === '/admin/produtos') {
    return '/produtos' as Href;
  }

  if (pathname === '/admin/configuracoes' && params.get('tab') === 'ml') {
    return '/anuncios' as Href;
  }

  if (pathname === '/admin/notifications' || pathname === '/notifications') {
    return '/notifications' as Href;
  }

  return null;
}
