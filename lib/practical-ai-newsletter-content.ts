export type PracticalAiNewsletterEmail = {
  week: number
  key: string
  subject: string
  preheader: string
  paragraphs: string[]
  primaryLabel: string
  primaryPath: string
  project?: {
    title: string
    description: string
    path: string
    youngLearner?: boolean
  }
}

// Editorial contract:
// - The newsletter shows what is possible, why it matters, and what good work looks like.
// - It never supplies the course's complete prompts, build steps, code, or project methodology.
// - Each email has one primary next step, selected only when it follows naturally from the topic.
export const practicalAiNewsletterContent: PracticalAiNewsletterEmail[] = [
  {
    week: 1,
    key: "one-useful-outcome",
    subject: "The best place to begin with AI is smaller than you think",
    preheader: "Useful progress usually starts with one real outcome, not dozens of tools.",
    paragraphs: [
      "AI can look overwhelming when every week brings another tool, feature or dramatic prediction. The people who make useful progress usually begin somewhere much smaller: one real problem they understand.",
      "That problem might be slow customer replies, scattered business information, a website that no longer explains the offer clearly, or an idea that has never moved beyond a notebook. The important shift is from asking what AI can do in general to asking what useful result would matter now.",
      "This newsletter will keep showing practical examples of people using AI to move from ideas to visible results—without pretending that one clever instruction replaces judgment, practice or proper guidance."
    ],
    primaryLabel: "See What Learners Have Built",
    primaryPath: "/projects"
  },
  {
    week: 2,
    key: "clarity-before-output",
    subject: "Why impressive AI answers can still be useless",
    preheader: "A polished answer is not the same thing as the right answer.",
    paragraphs: [
      "AI is very good at producing something that looks finished. That can make a weak answer feel more useful than it really is.",
      "The difference is usually clarity. Who is the work for? What should it achieve? What information is missing? What must not be assumed? These are judgment questions, not magic words.",
      "Prompt to Profit develops that judgment through practical building. Learners do not simply accept what AI produces; they learn to examine it, improve it and connect each decision to a real project outcome."
    ],
    primaryLabel: "Explore Prompt to Profit",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 3,
    key: "repeated-work",
    subject: "The repeated work hiding in plain sight",
    preheader: "A task you repeat may be a better AI opportunity than a brand-new idea.",
    paragraphs: [
      "Many useful AI opportunities are already visible in the work people repeat: answering familiar questions, organising notes, preparing routine updates or turning rough information into something another person can understand.",
      "The goal is not to hand over responsibility. It is to reduce avoidable repetition while keeping a person responsible for accuracy, tone and decisions.",
      "For business owners, this is often the most valuable starting point: practical improvement inside work that already exists."
    ],
    primaryLabel: "See AI for Everyday Business Owners",
    primaryPath: "/courses/ai-for-everyday-business-owners"
  },
  {
    week: 4,
    key: "ideas-need-structure",
    subject: "A good idea is not yet a buildable project",
    preheader: "Structure is what turns enthusiasm into something people can actually use.",
    paragraphs: [
      "It is easy to describe an ambitious website or application. The harder and more valuable work is deciding who it serves, what it must do first and what can wait.",
      "Learner projects make this visible. A finished project is evidence that someone moved beyond an exciting idea and made a series of practical decisions until the result worked online.",
      "That decision-making process is one of the reasons Prompt to Profit is taught through projects rather than disconnected AI demonstrations."
    ],
    project: {
      title: "M-Philz Wears",
      description: "A live learner website that demonstrates how an idea can become visible, shareable proof.",
      path: "/projects"
    },
    primaryLabel: "View the Student Projects",
    primaryPath: "/projects"
  },
  {
    week: 5,
    key: "small-projects-count",
    subject: "A small finished project beats a large unfinished plan",
    preheader: "Finishing creates evidence, feedback and confidence.",
    paragraphs: [
      "Beginners often think their first project must contain every feature they have seen elsewhere. The result is usually a plan too large to finish.",
      "A smaller project can still be serious. A clear page, useful tool or focused business system can solve one problem well and give its builder something real to test and improve.",
      "The important milestone is not how complicated the idea sounds. It is whether another person can open it, understand it and use it."
    ],
    primaryLabel: "Discover the Beginner Building Course",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 6,
    key: "clear-offers",
    subject: "AI cannot rescue an offer nobody understands",
    preheader: "Clear thinking has to come before polished language.",
    paragraphs: [
      "AI can make almost any paragraph sound polished. It cannot decide on your behalf who an unclear offer is for or why that person should care.",
      "That is why the most useful business work often happens before writing: listening to customers, understanding the problem and choosing a believable outcome.",
      "AI becomes valuable after those decisions are grounded in reality. It can help organise and refine the message, but the business owner still supplies the judgment."
    ],
    primaryLabel: "Explore Practical AI for Business",
    primaryPath: "/courses/ai-for-everyday-business-owners"
  },
  {
    week: 7,
    key: "questions-reveal-needs",
    subject: "The questions people ask are useful evidence",
    preheader: "Repeated questions reveal where people need clarity.",
    paragraphs: [
      "A repeated question is rarely just an interruption. It is evidence that something important is unclear.",
      "Customer questions can reveal missing information on a website. Parent questions can reveal what a school needs to explain. Student questions can reveal where a lesson needs another example.",
      "AI can help people organise patterns across those questions, but the best response still comes from experience and an honest understanding of the audience."
    ],
    primaryLabel: "Read the Latest Practical Guides",
    primaryPath: "/blog"
  },
  {
    week: 8,
    key: "dashboards-support-decisions",
    subject: "A dashboard is valuable only when it helps someone decide",
    preheader: "More charts do not automatically create more clarity.",
    paragraphs: [
      "A dashboard can look impressive and still leave its user unsure what to do next. Its real value is helping someone notice a problem, understand a situation or take an action sooner.",
      "That is what makes practical software different from a visual demonstration. The builder must understand the people, records and decisions behind the screen.",
      "The Hybrid Academy Inventory & Fee Manager is a learner example of moving beyond a page and towards a tool connected to real operational needs."
    ],
    project: {
      title: "Hybrid Academy Inventory & Fee Manager",
      description: "A learner-built system showing how AI-assisted building can address a real organisational need.",
      path: "/projects"
    },
    primaryLabel: "See More Learner Projects",
    primaryPath: "/projects"
  },
  {
    week: 9,
    key: "verification-is-a-skill",
    subject: "AI confidence should include the confidence to check",
    preheader: "Useful AI work depends on verification, not blind trust.",
    paragraphs: [
      "AI can sound certain while missing context, inventing a detail or producing something that fails when used. Responsible users expect to check the result.",
      "A writer checks facts and promises. A business owner checks whether advice fits the market. A builder tests what the project actually does. A learner should be able to explain the work rather than merely submit it.",
      "Verification is not a sign that AI has failed. It is part of using a powerful tool with judgment."
    ],
    primaryLabel: "Read More Practical AI Notes",
    primaryPath: "/blog"
  },
  {
    week: 10,
    key: "automation-needs-ownership",
    subject: "Good automation still needs a responsible owner",
    preheader: "The best automated systems make failures visible instead of hiding them.",
    paragraphs: [
      "Automation is often described as work that happens without people. In practice, reliable automation makes routine movement easier while making exceptions easier for a person to see and resolve.",
      "A useful system should not quietly lose a request, grant the wrong access or leave a customer wondering what happened. Someone must still understand the process and own the outcome.",
      "Prompt to Profit Advanced is designed for learners ready to think more deeply about connected systems, protected data and production-quality applications."
    ],
    primaryLabel: "Explore Prompt to Profit Advanced",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 11,
    key: "proof-before-claims",
    subject: "A live project says more than “I know AI”",
    preheader: "Proof gives clients, employers and collaborators something concrete to examine.",
    paragraphs: [
      "It is easy to add AI to a profile or CV. It is much more convincing to show a useful project and explain the problem it addresses.",
      "A project does not have to be enormous. It needs to be understandable, functional and genuinely connected to the skill being claimed.",
      "The public Student Projects collection exists for that reason: it shows outcomes rather than asking people to accept promises."
    ],
    primaryLabel: "Browse Student Projects",
    primaryPath: "/projects"
  },
  {
    week: 12,
    key: "choose-the-right-path",
    subject: "Choose the learning path that matches what you want to build",
    preheader: "A course and a project workbook solve different learning needs.",
    paragraphs: [
      "Some learners need a guided foundation: how to work with AI, understand what it produces and complete a first live project. Prompt to Profit is designed for that journey.",
      "Others already know the foundations and want to complete one specific business application. The Prompt to Profit workbooks provide a focused, project-by-project route.",
      "The right next step is not the product with the longest feature list. It is the one that matches your present confidence and the result you are ready to finish."
    ],
    primaryLabel: "Compare Courses and Workbooks",
    primaryPath: "/shop"
  },
  {
    week: 13,
    key: "ideas-become-visible",
    subject: "What changes when an idea becomes visible",
    preheader: "A live project creates feedback that an idea alone cannot provide.",
    paragraphs: [
      "An idea in a notebook can feel perfect because nobody has tried to use it. A live project creates a different kind of learning: people can see it, respond to it and reveal what needs improvement.",
      "That is why publishing matters. The first version does not have to represent the final ambition. It simply has to make the idea real enough to learn from.",
      "Every project in the Student Projects collection represents that transition from private possibility to public proof."
    ],
    primaryLabel: "See the Projects",
    primaryPath: "/projects"
  },
  {
    week: 14,
    key: "young-builders-create",
    subject: "Young learners can be creators, not only technology consumers",
    preheader: "Building changes a young person's relationship with technology.",
    paragraphs: [
      "Children and teenagers already spend time with digital products. Learning to build gives them a new question to ask: how was this made, and what could I create myself?",
      "Bear & Harvest: Cozy Kitchen is one example from a young learner. The important point is not that every young person must become a software developer. It is that they can practise creativity, logic and persistence through something they can share.",
      "A finished project makes that change in confidence visible."
    ],
    project: {
      title: "Bear & Harvest: Cozy Kitchen",
      description: "A public young-learner project that shows imagination becoming a live digital experience.",
      path: "https://bear-harest.netlify.app/",
      youngLearner: true
    },
    primaryLabel: "View Bear & Harvest",
    primaryPath: "https://bear-harest.netlify.app/"
  },
  {
    week: 15,
    key: "beginner-myth",
    subject: "The beginner myth that stops good ideas too early",
    preheader: "You do not need to know everything before you begin learning to build.",
    paragraphs: [
      "Many capable people assume digital building belongs to those who started coding years ago. That belief can stop them before they test what guided, practical learning makes possible.",
      "Beginners still need patience. They will meet unfamiliar words, make mistakes and revisit lessons. But being new is not evidence that they are unable to learn.",
      "A well-designed beginner programme reduces unnecessary confusion while keeping the learner responsible for understanding and finishing the work."
    ],
    primaryLabel: "See the Beginner Course",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 16,
    key: "first-project-invitation",
    subject: "Your first project does not need to prove everything",
    preheader: "It needs to prove that you can move from an idea to a working result.",
    paragraphs: [
      "The pressure to create something extraordinary can prevent people from finishing something useful.",
      "A first project can demonstrate clear thinking, attention to users and the ability to improve work after testing it. Those are foundations that carry into larger projects later.",
      "Prompt to Profit provides the guided environment for complete beginners to build that first piece of evidence."
    ],
    primaryLabel: "Start with Prompt to Profit",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 17,
    key: "technology-and-wellbeing",
    subject: "Technology can express care as well as efficiency",
    preheader: "Useful digital ideas are not limited to business administration.",
    paragraphs: [
      "When people imagine software, they often picture payments, reports and office systems. Digital projects can also communicate an idea, encourage reflection or support wellbeing.",
      "Wellness Garden, created by a young learner, is a reminder that the project begins with the human experience someone wants to create—not with a list of technologies.",
      "That wider imagination is one of the most encouraging things about giving young people the opportunity to build."
    ],
    project: {
      title: "Wellness Garden",
      description: "A public young-learner project exploring a thoughtful digital experience.",
      path: "https://welfareworld.netlify.app/wellness",
      youngLearner: true
    },
    primaryLabel: "Visit Wellness Garden",
    primaryPath: "https://welfareworld.netlify.app/wellness"
  },
  {
    week: 18,
    key: "parents-see-possibility",
    subject: "What parents notice when a child builds something real",
    preheader: "The finished page is visible; the confidence behind it matters too.",
    paragraphs: [
      "A public project gives a parent something concrete to see, but the less visible progress may be just as important.",
      "Building asks a young learner to make choices, notice problems, try again and explain what they intended. Those habits extend beyond one website or application.",
      "The goal is not to rush children into a career decision. It is to let them experience technology as a medium for creating and solving problems."
    ],
    primaryLabel: "Explore Prompt to Profit for Families",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 19,
    key: "school-innovation",
    subject: "A school technology programme should produce visible work",
    preheader: "Projects help schools move from technology awareness to applied learning.",
    paragraphs: [
      "Students can attend a technology talk, remember a few new terms and still never experience what it means to create something.",
      "Project-based learning changes the evidence. Schools can see what students attempted, how they responded to feedback and what they were able to publish.",
      "That visible work gives teachers and families a stronger basis for encouraging the learner's next step."
    ],
    primaryLabel: "Explore Prompt to Profit for Schools",
    primaryPath: "/courses/prompt-to-profit-schools"
  },
  {
    week: 20,
    key: "smartstock-proof",
    subject: "A young learner looked at stock management and saw a project",
    preheader: "Real operational problems can inspire young builders too.",
    paragraphs: [
      "SmartStock is a young-learner project built around an idea familiar to many organisations: keeping track of stock.",
      "The project is valuable as proof of possibility. A young person can look at an everyday process, recognise that technology could support it and turn that thought into something others can open and examine.",
      "The course contains the guided learning. The public project shows the kind of confidence that learning can unlock."
    ],
    project: {
      title: "SmartStock",
      description: "A public inventory-themed project built by a young learner.",
      path: "https://exquisite-cajeta-af63da.netlify.app/",
      youngLearner: true
    },
    primaryLabel: "View SmartStock",
    primaryPath: "https://exquisite-cajeta-af63da.netlify.app/"
  },
  {
    week: 21,
    key: "business-problems-have-shape",
    subject: "A useful business tool begins with a specific frustration",
    preheader: "Specific problems create clearer projects than broad ambitions.",
    paragraphs: [
      "“I want software for my business” is an ambition. “I cannot easily see where money is going” is a problem with a recognisable shape.",
      "Specific frustrations help a builder understand who needs the tool and what result would make it worthwhile. They also make it easier to judge whether the finished project is genuinely useful.",
      "The Prompt to Profit workbooks each begin with one defined business problem and guide the learner through a complete application."
    ],
    primaryLabel: "Browse the Software Workbooks",
    primaryPath: "/shop"
  },
  {
    week: 22,
    key: "expense-visibility",
    subject: "What changes when spending becomes visible",
    preheader: "Records become more useful when they support understanding.",
    paragraphs: [
      "Many individuals and small businesses record expenses inconsistently or only examine them when a problem appears.",
      "An expense-tracking application represents a useful software idea because it turns individual entries into a clearer picture of spending. The value is not the form itself; it is the visibility created over time.",
      "The Expense Tracker Workbook is for learners who want the complete, guided project rather than a surface-level demonstration."
    ],
    primaryLabel: "See the Expense Tracker Workbook",
    primaryPath: "/shop/expense-tracker-workbook"
  },
  {
    week: 23,
    key: "software-is-not-features",
    subject: "More features do not automatically make software more useful",
    preheader: "A focused tool can serve its user better than a crowded one.",
    paragraphs: [
      "Feature lists are easy to expand because every new idea sounds valuable in isolation. The result can become harder to understand, test and maintain.",
      "Useful software earns complexity. It solves the central problem first, then grows in response to evidence from real use.",
      "This is why a completed focused application is such a strong learning project: every feature has to justify its place in the user's journey."
    ],
    primaryLabel: "See Finished Learner Projects",
    primaryPath: "/projects"
  },
  {
    week: 24,
    key: "workbook-or-course",
    subject: "When a project workbook is the better next step",
    preheader: "Sometimes the goal is not another broad course—it is one completed application.",
    paragraphs: [
      "A learner who already understands the basic building process may not need to restart from the beginning each time a new business idea appears.",
      "A focused workbook makes sense when the learner wants one clearly defined application, a complete project journey and something useful to add to a growing portfolio.",
      "The workbook does the teaching. The newsletter simply helps you recognise which project matches the problem you care about."
    ],
    primaryLabel: "Compare the Available Workbooks",
    primaryPath: "/shop"
  },
  {
    week: 25,
    key: "customer-information",
    subject: "Customer information becomes a problem before businesses notice it",
    preheader: "Scattered records make ordinary customer service harder than it should be.",
    paragraphs: [
      "A phone number in one conversation, an address in another and an important note remembered by only one person may work while a business is very small.",
      "As activity grows, scattered information creates delays, mistakes and dependence on memory. A customer-record system is valuable because it gives important information a reliable home.",
      "Recognising that operational problem is the first step. Building the complete secure application is the work covered by the dedicated workbook."
    ],
    primaryLabel: "See the Customer Record Workbook",
    primaryPath: "/shop/customer-record-management-system-workbook"
  },
  {
    week: 26,
    key: "customer-system-proof",
    subject: "Software can make a small business feel more organised",
    preheader: "Professional operations are often built from quiet improvements.",
    paragraphs: [
      "Customers may never see the database behind a business, but they feel the result when information is found quickly and communication is consistent.",
      "That is an important lesson from business-software projects: not every valuable feature is dramatic. Reliability, clarity and fewer avoidable mistakes can be the real transformation.",
      "A complete customer-record project gives a learner both a practical tool and evidence of their ability to build around real operations."
    ],
    primaryLabel: "Explore the Customer Record Project",
    primaryPath: "/shop/customer-record-management-system-workbook"
  },
  {
    week: 27,
    key: "data-deserves-care",
    subject: "Useful software must respect the information people trust it with",
    preheader: "Collecting data creates responsibility as well as capability.",
    paragraphs: [
      "A system that stores names, contact details or business records is doing more than displaying an interface. People are trusting it with information that matters.",
      "That makes privacy, access and accuracy part of the product—not technical details to consider only after the design looks finished.",
      "The deeper a project moves into real records and real users, the more important guided learning and careful testing become."
    ],
    primaryLabel: "Explore Advanced Application Building",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 28,
    key: "operations-before-ai",
    subject: "AI exposes unclear business processes",
    preheader: "A tool cannot reliably organise a process nobody can explain.",
    paragraphs: [
      "When a business process lives entirely in one person's memory, asking AI to automate it often reveals how many rules were never written down.",
      "That discovery is useful. Before technology can support a process, the owner needs to understand what should happen, where judgment is required and what a good outcome looks like.",
      "Practical AI is therefore not only about speed. It can also force clearer thinking about how work is actually done."
    ],
    primaryLabel: "Explore AI for Everyday Business Owners",
    primaryPath: "/courses/ai-for-everyday-business-owners"
  },
  {
    week: 29,
    key: "professional-quotations",
    subject: "A quotation shapes the customer's first impression of the work",
    preheader: "Professional presentation supports trust before a project begins.",
    paragraphs: [
      "A customer often sees a quotation before they experience the service itself. Confusing calculations or an inconsistent document can weaken confidence at an important moment.",
      "A quotation generator is a useful project because it connects business presentation with dependable calculation and record keeping.",
      "The complete application involves more than formatting a page, which is why the full build belongs inside the Professional Quotation Generator Workbook."
    ],
    primaryLabel: "See the Quotation Generator Workbook",
    primaryPath: "/shop/professional-quotation-generator-workbook"
  },
  {
    week: 30,
    key: "documents-as-systems",
    subject: "A business document can be part of a real system",
    preheader: "The visible document is only one part of the workflow.",
    paragraphs: [
      "A professional quotation may look like a single document, but useful software has to support everything around it: accurate details, calculations, saving, finding, editing and presenting the result consistently.",
      "That is what makes the project educational. The learner is not merely designing a printable page; they are thinking about a repeatable business process.",
      "Projects like this help bridge the gap between learning isolated technical ideas and building something a business could actually use."
    ],
    primaryLabel: "Explore the Complete Workbook",
    primaryPath: "/shop/professional-quotation-generator-workbook"
  },
  {
    week: 31,
    key: "professional-does-not-mean-complex",
    subject: "Professional does not have to mean complicated",
    preheader: "Clarity and reliability often matter more than decoration.",
    paragraphs: [
      "People sometimes add complexity because they want a project to feel professional. Extra screens, effects and options can instead make ordinary work harder.",
      "Professional software communicates clearly, behaves predictably and helps the user finish the task with confidence.",
      "That standard is useful for every builder, whether the project is a first workbook application or a larger product intended for many users."
    ],
    primaryLabel: "View Practical Software Projects",
    primaryPath: "/projects"
  },
  {
    week: 32,
    key: "specific-project-confidence",
    subject: "Confidence grows differently when the project has a real purpose",
    preheader: "A defined business problem gives learning something concrete to serve.",
    paragraphs: [
      "Technical concepts can feel abstract when they are taught without a reason to use them.",
      "Inside a complete project, each new idea answers a practical need. The learner understands why information must be saved, why calculations must be checked and why the user's path matters.",
      "That is the purpose of the workbook series: one useful application at a time, with the complete instruction kept where it belongs."
    ],
    primaryLabel: "Browse the Workbook Series",
    primaryPath: "/shop"
  },
  {
    week: 33,
    key: "invoice-confidence",
    subject: "An invoice should make the next step obvious",
    preheader: "Clear records support both professionalism and payment.",
    paragraphs: [
      "An invoice has a practical job: explain what is being charged, preserve the relevant details and help both parties understand what happens next.",
      "When invoices are prepared inconsistently, businesses can lose time correcting avoidable mistakes or answering questions that the document should already address.",
      "A dedicated invoice application is therefore a meaningful software project, not simply a prettier document."
    ],
    primaryLabel: "See the Invoice Generator Workbook",
    primaryPath: "/shop/professional-invoice-generator-workbook"
  },
  {
    week: 34,
    key: "invoice-system-proof",
    subject: "The best business tools remove uncertainty",
    preheader: "A useful system helps people trust the information in front of them.",
    paragraphs: [
      "Business software earns trust through small, consistent behaviours: calculations are correct, saved information can be found and printed output matches what appears on screen.",
      "Those details may not create dramatic screenshots, but they determine whether someone can depend on the tool.",
      "Building an invoice generator gives a learner a practical way to experience that responsibility from the inside."
    ],
    primaryLabel: "Explore the Invoice Project",
    primaryPath: "/shop/professional-invoice-generator-workbook"
  },
  {
    week: 35,
    key: "test-the-boring-parts",
    subject: "The boring parts are often where trust is won",
    preheader: "Reliable projects pay attention to ordinary actions and awkward cases.",
    paragraphs: [
      "People naturally want to demonstrate the most exciting part of a project. Real users also need the ordinary parts to work: returning later, correcting a mistake, finding an older record and understanding an error.",
      "Testing those moments is not glamorous, but it separates a demonstration from a dependable tool.",
      "As learners progress towards more advanced applications, that habit of careful checking becomes increasingly important."
    ],
    primaryLabel: "Learn About the Advanced Course",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 36,
    key: "portfolio-business-tools",
    subject: "A portfolio project can demonstrate business understanding",
    preheader: "The strongest projects reveal more than technical vocabulary.",
    paragraphs: [
      "A quotation or invoice system tells a useful story in a portfolio. It shows that the builder can understand a workflow, organise records and care about the experience of the person using the result.",
      "That story becomes stronger when the project is live and the learner can explain the decisions behind it.",
      "Clients and employers may not care which lesson introduced a concept. They care whether the builder can turn understanding into a reliable outcome."
    ],
    primaryLabel: "See What Learners Have Published",
    primaryPath: "/projects"
  },
  {
    week: 37,
    key: "booking-friction",
    subject: "Every unnecessary booking message is a small piece of friction",
    preheader: "A clear booking experience can save time for the business and customer.",
    paragraphs: [
      "Service businesses often arrange appointments through long message exchanges: Which day? What time? Is the slot still free? Was the booking recorded?",
      "A booking system is useful because it gives that process a shared structure. Customers can understand the available path and the business can manage requests more consistently.",
      "The full project belongs in the Appointment Booking System Workbook, where the learner builds the complete workflow."
    ],
    primaryLabel: "See the Booking System Workbook",
    primaryPath: "/shop/appointment-booking-system-workbook"
  },
  {
    week: 38,
    key: "service-experience",
    subject: "Software becomes part of the service experience",
    preheader: "Customers judge the process as well as the final service.",
    paragraphs: [
      "A customer begins experiencing a service before the appointment itself. Clear information, a straightforward request and timely confirmation all influence trust.",
      "That means a booking application is not only an administrative convenience. It is one of the places where a business communicates how organised and considerate it is.",
      "Building around that human experience produces a stronger project than beginning with technology alone."
    ],
    primaryLabel: "Explore the Appointment Project",
    primaryPath: "/shop/appointment-booking-system-workbook"
  },
  {
    week: 39,
    key: "automation-with-fallbacks",
    subject: "What should happen when an automated step fails?",
    preheader: "Responsible systems make exceptions visible to people.",
    paragraphs: [
      "A confirmation may fail to send. A payment may need review. A requested time may become unavailable. Real systems eventually meet an exception.",
      "A responsible product does not pretend those cases cannot happen. It gives the user a clear message and gives the owner a way to understand and resolve the problem.",
      "This kind of thinking becomes central when learners move from simple projects towards production applications."
    ],
    primaryLabel: "Explore Prompt to Profit Advanced",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 40,
    key: "service-workbook-choice",
    subject: "Choose a workbook by the problem you want to solve",
    preheader: "The application should match a real interest or operational need.",
    paragraphs: [
      "One learner may care about appointments because they work with a salon, clinic or consultant. Another may care more about quotations, customers or expenses.",
      "Choosing a relevant project makes it easier to stay engaged and evaluate the result. The learner already understands why the application should exist.",
      "Each workbook is self-contained, so the best starting point is the project whose problem feels most meaningful now."
    ],
    primaryLabel: "Choose Your Workbook",
    primaryPath: "/shop"
  },
  {
    week: 41,
    key: "portfolio-evidence",
    subject: "A portfolio should make your contribution easy to understand",
    preheader: "A live link is stronger when it is accompanied by a clear project story.",
    paragraphs: [
      "Showing a project is useful. Explaining it makes the evidence stronger: what problem did it address, who was it for and what did the builder learn while improving it?",
      "That explanation helps another person see beyond the colours on the screen and understand the thinking represented by the work.",
      "The public Student Projects collection gives learners a place where completed work can speak for their growing ability."
    ],
    primaryLabel: "Browse the Student Portfolios",
    primaryPath: "/projects"
  },
  {
    week: 42,
    key: "showing-growth",
    subject: "Your earliest project does not need to disappear",
    preheader: "A portfolio can show development, not only perfection.",
    paragraphs: [
      "People sometimes hide their first project as soon as they build something more advanced. But the contrast between projects can tell an honest story of progress.",
      "The early work shows where the learner began. Later work shows new judgment, stronger structure and the ability to manage more responsibility.",
      "Growth is itself meaningful evidence—especially when the learner can explain what changed and why."
    ],
    primaryLabel: "See Different Learner Journeys",
    primaryPath: "/projects"
  },
  {
    week: 43,
    key: "project-before-certificate",
    subject: "A certificate is stronger when it points to completed work",
    preheader: "Evidence gives a learning credential practical meaning.",
    paragraphs: [
      "A certificate can confirm that someone completed a learning requirement. A project helps another person understand what that learning enabled them to do.",
      "That is why Prompt to Profit certificates are connected to project completion rather than attendance alone.",
      "The goal is not simply to finish lessons. It is to emerge with something visible that can support a conversation with a client, employer, school or collaborator."
    ],
    primaryLabel: "See the Project-Based Course",
    primaryPath: "/courses/prompt-to-profit"
  },
  {
    week: 44,
    key: "next-portfolio-project",
    subject: "What should your next portfolio project prove?",
    preheader: "Choose the next build for the evidence it will add.",
    paragraphs: [
      "A useful next project does not merely repeat the last one with different colours. It adds evidence the portfolio does not yet contain.",
      "That might mean working with business records, supporting a complete customer journey or demonstrating a more thoughtful mobile experience.",
      "A focused workbook can provide that next project. Advanced training is the better route when the learner is ready for a broader leap in application complexity."
    ],
    primaryLabel: "Compare Workbooks and Advanced Training",
    primaryPath: "/shop"
  },
  {
    week: 45,
    key: "systems-connect",
    subject: "Larger applications are difficult because the parts affect one another",
    preheader: "The challenge is no longer creating one screen—it is managing a connected product.",
    paragraphs: [
      "A larger application may connect accounts, private records, dashboards, notifications and payments. A change in one place can affect several others.",
      "That is why advanced building requires more than asking AI for additional features. The builder needs a clearer structure, stronger testing habits and a reliable way to manage change.",
      "Prompt to Profit Advanced is the next-stage course for learners ready to develop that deeper application-building judgment."
    ],
    primaryLabel: "Explore the Advanced Course",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 46,
    key: "hybrid-academy-proof",
    subject: "One learner project, two connected operational problems",
    preheader: "The Hybrid Academy project shows how software can connect related work.",
    paragraphs: [
      "Inventory and fee management may look like separate tasks, but an organisation may need both to understand its daily operations.",
      "The Hybrid Academy Inventory & Fee Manager demonstrates a learner thinking beyond a single page and towards a connected operational tool.",
      "Projects like this show what becomes possible as learners combine technical growth with a clearer understanding of real users and records."
    ],
    project: {
      title: "Hybrid Academy Inventory & Fee Manager",
      description: "A learner project connecting inventory and fee-management needs in one system.",
      path: "https://legendary-mochi-24add5.netlify.app/"
    },
    primaryLabel: "View the Hybrid Academy Project",
    primaryPath: "https://legendary-mochi-24add5.netlify.app/"
  },
  {
    week: 47,
    key: "production-responsibility",
    subject: "A product people depend on carries a different responsibility",
    preheader: "Real users change the standard a builder must meet.",
    paragraphs: [
      "A classroom demonstration can be restarted when something goes wrong. A product holding real records for real users needs a more dependable response.",
      "Security, recovery, monitoring and careful deployment become part of the user experience even when users never see those systems directly.",
      "This is the shift from simply generating software to taking responsibility for software—a central concern of advanced learning."
    ],
    primaryLabel: "See What Advanced Covers",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 48,
    key: "advanced-readiness",
    subject: "How to recognise when you are ready for a larger build",
    preheader: "The next level should stretch an existing foundation, not replace a missing one.",
    paragraphs: [
      "Advanced learning is most useful when a learner has already finished foundational projects and understands the discipline required to test and improve AI-assisted work.",
      "Readiness does not mean knowing everything. It means being prepared to manage a longer project, revisit difficult ideas and take greater responsibility for data and users.",
      "Learners still developing confidence with the foundations should finish and practise those first. Those ready for connected production applications have a clear next path."
    ],
    primaryLabel: "Check Whether Advanced Is Right for You",
    primaryPath: "/courses/prompt-to-production"
  },
  {
    week: 49,
    key: "year-of-possibility",
    subject: "A year of AI possibility looks better through real projects",
    preheader: "The most useful progress is visible in what people finished.",
    paragraphs: [
      "AI news tends to focus on new models and features. Learner projects offer a more grounded measure of progress.",
      "A business website, young learner's creative experience or operational tool shows someone applying technology to a specific idea. It also shows the persistence required to finish and publish.",
      "Looking back at completed work is a useful reminder: practical progress is not measured by how many AI announcements we followed."
    ],
    primaryLabel: "View the Project Collection",
    primaryPath: "/projects"
  },
  {
    week: 50,
    key: "young-learner-roundup",
    subject: "What young-learner projects teach the adults watching",
    preheader: "Curiosity becomes more powerful when it is given somewhere to go.",
    paragraphs: [
      "Bear & Harvest, Wellness Garden and SmartStock begin with very different ideas. Together, they show young learners treating technology as something they can shape.",
      "Adults do not need to understand every technical detail to support that development. They can ask what the learner wanted to create, what became difficult and what they would improve next.",
      "Those conversations value the thinking behind the project, not only the final screen."
    ],
    project: {
      title: "Young Learner Project Collection",
      description: "Public projects showing creative, wellbeing and operational ideas from young builders.",
      path: "/projects",
      youngLearner: true
    },
    primaryLabel: "See the Young Learner Projects",
    primaryPath: "/projects"
  },
  {
    week: 51,
    key: "choose-next-outcome",
    subject: "Choose next year's outcome before choosing another tool",
    preheader: "A clear destination makes it easier to select the right learning path.",
    paragraphs: [
      "Another year will bring many new AI tools. Following all of them is neither possible nor necessary.",
      "A better question is what you want to be able to show by this time next year: a first live project, a specific business application, stronger everyday workflows or a more advanced product.",
      "Once the outcome is clear, the relevant course or workbook becomes easier to identify—and distractions become easier to ignore."
    ],
    primaryLabel: "Explore All Learning Paths",
    primaryPath: "/courses"
  },
  {
    week: 52,
    key: "keep-building",
    subject: "The next useful thing you finish matters more than this email",
    preheader: "A year of ideas becomes valuable when one of them becomes real.",
    paragraphs: [
      "Over this series, you have seen practical AI through decisions, business problems and projects created by learners of different ages.",
      "The consistent lesson is not that AI makes serious work effortless. It is that more people can now participate in building when they receive the right guidance and remain willing to think, test and improve.",
      "Choose the next outcome that matters to you. Then choose the learning path that will help you finish it."
    ],
    primaryLabel: "Choose Your Next Learning Path",
    primaryPath: "/courses"
  }
]

export function practicalAiNewsletterEmail(week: number) {
  return practicalAiNewsletterContent.find((email) => email.week === week) || null
}
