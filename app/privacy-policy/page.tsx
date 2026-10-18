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
            Clinical text entered for charge summary generation is processed to generate draft summaries and coding
            support. Best-effort pattern-based text redaction targets common identifiers such as names, CID, HN/AN,
            contact details, addresses, and dates of birth. It can miss identifiers or redact clinical content, so it
            does not guarantee anonymization; health information remains sensitive.
          </p>
          <p>
            Medical images are sent to the AI provider for text extraction only after the user checks a per-request
            confirmation that the images were reviewed and identifying details were obscured. This confirmation is
            an attestation, not image analysis: DischargeX cannot verify that names, HN/AN/CID, dates of birth,
            addresses, phone numbers, QR codes, or barcodes have been removed. Image requests are not stored by the
            AI provider as configured by this application, but provider processing is still involved.
          </p>
          <p>
            Existing Pro summary snapshots are stored with usage records and may be available for authorized
            administrative review. Snapshot text receives the same best-effort pattern-based redaction, which is not
            a guarantee that all identifying information is removed.
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
