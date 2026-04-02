"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef, useState } from "react";

type Story = {
id: string;
user_id: string;
media_url: string;
caption?: string | null;
created_at?: string;
};

type ViewerProfile = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type StoryViewerRow = {
viewer_id: string;
created_at: string;
profiles: ViewerProfile | ViewerProfile[] | null;
};

const PHOTO_DURATION_MS = 4000;

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function StoryModal({
open,
onClose,
stories,
startIndex,
myUserId,
onDeleteCurrent,
}: {
open: boolean;
onClose: () => void;
stories: Story[];
startIndex: number;
myUserId?: string | null;
onDeleteCurrent?: (story: Story) => Promise<void>;
}) {
const safeStories = Array.isArray(stories) ? stories : [];
const maxIndex = Math.max(0, safeStories.length - 1);

const initialIndex = useMemo(() => {
const n = Number.isFinite(startIndex) ? startIndex : 0;
return Math.min(Math.max(0, n), maxIndex);
}, [startIndex, maxIndex]);

const [idx, setIdx] = useState<number>(initialIndex);
const [progressKey, setProgressKey] = useState(0);
const [storyViewers, setStoryViewers] = useState<StoryViewerRow[]>([]);

const timerRef = useRef<number | null>(null);
const timeAgo = (ts: string) => {
const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
if (diff < 60) return `${diff}s`;
if (diff < 3600) return `${Math.floor(diff / 60)}m`;
if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
return `${Math.floor(diff / 86400)}d`;
};

useEffect(() => {
if (!open) return;
setIdx(initialIndex);
setProgressKey((v) => v + 1);
}, [open, initialIndex]);

function clearAutoTimer() {
if (timerRef.current) {
window.clearTimeout(timerRef.current);
timerRef.current = null;
}
}

function closeNow() {
clearAutoTimer();
onClose();
}

function goNext() {
clearAutoTimer();
if (!safeStories.length) return closeNow();
if (idx >= maxIndex) return closeNow();
setIdx((v) => Math.min(v + 1, maxIndex));
setProgressKey((v) => v + 1);
}

function goPrev() {
clearAutoTimer();
if (!safeStories.length) return;
setIdx((v) => Math.max(v - 1, 0));
setProgressKey((v) => v + 1);
}

useEffect(() => {
if (!open) return;

const onKey = (e: KeyboardEvent) => {
if (e.key === "Escape") onClose();
if (e.key === "ArrowRight") goNext();
if (e.key === "ArrowLeft") goPrev();
};

window.addEventListener("keydown", onKey);
return () => window.removeEventListener("keydown", onKey);
}, [open, idx, maxIndex]);

const current = safeStories[idx] ?? null;

const isVideo =
!!current?.media_url && /\.(mp4|webm|mov)(\?|$)/i.test(current.media_url);

const isMine =
!!myUserId && !!current?.user_id && myUserId === current.user_id;

useEffect(() => {
clearAutoTimer();

if (!open || !current) return;
if (isVideo) return;

timerRef.current = window.setTimeout(() => {
goNext();
}, PHOTO_DURATION_MS);

return () => clearAutoTimer();
}, [open, idx, current?.id, isVideo]);

useEffect(() => {
if (!open) return;
if (!current?.id) return;
if (!myUserId) return;
if (current.user_id === myUserId) return;

const supabase = getSupabase();

async function recordStoryView() {
const { data: existing, error: existingError } = await supabase
.from("story_views")
.select("id")
.eq("story_id", current.id)
.eq("viewer_id", myUserId)
.maybeSingle();

if (existingError) {
alert(
"story_views existing check error:\n" +
JSON.stringify(
{
message: existingError.message,
code: existingError.code,
details: existingError.details,
hint: existingError.hint,
},
null,
2
)
);
return;
}

if (existing) return;

const { error } = await supabase.from("story_views").insert({
story_id: current.id,
viewer_id: myUserId,
});

if (error && error.code !== "23505") {
alert(
"story_views insert error:\n" +
JSON.stringify(
{
message: error.message,
code: error.code,
details: error.details,
hint: error.hint,
story_id: current.id,
viewer_id: myUserId,
},
null,
2
)
);

}
}

recordStoryView();
}, [open, current?.id, current?.user_id, myUserId]);

useEffect(() => {
if (!open) return;
if (!current?.id) {
setStoryViewers([]);
return;
}
if (!myUserId) {
setStoryViewers([]);
return;
}
if (current.user_id !== myUserId) {
setStoryViewers([]);
return;
}

const supabase = getSupabase();

async function loadStoryViewers() {
const { data, error } = await supabase
.from("story_views")
.select(
`
viewer_id,
created_at,
profiles:viewer_id (
id,
username,
display_name,
avatar_url
)
`
)
.eq("story_id", current.id)
.order("created_at", { ascending: false });

if (error) {
console.error("loadStoryViewers error:", error);
setStoryViewers([]);
return;
}

setStoryViewers((data as StoryViewerRow[]) || []);
}

loadStoryViewers();
}, [open, current?.id, current?.user_id, myUserId]);

if (!open) return null;

return (
<div style={overlay} role="dialog" aria-modal="true">
<div style={backdrop} onClick={closeNow} aria-hidden="true" />

<div style={frame} onClick={(e) => e.stopPropagation()}>
<div style={topBar}>
<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
{safeStories.map((s, i) => (
<div key={s.id ?? String(i)} style={progressTrack}>
{i < idx ? (
<div style={progressFillDone} />
) : i === idx ? (
<div
key={`${s.id}-${progressKey}`}
style={{
...progressFillActive,
animationDuration: isVideo ? "0ms" : `${PHOTO_DURATION_MS}ms`,
}}
/>
) : null}
</div>
))}
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
{isMine && onDeleteCurrent && current ? (
<button
type="button"
onClick={() => onDeleteCurrent(current)}
style={dangerBtn}
>
Delete
</button>
) : null}

<button
type="button"
onClick={(e) => {
e.stopPropagation();
closeNow();
}}
style={closeBtn}
aria-label="Close"
title="Close"
>
×
</button>
</div>
</div>

<div style={tapLayer}>
<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
goPrev();
}}
style={tapLeft}
aria-label="Previous story"
/>
<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
goNext();
}}
style={tapRight}
aria-label="Next story"
/>
</div>

