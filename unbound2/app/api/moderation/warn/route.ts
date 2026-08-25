import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const authHeader = req.headers.get("authorization");

if (!authHeader?.startsWith("Bearer ")) {
return NextResponse.json(
{ error: "Unauthorized" },
{ status: 401 }
);
}

const accessToken = authHeader.slice(7);

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!,
{
auth: {
autoRefreshToken: false,
persistSession: false,
},
}
);

// Verify the access token really belongs to a logged-in user.
const {
data: { user },
error: userError,
} = await supabaseAdmin.auth.getUser(accessToken);

if (userError || !user) {
return NextResponse.json(
{ error: "Unauthorized" },
{ status: 401 }
);
}

// Verify that user is an Unbound admin.
const { data: adminProfile, error: adminError } =
await supabaseAdmin
.from("profiles")
.select("role")
.eq("id", user.id)
.single();

if (
adminError ||
!adminProfile ||
adminProfile.role !== "admin"
) {
return NextResponse.json(
{ error: "Admin access required" },
{ status: 403 }
);
}

const { reportId } = await req.json();

const numericReportId = Number(reportId);

if (
!Number.isInteger(numericReportId) ||
numericReportId <= 0
) {
return NextResponse.json(
{ error: "Invalid reportId" },
{ status: 400 }
);
}

// Get the report server-side so the browser cannot choose
// an arbitrary user to receive a fake moderator warning.
const { data: report, error: reportFetchError } =
await supabaseAdmin
.from("reports")
.select("id, reported_user_id, status")
.eq("id", numericReportId)
.single();

if (reportFetchError || !report) {
return NextResponse.json(
{ error: "Report not found" },
{ status: 404 }
);
}

if (!report.reported_user_id) {
return NextResponse.json(
{ error: "This report has no reported user" },
{ status: 400 }
);
}

const warningTitle = "⚠️ Official Unbound Warning";

const warningBody =
"Your account has received an official warning following a harassment report.\n\n" +
"Unsolicited sexual, degrading, threatening, or harassing messages without established consent may violate Unbound's Community Guidelines.\n\n" +
"Please respect other members' boundaries. Additional reports or continued behavior may result in account restrictions, suspension, or permanent removal.";

// Create the notification with service-role permissions.
const { error: notificationError } =
await supabaseAdmin
.from("notifications")
.insert({
user_id: report.reported_user_id,
actor_id: null,
type: "moderation",
entity_id: String(report.id),
title: warningTitle,
message: warningBody,
body: warningBody,
});

if (notificationError) {
console.error(
"Moderation notification insert failed:",
notificationError
);

return NextResponse.json(
{ error: notificationError.message },
{ status: 500 }
);
}

const now = new Date().toISOString();

const { error: reportUpdateError } =
await supabaseAdmin
.from("reports")
.update({
status: "warned",
reviewed_at: now,
})
.eq("id", report.id);

if (reportUpdateError) {
console.error(
"Report update failed:",
reportUpdateError
);

return NextResponse.json(
{
error:
"Warning was sent, but the report could not be updated.",
},
{ status: 500 }
);
}

const { error: profileUpdateError } =
await supabaseAdmin
.from("profiles")
.update({
moderated_at: now,
})
.eq("id", report.reported_user_id);

if (profileUpdateError) {
console.error(
"Moderation timestamp update failed:",
profileUpdateError
);
}

return NextResponse.json({
ok: true,
reportId: report.id,
warnedUserId: report.reported_user_id,
});
} catch (err) {
console.error("Moderation warning failed:", err);

return NextResponse.json(
{
error:
err instanceof Error
? err.message
: "Unknown moderation error",
},
{ status: 500 }
);
}
}