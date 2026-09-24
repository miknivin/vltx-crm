import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import prisma from "@/app/lib/db/prisma";
import { authorizeRoles, isAuthenticatedUser } from "../middlewares/auth";
import { getSuccessStageIds } from "@/app/lib/utils/successStages";

interface MonthlyConversionRate {
  year: number;
  month: string;
  totalContacts: number;
  closedContacts: number;
  conversionRate: string;
}

interface DashboardResponse {
  success: boolean;
  totalContacts: number;
  totalClosedContacts: number;
  monthlyConversionRates: MonthlyConversionRate[];
  currentMonthClosedContacts: number;
  lastMonthClosedContacts: number;
  /// Valuation-side totals: what the open book is estimated at, and what has
  /// actually been paid out for the enquiries that closed.
  openEstimatedValue: number;
  purchasedOfferedValue: number;
  awaitingValuation: number;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthBucket {
  year: number;
  month: number;
  count: bigint;
}

export async function GET(req: NextRequest) {
  try {
    const user = await isAuthenticatedUser(req);

    try {
      authorizeRoles(user, "admin", "team_member");
    } catch {
      return NextResponse.json(
        { error: "Only admins or team members can view dashboard data" },
        { status: 403 }
      );
    }

    const closedStageIds = await getSuccessStageIds();

    const isAdmin = user.role === "admin";
    const scope: Prisma.EnquiryWhereInput = isAdmin
      ? {}
      : { assignedTo: { some: { userId: user.id } } };

    const closed: Prisma.EnquiryWhereInput = closedStageIds.length
      ? { pipelineEntries: { some: { stageId: { in: closedStageIds } } } }
      : // No success stage configured yet means nothing can be closed, rather
        // than an `in ()` that would match everything.
        { id: { in: [] } };

    const now = new Date();
    const previousMonth = subMonths(now, 1);

    const countClosedInRange = (rangeStart: Date, rangeEnd: Date) =>
      prisma.enquiry.count({
        where: {
          AND: [scope, closed, { updatedAt: { gte: rangeStart, lte: rangeEnd } }],
        },
      });

    // Prisma's `groupBy` cannot bucket by month, so the two monthly series
    // come from raw SQL. The scoping is applied with a parameterised join
    // rather than string interpolation.
    const assignmentScope = isAdmin
      ? Prisma.empty
      : Prisma.sql`AND EXISTS (
          SELECT 1 FROM enquiry_assignments ea
          WHERE ea.enquiry_id = e.id AND ea.user_id = ${user.id}::uuid
        )`;

    const closedScope = closedStageIds.length
      ? Prisma.sql`AND EXISTS (
          SELECT 1 FROM pipeline_entries pe
          WHERE pe.enquiry_id = e.id
            AND pe.stage_id = ANY(${closedStageIds}::uuid[])
        )`
      : Prisma.sql`AND FALSE`;

    const [
      totalContacts,
      totalClosedContacts,
      createdByMonth,
      closedByMonth,
      currentMonthClosedContacts,
      lastMonthClosedContacts,
      openValue,
      purchasedValue,
      awaitingValuation,
    ] = await Promise.all([
      prisma.enquiry.count({ where: scope }),
      prisma.enquiry.count({ where: { AND: [scope, closed] } }),
      prisma.$queryRaw<MonthBucket[]>`
        SELECT EXTRACT(YEAR FROM e.created_at)::int AS year,
               EXTRACT(MONTH FROM e.created_at)::int AS month,
               COUNT(*) AS count
        FROM enquiries e
        WHERE TRUE ${assignmentScope}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      prisma.$queryRaw<MonthBucket[]>`
        SELECT EXTRACT(YEAR FROM e.updated_at)::int AS year,
               EXTRACT(MONTH FROM e.updated_at)::int AS month,
               COUNT(*) AS count
        FROM enquiries e
        WHERE TRUE ${assignmentScope} ${closedScope}
        GROUP BY 1, 2
        ORDER BY 1, 2
      `,
      countClosedInRange(startOfMonth(now), endOfMonth(now)),
      countClosedInRange(startOfMonth(previousMonth), endOfMonth(previousMonth)),
      prisma.enquiry.aggregate({
        where: { AND: [scope, { NOT: closed }] },
        _sum: { estimatedValue: true },
      }),
      prisma.enquiry.aggregate({
        where: { AND: [scope, closed] },
        _sum: { offeredAmount: true },
      }),
      prisma.enquiry.count({
        where: { AND: [scope, { estimatedValue: null }] },
      }),
    ]);

    const closedLookup = new Map(
      closedByMonth.map((bucket) => [`${bucket.year}-${bucket.month}`, Number(bucket.count)])
    );

    const monthlyConversionRates: MonthlyConversionRate[] = createdByMonth.map((bucket) => {
      const total = Number(bucket.count);
      const closedCount = closedLookup.get(`${bucket.year}-${bucket.month}`) ?? 0;
      closedLookup.delete(`${bucket.year}-${bucket.month}`);
      return {
        year: bucket.year,
        month: MONTH_NAMES[bucket.month - 1],
        totalContacts: total,
        closedContacts: closedCount,
        conversionRate: total > 0 ? (closedCount / total).toFixed(2) : "0.00",
      };
    });

    // Months where something closed but nothing new came in still belong on
    // the chart.
    for (const [key, count] of closedLookup) {
      const [year, month] = key.split("-").map(Number);
      monthlyConversionRates.push({
        year,
        month: MONTH_NAMES[month - 1],
        totalContacts: 0,
        closedContacts: count,
        conversionRate: "0.00",
      });
    }

    monthlyConversionRates.sort((a, b) =>
      a.year !== b.year
        ? a.year - b.year
        : MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month)
    );

    const response: DashboardResponse = {
      success: true,
      totalContacts,
      totalClosedContacts,
      monthlyConversionRates,
      currentMonthClosedContacts,
      lastMonthClosedContacts,
      openEstimatedValue: Number(openValue._sum.estimatedValue ?? 0),
      purchasedOfferedValue: Number(purchasedValue._sum.offeredAmount ?? 0),
      awaitingValuation,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("login")) {
      return NextResponse.json({ success: false, message }, { status: 401 });
    }
    console.error("Dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
