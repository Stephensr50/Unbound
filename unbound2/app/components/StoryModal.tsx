"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Story = {
id: string;
user_id: string;
media_url: string;
caption?: string | null;
created_at?: string;
};

const PHOTO_DURATION_MS = 4000;

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

const timerRef = useRef<number | null>(null);

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

if (!open) return null;

return (
<div style={overlay} role="dialog" aria-modal="true">
<div style={backdrop} onClick={closeNow} aria-hidden="true" />

<div style={frame} onClick={(e) => e.stopPropagation()}>
<div style={topBar}>
<div style={{ display: "flex", gap: 6, alignItems: "center" }}>
{safeStories.map((s, i) => (
<div
key={s.id ?? String(i)}
style={progressTrack}
>
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
// eslint-disable-next-line @next/next/no-img-element
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

{current?.caption ? <div style={caption}>{current.caption}</div> : null}
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