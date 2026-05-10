"use client";

import { createClient } from "@supabase/supabase-js";

type Props = {
commentId: number;
commentBody: string;
commentUserId: string;
myUserId: string | null;
onReported?: (message: string) => void;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function ReportCommentButton({
commentId,
commentBody,
commentUserId,
myUserId,
onReported,
}: Props) {
async function reportComment() {
const supabase = getSupabase();

if (!myUserId) {
onReported?.("You need to be signed in to report comments.");
return;
}

if (commentUserId === myUserId) {
onReported?.("You can’t report your own comment.");
return;
}

const details = window.prompt("What should moderators know about this comment?");
if (details === null) return;

const { error } = await supabase.from("reports").insert({
reporter_id: myUserId,
reported_user_id: commentUserId,
entity_type: "comment",
entity_id: String(commentId),
reason: "Comment report",
details: details.trim() || commentBody,
status: "open",
});

if (error) {
onReported?.(error.message);
return;
}

onReported?.("Comment reported. Thank you for helping keep Unbound safe.");
}

if (!myUserId || myUserId === commentUserId) return null;

return (
<button
type="button"
onClick={reportComment}
style={{
marginTop: 8,
padding: "4px 9px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontSize: 11,
fontWeight: 800,
}}
>
Report
</button>
);
}