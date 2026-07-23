import type { Metadata } from "next"
import Link from "next/link"
import { 
  ArrowRight, 
  Calendar, 
  Clock, 
  FileText, 
  Lock, 
  Mail, 
  ShieldCheck 
} from "lucide-react"

import { brand } from "@/lib/brand"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "Privacy Policy for tochukwunkwocha.com, including how personal data is collected, used, stored, and shared for course enrolment and payments.",
  path: "/privacy-policy"
})

const sections = [
  {
    title: "1. Information We Collect",
    body: "We may collect identity and contact information, transaction information, manual transfer proof, technical information, and marketing or communication preferences."
  },
  {
    title: "2. How We Collect Information",
    body: "We collect information directly from forms, enrolments, payments, contact submissions, site technologies, and payment partners when transactions are processed or verified."
  },
  {
    title: "3. How We Use Information",
    body: "We use information to manage course enrolment, process payments, verify manual transfers, send onboarding and transactional emails, maintain security, improve services, and comply with legal obligations."
  },
  {
    title: "4. Payment Processing",
    body: "We use third-party payment processors including Paystack and PayPal. Card or payment account details are handled by those processors under their own privacy policies and compliance controls. We do not store full payment card details on our servers."
  },
  {
    title: "5. Manual Bank Transfer Verification",
    body: "Where manual bank transfer is available, we collect payment proof to verify your transfer before full enrolment. After payment is confirmed, your contact may be moved into the relevant enrolment communication segment."
  },
  {
    title: "6. Email and CRM Providers",
    body: "We use third-party email and CRM providers, including Flodesk where applicable, to manage enrolment communication, updates, and announcements."
  },
  {
    title: "7. Analytics and Advertising",
    body: "We may use analytics and event tracking tools to understand page usage and campaign performance. These tools may use cookies or similar technologies."
  },
  {
    title: "8. Legal Bases",
    body: "Where applicable, we process personal data under performance of a contract, legitimate interests, consent, or legal obligation."
  },
  {
    title: "9. Data Sharing",
    body: "We may share personal data with payment processors, hosting and infrastructure providers, email delivery and CRM providers, professional advisers, regulators, and authorities where legally required. We do not sell personal data in exchange for monetary consideration."
  },
  {
    title: "10. International Transfers",
    body: "Because our service providers may operate in multiple countries, your data may be processed outside your home jurisdiction. Where required, we rely on appropriate safeguards under applicable law."
  },
  {
    title: "11. Data Retention and Security",
    body: "We retain data only as long as reasonably necessary for operational, legal, tax, accounting, and dispute-resolution requirements. We use reasonable safeguards, but no internet or storage system is guaranteed to be fully secure."
  },
  {
    title: "12. Your Rights",
    body: "Depending on your location, you may have rights to access, correct, update, delete, object to, restrict, or request portability of your personal data, and to complain to a data protection authority."
  },
  {
    title: "13. Children’s Privacy",
    body: "Our services are not directed to children under 13. We do not knowingly collect personal data from children under 13 without appropriate authorization."
  },
  {
    title: "14. Third-Party Links and Changes",
    body: "Our site may link to third-party services. We are not responsible for their privacy practices. We may update this policy by changing the last updated date and publishing the revised version."
  }
]

const sectionContainer = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-muted/20 min-h-screen pb-24">
      {/* 1. Official Legal Hero */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        {/* Subtle grid pattern to signify structure */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="max-w-3xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <Lock className="h-4 w-4" />
              Data Protection
            </p>
            <h1 className="font-heading text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl">
              Privacy Policy
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              This policy explains how {brand.name} collects, uses, discloses, and protects personal information when you use our platform.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Document Body with Sticky Sidebar */}
      <section className="py-12 lg:py-20">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[320px_1fr] lg:gap-16 items-start">
            
            {/* Sidebar: Document Metadata & Help */}
            <aside className="lg:sticky lg:top-28 grid gap-6">
              
              {/* Document Info Card */}
              <div className="surface-raised bg-card p-6">
                <p className="eyebrow text-muted-foreground mb-4">Document Details</p>
                <ul className="grid gap-4">
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    Last Updated: March 17, 2026
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <Clock className="h-4 w-4 text-primary" />
                    Effective Immediately
                  </li>
                  <li className="flex items-center gap-3 text-sm font-medium text-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Data Compliant
                  </li>
                </ul>
              </div>

              {/* Support Card */}
              <div className="surface-raised bg-card p-6">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold">Privacy Inquiries</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  For privacy questions, data requests, or concerns about how we handle your information, please contact our support team.
                </p>
                <Link 
                  href="mailto:support@tochukwunkwocha.com" 
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                >
                  <Mail className="mr-2 h-4 w-4" /> Email Support
                </Link>
                <Link 
                  href="/terms-and-conditions" 
                  className="mt-4 flex items-center justify-between text-sm font-bold text-primary hover:underline"
                >
                  Read Terms & Conditions <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

            </aside>

            {/* Main Content: The Clauses */}
            <div className="surface-raised bg-card p-6 sm:p-10 lg:p-12">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed text-muted-foreground mb-10">
                  This Privacy Policy explains how Tochukwu Tech and AI Academy and tochukwunkwocha.com collect, use, disclose, and protect personal information when users visit the website, enrol in courses, make payments, upload payment proof, or join email lists.
                </p>

                <div className="grid gap-12">
                  {sections.map((section) => {
                    // Extract the number and the actual title text for premium styling
                    const [numStr, ...rest] = section.title.split(". ")
                    const headingText = rest.join(". ")
                    
                    return (
                      <div key={section.title} className="group relative">
                        {/* Number Badge */}
                        <div className="mb-4 inline-flex items-center justify-center rounded-md bg-muted/50 px-3 py-1 text-sm font-black text-primary">
                          Section {numStr}
                        </div>
                        
                        {/* Clause Title */}
                        <h2 className="font-heading text-2xl font-black tracking-tight text-foreground border-b border-border pb-4">
                          {headingText}
                        </h2>
                        
                        {/* Clause Body */}
                        <p className="mt-5 text-base leading-relaxed text-muted-foreground">
                          {section.body}
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>
    </main>
  )
}
