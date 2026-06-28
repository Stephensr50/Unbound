"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";

export default function SetupProfilePage() {
const router = useRouter();

const [userId, setUserId] = useState<string | null>(null);
const [displayName, setDisplayName] = useState("");
const [username, setUsername] = useState("");
const [checking, setChecking] = useState(false);
const [available, setAvailable] = useState<boolean | null>(null);
const [saving, setSaving] = useState(false);
const [error, setError] = useState<string | null>(null);

const cleanUsername = username
.toLowerCase()
.replace(/^@/, "")
.replace(/[^a-z0-9_]/g, "");

useEffect(() => {
async function loadUser() {
const { data } = await supabase.auth.getUser();

if (!data.user) {
router.push("/login");
return;
}

setUserId(data.user.id);

const { data: profile } = await supabase
.from("profiles")
.select("display_name, username")
.eq("user_id", data.user.id)
.single();

if (profile?.display_name) setDisplayName(profile.display_name);
if (profile?.username) setUsername(profile.username);
}

loadUser();
}, [router]);

useEffect(() => {
async function checkUsername() {
setError(null);
setAvailable(null);

if (!cleanUsername || cleanUsername.length < 3) return;

setChecking(true);

const { data, error } = await supabase
.from("profiles")
.select("id")
.ilike("username", cleanUsername)
.neq("user_id", userId || "")
.maybeSingle();

setChecking(false);

if (error) {
setError(error.message);
return;
}

setAvailable(!data);
}

const timer = setTimeout(checkUsername, 400);
return () => clearTimeout(timer);
}, [cleanUsername, userId]);

async function handleSubmit(e: FormEvent) {
e.preventDefault();
setError(null);

if (!userId) return;

if (!displayName.trim()) {
setError("Please enter a display name.");
return;
}

if (cleanUsername.length < 3) {
setError("Username must be at least 3 characters.");
return;
}

if (available === false) {
setError("That username is already taken.");
return;
}

setSaving(true);

const { error: updateError } = await supabase
.from("profiles")
.update({
display_name: displayName.trim(),
username: cleanUsername,
updated_at: new Date().toISOString(),
})
.eq("user_id", userId);

setSaving(false);

if (updateError) {
setError(updateError.message);
return;
}

router.push("/feed");
}

return (
<main
style={{
minHeight: "100vh",
display: "flex",
justifyContent: "center",
alignItems: "center",
padding: 24,
color: "white",
}}
>
<form
onSubmit={handleSubmit}
style={{
width: "min(520px, 92vw)",
padding: 24,
borderRadius: 22,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.62)",
boxShadow: "0 18px 55px rgba(0,0,0,0.55)",
}}
>
<h1 style={{ marginTop: 0, fontSize: 38 }}>Set up your profile</h1>

<p style={{ opacity: 0.75 }}>
Choose the name people will see on Unbound.
</p>

<label style={{ display: "block", marginTop: 18 }}>
Display name
</label>
<input
value={displayName}
onChange={(e) => setDisplayName(e.target.value)}
placeholder="Display Name"
required
style={inputStyle}
/>

<label style={{ display: "block", marginTop: 18 }}>Username</label>
<input
value={username}
onChange={(e) => setUsername(e.target.value)}
placeholder="@username"
required
style={inputStyle}
/>
<div
style={{
marginTop: 8,
fontSize: 13,
opacity: 0.7,
}}
>
Your username is unique and will appear in your profile link.
</div>
<div style={{ marginTop: 8, minHeight: 24, opacity: 0.8 }}>
{checking && "Checking username..."}
{!checking && available === true && cleanUsername.length >= 3 && (
<span style={{ color: "#8ef58e" }}>@{cleanUsername} is available</span>
)}
{!checking && available === false && (
<span style={{ color: "#ff6b6b" }}>That username is taken</span>
)}
</div>

{cleanUsername && (
<div style={{ marginTop: 8, opacity: 0.7 }}>
yourunbound.com/u/{cleanUsername}
</div>
)}

{error && (
<div style={{ marginTop: 14, color: "#ff6b6b", fontWeight: 700 }}>
{error}
</div>
)}

<button
type="submit"
disabled={saving || checking || available === false}
style={{
width: "100%",
height: 54,
marginTop: 22,
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.18)",
background: "linear-gradient(135deg, #ff2bd6, #8b5cf6)",
color: "white",
fontWeight: 800,
fontSize: 16,
cursor: saving ? "not-allowed" : "pointer",
}}
>
{saving ? "Saving..." : "Continue"}
</button>
</form>
</main>
);
}

const inputStyle: React.CSSProperties = {
width: "100%",
height: 48,
marginTop: 8,
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(0,0,0,0.45)",
color: "white",
padding: "0 14px",
fontSize: 16,
outline: "none",
};