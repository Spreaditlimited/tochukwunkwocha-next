import { randomUUID } from "crypto"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const digitalPriceMinor = Math.max(
  0,
  Number.parseInt(process.env.SHOP_WORKBOOK_PRICE_NGN_MINOR || "0", 10) || 0
)
const publish = /^(1|true|yes)$/i.test(process.env.SHOP_PUBLISH_SEEDED_WORKBOOKS || "") && digitalPriceMinor > 0

const workbooks = [
  {
    number: 1,
    slug: "expense-tracker-workbook",
    title: "Expense Tracker",
    subtitle: "Build a simple application that helps people understand where their money goes.",
    description: "A beginner-friendly workbook that guides you through building a secure expense tracker with HTML, CSS, Vanilla JavaScript and Supabase.",
    folder: "expense-tracker-workbook",
    filename: "Prompt-to-Profit-Workbook-01-Expense-Tracker.pdf"
  },
  {
    number: 2,
    slug: "customer-record-management-system-workbook",
    title: "Customer Record Management System",
    subtitle: "Build a useful application for keeping customer information organised.",
    description: "A clear, beginner-friendly workbook for building a secure customer record application from start to finish.",
    folder: "customer-record-management-system-workbook",
    filename: "Prompt-to-Profit-Workbook-02-Customer-Record-Management-System.pdf"
  },
  {
    number: 3,
    slug: "professional-quotation-generator-workbook",
    title: "Professional Quotation Generator",
    subtitle: "Build an application that creates clear and professional business quotations.",
    description: "A practical workbook that helps beginners build, save, edit, print and secure professional quotations.",
    folder: "professional-quotation-generator-workbook",
    filename: "Prompt-to-Profit-Workbook-03-Professional-Quotation-Generator.pdf"
  },
  {
    number: 4,
    slug: "professional-invoice-generator-workbook",
    title: "Professional Invoice Generator",
    subtitle: "Build an application that turns completed work into professional invoices.",
    description: "A step-by-step beginner workbook for creating, calculating, saving and printing secure business invoices.",
    folder: "professional-invoice-generator-workbook",
    filename: "Prompt-to-Profit-Workbook-04-Professional-Invoice-Generator.pdf"
  },
  {
    number: 5,
    slug: "appointment-booking-system-workbook",
    title: "Appointment Booking System",
    subtitle: "Build an application that helps a business receive and manage appointments.",
    description: "A beginner-friendly workbook for building a secure appointment booking application with a practical business workflow.",
    folder: "appointment-booking-system-workbook",
    filename: "Prompt-to-Profit-Workbook-05-Appointment-Booking-System.pdf"
  },
  {
    number: 6,
    slug: "sales-tracker-workbook",
    title: "Sales Tracker",
    subtitle: "Build an application that helps a business record, organise and understand its sales.",
    description: "A beginner-friendly workbook for building a secure sales tracking application with calculated totals, useful statistics and complete record management.",
    folder: "sales-tracker-workbook",
    filename: "Prompt-to-Profit-Workbook-06-Sales-Tracker.pdf"
  },
  {
    number: 7,
    slug: "supplier-management-system-workbook",
    title: "Supplier Management System",
    subtitle: "Build an application that keeps supplier information organised and easy to manage.",
    description: "A practical beginner workbook for building a secure supplier management application with detailed records, business statistics and useful contact actions.",
    folder: "supplier-management-system-workbook",
    filename: "Prompt-to-Profit-Workbook-07-Supplier-Management-System.pdf"
  },
  {
    number: 8,
    slug: "order-management-system-workbook",
    title: "Order Management System",
    subtitle: "Build an application that helps a business create, track and manage customer orders.",
    description: "A beginner-friendly workbook for building a secure order management application with calculated totals, status tracking and complete record management.",
    folder: "order-management-system-workbook",
    filename: "Prompt-to-Profit-Workbook-08-Order-Management-System.pdf"
  }
]

const requestedSkus = new Set(
  String(process.env.SHOP_WORKBOOK_SKUS || "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
)
const selectedWorkbooks = requestedSkus.size
  ? workbooks.filter((workbook) => requestedSkus.has(`PTP-WB${String(workbook.number).padStart(2, "0")}-DIG`))
  : workbooks
if (requestedSkus.size !== selectedWorkbooks.length) {
  throw new Error("SHOP_WORKBOOK_SKUS contains an unknown or duplicate workbook SKU.")
}

for (const workbook of selectedWorkbooks) {
  const existing = await prisma.shopProduct.findUnique({ where: { slug: workbook.slug } })
  const product = await prisma.shopProduct.upsert({
    where: { slug: workbook.slug },
    create: {
      productUuid: randomUUID(),
      slug: workbook.slug,
      title: workbook.title,
      subtitle: workbook.subtitle,
      shortDescription: workbook.description,
      bodyContent: `## What you will build

You will build one complete business application by following clear lessons and using beginner-friendly prompts.

## Who this workbook is for

This workbook is for beginners. You do not need to be an experienced programmer before you start.

## What you will use

- HTML
- CSS
- Vanilla JavaScript
- Supabase
- Notepad

## What is included

- Clear chapter and lesson milestones
- Complete build prompts
- Testing instructions
- Common beginner mistakes
- Reflection questions and extension challenges`,
      category: "workbooks",
      status: publish ? "published" : "draft",
      featured: workbook.number <= 2,
      sortOrder: workbook.number,
      seoTitle: `${workbook.title} | Prompt to Profit™ Workbook`,
      seoDescription: workbook.description,
      faqJson: JSON.stringify([
        { question: "Is this workbook suitable for a beginner?", answer: "Yes. The lessons and prompts are written for people who are building their first software applications." },
        { question: "Which tools will I use?", answer: "You will use HTML, CSS, Vanilla JavaScript, Supabase and Notepad." },
        { question: "How do I receive the digital workbook?", answer: "After payment is confirmed, the workbook appears securely in My Purchases in the student dashboard." }
      ]),
      publishedAt: publish ? new Date() : null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    update: {
      title: workbook.title,
      subtitle: workbook.subtitle,
      shortDescription: workbook.description,
      sortOrder: workbook.number,
      updatedAt: new Date()
    }
  })

  const sku = `PTP-WB${String(workbook.number).padStart(2, "0")}-DIG`
  await prisma.shopProductVariant.upsert({
    where: { sku },
    create: {
      variantUuid: randomUUID(),
      productId: product.id,
      sku,
      title: "Digital PDF",
      fulfillmentType: "digital",
      priceMinor: digitalPriceMinor,
      currency: "NGN",
      digitalAssetKey: null,
      digitalFilename: workbook.filename,
      active: true,
      sortOrder: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    update: {
      productId: product.id,
      digitalFilename: workbook.filename,
      updatedAt: new Date()
    }
  })
  console.log(`${publish ? "Published" : "Prepared draft"}: ${workbook.title}`)
}

await prisma.$disconnect()
