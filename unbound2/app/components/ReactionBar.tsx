"use client";

import type React from "react";

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";

const REACTIONS: Record<ReactionKey, string> = {
devil: "😈",
fire: "🔥",
eyes: "👀",
purple_heart: "💜",
};

type ReactionCounts = Partial<Record<ReactionKey, number>>;

export default function ReactionBar({
postId,
spanks,
comments,
iSpanked,
myReaction,
isBusy,
isPickerOpen,
sparkOn,
pillBtn,
reactionCounts,
onToggleSpank,
onTogglePicker,
onSetReaction,
onOpenComments,
}: {
postId: number;
spanks: number;
comments: number;
iSpanked: boolean;
myReaction?: ReactionKey;
isBusy: boolean;
isPickerOpen: boolean;
sparkOn: boolean;
pillBtn: React.CSSProperties;
reactionCounts?: ReactionCounts;
onToggleSpank: (postId: number) => void;
onTogglePicker: (postId: number) => void;
onSetReaction: (postId: number, reaction: ReactionKey) => void;
onOpenComments: (postId: number) => void;
}) {
const orderedReactions = (Object.keys(REACTIONS) as ReactionKey[]).filter(
(key) => (reactionCounts?.[key] ?? 0) > 0
);

return (
<div
style={{
display: "flex",
gap: 14,
marginTop: 12,
alignItems: "center",
flexWrap: "wrap",
position: "relative",
zIndex: isPickerOpen ? 9999 : 1,
overflow: "visible",
}}
>
<div
style={{
position: "relative",
display: "flex",
gap: 8,
overflow: "visible",
}}
>
<button
type="button"
onClick={(e) => {
e.stopPropagation();
if (!isBusy) onToggleSpank(postId);
}}
disabled={isBusy}
style={{
...pillBtn,
display: "flex",
alignItems: "center",
gap: 8,
opacity: isBusy ? 0.6 : 1,
animation: sparkOn ? "unboundPop .22s ease" : undefined,
color: iSpanked ? "#e879f9" : "white",
border: iSpanked
? "1px solid rgba(192,38,211,0.55)"
: "1px solid rgba(180,120,255,0.25)",
background: iSpanked
? "rgba(192,38,211,0.16)"
: "rgba(0,0,0,0.35)",
}}
title="Spank"
>
<span style={{ fontSize: 16, lineHeight: 1, display: "inline-flex" }}>
{iSpanked ? REACTIONS[myReaction || "devil"] : "👿"}
</span>

<span>
{iSpanked ? "Spanked" : "Spank"}
{spanks ? ` · ${spanks}` : ""}
</span>
</button>

<button
type="button"
onClick={(e) => {
e.preventDefault();
e.stopPropagation();

console.log("PICKER CLICKED", postId);

if (!isBusy) {
onTogglePicker(postId);
}
}}
disabled={isBusy}
style={{
...pillBtn,
padding: "8px 10px",
minWidth: 40,
opacity: isBusy ? 0.6 : 1,
position: "relative",
zIndex: 10000,
touchAction: "manipulation",
}}
title="Choose reaction"
>
▾
</button>

{isPickerOpen ? (
<div
onClick={(e) => e.stopPropagation()}
style={{
position: "absolute",
top: "100%",
left: 0,
marginTop: 8,
display: "flex",
gap: 8,
padding: 8,
borderRadius: 14,
background: "rgba(10,10,10,0.96)",
border: "1px solid rgba(180,120,255,0.32)",
boxShadow: "0 10px 28px rgba(0,0,0,0.45)",
zIndex: 99999,
pointerEvents: "auto",
overflow: "visible",
}}
>
{(Object.keys(REACTIONS) as ReactionKey[]).map((reaction) => (
<button
type="button"
key={reaction}
onClick={(e) => {
e.stopPropagation();
onSetReaction(postId, reaction);
}}
style={{
width: 40,
height: 40,
borderRadius: 999,
border:
myReaction === reaction
? "1px solid rgba(192,38,211,0.55)"
: "1px solid rgba(180,120,255,0.25)",
background:
myReaction === reaction
? "rgba(192,38,211,0.16)"
: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontSize: 20,
lineHeight: "20px",
touchAction: "manipulation",
}}
title={reaction}
>
{REACTIONS[reaction]}
</button>
))}
</div>
) : null}
</div>

<button
type="button"
onClick={(e) => {
e.stopPropagation();
onOpenComments(postId);
}}
style={pillBtn}
>
Comments {comments ? `· ${comments}` : ""}
</button>

{orderedReactions.length > 0 ? (
<div
style={{
display: "flex",
gap: 10,
alignItems: "center",
flexWrap: "wrap",
opacity: 0.95,
}}
>
{orderedReactions.map((reaction) => (
<div
key={reaction}
style={{
display: "inline-flex",
alignItems: "center",
gap: 6,
padding: "6px 10px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.18)",
background: "rgba(255,255,255,0.04)",
fontSize: 13,
lineHeight: 1,
}}
title={`${reaction} reactions`}
>
<span style={{ fontSize: 16 }}>{REACTIONS[reaction]}</span>
<span>{reactionCounts?.[reaction] ?? 0}</span>
</div>
))}
</div>
) : null}
</div>
);
}