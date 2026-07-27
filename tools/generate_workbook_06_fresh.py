#!/usr/bin/env python3
"""Generate Workbook 06 using the locked beginner workbook standard."""

from __future__ import annotations

import json
import re
from pathlib import Path


SOURCE = Path(
    "deliverables/appointment-booking-system-workbook/"
    "5 - Appointment Booking System.notepad"
)
OUTPUT = Path(
    "deliverables/sales-tracker-workbook/"
    "6 - Sales Tracker.notepad"
)
SEP = "=" * 50


def bullets(items: list[str]) -> str:
    return "\n\n".join(f"• {item}" for item in items)


def checks(items: list[str]) -> str:
    return "\n\n".join(f"✓ {item}" for item in items)


def numbered(items: list[str]) -> str:
    return "\n\n".join(f"{index}.\n\n{item}" for index, item in enumerate(items, 1))


def lesson(
    number: int,
    title: str,
    minutes: str,
    building: str,
    why: str,
    before: list[str],
    prompt: str,
    ai_return: list[str],
    files: list[str],
    tests: list[str],
    checkpoint: list[str],
    mistakes: list[str],
    behind: str,
    design_question: str,
    learned: list[str],
) -> str:
    lower_prompt = prompt.lower()
    is_code_capability = (
        not any(
            phrase in lower_prompt
            for phrase in (
                "there is nothing to build with ai",
                "there is nothing to build with chatgpt",
                "nothing is created with chatgpt",
            )
        )
        and bool(re.search(r"\b[\w-]+\.(?:html|css|js)\b", prompt, re.I))
    )
    code_question = """

CODE-READING QUESTION

In the complete JavaScript or HTML from this lesson, find the part that performs the main action. What information does it use, and what happens when the action succeeds?""" if is_code_capability else ""
    save_text = "\n".join(files).lower()
    save_backup = """

BACK UP BEFORE REPLACING FILES

Confirm that you made a separate copy of the complete working project folder before replacing any existing file.
""" if any(
        phrase in save_text
        for phrase in ("replace", "updated file", "already exists", "existing")
    ) else ""
    return f"""LESSON {number}

{title}
{SEP}

Estimated Time

{minutes}

{SEP}

WHAT YOU ARE BUILDING
{SEP}

{building}

{SEP}

WHY THIS MATTERS
{SEP}

{why}

{SEP}

BEFORE YOU CONTINUE
{SEP}

{checks(before)}

BACK UP BEFORE REPLACING COMPLETE FILES

Before you replace a file, make a copy of your current project folder.

Add the words Before This Lesson and today's date to the copied folder name.

If something goes wrong, you can return to the working copy.

{SEP}

BUILD PROMPT
{SEP}

{prompt.strip()}

{SEP}

WHAT AI SHOULD RETURN
{SEP}

AI should return:

{bullets(ai_return)}

Do not continue if AI returns only a snippet or leaves out a file that it was asked to update. Ask for the complete file again.

{SEP}

SAVE YOUR FILES
{SEP}

{save_backup}

{numbered(files)}

Use Save As when creating a new file. Choose All Files and UTF-8 if Notepad shows those options.

{SEP}

TEST YOUR WORK
{SEP}

{checks(tests)}

Write any unexpected result in your Error Log before asking AI for help.

{SEP}

CHECKPOINT
{SEP}

Do not continue until:

{checks(checkpoint)}

{SEP}

COMMON BEGINNER MISTAKES
{SEP}

{bullets(mistakes)}

{SEP}

BEHIND THE SCENES
{SEP}

{behind}

{SEP}

THINK LIKE A SOFTWARE DESIGNER
{SEP}

{design_question}

{code_question}

{SEP}

WHAT YOU LEARNED
{SEP}

You learned:

{bullets(learned)}

{SEP}"""


def chapter(
    number: int,
    title: str,
    introduction: str,
    builds: list[str],
    lessons: list[str],
    summary: str,
    milestone: list[str],
    transition: str,
) -> str:
    return f"""CHAPTER {number}

{title}

{SEP}

CHAPTER INTRODUCTION
{SEP}

{introduction.strip()}

{SEP}

WHAT YOU WILL BUILD IN THIS CHAPTER
{SEP}

During this chapter, you will build:

{bullets(builds)}

{SEP}

{chr(10).join(lessons)}

CHAPTER SUMMARY
{SEP}

{summary.strip()}

{SEP}

CHAPTER MILESTONE
{SEP}

Before moving forward, confirm:

{checks(milestone)}

{SEP}

TRANSITION
{SEP}

{transition.strip()}

{SEP}
"""


def standard_prompt(task: str, requirements: list[str], files: list[str]) -> str:
    return f"""I am building a beginner-friendly Sales Tracker using HTML, CSS, Vanilla JavaScript and Supabase.

I use Notepad, so explain any manual step in simple language.

{task}

Requirements:

{bullets(requirements)}

Return the complete updated contents of:

{bullets(files)}

Do not return snippets.

Do not use frameworks, package managers or build tools.

Keep the existing design and working features unless a change is required for this task.

After the files, give me a short beginner-friendly testing checklist."""


