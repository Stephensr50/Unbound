"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type ReportRow = {
id: number;
reporter_id: string | null;
reported_user_id: string | null;
reason?: string | null;
details?: string | null;
context?: string | null;
status?: string | null;
entity_type?: string | null;
entity_id?: string | null;
created_at?: string | null;
};

type ModAction = "warn" | "suspend_24h" | "suspend_7d" | "ban";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function AdminReportsPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [reports, setReports] = useState<ReportRow[]>([]);
const [loading, setLoading] = useState(true);
const [banner, setBanner] = useState<string | null>(null);
const [isAdmin, setIsAdmin] = useState(false);
const [checkingAdmin, setCheckingAdmin] = useState(true);
const [adminUserId, setAdminUserId] = useState<string | null>(null);
const [actionBusyId, setActionBusyId] = useState<number | null>(null);

async function checkAdminAccess() {
setCheckingAdmin(true);

const { data: sessionData } = await supabase.auth.getSession();
const uid = sessionData.session?.user?.id ?? null;

if (!uid) {
router.replace("/feed");
return false;
}

const { data: profile, error } = await supabase
.from("profiles")
.select("is_admin")
.eq("id", uid)
.maybeSingle();

if (error || !profile?.is_admin) {
router.replace("/feed");
return false;
}

setAdminUserId(uid);
setIsAdmin(true);
setCheckingAdmin(false);
return true;
}

async function loadReports() {
setLoading(true);
setBanner(null);

const { data, error } = await supabase
.from("reports")
.select("*")
.order("created_at", { ascending: false })
.limit(100);

if (error) {
setBanner(error.message);
setReports([]);
setLoading(false);
return;
}

setReports((data ?? []) as ReportRow[]);
setLoading(false);
}

async function updateStatus(
reportId: number,
status: "resolved" | "dismissed"
) {
const { error } = await supabase
.from("reports")
.update({ status })
.eq("id", reportId);

if (error) {
alert(error.message);
return;
}

await loadReports();
}

async function takeModerationAction(report: ReportRow, action: ModAction) {
if (!adminUserId) {
setBanner("Admin session missing.");
return;
}

if (!report.reported_user_id) {
setBanner("This report has no reported user.");
return;
}

const reason = window.prompt("Moderator note / reason:");
if (reason === null) return;

setActionBusyId(report.id);
setBanner(null);

const now = new Date();
let profileUpdate: Record<string, any> = {};
let expiresAt: string | null = null;

if (action === "warn") {
profileUpdate = {
moderation_status: "active",
moderation_note: reason.trim() || "Warning issued.",
};
}

if (action === "suspend_24h") {
const d = new Date(now.getTime() + 24 * 60 * 60 * 1000);
expiresAt = d.toISOString();
profileUpdate = {
moderation_status: "suspended",
suspended_until: expiresAt,
moderation_note: reason.trim() || "Suspended for 24 hours.",
};
}

if (action === "suspend_7d") {
const d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
expiresAt = d.toISOString();
profileUpdate = {
moderation_status: "suspended",
suspended_until: expiresAt,
moderation_note: reason.trim() || "Suspended for 7 days.",
};
}

if (action === "ban") {
profileUpdate = {
moderation_status: "banned",
banned_at: now.toISOString(),
moderation_note: reason.trim() || "User banned.",
};
}

const { error: profileErr } = await supabase
.from("profiles")
.update(profileUpdate)
.eq("id", report.reported_user_id);

if (profileErr) {
setBanner(profileErr.message);
setActionBusyId(null);
return;
}

const { error: actionErr } = await supabase
.from("moderation_actions")
.insert({
user_id: report.reported_user_id,
moderator_id: adminUserId,
action,
reason: reason.trim() || null,
expires_at: expiresAt,
});

if (actionErr) {
setBanner(actionErr.message);
setActionBusyId(null);
return;
}

const notificationTitle =
action === "warn"
? "Moderation warning"
: action === "suspend_24h"
? "Account suspended for 24 hours"
: action === "suspend_7d"
? "Account suspended for 7 days"
: "Account banned";

const notificationBody =
reason.trim() ||
(action === "warn"
? "A moderator has issued a warning on your account."
: action === "suspend_24h"
? "Your account has been suspended for 24 hours."
: action === "suspend_7d"
? "Your account has been suspended for 7 days."
: "Your account has been banned.");

const { error: notificationErr } = await supabase.from("notifications").insert({
user_id: report.reported_user_id,
actor_id: adminUserId,
type: "moderation",
entity_table: "moderation_actions",
title: notificationTitle,
body: notificationBody,
message: notificationBody,
href: "/notifications",
});

if (notificationErr) {
setBanner(`Moderation saved, but notification failed: ${notificationErr.message}`);
setActionBusyId(null);
return;
}

await supabase
.from("reports")
.update({ status: "resolved" })
.eq("id", report.id);

setBanner("Moderation action applied.");
setActionBusyId(null);
await loadReports();
}

