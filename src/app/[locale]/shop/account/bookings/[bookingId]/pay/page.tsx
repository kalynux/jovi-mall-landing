"use client";

import { use } from "react";
import { BookingPay } from "@/components/shop/account/BookingPay";

/**
 * `/shop/account/bookings/:bookingId/pay` — the web's booking payment screen.
 *
 * The screen itself lives in `components/shop/account/BookingPay.tsx` because
 * the app renders it too, from `/shop/account/booking/pay?id=` — a static
 * export has no server to resolve a path segment against, so the app addresses
 * it by query. All this route does is unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  return <BookingPay bookingId={bookingId} />;
}