def build_chapter_4() -> str:
    lessons = [
        lesson(
            1,
            "UNDERSTANDING THE SALES DATA MODEL",
            "20–30 Minutes",
            "A clear plan for the information that one sale must contain.",
            "A database becomes easier to build when you decide what each record means before writing SQL.",
            [
                "You can sign in on the deployed HTTPS website.",
                "Your Supabase project opens successfully.",
                "You have your Error Log nearby.",
            ],
            standard_prompt(
                "Help me plan one sales record before I create the database table.",
                [
                    "Use one row for one item sold in one sales entry.",
                    "Include sale date, item name, category, quantity, unit price, total amount, payment method, customer name and notes.",
                    "Explain which fields are required and which are optional.",
                    "Explain in simple language why user_id is needed.",
                    "Explain why total_amount should be calculated from quantity multiplied by unit_price.",
                    "Do not write SQL yet.",
                ],
                ["A plain-language data model plan"],
            ),
            [
                "A simple field-by-field plan.",
                "Clear required and optional field decisions.",
                "A short explanation of record ownership.",
            ],
            ["Save the plan in your project notes or workbook."],
            [
                "Read each field and describe what it stores.",
                "Use a sample sale to check that every important detail has a place.",
            ],
            [
                "You understand what one row represents.",
                "You can explain how a sale total is calculated.",
            ],
            [
                "Treating one row as a whole shopping basket with unrelated items.",
                "Using text for quantity or prices.",
                "Forgetting the owner of the record.",
            ],
            "A data model is a plan for stored information. Good field names make later prompts, forms and reports easier to understand.",
            "If a business sells three units of the same item in one transaction, should that be one row with quantity 3 or three separate rows? Explain your choice.",
            [
                "How to describe one sales record.",
                "Why data types and ownership matter.",
                "How quantity and unit price produce a total.",
            ],
        ),
        lesson(
            2,
            "CREATING THE SALES TABLE",
            "30–40 Minutes",
            "The secure sales table and its basic database rules.",
            "The table is the permanent home for every sale saved by the application.",
            [
                "You completed the data model plan.",
                "You are signed in to Supabase.",
                "The SQL Editor is open.",
            ],
            standard_prompt(
                "Write one complete Supabase SQL script that creates my sales table.",
                [
                    "Name the table sales.",
                    "Use id as a UUID primary key with a safe default.",
                    "Use user_id as a required UUID linked to auth.users(id) with on delete cascade.",
                    "Add sale_date as a required date.",
                    "Add item_name as required text and category as required text.",
                    "Add quantity as a required integer greater than zero.",
                    "Add unit_price as a required numeric value that cannot be negative.",
                    "Add total_amount as a generated stored numeric column equal to quantity multiplied by unit_price.",
                    "Add payment_method as required text.",
                    "Add optional customer_name and notes fields.",
                    "Add created_at and updated_at timestamps with safe defaults.",
                    "Create useful indexes for user_id, sale_date, category and payment_method.",
                    "Use if not exists where it is safe.",
                    "Explain exactly how to run the script in Supabase.",
                ],
                ["One complete SQL script"],
            ),
            [
                "One complete table-creation script.",
                "Database checks for quantity and price.",
                "A generated total and helpful indexes.",
            ],
            [
                "Save the SQL as sales-table.sql.",
                "Run the complete script in the Supabase SQL Editor.",
            ],
            [
                "Open Table Editor and find sales.",
                "Check that every requested column exists.",
                "Confirm total_amount is generated by the database.",
            ],
            [
                "The sales table exists.",
                "The owner, date, item, price and total fields are present.",
            ],
            [
                "Running only part of the SQL.",
                "Changing a column name in Supabase but not in your notes.",
                "Making total_amount a normal text field.",
            ],
            "PostgreSQL can calculate a generated column every time quantity or unit price changes. This prevents the saved total from disagreeing with the numbers used to create it.",
            "Why is a database-generated total safer than trusting a total typed into the browser?",
            [
                "How to create the sales table.",
                "How database checks protect important numbers.",
                "How a generated total stays accurate.",
            ],
        ),
        lesson(
            3,
            "PROTECTING SALES VALUES",
            "25–35 Minutes",
            "Rules that reject incomplete dates, blank names and unsupported payment methods.",
            "The form helps users, but database rules protect the information even if a request does not come from the form.",
            [
                "The sales table exists.",
                "You can see its columns in Table Editor.",
                "You backed up sales-table.sql.",
            ],
            standard_prompt(
                "Write one complete follow-up SQL script that strengthens the sales table.",
                [
                    "Reject blank item_name and blank category after spaces are removed.",
                    "Allow only Cash, Card, Bank Transfer, Mobile Money or Other for payment_method.",
                    "Keep quantity greater than zero and unit_price zero or greater.",
                    "Create a trigger that updates updated_at whenever a row changes.",
                    "Make the script safe to run after the table-creation script.",
                    "Explain each rule in simple language.",
                ],
                ["One complete SQL script"],
            ),
            [
                "Complete SQL for validation rules.",
                "A complete updated_at trigger.",
                "Simple explanations.",
            ],
            [
                "Save the SQL as sales-rules.sql.",
                "Run the full script in the SQL Editor.",
            ],
            [
                "Try to add a test row with quantity 0 in Table Editor.",
                "Try an unsupported payment method.",
                "Confirm Supabase refuses invalid values.",
            ],
            [
                "Invalid quantities are rejected.",
                "Only the allowed payment methods are accepted.",
            ],
            [
                "Using different spelling in the form and database rule.",
                "Deleting earlier checks while adding new ones.",
                "Testing with a real business record instead of temporary test data.",
            ],
            "Validation close to the database is a final safety net. JavaScript validation improves the experience; database validation protects the stored information.",
            "Which payment-method value would be rejected, and which line of SQL causes that rejection?",
            [
                "Why important rules belong in the database.",
                "How allowed values keep reports consistent.",
                "How updated_at records later changes.",
            ],
        ),
        lesson(
            4,
            "ENABLING ROW LEVEL SECURITY",
            "20–30 Minutes",
            "Row Level Security on the sales table.",
            "Without Row Level Security, a database request could expose sales that belong to another account.",
            [
                "The sales table and validation rules work.",
                "You understand that user_id identifies the owner.",
                "The SQL Editor is open.",
            ],
            standard_prompt(
                "Write the complete SQL needed to enable Row Level Security on the sales table.",
                [
                    "Enable Row Level Security.",
                    "Do not create public access.",
                    "Explain why enabling RLS alone blocks browser access until policies are added.",
                    "Include a query I can use to confirm that RLS is enabled.",
                ],
                ["One complete SQL script"],
            ),
            [
                "The RLS command.",
                "A confirmation query.",
                "A beginner-friendly explanation.",
            ],
            [
                "Save the SQL as sales-rls.sql.",
                "Run it in Supabase.",
            ],
            [
                "Confirm RLS shows as enabled for sales.",
                "Do not disable RLS to make a later test pass.",
            ],
            [
                "RLS is enabled.",
                "There is no public policy.",
            ],
            [
                "Assuming login alone protects database rows.",
                "Turning RLS off when a policy is missing.",
                "Adding a policy for the anon role.",
            ],
            "Authentication identifies the signed-in user. Row Level Security then decides which rows that user may read or change.",
            "What is the difference between knowing who a user is and deciding which rows that user may access?",
            [
                "How to enable RLS.",
                "Why RLS starts with no access.",
                "Why policies must check ownership.",
            ],
        ),
        lesson(
            5,
            "CREATING THE SELECT POLICY",
            "20–30 Minutes",
            "A policy that lets a signed-in user read only their own sales.",
            "Private sales figures must never appear in another user's dashboard or reports.",
            [
                "RLS is enabled.",
                "You have not created public access.",
                "You know that auth.uid() represents the signed-in user.",
            ],
            standard_prompt(
                "Write one complete SQL script for the sales SELECT policy.",
                [
                    "Allow only the authenticated role.",
                    "Allow a row only when auth.uid() equals user_id.",
                    "Drop and recreate the named policy safely.",
                    "Use a clear policy name.",
                    "Explain the ownership check in simple language.",
                ],
                ["One complete SQL script"],
            ),
            [
                "A safe SELECT policy.",
                "An authenticated ownership check.",
                "A simple explanation.",
            ],
            ["Save the SQL as sales-select-policy.sql.", "Run the full script."],
            [
                "Open the policy list for sales.",
                "Confirm the policy applies to SELECT and authenticated users.",
            ],
            [
                "The SELECT policy exists.",
                "Its condition compares auth.uid() with user_id.",
            ],
            [
                "Using true as the policy condition.",
                "Applying the policy to anon.",
                "Comparing auth.uid() with the sale id.",
            ],
            "A SELECT policy is applied whenever the application asks Supabase to read sales. Rows that fail the condition are hidden.",
            "If a table contains ten rows but only four belong to the signed-in user, how many should Supabase return?",
            ["How SELECT policies filter rows.", "How auth.uid() supports ownership.", "Why private totals depend on secure reads."],
        ),
        lesson(
            6,
            "CREATING THE INSERT POLICY",
            "20–30 Minutes",
            "A policy that allows a user to save a sale only under their own account.",
            "A browser must not be allowed to create a record and assign it to someone else.",
            ["The SELECT policy works.", "RLS remains enabled.", "The SQL Editor is open."],
            standard_prompt(
                "Write one complete SQL script for the sales INSERT policy.",
                [
                    "Allow only authenticated users.",
                    "Use WITH CHECK so auth.uid() must equal user_id.",
                    "Drop and recreate the named policy safely.",
                    "Explain why the application must insert the current user's id.",
                ],
                ["One complete SQL script"],
            ),
            ["A secure INSERT policy.", "A WITH CHECK ownership rule.", "A simple explanation."],
            ["Save the SQL as sales-insert-policy.sql.", "Run the complete script."],
            ["Confirm the policy is for INSERT.", "Confirm it uses WITH CHECK and the authenticated role."],
            ["The INSERT policy exists.", "A user cannot choose a different owner."],
            ["Using USING instead of WITH CHECK for INSERT.", "Forgetting the authenticated role.", "Using an email address as user_id."],
            "WITH CHECK examines the new row before Supabase saves it. The ownership rule must be true for the insert to succeed.",
            "Which value should your JavaScript place in user_id before inserting a sale?",
            ["How INSERT policies protect ownership.", "Why WITH CHECK is required.", "Why the authenticated user id is saved with every sale."],
        ),
        lesson(
            7,
            "CREATING THE UPDATE POLICY",
            "20–30 Minutes",
            "A policy that allows owners to edit only their own sales and keeps ownership unchanged.",
            "Editing must not become a way to take over another user's row or transfer a row to a different account.",
            ["SELECT and INSERT policies exist.", "RLS remains enabled.", "The SQL Editor is open."],
            standard_prompt(
                "Write one complete SQL script for the sales UPDATE policy.",
                [
                    "Allow only authenticated users.",
                    "Use USING to check the existing row owner.",
                    "Use WITH CHECK to check the updated row owner.",
                    "Require auth.uid() to equal user_id in both checks.",
                    "Drop and recreate the named policy safely.",
                ],
                ["One complete SQL script"],
            ),
            ["A secure UPDATE policy.", "Both existing-row and new-row checks.", "A simple explanation."],
            ["Save the SQL as sales-update-policy.sql.", "Run the complete script."],
            ["Confirm the policy includes USING.", "Confirm it also includes WITH CHECK."],
            ["Only owners can update rows.", "An update cannot change ownership."],
            ["Adding only a USING condition.", "Allowing anon updates.", "Removing earlier policies."],
            "An UPDATE has an old row and a proposed new row. Checking both protects the row before and after the change.",
            "Why does a secure UPDATE policy need two ownership checks?",
            ["How secure updates work.", "Why ownership is checked twice.", "How RLS protects editing."],
        ),
        lesson(
            8,
            "CREATING THE DELETE POLICY",
            "20–30 Minutes",
            "A policy that permits permanent deletion only for the owner of a sale.",
            "Delete is a powerful action. The database must reject attempts to delete another user's record.",
            ["The UPDATE policy exists.", "You understand that deletion is permanent.", "The SQL Editor is open."],
            standard_prompt(
                "Write one complete SQL script for the sales DELETE policy.",
                [
                    "Allow only authenticated users.",
                    "Use an ownership condition where auth.uid() equals user_id.",
                    "Drop and recreate the named policy safely.",
                    "Explain that the interface must still ask for confirmation before deleting.",
                ],
                ["One complete SQL script"],
            ),
            ["A secure DELETE policy.", "An ownership check.", "A warning about permanent deletion."],
            ["Save the SQL as sales-delete-policy.sql.", "Run the complete script."],
            ["Confirm the policy applies to DELETE.", "Confirm it is restricted to authenticated owners."],
            ["The DELETE policy exists.", "There is no public delete access."],
            ["Using a policy condition of true.", "Testing deletion with important data.", "Assuming a confirmation message replaces RLS."],
            "The interface confirmation prevents accidental clicks. The DELETE policy prevents unauthorised database requests. Both protections have different jobs.",
            "Why are a confirmation dialog and a DELETE policy both needed?",
            ["How to protect deletion.", "Why ownership is required.", "Why user experience and database security work together."],
        ),
        lesson(
            9,
            "TESTING THE SALES DATABASE",
            "35–45 Minutes",
            "A careful two-account test of all sales table rules and policies.",
            "Security is not complete because the SQL ran successfully. You must prove that valid work succeeds and unauthorised work fails.",
            ["All four RLS policies exist.", "RLS is enabled.", "You can use two verified test accounts."],
            standard_prompt(
                "Create a beginner-friendly database security test plan for my sales table.",
                [
                    "Use the deployed HTTPS application and two separate verified accounts called Account A and Account B.",
                    "Test valid inserts, reads, updates and deletes.",
                    "Test invalid quantity, blank item name and unsupported payment method.",
                    "Prove Account A cannot read, edit or delete Account B's rows.",
                    "Do not suggest disabling RLS or using the service role key in browser code.",
                    "Explain the expected result for every test.",
                ],
                ["One complete test plan"],
            ),
            ["A numbered two-account test plan.", "Expected pass and fail results.", "A short security review."],
            ["Save the test plan in your project notes.", "Keep all SQL files together."],
            [
                "Create a temporary valid sale for Account A.",
                "Create a different temporary sale for Account B.",
                "Complete every ownership and validation test.",
                "Remove only temporary records when testing is complete.",
            ],
            ["Valid records succeed.", "Invalid values fail.", "Cross-account access fails."],
            ["Testing with only one account.", "Calling an empty result proof of every policy.", "Leaving RLS disabled after troubleshooting."],
            "A two-account test checks the boundary between users. This is one of the most useful security tests in a multi-user application.",
            "Which failed test would show that your SELECT policy is too open?",
            ["How to test database rules.", "How to prove ownership isolation.", "Why expected failures are successful security tests."],
        ),
    ]
    return chapter(
        4,
        "BUILDING THE SALES DATABASE",
        """Your Sales Tracker can now recognise the person who is signed in.

The next step is to create a secure place for that person to store sales.

Each sale will record what was sold, when it was sold, how many units were sold and the amount charged for each unit. The database will calculate the total.

You will also protect every row with Row Level Security. This means one account cannot see or change another account's sales.""",
        [
            "A sales data model",
            "The sales table",
            "Quantity, price and payment rules",
            "An automatically calculated total",
            "Row Level Security",
            "SELECT, INSERT, UPDATE and DELETE policies",
            "A two-account security test",
        ],
        lessons,
        "You created the secure database foundation for the Sales Tracker. The table stores useful sales information, calculates each row total and uses ownership policies to keep accounts separate.",
        [
            "The sales table exists.",
            "Invalid quantities, prices and payment methods are rejected.",
            "The four ownership policies exist.",
            "Two-account privacy tests pass.",
        ],
        "The database is ready. In the next chapter, you will build the private dashboard and record the first real sale.",
    )


