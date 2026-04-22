export function PremiumDark() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "radial-gradient(ellipse at 40% 35%, #1a2e47 0%, #0D1B2A 55%, #060f1a 100%)",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "40px 20px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <p style={{
          color: "#b8c8d8",
          fontSize: "13px",
          letterSpacing: "5px",
          textTransform: "uppercase",
          marginBottom: "28px",
          fontWeight: 400,
          opacity: 0.75,
        }}>
          خدمات المنزل المتكاملة
        </p>

        <div style={{
          position: "relative",
          display: "inline-block",
          borderRadius: "28px",
          padding: "6px",
          background: "linear-gradient(135deg, #F5A623 0%, #f0c060 40%, #e07010 100%)",
          boxShadow: "0 0 60px rgba(245,166,35,0.25), 0 20px 60px rgba(0,0,0,0.6)",
        }}>
          <div style={{
            borderRadius: "22px",
            overflow: "hidden",
            background: "#0D1B2A",
            padding: "10px",
          }}>
            <img
              src="/logos/fanni-logo.png"
              alt="Fanni Logo"
              style={{
                width: "260px",
                height: "260px",
                display: "block",
                borderRadius: "16px",
              }}
            />
          </div>

          <div style={{
            position: "absolute",
            top: "-2px", right: "-2px",
            width: "18px", height: "18px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ffe082, #F5A623)",
            boxShadow: "0 0 10px rgba(245,166,35,0.8)",
          }} />
          <div style={{
            position: "absolute",
            bottom: "-2px", left: "-2px",
            width: "18px", height: "18px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #F5A623, #e07010)",
            boxShadow: "0 0 10px rgba(245,166,35,0.6)",
          }} />
        </div>

        <div style={{ marginTop: "32px" }}>
          <h1 style={{
            color: "#F5A623",
            fontSize: "42px",
            fontWeight: 800,
            letterSpacing: "10px",
            margin: 0,
            textShadow: "0 0 40px rgba(245,166,35,0.4)",
            background: "linear-gradient(90deg, #e07010, #F5A623, #ffe082, #F5A623, #e07010)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            FANNI
          </h1>
          <div style={{
            height: "2px",
            background: "linear-gradient(90deg, transparent, #F5A623, transparent)",
            margin: "10px auto",
            width: "160px",
          }} />
          <p style={{
            color: "#aabbcc",
            fontSize: "14px",
            letterSpacing: "3px",
            margin: 0,
            textTransform: "uppercase",
            fontWeight: 300,
          }}>
            فني
          </p>
        </div>
      </div>

      <p style={{
        position: "absolute",
        bottom: "18px",
        color: "#F5A623",
        fontSize: "12px",
        fontWeight: 600,
        letterSpacing: "2px",
        opacity: 0.6,
        margin: 0,
      }}>
        A — PREMIUM DARK
      </p>
    </div>
  );
}
