"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type CameraFilter =
| "none"
| "soft"
| "noir"
| "warm"
| "unbound"
| "glow"
| "rose"
| "golden"
| "cinema"
| "dream"
| "vintage"
| "moonlight"
| "highContrast"
| "muted"
| "frost";

const cameraFilters: Record<CameraFilter, { label: string; css: string }> = {
none: { label: "Normal", css: "none" },
soft: { label: "Soft", css: "brightness(1.08) contrast(0.92) saturate(1.12) blur(0.4px)" },
noir: { label: "Noir", css: "grayscale(1) contrast(1.25) brightness(0.92)" },
warm: { label: "Warm", css: "sepia(0.18) saturate(1.25) brightness(1.05)" },
unbound: { label: "Unbound", css: "contrast(1.08) saturate(1.45) hue-rotate(285deg) brightness(1.05)" },

glow: { label: "Glow", css: "brightness(1.12) contrast(0.95) saturate(1.25) blur(0.25px)" },
rose: { label: "Rose", css: "sepia(0.08) saturate(1.45) hue-rotate(315deg) brightness(1.08)" },
golden: { label: "Golden", css: "sepia(0.28) saturate(1.35) brightness(1.08) contrast(0.98)" },
cinema: { label: "Cinema", css: "contrast(1.22) saturate(1.15) brightness(0.92)" },
dream: { label: "Dream", css: "brightness(1.14) contrast(0.85) saturate(1.3) blur(0.7px)" },
vintage: { label: "Vintage", css: "sepia(0.38) contrast(0.95) saturate(0.9) brightness(1.03)" },
moonlight: { label: "Moonlight", css: "brightness(0.92) contrast(1.08) saturate(0.9) hue-rotate(190deg)" },
highContrast: { label: "Drama", css: "contrast(1.45) saturate(1.15) brightness(0.95)" },
muted: { label: "Muted", css: "saturate(0.65) contrast(1.05) brightness(1.02)" },
frost: { label: "Frost", css: "brightness(1.1) contrast(0.95) saturate(0.8) hue-rotate(170deg)" },
};