def build_chapter_5() -> str:
    lessons = [
        lesson(
            1,
            "DESIGNING THE SALES DASHBOARD",
            "35–45 Minutes",
            "The private dashboard layout, navigation and empty statistics cards.",
            "The dashboard gives the user one clear place to understand sales and begin common tasks.",
            ["Authentication works on the deployed site.", "The sales table is secure.", "You backed up your project folder."],
            standard_prompt(
                "Build the complete private Sales Tracker dashboard.",
                [
                    "Protect the page so signed-out visitors go to login.html.",
                    "Show the signed-in user's email and a working logout button.",
                    "Create cards for today's sales total, today's sale count, this month's sales total and all-time sales total.",
                    "Create a clear Record New Sale button.",
                    "Create links to Dashboard and Sales History.",
                    "Show friendly loading and empty states.",
                    "Use accessible labels, visible keyboard focus and responsive design.",
                    "Do not calculate real statistics yet; prepare the elements with clear ids.",
                ],
                ["dashboard.html", "dashboard.js", "styles.css"],
            ),
            ["A protected dashboard.", "Four prepared statistics cards.", "Clear navigation and responsive styling."],
            ["Replace dashboard.html.", "Replace dashboard.js.", "Replace styles.css."],
            ["Open the dashboard while signed in.", "Test the navigation and logout button.", "Resize the browser and check the cards."],
            ["Signed-out users are redirected.", "The dashboard is clear on desktop and mobile.", "No unexpected console errors appear."],
            ["Removing existing authentication checks.", "Using the same id on several cards.", "Showing zero before loading finishes without a loading state."],
            "The HTML provides labelled spaces for information. JavaScript will later ask Supabase for sales and place calculated values inside those spaces.",
            "Which dashboard number should help a business understand today's activity most quickly, and why?",
            ["How to organise a private dashboard.", "How to prepare statistic elements.", "Why loading and empty states matter."],
        ),
        lesson(
            2,
            "BUILDING THE RECORD SALE FORM",
            "40–50 Minutes",
            "A complete form for entering one sale.",
            "A good form helps the user provide valid information without needing to understand the database.",
            ["The dashboard works.", "You know the sales table field names.", "You backed up the current files."],
            standard_prompt(
                "Add a complete Record Sale form to the protected dashboard.",
                [
                    "Include sale date, item name, category, quantity, unit price, payment method, optional customer name and optional notes.",
                    "Use today's date as a helpful default without preventing an earlier date.",
                    "Use a select for the allowed payment methods.",
                    "Show a live read-only total calculated from quantity multiplied by unit price.",
                    "Use decimal-safe display formatting for money.",
                    "Add clear labels, help text and validation messages.",
                    "Do not save to Supabase yet.",
                    "Keep all existing dashboard and authentication features.",
                ],
                ["dashboard.html", "dashboard.js", "styles.css"],
            ),
            ["A complete accessible form.", "A live calculated total.", "Clear validation and mobile styling."],
            ["Replace dashboard.html.", "Replace dashboard.js.", "Replace styles.css."],
            ["Enter quantity 3 and unit price 2500.", "Confirm the displayed total is 7500 in the chosen money format.", "Try blank required fields and quantity 0."],
            ["All requested fields appear.", "The total updates immediately.", "Invalid form values are explained clearly."],
            ["Using a text field for quantity.", "Allowing a negative price.", "Saving a formatted currency string instead of a number."],
            "The browser displays a helpful total before saving. The database will calculate its own generated total after saving, so the stored value remains trustworthy.",
            "Which two input values cause the live total to change?",
            ["How to build a sales form.", "How to calculate a preview total.", "How form controls reduce errors."],
        ),
        lesson(
            3,
            "SAVING SALES SECURELY",
            "40–50 Minutes",
            "The complete form submission that saves a sale under the signed-in user's account.",
            "This is the moment the form becomes a working business capability instead of a visual design.",
            ["The form validates correctly.", "The INSERT policy exists.", "You are using the publishable key, never a service role key."],
            standard_prompt(
                "Connect the Record Sale form to Supabase and save sales securely.",
                [
                    "Get the authenticated user before inserting.",
                    "Insert sale_date, item_name, category, quantity, unit_price, payment_method, customer_name, notes and the current user's id.",
                    "Do not insert total_amount because the database generates it.",
                    "Trim text values and convert number inputs to numbers.",
                    "Disable the submit button while saving.",
                    "Show a clear success or error message.",
                    "After success, reset the form, restore today's date and refresh dashboard data.",
                    "Keep all existing features.",
                ],
                ["dashboard.html", "dashboard.js", "styles.css"],
            ),
            ["A complete secure insert flow.", "Duplicate-click protection.", "Clear success and error feedback."],
            ["Replace dashboard.html.", "Replace dashboard.js.", "Replace styles.css."],
            ["Save a valid sale.", "Confirm the row appears in Supabase with your user_id.", "Confirm total_amount equals quantity multiplied by unit_price.", "Refresh the page and confirm the record remains."],
            ["A valid sale saves once.", "The generated total is correct.", "An error does not clear the form."],
            ["Adding total_amount to the insert.", "Forgetting to await Supabase.", "Clearing the form before Supabase confirms success."],
            "The submit handler collects values, validates them, identifies the user and sends one insert request. RLS makes the ownership check again inside the database.",
            "Find the insert object. Which property connects the new row to the signed-in account?",
            ["How to save a sale.", "Why the generated total is not inserted.", "How to handle loading, success and failure."],
        ),
        lesson(
            4,
            "BUILDING DAILY AND MONTHLY STATISTICS",
            "45–60 Minutes",
            "Real dashboard statistics calculated from the signed-in user's sales.",
            "Daily and monthly figures help a business see current performance without reading every row.",
            ["You saved several test sales on different dates.", "The SELECT policy works.", "The dashboard statistic elements have unique ids."],
            standard_prompt(
                "Load the signed-in user's sales and calculate the dashboard statistics.",
                [
                    "Select only the fields needed for the statistics.",
                    "Use sale_date, not created_at, to decide which period contains a sale.",
                    "Calculate today's total and today's number of sales.",
                    "Calculate the current calendar month's total.",
                    "Calculate the all-time total.",
                    "Use local date parts carefully so today's date is not shifted by UTC conversion.",
                    "Format money consistently.",
                    "Show loading, empty and error states.",
                    "Refresh the statistics after a new sale is saved.",
                ],
                ["dashboard.html", "dashboard.js", "styles.css"],
            ),
            ["Complete statistics-loading logic.", "Correct daily, monthly and all-time calculations.", "Friendly states and formatted values."],
            ["Replace dashboard.html.", "Replace dashboard.js.", "Replace styles.css."],
            ["Add two sales dated today and one dated earlier this month.", "Check today's count and total.", "Check the monthly and all-time totals.", "Change one test date and confirm the correct cards change."],
            ["Every card matches the saved test data.", "The figures survive refresh.", "Only the signed-in user's rows are included."],
            ["Using created_at instead of sale_date.", "Comparing dates after converting them to UTC.", "Counting quantity as the number of sales when the card is meant to count rows."],
            "The browser receives the owner's permitted rows, then uses filter and reduce operations to group dates and add totals. RLS ensures the input data already belongs to the current account.",
            "Which condition decides whether a sale belongs to the current month?",
            ["How to calculate daily statistics.", "How to calculate monthly statistics.", "How date choices affect business reports."],
        ),
    ]
    return chapter(
        5,
        "BUILDING THE SALES DASHBOARD",
        """The secure database is ready.

You will now create the main working area of the application.

The user will record a sale, see its calculated total and view useful daily and monthly figures. Each step will be tested before you move forward.""",
        ["A protected sales dashboard", "A complete Record Sale form", "Secure sale saving", "Daily, monthly and all-time statistics"],
        lessons,
        "You built the central working area of the Sales Tracker. A signed-in user can now record a sale and immediately see useful totals.",
        ["The form saves valid sales.", "The database generates correct totals.", "Daily and monthly statistics are accurate.", "The dashboard works on a small screen."],
        "The dashboard shows a useful summary. Next, you will build the complete sales history and a page for viewing one sale.",
    )


