import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { THAI_PROVINCES, validateBirthDateBE, validateThaiPhone } from "@/lib/thai-input";

export const runtime = "nodejs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      birthDate: true,
      phone: true,
      hospitalName: true,
      province: true,
    },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      role: user.role,
      birthDate: user.birthDate,
      phone: user.phone,
      hospitalName: user.hospitalName,
      province: user.province,
    },
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const email = session.user.email;
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  const phone = typeof body.phone === "string" ? body.phone.trim() : undefined;
  const birthDate = typeof body.birthDate === "string" ? body.birthDate.trim() : undefined;
  const hospitalName =
    typeof body.hospitalName === "string" ? body.hospitalName.trim() : undefined;
  const province = typeof body.province === "string" ? body.province.trim() : undefined;

  if (
    name === undefined &&
    phone === undefined &&
    birthDate === undefined &&
    hospitalName === undefined &&
    province === undefined
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing fields to update" },
      { status: 400 }
    );
  }

  const data: {
    name?: string | null;
    phone?: string | null;
    birthDate?: string | null;
    hospitalName?: string | null;
    province?: string | null;
  } = {};

  if (name !== undefined) data.name = name || null;
  if (phone !== undefined) {
    const v = validateThaiPhone(phone);
    if (!v.ok) {
      return NextResponse.json({ ok: false, error: v.error }, { status: 400 });
    }
    data.phone = v.normalized || null;
  }
  if (birthDate !== undefined) {
    if (birthDate) {
      const err = validateBirthDateBE(birthDate);
      if (err) {
        return NextResponse.json({ ok: false, error: err }, { status: 400 });
      }
    }
    data.birthDate = birthDate || null;
  }
  if (hospitalName !== undefined) data.hospitalName = hospitalName || null;
  if (province !== undefined) {
    if (province && !THAI_PROVINCES.includes(province)) {
      return NextResponse.json({ ok: false, error: "จังหวัดไม่ถูกต้อง" }, { status: 400 });
    }
    data.province = province || null;
  }

  const updated = await prisma.user.update({
    where: { email },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      birthDate: true,
      phone: true,
      hospitalName: true,
      province: true,
    },
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      plan: updated.plan,
      role: updated.role,
      birthDate: updated.birthDate,
      phone: updated.phone,
      hospitalName: updated.hospitalName,
      province: updated.province,
    },
  });
}
