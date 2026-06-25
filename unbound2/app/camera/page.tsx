"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function CameraPage() {
const videoRef = useRef<HTMLVideoElement>(null);
const router = useRouter();

useEffect(() => {
let stream: MediaStream | null = null;

async function startCamera() {
try {
stream = await navigator.mediaDevices.getUserMedia({
video: {
facingMode: "user",
},
audio: true,
});

if (videoRef.current) {
videoRef.current.srcObject = stream;
}
} catch (err) {
console.error(err);
}
}

startCamera();

return () => {
stream?.getTracks().forEach((track) => track.stop());
};
}, []);

return (
<main
style={{
position: "fixed",
inset: 0,
background: "black",
display: "flex",
flexDirection: "column",
}}
>
<video
ref={videoRef}
autoPlay
playsInline
muted
style={{
flex: 1,
width: "100%",
objectFit: "cover",
}}
/>

<button
onClick={() => router.back()}
style={{
position: "absolute",
top: 20,
left: 20,
width: 48,
height: 48,
borderRadius: "50%",
border: "2px solid white",
background: "rgba(0,0,0,.5)",
color: "white",
fontSize: 24,
cursor: "pointer",
}}
>
×
</button>

<div
style={{
position: "absolute",
bottom: 50,
left: 0,
right: 0,
display: "flex",
justifyContent: "center",
}}
>
<button
style={{
width: 82,
height: 82,
borderRadius: "50%",
background: "white",
border: "6px solid #ff4fd8",
}}
/>
</div>
</main>
);
}