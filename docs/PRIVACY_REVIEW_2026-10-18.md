# Privacy review — 2026-10-18

## Scope

This review records the summary and specialist chat API boundaries, text redaction behavior, image confirmation flow, feedback email content, and Pro summary snapshot handling changed on this date. It is a technical review, not a legal or clinical compliance certification.

## Text handling

- Clinical text is passed through pattern-based redaction before model prompts. Rules cover common labeled names, HN/AN/MRN/CID/PID identifiers, citizen IDs, phone numbers, email addresses, labeled addresses, and dates of birth.
- Redaction is best-effort. It can miss identifiers and can remove clinically meaningful text. A successful redaction pass does not establish anonymization; health data remains sensitive and requires appropriate review and handling.
- Summary prompt inputs are redacted again at the final serialized model request boundary. Model responses are requested with `store: false`.
- Pro summary snapshots continue to be stored with usage records. Snapshot text receives best-effort redaction before persistence. Authorized administrators may review stored snapshots through existing administrative workflows.

## Image handling

- Images are processed only when the current request includes `imagesRedactedConfirmed: true` from the user's checkbox confirmation. The confirmation resets when attachments change and is required for both generate and recalculate requests.
- The UI asks users to obscure names, HN/AN/CID, dates of birth, addresses, phone numbers, QR codes, and barcodes. It states that images are sent to the AI provider and that DischargeX cannot verify image redaction.
- Confirmed images are sent to the AI provider for OCR or specialist chat processing with response storage disabled. The confirmation is an attestation only; `imageContentVerified` remains false. No automated image anonymization is claimed.
- Unconfirmed image requests are rejected before any model call.

## Feedback email handling

Chat and error-report alerts sent to administrators contain feedback metadata and the admin review path only. They do not include submitted messages, clinical text, or image payloads. Submitted feedback continues to follow the existing application storage and access controls.

## Exposure assessment

Earlier code paths made it possible for raw images or unredacted free-text snippets to be included in provider requests or administrative email alerts. This review records potential exposure paths; it does not establish that any specific data was transmitted, accessed, or disclosed. Existing Pro snapshots were already persisted as part of usage records; this change applies best-effort redaction before new snapshots are saved and does not retroactively certify existing records.

## Verification limits

Automated tests exercise redactor fixtures, unconfirmed-image rejection with zero model calls, the confirmed OCR request's `store: false` setting, disabled specialist-chat behavior, and feedback-alert content. They do not inspect actual provider infrastructure, user-submitted images, production logs, administrator access, or legal compliance.
