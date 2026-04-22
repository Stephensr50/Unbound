"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type SessionRow = {
id: number;
user_a: string;
user_b: string;
type: "truth" | "dare" | "choice";
status: string;
created_at?: string;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type MoveRow = {
id: number;
session_id: number;
sender_id: string;
type: "choice" | "prompt" | "answer" | "system";
body: string;
created_at: string;
};

function displayName(p?: ProfileRow | null) {
return p?.display_name || p?.username || "Unknown";
}

function timeAgo(ts: string) {
const now = Date.now();
const then = new Date(ts).getTime();
const diff = Math.max(1, Math.floor((now - then) / 1000));

if (diff < 15) return "just now";
if (diff < 60) return `${diff}s`;
if (diff < 3600) return `${Math.floor(diff / 60)}m`;
if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
return `${Math.floor(diff / 86400)}d`;
}

export default function TruthOrDareSessionPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();
const params = useParams();

const sessionId = Number(
typeof params?.id === "string"
? params.id
: Array.isArray(params?.id)
? params.id[0]
: ""
);

const [me, setMe] = useState<string | null>(null);
const [session, setSession] = useState<SessionRow | null>(null);
const [userA, setUserA] = useState<ProfileRow | null>(null);
const [userB, setUserB] = useState<ProfileRow | null>(null);
const [moves, setMoves] = useState<MoveRow[]>([]);

const [loading, setLoading] = useState(true);
const [saving, setSaving] = useState(false);
const [draft, setDraft] = useState("");
const [error, setError] = useState<string | null>(null);
const [notice, setNotice] = useState<string | null>(null);

async function loadSession() {
if (!Number.isFinite(sessionId) || sessionId <= 0) {
setError("Bad session id.");
setLoading(false);
return;
}

setLoading(true);
setError(null);

const {
data: { session: authSession },
error: authError,
} = await supabase.auth.getSession();

if (authError) {
setError(authError.message);
setLoading(false);
return;
}

const myId = authSession?.user?.id ?? null;
setMe(myId);

if (!myId) {
setError("You need to be signed in.");
setLoading(false);
return;
}

const { data: sessionData, error: sessionError } = await supabase
.from("game_sessions")
.select("id,user_a,user_b,type,status,created_at")
.eq("id", sessionId)
.single();

if (sessionError || !sessionData) {
setError(sessionError?.message || "Session not found.");
setLoading(false);
return;
}

const s = sessionData as SessionRow;

if (myId !== s.user_a && myId !== s.user_b) {
setError("You are not part of this game.");
setLoading(false);
return;
}

setSession(s);

const { data: profileRows, error: profileError } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", [s.user_a, s.user_b]);

if (profileError) {
setError(profileError.message);
setLoading(false);
return;
}

const allProfiles = (profileRows ?? []) as ProfileRow[];
setUserA(allProfiles.find((p) => p.id === s.user_a) ?? null);
setUserB(allProfiles.find((p) => p.id === s.user_b) ?? null);

const { data: moveRows, error: moveError } = await supabase
.from("game_moves")
.select("id,session_id,sender_id,type,body,created_at")
.eq("session_id", s.id)
.order("created_at", { ascending: true });

if (moveError) {
setError(moveError.message);
setLoading(false);
return;
}

setMoves((moveRows ?? []) as MoveRow[]);
setLoading(false);
}

useEffect(() => {
loadSession();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sessionId]);

async function refreshMoves() {
if (!session) return;

const { data, error } = await supabase
.from("game_moves")
.select("id,session_id,sender_id,type,body,created_at")
.eq("session_id", session.id)
.order("created_at", { ascending: true });

if (error) {
setError(error.message);
return;
}

setMoves((data ?? []) as MoveRow[]);
}

async function insertMove(
type: "choice" | "prompt" | "answer" | "system",
body: string
) {
if (!session || !me) return false;

const { error } = await supabase.from("game_moves").insert({
session_id: session.id,
sender_id: me,
type,
body,
});

if (error) {
setError(error.message);
return false;
}

await refreshMoves();
return true;
}

async function chooseTruthOrDare(choice: "truth" | "dare") {
setSaving(true);
setError(null);
setNotice(null);

const ok = await insertMove("choice", choice);

setSaving(false);

if (ok) {
setNotice(`Choice locked in: ${choice}.`);
}
}

async function submitPrompt() {
if (!draft.trim()) return;

setSaving(true);
setError(null);
setNotice(null);

const ok = await insertMove("prompt", draft.trim());

setSaving(false);

if (ok) {
setDraft("");
setNotice("Prompt sent.");
}
}

