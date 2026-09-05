"use client";

import { use } from "react";
import { BookingDetail } from "@/components/shop/account/BookingDetail";

/**
 * `/shop/account/bookings/:bookingId` — the web's booking screen.
 *
 * The screen itself lives in `components/shop/account/BookingDetail.tsx`
 * because the app renders it too, from `/shop/account/booking?id=` — a static
 * export has no server to resolve a path segment against, so the app addresses
 * it by query. All this route does is unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return <BookingDetail bookingId={bookingId} />;
}
