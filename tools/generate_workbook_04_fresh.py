#!/usr/bin/env python3
"""Generate Workbook 04 from the locked series standard and invoice requirements."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_learner_support_standard import apply_standard as apply_learner_support


SOURCE = Path(
    "deliverables/professional-quotation-generator-workbook/"
    "3 - Professional Quotation Generator.notepad"
)
OUTPUT = Path(
    "deliverables/professional-invoice-generator-workbook/"
    "4 - Professional Invoice Generator.notepad"
)
SEP = "=" * 50


def chapter_range(note: str, chapter: int) -> tuple[int, int]:
    start_match = re.search(rf"(?m)^CHAPTER {chapter}\s*$", note)
    if not start_match:
        raise RuntimeError(f"Could not find Chapter {chapter}")
    next_match = re.search(
        rf"(?m)^CHAPTER {chapter + 1}\s*$", note[start_match.end():]
    )
    end = (
        start_match.end() + next_match.start()
        if next_match
        else len(note)
    )
    return start_match.start(), end


def lesson_range(note: str, chapter: int, lesson: int) -> tuple[int, int]:
    chapter_start, chapter_end = chapter_range(note, chapter)
    chapter_text = note[chapter_start:chapter_end]
    match = re.search(rf"(?m)^LESSON {lesson}\s*$", chapter_text)
    if not match:
        raise RuntimeError(f"Could not find Chapter {chapter}, Lesson {lesson}")
    start = chapter_start + match.start()
    next_match = re.search(
        r"(?m)^LESSON \d+\s*$", chapter_text[match.end():]
    )
    end = (
        chapter_start + match.end() + next_match.start()
        if next_match
        else chapter_end
    )
    return start, end


def replace_lesson_section(
    note: str,
    chapter: int,
    lesson: int,
    title: str,
    next_title: str,
    body: str,
) -> str:
    start, end = lesson_range(note, chapter, lesson)
    lesson = note[start:end]
    pattern = (
        rf"(?m)^{re.escape(title)}\s*$\n(?:{re.escape(SEP)}\n)?"
        rf"[\s\S]*?(?=^{re.escape(next_title)}\s*$)"
    )
    replacement = f"{title}\n{SEP}\n\n{body.strip()}\n\n{SEP}\n"
    updated, count = re.subn(pattern, replacement, lesson, count=1)
    if count != 1:
        raise RuntimeError(
            f"Could not replace {title} in Chapter {chapter}, Lesson {lesson}"
        )
    return note[:start] + updated + note[end:]


def replace_lesson_title(
    note: str, chapter: int, lesson: int, new_title: str
) -> str:
    start, end = lesson_range(note, chapter, lesson)
    lesson_text = note[start:end]
    lesson_match = re.search(rf"(?m)^LESSON {lesson}\s*$", lesson_text)
    assert lesson_match
    after = lesson_text[lesson_match.end():]
    title_match = re.search(r"\S.*", after)
    if not title_match:
        raise RuntimeError("Lesson title is missing")
    title_start = lesson_match.end() + title_match.start()
    title_end = lesson_match.end() + title_match.end()
    lesson_text = (
        lesson_text[:title_start] + new_title + lesson_text[title_end:]
    )
    return note[:start] + lesson_text + note[end:]


def replace_chapter_section(
    note: str,
    chapter: int,
    title: str,
    next_title: str,
    body: str,
) -> str:
    start, end = chapter_range(note, chapter)
    chapter_text = note[start:end]
    pattern = (
        rf"(?m)^{re.escape(title)}\s*$\n(?:{re.escape(SEP)}\n)?"
        rf"[\s\S]*?(?=^{re.escape(next_title)}\s*$)"
    )
    replacement = f"{title}\n{SEP}\n\n{body.strip()}\n\n{SEP}\n"
    chapter_text, count = re.subn(pattern, replacement, chapter_text, count=1)
    if count != 1:
        raise RuntimeError(
            f"Could not replace {title} in Chapter {chapter}"
        )
    return note[:start] + chapter_text + note[end:]


def replace_chapter_tail(
    note: str, chapter: int, title: str, body: str
) -> str:
    start, end = chapter_range(note, chapter)
    chapter_text = note[start:end]
    pattern = (
        rf"(?m)^{re.escape(title)}\s*$\n(?:{re.escape(SEP)}\n)?[\s\S]*$"
    )
    replacement = f"{title}\n{SEP}\n\n{body.strip()}\n\n{SEP}\n"
    chapter_text, count = re.subn(pattern, replacement, chapter_text, count=1)
    if count != 1:
        raise RuntimeError(
            f"Could not replace final section {title} in Chapter {chapter}"
        )
    return note[:start] + chapter_text + note[end:]


def insert_lesson(note: str, chapter: int, number: int, lesson: str) -> str:
    start, end = chapter_range(note, chapter)
    chapter_text = note[start:end]

    def increment(match: re.Match[str]) -> str:
        value = int(match.group(1))
        suffix = match.group(2) or ""
        return (
            f"LESSON {value + 1}{suffix}"
            if value >= number
            else match.group(0)
        )

    chapter_text = re.sub(
        r"(?m)^LESSON (\d+)(\s+\(CONTINUED\))?\s*$",
        increment,
        chapter_text,
    )
    target_lesson = re.search(
        rf"(?m)^LESSON {number + 1}\s*$", chapter_text
    )
    if not target_lesson:
        raise RuntimeError(
            f"Could not locate insertion point for Chapter {chapter}, Lesson {number}"
        )
    marker = chapter_text.rfind(
        f"CHAPTER {chapter}", 0, target_lesson.start()
    )
    separator = chapter_text.rfind(f"{SEP}\n", 0, marker)
    insertion = separator if separator >= 0 else marker
    chapter_text = (
        chapter_text[:insertion]
        + lesson.strip()
        + "\n\n"
        + chapter_text[insertion:]
    )
    return note[:start] + chapter_text + note[end:]


def transform_project(note: str) -> str:
    replacements = (
        ("PROMPT TO PROFIT™ WORKBOOK 03", "PROMPT TO PROFIT™ WORKBOOK 04"),
        ("Workbook 03", "Workbook 04"),
        ("WORKBOOK 03", "WORKBOOK 04"),
        ("PROFESSIONAL QUOTATION GENERATOR", "PROFESSIONAL INVOICE GENERATOR"),
        ("Professional Quotation Generator", "Professional Invoice Generator"),
        ("quotation-profile.html", "invoice-details.html"),
        ("quotation-profile.js", "invoice-details.js"),
        ("Quotation Details", "Invoice Details"),
        ("QUOTATION DETAILS", "INVOICE DETAILS"),
        ("quotation details", "invoice details"),
        ("Quotation History", "Invoice History"),
        ("QUOTATION HISTORY", "INVOICE HISTORY"),
        ("quotation history", "invoice history"),
        ("quotation_items", "invoice_items"),
        ("QUOTATION_ITEMS", "INVOICE_ITEMS"),
        ("quotation_id", "invoice_id"),
        ("quotation_number", "invoice_number"),
        ("Quotation Number", "Invoice Number"),
        ("quotation number", "invoice number"),
        ("Quotations", "Invoices"),
        ("QUOTATIONS", "INVOICES"),
        ("quotations", "invoices"),
        ("Quotation", "Invoice"),
        ("QUOTATION", "INVOICE"),
        ("quotation", "invoice"),
        ("expiry_date", "due_date"),
        ("Expiry Date", "Due Date"),
        ("expiry date", "due date"),
        ("Accepted Invoices", "Paid Invoices"),
        ("accepted invoices", "paid invoices"),
        ("Accepted", "Paid"),
        ("accepted", "paid"),
        ("save_invoice_with_items", "save_invoice_with_items"),
        ("save-invoice-function.sql", "save-invoice-function.sql"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


CUSTOMER_TABLE_LESSON = f"""
{SEP}
CHAPTER 4

BUILDING THE INVOICE DATABASE
{SEP}

LESSON 2

CREATING THE CUSTOMERS TABLE
{SEP}

Estimated Time

30 minutes

{SEP}
WHAT YOU ARE BUILDING
{SEP}

In this lesson, you will create the table that stores customers.

The invoice form will later load these saved customers into a simple selection list.

Every customer will belong to the user who created that customer.

{SEP}
WHY THIS MATTERS
{SEP}

Businesses often create several invoices for the same customer.

Saving the customer once prevents the business from typing the same name, email address, phone number and address every time.

It also makes the invoice process faster and reduces typing mistakes.

{SEP}
BEFORE YOU CONTINUE
{SEP}

Confirm that:

✓ Your Supabase project is open.

✓ Authentication works on the deployed HTTPS website.

✓ You understand why this application needs three related tables.

{SEP}
BUILD PROMPT
{SEP}

There is nothing to build with ChatGPT in this lesson.

Create the customers table directly inside Supabase.

Open:

Table Editor

Click:

Create a new table

Name the table:

customers

Leave Row Level Security enabled.

Create these columns:

• id — uuid — Primary Key — default value gen_random_uuid()

• user_id — uuid — required

• customer_name — text — required

• company_name — text — optional

• email — text — optional

