import { redirect } from "next/navigation";

export default function Home({
searchParams,
}: {
searchParams?: Record<string, string | string[] | undefined>;
}) {
const qs = searchParams ? new URLSearchParams(
Object.entries(searchParams).flatMap(([k, v]) =>
v == null ? [] : Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v]]
)
).toString() : "";

redirect(qs ? `/feed?${qs}` : "/feed");
}