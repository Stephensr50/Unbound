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
request_id: number | null;
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
media_url?: string | null;
media_type?: string | null;
created_at: string;
};

function displayName(p?: ProfileRow | null) {
return p?.display_name || p?.username || "Unknown";
}

function timeAgo(ts: string) {
if (typeof window === "undefined") return "";

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
const [mediaFile, setMediaFile] = useState<File | null>(null);
const [deleteOpen, setDeleteOpen] = useState(false);

const [error, setError] = useState<string | null>(null);
const [notice, setNotice] = useState<string | null>(null);
const [nextSessionId, setNextSessionId] = useState<number | null>(null);

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
.select("id,request_id,user_a,user_b,type,status,created_at")
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

const { data: newerSessions } = await supabase
.from("game_sessions")
.select("id")
.eq("status", "active")
.neq("id", s.id)
.or(
`and(user_a.eq.${s.user_a},user_b.eq.${s.user_b}),and(user_a.eq.${s.user_b},user_b.eq.${s.user_a})`
)
.order("id", { ascending: false })
.limit(1);

setNextSessionId(newerSessions?.[0]?.id ?? null);

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
.select("id,session_id,sender_id,type,body,media_url,media_type,created_at")
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
.select("id,session_id,sender_id,type,body,media_url,media_type,created_at")
.eq("session_id", session.id)
.order("created_at", { ascending: true });

if (error) {
setError(error.message);
return;
}

setMoves((data ?? []) as MoveRow[]);
}

