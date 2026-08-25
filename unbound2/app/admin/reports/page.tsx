"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ReportRow = {
id: number;
reporter_id: string;
reported_user_id: string | null;
entity_table: string;
entity_id: string;
reason: string;
details: string | null;
status: string;
created_at: string;

reporter?: {
username: string | null;
display_name: string | null;
} | null;

reported?: {
username: string | null;
display_name: string | null;
moderation_status: string | null;
} | null;
};

export default function AdminReportsPage() {
const supabase = useMemo(() => getSupabase(), []);

const [loading, setLoading] = useState(true);
const [authorized, setAuthorized] = useState(false);
const [reports, setReports] = useState<ReportRow[]>([]);

async function loadReports() {
setLoading(true);

const {
data: { session },
} = await supabase.auth.getSession();

if (!session) {
setAuthorized(false);
setLoading(false);
return;
}

const { data: me } = await supabase
.from("profiles")
.select("role")
.eq("id", session.user.id)
.single();

if (!me || me.role !== "admin") {
setAuthorized(false);
setLoading(false);
return;
}

setAuthorized(true);

const { data } = await supabase
.from("reports")
.select("*")
.order("created_at", { ascending: false });

const rows = (data || []) as ReportRow[];

const userIds = Array.from(
new Set(
rows.flatMap((r) => [
r.reporter_id,
r.reported_user_id || "",
])
)
).filter(Boolean);

const { data: profiles } = await supabase
.from("profiles")
.select("id, username, display_name, moderation_status")
.in("id", userIds);

const profileMap = new Map(
(profiles || []).map((p: any) => [p.id, p])
);

const hydrated = rows.map((r) => ({
...r,
reporter: profileMap.get(r.reporter_id) || null,
reported: r.reported_user_id
? profileMap.get(r.reported_user_id) || null
: null,
}));

setReports(hydrated);
setLoading(false);
}

async function updateStatus(
reportId: number,
status: string
) {
await supabase
.from("reports")
.update({
status,
reviewed_at: new Date().toISOString(),
})
.eq("id", reportId);

loadReports();
}

async function warnUser(reportId: number) {
const confirmed = confirm(
"Send an official warning to this user? Their account will remain active and this report will be recorded as warned."
);

if (!confirmed) return;

const {
data: { session },
} = await supabase.auth.getSession();

if (!session) {
alert("Your admin session has expired. Please log in again.");
return;
}

const response = await fetch("/api/moderation/warn", {
method: "POST",
headers: {
"Content-Type": "application/json",
Authorization: `Bearer ${session.access_token}`,
},
body: JSON.stringify({
reportId,
}),
});

const result = await response.json();

if (!response.ok) {
console.error("Warning failed:", result);

alert(
`The warning could not be sent: ${
result.error || "Unknown error"
}`
);

return;
}

alert("Official warning sent.");

await loadReports();
}

async function banUser(userId: string) {
if (!confirm("Ban this user?")) return;

await supabase
.from("profiles")
.update({
moderation_status: "banned",
moderated_at: new Date().toISOString(),
})
.eq("id", userId);

loadReports();
}

async function activateUser(userId: string) {
if (!confirm("Reactivate this user?")) return;

await supabase
.from("profiles")
.update({
moderation_status: "active",
moderated_at: new Date().toISOString(),
})
.eq("id", userId);

loadReports();
}

useEffect(() => {
loadReports();
}, []);

if (loading) {
return (
<div style={{ padding: 24, color: "white" }}>
Loading moderation dashboard...
</div>
);
}

if (!authorized) {
return (
<div style={{ padding: 24, color: "white" }}>
Not authorized.
</div>
);
}

return (
<div
style={{
padding: 24,
color: "white",
maxWidth: 1200,
margin: "0 auto",
}}
>
<h1
style={{
fontSize: 34,
marginBottom: 24,
}}
>
Moderation Reports
</h1>

<div
style={{
display: "grid",
gap: 16,
}}
>
{reports.map((report) => (
<div
key={report.id}
style={{
background: "rgba(255,255,255,0.05)",
border:
"1px solid rgba(255,255,255,0.12)",
borderRadius: 18,
padding: 18,
backdropFilter: "blur(12px)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
flexWrap: "wrap",
}}
>
<div>
<div
style={{
fontSize: 18,
fontWeight: 700,
marginBottom: 8,
}}
>
Report #{report.id}
</div>

<div style={{ opacity: 0.8 }}>
Reporter:{" "}
{report.reporter?.display_name ||
report.reporter?.username ||
"Unknown"}
</div>

<div style={{ opacity: 0.8 }}>
Reported User:{" "}
{report.reported?.display_name ||
report.reported?.username ||
"Unknown"}
</div>

<div style={{ opacity: 0.8 }}>
Type: {report.entity_table}
</div>

<div style={{ opacity: 0.8 }}>
Reason: {report.reason}
</div>

<div style={{ opacity: 0.8 }}>
Status: {report.status}
</div>

<div style={{ opacity: 0.8 }}>
User Status:{" "}
{report.reported?.moderation_status ||
"unknown"}
</div>

{report.details && (
<div
style={{
marginTop: 12,
padding: 12,
borderRadius: 12,
background: "rgba(0,0,0,0.3)",
}}
>
{report.details}
</div>
)}
</div>

<div
style={{
display: "flex",
flexDirection: "column",
gap: 10,
minWidth: 180,
}}
>
<button
onClick={() =>
updateStatus(
report.id,
"reviewed"
)
}
style={buttonStyle}
>
Mark Reviewed
</button>

<button
onClick={() =>
updateStatus(
report.id,
"dismissed"
)
}
style={buttonStyle}
>
Dismiss
</button>

{report.reported_user_id && (
<>
{report.status === "warned" ? (
<div
style={{
...buttonStyle,
background: "rgba(245,158,11,0.18)",
border: "1px solid rgba(245,158,11,0.55)",
textAlign: "center",
cursor: "default",
color: "#fbbf24",
}}
>
✓ User Warned
</div>
) : (
<button
onClick={() => warnUser(report.id)}
style={{
...buttonStyle,
background:
"linear-gradient(135deg,#f59e0b,#f97316)",
}}
>
Warn User
</button>
)}

{report.reported
?.moderation_status !==
"banned" && (
<button
onClick={() =>
banUser(
report.reported_user_id!
)
}
style={{
...buttonStyle,
background:
"linear-gradient(135deg,#ff3366,#ff0044)",
}}
>
Ban User
</button>
)}

{report.reported
?.moderation_status ===
"banned" && (
<button
onClick={() =>
activateUser(
report.reported_user_id!
)
}
style={{
...buttonStyle,
background:
"linear-gradient(135deg,#00aa66,#00cc88)",
}}
>
Reactivate
</button>
)}

<Link
href={`/u/${report.reported_user_id}`}
style={{
...buttonStyle,
textDecoration: "none",
textAlign: "center",
}}
>
Open Profile
</Link>
</>
)}
</div>
</div>
</div>
))}

{reports.length === 0 && (
<div style={{ opacity: 0.7 }}>
No reports yet.
</div>
)}
</div>
</div>
);
}

const buttonStyle = {
border: "none",
borderRadius: 12,
padding: "12px 14px",
cursor: "pointer",
color: "white",
fontWeight: 700,
background:
"linear-gradient(135deg,#7c3aed,#a855f7)",
};