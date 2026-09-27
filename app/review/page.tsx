import { redirect } from "next/navigation";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  redirect(id ? `/unanswered?id=${encodeURIComponent(id)}` : "/unanswered");
}
