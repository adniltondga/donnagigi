import prisma from '@/lib/prisma';
import { getTenantIdOrDefault } from '@/lib/tenant';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const category = searchParams.get('category');
    const excludeCategory = searchParams.get('excludeCategory');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const q = searchParams.get('q')?.trim();
    const orderBy = searchParams.get('orderBy') || 'dueDate_desc';

    const tenantId = await getTenantIdOrDefault();
    const where: any = { tenantId };
    if (category) where.category = category;
    if (excludeCategory) where.category = { not: excludeCategory };
    if (type) where.type = type;
    if (status) where.status = status;
    if (q) {
      where.OR = [
        { description: { contains: q, mode: 'insensitive' } },
        { notes: { contains: q, mode: 'insensitive' } },
        { mlOrderId: { contains: q, mode: 'insensitive' } },
        { mlPackId: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [orderField, orderDir] = orderBy.split('_');
    const orderClause = { [orderField || 'dueDate']: (orderDir as 'asc' | 'desc') || 'desc' };

    const [bills, total] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: { supplier: true, product: true },
        orderBy: orderClause,
        skip,
        take: limit,
      }),
      prisma.bill.count({ where }),
    ]);

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
    const body = await req.json();
    const { type, description, amount, dueDate, category, supplierId, notes, mlOrderId, productId, productCost } = body;

    // Validação básica
    if (!type || !description || !amount || !dueDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    const tenantId = await getTenantIdOrDefault();
    const bill = await prisma.bill.create({
      data: {
        type,
        description,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        category,
        supplierId: supplierId || null,
        productId: productId || null,
        notes: notes || null,
        productCost: finalProductCost ? parseFloat(finalProductCost) : null,
        mlOrderId: mlOrderId || null,
        tenantId,
      },
      include: { supplier: true, product: true },
    });

    return NextResponse.json(bill, { status: 201 });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
