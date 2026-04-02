import HeroSection from "@/components/landing/HeroSection";
import PipelineSection from "@/components/landing/PipelineSection";
import ResultCardsSection from "@/components/landing/ResultCardsSection";
import AppPreviewSection from "@/components/landing/AppPreviewSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import CTASection from "@/components/landing/CTASection";
import LandingNav from "@/components/landing/LandingNav";

const Landing = () => (
  <main className="min-h-screen bg-background">
    <LandingNav />
    {/* Hero — warm gray bg (default) */}
    <HeroSection />
    {/* Pipeline — white bg */}
    <div className="bg-white">
      <PipelineSection />
    </div>
    {/* Result Cards — warm gray bg */}
    <ResultCardsSection />
    {/* App Preview — white bg */}
    <div className="bg-white">
      <AppPreviewSection />
    </div>
    {/* Features — warm gray bg */}
    <FeaturesSection />
    {/* CTA + Footer — white bg */}
    <div className="bg-white">
      <CTASection />
    </div>
  </main>
);

export default Landing;
