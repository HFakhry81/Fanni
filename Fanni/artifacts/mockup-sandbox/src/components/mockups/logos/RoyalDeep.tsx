export function RoyalDeep() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#060c14",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", opacity: 0.04, pointerEvents: "none" }}>
        <defs>
          <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#F5A623" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          position: "relative",
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
        }}>
          <svg width="340" height="340" viewBox="0 0 340 340" style={{ position: "absolute", top: -30, left: -30, pointerEvents: "none" }}>
            <defs>
              <linearGradient id="borderG" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffe082" stopOpacity="0.9" />
                <stop offset="30%" stopColor="#F5A623" stopOpacity="0.7" />
                <stop offset="60%" stopColor="#c97a10" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#ffe082" stopOpacity="0.7" />
              </linearGradient>
            </defs>
            <rect x="4" y="4" width="332" height="332" rx="28" ry="28"
              fill="none" stroke="url(#borderG)" strokeWidth="1.5" />
            <rect x="14" y="14" width="312" height="312" rx="20" ry="20"
              fill="none" stroke="url(#borderG)" strokeWidth="0.5" opacity="0.4" />
            <g fill="#F5A623" opacity="0.9">
              <polygon points="4,4 22,4 4,22" />
              <polygon points="336,4 318,4 336,22" />
              <polygon points="4,336 22,336 4,318" />
              <polygon points="336,336 318,336 336,318" />
            </g>
            <g fill="#ffe082" opacity="0.5">
              <rect x="1" y="160" width="8" height="1.5" />
              <rect x="331" y="160" width="8" height="1.5" />
              <rect x="160" y="1" width="1.5" height="8" />
              <rect x="160" y="331" width="1.5" height="8" />
            </g>
          </svg>

          <div style={{
            background: "linear-gradient(145deg, #0f1d2e, #0D1B2A)",
            borderRadius: "24px",
            padding: "28px",
            width: "240px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            boxShadow: "0 30px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>
            <img
              src="/logos/fanni-logo.png"
              alt="Fanni Logo"
              style={{
                width: "180px",
                height: "180px",
                display: "block",
                borderRadius: "12px",
                filter: "brightness(1.05) contrast(1.05)",
              }}
            />

            <div style={{
              width: "100%",
              height: "1px",
              background: "linear-gradient(90deg, transparent, rgba(245,166,35,0.5), transparent)",
              margin: "20px 0 16px",
            }} />

            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}>
              <span style={{
                color: "#ffffff",
                fontSize: "26px",
                fontWeight: 800,
                letterSpacing: "8px",
              }}>
                FANNI
              </span>
              <div style={{ width: "1px", height: "20px", background: "rgba(245,166,35,0.5)" }} />
              <span style={{
                color: "#F5A623",
                fontSize: "20px",
                fontWeight: 700,
                letterSpacing: "2px",
              }}>
                فني
              </span>
            </div>

            <p style={{
              color: "#4DADD9",
              fontSize: "10px",
              letterSpacing: "3px",
              margin: "8px 0 0",
              textTransform: "uppercase",
              opacity: 0.8,
            }}>
              HOME SERVICES
            </p>
          </div>
        </div>
      </div>

      <p style={{
        position: "absolute",
        bottom: "18px",
        color: "#c97a10",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "2px",
        opacity: 0.7,
        margin: 0,
      }}>
        D — ROYAL DEEP
      </p>
    </div>
  );
}
