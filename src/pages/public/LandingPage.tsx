import { FC, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import HeroSection from '../../components/landing/HeroSection';
import FeaturesSection from '../../components/landing/FeaturesSection';
import HowItWorksSection from '../../components/landing/HowItWorksSection';
import CTASection from '../../components/landing/CTASection';

const LandingPage: FC = () => {
  const location = useLocation();

  // Handle hash navigation on page load
  useEffect(() => {
    if (location.hash) {
      const sectionId = location.hash.substring(1); // Remove '#'
      const element = document.getElementById(sectionId);
      if (element) {
        // Use setTimeout to ensure the page has fully rendered
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
    }
  }, [location.hash]);

  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <CTASection />
    </>
  );
};

export default LandingPage;