def build_chapter_6() -> str:
    lessons = [
        lesson(
            1,
            "BUILDING THE SALES HISTORY",
            "45–60 Minutes",
            "A protected page that lists all saved sales in a clear order.",
            "A business needs to move from a summary to the individual records behind it.",
            ["Several test sales exist.", "The SELECT policy works.", "Dashboard navigation works."],
            standard_prompt(
                "Build a complete protected Sales History page.",
                [
                    "Load the signed-in user's sales from Supabase.",
                    "Order records by sale_date newest first, then created_at newest first.",
                    "Show date, item, category, quantity, unit price, total and payment method.",
                    "Use a responsive table on wide screens and readable cards on small screens.",
                    "Make each record open sale-details.html?id=SALE_ID.",
                    "Add loading, error and no-sales states.",
                    "Add navigation back to the dashboard.",
                ],
                ["sales.html", "sales.js", "styles.css"],
            ),
            ["A complete protected history page.", "Responsive sales records.", "Working details links and useful states."],
            ["Create sales.html.", "Create sales.js.", "Replace styles.css."],
            ["Open Sales History while signed in.", "Confirm all your records appear in the correct order.", "Open the page on a narrow browser window."],
            ["Only the current user's sales appear.", "Every amount and date is readable.", "Each details link contains the correct id."],
            ["Forgetting the authentication guard.", "Displaying raw unformatted numbers.", "Creating links without the sale id."],
            "The page makes one ordered SELECT request. JavaScript then creates a safe visual row or card for each returned record.",
            "Which part of the Supabase query controls the order of the history?",
            ["How to load a sales history.", "How to display the same data responsively.", "How a record id connects list and details pages."],
        ),
        lesson(
            2,
            "BUILDING THE SALE DETAILS PAGE",
            "40–50 Minutes",
            "A protected page that shows every saved detail for one sale.",
            "A focused details page gives the user space to review one record before editing or deleting it.",
            ["Sales History works.", "Its links contain an id query value.", "You backed up the project."],
            standard_prompt(
                "Build the complete protected sale details page.",
                [
                    "Read the id value from the page URL.",
                    "Reject a missing id with a clear message and a link back.",
                    "Select one sale by id using maybeSingle.",
                    "Rely on RLS and also handle a missing or inaccessible record safely.",
                    "Show all sale fields with formatted date and money values.",
                    "Add Edit Sale, Delete Sale and Back to Sales History actions.",
                    "Do not build editing or deletion yet.",
                    "Add loading and error states.",
                ],
                ["sale-details.html", "sale-details.js", "styles.css"],
            ),
            ["A complete protected details page.", "Safe id handling.", "Prepared edit and delete actions."],
            ["Create sale-details.html.", "Create sale-details.js.", "Replace styles.css."],
            ["Open a valid sale from history.", "Remove the id from the URL and check the message.", "Use a random id and confirm the page fails safely."],
            ["A valid sale displays correctly.", "Missing records do not crash the page.", "Navigation returns to the history."],
            ["Using the id without checking it.", "Calling single when a missing row should be handled normally.", "Showing raw database error details to the user."],
            "The query-string id tells the page which row to request. RLS remains the final decision-maker about whether that row is visible.",
            "What should the page do when maybeSingle returns no sale?",
            ["How to read a URL parameter.", "How to load one protected row.", "How to handle missing records safely."],
        ),
        lesson(
            3,
            "TESTING THE SALES HISTORY",
            "30–40 Minutes",
            "A complete test of list, details, empty, refresh and privacy behaviour.",
            "A screen is only complete when normal results and unusual results are both understandable.",
            ["The history and details pages are complete.", "You have two verified test accounts.", "You can open browser developer tools."],
            standard_prompt(
                "Write a complete beginner-friendly test checklist for Sales History and Sale Details.",
                [
                    "Test order, displayed values, details links, refresh and mobile layout.",
                    "Test no-sales, missing-id and unknown-id states.",
                    "Use two accounts to confirm a sale from Account A cannot be opened by Account B.",
                    "Include the expected result for each step.",
                    "Include a console-error check.",
                ],
                ["One complete test checklist"],
            ),
            ["A normal-flow checklist.", "Empty and error-state tests.", "A two-account privacy test."],
            ["Save the checklist in your project notes."],
            ["Complete every checklist item.", "Record and fix each unexpected result.", "Repeat a failed test after the fix."],
            ["History and details work after refresh.", "Private records remain private.", "No unexplained console errors remain."],
            ["Testing only the first record.", "Skipping the mobile layout.", "Sharing one browser session between two account tests without signing out."],
            "Testing different states helps you find problems that perfect sample data can hide.",
            "Which test proves that RLS protects the details page?",
            ["How to test connected pages.", "How to test empty and missing states.", "How to confirm cross-account privacy."],
        ),
    ]
    return chapter(
        6,
        "VIEWING SALES",
        """The dashboard gives a quick summary, but users also need to see the records behind those figures.

You will create a complete Sales History page and a separate Sale Details page. Both pages will remain protected by authentication and Row Level Security.""",
        ["A complete Sales History page", "Responsive sales rows and cards", "A Sale Details page", "Empty, missing and privacy tests"],
        lessons,
        "You built a clear path from the dashboard to the complete history and then to one individual sale.",
        ["Sales appear in the correct order.", "One sale opens safely by id.", "Empty and missing states are clear.", "Account privacy tests pass."],
        "The history works, but a growing list can become difficult to use. Next, you will add search, filters and sorting.",
    )


