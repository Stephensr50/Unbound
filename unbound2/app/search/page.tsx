import SearchBox from "./SearchBox";

export const dynamic = "force-dynamic";

export default async function SearchPage({
searchParams,
}: {
searchParams: Promise<{ q?: string }>;
}) {
const sp = await searchParams;
const q = (sp.q ?? "").toString();

return <SearchBox initialValue={q} />;
}