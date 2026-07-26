import { randomUUID } from "crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const prices = {
  NGN: 1_000_000,
  USD: 2_000,
  GBP: 2_000,
  EUR: 2_000
}

const commonFaqs = (title, time) => [
  {
    question: `Is the ${title} workbook suitable for a complete beginner?`,
    answer: "Yes. It starts from the beginning of the project, explains why each capability matters and uses simple, step-by-step instructions."
  },
  {
    question: "Do I need to know how to code before I start?",
    answer: "No. You will learn how to work with AI to build the application while understanding the files, features, tests and security decisions involved."
  },
  {
    question: "Which tools will I use?",
    answer: "You will use HTML, CSS, Vanilla JavaScript, Supabase, ChatGPT, Notepad and a modern web browser. You do not need VS Code, Node.js, React or a framework."
  },
  {
    question: "How long should the project take?",
    answer: `The estimated completion time is ${time}. Work at your own pace and test each completed capability before moving forward.`
  },
  {
    question: "Is this workbook part of a course?",
    answer: "It belongs to the Prompt to Profit™ Software Workbook Series, but it is a complete standalone project and can be studied independently."
  },
  {
    question: "How will I receive the workbook?",
    answer: "After secure payment is confirmed, the digital PDF is available through My Purchases and through a protected download link sent to your purchase email."
  }
]

