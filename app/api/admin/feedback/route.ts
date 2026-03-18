import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { grantBonusCredits, revokeBonusCredits } from "@/lib/bonus-credits";
import { notifyUser } from "@/lib/notifications";

export const runtime = "nodejs";

function isAdmin(session: unknown) {
  return (session as { user?: { role?: string } } | null)?.user?.role === "admin";
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "" | "chat" | "error_report"
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

    const where = type && ["chat", "error_report"].includes(type) ? { type } : {};

    const list = await prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });

    return NextResponse.json({
      ok: true,
      feedback: list.map((f) => ({
        id: f.id,
        type: f.type,
        message: f.message,
        payload: f.payload,
        userId: f.userId,
        userEmail: f.user?.email ?? null,
        userName: f.user?.name ?? null,
        category: f.category,
        shortSummary: f.shortSummary,
        aiScore: f.aiScore,
        aiSuggestedCredit: f.aiSuggestedCredit,
        adminFinalCredit: f.adminFinalCredit,
        status: f.status,
        adminNote: f.adminNote,
        createdAt: f.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("Admin feedback GET error:", e);
    return NextResponse.json({ ok: false, error: "โหลดรายการไม่สำเร็จ" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!isAdmin(session)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      action?: "approve" | "reject" | "duplicate" | "implemented" | "revoke";
      credit?: number;
      adminNote?: string;
    };
    const id = body.id;
    const action = body.action;
    if (!id || !action) {
      return NextResponse.json({ ok: false, error: "Missing id or action" }, { status: 400 });
    }

    const feedback = await prisma.feedback.findUnique({
      where: { id },
      select: { id: true, userId: true, status: true, adminFinalCredit: true },
    });
    if (!feedback) {
      return NextResponse.json({ ok: false, error: "Feedback not found" }, { status: 404 });
    }

    const reviewerEmail = (session?.user as { email?: string } | undefined)?.email ?? null;
    const now = new Date();
    const finalCredit = Math.max(0, Number(body.credit ?? feedback.adminFinalCredit ?? 0));

    if (action === "approve") {
      if (feedback.status === "approved") {
        return NextResponse.json({ ok: true, idempotent: true });
      }
      if (feedback.userId && finalCredit > 0) {
        await grantBonusCredits({
          userId: feedback.userId,
          amount: finalCredit,
          sourceType: "feedback",
          sourceId: feedback.id,
          note: "Feedback approved",
          createdBy: reviewerEmail,
        });
        await notifyUser({
          userId: feedback.userId,
          type: "bonus",
          title: "ได้รับเครดิตโบนัสจาก Feedback",
          message: `Feedback ของคุณได้รับการอนุมัติ และได้โบนัส +${finalCredit} เครดิต`,
          meta: { feedbackId: feedback.id, credit: finalCredit },
        });
      }
      await prisma.feedback.update({
        where: { id },
        data: {
          status: "approved",
          adminFinalCredit: finalCredit,
          adminNote: body.adminNote ?? null,
          reviewedAt: now,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "revoke") {
      if (feedback.status !== "approved") {
        return NextResponse.json({ ok: false, error: "Only approved feedback can be revoked" }, { status: 400 });
      }
      const creditsToRevoke = feedback.adminFinalCredit ?? 0;
      if (feedback.userId && creditsToRevoke > 0) {
        await revokeBonusCredits({
          userId: feedback.userId,
          amount: creditsToRevoke,
          sourceType: "revoke",
          sourceId: feedback.id,
          note: "Feedback credit revoked",
          createdBy: reviewerEmail,
        });
        await notifyUser({
          userId: feedback.userId,
          type: "bonus",
          title: "เครดิตโบนัสถูกปรับลด",
          message: `เครดิตโบนัสจาก Feedback ถูกยกเลิก -${creditsToRevoke} เครดิต`,
          meta: { feedbackId: feedback.id, credit: creditsToRevoke },
        });
      }
      await prisma.feedback.update({
        where: { id },
        data: {
          status: "revoked",
          adminNote: body.adminNote ?? null,
          reviewedAt: now,
        },
      });
      return NextResponse.json({ ok: true });
    }

    const nextStatus =
      action === "duplicate" ? "duplicate" : action === "implemented" ? "implemented" : "rejected";
    await prisma.feedback.update({
      where: { id },
      data: {
        status: nextStatus,
        adminNote: body.adminNote ?? null,
        ...(action === "implemented" ? { implementedAt: now } : {}),
        reviewedAt: now,
      },
    });
    if (feedback.userId) {
      await notifyUser({
        userId: feedback.userId,
        type: "feedback",
        title: "อัปเดตสถานะ Feedback",
        message:
          nextStatus === "implemented"
            ? "Feedback ของคุณถูกทำเครื่องหมายว่านำไปใช้แล้ว"
            : nextStatus === "duplicate"
            ? "Feedback ของคุณถูกทำเครื่องหมายว่าเป็นรายการซ้ำ"
            : "Feedback ของคุณถูกปฏิเสธ",
        meta: { feedbackId: feedback.id, status: nextStatus },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Admin feedback PATCH error:", e);
    return NextResponse.json({ ok: false, error: "อัปเดตไม่สำเร็จ" }, { status: 500 });
  }
}
