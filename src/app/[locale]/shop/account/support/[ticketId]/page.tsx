"use client";

import { use } from "react";
import { TicketDetail } from "@/components/shop/account/TicketDetail";

/**
 * `/shop/account/support/:ticketId` — the web's support thread.
 *
 * The screen itself lives in `components/shop/account/TicketDetail.tsx` because
 * the app renders it too, from `/shop/account/ticket?id=` — a static export has
 * no server to resolve a path segment against, so the app addresses it by
 * query. All this route does is unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = use(params);
  return <TicketDetail ticketId={ticketId} />;
}
