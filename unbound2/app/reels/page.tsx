"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Reel = {
id: number;
user_id: string;
body: string | null;
media_url: string | null;
media_type: string | null;
media_bucket: string | null;
media_path: string | null;
created_at: string;
signedUrl?: string | null;
};

export default function ReelsPage() {
const [reels, setReels] = useState<Reel[]>([]);
const [loading, setLoading] = useState(true);
const [myUserId, setMyUserId] = useState<string | null>(null);
const [banner, setBanner] = useState("");

useEffect(() => {
supabase.auth.getUser().then(({ data }) => {
setMyUserId(data.user?.id ?? null);
});

loadReels();
}, []);

async function loadReels() {
setLoading(true);

const { data, error } = await supabase
.from("posts")
.select(`
id,
user_id,
body,
media_url,
media_type,
media_bucket,
media_path,
created_at
`)
.eq("is_reel", true)
.order("created_at", { ascending: false });

if (error) {
console.error(error);
setBanner(error.message);
setLoading(false);
return;
}

const withSignedUrls = await Promise.all(
(data || []).map(async (reel: any) => {
if (reel.media_bucket && reel.media_path) {
const { data: signed } = await supabase.storage
.from(reel.media_bucket)
.createSignedUrl(reel.media_path, 60 * 60);

return {
...reel,
signedUrl: signed?.signedUrl ?? reel.media_url,
};
}

return {
...reel,
signedUrl: reel.media_url,
};
})
);

setReels(withSignedUrls);
setLoading(false);
}

async function deleteReel(reel: Reel) {
try {
if (!myUserId) return;

if (reel.user_id !== myUserId) {
setBanner("You can only delete your own reels.");
return;
}

if (reel.media_bucket && reel.media_path) {
await supabase.storage.from(reel.media_bucket).remove([reel.media_path]);
}

const { error } = await supabase
.from("posts")
.delete()
.eq("id", reel.id)
.eq("user_id", myUserId);

if (error) throw error;

setReels((rows) => rows.filter((r) => r.id !== reel.id));
setBanner("");
} catch (e: any) {
setBanner(e.message || "Delete failed");
}
}

if (loading) {
return (
<main style={{ minHeight: "100vh", color: "white", padding: "32px 64px" }}>
Loading reels...
</main>
);
}

if (!reels.length) {
return (
<main style={{ minHeight: "100vh", color: "white", padding: "32px 64px" }}>
<h1 style={{ fontSize: 48, marginBottom: 12 }}>Reels</h1>
<p>No reels yet. Upload a video from the feed to create one.</p>
</main>
);
}

return (
<main style={{ minHeight: "100vh", color: "white", padding: "32px 64px" }}>
<h1 style={{ fontSize: 48, marginBottom: 24 }}>Reels</h1>

{banner && (
<div style={{ marginBottom: 16, color: "#ff7aa8" }}>
{banner}
</div>
)}

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
gap: 18,
maxWidth: 1000,
}}
>
{reels.map((reel) => (
<div
key={reel.id}
style={{
position: "relative",
borderRadius: 18,
overflow: "hidden",
background: "rgba(255,255,255,0.06)",
border: "1px solid rgba(255,255,255,0.12)",
}}
>
{reel.user_id === myUserId && (
<button
onClick={() => {
if (confirm("Delete this reel?")) deleteReel(reel);
}}
style={{
position: "absolute",
top: 8,
right: 8,
zIndex: 5,
border: "none",
borderRadius: 999,
background: "rgba(0,0,0,0.65)",
color: "white",
width: 32,
height: 32,
cursor: "pointer",
fontSize: 20,
lineHeight: "32px",
}}
title="Delete reel"
>
×
</button>
)}

<video
src={reel.signedUrl || ""}
muted
loop
playsInline
controls
style={{
width: "100%",
aspectRatio: "1 / 1",
objectFit: "cover",
display: "block",
}}
/>

{reel.body && (
<div style={{ padding: 12, fontSize: 14 }}>
{reel.body}
</div>
)}
</div>
))}
</div>
</main>
);
}