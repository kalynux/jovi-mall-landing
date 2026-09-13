"use client";
import { useState } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroSection from "@/components/sections/HeroSection";
import HowItWorksSection from "@/components/sections/HowItWorksSection";
import VendorSection from "@/components/sections/VendorSection";
import AgencySection from "@/components/sections/AgencySection";
import AgentSection from "@/components/sections/AgentSection";
import CustomerSection from "@/components/sections/CustomerSection";
import AfricaFirstSection from "@/components/sections/AfricaFirstSection";
import TrustSection from "@/components/sections/TrustSection";
import FinalCTASection from "@/components/sections/FinalCTASection";
import RoleSelectorModal from "@/components/ui/RoleSelectorModal";
import SectionProgressIndicator from "@/components/ui/SectionProgressIndicator";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { SectionNavProvider } from "@/components/scroll/SectionNavProvider";
import { SECTION_IDS } from "@/lib/constants";

/**
 * The landing page body. Split out of app/page.tsx so that route can stay a
 * server component: it owns the page metadata (canonical) and the JSON-LD,
 * neither of which a "use client" module can export.
 */
export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <SectionNavProvider sections={SECTION_IDS}>
      {/* Ambient background (fixed, behind everything). Which layers actually
          mount depends on what the device can afford — see AmbientBackground. */}
      <AmbientBackground />

      {/* Sticky Navbar */}
      <Navbar onGetStarted={() => setModalOpen(true)} />

      {/* Section progress rail (desktop + mobile) */}
      <SectionProgressIndicator />

      {/* Role selector modal */}
      <RoleSelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Page sections — each fills one viewport */}
      <main id="main-content">
        <HeroSection onGetStarted={() => setModalOpen(true)} />
        <CustomerSection />
        <HowItWorksSection />
        <VendorSection />
        <AgencySection />
        <AgentSection />
        <AfricaFirstSection />
        <TrustSection />
        <FinalCTASection onGetStarted={() => setModalOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />
    </SectionNavProvider>
  );
}
