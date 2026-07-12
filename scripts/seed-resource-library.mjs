import { Prisma, PrismaClient } from "@prisma/client"
import fs from "node:fs"
import crypto from "node:crypto"

function loadDotEnv(path = ".env") {
  if (!fs.existsSync(path)) return
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#") || !line.includes("=")) continue
    const key = line.slice(0, line.indexOf("=")).trim()
    let value = line.slice(line.indexOf("=") + 1).trim()
    if (!key || process.env[key] != null) continue
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[key] = value
  }
}

loadDotEnv()

const prisma = new PrismaClient()
const now = new Date()

function uuidFor(seed) {
  return crypto.createHash("sha1").update(seed).digest("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12}).*$/, "$1-$2-$3-$4-$5")
}

const resources = [
  {
    slug: "ai-study-plan-for-waec-jamb-learners",
    type: "guide",
    audience: "waec-jamb-learners",
    category: "study",
    title: "Complete AI Study Plan for WAEC/JAMB Learners",
    summary: "A practical study system for using AI to plan revision, understand weak topics, practice questions, and review mistakes without replacing real learning.",
    body: `Many learners use AI in a shallow way: they ask for answers, copy explanations, and move on. That does not build exam confidence. A better approach is to use AI as a study planner, patient tutor, quiz master, and mistake-review assistant.

The first step is diagnosis. Before asking AI to create a timetable, the learner should list every subject and identify weak topics. For each topic, the learner should mark confidence as strong, average, weak, or not studied. This prevents random studying and helps the learner focus on topics that can improve scores quickly.

The second step is planning. AI can create a realistic timetable when the learner provides available study hours, exam date, school schedule, and weak topics. The timetable should include short study blocks, past-question practice, review time, and rest. A good plan is not the longest plan. It is the plan the learner can actually follow.

The third step is explanation. When a topic is difficult, the learner can ask AI to explain it like a patient teacher, give examples, and ask questions one by one. This works better than asking AI to summarize a full chapter. The learner should answer before checking the solution.

The fourth step is mistake review. This is where many learners improve fastest. After practice, the learner should paste wrong answers into AI and ask why the answer is wrong, what concept was missing, and what similar questions to practice next. The learner should keep a mistake log.

The fifth step is timed practice. WAEC and JAMB test speed as well as knowledge. Learners should ask AI for timed quizzes, answer without checking notes, then review only after the session.

The final step is teach-back. If the learner can explain a topic in their own words and AI can identify gaps, the learner is moving from memorization to understanding.

Used this way, AI does not replace the teacher, textbook, or past questions. It helps the learner organize effort, practice deliberately, and build confidence.`,
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-study-coach-prompt",
    type: "prompt",
    audience: "waec-jamb-learners",
    category: "study",
    title: "WAEC/JAMB Study Coach Prompt",
    summary: "A structured prompt that turns AI into a patient tutor, quiz master, and mistake-review coach for exam preparation.",
    prompt: `Act as a patient WAEC/JAMB study coach.

My exam is: [WAEC/JAMB/NECO/MOCK]
My class level is: [CLASS]
My subject is: [SUBJECT]
My weak topic is: [TOPIC]
My exam date or mock date is: [DATE]

Do the following:
1. Explain the topic simply, assuming I am confused but willing to learn.
2. Give me 3 examples from easy to harder.
3. Ask me 5 practice questions one by one.
4. Wait for my answer before marking each question.
5. If I am wrong, explain why my answer is wrong and show the correct reasoning.
6. At the end, summarize what I understand and what I should revise next.

Do not give me all answers at once. Make me think.`,
    useCase: "Use this when a learner is stuck on a topic and needs explanation, guided practice, correction, and next-step revision guidance.",
    customization: "Replace the exam, class, subject, topic, and exam date. For stronger learners, ask for harder questions. For weaker learners, ask AI to use simpler language and more examples.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "7-day-ai-study-planner-waec-jamb",
    type: "download",
    audience: "waec-jamb-learners",
    category: "study",
    title: "7-Day AI Study Planner for WAEC/JAMB Learners",
    summary: "A downloadable planner for using AI to organize one week of focused revision.",
    body: "Download this planner and use it with a learner's subject list, exam timeline, and weak topics.",
    downloadUrl: "/resources/downloads/ai-study-planner-waec-jamb.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-subject-weakness-audit",
    type: "download",
    audience: "waec-jamb-learners",
    category: "study",
    title: "WAEC/JAMB Subject Weakness Audit Worksheet",
    summary: "A worksheet that helps learners identify weak topics, prioritize revision, and stop studying randomly.",
    body: "Use this worksheet before creating a study timetable. It helps a learner list subjects, score topic confidence, and decide which topics deserve attention first.",
    downloadUrl: "/resources/downloads/waec-jamb-subject-audit-worksheet.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-mistake-review-tracker",
    type: "download",
    audience: "waec-jamb-learners",
    category: "study",
    title: "WAEC/JAMB Mistake Review Tracker",
    summary: "A practical tracker for turning wrong answers into revision targets and measurable improvement.",
    body: "This tracker helps learners stop repeating the same errors by recording the question, wrong answer, correct answer, mistake type, and next practice date.",
    downloadUrl: "/resources/downloads/waec-jamb-mistake-review-tracker.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-essay-writing-practice-prompt",
    type: "prompt",
    audience: "waec-jamb-learners",
    category: "study",
    title: "WAEC Essay Writing Practice Prompt",
    summary: "A prompt for practicing essays with structure, marking feedback, and step-by-step improvement.",
    prompt: `Act as a WAEC English essay coach.

Essay type: [argumentative/narrative/descriptive/formal letter/informal letter/article]
Topic: [TOPIC]
My class level: [CLASS]

First, teach me the structure for this essay type.
Then give me a simple outline.
Then ask me to write the introduction only.
After I write it, mark it and tell me how to improve it.
Continue section by section until the essay is complete.
At the end, score the essay using WAEC-style criteria: content, organization, expression, and mechanical accuracy.

Do not write the full essay for me unless I ask for a sample after I have tried.`,
    useCase: "Use this for English essay practice, especially when a learner struggles with structure, introductions, paragraphs, or expression.",
    customization: "Change the essay type and topic. For weaker learners, ask for simpler vocabulary. For stronger learners, ask for higher-quality expressions and stricter marking.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-maths-step-by-step-practice-prompt",
    type: "prompt",
    audience: "waec-jamb-learners",
    category: "study",
    title: "WAEC/JAMB Maths Step-by-Step Practice Prompt",
    summary: "A prompt that helps learners solve maths questions step by step without jumping straight to the answer.",
    prompt: `Act as a WAEC/JAMB Mathematics tutor.

Topic: [TOPIC]
Question: [PASTE QUESTION]

Do not solve everything at once.
First, identify what the question is asking.
Second, list the formula or concept needed.
Third, ask me what the first step should be.
Wait for my answer.
If I am wrong, correct me gently and explain why.
Guide me step by step until the final answer.
Afterwards, give me two similar questions to practice.`,
    useCase: "Use this when learners need to understand the process behind mathematics, physics calculations, or quantitative reasoning.",
    customization: "Paste a real past question. Add whether the learner wants WAEC-level or JAMB-level difficulty.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "waec-jamb-cbt-practice-routine",
    type: "guide",
    audience: "waec-jamb-learners",
    category: "study",
    title: "CBT Practice Routine for JAMB Learners",
    summary: "A practical routine for improving speed, accuracy, and confidence before computer-based tests.",
    body: `CBT success is not only about knowing the answer. It is also about time, focus, and familiarity with question patterns.

A useful CBT routine has three parts: timed practice, review, and repeat practice. The learner should choose a subject, set a timer, answer without checking notes, then review every wrong answer carefully. Scores should be recorded so progress becomes visible.

AI can help before and after CBT practice. Before practice, the learner can ask AI to generate topic-specific questions. After practice, the learner can paste wrong questions and ask for explanations. However, the learner should still use official past questions and trusted exam practice tools.

A simple routine is: 20 minutes of timed questions, 20 minutes of mistake review, and 10 minutes writing down rules or formulas to remember. This is better than reading for hours without testing recall.

Learners should also practice skipping difficult questions and returning later. Many marks are lost because a learner spends too long on one question. Speed improves when practice is regular and mistakes are reviewed.`,
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "parent-support-plan-for-waec-jamb-learners",
    type: "download",
    audience: "waec-jamb-learners",
    category: "study",
    title: "Parent Support Checklist for WAEC/JAMB Learners",
    summary: "A practical checklist parents can use to support exam preparation without creating fear or pressure.",
    body: "This checklist helps parents ask better questions, support planning, encourage safe AI use, watch for burnout, and track weekly progress.",
    downloadUrl: "/resources/downloads/waec-jamb-parent-support-checklist.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "parent-guide-to-safe-ai-use-at-home",
    type: "guide",
    audience: "parents",
    category: "safety",
    title: "Parent Guide to Safe AI Use at Home",
    summary: "A plain-English guide for helping children use AI safely, productively, and with supervision.",
    body: "Parents do not need to become technical experts before guiding children around AI.\n\nStart with three rules: no personal information, no private conversations with unknown tools, and no copying schoolwork without understanding it.\n\nChildren should use AI for explanation, practice, creativity, and guided projects. Parents should ask what the child is building, what prompt they used, and what they learned from the output.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "teacher-lesson-planning-prompt",
    type: "prompt",
    audience: "teachers",
    category: "schools",
    title: "Teacher Lesson Planning Prompt",
    summary: "A classroom-ready prompt for turning a topic into a structured lesson plan with activities and assessment checks.",
    prompt: "Act as an experienced Nigerian classroom teacher. Create a lesson plan for [CLASS LEVEL] on [TOPIC]. Include learning objectives, starter activity, main explanation, guided practice, class activity, assessment questions, homework, and differentiation for struggling learners.",
    useCase: "Use this when preparing a lesson plan, revision class, or extra support material.",
    customization: "Replace class level, subject, lesson duration, available materials, and learner ability range.",
    relatedCourse: "prompt-to-profit-schools"
  },
  {
    slug: "school-ai-policy-checklist",
    type: "download",
    audience: "school-owners",
    category: "schools",
    title: "School AI Policy Checklist",
    summary: "A practical checklist for introducing AI into a school with safety, integrity, and teacher readiness.",
    body: "Use this checklist before introducing AI tools to staff or students.",
    downloadUrl: "/resources/downloads/school-ai-policy-checklist.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit-schools"
  },
  {
    slug: "ai-adoption-roadmap-for-school-owners",
    type: "guide",
    audience: "school-owners",
    category: "schools",
    title: "AI Adoption Roadmap for School Owners",
    summary: "A step-by-step roadmap for adopting AI in school operations, teaching, staff productivity, and parent communication.",
    body: "School AI adoption should not begin with random tools. It should begin with clear outcomes.\n\nStart with teacher productivity, then learning support, then administrative workflows. Train staff first, communicate with parents, create simple policies, and use pilot projects before school-wide rollout.\n\nThe best school AI strategy is practical, supervised, and measurable.",
    relatedCourse: "prompt-to-profit-schools"
  },
  {
    slug: "ai-cv-and-interview-prep-for-job-seekers",
    type: "guide",
    audience: "nysc-job-seekers",
    category: "career",
    title: "AI CV and Interview Prep for Job Seekers",
    summary: "A practical guide for using AI to improve CVs, prepare interview answers, and build a portfolio without sounding generic.",
    body: "Job seekers should use AI to clarify their experience, not fabricate it.\n\nUse AI to turn responsibilities into measurable achievements, tailor a CV to a job description, prepare interview stories, and create a simple project portfolio.\n\nAlways review the final output so it sounds like you and reflects real work.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "small-business-ai-workflow-checklist",
    type: "download",
    audience: "small-business-owners",
    category: "business",
    title: "Small Business AI Workflow Checklist",
    summary: "A downloadable checklist for finding repeated business tasks that AI can improve immediately.",
    body: "Use this checklist to identify customer communication, marketing, operations, finance, and training workflows AI can support.",
    downloadUrl: "/resources/downloads/small-business-ai-workflow-checklist.md",
    accessType: "gated",
    relatedCourse: "ai-for-everyday-business-owners"
  },
  {
    slug: "customer-support-response-prompt-for-small-businesses",
    type: "prompt",
    audience: "small-business-owners",
    category: "business",
    title: "Customer Support Response Prompt for Small Businesses",
    summary: "A prompt for turning rough customer support notes into clear, respectful WhatsApp-ready replies.",
    prompt: "Act as a professional customer support assistant for a Nigerian small business. Rewrite this reply so it is warm, clear, firm where necessary, and suitable for WhatsApp. Keep it short. Customer issue: [ISSUE]. Business position: [POLICY OR DECISION]. Desired outcome: [OUTCOME].",
    useCase: "Use this for complaints, order updates, delivery delays, refunds, and follow-up messages.",
    customization: "Add your business tone, refund policy, delivery timelines, and whether the customer is new or returning.",
    relatedCourse: "ai-for-everyday-business-owners"
  },
  {
    slug: "non-technical-founder-product-validation-prompt",
    type: "prompt",
    audience: "non-technical-founders",
    category: "project-building",
    title: "Non-Technical Founder Product Validation Prompt",
    summary: "A prompt for turning a rough startup idea into clearer users, use cases, risks, and first prototype scope.",
    prompt: "Act as a practical product strategist. My idea is [IDEA]. Help me define the target user, painful problem, current alternatives, simplest useful version, risky assumptions, validation questions, and a 7-day prototype plan I can build with AI.",
    useCase: "Use this before paying for development or building a full product.",
    customization: "Add location, audience, price point, competitor examples, and your available budget.",
    relatedCourse: "prompt-to-production"
  },
  {
    slug: "children-and-ai-safety-starter-guide",
    type: "guide",
    audience: "children-ai-safety",
    category: "safety",
    title: "Children and AI Safety Starter Guide",
    summary: "A safety-first guide for helping children use AI for learning and creativity without exposing private information.",
    body: "Children can benefit from AI when adults create boundaries.\n\nGood AI activities include vocabulary practice, story planning, revision games, supervised coding exercises, and creative projects.\n\nAvoid unsupervised use, personal data sharing, private chats, and copying assignments without understanding.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "first-ai-built-project-roadmap",
    type: "guide",
    audience: "building-real-projects",
    category: "project-building",
    title: "First AI-Built Project Roadmap",
    summary: "A beginner-friendly roadmap for using AI to build a simple website, dashboard, or useful digital tool.",
    body: "A real project starts with a clear problem.\n\nDefine the user, write the core task, sketch the screens, ask AI to generate the first version, test it, then improve one feature at a time.\n\nDo not ask AI to build everything at once. Guide it step by step and review each output before moving forward.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "government-ai-readiness-checklist",
    type: "download",
    audience: "governments-public-institutions",
    category: "public-sector",
    title: "Government AI Readiness Checklist",
    summary: "A practical checklist for public-sector teams planning responsible AI adoption.",
    body: "Use this checklist to assess service delivery, data readiness, staff training, governance, public trust, and pilot suitability.",
    downloadUrl: "/resources/downloads/government-ai-readiness-checklist.md",
    accessType: "gated",
    relatedCourse: "prompt-to-profit"
  }
]

const bundles = [
  {
    slug: "waec-jamb-ai-study-toolkit",
    title: "WAEC/JAMB AI Study Toolkit",
    summary: "Study planning, weak-topic diagnosis, mistake review, essay practice, maths practice, and parent support resources for exam learners.",
    description: "A practical toolkit for learners and parents who want to use AI as a disciplined study assistant, not a shortcut. It combines planners, prompts, worksheets, and review routines that help learners identify weak topics, practice deliberately, and improve confidence before WAEC, JAMB, NECO, or school mock exams.",
    audience: "waec-jamb-learners",
    priceNgnMinor: 750000,
    priceUsdMinor: 800,
    items: [
      "ai-study-plan-for-waec-jamb-learners",
      "7-day-ai-study-planner-waec-jamb",
      "waec-jamb-subject-weakness-audit",
      "waec-jamb-study-coach-prompt",
      "waec-jamb-mistake-review-tracker",
      "waec-jamb-essay-writing-practice-prompt",
      "waec-jamb-maths-step-by-step-practice-prompt",
      "waec-jamb-cbt-practice-routine",
      "parent-support-plan-for-waec-jamb-learners"
    ]
  },
  {
    slug: "ai-starter-toolkit-for-schools",
    title: "AI Starter Toolkit for Schools",
    summary: "Policy, lesson-planning, parent communication, and teacher productivity resources for schools starting with AI.",
    description: "A practical toolkit for school owners and teachers who want to introduce AI responsibly without confusing staff, parents, or learners.",
    audience: "school-owners",
    priceNgnMinor: 1500000,
    priceUsdMinor: 1500,
    items: ["school-ai-policy-checklist", "teacher-lesson-planning-prompt", "ai-adoption-roadmap-for-school-owners"]
  },
  {
    slug: "ai-productivity-toolkit-for-small-businesses",
    title: "AI Productivity Toolkit for Small Businesses",
    summary: "Customer support, workflow, and business communication resources for practical AI adoption.",
    description: "A toolkit for small business owners who want to use AI for repeated business tasks before investing in complex tools.",
    audience: "small-business-owners",
    priceNgnMinor: 1000000,
    priceUsdMinor: 1000,
    items: ["small-business-ai-workflow-checklist", "customer-support-response-prompt-for-small-businesses"]
  }
]

const retiredBundleSlugs = bundles.map((bundle) => bundle.slug)
bundles.length = 0

function promptPlaybookText({ audience, area, prompts }) {
  return `Use these prompts inside your preferred AI tool. Replace the bracketed parts with your real situation. The value is in the context you provide, not in copying the prompt exactly.

${prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n\n")}

After each response, ask one follow-up: "Make this more specific to my situation: [ADD DETAIL]." That second step is where the prompt becomes useful for real work.`
}

const audiencePromptAreas = [
  {
    audience: "waec-jamb-learners",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "waec-jamb-weak-topic-study-prompts",
        category: "study",
        title: "WAEC/JAMB Weak Topic Study Prompts",
        summary: "Prompts for identifying weak topics, getting simple explanations, and practicing until the topic becomes clearer.",
        area: "weak-topic revision",
        prompts: [
          "Act as my WAEC/JAMB study coach. Subject: [SUBJECT]. Topic: [TOPIC]. First ask me three questions to check what I already understand, then explain only the parts I am missing.",
          "I keep getting questions on [TOPIC] wrong. Explain the topic simply, give two Nigerian classroom examples, then give me five practice questions one at a time.",
          "Here are my wrong answers: [PASTE QUESTIONS AND ANSWERS]. Tell me the concept I missed, the correct reasoning, and three similar questions to practice next."
        ]
      },
      {
        slug: "waec-jamb-timetable-and-practice-prompts",
        category: "study",
        title: "WAEC/JAMB Timetable and Practice Prompts",
        summary: "Prompts for building realistic revision schedules, timed quizzes, and weekly review plans.",
        area: "study planning and timed practice",
        prompts: [
          "Create a realistic 7-day study plan for me. Exam: [WAEC/JAMB/NECO]. Subjects: [SUBJECTS]. Weak topics: [TOPICS]. Available study time: [HOURS]. Include past-question practice and rest.",
          "Create a timed quiz for [SUBJECT] on [TOPIC]. Give me [NUMBER] questions. Do not show the answers until I submit mine.",
          "Review my study week: [PASTE WHAT I STUDIED AND SCORES]. Tell me what improved, what I avoided, and what I should study next week."
        ]
      },
      {
        slug: "waec-jamb-essay-and-cbt-prompts",
        category: "study",
        title: "WAEC Essay and JAMB CBT Prompts",
        summary: "Prompts for essay practice, CBT pacing, answer review, and exam confidence.",
        area: "exam performance",
        prompts: [
          "Act as a WAEC English essay coach. Essay type: [TYPE]. Topic: [TOPIC]. Teach me the structure, then ask me to write one section at a time and mark each section.",
          "Help me improve CBT speed for [SUBJECT]. Create a 20-minute practice plan, pacing rules, and a review checklist for careless mistakes.",
          "I panic during exams. Create a simple routine for the night before, the morning of the exam, and the first five minutes inside the hall."
        ]
      }
    ]
  },
  {
    audience: "parents",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "parent-ai-home-rules-prompts",
        category: "safety",
        title: "Parent AI Home Rules Prompts",
        summary: "Prompts for creating family AI rules around privacy, homework, copying, and supervised learning.",
        area: "home rules and safety",
        prompts: [
          "Help me create simple AI rules for my child aged [AGE]. Include privacy, schoolwork, copying, screen time, and when to ask an adult.",
          "Create a child-friendly explanation of why they should not share addresses, phone numbers, passwords, school details, or family information with AI tools.",
          "Turn these house rules into a one-page family agreement: [PASTE RULES]. Make it firm but not frightening."
        ]
      },
      {
        slug: "parent-study-support-prompts",
        category: "study",
        title: "Parent Study Support Prompts",
        summary: "Prompts parents can use to support homework, revision, and accountability without doing the work for the child.",
        area: "study support",
        prompts: [
          "My child is struggling with [SUBJECT/TOPIC]. Give me five simple questions I can ask to understand where they are stuck without doing the homework for them.",
          "Create a weekly study check-in plan for my child preparing for [EXAM/CLASS]. Keep it calm, realistic, and parent-friendly.",
          "Help me turn this wrong answer into a learning conversation: [PASTE QUESTION AND ANSWER]."
        ]
      },
      {
        slug: "parent-school-communication-prompts",
        category: "schools",
        title: "Parent School Communication Prompts",
        summary: "Prompts for writing clear messages to teachers and schools about learning, safety, and progress.",
        area: "school communication",
        prompts: [
          "Help me write a respectful message to my child's teacher about [CONCERN]. Keep it clear, calm, and focused on solutions.",
          "Create questions I can ask during a parent-teacher meeting about my child's progress in [SUBJECT/AREA].",
          "Rewrite this message so it sounds firm but respectful: [PASTE MESSAGE]."
        ]
      }
    ]
  },
  {
    audience: "teachers",
    relatedCourse: "prompt-to-profit-schools",
    areas: [
      {
        slug: "teacher-lesson-planning-prompts",
        category: "schools",
        title: "Teacher Lesson Planning Prompts",
        summary: "Prompts for planning lessons around class level, prior knowledge, local examples, activities, and assessment.",
        area: "lesson planning",
        prompts: [
          "Create a [DURATION]-minute lesson plan for [CLASS] on [TOPIC] in [SUBJECT]. Include prior knowledge, local examples, class activity, assessment, and homework.",
          "My students confuse [CONCEPT A] and [CONCEPT B]. Create a simple explanation, two examples, and five checking-for-understanding questions.",
          "Adapt this lesson for weak learners and fast learners: [PASTE LESSON]."
        ]
      },
      {
        slug: "teacher-marking-feedback-prompts",
        category: "schools",
        title: "Teacher Marking and Feedback Prompts",
        summary: "Prompts for rubrics, feedback comments, remediation notes, and parent-friendly learning updates.",
        area: "marking and feedback",
        prompts: [
          "Create a simple rubric for marking [ASSIGNMENT] in [SUBJECT] for [CLASS]. Include content, structure, accuracy, and presentation.",
          "Turn these common errors into short feedback comments I can write on scripts: [PASTE ERRORS].",
          "Create a remedial mini-lesson for students who failed questions on [TOPIC]."
        ]
      },
      {
        slug: "teacher-classroom-materials-prompts",
        category: "schools",
        title: "Teacher Classroom Materials Prompts",
        summary: "Prompts for quizzes, worksheets, starters, exit tickets, homework, and classroom activities.",
        area: "classroom materials",
        prompts: [
          "Create ten questions on [TOPIC] for [CLASS], arranged from easy to difficult, with answers and marking guide.",
          "Create a starter activity, group activity, and exit ticket for [TOPIC]. Use examples students in Nigeria can understand.",
          "Turn this textbook section into a worksheet with short-answer questions: [PASTE SECTION]."
        ]
      }
    ]
  },
  {
    audience: "school-owners",
    relatedCourse: "prompt-to-profit-schools",
    areas: [
      {
        slug: "school-owner-parent-communication-prompts",
        category: "schools",
        title: "School Parent Communication Prompts",
        summary: "Prompts for school announcements, parent updates, admissions follow-up, and fee/payment communication.",
        area: "parent communication",
        prompts: [
          "Write a parent update about [SCHOOL ISSUE/EVENT]. Keep it warm, clear, professional, and suitable for WhatsApp and email.",
          "Create an admissions follow-up message for a parent who visited the school but has not enrolled. Context: [DETAILS].",
          "Rewrite this fee reminder so it is respectful, firm, and not embarrassing: [PASTE MESSAGE]."
        ]
      },
      {
        slug: "school-owner-ai-policy-prompts",
        category: "schools",
        title: "School AI Policy Prompts",
        summary: "Prompts for drafting school AI rules for teachers, students, data privacy, and classroom use.",
        area: "AI policy and governance",
        prompts: [
          "Draft a simple AI use policy for a [PRIMARY/SECONDARY] school. Include teacher use, student use, privacy, homework, assessment, and parent communication.",
          "Create a staff training outline for introducing AI responsibly to teachers who are beginners.",
          "Review this AI policy and identify gaps around student data, assessment integrity, and teacher supervision: [PASTE POLICY]."
        ]
      },
      {
        slug: "school-owner-operations-prompts",
        category: "schools",
        title: "School Operations Prompts",
        summary: "Prompts for improving admissions, staff memos, meeting notes, event planning, and internal school workflows.",
        area: "school operations",
        prompts: [
          "Turn these school meeting notes into action items with owners, deadlines, and follow-up reminders: [PASTE NOTES].",
          "Create a weekly operations checklist for a school administrator covering admissions, parent communication, attendance, and staff follow-up.",
          "Write a clear internal memo to staff about [ISSUE]. Keep it respectful, direct, and school-appropriate."
        ]
      }
    ]
  },
  {
    audience: "nysc-job-seekers",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "job-seeker-cv-prompts",
        category: "career",
        title: "CV Improvement Prompts for Job Seekers",
        summary: "Prompts for turning real experience into stronger CV summaries, bullets, and role-specific applications.",
        area: "CV improvement",
        prompts: [
          "Review my CV for [ROLE]. Tell me what is weak, generic, missing, or not supported by evidence: [PASTE CV].",
          "Turn this experience into three honest CV bullet points with measurable value where possible: [PASTE EXPERIENCE].",
          "Tailor this CV summary to this job description without inventing experience: [PASTE CV SUMMARY AND JOB DESCRIPTION]."
        ]
      },
      {
        slug: "job-seeker-interview-prompts",
        category: "career",
        title: "Interview Preparation Prompts",
        summary: "Prompts for preparing role-specific answers, STAR stories, salary conversations, and confidence practice.",
        area: "interview preparation",
        prompts: [
          "Act as an interviewer for [ROLE]. Ask me ten questions one at a time, wait for my answer, then score and improve it.",
          "Help me turn this experience into a STAR interview story: [PASTE EXPERIENCE].",
          "Create a simple answer for 'Tell me about yourself' using my background: [PASTE BACKGROUND]."
        ]
      },
      {
        slug: "job-seeker-portfolio-prompts",
        category: "career",
        title: "Portfolio Builder Prompts",
        summary: "Prompts for turning school projects, NYSC work, internships, and personal work into a credible portfolio.",
        area: "portfolio building",
        prompts: [
          "Help me identify portfolio projects from my background: [PASTE SCHOOL, NYSC, INTERNSHIP, VOLUNTEER, OR PERSONAL EXPERIENCE].",
          "Create a one-page case study for this project: [PROJECT]. Include problem, role, process, result, and what I learned.",
          "Plan a simple portfolio website structure for someone applying for [ROLE]."
        ]
      }
    ]
  },
  {
    audience: "small-business-owners",
    relatedCourse: "ai-for-everyday-business-owners",
    areas: [
      {
        slug: "small-business-whatsapp-sales-prompts",
        category: "business",
        title: "WhatsApp Sales Prompts for Small Businesses",
        summary: "Prompts for product enquiries, follow-up messages, objections, abandoned orders, and customer conversion.",
        area: "WhatsApp sales",
        prompts: [
          "Write a WhatsApp reply to a customer asking about [PRODUCT]. Include price, benefits, delivery/payment next step, and a warm tone.",
          "Create three follow-up messages for a customer who showed interest in [PRODUCT] but has not paid.",
          "Help me respond to this objection without sounding desperate: [PASTE CUSTOMER OBJECTION]."
        ]
      },
      {
        slug: "small-business-content-prompts",
        category: "business",
        title: "Small Business Content Prompts",
        summary: "Prompts for weekly content ideas, captions, customer education, testimonials, and offers.",
        area: "content marketing",
        prompts: [
          "Create a 7-day content plan for my business. Business: [BUSINESS]. Audience: [AUDIENCE]. Products/services: [OFFERS].",
          "Turn these customer questions into useful social media posts: [PASTE QUESTIONS].",
          "Write five captions that educate customers about [PRODUCT/SERVICE] without sounding too salesy."
        ]
      },
      {
        slug: "small-business-customer-support-prompts",
        category: "business",
        title: "Customer Support Prompts for Small Businesses",
        summary: "Prompts for complaints, refund explanations, delivery delays, unavailable products, and apology messages.",
        area: "customer support",
        prompts: [
          "Rewrite this customer support reply for WhatsApp. Make it clear, calm, and professional: [PASTE REPLY].",
          "Help me respond to an angry customer. Complaint: [COMPLAINT]. What we can do: [OPTIONS]. What we cannot do: [LIMITS].",
          "Create a delivery delay update that is honest, apologetic, and does not overpromise. Details: [DETAILS]."
        ]
      }
    ]
  },
  {
    audience: "non-technical-founders",
    relatedCourse: "prompt-to-production",
    areas: [
      {
        slug: "founder-idea-validation-prompts",
        category: "project-building",
        title: "Founder Idea Validation Prompts",
        summary: "Prompts for testing whether an idea solves a real problem before building the wrong product.",
        area: "idea validation",
        prompts: [
          "Challenge my startup idea like a skeptical product strategist. Idea: [IDEA]. Identify target user, painful problem, alternatives, assumptions, and validation tests.",
          "Create ten customer interview questions for people who might have this problem: [PROBLEM]. Avoid leading questions.",
          "List five reasons this idea could fail and what evidence I need before building."
        ]
      },
      {
        slug: "founder-mvp-scope-prompts",
        category: "project-building",
        title: "MVP Scope Prompts for Non-Technical Founders",
        summary: "Prompts for deciding the smallest useful version and removing features that should wait.",
        area: "MVP scope",
        prompts: [
          "Define the MVP for this idea: [IDEA]. Separate must-have, should-wait, and unnecessary features.",
          "Turn this idea into a one-page product brief: user, problem, promise, features, non-features, and success metric.",
          "Create a simple user journey for [USER] trying to solve [PROBLEM] with my product."
        ]
      },
      {
        slug: "founder-launch-copy-prompts",
        category: "business",
        title: "Founder Launch Copy Prompts",
        summary: "Prompts for landing pages, waitlists, product positioning, and early user communication.",
        area: "launch communication",
        prompts: [
          "Write a landing page outline for [PRODUCT]. Audience: [AUDIENCE]. Problem: [PROBLEM]. Promise: [PROMISE].",
          "Create three positioning angles for this product: [PRODUCT]. Make each angle clear and not hype-driven.",
          "Write a waitlist invitation message for early users. Keep it direct, useful, and credible."
        ]
      }
    ]
  },
  {
    audience: "children-ai-safety",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "children-safe-learning-prompts",
        category: "safety",
        title: "Safe Learning Prompts for Children",
        summary: "Prompts adults can supervise for quizzes, explanations, vocabulary practice, and learning games.",
        area: "safe learning",
        prompts: [
          "Create a child-friendly quiz on [TOPIC] for age [AGE]. Ask one question at a time and explain gently after each answer.",
          "Explain [TOPIC] to a child aged [AGE] using simple words and safe examples.",
          "Create a vocabulary game for [SUBJECT/TOPIC] with ten words, meanings, and practice sentences."
        ]
      },
      {
        slug: "children-creative-project-prompts",
        category: "safety",
        title: "Child-Friendly Creative Project Prompts",
        summary: "Prompts for supervised stories, drawings, presentations, simple coding ideas, and creative learning.",
        area: "creative projects",
        prompts: [
          "Help a child aged [AGE] plan a short story about [THEME]. Ask questions first, then create a simple outline.",
          "Create a safe project idea for a child using [TOOL/MATERIAL]. Include steps, adult supervision notes, and what the child will learn.",
          "Turn this topic into a simple presentation plan for a child: [TOPIC]."
        ]
      },
      {
        slug: "children-ai-safety-conversation-prompts",
        category: "safety",
        title: "AI Safety Conversation Prompts for Children",
        summary: "Prompts for adults to explain privacy, copying, mistakes, and safe AI behavior to children.",
        area: "safety conversations",
        prompts: [
          "Create a simple conversation guide for explaining AI privacy to a child aged [AGE].",
          "Help me explain why copying from AI is not the same as learning. Make it age-appropriate for [AGE].",
          "Create a family checklist children can remember before using AI."
        ]
      }
    ]
  },
  {
    audience: "building-real-projects",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "project-planning-prompts",
        category: "project-building",
        title: "Project Planning Prompts",
        summary: "Prompts for defining users, screens, features, data, and success before building with AI.",
        area: "project planning",
        prompts: [
          "Help me turn this idea into a simple project brief: [IDEA]. Include user, problem, core screens, data needed, and first version.",
          "Create a screen-by-screen plan for a [WEBSITE/APP/DASHBOARD] that helps [USER] do [TASK].",
          "List the smallest features needed for version one and what should wait."
        ]
      },
      {
        slug: "ai-build-debug-prompts",
        category: "project-building",
        title: "AI Build and Debug Prompts",
        summary: "Prompts for generating, reviewing, fixing, and improving websites or simple software projects.",
        area: "building and debugging",
        prompts: [
          "Review this error and tell me the likely cause and exact fix: [PASTE ERROR]. Ask for missing files if needed.",
          "Improve this page layout for mobile and desktop without changing the core content: [PASTE CODE OR DESCRIPTION].",
          "Create a step-by-step build plan for adding [FEATURE] to my project. Include files likely affected and tests to run."
        ]
      },
      {
        slug: "project-launch-prompts",
        category: "project-building",
        title: "Project Launch Prompts",
        summary: "Prompts for testing, deployment readiness, feedback collection, and project presentation.",
        area: "launch and review",
        prompts: [
          "Create a pre-launch checklist for my [WEBSITE/APP]. Include mobile, forms, links, SEO basics, security, and analytics.",
          "Help me write a short project case study: problem, solution, features, tools used, screenshots needed, and lessons learned.",
          "Create feedback questions for first users testing my project: [PROJECT DESCRIPTION]."
        ]
      }
    ]
  },
  {
    audience: "governments-public-institutions",
    relatedCourse: "prompt-to-profit",
    areas: [
      {
        slug: "public-sector-service-communication-prompts",
        category: "public-sector",
        title: "Public-Sector Service Communication Prompts",
        summary: "Prompts for clearer citizen FAQs, announcements, service explanations, and internal communication.",
        area: "service communication",
        prompts: [
          "Rewrite this public service announcement so it is clear, respectful, and easy for citizens to understand: [PASTE ANNOUNCEMENT].",
          "Create FAQs for citizens about [SERVICE]. Include eligibility, steps, documents needed, timeline, and contact route.",
          "Turn this internal note into a citizen-facing explanation without exposing confidential details: [PASTE NOTE]."
        ]
      },
      {
        slug: "public-sector-policy-research-prompts",
        category: "public-sector",
        title: "Public-Sector Policy Research Prompts",
        summary: "Prompts for summarizing policy documents, comparing options, and preparing briefing notes with human review.",
        area: "policy research",
        prompts: [
          "Summarize this policy document for a non-technical public-sector audience. Separate facts, assumptions, risks, and questions: [PASTE TEXT].",
          "Create a briefing note on [TOPIC] with background, options, risks, implementation considerations, and recommended next questions.",
          "Compare these policy options using cost, public impact, implementation difficulty, risk, and accountability: [PASTE OPTIONS]."
        ]
      },
      {
        slug: "public-sector-ai-governance-prompts",
        category: "public-sector",
        title: "Public-Sector AI Governance Prompts",
        summary: "Prompts for identifying low-risk pilots, data boundaries, human review, and accountability checks.",
        area: "AI governance",
        prompts: [
          "Assess whether this workflow is suitable for a low-risk AI pilot: [WORKFLOW]. Check data sensitivity, public impact, human review, and success metrics.",
          "Create AI use guidelines for a public institution. Include approved use cases, prohibited data, review process, and accountability.",
          "Review this AI pilot plan and identify governance, privacy, procurement, and public trust risks: [PASTE PLAN]."
        ]
      }
    ]
  }
]