async function submitAnswer() {
if (!draft.trim()) return;

setSaving(true);
setError(null);
setNotice(null);

const ok = await insertMove("answer", draft.trim());

if (ok && session) {
await supabase
.from("game_sessions")
.update({ status: "completed" })
.eq("id", session.id);

setSession({ ...session, status: "completed" });
setDraft("");
setNotice("Answer sent. Session completed.");
}

setSaving(false);
}

async function exitSession() {
if (!session) return;

setSaving(true);
setError(null);
setNotice(null);

const { error } = await supabase
.from("game_sessions")
.update({ status: "ended" })
.eq("id", session.id);

setSaving(false);

if (error) {
setError(error.message);
return;
}

router.push("/truth-or-dare");
}

async function blockOther() {
if (!session || !me) return;
const otherId = me === session.user_a ? session.user_b : session.user_a;

setSaving(true);
setError(null);
setNotice(null);

const { error: blockError } = await supabase.from("blocks").insert({
blocker_id: me,
blocked_id: otherId,
});

if (blockError) {
setSaving(false);
setError(blockError.message);
return;
}

await supabase
.from("game_sessions")
.update({ status: "ended" })
.eq("id", session.id);

setSaving(false);
router.push("/truth-or-dare");
}

async function reportOther() {
if (!session || !me) return;
const otherId = me === session.user_a ? session.user_b : session.user_a;

setSaving(true);
setError(null);
setNotice(null);

const { error: reportError } = await supabase.from("reports").insert({
reporter_id: me,
reported_user_id: otherId,
context: `truth_or_dare_session:${session.id}`,
});

setSaving(false);

if (reportError) {
setError(reportError.message);
return;
}

setNotice("Report submitted.");
}

const choiceMove = moves.find((m) => m.type === "choice") ?? null;
const promptMove = moves.find((m) => m.type === "prompt") ?? null;
const answerMove = moves.find((m) => m.type === "answer") ?? null;

const chosenType =
session?.type === "choice"
? (choiceMove?.body as "truth" | "dare" | undefined)
: session?.type;

const isRequester = !!session && me === session.user_a;
const isReceiver = !!session && me === session.user_b;

const canChoose = !!session && session.type === "choice" && isReceiver && !choiceMove;
const canSendPrompt =
!!session &&
!!chosenType &&
isRequester &&
!promptMove &&
session.status === "active";
const canAnswer =
!!session &&
!!chosenType &&
!!promptMove &&
isReceiver &&
!answerMove &&
session.status === "active";

const otherProfile =
session && me
? me === session.user_a
? userB
: userA
: null;

const wrapper: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "16px auto 0",
color: "white",
};

const card: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "2px solid rgba(180,120,255,0.16)",
borderRadius: 16,
padding: 16,
boxShadow:
"0 0 18px rgba(236,72,153,0.14), 0 0 32px rgba(192,38,211,0.10)",
};

const titleCard: React.CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(236,72,153,0.95)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
boxShadow:
"0 0 18px rgba(236,72,153,0.25), 0 0 40px rgba(192,38,211,0.15)",
};

const pillBtn: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 700,
};

const actionBtn: React.CSSProperties = {
padding: "12px 18px",
borderRadius: 12,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 800,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "12px 14px",
outline: "none",
width: "100%",
minHeight: 110,
resize: "vertical",
};

if (loading) {
return (
<div style={wrapper}>
<div style={titleCard}>Loading Truth or Dare session…</div>
</div>
);
}

if (!session) {
return (
<div style={wrapper}>
<div style={titleCard}>{error || "Session not found."}</div>
</div>
);
}

return (
<div style={wrapper}>
{error ? (
<div
style={{
marginBottom: 12,
padding: 10,
borderRadius: 14,
background: "rgba(120,0,0,0.35)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
fontSize: 13,
}}
>
{error}
</div>
) : null}

{notice ? (
<div
style={{
marginBottom: 12,
padding: 10,
borderRadius: 14,
background: "rgba(48,10,60,0.45)",
border: "1px solid rgba(236,72,153,0.35)",
color: "rgba(255,235,250,0.96)",
fontSize: 13,
}}
>
{notice}
</div>
) : null}

<div style={titleCard}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 14,
flexWrap: "wrap",
alignItems: "flex-start",
}}
>
<div>
<div style={{ fontSize: 26, fontWeight: 900 }}>Truth or Dare Session</div>
<div style={{ opacity: 0.86, marginTop: 8 }}>
You’re playing with{" "}
<span style={{ fontWeight: 800 }}>
{displayName(otherProfile)}
</span>
.
</div>
<div style={{ opacity: 0.7, marginTop: 8, fontSize: 13 }}>
Status: <span style={{ fontWeight: 800 }}>{session.status}</span>
</div>
</div>

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button onClick={() => router.push("/truth-or-dare")} type="button" style={pillBtn}>
Back
</button>
<button onClick={reportOther} disabled={saving} type="button" style={pillBtn}>
Report
</button>
<button onClick={blockOther} disabled={saving} type="button" style={pillBtn}>
Block
</button>
<button onClick={exitSession} disabled={saving} type="button" style={pillBtn}>
Exit
</button>
</div>
</div>
</div>

