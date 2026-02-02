"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = (() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing NEXT_PUBLIC_SUPABASE env vars");
return createClient(url, key);
})();

export default function MessageButton({ toUserId }: { toUserId: string }) {
const router = useRouter();
const [loading, setLoading] = useState(false);

const start = async () => {
if (loading) return;
setLoading(true);

try {
// ✅ get current session so API route knows who we are
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;

const res = await fetch("/api/conversations/get-or-create", {
method: "POST",
headers: {
"Content-Type": "application/json",
...(token ? { Authorization: `Bearer ${token}` } : {}),
},
body: JSON.stringify({ to: toUserId }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) throw new Error(json?.error ?? "Failed to start conversation");

router.push(`/messages/${json.conversation_id}`);
} catch (e: any) {
alert(e?.message ?? "Could not start conversation");
} finally {
setLoading(false);
}
};

return (
<button type="button" onClick={start} disabled={loading}>
{loading ? "Opening..." : "Message"}
</button>
);
}