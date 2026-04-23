import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import prisma from '@/lib/prisma';
import { corsPreflight, extensionErrorResponse, withCors } from '@/lib/extension-auth';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return withCors(
        NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: String(email).toLowerCase().trim() },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        password: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!user) {
      return withCors(
        NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
      );
    }

    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return withCors(
        NextResponse.json({ error: 'Email ou senha inválidos' }, { status: 401 })
      );
    }

    if (!user.emailVerified) {
      return withCors(
        NextResponse.json(
          { error: 'EMAIL_NOT_VERIFIED', message: 'Ative sua conta pelo código enviado por email' },
          { status: 403 }
        )
      );
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || 'seu_jwt_secret_super_seguro'
    );

    const token = await new SignJWT({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      role: user.role,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('30d')
      .sign(secret);

    return withCors(
      NextResponse.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          role: user.role,
        },
        tenant: user.tenant,
      })
    );
  } catch (err) {
    return extensionErrorResponse(err);
  }
}