const workbooks = [
  {
    sku: "PTP-WB01-DIG",
    slug: "expense-tracker-workbook",
    title: "Expense Tracker",
    subtitle: "Build a complete expense tracking application with AI.",
    pages: 344,
    time: "10–15 hours",
    cover: "/shop/workbooks/expense-tracker-cover.png",
    shortDescription: "Build a secure Expense Tracker that records income and expenses, calculates balances, and protects each user’s financial records.",
    seoTitle: "Expense Tracker Workbook for Beginners | Prompt to Profit™",
    seoDescription: "Build a secure Expense Tracker with HTML, CSS, JavaScript and Supabase. A beginner-friendly 344-page practical software workbook.",
    chapters: [
      "Building the Public Website",
      "Connecting to Supabase",
      "Building the Authentication System",
      "Building the Transactions Database",
      "Building the Expense Tracker Dashboard",
      "Viewing Transactions",
      "Editing and Deleting Transactions",
      "Making the Dashboard More Powerful",
      "Final Testing and Project Completion"
    ],
    capabilities: [
      "Build a responsive public website with login and registration links",
      "Connect a browser-based application securely to Supabase",
      "Create registration, email verification, login, protected pages and logout",
      "Design a transactions table protected by Row Level Security",
      "Add, view, edit and delete income and expense records",
      "Calculate total income, total expenses and the current balance",
      "Search, filter and sort transactions",
      "Test record ownership with two separate user accounts",
      "Deploy the completed application to Netlify"
    ],
    outcomes: [
      "Understand how HTML, CSS and JavaScript work together",
      "Use complete AI build prompts without relying on code snippets",
      "Save and retrieve authenticated user data",
      "Test loading, empty, success and error states",
      "Present a complete financial software project in a portfolio"
    ]
  },
  {
    sku: "PTP-WB02-DIG",
    slug: "customer-record-management-system-workbook",
    title: "Customer Record Management System",
    subtitle: "Build a complete customer management application with AI.",
    pages: 322,
    time: "25–30 hours",
    cover: "/shop/workbooks/customer-record-management-system-cover.png",
    shortDescription: "Build a secure customer management application for saving, finding, updating and organising business customer records.",
    seoTitle: "Customer Record Management System Workbook for Beginners",
    seoDescription: "Build a secure customer record system with HTML, CSS, JavaScript and Supabase in this 322-page beginner software workbook.",
    chapters: [
      "Building the Public Website",
      "Connecting to Supabase",
      "Building the Complete Authentication System",
      "Building the Customer Database",
      "Building the Customer Dashboard",
      "Viewing Customers",
      "Searching, Filtering and Sorting Customers",
      "Editing Customer Records",
      "Deleting Customer Records",
      "Final Application Review"
    ],
    capabilities: [
      "Build a responsive public website and customer dashboard",
      "Create registration, email verification, login and protected customer pages",
      "Design a customers table with useful data-quality constraints",
      "Protect every customer record with authenticated ownership and Row Level Security",
      "Save personal and business customer information",
      "Detect duplicate email addresses and phone numbers",
      "Display a customer directory and individual customer profiles",
      "Add click-to-call and click-to-email actions",
      "Search, filter, sort, edit and securely delete customer records",
      "Complete two-account privacy testing and live deployment"
    ],
    outcomes: [
      "Plan a practical customer data model",
      "Build a secure create, read, update and delete workflow",
      "Design dashboard statistics for real business information",
      "Handle empty, loading and error states clearly",
      "Present a portfolio-ready customer management application"
    ]
  },
  {
    sku: "PTP-WB03-DIG",
    slug: "professional-quotation-generator-workbook",
    title: "Professional Quotation Generator",
    subtitle: "Build a complete quotation management application with AI.",
    pages: 300,
    time: "25–30 hours",
    cover: "/shop/workbooks/professional-quotation-generator-cover.png",
    shortDescription: "Build a secure quotation application that manages customers, multiple items, discounts, tax, totals and professional printed documents.",
    seoTitle: "Professional Quotation Generator Workbook for Beginners",
    seoDescription: "Build a quotation generator with items, discounts, tax, printing and secure Supabase records in this beginner-friendly workbook.",
    chapters: [
      "Building the Public Website",
      "Connecting to Supabase",
      "Building the Complete Authentication System",
      "Building the Quotation Database",
      "Building the Quotation Dashboard",
      "Viewing Quotations",
      "Searching, Filtering and Sorting Quotations",
      "Editing Quotations",
      "Printing and Deleting Quotations",
      "Final Testing and Project Completion"
    ],
    capabilities: [
      "Build a responsive quotation software website and dashboard",
      "Create a complete authenticated user journey",
      "Design secure quotations and quotation_items tables",
      "Add and remove several quotation items",
      "Calculate subtotals automatically",
      "Apply percentage or fixed discounts and tax",
      "Save, view, search, filter, sort and edit quotations",
      "Print professional quotation documents",
      "Confirm and securely delete quotations",
      "Test ownership protection using two separate accounts"
    ],
    outcomes: [
      "Model a parent business record with multiple related items",
      "Build reliable financial calculations",
      "Protect quotation data with Row Level Security",
      "Create screen and A4 print experiences",
      "Complete a practical business-software portfolio project"
    ]
  },
  {
    sku: "PTP-WB04-DIG",
    slug: "professional-invoice-generator-workbook",
    title: "Professional Invoice Generator",
    subtitle: "Build a complete invoice management application with AI.",
    pages: 302,
    time: "25–30 hours",
    cover: "/shop/workbooks/professional-invoice-generator-cover.png",
    shortDescription: "Build a secure invoice application with saved customers, multiple items, trusted totals, discounts, tax and professional printing.",
    seoTitle: "Professional Invoice Generator Workbook for Beginners",
    seoDescription: "Build a secure invoice generator with customers, items, tax, discounts, search, editing and printing using JavaScript and Supabase.",
    chapters: [
      "Building the Public Website",
      "Connecting to Supabase",
      "Building the Complete Authentication System",
      "Building the Invoice Database",
      "Building the Invoice Dashboard",
      "Viewing Invoices",
      "Searching, Filtering and Sorting Invoices",
      "Editing Invoices",
      "Printing and Deleting Invoices",
      "Final Testing and Project Completion"
    ],
    capabilities: [
      "Build a responsive invoice software website and dashboard",
      "Create secure customers, invoices and invoice_items tables",
      "Save customer profiles and select customers when invoicing",
      "Add and remove several invoice items",
      "Calculate trusted subtotals, discounts, tax and totals",
      "Save and view complete invoices and customer snapshots",
      "Search, filter, sort and edit invoices",
      "Print clean professional A4 invoices",
      "Confirm and securely delete invoices and their related items",
      "Test every important workflow and user-ownership rule"
    ],
    outcomes: [
      "Understand related database tables and cascading records",
      "Build trusted financial calculations",
      "Preserve invoice history while editing",
      "Create professional print layouts",
      "Deliver a complete invoice application for a software portfolio"
    ]
  },
  {
    sku: "PTP-WB05-DIG",
    slug: "appointment-booking-system-workbook",
    title: "Appointment Booking System",
    subtitle: "Build a complete appointment scheduling application with AI.",
    pages: 274,
    time: "25–30 hours",
    cover: "/shop/workbooks/appointment-booking-system-cover.png",
    shortDescription: "Build a secure appointment scheduling application that prevents overlaps and helps a business manage bookings clearly.",
    seoTitle: "Appointment Booking System Workbook for Beginners",
    seoDescription: "Build a secure appointment booking system with schedules, overlap protection, search, editing and cancellation using Supabase.",
    chapters: [
      "Building the Public Website",
      "Connecting to Supabase",
      "Building the Complete Authentication System",
      "Building the Appointment Database",
      "Building the Appointment Dashboard",
      "Viewing Appointments",
      "Building the Appointment Details Page",
      "Editing and Cancelling Appointment Records",
      "Making Appointment Management More Powerful",
      "Final Testing and Project Completion"
    ],
    capabilities: [
      "Build a responsive appointment software website and dashboard",
      "Create registration, verification, login and protected appointment pages",
      "Design a secure appointments table",
      "Protect dates, times, statuses and overlapping bookings",
      "Book appointments and display a date-grouped schedule",
      "Open complete appointment details",
      "Search, filter and sort appointments",
      "Edit appointment information securely",
      "Cancel appointments without deleting their history",
      "Test privacy, responsive layouts and the complete live workflow"
    ],
    outcomes: [
      "Model date-and-time information for a real business workflow",
      "Prevent conflicting appointment records",
      "Build dashboard statistics for today, upcoming and cancelled bookings",
      "Preserve useful appointment history",
      "Present a complete scheduling application in a portfolio"
    ]
  }
]

