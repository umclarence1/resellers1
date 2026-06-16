import { CheckCircle2, Smartphone } from 'lucide-react';
import Button from '@/components/ui/Button';
import { FeatureCard, ServiceCard } from '@/components/ui/ModernCard';
import { getNetworkImage } from '@/lib/network-images';
import { Link } from 'react-router-dom';
import SiteNavbar from '@/components/layout/SiteNavbar';
import { BrandMark } from '@/components/ui/BrandLogo';
import { PLATFORM_FOOTER, PLATFORM_NAME } from '@/lib/brand';
import ContactHelpButton from '@/components/ui/ContactHelpButton';
import ResultsCheckerPromo from '@/components/ui/ResultsCheckerPromo';
import WhatsAppFloat from '@/components/ui/WhatsAppFloat';
import { ADMIN_SUPPORT_DISPLAY, ADMIN_SUPPORT_PHONE } from '@/lib/support-contact';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-navy">
      <SiteNavbar />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute top-20 right-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Text */}
            <div className="relative z-10">
              <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold text-white leading-tight mb-6">
                Fastest and safest way to sell data bundles in Ghana
              </h1>
              <p className="text-lg text-gray-400 mb-8 max-w-lg leading-relaxed">
                Launch your own white-label store. Sell MTN, Telecel and AirtelTigo bundles with instant delivery and secure Paystack payments.
              </p>

              <ul className="space-y-3 mb-10">
                {[
                  'Instant data delivery within minutes',
                  'Secure wallet and payment system',
                  'Your own branded reseller store',
                  'Competitive pricing across all networks',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-gray-300">
                    <CheckCircle2 className="w-5 h-5 text-gold shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="flex flex-wrap gap-2 sm:gap-4">
                  <Link to="/register">
                    <Button
                      size="sm"
                      className="px-4 py-2 rounded-md sm:px-7 sm:py-3 sm:text-base sm:rounded-lg shadow-sm sm:shadow-md"
                    >
                      Become A Reseller
                    </Button>
                  </Link>
                  <Link to="/login/agent">
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-4 py-2 rounded-md border sm:px-7 sm:py-3 sm:text-base sm:rounded-lg sm:border-2"
                    >
                      Agent Login
                    </Button>
                  </Link>
                  <ResultsCheckerPromo />
                </div>
              </div>
            </div>

            {/* Right — Phone mockup */}
            <div className="relative flex justify-center lg:justify-end">
              <div className="absolute -top-4 right-12 w-32 h-32 bg-gold/20 rounded-full blur-2xl" />
              <div className="relative w-[280px] sm:w-[300px]">
                <div className="bg-navy-light border-4 border-navy-border rounded-[2.5rem] p-3 shadow-2xl shadow-black/40">
                  <div className="bg-white rounded-[2rem] overflow-hidden">
                    <div className="bg-navy px-5 py-4">
                      <BrandMark size="sm" />
                    </div>
                    <div className="p-4 space-y-2">
                      {['MTN Data Bundles', 'Telecel Packages', 'AirtelTigo Plans', 'Wallet & Earnings', 'My Store'].map((item) => (
                        <div key={item} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm text-gray-700">
                          <Smartphone className="w-4 h-4 text-gold" />
                          {item}
                        </div>
                      ))}
                      <div className="pt-2">
                        <div className="w-full py-2.5 bg-gold text-navy text-center text-sm font-semibold rounded-lg">
                          Buy Data
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Networks */}
      <section id="networks" className="border-t border-navy-border py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center gap-6">
          <span className="text-gray-500 text-sm font-medium whitespace-nowrap">Supported Networks:</span>
          <div className="flex flex-wrap items-center gap-8">
            {['MTN', 'Telecel', 'AirtelTigo'].map((name) => (
              <span key={name} className="text-white/80 font-semibold text-lg tracking-wide">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Why Choose Us */}
      <section id="features" className="py-20 bg-navy-light/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4">Why Choose Us</h2>
          <p className="text-center text-gray-400 mb-12 max-w-xl mx-auto">Trusted by resellers and Agents across Ghana</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            {[
              { title: 'Instant Activation', desc: 'Data delivered within minutes of purchase' },
              { title: 'Secure Payments', desc: 'Paystack-powered secure transactions' },
              { title: '24/7 Support', desc: 'Round-the-clock customer assistance' },
              { title: 'Competitive Pricing', desc: 'Best rates across all networks' },
            ].map((item) => (
              <FeatureCard key={item.title} title={item.title} description={item.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4">Our Services</h2>
          <p className="text-center text-gray-400 mb-12">All major Ghana networks supported</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {['MTN', 'Telecel', 'AirtelTigo'].map((network) => (
              <ServiceCard
                key={network}
                name={network}
                imageUrl={getNetworkImage(network)}
                badge="Available"
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-navy-border">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">Ready to Start Earning?</h2>
          <p className="text-gray-400 mb-8">Create your white-label store in minutes. No technical skills required.</p>
          <Link to="/register">
            <Button size="lg">Get Started Free</Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-navy-border py-8 pb-24">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          <p className="font-semibold text-white mb-2">{PLATFORM_NAME}</p>
          <p className="mb-2">
            Support line:{' '}
            <ContactHelpButton
              phone={ADMIN_SUPPORT_PHONE}
              displayPhone={ADMIN_SUPPORT_DISPLAY}
              smsBody="Hi topdealsgh, I need support."
              whatsAppText="Hi topdealsgh, I need support."
              className="text-gold font-medium hover:underline"
            >
              {ADMIN_SUPPORT_DISPLAY}
            </ContactHelpButton>
          </p>
          <p>{PLATFORM_FOOTER}</p>
        </div>
      </footer>

      <WhatsAppFloat />
    </div>
  );
}