• phone — text — optional

• billing_address — text — optional

• created_at — timestamp with time zone — required — default value now()

• updated_at — timestamp with time zone — required — default value now()

Review every column.

Then click:

Save

Do not add invoice totals or invoice items to this table.

This table stores reusable customer information only.

{SEP}
WHAT AI SHOULD RETURN
{SEP}

Nothing.

This lesson is completed inside Supabase.

{SEP}
SAVE YOUR FILES
{SEP}

No project files are created during this lesson.

{SEP}
TEST YOUR WORK
{SEP}

Open:

customers

inside the Table Editor.

Confirm that:

✓ id is the Primary Key.

✓ user_id exists and is required.

✓ customer_name exists and is required.

✓ company_name, email, phone and billing_address are optional.

✓ created_at and updated_at exist.

✓ Row Level Security remains enabled.

Do not add a customer row manually.

The application will add customers after the correct security policies exist.

{SEP}
CHECKPOINT
{SEP}

Before moving on, confirm that:

✓ The customers table exists.

✓ Every column has the correct type.

✓ Row Level Security remains enabled.

{SEP}
COMMON BEGINNER MISTAKES
{SEP}

A common mistake is making every contact field required.

A business may know a customer's phone number without knowing the email address.

Only the customer name is required in this workbook.

Another mistake is putting invoice information inside the customers table.

Customer information and invoice information have different jobs and must remain separate.

{SEP}
BEHIND THE SCENES
{SEP}

The customers table stores the current reusable customer profile.

Each saved invoice will also keep a copy of the customer details used when that invoice was created.

This means an old invoice does not change when the customer profile is updated later.

{SEP}
THINK LIKE A SOFTWARE DESIGNER
{SEP}

Business documents should preserve their history.

A customer profile may change, but a saved invoice should continue showing the information that was used when the invoice was issued.

{SEP}
WHAT YOU LEARNED
{SEP}

In this lesson you learned how to:

• create a reusable customers table

• keep customer and invoice information separate

• prepare the application for customer selection

• preserve invoice history
"""


CUSTOMER_SELECTION_LESSON = f"""
{SEP}
CHAPTER 5

BUILDING THE INVOICE WORKSPACE
{SEP}

LESSON 2

SAVING AND SELECTING CUSTOMERS
{SEP}

Estimated Time

50 minutes

{SEP}
WHAT YOU ARE BUILDING
{SEP}

In this lesson, you will add a simple customer area to the dashboard.

The user will be able to save a customer and select that customer while preparing an invoice.

{SEP}
WHY THIS MATTERS
{SEP}

Typing the same customer details into every invoice wastes time.

A saved customer list makes invoice creation faster and keeps customer information consistent.

{SEP}
BEFORE YOU CONTINUE
{SEP}

Confirm that:

✓ The customers table exists.

✓ Customer Row Level Security policies exist.

✓ The dashboard is protected.

✓ Your latest project folder is backed up.

{SEP}
BUILD PROMPT
{SEP}

PROJECT STATE

I already have a working Professional Invoice Generator.

Registration, login, logout and dashboard protection work.

The customers, invoices and invoice_items tables already exist.

Row Level Security and authenticated ownership policies are enabled.

Everything already built must continue working.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build one complete customer-saving and customer-selection capability.

DASHBOARD.HTML

Keep every existing dashboard section.

Add a customer area containing:

• Customer name

• Company name

• Email

• Phone

• Billing address

• Save Customer button

• Friendly status message

Add a Select Customer field to the invoice form.

Add a small customer preview below the selection field.

The preview should display the selected customer's saved information.

DASHBOARD.JS

Keep authentication, logout and dashboard protection working.

After authentication succeeds:

• Load only customers available to the signed-in user

• Order customers by customer_name

• Populate the Select Customer field

• Show a friendly empty state when no customer exists

When Save Customer is selected:

• Validate customer_name

• Trim all text values

• Convert email to lowercase

• Confirm that the user is authenticated

• Insert the customer using the current user's ID

• Disable the button while saving

• Display friendly success and error messages

• Clear the customer form only after a successful save

• Reload the customer selection list

When a customer is selected:

• Store the selected customer ID

• Display the customer preview

• Do not allow a customer belonging to another user to be selected

Do not create another Supabase client.

Do not use the browser's local storage as the customer database.

AUTH.CSS

Keep every existing style.

Style the customer form, selection field, preview, empty state and messages.

Keep the complete area readable on small screens.

IMPORTANT

Return all three complete updated files.

Do not return snippets.

Do not remove any working feature.

{SEP}
WHAT AI SHOULD RETURN
{SEP}

ChatGPT should return three complete updated files:

• dashboard.html

• dashboard.js

• auth.css

The dashboard should now save customers securely and allow the signed-in user to select a saved customer.

{SEP}
SAVE YOUR FILES
{SEP}

Replace the complete contents of:

dashboard.html

dashboard.js

auth.css

Use the backup instructions before replacing the files.

Save every file using its exact filename.

{SEP}
TEST YOUR WORK
{SEP}

Open the deployed HTTPS website.

Sign in.

Open the dashboard.

Confirm that the customer form and Select Customer field appear.

Try to save the form without a customer name.

A friendly validation message should appear.

Now save one customer.

Confirm that:

✓ The Save Customer button is disabled while saving.

✓ A success message appears.

✓ The customer form clears.

✓ The new customer appears in Select Customer.

Select the customer.

Confirm that the saved customer details appear in the preview.

Refresh the page.

Confirm that the customer remains available.

Open the customers table in Supabase.

Confirm that the saved row contains the authenticated user's ID.

{SEP}
CHECKPOINT
{SEP}

Before moving on, confirm that:

✓ Customers save successfully.

✓ The selection list loads successfully.

✓ The customer preview works.

✓ Friendly loading, empty and error states appear.

{SEP}
COMMON BEGINNER MISTAKES
{SEP}

A common mistake is loading customers before authentication has finished.

Another mistake is saving a customer without the current user's ID.

Do not remove the ownership value.

The database policies and the application query must work together.

{SEP}
BEHIND THE SCENES
{SEP}

The selection field stores a customer ID, not only a customer name.

That ID creates a reliable relationship between the customer and a future invoice.

{SEP}
THINK LIKE A SOFTWARE DESIGNER
{SEP}

Reusable information should be saved once and selected when needed.

This reduces repeated work and creates a more consistent business process.

{SEP}
WHAT YOU LEARNED
{SEP}

In this lesson you learned how to:

• save customer profiles

• load user-owned customers

• build a customer selection field

• connect a selected customer to a future invoice
"""


CONSTRAINTS_LESSON = f"""
{SEP}
CHAPTER 4

BUILDING THE INVOICE DATABASE
{SEP}

LESSON 5

ADDING DATABASE CONSTRAINTS
{SEP}

Estimated Time

30 minutes

{SEP}
WHAT YOU ARE BUILDING
{SEP}

In this lesson, you will add database rules that reject invalid invoice information.

These rules protect the database even if incorrect information reaches Supabase from outside the normal form.

{SEP}
WHY THIS MATTERS
{SEP}

Browser validation helps the user, but it is not the final security boundary.

A user can change browser code or send a request in another way.

The database must still refuse impossible dates, quantities and totals.

{SEP}
BEFORE YOU CONTINUE
{SEP}

Confirm that:

✓ customers exists.

✓ invoices exists.

✓ invoice_items exists.

✓ The table relationships are correct.

{SEP}
BUILD PROMPT
{SEP}

I have a Supabase project containing:

• customers

• invoices

• invoice_items

Return one complete SQL file named:

invoice-database-constraints.sql

Return the complete file only.

Do not return snippets.

Do not return explanations.

The SQL file must add clearly named constraints that enforce:

CUSTOMERS

• customer_name cannot be empty after spaces are removed

INVOICES

• invoice_number is unique for each user

• status must be draft, sent, paid or overdue

• discount_type must be none, percentage or fixed

• due_date cannot be earlier than issue_date

• discount_value cannot be negative

• subtotal cannot be negative

• discount_amount cannot be negative

• discount_amount cannot be greater than subtotal

• tax_rate cannot be negative

• tax_amount cannot be negative

• total cannot be negative

INVOICE_ITEMS

• description cannot be empty after spaces are removed

• quantity must be greater than zero

• unit_price cannot be negative

• line_total cannot be negative

Use ALTER TABLE statements.

Give every constraint a clear name.

Do not delete any table.

Do not remove any column.

Do not disable Row Level Security.

The file should be safe to run once on the tables described above.

{SEP}
WHAT AI SHOULD RETURN
{SEP}

ChatGPT should return one complete file:

invoice-database-constraints.sql

The file should contain all required constraints and no destructive table commands.

{SEP}
SAVE YOUR FILES
{SEP}

Open Notepad.

Paste the complete SQL returned by ChatGPT.

Save the file as:

invoice-database-constraints.sql

Use:

Save as type: All Files

Confirm that the file does not end with:

.txt

{SEP}
TEST YOUR WORK
{SEP}

Open the complete SQL file in Notepad.

Confirm that:

✓ Every constraint has a clear name.

✓ No table is deleted.

