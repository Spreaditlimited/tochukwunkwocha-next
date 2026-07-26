#!/usr/bin/env python3
"""Build Workbook 03 afresh by using Workbook 02 as the locked writing template."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_learner_support_standard import apply_standard as apply_learner_support


SOURCE = Path(
    "/Users/tochukwunkwocha/Desktop/PTP New Lessons/"
    "2 - Customer Record Management System.notepad"
)
OUTPUT = Path(
    "deliverables/professional-quotation-generator-workbook/"
    "3 - Professional Quotation Generator.notepad"
)
SEP = "=" * 50


def section(title: str, body: str) -> str:
    return f"{SEP}\n{title}\n{SEP}\n\n{body.strip()}\n"


def replace_section(note: str, title: str, next_title: str, body: str) -> str:
    pattern = (
        rf"{re.escape(SEP)}\n{re.escape(title)}\n"
        rf"(?:{re.escape(SEP)}\n)?[\s\S]*?"
        rf"(?={re.escape(SEP)}\n{re.escape(next_title)}\n)"
    )
    replacement = section(title, body) + "\n"
    updated, count = re.subn(pattern, replacement, note, count=1)
    if count != 1:
        raise RuntimeError(f"Could not replace section: {title}")
    return updated


def replace_lesson_title(note: str, chapter: int, lesson: int, title: str) -> str:
    chapter_marker = f"{SEP}\nCHAPTER {chapter}\n"
    start = note.index(chapter_marker)
    if chapter < 10:
        end = note.index(f"{SEP}\nCHAPTER {chapter + 1}\n", start)
    else:
        end = len(note)
    part = note[start:end]
    pattern = rf"(\nLESSON {lesson}\n\n)[^\n]+"
    part, count = re.subn(pattern, rf"\1{title}", part, count=1)
    if count != 1:
        raise RuntimeError(f"Could not rename Chapter {chapter}, Lesson {lesson}")
    return note[:start] + part + note[end:]


def replace_chapter_title(note: str, chapter: int, old: str, new: str) -> str:
    start = note.index(f"{SEP}\nCHAPTER {chapter}\n")
    if chapter < 10:
        end = note.index(f"{SEP}\nCHAPTER {chapter + 1}\n", start)
    else:
        end = len(note)
    part = note[start:end].replace(old, new)
    return note[:start] + part + note[end:]


def insert_after(note: str, needle: str, addition: str, count: int = 1) -> str:
    if note.count(needle) < count:
        raise RuntimeError(f"Could not find insertion point: {needle[:80]}")
    return note.replace(needle, needle + addition, count)


def replace_lesson_section(
    note: str,
    chapter: int,
    lesson: int,
    title: str,
    next_title: str,
    body: str,
) -> str:
    chapter_start = note.index(f"{SEP}\nCHAPTER {chapter}\n")
    if chapter < 10:
        chapter_end = note.index(f"{SEP}\nCHAPTER {chapter + 1}\n", chapter_start)
    else:
        chapter_end = len(note)
    chapter_text = note[chapter_start:chapter_end]
    lesson_match = list(re.finditer(rf"\nLESSON {lesson}\n", chapter_text))
    if not lesson_match:
        raise RuntimeError(f"Could not find Chapter {chapter}, Lesson {lesson}")
    lesson_start = lesson_match[0].start()
    if lesson < 9 and re.search(rf"\nLESSON {lesson + 1}\n", chapter_text[lesson_start:]):
        next_lesson = re.search(
            rf"\nLESSON {lesson + 1}\n", chapter_text[lesson_start:]
        )
        assert next_lesson
        lesson_end = lesson_start + next_lesson.start()
    else:
        summary = chapter_text.find(f"{SEP}\nCHAPTER SUMMARY", lesson_start)
        lesson_end = summary if summary >= 0 else len(chapter_text)
    lesson_text = chapter_text[lesson_start:lesson_end]
    pattern = (
        rf"{re.escape(SEP)}\n{re.escape(title)}\n"
        rf"(?:{re.escape(SEP)}\n)?[\s\S]*?"
        rf"(?={re.escape(SEP)}\n{re.escape(next_title)}\n)"
    )
    replacement = section(title, body) + "\n"
    lesson_text, count = re.subn(pattern, replacement, lesson_text, count=1)
    if count != 1:
        raise RuntimeError(
            f"Could not replace {title} in Chapter {chapter}, Lesson {lesson}"
        )
    chapter_text = (
        chapter_text[:lesson_start] + lesson_text + chapter_text[lesson_end:]
    )
    return note[:chapter_start] + chapter_text + note[chapter_end:]


def replace_chapter_section(
    note: str,
    chapter: int,
    title: str,
    next_title: str,
    body: str,
) -> str:
    chapter_start = note.index(f"{SEP}\nCHAPTER {chapter}\n")
    if chapter < 10:
        chapter_end = note.index(f"{SEP}\nCHAPTER {chapter + 1}\n", chapter_start)
    else:
        chapter_end = len(note)
    chapter_text = note[chapter_start:chapter_end]
    pattern = (
        rf"{re.escape(title)}\n(?:{re.escape(SEP)}\n)?[\s\S]*?"
        rf"(?={re.escape(SEP)}\n{re.escape(next_title)}\n)"
    )
    replacement = f"{title}\n{SEP}\n\n{body.strip()}\n\n"
    chapter_text, count = re.subn(pattern, replacement, chapter_text, count=1)
    if count != 1:
        raise RuntimeError(f"Could not replace Chapter {chapter} section {title}")
    return note[:chapter_start] + chapter_text + note[chapter_end:]


def make_note() -> str:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))["note"]

    # Begin with the locked Workbook 02 manuscript so its voice, teaching rhythm,
    # lesson order and beginner instructions remain the controlling standard.
    note = source

    note = note.replace("PROMPT TO PROFIT™ WORKBOOK 02", "PROMPT TO PROFIT™ WORKBOOK 03")
    note = note.replace("Workbook 02", "Workbook 03")
    note = note.replace("WORKBOOK 02", "WORKBOOK 03")
    note = note.replace(
        "CUSTOMER RECORD MANAGEMENT SYSTEM", "PROFESSIONAL QUOTATION GENERATOR"
    )
    note = note.replace(
        "Customer Record Management System", "Professional Quotation Generator"
    )

    # Protect the genuine customer information that belongs inside a quotation.
    protected = {
        "customer name": "§A1§",
        "Customer name": "§A2§",
        "customer email": "§A3§",
        "Customer email": "§A4§",
        "customer phone": "§A5§",
        "Customer phone": "§A6§",
        "customer address": "§A7§",
        "Customer address": "§A8§",
    }
    for old, token in protected.items():
        note = note.replace(old, token)

    replacements = [
        ("customer record management", "quotation management"),
        ("Customer record management", "Quotation management"),
        ("CUSTOMER RECORDS", "QUOTATIONS"),
        ("CUSTOMER RECORD", "QUOTATION"),
        ("customer records", "quotations"),
        ("Customer records", "Quotations"),
        ("customer record", "quotation"),
        ("Customer record", "Quotation"),
        ("customers table", "quotations table"),
        ("Customers table", "Quotations table"),
        ("CUSTOMERS TABLE", "QUOTATIONS TABLE"),
        ("customers", "quotations"),
        ("Customers", "Quotations"),
        ("CUSTOMERS", "QUOTATIONS"),
        ("customer", "quotation"),
        ("Customer", "Quotation"),
        ("CUSTOMER", "QUOTATION"),
    ]
    for old, new in replacements:
        note = note.replace(old, new)

    restorations = {
        "§A1§": "customer name",
        "§A2§": "Customer name",
        "§A3§": "customer email",
        "§A4§": "Customer email",
        "§A5§": "customer phone",
        "§A6§": "Customer phone",
        "§A7§": "customer address",
        "§A8§": "Customer address",
    }
    for token, value in restorations.items():
        note = note.replace(token, value)

    # Quotation-specific vocabulary. These replace Customer System capabilities
    # without changing the short, direct sentences used by Workbook 02.
    terms = [
        ("quotation profile page", "quotation details page"),
        ("quotation profiles", "quotation details"),
        ("quotation profile", "quotation details"),
        ("Quotation Profile", "Quotation Details"),
        ("QUOTATION PROFILE", "QUOTATION DETAILS"),
        ("quotation directory", "quotation history"),
        ("Quotation Directory", "Quotation History"),
        ("QUOTATION DIRECTORY", "QUOTATION HISTORY"),
        ("Quotation Type", "Customer Type"),
        ("quotation type", "customer type"),
        ("Duplicate email", "Duplicate quotation number"),
        ("duplicate email", "duplicate quotation number"),
        ("Duplicate phone", "Incorrect total"),
        ("duplicate phone", "incorrect total"),
        ("Quotation initials", "Quotation number"),
        ("quotation initials", "quotation number"),
        (
            "Quotation number generated from the quotation's first and last names.",
            "Quotation number.",
        ),
        ("First Name", "Customer Name"),
        ("first name", "customer name"),
        ("Last Name", "Customer Company"),
        ("last name", "customer company"),
        ("Job Title", "Issue Date"),
        ("job title", "issue date"),
        ("City", "Expiry Date"),
        ("Country", "Currency"),
    ]
    for old, new in terms:
        note = note.replace(old, new)

    identifier_changes = {
        "quotation_type": "status",
        "first_name": "customer_name",
        "last_name": "customer_company",
        "job_title": "issue_date",
    }
    for old, new in identifier_changes.items():
        note = note.replace(old, new)
    note = note.replace("\ncity\n", "\nexpiry_date\n")
    note = note.replace("\n• city", "\n• expiry_date")
    note = note.replace("\nstate\n", "\ndiscount_type\n")
    note = note.replace("\n• state", "\n• discount_type")
    note = note.replace("\ncountry\n", "\ncurrency\n")
    note = note.replace("\n• country", "\n• currency")
    note = note.replace("Business Quotations", "Accepted Quotations")
    note = note.replace("Business quotations", "Accepted quotations")
    note = note.replace("business quotations", "accepted quotations")
    note = note.replace("Individual Quotations", "Draft Quotations")
    note = note.replace("Individual quotations", "Draft quotations")
    note = note.replace("individual quotations", "draft quotations")
    note = note.replace("Customer Type", "Status")
    note = note.replace("customer type", "status")
    note = note.replace("\nIndividual\n", "\nDraft\n")
    note = note.replace("\nindividual\n", "\ndraft\n")
    note = note.replace("\nBusiness\n", "\nSent\n")
    note = note.replace("\nbusiness\n", "\nsent\n")
    note = note.replace("Call Quotation", "Call Customer")
    note = note.replace("call quotations", "call customers")
    note = note.replace("Email Quotation", "Email Customer")
    note = note.replace("Initials display", "Quotation numbers display")
    note = note.replace("Initials are correct", "Quotation numbers are correct")
    note = note.replace("Quotation Initials", "Quotation Number")
    note = note.replace("Initials badge", "Status badge")
    note = note.replace("View Profile", "View Quotation")
    note = note.replace("Quotation profiles", "Quotation details")
    note = note.replace("quotation profiles", "quotation details")
    note = note.replace("Profile page", "Details page")
    note = note.replace("profile page", "details page")
    note = note.replace("open a quotation details", "open quotation details")
    note = note.replace("provide better quotation service", "prepare more accurate quotations")
    note = note.replace("temporary values", "initial values of 0")
    note = note.replace("duplicate quotations", "duplicate quotation numbers")
    note = note.replace("duplicate quotation details", "duplicate quotation numbers")
    note = note.replace(
        "duplicate quotation number and phone number scenarios",
        "quotation number and incorrect total scenarios",
    )
    note = note.replace(
        "Do not save files from this project inside the Expense Tracker folder.",
        "Do not copy or save files from any other workbook inside this folder.",
    )
    note = note.replace(
        "Do not copy files from Workbook 01 into this folder.",
        "Do not copy files from any other workbook into this folder.",
    )
    note = note.replace(
        "Keep Workbook 03 completely separate from Workbook 01.",
        "Keep this project completely separate from any other workbook.",
    )

    about = """This workbook is a complete, self-contained project.

