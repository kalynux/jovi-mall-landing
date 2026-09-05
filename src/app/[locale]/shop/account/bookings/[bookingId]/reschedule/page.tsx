"use client";

import { use } from "react";
import { BookingReschedule } from "@/components/shop/account/BookingReschedule";

/**
 * `/shop/account/bookings/:bookingId/reschedule` — the web's reschedule screen.
 *
 * The screen itself lives in `components/shop/account/BookingReschedule.tsx`
 * because the app renders it too, from `/shop/account/booking/reschedule?id=` —
 * a static export has no server to resolve a path segment against, so the app
 * addresses it by query. All this route does is unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return <BookingReschedule bookingId={bookingId} />;
}
