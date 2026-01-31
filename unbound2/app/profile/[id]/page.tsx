import { redirect } from "next/navigation";

export default function ProfileRedirect({
params,
}: {
params: { id: string };
}) {
redirect(`/u/${params.id}`);
}