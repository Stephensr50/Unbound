"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";

export default function SignupPage() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [gender, setGender] = useState("");
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const cardStyle: React.CSSProperties = {
width: "min(520px, 92vw)",
padding: 22,
borderRadius: 18,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(0,0,0,0.55)",
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
boxShadow: "0 12px 45px rgba(0,0,0,0.6)",
};

const inputStyle: React.CSSProperties = {
width: "100%",
height: 46,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.45)",
color: "white",
padding: "0 14px",
outline: "none",
marginTop: 10,
};

const buttonStyle: React.CSSProperties = {
width: "100%",
height: 54,
borderRadius: 999,
border: "1px solid rgba(160,120,255,0.45)",
background: "rgba(135, 100, 255, 0.40)",
color: "white",
fontWeight: 700,
fontSize: 16,
marginTop: 14,
cursor: loading ? "not-allowed" : "pointer",
boxShadow: "0 10px 35px rgba(140,110,255,0.25)",
};

async function handleSignup(e: FormEvent) {
e.preventDefault();
setError(null);

// Keep the UI requirement, but we won't write it to DB here.
if (!gender) {
setError("Please select a gender.");
return;
}

setLoading(true);

const { data, error: signUpError } = await supabase.auth.signUp({
email,
password,
});

setLoading(false);

if (signUpError) {
setError(signUpError.message);
return;
}

// If email confirmations are ON, Supabase may not create a session yet.
// So we handle both cases cleanly.
if (!data.session) {
router.push("/login?check_email=1");
return;
}

// If confirmations are OFF, user is signed in immediately.
router.push("/feed");
}

return (
<div
style={{
minHeight: "100vh",
display: "flex",
justifyContent: "center",
alignItems: "center",
padding: 24,
}}
>
<form onSubmit={handleSignup} style={cardStyle}>
<h1 style={{ margin: 0, fontSize: 44, color: "white" }}>Join Unbound</h1>

<input
style={inputStyle}
type="email"
placeholder="Email"
value={email}
onChange={(e) => setEmail(e.target.value)}
required
/>

<input
style={inputStyle}
type="password"
placeholder="Password"
value={password}
onChange={(e) => setPassword(e.target.value)}
required
/>

<select
style={inputStyle}
value={gender}
onChange={(e) => setGender(e.target.value)}
required
>
<option value="" disabled>
Select gender...
</option>
<option value="Male">Male</option>
<option value="Female">Female</option>
<option value="Nonbinary">Nonbinary</option>
<option value="Other">Other</option>
</select>

{error && (
<div style={{ marginTop: 10, color: "#ff6b6b", fontWeight: 600 }}>
{error}
</div>
)}

<button type="submit" style={buttonStyle} disabled={loading}>
{loading ? "Creating account..." : "Create Account"}
</button>

<div style={{ marginTop: 12, opacity: 0.75 }}>
Already have an account? <a href="/login">Log in</a>
</div>
</form>
</div>
);
}