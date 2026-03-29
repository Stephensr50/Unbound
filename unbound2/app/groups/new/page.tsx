"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error(
"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
);
}

return createClient(url, key);
}

function slugify(input: string) {
return input
.toLowerCase()
.trim()
.replace(/['"]/g, "")
.replace(/[^a-z0-9]+/g, "-")
.replace(/^-+|-+$/g, "")
.slice(0, 60);
}

export default function NewGroupPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [name, setName] = useState("");
const [description, setDescription] = useState("");
const [visibility, setVisibility] = useState<"public" | "private">("public");

const [saving, setSaving] = useState(false);
const [status, setStatus] = useState("");

async function handleCreate() {
try {
setSaving(true);
setStatus("");

const trimmedName = name.trim();
const trimmedDescription = description.trim();

if (!trimmedName) {
setStatus("Group name is required.");
setSaving(false);
return;
}

const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;

const user = authData?.user;
if (!user) {
setStatus("You must be logged in.");
setSaving(false);
return;
}

let baseSlug = slugify(trimmedName);
if (!baseSlug) baseSlug = `group-${Date.now()}`;

let finalSlug = baseSlug;

for (let i = 0; i < 10; i++) {
const trySlug = i === 0 ? baseSlug : `${baseSlug}-${Date.now()}`;
const { data: slugTaken } = await supabase
.from("groups")
.select("id")
.eq("slug", trySlug)
.maybeSingle();

if (!slugTaken) {
finalSlug = trySlug;
break;
}
}

const { data: newGroup, error: groupErr } = await supabase
.from("groups")
.insert({
creator_id: user.id,
name: trimmedName,
slug: finalSlug,
description: trimmedDescription || null,
visibility,
})
.select("id, slug")
.single();

if (groupErr) throw groupErr;
if (!newGroup) throw new Error("Group creation failed.");

const { error: memberErr } = await supabase.from("group_members").insert({
group_id: newGroup.id,
user_id: user.id,
role: "owner",
});

if (memberErr) throw memberErr;

setStatus("Group created ✅");
router.push(`/groups/${newGroup.slug}`);
} catch (e: any) {
setStatus(e?.message || "Failed to create group.");
setSaving(false);
}
}

const shell: React.CSSProperties = {
width: "min(760px, 94vw)",
margin: "24px auto",
padding: 18,
borderRadius: 18,
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.18)",
boxShadow: "0 0 24px rgba(168,85,247,0.18)",
};

const label: React.CSSProperties = {
fontSize: 12,
opacity: 0.82,
marginBottom: 6,
};

const input: React.CSSProperties = {
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
};

const button: React.CSSProperties = {
marginTop: 14,
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.45)",
background: "rgba(120, 60, 220, 0.18)",
color: "rgba(235,220,255,0.95)",
fontWeight: 800,
cursor: "pointer",
boxShadow: "0 0 18px rgba(170, 90, 255, 0.18)",
};

return (
<div style={shell}>
<h1 style={{ marginTop: 0, marginBottom: 16, fontSize: 30, fontWeight: 900 }}>
Create Group
</h1>

<div style={{ marginBottom: 12 }}>
<div style={label}>Group name</div>
<input
style={input}
value={name}
onChange={(e) => setName(e.target.value)}
placeholder="Ex: Tacoma Rope Crew"
/>
</div>

<div style={{ marginBottom: 12 }}>
<div style={label}>Description</div>
<textarea
style={{ ...input, minHeight: 110, resize: "vertical" }}
value={description}
onChange={(e) => setDescription(e.target.value)}
placeholder="What is this group about?"
/>
</div>

<div style={{ marginBottom: 12 }}>
<div style={label}>Visibility</div>
<select
style={input}
value={visibility}
onChange={(e) => setVisibility(e.target.value as "public" | "private")}
>
<option value="public" style={{ color: "black" }}>
Public
</option>
<option value="private" style={{ color: "black" }}>
Private
</option>
</select>
</div>

<button onClick={handleCreate} disabled={saving} style={button}>
{saving ? "Creating..." : "Create group"}
</button>

{status ? (
<div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>{status}</div>
) : null}
</div>
);
}