You do not need to own any of the other Prompt to Profit™ Software Workbooks to complete it successfully.

Every workbook in this series teaches you how to build one complete software application from start to finish. It contains all the explanations, prompts, instructions and practical exercises you need to complete that project independently.

Although some software development concepts naturally appear across multiple workbooks, every workbook starts from the beginning of its own project and assumes no prior knowledge of the other workbooks.

This means you can begin with this workbook even if you have not completed Workbook 01 or Workbook 02.

If your immediate need is to build a Professional Quotation Generator, you can start here.

If you later decide to build additional software, each new workbook will teach you a different business application while reinforcing the software development skills you have already learned.

Together, the workbooks form a complete software development series. Individually, each workbook is a complete learning experience."""
    note = replace_section(note, "ABOUT THIS WORKBOOK", "WELCOME", about)

    welcome = """Welcome to Prompt to Profit™ Workbook 03.

In this workbook, you will build a complete Professional Quotation Generator from the ground up using HTML, CSS, Vanilla JavaScript, Supabase and Artificial Intelligence.

Throughout this project, you will learn how to build secure, database-driven business software by following the same step-by-step development process used in real-world software projects.

You will create a professional quotation application that allows a business to enter customer details, add several quotation items, calculate totals, apply discounts and tax, save quotations, view previous quotations, edit them, delete them and print a professional quotation document.

