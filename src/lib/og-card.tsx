import { ImageResponse } from "next/og";

export const OG_SIZE = {
  width: 1200,
  height: 630,
};

export const OG_ALT = "ClearCut — Enter. Cut. Leave.";

export function createClearCutOgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 18% 20%, rgba(16, 185, 129, 0.22), transparent 52%), radial-gradient(circle at 85% 80%, rgba(20, 184, 166, 0.14), transparent 48%)",
          padding: "64px 72px",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left Brand Column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "660px",
            height: "100%",
          }}
        >
          {/* Logo Lockup */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <svg
              width="76"
              height="76"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient
                  id="og-badge-grad"
                  x1="4"
                  y1="2"
                  x2="36"
                  y2="38"
                  gradientUnits="userSpaceOnUse"
                >
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="100%" stopColor="#0d9488" />
                </linearGradient>
              </defs>
              <rect
                x="2"
                y="2"
                width="36"
                height="36"
                rx="10"
                fill="url(#og-badge-grad)"
              />
              <rect
                x="2.5"
                y="2.5"
                width="35"
                height="35"
                rx="9.5"
                stroke="#ffffff"
                strokeOpacity="0.25"
              />
              <path
                d="M27.07 12.93A10 10 0 1 0 27.07 27.07"
                stroke="#09090b"
                strokeWidth="3.8"
                strokeLinecap="round"
              />
              <path
                d="M23.25 16.75A4.6 4.6 0 1 0 23.25 23.25"
                stroke="#09090b"
                strokeWidth="3.4"
                strokeLinecap="round"
              />
            </svg>

            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  display: "flex",
                  fontSize: "52px",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#ffffff",
                }}
              >
                <span>Clear</span>
                <span style={{ color: "#34d399" }}>Cut</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "9999px",
                  border: "1px solid rgba(52, 211, 153, 0.35)",
                  backgroundColor: "rgba(16, 185, 129, 0.14)",
                  color: "#6ee7b7",
                  fontSize: "18px",
                  fontWeight: 700,
                  padding: "6px 14px",
                  letterSpacing: "0.08em",
                }}
              >
                AI
              </div>
            </div>
          </div>

          {/* Headline & Subtitle */}
          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div
              style={{
                display: "flex",
                fontSize: "62px",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.08,
                color: "#ffffff",
              }}
            >
              <span>Enter.&nbsp;</span>
              <span style={{ color: "#34d399" }}>Cut.</span>
              <span>&nbsp;Leave.</span>
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "25px",
                lineHeight: 1.45,
                color: "#a1a1aa",
              }}
            >
              Instant batch AI background removal directly in your browser.
              Zero uploads, zero waiting.
            </div>
          </div>

          {/* Feature Pills */}
          <div style={{ display: "flex", gap: "12px" }}>
            {["Batch ZIP Export", "100% On-Device", "PNG • WebP • JPG"].map(
              (label) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    borderRadius: "9999px",
                    border: "1px solid #27272a",
                    backgroundColor: "#18181b",
                    color: "#e4e4e7",
                    fontSize: "18px",
                    fontWeight: 600,
                    padding: "10px 18px",
                  }}
                >
                  {label}
                </div>
              )
            )}
          </div>
        </div>

        {/* Right Visual Cutout Preview Card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "340px",
            height: "410px",
            borderRadius: "28px",
            border: "1px solid #27272a",
            backgroundColor: "#121215",
            padding: "20px",
            boxShadow: "0 24px 60px rgba(0, 0, 0, 0.55)",
          }}
        >
          {/* Checkerboard Preview Stage */}
          <div
            style={{
              display: "flex",
              position: "relative",
              flex: 1,
              borderRadius: "18px",
              border: "1px solid #27272a",
              backgroundColor: "#18181b",
              backgroundImage:
                "linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)",
              backgroundSize: "24px 24px",
              backgroundPosition: "0 0, 0 12px, 12px -12px, -12px 0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* Stylized Subject Cutout Silhouette */}
            <svg
              width="170"
              height="170"
              viewBox="0 0 170 170"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="85"
                cy="85"
                r="62"
                fill="rgba(16, 185, 129, 0.16)"
                stroke="#34d399"
                strokeWidth="3"
                strokeDasharray="8 6"
              />
              <rect
                x="52"
                y="46"
                width="66"
                height="78"
                rx="18"
                fill="#ffffff"
              />
              <circle cx="85" cy="74" r="14" fill="#09090b" />
              <path
                d="M65 106C65 96.6112 72.6112 89 82 89H88C97.3888 89 105 96.6112 105 106V110H65V106Z"
                fill="#09090b"
              />
            </svg>
          </div>

          {/* Card Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "16px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#fafafa",
                }}
              >
                cutout_ready.png
              </span>
              <span style={{ fontSize: "14px", color: "#a1a1aa" }}>
                Transparent Alpha • Ready
              </span>
            </div>
            <div
              style={{
                display: "flex",
                borderRadius: "10px",
                backgroundColor: "#10b981",
                color: "#09090b",
                fontSize: "15px",
                fontWeight: 700,
                padding: "8px 14px",
              }}
            >
              Save
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
    }
  );
}
