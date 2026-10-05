import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const title = searchParams.get("title") || "Direct Owner Rental Platform in Pune";
    const area = searchParams.get("area") || "Pune";
    const rent = searchParams.get("rent");
    const bhk = searchParams.get("bhk");
    const badge = searchParams.get("badge") || "Zero Brokerage · Verified Truth";

    return new ImageResponse(
      (
        <div
          style={{
            height: "100%",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "space-between",
            backgroundImage: "linear-gradient(to bottom right, #0f172a, #1e1b4b, #311b92)",
            padding: "60px 80px",
            fontFamily: "sans-serif",
            color: "#ffffff",
          }}
        >
          {/* Top Brand Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "48px",
                height: "48px",
                borderRadius: "14px",
                background: "#6366f1",
                color: "#ffffff",
                fontWeight: "900",
                fontSize: "26px",
              }}
            >
              K
            </div>
            <span style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-0.5px" }}>
              Kiraya
            </span>
            <span
              style={{
                marginLeft: "12px",
                padding: "6px 14px",
                borderRadius: "20px",
                background: "rgba(99, 102, 241, 0.25)",
                border: "1px solid rgba(129, 140, 248, 0.4)",
                color: "#a5b4fc",
                fontSize: "16px",
                fontWeight: "600",
              }}
            >
              {badge}
            </span>
          </div>

          {/* Main Title & Subtitle */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "950px" }}>
            <div style={{ fontSize: "52px", fontWeight: "900", lineHeight: "1.15", letterSpacing: "-1px" }}>
              {title}
            </div>
            <div style={{ fontSize: "24px", color: "#94a3b8", fontWeight: "500" }}>
              100% itemized rent & deposit breakdowns · Physically verified in {area}
            </div>
          </div>

          {/* Bottom KPI Bar */}
          <div
            style={{
              display: "flex",
              width: "100%",
              alignItems: "center",
              justifyContent: "space-between",
              borderTop: "1px solid rgba(255,255,255,0.15)",
              paddingTop: "28px",
            }}
          >
            <div style={{ display: "flex", gap: "32px" }}>
              {rent ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", color: "#94a3b8", textTransform: "uppercase" }}>
                    Monthly Rent
                  </span>
                  <span style={{ fontSize: "32px", fontWeight: "800", color: "#34d399" }}>
                    {rent}
                  </span>
                </div>
              ) : null}

              {bhk ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "14px", color: "#94a3b8", textTransform: "uppercase" }}>
                    Configuration
                  </span>
                  <span style={{ fontSize: "32px", fontWeight: "800", color: "#ffffff" }}>
                    {bhk}
                  </span>
                </div>
              ) : null}

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "14px", color: "#94a3b8", textTransform: "uppercase" }}>
                  Locality
                </span>
                <span style={{ fontSize: "32px", fontWeight: "800", color: "#818cf8" }}>
                  {area}, Pune
                </span>
              </div>
            </div>

            <div
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "#f8fafc",
                background: "rgba(255, 255, 255, 0.1)",
                padding: "10px 24px",
                borderRadius: "12px",
              }}
            >
              kirayah.xyz
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (err) {
    console.error("Error generating OG image:", err);
    return new Response("Failed to generate image", { status: 500 });
  }
}