Every feature is built one step at a time. You won't simply copy prompts into an AI tool. You'll learn why each feature is being built, how the different parts of the application work together, and how to communicate effectively with AI to build reliable software.

By the end of this workbook, you will have a fully functional Professional Quotation Generator that you can proudly include in your software development portfolio.

You will build the project using:

• HTML

• CSS

• Vanilla JavaScript

• Supabase

• ChatGPT

• Notepad

• A web browser

You do not need to install additional software.

You will continue working with complete files and clear Build Prompts.

Every new feature will preserve everything already built.

Complete the lessons in order.

Test each feature before moving forward.

Do not continue when an important feature is not working."""
    note = replace_section(note, "WELCOME", "WHAT YOU WILL BUILD", welcome)

    what = """By the end of this workbook, your Professional Quotation Generator will include:

PUBLIC WEBSITE

• Responsive navigation

• Hero section

• Business problem section

• Features section

• How It Works section

• Quotation preview

• Login and Register links

SUPABASE

• Supabase project

• Shared connection file

• Connection test page

AUTHENTICATION

• User registration

• Email verification

• User login

• Protected quotation pages

• Logout

QUOTATION DATABASE

• Secure quotations table

• Secure quotation_items table

• User-owned quotations

• Row Level Security

QUOTATION MANAGEMENT

• Create quotations

• Add and remove quotation items

• Calculate subtotals automatically

• Apply percentage or fixed discounts

• Apply tax

• Save quotations

• View previous quotations

• Search, filter and sort quotations

• Edit quotations

• Delete quotations

• Print professional quotation documents

BUSINESS DASHBOARD

• Total quotations

• Draft quotations

• Sent quotations

• Accepted quotations

• Loading, empty and error states

COMPLETION

• Complete application audit

• Two-account privacy testing

• Netlify deployment

• Live application testing

• Portfolio description

• Reflection questions

• Extension challenges"""
    note = replace_section(note, "WHAT YOU WILL BUILD", "WORKBOOK STRUCTURE", what)

    structure = """This workbook is organised into ten chapters.

Chapter 1

Building the Public Website

Chapter 2

Connecting to Supabase

Chapter 3

Building the Complete Authentication System

Chapter 4

Building the Quotation Database

Chapter 5

Building the Quotation Dashboard

Chapter 6

Viewing Quotations

Chapter 7

Searching, Filtering and Sorting Quotations

Chapter 8

Editing Quotations

Chapter 9

Printing and Deleting Quotations

Chapter 10

Final Testing and Project Completion

Complete each chapter before moving to the next.

Every chapter depends on the work completed earlier."""
    note = replace_section(note, "WORKBOOK STRUCTURE", "CHAPTER 1", structure)

    chapter_titles = {
        4: ("BUILDING THE QUOTATION DATABASE", "BUILDING THE QUOTATION DATABASE"),
        5: ("BUILDING THE QUOTATION DASHBOARD", "BUILDING THE QUOTATION DASHBOARD"),
        6: ("VIEWING QUOTATIONS", "VIEWING QUOTATIONS"),
        7: (
            "SEARCHING, FILTERING AND SORTING QUOTATIONS",
            "SEARCHING, FILTERING AND SORTING QUOTATIONS",
        ),
        8: ("EDITING QUOTATION RECORDS", "EDITING QUOTATIONS"),
        9: ("DELETING QUOTATIONS", "PRINTING AND DELETING QUOTATIONS"),
    }
    for number, (old, new) in chapter_titles.items():
        note = replace_chapter_title(note, number, old, new)

    lesson_titles = {
        (4, 1): "UNDERSTANDING THE QUOTATION DATA MODEL",
        (4, 2): "CREATING THE QUOTATIONS TABLE",
        (4, 3): "CREATING THE QUOTATION ITEMS TABLE",
        (4, 4): "ENABLING ROW LEVEL SECURITY",
        (4, 5): "CREATING THE SELECT POLICIES",
        (4, 6): "CREATING THE INSERT POLICIES",
        (4, 7): "CREATING THE UPDATE POLICIES",
        (4, 8): "CREATING THE DELETE POLICIES",
        (4, 9): "TESTING THE QUOTATION DATABASE",
        (5, 1): "DESIGNING THE QUOTATION DASHBOARD",
        (5, 2): "BUILDING THE QUOTATION FORM",
        (5, 3): "CALCULATING AND SAVING QUOTATIONS SECURELY",
        (5, 4): "BUILDING QUOTATION DASHBOARD STATISTICS",
        (6, 1): "BUILDING THE QUOTATION HISTORY",
        (6, 2): "BUILDING THE QUOTATION DETAILS PAGE",
        (6, 3): "TESTING THE QUOTATION HISTORY",
        (7, 1): "BUILDING QUOTATION SEARCH, FILTERING AND SORTING",
        (7, 2): "TESTING QUOTATION SEARCH",
        (8, 1): "BUILDING QUOTATION EDITING",
        (8, 2): "TESTING QUOTATION EDITING",
        (9, 1): "BUILDING THE PRINTABLE QUOTATION DOCUMENT",
        (9, 2): "BUILDING AND TESTING SECURE QUOTATION DELETION",
    }
    for (chapter, lesson), title in lesson_titles.items():
        note = replace_lesson_title(note, chapter, lesson, title)

    chapter_rewrites = {
        4: (
            """Your Professional Quotation Generator can now recognise who is signed in.