def build_chapter_7() -> str:
    lessons = [
        lesson(
            1,
            "BUILDING SALES SEARCH, FILTERING AND SORTING",
            "50–65 Minutes",
            "One discovery toolbar that helps users find the right sales quickly.",
            "Search and filters turn a long history into useful business information.",
            ["Sales History loads correctly.", "Your test data contains different dates, categories and payment methods.", "You backed up the files."],
            standard_prompt(
                "Add complete search, filtering and sorting to Sales History.",
                [
                    "Add one search field for item name, customer name and notes.",
                    "Add category and payment-method filters.",
                    "Add From Date and To Date filters based on sale_date.",
                    "Add sorting for newest, oldest, highest total and lowest total.",
                    "Allow all controls to work together.",
                    "Use safe Supabase query methods and escape search input used in an or filter.",
                    "Do not filter by user_id in place of RLS; keep RLS enabled.",
                    "Add a Clear Filters button and a result count.",
                    "Show a specific no-matching-sales message.",
                    "Keep details links and responsive display working.",
                ],
                ["sales.html", "sales.js", "styles.css"],
            ),
            ["A complete discovery toolbar.", "Combined query behaviour.", "Clear filters, result count and no-match feedback."],
            ["Replace sales.html.", "Replace sales.js.", "Replace styles.css."],
            ["Search for part of an item name.", "Combine a date range with a payment method.", "Sort matching records by highest total.", "Clear every control."],
            ["Controls work separately and together.", "Clear Filters restores the full history.", "No-match feedback is different from no saved sales."],
            ["Filtering only the currently visible page by accident.", "Using created_at for the date range.", "Building raw query strings from unchecked input."],
            "Each control contributes a condition or ordering instruction to the query. Rebuilding the query when controls change keeps the displayed records consistent.",
            "Which lines add the From Date and To Date conditions to the Supabase query?",
            ["How to combine search and filters.", "How to sort totals and dates.", "Why clear feedback helps users understand results."],
        ),
        lesson(
            2,
            "TESTING SALES DISCOVERY",
            "30–40 Minutes",
            "A planned test using known sales that proves every discovery control works together.",
            "Combined controls can fail in ways that single-control tests do not reveal.",
            ["The discovery toolbar is complete.", "You have a small set of sales with known differences.", "You know the expected results."],
            standard_prompt(
                "Create a complete test plan for my Sales History search, filters and sorting.",
                [
                    "Start by defining six useful test sales.",
                    "Test partial item search, customer search and notes search.",
                    "Test category, payment method and date range separately.",
                    "Test at least three combined-control cases.",
                    "Test all four sorting options.",
                    "Test Clear Filters, no matches, refresh and mobile layout.",
                    "State the expected records for every test.",
                ],
                ["One complete test plan"],
            ),
            ["A six-record test dataset.", "Individual and combined tests.", "Expected results for every test."],
            ["Save the plan in your project notes."],
            ["Create the planned test records.", "Complete every test.", "Correct and repeat any failed case."],
            ["Every control produces the expected records.", "Sorting changes order without losing filters.", "Clear Filters restores the list."],
            ["Testing with records that all look alike.", "Guessing expected totals during the test.", "Ignoring no-match and refresh behaviour."],
            "Known test data makes failures easier to recognise. It gives you a small answer key for every filter combination.",
            "Which combined test would reveal that changing the sort accidentally removes the date filter?",
            ["How to design useful search tests.", "How to test combined state.", "Why expected results should be written first."],
        ),
    ]
    return chapter(
        7,
        "SEARCHING, FILTERING AND SORTING SALES",
        """As the business records more sales, scrolling becomes slower and less useful.

In this chapter, you will help the user find a sale by words, category, payment method or date. You will also let the user change the order of the results.""",
        ["Sales search", "Category and payment filters", "A sales date range", "Four sorting choices", "Clear filters and result feedback"],
        lessons,
        "You turned Sales History into a useful discovery tool. Users can combine controls and still open the correct record.",
        ["Search finds the correct text.", "Filters work alone and together.", "All sorting options work.", "No-match and clear-filter states are correct."],
        "Users can now find the right sale. Next, you will allow them to correct a saved record securely.",
    )


