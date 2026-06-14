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

if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
age--;
}

return age >= 18;
}

export default function AgeGate({ children }: { children: React.ReactNode }) {
const supabase = useMemo(() => getSupabase(), []);
const [loading, setLoading] = useState(true);
const [userId, setUserId] = useState<string | null>(null);
const [ageConfirmed, setAgeConfirmed] = useState(false);
const [birthdate, setBirthdate] = useState("");
const [acknowledged, setAcknowledged] = useState(false);
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

if (!acknowledged) {
setErrorText("Please acknowledge that you are 18 or older before continuing.");
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



if (error) {
console.error("Age gate update error:", error);
setErrorText(error.message || "Something went wrong saving your age confirmation.");
return;
}
setSaving(false);
setAgeConfirmed(true);

}

function exitSite() {
window.location.href = "https://www.google.com";
}

if (loading) return null;
if (!userId || ageConfirmed) {
return <>{children}</>;
}

return (
<div className="ageGateOverlay">
<div className="ageGateCard">
<div className="ageGateBadge">18+</div>

<h1>This is an adult website</h1>

<p className="ageGateText">
Unbound contains age-restricted content and may include nudity,
sexual themes, kink-related discussion, and other mature material.
By entering, you confirm that you are at least 18 years old, or the
age of majority where you live, and that viewing this content is
legal in your location.
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

<label className="ageGateCheck">
<input
type="checkbox"
checked={acknowledged}
onChange={(e) => {
setAcknowledged(e.target.checked);
setErrorText("");
}}
/>
<span>
I confirm that I am 18 years of age or older and agree to enter
Unbound.
</span>
</label>

{errorText ? <p className="ageGateError">{errorText}</p> : null}

<button onClick={confirmAge} disabled={saving}>
{saving ? "Saving..." : "I am 18 or older — Enter"}
</button>

<button className="ageGateExit" onClick={exitSite}>
I am under 18 — Exit
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
width: min(480px, 100%);
padding: 30px;
border-radius: 28px;
background: rgba(10, 10, 16, 0.92);
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
background: linear-gradient(135deg, #ec4899, #8b5cf6);
box-shadow: 0 0 28px rgba(236, 72, 153, 0.55);
}

h1 {
margin: 0 0 14px;
font-size: 31px;
}

.ageGateText {
margin: 0 auto 22px;
color: rgba(255, 255, 255, 0.78);
line-height: 1.55;
}

label {
display: block;
margin-bottom: 8px;
text-align: left;
font-size: 13px;
font-weight: 800;
color: rgba(255, 255, 255, 0.76);
}

input[type="date"] {
width: 100%;
margin-bottom: 14px;
border-radius: 16px;
border: 1px solid rgba(244, 114, 182, 0.38);
padding: 13px 14px;
color: white;
background: rgba(255, 255, 255, 0.08);
outline: none;
}

.ageGateCheck {
display: flex;
align-items: flex-start;
gap: 10px;
margin: 4px 0 16px;
text-align: left;
line-height: 1.35;
}

.ageGateCheck input {
margin-top: 3px;
transform: scale(1.15);
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

.ageGateExit {
margin-top: 12px;
background: rgba(255, 255, 255, 0.09);
border: 1px solid rgba(255, 255, 255, 0.18);
box-shadow: none;
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