<div style={mediaWrap}>
{current?.media_url ? (
isVideo ? (
<video
key={current.media_url}
src={current.media_url}
controls
autoPlay
playsInline
onEnded={goNext}
style={media}
/>
) : (
<img
key={current.media_url}
src={current.media_url}
alt=""
style={media}
/>
)
) : (
<div style={empty}>No story media.</div>
)}
</div>

{isMine ? (
<div style={viewPanel}>
<div style={viewTitle}>
👁 {storyViewers.length} {storyViewers.length === 1 ? "view" : "views"}
</div>

{storyViewers.length === 0 ? (
<div style={viewEmpty}>No views yet</div>
) : (
<div style={viewerList}>
{storyViewers.map((row) => {
const profile = Array.isArray(row.profiles)
? row.profiles[0]
: row.profiles;

const label =
profile?.display_name || profile?.username || "Unknown user";

return (
<div key={row.viewer_id} style={viewerRow}>
<img
src={profile?.avatar_url || "/default-avatar.png"}
alt={label}
style={viewerAvatar}
/>
<div style={{ minWidth: 0 }}>
<div style={viewerName}>{label}</div>

{profile?.username ? (
<div style={viewerUsername}>@{profile.username}</div>
) : null}

<div style={{ fontSize: 11, opacity: 0.6 }}>
{timeAgo(row.created_at)} ago
</div>
</div>
</div>
);
})}
</div>
)}
</div>
) : current?.caption ? (
<div style={caption}>{current.caption}</div>
) : null}

{isMine && current?.caption ? (
<div style={myCaptionWrap}>
<div style={caption}>{current.caption}</div>
</div>
) : null}
</div>

<style>{`
@keyframes unboundStoryProgress {
from { width: 0%; }
to { width: 100%; }
}
`}</style>
</div>
);
}

const overlay: React.CSSProperties = {
position: "fixed",
inset: 0,
zIndex: 999999,
display: "grid",
placeItems: "center",
};

const backdrop: React.CSSProperties = {
position: "absolute",
inset: 0,
background: "rgba(0,0,0,0.72)",
backdropFilter: "blur(6px)",
WebkitBackdropFilter: "blur(6px)",
};

const frame: React.CSSProperties = {
position: "relative",
width: "min(520px, 94vw)",
height: "min(860px, 90vh)",
borderRadius: 18,
overflow: "hidden",
border: "1px solid rgba(168,85,247,0.22)",
background: "rgba(0,0,0,0.55)",
boxShadow: "0 20px 80px rgba(0,0,0,0.6), 0 0 30px rgba(168,85,247,0.18)",
};

