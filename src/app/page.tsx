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

export default function Home() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      {/* Sticky Navbar */}
      <Navbar onGetStarted={() => setModalOpen(true)} />

      {/* Mobile section progress dots */}
      <SectionProgressIndicator />

      {/* Role selector modal */}
      <RoleSelectorModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

      {/* Page sections */}
      <main id="main-content">
        <HeroSection onGetStarted={() => setModalOpen(true)} />
        <HowItWorksSection />
        <VendorSection />
        <AgencySection />
        <AgentSection />
        <CustomerSection />
        <AfricaFirstSection />
        <TrustSection />
        <FinalCTASection onGetStarted={() => setModalOpen(true)} />
      </main>

      {/* Footer */}
      <Footer />
    </>
  );
}
