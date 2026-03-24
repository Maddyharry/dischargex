import { ImageResponse } from "next/og";

export const alt =
  "DischargeX — AI discharge summary and ICD-10 coding support for Thai physicians";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(145deg, #0a1628 0%, #081120 45%, #0c1a2e 100%)",
          border: "1px solid rgba(34, 211, 238, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "linear-gradient(135deg, #22d3ee 0%, #3b82f6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
            }}
          >
            DX
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: "#f8fafc",
                letterSpacing: -1,
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              DischargeX
            </span>
            <span
              style={{
                fontSize: 20,
                color: "#94a3b8",
                fontFamily: "ui-sans-serif, system-ui, sans-serif",
              }}
            >
              IPD · Discharge summary · Thai DRG · ICD-10 review
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "stretch" }}>
          <div
            style={{
              flex: 1,
              borderRadius: 16,
              padding: 24,
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(148, 163, 184, 0.25)",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 13, color: "#64748b", letterSpacing: 2, textTransform: "uppercase" }}>
              Clinical workspace
            </span>
            <span style={{ fontSize: 22, color: "#e2e8f0", lineHeight: 1.35 }}>
              AI-assisted discharge summary & coding structure for Thai hospital charts
            </span>
          </div>
          <div
            style={{
              width: 340,
              borderRadius: 16,
              padding: 20,
              background: "rgba(8, 17, 32, 0.95)",
              border: "1px solid rgba(34, 211, 238, 0.35)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 12, color: "#67e8f9" }}>Suggested ICD-10</span>
            <span style={{ fontSize: 26, color: "#f1f5f9", fontFamily: "ui-monospace, monospace" }}>
              J18.9 · E11.9 · I10
            </span>
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Physician review required</span>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 18, color: "#64748b" }}>dischargex.net</span>
          <span style={{ fontSize: 16, color: "#475569" }}>
            Decision support · Not official DRG grouping
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