def build_chapter_8() -> str:
    lessons = [
        lesson(
            1,
            "BUILDING SALE EDITING",
            "50–65 Minutes",
            "A complete edit page that loads one sale, validates changes and saves them securely.",
            "Mistakes happen. Editing lets the owner correct a date, item, quantity, price or other detail without creating a second record.",
            ["Sale Details works.", "The UPDATE policy exists.", "You backed up the project."],
            standard_prompt(
                "Build complete secure editing for one sale.",
                [
                    "Create edit-sale.html and edit-sale.js.",
                    "Read the sale id from the URL and protect the page with authentication.",
                    "Load the owner's sale and prefill every editable field.",
                    "Reuse the same field rules and live total preview as Record Sale.",
                    "Update only sale_date, item_name, category, quantity, unit_price, payment_method, customer_name and notes.",
                    "Never update user_id, id, total_amount or created_at from the browser.",
                    "Disable the save button while updating.",
                    "Show clear success and error messages.",
                    "After success, return to the same sale details page.",
                    "Connect the Sale Details Edit button to this page.",
                ],
                ["edit-sale.html", "edit-sale.js", "sale-details.html", "sale-details.js", "styles.css"],
            ),
            ["A complete protected edit page.", "Prefilled values and recalculated preview.", "A secure update and return flow."],
            ["Create edit-sale.html.", "Create edit-sale.js.", "Replace the complete details files returned by AI.", "Replace styles.css."],
            ["Open Edit from one sale.", "Change quantity and unit price.", "Save and confirm the details page shows the new generated total.", "Refresh and confirm the change remains."],
            ["All current values are prefilled.", "Only allowed fields are updated.", "The generated total changes correctly."],
            ["Sending user_id in the update object.", "Allowing edits before the existing row loads.", "Calculating a preview but not validating the number inputs."],
            "The page first reads the protected row, then sends only allowed changes. The database recalculates total_amount and the UPDATE policy verifies ownership.",
            "Which fields are deliberately missing from the update object, and why?",
            ["How to prefill an edit form.", "How to update only allowed fields.", "How generated totals respond to changes."],
        ),
        lesson(
            2,
            "TESTING SALE EDITING",
            "30–40 Minutes",
            "A complete test of valid edits, invalid edits, totals, refresh and ownership.",
            "Editing touches existing business data, so it deserves careful tests before the feature is trusted.",
            ["Editing works for one normal test.", "You have two test accounts.", "Your Error Log is ready."],
            standard_prompt(
                "Write a complete beginner-friendly test plan for sale editing.",
                [
                    "Test every editable field.",
                    "Test quantity and unit-price changes and the generated total.",
                    "Test blank required fields, quantity zero and a negative price.",
                    "Test missing and unknown ids.",
                    "Test refresh after saving.",
                    "Prove Account B cannot edit Account A's sale.",
                    "Include expected results and a console check.",
                ],
                ["One complete test plan"],
            ),
            ["Valid and invalid edit tests.", "A total recalculation test.", "A two-account security test."],
            ["Save the plan in your project notes."],
            ["Complete every test.", "Check the database row after important changes.", "Repeat failed tests after fixing them."],
            ["Valid edits persist.", "Invalid edits do not damage the row.", "Cross-account editing fails."],
            ["Testing only one field.", "Not checking the database-generated total.", "Using a record that both test accounts can legitimately access."],
            "A secure failure may appear as no accessible row or no updated row. The important result is that another account's data remains unchanged.",
            "Which test proves that changing quantity updates the saved total rather than only the preview?",
            ["How to test existing-data changes.", "How to check generated totals after edits.", "How to confirm update privacy."],
        ),
    ]
    return chapter(
        8,
        "EDITING SALES",
        """A saved sale may contain a typing mistake or need a correction.

You will build one focused edit page. It will reuse familiar form rules, protect the row with RLS and allow the database to calculate the revised total.""",
        ["A protected Edit Sale page", "Prefilled sale information", "Live revised totals", "Secure saving and ownership tests"],
        lessons,
        "You built and tested secure sale editing. The owner can correct useful fields without changing the identity or ownership of the record.",
        ["Existing values load correctly.", "Valid changes persist.", "Invalid changes are refused.", "Another account cannot edit the sale."],
        "The application can create, view, find and edit sales. Next, you will add careful permanent deletion.",
    )


def build_chapter_9() -> str:
    lessons = [
        lesson(
            1,
            "BUILDING SECURE SALE DELETION",
            "40–50 Minutes",
            "A clear confirmation flow that permanently deletes one owned sale.",
            "Deletion is useful for duplicate or unwanted records, but it must be deliberate and protected.",
            ["The DELETE policy exists.", "Sale Details loads the correct record.", "You created a temporary record for deletion testing."],
            standard_prompt(
                "Add complete secure deletion to the Sale Details page.",
                [
                    "Use the current sale id.",
                    "Show a clear confirmation that includes the item name and says the action cannot be undone.",
                    "Do nothing when the user cancels.",
                    "Disable the delete control while the request runs.",
                    "Delete by id and rely on the RLS ownership policy.",
                    "Show a clear error if deletion fails.",
                    "After success, go to sales.html with a simple deleted-successfully message.",
                    "Show that message on Sales History and then remove it from the URL without reloading.",
                    "Keep all view and edit features working.",
                ],
                ["sale-details.html", "sale-details.js", "sales.html", "sales.js", "styles.css"],
            ),
            ["A deliberate confirmation.", "A secure delete request.", "A success return to Sales History."],
            ["Replace the complete details files.", "Replace the complete history files.", "Replace styles.css."],
            ["Open a temporary sale and choose Delete.", "Cancel once and confirm the row remains.", "Confirm again and verify the row is removed.", "Check that the history success message appears."],
            ["Cancellation changes nothing.", "Confirmation deletes exactly one owned sale.", "Statistics change after returning to the dashboard."],
            ["Using a vague confirmation message.", "Deleting before the user confirms.", "Leaving the button active during the request."],
            "The browser asks for a deliberate decision, then sends one DELETE request. RLS checks the row owner before PostgreSQL removes anything.",
            "Where does the code stop when the user cancels the confirmation?",
            ["How to build a safe delete flow.", "How RLS protects deletion.", "How to return clear feedback after deletion."],
        ),
        lesson(
            2,
            "TESTING SALE DELETION",
            "30–40 Minutes",
            "A complete deletion test covering cancellation, confirmation, totals, missing records and privacy.",
            "Because deletion cannot be undone, the feature must behave correctly in both success and failure cases.",
            ["Secure deletion is implemented.", "You have disposable test sales.", "You have two verified accounts."],
            standard_prompt(
                "Write a complete beginner-friendly test plan for sale deletion.",
                [
                    "Use only disposable test sales.",
                    "Test cancelling the confirmation.",
                    "Test confirming deletion.",
                    "Confirm the deleted sale disappears from history, details and dashboard totals.",
                    "Test refreshing the old details URL.",
                    "Prove Account B cannot delete Account A's sale.",
                    "Include expected results and an unexpected-error check.",
                ],
                ["One complete test plan"],
            ),
            ["Safe disposable test preparation.", "Success and cancellation tests.", "A two-account privacy test."],
            ["Save the test plan in your project notes."],
            ["Complete every test with temporary data.", "Confirm database rows directly when needed.", "Record and fix unexpected results."],
            ["Cancel keeps the row.", "Confirm removes only the selected row.", "Cross-account deletion fails.", "Dashboard totals update correctly."],
            ["Deleting an important record.", "Checking only the screen and not the database.", "Forgetting to retest totals after deletion."],
            "Deletion affects every screen that used the record. A complete test checks the database, history, details and summary figures.",
            "Which screens should change after a sale is deleted, and what should each one show?",
            ["How to test permanent actions safely.", "How deletion affects connected features.", "How to prove delete ownership."],
        ),
    ]
    return chapter(
        9,
        "DELETING SALES",
        """The final record-management capability is deletion.

You will make the decision clear, give the user a chance to cancel and rely on Row Level Security to protect ownership. Use temporary records while testing this chapter.""",
        ["A clear delete confirmation", "A protected delete request", "Success feedback", "Connected-screen and two-account tests"],
        lessons,
        "You added deliberate, secure deletion and confirmed that related lists and statistics respond correctly.",
        ["Cancelling keeps the sale.", "Confirming removes one selected sale.", "Only the owner can delete.", "Related figures update correctly."],
        "Every required sales capability is now present. The final chapter brings the complete journey together and prepares the application for sharing.",
    )


