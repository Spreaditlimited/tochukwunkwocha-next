#!/usr/bin/env python3
"""Generate Prompt to Profit™ Workbook 03: Professional Quotation Generator."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


RULE = "=" * 50


def block(title: str, *paragraphs: str) -> str:
    content = [RULE, title, RULE]
    content.extend(p for p in paragraphs if p)
    return "\n\n".join(content)


def bullet_list(items: list[str], marker: str = "•") -> str:
    return "\n\n".join(f"{marker} {item}" for item in items)


def build_prompt(
    project_state: str,
    files: list[str],
    requirements: list[str],
    security: list[str] | None = None,
) -> str:
    file_text = "\n".join(f"• {name}" for name in files)
    req_text = "\n\n".join(f"• {item}" for item in requirements)
    security_text = ""
    if security:
        security_text = (
            "\n\nSecurity requirements:\n\n"
            + "\n".join(f"• {item}" for item in security)
        )
    return f"""PROJECT STATE

I already have a working Professional Quotation Generator.

{project_state}

Everything already working must continue working exactly as before.

I am a complete beginner and use Notepad.

Continue using:

• HTML
• CSS
• Vanilla JavaScript
• Supabase

Return complete files only.

Do not return snippets or partial code.

CREATE OR UPDATE ONLY:

{file_text}

GENERAL GOAL

Complete the feature described below.

Follow every requirement carefully.

REQUIREMENTS

{req_text}{security_text}

Use beginner-friendly HTML, CSS and Vanilla JavaScript.

Keep the code organised and use clear names.

Do not use React, Node.js, npm, build tools, frameworks or external application libraries other than the official Supabase JavaScript browser library.

Preserve every feature that is already working.

Return a complete updated version of every requested file.

Do not return snippets.

Do not omit unchanged sections from an updated file.

Do not tell me to find small sections of code and replace them manually.

Do not return explanations before the complete files."""


def lesson(
    number: int,
    title: str,
    time: str,
    building: list[str],
    why: list[str],
    before: list[str],
    prompt: str,
    ai_return: list[str],
    save: list[str],
    tests: list[str],
    mistakes: list[str],
    behind: list[str],
    designer: list[str],
    learned: list[str],
    continued: bool = False,
    checkpoint: list[str] | None = None,
) -> str:
    label = f"LESSON {number}" + (" (CONTINUED)" if continued else "")
    pieces = [
        block(label, title, "Estimated Time", time),
        block("WHAT YOU ARE BUILDING", *building),
        block("WHY THIS MATTERS", *why),
        block("BEFORE YOU CONTINUE", *before),
        block("BUILD PROMPT", prompt),
        block("WHAT AI SHOULD RETURN", *ai_return),
        block("SAVE YOUR FILES", *save),
        block("TEST YOUR WORK", "Complete the following tests:", bullet_list(tests, "✓")),
        block("CHECKPOINT", "Before moving on, confirm that:", bullet_list(checkpoint or tests, "✓")),
        block("COMMON BEGINNER MISTAKES", *mistakes),
        block("BEHIND THE SCENES", *behind),
        block("THINK LIKE A SOFTWARE DESIGNER", *designer),
        block("WHAT YOU LEARNED", "In this lesson you learned how to:", bullet_list(learned)),
    ]
    return "\n\n".join(pieces)


def chapter_open(number: int, title: str, introduction: list[str], outcomes: list[str]) -> str:
    return "\n\n".join([
        block(f"CHAPTER {number}", title, "CHAPTER INTRODUCTION", *introduction),
        block("WHAT YOU WILL BUILD IN THIS CHAPTER", bullet_list(outcomes)),
    ])


def chapter_close(number: int, title: str, summary: list[str], milestone: list[str], next_title: str) -> str:
    return "\n\n".join([
        block("CHAPTER SUMMARY", *summary),
        block("CHAPTER MILESTONE", "You have now completed:", bullet_list(milestone, "✓")),
        block(
            f"TRANSITION TO CHAPTER {number + 1}",
            "The work in this chapter is complete.",
            f"In the next chapter, you will build {next_title.lower()}.",
            "Do not continue until every checkpoint in this chapter passes.",
        ),
    ])


def manual_prompt(instruction: str) -> str:
    return (
        "There is nothing to build with ChatGPT in this lesson.\n\n"
        + instruction
        + "\n\nComplete every step and test before continuing."
    )


def sql_prompt(filename: str, requirements: str) -> str:
    return f"""I am a complete beginner using Notepad and the Supabase SQL Editor.

Create one complete SQL file named:

{filename}

The SQL file must complete the database work described below.

{requirements}

Include short comments that explain the main sections in beginner-friendly language.

Return the complete {filename} file only.

Do not return snippets.

Do not ask me to combine separate pieces of SQL.

