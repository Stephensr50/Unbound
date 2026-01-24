"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type Story = {
id: string;
user_id: string;
media_url: string;
caption?: string | null;
};

type Props = {
open: boolean;
stories: Story[];
initialIndex: number;
onClose: () => void;
};

export default function StoriesViewer({ open, stories, initialIndex, onClose }: Props) {
const [index, setIndex] = useState(initialIndex);
const [progress, setProgress] = useState(0);

const startY = useRef<number | null>(null);
const startX = useRef<number | null>(null);

const story = useMemo(() => stories[index], [stories, index]);

useEffect(() => {
if (!open) return;

setIndex(initialIndex);
setProgress(0);

const prevOverflow = document.body.style.overflow;
document.body.style.overflow = "hidden";
return () => {
document.body.style.overflow = prevOverflow;
};
}, [open, initialIndex]);

useEffect(() => {
if (!open) return;

const onKeyDown = (e: KeyboardEvent) => {
if (e.key === "Escape") onClose();
if (e.key === "ArrowRight") next();
if (e.key === "ArrowLeft") prev();
};

window.addEventListener("keydown", onKeyDown);
return () => window.removeEventListener("keydown", onKeyDown);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, index, stories.length]);

useEffect(() => {
if (!open) return;
if (!story) return;

const durationMs = 4500; // story speed
const tickMs = 50;

setProgress(0);
const startedAt = Date.now();

const t = window.setInterval(() => {
const elapsed = Date.now() - startedAt;
const p = Math.min(1, elapsed / durationMs);
setProgress(p);

if (p >= 1) {
window.clearInterval(t);
next();
}
}, tickMs);

return () => window.clearInterval(t);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, index, story?.id]);

function next() {
if (index < stories.length - 1) setIndex(index + 1);
else onClose();
}

function prev() {
if (index > 0) setIndex(index - 1);
else setIndex(0);
}

if (!open) return null;
if (!stories.length) return null;

const isVideo = story?.media_url?.match(/\.(mp4|webm|mov)(\?|$)/i);

return (
<div
className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center"
onMouseDown={(e) => {
if ((e.target as HTMLElement).dataset?.backdrop === "1") onClose();
}}
>
<div className="absolute inset-0" data-backdrop="1" />

<div
className="relative w-full max-w-[520px] h-[92vh] mx-auto rounded-2xl overflow-hidden bg-black"
onPointerDown={(e) => {
startY.current = e.clientY;
startX.current = e.clientX;
}}
onPointerUp={(e) => {
const sy = startY.current;
const sx = startX.current;
startY.current = null;
startX.current = null;

if (sy == null || sx == null) return;

const dy = e.clientY - sy;
const dx = e.clientX - sx;

if (dy > 90 && Math.abs(dx) < 80) onClose();
if (dx < -90 && Math.abs(dy) < 80) next();
if (dx > 90 && Math.abs(dy) < 80) prev();
}}
>
<div className="absolute top-0 left-0 right-0 z-20 p-3 flex gap-2">
{stories.map((s, i) => {
const filled = i < index ? 1 : i > index ? 0 : progress;
return (
<div key={s.id} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
<div className="h-full bg-white" style={{ width: `${filled * 100}%` }} />
</div>
);
})}
</div>

<button
className="absolute top-3 right-3 z-30 text-white/90 hover:text-white text-2xl leading-none"
onClick={onClose}
aria-label="Close"
>
×
</button>

<button className="absolute left-0 top-0 bottom-0 w-1/3 z-10" onClick={prev} aria-label="Previous" />
<button className="absolute right-0 top-0 bottom-0 w-1/3 z-10" onClick={next} aria-label="Next" />

<div className="absolute inset-0 z-0 flex items-center justify-center">
{isVideo ? (
<video className="w-full h-full object-cover" src={story.media_url} autoPlay playsInline muted />
) : (
// eslint-disable-next-line @next/next/no-img-element
<img src={story.media_url} alt="Story" className="w-full h-full object-cover" draggable={false} />
)}
</div>

{story.caption ? (
<div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-gradient-to-t from-black/70 to-transparent">
<div className="text-white text-sm">{story.caption}</div>
</div>
) : null}
</div>
</div>
);
}