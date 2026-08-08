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
import AuroraBackground from "@/components/layout/AuroraBackground";
import InteractiveNetwork from "@/components/layout/InteractiveNetwork";
import OrbitalBackground from "@/components/layout/orbital";
import GrainOverlay from "@/components/layout/GrainOverlay";
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
      {/* Ambient background layers (fixed, behind everything).
          OrbitalBackground sits after the aurora + network so it paints on top
          of them, and before the grain so the grain still tops the stack. */}
      <AuroraBackground />
      <InteractiveNetwork />
      <OrbitalBackground />
      <GrainOverlay />

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
