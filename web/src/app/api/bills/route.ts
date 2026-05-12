import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { AuthError, authErrorResponse, requireRole } from '@/lib/auth';
import { parseStartOfDayBR, parseEndOfDayBR } from '@/lib/tz';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const category = searchParams.get('category');
    const excludeCategory = searchParams.get('excludeCategory');
    const excludeAportes = searchParams.get('excludeAportes') === 'true';
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const dueFrom = searchParams.get('dueFrom'); // YYYY-MM-DD (inclusive)
    const dueTo = searchParams.get('dueTo');     // YYYY-MM-DD (inclusive)
    const paidFrom = searchParams.get('paidFrom'); // YYYY-MM-DD (inclusive)
    const paidTo = searchParams.get('paidTo');     // YYYY-MM-DD (inclusive)
    const q = searchParams.get('q')?.trim();
    const orderBy = searchParams.get('orderBy') || 'dueDate_desc';

    const tenantId = await getTenantIdOrDefault();
    const where: any = { tenantId };
    if (category) where.category = category;
    if (excludeCategory) where.category = { not: excludeCategory };
    if (type) where.type = type;
    if (status) where.status = status;
    if (dueFrom || dueTo) {
      where.dueDate = {};
      if (dueFrom) where.dueDate.gte = parseStartOfDayBR(dueFrom);
      if (dueTo) where.dueDate.lte = parseEndOfDayBR(dueTo);
    }
    if (paidFrom || paidTo) {
      where.paidDate = {};
      if (paidFrom) where.paidDate.gte = parseStartOfDayBR(paidFrom);
      if (paidTo) where.paidDate.lte = parseEndOfDayBR(paidTo);
    }
    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { mlOrderId: { contains: q, mode: 'insensitive' } },
        { mlPackId: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Esconde bills da hierarquia "Aporte sócio" (raiz + filhas, incluindo
    // Amortização). Aportes têm tela própria em /admin/financeiro/aportes —
    // não devem poluir a listagem geral de Contas.
    if (excludeAportes) {
      const aporteRoot = await prisma.billCategory.findFirst({
        where: { tenantId, parentId: null, name: 'Aporte sócio', type: 'payable' },
        select: { id: true, children: { select: { id: true } } },
      });
      if (aporteRoot) {
        const ids = [aporteRoot.id, ...aporteRoot.children.map((c) => c.id)];
        where.billCategoryId = { notIn: ids };
      }
    }

    const [orderField, orderDir] = orderBy.split('_');
    const orderClause = { [orderField || 'dueDate']: (orderDir as 'asc' | 'desc') || 'desc' };

    const [rawBills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: {
          billCategory: { include: { parent: true } },
          refunds: { where: { source: 'ml_partial_refund' }, select: { amount: true } },
        },
        orderBy: orderClause,
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

    const bills = rawBills.map(({ refunds, ...b }) => ({
      ...b,
      refundedAmount: refunds.reduce((s, r) => s + r.amount, 0),
    }));

    return NextResponse.json({
      data: bills,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['OWNER', 'ADMIN']);
    const body = await req.json();
    const { type, description, amount, dueDate, category, billCategoryId, supplierId, notes, mlOrderId, productId, productCost } = body;

    // Validação básica (description opcional agora — auto-preenche com nome da subcategoria)
    if (!type || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Resolve descrição auto a partir da subcategoria se não vier explícita
    const tenantId = await getTenantIdOrDefault();
    let resolvedDescription = (description || '').trim();
    let resolvedCategoryName: string | null = null;

    if (billCategoryId) {
      const cat = await prisma.billCategory.findUnique({
        where: { id: billCategoryId },
        select: { id: true, name: true, tenantId: true, parent: { select: { name: true } } },
      });
      if (!cat || cat.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Categoria não encontrada' }, { status: 404 });
      }
      resolvedCategoryName = cat.parent ? `${cat.parent.name} · ${cat.name}` : cat.name;
      if (!resolvedDescription) resolvedDescription = resolvedCategoryName;
    }
    if (!resolvedDescription) {
      return NextResponse.json({ error: 'Informe uma categoria ou uma descrição' }, { status: 400 });
    }

    // Verificar se mlOrderId já existe
    if (mlOrderId) {
      const existing = await prisma.bill.findUnique({
        where: { mlOrderId },
      });
      if (existing) {
        return NextResponse.json(
          { error: 'This order is already registered' },
          { status: 409 }
        );
      }
    }

    // Se productId foi fornecido, puxar o custo automaticamente se não for fornecido
    let finalProductCost = productCost;
    if (productId && !productCost) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { productCost: true },
      });
      if (product) {
        if (!productCost && product.productCost) {
          finalProductCost = product.productCost;
        }
      }
    }

    const bill = await prisma.bill.create({
      data: {
        type,
        description: resolvedDescription,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        category: category || resolvedCategoryName || 'outro',
        billCategoryId: billCategoryId || null,
        supplierId: supplierId || null,
        productId: productId || null,
        notes: notes || null,
        productCost: finalProductCost ? parseFloat(finalProductCost) : null,
        mlOrderId: mlOrderId || null,
        tenantId,
      },
      include: { supplier: true, product: true, billCategory: { include: { parent: true } } },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
