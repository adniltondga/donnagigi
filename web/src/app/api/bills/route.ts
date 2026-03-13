import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const category = searchParams.get('category');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Auto-update overdue status
    const now = new Date();
    await prisma.bill.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      data: {
        status: 'overdue',
      },
    });

    // Build filter
    const where: any = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (category) where.category = category;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = new Date(startDate);
      if (endDate) where.dueDate.lte = new Date(endDate);
    }

    // Execute queries in parallel
    const [bills, total, payableAgg, receivableAgg, overdueAgg] = await Promise.all([
      prisma.bill.findMany({
        where,
        include: { supplier: true },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.bill.count({ where }),
      prisma.bill.aggregate({
        where: { type: 'payable', status: { not: 'cancelled' } },
        _sum: { amount: true },
      }),
      prisma.bill.aggregate({
        where: { type: 'receivable', status: { not: 'cancelled' } },
        _sum: { amount: true },
      }),
      prisma.bill.aggregate({
        where: { status: 'overdue' },
        _count: { id: true },
        _sum: { amount: true },
      }),
    ]);

    const totalPayable = payableAgg._sum.amount || 0;
    const totalReceivable = receivableAgg._sum.amount || 0;
    const balance = totalReceivable - totalPayable;
    const totalOverdue = overdueAgg._sum.amount || 0;
    const countOverdue = overdueAgg._count.id || 0;

    return NextResponse.json({
      success: true,
      data: bills,
      summary: {
        totalPayable,
        totalReceivable,
        balance,
        totalOverdue,
        countOverdue,
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching bills:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch bills' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, description, amount, dueDate, category, supplierId, notes, paidDate } = body;

    // Validate required fields
    if (!type || !description || !amount || !dueDate || !category) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Auto-determine status
    const dueDateObj = new Date(dueDate);
    const now = new Date();
    let status = 'pending';

    if (paidDate) {
      status = 'paid';
    } else if (dueDateObj < now) {
      status = 'overdue';
    }

    const bill = await prisma.bill.create({
      data: {
        type,
        description,
        amount: parseFloat(amount),
        dueDate: dueDateObj,
        paidDate: paidDate ? new Date(paidDate) : null,
        status,
        category,
        supplierId: supplierId || null,
        notes: notes || null,
      },
      include: { supplier: true },
    });

    return NextResponse.json({
      success: true,
      data: bill,
    });
  } catch (error) {
    console.error('Error creating bill:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create bill' },
      { status: 500 }
    );
  }
}
