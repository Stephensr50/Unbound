"use client";

import React, { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function EditProfilePage() {
const fileInputRef = useRef<HTMLInputElement | null>(null);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [uploading, setUploading] = useState(false);

const [displayName, setDisplayName] = useState("");
const [bio, setBio] = useState("");
const [avatarUrl, setAvatarUrl] = useState<string>("");

const [status, setStatus] = useState<string>("");

useEffect(() => {
const loadProfile = async () => {
setLoading(true);
setStatus("");

const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) {
setStatus("Not logged in.");
setLoading(false);
return;
}

const userId = authData.user.id;

const { data: profile } = await supabase
.from("profiles")
.select("display_name, bio, avatar_url")
.eq("id", userId)
.single();

if (profile) {
setDisplayName(profile.display_name ?? "");
setBio(profile.bio ?? "");
setAvatarUrl(
profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : ""
);
}

setLoading(false);
};

loadProfile();
}, []);

const pickAvatar = () => {
setStatus("");
fileInputRef.current?.click();
};

const onAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
try {
const file = e.target.files?.[0];
if (!file) return;

e.target.value = "";

if (!file.type.startsWith("image/")) {
setStatus("Please choose an image file.");
return;
}

setUploading(true);
setStatus("");

const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) {
setStatus("Not logged in.");
setUploading(false);
return;
}

const userId = authData.user.id;
const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
const path = `public/${userId}/avatar.${safeExt}`;

const { error: uploadErr } = await supabase.storage
.from("avatars")
.upload(path, file, {
upsert: true,
contentType: file.type,
cacheControl: "3600",
});

if (uploadErr) {
setStatus(`Upload failed: ${uploadErr.message}`);
setUploading(false);
return;
}

const { data } = supabase.storage.from("avatars").getPublicUrl(path);
const publicUrl = data?.publicUrl;

if (!publicUrl) {
setStatus("Could not get public image URL.");
setUploading(false);
return;
}

setAvatarUrl(`${publicUrl}?t=${Date.now()}`);

await supabase
.from("profiles")
.update({ avatar_url: publicUrl })
.eq("id", userId);

setStatus("Avatar updated ✅");
setUploading(false);
} catch (err: any) {
setStatus(err?.message || "Upload failed.");
setUploading(false);
}
};

const saveProfile = async () => {
setSaving(true);
setStatus("");

const { data: authData } = await supabase.auth.getUser();
if (!authData?.user) {
setStatus("Not logged in.");
setSaving(false);
return;
}

await supabase
.from("profiles")
.update({
display_name: displayName.trim(),
bio,
})
.eq("id", authData.user.id);

setStatus("Saved ✅");
setSaving(false);
};

const initials = (displayName || "U")
.trim()
.split(" ")
.filter(Boolean)
.slice(0, 2)
.map((w) => w[0].toUpperCase())
.join("");

return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 16, paddingTop: 96 }}>
<h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
Edit Profile
</h1>

<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(255,255,255,0.1)",
borderRadius: 14,
padding: 16,
backdropFilter: "blur(10px)",
}}
>
{/* Avatar */}
<div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
<div
onClick={pickAvatar}
style={{
width: 112,
height: 112,
borderRadius: "50%",
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.18)",
background: "rgba(0,0,0,0.35)",
cursor: "pointer",
display: "flex",
alignItems: "center",
justifyContent: "center",
userSelect: "none",
}}
>
{avatarUrl ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={avatarUrl}
alt="Avatar"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
}}
/>
) : (
<div style={{ fontSize: 32, fontWeight: 800 }}>
{initials}
</div>
)}
</div>

<div>
<div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>
Profile picture
</div>
<button
onClick={pickAvatar}
disabled={uploading}
style={{
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
}}
>
{uploading ? "Uploading..." : "Change photo"}
</button>
</div>

<input
ref={fileInputRef}
type="file"
accept="image/*"
onChange={onAvatarSelected}
style={{ display: "none" }}
/>
</div>

{/* Display Name */}
<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Display name
</div>
<input
value={displayName}
onChange={(e) => setDisplayName(e.target.value)}
disabled={loading}
style={{
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
marginBottom: 12,
}}
/>
</label>

{/* Bio */}
<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Bio</div>
<textarea
value={bio}
onChange={(e) => setBio(e.target.value)}
rows={5}
style={{
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
}}
/>
</label>

<button
onClick={saveProfile}
disabled={saving}
style={{
marginTop: 14,
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
fontWeight: 700,
cursor: "pointer",
}}
>
{saving ? "Saving..." : "Save"}
</button>

{status && (
<div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
{status}
</div>
)}
</div>
</div>
);
}