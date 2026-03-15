import { NextResponse } from "next/server";

export async function GET(req: Request) {
try {
const { searchParams } = new URL(req.url);

const city = (searchParams.get("city") ?? "").trim();
const state = (searchParams.get("state") ?? "").trim();
const country = (searchParams.get("country") ?? "").trim();

const parts = [city, state, country].filter(Boolean);
if (parts.length === 0) {
return NextResponse.json(
{ error: "Missing city/state/country" },
{ status: 400 }
);
}

const q = parts.join(", ");

const url =
"https://nominatim.openstreetmap.org/search?" +
new URLSearchParams({
q,
format: "jsonv2",
limit: "1",
}).toString();

const res = await fetch(url, {
headers: {
"Accept-Language": "en",
"User-Agent": "Unbound/1.0",
},
cache: "no-store",
});

if (!res.ok) {
return NextResponse.json(
{ error: "Geocoder request failed" },
{ status: 502 }
);
}

const data = (await res.json()) as Array<{
lat: string;
lon: string;
}>;

if (!Array.isArray(data) || data.length === 0) {
return NextResponse.json(
{ error: "Location not found" },
{ status: 404 }
);
}

return NextResponse.json({
latitude: Number(data[0].lat),
longitude: Number(data[0].lon),
});
} catch {
return NextResponse.json(
{ error: "Unexpected geocoding error" },
{ status: 500 }
);
}
}