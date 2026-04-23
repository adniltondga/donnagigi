import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@prisma/client';
import type { SessionPayload } from './tenant';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro'
);

export class ExtensionAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireExtensionSession(req: NextRequest): Promise<SessionPayload> {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    throw new ExtensionAuthError('Token ausente', 401);
  }
  const token = header.slice(7).trim();
  if (!token) throw new ExtensionAuthError('Token ausente', 401);

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.tenantId || !payload.role) {
      throw new ExtensionAuthError('Token inválido', 401);
    }
    return {
      id: String(payload.id),
      email: String(payload.email || ''),
      tenantId: String(payload.tenantId),
      role: payload.role as UserRole,
    };
  } catch (err) {
    if (err instanceof ExtensionAuthError) throw err;
    throw new ExtensionAuthError('Token inválido ou expirado', 401);
  }
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export function withCors(res: NextResponse): NextResponse {
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    res.headers.set(k, v);
  }
  return res;
}

export function corsPreflight(): NextResponse {
  return withCors(new NextResponse(null, { status: 204 }));
}

export function extensionErrorResponse(err: unknown): NextResponse {
  if (err instanceof ExtensionAuthError) {
    return withCors(NextResponse.json({ error: err.message }, { status: err.status }));
  }
  console.error('[extension] erro inesperado:', err);
  return withCors(
    NextResponse.json(
      { error: 'Erro interno', message: err instanceof Error ? err.message : 'erro' },
      { status: 500 }
    )
  );
}
