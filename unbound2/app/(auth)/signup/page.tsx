"use client";

import { useState, type FormEvent } from "react";
import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";

function SignupPageContent() {
const router = useRouter();

const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [username, setUsername] = useState("");
const [displayName, setDisplayName] = useState("");
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

const cleanUsername = username.trim().toLowerCase();
const cleanDisplayName = displayName.trim();

if (!cleanUsername) {
setError("Please choose a username.");
return;
}

if (cleanUsername.length < 3) {
setError("Username must be at least 3 characters.");
return;
}

if (cleanUsername.length > 30) {
setError("Username must be 30 characters or less.");
return;
}

if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
setError(
"Username can only contain letters, numbers, and underscores."
);
return;
}

if (!cleanDisplayName) {
setError("Please enter a screen name.");
return;
}

if (cleanDisplayName.length > 50) {
setError("Screen name must be 50 characters or less.");
return;
}

if (!gender) {
setError("Please select a gender.");
return;
}

setLoading(true);

// Check whether this username is already taken
const { data: existingUsername, error: usernameCheckError } = await supabase
.from("profiles")
.select("id")
.ilike("username", cleanUsername)
.limit(1);

if (usernameCheckError) {
setLoading(false);
setError("Unable to check username. Please try again.");
return;
}

if (existingUsername && existingUsername.length > 0) {
setLoading(false);
setError("That username is already taken. Please choose another.");
return;
}

const emailRedirectTo =
typeof window !== "undefined"
? `${window.location.origin}/login?verified=1`
: undefined;

const { error: signUpError } = await supabase.auth.signUp({
email,
password,
options: {
emailRedirectTo,
data: {
username: cleanUsername,
display_name: cleanDisplayName,
gender,
},
},
});

setLoading(false);
if (signUpError) {
const message = signUpError.message.toLowerCase();

if (
message.includes("duplicate") ||
message.includes("unique") ||
message.includes("username")
) {
setError("That username is already taken. Please choose another.");
return;
}

setError(signUpError.message);
return;
}

router.push("/login?check_email=1&setup=1");
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
<h1 style={{ margin: 0, fontSize: 44, color: "white" }}>
Join Unbound
</h1>

<input
style={inputStyle}
type="text"
placeholder="Username"
value={username}
onChange={(e) => setUsername(e.target.value)}
autoCapitalize="none"
autoCorrect="off"
maxLength={30}
required
/>

<div
style={{
marginTop: 5,
fontSize: 12,
opacity: 0.65,
}}
>
Letters, numbers, and underscores only
</div>

<input
style={inputStyle}
type="text"
placeholder="Screen name"
value={displayName}
onChange={(e) => setDisplayName(e.target.value)}
maxLength={50}
required
/>

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
<option value="Transgender">Trans</option>
<option value="Non-binary">Non-binary</option>
</select>

{error && (
<div
style={{
marginTop: 10,
color: "#ff6b6b",
fontWeight: 600,
}}
>
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

export default function SignupPage() {
return (
<Suspense fallback={null}>
<SignupPageContent />
</Suspense>
);
}