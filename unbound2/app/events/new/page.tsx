"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewEventPage() {
const router = useRouter();
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

const [saving, setSaving] = useState(false);
const [errorMsg, setErrorMsg] = useState("");

function handleBannerChange(e: React.ChangeEvent<HTMLInputElement>) {
const file = e.target.files?.[0] || null;
setBannerFile(file);

if (!file) {
setBannerPreview(null);
return;
}

setBannerPreview(URL.createObjectURL(file));
}

async function uploadBanner(userId: string) {
if (!bannerFile) return null;

const ext = bannerFile.name.split(".").pop() || "jpg";
const filePath = `event-banners/${userId}-${Date.now()}.${ext}`;

const { error: uploadError } = await supabase.storage
.from("media")
.upload(filePath, bannerFile, {
cacheControl: "3600",
upsert: false,
});

if (uploadError) {
throw uploadError;
}

const { data } = supabase.storage.from("media").getPublicUrl(filePath);

return data.publicUrl;
}

async function createEvent(e: React.FormEvent) {
e.preventDefault();
setErrorMsg("");
setSaving(true);

try {
const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
setErrorMsg("You need to be logged in to create an event.");
setSaving(false);
return;
}

if (endsAt && new Date(endsAt) < new Date(startsAt)) {
setErrorMsg("End time cannot be before the start time.");
setSaving(false);
return;
}

const bannerUrl = await uploadBanner(user.id);

const { data, error } = await supabase
.from("events")
.insert({
creator_id: user.id,
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
.select("id")
.single();

if (error) {
console.error(error);
setErrorMsg(error.message || "Something went wrong creating the event.");
setSaving(false);
return;
}

router.push(`/events/${data.id}`);
} catch (err: any) {
console.error(err);
setErrorMsg(err?.message || "Something went wrong uploading the banner.");
setSaving(false);
}
}

return (
<main
style={{
maxWidth: 820,
margin: "0 auto",
padding: "120px 20px 80px",
}}
>
<h1 style={{ color: "white", fontSize: 34, marginBottom: 8 }}>
Create Event
</h1>

<p style={{ color: "rgba(255,255,255,0.72)", marginBottom: 28 }}>
Add a community meetup, party, munch, class, workshop, or gathering.
</p>

<form
onSubmit={createEvent}
style={{
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(168,85,247,0.22)",
borderRadius: 24,
padding: 24,
backdropFilter: "blur(12px)",
boxShadow: "0 0 24px rgba(123,92,255,0.12)",
}}
>
<label style={labelStyle}>
Event banner
<input
type="file"
accept="image/*"
onChange={handleBannerChange}
style={fileInputStyle}
/>
</label>

{bannerPreview && (
<div
style={{
width: "100%",
height: 220,
borderRadius: 20,
overflow: "hidden",
marginBottom: 18,
border: "1px solid rgba(255,255,255,0.12)",
boxShadow: "0 0 24px rgba(123,92,255,0.18)",
}}
>
<img
src={bannerPreview}
alt="Event banner preview"
style={{
width: "100%",
height: "100%",
objectFit: "cover",
display: "block",
}}
/>
</div>
)}

<label style={labelStyle}>
Event title
<input
required
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="Ex: Seattle Rope Jam"
style={inputStyle}
/>
</label>

<label style={labelStyle}>
Event type
<select
value={eventType}
onChange={(e) => setEventType(e.target.value as EventType)}
style={inputStyle}
>
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
placeholder="Tell people what this event is about..."
rows={5}
style={{ ...inputStyle, resize: "vertical" }}
/>
</label>

<label style={labelStyle}>
Location / venue
<input
value={location}
onChange={(e) => setLocation(e.target.value)}
placeholder="Venue, address, online link, or private location note"
style={inputStyle}
/>
</label>

<div style={twoColStyle}>
<label style={labelStyle}>
City
<input
value={city}
onChange={(e) => setCity(e.target.value)}
placeholder="Seattle"
style={inputStyle}
/>
</label>

<label style={labelStyle}>
State
<input
value={stateName}
onChange={(e) => setStateName(e.target.value)}
placeholder="WA"
style={inputStyle}
/>
</label>
</div>

<div style={twoColStyle}>
<label style={labelStyle}>
Starts at
<input
required
type="datetime-local"
value={startsAt}
onChange={(e) => setStartsAt(e.target.value)}
style={inputStyle}
/>
</label>

<label style={labelStyle}>
Ends at
<input
type="datetime-local"
value={endsAt}
onChange={(e) => setEndsAt(e.target.value)}
style={inputStyle}
/>
</label>
</div>

<div style={twoColStyle}>
<label style={labelStyle}>
Event visibility
<select
value={visibility}
onChange={(e) =>
setVisibility(e.target.value as EventVisibility)
}
style={inputStyle}
>
<option value="public">Public</option>
<option value="friends">Friends only</option>
<option value="private">Private</option>
<option value="invite_only">Invite only</option>
</select>
</label>

<label style={labelStyle}>
RSVP visibility
<select
value={rsvpVisibility}
onChange={(e) =>
setRsvpVisibility(e.target.value as RSVPVisibility)
}
style={inputStyle}
>
<option value="public">Public</option>
<option value="attendees">Attendees only</option>
<option value="hidden">Hidden</option>
</select>
</label>
</div>

<div
style={{
marginTop: -6,
marginBottom: 18,
padding: 14,
borderRadius: 16,
background: "rgba(123,92,255,0.10)",
border: "1px solid rgba(168,85,247,0.18)",
color: "rgba(255,255,255,0.72)",
fontSize: 13,
lineHeight: 1.5,
}}
>
Safety note: blocked users are filtered out of event and RSVP views.
RSVP visibility controls how much of the attendee list people can see.
</div>

{errorMsg && (
<div
style={{
marginBottom: 16,
padding: 12,
borderRadius: 14,
color: "#fecaca",
background: "rgba(239,68,68,0.12)",
border: "1px solid rgba(239,68,68,0.35)",
}}
>
{errorMsg}
</div>
)}

<button
disabled={saving}
type="submit"
style={{
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
}}
>
{saving ? "Creating..." : "Create Event"}
</button>
</form>
</main>
);
}

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
width: "100%",
padding: "13px 14px",
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.35)",
color: "rgba(255,255,255,0.82)",
outline: "none",
};

const twoColStyle: React.CSSProperties = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 16,
};