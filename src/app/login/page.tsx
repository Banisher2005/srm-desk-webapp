"use client";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useSearchParams();
  const fromExtension = params.get("from") === "extension";
  const [tokenCopied, setTokenCopied] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") {
      if (fromExtension) {
        // Fetch a token for the extension
        fetch("/api/token")
          .then(r => r.json())
          .then(d => {
            if (d.token) setToken(d.token);
          });
      } else {
        router.push("/dashboard");
      }
    }
    if (params.get("error") === "AccessDenied") {
      setError("Only @srmist.edu.in Google accounts are allowed.");
    }
  }, [status]);

  if (status === "loading") return (
    <div style={styles.center}>
      <div style={styles.spinner}></div>
    </div>
  );

  if (session && fromExtension && token) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.brand}>SRM <span style={styles.accent}>DESK</span></div>
          <div style={styles.heading}>Extension Connected!</div>
          <p style={styles.sub}>Copy this token into your extension settings to enable cloud sync.</p>
          <div style={styles.tokenBox}>{token}</div>
          <button style={styles.copyBtn} onClick={() => {
            navigator.clipboard.writeText(token);
            setTokenCopied(true);
            setTimeout(() => setTokenCopied(false), 2000);
          }}>
            {tokenCopied ? "✓ Copied!" : "Copy Token"}
          </button>
          <p style={styles.hint}>
            In the extension popup → paste this token → click Save.<br />
            Then use "↑ Upload to Cloud" from the dashboard.
          </p>
          <button style={styles.dashBtn} onClick={() => router.push("/dashboard")}>
            Open Dashboard →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.brand}>SRM <span style={styles.accent}>DESK</span></div>
        <div style={styles.heading}>Sign In</div>
        <p style={styles.sub}>Use your SRM Google account<br />(@srmist.edu.in only)</p>
        {error && <div style={styles.error}>{error}</div>}
        <button style={styles.googleBtn} onClick={() => signIn("google")}>
          <svg width="18" height="18" viewBox="0 0 18 18" style={{marginRight:10,flexShrink:0}}>
            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
          </svg>
          Sign in with Google
        </button>
        <p style={styles.privacy}>Your data is only stored on Vercel KV, tied to your Google account. Nothing is shared.</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight:"100vh", background:"#07070f", display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem",
    backgroundImage:"linear-gradient(rgba(124,58,237,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,.03) 1px,transparent 1px)", backgroundSize:"44px 44px" },
  card: { background:"#0f0f1a", border:"1px solid #1a1a2e", borderRadius:20, padding:"2.5rem 2rem", maxWidth:400, width:"100%", textAlign:"center" },
  center: { minHeight:"100vh", background:"#07070f", display:"flex", alignItems:"center", justifyContent:"center" },
  spinner: { width:32, height:32, border:"3px solid #1a1a2e", borderTop:"3px solid #7c3aed", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  brand: { fontFamily:"'Syne',sans-serif", fontSize:"2rem", fontWeight:800, color:"#e2e8f0", marginBottom:"1.5rem" },
  accent: { color:"#7c3aed" },
  heading: { fontFamily:"'Syne',sans-serif", fontSize:"1.3rem", fontWeight:700, color:"#e2e8f0", marginBottom:".5rem" },
  sub: { fontFamily:"'Space Mono',monospace", fontSize:".7rem", color:"#64748b", marginBottom:"1.5rem", lineHeight:1.7 },
  error: { background:"rgba(239,68,68,.1)", border:"1px solid rgba(239,68,68,.3)", borderRadius:8, padding:".6rem 1rem", fontFamily:"monospace", fontSize:".7rem", color:"#ef4444", marginBottom:"1rem" },
  googleBtn: { display:"flex", alignItems:"center", justifyContent:"center", width:"100%", padding:".75rem 1.5rem", background:"#fff", color:"#1a1a1a", border:"none", borderRadius:10, fontFamily:"'Space Mono',monospace", fontSize:".8rem", fontWeight:700, cursor:"pointer", marginBottom:"1rem" },
  privacy: { fontFamily:"'Space Mono',monospace", fontSize:".6rem", color:"#475569", lineHeight:1.7, marginTop:".5rem" },
  tokenBox: { background:"#050508", border:"1px solid #7c3aed", borderRadius:8, padding:".8rem 1rem", fontFamily:"monospace", fontSize:".65rem", color:"#7c3aed", wordBreak:"break-all", marginBottom:"1rem", textAlign:"left" },
  copyBtn: { width:"100%", padding:".6rem", background:"#7c3aed", color:"#fff", border:"none", borderRadius:8, fontFamily:"'Space Mono',monospace", fontSize:".75rem", cursor:"pointer", marginBottom:".8rem" },
  hint: { fontFamily:"'Space Mono',monospace", fontSize:".62rem", color:"#64748b", lineHeight:1.7, marginBottom:"1rem" },
  dashBtn: { width:"100%", padding:".6rem", background:"transparent", color:"#06b6d4", border:"1px solid rgba(6,182,212,.3)", borderRadius:8, fontFamily:"'Space Mono',monospace", fontSize:".75rem", cursor:"pointer" },
};