Do not return explanations before the complete file."""


def sql_save(filename: str) -> list[str]:
    return [
        f"Save the complete SQL returned by ChatGPT as {filename}.",
        "In Notepad, choose File, then Save As.",
        "Browse to the Professional Quotation Generator folder.",
        "Choose Save as type: All Files.",
        f"Enter the filename exactly as {filename}.",
        "Save the file.",
        "Open the saved file in Notepad and copy the complete SQL.",
        "Open your Supabase project.",
        "Open SQL Editor and create a new query.",
        "Paste the complete SQL and select Run once.",
        "Do not continue if Supabase reports an error.",
    ]


def make_workbook() -> str:
    parts: list[str] = []
    parts.append("\n\n".join([
        RULE,
        "PROMPT TO PROFIT™ WORKBOOK 03",
        "PROFESSIONAL QUOTATION GENERATOR",
        "Workbook 03",
        RULE,
    ]))
    parts.append(block(
        "ABOUT THIS WORKBOOK",
        "This workbook is a complete, self-contained project.",
        "You do not need to complete any other Prompt to Profit™ workbook before starting.",
        "You will build one complete business application from an empty folder to a deployed website using Notepad, a browser, ChatGPT and Supabase.",
        "Every explanation, Build Prompt, test and security step required for this project is included here.",
        "Complete the lessons in order because each capability depends on work that has already been tested.",
    ))
    parts.append(block(
        "WELCOME",
        "Welcome to Prompt to Profit™ Workbook 03.",
        "In this workbook, you will build a professional Quotation Generator for businesses that need to prepare clear prices for customers.",
        "The finished software will allow an authenticated user to create quotations, add multiple items, calculate discounts and taxes, save records securely, reopen previous quotations, edit or delete them, update their status and print a professional quotation document.",
        "You will use only HTML, CSS, Vanilla JavaScript, Supabase, ChatGPT, Notepad and a modern web browser.",
        "You do not need prior programming experience.",
        "Every Build Prompt asks for complete files. Never combine snippets manually unless a lesson explicitly asks you to enter a Supabase setting.",
        "Test each capability before moving forward. If an important test fails, stop and fix it while the lesson is still fresh.",
    ))
    parts.append(block(
        "WHAT YOU WILL BUILD",
        "By the end of this workbook, your Professional Quotation Generator will include:",
        "PUBLIC WEBSITE",
        bullet_list([
            "Responsive navigation and mobile menu", "Hero, business problem and feature sections",
            "Quotation preview", "Login and Register links", "Professional calls to action",
        ]),
        "AUTHENTICATION AND BUSINESS PROFILE",
        bullet_list([
            "Registration, email verification, login and logout", "Protected application pages",
            "One private business profile per user", "Business contact and quotation settings",
        ]),
        "QUOTATION MANAGEMENT",
        bullet_list([
            "Create quotations", "Add multiple quotation items", "Automatic line totals",
            "Subtotal, fixed or percentage discounts, tax and final totals",
            "Unique quotation numbers", "Draft, Sent, Accepted, Declined and Expired statuses",
            "Save, view, edit and delete quotations", "Search, filter and sort saved records",
        ]),
        "PROFESSIONAL DOCUMENTS",
        bullet_list([
            "Printable quotation layout", "Business and customer information",
            "Itemised pricing table", "Notes, terms and validity date", "Print-friendly CSS",
        ]),
        "SECURITY",
        bullet_list([
            "Supabase Row Level Security", "Authenticated ownership checks",
            "Private quotations and quotation items", "Two-account privacy testing",
        ]),
    ))
    chapter_titles = [
        "BUILDING THE PUBLIC WEBSITE",
        "CONNECTING TO SUPABASE",
        "BUILDING AUTHENTICATION AND THE BUSINESS PROFILE",
        "BUILDING THE SECURE QUOTATION DATABASE",
        "BUILDING THE QUOTATION EDITOR",
        "SAVING AND VIEWING QUOTATIONS",
        "EDITING, STATUS AND DELETION",
        "PRINTING PROFESSIONAL QUOTATIONS",
        "IMPROVING THE QUOTATION WORKFLOW",
        "FINAL TESTING AND PROJECT COMPLETION",
    ]
    structure = ["This workbook is organised into ten chapters."]
    for index, title in enumerate(chapter_titles, 1):
        structure.extend([f"Chapter {index}", title.title()])
    structure.extend([
        "Every chapter produces a tested part of the final application.",
        "Do not jump ahead or disable security to make a feature appear to work.",
    ])
    parts.append(block("WORKBOOK STRUCTURE", *structure))

    # Chapter 1
    parts.append(chapter_open(1, chapter_titles[0], [
        "A professional business application needs a public website that explains its purpose before asking visitors to register.",
        "You will create the complete public landing page in separate HTML, CSS and JavaScript sessions.",
    ], [
        "Project folder", "Complete index.html", "Complete styles.css", "Responsive script.js",
        "Quotation preview section", "Working Login and Register navigation",
    ]))
    parts.append(lesson(1, "UNDERSTANDING THE QUOTATION GENERATOR", "10 minutes",
        ["You will prepare the project folder and understand the complete application before creating files."],
        ["A quotation is a business promise about proposed work, prices, taxes, validity and terms. The software must protect that information and calculate it consistently."],
        ["Create an empty folder named Professional Quotation Generator."],
        manual_prompt("Prepare the project folder and review the complete workbook structure."),
        ["Nothing. This lesson prepares the project."],
        ["Confirm that the Professional Quotation Generator folder exists and is empty."],
        ["The folder exists.", "It is empty.", "You understand the difference between a quotation and an invoice."],
        ["Do not mix this project with another workbook folder.", "Do not begin creating files before the folder is ready."],
        ["The project will grow into public pages, authentication pages, protected application pages and shared JavaScript files."],
        ["Understand the business document before designing the software that creates it."],
        ["prepare a clean project", "identify the complete quotation workflow", "work in a safe sequence"]))
    parts.append(lesson(2, "BUILDING THE PUBLIC LANDING PAGE", "35 minutes",
        ["You will create the complete semantic HTML structure for the public website."],
        ["Visitors must understand who the product serves, what it calculates and how to begin."],
        ["Open Notepad.", "Keep the project folder open."],
        build_prompt(
            "The project folder is empty.",
            ["index.html"],
            [
                "Create a semantic HTML5 landing page for a Professional Quotation Generator.",
                "Include a header with brand, Features, How It Works, Login and Register links.",
                "Include a hero explaining that businesses can prepare accurate professional quotations.",
                "Include problem, features, workflow, quotation preview, final call-to-action and footer sections.",
                "Show a realistic quotation preview containing customer details, three line items, subtotal, discount, tax and total.",
                "Link styles.css and script.js and use stable IDs and classes.",
                "Point Login to login.html and Register/Get Started to register.html.",
                "Include accessible labels, buttons and navigation attributes.",
            ],
        ),
        ["One complete index.html file."],
        ["Save the returned file as index.html using Save as type: All Files."],
        ["index.html opens in the browser.", "Every public section appears.", "Login and Register links use the correct filenames."],
        ["Do not save index.html.txt.", "Do not worry about the plain appearance before CSS exists."],
        ["Semantic HTML gives every later stylesheet and script a stable structure."],
        ["Build the complete information journey before decorating individual sections."],
        ["create semantic public-page structure", "connect future files safely", "test navigation destinations"]))
    parts.append(lesson(3, "STYLING THE PUBLIC WEBSITE", "45 minutes",
        ["You will create the complete stylesheet and turn the plain structure into a polished responsive website."],
        ["Clear hierarchy and spacing make financial software feel trustworthy."],
        ["Confirm index.html opens.", "Copy its complete code for the Build Prompt."],
        build_prompt(
            "index.html is complete. I will paste its full code after this prompt.",
            ["styles.css"],
            [
                "Style the exact existing HTML without renaming its classes or IDs.",
                "Use a restrained white, off-white, charcoal and deep-blue business palette.",
                "Create responsive containers, navigation, hero, cards, steps, quotation preview, calls to action and footer.",
                "Make the quotation preview look like a credible business document.",
                "Include visible focus states and strong text contrast.",
                "Add mobile breakpoints and styles for a three-line navigation button.",
                "Do not hide important content on small screens.",
                "Use no CSS framework.",
                "[PASTE YOUR COMPLETE INDEX.HTML HERE]",
            ],
        ),
        ["One complete styles.css file."],
        ["Save styles.css beside index.html."],
        ["The stylesheet loads.", "The quotation preview is readable.", "The page remains usable at mobile width."],
        ["A partial page usually means the CSS selectors do not match the HTML.", "Do not paste CSS into index.html."],
        ["CSS can make the same HTML adapt to several screen sizes without duplicating the page."],
        ["Professional visual design should clarify business information, not compete with it."],
        ["style an existing structure", "design responsive business content", "preserve accessibility"]))
    parts.append(lesson(4, "ADDING RESPONSIVE NAVIGATION", "25 minutes",
        ["You will add the mobile navigation behaviour in a complete JavaScript file."],
        ["Responsive styling is incomplete if mobile visitors cannot open and close the menu."],
        ["Confirm index.html and styles.css work.", "Identify the navigation button and menu IDs."],
        build_prompt(
            "The public landing page and stylesheet are complete.",
            ["script.js"],
            [
                "Use the exact existing navigation selectors.",
                "Open and close the mobile menu with the three-line button.",
                "Update aria-expanded accurately.",
                "Close the menu after a navigation link is selected.",
                "Close it when the user clicks outside it or presses Escape.",
                "Remove the open state when the desktop breakpoint is restored.",
                "Do not add unrelated functionality.",
            ],
        ),
        ["One complete script.js file."],
        ["Save script.js beside index.html and refresh the browser."],
        ["The menu opens and closes.", "Escape closes it.", "Desktop navigation remains visible."],
        ["Do not use selectors that differ from the HTML.", "Test after resizing back to desktop."],
        ["Accessible components expose their current state to assistive technology as well as changing visually."],
        ["A navigation control should behave predictably through mouse, touch and keyboard input."],
        ["build a responsive menu", "synchronise visual and accessibility state", "test breakpoint changes"]))
    parts.append(lesson(5, "AUDITING THE PUBLIC WEBSITE", "25 minutes",
        ["You will complete a capability audit of the public website."],
        ["Later authentication work should not begin on an unstable public foundation."],
        ["Open the page on desktop and mobile widths."],
        manual_prompt("Test the complete public website using every check below."),
        ["Nothing. This is a testing lesson."],
        ["No files should change unless a failed test requires a correction."],
        ["Every section is present.", "Navigation works at all widths.", "Login and Register links point to the correct future pages.", "No browser console errors appear."],
        ["Do not ignore broken links because their pages have not been built yet.", "Do not accept horizontal scrolling on mobile."],
        ["An audit confirms several connected features together instead of testing only the latest change."],
        ["A capability is complete only when normal, mobile and keyboard paths all work."],
        ["audit a public website", "identify regression problems", "approve a stable chapter milestone"]))
    parts.append(chapter_close(1, chapter_titles[0], [
        "You created and tested the complete public website using separate HTML, CSS and JavaScript files.",
    ], ["Public landing page", "Responsive design", "Accessible mobile navigation"], "the Supabase connection"))

    # Chapter 2
    parts.append(chapter_open(2, chapter_titles[1], [
        "Supabase will provide authentication and the PostgreSQL database.",
        "You will create an isolated project, retrieve only browser-safe credentials and prove the connection before building dependent features.",
    ], ["Supabase project", "Project URL and Publishable Key", "supabase-config.js", "Connection test page", "Connection audit"]))
    parts.append(lesson(1, "CREATING YOUR SUPABASE PROJECT", "20 minutes",
        ["You will create a new Supabase project dedicated to this workbook."],
        ["Separating projects prevents users, tables and security policies from unrelated applications being mixed."],
        ["Sign in at https://supabase.com.", "Have a secure database password ready."],
        manual_prompt("Create a new Supabase project named Professional Quotation Generator. Select an appropriate region, store the database password securely and wait for provisioning to finish."),
        ["Nothing. This lesson is completed in Supabase."],
        ["Do not add project files."],
        ["The project dashboard opens.", "The project name is correct.", "Provisioning has finished."],
        ["Never reuse another workbook's Supabase project.", "Do not expose the database password."],
        ["A Supabase project contains authentication, a database, APIs and security settings."],
        ["Give each application its own Supabase project."],
        ["create a separate Supabase project", "protect the database password", "confirm that the project is ready"]))
    parts.append(lesson(2, "FINDING THE PROJECT URL AND PUBLISHABLE KEY", "20 minutes",
        ["You will locate the two browser-safe values used by the website."],
        ["The application cannot contact the correct Supabase project without both values."],
        ["Open the project settings and API section."],
        manual_prompt("Copy the base Project URL and Publishable Key. Do not copy service_role, secret or database credentials."),
        ["Nothing. This lesson is completed in Supabase."],
        ["Keep both values temporarily available for the next lesson."],
        ["The URL ends at supabase.co.", "The Publishable Key is copied.", "No secret key is placed in the project folder."],
        ["Do not append /rest/v1 to the base URL.", "Never use service_role in browser JavaScript."],
        ["The Project URL and Publishable Key tell the website which Supabase project to contact.", "Row Level Security decides which private records a signed-in user is allowed to access."],
        ["Browser-safe connection details and database security rules must work together."],
        ["find the Project URL and Publishable Key", "recognise keys that must remain secret", "prepare a secure connection"]))
    parts.append(lesson(3, "CREATING THE SHARED SUPABASE CONNECTION", "25 minutes",
        ["You will create one reusable Supabase client file."],
        ["A shared client prevents duplicated credentials and inconsistent connection code."],
        ["Have the Project URL and Publishable Key ready."],
        build_prompt(
            "The public website exists and the Supabase project is ready.",
            ["supabase-config.js"],
            [
                "Define SUPABASE_URL using PASTE YOUR PROJECT URL HERE.",
                "Define SUPABASE_PUBLISHABLE_KEY using PASTE YOUR PUBLISHABLE KEY HERE.",
                "Create const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY).",
                "Expose only supabaseClient for the other browser scripts.",
                "Include clear beginner-friendly comments without logging credentials.",
            ],
            ["Do not use a secret or service_role key.", "Use only the base project URL."],
        ),
        ["One complete supabase-config.js file."],
        ["Replace the two placeholder values with your actual browser-safe values.", "Save the file in the project root."],
        ["The file loads without syntax errors.", "Only one Supabase client is created."],
        ["Quotation marks must remain around both values.", "Do not create a new client in every page script."],
        ["The Supabase browser library must load before this configuration file."],
        ["Create shared infrastructure once and reuse it everywhere."],
        ["create a shared client", "store browser-safe configuration correctly", "avoid duplicated connection logic"]))
    parts.append(lesson(4, "BUILDING THE CONNECTION TEST", "30 minutes",
        ["You will create a small diagnostic page that proves the browser can reach Supabase."],
        ["Connection problems are much easier to fix before authentication and database features depend on them."],
        ["Confirm supabase-config.js contains the correct values."],
        build_prompt(
            "supabase-config.js creates a shared supabaseClient.",
            ["connection-test.html", "connection-test.js"],
            [
                "Create a simple status page with Checking, Success and Error states.",
                "Load the official Supabase browser library from https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.",
                "Load supabase-config.js before connection-test.js.",
                "Call supabaseClient.auth.getSession() to test the connection.",
                "Display a friendly result and a technical error message when needed.",
                "Do not use fetch and do not expose credentials on the page.",
            ],
        ),
        ["Complete connection-test.html and connection-test.js files."],
        ["Save both files in the project root."],
        ["The page reaches a success state.", "No undefined-client error appears.", "An incorrect key produces a clear error."],
        ["Script loading order matters.", "A blank page is not a successful connection test."],
        ["A small diagnostic isolates infrastructure from feature code."],
        ["Prove dependencies independently before building on top of them."],
        ["test the Supabase client", "diagnose loading order", "show safe connection feedback"]))
    parts.append(lesson(5, "AUDITING THE SUPABASE CONNECTION", "15 minutes",
        ["You will approve the complete connection capability."],
        ["Authentication must not begin until the backend is reliably reachable."],
        ["Open the connection test page."],
        manual_prompt("Repeat the connection test, inspect the browser console and review the project folder for duplicate client code or secret keys."),
        ["Nothing. This is a testing lesson."],
        ["No new files are required."],
        ["Connection succeeds.", "No secret credentials exist in browser files.", "The shared client is created once.", "The console contains no connection errors."],
        ["Do not disable security to resolve a connection error.", "Do not confuse a successful page load with a successful Supabase request."],
        ["Connection, authentication and authorisation are separate layers."],
        ["Approve each infrastructure layer before introducing the next."],
        ["review the connection settings", "protect secret information", "confirm that the Supabase connection is ready"]))
    parts.append(chapter_close(2, chapter_titles[1], [
        "You created an isolated Supabase project and a tested shared browser connection.",
    ], ["Supabase project", "Safe browser credentials", "Reusable client", "Connection test page"], "authentication and the business profile"))

    # Remaining chapters use concise, capability-focused lessons.
    parts.extend(make_remaining_chapters(chapter_titles))
    return "\n\n".join(parts).strip() + "\n"


def capability_lesson(
    n: int, title: str, time: str, building: str, why: str, state: str,
    files: list[str], requirements: list[str], tests: list[str],
    security: list[str] | None = None,
) -> str:
    topic = title.lower()
    if "authentication" in topic or "registration" in topic or "password" in topic:
        extra_building = "The registration, login and password recovery pages will work together as one complete system."
        topic_mistake = "Do not create a separate Supabase client inside every authentication page."
        behind = [
            "Supabase Authentication stores and checks the user's login details.",
            "Your JavaScript sends registration, login and password recovery requests to Supabase.",
            "The application never stores or checks passwords itself.",
        ]
        designer = [
            "Authentication should guide the user clearly.",
            "A user should always know whether they need to verify an email, try again, or continue to the dashboard.",
        ]
    elif "protected application shell" in topic or "logout" in topic:
        extra_building = "Only signed-in users will be allowed to see the private application pages."
        topic_mistake = "Do not display the private dashboard before the session check has finished."
        behind = [
            "When a protected page opens, JavaScript asks Supabase whether a valid user session exists.",
            "If no session exists, the visitor is sent to the Login page.",
            "Logging out removes the session before returning the user to the public website.",
        ]
        designer = [
            "Private information should never appear briefly before a security check finishes.",
            "Always complete the session check before showing protected content.",
        ]
    elif "business profile" in topic:
        extra_building = "The saved business information will later appear automatically on every quotation."
        topic_mistake = "Do not create a new business profile row every time the Save button is selected."
        behind = [
            "Each signed-in user has one business profile row.",
            "The first save creates that row. Later saves update the same row.",
            "Row Level Security prevents another user from reading or changing it.",
        ]
        designer = [
            "Information used in many places should be stored once.",
            "This allows the user to update the business address or tax rate without editing every quotation.",
        ]
    elif "calculation" in topic:
        extra_building = "The totals will update immediately whenever an item, discount or tax value changes."
        topic_mistake = "Do not join number values as text. Convert every calculation value into a real number first."
        behind = [
            "HTML form values arrive in JavaScript as text.",
            "JavaScript must convert quantity, price, discount and tax values into numbers before calculating.",
            "The application then calculates each line first, followed by the subtotal, discount, tax and final total.",
        ]
        designer = [
            "Financial calculations should always happen in one clear order.",
            "Using the same order everywhere prevents the editor, saved record and printed quotation from showing different totals.",
        ]
    elif "quotation-number" in topic:
        extra_building = "The application will suggest the next number while still allowing the user to choose another valid number."
        topic_mistake = "Do not assume that the suggested number is automatically available until Supabase accepts the save."
        behind = [
            "JavaScript reviews the signed-in user's recent quotation numbers and suggests the next sequence.",
            "The database performs the final duplicate check when the quotation is saved.",
            "This protects the application if two browser tabs try to use the same number.",
        ]
        designer = [
            "A useful suggestion saves time, but the database must still protect the final result.",
            "Friendly automation and reliable validation should work together.",
        ]
    elif "preview" in topic:
        extra_building = "The user will see the quotation document taking shape before anything is saved."
        topic_mistake = "Do not calculate a second set of totals only for the preview."
        behind = [
            "The preview reads the same form information and calculated totals already used by the editor.",
            "It does not create another quotation or save anything to Supabase.",
            "It gives the user an immediate visual check before saving.",
        ]
        designer = [
            "A preview should help the user notice mistakes.",
            "It should match the final document closely without introducing a second set of information.",
        ]
    elif "saving complete" in topic:
        extra_building = "The quotation and all of its items will either save together or fail together."
        topic_mistake = "Do not report success after saving only the quotation without its items."
        behind = [
            "A quotation uses one row in quotations and several connected rows in quotation_items.",
            "The Supabase function completes these changes as one operation.",
            "If any part fails, Supabase cancels the whole save so an incomplete quotation is not left behind.",
        ]
        designer = [
            "A quotation without all of its items is not a successful result.",
            "Connected information should be saved together whenever one part would be meaningless without the other.",
        ]
    elif "viewing saved" in topic or "directory" in topic:
        extra_building = "Users will be able to recognise previous quotations and open the one they need."
        topic_mistake = "Do not retrieve every user's quotations and filter them afterwards in JavaScript."
        behind = [
            "Supabase returns only the quotation rows the signed-in user is allowed to view.",
            "JavaScript turns each returned row into a clear card or table row.",
            "The list does not need every quotation item until the user opens one quotation.",
        ]
        designer = [
            "A useful list shows enough information to make a choice without overcrowding the page.",
            "Detailed information belongs on the quotation details page.",
        ]
    elif "details" in topic:
        extra_building = "The page will combine one quotation, its items and the user's business profile."
        topic_mistake = "Do not place customer details or prices inside the page address."
        behind = [
            "The page address contains only the quotation ID.",
            "JavaScript uses that ID to request the quotation and its items from Supabase.",
            "Row Level Security decides whether the signed-in user is allowed to receive them.",
        ]
        designer = [
            "A page address should identify the record, not expose the record's private information.",
            "The database should decide whether the current user may open it.",
        ]
    elif "dashboard" in topic or "statistics" in topic:
        extra_building = "The dashboard will turn saved quotation information into a quick business overview."
        topic_mistake = "Do not send a separate database request for every summary card."
        behind = [
            "JavaScript can calculate several dashboard summaries from one authorised list of quotations.",
            "This reduces unnecessary database requests and keeps the cards consistent.",
        ]
        designer = [
            "A dashboard should answer a few useful questions quickly.",
            "It should not repeat every detail already available in the quotation directory.",
        ]
    elif "editing" in topic:
        extra_building = "Users will reopen an existing quotation, change it and save the complete updated version."
        topic_mistake = "Do not create a new quotation when the user intended to update an existing one."
        behind = [
            "The edit page first retrieves the existing quotation and items.",
            "The form uses the same validation and calculation rules as the New Quotation page.",
            "The Supabase save function replaces the owned information together so a failed edit can be cancelled safely.",
        ]
        designer = [
            "Creating and editing should follow the same business rules.",
            "Reusing the same rules prevents one page from accepting information that another page rejects.",
        ]
    elif "status" in topic:
        extra_building = "Users will be able to record what happened after a quotation was prepared."
        topic_mistake = "Do not change the visible status before Supabase confirms that the update succeeded."
        behind = [
            "The status is stored with the quotation record.",
            "JavaScript sends the selected value to Supabase, and the database accepts only the five allowed values.",
        ]
        designer = [
            "A status should communicate a clear business meaning.",
            "Use a small, controlled list instead of allowing many different spellings for the same idea.",
        ]
    elif "delet" in topic:
        extra_building = "The user must confirm the action before the quotation is removed permanently."
        topic_mistake = "Do not send a delete request when the user selects Cancel."
        behind = [
            "Deleting the quotation row also removes its connected item rows because the database relationship uses cascade deletion.",
            "Row Level Security still checks that the quotation belongs to the signed-in user.",
        ]
        designer = [
            "Permanent actions should never happen by surprise.",
            "A clear confirmation should identify exactly what will be removed.",
        ]
    elif "ownership" in topic or "security audit" in topic:
        extra_building = "You will deliberately test whether one account can reach another account's information."
        topic_mistake = "Do not test privacy with only one account."
        behind = [
            "Hiding a button does not protect database information.",
            "The real test is whether Supabase rejects a request made by the wrong signed-in user.",
        ]
        designer = [
            "Security should be tested by attempting actions that must fail.",
            "A successful privacy test proves both that owned actions work and that cross-account actions do not.",
        ]
    elif "print" in topic or "document-quality" in topic:
        extra_building = "The on-screen quotation will become a clean A4 document when the user prints or saves it as PDF."
        topic_mistake = "Do not hide important quotation information just to make the page fit on one sheet."
        behind = [
            "Print CSS changes how the existing quotation page appears on paper.",
            "It hides navigation and buttons while keeping the business document, items and totals.",
        ]
        designer = [
            "Screen and paper are two different viewing environments.",
            "Always test both instead of assuming a good screen layout will print correctly.",
        ]
    elif "search" in topic or "sorting" in topic:
        extra_building = "Users will be able to find the quotation they need without changing or deleting any saved information."
        topic_mistake = "Do not request the database again every time one filter changes."
        behind = [
            "The page keeps the signed-in user's authorised quotations in memory.",
            "Search, filters and sorting change only which records are displayed and in what order.",
        ]
        designer = [
            "Search and filters should make information easier to find without changing the information itself.",
            "A visible Reset button helps users return to the complete list.",
        ]
    elif "expiry" in topic:
        extra_building = "The application will clearly identify quotations whose valid-until date has passed."
        topic_mistake = "Do not change a saved quotation status automatically without the user's knowledge."
        behind = [
            "JavaScript compares the valid-until date with today's calendar date.",
            "The page can show guidance without silently changing the database record.",
        ]
        designer = [
            "Software may point out an important condition while still leaving the final business decision to the user.",
        ]
    elif "loading" in topic or "error states" in topic:
        extra_building = "Every important page will clearly explain whether it is loading, empty, successful or unable to continue."
        topic_mistake = "Do not leave a button disabled after a failed request."
        behind = [
            "Database requests take time and may sometimes fail.",
            "JavaScript changes the visible page state before, during and after each request so the user is never left guessing.",
        ]
        designer = [
            "Silence can make working software feel broken.",
            "Clear feedback is part of the feature, not an optional decoration.",
        ]
    elif "portfolio" in topic:
        extra_building = "The final description will explain what the software does and how you built and tested it."
        topic_mistake = "Do not list a technology or feature that is not actually present in the project."
        behind = [
            "A portfolio reader may not open every file in the project.",
            "The description should explain the business problem, the completed solution and the important technical decisions clearly.",
        ]
        designer = [
            "Describe results in language a business owner can understand.",
            "Technical details are useful when they explain why the application is reliable or secure.",
        ]
    else:
        extra_building = "You will complete and test the whole feature before moving to the next lesson."
        topic_mistake = "Do not continue until the complete feature works."
        behind = [
            "The page, JavaScript and Supabase each have a different job.",
            "They must work together before the feature is complete.",
        ]
        designer = [
            "Build one clear result at a time.",
            "Test that result before adding something new.",
        ]

    save_steps = [
        "ChatGPT should return one complete version of every requested file.",
        "For each file:",
        "• Copy the complete code returned by ChatGPT.",
        "• Open Notepad.",
        "• Paste the code into a new document or replace the complete contents of the existing file.",
        "• Click File.",
        "• Click Save As when creating a new file.",
        "• Browse to the Professional Quotation Generator folder.",
        "• Choose Save as type: All Files.",
        "• Enter the exact filename shown below.",
    ]
    save_steps.extend(f"• {name}" for name in files)
    save_steps.extend([
        "Save every file before testing.",
        "If Notepad asks whether you want to replace an existing file, confirm only after checking that ChatGPT returned the complete file.",
        "Make sure none of the filenames end with .txt.",
    ])
    if any(name.endswith(".sql") for name in files):
        save_steps.extend([
            "For each .sql file:",
            "• Open the saved .sql file in Notepad.",
            "• Copy the complete SQL code.",
            "• Open your Supabase project.",
            "• Open SQL Editor.",
            "• Create a new query.",
            "• Paste the complete SQL code.",
            "• Select Run once.",
            "Read the result and do not continue if Supabase reports an error.",
        ])
    test_steps = [
        "Save every requested file.",
        "Open the relevant page in your browser or refresh it if it is already open.",
        "Open the browser console so you can see unexpected errors.",
    ] + tests

    return lesson(
        n, title, time,
        [
            f"In this lesson, you will build {building}.",
            extra_building,
            "You will add this feature to the project you have already tested.",
            "By the end of the lesson, you will test the complete feature from the user's point of view.",
        ],
        [
            why,
            "This feature is not only about making a button appear on the page.",
            "The information must be handled correctly, the user must receive clear feedback, and private records must remain protected.",
        ],
        [
            "Before starting this lesson, confirm that:",
            "✓ Every checkpoint in the previous lesson passes.",
            f"✓ {state}",
            "✓ Your current project files are saved.",
            "Make a backup copy of the project folder before replacing complete files.",
        ],
        build_prompt(state, files, requirements, security),
        ["Complete updated copies of:"] + [f"• {name}" for name in files],
        save_steps,
        test_steps,
        [
            "A common mistake is copying only part of the code returned by ChatGPT.",
            "Always replace the complete contents of every file ChatGPT was asked to update.",
            topic_mistake,
            "Read the first browser console or Supabase error carefully before making more changes.",
        ],
        behind,
        designer,
        [f"build {building}", "test the complete feature", "keep each user's information private"],
        checkpoint=tests,
    )


def simplify_language(note: str) -> str:
    """Apply the locked beginner-facing vocabulary used by Workbooks 01 and 02."""
    replacements = {
        "each capability": "each feature",
        "every capability": "every feature",
        "complete capability": "complete feature",
        "business capability": "business feature",
        "capability audit": "complete test",
        "capability is": "feature is",
        "capabilities": "features",
        "capability": "feature",
        "data boundary": "separate project area",
        "diagnostic page": "connection test page",
        "diagnostic": "connection test",
        "infrastructure layer": "connection step",
        "infrastructure": "connection setup",
        "authorisation": "access permissions",
        "parent-and-items": "quotation-and-items",
        "parent and child records": "quotation and item records",
        "parent record": "quotation record",
        "parent table": "quotations table",
        "child table": "quotation items table",
        "Child records": "Quotation item records",
        "relational tables": "connected database tables",
        "Relational tables": "Connected database tables",
        "relational table": "connected database table",
        "relational data modelling": "connected database design",
        "Secure relational quotation database": "Secure connected quotation database",
        "relational integrity": "correct quotation and item links",
        "query parameter": "quotation ID in the page address",
        "during mutation": "during a save, update or delete request",
        "pending mutation": "save, update or delete request",
        "source of truth": "reliable place for this information",
        "database contract": "database structure",
        "business lifecycle": "business status",
        "lifecycle status": "quotation status",
        "client-side quotation discovery controls": "quotation search, filter and sorting tools",
        "scalable discovery": "search and filtering",
        "workflow state": "current status",
        "CRUD operations": "create, view, edit and delete operations",
        "regression problems": "problems caused by a later change",
        "Regression testing": "Testing the complete application again",
        "schema-qualify every database object":
            "write public. before every table and function name so PostgreSQL uses the correct database area",
    }
    for old, new in replacements.items():
        note = note.replace(old, new)
    return note


def make_remaining_chapters(chapter_titles: list[str]) -> list[str]:
    p: list[str] = []
    # Chapter 3
    p.append(chapter_open(3, chapter_titles[2], [
        "The application now needs verified users, protected pages and private business identity details.",
    ], ["Registration and login", "Email verification", "Protected dashboard", "Logout", "Private business profile"]))
    p.append(capability_lesson(1, "BUILDING REGISTRATION, LOGIN AND LOGOUT", "90 minutes",
        "a complete authentication system",
        "Every private quotation must be linked to a verified Supabase user.",
        "The public site and shared Supabase client work.",
        ["register.html", "login.html", "forgot-password.html", "reset-password.html", "auth.css", "auth.js"],
        [
            "Create complete registration and login pages with labelled email and password fields.",
            "Use supabaseClient.auth.signUp and signInWithPassword.",
            "Create a forgot-password page using resetPasswordForEmail with a redirect to reset-password.html.",
            "Create a protected recovery page that listens for the password-recovery session and uses supabaseClient.auth.updateUser to save a confirmed new password.",
            "Show loading, success, verification and friendly error states.",
            "Disable submit buttons during requests and restore them afterwards.",
            "Redirect successful login to dashboard.html.",
            "If an authenticated user opens login or register, redirect to dashboard.html.",
            "Include links back to index.html and between all authentication pages.",
            "Explain that the local and future live reset URLs must be allowed in Supabase Authentication URL Configuration.",
        ], ["Registration creates a user.", "Verification guidance appears.", "Login redirects correctly.", "Invalid credentials show a friendly error.", "A password-reset email opens the recovery page.", "The new password works and the old password no longer works."],
        ["Never store passwords yourself.", "Do not use service_role.", "Use the current authenticated session."]))
    p.append(capability_lesson(2, "BUILDING THE PROTECTED APPLICATION SHELL", "60 minutes",
        "a protected dashboard and reliable logout",
        "Private business pages must never remain visible to a visitor without a valid session.",
        "Registration and login work.",
        ["dashboard.html", "dashboard.css", "dashboard.js"],
        [
            "Create the complete dashboard shell with navigation for Dashboard, New Quotation, Saved Quotations, Business Profile and Logout.",
            "Check supabaseClient.auth.getSession before showing private content.",
            "Redirect unauthenticated visitors to login.html.",
            "Display the authenticated email.",
            "Implement logout with supabaseClient.auth.signOut and redirect to index.html.",
            "Include loading protection so private content does not flash before the session check finishes.",
        ], ["Unauthenticated access redirects.", "Authenticated access succeeds.", "Logout removes access.", "Private content does not flash."]))
    p.append(capability_lesson(3, "CREATING THE BUSINESS PROFILE", "75 minutes",
        "a private business profile used on every printed quotation",
        "A professional quotation must identify the business that issued it.",
        "The protected dashboard and logout work.",
        ["business-profile-table.sql", "business-profile.html", "business-profile.js", "dashboard.css"],
        [
            "Create a complete business-profile-table.sql file.",
            "Inside the SQL file create public.business_profiles with one row per user. Use user_id as a uuid primary key connected to auth.users(id) with on delete cascade.",
            "Include business_name as required text. Include optional contact_name, email, phone, address and website fields.",
            "Include default_currency as required text with GBP as the default.",
            "Include default_tax_rate as numeric(5,2) with a default of 0 and a check that allows only 0 to 100.",
            "Include optional default_terms, created_at and updated_at fields.",
            "Enable Row Level Security.",
            "Create SELECT, INSERT and UPDATE policies that allow a signed-in user to work only with the row where user_id = auth.uid().",
            "Create a protected business profile form for every table field except timestamps and user_id.",
            "Load the signed-in user's existing profile with maybeSingle.",
            "Insert with user_id equal to the authenticated user's id when no profile exists.",
            "Update only the authenticated user's profile when it exists.",
            "Validate business name, currency and a tax rate between 0 and 100.",
            "Show loading, saved and error states and prevent duplicate submissions.",
        ], ["The SQL file runs without an error.", "The business_profiles table exists and Row Level Security is enabled.", "A first profile saves.", "Reloading retrieves it.", "Updating changes the same row.", "A second account cannot read it."],
        ["Keep RLS enabled.", "Every insert and update must use the authenticated user id.", "Never trust a user_id from a form field."]))
    p.append(chapter_close(3, chapter_titles[2], ["You built authentication, protected navigation and a reusable private business profile."],
        ["Registration and login", "Protected dashboard", "Logout", "Business profile"], "the secure quotation database"))

    # Chapter 4
    p.append(chapter_open(4, chapter_titles[3], [
        "Quotations contain a parent record and one or more item records. The database must preserve that relationship and enforce ownership at both levels.",
    ], ["quotations table", "quotation_items table", "Constraints and indexes", "RLS policies", "Security policy review"]))
    p.append(lesson(1, "DESIGNING THE QUOTATION DATA MODEL", "25 minutes",
        ["You will understand the parent-and-items database model before creating it."],
        ["A quotation has one customer and set of totals, but an unlimited number of priced items."],
        ["Open the Supabase Table Editor."], manual_prompt(
            "Review the field plan for quotations and quotation_items. Confirm that totals belong to the quotation and quantity, unit price and line total belong to each item."
        ), ["Nothing."], ["No files change."],
        ["You can explain the one-to-many relationship.", "You understand why items need quotation_id.", "You understand cascade deletion."],
        ["Do not store all items inside one text field.", "Do not create a separate table for every quotation."],
        ["Relational tables store repeated items cleanly and allow a quotation to have any practical number of lines."],
        ["Model the business relationship before building forms."],
        ["identify parent and child records", "place fields in the correct table", "plan ownership"]))
    p.append(lesson(2, "CREATING THE QUOTATIONS TABLE", "35 minutes",
        ["You will create the parent table that stores customer details, dates, status and calculated totals."],
        ["The parent record represents the complete quotation and its workflow state."],
        ["Confirm the database plan from the previous lesson is clear.", "Open Notepad."], sql_prompt("create-quotations-table.sql",
            """Create public.quotations with:

id uuid primary key default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
quotation_number text not null
client_name text not null
client_company text
client_email text
client_phone text
client_address text
issue_date date not null
valid_until date
status text not null default 'draft' with a check allowing draft, sent, accepted, declined or expired
currency text not null default 'GBP'
discount_type text not null default 'percentage' with a check allowing percentage or fixed
discount_value numeric(12,2) not null default 0 with a non-negative check
tax_rate numeric(5,2) not null default 0 with a check from 0 to 100
subtotal numeric(12,2) not null default 0
discount_amount numeric(12,2) not null default 0
tax_amount numeric(12,2) not null default 0
total_amount numeric(12,2) not null default 0
notes text
terms text
created_at timestamptz not null default now()
updated_at timestamptz not null default now()

Add unique(user_id, quotation_number), enable Row Level Security and do not create permissive public policies."""
        ), ["One complete file:", "create-quotations-table.sql"], sql_save("create-quotations-table.sql"),
        ["The table exists.", "Constraints exist.", "RLS is enabled.", "No public policy bypasses ownership."],
        ["Do not use floating-point columns for money.", "Do not make quotation_number globally unique across every user."],
        ["Numeric columns preserve predictable decimal values; the user-scoped unique constraint lets different businesses use their own numbering."],
        ["Database constraints should reject impossible states even if browser validation fails."],
        ["create a financial parent table", "add business constraints", "enable RLS before application access"]))
    p.append(lesson(3, "CREATING THE QUOTATION ITEMS TABLE", "30 minutes",
        ["You will create the child table for itemised products and services."],
        ["Separate rows allow every quotation to contain multiple independently priced items."],
        ["Confirm the quotations table exists.", "Open Notepad."], sql_prompt("create-quotation-items-table.sql",
            """Create public.quotation_items with:

id uuid primary key default gen_random_uuid()
quotation_id uuid not null references public.quotations(id) on delete cascade
user_id uuid not null references auth.users(id) on delete cascade
description text not null
quantity numeric(12,2) not null with quantity > 0
unit_price numeric(12,2) not null with unit_price >= 0
line_total numeric(12,2) not null with line_total >= 0
sort_order integer not null default 0
created_at timestamptz not null default now()

Create indexes on quotation_id and user_id. Enable Row Level Security. Do not add public access."""
        ), ["One complete file:", "create-quotation-items-table.sql"], sql_save("create-quotation-items-table.sql"),
        ["The table exists.", "The foreign key cascades on deletion.", "Numeric checks exist.", "RLS is enabled."],
        ["Do not omit quotation_id.", "Do not accept zero or negative quantity."],
        ["Cascade deletion removes orphaned items when their parent quotation is deleted."],
        ["Child records must never outlive the business record that gives them meaning."],
        ["create a secure child table", "enforce valid quantities", "preserve relational integrity"]))
    policy_specs = [
        ("4", "CREATING QUOTATION OWNERSHIP POLICIES", "quotations", [
            "Create SELECT and DELETE policies with USING (user_id = auth.uid()).",
            "Create INSERT with WITH CHECK (user_id = auth.uid()).",
            "Create UPDATE with both USING and WITH CHECK (user_id = auth.uid()).",
        ]),
        ("5", "CREATING ITEM OWNERSHIP POLICIES", "quotation_items", [
            "For SELECT and DELETE require user_id = auth.uid() and an EXISTS query proving the parent quotations row has q.id = quotation_id and q.user_id = auth.uid().",
            "For INSERT require the same ownership expression inside WITH CHECK.",
            "For UPDATE use the same expression in USING and WITH CHECK.",
            "Keep RLS enabled on both tables.",
        ]),
    ]
    for number, title, table, steps in policy_specs:
        policy_file = f"create-{table.replace('_', '-')}-policies.sql"
        p.append(lesson(int(number), title, "30 minutes",
            [f"In this lesson, you will create the security policies for {table}.", "These policies will allow signed-in users to work only with information that belongs to them."],
            ["JavaScript can request the correct records, but the database must still enforce the privacy rule."],
            [f"Confirm {table} exists and RLS is enabled."],
            sql_prompt(policy_file, "Create the following policies:\n\n" + bullet_list(steps)),
            ["One complete file:", policy_file], sql_save(policy_file),
            ["All four operations have policies.", "Unauthenticated access is denied.", "Ownership is checked during updates as well as before them."],
            ["Do not use USING (true).", "Do not disable RLS when a request fails."],
            ["USING protects existing rows; WITH CHECK protects the ownership of new row values."],
            ["Security must remain correct when a record changes, not only when it is first created."],
            ["create operation-specific RLS", "protect ownership during mutation", "keep security in the database"]))
    p.append(lesson(6, "ADDING UPDATED-AT AUTOMATION", "20 minutes",
        ["You will create a database trigger that updates quotations.updated_at automatically."],
        ["Edit timestamps should remain reliable even if a browser forgets to send one."],
        ["Confirm the quotations table contains updated_at."],
        sql_prompt("create-quotation-updated-at-trigger.sql", "Create a reusable PostgreSQL function that sets NEW.updated_at = now(). Create a BEFORE UPDATE trigger on public.quotations that runs this function. Make the SQL safe to run once in this new project."),
        ["One complete file:", "create-quotation-updated-at-trigger.sql"], sql_save("create-quotation-updated-at-trigger.sql"),
        ["The function exists.", "The trigger is attached to quotations.", "RLS remains enabled."],
        ["Do not let clients control audit timestamps.", "Do not add multiple triggers doing the same job."],
        ["Database-managed timestamps provide one consistent source of truth."],
        ["Move rules that must always happen into the database."],
        ["create timestamp automation", "separate audit data from form data", "avoid duplicate triggers"]))
    p.append(lesson(7, "REVIEWING THE DATABASE SECURITY RULES", "25 minutes",
        ["In this lesson, you will review every security policy before building the quotation pages."],
        ["A missing policy can stop a correct feature from working, while an unsafe policy can expose private business information."],
        ["Open your Supabase project.", "Open Table Editor.", "Confirm quotations and quotation_items both show Row Level Security as enabled."],
        manual_prompt("Review the policies for quotations and quotation_items. Confirm that SELECT, INSERT, UPDATE and DELETE are covered. Confirm that every rule checks auth.uid(). Confirm that quotation item policies also check that the connected quotation belongs to the same signed-in user. Do not change or disable Row Level Security."),
        ["Nothing. This lesson is completed by reviewing Supabase."], ["No project files are created or updated."],
        ["Both tables have four operation policies.", "Every policy checks the signed-in user.", "Item policies also check the connected quotation.", "No policy uses USING (true)."],
        ["Do not assume that creating one SELECT policy protects every operation.", "Do not add a public policy to make testing easier."],
        ["Each database operation has its own security rule.", "The application will be tested with two accounts after the quotation pages have been built."],
        ["Security is easier to correct before many pages depend on it."],
        ["review all quotation policies", "confirm that Row Level Security remains enabled", "prepare for later two-account testing"]))
    p.append(lesson(8, "AUDITING THE QUOTATION DATABASE", "20 minutes",
        ["You will approve the complete database foundation."], ["Application development should begin only after schema and policies agree."],
        ["Review both tables, constraints, indexes, triggers and policies."], manual_prompt("Complete the database audit and correct any missing field, constraint, index, trigger or ownership policy."),
        ["Nothing."], ["No files change."],
        ["Both tables match the workbook.", "All required policies exist.", "No public policy exists.", "The trigger and indexes exist."],
        ["Do not postpone security fixes.", "Do not create duplicate columns with slightly different names."],
        ["A schema audit prevents later prompts from coding against a database that does not exist as described."],
        ["Keep the database contract stable before building client features."],
        ["audit schema", "audit RLS", "approve the database contract"]))
    p.append(chapter_close(4, chapter_titles[3], ["You built a constrained parent-and-items model with authenticated ownership at both levels."],
        ["Quotations table", "Items table", "RLS policies", "Indexes and trigger", "Security policy review"], "the quotation editor"))

    # Chapter 5
    p.append(chapter_open(5, chapter_titles[4], [
        "The quotation editor will collect customer details, dates, line items, discounts, tax, notes and terms as one coherent business workflow.",
    ], ["New quotation page", "Dynamic item rows", "Calculation engine", "Validation", "Quotation preview"]))
    p.append(capability_lesson(1, "BUILDING THE QUOTATION EDITOR", "90 minutes",
        "a complete New Quotation form for signed-in users",
        "A single coherent editor reduces errors and shows users the document they are preparing.",
        "Authentication, business profile and database chapters pass.",
        ["new-quotation.html", "quotation.css", "quotation-editor.js"],
        [
            "Create a protected page with customer, quotation, item, discount, tax, notes and terms sections.",
            "Include issue date, valid-until date, status and currency.",
            "Start with one item row containing description, quantity, unit price and read-only line total.",
            "Add controls to add and remove item rows while always retaining at least one row.",
            "Load business-profile defaults for currency, tax rate and terms.",
            "Use clear loading, validation, calculation and save-message areas.",
            "Do not save to Supabase yet.",
        ], ["The page is protected.", "Profile defaults load.", "Item rows add and remove.", "At least one item remains."]))
    p.append(capability_lesson(2, "BUILDING THE CALCULATION ENGINE", "70 minutes",
        "accurate line, subtotal, discount, tax and final-total calculations",
        "Users must see reliable totals before saving or printing a quotation.",
        "The complete editor exists.",
        ["quotation-editor.js"],
        [
            "Calculate each line as quantity multiplied by unit price.",
            "Convert every input with Number and treat blank invalid values safely.",
            "Round displayed money to two decimal places.",
            "Calculate subtotal from all current line totals.",
            "Support percentage and fixed discounts; never allow discount to exceed subtotal.",
            "Apply tax to subtotal after discount.",
            "Calculate final total as subtotal minus discount amount plus tax amount.",
            "Recalculate on every relevant input or row change.",
            "Keep unformatted numeric values separate from formatted display strings.",
        ], ["Several item totals are correct.", "Percentage discount works.", "Fixed discount works.", "Tax uses the discounted amount.", "Blank input never displays NaN."]))
    p.append(capability_lesson(3, "ADDING COMPLETE QUOTATION VALIDATION", "45 minutes",
        "business validation for the complete quotation",
        "A saved financial document should never contain missing identity, invalid dates or unusable item values.",
        "Calculations work.",
        ["quotation-editor.js"],
        [
            "Require client name, quotation number, issue date and at least one valid item.",
            "Require every item description, quantity greater than zero and unit price zero or greater.",
            "Require valid-until to be on or after issue date when supplied.",
            "Require tax from 0 to 100 and non-negative discount.",
            "Reject a fixed discount above subtotal and a percentage above 100.",
            "Show a concise validation summary and focus the first invalid field.",
            "Clear field errors when corrected.",
        ], ["Invalid forms do not proceed.", "The first error receives focus.", "Corrected fields clear errors.", "Valid zero-priced items remain allowed."]))
    p.append(capability_lesson(4, "GENERATING UNIQUE QUOTATION NUMBERS", "40 minutes",
        "a user-friendly quotation-number workflow",
        "Businesses need recognisable references while the database guarantees uniqueness per user.",
        "The editor and unique database constraint exist.",
        ["quotation-editor.js"],
        [
            "Suggest a quotation number in the form Q-YYYY-0001.",
            "Query only the authenticated user's recent quotation numbers.",
            "Find the highest valid sequence for the current year and increment it.",
            "Allow the user to edit the suggestion.",
            "Treat the database unique constraint as the final authority.",
            "If a duplicate occurs during save later, show a clear instruction to choose another number.",
        ], ["A first suggestion appears.", "The next sequence increments.", "A second user has an independent sequence.", "Manual editing remains possible."]))
    p.append(capability_lesson(5, "BUILDING THE LIVE QUOTATION PREVIEW", "60 minutes",
        "a live document preview beside the editor",
        "A live preview helps users catch customer, pricing and terms mistakes before saving.",
        "The editor, calculations and validation work.",
        ["new-quotation.html", "quotation.css", "quotation-editor.js"],
        [
            "Add a preview containing business profile, quotation number, dates, status, customer details, item table, totals, notes and terms.",
            "Update preview content as form values change.",
            "Format currency using Intl.NumberFormat and the selected currency.",
            "Show sensible empty placeholders only in the preview.",
            "Keep editor labels and preview document semantics accessible.",
            "Make the preview responsive without implementing print mode yet.",
        ], ["Preview updates immediately.", "Items appear in order.", "Currency formatting changes correctly.", "Totals match the editor."]))
    p.append(chapter_close(5, chapter_titles[4], ["You built a protected, validated editor with dynamic items, reliable calculations and a live preview."],
        ["Quotation form", "Dynamic items", "Calculations", "Validation", "Numbering", "Live preview"], "saving and viewing quotations"))

    # Chapter 6
    p.append(chapter_open(6, chapter_titles[5], [
        "The editor will now persist parent and item records, then retrieve them as complete quotations.",
    ], ["Reliable save workflow", "Saved quotation list", "Quotation details page", "Dashboard summaries"]))
    p.append(capability_lesson(1, "SAVING COMPLETE QUOTATIONS", "90 minutes",
        "a reliable save operation for a quotation and all of its items",
        "The business capability is incomplete until a validated quotation can be recovered after refresh.",
        "Editor validation and calculations pass. RLS policies pass.",
        ["quotation-functions.sql", "quotation-editor.js"],
        [
            "Require an authenticated session before saving.",
            "Create a PostgreSQL function named save_quotation_with_items accepting a quotation JSON object, an items JSON array and an optional quotation id.",
            "Make the function SECURITY INVOKER. This means it must use the permissions of the signed-in user. Write public. before every table and function name so PostgreSQL uses the correct database area. Allow only authenticated users to run it.",
            "Inside the function require auth.uid(), require at least one valid item and reject invalid quantity, price, tax or discount values.",
            "Recalculate every line total, subtotal, discount amount, tax amount and final total inside PostgreSQL using numeric values and two-decimal rounding.",
            "Insert a new owned quotation or update only an existing quotation owned by auth.uid().",
            "Replace that quotation's owned items inside the same database transaction.",
            "Return the saved quotation id and let any error roll back the complete operation.",
            "In quotation-editor.js validate locally, then call supabaseClient.rpc('save_quotation_with_items') with plain numeric item values.",
            "Disable Save during the operation and prevent double submission.",
            "Show duplicate-number, RLS, network and general errors clearly.",
            "On success redirect to quotation-details.html?id=THE_NEW_ID.",
            "Include comments explaining that quotation-functions.sql must be run once in the Supabase SQL Editor.",
        ], ["The SQL function installs successfully.", "One quotation and all items save.", "Stored totals match an independent manual calculation.", "Double-clicking does not duplicate.", "A deliberately invalid item leaves no incomplete quotation or items behind.", "A quotation belonging to another account cannot be updated."]))
    p.append(capability_lesson(2, "VIEWING SAVED QUOTATIONS", "70 minutes",
        "a Saved Quotations page for signed-in users",
        "Businesses need to find previous quotations without opening database tools.",
        "At least two quotations have been saved using the current account.",
        ["quotations.html", "quotations.js", "dashboard.css"],
        [
            "Fetch only the authenticated user's quotations ordered newest first.",
            "Display number, client, issue date, valid-until date, status, currency and total.",
            "Link every card or row to quotation-details.html?id=quotation.id.",
            "Add loading, empty and error states.",
            "Format dates and currencies safely.",
            "Do not fetch quotation_items on the list page.",
        ], ["Owned quotations appear.", "Newest appears first.", "An empty account sees guidance.", "No other user's records appear."]))
    p.append(capability_lesson(3, "BUILDING THE QUOTATION DETAILS PAGE", "75 minutes",
        "a complete page for viewing one saved quotation",
        "A saved record must reopen with every item and calculated value intact.",
        "The list page links to a quotation id.",
        ["quotation-details.html", "quotation-details.js", "quotation.css"],
        [
            "Read the id query parameter and reject a missing id.",
            "Fetch one owned quotation with maybeSingle.",
            "Fetch its owned quotation_items ordered by sort_order.",
            "Load the owned business profile.",
            "Render the complete professional quotation document.",
            "Include Back, Edit, Print and Delete controls; only Back works in this lesson.",
            "Show not-found, loading and error states without exposing another user's existence.",
        ], ["Your own quotation details load.", "Every item and total matches.", "A quotation ID belonging to another account or an invalid ID shows a safe not-found message.", "Back returns to the list."]))
    p.append(capability_lesson(4, "ADDING DASHBOARD QUOTATION SUMMARIES", "50 minutes",
        "useful quotation statistics on the protected dashboard",
        "A business dashboard should show current workload without replacing the detailed directory.",
        "Saved quotations can be fetched securely.",
        ["dashboard.html", "dashboard.js", "dashboard.css"],
        [
            "Fetch the authenticated user's quotations once.",
            "Display Total Quotations, Draft, Sent and Accepted counts.",
            "Display the total value of accepted quotations grouped only in the user's default currency.",
            "Show the five most recently updated quotations.",
            "Add loading, empty and error states.",
            "Do not make one database request per summary card.",
        ], ["Counts match saved data.", "Recent records are ordered correctly.", "Accepted value excludes other statuses.", "A new account sees a useful empty state."]))
    p.append(chapter_close(6, chapter_titles[5], ["You can save, list, reopen and summarise complete owned quotations."],
        ["Reliable parent-and-items save", "Quotation directory", "Details view", "Dashboard summaries"], "editing, status and deletion"))

    # Chapter 7
    p.append(chapter_open(7, chapter_titles[6], [
        "Saved quotations must support controlled changes throughout their business lifecycle.",
    ], ["Edit complete quotations", "Update status", "Delete with confirmation", "Ownership audit"]))
    p.append(capability_lesson(1, "EDITING A COMPLETE QUOTATION", "100 minutes",
        "a complete edit workflow for quotation details and items",
        "Users need to correct customer details, prices and terms without creating an unrelated duplicate.",
        "The details page and editor work.",
        ["edit-quotation.html", "edit-quotation.js", "quotation.css", "quotation-details.js"],
        [
            "Load the owned quotation and items from the id query parameter.",
            "Populate the same fields and dynamic item interface used for creation.",
            "Recalculate and validate with the same rules.",
            "Call the existing save_quotation_with_items RPC with the current quotation id so the owned parent and replacement item set change in one transaction.",
            "Never change user_id or id in browser code.",
            "Allow any RPC error to roll back the entire edit and display a clear failure message.",
            "Prevent duplicate submissions and redirect to details on success.",
            "Make the details-page Edit control open this page.",
        ], ["Existing data populates.", "Edits persist after reload.", "Removed items disappear.", "New items appear in order.", "Foreign ids remain inaccessible."]))
    p.append(capability_lesson(2, "MANAGING QUOTATION STATUS", "45 minutes",
        "a controlled Draft, Sent, Accepted, Declined and Expired status workflow",
        "Status helps a business understand what happened after a quotation was prepared.",
        "Quotation details load securely.",
        ["quotation-details.html", "quotation-details.js", "quotation.css"],
        [
            "Add an accessible status control with only the five allowed values.",
            "Update only the current authenticated user's quotation.",
            "Disable the control during the request and restore it after failure.",
            "Update the visible badge only after Supabase confirms success.",
            "Show a concise success or error message.",
        ], ["Every allowed status saves.", "Reload preserves status.", "Invalid values are impossible through the interface.", "Foreign records cannot be changed."]))
    p.append(capability_lesson(3, "DELETING A QUOTATION SAFELY", "45 minutes",
        "a safe quotation deletion process with confirmation",
        "Deletion is permanent and must be clear, intentional and ownership-protected.",
        "The details page displays an owned quotation.",
        ["quotation-details.html", "quotation-details.js", "quotation.css"],
        [
            "Make Delete open a confirmation dialog naming the quotation number and client.",
            "Require an explicit second confirmation action.",
            "Delete the owned quotations row by id and authenticated user_id.",
            "Rely on the foreign-key cascade to remove items.",
            "Disable controls during deletion.",
            "Redirect to quotations.html after confirmed success.",
            "Cancel must make no database request.",
        ], ["Cancel preserves the record.", "Confirm removes parent and items.", "The list no longer displays it.", "A foreign id cannot be deleted."]))
    p.append(capability_lesson(4, "AUDITING RECORD OWNERSHIP", "35 minutes",
        "a complete two-account security test for viewing, editing and deleting quotations",
        "Security must survive every new management capability.",
        "Two accounts each own quotations.",
        ["quotation-details.js", "edit-quotation.js", "quotations.js"],
        [
            "Review every select, update and delete query for authenticated ownership.",
            "Confirm pages respond safely to missing, malformed and foreign ids.",
            "Remove any client-supplied user_id fields.",
            "Preserve RLS and do not add public policies.",
            "Improve safe not-found messages without revealing whether a foreign record exists.",
        ], ["Account A cannot view Account B details.", "Account A cannot edit status or items for B.", "Account A cannot delete B.", "Each account can still work with its own quotations."]))
    p.append(chapter_close(7, chapter_titles[6], ["You added complete edit, lifecycle status and confirmed deletion workflows while preserving ownership."],
        ["Editing", "Status workflow", "Confirmed deletion", "Two-account audit"], "professional printing"))

    # Chapter 8
    p.append(chapter_open(8, chapter_titles[7], [
        "A quotation becomes useful outside the application when it can be presented as a clean professional document.",
    ], ["Print-ready quotation", "Print CSS", "Business and customer identity", "Print audit"]))
    p.append(capability_lesson(1, "BUILDING THE PRINTABLE QUOTATION DOCUMENT", "75 minutes",
        "a professional print mode for quotation details",
        "Businesses need to print or save quotations as PDF without application navigation and controls.",
        "Details, items and business profile load.",
        ["quotation-details.html", "quotation-details.js", "quotation.css"],
        [
            "Create a dedicated printable document region with business identity, quotation metadata, Bill To details, items, totals, notes and terms.",
            "Add a Print button that calls window.print only after the document has loaded.",
            "Add @media print rules that hide navigation, buttons, messages and application chrome.",
            "Use A4-friendly margins, readable type, strong table headers and controlled page breaks.",
            "Repeat table headers where supported and prevent total rows from splitting awkwardly.",
            "Use the selected quotation currency and preserve all values exactly.",
            "Do not use a PDF framework.",
        ], ["Print preview contains only the document.", "All totals match.", "Long item lists continue cleanly.", "Save as PDF produces a readable file."]))
    p.append(capability_lesson(2, "AUDITING THE PROFESSIONAL DOCUMENT", "35 minutes",
        "a complete print testing process for short and long quotations",
        "A visually attractive screen is not enough if printed pages omit information or split totals.",
        "Prepare short and long test quotations.",
        ["quotation.css", "quotation-details.js"],
        [
            "Audit A4 print preview for one-item and many-item quotations.",
            "Ensure business, client, quotation number, dates, currency, totals, notes and terms appear when available.",
            "Prevent controls, URLs and empty placeholder labels from printing.",
            "Improve page breaks without reducing text below a readable size.",
            "Preserve responsive screen styling.",
        ], ["One-page quotation prints cleanly.", "Long quotation uses sensible breaks.", "No application controls print.", "Printed totals equal saved totals."]))
    p.append(chapter_close(8, chapter_titles[7], ["You created and tested a professional printable quotation without adding frameworks."],
        ["Print document", "A4 print CSS", "Short and long document audit"], "a more powerful quotation workflow"))

    # Chapter 9
    p.append(chapter_open(9, chapter_titles[8], [
        "As quotation history grows, users need fast ways to find records and clear feedback during every request.",
    ], ["Search", "Status and date filters", "Sorting", "Expiry indicators", "Complete UX states"]))
    p.append(capability_lesson(1, "ADDING SEARCH, FILTERS AND SORTING", "75 minutes",
        "client-side quotation discovery controls",
        "A useful history page must remain manageable when a business has many quotations.",
        "The owned quotation list loads once.",
        ["quotations.html", "quotations.js", "dashboard.css"],
        [
            "Add search across quotation number, client name, company and email.",
            "Add status and issue-date range filters.",
            "Add sorting for newest, oldest, highest total, lowest total and client name.",
            "Filter and sort the authenticated user's already loaded array without changing the database.",
            "Add Reset Filters and a no-results state distinct from an empty account.",
            "Keep totals numeric during sorting and dates comparable.",
        ], ["Search finds number and client.", "Filters combine correctly.", "Every sort works.", "Reset restores all records.", "No-results does not imply deletion."]))
    p.append(capability_lesson(2, "ADDING EXPIRY AND WORKFLOW GUIDANCE", "45 minutes",
        "clear validity and expiry guidance",
        "Users should be able to recognise quotations whose validity date has passed.",
        "Saved quotations contain valid-until dates and statuses.",
        ["quotations.js", "quotation-details.js", "dashboard.css", "quotation.css"],
        [
            "Compare valid-until with today's local calendar date without time-zone off-by-one errors.",
            "Display an Expired indicator when the date has passed and status is still draft or sent.",
            "Do not silently change the saved database status.",
            "Show guidance allowing the user to choose whether to update status.",
            "Keep accepted and declined records labelled by their explicit saved status.",
        ], ["Past draft displays expiry guidance.", "Today's valid-until is not prematurely expired.", "Accepted remains Accepted.", "Database status changes only through user action."]))
    p.append(capability_lesson(3, "COMPLETING LOADING, EMPTY AND ERROR STATES", "50 minutes",
        "clear loading, empty, success and error messages across the protected application",
        "Users should always understand whether the application is waiting, empty, successful or unable to continue.",
        "All primary features work.",
        ["dashboard.js", "business-profile.js", "quotation-editor.js", "quotations.js", "quotation-details.js", "edit-quotation.js"],
        [
            "Audit every Supabase request for visible loading, empty, success and error feedback.",
            "Disable only the control responsible for a pending mutation.",
            "Prevent stale success messages after a later failure.",
            "Use friendly messages for users and log useful technical details without credentials.",
            "Ensure authentication expiry redirects safely to login.",
            "Preserve all working features and return every updated file in full.",
        ], ["No request leaves the page apparently frozen.", "Empty states give a next action.", "Failures restore controls.", "Expired sessions redirect safely."]))
    p.append(chapter_close(9, chapter_titles[8], ["You added scalable discovery, expiry guidance and consistent request feedback."],
        ["Search and filters", "Sorting", "Expiry guidance", "Application-wide UX states"], "final testing and completion"))

    # Chapter 10
    p.append(chapter_open(10, chapter_titles[9], [
        "The software is feature-complete. You will now test the whole product, deploy it and describe it professionally.",
    ], ["Complete audit", "Security audit", "Netlify deployment", "Live testing", "Portfolio description"]))
    p.append(lesson(1, "COMPLETE PROJECT AUDIT", "90 minutes",
        ["You will test every important user journey from the public website to printing and deletion."],
        ["Professional software is complete only when connected capabilities work together after realistic use."],
        ["Create two verified test accounts.", "Prepare short and long quotations."],
        manual_prompt("""Complete this audit:

Public website and mobile navigation
Registration, verification, login and logout
Protected-page redirects
Business profile create and update
Quotation creation with one and many items
Percentage and fixed discounts
Tax and currency formatting
Validation and duplicate number handling
Saved list, details and dashboard summaries
Search, filter, sort and reset
Editing customer details and items
Status updates
Expiry guidance
Deletion confirmation and cascade cleanup
A4 printing and Save as PDF
Two-account privacy for profiles, quotations and items
Loading, empty, success and error states
Browser console free from unresolved errors"""),
        ["Nothing."], ["Correct only files connected to a failed test."],
        ["Every audit item passes.", "Two-account privacy passes.", "Printed totals match saved totals.", "No unresolved console errors remain."],
        ["Do not test only the happy path.", "Do not deploy with known security or calculation failures."],
        ["Regression testing confirms that later improvements did not damage earlier capabilities."],
        ["Test complete user journeys, not isolated buttons."],
        ["perform final quality assurance", "verify financial calculations", "approve security and printing"]))
    p.append(lesson(2, "GOING LIVE", "45 minutes",
        ["You will deploy the static application to Netlify and test the live version."],
        ["A portfolio project must work outside the local computer and use authorised Supabase URLs."],
        ["The complete local audit passes.", "Create a Netlify account."],
        manual_prompt("""Deploy the complete project folder to Netlify.