The next step is to create a secure database where each signed-in user can store their own quotations.

A quotation contains two kinds of information.

The first kind belongs to the complete document. This includes the quotation number, business details, customer details, dates, status, discount, tax and final total.

The second kind belongs to each item on the quotation. This includes the item description, quantity, unit price and line total.

Keeping these two kinds of information in separate tables makes it possible for one quotation to contain several items.

In this chapter, you will create both tables and protect them with Row Level Security.

Every signed-in user will be able to work only with their own quotations.""",
            """During this chapter, you will build:

• quotations table

• quotation_items table

• A relationship between both tables

• Required and optional fields

• Primary Keys

• User ownership

• Row Level Security

• SELECT policies

• INSERT policies

• UPDATE policies

• DELETE policies

• Database security testing

By the end of this chapter, your application will have a secure database capable of storing complete quotations with several items.""",
        ),
        5: (
            """Your Professional Quotation Generator now has secure database tables.

The next step is to give users a clear place to create quotations.

In this chapter, you will build the main quotation dashboard.

The form will collect business details, customer details, dates and quotation items.

JavaScript will calculate every line total, the subtotal, discount, tax and final total.

Supabase will check the important information again before saving the quotation and all its items as one complete action.

You will also add simple dashboard statistics so users can understand the quotations they have created.""",
            """During this chapter, you will build:

• A professional quotation dashboard

• Business and customer detail fields

• Multiple quotation items

• Add Item and Remove Item controls

• Automatic line totals

• Automatic subtotal

• Percentage and fixed discounts

• Tax calculation

• Final total

• Secure quotation saving

• Automatic form reset

• Quotation dashboard statistics

By the end of the chapter, users will be able to calculate and save complete quotations securely.""",
        ),
        6: (
            """A saved quotation becomes useful when the user can find it and open it easily.

At the moment, your quotations exist inside Supabase.

In this chapter, you will display them inside the application.

The dashboard will show a clear history of saved quotations.

Each quotation card will show the quotation number, customer name, dates, status and final total.

Users will also be able to open one quotation and view every item and calculation.

Loading, empty and error messages will help beginners understand what the application is doing.""",
            """During this chapter, you will build:

• Quotation History

• Quotation cards

• Quotation number

• Customer name

• Issue and expiry dates

• Status

• Final total

• View Quotation action

• Complete quotation details page

• Loading state

• Empty state

• Error state

• Responsive layouts

• Quotation privacy testing""",
        ),
        8: (
            """A saved quotation may need to change.

A customer may ask for another item.

A quantity or price may change.

The business may apply a different discount or tax rate.

The quotation status may also move from Draft to Sent or Accepted.

In this chapter, you will allow the signed-in user to load one complete quotation, change its details and items, and save every change securely.

The application will recalculate all totals inside Supabase and will never allow one user to edit another user's quotation.""",
            """During this chapter, you will build:

• Edit Quotation workflow

• Secure quotation retrieval

• Automatic form population

• Editing for all quotation items

• Add and Remove Item controls during editing

• Automatic recalculation

• Server-side total checking

• Secure database updates

• Cancel Edit action

• Automatic history and statistics refresh

• Quotation editing security tests""",
        ),
        9: (
            """Businesses need to share quotations in a clear, professional format.

They also need a safe way to remove quotations that are no longer required.

In this chapter, you will first create a clean A4 quotation document that can be printed from the browser.

The printed page will show the business details, customer details, items, discount, tax and final total.

You will then add secure quotation deletion.

Because deletion cannot easily be undone, the application will ask for confirmation and will delete only a quotation that belongs to the signed-in user.""",
            """During this chapter, you will build:

• Professional A4 quotation document

• Complete quotation item table

• Print Quotation button

• Print-only styles

• Hidden screen controls during printing

• Delete Quotation action

• Delete confirmation

• Secure quotation deletion

• Automatic quotation item deletion

• Quotation History refresh

• Dashboard statistics refresh

• Printing and deletion testing""",
        ),
    }
    for chapter, (introduction, outcomes) in chapter_rewrites.items():
        note = replace_chapter_section(
            note,
            chapter,
            "CHAPTER INTRODUCTION",
            "WHAT YOU WILL BUILD IN THIS CHAPTER",
            introduction,
        )
        note = replace_chapter_section(
            note,
            chapter,
            "WHAT YOU WILL BUILD IN THIS CHAPTER",
            "LESSON 1",
            outcomes,
        )

    note = replace_lesson_section(
        note,
        1,
        1,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """You are building software that helps a business prepare professional quotations in one organised system.

A user will be able to create an account and:

• Enter customer details

• Add several quotation items

• Enter a quantity and price for each item

• Calculate totals automatically

• Apply a discount

• Apply tax

• Save quotations

• Find previous quotations

• Edit quotations

• Delete quotations

• Print professional quotation documents

Every user's quotations will remain private.""",
    )
    note = replace_lesson_section(
        note,
        1,
        1,
        "WHY THIS MATTERS",
        "BEFORE YOU CONTINUE",
        """Many small businesses prepare quotations using documents, spreadsheets or handwritten calculations.

This can create several problems.

An item may be forgotten.

A quantity may be multiplied incorrectly.

A discount or tax amount may be calculated incorrectly.

An old quotation may be difficult to find.

Two quotations may accidentally use the same number.

A Professional Quotation Generator solves these problems by keeping quotation details and items together, completing the calculations automatically, and saving every quotation in one secure database.""",
    )

    note = replace_lesson_section(
        note,
        4,
        1,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """Before creating the database tables, it is important to understand how a quotation is organised.

One table will store information about the complete quotation.

A second table will store the individual items that appear on that quotation.

This lesson explains why both tables are needed and what information each table will store.""",
    )
    note = replace_lesson_section(
        note,
        4,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """There is nothing to build with ChatGPT in this lesson.

Study the database plan below.

QUOTATIONS TABLE

This table will store:

• The signed-in user's ID

• A unique quotation number

• Business details

• Customer details

• Issue and expiry dates

• Quotation status

• Currency

• Discount information

• Tax information

• Calculated totals

• Notes

• Created and updated dates

QUOTATION_ITEMS TABLE

This table will store:

• The quotation ID

• Item description

• Quantity

• Unit price

• Line total

• Item position

One quotation can have several quotation items.

Every quotation item must belong to one quotation.

Deleting a quotation should also delete its related items.

Row Level Security will protect both tables.""",
    )

    dashboard_design_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Registration, login, logout and dashboard protection already work.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build the complete visual structure for the quotation dashboard.

