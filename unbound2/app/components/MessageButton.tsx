"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = (() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
}
return createClient(url, key);
})();

export default function MessageButton({ toUserId }: { toUserId: string }) {
const router = useRouter();
const [loading, setLoading] = useState(false);

const start = async () => {
if (loading) return;
setLoading(true);

try {
// get auth token for API route
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

const res = await fetch("/api/conversations/get-or-create", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
  },
  body: JSON.stringify({ to: toUserId }),
});



const json = await res.json().catch(() => ({}));
if (!res.ok) {
throw new Error(json?.error ?? "Failed to start conversation");
}

router.push(`/messages/${json.conversation_id}`);
} catch (e: any) {
alert(e?.message ?? "Could not start conversation");
} finally {
setLoading(false);
}
};

return (
<button
type="button"
onClick={start}
disabled={loading}
style={{
padding: "10px 18px",
borderRadius: 12,
background: "linear-gradient(180deg, #a47aed, #49159e)",
border: "none",
outline: "none",
color: "#f5edff",
fontWeight: 700,
fontSize: 14,
cursor: loading ? "default" : "pointer",
opacity: loading ? 0.7 : 1,
boxShadow: "0 0 22px rgba(170, 90, 255, 0.55)",
transition: "transform 0.12s ease, box-shadow 0.12s ease",
}}
onMouseDown={(e) => {
e.currentTarget.style.transform = "scale(0.97)";
}}
onMouseUp={(e) => {
e.currentTarget.style.transform = "scale(1)";
}}
>
{loading ? "Opening…" : "Message"}
</button>
);
}