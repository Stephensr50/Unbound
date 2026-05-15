"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type EventType =
| "meetup"
| "party"
| "class"
| "workshop"
| "munch"
| "convention"
| "online"
| "other";

type EventVisibility = "public" | "private" | "friends" | "invite_only";
type RSVPVisibility = "public" | "attendees" | "hidden";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

function toDatetimeLocal(value: string | null) {
if (!value) return "";
const date = new Date(value);
const offset = date.getTimezoneOffset();
const localDate = new Date(date.getTime() - offset * 60 * 1000);
return localDate.toISOString().slice(0, 16);
}

export default function EditEventPage() {
const router = useRouter();
const params = useParams();
const eventId = String(params?.id || "");
const supabase = useMemo(() => getSupabase(), []);

const [title, setTitle] = useState("");
const [description, setDescription] = useState("");
const [location, setLocation] = useState("");
const [city, setCity] = useState("");
const [stateName, setStateName] = useState("");
const [startsAt, setStartsAt] = useState("");
const [endsAt, setEndsAt] = useState("");

const [eventType, setEventType] = useState<EventType>("meetup");
const [visibility, setVisibility] = useState<EventVisibility>("public");
const [rsvpVisibility, setRsvpVisibility] =
useState<RSVPVisibility>("attendees");

const [bannerFile, setBannerFile] = useState<File | null>(null);
const [bannerPreview, setBannerPreview] = useState<string | null>(null);
const [currentBannerUrl, setCurrentBannerUrl] = useState<string | null>(null);

const [creatorId, setCreatorId] = useState<string | null>(null);
const [myUserId, setMyUserId] = useState<string | null>(null);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

useEffect(() => {
loadEvent();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [eventId]);

async function loadEvent() {
setLoading(true);
setErrorMsg("");

const { data: authData } = await supabase.auth.getUser();
const userId = authData?.user?.id ?? null;
setMyUserId(userId);

const { data, error } = await supabase
.from("events")
.select("*")
.eq("id", eventId)
.single();

if (error || !data) {
console.error(error);
setErrorMsg("Could not load this event.");
setLoading(false);
return;
}

setCreatorId(data.creator_id);

if (userId !== data.creator_id) {
setErrorMsg("Only the event creator can edit this event.");
setLoading(false);
return;
}

setTitle(data.title || "");
setDescription(data.description || "");
setLocation(data.location || "");
setCity(data.city || "");
setStateName(data.state || "");
setStartsAt(toDatetimeLocal(data.starts_at));
setEndsAt(toDatetimeLocal(data.ends_at));
setEventType((data.event_type || "meetup") as EventType);
setVisibility((data.visibility || "public") as EventVisibility);
setRsvpVisibility((data.rsvp_visibility || "attendees") as RSVPVisibility);
setCurrentBannerUrl(data.banner_url || null);
setBannerPreview(data.banner_url || null);

setLoading(false);
}

function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files?.[0] || null;
setBannerFile(file);

if (!file) {
setBannerPreview(currentBannerUrl);
return;
}

setBannerPreview(URL.createObjectURL(file));
}

async function uploadBanner(userId: string) {
if (!bannerFile) return currentBannerUrl;

const ext = bannerFile.name.split(".").pop() || "jpg";
const filePath = `event-banners/${userId}-${Date.now()}.${ext}`;

const { error: uploadError } = await supabase.storage
.from("media")
.upload(filePath, bannerFile, {
cacheControl: "3600",
upsert: false,
});

if (uploadError) throw uploadError;

const { data } = supabase.storage.from("media").getPublicUrl(filePath);
return data.publicUrl;
}

async function updateEvent(e: React.FormEvent) {
e.preventDefault();
setErrorMsg("");
setSaving(true);

try {
const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
setErrorMsg("You need to be logged in to edit this event.");
setSaving(false);
return;
}

if (creatorId && user.id !== creatorId) {
setErrorMsg("Only the event creator can edit this event.");
setSaving(false);
return;
}

if (endsAt && new Date(endsAt) < new Date(startsAt)) {
setErrorMsg("End time cannot be before the start time.");
setSaving(false);
return;
}

const bannerUrl = await uploadBanner(user.id);

const { error } = await supabase
.from("events")
.update({
title: title.trim(),
description: description.trim() || null,
location: location.trim() || null,
city: city.trim() || null,
state: stateName.trim() || null,
starts_at: new Date(startsAt).toISOString(),
ends_at: endsAt ? new Date(endsAt).toISOString() : null,
event_type: eventType,
visibility,
rsvp_visibility: rsvpVisibility,
banner_url: bannerUrl,
})
.eq("id", eventId)
.eq("creator_id", user.id);

if (error) {
console.error(error);
setErrorMsg(error.message || "Something went wrong updating the event.");
setSaving(false);
return;
}

router.push(`/events/${eventId}`);
} catch (err: any) {
console.error(err);
setErrorMsg(err?.message || "Something went wrong updating the event.");
setSaving(false);
}
}

if (loading) {
return (
<main style={{ maxWidth: 820, margin: "0 auto", padding: "150px 20px 80px" }}>
<p style={{ color: "rgba(255,255,255,0.72)" }}>Loading event...</p>
</main>
);
}