✓ No column is removed.

✓ Row Level Security is not disabled.

Copy the complete SQL.

Open:

Supabase

SQL Editor

Create a new query.

Paste the complete SQL.

Run the query once.

Confirm that it completes successfully.

Open the table information for customers, invoices and invoice_items.

Confirm that the new constraints appear.

{SEP}
CHECKPOINT
{SEP}

Before moving on, confirm that the database now rejects:

✓ Empty required names and descriptions

✓ Invalid invoice statuses

✓ Invalid discount types

✓ Due dates before issue dates

✓ Negative totals

✓ Zero or negative quantities

✓ Duplicate invoice numbers for the same user

{SEP}
COMMON BEGINNER MISTAKES
{SEP}

A common mistake is relying only on the HTML form.

The form is useful, but the database must enforce important rules too.

Another mistake is running the same constraint file repeatedly.

Run it once and confirm that the constraints exist before continuing.

{SEP}
BEHIND THE SCENES
{SEP}

Validation in the browser improves the experience.

Validation inside the save function protects the complete saving process.

Constraints protect the stored data at the database level.

Professional software uses these layers together.

{SEP}
THINK LIKE A SOFTWARE DESIGNER
{SEP}

Important business rules should be enforced as close to the data as possible.

This keeps the database trustworthy even when the application changes later.

{SEP}
WHAT YOU LEARNED
{SEP}

In this lesson you learned how to:

• add database constraints

• protect invoice data quality

• reject impossible values

• combine browser and database validation
"""


def policy_prompt(operation: str) -> str:
    operation = operation.upper()
    if operation == "SELECT":
        direct_clause = "USING"
        invoice_detail = """Use:

user_id = auth.uid()

in USING."""
        child_detail = (
            "Use an EXISTS check in USING. Confirm that invoice_items.invoice_id "
            "matches invoices.id and invoices.user_id matches auth.uid()."
        )
    elif operation == "INSERT":
        direct_clause = "WITH CHECK"
        invoice_detail = """In WITH CHECK, require both:

• invoices.user_id matches auth.uid()

• An EXISTS check confirms that invoices.customer_id belongs to a customers row whose user_id matches auth.uid()

This prevents a forged request from attaching an invoice to another user's customer."""
        child_detail = (
            "Use an EXISTS check in WITH CHECK. Confirm that the parent invoice "
            "belongs to auth.uid()."
        )
    elif operation == "UPDATE":
        direct_clause = "USING and WITH CHECK"
        invoice_detail = """In USING, require:

user_id = auth.uid()

In WITH CHECK, require both:

• invoices.user_id matches auth.uid()

• An EXISTS check confirms that invoices.customer_id belongs to a customers row whose user_id matches auth.uid()

This protects the existing invoice and any newly selected customer."""
        child_detail = (
            "Use the same parent-invoice ownership EXISTS check in both USING "
            "and WITH CHECK."
        )
    else:
        direct_clause = "USING"
        invoice_detail = """Use:

user_id = auth.uid()

in USING."""
        child_detail = (
            "Use an EXISTS check in USING. Confirm that the parent invoice "
            "belongs to auth.uid()."
        )
    return f"""There is nothing to build with ChatGPT in this lesson.

Create the {operation} policies directly inside Supabase.

Open:

Authentication

Then:

Policies

CUSTOMERS

Create a {operation} policy for:

customers

Use:

user_id = auth.uid()

in:

{direct_clause}

INVOICES

Create the matching {operation} policy for:

invoices

{invoice_detail}

INVOICE_ITEMS

Create the {operation} policy for:

invoice_items

The invoice_items table does not store a separate user_id.

{child_detail}

Review the three policies carefully.

Save every policy.

If you ask AI to prepare SQL, ask for one complete SQL file.

Do not request a snippet."""


def policy_test(operation: str) -> str:
    operation = operation.upper()
    customer_check = (
        "\n\nConfirm that the invoices policy also checks that the selected "
        "customer belongs to auth.uid()."
        if operation in {"INSERT", "UPDATE"}
        else ""
    )
    return f"""Return to the Policies page.

Confirm that:

✓ customers has a {operation} policy.

✓ invoices has a {operation} policy.

✓ invoice_items has a {operation} policy.

Confirm that the customers and invoices policies compare:

user_id

with:

auth.uid()

Confirm that the invoice_items policy checks ownership through the parent invoice.
{customer_check}

Do not continue while any policy is missing."""


