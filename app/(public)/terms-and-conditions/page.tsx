import type { Metadata } from "next"
import Link from "next/link"
import { 
  ArrowRight, 
  Calendar, 
  Clock, 
  FileText, 
  Mail, 
  Scale, 
  ShieldCheck 
} from "lucide-react"

import { brand } from "@/lib/brand"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Terms & Conditions",
  description: "Terms and Conditions for tochukwunkwocha.com covering enrolment, payments, course access, acceptable use, and legal terms.",
  path: "/terms-and-conditions"
})

const sections = [
  ["1. Eligibility and Acceptance", "You must be at least 18 years old, or use the services with parental or guardian authorization. You agree to provide accurate information during enrolment and payment."],
  ["2. Services and Course Access", "We provide educational content, live sessions, recorded content, and related course resources. Course structure, release schedule, and support format may evolve to improve learner outcomes."],
  ["3. Pricing, Taxes, and Payment", "Prices displayed at checkout are the prices due for the selected payment method and currency. Payment processors handle payment execution and security. Manual bank transfer enrolment is subject to verification."],
  ["4. Refunds and Cancellations", "Any specific refund terms shown on a course checkout or sales page form part of these Terms. Unless otherwise stated, digital course purchases are generally non-refundable once access is granted."],
  ["5. Intellectual Property", "Course materials, text, videos, files, branding, and site content are owned by us or our licensors. Users receive a limited, non-exclusive, non-transferable license for personal learning use only."],
  ["6. Acceptable Use", "You must not use the services for unlawful, fraudulent, abusive, or deceptive purposes, attempt unauthorized access, upload malicious code, or harass instructors, staff, or learners."],
  ["7. User Content and Submissions", "If you submit feedback, messages, files, or materials, you grant us a limited right to use that content for providing and improving the services. You remain responsible for submitted content."],
  ["8. Communications", "By enrolling or transacting, you agree to receive service-related communications such as enrolment updates, payment confirmations, schedule information, and access instructions."],
  ["9. Third-Party Services", "The services may integrate with third-party providers including payment processors, hosting, and email or CRM tools. We are not responsible for third-party outages or policy changes."],
  ["10. Disclaimers", "Educational content is provided for information and skills development. We do not guarantee specific business, financial, or career outcomes. Services are provided on an as-is and as-available basis where permitted by law."],
  ["11. Limitation of Liability", "To the fullest extent permitted by law, we are not liable for indirect, incidental, consequential, special, or punitive damages arising from use of the services."],
  ["12. Indemnity", "You agree to indemnify and hold us harmless from claims, liabilities, damages, and expenses arising from misuse of the services or breach of these Terms."],
  ["13. Suspension or Termination", "We may suspend or terminate access where there is suspected abuse, fraud, unlawful activity, non-payment, or breach of these Terms."],
  ["14. Changes to These Terms", "We may revise these Terms from time to time. Updated Terms will be posted on this page with a revised last updated date."],
  ["15. Governing Law", "These Terms are governed by applicable laws in the operating jurisdiction of the services, subject to any mandatory consumer rights under local law."]
]

const sectionContainer = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"

export default function TermsPage() {
  return (
    <main className="bg-muted/20 min-h-screen pb-24">
      {/* 1. Official Legal Hero */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        {/* Subtle grid pattern to signify structure */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        
        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="max-w-3xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <Scale className="h-4 w-4" />
              Legal Policies
            </p>
            <h1 className="font-heading text-4xl font-black tracking-tighter sm:text-5xl lg:text-6xl">
              Terms & Conditions
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300">
              These terms govern your use of the {brand.name} platform, covering enrolment, payments, course access, acceptable use, and related services.
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
                    Legally Binding
                  </li>
                </ul>
              </div>

              {/* Support Card */}
              <div className="surface-raised bg-card p-6">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-3 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-lg font-bold">Have questions?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  If you have legal or terms-related questions regarding your enrolment or data, our support team is available to help.
                </p>
                <Link 
                  href="mailto:support@tochukwunkwocha.com" 
                  className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-border bg-background px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:bg-muted"
                >
                  <Mail className="mr-2 h-4 w-4" /> Email Support
                </Link>
                <Link 
                  href="/privacy-policy" 
                  className="mt-4 flex items-center justify-between text-sm font-bold text-primary hover:underline"
                >
                  Read Privacy Policy <ArrowRight className="h-4 w-4" />
                </Link>
              </div>

            </aside>

            {/* Main Content: The Clauses */}
            <div className="surface-raised bg-card p-6 sm:p-10 lg:p-12">
              <div className="prose prose-slate dark:prose-invert max-w-none">
                <p className="text-lg leading-relaxed text-muted-foreground mb-10">
                  By accessing or using tochukwunkwocha.com and any related course offerings, content, products, or services, you agree to be bound by the following Terms & Conditions. Please read them carefully before enrolling.
                </p>

                <div className="grid gap-12">
                  {sections.map(([title, body]) => {
                    // Extract the number and the actual title text for premium styling
                    const [numStr, ...rest] = title.split(". ")
                    const headingText = rest.join(". ")
                    
                    return (
                      <div key={title} className="group relative">
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
                          {body}
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
