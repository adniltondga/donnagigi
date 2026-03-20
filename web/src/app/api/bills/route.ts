import prisma from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    const [bills, total, summary] = await Promise.all([
      prisma.bill.findMany({
        include: { supplier: true },
        orderBy: { dueDate: 'asc' },
        skip,
        take: limit,
      }),
      prisma.bill.count(),
      prisma.$queryRaw<
        { total_payable: number; total_receivable: number; total_overdue: number; count_overdue: number }[]
      >`
        SELECT
          COALESCE(SUM(CASE WHEN type = 'payable' THEN amount ELSE 0 END), 0) as total_payable,
          COALESCE(SUM(CASE WHEN type = 'receivable' THEN amount ELSE 0 END), 0) as total_receivable,
          COALESCE(SUM(CASE WHEN status = 'overdue' THEN amount ELSE 0 END), 0) as total_overdue,
          COALESCE(COUNT(CASE WHEN status = 'overdue' THEN 1 END), 0) as count_overdue
        FROM "Bill"
      `,
    ]);

    const summaryData = summary[0] || {
      total_payable: 0,
      total_receivable: 0,
      total_overdue: 0,
      count_overdue: 0,
    };

    return NextResponse.json({
      data: bills,
      total,
      pages: Math.ceil(total / limit),
      summary: {
        totalPayable: Number(summaryData.total_payable),
        totalReceivable: Number(summaryData.total_receivable),
        balance: Number(summaryData.total_receivable) - Number(summaryData.total_payable),
        totalOverdue: Number(summaryData.total_overdue),
        countOverdue: Number(summaryData.count_overdue),
      },
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
    const { type, description, amount, dueDate, category, supplierId, notes, mlOrderId } = body;

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

    const bill = await prisma.bill.create({
      data: {
        type,
        description,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        category,
        supplierId: supplierId || null,
        notes: notes || null,
        mlOrderId: mlOrderId || null,
      },
      include: { supplier: true },
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
