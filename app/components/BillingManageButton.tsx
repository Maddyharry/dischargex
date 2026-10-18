import Link from "next/link";

export function BillingManageButton() {
  return (
    <Link
      href="/app/profile"
      className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-400"
    >
      จัดการหรือเปลี่ยนแพ็กเกจ
    </Link>
  );
}