export default function CameraPage() {
const videoRef = useRef<HTMLVideoElement>(null);
const streamRef = useRef<MediaStream | null>(null);
const recorderRef = useRef<MediaRecorder | null>(null);
const chunksRef = useRef<Blob[]>([]);
const pressTimerRef = useRef<number | null>(null);

const router = useRouter();

const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
const [recording, setRecording] = useState(false);
const [posting, setPosting] = useState(false);
const [status, setStatus] = useState("");
const [previewUrl, setPreviewUrl] = useState<string | null>(null);
const [previewType, setPreviewType] = useState<"image" | "video" | null>(null);
const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
const [activeFilter, setActiveFilter] = useState<CameraFilter>("none");

useEffect(() => {
startCamera();
return () => stopCamera();
}, [facingMode]);

async function startCamera() {
try {
stopCamera();

const stream = await navigator.mediaDevices.getUserMedia({
video: { facingMode },
audio: true,
});

streamRef.current = stream;

if (videoRef.current) {
videoRef.current.srcObject = stream;
}
} catch (err) {
console.error(err);
setStatus("Could not open camera.");
}
}

function stopCamera() {
streamRef.current?.getTracks().forEach((track) => track.stop());
streamRef.current = null;
}

function flipCamera() {
setFacingMode((current) => (current === "user" ? "environment" : "user"));
}

function takePhoto() {
const video = videoRef.current;
if (!video) return;

const canvas = document.createElement("canvas");
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;

const ctx = canvas.getContext("2d");
if (!ctx) return;

ctx.filter = cameraFilters[activeFilter].css;
ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
ctx.filter = "none";

applyCanvasFilter(ctx, canvas.width, canvas.height, activeFilter);

canvas.toBlob(
(blob) => {
if (!blob) return;

const url = URL.createObjectURL(blob);
setCapturedBlob(blob);
setPreviewUrl(url);
setPreviewType("image");
},
"image/jpeg",
0.94
);
}

function applyCanvasFilter(
ctx: CanvasRenderingContext2D,
width: number,
height: number,
filter: CameraFilter
) {
if (filter === "none") return;

const imageData = ctx.getImageData(0, 0, width, height);
const data = imageData.data;

const settings: Record<
CameraFilter,
{
contrast: number;
saturation: number;
brightness: number;
warmth: number;
fade: number;
noir?: boolean;
vignette?: boolean;
grain?: number;
}
> = {
none: { contrast: 1, saturation: 1, brightness: 1, warmth: 0, fade: 0 },
soft: { contrast: 0.92, saturation: 1.08, brightness: 1.08, warmth: 4, fade: 8 },
noir: { contrast: 1.35, saturation: 0, brightness: 0.96, warmth: 0, fade: 0, noir: true, vignette: true },
warm: { contrast: 1.08, saturation: 1.18, brightness: 1.04, warmth: 18, fade: 4 },
unbound: { contrast: 1.18, saturation: 1.35, brightness: 1.04, warmth: 6, fade: 0, vignette: true, grain: 5 },
glow: { contrast: 0.9, saturation: 1.2, brightness: 1.12, warmth: 8, fade: 12 },
rose: { contrast: 1.05, saturation: 1.35, brightness: 1.07, warmth: 12, fade: 5 },
golden: { contrast: 1.12, saturation: 1.28, brightness: 1.06, warmth: 28, fade: 4, vignette: true },
cinema: { contrast: 1.45, saturation: 1.12, brightness: 0.92, warmth: 2, fade: 0, vignette: true, grain: 7 },
dream: { contrast: 0.82, saturation: 1.25, brightness: 1.14, warmth: 10, fade: 18 },
vintage: { contrast: 0.95, saturation: 0.82, brightness: 1.02, warmth: 20, fade: 18, grain: 8 },
moonlight: { contrast: 1.12, saturation: 0.85, brightness: 0.94, warmth: -18, fade: 6, vignette: true },
highContrast: { contrast: 1.6, saturation: 1.15, brightness: 0.96, warmth: 0, fade: 0, vignette: true },
muted: { contrast: 1.04, saturation: 0.55, brightness: 1.02, warmth: 0, fade: 10 },
frost: { contrast: 0.98, saturation: 0.72, brightness: 1.1, warmth: -22, fade: 12 },
};

const s = settings[filter];

for (let i = 0; i < data.length; i += 4) {
let r = data[i];
let g = data[i + 1];
let b = data[i + 2];

if (s.noir) {
const gray = r * 0.299 + g * 0.587 + b * 0.114;
r = gray;
g = gray;
b = gray;
}

r += s.warmth;
b -= s.warmth;

r = ((r - 128) * s.contrast + 128) * s.brightness;
g = ((g - 128) * s.contrast + 128) * s.brightness;
b = ((b - 128) * s.contrast + 128) * s.brightness;

const avg = (r + g + b) / 3;
r = avg + (r - avg) * s.saturation;
g = avg + (g - avg) * s.saturation;
b = avg + (b - avg) * s.saturation;

if (s.fade > 0) {
r = r + (255 - r) * (s.fade / 100);
g = g + (255 - g) * (s.fade / 100);
b = b + (255 - b) * (s.fade / 100);
}

if (s.grain) {
const grain = (Math.random() - 0.5) * s.grain;
r += grain;
g += grain;
b += grain;
}

data[i] = Math.max(0, Math.min(255, r));
data[i + 1] = Math.max(0, Math.min(255, g));
data[i + 2] = Math.max(0, Math.min(255, b));
}

ctx.putImageData(imageData, 0, 0);

if (s.vignette) {
const gradient = ctx.createRadialGradient(
width / 2,
height / 2,
width * 0.25,
width / 2,
height / 2,
width * 0.75
);

gradient.addColorStop(0, "rgba(0,0,0,0)");
gradient.addColorStop(1, "rgba(0,0,0,0.38)");

ctx.fillStyle = gradient;
ctx.fillRect(0, 0, width, height);
}
}

function startRecording() {
const stream = streamRef.current;
if (!stream) return;

chunksRef.current = [];

const mimeType = MediaRecorder.isTypeSupported("video/mp4")
? "video/mp4"
: MediaRecorder.isTypeSupported("video/webm;codecs=vp8")
? "video/webm;codecs=vp8"
: "video/webm";

const recorder = new MediaRecorder(stream, { mimeType });
recorderRef.current = recorder;

recorder.ondataavailable = (event) => {
if (event.data.size > 0) chunksRef.current.push(event.data);
};

recorder.onstop = () => {
const blob = new Blob(chunksRef.current, {
type: recorder.mimeType || "video/mp4",
});
const url = URL.createObjectURL(blob);

setCapturedBlob(blob);
setPreviewUrl(url);
setPreviewType("video");
setRecording(false);
};

recorder.start();
setRecording(true);
}

function stopRecording() {
if (recorderRef.current && recorderRef.current.state !== "inactive") {
recorderRef.current.stop();
}
}

function handlePressStart() {
pressTimerRef.current = window.setTimeout(() => {
startRecording();
}, 350);
}

function handlePressEnd() {
if (pressTimerRef.current) {
clearTimeout(pressTimerRef.current);
pressTimerRef.current = null;
}

if (recording) {
stopRecording();
} else {
takePhoto();
}
}

async function postCaptured(asReel: boolean) {
try {
if (!capturedBlob || !previewType) return;

setPosting(true);
setStatus("Posting...");

const { data: authData, error: authError } =
await supabase.auth.getUser();
if (authError) throw authError;

const uid = authData.user?.id;
if (!uid) throw new Error("You must be logged in.");

const isMp4 = capturedBlob.type.includes("mp4");
const ext = previewType === "image" ? ".jpg" : isMp4 ? ".mp4" : ".webm";
const mediaType =
previewType === "image"
? "image/jpeg"
: capturedBlob.type || "video/mp4";
const name = `${Date.now()}-${crypto.randomUUID()}${ext}`;
const path = `posts/${uid}/${name}`;

const file = new File([capturedBlob], name, { type: mediaType });

const { error: uploadError } = await supabase.storage
.from("media")
.upload(path, file, {
contentType: mediaType,
cacheControl: "3600",
upsert: false,
});

if (uploadError) throw uploadError;

const { data } = supabase.storage.from("media").getPublicUrl(path);

const { error: insertError } = await supabase.from("posts").insert({
user_id: uid,
body: null,
kind: previewType,
media_url: data.publicUrl,
media_type: mediaType,
media_bucket: "media",
media_path: path,
is_locked: false,
is_reel: asReel,
});

if (insertError) throw insertError;

router.push(asReel ? "/reels" : "/feed");
} catch (e: any) {
setStatus(e.message || "Post failed.");
setPosting(false);
}
}

async function postStory() {
try {
if (!capturedBlob || !previewType) return;

setPosting(true);
setStatus("Posting story...");

const { data: authData, error: authError } =
await supabase.auth.getUser();
if (authError) throw authError;

const uid = authData.user?.id;
if (!uid) throw new Error("You must be logged in.");

const isImage = previewType === "image";
const isMp4 = capturedBlob.type.includes("mp4");

const ext = isImage ? "jpg" : isMp4 ? "mp4" : "webm";
const mediaType = isImage
? "image/jpeg"
: capturedBlob.type || "video/mp4";
const filePath = `${uid}/${crypto.randomUUID()}.${ext}`;

const file = new File([capturedBlob], `story.${ext}`, {
type: mediaType,
});

const { error: uploadError } = await supabase.storage
.from("stories")
.upload(filePath, file, {
contentType: mediaType,
upsert: false,
});

if (uploadError) throw uploadError;

const { data: pub } = supabase.storage
.from("stories")
.getPublicUrl(filePath);
const publicUrl = pub?.publicUrl;

if (!publicUrl) throw new Error("Could not get story URL.");

const { error: insertError } = await supabase.from("stories").insert({
user_id: uid,
media_url: publicUrl,
caption: null,
});

if (insertError) throw insertError;

router.push("/feed");
router.refresh();
} catch (e: any) {
setStatus(e.message || "Story failed.");
setPosting(false);
}
}

if (previewUrl && previewType) {
return (
<main
style={{
position: "fixed",
inset: 0,
background: "black",
color: "white",
}}
>
{previewType === "image" ? (
<img
src={previewUrl}
alt="Preview"
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
) : (
<video
src={previewUrl}
controls
autoPlay
loop
playsInline
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
)}

<button
onClick={() => {
setPreviewUrl(null);
setPreviewType(null);
setCapturedBlob(null);
setStatus("");
}}
style={topLeftButton}
>
×
</button>

<div style={bottomPanel}>
{status && <div style={{ textAlign: "center" }}>{status}</div>}

<button
disabled={posting}
onClick={() => postCaptured(false)}
style={actionButton}
>
Post to Feed
</button>

{previewType === "video" && (
<button
disabled={posting}
onClick={() => postCaptured(true)}
style={actionButton}
>
Post as Reel
</button>
)}

<button disabled={posting} onClick={postStory} style={actionButton}>
Post Story
</button>
</div>
</main>
);
}

return (
<main style={{ position: "fixed", inset: 0, background: "black" }}>
<video
ref={videoRef}
autoPlay
playsInline
muted
style={{
width: "100%",
height: "100%",
objectFit: "cover",
filter: cameraFilters[activeFilter].css,
}}
/>

<button onClick={() => router.back()} style={topLeftButton}>
×
</button>
<button onClick={flipCamera} style={topRightButton}>
↻
</button>

<div style={hintStyle}>Tap for photo · Hold for video</div>

<div style={filterBarStyle}>
{(Object.keys(cameraFilters) as CameraFilter[]).map((filter) => (
<button
key={filter}
onClick={() => setActiveFilter(filter)}
style={{
...filterButtonStyle,
...(activeFilter === filter ? activeFilterButtonStyle : {}),
}}
>
{cameraFilters[filter].label}
</button>
))}
</div>

<div style={shutterWrap}>
<button
onMouseDown={handlePressStart}
onMouseUp={handlePressEnd}
onTouchStart={handlePressStart}
onTouchEnd={handlePressEnd}
style={{
width: recording ? 92 : 82,
height: recording ? 92 : 82,
borderRadius: "50%",
background: recording ? "#ff2b6d" : "white",
border: "6px solid #ff4fd8",
boxShadow: "0 0 24px rgba(255,79,216,.75)",
}}
/>
</div>
</main>
);
}

