"use client";

import { useEffect, useRef, useState } from "react";
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
profiles?: {
username: string | null;
display_name: string | null;
avatar_url: string | null;
} | null;
};

export default function ReelsPage() {
const [reels, setReels] = useState<Reel[]>([]);
const [loading, setLoading] = useState(true);
const [myUserId, setMyUserId] = useState<string | null>(null);
const [banner, setBanner] = useState("");
const [caption, setCaption] = useState("");
const [file, setFile] = useState<File | null>(null);
const [posting, setPosting] = useState(false);
const [showPostBox, setShowPostBox] = useState(false);

const reelRefs = useRef<(HTMLVideoElement | null)[]>([]);
const cardRefs = useRef<(HTMLElement | null)[]>([]);

useEffect(() => {
supabase.auth.getUser().then(({ data }) => {
setMyUserId(data.user?.id ?? null);
});

loadReels();
}, []);

useEffect(() => {
if (!reels.length) return;

const observer = new IntersectionObserver(
(entries) => {
entries.forEach((entry) => {
const index = Number((entry.target as HTMLElement).dataset.index);
const video = reelRefs.current[index];

if (!video) return;

if (entry.isIntersecting && entry.intersectionRatio >= 0.65) {
video.play().catch(() => {});
} else {
video.pause();
}
});
},
{ threshold: [0.25, 0.65, 0.9] }
);

cardRefs.current.forEach((card) => {
if (card) observer.observe(card);
});

return () => observer.disconnect();
}, [reels]);

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
created_at,
profiles (
username,
display_name,
avatar_url
)
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

async function postReel() {
try {
setBanner("");

if (!myUserId) {
setBanner("Please sign in first.");
return;
}

if (!file) {
setBanner("Choose a video first.");
return;
}

if (!file.type.startsWith("video/")) {
setBanner("Reels must be videos.");
return;
}

setPosting(true);

const ext = file.name.split(".").pop() || "mp4";
const path = `posts/${crypto.randomUUID()}.${ext}`;
const bucket = "media";
const { error: uploadError } = await supabase.storage
.from(bucket)
.upload(path, file, {
contentType: file.type,
upsert: false,
});

if (uploadError) throw uploadError;

const { data: publicUrlData } = supabase.storage
.from(bucket)
.getPublicUrl(path);

const { error: insertError } = await supabase.from("posts").insert({
user_id: myUserId,
body: caption.trim() || null,
media_url: publicUrlData.publicUrl,
media_bucket: bucket,
media_path: path,
media_type: file.type,
is_reel: true,
});

if (insertError) throw insertError;

setCaption("");
setFile(null);
setShowPostBox(false);
await loadReels();
} catch (e: any) {
setBanner(e.message || "Could not post reel.");
} finally {
setPosting(false);
}
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

function scrollToNext(index: number) {
const next = cardRefs.current[index + 1];
if (next) {
next.scrollIntoView({ behavior: "smooth", block: "start" });
}
}

if (loading) {
return (
<main style={{ minHeight: "100vh", color: "white", padding: 32 }}>
Loading reels...
</main>
);
}

return (
<main
style={{
height: "100dvh",
overflowY: "auto",
scrollSnapType: "y mandatory",
background: "black",
color: "white",
}}
>
<button
onClick={() => setShowPostBox((v) => !v)}
style={{
position: "fixed",
top: 92,
right: 18,
zIndex: 50,
width: 54,
height: 54,
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.25)",
background: "linear-gradient(135deg, #ff3bd4, #7c3cff)",
color: "white",
fontSize: 34,
fontWeight: 900,
cursor: "pointer",
boxShadow: "0 0 28px rgba(255,59,212,0.45)",
}}
>
+
</button>

{showPostBox && (
<div
style={{
position: "fixed",
top: 155,
left: 16,
right: 16,
zIndex: 60,
padding: 16,
borderRadius: 18,
background: "rgba(10,10,14,0.94)",
border: "1px solid rgba(255,255,255,0.16)",
boxShadow: "0 18px 50px rgba(0,0,0,0.65)",
}}
>
<div style={{ fontSize: 22, fontWeight: 900, marginBottom: 12 }}>
Post a Reel
</div>

<input
type="file"
accept="video/*"
onChange={(e) => setFile(e.target.files?.[0] ?? null)}
style={{ width: "100%", marginBottom: 12, color: "white" }}
/>

<textarea
value={caption}
onChange={(e) => setCaption(e.target.value)}
placeholder="Write a caption..."
style={{
width: "100%",
minHeight: 80,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.18)",
background: "rgba(255,255,255,0.08)",
color: "white",
padding: 12,
resize: "none",
boxSizing: "border-box",
}}
/>

<button
onClick={postReel}
disabled={posting}
style={{
marginTop: 12,
width: "100%",
border: "none",
borderRadius: 999,
padding: "12px 16px",
background: posting
? "rgba(255,255,255,0.18)"
: "linear-gradient(135deg, #ff3bd4, #7c3cff)",
color: "white",
fontWeight: 900,
fontSize: 16,
cursor: posting ? "default" : "pointer",
}}
>
{posting ? "Posting..." : "Post Reel"}
</button>
</div>
)}

{banner && (
<div
style={{
position: "fixed",
top: 28,
left: 16,
right: 16,
zIndex: 70,
padding: 12,
borderRadius: 12,
background: "rgba(0,0,0,0.78)",
color: "#ff7aa8",
textAlign: "center",
}}
>
{banner}
</div>
)}

{!reels.length ? (
<section
style={{
height: "100dvh",
scrollSnapAlign: "start",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 24,
textAlign: "center",
}}
>
<div>
<h1 style={{ fontSize: 44, marginBottom: 10 }}>Reels</h1>
<p style={{ opacity: 0.75 }}>
No reels yet. Tap the + button to post the first one.
</p>
</div>
</section>
) : (
reels.map((reel, index) => (
<section
key={reel.id}
ref={(el) => {
cardRefs.current[index] = el;
}}
data-index={index}
style={{
position: "relative",
height: "100dvh",
scrollSnapAlign: "start",
scrollSnapStop: "always",
background: "black",
overflow: "hidden",
}}
>
{reel.user_id === myUserId && (
<button
onClick={() => {
if (confirm("Delete this reel?")) deleteReel(reel);
}}
style={{
position: "absolute",
top: 92,
right: 18,
zIndex: 20,
border: "none",
borderRadius: 999,
background: "rgba(0,0,0,0.65)",
color: "white",
width: 36,
height: 36,
cursor: "pointer",
fontSize: 22,
}}
title="Delete reel"
>
×
</button>
)}

<video
ref={(el) => {
reelRefs.current[index] = el;
}}
src={reel.signedUrl || ""}
muted
playsInline
controls={false}
onEnded={() => scrollToNext(index)}
onClick={(e) => {
const video = e.currentTarget;
if (video.paused) video.play().catch(() => {});
else video.pause();
}}
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>

<div
style={{
position: "absolute",
left: 18,
right: 88,
bottom: 92,
zIndex: 10,
textShadow: "0 2px 12px rgba(0,0,0,0.85)",
}}
>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
{reel.profiles?.avatar_url ? (
<img
src={reel.profiles.avatar_url}
alt=""
style={{
width: 38,
height: 38,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.35)",
}}
/>
) : (
<div
style={{
width: 38,
height: 38,
borderRadius: 999,
background: "rgba(255,255,255,0.16)",
border: "1px solid rgba(255,255,255,0.25)",
}}
/>
)}

<div style={{ fontWeight: 900, fontSize: 18 }}>
@{reel.profiles?.username || reel.profiles?.display_name || "creator"}
</div>
</div>

{reel.body && (
<div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.35 }}>
{reel.body}
</div>
)}
</div>

<div
style={{
position: "absolute",
right: 18,
bottom: 118,
zIndex: 10,
display: "flex",
flexDirection: "column",
gap: 18,
alignItems: "center",
fontSize: 26,
}}
>
<div>❤️</div>
<div>💬</div>
<div>↗</div>
</div>
</section>
))
)}
</main>
);
}