def apply_invoice_architecture(note: str) -> str:
    # Chapter 4 gains one complete customer-table capability.
    note = insert_lesson(note, 4, 2, CUSTOMER_TABLE_LESSON)
    note = replace_lesson_title(
        note, 4, 1, "UNDERSTANDING THE INVOICE DATA MODEL"
    )
    note = replace_lesson_section(
        note,
        4,
        1,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """Before creating the database, you will understand how the information is organised.

The application uses three related tables.

The customers table stores reusable customer profiles.

The invoices table stores each complete invoice and a snapshot of the selected customer.

The invoice_items table stores the individual lines that belong to each invoice.

This lesson explains why all three tables are needed.""",
    )
    note = replace_lesson_section(
        note,
        4,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """There is nothing to build with ChatGPT in this lesson.

Study the database plan below.

CUSTOMERS TABLE

This table stores:

• The signed-in user's ID

• Customer name

• Company name

• Email

• Phone

• Billing address

INVOICES TABLE

This table stores:

• The signed-in user's ID

• The selected customer ID

• A unique invoice number

• Business details

• A snapshot of the selected customer details

• Issue and due dates

• Invoice status and currency

• Discount, tax and trusted totals

• Notes and dates

INVOICE_ITEMS TABLE

This table stores:

• The parent invoice ID

• Description

• Quantity

• Unit price

• Trusted line total

• Item position

One customer can be selected for several invoices.

One invoice can contain several invoice items.

Deleting an invoice should delete its invoice items.

Deleting a customer with saved invoices should not rewrite or remove those invoices.

Row Level Security will protect all three tables.""",
    )

    # The transformed original table lessons are now Lessons 3 and 4.
    invoice_table_prompt = """There is nothing to build with ChatGPT in this lesson.

Create the invoices table directly inside Supabase.

Open:

Table Editor

Create a new table named:

invoices

Leave Row Level Security enabled.

Create these columns:

• id — uuid — Primary Key — default value gen_random_uuid()

• user_id — uuid — required

• customer_id — uuid — required

• invoice_number — text — required

• business_name — text — required

• business_email — text — optional

• business_phone — text — optional

• business_address — text — optional

• customer_name — text — required

• customer_company — text — optional

• customer_email — text — optional

• customer_phone — text — optional

• customer_address — text — optional

• issue_date — date — required

• due_date — date — required

• status — text — required — default value draft

• currency — text — required — default value GBP

• discount_type — text — required — default value none

• discount_value — numeric — required — default value 0

• subtotal — numeric — required — default value 0

• discount_amount — numeric — required — default value 0

• tax_rate — numeric — required — default value 0

• tax_amount — numeric — required — default value 0

• total — numeric — required — default value 0

• notes — text — optional

• created_at — timestamp with time zone — required — default value now()

• updated_at — timestamp with time zone — required — default value now()

Create a relationship from:

invoices.customer_id

to:

customers.id

Do not choose cascading deletion for this relationship.

Save the table.

The customer snapshot fields intentionally remain in the invoices table.

They preserve what appeared on the invoice when it was saved."""
    note = replace_lesson_section(
        note, 4, 3, "BUILD PROMPT", "WHAT AI SHOULD RETURN", invoice_table_prompt
    )
    note = replace_lesson_section(
        note,
        4,
        3,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open the invoices table.

Confirm that:

✓ id is the Primary Key.

✓ user_id and customer_id are required.

✓ invoice_number exists.

✓ The customer snapshot fields exist.

✓ issue_date and due_date exist.

✓ status defaults to draft.

✓ All discount, tax and total fields exist.

✓ created_at and updated_at exist.

✓ customer_id relates to customers.id.

✓ Row Level Security remains enabled.""",
    )

    note = replace_lesson_title(
        note, 4, 4, "CREATING THE INVOICE ITEMS TABLE"
    )
    note = replace_lesson_section(
        note,
        4,
        4,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """In this lesson, you will create the table that stores invoice items.

Each row will represent one line on an invoice.

Several item rows can belong to the same invoice.""",
    )
    note = replace_lesson_section(
        note,
        4,
        4,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """There is nothing to build with ChatGPT in this lesson.

Create a new table named:

invoice_items

Leave Row Level Security enabled.

Create these columns:

• id — uuid — Primary Key — default value gen_random_uuid()

• invoice_id — uuid — required

• description — text — required

• quantity — numeric — required

• unit_price — numeric — required

• line_total — numeric — required

• position — integer — required — default value 0

• created_at — timestamp with time zone — required — default value now()

Create a relationship from:

invoice_items.invoice_id

to:

invoices.id

Choose:

Delete related records when the invoice is deleted.

This is also called:

ON DELETE CASCADE

Save the table.

The invoices table stores the complete document.

The invoice_items table stores every line on that document.""",
    )
    note = replace_lesson_section(
        note,
        4,
        4,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open the invoice_items table.

Confirm that:

✓ id is the Primary Key.

✓ invoice_id is required.

✓ description, quantity, unit_price and line_total are required.

✓ position exists.

✓ invoice_id relates to invoices.id.

✓ Deleting an invoice will delete its related items.

        ✓ Row Level Security remains enabled.""",
    )

    note = insert_lesson(note, 4, 5, CONSTRAINTS_LESSON)

    # Row Level Security is now checked on all three tables.
    note = replace_lesson_section(
        note,
        4,
        6,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """There is nothing to build with ChatGPT in this lesson.

Open the Table Editor.

Select:

customers

Confirm that Row Level Security is enabled.

Now select:

invoices

Confirm that Row Level Security is enabled.

Now select:

invoice_items

Confirm that Row Level Security is enabled.

Do not disable Row Level Security on any table.""",
    )
    note = replace_lesson_section(
        note,
        4,
        6,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Confirm that Row Level Security is enabled on:

✓ customers

✓ invoices

✓ invoice_items""",
    )

    for lesson, operation in (
        (7, "SELECT"),
        (8, "INSERT"),
        (9, "UPDATE"),
        (10, "DELETE"),
    ):
        note = replace_lesson_section(
            note,
            4,
            lesson,
            "BUILD PROMPT",
            "WHAT AI SHOULD RETURN",
            policy_prompt(operation),
        )
        note = replace_lesson_section(
            note,
            4,
            lesson,
            "TEST YOUR WORK",
            "CHECKPOINT",
            policy_test(operation),
        )

    note = replace_lesson_section(
        note,
        4,
        11,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Complete this test with two different accounts on the deployed HTTPS website.

ACCOUNT A

Sign in as Account A.

Create one customer and one invoice when the application features are available.

Confirm that the customer and invoice belong to Account A.

Sign out.

ACCOUNT B

Sign in as Account B.

Confirm that Account B cannot view, update or delete Account A's customer, invoice or invoice items.

Create a separate customer and invoice for Account B.

Confirm that Account B can access only its own information.

SUPABASE REVIEW

Confirm that all four operations have policies on:

✓ customers

✓ invoices

✓ invoice_items

Do not continue if either account can access the other account's data.""",
    )

    # Chapter 5 gains a complete customer-saving and selection capability.
    note = insert_lesson(note, 5, 2, CUSTOMER_SELECTION_LESSON)
    note = replace_lesson_title(
        note, 5, 1, "DESIGNING THE INVOICE WORKSPACE"
    )
    note = replace_lesson_section(
        note,
        5,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

I already have a working Professional Invoice Generator.

Authentication and dashboard protection work.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build the complete visual structure for the invoice workspace.

DASHBOARD.HTML

Keep authentication protection and logout.

Add:

• Dashboard header

• Signed-in user message

• Four invoice statistic cards

• Customer area

• Select Customer field

• Create Invoice section

• Business Details section

• Invoice Details section

• Invoice Items section

• Totals section

• Save Invoice button

• Status message area

• Invoice History section

The detailed customer and invoice behaviour will be completed in later lessons.

DASHBOARD.JS

Keep authentication, logout and the signed-in user message working.

Do not save customers or invoices yet.

AUTH.CSS

Keep every existing style.

Create a clean, responsive workspace.

IMPORTANT

Do not remove any authentication feature.

Do not create another Supabase client.

Return complete updated files only.""",
    )

    # The transformed original form, save and statistics lessons are now 3–5.
    form_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Saving and selecting customers already works.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build the complete invoice form and automatic browser calculations.

DASHBOARD.HTML

Keep the customer form and Select Customer field.

The invoice form must include:

• Selected customer preview

• Message explaining that the invoice number is generated when saved

• Business name

• Business email

• Business phone

• Business address

• Issue date

• Due date

• Status with draft, sent, paid and overdue options

• Currency

• Notes

Add an invoice items section.

Each item row must include:

• Description

• Quantity

• Unit price

• Line total

Add:

• Add Item button

• Remove Item button on every item after the first

Add a totals section containing:

• Subtotal

• Discount type

• Discount value

• Discount amount

• Tax rate

• Tax amount

• Final total

DASHBOARD.JS

Keep customer saving, customer selection, authentication and logout working.

Require one selected customer.

Allow users to add and remove item rows.

Always keep at least one item row.

Recalculate line totals when quantity or unit price changes.

Recalculate the complete invoice when an item, discount or tax value changes.

Support no discount, percentage discount and fixed discount.

Apply tax after the discount.

Reject negative values and zero quantity.

Do not allow a discount larger than the subtotal.

Display money values to two decimal places.

Do not save an invoice in this lesson.

AUTH.CSS

Keep every existing style.

Style the form, item rows, totals and buttons.

Keep the form readable on small screens.

IMPORTANT

Return all three complete files.

Do not remove anything that already works."""
    note = replace_lesson_section(
        note, 5, 3, "BUILD PROMPT", "WHAT AI SHOULD RETURN", form_prompt
    )
    note = replace_lesson_section(
        note,
        5,
        3,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open the deployed dashboard.

Select a saved customer.

Add three invoice items with different quantities and prices.

Confirm that:

✓ Every line total changes correctly.

✓ The subtotal equals all line totals.

✓ Percentage discount works.

✓ Fixed discount works.

✓ Tax is applied after the discount.

✓ The final total is correct.

✓ Removing an item updates every total.

✓ At least one item always remains.

Try a negative price and zero quantity.

Friendly validation should prevent both values.

Do not continue until every calculation is correct.""",
    )

    save_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Customer selection, invoice items and browser calculations work.

Everything already built must continue working.

Return complete files only.

Do not return snippets.

Create or update only:

• save-invoice-function.sql

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Save one complete invoice and all its items as one secure database action.

SAVE-INVOICE-FUNCTION.SQL

Create one complete PostgreSQL function named:

save_invoice_with_items

Use the normal authenticated caller and Row Level Security.

The function must:

• Require auth.uid()

• Accept customer_id, invoice details and a JSON array of items

• Confirm that the selected customer belongs to auth.uid()

• Copy the selected customer details into the invoice snapshot fields

• Validate issue date and due date

• Validate at least one item

• Validate every description, quantity and unit price

• Generate an invoice number unique for the signed-in user

• Recalculate every line total in Supabase

• Recalculate subtotal, discount, tax and final total in Supabase

• Never trust totals received from the browser

• Insert the invoice

• Insert every invoice item

• Complete all inserts as one transaction

• Leave no partly saved invoice when an error occurs

• Return the new invoice ID and invoice number

Restrict execution to authenticated users.

DASHBOARD.JS

Keep every existing capability.

When Save Invoice is selected:

• Require a selected customer

• Validate all required invoice fields and items

• Confirm the user is authenticated

• Call save_invoice_with_items

• Disable the button while saving

• Display friendly progress, success and error messages

• Clear the invoice form only after success

• Keep saved customers available

• Refresh invoice history and statistics

Use console.error() for technical details.

Do not display raw database messages to the learner.

IMPORTANT

Return all four complete files.

Do not create another Supabase client."""
    note = replace_lesson_section(
        note, 5, 4, "BUILD PROMPT", "WHAT AI SHOULD RETURN", save_prompt
    )
    note = replace_lesson_section(
        note,
        5,
        4,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Sign in on the deployed website.

Select a saved customer.

Prepare an invoice containing at least two items, a discount and tax.

Save the invoice.

Confirm that:

✓ The button is disabled while saving.

✓ A friendly success message appears.

✓ The generated invoice number appears.

✓ The invoice form clears only after success.

Open the invoices table in Supabase.

Confirm that:

✓ One invoice row exists.

✓ user_id belongs to the signed-in user.

✓ customer_id identifies the selected customer.

✓ Customer snapshot fields contain the selected customer's details.

✓ Trusted subtotal, discount, tax and total values are correct.

Open invoice_items.

Confirm that every item belongs to the new invoice.

Try saving without a customer and without an item.

Friendly validation should prevent both attempts.""",
    )

    statistics_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Creating and saving complete invoices works.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Display live invoice statistics.

Use four cards:

• Total Invoices

• Draft Invoices

• Sent Invoices

• Paid Invoices

Load only invoices available to the signed-in user.

Display 0 when no invoice exists.

Refresh the cards when:

• The dashboard opens

• An invoice is saved

• An invoice is edited

• An invoice is deleted

Handle loading and errors with friendly messages.

Continue relying on Row Level Security.

Return complete files only."""
    note = replace_lesson_section(
        note, 5, 5, "BUILD PROMPT", "WHAT AI SHOULD RETURN", statistics_prompt
    )
    note = replace_lesson_section(
        note,
        5,
        5,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open the dashboard.

Confirm that all four cards display numbers.

Create one draft invoice.

Confirm that Total Invoices and Draft Invoices increase.

Create or update an invoice with sent status.

Confirm that Sent Invoices displays correctly.

Mark an invoice as paid when editing is available.

Confirm that Paid Invoices displays correctly.

The cards should refresh without manually refreshing the browser.""",
    )
    return note


def polish_invoice_workflows(note: str) -> str:
    history_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Customer selection, invoice creation and dashboard statistics work.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Replace the Invoice History placeholder with a complete list of saved invoices.

DASHBOARD.JS

Retrieve only invoices available to the signed-in user.

Order them by created_at with the newest first.

Display one card for each invoice.

Every card must show:

• Invoice number

• Customer name

• Issue date

• Due date

• Status

• Final total with currency

Add a View Invoice button linking to:

invoice-details.html?id=INVOICE_ID

Pass only the invoice ID in the address.

Create separate loading, empty, error and content areas.

Display only the correct area.

If no invoice exists, display:

You haven't created any invoices yet. Create your first invoice using the form above.

Refresh the history after an invoice is saved, edited or deleted.

Do not create duplicate cards during refresh.

Display database information safely.

Do not insert untrusted values using unsafe HTML.

AUTH.CSS

Keep every existing style.

Style invoice cards and status labels.

Keep the history readable on small screens.

IMPORTANT

Continue relying on Row Level Security.

Do not retrieve another user's invoices.

Return complete files only."""
    note = replace_lesson_section(
        note, 6, 1, "BUILD PROMPT", "WHAT AI SHOULD RETURN", history_prompt
    )
    note = replace_lesson_section(
        note,
        6,
        1,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Sign in and open the dashboard.

Confirm that:

✓ The loading state appears while invoices load.

✓ Every saved invoice appears once.

✓ Each card displays the invoice number, customer, dates, status and total.

✓ View Invoice contains the correct invoice ID.

✓ A new account sees the friendly empty state.

✓ A failed request displays the friendly error state.

✓ Saving another invoice refreshes the history without duplicate cards.

✓ Only the signed-in user's invoices appear.""",
    )

    details_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Invoice History links to invoice-details.html.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• invoice-details.html

• invoice-details.js

• auth.css

GENERAL GOAL

Build the complete protected invoice details page.

INVOICE-DETAILS.JS

Confirm that the user is signed in.

Read the invoice ID from:

invoice-details.html?id=INVOICE_ID

If no ID exists, show a friendly unavailable message and do not query Supabase.

Retrieve one invoice where:

• id matches the address

• user_id matches the signed-in user

Retrieve all invoice_items belonging to that invoice.

Order items by position.

Continue relying on Row Level Security.

Do not reveal whether another user owns an unavailable invoice.

INVOICE-DETAILS.HTML

Display:

• Business details

• Invoice number

• Issue date

• Due date

• Status

• Saved customer snapshot

• Every invoice item

• Subtotal

• Discount

• Tax

• Final total and currency

• Notes

Add:

• Edit Invoice

• Back to Dashboard

• Logout

Create separate loading, unavailable, error and content areas.

Display money values to two decimal places.

Display dates clearly.

Display database information safely.

AUTH.CSS

Keep every existing style.

Create a clean responsive document layout.

IMPORTANT

Do not create another Supabase client.

Do not retrieve another user's invoice.

Return complete files only."""
    note = replace_lesson_section(
        note, 6, 2, "BUILD PROMPT", "WHAT AI SHOULD RETURN", details_prompt
    )
    note = replace_lesson_section(
        note,
        6,
        2,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open Invoice History.

Select View Invoice.

Confirm that:

✓ The correct invoice opens.

✓ Business and saved customer details appear.

✓ Invoice number, issue date, due date and status appear.

✓ Every saved item appears in the correct order.

✓ Subtotal, discount, tax and final total are correct.

✓ Edit Invoice opens dashboard.html?edit=INVOICE_ID.

✓ Back to Dashboard and Logout work.

Remove the ID from the address.

A friendly unavailable message should appear.

Try an invoice ID belonging to another account.

No invoice information should appear.""",
    )
    note = replace_lesson_section(
        note,
        6,
        3,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Complete every test on the deployed HTTPS website.

INVOICE HISTORY

✓ Loading, empty, error and content states work.

✓ Every invoice card appears once.

✓ Invoice numbers, customers, dates, statuses and totals are correct.

INVOICE DETAILS

✓ The correct invoice and items load.

✓ Trusted totals match the saved database values.

✓ Missing notes display a friendly fallback.

✓ Edit Invoice uses the correct invoice ID.

SECURITY

✓ A signed-out visitor returns to login.html.

✓ Account A cannot open an invoice belonging to Account B.

✓ An unavailable invoice does not reveal another user's information.

RESPONSIVE LAYOUT

✓ Cards and details remain readable on a small screen.""",
    )

    search_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Invoice History and invoice details work.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Make Invoice History searchable, filterable and sortable.

DASHBOARD.HTML

Add a toolbar above Invoice History.

Include:

• Search Invoices field

• Status filter

• Sort Invoices field

• Clear Search and Filters button

• Result information

• Separate no-results message

Search placeholder:

Search by invoice number or customer

Status options:

• All Statuses

• Draft

• Sent

• Paid

• Overdue

Sort options:

• Newest First

• Oldest First

• Due Date Soonest

• Highest Total

• Lowest Total

DASHBOARD.JS

Keep a reusable allInvoices array after invoices load.

Do not request the database again for every search.

Search while the user types across:

• Invoice number

• Customer name

• Customer company

• Customer email

Ignore letter case and extra spaces.

Filter by status.

Sort dates as dates and totals as numbers.

Apply search, filter and sorting together.

Update result information after every change.

Show the no-results message only when invoices exist but none match.

Clear Search and Filters must restore the default view.

AUTH.CSS

Keep every existing style.

Make the toolbar usable on desktop and small screens.

IMPORTANT

Return complete files only.

Do not remove invoice creation or statistics."""
    note = replace_lesson_section(
        note, 7, 1, "BUILD PROMPT", "WHAT AI SHOULD RETURN", search_prompt
    )
    search_test = """Confirm that:

✓ Searching by invoice number works.

✓ Searching by customer name works.

✓ Searching by customer company works.

✓ Searching ignores letter case and extra spaces.

✓ Draft, sent, paid and overdue filters work.

✓ Newest and oldest sorting work.

✓ Due Date Soonest sorts real dates correctly.

✓ Highest and Lowest Total sort numbers correctly.

✓ Search, filter and sorting work together.

✓ Result information updates.

✓ No-results and empty-history messages remain different.

✓ Clear Search and Filters restores the default history.

✓ Saving another invoice refreshes allInvoices and the visible results."""
    note = replace_lesson_section(
        note, 7, 1, "TEST YOUR WORK", "CHECKPOINT", search_test
    )
    note = replace_lesson_section(
        note, 7, 2, "TEST YOUR WORK", "CHECKPOINT", search_test
    )

    edit_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Creating, saving and viewing complete invoices works.

Everything already built must continue working.

Return complete files only.

Do not return snippets.

Create or update only:

• update-invoice-function.sql

• dashboard.html

• dashboard.js

• invoice-details.js

• auth.css

GENERAL GOAL

Allow the signed-in user to edit one complete invoice and all its items securely.

UPDATE-INVOICE-FUNCTION.SQL

Create one complete PostgreSQL function named:

update_invoice_with_items

Use the normal authenticated caller and Row Level Security.

The function must:

• Require auth.uid()

• Accept invoice ID, customer ID, invoice details and a JSON item array

• Confirm that the invoice belongs to auth.uid()

• Confirm that the selected customer belongs to auth.uid()

• Copy the selected customer details into the invoice snapshot fields

• Validate issue date and due date

• Validate at least one item

• Validate every description, quantity and unit price

• Recalculate line totals, subtotal, discount, tax and final total in Supabase

• Update the invoice

• Replace its items with the new complete item list

• Complete every change as one transaction

• Leave the original invoice unchanged when any part fails

• Update updated_at without changing created_at

• Keep the existing invoice number unchanged

Restrict execution to authenticated users.

DASHBOARD.JS

Read the edit ID from:

dashboard.html?edit=INVOICE_ID

Load only the signed-in user's invoice and items.

Fill the existing form and select the saved customer.

Do not create a second form.

Allow customer, dates, status, items, discount, tax and notes to change.

Change Save Invoice to Update Invoice in edit mode.

Add Cancel Edit.

Call update_invoice_with_items after complete validation.

Show friendly progress, success and error messages.

Return to create mode after success.

Refresh history and statistics.

IMPORTANT

Do not create another Supabase client.

Do not trust browser totals.

Do not allow one user to edit another user's invoice.

Return all five complete files."""
    note = replace_lesson_section(
        note, 8, 1, "BUILD PROMPT", "WHAT AI SHOULD RETURN", edit_prompt
    )
    edit_test = """Open one saved invoice.

Select:

Edit Invoice

Confirm that:

✓ Edit mode uses the existing invoice form.

✓ The correct customer is selected.

✓ Every invoice field and item loads.

Change the customer, due date, status, one item, discount, tax and notes.

Select:

Update Invoice

Confirm that:

✓ Complete validation runs.

✓ The invoice number does not change.

✓ Trusted totals are recalculated in Supabase.

✓ The customer snapshot updates to the selected customer.

✓ created_at remains unchanged.

✓ updated_at changes.

✓ History, details and statistics refresh.

Cancel a second edit.

The saved invoice should remain unchanged.

Attempt to edit another account's invoice.

Access must be denied and no update must occur."""
    note = replace_lesson_section(
        note, 8, 1, "TEST YOUR WORK", "CHECKPOINT", edit_test
    )
    note = replace_lesson_section(
        note, 8, 2, "TEST YOUR WORK", "CHECKPOINT", edit_test
    )

    print_prompt = """PROJECT STATE

I already have a working Professional Invoice Generator.

Users can open a complete saved invoice.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets.

Update only:

• invoice-details.html

• invoice-details.js

• auth.css

GENERAL GOAL

Build a professional A4 invoice document that the user can print.

INVOICE-DETAILS.HTML

Keep every feature that already works.

Add a Print Invoice button.

Create an invoice document area containing:

• Business details

• Invoice number

• Issue date

• Due date

• Status

• Saved customer details

• Every invoice item

• Subtotal

• Discount

• Tax

• Final total and currency

• Notes

INVOICE-DETAILS.JS

Load the invoice only when it belongs to the signed-in user.

Load and display items in their saved position.

Display money values to two decimal places.

Use the browser print window when Print Invoice is selected.

AUTH.CSS

Add print styles using:

@media print

Use a clean A4 layout.

Hide navigation, editing controls, buttons and screen-only messages when printing.

Keep the invoice document visible.

Prevent item rows from breaking awkwardly.

IMPORTANT

Do not create another Supabase client.

Do not allow one user to print another user's invoice.

Return complete files only."""
    note = replace_lesson_section(
        note, 9, 1, "BUILD PROMPT", "WHAT AI SHOULD RETURN", print_prompt
    )

    complete_test = """Complete the following final tests on the deployed HTTPS website.

USER ACCOUNTS

✓ Registration, verification, login and logout work.

✓ Protected pages reject signed-out visitors.

CUSTOMERS

✓ A customer saves with the authenticated user's ID.

✓ The customer selection list and preview work.

✓ Account A cannot access Account B's customers.

INVOICE CREATION

✓ Customer selection is required.

✓ Multiple items, discounts and tax calculate correctly.

✓ Supabase recalculates trusted totals.

✓ The invoice and all items save as one complete action.

INVOICE HISTORY AND DETAILS

✓ Loading, empty, error and content states work.

✓ The correct invoice, snapshot, items and totals appear.

SEARCH, FILTER AND SORT

✓ Invoice number and customer search work.

✓ Status filters work.

✓ Date and total sorting work.

INVOICE EDITING

✓ Customer, fields and items update securely.

✓ The invoice number and created_at remain unchanged.

PRINTING

✓ The complete document prints cleanly on A4.

✓ Screen controls are hidden from print.

DELETION

✓ Cancelling leaves the invoice unchanged.

✓ Confirming deletes the invoice and cascades to its items.

SECURITY

✓ Account A cannot view, edit, print or delete Account B's invoice.

✓ Row Level Security remains enabled on all three tables.

RESPONSIVE DESIGN

✓ Customer, invoice, history, details and toolbar layouts remain usable on a small screen.

CONSOLE

✓ No unexpected red errors appear during the complete workflow."""
    note = replace_lesson_section(
        note, 10, 1, "TEST YOUR WORK", "CHECKPOINT", complete_test
    )
    return note


def polish_lesson_explanations(note: str) -> str:
    replacements = [
        (5, 3, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ A saved customer can be selected.

✓ At least one item is always required.

✓ Quantity and price validation work.

✓ Discount and tax calculations work.

✓ No invoice has been saved in this lesson."""),
        (5, 3, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES", """A common mistake is treating the totals displayed by the browser as final trusted values.

The browser calculations help the user while the invoice is being prepared.

Supabase will calculate the trusted values again when the invoice is saved."""),
        (5, 3, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER", """The form gives immediate feedback whenever an item, discount or tax value changes.

This makes the application feel responsive without weakening the database validation used during saving."""),
        (5, 3, "WHAT YOU LEARNED", "CHAPTER 5", """In this lesson you learned how to:

• require a selected customer

• create and remove invoice item rows

• calculate line totals and subtotal

• apply discounts and tax

• prepare a complete invoice for secure saving"""),
        (5, 4, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS", """In this lesson, you will complete secure invoice saving.

One database function will verify the selected customer, recalculate every trusted total, save the invoice, and save all its items as one complete action.

If any part fails, no partial invoice will remain."""),
        (5, 4, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ The selected customer is verified.

✓ Supabase recalculates every trusted total.

✓ The invoice and items save together.

✓ A failed request leaves no partial invoice.

✓ Invoice ownership is protected.

✓ The form resets only after success."""),
        (5, 4, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES", """A common mistake is inserting the invoice and each item through separate browser requests.

If one request fails, the database may contain an incomplete document.

The database function completes the invoice and item inserts as one transaction.

Another mistake is trusting customer or total values supplied by the browser.

Supabase verifies the customer and recalculates the totals."""),
        (5, 4, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER", """The database function is responsible for the final trusted result.

It checks ownership, preserves the customer snapshot, calculates the totals and saves related records together."""),
        (5, 4, "WHAT YOU LEARNED", "CHAPTER 5", """In this lesson you learned how to:

• verify customer ownership

• calculate trusted totals in Supabase

• save an invoice and its items as one transaction

• prevent partly saved invoices

• refresh application data after success"""),
        (5, 5, "WHY THIS MATTERS", "BEFORE YOU CONTINUE", """Dashboard statistics turn saved invoice information into a quick business overview.

The user should see how many invoices exist and how many are currently draft, sent or paid without counting them manually."""),
        (5, 5, "BEFORE YOU CONTINUE", "BUILD PROMPT", """Confirm that:

✓ Complete invoices save successfully.

✓ The invoice form resets after success.

✓ Test invoices exist with different statuses.

✓ Dashboard authentication still works."""),
        (5, 5, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ Total, draft, sent and paid counts are correct.

✓ Statistics refresh automatically.

✓ Invoice creation still works.

✓ Only the signed-in user's invoices are counted."""),
        (6, 2, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ Invoice details load correctly.

✓ Every item and trusted total appears.

✓ Authentication works.

✓ Invoice ownership remains protected.

✓ Edit Invoice works."""),
        (6, 2, "WHAT YOU LEARNED", "CHAPTER 6", """In this lesson you learned how to:

• build a complete invoice details page

• retrieve one authorised invoice

• retrieve and order related invoice items

• protect invoice privacy

• create one reusable details page"""),
        (7, 1, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ Search works.

✓ Status filtering works.

✓ Date and total sorting work.

✓ No-results and result information work.

✓ Invoice History refreshes correctly."""),
        (7, 1, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER", """Invoice History retrieves the authorised invoices once.

JavaScript then searches, filters and sorts the reusable array in the browser.

This keeps the controls fast and avoids an unnecessary database request after every key press."""),
        (8, 1, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before moving on, confirm that:

✓ Edit mode loads the complete invoice.

✓ Customer and item changes work.

✓ Trusted totals are recalculated.

✓ The invoice number and created_at remain unchanged.

✓ The update is transactional and secure."""),
        (8, 2, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS", """In this lesson, you will test the complete invoice editing workflow.

You will confirm that authorised changes succeed, trusted totals remain correct, cancelled changes are not saved, and another account cannot update the invoice."""),
        (8, 2, "BEFORE YOU CONTINUE", "BUILD PROMPT", """Prepare:

• Two user accounts

• Two saved customers

• Several invoices containing more than one item

• Invoices with different statuses, discounts and tax values"""),
        (8, 2, "CHECKPOINT", "COMMON BEGINNER MISTAKES", """Before completing this chapter, confirm that:

✓ Complete invoice editing works.

✓ Cancel Edit leaves the saved invoice unchanged.

✓ Trusted totals remain correct.

✓ Invoice ownership remains protected.

✓ History, details and statistics refresh."""),
        (8, 2, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES", """A common mistake is updating the invoice first and replacing its items afterwards using unrelated requests.

If the item update fails, the document becomes inconsistent.

The update function completes every change as one database transaction."""),
        (8, 2, "WHAT YOU LEARNED", "CHAPTER SUMMARY", """In this lesson you learned how to:

• test complete invoice editing

• verify trusted recalculation

• verify transactional updates

• test cancelled changes

• protect invoice ownership"""),
        (10, 1, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER", """Every capability depends on the others.

Authentication identifies the user.

The customer list supplies the invoice form.

Secure database functions save and update complete invoices.

Invoice History opens the protected details page.

Printing and deletion use that same authorised invoice.

Dashboard statistics reflect every successful change.

End-to-end testing confirms that the complete journey remains reliable."""),
    ]
    for chapter, lesson, title, next_title, body in replacements:
        note = replace_lesson_section(
            note, chapter, lesson, title, next_title, body
        )
    return note


def polish_chapter_frames(note: str) -> str:
    note = replace_chapter_section(
        note,
        4,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Your Professional Invoice Generator can now recognise the signed-in user.

The next step is to create a secure database for customers, invoices and invoice items.

The customers table will store reusable customer profiles.

The invoices table will store each complete business document and a snapshot of the selected customer.

The invoice_items table will store every item on each invoice.

You will add database constraints and Row Level Security so invalid or unauthorised information is rejected before it can become trusted business data.""",
    )
    note = replace_chapter_section(
        note,
        4,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• customers table

• invoices table

• invoice_items table

• Customer and invoice relationships

• Invoice item cascading deletion

• Database constraints

• Row Level Security on all three tables

• SELECT, INSERT, UPDATE and DELETE policies

• Two-account privacy tests""",
    )
    note = replace_chapter_section(
        note,
        4,
        "CHAPTER SUMMARY",
        "CHAPTER MILESTONE",
        """Congratulations.

Your Professional Invoice Generator now has a complete three-table database.

Customer profiles can be reused, invoices preserve a customer snapshot, and every invoice can contain several related items.

Database constraints protect important business rules.

Row Level Security and ownership policies protect customers, invoices and invoice items for every operation.""",
    )
    note = replace_chapter_section(
        note,
        4,
        "CHAPTER MILESTONE",
        "TRANSITION TO CHAPTER 5",
        """By the end of Chapter 4, you have successfully built:

✓ customers table

✓ invoices table

✓ invoice_items table

✓ Correct relationships

✓ Customer snapshot design

✓ Database constraints

✓ Row Level Security

✓ SELECT policies

✓ INSERT policies

✓ UPDATE policies

✓ DELETE policies

✓ Two-account security test""",
    )
    note = replace_chapter_tail(
        note,
        4,
        "TRANSITION TO CHAPTER 5",
        """The secure database foundation is complete.

In Chapter 5, you will build the working invoice workspace.

Users will save and select customers, prepare invoices containing several items, calculate discounts and tax, save the complete invoice securely, and view live dashboard statistics.""",
    )

    note = replace_chapter_section(
        note,
        5,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Your Professional Invoice Generator now has secure database tables and policies.

In this chapter, you will build the main working area.

The user will save customer profiles, select one customer, add several invoice items, calculate totals and save the complete invoice.

The browser will provide immediate calculations.

Supabase will independently validate the customer, items and trusted totals before saving.

The dashboard will also display useful invoice statistics.""",
    )
    note = replace_chapter_section(
        note,
        5,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• Responsive invoice workspace

• Customer-saving form

• Select Customer field and preview

• Multiple invoice items

• Add Item and Remove Item controls

• Automatic line totals

• Subtotal, discount, tax and final total

• Secure transactional invoice saving

• Customer snapshot saving

• Total, draft, sent and paid statistics""",
    )
    note = replace_chapter_section(
        note,
        5,
        "CHAPTER SUMMARY",
        "CHAPTER MILESTONE",
        """Congratulations.

Your application can now save reusable customers and select them while preparing invoices.

Users can add several items, see immediate calculations and save the complete invoice as one secure database action.

Supabase validates ownership and recalculates trusted totals.

The dashboard statistics refresh when invoice information changes.""",
    )
    note = replace_chapter_section(
        note,
        5,
        "CHAPTER MILESTONE",
        "TRANSITION TO CHAPTER 6",
        """By the end of Chapter 5, you have successfully built:

✓ Professional invoice workspace

✓ Customer saving and selection

✓ Customer preview

✓ Multiple invoice items

✓ Live calculations

✓ Trusted Supabase calculations

✓ Secure transactional saving

✓ Customer snapshot

✓ Automatic form reset

✓ Live invoice statistics""",
    )
    note = replace_chapter_tail(
        note,
        5,
        "TRANSITION TO CHAPTER 6",
        """Your application can now create complete invoices.

In Chapter 6, you will replace the history placeholder with a clear list of saved invoices and build a protected page that displays one complete invoice and all its items.""",
    )

    note = replace_chapter_section(
        note,
        6,
        "CHAPTER SUMMARY",
        "CHAPTER MILESTONE",
        """Congratulations.

Users can now browse saved invoices and open one complete document inside the application.

Invoice History handles loading, empty and error states.

The protected details page displays the business information, customer snapshot, items and trusted totals without exposing another user's invoice.""",
    )
    note = replace_chapter_section(
        note,
        6,
        "CHAPTER MILESTONE",
        "TRANSITION TO CHAPTER 7",
        """By the end of Chapter 6, you have successfully built:

✓ Invoice History

✓ Invoice cards

✓ View Invoice links

✓ Complete invoice details

✓ Ordered invoice items

✓ Loading state

✓ Empty state

✓ Error state

✓ Responsive layouts

✓ Invoice privacy protection""",
    )

    note = replace_chapter_section(
        note,
        7,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• Invoice History toolbar

• Search by invoice number

• Search by customer information

• Draft, sent, paid and overdue filters

• Date and total sorting

• Result information

• No-results state

• Clear Search and Filters

• Automatic result refresh""",
    )

    note = replace_chapter_tail(
        note,
        7,
        "TRANSITION TO CHAPTER 8",
        """Your application can now create, display and locate invoices efficiently.

In Chapter 8, you will build a secure editing workflow.

Users will update the selected customer, dates, status, items, discounts, tax and notes while Supabase protects ownership and recalculates every trusted total.""",
    )
    note = replace_chapter_section(
        note,
        8,
        "CHAPTER SUMMARY",
        "CHAPTER MILESTONE",
        """Congratulations.

Authorised users can now edit one complete invoice and all its items.

The application reuses the existing form, preserves the invoice number and original creation date, updates the customer snapshot, and recalculates trusted totals inside Supabase.

Unauthorised users cannot load or update the invoice.""",
    )
    note = replace_chapter_section(
        note,
        8,
        "CHAPTER MILESTONE",
        "TRANSITION TO CHAPTER 9",
        """By the end of Chapter 8, you have successfully built:

✓ Invoice edit mode

✓ Secure invoice retrieval

✓ Existing form population

✓ Customer and item editing

✓ Trusted total recalculation

✓ Transactional invoice update

✓ Preserved invoice number and created date

✓ Cancel Edit

✓ Automatic history and statistics refresh

✓ Two-account editing protection""",
    )
    note = replace_chapter_tail(
        note,
        8,
        "TRANSITION TO CHAPTER 9",
        """Your application can now create, view, find and edit invoices.

In Chapter 9, you will produce a clean printable A4 document and add a confirmed deletion workflow that removes the invoice and its related items securely.""",
    )

    note = replace_chapter_section(
        note,
        9,
        "CHAPTER SUMMARY",
        "CHAPTER MILESTONE",
        """Congratulations.

Your application can now present each invoice as a professional A4 document and open the browser print window.

It can also delete an authorised invoice after confirmation.

The database relationship removes the related invoice items automatically while Row Level Security protects ownership.""",
    )
    note = replace_chapter_section(
        note,
        9,
        "CHAPTER MILESTONE",
        "TRANSITION TO CHAPTER 10",
        """By the end of Chapter 9, you have successfully built:

✓ Professional printable invoice

✓ Complete item table

✓ A4 print styles

✓ Hidden screen controls during print

✓ Delete confirmation

✓ Secure invoice deletion

✓ Cascading item deletion

✓ History and statistics refresh

✓ Printing and deletion security tests""",
    )

    note = replace_chapter_section(
        note,
        10,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Congratulations.

You have built a complete Professional Invoice Generator.

The application now supports user accounts, saved customers, invoice creation, trusted calculations, history, search, editing, printing and deletion.

Before publishing, professional developers test the complete journey instead of checking isolated features only.

In this chapter, you will perform that final end-to-end review and confirm that different user accounts remain private.""",
    )
    return note


def clean_and_finish(note: str) -> str:
    # Make the opening capability list explicitly include saved customers.
    note = note.replace(
        "INVOICE DATABASE\n\n• Secure invoices table",
        "INVOICE DATABASE\n\n• Secure customers table\n\n"
        "• Secure invoices table",
        1,
    )
    note = note.replace(
        "INVOICE MANAGEMENT\n\n• Create invoices",
        "INVOICE MANAGEMENT\n\n• Save customer profiles\n\n"
        "• Select saved customers\n\n• Create invoices",
        1,
    )
    note = note.replace(
        "enter customer details",
        "select a saved customer",
    )
    note = note.replace(
        "Enter customer details",
        "Select a saved customer",
    )
    note = note.replace(
        "Most importantly, you have followed the same professional workflow introduced in Workbook 01.",
        "Most importantly, you have followed a professional step-by-step workflow.",
    )
    note = note.replace(
        "Unlike Workbook 01, this workbook introduces a much richer database structure, allowing businesses to manage complete invoice details instead of simple financial transactions.",
        "This database structure allows businesses to manage complete invoices containing several related items.",
    )
    note = note.replace(
        "Unlike the Expense Tracker, where each row represented one transaction, every row in this table represents one invoice.",
        "In this table, every row represents one complete invoice.",
    )
    note = note.replace(
        "This chapter introduces several new software design patterns that you have not used before and marks a significant step forward from Workbook 01.",
        "This chapter introduces several useful software design patterns for complete business documents.",
    )
    note = note.replace(
        "A invoice contains two kinds of information.",
        "An invoice contains document information and several related items.",
    )
    note = note.replace(
        "Why might a business invoice include a company name while an individual invoice does not?",
        "Why should a saved invoice keep a customer snapshot?",
    )
    note = note.replace(
        "• New Invoices This Month",
        "• Draft Invoices",
    )
    note = note.replace("Invoices Added Today", "Draft Invoices")
    note = note.replace("New Invoices This Month", "Sent Invoices")
    note = note.replace(
        "The application will retrieve invoices from Supabase, display them as professional invoice cards, generate invoice number automatically, provide click-to-call and click-to-email actions, and allow users to open individual invoice details.",
        "The application will retrieve authorised invoices from Supabase, display clear invoice cards, and allow users to open one complete invoice and its items.",
    )
    note = note.replace(
        "This is the same professional approach you used successfully in Workbook 01.",
        "This coordinated approach reduces missing files and broken redirects.",
    )
    note = note.replace("• Invoice profile heading", "• Invoice details heading")
    note = note.replace("• Invoice profile cards", "• Invoice cards")
    note = note.replace(
        "• Duplicate records\n\n• Missed follow-ups\n\n"
        "• Slow invoice service\n\n• Difficulty understanding invoice growth",
        "• Repeated invoice numbers\n\n• Incorrect totals\n\n"
        "• Slow invoice preparation\n\n• Difficulty finding overdue invoices",
    )
    note = note.replace(
        "1. Secure Invoice Records\n\n2. Duplicate Detection\n\n"
        "3. Invoice Details Cards\n\n4. Click-to-Call\n\n"
        "5. Click-to-Email\n\n6. Search, Filters and Sorting",
        "1. Saved Customers\n\n2. Multiple Invoice Items\n\n"
        "3. Automatic Totals\n\n4. Discounts and Tax\n\n"
        "5. Professional Printing\n\n6. Search, Filters and Sorting",
    )
    note = note.replace(
        "1. Create an Account\n\n2. Add Invoice Details\n\n"
        "3. Manage Invoice Records\n\n4. Find and Contact Invoices Quickly",
        "1. Create an Account\n\n2. Save and Select a Customer\n\n"
        "3. Prepare and Save an Invoice\n\n4. Find, Edit and Print Invoices",
    )
    note = note.replace("• A invoice search area", "• An invoice search area")
    note = note.replace(
        "• Three sample invoice details cards",
        "• Three sample invoice cards",
    )
    note = note.replace("• Invoice type", "• Status")
    note = note.replace(
        "• Company\n\n• Phone\n\n• Email\n\n• View Invoice button",
        "• Issue date\n\n• Due date\n\n• Final total\n\n• View Invoice button",
    )
    note = note.replace(
        "The invoice form should now validate and normalise invoice information professionally.",
        "The invoice form should now support customer selection, item rows and complete live calculations.",
    )
    note = note.replace(
        "✓ Invoice profile loads correctly.",
        "✓ Invoice details load correctly.",
    )
    note = note.replace("✓ Contact actions work.\n\n", "")
    note = note.replace(
        "Rather than adding new features, you will confirm that every part of the directory works correctly under different conditions.",
        "Rather than adding new features, you will confirm that Invoice History and Invoice Details work correctly under different conditions.",
    )
    note = note.replace(
        "The Invoice History now behaves much like professional CRM software.",
        "Invoice History now behaves like a responsive business document list.",
    )
    note = note.replace("✓ Directory refresh works.", "✓ Invoice History refreshes.")
    note = note.replace(
        "✓ Automatic Directory Refresh",
        "✓ Automatic Invoice History Refresh",
    )
    note = note.replace(
        "The directory will also provide friendly loading, empty and error states to improve the overall user experience.",
        "Invoice History will also provide friendly loading, empty and error states.",
    )
    note = note.replace(
        "This lesson will confirm that invoice privacy, directory behaviour and details pages all function correctly.",
        "This lesson will confirm that invoice privacy, Invoice History and the details page all function correctly.",
    )
    note = note.replace(
        "✓ Invoice information is normalised.",
        "✓ Invoice fields and items are validated.",
    )
    note = note.replace(
        "The difference is that the database performs an UPDATE instead of an INSERT.",
        "The update function replaces the authorised invoice and its items as one transaction.",
    )
    note = note.replace(
        "Invoice creation supplies the directory.\n\n"
        "The directory opens invoice details.\n\n"
        "Invoice editing updates those profiles.",
        "Invoice creation supplies Invoice History.\n\n"
        "Invoice History opens invoice details.\n\n"
        "Invoice editing updates those documents.",
    )
    note = note.replace("Expiry date", "Due date")
    note = note.replace("Expiry Date", "Due Date")
    note = note.replace("INVOICE-PROFILE", "INVOICE-DETAILS")
    note = note.replace("a invoice", "an invoice")
    note = note.replace("A invoice", "An invoice")
    note = note.replace("updated profile", "updated invoice details")
    note = note.replace("Invoice numbers display correctly", "Invoice numbers display correctly")
    note = note.replace(
        "This means you can begin with this workbook even if you have not completed Workbook 01 or Workbook 02.",
        "This means you can begin with this workbook even if you have not completed any other workbook.",
    )
    note = note.replace(
        "• Invoice expiry reminders",
        "• Invoice overdue reminders",
    )
    note = note.replace(
        "• Convert an paid invoice into an invoice",
        "• Convert a paid invoice into a receipt",
    )
    note = note.replace(
        "The title and project for Workbook 04 will be introduced separately.",
        "The next project in the series is Workbook 05 — Appointment Booking System.",
    )
    note = note.replace(
        "✓ Create a invoice with several items",
        "✓ Save a customer\n\n✓ Select the saved customer\n\n"
        "✓ Create an invoice with several items",
    )
    note = replace_lesson_section(
        note,
        5,
        1,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Sign in and open the dashboard.

Confirm that:

✓ The dashboard header and signed-in user message appear.

✓ Four invoice statistic cards appear.

✓ The customer area appears.

✓ Select Customer appears.

✓ The Create Invoice structure appears.

✓ Business, invoice items, totals and history sections appear.

✓ Save Invoice and Logout appear.

Resize the browser.

Confirm that the workspace remains readable without unnecessary horizontal scrolling.""",
    )
    going_live = """Your Professional Invoice Generator is ready for its final deployment.

1.

Save every complete project file.

2.

Open:

https://app.netlify.com/drop

3.

Drag the complete Professional Invoice Generator folder into the deployment area.

If you already created the Netlify website during authentication testing, deploy the updated folder to that same website.

4.

Wait for the deployment to finish.

5.

Open the HTTPS website address supplied by Netlify.

6.

Confirm that the Supabase Site URL and Redirect URLs still use this exact website address.

7.

Repeat the complete live workflow:

• Registration and email verification

• Customer saving and selection

• Invoice creation and trusted calculations

• History, search and invoice details

• Editing

• Printing

• Deletion

• Two-account privacy

Only share the application after every important live test succeeds."""
    pattern = (
        rf"(?m)^GOING LIVE\s*$\n(?:{re.escape(SEP)}\n)?"
        rf"[\s\S]*?(?=^{re.escape('PORTFOLIO DESCRIPTION')}\s*$)"
    )
    note, count = re.subn(
        pattern,
        f"GOING LIVE\n{SEP}\n\n{going_live}\n\n{SEP}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace Going Live")

    # Recreate every question from the final invoice-specific lesson.
    note = re.sub(
        rf"(?ms)^CODE-READING QUESTION\s*\n.*?"
        rf"^{re.escape(SEP)}\s*\n(?=WHAT YOU LEARNED)",
        "",
        note,
    )
    note = apply_learner_support(note)
    return note


def audit(note: str) -> None:
    required = (
        "PROMPT TO PROFIT™ WORKBOOK 04",
        "PROFESSIONAL INVOICE GENERATOR",
        "LEARNER SUPPORT TOOLKIT",
        "customers",
        "invoices",
        "invoice_items",
        "customer_id",
        "save_invoice_with_items",
        "SAVING AND SELECTING CUSTOMERS",
        "BUILDING THE PRINTABLE INVOICE DOCUMENT",
        "Row Level Security",
        "emailRedirectTo",
        "CODE-READING QUESTION",
        "PORTFOLIO DESCRIPTION",
    )
    for value in required:
        if value not in note:
            raise RuntimeError(f"Workbook 04 is missing required content: {value}")
    forbidden = (
        "Quotation",
        "quotation",
        "quotation_items",
        "customer-profile",
        "Expense Tracker",
        "Workbook 01",
        "Workbook 02",
        "Workbook 03",
        "VS Code",
        "React",
        "Node.js",
    )
    for value in forbidden:
        if value in note:
            raise RuntimeError(f"Workbook 04 contains forbidden text: {value}")
    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook 04 must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") < 39:
        raise RuntimeError("Workbook 04 lost part of the locked lesson structure")


def make_note() -> str:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    note = transform_project(payload["note"])
    note = apply_invoice_architecture(note)
    note = polish_invoice_workflows(note)
    note = polish_lesson_explanations(note)
    note = polish_chapter_frames(note)
    note = clean_and_finish(note)
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
