"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Story = {
id: string;
user_id: string;
media_url: string;
caption?: string | null;
created_at?: string;
};

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
myUserId: string | null;
onDeleteCurrent: (story: Story) => Promise<void>;
}) {
const cardRef = useRef<HTMLDivElement | null>(null);
const startY = useRef<number | null>(null);
const pointerIdRef = useRef<number | null>(null);

const [idx, setIdx] = useState(startIndex);
const [dragY, setDragY] = useState(0);
const [busy, setBusy] = useState(false);

// keep idx in sync when opening a new story
useEffect(() => {
if (open) setIdx(startIndex);
}, [open, startIndex]);

const story = stories[idx] ?? null;

const isImage = useMemo(() => {
const u = (story?.media_url || "").toLowerCase();
return (
u.includes(".jpg") ||
u.includes(".jpeg") ||
u.includes(".png") ||
u.includes(".webp") ||
u.includes("image")
);
}, [story?.media_url]);

// ESC closes
useEffect(() => {
if (!open) return;
const onKey = (e: KeyboardEvent) => {
if (e.key === "Escape") closeNow();
if (e.key === "ArrowRight") next();
if (e.key === "ArrowLeft") prev();
};
window.addEventListener("keydown", onKey);
return () => window.removeEventListener("keydown", onKey);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, idx, stories.length]);

// lock background scroll while open
useEffect(() => {
if (!open) return;
const prev = document.body.style.overflow;
document.body.style.overflow = "hidden";
return () => {
document.body.style.overflow = prev;
};
}, [open]);

// auto-advance timer (images: 6s; videos: let the user control for now)
useEffect(() => {
if (!open) return;
if (!story) return;
if (!isImage) return; // keep videos manual for now (more reliable)

const t = window.setTimeout(() => {
next();
}, 6000);

return () => window.clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, idx, isImage, story?.id]);

if (!open || !story) return null;

const canDelete = !!myUserId && story.user_id === myUserId;

const closeNow = () => {
setDragY(0);
startY.current = null;
pointerIdRef.current = null;
onClose();
};

const next = () => {
if (idx >= stories.length - 1) {
closeNow();
return;
}
setIdx((v) => Math.min(stories.length - 1, v + 1));
};

const prev = () => {
setIdx((v) => Math.max(0, v - 1));
};

// swipe-down capture
const onPointerDown = (e: React.PointerEvent) => {
pointerIdRef.current = e.pointerId;
startY.current = e.clientY;
setDragY(0);
cardRef.current?.setPointerCapture(e.pointerId);
};

const onPointerMove = (e: React.PointerEvent) => {
if (pointerIdRef.current == null) return;
if (e.pointerId !== pointerIdRef.current) return;
if (startY.current == null) return;

const delta = Math.max(0, e.clientY - startY.current);
setDragY(delta);

e.preventDefault();
e.stopPropagation();
};

const onPointerUp = (e: React.PointerEvent) => {
if (pointerIdRef.current == null) return;
if (e.pointerId !== pointerIdRef.current) return;

if (dragY > 120) closeNow();
else setDragY(0);

startY.current = null;
pointerIdRef.current = null;
};

const doDelete = async () => {
if (!canDelete || busy) return;
setBusy(true);
try {
await onDeleteCurrent(story);

// after delete, try to show next story; if none, close
if (stories.length <= 1) closeNow();
else if (idx >= stories.length - 1) setIdx((v) => Math.max(0, v - 1));
else next();
} finally {
setBusy(false);
}
};

return (
<div
onClick={closeNow}
style={{
position: "fixed",
inset: 0,
zIndex: 9999,
background: "rgba(0,0,0,0.65)",
backdropFilter: "blur(8px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 16,
}}
>
<div
ref={cardRef}
onClick={(e) => e.stopPropagation()}
onPointerDown={onPointerDown}
onPointerMove={onPointerMove}
onPointerUp={onPointerUp}
onPointerCancel={onPointerUp}
style={{
width: "min(520px, 92vw)",
height: "min(820px, 86vh)",
borderRadius: 18,
background: "rgba(0,0,0,0.78)",
border: "1px solid rgba(190,120,255,0.35)",
boxShadow: "0 0 24px rgba(180,90,255,0.25)",
overflow: "hidden",
position: "relative",
transform: `translateY(${dragY}px)`,
transition: dragY === 0 ? "transform 160ms ease" : "none",
touchAction: "none",
userSelect: "none",
}}
>
{/* progress bars */}
<div style={{ display: "flex", gap: 6, padding: "10px 12px 0" }}>
{stories.map((_, i) => (
<div
key={i}
style={{
height: 3,
flex: 1,
borderRadius: 999,
background:
i < idx
? "rgba(190,120,255,0.75)"
: i === idx
? "rgba(190,120,255,0.35)"
: "rgba(255,255,255,0.12)",
}}
/>
))}
</div>

{/* Top bar */}
<div
style={{
height: 52,
display: "flex",
alignItems: "center",
justifyContent: "space-between",
padding: "0 14px",
borderBottom: "1px solid rgba(190,120,255,0.18)",
}}
>
<div style={{ opacity: 0.85, fontSize: 13 }}>
{idx + 1} / {stories.length}
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
{canDelete && (
<button
onClick={doDelete}
disabled={busy}
style={{
height: 34,
padding: "0 12px",
borderRadius: 999,
border: "1px solid rgba(255,90,150,0.35)",
background: "rgba(255,90,150,0.10)",
color: "rgba(255,255,255,0.92)",
cursor: busy ? "not-allowed" : "pointer",
}}
>
{busy ? "Deleting..." : "Delete"}
</button>
)}

<button
onClick={closeNow}
style={{
width: 36,
height: 36,
borderRadius: 999,
border: "1px solid rgba(190,120,255,0.35)",
background: "rgba(180,90,255,0.12)",
color: "rgba(255,255,255,0.92)",
cursor: "pointer",
}}
aria-label="Close"
>
✕
</button>
</div>
</div>

{/* Tap zones for prev/next */}
<div style={{ position: "relative", height: "calc(100% - 62px)" }}>
<button
type="button"
onClick={prev}
style={{
position: "absolute",
inset: 0,
width: "50%",
background: "transparent",
border: "none",
cursor: "pointer",
}}
aria-label="Previous story"
/>
<button
type="button"
onClick={next}
style={{
position: "absolute",
top: 0,
right: 0,
bottom: 0,
width: "50%",
background: "transparent",
border: "none",
cursor: "pointer",
}}
aria-label="Next story"
/>

{/* Media */}
<div
style={{
height: "100%",
display: "flex",
flexDirection: "column",
}}
>
<div style={{ flex: 1, background: "rgba(0,0,0,0.55)" }}>
{isImage ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={story.media_url}
alt="Story"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
pointerEvents: "none",
}}
/>
) : (
<video
src={story.media_url}
controls
playsInline
autoPlay
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
)}
</div>

{story.caption ? (
<div
style={{
padding: 12,
borderTop: "1px solid rgba(190,120,255,0.18)",
opacity: 0.9,
}}
>
{story.caption}
</div>
) : null}
</div>
</div>
</div>
</div>
);
}