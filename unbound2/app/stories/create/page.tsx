"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

return createClient(url, key);
}

export default function CreateStoryPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [file, setFile] = useState<File | null>(null);
const [caption, setCaption] = useState("");
const [busy, setBusy] = useState(false);
const [msg, setMsg] = useState<string>("");

async function onPost() {
try {
setMsg("");
if (!file) {
setMsg("Pick a photo first.");
return;
}

setBusy(true);

// 1) Get logged-in user
const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;
const user = authData?.user;
if (!user) {
setMsg("You are not logged in.");
return;
}

// 2) Upload to Storage
const ext = file.name.split(".").pop() || "jpg";
const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

const { error: upErr } = await supabase.storage
.from("stories")
.upload(filePath, file, { upsert: false });

if (upErr) throw upErr;

// 3) Get public URL (or signed URL if your bucket is private)
const { data: pub } = supabase.storage.from("stories").getPublicUrl(filePath);
const publicUrl = pub?.publicUrl;
if (!publicUrl) throw new Error("Could not get public URL for uploaded story.");

// 4) Insert story row
const { error: insErr } = await supabase
.from("stories")
.insert({
user_id: user.id,
media_url: publicUrl,
caption: caption.trim() || null,
});

if (insErr) throw insErr;

setMsg("Posted ✅");
router.push("/feed");
router.refresh();
} catch (e: any) {
setMsg(e?.message || "Failed to post story.");
} finally {
setBusy(false);
}
}

return (
<div style={{ maxWidth: 520, margin: "0 auto", padding: 18 }}>
<h1 style={{ fontSize: 26, marginBottom: 12 }}>Create Story</h1>

<div style={{ marginBottom: 12 }}>
<input
type="file"
accept="image/*"
onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
disabled={busy}
/>
</div>

<div style={{ marginBottom: 12 }}>
<input
value={caption}
onChange={(e) => setCaption(e.target.value)}
placeholder="Caption (optional)"
disabled={busy}
style={{
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(180, 120, 255, 0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
}}
/>
</div>

<button
onClick={onPost}
disabled={busy}
style={{
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(180, 120, 255, 0.55)",
background: "rgba(140, 80, 255, 0.18)",
color: "white",
cursor: busy ? "not-allowed" : "pointer",
boxShadow: "0 0 18px rgba(180,120,255,0.25)",
}}
>
{busy ? "Reaching climax..." : "Post Story"}
</button>

{msg ? (
<div style={{ marginTop: 12, opacity: 0.9 }}>
{msg}
</div>
) : null}
</div>
);
}