const topLeftButton: React.CSSProperties = {
position: "absolute",
top: 24,
left: 20,
width: 48,
height: 48,
borderRadius: "50%",
border: "2px solid white",
background: "rgba(0,0,0,.5)",
color: "white",
fontSize: 28,
cursor: "pointer",
zIndex: 10,
};

const topRightButton: React.CSSProperties = {
position: "absolute",
top: 24,
right: 20,
width: 48,
height: 48,
borderRadius: "50%",
border: "2px solid white",
background: "rgba(0,0,0,.5)",
color: "white",
fontSize: 28,
cursor: "pointer",
zIndex: 10,
};

const shutterWrap: React.CSSProperties = {
position: "absolute",
bottom: 110,
left: 0,
right: 0,
display: "flex",
justifyContent: "center",
zIndex: 10,
};

const hintStyle: React.CSSProperties = {
position: "absolute",
bottom: 210,
left: 0,
right: 0,
textAlign: "center",
color: "white",
fontSize: 14,
textShadow: "0 2px 8px black",
};

const filterBarStyle: React.CSSProperties = {
position: "absolute",
bottom: 250,
left: 12,
right: 12,
display: "flex",
justifyContent: "flex-start",
gap: 8,
overflowX: "auto",
zIndex: 10,
paddingBottom: 4,
};

const filterButtonStyle: React.CSSProperties = {
padding: "9px 14px",
borderRadius: 999,
border: "1px solid rgba(255,255,255,.35)",
background: "rgba(0,0,0,.45)",
color: "white",
fontSize: 13,
fontWeight: 700,
whiteSpace: "nowrap",
};

const activeFilterButtonStyle: React.CSSProperties = {
border: "1px solid rgba(255,79,216,.9)",
background: "rgba(255,79,216,.25)",
boxShadow: "0 0 16px rgba(255,79,216,.45)",
};

const bottomPanel: React.CSSProperties = {
position: "absolute",
left: 16,
right: 16,
bottom: 90,
display: "grid",
gap: 10,
};

const actionButton: React.CSSProperties = {
padding: "14px 16px",
borderRadius: 18,
border: "1px solid rgba(255,79,216,.7)",
background: "rgba(255,79,216,.18)",
color: "white",
fontSize: 16,
fontWeight: 700,
};