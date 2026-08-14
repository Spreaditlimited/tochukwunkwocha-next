export type AdvancedUpgradeEmailContent = {
  key: string
  sendDateWat: string
  subject: string
  preheader: string
  paragraphs: string[]
  bullets?: string[]
  primaryLabel: string
  primaryPath: string
  projectLinks?: Array<{ label: string; url: string; description: string }>
}

const coursePath = "/courses/prompt-to-production"
const checkoutPath = "/checkout/prompt-to-production"

export const advancedUpgradeCampaignContent: AdvancedUpgradeEmailContent[] = [
  {
    key: "01-foundation-next-level",
    sendDateWat: "2026-08-14",
    subject: "You are building the foundation. Here is the next level.",
    preheader: "Basic teaches you to build; Advanced teaches you to build software that can grow.",
    paragraphs: [
      "Prompt to Profit Basic is more than an introduction to AI. It teaches learners to work with HTML, CSS and JavaScript, improve what AI generates, publish websites and create simple software.",
      "That foundation proves an idea can become something useful. Prompt to Profit Advanced is the critical next step because larger products must remain organised, secure and maintainable as their users, data and features grow.",
      "Across four weeks, Advanced introduces structured application development, Git and GitHub, reusable components, deeper database and authentication work, testing, payments, deployment and ongoing improvement for web and mobile."
    ],
    primaryLabel: "See the Advanced Course",
    primaryPath: coursePath
  },
  {
    key: "02-learner-proof",
    sendDateWat: "2026-08-17",
    subject: "What learners built after learning the basics",
    preheader: "See the products learners created after moving beyond simple projects.",
    paragraphs: [
      "The strongest evidence for a course is what learners can build after the training. These Advanced learners did not reproduce one classroom template; they used the workflow to solve different real problems.",
      "Basic gave them the ability to start. Advanced helped them organise, connect, test and ship more serious software."
    ],
    projectLinks: [
      { label: "Treshatrendy", url: "https://www.treshatrendy.com/", description: "African fashion store" },
      { label: "Flock", url: "https://flock-church-workforce.vercel.app/", description: "Church operations and people-care platform" },
      { label: "LOTrack", url: "https://lotrack-theta.vercel.app/", description: "Inventory management application" }
    ],
    primaryLabel: "View Advanced Learner Projects",
    primaryPath: `${coursePath}#learner-projects`
  },
  {
    key: "03-foundation-not-ceiling",
    sendDateWat: "2026-08-19",
    subject: "HTML, CSS and JavaScript are the foundation—not the ceiling",
    preheader: "The next skill is keeping a product reliable as it becomes more complex.",
    paragraphs: [
      "Basic teaches learners to generate and refine HTML, CSS and JavaScript. It also reveals an important truth: good results depend on clear instructions and the ability to review what AI produces.",
      "Advanced takes that responsibility further. How should a growing application be organised? How is private data protected? How can one feature change without breaking another? How does a local project become a product people can depend on?",
      "The valuable skill is no longer generating one page. It is guiding AI through the complete product-development process."
    ],
    primaryLabel: "Explore the Advanced Workflow",
    primaryPath: coursePath
  },
  {
    key: "04-pocketbudget",
    sendDateWat: "2026-08-21",
    subject: "Your Basic software is the beginning. Now build this.",
    preheader: "Build one complete expense-tracking product for web and mobile.",
    paragraphs: [
      "Basic software shows how an interface, logic and data can work together. Advanced takes that foundation much further through PocketBudget, a complete expense-tracking application for web and mobile.",
      "Every lesson supports the build, so databases, authentication, dashboards, payments and deployment are learned because the product needs them—not as disconnected technical terms."
    ],
    bullets: ["Secure personal accounts", "Income, expenses, categories and reports", "Live database and payment integration", "Responsive web and mobile applications", "Testing and live deployment"],
    primaryLabel: "See What You Will Build",
    primaryPath: coursePath
  },
  {
    key: "05-depth",
    sendDateWat: "2026-08-24",
    subject: "Basic gives you breadth. Advanced gives you depth.",
    preheader: "46 recorded lessons, four live classes and one complete build.",
    paragraphs: [
      "Basic introduces the build-and-publish journey in a focused format. Production software involves more connected systems and more decisions, so Advanced provides the time and depth the work requires.",
      "The programme combines 46 recorded lessons with four live classes, four weeks of guided learning and one full year of access.",
      "This depth is critical when decisions about project structure, databases, authentication and deployment can affect everything that follows."
    ],
    primaryLabel: "Review the Course Structure",
    primaryPath: coursePath
  },
  {
    key: "06-ready",
    sendDateWat: "2026-08-26",
    subject: "Your Prompt to Profit Basic foundation prepares you for this",
    preheader: "Advanced is the next practical step—not a demand to know everything already.",
    paragraphs: [
      "Prompt to Profit Basic learners are not approaching Advanced without a foundation. They are learning—or have learned—to build with HTML, CSS and JavaScript, work through AI-generated code, correct results and publish useful projects.",
      "Advanced does not require professional coding experience. It applies the same guided, practical learning style to a more serious standard of software using Next.js, Git, GitHub, professional application structure and mobile development."
    ],
    primaryLabel: "Check If Advanced Is Right for You",
    primaryPath: coursePath
  },
  {
    key: "07-codebase",
    sendDateWat: "2026-08-28",
    subject: "From simple project files to a structured codebase",
    preheader: "Learn the structure that makes software easier to improve and maintain.",
    paragraphs: [
      "A small number of HTML, CSS and JavaScript files makes it possible to build and publish quickly. That is the right foundation, but the same structure becomes difficult to manage as a product grows.",
      "Advanced introduces reusable components, clear project organisation, protected settings and Git/GitHub version control. AI becomes more useful because the builder can give it better context, evaluate changes and safely recover when something goes wrong."
    ],
    primaryLabel: "Learn the Professional Workflow",
    primaryPath: coursePath
  },
  {
    key: "08-user-data",
    sendDateWat: "2026-08-31",
    subject: "From a simple database to protected user data",
    preheader: "Go deeper into authentication, databases and user-specific records.",
    paragraphs: [
      "Basic introduces how a simple application can connect to a database, authenticate a user and display information on a dashboard. Advanced develops those ideas as parts of a larger multi-user product.",
      "PocketBudget must identify each user, protect the account, store the correct records and ensure one user cannot see another person’s private data.",
      "The same pattern supports customer portals, school systems, membership platforms, staff tools and booking applications."
    ],
    primaryLabel: "See Everything Included",
    primaryPath: coursePath
  },
  {
    key: "09-mobile",
    sendDateWat: "2026-09-02",
    subject: "Your Basic projects run on the web. Now build for mobile.",
    preheader: "Turn one product into an experience people can use across devices.",
    paragraphs: [
      "Basic focuses on HTML, CSS and JavaScript projects that run in the browser. Advanced extends that foundation because modern users expect useful products to work wherever they are.",
      "After building the web application, learners develop its mobile experience, test it on devices and understand which logic can be shared and which interface decisions must change for mobile.",
      "The question shifts from ‘How will this work in a browser?’ to ‘What complete experience should this product provide?’"
    ],
    primaryLabel: "Build for Web and Mobile",
    primaryPath: checkoutPath
  },
  {
    key: "10-launch",
    sendDateWat: "2026-09-04",
    subject: "Basic teaches you to publish. Advanced teaches you to launch.",
    preheader: "Prepare a larger application for real users and ongoing updates.",
    paragraphs: [
      "Publishing a Basic project to a live address is a major milestone. Launching a larger application adds another level of responsibility.",
      "Before users can rely on a product, important flows must be tested, settings protected, problems diagnosed, performance improved and deployment configured correctly.",
      "Advanced covers practical debugging, web deployment, mobile publishing concepts, payment-gateway integration and managing updates after launch."
    ],
    primaryLabel: "See the Four-Week Curriculum",
    primaryPath: coursePath
  },
  {
    key: "11-guidance",
    sendDateWat: "2026-09-07",
    subject: "The build is more advanced. The guidance is still practical.",
    preheader: "Four live classes help learners keep moving through the project.",
    paragraphs: [
      "The practical, step-by-step guidance used in Basic continues in Advanced. The difference is that the product has more connected parts and naturally raises more questions.",
      "Four live classes complement the 46 recorded lessons to reinforce the workflow, address common difficulties and help learners develop judgment rather than merely follow clicks."
    ],
    primaryLabel: "Join the Guided October Cohort",
    primaryPath: checkoutPath
  },
  {
    key: "12-one-year",
    sendDateWat: "2026-09-09",
    subject: "Advanced is deeper—so access lasts for one year",
    preheader: "The four-week cohort ends; access to the recorded lessons does not.",
    paragraphs: [
      "Advanced concepts do not have to be memorised at once. A database lesson may make more sense after another independent project. Git may become more valuable when a codebase grows. Deployment may need revisiting when a client product is ready.",
      "The cohort provides four weeks of structure and momentum. One full year of access provides room to practise, repeat and apply the workflow to future products."
    ],
    primaryLabel: "Get One Year of Advanced Access",
    primaryPath: checkoutPath
  },
  {
    key: "13-francis-proof",
    sendDateWat: "2026-09-11",
    subject: "“Your course shifted me from ideas to shipping products.”",
    preheader: "Francis used the Advanced workflow to build operational software.",
    paragraphs: [
      "Francis Balogun described Prompt to Profit Advanced as the turning point that shifted him from thinking about ideas to shipping actual products.",
      "He first built a restaurant margin-intelligence solution and then built Flock, a platform for church management, operations and people care.",
      "The class project creates a structured environment for learning. The deeper outcome is a repeatable process that can be applied to a learner’s own sector and ideas."
    ],
    primaryLabel: "See What Advanced Learners Built",
    primaryPath: `${coursePath}#learner-projects`
  },
  {
    key: "14-louis-proof",
    sendDateWat: "2026-09-14",
    subject: "From learning the concepts to launching LOTrack",
    preheader: "Louis turned the Advanced workflow into an inventory application.",
    paragraphs: [
      "Louis Obinna Odionye used what he learned in Advanced to build LOTrack, his own inventory-management application.",
      "He said the knowledge, practical approach and guidance gave him the confidence to turn an idea into a real product.",
      "Confidence comes from working through the complete process: setting up the project, building features, diagnosing problems, connecting systems and seeing the result live."
    ],
    primaryLabel: "Start Your Advanced Build",
    primaryPath: checkoutPath
  },
  {
    key: "15-certificate-proof",
    sendDateWat: "2026-09-16",
    subject: "Your certificate should point to evidence",
    preheader: "Complete a project that demonstrates what was actually built.",
    paragraphs: [
      "Basic projects provide visible proof that a learner can build with AI. Advanced strengthens that proof through a more sophisticated product and professional workflow.",
      "The Advanced certificate is project-based. It can connect to verifiable evidence of the submitted work so a client, employer or collaborator can examine more than a line on a CV."
    ],
    primaryLabel: "Build Work You Can Show",
    primaryPath: coursePath
  },
  {
    key: "16-offer-value",
    sendDateWat: "2026-09-18",
    subject: "Your Basic-student price for Prompt to Profit Advanced",
    preheader: "Use the dedicated discount and choose full or installment payment.",
    paragraphs: [
      "Advanced is not a payment to repeat Basic. It is an investment in the next layer: structured web and mobile development, professional tools, deeper data and authentication work, testing, payments and production deployment.",
      "The standard fee is ₦150,000. Eligible learners from completed Basic cohorts receive ₦50,000 off and pay ₦100,000 with the dedicated campaign code."
    ],
    primaryLabel: "Claim the Basic-Student Price",
    primaryPath: checkoutPath
  },
  {
    key: "17-time",
    sendDateWat: "2026-09-21",
    subject: "“What if I cannot keep up?”",
    preheader: "Four-week structure and one-year access provide momentum and breathing room.",
    paragraphs: [
      "Basic shows that building requires attention and practice. Advanced does not hide that reality; it gives the larger project a clear sequence.",
      "Week 1 establishes the professional environment. Week 2 builds the web application. Week 3 develops mobile. Week 4 tests, deploys and prepares the product for launch.",
      "Recorded lessons can be paused and repeated, live classes provide guidance, and one-year access means a difficult week does not take the learning away."
    ],
    primaryLabel: "Review the Learning Structure",
    primaryPath: coursePath
  },
  {
    key: "18-fit",
    sendDateWat: "2026-09-23",
    subject: "Who should join the October Advanced cohort?",
    preheader: "A straightforward way to decide whether this is the next step.",
    paragraphs: [
      "Advanced is designed for learners who can confidently follow the Basic building process and are ready to move beyond websites and guided simple software.",
      "It is a strong fit for someone ready to practise, understand application structure, work with databases and authentication more deeply, build for web and mobile and develop a repeatable route from idea to deployment.",
      "Learners who still need confidence with the practical Basic lessons should finish and practise that foundation first."
    ],
    primaryLabel: "Join the October Advanced Cohort",
    primaryPath: checkoutPath
  },
  {
    key: "19-ten-days",
    sendDateWat: "2026-09-25",
    subject: "Ten days until Prompt to Profit Advanced begins",
    preheader: "Move from the Basic foundation to a complete web-and-mobile build.",
    paragraphs: [
      "The October cohort starts on Monday, 5 October at 7:00 PM WAT.",
      "This is the next structured stage for Basic learners ready to organise larger codebases, separate user data, manage changes safely, integrate payments and deploy products across web and mobile.",
      "The dedicated Basic-student offer reduces the fee from ₦150,000 to ₦100,000."
    ],
    primaryLabel: "Enroll for October",
    primaryPath: checkoutPath
  },
  {
    key: "20-one-week",
    sendDateWat: "2026-09-28",
    subject: "One week until Prompt to Profit Advanced begins",
    preheader: "Here is exactly what the October enrollment includes.",
    paragraphs: [
      "The October Advanced cohort begins in one week: Monday, 5 October at 7:00 PM WAT.",
      "Enrollment includes 46 recorded lessons, four live classes, a four-week curriculum, one year of access, a complete web-and-mobile project, Git/GitHub, databases, authentication, dashboards, payments, testing, deployment and a project-based certificate.",
      "Eligible learners from completed Basic cohorts pay ₦100,000 after the ₦50,000 campaign discount."
    ],
    primaryLabel: "Enroll for the October Cohort",
    primaryPath: checkoutPath
  },
  {
    key: "21-five-days",
    sendDateWat: "2026-09-30",
    subject: "Five days until the Advanced cohort begins",
    preheader: "The next build can become more than a simple web project.",
    paragraphs: [
      "In five days, learners begin the journey from setting up a professional development environment to deploying a complete web and mobile application.",
      "This is for Basic learners who understand what AI can generate and now want to understand how larger applications are structured, secured, tested and launched.",
      "Professional coding experience is not required. A strong Basic foundation, curiosity and willingness to work through the project are required."
    ],
    primaryLabel: "Secure Your Place",
    primaryPath: checkoutPath
  },
  {
    key: "22-final-weekend",
    sendDateWat: "2026-10-02",
    subject: "The October Advanced cohort starts on Monday",
    preheader: "The final weekend before the guided cohort begins at 7:00 PM WAT.",
    paragraphs: [
      "This is the final weekend before Prompt to Profit Advanced begins on Monday, 5 October at 7:00 PM WAT.",
      "Basic learners who are ready for structured web and mobile applications, deeper database work, secure accounts, payment flows and production deployment can still join the cohort.",
      "The Basic-student campaign code reduces the ₦150,000 fee to ₦100,000, and installment payment is available."
    ],
    primaryLabel: "Enroll Before Monday",
    primaryPath: checkoutPath
  },
  {
    key: "23-starts-today",
    sendDateWat: "2026-10-05",
    subject: "Prompt to Profit Advanced starts today at 7:00 PM WAT",
    preheader: "Final opportunity to join the October guided cohort before class begins.",
    paragraphs: [
      "Prompt to Profit Advanced begins today at 7:00 PM WAT.",
      "This is the final campaign message for Basic learners ready to turn their HTML, CSS, JavaScript and simple-software foundation into structured web and mobile product development.",
      "Enrollment remains available before class. The Basic-student campaign code reduces the fee to ₦100,000, and an installment plan can be started from the dashboard."
    ],
    primaryLabel: "Join Before Class Starts",
    primaryPath: checkoutPath
  }
]
