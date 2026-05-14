"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type WritingRow = {
id: number;
user_id: string;
title: string;
body: string;
visibility: string;
created_at: string;
updated_at: string;
author?: {
username: string | null;
display_name: string | null;
avatar_url: string | null;
} | null;
};

type RatingRow = {
rating: number;
user_id: string;
};

type WritingCommentRow = {
id: number;
writing_id: number;
user_id: string;
body: string;
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

export default function WritingPage() {
const params = useParams();
const router = useRouter();
const writingId = Number(params.id);

const supabase = useMemo(() => getSupabase(), []);

const [meId, setMeId] = useState<string | null>(null);
const [writing, setWriting] = useState<WritingRow | null>(null);
const [ratings, setRatings] = useState<RatingRow[]>([]);
const [myRating, setMyRating] = useState<number | null>(null);
const [comments, setComments] = useState<WritingCommentRow[]>([]);
const [commentBody, setCommentBody] = useState("");
const [sendingComment, setSendingComment] = useState(false);
const [loading, setLoading] = useState(true);
const [savingRating, setSavingRating] = useState(false);

useEffect(() => {
loadPage();
}, [writingId]);

async function loadPage() {
setLoading(true);

const {
data: { user },
} = await supabase.auth.getUser();

setMeId(user?.id || null);

const { data: writingData, error: writingError } = await supabase
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
.eq("id", writingId)
.single();

if (writingError) {
console.error(writingError);
setWriting(null);
setLoading(false);
return;
}

setWriting(writingData as unknown as WritingRow);

const { data: ratingData, error: ratingError } = await supabase
.from("writing_ratings")
.select("rating,user_id")
.eq("writing_id", writingId);

if (ratingError) {
console.error(ratingError);
setRatings([]);
} else {
const safeRatings = (ratingData || []) as RatingRow[];
setRatings(safeRatings);

if (user?.id) {
const mine = safeRatings.find((r) => r.user_id === user.id);
setMyRating(mine?.rating || null);
}
}

const { data: commentData, error: commentError } = await supabase
.from("writing_comments")
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
.eq("writing_id", writingId)
.order("created_at", { ascending: true });

if (commentError) {
console.error(commentError);
setComments([]);
} else {
setComments((commentData || []) as WritingCommentRow[]);
}

setLoading(false);
}

async function rateWriting(rating: number) {
if (!meId || !writing) return;

setSavingRating(true);

const { error } = await supabase.from("writing_ratings").upsert(
{
writing_id: writingId,
user_id: meId,
rating,
updated_at: new Date().toISOString(),
},
{
onConflict: "writing_id,user_id",
}
);

setSavingRating(false);

if (error) {
console.error(error);
return;
}

setMyRating(rating);
await loadPage();
}

async function submitComment() {
if (!meId || !writing || !commentBody.trim()) return;

setSendingComment(true);

const { error } = await supabase.from("writing_comments").insert({
writing_id: writingId,
user_id: meId,
body: commentBody.trim(),
});

setSendingComment(false);

if (error) {
console.error(error);
return;
}

setCommentBody("");
await loadPage();
}

const authorName =
writing?.author?.display_name || writing?.author?.username || "Unknown writer";

const averageRating =
ratings.length > 0
? ratings.reduce((sum, item) => sum + item.rating, 0) / ratings.length
: 0;

if (loading) {
return <main style={pageStyle}>Loading writing...</main>;
}

if (!writing) {
return (
<main style={pageStyle}>
<section style={cardStyle}>
<h1 style={titleStyle}>Writing not found</h1>
<button onClick={() => router.back()} style={buttonStyle}>
Go Back
</button>
</section>
</main>
);
}

return (
<main style={pageStyle}>
<article style={cardStyle}>
<Link href="/feed" style={backLinkStyle}>
← Back
</Link>

<p style={eyebrowStyle}>UNBOUND WRITING</p>

<h1 style={titleStyle}>{writing.title}</h1>

<div style={authorRowStyle}>
<div style={avatarStyle}>
{writing.author?.avatar_url ? (
<img
src={writing.author.avatar_url}
alt=""
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
) : (
authorName.charAt(0).toUpperCase()
)}
</div>

<div>
<div style={{ color: "white", fontWeight: 900 }}>{authorName}</div>
<div style={{ color: "rgba(255,255,255,0.58)", fontSize: 13 }}>
{new Date(writing.created_at).toLocaleDateString()}
</div>
</div>
</div>

<div style={bodyStyle}>{writing.body}</div>
</article>

<section style={cardStyle}>
<h2 style={{ marginTop: 0 }}>Rate this writing</h2>

<div style={starsRowStyle}>
{[1, 2, 3, 4, 5].map((star) => (
<button
key={star}
type="button"
onClick={() => rateWriting(star)}
disabled={savingRating}
style={starButtonStyle}
title={`${star} star${star === 1 ? "" : "s"}`}
>
{star <= (myRating || 0) ? "★" : "☆"}
</button>
))}
</div>

<p style={ratingTextStyle}>
{ratings.length > 0
? `${averageRating.toFixed(1)} average · ${ratings.length} rating${
ratings.length === 1 ? "" : "s"
}`
: "No ratings yet."}
</p>

{myRating ? (
<p style={ratingTextStyle}>Your rating: {myRating} star{myRating === 1 ? "" : "s"}</p>
) : null}
</section>
<section style={cardStyle}>
<h2 style={{ marginTop: 0 }}>
Comments ({comments.length})
</h2>

<textarea
value={commentBody}
onChange={(e) => setCommentBody(e.target.value)}
placeholder="Write a comment..."
style={commentInputStyle}
/>

<button
type="button"
onClick={submitComment}
disabled={sendingComment}
style={buttonStyle}
>
{sendingComment ? "Posting..." : "Post Comment"}
</button>

<div style={{ marginTop: 24 }}>
{comments.length === 0 ? (
<p style={ratingTextStyle}>No comments yet.</p>
) : (
comments.map((comment) => {
const commentAuthor =
comment.author?.display_name ||
comment.author?.username ||
"Unknown user";

return (
<div key={comment.id} style={commentCardStyle}>
<div style={commentHeaderStyle}>
<div style={commentAvatarStyle}>
{comment.author?.avatar_url ? (
<img
src={comment.author.avatar_url}
alt=""
style={{
width: "100%",
height: "100%",
objectFit: "cover",
}}
/>
) : (
commentAuthor.charAt(0).toUpperCase()
)}
</div>

<div>
<div style={{ fontWeight: 800, color: "white" }}>
{commentAuthor}
</div>

<div
style={{
color: "rgba(255,255,255,0.52)",
fontSize: 12,
}}
>
{new Date(comment.created_at).toLocaleString()}
</div>
</div>
</div>

<div style={commentBodyStyle}>
{comment.body}
</div>
</div>
);
})
)}
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
maxWidth: 900,
margin: "0 auto 28px",
padding: 28,
borderRadius: 28,
background:
"linear-gradient(135deg, rgba(168,85,247,0.22), rgba(76,29,149,0.16)), rgba(10,10,18,0.78)",
border: "3px solid rgba(183, 10, 146, 0.38)",
boxShadow: "0 0 34px rgba(168,85,247,0.18)",
backdropFilter: "blur(16px)",
};

const backLinkStyle: React.CSSProperties = {
color: "rgba(255,255,255,0.72)",
textDecoration: "none",
display: "inline-block",
marginBottom: 18,
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
margin: "0 0 18px",
};

const authorRowStyle: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
marginBottom: 28,
};

const avatarStyle: React.CSSProperties = {
width: 46,
height: 46,
borderRadius: "50%",
overflow: "hidden",
display: "grid",
placeItems: "center",
background: "linear-gradient(135deg,#c084fc,#7c3aed)",
color: "white",
fontWeight: 900,
};

const bodyStyle: React.CSSProperties = {
whiteSpace: "pre-wrap",
lineHeight: 1.8,
color: "rgba(255,255,255,0.86)",
fontSize: 17,
};

const starsRowStyle: React.CSSProperties = {
display: "flex",
gap: 6,
margin: "10px 0",
};

const starButtonStyle: React.CSSProperties = {
border: "none",
background: "transparent",
color: "#facc15",
fontSize: 36,
cursor: "pointer",
padding: 0,
};

const ratingTextStyle: React.CSSProperties = {
color: "rgba(255,255,255,0.68)",
margin: "6px 0",
};

const commentInputStyle: React.CSSProperties = {
width: "100%",
minHeight: 120,
borderRadius: 18,
border: "1px solid rgba(183, 10, 146, 0.38)",
background: "rgba(255,255,255,0.06)",
color: "white",
padding: 16,
outline: "none",
resize: "vertical",
marginBottom: 14,
fontSize: 15,
};

const commentCardStyle: React.CSSProperties = {
borderRadius: 20,
padding: 18,
marginBottom: 14,
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(183, 10, 146, 0.38)",
};

const commentHeaderStyle: React.CSSProperties = {
display: "flex",
alignItems: "center",
gap: 12,
marginBottom: 14,
};

const commentAvatarStyle: React.CSSProperties = {
width: 42,
height: 42,
borderRadius: "50%",
overflow: "hidden",
display: "grid",
placeItems: "center",
background: "linear-gradient(135deg,#c084fc,#7c3aed)",
color: "white",
fontWeight: 900,
};

const commentBodyStyle: React.CSSProperties = {
whiteSpace: "pre-wrap",
color: "rgba(255,255,255,0.84)",
lineHeight: 1.6,
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