Copy the final HTTPS site URL.

In Supabase Authentication URL Configuration, set the Site URL to the live URL and add the required local and live redirect URLs.

Do not upload backup folders, passwords or secret keys.

Repeat registration, login, protected navigation, quotation creation, retrieval, editing, deletion and printing on the live site."""),
        ["Nothing."], ["Keep the same complete project files locally."],
        ["The HTTPS site loads.", "Authentication redirects work.", "Supabase requests succeed.", "A live quotation can be created and printed."],
        ["Do not use service_role to solve deployment errors.", "Do not forget Supabase redirect configuration."],
        ["Static deployment publishes HTML, CSS and JavaScript while Supabase remains the secured backend."],
        ["A deployment is complete only after live user journeys pass."],
        ["deploy a static application", "configure authorised URLs", "test the live product"]))
    p.append(capability_lesson(3, "WRITING YOUR PORTFOLIO DESCRIPTION", "25 minutes",
        "a professional project description",
        "A portfolio should explain the business problem, technical decisions, security and result.",
        "The live application passes its audit.",
        ["portfolio-description.txt"],
        [
            "Write a concise portfolio description for the Professional Quotation Generator.",
            "Explain the business problem and the complete user workflow.",
            "Mention HTML, CSS, Vanilla JavaScript, Supabase, authentication, relational tables, Row Level Security and A4 printing.",
            "Describe parent-and-items data modelling, calculations, validation and two-account privacy testing.",
            "Do not claim technologies or features that are not present.",
            "Include a short project summary, key capabilities, technical highlights and testing statement.",
        ], ["The description is accurate.", "It explains business value.", "It identifies security and testing.", "It contains no invented technology."]))
    p.append(block("CHAPTER SUMMARY",
        "You tested, deployed and documented a complete professional business application."))
    p.append(block("CHAPTER MILESTONE",
        "You have completed Prompt to Profit™ Workbook 03.",
        bullet_list([
            "Public website", "Authentication and business profile", "Secure relational quotation database",
            "Quotation editor and calculations", "Save, view, edit, status and deletion workflows",
            "Professional A4 printing", "Search, filters and expiry guidance",
            "Two-account security testing", "Live deployment", "Portfolio description",
        ], "✓")))
    p.append(block("REFLECTION QUESTIONS",
        "Take time to record your answers.",
        "1. Which complete capability was most difficult to build?",
        "2. Why are quotation items stored separately from quotations?",
        "3. How does Row Level Security protect both parent and child records?",
        "4. Why are subtotal, discount, tax and total recalculated before saving?",
        "5. What did the two-account test reveal?",
        "6. How did print testing differ from screen testing?",
        "7. Which error did you diagnose most effectively?",
        "8. How would you explain this application to a business owner?",
        "9. What would you improve before offering it to a real client?",
        "10. How has your ability to guide AI through a software project changed?"))
    p.append(block("EXTENSION CHALLENGES",
        "Continue only after the core project passes every audit.",
        bullet_list([
            "Duplicate an existing quotation as a new draft",
            "Convert an accepted quotation into an invoice workflow",
            "Add product and service presets",
            "Add multiple saved tax rates",
            "Add optional business logo storage using Supabase Storage with secure policies",
            "Add quotation acceptance notes",
            "Add CSV export for quotation history",
            "Add dashboard charts without changing financial source data",
            "Add several print themes while preserving accessibility",
            "Add server-controlled sequential numbering using a secure database function",
        ]),
        "Treat each extension as one complete capability with security, loading, error and testing requirements."))
    p.append(block("NEXT WORKBOOK",
        "Excellent work.",
        "You have completed Workbook 03 of the Prompt to Profit™ Software Workbook Series.",
        "In the next workbook, you will build another complete business application using the same disciplined process.",
        "You will begin from an empty folder, preserve authenticated ownership, request complete files and test every capability before moving forward.",
        "The skills you developed here—relational data modelling, financial calculations, secure CRUD operations and professional printing—will support many future software projects."))
    return p


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    note = simplify_language(make_workbook())
    payload = {"bgColorIndex": 0, "textColorIndex": 1, "note": note}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({
        "output": str(args.output),
        "characters": len(note),
        "words": len(note.split()),
        "lines": len(note.splitlines()),
    }, indent=2))


if __name__ == "__main__":
    main()
