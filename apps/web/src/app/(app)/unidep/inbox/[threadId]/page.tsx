import InboxWorkspace from "@/components/unidep/InboxWorkspace";

export default async function InboxThreadPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;

  return <InboxWorkspace initialThreadId={threadId} />;
}