useEffect(() => {
void (async () => {
const ok = await checkAdminAccess();
if (ok) await loadReports();
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

if (checkingAdmin) {
return (
<div
style={{
width: "min(920px, 94vw)",
margin: "30px auto",
color: "white",
}}
>
Checking admin access…
</div>
);
}

if (!isAdmin) return null;

return (
<div
style={{
width: "min(1100px, 94vw)",
margin: "30px auto",
color: "white",
}}
>
<button
onClick={() => router.back()}
style={{
marginBottom: 18,
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.45)",
color: "white",
cursor: "pointer",
fontWeight: 800,
}}
>
← Back
</button>

<h1
style={{
fontSize: 42,
margin: "0 0 8px",
color: "rgba(236,72,153,0.95)",
textShadow: "0 0 18px rgba(168,85,247,0.55)",
fontFamily: '"Gloock", serif',
}}
>
Reports
</h1>

<div style={{ opacity: 0.75, marginBottom: 18 }}>
Moderation queue for user and content reports.
</div>

{banner ? (
<div
style={{
marginBottom: 14,
padding: 12,
borderRadius: 14,
background: "rgba(120,0,0,0.35)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
}}
>
{banner}
</div>
) : null}

<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(168,85,247,0.28)",
borderRadius: 20,
padding: 16,
boxShadow: "0 0 24px rgba(168,85,247,0.18)",
}}
>
{loading ? (
<div style={{ opacity: 0.75 }}>Loading reports…</div>
) : reports.length === 0 ? (
<div style={{ opacity: 0.75 }}>No reports yet.</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{reports.map((r) => (
<div
key={r.id}
style={{
padding: 14,
borderRadius: 16,
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(255,255,255,0.08)",
}}
>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 12,
flexWrap: "wrap",
marginBottom: 8,
}}
>
<div style={{ fontWeight: 900 }}>
Report #{r.id}
{r.entity_type ? ` · ${r.entity_type}` : ""}
{r.entity_id ? ` · ${r.entity_id}` : ""}
</div>

<div style={{ fontSize: 12, opacity: 0.75 }}>
{r.created_at
? new Date(r.created_at).toLocaleString()
: "No date"}
</div>
</div>

<div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>
Reporter: {r.reporter_id ?? "Unknown"}
{r.reporter_id ? (
<button
type="button"
onClick={() => router.push(`/u/${r.reporter_id}`)}
style={{
marginLeft: 10,
padding: "4px 9px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 800,
fontSize: 11,
}}
>
View Reporter
</button>
) : null}
</div>

<div style={{ fontSize: 13, opacity: 0.75, marginBottom: 10 }}>
Reported user: {r.reported_user_id ?? "Unknown"}
{r.reported_user_id ? (
<button
type="button"
onClick={() => router.push(`/u/${r.reported_user_id}`)}
style={{
marginLeft: 10,
padding: "4px 9px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.35)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 800,
fontSize: 11,
}}
>
View Reported
</button>
) : null}
</div>

<div style={{ marginBottom: 8 }}>
<strong>Reason:</strong> {r.reason ?? "No reason"}
</div>

<div style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>
<strong>Details:</strong>{" "}
{r.details ?? r.context ?? "No details provided."}
</div>

<div
style={{
display: "inline-flex",
padding: "5px 10px",
borderRadius: 999,
background: "rgba(168,85,247,0.16)",
border: "1px solid rgba(168,85,247,0.30)",
fontSize: 12,
fontWeight: 900,
}}
>
Status: {r.status ?? "open"}
</div>

<div
style={{
display: "flex",
gap: 10,
marginTop: 14,
flexWrap: "wrap",
}}
>
<button
type="button"
onClick={() => updateStatus(r.id, "resolved")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "none",
cursor: "pointer",
fontWeight: 800,
background:
"linear-gradient(90deg, rgba(34,197,94,0.95), rgba(16,185,129,0.95))",
color: "white",
}}
>
Resolve
</button>

<button
type="button"
onClick={() => updateStatus(r.id, "dismissed")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "none",
cursor: "pointer",
fontWeight: 800,
background:
"linear-gradient(90deg, rgba(239,68,68,0.95), rgba(190,24,93,0.95))",
color: "white",
}}
>
Dismiss
</button>

<button
type="button"
disabled={actionBusyId === r.id}
onClick={() => takeModerationAction(r, "warn")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(250,204,21,0.45)",
cursor: actionBusyId === r.id ? "not-allowed" : "pointer",
fontWeight: 800,
background: "rgba(250,204,21,0.14)",
color: "rgba(254,249,195,0.95)",
}}
>
Warn
</button>

<button
type="button"
disabled={actionBusyId === r.id}
onClick={() => takeModerationAction(r, "suspend_24h")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(251,146,60,0.45)",
cursor: actionBusyId === r.id ? "not-allowed" : "pointer",
fontWeight: 800,
background: "rgba(251,146,60,0.14)",
color: "rgba(255,237,213,0.95)",
}}
>
Suspend 24h
</button>

<button
type="button"
disabled={actionBusyId === r.id}
onClick={() => takeModerationAction(r, "suspend_7d")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(249,115,22,0.55)",
cursor: actionBusyId === r.id ? "not-allowed" : "pointer",
fontWeight: 800,
background: "rgba(249,115,22,0.18)",
color: "rgba(255,237,213,0.95)",
}}
>
Suspend 7d
</button>

<button
type="button"
disabled={actionBusyId === r.id}
onClick={() => takeModerationAction(r, "ban")}
style={{
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(239,68,68,0.55)",
cursor: actionBusyId === r.id ? "not-allowed" : "pointer",
fontWeight: 900,
background:
"linear-gradient(90deg, rgba(127,29,29,0.95), rgba(190,24,93,0.95))",
color: "white",
}}
>
Ban
</button>
</div>
</div>
))}
</div>
)}
</div>
</div>
);
}