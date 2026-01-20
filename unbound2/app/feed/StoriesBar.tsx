"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./StoriesBar.module.css";

type StoryRow = {
id: string;
user_id: string;
media_url: string | null;
caption: string | null;
};

type ProfileRow = {
id: string;
username: string | null;
avatar_url: string | null;
};

type Props = {
stories: StoryRow[];
profilesById: Record<string, ProfileRow | undefined>;
};

const STORY_MS = 7000;
const SWIPE_CLOSE_PX = 70;

export default function StoriesBar({ stories, profilesById }: Props) {
// group by user in order of appearance
const grouped = useMemo(() => {
const seen = new Set<string>();
const out: { userId: string }[] = [];
for (const s of stories) {
if (!seen.has(s.user_id)) {
seen.add(s.user_id);
out.push({ userId: s.user_id });
}
}
return out;
}, [stories]);

const storiesByUser = useMemo(() => {
const map: Record<string, StoryRow[]> = {};
for (const s of stories) {
(map[s.user_id] ||= []).push(s);
}
return map;
}, [stories]);

const [open, setOpen] = useState(false);
const [activeUserIndex, setActiveUserIndex] = useState(0);
const [activeStoryIndex, setActiveStoryIndex] = useState(0);

const activeUserId = grouped[activeUserIndex]?.userId;
const activeStories = activeUserId ? storiesByUser[activeUserId] || [] : [];
const activeStory = activeStories[activeStoryIndex] || null;

// auto advance
useEffect(() => {
if (!open) return;
if (!activeStories.length) return;

const t = window.setTimeout(() => {
next();
}, STORY_MS);

return () => window.clearTimeout(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, activeUserIndex, activeStoryIndex]);

// ESC close + arrow nav
useEffect(() => {
if (!open) return;
function onKeyDown(e: KeyboardEvent) {
if (e.key === "Escape") close();
if (e.key === "ArrowRight") next();
if (e.key === "ArrowLeft") prev();
}
window.addEventListener("keydown", onKeyDown);
return () => window.removeEventListener("keydown", onKeyDown);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, activeUserIndex, activeStoryIndex]);

function openUser(idx: number) {
setActiveUserIndex(idx);
setActiveStoryIndex(0);
setOpen(true);
}

function close() {
setOpen(false);
}

function next() {
// next story in same user, else next user
if (activeStoryIndex < activeStories.length - 1) {
setActiveStoryIndex((v) => v + 1);
return;
}
if (activeUserIndex < grouped.length - 1) {
setActiveUserIndex((v) => v + 1);
setActiveStoryIndex(0);
return;
}
// end: close
close();
}

function prev() {
if (activeStoryIndex > 0) {
setActiveStoryIndex((v) => v - 1);
return;
}
if (activeUserIndex > 0) {
const prevUser = activeUserIndex - 1;
const prevUserId = grouped[prevUser]?.userId;
const prevStories = prevUserId ? storiesByUser[prevUserId] || [] : [];
setActiveUserIndex(prevUser);
setActiveStoryIndex(Math.max(prevStories.length - 1, 0));
return;
}
}

// ---- Swipe down handlers (this is the whole point) ----
const startYRef = useRef<number | null>(null);
const startXRef = useRef<number | null>(null);

function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
if (!open) return;

// Capture pointer so we keep getting move/up events even if cursor drifts
try {
(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
} catch {}

startYRef.current = e.clientY;
startXRef.current = e.clientX;
}

function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
if (!open) return;
if (startYRef.current == null || startXRef.current == null) return;

const dy = e.clientY - startYRef.current;
const dx = e.clientX - startXRef.current;

// prefer vertical gesture
if (dy > SWIPE_CLOSE_PX && Math.abs(dy) > Math.abs(dx)) {
close();
}
}

function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
try {
(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
} catch {}
startYRef.current = null;
startXRef.current = null;
}

const label = activeUserId ? profilesById[activeUserId]?.username ?? "User" : "User";

return (
<div className={styles.wrap}>
{/* Story bubbles */}
<div className={styles.row}>
{grouped.map(({ userId }, idx) => {
const p = profilesById[userId];
const name = p?.username ?? "User";
const initial = (name?.[0] ?? "U").toUpperCase();

return (
<button
key={userId}
type="button"
className={styles.bubbleBtn}
onClick={() => openUser(idx)}
aria-label={`Open stories for ${name}`}
>
<div className={styles.ring}>
<div className={styles.avatar}>
{p?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img className={styles.avatarImg} src={p.avatar_url} alt={name} />
) : (
<span className={styles.initial}>{initial}</span>
)}
</div>
</div>
<div className={styles.name}>{name}</div>
</button>
);
})}
</div>

{/* Viewer */}
{open && (
<div
className={styles.overlay}
role="dialog"
aria-modal="true"
onPointerDown={onPointerDown}
onPointerMove={onPointerMove}
onPointerUp={onPointerUp}
onPointerCancel={onPointerUp}
>
{/* IMPORTANT: do NOT stop pointer events here, only clicks */}
<div className={styles.viewer} onClick={(e) => e.stopPropagation()}>
<div className={styles.top}>
<div className={styles.userLabel}>{label}</div>

<button type="button" className={styles.closeBtn} onClick={close} aria-label="Close">
✕
</button>
</div>

<div className={styles.mediaWrap}>
{activeStory?.media_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img className={styles.media} src={activeStory.media_url} alt="Story" />
) : (
<div className={styles.mediaPlaceholder}>No story media</div>
)}

<button type="button" className={styles.tapLeft} aria-label="Previous story" onClick={prev} />
<button type="button" className={styles.tapRight} aria-label="Next story" onClick={next} />
</div>

{activeStory?.caption ? (
<div className={styles.caption}>{activeStory.caption}</div>
) : (
<div className={styles.captionMuted}> </div>
)}

<div className={styles.hint}>Drag down to close</div>
</div>
</div>
)}
</div>
);
}