"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function NewWritingPage() {
const router = useRouter();
const supabase = useMemo(() => getSupabase(), []);

const [title, setTitle] = useState("");
const [body, setBody] = useState("");
const [visibility, setVisibility] = useState("public");
const [saving, setSaving] = useState(false);
const [status, setStatus] = useState("");

async function createWriting() {
if (!title.trim() || !body.trim()) {
setStatus("Add a title and body first.");
return;
}

setSaving(true);
setStatus("");

const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
setSaving(false);
setStatus("You need to be logged in.");
return;
}

const { data, error } = await supabase
.from("writings")
.insert({
user_id: user.id,
title: title.trim(),
body: body.trim(),
visibility,
})
.select("id")
.single();

setSaving(false);

if (error) {
console.error(error);
setStatus("Could not create writing.");
return;
}

router.push(`/writings/${data.id}`);
}

return (
<main style={pageStyle}>
<section style={cardStyle}>
<p style={eyebrowStyle}>UNBOUND WRITINGS</p>

<h1 style={titleStyle}>New Writing</h1>

<p style={subStyle}>
Share a story, journal entry, fantasy, reflection, scene recap, or
anything worth saying.
</p>

<label style={labelStyle}>Title</label>
<input
value={title}
onChange={(e) => setTitle(e.target.value)}
placeholder="Give it a title..."
style={inputStyle}
/>

<label style={labelStyle}>Visibility</label>
<select
value={visibility}
onChange={(e) => setVisibility(e.target.value)}
style={inputStyle}
>
<option value="public">Public</option>
<option value="followers">Followers</option>
<option value="private">Private</option>
</select>

<label style={labelStyle}>Body</label>
<textarea
value={body}
onChange={(e) => setBody(e.target.value)}
placeholder="Start writing..."
rows={16}
style={textareaStyle}
/>

{status ? <p style={statusStyle}>{status}</p> : null}

<div style={buttonRowStyle}>
<button
type="button"
onClick={() => router.back()}
style={ghostButtonStyle}
>
Cancel
</button>

<button
type="button"
onClick={createWriting}
disabled={saving}
style={buttonStyle}
>
{saving ? "Publishing..." : "Publish Writing"}
</button>
</div>
</section>
</main>
);
}

const pageStyle: React.CSSProperties = {
minHeight: "100vh",
padding: "42px 18px",
color: "white",
};

const cardStyle: React.CSSProperties = {
maxWidth: 880,
margin: "0 auto",
padding: 28,
borderRadius: 28,
background:
"linear-gradient(135deg, rgba(168,85,247,0.22), rgba(76,29,149,0.16)), rgba(10,10,18,0.78)",
border: "1px solid rgba(192,132,252,0.38)",
boxShadow: "0 0 34px rgba(168,85,247,0.18)",
backdropFilter: "blur(16px)",
};

const eyebrowStyle: React.CSSProperties = {
color: "#c084fc",
fontWeight: 900,
letterSpacing: 2,
fontSize: 12,
marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
fontSize: 44,
margin: "0 0 10px",
};

const subStyle: React.CSSProperties = {
color: "rgba(255,255,255,0.72)",
lineHeight: 1.6,
marginBottom: 24,
};

const labelStyle: React.CSSProperties = {
display: "block",
margin: "18px 0 8px",
color: "rgba(255,255,255,0.84)",
fontWeight: 800,
};

const inputStyle: React.CSSProperties = {
width: "100%",
borderRadius: 16,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(0,0,0,0.34)",
color: "white",
padding: "13px 14px",
outline: "none",
};

const textareaStyle: React.CSSProperties = {
...inputStyle,
minHeight: 360,
resize: "vertical",
lineHeight: 1.7,
};

const buttonRowStyle: React.CSSProperties = {
display: "flex",
gap: 12,
flexWrap: "wrap",
marginTop: 22,
};

const buttonStyle: React.CSSProperties = {
border: "none",
borderRadius: 999,
padding: "12px 20px",
background: "linear-gradient(135deg,#c084fc,#7c3aed)",
color: "white",
fontWeight: 900,
cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
...buttonStyle,
background: "rgba(255,255,255,0.08)",
border: "1px solid rgba(255,255,255,0.16)",
};

const statusStyle: React.CSSProperties = {
color: "#ffb3b3",
marginTop: 14,
};