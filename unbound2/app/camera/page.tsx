"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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

ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

canvas.toBlob(
(blob) => {
if (!blob) return;

const url = URL.createObjectURL(blob);
setCapturedBlob(blob);
setPreviewUrl(url);
setPreviewType("image");
},
"image/jpeg",
0.92
);
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

const { data: authData, error: authError } = await supabase.auth.getUser();
if (authError) throw authError;

const uid = authData.user?.id;
if (!uid) throw new Error("You must be logged in.");

const isMp4 = capturedBlob.type.includes("mp4");
const ext = previewType === "image" ? ".jpg" : isMp4 ? ".mp4" : ".webm";
const mediaType =
previewType === "image" ? "image/jpeg" : capturedBlob.type || "video/mp4";
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

const { data: authData, error: authError } = await supabase.auth.getUser();
if (authError) throw authError;

const uid = authData.user?.id;
if (!uid) throw new Error("You must be logged in.");

const isImage = previewType === "image";
const isMp4 = capturedBlob.type.includes("mp4");

const ext = isImage ? "jpg" : isMp4 ? "mp4" : "webm";
const mediaType = isImage ? "image/jpeg" : capturedBlob.type || "video/mp4";
const filePath = `${uid}/${crypto.randomUUID()}.${ext}`;

const file = new File([capturedBlob], `story.${ext}`, { type: mediaType });

const { error: uploadError } = await supabase.storage
.from("stories")
.upload(filePath, file, {
contentType: mediaType,
upsert: false,
});

if (uploadError) throw uploadError;

const { data: pub } = supabase.storage.from("stories").getPublicUrl(filePath);
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
<main style={{ position: "fixed", inset: 0, background: "black", color: "white" }}>
{previewType === "image" ? (
<img src={previewUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
) : (
<video src={previewUrl} controls autoPlay loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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

<button disabled={posting} onClick={() => postCaptured(false)} style={actionButton}>
Post to Feed
</button>

{previewType === "video" && (
<button disabled={posting} onClick={() => postCaptured(true)} style={actionButton}>
Post as Reel
</button>
)}

<button
disabled={posting}
onClick={postStory}
style={actionButton}
>
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
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>

<button onClick={() => router.back()} style={topLeftButton}>×</button>
<button onClick={flipCamera} style={topRightButton}>↻</button>

<div style={hintStyle}>Tap for photo · Hold for video</div>

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