<div style={{ ...card, marginBottom: 18 }}>
<div style={{ fontSize: 18, fontWeight: 850, marginBottom: 10 }}>
Current stage
</div>

{session.status !== "active" ? (
<div style={{ opacity: 0.82 }}>
This session is no longer active.
</div>
) : canChoose ? (
<>
<div style={{ opacity: 0.9, marginBottom: 14 }}>
They let you choose. Pick Truth or Dare to continue.
</div>
<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
onClick={() => chooseTruthOrDare("truth")}
disabled={saving}
type="button"
style={actionBtn}
>
{saving ? "Working..." : "Choose Truth"}
</button>

<button
onClick={() => chooseTruthOrDare("dare")}
disabled={saving}
type="button"
style={pillBtn}
>
{saving ? "Working..." : "Choose Dare"}
</button>
</div>
</>
) : canSendPrompt ? (
<>
<div style={{ opacity: 0.9, marginBottom: 14 }}>
{chosenType === "truth"
? "Ask your truth question."
: "Send your dare."}
</div>

<textarea
value={draft}
onChange={(e) => setDraft(e.target.value)}
placeholder={
chosenType === "truth"
? "Type your truth question..."
: "Type your dare..."
}
style={inputStyle}
/>

<div style={{ marginTop: 12 }}>
<button
onClick={submitPrompt}
disabled={saving || !draft.trim()}
type="button"
style={actionBtn}
>
{saving ? "Sending..." : "Send"}
</button>
</div>
</>
) : canAnswer ? (
<>
<div style={{ opacity: 0.9, marginBottom: 10 }}>
{chosenType === "truth" ? "Truth question:" : "Dare:"}
</div>

<div
style={{
padding: 14,
borderRadius: 14,
background: "rgba(255,255,255,0.05)",
border: "1px solid rgba(255,255,255,0.10)",
marginBottom: 14,
whiteSpace: "pre-wrap",
}}
>
{promptMove?.body}
</div>

<textarea
value={draft}
onChange={(e) => setDraft(e.target.value)}
placeholder="Type your answer..."
style={inputStyle}
/>

<div style={{ marginTop: 12 }}>
<button
onClick={submitAnswer}
disabled={saving || !draft.trim()}
type="button"
style={actionBtn}
>
{saving ? "Sending..." : "Send answer"}
</button>
</div>
</>
) : (
<div style={{ opacity: 0.82 }}>
{session.type === "choice" && !choiceMove
? "Waiting for the receiver to choose Truth or Dare..."
: promptMove && !answerMove
? isRequester
? "Waiting for them to answer..."
: "Waiting for your turn..."
: answerMove
? "This round is complete."
: "Waiting for the next action..."}
</div>
)}
</div>

<div style={card}>
<div style={{ fontSize: 18, fontWeight: 850, marginBottom: 12 }}>
Session activity
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
{moves.length === 0 ? (
<div style={{ opacity: 0.72 }}>No activity yet.</div>
) : (
moves.map((move) => {
const who =
move.sender_id === userA?.id
? displayName(userA)
: move.sender_id === userB?.id
? displayName(userB)
: "Unknown";

const label =
move.type === "choice"
? `chose ${move.body}`
: move.type === "prompt"
? "sent the prompt"
: move.type === "answer"
? "answered"
: move.body;

return (
<div
key={move.id}
style={{
padding: 12,
borderRadius: 14,
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(255,255,255,0.08)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 10,
marginBottom: 6,
flexWrap: "wrap",
}}
>
<div style={{ fontWeight: 800 }}>
{move.type === "choice" ? `${who} ${label}` : `${who} ${label}`}
</div>
<div style={{ opacity: 0.6, fontSize: 12 }}>
{timeAgo(move.created_at)}
</div>
</div>

{move.type !== "choice" && move.type !== "system" ? (
<div style={{ whiteSpace: "pre-wrap", opacity: 0.92 }}>
{move.body}
</div>
) : null}
</div>
);
})
)}
</div>
</div>
</div>
);
}