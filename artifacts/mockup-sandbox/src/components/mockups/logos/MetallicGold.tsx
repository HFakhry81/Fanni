export function MetallicGold() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #1a1208 0%, #0e0b05 50%, #1a1005 100%)",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "40px 20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(245,166,35,0.04) 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
        <div style={{
          position: "relative",
          display: "inline-block",
        }}>
          <svg width="320" height="320" viewBox="0 0 320 320" style={{ position: "absolute", top: -10, left: -10, pointerEvents: "none" }}>
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffe082" />
                <stop offset="25%" stopColor="#F5A623" />
                <stop offset="50%" stopColor="#ffe082" />
                <stop offset="75%" stopColor="#c97a10" />
                <stop offset="100%" stopColor="#ffe082" />
              </linearGradient>
            </defs>
            <circle
              cx="160" cy="160" r="150"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="2.5"
              strokeDasharray="12 6"
              strokeLinecap="round"
            />
            <circle cx="160" cy="10" r="5" fill="#ffe082" />
            <circle cx="160" cy="310" r="5" fill="#F5A623" />
            <circle cx="10" cy="160" r="5" fill="#c97a10" />
            <circle cx="310" cy="160" r="5" fill="#ffe082" />
          </svg>

          <div style={{
            borderRadius: "50%",
            width: "280px",
            height: "280px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle at 35% 30%, #2a1e00, #0e0b05)",
            boxShadow: "0 0 80px rgba(245,166,35,0.15), 0 25px 70px rgba(0,0,0,0.8), inset 0 1px 1px rgba(255,255,255,0.05)",
            margin: "0 auto",
          }}>
            <img
              src="/logos/fanni-logo.png"
              alt="Fanni Logo"
              style={{
                width: "200px",
                height: "200px",
                filter: "sepia(1) saturate(4) hue-rotate(-15deg) brightness(1.15) contrast(1.1)",
                borderRadius: "8px",
              }}
            />
          </div>
        </div>

        <div style={{ marginTop: "36px" }}>
          <h1 style={{
            margin: 0,
            fontSize: "44px",
            fontWeight: 900,
            letterSpacing: "14px",
            background: "linear-gradient(180deg, #ffe082 0%, #F5A623 40%, #c97a10 70%, #ffe082 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            textShadow: "none",
            filter: "drop-shadow(0 2px 8px rgba(245,166,35,0.5))",
          }}>
            FANNI
          </h1>

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            marginTop: "10px",
          }}>
            <div style={{ height: "1px", width: "50px", background: "linear-gradient(90deg, transparent, #c97a10)" }} />
            <p style={{ color: "#c97a10", fontSize: "13px", letterSpacing: "4px", margin: 0, fontWeight: 500 }}>
              فني
            </p>
            <div style={{ height: "1px", width: "50px", background: "linear-gradient(90deg, #c97a10, transparent)" }} />
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
        B — METALLIC GOLD
      </p>
    </div>
  );
}
