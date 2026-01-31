"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import styles from "./StoriesBar.module.css";
import StoryModal from "../components/StoryModal";

type StoryRow = {
id: string;
user_id: string;
media_url: string;
caption: string | null;
created_at?: string;
};

type ProfileRow = {
id: string;
username: string | null;
avatar_url: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
throw new Error(
"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
);
}
return createClient(url, key);
}

export default function StoriesBar() {
const supabase = useMemo(() => getSupabase(), []);

const [stories, setStories] = useState<
(StoryRow & { profile?: ProfileRow | null })[]
>([]);

const [openCreate, setOpenCreate] = useState(false);

// Viewer modal state
const [openView, setOpenView] = useState(false);
const [selectedStory, setSelectedStory] = useState<StoryRow | null>(null);

// Create story state
const fileInputRef = useRef<HTMLInputElement | null>(null);
const [pickedFile, setPickedFile] = useState<File | null>(null);
const [caption, setCaption] = useState("");
const [busy, setBusy] = useState(false);
const [msg, setMsg] = useState("");

// Logged-in user id (for Delete button)
const [myUserId, setMyUserId] = useState<string | null>(null);

async function refreshStories() {
try {
const { data, error } = await supabase
.from("stories")
.select("id,user_id,media_url,caption,created_at")
.order("created_at", { ascending: false })
.limit(30);

if (error) throw error;
setStories((data ?? []) as any);
} catch {
// swallow to keep UI stable
}
}

// Load stories
useEffect(() => {
let alive = true;

(async () => {
try {
const { data, error } = await supabase
.from("stories")
.select("id,user_id,media_url,caption,created_at")
.order("created_at", { ascending: false })
.limit(30);

if (error) throw error;
if (!alive) return;

setStories((data ?? []) as any);
} catch {
// swallow
}
})();

return () => {
alive = false;
};
}, [supabase]);

// Load current user id
useEffect(() => {
let alive = true;

(async () => {
try {
const { data, error } = await supabase.auth.getUser();
if (error) return;
if (!alive) return;
setMyUserId(data?.user?.id ?? null);
} catch {
// ignore
}
})();

return () => {
alive = false;
};
}, [supabase]);

// ONE bubble per user (latest story)
const dedupedStories = useMemo(() => {
const map = new Map<string, StoryRow>();

const sorted = [...stories].sort((a, b) => {
const aT = a.created_at ? +new Date(a.created_at) : 0;
const bT = b.created_at ? +new Date(b.created_at) : 0;
return bT - aT;
});

for (const s of sorted) {
if (!map.has(s.user_id)) map.set(s.user_id, s);
}

return Array.from(map.values());
}, [stories]);

function openFilePicker() {
fileInputRef.current?.click();
}

function openStoryViewer(story: StoryRow) {
setSelectedStory(story);
setOpenView(true);
}

function closeStoryViewer() {
setOpenView(false);
setSelectedStory(null);
}

async function deleteSelectedStory() {
if (!selectedStory) return;

try {
setMsg("");

const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;

const user = authData?.user;
if (!user) {
setMsg("You are not logged in.");
return;
}

// Delete only if it's yours
const { error } = await supabase
.from("stories")
.delete()
.eq("id", selectedStory.id)
.eq("user_id", user.id);

if (error) {
setMsg(error.message);
return;
}

await refreshStories();
} catch (e: any) {
setMsg(e?.message || "Delete failed.");
}
}

async function postStory() {
try {
setMsg("");
if (!pickedFile) {
setMsg("Pick a photo/video first.");
return;
}

setBusy(true);

const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;
const user = authData?.user;
if (!user) {
setMsg("You are not logged in.");
return;
}

// Upload to Storage bucket: stories
const ext = pickedFile.name.split(".").pop() || "jpg";
const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

const { error: upErr } = await supabase.storage
.from("stories")
.upload(path, pickedFile, { upsert: false });

if (upErr) throw upErr;

const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
const mediaUrl = pub?.publicUrl;
if (!mediaUrl) throw new Error("Could not get public URL for uploaded file.");

const { error: insErr } = await supabase.from("stories").insert({
user_id: user.id,
media_url: mediaUrl,
caption: caption.trim() || null,
});

if (insErr) throw insErr;

setMsg("Posted ✅");
setPickedFile(null);
setCaption("");
setOpenCreate(false);

await refreshStories();
} catch (e: any) {
setMsg(e?.message || "Failed to post story.");
} finally {
setBusy(false);
}
}

return (
<>
{/* ✅ NEW: wrapper so glow can spill outside the scroller */}
<div className={styles.storiesWrap}>
<div className={styles.storiesRow}>
{/* Add story bubble */}
<button
type="button"
className={styles.addStory}
title="Create story"
aria-label="Create story"
onClick={() => {
setMsg("");
setPickedFile(null);
setCaption("");
setOpenCreate(true);
}}
>
<span>+</span>
</button>

{/* Existing story bubbles */}
{dedupedStories.map((s) => (
<button
key={s.id}
type="button"
className={styles.storyBubble}
title="Story"
aria-label="Open story"
onClick={() => openStoryViewer(s)}
>
<img className={styles.storyAvatar} src={s.media_url} alt="story" />
</button>
))}
</div>
</div>

{/* Hidden file input */}
<input
ref={fileInputRef}
type="file"
accept="image/*,video/*"
style={{ display: "none" }}
onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
/>

{/* Create Story Modal */}
{openCreate ? (
<div
className={styles.modalBackdrop}
onClick={() => !busy && setOpenCreate(false)}
style={{ pointerEvents: "auto" }}
>
<div
className={styles.modalCard}
onClick={(e) => e.stopPropagation()}
style={{ zIndex: 9999, pointerEvents: "auto" }}
>
<div className={styles.modalHeader}>
<div style={{ fontSize: 18, fontWeight: 800 }}>Create story</div>
<button
type="button"
className={styles.closeBtn}
onClick={() => !busy && setOpenCreate(false)}
aria-label="Close"
>
×
</button>
</div>

<div style={{ opacity: 0.9, marginBottom: 10 }}>Add a photo or video</div>

<button
type="button"
className={styles.uploadBtn}
onClick={openFilePicker}
disabled={busy}
style={{ pointerEvents: "auto" }}
>
{pickedFile ? "Change photo / video" : "Add photo / video"}
</button>

{pickedFile ? (
<div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
Selected: {pickedFile.name}
</div>
) : null}

<input
value={caption}
onChange={(e) => setCaption(e.target.value)}
placeholder="Caption (optional)"
disabled={busy}
style={{
marginTop: 12,
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(180, 120, 255, 0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
}}
/>

<button
type="button"
className={styles.uploadBtn}
onClick={postStory}
disabled={busy || !pickedFile}
style={{ marginTop: 12, opacity: busy || !pickedFile ? 0.55 : 1 }}
>
{busy ? "Posting..." : "Post story"}
</button>

<div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
Upload goes to Storage bucket <b>stories</b> and inserts into{" "}
<b>public.stories</b>.
</div>

{msg ? <div style={{ marginTop: 10, opacity: 0.9 }}>{msg}</div> : null}
</div>
</div>
) : null}

{/* Story Viewer Modal */}
<StoryModal
open={openView}
onClose={closeStoryViewer}
stories={dedupedStories}
startIndex={Math.max(
0,
dedupedStories.findIndex((s) => s.id === selectedStory?.id)
)}
myUserId={myUserId}
onDeleteCurrent={async (story) => {
// reuse your existing delete logic, but delete by the passed story
const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;
const user = authData?.user;
if (!user) throw new Error("You are not logged in.");

const { error } = await supabase
.from("stories")
.delete()
.eq("id", story.id)
.eq("user_id", user.id);

if (error) throw error;

await refreshStories();
}}
/>
</>
);
}