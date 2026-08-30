import { Suspense } from 'react';
import { LandingNavigation } from '@/components/landing/LandingNavigation';
import { CivicTheme } from '@/components/landing/CivicTheme';
import { HeroSection } from '@/components/landing/HeroSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { StoryScroll } from '@/components/landing/StoryScroll';
import { SolutionSection } from '@/components/landing/SolutionSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { PromiseLedgerSection } from '@/components/landing/PromiseLedgerSection';
import { BrokenPromiseSection } from '@/components/landing/BrokenPromiseSection';
import { AIVerificationSection } from '@/components/landing/AIVerificationSection';
import { CivicIntelligenceMapSection } from '@/components/landing/CivicIntelligenceMapSection';
import { PredictiveIntelligenceSection } from '@/components/landing/PredictiveIntelligenceSection';
import { DashboardPreviewSection } from '@/components/landing/DashboardPreviewSection';
import { CTASection } from '@/components/landing/CTASection';
import { SectionWave } from '@/components/landing/SectionWave';
import { Footer } from '@/components/layout/Footer';

export default function Home() {
  return (
    <main className="relative min-h-screen theme-tint dark:bg-dark-bg">
      <CivicTheme />
      <LandingNavigation />
      <Suspense fallback={<HeroLoading />}>
        <HeroSection />
      </Suspense>
      <ProblemSection />
      <StoryScroll />
      <SolutionSection />
      <FeaturesSection />
      <PromiseLedgerSection />
      <BrokenPromiseSection />
      <AIVerificationSection />
      <SectionWave fill="#091540" />
      <CivicIntelligenceMapSection />
      <PredictiveIntelligenceSection />
      <DashboardPreviewSection />
      <SectionWave flip fill="#091540" fillAccent="#12207a" />
      <CTASection />
      <Footer />
    </main>
  );
}

function HeroLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-bg">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-brand-500/30 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm font-mono">Loading CivicChain...</p>
      </div>
    </div>
  );
}