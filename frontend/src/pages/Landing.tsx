import HeroSection from "@/components/landing/HeroSection";
import PipelineSection from "@/components/landing/PipelineSection";
import ResultCardsSection from "@/components/landing/ResultCardsSection";
import AppPreviewSection from "@/components/landing/AppPreviewSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CTASection from "@/components/landing/CTASection";

const Landing = () => (
  <main className="min-h-screen bg-background">
    <HeroSection />
    <PipelineSection />
    <ResultCardsSection />
    <AppPreviewSection />
    <FeaturesSection />
    <CTASection />
  </main>
);

export default Landing;