DASHBOARD.HTML

Keep authentication protection and logout.

Add:

• Dashboard header

• Welcome message using the signed-in user's email

• Four quotation statistic cards

• Create Quotation section

• Business Details section

• Customer Details section

• Quotation Details section

• Quotation Items section

• Totals section

• Save Quotation button

• Status message area

• Quotation History section

The detailed form controls and calculations will be completed in the next lesson.

DASHBOARD.JS

Keep authentication, logout and the welcome message working.

Do not connect the quotation form to Supabase yet.

AUTH.CSS

Keep every existing style.

Create a clean dashboard layout.

Keep every section readable on small screens.

IMPORTANT

Do not remove any working authentication feature.

Do not create another Supabase client.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        5,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        dashboard_design_prompt,
    )

    quotations_table_prompt = """There is nothing to build with ChatGPT in this lesson.

Instead, create the quotations table directly inside Supabase.

Open:

Table Editor

Click:

Create a new table

Name the table:

quotations

Leave Row Level Security enabled.

Create these columns:

• id — uuid — Primary Key — default value gen_random_uuid()

• user_id — uuid — required

• quotation_number — text — required

• business_name — text — required

• business_email — text — optional

• business_phone — text — optional

• business_address — text — optional

• customer_name — text — required

• customer_email — text — optional

• customer_phone — text — optional

• customer_address — text — optional

• issue_date — date — required

• expiry_date — date — required

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

Review every column carefully.

Then click:

Save

Do not add quotation items to this table.

The items will have their own table in the next lesson."""
    note = replace_lesson_section(
        note,
        4,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        quotations_table_prompt,
    )

    quotation_items_prompt = """There is nothing to build with ChatGPT in this lesson.

Create a second table directly inside Supabase.

Open:

Table Editor

Click:

Create a new table

Name the table:

quotation_items

Leave Row Level Security enabled.

Create these columns:

• id — uuid — Primary Key — default value gen_random_uuid()

• quotation_id — uuid — required

• description — text — required

• quantity — numeric — required

• unit_price — numeric — required

• line_total — numeric — required

• position — integer — required — default value 0

• created_at — timestamp with time zone — required — default value now()

Create a relationship from:

quotation_items.quotation_id

to:

quotations.id

Choose:

Delete related records when the quotation is deleted.

This is also called:

ON DELETE CASCADE

Review every column and the relationship carefully.

Then click:

Save

The quotations table stores the main document.

The quotation_items table stores every line on that document.

One quotation can therefore contain several items."""
    note = replace_lesson_section(
        note,
        4,
        3,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        quotation_items_prompt,
    )

    rls_prompt = """There is nothing to build with ChatGPT in this lesson.

Open your Supabase project.

Open:

Table Editor

Select:

quotations

Confirm that:

Row Level Security

is enabled.

Now select:

quotation_items

Confirm that Row Level Security is also enabled.

If Row Level Security is already enabled, do not change anything.

Do not disable it on either table."""
    note = replace_lesson_section(
        note,
        4,
        4,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        rls_prompt,
    )

    policy_details = {
        5: (
            "SELECT",
            "view",
            "USING",
        ),
        6: (
            "INSERT",
            "add",
            "WITH CHECK",
        ),
        7: (
            "UPDATE",
            "update",
            "USING and WITH CHECK",
        ),
        8: (
            "DELETE",
            "delete",
            "USING",
        ),
    }
    for lesson_number, (operation, verb, policy_part) in policy_details.items():
        policy_prompt = f"""There is nothing to build with ChatGPT in this lesson.

Create the {operation} policy for the quotations table first.

Open:

Authentication

Then:

Policies

Locate:

quotations

Create a new {operation} policy.

Use:

user_id = auth.uid()

in the correct {policy_part} section.

For UPDATE, use the ownership check in both USING and WITH CHECK.

Save the policy.

Now create the matching {operation} policy for:

quotation_items

The quotation_items table does not contain user_id.

It must check the quotation that owns the item.

Use an EXISTS check that confirms:

• quotation_items.quotation_id matches quotations.id

• quotations.user_id matches auth.uid()

This allows a signed-in user to {verb} items only when the parent quotation belongs to them.

Ask ChatGPT to explain the policy if you are unsure.

If you ask ChatGPT to prepare SQL, request one complete SQL file.

Do not request a snippet.

Review both policies before saving them."""
        note = replace_lesson_section(
            note,
            4,
            lesson_number,
            "BUILD PROMPT",
            "WHAT AI SHOULD RETURN",
            policy_prompt,
        )

    calculation_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Everything built so far must continue working exactly as before.

Continue using the existing project architecture, including the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build the complete quotation form and automatic calculation system.

DASHBOARD.HTML

Keep everything already built.

The form must include:

• A message explaining that the quotation number will be generated when the quotation is saved

• Business name

• Business email

• Business phone

• Business address

• Customer name

• Customer email

• Customer phone

• Customer address

• Issue date

• Expiry date

• Status

• Currency

• Notes

Add a quotation items section.

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

Keep authentication, logout and dashboard protection working.

Allow users to add and remove item rows.

Always keep at least one item row.

Recalculate every line total when quantity or unit price changes.

Recalculate the complete quotation when an item, discount or tax value changes.

Support:

• No discount

• Percentage discount

• Fixed discount

Apply tax after the discount.

Do not allow negative values.

Do not allow zero quantity.

Do not allow the discount to make the final total negative.

Display money values to two decimal places.

Do not save anything to Supabase in this lesson.

AUTH.CSS

Keep every existing style.

Style the form, item rows, totals and buttons clearly.

Keep the complete form readable on small screens.

IMPORTANT

Return complete updated files only.

Do not return snippets or partial code.

