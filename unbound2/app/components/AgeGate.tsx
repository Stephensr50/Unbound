"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

function isAtLeast18(birthdate: string) {
if (!birthdate) return false;

const today = new Date();
const dob = new Date(`${birthdate}T00:00:00`);

let age = today.getFullYear() - dob.getFullYear();
const monthDiff = today.getMonth() - dob.getMonth();

if (
monthDiff < 0 ||
(monthDiff === 0 && today.getDate() < dob.getDate())
) {
age--;
}

return age >= 18;
}

export default function AgeGate({ children }: { children: React.ReactNode }) {
const supabase = useMemo(() => getSupabase(), []);
const [loading, setLoading] = useState(true);
const [userId, setUserId] = useState<string | null>(null);
const [ageConfirmed, setAgeConfirmed] = useState<boolean>(false);
const [birthdate, setBirthdate] = useState("");
const [errorText, setErrorText] = useState("");
const [saving, setSaving] = useState(false);

useEffect(() => {
async function load() {
const { data: authData } = await supabase.auth.getUser();
const user = authData.user;

if (!user) {
setLoading(false);
return;
}

setUserId(user.id);

const { data } = await supabase
.from("profiles")
.select("age_confirmed, birthdate")
.eq("id", user.id)
.maybeSingle();

setAgeConfirmed(Boolean(data?.age_confirmed));

if (data?.birthdate) {
setBirthdate(data.birthdate);
}

setLoading(false);
}

load();
}, [supabase]);

async function confirmAge() {
if (!userId) return;

setErrorText("");

if (!birthdate) {
setErrorText("Please enter your date of birth.");
return;
}

if (!isAtLeast18(birthdate)) {
setErrorText("You must be at least 18 years old to use Unbound.");
return;
}

setSaving(true);

const { error } = await supabase
.from("profiles")
.update({
birthdate,
age_confirmed: true,
age_confirmed_at: new Date().toISOString(),
verification_status: "self_attested",
})
.eq("id", userId);

setSaving(false);

if (error) {
alert(error.message);
return;
}

setAgeConfirmed(true);
}

if (loading) {
return null;
}

if (!userId || ageConfirmed) {
return <>{children}</>;
}

return (
<div className="ageGateOverlay">
<div className="ageGateCard">
<div className="ageGateBadge">18+</div>

<h1>Adults Only</h1>

<p>
Unbound is intended for adults only. Enter your date of birth to
confirm that you are at least 18 years old.
</p>

<label htmlFor="birthdate">Date of birth</label>

<input
id="birthdate"
type="date"
value={birthdate}
onChange={(e) => {
setBirthdate(e.target.value);
setErrorText("");
}}
/>

{errorText ? <p className="ageGateError">{errorText}</p> : null}

<button onClick={confirmAge} disabled={saving}>
{saving ? "Saving..." : "Continue"}
</button>

<p className="ageGateFinePrint">
If you are under 18, do not continue.
</p>
</div>

<style jsx>{`
.ageGateOverlay {
min-height: 100vh;
width: 100%;
display: flex;
align-items: center;
justify-content: center;
padding: 24px;
background:
radial-gradient(circle at top, rgba(236, 72, 153, 0.22), transparent 38%),
radial-gradient(circle at bottom, rgba(168, 85, 247, 0.2), transparent 42%),
#020202;
color: white;
}

.ageGateCard {
width: min(440px, 100%);
padding: 30px;
border-radius: 28px;
background: rgba(10, 10, 16, 0.88);
border: 1px solid rgba(244, 114, 182, 0.35);
box-shadow:
0 0 40px rgba(236, 72, 153, 0.22),
0 0 80px rgba(168, 85, 247, 0.14);
text-align: center;
backdrop-filter: blur(18px);
}

.ageGateBadge {
margin: 0 auto 18px;
width: 72px;
height: 72px;
border-radius: 999px;
display: flex;
align-items: center;
justify-content: center;
font-size: 24px;
font-weight: 900;
color: white;
background: linear-gradient(135deg, #ec4899, #8b5cf6);
box-shadow: 0 0 28px rgba(236, 72, 153, 0.55);
}

h1 {
margin: 0 0 12px;
font-size: 32px;
}

p {
margin: 0 auto 20px;
color: rgba(255, 255, 255, 0.78);
line-height: 1.5;
}

label {
display: block;
margin-bottom: 8px;
text-align: left;
font-size: 13px;
font-weight: 800;
color: rgba(255, 255, 255, 0.76);
}

input {
width: 100%;
margin-bottom: 14px;
border-radius: 16px;
border: 1px solid rgba(244, 114, 182, 0.38);
padding: 13px 14px;
color: white;
background: rgba(255, 255, 255, 0.08);
outline: none;
}

input:focus {
border-color: rgba(244, 114, 182, 0.75);
box-shadow: 0 0 18px rgba(236, 72, 153, 0.22);
}

button {
width: 100%;
border: 0;
border-radius: 999px;
padding: 14px 18px;
cursor: pointer;
font-weight: 900;
color: white;
background: linear-gradient(135deg, #ec4899, #8b5cf6);
box-shadow: 0 0 26px rgba(236, 72, 153, 0.45);
}

button:disabled {
opacity: 0.65;
cursor: not-allowed;
}

.ageGateError {
margin: 0 0 14px;
font-size: 13px;
font-weight: 800;
color: #fb7185;
}

.ageGateFinePrint {
margin-top: 14px;
margin-bottom: 0;
font-size: 13px;
color: rgba(255, 255, 255, 0.55);
}
`}</style>
</div>
);
}