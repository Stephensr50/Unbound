"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type WritingRow = {
id: number;
user_id: string;
title: string;
body: string;
visibility: string;
created_at: string;
author?: {
username: string | null;
display_name: string | null;
avatar_url: string | null;
} | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

function previewText(body: string) {
if (body.length <= 220) return body;
return body.slice(0, 220).trim() + "...";
}

export default function WritingsPage() {
const supabase = useMemo(() => getSupabase(), []);
const [writings, setWritings] = useState<WritingRow[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
loadWritings();
}, []);

async function loadWritings() {
setLoading(true);

const { data, error } = await supabase
.from("writings")
.select(
`
*,
author:profiles (
username,
display_name,
avatar_url
)
`
)
.eq("visibility", "public")
.order("created_at", { ascending: false });

if (error) {
console.error(error);
setWritings([]);
} else {
setWritings((data || []) as WritingRow[]);
}

setLoading(false);
}

return (
<main style={pageStyle}>
<section style={headerStyle}>
<div>
<p style={eyebrowStyle}>UNBOUND WRITINGS</p>
<h1 style={titleStyle}>Writings</h1>
<p style={subStyle}>
Stories, journals, fantasies, reflections, scene recaps, and voices
from the Unbound community.
</p>
</div>

<Link href="/writings/new" style={buttonStyle}>
Create Writing
</Link>
</section>

{loading ? (
<section style={cardStyle}>Loading writings...</section>
) : writings.length === 0 ? (
<section style={cardStyle}>
No writings yet. Be the first to publish one.
</section>
) : (
<section style={listStyle}>
{writings.map((writing) => {
const authorName =
writing.author?.display_name ||
writing.author?.username ||
"Unknown writer";

return (
<Link
key={writing.id}
href={`/writings/${writing.id}`}
style={writingCardStyle}
>
<div style={authorRowStyle}>
<div style={avatarStyle}>
{writing.author?.avatar_url ? (
<img
src={writing.author.avatar_url}
alt=""
style={{
width: "100%",
height: "100%",
objectFit: "cover",
}}
/>
) : (
authorName.charAt(0).toUpperCase()
)}
</div>

<div>
<div style={{ color: "white", fontWeight: 900 }}>
{authorName}
</div>
<div
style={{
color: "rgba(255,255,255,0.58)",
fontSize: 13,
}}
>
{new Date(writing.created_at).toLocaleDateString()}
</div>
</div>
</div>

<h2 style={writingTitleStyle}>{writing.title}</h2>

<p style={previewStyle}>{previewText(writing.body)}</p>

<div style={readMoreStyle}>Continue reading →</div>
</Link>
);
})}
</section>
)}
</main>
);
}

const pageStyle: React.CSSProperties = {
minHeight: "100vh",
padding: "42px 18px",
color: "white",
};

const headerStyle: React.CSSProperties = {
maxWidth: 980,
margin: "0 auto 28px",
padding: 28,
borderRadius: 28,
background:
"linear-gradient(135deg, rgba(168,85,247,0.22), rgba(76,29,149,0.16)), rgba(10,10,18,0.78)",
border: "3px solid rgba(183, 10, 146, 0.38)",
boxShadow: "0 0 34px rgba(168,85,247,0.18)",
backdropFilter: "blur(16px)",
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 18,
flexWrap: "wrap",
};

const eyebrowStyle: React.CSSProperties = {
color: "#c084fc",
fontWeight: 900,
letterSpacing: 2,
fontSize: 12,
marginBottom: 10,
};

const titleStyle: React.CSSProperties = {
fontSize: 46,
margin: "0 0 10px",
};

const subStyle: React.CSSProperties = {
color: "rgba(255,255,255,0.72)",
lineHeight: 1.6,
margin: 0,
maxWidth: 640,
};

const buttonStyle: React.CSSProperties = {
border: "none",
borderRadius: 999,
padding: "12px 20px",
background: "linear-gradient(135deg,#c084fc,#7c3aed)",
color: "white",
fontWeight: 900,
display: "flex",
alignItems: "center",
justifyContent: "center",
textAlign: "center",
textDecoration: "none",
boxShadow: "0 0 22px rgba(168,85,247,0.28)",
};

const cardStyle: React.CSSProperties = {
maxWidth: 980,
margin: "0 auto",
padding: 28,
borderRadius: 28,
background: "rgba(10,10,18,0.76)",
border: "1px solid rgba(183, 10, 146, 0.38)",
};

const listStyle: React.CSSProperties = {
maxWidth: 980,
margin: "0 auto",
display: "flex",
flexDirection: "column",
gap: 18,
};

const writingCardStyle: React.CSSProperties = {
display: "block",
padding: 24,
borderRadius: 26,
background:
"linear-gradient(135deg, rgba(168,85,247,0.18), rgba(76,29,149,0.12)), rgba(10,10,18,0.76)",
border: "3px solid rgba(183, 10, 146, 0.38)",
boxShadow: "0 0 24px rgba(168,85,247,0.12)",
color: "white",
textDecoration: "none",
backdropFilter: "blur(14px)",
};

const authorRowStyle: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
marginBottom: 16,
};

const avatarStyle: React.CSSProperties = {
width: 44,
height: 44,
borderRadius: "50%",
overflow: "hidden",
display: "grid",
placeItems: "center",
background: "linear-gradient(135deg,#c084fc,#7c3aed)",
color: "white",
fontWeight: 900,
};

const writingTitleStyle: React.CSSProperties = {
fontSize: 34,
margin: "0 0 10px",
};

const previewStyle: React.CSSProperties = {
color: "rgba(255,255,255,0.76)",
lineHeight: 1.65,
margin: "0 0 14px",
};

const readMoreStyle: React.CSSProperties = {
color: "#c084fc",
fontWeight: 900,
};