function slugPart(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

const expandedPromptAudienceSpecs = [
  { audience: "university-students", label: "University Students", category: "study", relatedCourse: "prompt-to-profit", areas: ["coursework planning", "research and citations", "presentation preparation"] },
  { audience: "polytechnic-students", label: "Polytechnic Students", category: "study", relatedCourse: "prompt-to-profit", areas: ["practical assignments", "technical reports", "industrial training preparation"] },
  { audience: "undergraduates-final-year", label: "Final-Year Students", category: "study", relatedCourse: "prompt-to-profit", areas: ["project topic refinement", "chapter writing support", "defense preparation"] },
  { audience: "postgraduate-researchers", label: "Postgraduate Researchers", category: "study", relatedCourse: "prompt-to-profit", areas: ["literature review planning", "methodology design", "academic writing review"] },
  { audience: "lecturers-academics", label: "Lecturers & Academics", category: "schools", relatedCourse: "prompt-to-profit-schools", areas: ["lecture preparation", "assessment design", "research supervision"] },
  { audience: "school-administrators", label: "School Administrators", category: "schools", relatedCourse: "prompt-to-profit-schools", areas: ["school operations", "parent communication", "staff coordination"] },
  { audience: "private-tutors", label: "Private Tutors", category: "schools", relatedCourse: "prompt-to-profit", areas: ["learner diagnosis", "custom lesson planning", "parent progress updates"] },
  { audience: "online-course-creators", label: "Online Course Creators", category: "business", relatedCourse: "prompt-to-profit", areas: ["course outline design", "lesson script writing", "learner engagement"] },
  { audience: "corporate-trainers", label: "Corporate Trainers", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["training needs analysis", "facilitation activities", "assessment and feedback"] },
  { audience: "hr-professionals", label: "HR Professionals", category: "career", relatedCourse: "prompt-to-profit", areas: ["job descriptions", "onboarding communication", "performance support"] },
  { audience: "customer-support-teams", label: "Customer Support Teams", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["support replies", "complaint escalation", "knowledge base writing"] },
  { audience: "sales-professionals", label: "Sales Professionals", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["prospecting messages", "follow-up sequences", "objection handling"] },
  { audience: "marketers", label: "Marketers", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["campaign planning", "audience research", "copy improvement"] },
  { audience: "social-media-managers", label: "Social Media Managers", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["content calendars", "caption writing", "community replies"] },
  { audience: "content-creators", label: "Content Creators", category: "business", relatedCourse: "prompt-to-profit", areas: ["content ideas", "script hooks", "repurposing content"] },
  { audience: "youtube-creators", label: "YouTube Creators", category: "business", relatedCourse: "prompt-to-profit", areas: ["video outlines", "title and thumbnail angles", "audience retention"] },
  { audience: "tiktok-instagram-creators", label: "TikTok & Instagram Creators", category: "business", relatedCourse: "prompt-to-profit", areas: ["short-form hooks", "series planning", "caption and CTA writing"] },
  { audience: "writers-bloggers", label: "Writers & Bloggers", category: "business", relatedCourse: "prompt-to-profit", areas: ["article outlines", "headline improvement", "editing and clarity"] },
  { audience: "designers-creatives", label: "Designers & Creatives", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["creative briefs", "concept development", "client presentation"] },
  { audience: "software-developers", label: "Software Developers", category: "project-building", relatedCourse: "prompt-to-production", areas: ["debugging", "architecture planning", "documentation"] },
  { audience: "product-managers", label: "Product Managers", category: "project-building", relatedCourse: "prompt-to-production", areas: ["user stories", "roadmap planning", "stakeholder updates"] },
  { audience: "data-analysts", label: "Data Analysts", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["analysis planning", "dashboard narratives", "SQL assistance"] },
  { audience: "lawyers-legal-teams", label: "Lawyers & Legal Teams", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["document review planning", "client communication", "legal research organization"] },
  { audience: "accountants-finance-teams", label: "Accountants & Finance Teams", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["financial explanations", "reporting notes", "budget planning"] },
  { audience: "healthcare-administrators", label: "Healthcare Administrators", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["patient communication", "staff notes", "admin workflow planning"] },
  { audience: "ngo-nonprofit-teams", label: "NGO & Nonprofit Teams", category: "public-sector", relatedCourse: "prompt-to-profit", areas: ["programme design", "impact reporting", "donor communication"] },
  { audience: "grant-writers", label: "Grant Writers", category: "public-sector", relatedCourse: "prompt-to-profit", areas: ["needs statements", "proposal structure", "impact measurement"] },
  { audience: "church-ministry-teams", label: "Church & Ministry Teams", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["volunteer coordination", "event communication", "teaching outlines"] },
  { audience: "event-planners", label: "Event Planners", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["event briefs", "vendor communication", "run-of-show planning"] },
  { audience: "real-estate-professionals", label: "Real Estate Professionals", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["property descriptions", "client follow-up", "market education"] },
  { audience: "farmers-agribusiness", label: "Farmers & Agribusiness", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["farm planning", "customer education", "record keeping"] },
  { audience: "ecommerce-sellers", label: "Ecommerce Sellers", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["product descriptions", "customer replies", "offer planning"] },
  { audience: "import-export-traders", label: "Import & Export Traders", category: "business", relatedCourse: "ai-for-everyday-business-owners", areas: ["supplier communication", "product research", "buyer education"] },
  { audience: "freelancers-consultants", label: "Freelancers & Consultants", category: "business", relatedCourse: "prompt-to-profit", areas: ["proposal writing", "client onboarding", "project reporting"] },
  { audience: "executives-managers", label: "Executives & Managers", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["decision briefs", "meeting summaries", "delegation notes"] },
  { audience: "personal-productivity", label: "Personal Productivity", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["weekly planning", "prioritization", "reflection and review"] },
  { audience: "diaspora-professionals", label: "Diaspora Professionals", category: "career", relatedCourse: "prompt-to-profit", areas: ["cross-border communication", "relocation planning", "African market research"] },
  { audience: "civil-servants", label: "Civil Servants", category: "public-sector", relatedCourse: "prompt-to-profit", areas: ["memo writing", "public communication", "report summaries"] },
  { audience: "local-government-officers", label: "Local Government Officers", category: "public-sector", relatedCourse: "prompt-to-profit", areas: ["citizen communication", "service documentation", "programme planning"] },
  { audience: "ai-beginners", label: "AI Beginners", category: "productivity", relatedCourse: "prompt-to-profit", areas: ["asking better questions", "safe AI practice", "everyday learning"] }
]

const expandedAudiencePromptAreas = expandedPromptAudienceSpecs.map((spec) => ({
  audience: spec.audience,
  relatedCourse: spec.relatedCourse,
  areas: spec.areas.map((area) => ({
    slug: `${spec.audience}-${slugPart(area)}-prompts`,
    category: spec.category,
    title: `${spec.label}: ${area.replace(/\b\w/g, (letter) => letter.toUpperCase())} Prompts`,
    summary: `Practical AI prompts for ${area} designed for ${spec.label.toLowerCase()}.`,
    area,
    prompts: [
      `Act as an AI assistant for ${spec.label.toLowerCase()}. I need help with ${area}. My context is [CONTEXT]. Ask me up to three clarifying questions, then give me a practical first draft.`,
      `Create a step-by-step workflow for ${area}. Audience or stakeholder: [AUDIENCE]. Goal: [GOAL]. Constraints: [CONSTRAINTS]. Keep it realistic for my environment.`,
      `Review this output for ${area}: [PASTE OUTPUT]. Tell me what is unclear, generic, risky, missing, or not specific enough for ${spec.label.toLowerCase()}.`,
      `Give me three versions of this ${area} output: simple, professional, and warm. Context: [CONTEXT]. Draft: [PASTE DRAFT].`,
      `Create a reusable prompt template I can use every time I need help with ${area}. Include placeholders for context, goal, audience, tone, constraints, and review criteria.`
    ]
  }))
}))

audiencePromptAreas.push(...expandedAudiencePromptAreas)

const promptOnlyResources = audiencePromptAreas.flatMap((audienceGroup, audienceIndex) =>
  audienceGroup.areas.map((area, areaIndex) => ({
    slug: area.slug,
    type: "prompt",
    audience: audienceGroup.audience,
    category: area.category,
    title: area.title,
    summary: area.summary,
    body: `## ${area.area}\nThese prompts are designed for ${audienceName(audienceGroup.audience)}. Use them when you need practical help with ${area.area}, then adapt the response to your real context before using it.`,
    prompt: promptPlaybookText({
      audience: audienceName(audienceGroup.audience),
      area: area.area,
      prompts: area.prompts
    }),
    useCase: `Use this when you need AI support for ${area.area} in a way that matches ${audienceName(audienceGroup.audience)}.`,
    customization: "Replace every bracketed placeholder with your real context. Add your location, audience, goal, constraints, tone, and examples. Ask one follow-up prompt to make the answer more specific before using it.",
    relatedCourse: audienceGroup.relatedCourse,
    featured: audienceIndex < 2 && areaIndex === 0
  }))
)

const waecFoundation = `## Why this resource exists
WAEC, JAMB, NECO, and school mock examinations reward preparation that is consistent, honest, and specific. You may be working hard already, but hard work becomes weaker when it is scattered. If you keep reading only the topics you enjoy, avoiding the topics that expose your weakness, copying answers you do not understand, or waiting until the final weeks before practicing under pressure, you will not get the full value of your effort. Artificial Intelligence can help, but only when you use it as a disciplined learning assistant rather than a shortcut for avoiding study.

The Tochukwu Tech approach is simple: AI should help you think, practice, review, and improve. It should not replace textbooks, teachers, past questions, class notes, parental guidance, or your own effort. If you simply ask AI for answers, you may feel busy, but you are not building exam strength. If you use AI to diagnose weak topics, explain concepts patiently, ask practice questions, mark your attempts, and review your mistakes, you are building a repeatable study system.

This resource is designed for Nigerian learners and families. It assumes you may be balancing school, home responsibilities, lessons, church or mosque activities, power supply issues, data limits, and exam anxiety. It also assumes that parents and guardians want practical support, not complicated educational theory. The goal is to make AI useful in everyday preparation without turning you into a passive copy-and-paste user.

The best way to use this resource is to combine it with real exam materials. You should still use school notes, recommended textbooks, official syllabuses, trusted past questions, and teacher feedback. AI becomes the extra study partner that is available when you need explanation, revision structure, practice questions, or a second look at a mistake. When used properly, it helps you study with more clarity and less panic.

A useful study session has four parts. First, choose a clear topic instead of saying, "I want to read Biology." Second, ask AI to explain the topic in simple terms and check the explanation against class materials. Third, practice questions without looking at the answer. Fourth, review your mistakes and write down what to revise next. This resource follows that cycle because it is how real understanding grows.

There is also an integrity rule. Do not use AI to cheat, impersonate someone else, submit work without understanding, or bypass school rules. Use it to learn faster, ask better questions, and build confidence. When you develop this habit early, you gain an advantage that goes beyond exams. You learn how to work with intelligent tools responsibly, which is now a life skill.`

function waecPremiumBody({ purpose, sections, practicePlan, parentNote, closing }) {
  return `${waecFoundation}

## What this resource helps you do
${purpose}

## The practical method
${sections}

## A seven-day way to apply it
${practicePlan}

## Guidance for parents, guardians, and teachers
${parentNote}

## How to measure progress
Progress should not be measured only by how long you sat with a book. A better measure is evidence. Can you explain the topic without reading from a note? Can you answer fresh questions under time pressure? Can you identify why a previous answer was wrong? Can you name the next topic to revise without guessing? If the answer to these questions improves, you are making progress.

Keep a simple record. For each study session, write the subject, topic, number of questions attempted, number correct, mistakes discovered, and next action. This record does not need to be beautiful. It needs to be honest. After one week, patterns will appear. You may discover that you understand a topic while reading but fail when questions are timed. You may discover that you know formulas but misread questions. You may also see that English comprehension affects performance across subjects.

AI is most useful when it helps you act on this evidence. You can paste your mistake record into AI and ask for a three-day correction plan. You can ask for five similar questions. You can ask for a simpler explanation of the exact concept that caused the mistake. This is how AI becomes a coach instead of a toy.

## Safety and responsible use
Do not paste private information, school passwords, home addresses, phone numbers, or sensitive family details into AI tools. Do not rely on AI as the only source of truth. AI can make mistakes, especially with exam-specific facts, dates, marking schemes, and local syllabus details. Always compare important answers with textbooks, teachers, or trusted materials.

You should also avoid using AI to write assignments you cannot explain. A better habit is to ask AI to teach, question, mark, and improve your own attempt. That habit builds confidence and protects integrity.

${closing}`
}

function waecPromptPack({ title, setup, prompts }) {
  return `${title}

${setup}

Use these prompts as starting points. Replace the details in brackets before sending the prompt to an AI tool. Keep your class notes, textbooks, and past questions nearby so that AI support remains connected to the real syllabus.

${prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n\n")}

After using any prompt, write down three things: what you understood better, what you still do not understand, and what you will practice next. This turns the AI conversation into a revision record instead of a one-time chat.`
}

const premiumWaecResources = {
  "ai-study-plan-for-waec-jamb-learners": {
    body: waecPremiumBody({
      purpose: `This guide helps the learner build a complete AI-supported study system. The system begins with subject diagnosis, moves into weekly planning, adds daily practice, and ends with mistake review. The learner is not asked to study everything at once. Instead, the learner learns how to identify the topics that matter most, create a realistic timetable, and use AI to explain, question, and review.`,
      sections: `Start by writing all examination subjects in one place. Under each subject, list the topics that have already been taught, the topics that feel confusing, and the topics that frequently appear in past questions. The learner should mark each topic as strong, average, weak, or untouched. This simple audit prevents random study.

Next, choose two priority subjects for the week. One should be a high-scoring opportunity, and one should be a weak subject that needs attention. Ask AI to create a timetable using the learner's real available time. The timetable must include explanation time, practice time, correction time, and rest. A plan that ignores rest will fail.

For each topic, use AI in layers. First ask for a simple explanation. Then ask for examples. Then ask for practice questions without answers. Then submit answers for marking. Finally, ask AI to identify the weak concept behind each mistake. This layered approach forces the learner to think.

At the end of each day, the learner should keep a mistake log. The log should include the question, the wrong answer, the correct answer, the reason for the mistake, and the next topic to revise. This is where improvement becomes measurable.`,
      practicePlan: `Day 1 should be used for the subject audit and timetable. Day 2 should focus on one weak topic in the first priority subject. Day 3 should focus on one weak topic in the second priority subject. Day 4 should be for timed practice. Day 5 should be for mistake review and re-practice. Day 6 should be for mixed questions across both subjects. Day 7 should be for a mini mock session and a new plan for the following week.`,
      parentNote: `Parents should not only ask, "Did you read?" A better question is, "Which topic did you practice today, what mistake did you find, and what will you do next?" This encourages evidence-based preparation. Parents can also help by protecting quiet study time, checking the mistake log weekly, and making sure AI is used for learning rather than answer copying.`,
      closing: `A complete study plan does not remove pressure, but it gives the learner a path. The learner knows what to study, how to practice, how to review, and how to ask for help. That clarity is the real advantage.`
    })
  },
  "waec-jamb-study-coach-prompt": {
    body: waecPremiumBody({
      purpose: `This resource turns AI into a study coach that explains topics, asks questions, waits for answers, marks attempts, and recommends next steps. It is designed for learners who need patient support outside class time, especially when they are embarrassed to ask the same question repeatedly.`,
      sections: `The learner should never begin with, "Explain everything about this subject." That is too broad. A better request is specific: subject, topic, class level, exam, and where the learner is confused. The AI coach should be instructed not to give all answers at once. It should ask questions one after another so the learner stays active.

The study coach method has five movements. It explains the topic simply. It gives examples. It asks questions. It marks the learner's answer. It recommends what to revise next. If the AI skips any of these steps, the learner should correct it and ask it to slow down.

This prompt is especially useful for Biology processes, Chemistry concepts, Literature themes, English comprehension, Mathematics steps, Government definitions, Economics graphs, and CRS/IRS explanations. It can also help learners prepare oral explanations before group study.`,
      practicePlan: `For seven days, the learner should use the coach prompt on one topic per day. Each session should last 30 to 45 minutes. The learner should save the final summary and mistake notes. At the end of the week, the learner should ask AI to review all seven summaries and identify repeating weaknesses.`,
      parentNote: `Parents can ask the learner to show the questions AI asked and the answers the learner gave. This is better than only seeing a neat AI-generated explanation. The evidence of learning is in the learner's attempt, correction, and improvement.`,
      closing: `A good coach does not merely talk. A good coach makes the learner attempt, struggle, correct, and try again. This prompt is built around that principle.`
    }),
    prompt: waecPromptPack({
      title: "WAEC/JAMB Study Coach Prompt Pack",
      setup: "These prompts approach the study coach role from different angles so the learner can use AI for explanation, questioning, mistake review, and confidence building.",
      prompts: [
        "Act as a patient WAEC/JAMB study coach. My exam is [EXAM], my class level is [CLASS], my subject is [SUBJECT], and my weak topic is [TOPIC]. Explain it simply, give three examples, then ask me five questions one by one. Wait for my answer before marking.",
        "Act as a strict but kind revision coach. I keep missing questions on [TOPIC]. Ask me diagnostic questions to find the exact concept I do not understand, then teach only that concept.",
        "Act as a past-question review coach. I will paste a question I got wrong. Explain why my answer was wrong, what clue I missed, and give me three similar questions.",
        "Act as a memory coach. Help me create simple memory aids for [TOPIC], but also test whether I understand the idea and not just the memory aid.",
        "Act as a one-question-at-a-time tutor. Do not lecture first. Ask me one easy question on [TOPIC], mark my answer, then slowly increase difficulty.",
        "Act as a revision timetable coach. I have [NUMBER] days before my exam and struggle with [SUBJECTS]. Create a realistic plan with practice and review blocks.",
        "Act as a confidence coach for exam anxiety. Help me prepare for [SUBJECT] by giving short tasks I can complete today and asking me reflective questions.",
        "Act as a concept comparison tutor. Explain the difference between [CONCEPT A] and [CONCEPT B] using examples from WAEC/JAMB-style questions.",
        "Act as an oral revision partner. Ask me to explain [TOPIC] in my own words, then identify gaps in my explanation.",
        "Act as a weekly progress reviewer. I will paste my study log. Tell me what improved, what is still weak, and what to study next week.",
        "Act as a mixed-practice quiz master. Give me ten questions across [TOPICS], do not show answers until I submit mine, and classify my mistakes afterwards.",
        "Act as a teacher preparing me for a mock exam. Give me a 45-minute revision session for [SUBJECT] with explanation, practice, and final review."
      ]
    })
  },
  "7-day-ai-study-planner-waec-jamb": {
    body: waecPremiumBody({
      purpose: `This planner gives the learner one practical week of structured revision. It is useful when the learner feels overwhelmed and needs a clear starting point. The planner does not promise magic. It helps the learner use seven days to diagnose weak topics, practice deliberately, review mistakes, and prepare a better plan for the next week.`,
      sections: `Before Day 1, the learner should gather class notes, past questions, textbooks, and a notebook for mistakes. The learner should choose two or three subjects, not every subject at once. The planner works because it creates focus.

Each day has a main task. The learner should begin with a short AI-supported explanation, move into independent practice, then use AI for review after attempting questions. The important rule is that answers should not be requested before the learner attempts the work.

At the end of every session, the learner should write a short reflection: what I studied, what I got wrong, what I now understand, and what I will revise next. This reflection is what makes the planner valuable.`,
      practicePlan: `Day 1 is for subject audit and weak-topic selection. Day 2 is for Topic A explanation and practice. Day 3 is for Topic B explanation and practice. Day 4 is for mixed questions under time pressure. Day 5 is for reviewing all wrong answers. Day 6 is for a mini mock using past questions. Day 7 is for correction, confidence review, and planning the next week.`,
      parentNote: `Parents can print or save the planner and check it at the end of each day. The goal is not to police the learner but to help the learner stay accountable. A calm weekly review is more useful than daily shouting.`,
      closing: `Seven days is enough to create momentum. If repeated honestly, this weekly cycle can change the way a learner prepares for exams.`
    })
  },
  "waec-jamb-subject-weakness-audit": {
    body: waecPremiumBody({
      purpose: `This worksheet helps learners stop guessing what to study. It turns vague worry into a clear map of subjects, topics, confidence levels, and next actions. Many learners say, "I am bad at Mathematics" or "I do not understand Chemistry." That statement is too broad to fix. A weakness audit breaks the problem into smaller topics that can be handled one at a time.`,
      sections: `The learner should list each subject, then write the major topics under that subject. For each topic, the learner should mark one of four levels: strong, average, weak, or untouched. The learner should also record evidence. Evidence may be a test score, past question result, teacher feedback, or personal confusion.

After scoring, the learner should choose priority topics. Priority does not always mean the hardest topic. It means topics that appear often, affect many questions, or block understanding of other areas. For example, weak algebra can affect many parts of Mathematics and Physics. Weak comprehension can affect English and other subjects.

AI can help after the audit. The learner can paste the weak-topic list and ask for a two-week revision plan. AI can also group topics by difficulty and suggest what to study first. However, the learner should confirm topic importance with teachers, textbooks, and past questions.`,
      practicePlan: `Day 1 is for listing subjects and topics. Day 2 is for scoring confidence honestly. Day 3 is for choosing five priority topics. Day 4 is for asking AI to create a revision order. Day 5 is for studying the first weak topic. Day 6 is for practice questions. Day 7 is for reviewing the audit and adjusting priorities.`,
      parentNote: `Parents should use the audit to support the learner rather than shame the learner. A weak topic is not a character problem. It is information. When parents treat weakness as information, learners become more willing to be honest.`,
      closing: `The audit is the foundation of intelligent study. Once the learner knows what is weak, every hour of revision becomes more purposeful.`
    })
  },
  "waec-jamb-mistake-review-tracker": {
    body: waecPremiumBody({
      purpose: `This tracker helps learners turn wrong answers into improvement. Many learners mark answers, feel bad, and move on. That wastes the value of practice. The wrong answer is not just a failure; it is a message. It shows what the learner misunderstood, forgot, rushed through, or failed to read carefully.`,
      sections: `A useful mistake log should capture six things: the subject, the topic, the question source, the wrong answer, the correct answer, and the reason for the mistake. The reason is the most important part. Was it a concept error? A careless reading error? A formula error? A time-pressure error? A memory gap? Each type of mistake needs a different response.

After recording mistakes, the learner should ask AI to classify them. For example, the learner can paste ten mistakes and ask, "What pattern do you see?" AI may notice that the learner understands the topic but rushes, or that the learner keeps confusing two similar concepts.

The learner should then create a re-practice date. A mistake is not fully corrected until the learner answers a similar question correctly later. This is why the tracker includes follow-up practice.`,
      practicePlan: `Day 1 is for setting up the tracker. Day 2 is for adding mistakes from one subject. Day 3 is for asking AI to classify those mistakes. Day 4 is for reviewing the weakest concept. Day 5 is for attempting similar questions. Day 6 is for timed practice. Day 7 is for checking whether old mistakes are reducing.`,
      parentNote: `Parents can ask to see the mistake categories, not just the scores. This helps the family understand whether the learner needs more explanation, more practice, better time management, or calmer exam habits.`,
      closing: `When you review mistakes properly, you become harder to defeat. Every wrong answer becomes training data for your next attempt.`
    })
  },
  "waec-jamb-essay-writing-practice-prompt": {
    body: waecPremiumBody({
      purpose: `This resource helps learners practice English essays with structure and feedback. Many learners struggle with essays because they try to write the full essay at once. A better approach is to practice the parts: understanding the question, planning the answer, writing the introduction, developing paragraphs, using appropriate tone, and editing for errors.`,
      sections: `The learner should begin by identifying the essay type. Argumentative essays, narratives, descriptive essays, formal letters, informal letters, articles, and reports do not use the same structure. AI can explain the structure, but the learner should write the actual essay attempt.

The strongest method is section-by-section practice. Ask AI to teach the structure. Then write only the introduction. Submit it for feedback. Improve it. Then write the next paragraph. This slows the process down enough for learning to happen.

AI can also mark essays using broad WAEC-style criteria: content, organization, expression, and mechanical accuracy. The learner should not treat the AI score as official, but the feedback can reveal weak introductions, poor paragraph flow, weak vocabulary, punctuation problems, or failure to answer the question.`,
      practicePlan: `Day 1 is for learning essay types. Day 2 is for introduction practice. Day 3 is for paragraph development. Day 4 is for formal and informal tone. Day 5 is for timed essay writing. Day 6 is for editing and correction. Day 7 is for writing one full essay and reviewing feedback.`,
      parentNote: `Parents can help by asking the learner to read the essay aloud. Reading aloud exposes awkward sentences and unclear arguments. Parents do not need to be English teachers to ask, "What is your main point?" or "Does this paragraph support the topic?"`,
      closing: `Essay writing improves through repeated attempts and clear feedback. This prompt pack gives learners a way to practice without waiting for formal marking every time.`
    }),
    prompt: waecPromptPack({
      title: "WAEC Essay Writing Prompt Pack",
      setup: "These prompts help the learner practice different parts of essay writing instead of asking AI to write the essay for them.",
      prompts: [
        "Act as a WAEC English essay coach. Essay type: [TYPE]. Topic: [TOPIC]. Teach me the structure, then ask me to write only the introduction. Mark my introduction before we continue.",
        "Help me understand this essay question: [QUESTION]. Identify the keywords, what the examiner expects, and mistakes students often make.",
        "Give me three possible outlines for this essay topic: [TOPIC]. Explain which outline is strongest and why.",
        "I will paste my introduction. Mark it for clarity, relevance, grammar, and strength. Do not rewrite everything; show me what to improve.",
        "Act as a paragraph coach. Give me one paragraph topic sentence for [ESSAY TOPIC], then ask me to complete the paragraph.",
        "Mark this paragraph using WAEC-style feedback: content, organization, expression, and mechanical accuracy. Paragraph: [PASTE].",
        "Teach me how to write a formal letter on [TOPIC]. Show the structure, tone, and common mistakes, then quiz me.",
        "Teach me how to improve weak sentences in my essay without using unnecessarily big words. Here is my sentence: [PASTE].",
        "Give me five practice essay topics for [CLASS LEVEL] and classify them by essay type.",
        "Act as an editing coach. I will paste my full essay. Identify repeated grammar mistakes and give me a correction checklist.",
        "Help me turn this rough story idea into a better narrative essay plan without writing the essay for me: [IDEA].",
        "Act as a timed essay examiner. Give me a topic, a 5-minute planning task, a 30-minute writing target, and a marking checklist."
      ]
    })
  },
  "waec-jamb-maths-step-by-step-practice-prompt": {
    body: waecPremiumBody({
      purpose: `This resource helps learners use AI for Mathematics and calculation-based subjects without jumping straight to answers. Maths confidence grows when the learner understands the steps, knows why a formula applies, and practices similar questions. Copying a final solution does not build that confidence.`,
      sections: `The learner should paste one question at a time and instruct AI not to solve everything immediately. The AI should first identify what the question is asking, then identify the concept or formula, then ask the learner for the first step. This keeps the learner active.

When the learner makes a mistake, AI should explain the exact point of error. Was the formula wrong? Was a sign changed? Was there a multiplication error? Did the learner skip a condition in the question? This diagnosis matters because different errors need different correction.

The learner should also ask for similar questions after each solved example. One solved question is not enough. Understanding becomes stronger when the learner practices variations.`,
      practicePlan: `Day 1 is for choosing one weak maths topic. Day 2 is for guided examples. Day 3 is for independent practice. Day 4 is for error classification. Day 5 is for timed questions. Day 6 is for mixed-topic review. Day 7 is for reattempting old mistakes without help.`,
      parentNote: `Parents should not worry if they cannot solve the maths themselves. They can still ask the learner to explain the steps aloud. If the learner cannot explain, the learner should return to the concept before attempting more questions.`,
      closing: `The goal is not to make AI the calculator. The goal is to make AI the patient step-by-step tutor that forces the learner to understand.`
    }),
    prompt: waecPromptPack({
      title: "WAEC/JAMB Maths Practice Prompt Pack",
      setup: "These prompts help learners build step-by-step reasoning in Mathematics, Physics calculations, Chemistry calculations, and quantitative reasoning.",
      prompts: [
        "Act as a WAEC/JAMB Mathematics tutor. Topic: [TOPIC]. Question: [PASTE]. Do not solve fully. First identify what is being asked, then ask me for the first step.",
        "I got this maths question wrong: [PASTE]. My answer was [ANSWER]. Explain the exact mistake and give me two similar questions.",
        "Teach me the formula for [TOPIC] using simple language, then give me three questions from easy to hard.",
        "Act as a formula coach. Show me when to use [FORMULA], when not to use it, and common traps in exam questions.",
        "Give me five JAMB-style questions on [TOPIC]. Do not show answers until I submit mine.",
        "Help me compare these two concepts: [CONCEPT A] and [CONCEPT B]. Show how exam questions try to confuse students.",
        "Act as a speed coach. Give me ten short questions on [TOPIC] and help me reduce time without losing accuracy.",
        "I understand examples but fail past questions. Diagnose why using this topic: [TOPIC]. Ask me questions one by one.",
        "Create a mistake table from these wrong answers: [PASTE]. Classify each mistake as concept, formula, arithmetic, reading, or time pressure.",
        "Explain this solution line by line and ask me to predict the next step before showing it: [PASTE SOLUTION].",
        "Give me a 30-minute revision drill for [TOPIC] with explanation, practice, marking, and correction.",
        "Act as a calm tutor for a learner afraid of maths. Teach [TOPIC] slowly and celebrate understanding, but still mark strictly."
      ]
    })
  },
  "waec-jamb-cbt-practice-routine": {
    body: waecPremiumBody({
      purpose: `This guide helps JAMB and mock-exam learners practice for computer-based tests with structure. CBT performance depends on knowledge, speed, calmness, and familiarity with answering under time pressure. A learner may know a topic but still lose marks because of poor pacing, panic, or careless clicking.`,
      sections: `The routine has three parts: timed practice, review, and re-practice. Timed practice trains speed. Review trains understanding. Re-practice confirms correction. Learners should not only celebrate the score. They should examine how the score happened.

During timed practice, the learner should avoid checking notes. After the timer ends, the learner should mark answers and collect wrong questions. Then AI can be used to explain mistakes, classify weak areas, and generate similar practice questions.

The learner should also practice skipping. In CBT, one difficult question should not steal time from easier marks. A good habit is to answer known questions first, mark uncertain ones mentally, and return if time allows. AI can help create drills where questions are mixed by difficulty.`,
      practicePlan: `Day 1 is for a baseline timed test. Day 2 is for mistake review from that test. Day 3 is for topic-specific practice. Day 4 is for mixed-subject speed drills. Day 5 is for reading-comprehension and calculation timing. Day 6 is for a longer mock. Day 7 is for correction and pacing strategy.`,
      parentNote: `Parents can support CBT preparation by asking for score trends and mistake patterns, not just one result. They can also help learners create quiet timed sessions that feel like the real exam environment.`,
      closing: `CBT confidence is built before exam day. The learner who has practiced timing, review, and correction is less likely to panic when the real screen appears.`
    })
  },
  "parent-support-plan-for-waec-jamb-learners": {
    body: waecPremiumBody({
      purpose: `This checklist helps parents and guardians support exam preparation without creating fear. Many parents want good results but unintentionally increase pressure by asking only about reading time, comparing children, or reacting harshly to weak scores. This resource gives parents a calmer, more useful way to support preparation.`,
      sections: `Parents should begin with structure. Help the learner identify quiet study time, reduce distractions, gather materials, and create a weekly plan. Then ask evidence-based questions: What topic did you study? What questions did you attempt? What mistakes did you find? What will you review tomorrow?

Parents should also guide AI use. The learner should not paste personal information into AI tools or copy answers without understanding. Parents can ask the learner to show the prompt used and explain what they learned from the response.

Emotional support matters. Exam preparation can create anxiety, especially when the learner has failed before or feels behind classmates. Parents should encourage consistency and honesty. A weak score should lead to diagnosis, not shame.`,
      practicePlan: `Day 1 is for a family conversation about exam goals. Day 2 is for setting study times. Day 3 is for checking the subject weakness audit. Day 4 is for reviewing one AI-supported study session. Day 5 is for checking the mistake tracker. Day 6 is for encouraging a timed practice session. Day 7 is for a calm weekly review and adjustment.`,
      parentNote: `The parent's role is not to become the learner's teacher in every subject. The role is to create the conditions for learning, ask better questions, encourage integrity, and notice when the learner needs extra help.`,
      closing: `A supported learner is more likely to stay consistent. Support does not mean pressure every minute. It means structure, encouragement, accountability, and wise guidance.`
    })
  }
}

function readerVoice(content) {
  if (!content) return content
  return content
    .replace(/\bThe learner should\b/g, "You should")
    .replace(/\bthe learner should\b/g, "you should")
    .replace(/\bThe learner can\b/g, "You can")
    .replace(/\bthe learner can\b/g, "you can")
    .replace(/\bThe learner is\b/g, "You are")
    .replace(/\bthe learner is\b/g, "you are")
    .replace(/\bThe learner has\b/g, "You have")
    .replace(/\bthe learner has\b/g, "you have")
    .replace(/\bThe learner knows\b/g, "You know")
    .replace(/\bthe learner knows\b/g, "you know")
    .replace(/\bThe learner needs\b/g, "You need")
    .replace(/\bthe learner needs\b/g, "you need")
    .replace(/\bThe learner may\b/g, "You may")
    .replace(/\bthe learner may\b/g, "you may")
    .replace(/\bThe learner\b/g, "You")
    .replace(/\bthe learner\b/g, "you")
    .replace(/\blearner's\b/g, "your")
    .replace(/\bLearner's\b/g, "Your")
    .replace(/\blearners' own\b/g, "your own")
    .replace(/\blearners'\b/g, "your")
    .replace(/\bLearners should\b/g, "You should")
    .replace(/\blearners should\b/g, "you should")
    .replace(/\bLearners can\b/g, "You can")
    .replace(/\blearners can\b/g, "you can")
    .replace(/\bLearners\b/g, "Students")
    .replace(/\blearners\b/g, "students")
}

function premiumAudienceGuide({ audience, promise, context, method, routine, mistakes, safety, nextStep }) {
  const normalized = audience.toLowerCase()

  if (normalized.includes("parent")) {
    return `## Start with the real problem at home
${context}

Your child may already be using AI before you have had time to form an opinion about it. They may hear about ChatGPT from classmates, see AI features inside search, use writing tools on a phone, or ask AI to explain homework when no adult is nearby. Your job is not to panic or pretend the technology does not exist. Your job is to create clear rules that protect privacy, honesty, learning, and emotional safety.

## What good AI use looks like for your child
${promise}

Good AI use at home should look like explanation, practice, revision, creativity, and supervised building. It should not look like secret conversations, copied assignments, private family details inside a chatbot, or a child submitting work they cannot explain. A useful rule is simple: AI may help you learn, but it must not replace your thinking.

## A parent conversation that works
${method}

Do not begin with a lecture. Ask your child three questions: What AI tools have you seen? What do your classmates use them for? What do you think AI gets wrong? Their answers will show you whether they see AI as a toy, shortcut, tutor, or mystery. From there, agree on house rules that are short enough to remember.

Use this script: "You can use AI to explain topics, create practice questions, plan revision, and improve your own draft. You cannot use it to copy schoolwork, hide what you are doing, share private information, or pretend an AI answer is your own understanding."

## Your first week of AI rules at home
${routine}

Day 1: ask your child to show you one AI interaction. Day 2: write the no-private-information rule together. Day 3: turn one homework question into a learning prompt instead of an answer prompt. Day 4: ask your child to explain an AI answer back to you. Day 5: discuss copying and honesty. Day 6: choose approved times and places for AI use. Day 7: review what felt helpful or unsafe.

## Mistakes parents commonly make
${mistakes}

One mistake is banning everything so the child simply learns to hide it. Another is allowing everything because it looks educational. The better middle ground is supervised confidence. You do not need to know every tool; you need to know the rules. You should also avoid praising polished AI-written work unless your child can explain the ideas in their own words.

## Privacy and safety boundaries
${safety}

Your child should not enter home addresses, school passwords, family problems, phone numbers, pictures, full names of classmates, or private school portal information into AI tools. If a tool asks for age, payment, account permissions, or uploads, pause first. Children need adults around these decisions.

## What to check every week
Ask what your child used AI for, what prompt they typed, what they learned, and what they changed after reading the output. If they cannot explain the answer, the session was not learning. If they can explain it better than before, AI helped.

${nextStep}`
  }

  if (normalized.includes("teacher")) {
    return `## Start from your classroom, not from a blank prompt
${context}

Your class is not generic. You know the learners who rush through work, the ones who are quiet but capable, the ones who need examples before the concept lands, and the ones who can handle extension tasks. AI becomes useful for teaching only when you give it that classroom reality. If you ask for "a lesson plan on photosynthesis", you will get ordinary notes. If you describe your class level, timing, weak areas, available materials, and learning outcome, you get something closer to a teachable plan.

## What you should be able to prepare faster
${promise}

Use AI for lesson structure, starter questions, examples, differentiated tasks, rubrics, feedback comments, parent-friendly explanations, and remedial practice. Keep your professional judgment in charge. AI can draft; you decide whether the draft fits your syllabus, school culture, class level, and time.

## The lesson planning workflow
${method}

Start with the exact class and topic. Add what students already know, what confused them last time, and how long the lesson will last. Ask for a plan with teacher explanation, student activity, quick assessment, and homework. Then ask for two adaptations: one for struggling learners and one for fast learners.

For example: "I teach JSS2 Basic Science. My students confuse evaporation and boiling. I have 40 minutes and no lab equipment. Create a lesson with local examples, questions, and a quick exit ticket."

## A practical teaching week
${routine}

Day 1: generate the lesson outline. Day 2: create starter questions to test prior knowledge. Day 3: create class activities and examples from the students' environment. Day 4: create assessment questions and marking guidance. Day 5: generate remedial support for students who fail the exit ticket. Day 6: teach and record what confused students. Day 7: ask AI to help improve next week's lesson based on your notes.

## Mistakes that make AI lesson plans weak
${mistakes}

Do not accept activities that require resources your class does not have. Do not use examples that are foreign to your students when local examples would work better. Do not let AI make the lesson longer than the period allows. Do not paste names or private student issues into AI. Describe learning patterns instead.

## Responsible classroom use
${safety}

When using AI for feedback, remove student names and sensitive details. When creating questions, check every answer. When preparing parent communication, keep the tone respectful and specific. AI should reduce your workload, but it must not reduce your care.

## How to know it is working
You should see clearer lesson flow, faster preparation, more targeted questions, and better feedback. Students should still hear your voice, your examples, and your expectations. If the material sounds like it could be used in any classroom anywhere, add your class reality before using it.

${nextStep}`
  }

  if (normalized.includes("school owner") || normalized.includes("school leader")) {
    return `## AI adoption is now a leadership decision
${context}

As a school leader, your problem is not simply whether AI is exciting. Your problem is how to introduce it without confusing parents, exposing students, overwhelming teachers, or buying tools that do not improve learning. AI must serve a school outcome: better teaching preparation, stronger revision support, clearer parent communication, faster administration, improved admissions follow-up, or more confident digital learning.

## What responsible adoption should produce
${promise}

You should be able to choose one useful pilot, set boundaries for staff, explain the direction to parents, and measure whether the pilot saves time or improves quality. Do not begin with a school-wide announcement. Begin with a controlled workflow that proves value.

## Choose the first pilot carefully
${method}

Good first pilots include teacher lesson planning support, parent newsletter drafting, admissions follow-up, internal memo drafting, revision question generation, staff training notes, or school policy summaries. Poor first pilots include unsupervised student chatbots, automated grading without review, or tools that collect student data before privacy has been discussed.

## A 30-day school rollout
${routine}

Week 1: list repeated staff and admin tasks. Week 2: choose one low-risk pilot and write the rules. Week 3: train a small group of teachers or admin staff. Week 4: collect evidence: time saved, quality improved, mistakes found, and staff confidence. Only expand after the pilot has produced evidence.

## Leadership mistakes to avoid
${mistakes}

Do not buy an AI subscription because another school mentioned AI. Do not make teachers feel judged for not knowing the tools yet. Do not tell parents AI will replace teaching. Do not allow staff to paste student records into public tools. Do not launch a student-facing system before adults understand the risks.

## Policy and trust
${safety}

Your policy should cover approved tools, prohibited data, teacher review, student use, parent communication, assessment integrity, and incident reporting. Keep it short enough to use. A beautiful policy nobody follows is not governance.

## What success looks like
Success is not a poster that says your school uses AI. Success is a teacher preparing better questions faster, an admissions officer following up more consistently, parents receiving clearer updates, and students getting better support without privacy being compromised.

${nextStep}`
  }

  if (normalized.includes("job seeker") || normalized.includes("nysc")) {
    return `## Your CV problem is probably not grammar
${context}

Many NYSC members and job seekers ask AI to "make my CV better" and receive polished but empty wording. That does not solve the real problem. Employers need evidence. They want to know what you have done, what tools you can use, what problems you have solved, how you communicate, and whether you can explain your work.

## What AI should help you clarify
${promise}

Use AI to organize your experience, turn vague responsibilities into evidence, tailor your CV to a role, prepare interview stories, and plan a simple portfolio. Do not use it to invent experience. Anything AI writes must be something you can defend in an interview.

## Build from real evidence
${method}

List school projects, NYSC tasks, volunteer work, internships, personal projects, small businesses, leadership roles, certifications, and tools you have used. For each one, write what you did, who benefited, what changed, and what proof exists. Then ask AI to help you express it clearly.

Example: instead of "hardworking team player", give AI the raw material: "I organized weekly CDS attendance records for 74 corps members using Google Sheets and reduced missing records." That can become a credible bullet.

## Seven days to a stronger application
${routine}

Day 1: gather real experience. Day 2: rewrite your CV summary for one role. Day 3: improve bullet points with evidence. Day 4: tailor the CV to a real job description. Day 5: prepare five interview stories using the STAR method. Day 6: outline a portfolio page. Day 7: review every claim and remove anything you cannot defend.

## Mistakes that make applications weak
${mistakes}

Do not let AI fill your CV with empty phrases like "dynamic professional" and "results-driven individual" unless there is evidence behind them. Do not submit the same CV to every role. Do not use tools, numbers, or responsibilities you have never touched. Do not paste private referee details or ID numbers into AI.

## Interview integrity and privacy
${safety}

AI can help you practice, but it cannot attend the interview for you. Practice explaining your work aloud. Remove private addresses, referee phone numbers, identification numbers, and confidential employer information before using AI.

## What progress looks like
Your CV should become more specific, your interview answers should sound more natural, and your portfolio should show visible proof. A recruiter should be able to understand your direction within one minute.

${nextStep}`
  }

  if (normalized.includes("business")) {
    return `## Start with the business task that wastes your time
${context}

If you run a small business, AI is useful only when it touches work you already do: replying customers on WhatsApp, describing products, following up unpaid orders, planning content, writing staff instructions, handling complaints, summarizing supplier messages, or preparing simple records. You do not need AI theatre. You need a cleaner workflow.

## What the workflow should change
${promise}

Pick one repeated task and make it easier, faster, or more consistent. A good AI workflow should help you respond faster without sounding careless, plan content without guessing, explain policies without sounding rude, and train staff without repeating yourself every day.

## Build one reusable business prompt
${method}

Write your business context first: what you sell, who you sell to, your tone, your policies, delivery limits, refund rules, location, price range, and common customer objections. Then ask AI to help with one task. If you run a food brand, your prompt should not sound like a fashion store. If you sell courses, your reply should not sound like a logistics company.

## A one-week workflow test
${routine}

Day 1: list repeated messages and admin tasks. Day 2: choose one painful workflow. Day 3: write the business context AI needs. Day 4: test three prompts using real but anonymized scenarios. Day 5: create approved templates. Day 6: use the best template in real conversations. Day 7: review whether it saved time or improved tone.

## Mistakes that cost trust
${mistakes}

Do not let AI promise delivery dates, refunds, discounts, stock availability, or outcomes you cannot honour. Do not paste full customer addresses or payment details. Do not sound robotic on WhatsApp. Your customers should still feel they are speaking with your business, not a random corporate script.

## Customer privacy and operational control
${safety}

Summarize customer issues instead of pasting private data. Keep final approval with you or a trained staff member. Save only templates that match your brand. If a message involves money, complaints, safety, or legal terms, review it carefully before sending.

## What success looks like
You should have fewer repeated typing tasks, clearer customer replies, better follow-up, and content that actually reflects your offers. AI should make your business more consistent, not more generic.

${nextStep}`
  }

  if (normalized.includes("founder")) {
    return `## Do not start with the app
${context}

As a non-technical founder, your biggest risk is not that you cannot code. Your biggest risk is building the wrong thing with confidence. AI can help you think through the idea before you pay for development, hire someone, or spend weeks prompting a tool to create features nobody wants.

## What you should prove first
${promise}

Before you build, clarify the user, the painful problem, the current workaround, the promise, the smallest useful version, and the evidence that someone cares. AI should challenge your thinking, not flatter your idea.

## Use AI as a product strategist
${method}

Describe your idea plainly. Then ask AI to identify assumptions, missing user details, risky features, competitors, interview questions, and the smallest version worth testing. If the answer is too positive, ask for the skeptical version. You need pressure before you need praise.

## Seven days before you build
${routine}

Day 1: define the user and problem. Day 2: list how people solve it today. Day 3: write customer interview questions. Day 4: define the MVP and remove non-essential features. Day 5: sketch the user journey. Day 6: create a landing page or clickable prototype. Day 7: decide whether to build, narrow, pause, or test again.

## Founder mistakes AI can hide
${mistakes}

Do not ask AI to validate your idea by agreeing with you. Do not turn every idea into a platform. Do not treat a feature list as a business model. Do not let AI produce a polished product document that has no evidence behind it.

## Confidentiality and judgment
${safety}

Avoid pasting confidential investor terms, private customer records, proprietary contracts, or sensitive strategy into public AI tools. Use anonymized summaries. If you are discussing legal or financial commitments, get professional advice.

## What progress looks like
You should end the process with a sharper product scope, fewer unnecessary features, better interview questions, and a clearer decision about what to test next. The goal is not a bigger idea. The goal is a more testable one.

${nextStep}`
  }

  if (normalized.includes("children")) {
    return `## Children need supervised imagination, not unrestricted access
${context}

AI can make learning playful for children. It can create spelling games, story ideas, quiz questions, vocabulary practice, coding explanations, and simple project plans. But a child may not know when an answer is false, when a question is too private, or when a tool is asking for information they should not share.

## What safe use should look like
${promise}

The goal is to help a child learn, create, and explain, while an adult remains close enough to guide privacy, honesty, and emotional safety. AI should not become a secret companion, a homework shortcut, or an unsupervised adult-like voice in the child's life.

## Start with one supervised activity
${method}

Choose a simple activity: create a story plan, practice vocabulary, revise multiplication, ask for a quiz, or plan a small Scratch/project idea. Sit with the child. Read the response together. Ask what they understood and what they think may be wrong.

## One week of safe introduction
${routine}

Day 1: explain that AI can be helpful but can make mistakes. Day 2: agree on private information that must never be shared. Day 3: use AI for a quiz. Day 4: find one wrong or weak AI answer together. Day 5: create a story or project. Day 6: discuss copying. Day 7: write simple family or classroom rules.

## Mistakes adults should avoid
${mistakes}

Do not give children unsupervised access to unknown tools. Do not reward copied AI output as if it were understanding. Do not allow children to upload photos, school details, or personal stories without review. Do not turn AI into a babysitter.

## Safety rules children can remember
${safety}

Use rules a child can repeat: do not share your full name, school, address, phone number, password, photos, family problems, or private messages. If AI says something scary, confusing, rude, or too personal, stop and tell an adult.

## What progress looks like
The child should become more curious, more able to explain ideas, and more careful with information. If AI use makes the child more secretive, more dependent, or less honest with schoolwork, pause and reset the rules.

${nextStep}`
  }

  if (normalized.includes("project")) {
    return `## A real project starts with one user and one task
${context}

AI can help you build faster, but it cannot rescue a vague idea. If you ask for a complete app with no user, no screen plan, no data structure, and no testing habit, you will get confusion quickly. A useful project begins with a small promise: one person needs to do one thing better.

## What you should build first
${promise}

Start with a first version that proves the core workflow. If it is a website, define the sections and call to action. If it is a dashboard, define the data and actions. If it is a tool, define the input, output, and success condition. Add features only after the first version works.

## How to guide AI like a builder
${method}

Give AI the user, goal, screens, data, constraints, and design direction. Ask for one piece at a time. Test before expanding. Keep a changelog of prompts, errors, and fixes. When something breaks, paste the exact error and ask for a focused correction instead of starting again.

## A practical build week
${routine}

Day 1: write the project brief. Day 2: sketch screens. Day 3: generate the first version. Day 4: test on desktop and mobile. Day 5: add one important feature. Day 6: fix bugs and improve content. Day 7: deploy or prepare for feedback from a real user.

## Mistakes beginners make
${mistakes}

Do not build ten features before the first page works. Do not ignore errors because the design looks nice once. Do not paste API keys, database passwords, or real customer data into prompts. Do not accept code you cannot run.

## Security and data discipline
${safety}

Use test data. Keep secrets in environment variables. Do not expose admin pages publicly. Do not collect information you do not need. If users will log in or pay, treat security as part of the project, not an afterthought.

## What progress looks like
Progress is a working version someone can open, test, and understand. A small live project is more valuable than a large unfinished idea.

${nextStep}`
  }

  if (normalized.includes("government") || normalized.includes("public-sector")) {
    return `## Public-sector AI must begin with trust
${context}

A ministry, agency, local government office, school board, or public institution cannot adopt AI the same way an individual experiments with a chatbot. Public work involves citizens, records, accountability, procurement, policy, and reputation. The first question is not "Which AI tool should we buy?" The first question is "Which low-risk public workflow can improve without harming trust?"

## What readiness should mean
${promise}

You should be able to identify workflows suitable for AI support, remove high-risk decisions from the first pilot, define human review, protect sensitive data, and measure whether service delivery improves. AI should assist public servants; it should not make citizen-impacting decisions without governance.

## Choose low-risk pilots first
${method}

Better starting points include public FAQ drafts, internal memo summaries, meeting note organization, training material, policy research support, citizen communication templates, and document classification where no rights or benefits are decided automatically. Avoid automated approvals, eligibility decisions, sensitive citizen profiling, or anything involving confidential records in the first pilot.

## A responsible pilot week
${routine}

Day 1: list repeated service tasks. Day 2: classify each by data sensitivity and public impact. Day 3: choose one low-risk pilot. Day 4: define what data is allowed. Day 5: train a small team. Day 6: test outputs against official sources. Day 7: document errors, benefits, and governance needs.

## Institutional mistakes to avoid
${mistakes}

Do not confuse a vendor demo with readiness. Do not put citizen records into public tools. Do not allow every department to improvise separately. Do not automate decisions affecting rights, access, money, or public services without legal, ethical, and operational review.

## Data protection and accountability
${safety}

Remove personally identifiable information where possible. Keep human review for public communication and decisions. Document who used the tool, for what purpose, what data was entered, and how outputs were checked. Trust depends on traceability.

## What progress looks like
Progress is a small, documented pilot that improves speed or clarity while preserving accountability. The public should not experience AI as confusion. They should experience it as clearer communication, faster service support, and better organized institutions.

${nextStep}`
  }

  return `## Why this resource matters
${context}

## What you will be able to do
${promise}

## The practical method
${method}

## Implementation routine
${routine}

## Common mistakes to avoid
${mistakes}

## Safety and responsible use
${safety}

${nextStep}`
}

function premiumPromptPack({ title, audience, setup, prompts }) {
  return `${title}

${setup}

Use these prompts as starting points. Replace the details in brackets with your real situation. Do not send a prompt once and stop. Review the output, then ask for a sharper version, a simpler version, a more local version, or a version matched to your audience.

${prompts.map((prompt, index) => `${index + 1}. ${prompt}`).join("\n\n")}

After using any prompt, save the version that worked best. Add notes about when you used it, what you changed, and what result it produced. Over time, you will build a practical prompt bank for ${audience}, not a generic collection copied from the internet.`
}

const audienceResourceSpecs = [
  {
    slug: "parent-guide-to-safe-ai-use-at-home",
    body: premiumAudienceGuide({
      audience: "parents and guardians",
      context: "AI is already entering the home through phones, school assignments, search tools, social media, and children talking with classmates. As a parent, you do not need to become a programmer before you guide your child. You need a practical understanding of what AI can do, what it should not be trusted with, and how to create boundaries that protect learning, safety, and character.",
      promise: "You will learn how to set simple AI rules at home, guide your child away from copying, encourage better learning habits, and talk about online safety without sounding alarmist or confused.",
      method: "Start with a family AI conversation. Ask your child what AI tools they have seen, what classmates use them for, and what they think AI is good at. Then create three house rules: do not share private information, do not copy schoolwork without understanding it, and do not use AI secretly for anything that affects school integrity or personal safety.",
      routine: "Use the first week to observe, not panic. Review one AI conversation with your child, ask what they learned, and help them rewrite one weak prompt into a better learning prompt. By the end of the week, agree on when AI is allowed, when an adult should be present, and what information must never be entered.",
      mistakes: "Do not ban everything without understanding it, and do not allow everything because it looks educational. Both extremes fail. Also avoid judging only the final answer. Ask your child to explain how they got there.",
      safety: "Children should not paste addresses, phone numbers, passwords, school portals, family problems, or personal photos into AI tools without adult guidance. If a tool asks for age, account details, or permissions, pause and review it first.",
      nextStep: "Your next step is to write a one-page family AI agreement. Keep it simple enough that a child can understand it and practical enough that you can actually enforce it."
    })
  },
  {
    slug: "teacher-lesson-planning-prompt",
    body: premiumAudienceGuide({
      audience: "teachers",
      context: "Teachers are under pressure to prepare lessons, mark work, support weak learners, respond to parents, and still keep classes engaging. AI can help, but it must support your professional judgment. It should not flatten your teaching into generic notes or remove your understanding of the students in front of you.",
      promise: "You will learn how to use AI to plan lessons, create activities, prepare assessment questions, differentiate tasks, and generate feedback while keeping your own classroom context at the center.",
      method: "Begin with the class level, subject, topic, lesson duration, prior knowledge, available materials, and the exact learning outcome. Ask AI to create a lesson plan, then review whether it fits your students. Ask for a simpler version for struggling learners and an extension task for stronger learners.",
      routine: "Use one topic this week. On Day 1, create the lesson outline. On Day 2, generate starter questions. On Day 3, create practice activities. On Day 4, create assessment questions. On Day 5, adapt for weak and strong learners. On Day 6, teach. On Day 7, review what worked.",
      mistakes: "Do not accept AI lesson plans that ignore your syllabus, classroom time, local examples, or student ability. Do not let AI overcomplicate a simple topic. Your students need clarity, not decorative planning.",
      safety: "Do not paste identifiable student records, private family information, disciplinary notes, or sensitive learning concerns into AI tools. Describe patterns without exposing children.",
      nextStep: "Your next step is to build a reusable lesson planning prompt for your subject and class level, then improve it after each real lesson."
    }),
    prompt: premiumPromptPack({
      title: "Teacher Lesson Planning Prompt Pack",
      audience: "your classroom",
      setup: "These prompts help you plan, teach, assess, and improve lessons without losing your professional voice.",
      prompts: [
        "Act as an experienced Nigerian classroom teacher. Create a lesson plan for [CLASS] on [TOPIC] in [SUBJECT]. Include objectives, prior knowledge, starter, explanation, activity, assessment, homework, and differentiation.",
        "Turn this topic into a 40-minute lesson for students who struggle with [CHALLENGE]. Keep the language simple and include examples from Nigeria.",
        "Create five starter questions that reveal whether my students understand [PRIOR TOPIC] before I teach [NEW TOPIC].",
        "Create three class activities for [TOPIC]: one individual task, one pair task, and one group task.",
        "Generate ten assessment questions on [TOPIC], arranged from easy to difficult, and include marking guidance.",
        "Rewrite this explanation so it is clearer for [AGE/CLASS]: [PASTE EXPLANATION].",
        "Create a remedial mini-lesson for students who failed questions on [CONCEPT].",
        "Create an extension activity for fast learners who already understand [TOPIC].",
        "Help me write constructive feedback for a student who [SITUATION]. Keep it respectful and specific.",
        "Create a parent-friendly explanation of what we are learning in [SUBJECT] this week and how parents can support at home.",
        "Create a simple rubric for marking [ASSIGNMENT TYPE] in [SUBJECT].",
        "After this lesson, help me reflect on what worked, what confused students, and how to improve the next class: [LESSON NOTES]."
      ]
    })
  },
  {
    slug: "ai-adoption-roadmap-for-school-owners",
    body: premiumAudienceGuide({
      audience: "school owners and school leaders",
      context: "Schools are hearing about AI from parents, teachers, students, vendors, and competitors. The temptation is to buy tools quickly or announce an AI programme without preparing staff. That is risky. Good AI adoption in a school begins with outcomes, policy, teacher readiness, parent communication, and careful pilots.",
      promise: "You will learn how to introduce AI into your school responsibly, beginning with teacher productivity, student support, administrative workflows, and parent trust.",
      method: "Start with a leadership decision: what problem should AI help the school solve first? Teacher lesson planning, revision support, parent communication, admissions follow-up, staff training, and administrative reporting are better starting points than vague promises about future technology.",
      routine: "Use the first week to map opportunities. Interview teachers, list repeated admin tasks, review parent communication gaps, choose one pilot, and define how success will be measured. Do not roll out to every class immediately.",
      mistakes: "Do not introduce AI without a policy. Do not leave teachers alone to figure it out. Do not promise parents that AI will replace teaching. Do not collect student data in tools you have not reviewed.",
      safety: "Protect student privacy. Create staff rules for data handling. Decide which tools are approved, which use cases are allowed, and when human review is required.",
      nextStep: "Your next step is to create a 30-day AI pilot plan for one department or workflow before school-wide adoption."
    })
  },
  {
    slug: "ai-cv-and-interview-prep-for-job-seekers",
    body: premiumAudienceGuide({
      audience: "NYSC members and job seekers",
      context: "Many job seekers use AI to rewrite CVs, but the result often sounds generic. Employers do not need another polished document that says nothing specific. You need a clearer story, stronger evidence, better role targeting, and interview preparation that reflects your real experience.",
      promise: "You will learn how to use AI to improve your CV, prepare interview stories, tailor applications, and build a simple portfolio without inventing experience.",
      method: "Start by listing your real experiences: school projects, NYSC responsibilities, internships, volunteer work, business activities, leadership roles, and measurable outcomes. Then use AI to turn responsibilities into clearer achievements, not fake claims.",
      routine: "Use Day 1 to collect experience. Day 2 to improve your CV summary. Day 3 to rewrite experience bullets. Day 4 to tailor your CV to one job description. Day 5 to prepare interview stories. Day 6 to build a portfolio outline. Day 7 to review everything for honesty and clarity.",
      mistakes: "Do not let AI invent tools, companies, metrics, or responsibilities you cannot defend. Do not submit the same CV everywhere. Do not use big words that make you sound less credible.",
      safety: "Remove private referee phone numbers, home addresses, identification numbers, and sensitive personal details before pasting CV content into AI tools.",
      nextStep: "Your next step is to create a master CV and one tailored CV for a real job description this week."
    })
  },
  {
    slug: "small-business-ai-workflow-checklist",
    body: premiumAudienceGuide({
      audience: "small business owners",
      context: "Small businesses do not need AI theatre. You need more sales, clearer communication, faster follow-up, better records, easier content creation, and less repeated manual work. AI becomes valuable when it improves a workflow you already perform every week.",
      promise: "You will learn how to identify repeated tasks in your business and turn them into AI-supported workflows for customer support, marketing, operations, staff training, and admin.",
      method: "List tasks you repeat every week: WhatsApp replies, product descriptions, invoice reminders, FAQs, social media captions, customer complaints, supplier messages, staff instructions, and sales follow-ups. Choose one task that wastes time or causes inconsistency, then build a prompt for it.",
      routine: "Day 1: list repeated tasks. Day 2: choose one workflow. Day 3: write your business context. Day 4: test three prompts. Day 5: create a reusable response template. Day 6: use it with real customer scenarios. Day 7: improve based on results.",
      mistakes: "Do not automate a bad process. Do not copy AI replies without checking tone, policy, price, delivery promise, or customer history. Do not sound robotic on WhatsApp.",
      safety: "Do not paste customer payment details, private addresses, full order histories, or sensitive complaints into AI tools. Summarize the issue instead.",
      nextStep: "Your next step is to create one reusable prompt for the most repeated message in your business."
    })
  },
  {
    slug: "customer-support-response-prompt-for-small-businesses",
    body: premiumAudienceGuide({
      audience: "small business owners and customer support staff",
      context: "Customer support can protect or damage trust quickly. A delayed, rude, confusing, or overly defensive reply can cost repeat sales. AI can help you write clearer replies, but you must give it your policy, tone, and desired outcome.",
      promise: "You will learn how to turn rough support notes into respectful, clear, WhatsApp-ready replies for complaints, delivery updates, refunds, order issues, and follow-up messages.",
      method: "Before asking AI to write a reply, define the customer's issue, what your business can do, what your policy allows, and what tone you want. Ask for a short version, a warmer version, and a firmer version, then choose the one that fits the customer relationship.",
      routine: "Use one week to build your support bank: delivery delay reply, refund reply, unavailable product reply, angry customer reply, payment confirmation reply, follow-up reply, and apology reply.",
      mistakes: "Do not let AI promise refunds, discounts, delivery times, or replacements you cannot honor. Do not make every reply sound like a formal email if your customers expect WhatsApp clarity.",
      safety: "Remove full addresses, payment references, private phone numbers, and order IDs before using AI. Keep customer privacy intact.",
      nextStep: "Your next step is to create five approved response templates your team can reuse."
    }),
    prompt: premiumPromptPack({
      title: "Small Business Customer Support Prompt Pack",
      audience: "your business",
      setup: "These prompts help you respond faster while keeping your brand respectful and clear.",
      prompts: [
        "Rewrite this customer reply for WhatsApp. Make it warm, clear, and professional. Customer issue: [ISSUE]. Business policy: [POLICY]. Desired outcome: [OUTCOME].",
        "Create three versions of this reply: friendly, firm, and apologetic. Keep each under 90 words: [PASTE].",
        "Help me respond to an angry customer who says [COMPLAINT]. We can offer [OPTIONS] but cannot offer [LIMITS].",
        "Write a delivery delay update that is honest, apologetic, and does not overpromise. Details: [DETAILS].",
        "Write a refund policy explanation for a customer who [SITUATION]. Keep the tone respectful.",
        "Turn this rough voice note summary into a clear customer reply: [SUMMARY].",
        "Create a follow-up message for a customer who asked about [PRODUCT] but has not paid.",
        "Write a product unavailable reply that suggests alternatives without sounding dismissive.",
        "Create a payment confirmation message with next steps. Order context: [CONTEXT].",
        "Review this customer reply and tell me if it sounds defensive, unclear, or too long: [PASTE]."
      ]
    })
  },
  {
    slug: "non-technical-founder-product-validation-prompt",
    body: premiumAudienceGuide({
      audience: "non-technical founders",
      context: "A strong product does not begin with code. It begins with a painful problem, a clear user, a believable use case, and proof that someone cares enough to use or pay for the solution. AI can help you think through this before you waste money building the wrong thing.",
      promise: "You will learn how to use AI to clarify your idea, identify users, define the simplest useful version, surface risks, and plan a prototype you can test.",
      method: "Describe your idea in plain language, then ask AI to challenge it. Who has the problem? How do they solve it today? Why would they switch? What is the smallest useful version? What evidence would prove demand?",
      routine: "Day 1: describe the problem. Day 2: define user segments. Day 3: list alternatives. Day 4: write interview questions. Day 5: define the MVP. Day 6: sketch user flow. Day 7: decide whether to prototype, pause, or refine.",
      mistakes: "Do not ask AI to validate your idea by praising it. Ask it to find weaknesses. Do not build every feature. Do not confuse excitement from friends with real demand.",
      safety: "Do not paste confidential investor terms, private customer data, or proprietary business information into public AI tools.",
      nextStep: "Your next step is to run your idea through a validation prompt before writing a specification or paying a developer."
    }),
    prompt: premiumPromptPack({
      title: "Non-Technical Founder Validation Prompt Pack",
      audience: "your startup idea",
      setup: "These prompts help you test the thinking behind an idea before investing heavily.",
      prompts: [
        "Act as a practical product strategist. My idea is [IDEA]. Identify the target user, painful problem, current alternatives, simplest useful version, risky assumptions, and validation questions.",
        "Challenge this idea like a skeptical investor: [IDEA]. What is weak, unclear, expensive, or unproven?",
        "Turn this idea into a one-page product brief: user, problem, promise, features, non-features, and success metric.",
        "Create ten customer interview questions for people who might need [SOLUTION]. Avoid leading questions.",
        "Define the MVP for [IDEA]. Remove every feature that is not needed for the first useful test.",
        "Create a landing page outline to test demand for [IDEA]. Include headline, promise, proof, and call to action.",
        "Map the user journey for [USER] trying to solve [PROBLEM] with my product.",
        "List five reasons this product could fail and what evidence I need to reduce each risk.",
        "Compare my idea with existing alternatives: [ALTERNATIVES]. Where could we be meaningfully better?",
        "Create a seven-day prototype plan I can execute with AI and no engineering background."
      ]
    })
  },
  {
    slug: "children-and-ai-safety-starter-guide",
    body: premiumAudienceGuide({
      audience: "families, teachers, and children learning with AI",
      context: "Children can use AI for vocabulary practice, stories, revision games, coding, creativity, and guided projects. But children also need boundaries because they may not understand privacy, misinformation, manipulation, or academic integrity yet.",
      promise: "You will learn how to introduce AI to children in a supervised, age-aware way that supports learning without exposing private information or encouraging copying.",
      method: "Begin with supervised use. Choose one safe learning task, such as explaining a topic, creating a quiz, planning a story, or practicing vocabulary. Sit with the child, read the output together, and ask what they understood.",
      routine: "Day 1: explain what AI is and is not. Day 2: set privacy rules. Day 3: try a learning prompt. Day 4: review a wrong answer from AI. Day 5: create something small. Day 6: discuss copying and honesty. Day 7: agree on family rules.",
      mistakes: "Do not give children unsupervised access to tools you have not reviewed. Do not let AI become the child's private adult-like companion. Do not reward copied output as if it were understanding.",
      safety: "Children should not share names, addresses, school names, phone numbers, pictures, passwords, or family details with AI tools. Adults should review tools, privacy settings, and age suitability.",
      nextStep: "Your next step is to create a simple child-friendly AI safety agreement and practice one supervised AI learning activity."
    })
  },
  {
    slug: "first-ai-built-project-roadmap",
    body: premiumAudienceGuide({
      audience: "beginners building real digital projects",
      context: "Building with AI is different from collecting prompts. A real project needs a user, a problem, screens, data, logic, testing, deployment, and iteration. AI can help you build faster, but you still need to guide the process step by step.",
      promise: "You will learn how to move from idea to a simple website, dashboard, or software tool by defining the problem, planning screens, prompting AI, testing output, and improving one feature at a time.",
      method: "Start with one user and one task. Do not ask AI to build a complete platform at once. Ask for a simple first version, review it, then add features in small steps. Keep a changelog of what you asked for and what changed.",
      routine: "Day 1: define the user and problem. Day 2: sketch the screens. Day 3: generate a first version. Day 4: test layout and content. Day 5: add one feature. Day 6: fix bugs. Day 7: deploy or prepare for feedback.",
      mistakes: "Do not accept code you cannot run or inspect. Do not add too many features too early. Do not skip testing on mobile. Do not ignore errors because the page looks good once.",
      safety: "Do not paste real passwords, API keys, private databases, or customer records into prompts. Use test data while building.",
      nextStep: "Your next step is to choose a small project you can explain in one sentence and build a first version before expanding."
    })
  },
  {
    slug: "government-ai-readiness-checklist",
    body: premiumAudienceGuide({
      audience: "government and public-sector teams",
      context: "Public institutions can use AI to improve service delivery, document processing, citizen communication, training, research, and internal productivity. But public-sector AI adoption must be careful because trust, privacy, accountability, procurement, and fairness matter.",
      promise: "You will learn how to assess whether a public-sector workflow is ready for AI, what risks to check, and how to begin with responsible pilots instead of broad uncontrolled adoption.",
      method: "Start by identifying repeated service tasks: citizen FAQs, document summarization, internal memo drafting, policy research, training material, meeting notes, and data cleanup. Then classify each task by sensitivity, risk, human review requirement, and measurable benefit.",
      routine: "Day 1: list candidate workflows. Day 2: remove high-risk use cases from the first pilot. Day 3: choose one low-risk workflow. Day 4: define data boundaries. Day 5: train a small team. Day 6: test outputs. Day 7: document findings.",
      mistakes: "Do not start with sensitive citizen decisions, private records, or automated approvals. Do not buy tools before defining governance. Do not confuse a demo with institutional readiness.",
      safety: "Protect citizen data, confidential memos, procurement information, security details, and personally identifiable information. Require human review for anything that affects rights, access, money, or official decisions.",
      nextStep: "Your next step is to create a low-risk AI pilot proposal with scope, safeguards, success metrics, and review responsibilities."
    })
  }
]

resources.push(
  {
    slug: "parent-ai-home-rules-checklist",
    type: "guide",
    audience: "parents",
    category: "safety",
    title: "AI Home Rules Checklist for Parents",
    summary: "A practical guide for setting clear family rules around AI, schoolwork, privacy, copying, and supervised learning.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "teacher-feedback-and-marking-with-ai",
    type: "guide",
    audience: "teachers",
    category: "schools",
    title: "Teacher Feedback and Marking With AI",
    summary: "A practical guide for using AI to draft clearer feedback, rubrics, remediation notes, and parent-friendly learning updates.",
    relatedCourse: "prompt-to-profit-schools"
  },
  {
    slug: "school-parent-communication-ai-guide",
    type: "guide",
    audience: "school-owners",
    category: "schools",
    title: "School Parent Communication AI Guide",
    summary: "A guide for using AI to improve parent updates, school announcements, admissions follow-up, and communication consistency.",
    relatedCourse: "prompt-to-profit-schools"
  },
  {
    slug: "job-seeker-portfolio-builder-with-ai",
    type: "guide",
    audience: "nysc-job-seekers",
    category: "career",
    title: "Job Seeker Portfolio Builder With AI",
    summary: "A practical guide for turning class projects, NYSC work, internships, and personal projects into a credible portfolio.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "small-business-content-calendar-with-ai",
    type: "guide",
    audience: "small-business-owners",
    category: "business",
    title: "Small Business Content Calendar With AI",
    summary: "A practical guide for planning useful weekly content around products, customer questions, objections, proof, and offers.",
    relatedCourse: "ai-for-everyday-business-owners"
  },
  {
    slug: "non-technical-founder-mvp-scope-guide",
    type: "guide",
    audience: "non-technical-founders",
    category: "project-building",
    title: "Non-Technical Founder MVP Scope Guide",
    summary: "A guide for deciding what belongs in the first version of a product and what should wait until users prove demand.",
    relatedCourse: "prompt-to-production"
  },
  {
    slug: "child-friendly-ai-project-ideas",
    type: "guide",
    audience: "children-ai-safety",
    category: "safety",
    title: "Child-Friendly AI Project Ideas",
    summary: "Safe, supervised project ideas that help children use AI for creativity, revision, storytelling, and simple building.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "ai-project-planning-prompt-pack",
    type: "prompt",
    audience: "building-real-projects",
    category: "project-building",
    title: "AI Project Planning Prompt Pack",
    summary: "A prompt pack for defining users, screens, features, data, testing steps, and deployment plans for real projects.",
    relatedCourse: "prompt-to-profit"
  },
  {
    slug: "public-sector-service-delivery-ai-guide",
    type: "guide",
    audience: "governments-public-institutions",
    category: "public-sector",
    title: "Public-Sector Service Delivery AI Guide",
    summary: "A practical guide for using AI to improve citizen communication, internal productivity, and low-risk service workflows.",
    relatedCourse: "prompt-to-profit"
  }
)

const nonWaecPremiumResources = Object.fromEntries(
  audienceResourceSpecs.map((spec) => [spec.slug, { body: spec.body, prompt: spec.prompt || null }])
)

function audienceName(key) {
  const expanded = expandedPromptAudienceSpecs.find((spec) => spec.audience === key)
  if (expanded) return expanded.label.toLowerCase()
  return {
    "waec-jamb-learners": "WAEC/JAMB learners",
    parents: "parents and guardians",
    teachers: "teachers",
    "school-owners": "school owners and school leaders",
    "nysc-job-seekers": "NYSC members and job seekers",
    "small-business-owners": "small business owners",
    "non-technical-founders": "non-technical founders",
    "children-ai-safety": "families guiding children around AI",
    "building-real-projects": "beginners building real projects",
    "governments-public-institutions": "government and public-sector teams"
  }[key] || "practical AI learners"
}

function defaultPremiumForResource(resource) {
  if (resource.audience === "waec-jamb-learners") return {}
  const audience = audienceName(resource.audience)
  const title = resource.title
  const body = premiumAudienceGuide({
    audience,
    context: `${title} exists because practical AI education should be connected to real work, not abstract excitement. You need resources that help you make better decisions, communicate more clearly, save time, support people, and build useful habits with AI. This guide takes the topic and turns it into a practical workflow you can apply in a Nigerian or African context without needing a technical background.`,
    promise: `You will learn how to apply ${title.toLowerCase()} in a way that is specific, responsible, and useful. You will be able to define the task, write better prompts, review AI output, adapt it to your context, and turn it into a repeatable process.`,
    method: `Start by writing the exact situation you want to improve. Do not begin with the tool. Begin with the task, the person affected, the current problem, and the outcome you want. Then give AI that context and ask for a structured first draft. Review the draft for accuracy, tone, local relevance, and practical usefulness before using it.`,
    routine: `Use one week to test this resource in real life. Choose one task on the first day, create a prompt on the second day, review the output on the third day, improve it on the fourth day, use it in a real situation on the fifth day, collect feedback on the sixth day, and save your best version on the seventh day.`,
    mistakes: `Avoid broad prompts, copied outputs, exaggerated claims, and AI-generated language that does not sound like you. Do not use AI to avoid thinking. Use it to make your thinking clearer.`,
    safety: `Protect private information, student information, customer details, passwords, financial records, and sensitive organizational data. Use examples and summaries instead of exposing real people or confidential material.`,
    nextStep: `Your next step is to choose one real task connected to ${title.toLowerCase()} and use this resource to create a reusable prompt, checklist, or workflow you can test this week.`
  })
  const prompt = resource.type === "prompt"
    ? premiumPromptPack({
        title: `${title} Prompt Pack`,
        audience,
        setup: `These prompts help you approach ${title.toLowerCase()} from planning, execution, review, improvement, and communication angles.`,
        prompts: [
          `Act as a practical AI coach for ${audience}. Help me apply ${title} to this situation: [SITUATION]. Ask clarifying questions before giving advice.`,
          `Turn this rough idea into a step-by-step workflow: [IDEA]. Keep it practical for my context: [CONTEXT].`,
          `Create a checklist I can use before applying this output in real life: [TASK].`,
          `Review this AI output for accuracy, tone, usefulness, and missing local context: [PASTE OUTPUT].`,
          `Give me three versions of this response: simple, professional, and warm: [PASTE].`,
          `Create a one-week implementation plan for [GOAL] using only tools and time I already have.`,
          `Help me explain this idea to someone who is skeptical about AI: [IDEA].`,
          `Identify the risks in using AI for this task and suggest safeguards: [TASK].`,
          `Create a reusable prompt template for this repeated workflow: [WORKFLOW].`,
          `Summarize what I learned from this experiment and tell me what to improve next: [NOTES].`
        ]
      })
    : resource.prompt
  return { body, prompt }
}

function premiumFor(resource) {
  return premiumWaecResources[resource.slug] || nonWaecPremiumResources[resource.slug] || defaultPremiumForResource(resource)
}

async function ensureTables() {
  await import("./setup-resource-tables.mjs")
}

async function upsertResource(resource) {
  const resourceUuid = uuidFor(`resource:${resource.slug}`)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_resources
      (resource_uuid, resource_type, audience_key, category_key, title, slug, summary, body_content, prompt_text,
       use_case_text, customization_notes, video_url, thumbnail_url, download_url, file_public_id, access_type,
       price_ngn_minor, price_usd_minor, brevo_list_id, related_course_slug, seo_title, seo_description, og_image,
       status, featured, generated_json, created_at, updated_at, published_at)
    VALUES
      (${resourceUuid}, ${resource.type}, ${resource.audience}, ${resource.category}, ${resource.title}, ${resource.slug},
       ${resource.summary}, ${resource.body || null}, ${resource.prompt || null}, ${resource.useCase || null},
       ${resource.customization || null}, ${resource.videoUrl || null}, ${resource.thumbnailUrl || null},
       ${resource.downloadUrl || null}, NULL, ${resource.accessType || "free"}, ${resource.priceNgnMinor || 0},
       ${resource.priceUsdMinor || 0}, NULL, ${resource.relatedCourse || null}, ${resource.title},
       ${resource.summary}, ${resource.thumbnailUrl || null}, 'published', ${resource.featured ? 1 : 0},
       ${JSON.stringify({ seeded: true })}, ${now}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      resource_type = VALUES(resource_type),
      audience_key = VALUES(audience_key),
      category_key = VALUES(category_key),
      title = VALUES(title),
      summary = VALUES(summary),
      body_content = VALUES(body_content),
      prompt_text = VALUES(prompt_text),
      use_case_text = VALUES(use_case_text),
      customization_notes = VALUES(customization_notes),
      download_url = VALUES(download_url),
      access_type = VALUES(access_type),
      related_course_slug = VALUES(related_course_slug),
      seo_title = VALUES(seo_title),
      seo_description = VALUES(seo_description),
      status = VALUES(status),
      updated_at = VALUES(updated_at),
      published_at = COALESCE(published_at, VALUES(published_at))
  `
  return resourceUuid
}

async function upsertBundle(bundle) {
  const bundleUuid = uuidFor(`bundle:${bundle.slug}`)
  await prisma.$executeRaw`
    INSERT INTO tochukwu_resource_bundles
      (bundle_uuid, title, slug, summary, description, audience_key, price_ngn_minor, price_usd_minor, status, featured, created_at, updated_at, published_at)
    VALUES
      (${bundleUuid}, ${bundle.title}, ${bundle.slug}, ${bundle.summary}, ${bundle.description}, ${bundle.audience},
       ${bundle.priceNgnMinor}, ${bundle.priceUsdMinor}, 'published', 1, ${now}, ${now}, ${now})
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      summary = VALUES(summary),
      description = VALUES(description),
      audience_key = VALUES(audience_key),
      price_ngn_minor = VALUES(price_ngn_minor),
      price_usd_minor = VALUES(price_usd_minor),
      status = VALUES(status),
      featured = VALUES(featured),
      updated_at = VALUES(updated_at),
      published_at = COALESCE(published_at, VALUES(published_at))
  `
  await prisma.$executeRaw`DELETE FROM tochukwu_resource_bundle_items WHERE bundle_uuid = ${bundleUuid}`
  for (const [index, slug] of bundle.items.entries()) {
    const resourceUuid = uuidFor(`resource:${slug}`)
    await prisma.$executeRaw`
      INSERT INTO tochukwu_resource_bundle_items (bundle_uuid, resource_uuid, sort_order, created_at)
      VALUES (${bundleUuid}, ${resourceUuid}, ${index + 1}, ${now})
      ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
    `
  }
}

async function main() {
  await ensureTables()
  const activePromptSlugs = promptOnlyResources.map((resource) => resource.slug)
  await prisma.$executeRaw`
    UPDATE tochukwu_resources
    SET status = 'draft', featured = 0, updated_at = ${now}
    WHERE resource_type <> 'video'
      AND slug NOT IN (${Prisma.join(activePromptSlugs)})
  `
  if (retiredBundleSlugs.length) {
    for (const slug of retiredBundleSlugs) {
      await prisma.$executeRaw`
        UPDATE tochukwu_resource_bundles
        SET status = 'draft', featured = 0, updated_at = ${now}
        WHERE slug = ${slug}
      `
    }
  }
  for (const resource of promptOnlyResources) {
    await upsertResource({
      ...resource,
      body: readerVoice(resource.body),
      prompt: readerVoice(resource.prompt),
      useCase: readerVoice(resource.useCase),
      customization: readerVoice(resource.customization)
    })
  }
  for (const bundle of bundles) {
    await upsertBundle(bundle)
  }
  console.log(`seeded_resources=${promptOnlyResources.length}`)
  console.log(`seeded_bundles=${bundles.length}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