Do not remove any feature that already works."""
    note = replace_lesson_section(
        note,
        5,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        calculation_prompt,
    )

    saving_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

The complete quotation form and automatic calculations already work.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Create or update only:

• save-quotation-function.sql

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Save one complete quotation and all its items securely.

SAVE-QUOTATION-FUNCTION.SQL

Create one complete Supabase PostgreSQL function named:

save_quotation_with_items

The function must:

• Require an authenticated user

• Accept the quotation details and a JSON array of items

• Validate that at least one item exists

• Validate every description, quantity and unit price

• Generate a quotation number that is unique for the signed-in user

• Recalculate every line total inside Supabase

• Recalculate subtotal, discount, tax and final total inside Supabase

• Never trust totals received from the browser

• Insert the quotation

• Insert all quotation items

• Complete both inserts as one database action

• Leave no partly saved quotation if an error occurs

Use auth.uid() for ownership.

Restrict function access to authenticated users.

DASHBOARD.JS

Keep the form and live calculations working.

When the user selects Save Quotation:

• Validate all required quotation fields

• Validate every item

• Confirm the user is signed in

• Call save_quotation_with_items

• Disable the Save Quotation button while saving

• Display a friendly saving message

• Display a friendly success or error message

• Clear the form only after a successful save

• Refresh quotation history and dashboard statistics

Do not display raw database errors to the user.

Use console.error() for technical details.

IMPORTANT

Return all four complete files.

Do not return snippets or partial code.

Do not create another Supabase client.

Do not calculate trusted totals only in the browser."""
    note = replace_lesson_section(
        note,
        5,
        3,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        saving_prompt,
    )

    statistics_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Creating and saving complete quotations already works.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Calculate and display live quotation statistics on the dashboard.

Use four statistic cards:

• Total Quotations

• Draft Quotations

• Sent Quotations

• Accepted Quotations

DASHBOARD.JS

After authentication succeeds, retrieve only quotations belonging to the signed-in user.

Count all quotations for Total Quotations.

Count quotations whose status is draft.

Count quotations whose status is sent.

Count quotations whose status is accepted.

Display 0 when no quotations exist.

Refresh all four cards:

• When the dashboard opens

• After a quotation is saved

• After a quotation is edited

• After a quotation is deleted

Handle loading and errors with friendly messages.

Use console.error() for technical details.

AUTH.CSS

Keep every existing style.

Style the four cards clearly.

Keep them readable on small screens.

IMPORTANT

Continue relying on Row Level Security.

Do not retrieve another user's quotations.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        5,
        4,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        statistics_prompt,
    )

    history_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Creating quotations and dashboard statistics already work.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Replace the Quotation History placeholder with a complete list of saved quotations.

DASHBOARD.JS

Retrieve only quotations belonging to the signed-in user.

Order them by created_at, with the newest first.

Display one card for each quotation.

Every card must show:

• Quotation number

• Customer name

• Issue date

• Expiry date

• Status

• Final total with currency

Add a View Quotation button linking to:

quotation-profile.html?id=QUOTATION_ID

Pass only the quotation ID in the page address.

Create separate loading, empty and error areas.

Display only one area at a time.

If there are no quotations, display:

You haven't created any quotations yet.

Create your first quotation using the form above.

Refresh the history after a quotation is saved, edited or deleted.

Do not create duplicate cards during refresh.

Display database information safely.

Do not insert untrusted information as unsafe HTML.

AUTH.CSS

Keep every existing style.

Style the quotation cards and status labels.

Keep the history easy to read on small screens.

IMPORTANT

Continue relying on Row Level Security.

Do not retrieve another user's quotations.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        6,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        history_prompt,
    )

    details_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

The Quotation History already links to the protected quotation details page.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• quotation-profile.html

• quotation-profile.js

• auth.css

GENERAL GOAL

Build the complete quotation details page.

QUOTATION-PROFILE.JS

Confirm that the user is signed in.

Read the quotation ID from:

quotation-profile.html?id=QUOTATION_ID

If no ID exists, display a friendly message and do not contact Supabase.

Retrieve one quotation where:

• id matches the page address

• user_id matches the signed-in user

Retrieve all quotation_items belonging to that quotation.

Order the items by position.

Continue relying on Row Level Security.

Do not reveal whether another user owns an unavailable quotation.

QUOTATION-PROFILE.HTML

Display:

• Quotation number

• Issue date

• Expiry date

• Status

• Customer name

• Customer email

• Customer phone

• Customer address

• Every quotation item

• Subtotal

• Discount

• Tax

• Final total

• Currency

• Notes

Add:

• Edit Quotation

• Back to Dashboard

• Logout

Create separate loading, unavailable, error and content areas.

Display money values to two decimal places.

Display dates in a clear format.

Display database information safely.

Do not insert untrusted information as unsafe HTML.

AUTH.CSS

Keep every existing style.

Create a clean and responsive quotation document layout.

IMPORTANT

Do not create another Supabase client.

Do not retrieve another user's quotation.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        6,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        details_prompt,
    )

    edit_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Creating, saving, viewing and printing quotations already work.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Create or update only:

• update-quotation-function.sql

• dashboard.html

• dashboard.js

• quotation-profile.js

• auth.css

GENERAL GOAL

Allow the signed-in user to edit one complete quotation and all its items.

UPDATE-QUOTATION-FUNCTION.SQL

Create one complete Supabase PostgreSQL function named:

update_quotation_with_items

The function must:

• Require an authenticated user

• Accept the quotation ID, quotation details and a JSON array of items

• Confirm the quotation belongs to auth.uid()

• Validate that at least one item exists

• Validate every description, quantity and unit price

• Recalculate line totals, subtotal, discount, tax and final total inside Supabase

• Update the main quotation

• Replace its saved items with the new complete item list

• Complete all changes as one database action

• Leave the original quotation unchanged if any part fails

• Update updated_at without changing created_at

Restrict function access to authenticated users.

DASHBOARD.JS

Read the edit ID from:

dashboard.html?edit=QUOTATION_ID

Load only the signed-in user's quotation and its items.

Fill the existing form.

Do not create a second form.

Allow the user to add, change and remove items.

Keep live calculations working.

Change Save Quotation to Update Quotation during edit mode.

Add a Cancel Edit button.

When Update Quotation is selected:

• Validate the complete form

• Confirm the user is signed in

• Call update_quotation_with_items

• Display friendly saving, success and error messages

• Return to normal create mode after success

• Refresh quotation history and dashboard statistics