const topBar: React.CSSProperties = {
position: "absolute",
top: 10,
left: 10,
right: 10,
zIndex: 5,
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 12,
padding: "10px 12px",
borderRadius: 14,
background: "rgba(0,0,0,0.35)",
border: "1px solid rgba(168,85,247,0.18)",
};

const progressTrack: React.CSSProperties = {
position: "relative",
height: 3,
width: 28,
borderRadius: 999,
overflow: "hidden",
background: "rgba(255,255,255,0.22)",
};

const progressFillDone: React.CSSProperties = {
position: "absolute",
inset: 0,
width: "100%",
background: "rgba(168,85,247,0.95)",
boxShadow: "0 0 10px rgba(168,85,247,0.85)",
};

const progressFillActive: React.CSSProperties = {
position: "absolute",
left: 0,
top: 0,
bottom: 0,
width: "0%",
background: "rgba(168,85,247,0.95)",
boxShadow: "0 0 10px rgba(168,85,247,0.85)",
animationName: "unboundStoryProgress",
animationTimingFunction: "linear",
animationFillMode: "forwards",
};

const closeBtn: React.CSSProperties = {
width: 36,
height: 36,
borderRadius: 999,
border: "1px solid rgba(190,120,255,0.35)",
background: "rgba(168,90,255,0.12)",
color: "rgba(255,255,255,0.92)",
cursor: "pointer",
fontSize: 22,
lineHeight: "34px",
textAlign: "center",
};

const dangerBtn: React.CSSProperties = {
height: 36,
padding: "0 12px",
borderRadius: 12,
border: "1px solid rgba(255,120,120,0.35)",
background: "rgba(120,0,0,0.25)",
color: "rgba(255,230,230,0.95)",
cursor: "pointer",
fontWeight: 800,
};

const mediaWrap: React.CSSProperties = {
position: "absolute",
inset: 0,
display: "grid",
placeItems: "center",
paddingTop: 70,
paddingBottom: 44,
};

const media: React.CSSProperties = {
width: "100%",
height: "100%",
objectFit: "cover",
};

const caption: React.CSSProperties = {
position: "absolute",
left: 12,
right: 12,
bottom: 10,
zIndex: 5,
padding: "10px 12px",
borderRadius: 14,
background: "rgba(0,0,0,0.38)",
border: "1px solid rgba(168,85,247,0.16)",
color: "rgba(255,255,255,0.92)",
fontSize: 14,
};

const myCaptionWrap: React.CSSProperties = {
position: "absolute",
left: 12,
right: 12,
bottom: 128,
zIndex: 6,
};

const viewPanel: React.CSSProperties = {
position: "absolute",
left: 12,
right: 12,
bottom: 10,
zIndex: 6,
padding: "12px",
borderRadius: 14,
background: "rgba(0,0,0,0.52)",
border: "1px solid rgba(168,85,247,0.18)",
color: "rgba(255,255,255,0.95)",
maxHeight: 150,
overflowY: "auto",
};

const viewTitle: React.CSSProperties = {
fontSize: 14,
fontWeight: 800,
marginBottom: 8,
};

const viewEmpty: React.CSSProperties = {
fontSize: 13,
color: "rgba(255,255,255,0.75)",
};

const viewerList: React.CSSProperties = {
display: "flex",
flexDirection: "column",
gap: 8,
};

const viewerRow: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 10,
};

const viewerAvatar: React.CSSProperties = {
width: 30,
height: 30,
borderRadius: "50%",
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
flexShrink: 0,
};

const viewerName: React.CSSProperties = {
fontSize: 13,
fontWeight: 700,
color: "rgba(255,255,255,0.95)",
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
};

const viewerUsername: React.CSSProperties = {
fontSize: 12,
color: "rgba(255,255,255,0.65)",
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
};

const empty: React.CSSProperties = {
color: "rgba(255,255,255,0.75)",
fontSize: 14,
padding: 16,
};

const tapLayer: React.CSSProperties = {
position: "absolute",
inset: 0,
zIndex: 4,
};

const tapBase: React.CSSProperties = {
position: "absolute",
top: 0,
bottom: 0,
border: "none",
background: "transparent",
cursor: "pointer",
padding: 0,
};

const tapLeft: React.CSSProperties = {
...tapBase,
left: 0,
width: "45%",
};

const tapRight: React.CSSProperties = {
...tapBase,
right: 0,
width: "55%",
};