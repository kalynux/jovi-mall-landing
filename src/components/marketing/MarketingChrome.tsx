"use client";
import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import RoleSelectorModal from "@/components/ui/RoleSelectorModal";

/**
 * The header half of the marketing-page frame.
 *
 * Exists only to own the role-modal state: Navbar's "Get Started" takes a
 * callback, which a server layout cannot supply. Everything else on these pages
 * stays a server component so the copy is in the served HTML.
 *
 * Off the landing page there is no SectionNavProvider, and both Navbar and
 * Footer already handle that — their in-page anchors resolve to `/#vendors`
 * instead of scroll-jumping.
 */
export default function MarketingChrome() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Navbar onGetStarted={() => setModalOpen(true)} />
      <RoleSelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