Do not display raw database errors.

Use console.error() for technical details.

IMPORTANT

Do not create another Supabase client.

Do not allow one user to edit another user's quotation.

Return all five complete files.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        8,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        edit_prompt,
    )

    # Add the project-specific capabilities to the inherited full-file prompts.
    note = note.replace(
        "Create the quotations table.",
        "Create the quotations table. Store the signed-in user's ID, quotation "
        "number, customer details, dates, status, currency, discount, tax, notes "
        "and calculated totals.",
    )
    note = note.replace(
        "Improve the quotations table with database constraints.",
        "Create a quotation_items table connected to quotations. Each item must "
        "store its description, quantity, unit price and line total. Add rules "
        "that prevent negative quantities or prices.",
    )
    note = note.replace(
        "Enable Row Level Security on the quotations table.",
        "Enable Row Level Security on both the quotations and quotation_items tables.",
    )
    note = note.replace(
        "Create a secure SELECT policy for the quotations table.",
        "Create secure SELECT policies for both tables. A signed-in user may read "
        "only their own quotations and the items belonging to those quotations.",
    )
    note = note.replace(
        "Create a secure INSERT policy for the quotations table.",
        "Create secure INSERT policies for both tables. A signed-in user may add "
        "only their own quotations and items belonging to those quotations.",
    )
    note = note.replace(
        "Create a secure UPDATE policy for the quotations table.",
        "Create secure UPDATE policies for both tables. Include authenticated "
        "ownership checks in both USING and WITH CHECK.",
    )
    note = note.replace(
        "Create a secure DELETE policy for the quotations table.",
        "Create secure DELETE policies for both tables. A signed-in user may "
        "delete only their own quotations and items belonging to those quotations.",
    )

    # Every prompt continues to ask for complete files, as in Workbook 02.
    note = re.sub(
        r"Return complete updated versions of the files\.",
        "Return complete updated versions of the files.\n\n"
        "Do not return snippets or partial code.",
        note,
    )
    note = re.sub(
        r"Return complete updated files\.",
        "Return complete updated files.\n\nDo not return snippets or partial code.",
        note,
    )

    note = note.replace(
        "The quotation details page should display every available piece of quotation information.",
        "The quotation details page should display the customer details, every "
        "quotation item, subtotal, discount, tax, final total, status, dates and notes.",
    )
    note = note.replace(
        "The edit form should contain every quotation field.",
        "The edit form should contain every quotation field and every quotation "
        "item. The user must be able to add, change and remove items. Recalculate "
        "and save the complete quotation as one action.",
    )

    print_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Users can open a saved quotation and view its complete details.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• quotation-profile.html

• quotation-profile.js

• auth.css

GENERAL GOAL

Build a professional A4 quotation document that the user can print.

QUOTATION-PROFILE.HTML

Keep every feature that already works.

Add a Print Quotation button.

Create a quotation document area containing:

• Business details

• Quotation number

• Issue date

• Expiry date

• Status

• Customer details

• Every quotation item

• Subtotal

• Discount

• Tax

• Final total

• Notes

QUOTATION-PROFILE.JS

Load the quotation only when it belongs to the signed-in user.

Load all items belonging to that quotation.

Display the items in their saved position.

Display every money value to two decimal places.

When Print Quotation is selected, open the browser print window.

AUTH.CSS

Keep every existing style.

Add print styles using:

@media print

Use a clean A4 layout.

Hide navigation, editing controls, buttons and screen-only messages during printing.

Keep the quotation document visible.

Prevent item rows from breaking awkwardly across printed pages.

IMPORTANT

Do not create another Supabase client.

