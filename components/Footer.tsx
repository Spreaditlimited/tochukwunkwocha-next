import Link from "next/link"
import { ArrowRight } from "lucide-react"

import { BrandMark } from "@/components/BrandMark"
import { PromptToProfitMark } from "@/components/TrademarkText"
import { brand } from "@/lib/brand"

export function Footer() {
  return (
    <footer className="bg-brand-ink pb-6 pt-12 text-white">
      <div className="site-container">
        <div className="grid gap-12 lg:grid-cols-5 lg:gap-8">
          <div className="lg:col-span-2">
            <div className="mb-6">
              <BrandMark
                context="public"
                variant="full"
                tone="reverse"
                className="h-10 w-[170px] sm:h-11 sm:w-[188px]"
              />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-400">
              Practical AI education and real-world building for individuals, schools, and teams.
              Master AI by executing, not collecting theory.
            </p>
            <div className="mt-8">
              <Link
                href="/courses/prompt-to-profit"
                className="group inline-flex items-center text-sm font-bold text-sky-400 no-underline transition-colors hover:text-sky-300"
              >
                Enroll in the next cohort
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
            <div>
              <h4 className="font-heading text-sm font-bold text-white">Learning</h4>
              <ul className="mt-6 space-y-4">
                <li>
                  <Link href="/courses/prompt-to-profit" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    <PromptToProfitMark />
                  </Link>
                </li>
                <li>
                  <Link href="/courses/prompt-to-production" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    <PromptToProfitMark suffix=" Advanced" />
                  </Link>
                </li>
                <li>
                  <Link href="/courses/prompt-to-profit-schools" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    For Schools
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    All Courses
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-sm font-bold text-white">Academy</h4>
              <ul className="mt-6 space-y-4">
                <li>
                  <Link href="/build" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Build Services
                  </Link>
                </li>
                <li>
                  <Link href="/private-ai-build-coaching" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Private Coaching
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Insights & Blog
                  </Link>
                </li>
                <li>
                  <Link href="/projects" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Student Projects
                  </Link>
                </li>
                <li>
                  <Link href="/resources" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Resources
                  </Link>
                </li>
                <li>
                  <Link href="/dashboard" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Student Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="font-heading text-sm font-bold text-white">Legal & Connect</h4>
              <ul className="mt-6 space-y-4">
                <li>
                  <Link href="/about" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link href="/privacy-policy" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms-and-conditions" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/certificates/verify" className="text-sm text-slate-400 no-underline transition-colors hover:text-white">
                    Verify Certificate
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 pt-6 sm:flex-row">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-slate-500">
            {brand.promise}
          </p>
          <p className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} {brand.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