function body(workbook) {
  return `## Build a real business application

${workbook.shortDescription}

This is Workbook ${workbook.sku.slice(6, 8)} in the Prompt to Profit™ Software Workbook Series. It is a complete standalone learning project. You can begin here without owning or completing another workbook in the series.

## Who this workbook is for

- Complete beginners who want to build useful software with AI
- Small business owners who want to understand how custom business applications are created
- Students and career changers building practical portfolio projects
- People who prefer clear, guided projects instead of disconnected coding exercises
- Learners using Notepad and a browser rather than a professional development environment

## What you will build

${workbook.capabilities.map((item) => `- ${item}`).join("\n")}

## What you will learn

${workbook.outcomes.map((item) => `- ${item}`).join("\n")}

## Your chapter-by-chapter path

${workbook.chapters.map((chapter, index) => `${index + 1}. ${chapter}`).join("\n")}

## Tools used in the workbook

- HTML for page structure
- CSS for layout, colours and responsive design
- Vanilla JavaScript for application behaviour
- Supabase for authentication, database storage and security
- ChatGPT as your AI software development partner
- Notepad for creating and updating complete files
- A modern browser for testing

You do not need VS Code, Node.js, React or a JavaScript framework.

## Designed for careful beginner progress

Every lesson explains what you are building, why it matters, what to prepare, the complete Build Prompt, what AI should return, how to save the files and how to test the completed capability.

The workbook also includes checkpoints, common beginner mistakes, behind-the-scenes explanations, software-design questions and a clear summary of what you learned.

## Security is part of the project

You will not build a demonstration that exposes every user's records. The workbook teaches authenticated ownership checks, Supabase Row Level Security and two-account privacy testing so you can verify that one user cannot access another user's information.

## Learner support included

- A visual glossary of recurring terms
- Backup instructions before replacing complete files
- A troubleshooting checklist
- A reusable error log
- Code-reading questions after major capabilities
- Final testing and live deployment guidance
- Portfolio description, reflection questions and extension challenges

## Workbook details

- Format: Protected digital PDF
- Length: ${workbook.pages} pages
- Difficulty: Beginner
- Estimated completion time: ${workbook.time}
- Series: Prompt to Profit™ Software Workbook Series
- Produced by: Tochukwu Tech and AI Academy

## Work at your own pace

The estimated time is a guide, not a deadline. Complete the lessons in order, test every important capability and stop to correct problems before moving forward. By the end, you will have both a working application and a clearer understanding of how complete software is planned, built, secured, tested and published.`
}

try {
  for (const workbook of workbooks) {
    const variant = await prisma.shopProductVariant.findUnique({
      where: { sku: workbook.sku },
      include: { product: true }
    })
    if (!variant || variant.product.slug !== workbook.slug) {
      throw new Error(`Could not find the expected product variant for ${workbook.sku}.`)
    }
    const now = new Date()
    await prisma.$transaction(async (transaction) => {
      await transaction.shopProduct.update({
        where: { id: variant.productId },
        data: {
          title: workbook.title,
          subtitle: workbook.subtitle,
          shortDescription: workbook.shortDescription,
          bodyContent: body(workbook),
          coverImageUrl: workbook.cover,
          status: "published",
          seoTitle: workbook.seoTitle,
          seoDescription: workbook.seoDescription,
          faqJson: JSON.stringify(commonFaqs(workbook.title, workbook.time)),
          publishedAt: variant.product.publishedAt || now,
          updatedAt: now
        }
      })
      await transaction.shopProductVariant.update({
        where: { id: variant.id },
        data: {
          priceMinor: prices.NGN,
          currency: "NGN",
          active: true,
          updatedAt: now
        }
      })
      for (const [currency, amountMinor] of Object.entries(prices)) {
        await transaction.shopVariantPrice.upsert({
          where: {
            variantId_currency: {
              variantId: variant.id,
              currency
            }
          },
          create: {
            priceUuid: randomUUID(),
            variantId: variant.id,
            currency,
            amountMinor,
            active: true,
            createdAt: now,
            updatedAt: now
          },
          update: {
            amountMinor,
            active: true,
            updatedAt: now
          }
        })
      }
    })
    console.log(`Published ${workbook.sku}: ${workbook.title}`)
  }
} finally {
  await prisma.$disconnect()
}
