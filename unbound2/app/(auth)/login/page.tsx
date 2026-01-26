"use client";

import { useState, type FormEvent, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";

export default function LoginPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

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
<form onSubmit={handleLogin} style={card}>
<h1 style={title}>Welcome Back</h1>

<input
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
style={input}
/>

<input
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
style={input}
/>

{error ? <div style={errorText}>{error}</div> : null}

<button type="submit" disabled={loading} style={button(loading)}>
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
alignItems: "center",
justifyContent: "center",
padding: 24,
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

const errorText: CSSProperties = {
color: "#ff6b6b",
marginTop: 10,
fontSize: 14,
};

const button = (loading: boolean): CSSProperties => ({
marginTop: 16,
width: "100%",
border: "none",
borderRadius: 999,
padding: "14px 16px",
fontSize: 18,
fontWeight: 700,
color: "white",
cursor: loading ? "not-allowed" : "pointer",
background:
"linear-gradient(180deg, rgba(160,120,255,1) 0%, rgba(120,80,255,1) 100%)",
boxShadow: "0 0 22px rgba(140, 82, 255, 0.35)",
opacity: loading ? 0.7 : 1,
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