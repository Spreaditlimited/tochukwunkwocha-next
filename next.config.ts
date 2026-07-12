import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"

const sharedConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "tochukwunkwocha.com" }
    ]
  },
  async redirects() {
    const promptToProfitLegacySlugs = [
      "prompt-to-profit-holiday",
      "prompt-to-profit-job-seekers",
      "prompt-to-profit-children"
    ]

    return promptToProfitLegacySlugs.flatMap((slug) => [
      {
        source: `/${slug}`,
        destination: "/courses/prompt-to-profit",
        permanent: true
      },
      {
        source: `/courses/${slug}`,
        destination: "/courses/prompt-to-profit",
        permanent: true
      },
      {
        source: `/checkout/${slug}`,
        destination: "/checkout/prompt-to-profit",
        permanent: false
      }
    ])
  },
  async rewrites() {
    return [
      {
        source: "/.netlify/functions/school-call-slots",
        destination: "/api/schools/call/slots"
      },
      {
        source: "/.netlify/functions/school-call-book",
        destination: "/api/schools/call/book"
      },
      {
        source: "/.netlify/functions/school-call-manage",
        destination: "/api/schools/call/manage"
      },
      {
        source: "/.netlify/functions/school-call-reschedule",
        destination: "/api/schools/call/reschedule"
      },
      {
        source: "/.netlify/functions/school-call-cancel",
        destination: "/api/schools/call/cancel"
      },
      {
        source: "/.netlify/functions/school-students-template",
        destination: "/api/schools/students/template"
      },
      {
        source: "/.netlify/functions/school-certificate-public",
        destination: "/api/schools/certificate/public"
      },
      {
        source: "/.netlify/functions/school-student-code-login",
        destination: "/api/student/group-code-login"
      },
      {
        source: "/.netlify/functions/build-discovery-paystack-return",
        destination: "/api/build-discovery/paystack/return"
      },
      {
        source: "/.netlify/functions/build-discovery-stripe-return",
        destination: "/api/build-discovery/stripe/return"
      },
      {
        source: "/.netlify/functions/private-ai-coaching-paystack-return",
        destination: "/api/private-ai-coaching/paystack/return"
      },
      {
        source: "/.netlify/functions/private-ai-coaching-stripe-return",
        destination: "/api/private-ai-coaching/stripe/return"
      },
      {
        source: "/.netlify/functions/contact-submit",
        destination: "/api/contact"
      }
    ]
  }
}

export default function nextConfig(phase: string): NextConfig {
  return {
    ...sharedConfig,
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"
  }
}
