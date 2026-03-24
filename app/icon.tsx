import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0c1728 0%, #081120 100%)",
          borderRadius: 6,
          border: "1px solid rgba(34, 211, 238, 0.35)",
        }}
      >
        <span
          style={{
            color: "#22d3ee",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: -0.5,
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
          }}
        >
          DX
        </span>
      </div>
    ),
    { ...size },
  );
}
