"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type Profile = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
gender?: string | null;
};

const QUESTIONS = [
"Would you let them tie you up?",
"Would you let them take control?",
"Would you let them fuck you all night?",
"Would you let them tell you what to do?",
"Would you let them tease you in public?",
"Would you let them be your guilty pleasure?",
"Would you let them boss you around?",
"Would you let them ruin your focus?",
"Would you let them spank your ass?",
];

export default function GamePage() {
const supabase = useMemo(() => getSupabase(), []);

const [mode, setMode] = useState<"menu" | "wouldyou">("menu");
const [profiles, setProfiles] = useState<Profile[]>([]);
const [current, setCurrent] = useState<Profile | null>(null);
const [question, setQuestion] = useState("");
const [loading, setLoading] = useState(false);
const [matchProfile, setMatchProfile] = useState<Profile | null>(null);
const [genderFilter, setGenderFilter] = useState<
"Female" | "Male" | "Other" | "all">
("all");
function getRandomQuestion() {
return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

function pickNext(list: Profile[]) {
if (!list.length) {
setCurrent(null);
return;
}

const next = list[Math.floor(Math.random() * list.length)];
setCurrent(next);
setQuestion(getRandomQuestion());
}

async function loadProfiles() {
setLoading(true);

try {
const { data: authData } = await supabase.auth.getUser();
const me = authData.user?.id;

if (!me) {
alert("You need to be logged in to play.");
setLoading(false);
return;
}

const { data: meProfile, error: meProfileError } = await supabase
.from("profiles")
.select("interested_in")
.eq("id", me)
.maybeSingle();



let query = supabase
.from("profiles")
.select("id, username, display_name, avatar_url, gender")
.neq("id", me)
.limit(50);
if (genderFilter !== "all") {
query = query.eq("gender", genderFilter);
}



const { data, error } = await query;

if (error) {
console.error("LOAD PROFILES ERROR:", error.message);
alert(error.message);
setProfiles([]);
setCurrent(null);
setLoading(false);
return;
}

const rows = (data ?? []) as Profile[];

setProfiles(rows);
pickNext(rows);
} catch (err) {
console.error("LOAD PROFILES CRASH:", err);
alert("Could not load game profiles. Check console.");
setProfiles([]);
setCurrent(null);
}

setLoading(false);
}

function nextProfile() {
pickNext(profiles);
}

async function handleAnswer(answer: "yes" | "no") {
const { data } = await supabase.auth.getUser();
const me = data.user?.id;

if (!me) {
alert("You need to be logged in to play.");
return;
}

if (!current?.id || me === current.id) {
nextProfile();
return;
}

const { error: voteErr } = await supabase.from("game_votes").upsert(
{
from_user: me,
to_user: current.id,
answer,
},
{
onConflict: "from_user,to_user",
}
);

if (voteErr) {
console.error(voteErr);
nextProfile();
return;
}

if (answer === "yes") {
const { data: reverseYes, error: reverseErr } = await supabase
.from("game_votes")
.select("id")
.eq("from_user", current.id)
.eq("to_user", me)
.eq("answer", "yes")
.maybeSingle();

if (!reverseErr && reverseYes) {
await supabase.from("notifications").insert({
user_id: current.id,
actor_id: me,
type: "game_match",
message: "You have a match 🔥",
href: `/u/${me}`,
});

await supabase.from("notifications").insert({
user_id: me,
actor_id: current.id,
type: "game_match",
message: "You have a match 🔥",
href: `/u/${current.id}`,
});

setMatchProfile(current);
return;
}
}

nextProfile();
}

useEffect(() => {
if (mode === "wouldyou" && profiles.length === 0 && !loading) {
loadProfiles();
}
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [mode]);

if (mode === "menu") {
return (
<main
style={{
minHeight: "100vh",
padding: "20px 14px 110px",
background:
"radial-gradient(circle at top, rgba(168,85,247,0.14), transparent 28%), rgba(6,6,8,1)",
color: "#fff",
}}
>
<div style={{ maxWidth: 980, margin: "0 auto" }}>
<div
style={{
border: "1px solid rgba(168,85,247,0.18)",
background: "rgba(255,255,255,0.05)",
borderRadius: 24,
padding: 20,
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
}}
>
<h1
style={{
margin: 0,
fontSize: 30,
lineHeight: 1.05,
fontWeight: 900,
letterSpacing: -0.4,
}}
>
Kinky Games 😈
</h1>

<div
style={{
marginTop: 8,
fontSize: 14,
opacity: 0.82,
}}
>
Pick a game and play.
</div>

<div style={{ marginTop: 12 }}>
<select
value={genderFilter}
onChange={(e) => setGenderFilter(e.target.value as any)}
style={{
padding: "10px 12px",
borderRadius: 10,
background: "rgba(255,255,255,0.08)",
color: "#fff",
border: "1px solid rgba(255,255,255,0.15)",
fontWeight: 700,
}}
>
<option value="all" style={{ color: "#000", background: "#fff" }}>Everyone</option>
<option value="Female" style={{ color: "#000", background: "#fff" }}>Women</option>
<option value="Male" style={{ color: "#000", background: "#fff" }}>Men</option>
<option value="Other" style={{ color: "#000", background: "#fff" }}>Other</option>
</select>


</div>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
gap: 16,
marginTop: 20,
}}
>



<button
onClick={() => {
setProfiles([]);
setCurrent(null);
setMode("wouldyou");
}}
style={cardStyle}
type="button"
>
<div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
Would You 😈
</div>
<div style={{ fontSize: 14, opacity: 0.82, fontWeight: 500 }}>
Tap through profiles and answer yes or no.
</div>
</button>

<Link href="/truth-or-dare" style={cardStyle}>
<div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
Truth or Dare 🎭
</div>
<div style={{ fontSize: 14, opacity: 0.82, fontWeight: 500 }}>
Browse the player grid and send a truth, dare, or let them choose.
</div>
</Link>
</div>
</div>
</div>
</main>
);
}

if (loading) {
return (
<main
style={{
minHeight: "100vh",
padding: 20,
color: "#ffffff",
background:
"radial-gradient(circle at top, rgba(168,85,247,0.14), transparent 28%), rgba(6,6,8,1)",
}}
>
<button
onClick={() => setMode("menu")}
type="button"
style={{
marginBottom: 16,
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
color: "#fff",
cursor: "pointer",
fontWeight: 700,
}}
>
← Back to Kinky Games
</button>

Loading game…
</main>
);
}

if (!current) {
return (
<main
style={{
minHeight: "100vh",
padding: 20,
color: "#fff",
background:
"radial-gradient(circle at top, rgba(168,85,247,0.14), transparent 28%), rgba(6,6,8,1)",
}}
>
<button
onClick={() => setMode("menu")}
type="button"
style={{
marginBottom: 16,
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
color: "#fff",
cursor: "pointer",
fontWeight: 700,
}}
>
← Back to Kinky Games
</button>

No profiles matched your preferences yet.
</main>
);
}

const name = current.display_name || current.username || "Unknown";

return (
<>
<main
style={{
minHeight: "100vh",
padding: "20px 14px 110px",
color: "#fff",
background:
"radial-gradient(circle at top, rgba(168,85,247,0.14), transparent 28%), rgba(6,6,8,1)",
}}
>
<div style={{ maxWidth: 720, margin: "0 auto" }}>
<button
onClick={() => setMode("menu")}
type="button"
style={{
marginBottom: 16,
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
color: "#fff",
cursor: "pointer",
fontWeight: 700,
}}
>
← Back to Kinky Games
</button>

<div
style={{
border: "1px solid rgba(168,85,247,0.18)",
background: "rgba(255,255,255,0.05)",
borderRadius: 24,
padding: 20,
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
display: "flex",
flexDirection: "column",
alignItems: "center",
gap: 20,
textAlign: "center",
}}
>
<div
style={{
alignSelf: "stretch",
textAlign: "left",
fontSize: 14,
opacity: 0.76,
fontWeight: 700,
}}
>
Would You 😈
</div>

<img
src={current.avatar_url || "/rope-devil.png"}
alt={name}
style={{
width: 120,
height: 120,
borderRadius: "50%",
objectFit: "cover",
boxShadow: "0 0 20px rgba(170,90,255,0.6)",
border: "1px solid rgba(255,255,255,0.10)",
}}
/>

<div style={{ fontSize: 24, fontWeight: 800 }}>{name}</div>

<div style={{ fontSize: 18, opacity: 0.92, maxWidth: 520 }}>{question}</div>

<div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
<button
onClick={() => handleAnswer("yes")}
type="button"
style={{
padding: "12px 20px",
borderRadius: 12,
border: "none",
background: "linear-gradient(180deg,#22c55e,#166534)",
color: "#fff",
fontWeight: 800,
cursor: "pointer",
}}
>
YES 😈
</button>

<button
onClick={() => handleAnswer("no")}
type="button"
style={{
padding: "12px 20px",
borderRadius: 12,
border: "none",
background: "linear-gradient(180deg,#ef4444,#7f1d1d)",
color: "#fff",
fontWeight: 800,
cursor: "pointer",
}}
>
NO 🙅‍♂️
</button>
</div>
</div>
</div>
</main>

{matchProfile && (
<div
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.78)",
backdropFilter: "blur(8px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9999,
padding: 20,
}}
>
<div
style={{
width: "100%",
maxWidth: 420,
borderRadius: 24,
padding: 28,
textAlign: "center",
background:
"linear-gradient(180deg, rgba(168,85,247,0.22), rgba(20,20,20,0.96))",
border: "1px solid rgba(255,255,255,0.12)",
boxShadow: "0 0 40px rgba(168,85,247,0.45)",
color: "#fff",
}}
>
<div
style={{
fontSize: 34,
fontWeight: 900,
color: "#ff66cc",
textShadow: "0 0 18px rgba(255,102,204,0.55)",
marginBottom: 18,
}}
>
It’s a Match 💥
</div>

<img
src={matchProfile.avatar_url || "/rope-devil.png"}
alt={matchProfile.display_name || matchProfile.username || "Unknown"}
style={{
width: 120,
height: 120,
borderRadius: "50%",
objectFit: "cover",
marginBottom: 16,
boxShadow: "0 0 24px rgba(255,102,204,0.45)",
}}
/>

<div style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>
{matchProfile.display_name || matchProfile.username || "Unknown"}
</div>

<div
style={{
fontSize: 16,
opacity: 0.9,
marginBottom: 22,
}}
>
You both said yes 😈
</div>

<div
style={{
display: "flex",
justifyContent: "center",
gap: 12,
flexWrap: "wrap",
}}
>
<button
onClick={() => {
setMatchProfile(null);
nextProfile();
}}
type="button"
style={{
padding: "12px 18px",
borderRadius: 12,
border: "none",
background: "linear-gradient(180deg,#a855f7,#6d28d9)",
color: "#fff",
fontWeight: 800,
cursor: "pointer",
boxShadow: "0 0 16px rgba(168,85,247,0.35)",
}}
>
Keep Playing
</button>

<button
onClick={() => {
window.location.href = `/u/${matchProfile.id}`;
}}
type="button"
style={{
padding: "12px 18px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.08)",
color: "#fff",
fontWeight: 800,
cursor: "pointer",
}}
>
View Profile
</button>

<button
onClick={async () => {
const { data } = await supabase.auth.getUser();
const me = data.user?.id;

const { data: sessionData } = await supabase.auth.getSession();
const token = sessionData.session?.access_token;

if (!token || !me || !matchProfile?.id) return;

const res = await fetch("/api/conversations/get-or-create", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${token}`,
},
body: JSON.stringify({
to: matchProfile.id,
}),
});

const json = await res.json().catch(() => ({}));

if (!res.ok || !json?.conversation_id) {
console.error("GET OR CREATE ERROR:", json);
return;
}

const conversationId = json.conversation_id;

window.location.href = `/messages/${conversationId}?firstMessage=${encodeURIComponent(
"Looks like we matched 😈"
)}`;
}}
type="button"
style={{
padding: "12px 18px",
borderRadius: 12,
border: "none",
background: "linear-gradient(180deg,#ec4899,#9d174d)",
color: "#fff",
fontWeight: 800,
cursor: "pointer",
boxShadow: "0 0 16px rgba(236,72,153,0.35)",
}}
>
Send Message 💬
</button>
</div>
</div>
</div>
)}
</>
);
}

const cardStyle: React.CSSProperties = {
padding: "20px",
borderRadius: "18px",
border: "1px solid rgba(168,85,247,0.3)",
background: "rgba(168,85,247,0.1)",
color: "#fff",
fontWeight: 800,
fontSize: "18px",
cursor: "pointer",
textAlign: "left",
textDecoration: "none",
boxShadow: "0 0 18px rgba(168,85,247,0.18)",
display: "block",
};