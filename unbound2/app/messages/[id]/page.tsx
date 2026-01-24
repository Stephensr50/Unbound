import MessagesThread from "../MessagesThread";

export default async function MessageThreadPage({
params,
}: {
params: Promise<{ id: string }>;
}) {
const { id } = await params;
return <MessagesThread threadId={id} />;
}