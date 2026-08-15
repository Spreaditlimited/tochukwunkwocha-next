import fs from "node:fs"
import { PrismaClient } from "@prisma/client"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  for (const rawLine of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[key] = value
  }
}

loadDotEnv()
const prisma = new PrismaClient()
const apply = process.argv.includes("--apply")
const titleSuffix = " | Tochukwu Tech"

const metadataBySlug = {
  "future-proofing-your-classrooms": ["Future-Proof Classrooms With Practical AI", "future-proof classrooms with AI"],
  "the-end-of-theory-only-technology-classes": ["Practical Technology Classes Beyond Theory", "practical technology classes"],
  "why-8-year-olds-are-building-better-websites-than-most-adults": ["How Children Build Better Websites With AI", "AI website building for children"],
  "no-passwords-no-emails-just-building-the-frictionless-future-of-ai-education": ["Frictionless AI Education Without Logins", "frictionless AI education"],
  "family-dashboard-for-childrens-online-learning-in-nigeria": ["Family Learning Dashboard for Nigerian Parents", "family learning dashboard Nigeria"],
  "how-to-start-an-ai-club-in-a-nigerian-school": ["Start an AI Club in a Nigerian School", "AI club in Nigerian school"],
  "how-nigerian-small-businesses-can-build-a-website-with-ai": ["Build a Business Website With AI in Nigeria", "build website with AI Nigeria"],
  "ai-safety-for-children-in-nigeria": ["AI Safety Rules for Children in Nigeria", "AI safety for children Nigeria"],
  "prompt-engineering-for-nigerian-students": ["Prompt Engineering for Nigerian Students", "prompt engineering for Nigerian students"],
  "how-nigerian-schools-can-launch-an-ai-program-without-overwhelming-teachers": ["Launch a School AI Programme in Nigeria", "school AI programme Nigeria"],
  "ai-skills-for-nigerian-teenagers-building-a-portfolio-before-university": ["AI Skills for Nigerian Teenagers", "AI skills for Nigerian teenagers"],
  "chatgpt-for-nigerian-teachers-lesson-planning-and-classroom-ideas": ["ChatGPT for Nigerian Teachers", "ChatGPT for Nigerian teachers"],
  "how-to-choose-an-ai-course-for-your-child-in-nigeria": ["Choose an AI Course for Your Child in Nigeria", "AI course for children in Nigeria"],
  "holiday-ai-programs-for-children-in-nigeria": ["Holiday AI Programmes for Children in Nigeria", "holiday AI programs for children in Nigeria"],
  "school-ai-readiness-in-nigeria-checklist-for-principals-and-school-owners": ["School AI Readiness Checklist for Nigeria", "school AI readiness Nigeria"],
  "ai-for-nigerian-small-business-owners-practical-daily-use-cases": ["AI for Nigerian Small Business Owners", "AI for Nigerian small business owners"],
  "how-nigerian-students-can-build-websites-with-chatgpt-without-coding": ["Nigerian Students: Build Websites With ChatGPT", "students build websites with ChatGPT"],
  "ai-curriculum-for-nigerian-schools-what-students-should-actually-learn": ["AI Curriculum for Nigerian Schools", "AI curriculum for Nigerian schools"],
  "the-nigerian-parents-guide-to-ai-skills-for-children": ["AI Skills for Children: Nigerian Parent Guide", "AI skills for children in Nigeria"],
  "how-to-use-chatgpt-as-a-beginner-practical-step-by-step-guide": ["How to Use ChatGPT: Beginner Guide", "how to use ChatGPT for beginners"],
  "best-chatgpt-prompts-for-everyday-work": ["Best ChatGPT Prompts for Everyday Work", "ChatGPT prompts for work"],
  "chatgpt-vs-gemini-vs-claude-which-ai-tool-should-you-use": ["ChatGPT vs Gemini vs Claude: Practical Guide", "ChatGPT vs Gemini vs Claude"],
  "how-small-business-owners-can-use-ai-to-save-time-every-week": ["Use AI to Save Time in Your Small Business", "AI for small business productivity"],
  "chatgpt-prompts-for-business-owners": ["ChatGPT Prompts for Business Owners", "ChatGPT prompts for business owners"],
  "how-to-use-ai-to-write-better-whatsapp-and-email-replies": ["AI for Better WhatsApp and Email Replies", "AI WhatsApp and email replies"],
  "how-to-turn-ai-skills-into-practical-income-opportunities": ["Turn AI Skills Into Income Opportunities", "make money with AI skills"],
  "artificial-intelligence-course-in-nigeria": ["Artificial Intelligence Course in Nigeria", "artificial intelligence course in Nigeria"],
  "ai-certification-course-in-nigeria": ["AI Certification Course in Nigeria: What to Check", "AI certification course in Nigeria"],
  "ai-training-course-in-nigeria": ["AI Training Courses in Nigeria: Practical Guide", "AI training courses in Nigeria"],
  "ai-in-education-courses-in-nigeria": ["AI in Education Courses in Nigeria", "AI in education courses in Nigeria"],
  "best-ai-course-for-beginners-in-nigeria": ["Best AI Course for Beginners in Nigeria", "best AI course for beginners in Nigeria"],
  "what-can-you-sell-with-chatgpt-skills": ["Services You Can Sell With ChatGPT Skills", "sell services with ChatGPT"],
  "how-to-package-an-ai-skill-into-a-simple-service": ["Package an AI Skill Into a Simple Service", "package AI skills as a service"],
  "how-to-build-a-website-with-chatgpt-without-coding": ["Build a Website With ChatGPT Without Coding", "build website with ChatGPT without coding"],
  "how-to-plan-an-app-with-ai-before-building-it": ["Plan an App With AI Before Building It", "plan an app with AI"],
  "how-to-build-a-landing-page-with-ai": ["Build a Landing Page With AI: Practical Guide", "build landing page with AI"],
  "how-to-use-ai-to-create-a-simple-marketing-plan": ["Create a Simple Marketing Plan With AI", "create marketing plan with AI"],
  "how-to-use-ai-to-improve-customer-service": ["Improve Customer Service With AI", "AI for customer service"],
  "how-to-use-ai-to-write-product-descriptions-that-sell": ["Write Product Descriptions That Sell With AI", "AI product descriptions"],
  "should-students-use-chatgpt-a-practical-guide-for-parents-and-teachers": ["Should Students Use ChatGPT? Parent Guide", "should students use ChatGPT"],
  "how-schools-can-introduce-ai-without-encouraging-cheating": ["Introduce AI in Schools Without Cheating", "AI in schools and cheating"],
  "ai-policy-for-schools-what-should-be-included": ["AI Policy for Schools: Practical Checklist", "AI policy for schools"],
  "how-to-build-a-simple-ai-powered-lead-magnet": ["Build an AI-Powered Lead Magnet", "AI-powered lead magnet"],
  "how-to-use-ai-to-start-a-digital-service-business": ["Start a Digital Service Business With AI", "start digital service business with AI"],
  "how-to-price-ai-assisted-services-without-undervaluing-yourself": ["Price AI-Assisted Services With Confidence", "pricing AI-assisted services"]
}

