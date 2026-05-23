"use client";

import { useEffect, useState, type FormEvent, type CSSProperties } from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";
import Image from "next/image";

function LoginPageContent() {
const router = useRouter();

const [mounted, setMounted] = useState(false);
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
setMounted(true);
}, []);

async function handleLogin(e: FormEvent) {
e.preventDefault();
setError(null);
setLoading(true);

const { error: signInError } = await supabase.auth.signInWithPassword({
email,
password,
});

setLoading(false);

if (signInError) {
setError(signInError.message);
return;
}

router.push("/feed");
}

return (
<div style={wrap}>
  <img
src="/unbound-logo1.png"
alt="Unbound logo"
style={{
width: 520,
height: "auto",
objectFit: "contain",
marginBottom: -180,
filter:
"drop-shadow(0 0 35px rgba(255,60,200,1)) drop-shadow(0 0 90px rgba(180,60,255,1))",
}}
/>
<div style={brand}>UNBOUND</div>
<div style={tagline}>Build Community • Build Your Brand</div>

<form onSubmit={handleLogin} style={card}>
<h1 style={title}>Welcome Back</h1>

{mounted ? (
<>
<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
autoComplete="email"
autoCorrect="off"
autoCapitalize="off"
spellCheck={false}
suppressHydrationWarning
style={input}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
autoComplete="current-password"
autoCorrect="off"
autoCapitalize="off"
spellCheck={false}
suppressHydrationWarning
style={input}
/>
</>
) : (
<>
<div style={inputPlaceholder} />
<div style={inputPlaceholder} />
</>
)}

{error ? <div style={errorText}>{error}</div> : null}

<button type="submit" disabled={loading || !mounted} style={button(loading || !mounted)}>
{loading ? "Logging in…" : "Log in"}
</button>

<p style={footer}>
Don’t have an account?{" "}
<a href="/signup" style={link}>
Sign up
</a>
</p>
</form>
</div>
);
}

const wrap: CSSProperties = {
minHeight: "100vh",
display: "flex",
flexDirection: "column",
alignItems: "center",
justifyContent: "center",
padding: 24,
overflow: "hidden",
};

const brand: CSSProperties = {
textAlign: "center",
fontSize: "clamp(46px, 13vw, 92px)",
fontWeight: 900,
letterSpacing: 1,
marginBottom: 6,
color: "#fc0ce8",
maxWidth: "100%",
textShadow: `
0 0 10px rgba(168,85,247,0.9),
0 0 25px rgba(168,85,247,0.9),
0 0 50px rgba(168,85,247,0.8)
`,
animation: "glowPulse 1.5s ease-in-out infinite alternate",
};

const tagline: CSSProperties = {
textAlign: "center",
fontSize: "clamp(15px, 4vw, 20px)",
fontWeight: 800,
letterSpacing: 0.8,
color: "#c084fc",
marginBottom: 22,
textShadow: "0 0 10px rgba(192,132,252,0.75)",
};

const card: CSSProperties = {
width: "100%",
maxWidth: 520,
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(255,255,255,0.12)",
borderRadius: 18,
padding: 22,
backdropFilter: "blur(10px)",
boxShadow: "0 0 24px rgba(140, 82, 255, 0.20)",
};

const title: CSSProperties = {
fontSize: 42,
margin: 0,
marginBottom: 14,
color: "white",
};

const input: CSSProperties = {
width: "100%",
marginTop: 10,
padding: "12px 14px",
borderRadius: 12,
outline: "none",
color: "white",
background: "rgba(0,0,0,0.45)",
border: "1px solid rgba(255,255,255,0.18)",
};

const inputPlaceholder: CSSProperties = {
width: "100%",
marginTop: 10,
padding: "12px 14px",
borderRadius: 12,
background: "rgba(0,0,0,0.18)",
border: "1px solid rgba(255,255,255,0.10)",
height: 44,
};

const errorText: CSSProperties = {
color: "#ff6b6b",
marginTop: 10,
fontSize: 14,
};

const button = (disabled: boolean): CSSProperties => ({
marginTop: 16,
width: "100%",
border: "none",
borderRadius: 999,
padding: "14px 16px",
fontSize: 18,
fontWeight: 700,
color: "white",
cursor: disabled ? "not-allowed" : "pointer",
background: "linear-gradient(180deg, rgba(160,120,255,1) 0%, rgba(120,80,255,1) 100%)",
boxShadow: "0 0 22px rgba(140, 82, 255, 0.35)",
opacity: disabled ? 0.7 : 1,
});

const footer: CSSProperties = {
marginTop: 14,
color: "rgba(255,255,255,0.75)",
};

const link: CSSProperties = {
color: "#a98bff",
fontWeight: 700,
textDecoration: "none",
};

export default function LoginPage() {
return (
<Suspense fallback={null}>
<LoginPageContent />
</Suspense>
);
}