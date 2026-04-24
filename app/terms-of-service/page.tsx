import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — DischargeX",
  description: "Terms of service for DischargeX.",
  alternates: { canonical: "/terms-of-service" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-300">
          <p>
            DischargeX is a clinical documentation support tool. It is not a licensed medical decision
            system, not a statutory grouper, and not a replacement for physician or coder judgment.
          </p>
          <p>
            Users must review all generated outputs before clinical or billing use. Final responsibility
            for diagnosis coding, summary accuracy, and compliance remains with the user and institution.
          </p>
          <p>
            Account access is personal and must not be shared. Service plans, usage quotas, and limits are
            enforced according to the active subscription policy shown in the application.
          </p>
          <p>
            Misuse, unauthorized automation, abuse of payment workflows, or attempts to bypass security
            controls may result in account suspension.
          </p>
          <p>
            Continued use of DischargeX means you accept these terms, the{" "}
            <Link href="/privacy-policy" className="text-cyan-400 hover:underline">
              Privacy Policy
            </Link>
            , and the{" "}
            <Link href="/legal" className="text-cyan-400 hover:underline">
              Reference &amp; Legal Notice
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