def build_chapter_10() -> str:
    final_lesson = lesson(
        1,
        "COMPLETE SYSTEM TESTING",
        "60–90 Minutes",
        "One end-to-end test of the complete Sales Tracker on its deployed HTTPS website.",
        "Separate features may work on their own and still fail when used as one complete journey.",
        ["Every chapter milestone is complete.", "Your latest project folder is backed up.", "You have two verified test accounts."],
        standard_prompt(
            "Create one complete final test plan for my beginner Sales Tracker.",
            [
                "Test registration, email verification, login, protected pages and logout on the deployed HTTPS Netlify website.",
                "Test recording sales and generated totals.",
                "Test daily, monthly and all-time dashboard statistics.",
                "Test history, details, search, filters and sorting.",
                "Test editing and deletion.",
                "Test empty, loading, error and mobile states.",
                "Use two accounts to test read, insert, update and delete ownership.",
                "Include expected results and a final browser-console check.",
            ],
            ["One complete end-to-end test plan"],
        ),
        ["A complete ordered test journey.", "Expected results for every major capability.", "A final security and responsive review."],
        ["Save the final test plan in your project notes.", "Save every complete current project file."],
        [
            "Complete the full journey with a new verified account.",
            "Repeat the ownership tests with a second account.",
            "Fix and repeat every failed test.",
            "Confirm there are no unexplained console errors.",
        ],
        ["Every required capability works together.", "Saved data survives refresh and sign-in.", "Cross-account access fails.", "The application works on a small screen."],
        ["Testing only with an old browser session.", "Skipping expected failure tests.", "Publishing a change without repeating the affected tests."],
        "End-to-end testing follows the same path a real user will follow. It checks the connections between authentication, database security, screens and business calculations.",
        "Which three tests would you repeat first after changing the sales table?",
        ["How to test a complete application.", "How to combine business and security checks.", "How to decide whether the project is ready to share."],
    )
    core = chapter(
        10,
        "FINAL APPLICATION REVIEW",
        """You have built every major part of the Sales Tracker.

This chapter is about confidence. You will test the complete journey, publish the latest version and prepare a simple description for your portfolio.""",
        ["One end-to-end test", "A final security review", "A live deployment check", "A portfolio description and reflection"],
        [final_lesson],
        "You completed the final application review. The Sales Tracker now supports secure sales recording, reporting, discovery, editing and deletion.",
        ["The complete live journey works.", "Daily and monthly figures are correct.", "Two-account privacy tests pass.", "No unexplained browser errors remain."],
        "Complete the final sections below before marking Workbook 06 as finished.",
    )
    return core + f"""
FINAL TESTING
{SEP}

Create a completely new user account on the deployed HTTPS website.

Complete this journey:

{checks([
    "Register and verify the email address.",
    "Sign in and confirm the empty states.",
    "Record sales on today, an earlier date this month and an earlier month.",
    "Check each generated total.",
    "Check today's, this month's and all-time dashboard totals.",
    "Open Sales History and one Sale Details page.",
    "Search, filter and sort the records.",
    "Edit one sale and confirm its revised total.",
    "Cancel one deletion, then delete a disposable sale.",
    "Refresh the website and confirm the remaining data still exists.",
    "Sign out and confirm protected pages redirect to login.",
    "Use a second account and confirm that the first account's sales remain private.",
])}

If a step fails, write the result in the Error Log, fix the problem and repeat the test.

{SEP}

GOING LIVE
{SEP}

Your Sales Tracker is ready for its final deployment.

{numbered([
    "Save every complete project file.",
    "Make one final backup of the complete project folder.",
    "Open https://app.netlify.com/drop.",
    "Drag the complete Sales Tracker folder into the deployment area. If you already created the Netlify website during authentication testing, deploy the updated folder to that same website.",
    "Wait for deployment to finish and open the HTTPS website supplied by Netlify.",
    "Confirm that the Supabase Site URL and Redirect URLs use that exact HTTPS address.",
    "Repeat registration, sales recording, reports, history, search, editing, deletion and two-account privacy tests on the live website.",
])}

Only share the application after every important live test succeeds.

{SEP}

PORTFOLIO DESCRIPTION
{SEP}

Sales Tracker

I built a complete browser-based Sales Tracker using HTML, CSS, Vanilla JavaScript and Supabase.

The application allows authenticated users to record sales, calculate totals, monitor daily and monthly performance, search and filter sales, open individual records, edit sales and delete unwanted records.

I used Supabase Authentication and Row Level Security so each user can access only their own sales.

I also tested responsive design, database validation, generated totals and two-account privacy.

{SEP}

REFLECTION QUESTIONS
{SEP}

1.

Which part of the Sales Tracker are you most proud of?

2.

How does the database-generated total protect accuracy?

3.

What is the difference between today's total and this month's total?

4.

How does Row Level Security protect sales records?

5.

Which test helped you find the most useful problem?

6.

What would you improve before giving this application to a real business?

{SEP}

EXTENSION CHALLENGES
{SEP}

Complete these only after the main application works correctly.

• Add a best-selling categories summary.

• Add an export-to-CSV feature for the signed-in user's filtered sales.

• Add a simple printable monthly sales report.

• Add a setting for the business's preferred currency symbol.

• Add pagination when the sales history becomes long.

Ask AI for complete updated files, make a backup first and repeat the affected security and calculation tests after every extension.

{SEP}

NEXT WORKBOOK
{SEP}

Excellent work.

You have completed Workbook 06 of the Prompt to Profit™ Software Workbook Series.

You have built software that allows a business to record, review, search, edit and delete sales while monitoring daily and monthly totals.

The next project in the series is Workbook 07 — Supplier Management System.

For now, review what you have built and make sure every important feature works correctly.

Congratulations once again on completing your Sales Tracker.
"""


