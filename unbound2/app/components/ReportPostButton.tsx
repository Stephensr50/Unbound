
"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Props = {
postId: number;
reportedUserId: string;
myUserId: string | null;
onReported?: (message: string) => void;
style?: React.CSSProperties;
};

function getSupabase() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
}

export default function ReportPostButton({
postId,
reportedUserId,
myUserId,
onReported,
style,
}: Props) {
const [open, setOpen] = useState(false);
const [details, setDetails] = useState("");
const [busy, setBusy] = useState(false);

async function submitReport() {
if (!myUserId) {
onReported?.("You need to be signed in to report posts.");
return;
}

if (myUserId === reportedUserId) {
onReported?.("You can’t report your own post.");
return;
}

setBusy(true);

const supabase = getSupabase();

const { error } = await supabase.from("reports").insert({
reporter_id: myUserId,
reported_user_id: reportedUserId,
entity_type: "post",
entity_id: String(postId),
reason: "Post report",
details: details.trim() || null,
status: "open",
});

setBusy(false);

if (error) {
onReported?.(error.message);
return;
}

setDetails("");
setOpen(false);
onReported?.("Post reported. Thank you for helping keep Unbound safe.");
}

if (!myUserId || myUserId === reportedUserId) return null;

return (
<>
<button
type="button"
onClick={() => setOpen(true)}
style={style}
>
Report Post
</button>

{open ? (
<div
style={{
position: "fixed",
inset: 0,
zIndex: 99999,
background: "rgba(0,0,0,0.72)",
backdropFilter: "blur(10px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
padding: 16,
}}
>
<div
style={{
width: "min(520px, 94vw)",
borderRadius: 22,
padding: 18,
background:
"linear-gradient(180deg, rgba(20,0,28,0.96), rgba(0,0,0,0.94))",
border: "1px solid rgba(240, 10, 10, 0.55)",
boxShadow:
"0 0 28px rgba(236, 154, 72, 0.28), 0 0 60px rgba(168,85,247,0.22)",
color: "white",
}}
>
<h2 style={{ margin: "0 0 8px", color: "rgba(240, 7, 7, 0.95)" }}>
Report Post
</h2>

<div style={{ opacity: 0.8, marginBottom: 12 }}>
What should moderators know about this post?
</div>

<textarea
value={details}
onChange={(e) => setDetails(e.target.value)}
placeholder="Add details..."
rows={5}
style={{
width: "100%",
resize: "none",
borderRadius: 14,
padding: 12,
background: "rgba(0,0,0,0.55)",
color: "white",
border: "1px solid rgba(246, 8, 8, 0.45)",
outline: "none",
}}
/>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
marginTop: 14,
}}
>
<button
type="button"
onClick={() => setOpen(false)}
style={{
padding: "9px 14px",
borderRadius: 999,
background: "rgba(0,0,0,0.35)",
color: "white",
border: "1px solid rgba(168,85,247,0.35)",
cursor: "pointer",
fontWeight: 800,
}}
>
Cancel
</button>

<button
type="button"
onClick={submitReport}
disabled={busy}
style={{
padding: "9px 16px",
borderRadius: 999,
border: "none",
color: "white",
cursor: busy ? "not-allowed" : "pointer",
fontWeight: 900,
background: "linear-gradient(90deg,#ec4899,#a855f7)",
opacity: busy ? 0.65 : 1,
}}
>
{busy ? "Submitting..." : "Submit Report"}
</button>
</div>
</div>
</div>
) : null}
</>
);
}