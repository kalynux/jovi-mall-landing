"use client";

import { use } from "react";
import { BookingBalance } from "@/components/shop/account/BookingBalance";

/**
 * `/shop/account/bookings/:bookingId/balance` — the web's booking balance screen.
 *
 * The screen itself lives in `components/shop/account/BookingBalance.tsx`
 * because the app renders it too, from `/shop/account/booking/balance?id=` — a
 * static export has no server to resolve a path segment against, so the app
 * addresses it by query. All this route does is unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return <BookingBalance bookingId={bookingId} />;
}
