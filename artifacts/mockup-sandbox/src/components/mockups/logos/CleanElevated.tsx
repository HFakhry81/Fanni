export function CleanElevated() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #f8f9fb 0%, #eef0f5 100%)",
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        padding: "40px 20px",
        position: "relative",
      }}
    >
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "4px",
        background: "linear-gradient(90deg, #0D1B2A, #4DADD9, #F5A623)",
      }} />

      <div style={{ textAlign: "center" }}>
        <div style={{
          display: "inline-block",
          borderRadius: "32px",
          background: "#ffffff",
          padding: "20px",
          boxShadow: [
            "0 2px 4px rgba(13,27,42,0.04)",
            "0 8px 16px rgba(13,27,42,0.08)",
            "0 20px 40px rgba(13,27,42,0.12)",
            "0 40px 80px rgba(13,27,42,0.08)",
          ].join(", "),
          position: "relative",
        }}>
          <div style={{
            position: "absolute",
            top: "-1px", left: "20%", right: "20%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, rgba(77,173,217,0.6), transparent)",
          }} />
          <img
            src="/logos/fanni-logo.png"
            alt="Fanni Logo"
            style={{
              width: "220px",
              height: "220px",
              display: "block",
              borderRadius: "18px",
            }}
          />
        </div>

        <div style={{ marginTop: "36px" }}>
          <h1 style={{
            margin: 0,
            fontSize: "40px",
            fontWeight: 800,
            letterSpacing: "10px",
            color: "#0D1B2A",
            textTransform: "uppercase",
          }}>
            FANNI
          </h1>

          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            margin: "14px 0",
          }}>
            <div style={{ height: "1.5px", flex: 1, maxWidth: "60px", background: "linear-gradient(90deg, transparent, #F5A623)" }} />
            <div style={{
              width: "6px", height: "6px",
              borderRadius: "50%",
              background: "#F5A623",
              boxShadow: "0 0 6px rgba(245,166,35,0.5)",
            }} />
            <div style={{ height: "1.5px", flex: 1, maxWidth: "60px", background: "linear-gradient(90deg, #F5A623, transparent)" }} />
          </div>

          <p style={{
            color: "#4DADD9",
            fontSize: "14px",
            letterSpacing: "5px",
            margin: "0 0 6px",
            fontWeight: 500,
            textTransform: "uppercase",
          }}>
            فني
          </p>
          <p style={{
            color: "#8899aa",
            fontSize: "11px",
            letterSpacing: "2px",
            margin: 0,
            fontWeight: 400,
          }}>
            HOME SERVICES
          </p>
        </div>
      </div>

      <div style={{
        position: "absolute",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        gap: "6px",
        alignItems: "center",
      }}>
        <div style={{ width: "20px", height: "2px", background: "#0D1B2A", borderRadius: "2px" }} />
        <p style={{ color: "#8899aa", fontSize: "11px", fontWeight: 600, letterSpacing: "2px", margin: 0 }}>
          C — CLEAN ELEVATED
        </p>
        <div style={{ width: "20px", height: "2px", background: "#F5A623", borderRadius: "2px" }} />
      </div>
    </div>
  );
}
