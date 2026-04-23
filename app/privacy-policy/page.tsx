import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — DischargeX",
  description: "Privacy policy for DischargeX.",
  alternates: { canonical: "/privacy-policy" },
  robots: {
    index: false,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#081120] text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Link href="/" className="mb-6 inline-block text-sm text-slate-400 hover:text-white">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
        <div className="mt-8 space-y-5 text-sm leading-7 text-slate-300">
          <p>
            DischargeX collects only the information required to provide account access, plan management,
            and service operation. We do not sell personal data to third parties.
          </p>
          <p>
            Account data may include name, email, phone number, organization, usage logs, and billing
            request records submitted by the user. Uploaded payment slips are used only for payment
            verification.
          </p>
          <p>
            Clinical text entered into the workspace is processed to generate draft summaries and coding
            support. The system automatically redacts common identifiers (for example name, CID, HN/AN)
            before sending text to AI models, and users remain responsible for institutional compliance.
          </p>
          <p>
            We use reasonable security controls such as authenticated access and transport security.
            No online service can guarantee absolute security. Contact us immediately if you suspect
            unauthorized account access.
          </p>
          <p>
            By using DischargeX, you agree to this policy and the terms of service. For legal notices,
            please see <Link href="/legal" className="text-cyan-400 hover:underline">Reference &amp; Legal Notice</Link>.
          </p>
        </div>
      </div>
    </main>
  );
}
