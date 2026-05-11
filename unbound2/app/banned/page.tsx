"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function BannedPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

async function logout() {
await supabase.auth.signOut();
router.replace("/login");
}

return (
<div
style={{
minHeight: "100vh",
display: "grid",
placeItems: "center",
padding: 24,
color: "white",
}}
>
<div
style={{
width: "min(620px, 94vw)",
padding: 28,
borderRadius: 24,
background: "rgba(0,0,0,0.72)",
border: "1px solid rgba(255,80,80,0.45)",
boxShadow: "0 0 35px rgba(255,80,80,0.22)",
}}
>
<h1
style={{
marginTop: 0,
color: "rgba(255,180,180,0.98)",
}}
>
Account banned
</h1>

<p style={{ lineHeight: 1.6, opacity: 0.9 }}>
This account has been banned from Unbound. Access to posting,
messaging, stories, and other community features has been
restricted.
</p>

<button
onClick={logout}
style={{
marginTop: 20,
padding: "10px 18px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.35)",
background: "rgba(0,0,0,0.45)",
color: "white",
cursor: "pointer",
fontWeight: 800,
}}
>
Log Out
</button>
</div>
</div>
);
}