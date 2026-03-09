/**
 * Landing Page
 * 
 * Hero section with CTA, how-it-works, and trust signals
 */

import { LoginButton } from '@/components/auth/LoginButton';
import { Shield, Zap, GitBranch, FileSearch, Bug, Wrench, GitPullRequest } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "AI-Powered Code Intelligence Platform",
  description: "DevSentinel reads your PRD, tests your code, finds what's broken, and fixes it for you. Automated bug detection, security audits, and autonomous PR creation.",
  openGraph: {
    title: "DevSentinel - AI-Powered Code Intelligence",
    description: "Automated code analysis, bug detection, and autonomous fixes with AI",
    url: "https://devsentinel.com",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "DevSentinel - AI-Powered Code Intelligence",
    description: "Automated code analysis, bug detection, and autonomous fixes with AI",
  },
  alternates: {
    canonical: "https://devsentinel.com",
  },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "DevSentinel",
    "applicationCategory": "DeveloperApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "description": "AI-powered code intelligence platform that reads your PRD, tests your code, finds what's broken, and fixes it for you",
    "featureList": [
      "Automated code analysis",
      "Bug detection",
      "Security vulnerability scanning",
      "Production readiness audit",
      "Autonomous PR creation",
      "PRD compliance checking"
    ],
    "screenshot": "https://devsentinel.com/screenshot.png",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5",
      "ratingCount": "1"
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      {/* Skip Navigation Link */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md"
      >
        Skip to main content
      </a>
      
      {/* Hero Section */}
      <main id="main-content" className="flex-1" role="main">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="flex flex-col items-center text-center space-y-8">
            {/* Logo/Brand */}
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                DevSentinel
              </h1>
              <p className="text-xl md:text-3xl font-semibold text-foreground max-w-4xl leading-tight">
                AI that reads your PRD, tests your code, finds what's broken, and fixes it for you
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
                Automated code intelligence that detects bugs, security issues, and production gaps—then opens PRs to fix them
              </p>
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <LoginButton size="lg" />
            </div>

            {/* Trust Signals */}
            <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-2xl text-primary">$0</span>
                <span>/month</span>
              </div>
              <span className="text-muted-foreground/50">•</span>
              <span>Next.js</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Gemini Flash</span>
              <span className="text-muted-foreground/50">•</span>
              <span>Claude Sonnet</span>
              <span className="text-muted-foreground/50">•</span>
              <span>E2B Sandboxes</span>
            </div>
          </div>
        </div>

        {/* How It Works Section */}
        <section className="border-t bg-muted/30" aria-labelledby="how-it-works-heading">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="text-center space-y-4 mb-12">
              <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold">How It Works</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Four simple steps from code analysis to automated fixes
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <FileSearch className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-primary">Step 1</div>
                  <h3 className="font-semibold text-lg">Connect Repository</h3>
                  <p className="text-sm text-muted-foreground">
                    Link your GitHub repo and optionally upload your PRD document
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <Bug className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-primary">Step 2</div>
                  <h3 className="font-semibold text-lg">AI Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    4-pass AI engine detects bugs, security issues, and production gaps
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <Wrench className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-primary">Step 3</div>
                  <h3 className="font-semibold text-lg">Review Findings</h3>
                  <p className="text-sm text-muted-foreground">
                    See detailed reports with file locations, severity, and suggested fixes
                  </p>
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                  <GitPullRequest className="h-8 w-8 text-primary" />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-semibold text-primary">Step 4</div>
                  <h3 className="font-semibold text-lg">Auto-Fix</h3>
                  <p className="text-sm text-muted-foreground">
                    AI agent writes fixes in sandboxes and opens GitHub PRs automatically
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-16 md:py-24" aria-labelledby="features-heading">
          <h2 id="features-heading" className="sr-only">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Security First</h3>
              <p className="text-sm text-muted-foreground">
                Detect SQL injection, XSS, hardcoded secrets, and IDOR vulnerabilities automatically
              </p>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Autonomous Fixes</h3>
              <p className="text-sm text-muted-foreground">
                Claude Sonnet agent writes code fixes in isolated E2B sandboxes with no manual intervention
              </p>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">GitHub Native</h3>
              <p className="text-sm text-muted-foreground">
                Seamless OAuth integration, automatic PR creation, and never auto-merges
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6" role="contentinfo">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          © 2026 DevSentinel. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
