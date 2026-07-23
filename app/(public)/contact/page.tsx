import type { Metadata } from "next"
import { 
  Clock, 
  Mail, 
  MapPin, 
  Phone
} from "lucide-react"

import { ContactForm } from "@/components/ContactForm"
import { buildMetadata } from "@/lib/site-seo"

export const metadata: Metadata = buildMetadata({
  title: "Contact Us",
  description: "Contact Tochukwu Tech and AI Academy about courses, services, workshops, and AI build coaching.",
  path: "/contact"
})

const sectionContainer = "mx-auto w-full max-w-7xl px-5 sm:px-6 lg:px-8"

export default function ContactPage() {
  return (
    <main>
      {/* 1. Immersive Hero Section */}
      <section className="relative overflow-hidden bg-brand-ink pt-16 text-white lg:pt-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
        <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-sky/15 blur-[150px]"></div>

        <div className={`${sectionContainer} relative z-10 pb-16 lg:pb-24`}>
          <div className="max-w-3xl">
            <p className="eyebrow mb-6 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-4 py-1.5 text-sky-400">
              <Mail className="h-4 w-4" />
              Admissions & Support
            </p>
            <h1 className="font-heading text-5xl font-black tracking-tighter sm:text-6xl lg:text-7xl">
              Get in touch with us.
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-slate-300 sm:text-xl">
              Whether you have a question about our courses, need help with a service, or want to explore partnership opportunities, our team is here to assist you.
            </p>
          </div>
        </div>
      </section>

      {/* 2. Main Content Grid */}
      <section className="bg-muted/20 py-20 lg:py-28">
        <div className={sectionContainer}>
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 items-start">
            
            {/* Left Column: Contact Information */}
            <div className="grid gap-6">
              <div className="mb-4">
                <h2 className="font-heading text-2xl font-black tracking-tight">Direct Contact</h2>
                <p className="mt-2 text-sm text-muted-foreground">Our support team typically responds within 24 hours.</p>
              </div>

              {/* Office Address */}
              <div className="surface-raised flex items-start gap-4 bg-card p-6 transition-shadow hover:shadow-md">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Office Address</p>
                  <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
                    5 Olutosin Ajayi Street<br />
                    Ajao Estate, Lagos<br />
                    Nigeria
                  </p>
                </div>
              </div>

              {/* Phone Numbers (Split for clarity) */}
              <div className="surface-raised flex items-start gap-4 bg-card p-6 transition-shadow hover:shadow-md">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="w-full">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-bold text-foreground">United Kingdom</p>
                      <a href="tel:+447881194138" className="mt-1 block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        +44 788 119 4138
                      </a>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Nigeria</p>
                      <a href="tel:+2348037649956" className="mt-1 block text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        +234 803 764 9956
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="surface-raised flex items-start gap-4 bg-card p-6 transition-shadow hover:shadow-md">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</p>
                  <a href="mailto:support@tochukwunkwocha.com" className="mt-2 block text-sm font-semibold text-foreground hover:text-primary transition-colors">
                    support@tochukwunkwocha.com
                  </a>
                </div>
              </div>

              {/* Working Hours */}
              <div className="surface-raised flex items-start gap-4 bg-brand-ink p-6 text-white transition-shadow hover:shadow-md">
                <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-sky-400">
                  <Clock className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Support Hours</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    Monday – Friday<br />
                    9:00 AM – 5:00 PM (WAT/BST)
                  </p>
                </div>
              </div>

            </div>

            {/* Right Column: Contact Form */}
            <div className="surface-raised bg-card p-8 sm:p-12">
              <h2 className="font-heading text-2xl font-black tracking-tight">Send a Message</h2>
              <p className="mt-2 text-sm text-muted-foreground">Fill out the form below and we will route your enquiry to the right team.</p>
              <ContactForm />
            </div>

          </div>
        </div>
      </section>
    </main>
  )
}