Do not allow one user to print another user's quotation.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        9,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        print_prompt,
    )
    note = replace_lesson_section(
        note,
        9,
        1,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """In this lesson, you will build a professional quotation document that can be printed from the browser.

The document will show the complete quotation in a clean A4 layout.

Screen controls will disappear during printing so the customer sees only the quotation itself.""",
    )
    note = replace_lesson_section(
        note,
        9,
        1,
        "WHY THIS MATTERS",
        "BEFORE YOU CONTINUE",
        """A quotation may look clear on a computer screen but print badly on paper.

Navigation menus, buttons and narrow layouts do not belong on a professional document.

Print styles allow the same quotation page to become a clean business document when the user selects Print Quotation.""",
    )
    note = replace_lesson_section(
        note,
        9,
        1,
        "BEFORE YOU CONTINUE",
        "BUILD PROMPT",
        """Confirm that:

✓ Quotation details load correctly.

✓ Every quotation item appears.

✓ Subtotal, discount, tax and final total are correct.

✓ The quotation belongs to the signed-in user.

✓ Row Level Security remains enabled.""",
    )

    print_test = """Open a saved quotation that contains several items.

Confirm that:

✓ Business details appear.

✓ Customer details appear.

✓ Quotation number and dates appear.

✓ Every quotation item appears.

✓ Subtotal, discount, tax and final total are correct.

Select:

Print Quotation

Confirm that:

✓ The browser print window opens.

✓ The quotation fits a clean A4 layout.

✓ Navigation and buttons are hidden.

✓ No important information is cut off.

Cancel the print window.

Confirm that the normal screen layout still works."""
    note = replace_lesson_section(
        note,
        9,
        1,
        "TEST YOUR WORK",
        "CHECKPOINT",
        print_test,
    )

    delete_prompt = """PROJECT STATE

I already have a working Professional Quotation Generator.

Printing, editing and viewing quotations already work.

Everything built so far must continue working exactly as before.

Continue using the shared supabaseClient from supabase-config.js.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• quotation-profile.html

• quotation-profile.js

• dashboard.js

• auth.css

GENERAL GOAL

Build the complete secure quotation deletion workflow.

Add a Delete Quotation button to the quotation details page.

Ask for confirmation before deleting.

If the user cancels, stop immediately.

If the user confirms:

• Confirm the user is signed in

• Delete only the quotation with the current ID

• Include the signed-in user's ID in the delete request

• Continue relying on Row Level Security

• Allow ON DELETE CASCADE to remove the related quotation items

After a successful deletion:

• Display a friendly success message

• Return to dashboard.html

• Refresh quotation history

• Refresh dashboard statistics

Handle errors with a friendly message.

Use console.error() for technical details.

Do not display raw database errors.

Do not allow one user to delete another user's quotation.

Return complete updated files only.

Do not return snippets or partial code."""
    note = replace_lesson_section(
        note,
        9,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        delete_prompt,
    )
    note = replace_lesson_section(
        note,
        9,
        2,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """In this lesson, you will build and test secure quotation deletion.

The user will be able to delete one quotation after confirming the action.

The related quotation items will be removed automatically.

The Quotation History and dashboard statistics will then refresh.""",
    )
    note = replace_lesson_section(
        note,
        9,
        2,
        "WHY THIS MATTERS",
        "BEFORE YOU CONTINUE",
        """Deleting information is permanent.

A professional application should never remove a quotation because of one accidental click.

Confirmation, authenticated ownership checks and Row Level Security work together to protect the user's information.""",
    )
    note = replace_lesson_section(
        note,
        9,
        2,
        "WHAT AI SHOULD RETURN",
        "SAVE YOUR FILES",
        """ChatGPT should return complete updated versions of:

• quotation-profile.html

• quotation-profile.js

• dashboard.js

• auth.css

The application should now support secure quotation deletion.""",
    )
    note = replace_lesson_section(
        note,
        9,
        2,
        "SAVE YOUR FILES",
        "TEST YOUR WORK",
        """Replace the complete contents of every updated file.

Save each file.

Do not change the file names.""",
    )

    # Correct the closing pages so they describe the finished quotation workflow.
    final_testing = """Before considering this workbook complete, perform one final review.

Create a completely new user account.

Begin with an empty quotation database.

Work through the application exactly as a first-time business user would.

Complete the following journey:

✓ Register

✓ Verify email

✓ Sign in

✓ Create a quotation with several items

✓ Check the subtotal

✓ Apply a discount

✓ Apply tax

✓ Save the quotation

✓ Open the quotation details

✓ Search, filter and sort quotations

✓ Edit one quotation

✓ Print one quotation

✓ Delete one quotation

✓ Sign out

✓ Sign in again

Confirm that every remaining quotation still exists and every dashboard statistic is correct.

If every step succeeds without unexpected errors, your Professional Quotation Generator is ready to be published."""
    note = replace_section(note, "FINAL TESTING", "GOING LIVE", final_testing)

    note = note.replace(
        "• Quotation creation\n\n• Quotation editing\n\n• Quotation deletion\n\n"
        "• Quotation search\n\n• Quotation details",
        "• Quotation creation\n\n• Automatic calculations\n\n• Quotation editing\n\n"
        "• Quotation printing\n\n• Quotation deletion\n\n• Quotation search\n\n"
        "• Quotation details",
    )

    portfolio = """Congratulations.

You have successfully built a fully functional Professional Quotation Generator.

Your application demonstrates practical software development skills including:

• User authentication

• Database design

• Secure quotation management

• Multiple quotation items

• Automatic totals, discounts and tax

• Create, read, update and delete operations

• Search and filtering

• Professional print layouts

• Responsive design

• Database security using Row Level Security

This project is an excellent addition to your software development portfolio because it solves a genuine business problem and demonstrates that you can build secure, data-driven applications using Artificial Intelligence."""
    note = replace_section(
        note, "PORTFOLIO DESCRIPTION", "REFLECTION QUESTIONS", portfolio
    )

    extensions = """If you would like to improve your Professional Quotation Generator further, consider adding some of these features.

• Business logo upload

• Customer list

• Product and service list

• Quotation approval

• Quotation expiry reminders

• Email delivery

• PDF download

• More currencies

• Convert an accepted quotation into an invoice

• Quotation activity log

Do not attempt to build every feature immediately.

Choose one feature at a time and treat it as a separate software project."""
    note = replace_section(note, "EXTENSION CHALLENGES", "NEXT WORKBOOK", extensions)

    next_workbook = """Excellent work.

You have completed Workbook 03 of the Prompt to Profit™ Software Workbook Series.

You have built software that allows a business to create, calculate, save, find, edit, print and delete professional quotations.

You have also protected every quotation using user authentication and Row Level Security.

The title and project for Workbook 04 will be introduced separately.

For now, take time to review what you have built and make sure every important feature works correctly.

Congratulations once again on completing your Professional Quotation Generator."""
    note = re.sub(
        rf"{re.escape(SEP)}\nNEXT WORKBOOK\n{re.escape(SEP)}\n[\s\S]*$",
        section("NEXT WORKBOOK", next_workbook),
        note,
    )

    # Remove accidental duplicate prompt rules created when the source already
    # contained both sentences.
    note = note.replace(
        "Do not return snippets or partial code.\n\n"
        "Do not return snippets or partial code.",
        "Do not return snippets or partial code.",
    )
    # Workbook 02 questions have already served their purpose as structural
    # placeholders. Recreate them from Workbook 03's final lesson titles and
    # final returned files so each question describes the quotation capability
    # actually built in that lesson.
    note = re.sub(
        rf"(?ms)^CODE-READING QUESTION\s*\n.*?"
        rf"^{re.escape(SEP)}\s*\n(?=WHAT YOU LEARNED)",
        "",
        note,
    )
    # Front-matter replacements above intentionally rebuild Workbook 03's
    # project-specific opening pages. Reapply the permanent learner-support
    # template afterwards so it cannot be removed by those replacements.
    note = apply_learner_support(note)
    return note


def audit(note: str) -> None:
    required = [
        "ABOUT THIS WORKBOOK",
        "WELCOME",
        "FINAL TESTING",
        "GOING LIVE",
        "PORTFOLIO DESCRIPTION",
        "REFLECTION QUESTIONS",
        "EXTENSION CHALLENGES",
        "NEXT WORKBOOK",
        "quotation_items",
        "Row Level Security",
        "Do not return snippets or partial code.",
        "LEARNER SUPPORT TOOLKIT",
        "VISUAL GLOSSARY",
        "MY ERROR LOG",
        "CODE-READING QUESTION",
    ]
    for text in required:
        if text not in note:
            raise RuntimeError(f"Missing required content: {text}")
    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") < 36:
        raise RuntimeError("Every lesson must retain the locked lesson structure")
    if "VS Code" in note or "React" in note or "Node.js" in note:
        raise RuntimeError("Unsupported development tools found")


def main() -> None:
    note = make_note()
    audit(note)
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
