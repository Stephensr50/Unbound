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
const [designation, setDesignation] = useState("");
const [city, setCity] = useState("");
const [stateName, setStateName] = useState("");
const [country, setCountry] = useState("");
const [relationshipStatus, setRelationshipStatus] = useState("");
const [orientation, setOrientation] = useState("");
const [pronouns, setPronouns] = useState("");
const [lookingFor, setLookingFor] = useState("");
const [dsRelationship, setDsRelationship] = useState("");

const [status, setStatus] = useState<string>("");
const [connectingStripe, setConnectingStripe] = useState(false);
const [userId, setUserId] = useState("");

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
setUserId(userId)

const { data: profile } = await supabase
.from("profiles")
.select("display_name, designation, bio, avatar_url, city, state, country, relationship_status, orientation, pronouns, looking_for, ds_relationship")
.eq("id", userId)
.single();

if (profile) {
setDisplayName(profile.display_name ?? "");
setDesignation(profile.designation || "");
setBio(profile.bio ?? "");
setCity(profile.city ?? "");
setStateName(profile.state ?? "");
setCountry(profile.country ?? "");
setRelationshipStatus(profile.relationship_status ?? "");
setOrientation(profile.orientation ?? "");
setPronouns(profile.pronouns ?? "");
setLookingFor(profile.looking_for ?? "");
setDsRelationship(profile.ds_relationship ?? "");
setAvatarUrl(profile.avatar_url ? `${profile.avatar_url}?t=${Date.now()}` : "");
}

setLoading(false);
};

void loadProfile();
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
const path = `${userId}/avatar.${safeExt}`;

const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, {
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

await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);

setStatus("Avatar updated ✅");
setUploading(false);
} catch (err: any) {
setStatus(err?.message || "Upload failed.");
setUploading(false);
}
};

const connectStripe = async () => {
try {
setConnectingStripe(true);
setStatus("");

if (!userId) {
setStatus("Not logged in.");
setConnectingStripe(false);
return;
}

const res = await fetch("/api/connect/create-account", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({ userId }),
});

const data = await res.json();

if (!res.ok || !data.url) {
setStatus(data?.error || "Could not start Stripe setup.");
setConnectingStripe(false);
return;
}

window.location.href = data.url;
} catch (err: any) {
setStatus(err?.message || "Could not start Stripe setup.");
setConnectingStripe(false);
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

const cleanCity = city.trim();
const cleanState = stateName.trim();
const cleanCountry = country.trim();

let latitude: number | null = null;
let longitude: number | null = null;

if (cleanCity || cleanState || cleanCountry) {
try {
const params = new URLSearchParams({
city: cleanCity,
state: cleanState,
country: cleanCountry,

});

const geoRes = await fetch(`/api/geocode?${params.toString()}`, {
cache: "no-store",
});

if (geoRes.ok) {
const geo = (await geoRes.json()) as {
latitude: number;
longitude: number;
};

latitude = geo.latitude;
longitude = geo.longitude;
} else {
const geoErr = await geoRes.json().catch(() => null);
setStatus(geoErr?.error || "Could not geocode location.");
setSaving(false);
return;
}
} catch {
setStatus("Could not geocode location.");
setSaving(false);
return;
}
}

const { error } = await supabase
.from("profiles")
.update({
display_name: displayName.trim(),
designation: designation.trim() || null,
bio,
city: cleanCity || null,
state: cleanState || null,
country: cleanCountry || null,
relationship_status: relationshipStatus.trim() || null,
orientation: orientation.trim() || null,
pronouns: pronouns.trim() || null,
looking_for: lookingFor.trim() || null,
ds_relationship: dsRelationship.trim() || null,
latitude,
longitude,
})
.eq("id", authData.user.id);

if (error) {
setStatus(`Save failed: ${error.message}`);
setSaving(false);
return;
}

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
<h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Edit Profile</h1>

<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(255,255,255,0.1)",
borderRadius: 14,
padding: 16,
backdropFilter: "blur(10px)",
}}
>
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
<div style={{ fontSize: 32, fontWeight: 800 }}>{initials}</div>
)}
</div>

<div>
<div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>Profile picture</div>
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
{uploading ? "Reaching climax..." : "Change photo"}
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Display name</div>
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
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Designation
</div>

<input
value={designation}
onChange={(e) => setDesignation(e.target.value)}
disabled={loading}
placeholder="Dom, Sub, Switch, Brat, etc."
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
<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>City</div>
<input
value={city}
onChange={(e) => setCity(e.target.value)}
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>State</div>
<input
value={stateName}
onChange={(e) => setStateName(e.target.value)}
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Country</div>
<input
value={country}
onChange={(e) => setCountry(e.target.value)}
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
<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Relationship Status
</div>
<input
value={relationshipStatus}
onChange={(e) => setRelationshipStatus(e.target.value)}
disabled={loading}
placeholder="Single, partnered, open relationship, poly, etc."
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Orientation
</div>
<input
value={orientation}
onChange={(e) => setOrientation(e.target.value)}
disabled={loading}
placeholder="Straight, bi, pansexual, gay, lesbian, etc."
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Pronouns
</div>
<input
value={pronouns}
onChange={(e) => setPronouns(e.target.value)}
disabled={loading}
placeholder="She/Her, He/Him, They/Them, etc."
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Looking For
</div>
<input
value={lookingFor}
onChange={(e) => setLookingFor(e.target.value)}
disabled={loading}
placeholder="Friendship, play partner, relationship, events, community"
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

<label>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
D/s Relationship
</div>
<input
value={dsRelationship}
onChange={(e) => setDsRelationship(e.target.value)}
disabled={loading}
placeholder="Owned by, collared by, Daddy/little, Dom/sub dynamic, etc."
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
onClick={async () => {
try {
setConnectingStripe(true);

const res = await fetch("/api/connect/create-account", {
method: "POST",
headers: {
"Content-Type": "application/json",
},
body: JSON.stringify({
userId,
}),
});

const data = await res.json();

if (!res.ok) {
throw new Error(data.error || "Could not connect Stripe.");
}

window.location.href = data.url;
} catch (err: any) {
setStatus(err.message || "Stripe connection failed.");
} finally {
setConnectingStripe(false);
}
}}
disabled={connectingStripe}
style={{
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.15)",
background: "#6d28d9",
color: "white",
fontWeight: 700,
cursor: "pointer",
marginTop: 14,
}}
>
{connectingStripe ? "Connecting..." : "Set Up Payouts"}
</button>

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