const descriptionsBySlug = {
  "future-proofing-your-classrooms": "Learn how school leaders can introduce practical AI education, protect student privacy, reduce technical friction, and build real-world skills.",
  "the-end-of-theory-only-technology-classes": "Learn why schools should move beyond memorising computer concepts and teach practical AI-assisted digital building through modern technology classes.",
  "why-8-year-olds-are-building-better-websites-than-most-adults": "Discover how children build websites with AI through natural prompting, fearless experimentation, fast feedback, and outcome-first thinking.",
  "no-passwords-no-emails-just-building-the-frictionless-future-of-ai-education": "See how password-free learning can improve student privacy, simplify school onboarding, and create more room for practical AI building.",
  "family-dashboard-for-childrens-online-learning-in-nigeria": "Learn how a family learning dashboard helps Nigerian parents manage access, monitor progress, and evaluate children’s online AI programmes.",
  "how-to-start-an-ai-club-in-a-nigerian-school": "Use this practical guide to start an AI club in a Nigerian school with clear goals, manageable tools, teacher support, and student projects.",
  "how-nigerian-small-businesses-can-build-a-website-with-ai": "Learn how Nigerian small business owners can use AI to plan, write, review, and launch a useful business website without unnecessary complexity.",
  "ai-safety-for-children-in-nigeria": "Teach children practical AI safety rules for privacy, verification, responsible prompting, online learning, and using tools such as ChatGPT safely.",
  "prompt-engineering-for-nigerian-students": "Learn prompt engineering for Nigerian students who want better AI results for schoolwork, websites, portfolios, research, and digital projects.",
  "how-nigerian-schools-can-launch-an-ai-program-without-overwhelming-teachers": "Follow a practical rollout plan for launching a school AI programme in Nigeria without overwhelming teachers or creating avoidable technical confusion.",
  "ai-skills-for-nigerian-teenagers-building-a-portfolio-before-university": "Learn which AI skills help Nigerian teenagers build credible portfolios, websites, and practical digital projects before university or work.",
  "chatgpt-for-nigerian-teachers-lesson-planning-and-classroom-ideas": "Discover practical ways Nigerian teachers can use ChatGPT for lesson planning, examples, student support, classroom preparation, and feedback.",
  "how-to-choose-an-ai-course-for-your-child-in-nigeria": "Use this parent-friendly checklist to choose a safe, practical, age-appropriate AI course for children in Nigeria that produces real outcomes.",
  "holiday-ai-programs-for-children-in-nigeria": "Learn what Nigerian parents should check before choosing a holiday AI programme that helps children build real projects and practical skills.",
  "school-ai-readiness-in-nigeria-checklist-for-principals-and-school-owners": "Use this school AI readiness checklist to assess leadership, teachers, devices, safety, curriculum, and student support before launching in Nigeria.",
  "ai-for-nigerian-small-business-owners-practical-daily-use-cases": "Explore practical ways Nigerian small business owners can use AI for customer replies, product descriptions, planning, staff guidance, and visibility.",
  "how-nigerian-students-can-build-websites-with-chatgpt-without-coding": "Learn how Nigerian students can use ChatGPT to plan and build websites, portfolios, and project pages without previous coding experience.",
  "ai-curriculum-for-nigerian-schools-what-students-should-actually-learn": "Use this practical AI curriculum guide to help Nigerian schools teach responsible prompting, critical thinking, digital building, and real student projects.",
  "the-nigerian-parents-guide-to-ai-skills-for-children": "A practical Nigerian parent’s guide to helping children use AI safely, think critically, build digital projects, and develop useful skills.",
  "how-to-use-chatgpt-as-a-beginner-practical-step-by-step-guide": "Learn how to use ChatGPT as a beginner for planning, learning, writing, research, and business tasks without copying answers blindly.",
  "best-chatgpt-prompts-for-everyday-work": "Use practical ChatGPT prompts for emails, planning, research, meetings, customer replies, reports, learning, and everyday productivity.",
  "chatgpt-vs-gemini-vs-claude-which-ai-tool-should-you-use": "Compare ChatGPT, Gemini, and Claude for writing, research, coding, learning, business tasks, and everyday work before choosing a tool.",
  "how-small-business-owners-can-use-ai-to-save-time-every-week": "Learn how small business owners can use AI to reduce repeated work, improve communication, plan content, document processes, and save time.",
  "chatgpt-prompts-for-business-owners": "Use reusable ChatGPT prompts for customer replies, sales, marketing, proposals, hiring, analysis, follow-up, and business procedures.",
  "how-to-use-ai-to-write-better-whatsapp-and-email-replies": "Learn how to use AI for clearer WhatsApp messages, email replies, customer support, follow-ups, complaint handling, and business communication.",
  "how-to-turn-ai-skills-into-practical-income-opportunities": "Learn realistic ways to make money with AI skills by solving defined problems, packaging useful services, building proof, and delivering reliable outcomes.",
  "artificial-intelligence-course-in-nigeria": "Learn what an artificial intelligence course in Nigeria should teach, who it should serve, and how to choose practical training with real projects.",
  "ai-certification-course-in-nigeria": "Learn how to evaluate an AI certification course in Nigeria for credible assessment, practical skills, verifiable evidence, and useful project work.",
  "ai-training-course-in-nigeria": "Compare AI training courses in Nigeria and learn which practical skills, projects, support, and outcomes matter for work, business, and career growth.",
  "ai-in-education-courses-in-nigeria": "Explore AI in education courses in Nigeria for teachers and schools, including classroom use, policy, privacy, verification, and responsible adoption.",
  "best-ai-course-for-beginners-in-nigeria": "Use this practical checklist to choose the best AI course for beginners in Nigeria based on teaching quality, responsible use, and real projects.",
  "what-can-you-sell-with-chatgpt-skills": "Discover practical services you can sell with ChatGPT skills, including content systems, customer replies, landing pages, procedures, and training.",
  "how-to-package-an-ai-skill-into-a-simple-service": "Learn how to package an AI skill as a clear service with a defined customer, outcome, scope, process, price, proof, and delivery checklist.",
  "how-to-build-a-website-with-chatgpt-without-coding": "Learn how to plan, write, design, review, and launch a useful website with ChatGPT and AI-assisted tools without previous coding experience.",
  "how-to-plan-an-app-with-ai-before-building-it": "Learn how to plan an app with AI by defining users, features, workflows, screens, data, risks, and a realistic minimum viable product before building.",
  "how-to-build-a-landing-page-with-ai": "Learn how to build a landing page with AI by planning one clear offer, writing useful copy, designing the page, testing it, and capturing leads.",
  "how-to-use-ai-to-create-a-simple-marketing-plan": "Learn how to create a simple marketing plan with AI using audience clarity, offers, channels, content themes, lead capture, and weekly execution.",
  "how-to-use-ai-to-improve-customer-service": "Learn how to use AI for customer service templates, FAQs, complaint handling, escalation rules, knowledge bases, and consistent quality checks.",
  "how-to-use-ai-to-write-product-descriptions-that-sell": "Learn how to write product descriptions with AI that explain benefits clearly, answer buyer objections, strengthen trust, and support conversion.",
  "should-students-use-chatgpt-a-practical-guide-for-parents-and-teachers": "A balanced guide for parents and teachers on when students should use ChatGPT, when it harms learning, and which practical rules protect integrity.",
  "how-schools-can-introduce-ai-without-encouraging-cheating": "Learn how schools can introduce AI without encouraging cheating through clear policy, teacher training, disclosure, and better assignment design.",
  "ai-policy-for-schools-what-should-be-included": "Use this practical AI policy checklist for schools covering acceptable use, privacy, cheating, teacher guidance, parent communication, and safeguarding.",
  "how-to-build-a-simple-ai-powered-lead-magnet": "Learn how to build an AI-powered lead magnet that solves a useful problem, attracts the right audience, demonstrates value, and supports a paid offer.",
  "how-to-use-ai-to-start-a-digital-service-business": "Learn how to start a digital service business with AI by choosing a problem, packaging an offer, building proof, finding clients, and delivering well.",
  "how-to-price-ai-assisted-services-without-undervaluing-yourself": "Learn how to price AI-assisted services using value, scope, deliverables, risk, revisions, and proof instead of charging only for time spent."
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function parseJson(value) {
  try {
    const parsed = JSON.parse(value || "{}")
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

async function main() {
  const posts = await prisma.tochukwuBlogPost.findMany({
    where: { blogPublished: true, createdAt: { lte: new Date() } },
    orderBy: { createdAt: "asc" }
  })
  const liveSlugs = new Set(posts.map((post) => post.blogSlug))
  const unmapped = posts.filter((post) => !metadataBySlug[post.blogSlug]).map((post) => post.blogSlug)
  const staleMappings = Object.keys(metadataBySlug).filter((slug) => !liveSlugs.has(slug))
  if (unmapped.length || staleMappings.length) throw new Error(`Metadata map mismatch. Unmapped: ${unmapped.join(", ") || "none"}. Stale: ${staleMappings.join(", ") || "none"}.`)

  const updates = posts.map((post) => {
    const [metaTitle, focusKeyword] = metadataBySlug[post.blogSlug]
    const description = descriptionsBySlug[post.blogSlug]
    const renderedTitleLength = metaTitle.length + titleSuffix.length
    if (renderedTitleLength > 65) throw new Error(`${post.blogSlug} renders a ${renderedTitleLength}-character title.`)
    if (description.length < 120 || description.length > 160) throw new Error(`${post.blogSlug} has a ${description.length}-character description.`)
    const existing = { ...parseJson(post.blogExt2), ...parseJson(post.seoJson) }
    const titleKeyword = clean(post.blogTitle.split(":")[0])
    const keywords = Array.from(new Set([focusKeyword, titleKeyword, ...(Array.isArray(existing.keywords) ? existing.keywords : [])].map(clean).filter(Boolean))).slice(0, 10)
    const seo = {
      ...existing,
      metaTitle,
      seoTitle: metaTitle,
      metaDescription: description,
      focusKeyword,
      keywords,
      imageAlt: `${post.blogTitle} cover illustration`,
      ogTitle: metaTitle,
      ogDescription: description,
      twitterTitle: metaTitle,
      twitterDescription: description
    }
    return { post, seo, renderedTitleLength, descriptionLength: description.length }
  })

  if (apply) {
    await prisma.$transaction(updates.map(({ post, seo }) => prisma.tochukwuBlogPost.update({
      where: { pidBlog: post.pidBlog },
      data: { seoJson: JSON.stringify(seo), blogExt2: JSON.stringify(seo) }
    })))
  }

  const lengths = updates.map((item) => item.descriptionLength)
  process.stdout.write(JSON.stringify({
    mode: apply ? "applied" : "dry-run",
    liveArticles: posts.length,
    completeRecords: updates.length,
    renderedTitleLength: { min: Math.min(...updates.map((item) => item.renderedTitleLength)), max: Math.max(...updates.map((item) => item.renderedTitleLength)) },
    descriptionLength: { min: Math.min(...lengths), max: Math.max(...lengths) }
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
}).finally(() => prisma.$disconnect())