async function uploadSelectedMedia() {
if (!mediaFile || !me || !session) return null;

const isImage = mediaFile.type.startsWith("image/");
const isVideo = mediaFile.type.startsWith("video/");

if (!isImage && !isVideo) {
setError("Please choose an image or video.");
return false;
}

const maxSize = isVideo ? 60 * 1024 * 1024 : 15 * 1024 * 1024;

if (mediaFile.size > maxSize) {
setError(isVideo ? "Video is too large. Max 60MB." : "Image is too large. Max 15MB.");
return false;
}

const ext = mediaFile.name.split(".").pop() || "upload";
const path = `truth-or-dare/${session.id}/${me}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

const { error: uploadError } = await supabase.storage
.from("media")
.upload(path, mediaFile, {
contentType: mediaFile.type,
upsert: false,
});

if (uploadError) {
setError(uploadError.message);
return false;
}

const { data } = supabase.storage.from("media").getPublicUrl(path);

return {
url: data.publicUrl,
type: mediaFile.type,
};
}

async function insertMove(
type: "choice" | "prompt" | "answer" | "system",
body: string,
media?: { url: string; type: string } | null
) {
if (!session || !me) return false;

const { error } = await supabase.from("game_moves").insert({
session_id: session.id,
sender_id: me,
type,
body,
media_url: media?.url ?? null,
media_type: media?.type ?? null,
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

if (ok) setNotice(`Choice locked in: ${choice}.`);
}

async function submitPrompt() {
if (!draft.trim() && !mediaFile) return;

setSaving(true);
setError(null);
setNotice(null);

const media = await uploadSelectedMedia();
if (media === false) {
setSaving(false);
return;
}

const ok = await insertMove("prompt", draft.trim(), media);

setSaving(false);

if (ok) {
setDraft("");
setMediaFile(null);
setNotice("Prompt sent.");
}
}

async function submitAnswer() {
if (!draft.trim() && !mediaFile) return;

setSaving(true);
setError(null);
setNotice(null);

const media = await uploadSelectedMedia();
if (media === false) {
setSaving(false);
return;
}

const ok = await insertMove("answer", draft.trim(), media);

if (ok && session) {
await supabase
.from("game_sessions")
.update({ status: "completed" })
.eq("id", session.id);

setSession({ ...session, status: "completed" });
setDraft("");
setMediaFile(null);
setNotice("Answer sent. Session completed.");
}

setSaving(false);
}

async function playAgain() {
if (!session || !me) return;

setSaving(true);
setError(null);
setNotice(null);

const otherUser = session.user_a === me ? session.user_b : session.user_a;

await supabase
.from("game_sessions")
.update({ status: "completed" })
.eq("id", session.id);

const { data: activeSessions, error: activeError } = await supabase
.from("game_sessions")
.select("id")
.eq("status", "active")
.neq("id", session.id)
.or(
`and(user_a.eq.${me},user_b.eq.${otherUser}),and(user_a.eq.${otherUser},user_b.eq.${me})`
)
.order("id", { ascending: false })
.limit(10);

if (activeError) {
setSaving(false);
setError(activeError.message);
return;
}

for (const s of activeSessions ?? []) {
const { data: existingAnswer } = await supabase
.from("game_moves")
.select("id")
.eq("session_id", s.id)
.eq("type", "answer")
.limit(1);

if (!existingAnswer?.length) {
setSaving(false);
router.push(`/truth-or-dare/${s.id}`);
return;
}
}

const { data: newSession, error } = await supabase
.from("game_sessions")
.insert({
user_a: me,
user_b: otherUser,
type: session.type,
status: "active",
})
.select("id")
.single();

setSaving(false);

if (error || !newSession) {
setError(error?.message || "Could not start a new round.");
return;
}

router.push(`/truth-or-dare/${newSession.id}`);
}

async function deleteFinishedGame() {
if (!session) return;

setSaving(true);
setError(null);
setNotice(null);

try {
if (session.request_id) {
const { error: requestError } = await supabase
.from("truth_dare_requests")
.delete()
.eq("id", session.request_id);

if (requestError) throw requestError;
}

const { error: sessionError } = await supabase
.from("game_sessions")
.delete()
.eq("id", session.id);

if (sessionError) throw sessionError;

setDeleteOpen(false);
router.push("/truth-or-dare");
} catch (err: any) {
setError(err.message || "Delete failed");
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

const canChoose =
!!session && session.type === "choice" && isReceiver && !choiceMove;

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
session && me ? (me === session.user_a ? userB : userA) : null;

const wrapper: CSSProperties = {
width: "min(920px, 94vw)",
margin: "16px auto 0",
color: "white",
};

const card: CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "2px solid rgba(180,120,255,0.16)",
borderRadius: 16,
padding: 16,
boxShadow:
"0 0 18px rgba(236,72,153,0.14), 0 0 32px rgba(192,38,211,0.10)",
};

const titleCard: CSSProperties = {
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(236,72,153,0.95)",
borderRadius: 18,
padding: 18,
marginBottom: 18,
boxShadow:
"0 0 18px rgba(236,72,153,0.25), 0 0 40px rgba(192,38,211,0.15)",
};

const pillBtn: CSSProperties = {
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 700,
};

const ghostBtn: CSSProperties = {
...pillBtn,
backdropFilter: "blur(6px)",
WebkitBackdropFilter: "blur(6px)",
};

const dangerBtn: CSSProperties = {
...ghostBtn,
border: "1px solid rgba(239,68,68,0.35)",
boxShadow: "0 0 10px rgba(239,68,68,0.18)",
};

const actionBtn: CSSProperties = {
padding: "12px 18px",
borderRadius: 12,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 800,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
};

const inputStyle: CSSProperties = {
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

const fileInputStyle: CSSProperties = {
marginTop: 12,
display: "block",
width: "100%",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: 10,
background: "rgba(0,0,0,0.35)",
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
<div style={{ fontSize: 26, fontWeight: 900 }}>
Truth or Dare Session
</div>

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

{canChoose ? (
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
{chosenType === "truth" ? "Ask your truth question." : "Send your dare."}
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

<label style={pillBtn}>
📎 Attach photo/video

</label>

{mediaFile ? (
<div style={{ opacity: 0.75, fontSize: 13, marginTop: 8 }}>
Attached: {mediaFile.name}
</div>
) : null}

<div style={{ marginTop: 12 }}>
<button
onClick={submitPrompt}
disabled={saving || (!draft.trim() && !mediaFile)}
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

<label style={pillBtn}>
📎 Attach photo/video

</label>

{mediaFile ? (
<div style={{ opacity: 0.75, fontSize: 13, marginTop: 8 }}>
Attached: {mediaFile.name}
</div>
) : null}

<div style={{ marginTop: 12 }}>
<button
onClick={submitAnswer}
disabled={saving || (!draft.trim() && !mediaFile)}
type="button"
style={actionBtn}
>
{saving ? "Sending..." : "Send answer"}
</button>
</div>
</>
) : (
<div style={{ opacity: 0.82 }}>
<div>
{answerMove
? "This round is complete."
: session.status !== "active"
? "This session is no longer active."
: session.type === "choice" && !choiceMove
? "Waiting for the receiver to choose Truth or Dare..."
: promptMove && !answerMove
? isRequester
? "Waiting for them to answer..."
: "Waiting for your turn..."
: "Waiting for the next action..."}
</div>

{answerMove ? (
<div style={{ marginTop: 16 }}>
{nextSessionId ? (
<div
style={{
marginBottom: 14,
padding: 14,
borderRadius: 14,
background: "rgba(124,58,237,0.18)",
border: "1px solid rgba(168,85,247,0.45)",
boxShadow: "0 0 18px rgba(168,85,247,0.25)",
}}
>
<div style={{ fontWeight: 800, marginBottom: 6 }}>
{displayName(otherProfile)} wants to play again 🔥
</div>

<div style={{ opacity: 0.85, fontSize: 14, marginBottom: 10 }}>
A new round has already started.
</div>

<button
onClick={() => router.push(`/truth-or-dare/${nextSessionId}`)}
disabled={saving}
type="button"
style={actionBtn}
>
Jump into the new round →
</button>
</div>
) : null}

<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
<button
onClick={playAgain}
disabled={saving}
type="button"
style={{
...ghostBtn,
boxShadow: "0 0 10px rgba(168,85,247,0.25)",
}}
>
{saving ? "Starting..." : "Play Again 🔁"}
</button>

<button
onClick={() => setDeleteOpen(true)}
disabled={saving}
type="button"
style={dangerBtn}
>
Delete Game
</button>
</div>
</div>
) : null}
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

const isImage =
move.media_type?.startsWith("image/") ||
(!!move.media_url && move.media_type === "image");

const isVideo =
move.media_type?.startsWith("video/") ||
(!!move.media_url && move.media_type === "video");

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
{who} {label}
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

{move.media_url && isImage ? (
<img
src={move.media_url}
alt=""
style={{
marginTop: 10,
width: "100%",
maxHeight: 420,
objectFit: "cover",
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.12)",
}}
/>
) : null}

{move.media_url && isVideo ? (
<video
src={move.media_url}
controls
style={{
marginTop: 10,
width: "100%",
maxHeight: 420,
borderRadius: 14,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.45)",
}}
/>
) : null}
</div>
);
})
)}
</div>
</div>

{deleteOpen ? (
<div
style={{
position: "fixed",
inset: 0,
zIndex: 9999,
background: "rgba(0,0,0,0.72)",
backdropFilter: "blur(8px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 18,
}}
>
<div
style={{
width: "min(440px, 94vw)",
borderRadius: 22,
padding: 20,
background:
"linear-gradient(180deg, rgba(20,0,28,0.96), rgba(0,0,0,0.94))",
border: "1px solid rgba(236,72,153,0.55)",
boxShadow:
"0 0 25px rgba(236,72,153,0.26), 0 0 55px rgba(168,85,247,0.18)",
color: "white",
}}
>
<div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>
Delete finished game?
</div>

<div style={{ opacity: 0.82, lineHeight: 1.4, marginBottom: 18 }}>
This will remove this finished Truth or Dare session from your list.
</div>

<div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
<button
onClick={() => setDeleteOpen(false)}
disabled={saving}
type="button"
style={pillBtn}
>
Cancel
</button>

<button
onClick={deleteFinishedGame}
disabled={saving}
type="button"
style={dangerBtn}
>
{saving ? "Deleting..." : "Delete Game"}
</button>
</div>
</div>
</div>
) : null}
</div>
);
}