if (errorMsg && myUserId !== creatorId) {
return (
<main style={{ maxWidth: 820, margin: "0 auto", padding: "150px 20px 80px" }}>
<div style={errorStyle}>{errorMsg}</div>
</main>
);
}

return (
<main style={{ maxWidth: 820, margin: "0 auto", padding: "150px 20px 80px" }}>
<h1 style={{ color: "white", fontSize: 34, marginBottom: 8 }}>
Edit Event
</h1>

<p style={{ color: "rgba(255,255,255,0.72)", marginBottom: 28 }}>
Update the time, location, details, visibility, or banner.
</p>

<form onSubmit={updateEvent} style={formStyle}>
<label style={labelStyle}>
Event banner
<input type="file" accept="image/*" onChange={handleBannerChange} style={fileInputStyle} />
</label>

{bannerPreview && (
<div style={bannerWrapStyle}>
<img src={bannerPreview} alt="Event banner preview" style={bannerImgStyle} />
</div>
)}

<label style={labelStyle}>
Event title
<input required value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
</label>

<label style={labelStyle}>
Event type
<select value={eventType} onChange={(e) => setEventType(e.target.value as EventType)} style={inputStyle}>
<option value="meetup">Meetup</option>
<option value="munch">Munch</option>
<option value="party">Party</option>
<option value="class">Class</option>
<option value="workshop">Workshop</option>
<option value="convention">Convention</option>
<option value="online">Online</option>
<option value="other">Other</option>
</select>
</label>

<label style={labelStyle}>
Description
<textarea
value={description}
onChange={(e) => setDescription(e.target.value)}
rows={5}
style={{ ...inputStyle, resize: "vertical" }}
/>
</label>

<label style={labelStyle}>
Location / venue
<input value={location} onChange={(e) => setLocation(e.target.value)} style={inputStyle} />
</label>

<div style={twoColStyle}>
<label style={labelStyle}>
City
<input value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
</label>

<label style={labelStyle}>
State
<input value={stateName} onChange={(e) => setStateName(e.target.value)} style={inputStyle} />
</label>
</div>

<div style={twoColStyle}>
<label style={labelStyle}>
Starts at
<input required type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={inputStyle} />
</label>

<label style={labelStyle}>
Ends at
<input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={inputStyle} />
</label>
</div>

<div style={twoColStyle}>
<label style={labelStyle}>
Event visibility
<select value={visibility} onChange={(e) => setVisibility(e.target.value as EventVisibility)} style={inputStyle}>
<option value="public">Public</option>
<option value="friends">Friends only</option>
<option value="private">Private</option>
<option value="invite_only">Invite only</option>
</select>
</label>

<label style={labelStyle}>
RSVP visibility
<select value={rsvpVisibility} onChange={(e) => setRsvpVisibility(e.target.value as RSVPVisibility)} style={inputStyle}>
<option value="public">Public</option>
<option value="attendees">Attendees only</option>
<option value="hidden">Hidden</option>
</select>
</label>
</div>

{errorMsg && <div style={errorStyle}>{errorMsg}</div>}

<button disabled={saving} type="submit" style={submitStyle(saving)}>
{saving ? "Saving..." : "Save Changes"}
</button>
</form>
</main>
);
}

const formStyle: React.CSSProperties = {
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(168,85,247,0.22)",
borderRadius: 24,
padding: 24,
backdropFilter: "blur(12px)",
boxShadow: "0 0 24px rgba(123,92,255,0.12)",
};

const labelStyle: React.CSSProperties = {
display: "flex",
flexDirection: "column",
gap: 8,
color: "rgba(255,255,255,0.86)",
fontWeight: 700,
marginBottom: 18,
};

const inputStyle: React.CSSProperties = {
width: "100%",
padding: "13px 14px",
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
};

const fileInputStyle: React.CSSProperties = {
...inputStyle,
color: "rgba(255,255,255,0.82)",
};

const twoColStyle: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 16,
};

const bannerWrapStyle: React.CSSProperties = {
width: "100%",
height: 220,
borderRadius: 20,
overflow: "hidden",
marginBottom: 18,
border: "1px solid rgba(255,255,255,0.12)",
boxShadow: "0 0 24px rgba(123,92,255,0.18)",
};

const bannerImgStyle: React.CSSProperties = {
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
};

const errorStyle: React.CSSProperties = {
marginBottom: 16,
padding: 12,
borderRadius: 14,
color: "#fecaca",
background: "rgba(239,68,68,0.12)",
border: "1px solid rgba(239,68,68,0.35)",
};

const submitStyle = (saving: boolean): React.CSSProperties => ({
width: "100%",
padding: "14px 18px",
borderRadius: 16,
border: "none",
cursor: saving ? "not-allowed" : "pointer",
background: "linear-gradient(135deg, #ff4fd8 0%, #7b5cff 100%)",
color: "white",
fontWeight: 800,
fontSize: 16,
boxShadow: "0 0 24px rgba(168,85,247,0.45)",
opacity: saving ? 0.7 : 1,
});