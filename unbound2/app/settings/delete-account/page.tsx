"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function DeleteAccountPage() {
const router = useRouter();
const [confirmText, setConfirmText] = useState("");
const [busy, setBusy] = useState(false);
const [message, setMessage] = useState("");

const supabase = useMemo(() => {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
}, []);

async function deleteAccount() {
if (confirmText !== "DELETE") {
setMessage("Type DELETE exactly to confirm.");
return;
}

const ok = window.confirm(
"This will permanently delete this profile and related Unbound data. This cannot be undone."
);

if (!ok) return;

setBusy(true);
setMessage("");

const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
setBusy(false);
setMessage("Could not find the current signed-in user.");
return;
}

const {
data: { session },
} = await supabase.auth.getSession();

if (!session?.access_token) {
setBusy(false);
setMessage("Your session has expired. Please sign in again.");
return;
}

const response = await fetch("/api/delete-account", {
method: "POST",
headers: {
Authorization: `Bearer ${session.access_token}`,
},
});

const result = await response.json();

if (!response.ok) {
setBusy(false);
setMessage(result.error || "Could not delete account.");
return;
}

await supabase.auth.signOut();

router.push("/login");
}

return (
<main
style={{
minHeight: "100vh",
padding: 24,
color: "white",
background: "rgba(0,0,0,0.88)",
}}
>
<div
style={{
maxWidth: 620,
margin: "0 auto",
padding: 24,
borderRadius: 18,
border: "1px solid rgba(239,68,68,0.35)",
background: "rgba(20,20,28,0.86)",
}}
>
<h1 style={{ marginTop: 0 }}>Delete Account</h1>

<p style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.82)" }}>
This will delete your Unbound profile and related profile data. This
action cannot be undone.
</p>

<p style={{ lineHeight: 1.6, color: "rgba(255,255,255,0.72)" }}>
To confirm, type <strong>DELETE</strong> below.
</p>

<input
value={confirmText}
onChange={(e) => setConfirmText(e.target.value)}
placeholder="Type DELETE"
style={{
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.22)",
background: "rgba(0,0,0,0.45)",
color: "white",
fontSize: 16,
boxSizing: "border-box",
marginBottom: 14,
}}
/>

{message ? (
<p style={{ color: "rgb(248,113,113)", fontWeight: 700 }}>
{message}
</p>
) : null}

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
type="button"
onClick={() => router.push("/settings")}
disabled={busy}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.22)",
background: "rgba(255,255,255,0.08)",
color: "white",
fontWeight: 800,
cursor: "pointer",
}}
>
Cancel
</button>

<button
type="button"
onClick={deleteAccount}
disabled={busy || confirmText !== "DELETE"}
style={{
padding: "10px 16px",
borderRadius: 999,
border: "1px solid rgba(239,68,68,0.55)",
background:
confirmText === "DELETE"
? "rgba(239,68,68,0.9)"
: "rgba(239,68,68,0.28)",
color: "white",
fontWeight: 900,
cursor: busy || confirmText !== "DELETE" ? "not-allowed" : "pointer",
opacity: busy ? 0.7 : 1,
}}
>
{busy ? "Deleting..." : "Permanently Delete Account"}
</button>
</div>
</div>
</main>
);
}