def transform_standard_opening(note: str) -> str:
    chapter4 = re.search(r"(?m)^CHAPTER 4\s*$", note)
    if not chapter4:
        raise RuntimeError("Could not locate Chapter 4 in the template")
    note = note[: chapter4.start()]
    replacements = (
        ("PROMPT TO PROFIT™ WORKBOOK 05", "PROMPT TO PROFIT™ WORKBOOK 06"),
        ("Workbook 05", "Workbook 06"),
        ("WORKBOOK 05", "WORKBOOK 06"),
        ("APPOINTMENT BOOKING SYSTEM", "SALES TRACKER"),
        ("Appointment Booking System", "Sales Tracker"),
        ("appointment-booking-system", "sales-tracker"),
        ("APPOINTMENT-DETAILS", "SALE-DETAILS"),
        ("Appointment Schedule", "Sales History"),
        ("appointment schedule", "sales history"),
        ("Appointments", "Sales"),
        ("appointments", "sales"),
        ("Appointment", "Sale"),
        ("appointment", "sale"),
        ("booking", "sales recording"),
        ("Booking", "Sales Recording"),
        ("book a sale", "record a sale"),
        ("Book a sale", "Record a sale"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    note = note.replace("Workbook 06 — Sales Tracker", "Workbook 07 — Supplier Management System")
    return note.rstrip() + "\n\n"


def replace_opening_project_sections(note: str) -> str:
    overview = """By the end of this workbook, your Sales Tracker will include:

• A clear public website

• User registration and login

• A protected sales dashboard

• A form for recording sales

• Automatically calculated totals

• Daily, monthly and all-time sales statistics

• A complete Sales History page

• Sale Details and editing

• Search, filters and sorting

• Secure deletion

• Supabase Row Level Security

• A live HTTPS deployment"""
    note, count = re.subn(
        rf"(?ms)^WHAT YOU WILL BUILD\s*\n{re.escape(SEP)}\n.*?(?=^WORKBOOK STRUCTURE\s*$)",
        f"WHAT YOU WILL BUILD\n{SEP}\n\n{overview}\n\n{SEP}\n\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace opening project overview")
    chapter1_intro = """Every useful business application begins with a clear purpose.

A Sales Tracker helps a business record what it sells and understand its daily and monthly activity.

Before building the private sales area, you will create a simple public website that explains the problem and introduces the solution.

This chapter begins gently. You will create the project folder, build the landing page, style it and add responsive navigation.

You will continue using only HTML, CSS, Vanilla JavaScript, Notepad and a web browser."""
    note, count = re.subn(
        rf"(?ms)(^CHAPTER 1\s*$.*?^CHAPTER INTRODUCTION\s*\n{re.escape(SEP)}\n).*?(?=^{re.escape(SEP)}\nWHAT YOU WILL BUILD IN THIS CHAPTER)",
        rf"\1\n{chapter1_intro}\n\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace Chapter 1 introduction")
    return note


def polish_standard_opening(note: str) -> str:
    lesson_one_start = note.index(
        "LESSON 1\n\nUNDERSTANDING THE SALES TRACKER"
    )
    lesson_two_chapter = note.index(
        "CHAPTER 1\n\nBUILDING THE PUBLIC WEBSITE", lesson_one_start + 1
    )
    lesson_one = lesson(
        1,
        "UNDERSTANDING THE SALES TRACKER",
        "10–15 Minutes",
        "A clear plan for the Sales Tracker and a separate folder for the new project.",
        "Understanding the business problem first will help every later page, prompt and test make sense.",
        [
            "You have a computer with Notepad and a web browser.",
            "You are ready to keep this project separate from any other workbook.",
            "You understand that no code is required in this first lesson.",
        ],
        """There is nothing to generate with AI in this lesson.

Create a new empty folder named:

Sales Tracker

Then read the project plan below and make sure you understand it.

The application will allow a signed-in business user to record a sale with a date, item name, category, quantity, unit price, payment method, optional customer name and optional notes.

It will calculate totals, show daily and monthly figures, display sales history, find records, edit records and delete unwanted records.

Each account will see only its own sales.""",
        [
            "Nothing in this lesson.",
            "This lesson prepares you and your project folder for the build.",
        ],
        ["Create and save the empty Sales Tracker project folder."],
        [
            "Open the folder and confirm it is empty.",
            "Explain in your own words what one saved sale will contain.",
            "List the seven main capabilities you will build.",
        ],
        [
            "The folder is named Sales Tracker.",
            "The folder contains no files from another project.",
            "You understand that each user will have private sales.",
        ],
        [
            "Placing files from several projects in one folder.",
            "Starting with code before understanding the project.",
            "Thinking that a sale total should be typed instead of calculated.",
        ],
        "The public website, authentication, sales database, dashboard and record-management pages will be built in a careful order. Each part will connect to the parts completed before it.",
        "Which two saved numbers will the application use to calculate the total for one sale?",
        [
            "What the Sales Tracker will do.",
            "What information one sale will contain.",
            "Why the project needs its own folder.",
            "Why every user's sales must remain private.",
        ],
    )
    note = note[:lesson_one_start] + lesson_one + "\n\n" + note[lesson_two_chapter:]
    replacements = (
        ("If your immediate need is to build an Sales Tracker", "If your immediate need is to build a Sales Tracker"),
        ("a professional sale management application", "a professional sales management application"),
        ("manage sale information securely", "record sales securely"),
        ("Building the Sale Database", "Building the Sales Database"),
        ("Building the Sale Dashboard", "Building the Sales Dashboard"),
        ("Building the Sale Details Page", "Searching, Filtering and Sorting Sales"),
        ("Editing and Deleting Sale Records", "Editing Sales"),
        ("Making Sale Management More Powerful", "Deleting Sales"),
        ("• A sample schedule preview", "• A sample sales dashboard preview"),
        ("an sale management preview", "a sales dashboard preview"),
        ("• Upcoming Sales\n\n• Cancelled Sales", "• Today's Sales\n\n• This Month's Sales"),
        ("sale information is scattered across", "sales information is scattered across"),
        ("• Phone contacts\n\n", ""),
        ("• Employees' personal devices", "• Loose paper records"),
        ("• Lost sale details", "• Missing sales records"),
        ("• Duplicate records", "• Incorrect totals"),
        ("• Missed follow-ups", "• Slow monthly reporting"),
        ("• Slow service", "• Difficulty checking daily performance"),
        ("• Difficulty understanding sale activity", "• Difficulty understanding sales performance"),
        ("1. Secure Sale Records\n\n2. Overlap Protection\n\n3. Sale Details Cards\n\n4. Click-to-Call\n\n5. Click-to-Email\n\n6. Search, Filters and Sorting", "1. Secure Sales Records\n\n2. Automatic Sale Totals\n\n3. Daily and Monthly Statistics\n\n4. Sales History and Details\n\n5. Secure Editing and Deletion\n\n6. Search, Filters and Sorting"),
        ("2. Book Sale Details\n\n3. Manage Sale Records\n\n4. Find and Contact Sales Quickly", "2. Record a Sale\n\n3. View Sales Performance\n\n4. Find and Manage Sales"),
        ("• Customer initials\n\n• Customer name\n\n• Service\n\n• Service\n\n• Phone\n\n• Email\n\n• View Sale button", "• Sale date\n\n• Item name\n\n• Category\n\n• Quantity\n\n• Total amount\n\n• Payment method\n\n• View Sale button"),
        ("Do not book sale management code.", "Do not add sales management code."),
        ("• Cancels sales", "• Deletes sales"),
        ("Total Sales\n\nToday's Sales\n\nUpcoming Sales\n\nCancelled Sales", "Today's Sales Total\n\nToday's Sale Count\n\nThis Month's Sales Total\n\nAll-Time Sales Total"),
        ("Cancel the existing contents.", "Delete the existing contents."),
        ("an Sales Tracker", "a Sales Tracker"),
        ("an sale search area", "a sales search area"),
        ("An sale search area", "A sales search area"),
        ("opens an sale details", "opens a sale"),
        ("PROTECTED APPOINTMENT PAGE", "PROTECTED SALE PAGE"),
        ("sale management", "sales management"),
        ("organise sale information", "organise sales information"),
        ("• Client initials\n\n• Client name\n\n• Service\n\n• Service\n\n• Phone\n\n• Email\n\n• View Sale button", "• Sale date\n\n• Item name\n\n• Category\n\n• Quantity\n\n• Total amount\n\n• Payment method\n\n• View Sale button"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def audit(note: str) -> None:
    required = (
        "PROMPT TO PROFIT™ WORKBOOK 06",
        "SALES TRACKER",
        "LEARNER SUPPORT TOOLKIT",
        "sales",
        "sale_date",
        "total_amount",
        "Row Level Security",
        "emailRedirectTo",
        "CODE-READING QUESTION",
        "PORTFOLIO DESCRIPTION",
        "Workbook 07 — Supplier Management System",
    )
    for value in required:
        if value not in note:
            raise RuntimeError(f"Workbook 06 is missing required content: {value}")
    forbidden = (
        "Appointment Booking System",
        "appointments",
        "appointment",
        "starts_at",
        "ends_at",
        "cancel_appointment",
        "Customer Record Management System",
        "Expense Tracker",
        "Professional Quotation Generator",
        "Professional Invoice Generator",
        "Workbook 01",
        "Workbook 02",
        "Workbook 03",
        "Workbook 04",
        "Workbook 05",
        "VS Code",
        "React",
        "Node.js",
    )
    for value in forbidden:
        if value in note:
            raise RuntimeError(f"Workbook 06 contains forbidden text: {value}")
    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook 06 must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") != 36:
        raise RuntimeError("Workbook 06 must contain 36 complete lessons")
    for heading in (
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        "BEFORE YOU CONTINUE",
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        "SAVE YOUR FILES",
        "TEST YOUR WORK",
        "CHECKPOINT",
        "COMMON BEGINNER MISTAKES",
        "BEHIND THE SCENES",
        "THINK LIKE A SOFTWARE DESIGNER",
        "WHAT YOU LEARNED",
    ):
        count = len(re.findall(rf"(?m)^{re.escape(heading)}$", note))
        if count != 36:
            raise RuntimeError(f"Locked lesson heading count is wrong for {heading}: {count}")
    if note.count("CODE-READING QUESTION") < 15:
        raise RuntimeError("Major code capabilities need code-reading questions")


def make_note() -> str:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    opening = transform_standard_opening(payload["note"])
    opening = replace_opening_project_sections(opening)
    opening = polish_standard_opening(opening)
    note = (
        opening
        + build_chapter_4()
        + "\n"
        + build_chapter_5()
        + "\n"
        + build_chapter_6()
        + "\n"
        + build_chapter_7()
        + "\n"
        + build_chapter_8()
        + "\n"
        + build_chapter_9()
        + "\n"
        + build_chapter_10()
    )
    note = re.sub(r"\n{4,}", "\n\n\n", note).strip() + "\n"
    audit(note)
    return note


def main() -> None:
    note = make_note()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    payload = {"bgColorIndex": 0, "note": note, "textColorIndex": 0}
    OUTPUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT}")
    print(f"Words: {len(note.split()):,}")
    print(f"Lessons: {note.count('COMMON BEGINNER MISTAKES')}")


if __name__ == "__main__":
    main()
