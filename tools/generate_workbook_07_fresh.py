#!/usr/bin/env python3
"""Generate Workbook 07 from the locked Workbook 02 beginner standard."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_learner_support_standard import apply_standard as apply_learner_support
from generate_workbook_04_fresh import SEP, replace_chapter_section


SOURCE = Path(
    "/Users/tochukwunkwocha/Desktop/PTP New Lessons/"
    "2 - Customer Record Management System.notepad"
)
OUTPUT = Path(
    "deliverables/supplier-management-system-workbook/"
    "7 - Supplier Management System.notepad"
)


def transform_project(note: str) -> str:
    replacements = (
        ("PROMPT TO PROFIT™ WORKBOOK 02", "PROMPT TO PROFIT™ WORKBOOK 07"),
        ("Workbook 02", "Workbook 07"),
        ("WORKBOOK 02", "WORKBOOK 07"),
        ("CUSTOMER RECORD MANAGEMENT SYSTEM", "SUPPLIER MANAGEMENT SYSTEM"),
        ("Customer Record Management System", "Supplier Management System"),
        ("customer-management-system", "supplier-management-system"),
        ("customer-profile.html", "supplier-details.html"),
        ("customer-profile.js", "supplier-details.js"),
        ("CUSTOMER-PROFILE", "SUPPLIER-DETAILS"),
        ("Customer Profile", "Supplier Details"),
        ("CUSTOMER PROFILE", "SUPPLIER DETAILS"),
        ("customer profile", "supplier details"),
        ("Customer Directory", "Supplier Directory"),
        ("CUSTOMER DIRECTORY", "SUPPLIER DIRECTORY"),
        ("customer directory", "supplier directory"),
        ("customer_type", "supplier_category"),
        ("first_name", "supplier_name"),
        ("last_name", "contact_person"),
        ("job_title", "payment_terms"),
        ("company", "products_services"),
        ("Customer Type", "Supplier Category"),
        ("CUSTOMER TYPE", "SUPPLIER CATEGORY"),
        ("customer type", "supplier category"),
        ("First Name", "Supplier Name"),
        ("FIRST NAME", "SUPPLIER NAME"),
        ("first name", "supplier name"),
        ("Last Name", "Contact Person"),
        ("LAST NAME", "CONTACT PERSON"),
        ("last name", "contact person"),
        ("Job Title", "Payment Terms"),
        ("JOB TITLE", "PAYMENT TERMS"),
        ("job title", "payment terms"),
        ("Company", "Products or Services"),
        ("COMPANY", "PRODUCTS OR SERVICES"),
        ("customer records", "supplier records"),
        ("Customer records", "Supplier records"),
        ("CUSTOMER RECORDS", "SUPPLIER RECORDS"),
        ("customer record", "supplier record"),
        ("Customer record", "Supplier record"),
        ("CUSTOMER RECORD", "SUPPLIER RECORD"),
        ("customer_id", "supplier_id"),
        ("Customer ID", "Supplier ID"),
        ("customer ID", "supplier ID"),
        ("customers", "suppliers"),
        ("Customers", "Suppliers"),
        ("CUSTOMERS", "SUPPLIERS"),
        ("customer", "supplier"),
        ("Customer", "Supplier"),
        ("CUSTOMER", "SUPPLIER"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def replace_opening(note: str) -> str:
    about_replacements = (
        (
            "If your immediate need is to build a Quotation Generator, you can start with that workbook.",
            "If your immediate need is to organise supplier information, you can start with this workbook.",
        ),
        (
            "If you need a Supplier Record Management System, you can begin with this workbook.",
            "You do not need to complete any other workbook before beginning.",
        ),
        (
            "\n\nIf you need a Supplier Management System, you can begin with this workbook.\n\n",
            "\n\n",
        ),
    )
    for old, new in about_replacements:
        note = note.replace(old, new)

    overview = """By the end of this workbook, your Supplier Management System will include:

PUBLIC WEBSITE

• Responsive navigation

• Hero, business problem and features sections

• A simple How It Works section

• Supplier dashboard preview

• Login and Register links

SUPABASE AND AUTHENTICATION

• Supabase project and shared connection file

• Registration and email verification

• Login, protected pages and logout

• Hosted HTTPS authentication testing

SUPPLIER DATABASE

• Secure suppliers table

• Supplier name and contact person

• Email, phone and address information

• Supplier category

• Products or services supplied

• Payment terms and notes

• Created and updated dates

• Row Level Security and ownership policies

SUPPLIER MANAGEMENT

• Add and view suppliers

• Open complete supplier details

• Search, filter and sort suppliers

• Edit and delete supplier records

• Prevent duplicate email addresses and phone numbers

• Click-to-call and click-to-email actions

BUSINESS DASHBOARD

• Total Suppliers

• Suppliers Added Today

• New Suppliers This Month

• Service Suppliers

COMPLETION

• Complete application audit

• Two-account privacy testing

• Final Netlify deployment

• Portfolio description, reflection and extension challenges"""
    note, count = re.subn(
        rf"(?ms)^WHAT YOU WILL BUILD\s*\n.*?(?=^WORKBOOK STRUCTURE\s*$)",
        f"WHAT YOU WILL BUILD\n{SEP}\n\n{overview}\n\n{SEP}\n\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace the opening project overview")

    note = replace_chapter_section(
        note,
        1,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Every useful business application begins with a clear purpose.

A Supplier Management System helps a business keep important supplier information together instead of searching through notebooks, messages and separate files.

Before building the private supplier area, you will create a simple public website that explains the problem and introduces the solution.

This chapter begins gently. You will create the project folder, build the landing page, style it and add responsive navigation.

You will continue using only HTML, CSS, Vanilla JavaScript, Notepad and a web browser.""",
    )
    return note


def replace_supplier_model(note: str) -> str:
    note = replace_chapter_section(
        note,
        4,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Your Supplier Management System can now recognise the person who is signed in.

The next step is to create a secure database where each signed-in user can store their own supplier records.

One supplier record will keep the supplier's name, contact person, contact details, category, products or services, payment terms, address and notes together.

Some information will be required. Other information will remain optional because a business may not know every detail when a supplier is first added.

You will also use Row Level Security so each account can work only with its own supplier records.""",
    )
    note = replace_chapter_section(
        note,
        4,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• A suppliers table

• A practical supplier data model

• Required and optional fields

• Consistent supplier categories

• User ownership

• Row Level Security

• SELECT, INSERT, UPDATE and DELETE policies

• Database security testing

By the end of this chapter, the application will have a secure place for complete supplier profiles.""",
    )

    replacements = (
        (
            "Individual\n\nor\n\nBusiness",
            "Goods\n\nServices\n\nLogistics\n\nProfessional Services\n\nOther",
        ),
        (
            "will always contain one of these values:\n\nIndividual\n\nBusiness",
            "will always contain one of these values:\n\nGoods\n\nServices\n\nLogistics\n\nProfessional Services\n\nOther",
        ),
        (
            "Do not use variations such as:\n\nindividual\n\nbusiness\n\nProducts or Services\n\nCorporate\n\nPerson\n\nSupplier",
            "Do not create several spellings for the same category. Always use the exact category choices shown in the application.",
        ),
        (
            "Why might a business supplier include a products_services name while an individual supplier does not?",
            "Why should the application use the same supplier category choices every time?",
        ),
        (
            "Why supplier records contain richer information than expense records",
            "Why supplier profiles need more than a name and phone number",
        ),
        (
            "Unlike the Expense Tracker, where each row represented one transaction, every row in this table represents one supplier.",
            "Every row in this table represents one complete supplier profile.",
        ),
        (
            "Unlike the Expense Tracker in Workbook 01, this application stores much richer information.",
            "A supplier profile stores several related pieces of business information.",
        ),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def polish_supplier_workflows(note: str) -> str:
    replacements = (
        ("Supplier Record Management System", "Supplier Management System"),
        ("supplier record management", "supplier management"),
        ("Supplier record management", "Supplier management"),
        ("supplier profiles", "supplier details"),
        ("Supplier profiles", "Supplier details"),
        ("supplier profile", "supplier details"),
        ("Supplier profile", "Supplier details"),
        ("Goods Suppliers", "Goods Suppliers"),
        ("Individual Suppliers", "Goods Suppliers"),
        ("Individual suppliers", "Goods suppliers"),
        ("individual suppliers", "goods suppliers"),
        ("Business Suppliers", "Service Suppliers"),
        ("Business suppliers", "Service suppliers"),
        ("business suppliers", "service suppliers"),
        ("• Individual", "• Goods\n\n• Services\n\n• Logistics\n\n• Professional Services\n\n• Other"),
        ("Return Supplier Category to its default value.", "Return Supplier Category to its default value."),
        ("Search by name, products_services, phone or email", "Search by supplier name, contact person, products or services, phone or email"),
        ("Search by products_services", "Search by products or services"),
        ("Searching by products_services works.", "Searching by products or services works."),
        ("Supplier initials", "Supplier initials"),
        ("supplier's supplier and contact person names", "supplier name"),
        ("supplier and contact person names", "supplier name and contact person"),
        ("the supplier's supplier name", "the supplier name"),
        ("supplier's supplier name", "supplier name"),
        ("Supplier name and contact person", "Supplier name and contact person"),
        ("Products or Services information", "Products or services information"),
        ("products_services information", "products or services information"),
        ("products_services name", "products or services"),
        ("products_services when available", "products or services when available"),
        ("supplier type", "supplier category"),
        ("Supplier type", "Supplier category"),
        ("professional CRM software", "professional supplier management software"),
        ("professional CRM systems", "professional supplier management systems"),
        ("Supplier Relationship Management (CRM)", "supplier management"),
        ("supplier Relationship Management (CRM)", "supplier management"),
        (
            "A supplier may change their phone number, move to a new address, join a different products or services or update their email address.",
            "A supplier may change its phone number, contact person, address, products or services, payment terms or email address.",
        ),
        (
            "• Move to another city.\n\n• Start working for a different products or services.",
            "• Move to another address.\n\n• Change the products or services supplied.",
        ),
        ("Call Supplier", "Call Contact"),
        ("Email Supplier", "Email Contact"),
        ("supplier initials generated from the supplier's supplier and contact person names", "supplier initials generated from the supplier name"),
        ("Supplier Added Today", "Suppliers Added Today"),
        ("New Supplier This Month", "New Suppliers This Month"),
        ("Now add another Business supplier.", "Now add another Services supplier."),
        ("equals:\n\nBusiness", "equals:\n\nServices"),
        ("• Other\n\n• Business", "• Other"),
        ("• Full Name", "• Contact Person"),
        ("• View Profile button", "• View Details button"),
        ("• View Profile buttons", "• View Details buttons"),
        ("• View Profile action", "• View Details action"),
        ("View Profile", "View Details"),
        ("Profile pages remain readable.", "Supplier details pages remain readable."),
        ("open a supplier details", "open a supplier details page"),
        ("Open a supplier details.", "Open a supplier details page."),
        ("one complete supplier details", "one complete supplier record"),
        ("detailed supplier details", "complete supplier information"),
        ("open individual supplier details", "open each supplier's complete details"),
        ("building the supplier details", "building the supplier details page"),
        ("BUILDING THE SUPPLIER DETAILS", "BUILDING THE SUPPLIER DETAILS PAGE"),
        ("Supplier Detailss", "Supplier Details pages"),
        ("• Job title", "• Payment terms"),
        ("provide better supplier service", "work with suppliers more effectively"),
        ("• Slow supplier service", "• Slow purchasing decisions"),
        ("supplier's first and contact persons", "supplier name"),
        ("A dedicated profile page", "A dedicated supplier details page"),
        ("exactly as a first-time supplier would", "exactly as a first-time user would"),
        ("opens a supplier details", "opens a supplier details page"),
        ("complete detailss", "complete details"),
        ("• Start working for a different products_services.", "• Change the products or services it supplies."),
        ("join a different products_services", "change the products or services it supplies"),
        ("update their email address", "update its email address"),
        ("Companies grow.", "Supplier arrangements change."),
        (
            "Imagine one supplier record contains:\n\nBusiness\n\nAnother contains:\n\nbusiness\n\nAnother contains:\n\nProducts or Services\n\nAnother contains:\n\nCorporate",
            "Imagine one supplier record contains:\n\nServices\n\nAnother contains:\n\nservices\n\nAnother contains:\n\nService Provider\n\nAnother contains:\n\nProfessional",
        ),
        (
            "For example:\n\nBusiness\n\nbusiness\n\nBUSINESS\n\nProducts or Services\n\nCorporate",
            "For example:\n\nServices\n\nservices\n\nSERVICES\n\nService Provider\n\nProfessional",
        ),
    )
    for old, new in replacements:
        note = note.replace(old, new)

    # Remove references to other projects. Every workbook must stand alone.
    note = re.sub(
        r"(?ms)^Unlike another project,.*?(?=^Instead of|^Every row|^For example)",
        "",
        note,
    )
    note = note.replace(
        "This means you can begin with this workbook even if you have not completed Workbook 01 or Workbook 02.",
        "This means you can begin with this workbook even if you have not completed any other workbook.",
    )
    return note


def replace_final_pages(note: str) -> str:
    next_workbook = """Excellent work.

You have completed Workbook 07 of the Prompt to Profit™ Software Workbook Series.

You have built a secure Supplier Management System that allows a business to organise supplier details, search records, review useful statistics, edit information and remove unwanted records.

The next project in the series is Workbook 08 — Order Management System.

For now, review what you have built and make sure every important feature works correctly.

Congratulations once again on completing your Supplier Management System."""
    note, count = re.subn(
        rf"(?ms)^NEXT WORKBOOK\s*\n{re.escape(SEP)}\n.*$",
        f"NEXT WORKBOOK\n{SEP}\n\n{next_workbook}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace the Next Workbook section")

    note = note.replace("• Supplier profile photographs", "• Supplier logos")
    note = note.replace("• Supplier birthdays", "• Contract renewal dates")
    note = note.replace("• Favourite suppliers", "• Preferred supplier status")
    note = note.replace("• Supplier interaction history", "• Supplier communication history")
    note = note.replace("• Supplier follow-up reminders", "• Order and delivery reminders")
    note = note.replace("• Supplier document uploads", "• Supplier document and contract uploads")
    return note


def clean_language(note: str) -> str:
    replacements = (
        ("an Supplier", "a Supplier"),
        ("an supplier", "a supplier"),
        ("A supplier may change their", "A supplier may change its"),
        ("supplier information securely", "supplier information securely"),
        ("Supplier management application", "supplier management application"),
        ("Supplier details page page", "Supplier details page"),
        ("supplier details page page", "supplier details page"),
        ("Supplier Details Page Page", "Supplier Details Page"),
        ("supplier detailss", "supplier details"),
        ("Supplier detailss", "Supplier details"),
        ("SUPPLIER DETAILSS", "SUPPLIER DETAILS"),
        ("• Products or services\n\n• Products or services", "• Products or services"),
        ("Supplier Category\n\nIndividual\n\nor\n\nBusiness", "Supplier Category\n\nGoods\n\nServices\n\nLogistics\n\nProfessional Services\n\nOther"),
        ("Individual\n\nBusiness", "Goods\n\nServices\n\nLogistics\n\nProfessional Services\n\nOther"),
        ("one of these two values", "one of these five values"),
        ("Workbook 03, you will build a professional Quotation Generator.", "Workbook 08, you will build an Order Management System."),
        (
            "the same professional workflow introduced in Workbook 01",
            "a careful professional workflow throughout this project",
        ),
        (
            "the same professional approach you used successfully in Workbook 01",
            "the same careful approach you have used throughout this project",
        ),
        (
            "Unlike Workbook 01, this workbook introduces a much richer database structure, allowing businesses to manage complete supplier details instead of simple financial transactions.",
            "This workbook uses a practical database structure that allows businesses to manage complete supplier details.",
        ),
        (
            "a richer data model than the one used in Workbook 01",
            "a practical supplier data model",
        ),
        (
            "a significant step forward from Workbook 01",
            "a significant step forward in your software-building confidence",
        ),
    )
    for old, new in replacements:
        note = note.replace(old, new)

    note = re.sub(r"\n{4,}", "\n\n\n", note)
    note = re.sub(
        rf"(?ms)^CODE-READING QUESTION\s*\n.*?"
        rf"^{re.escape(SEP)}\s*\n(?=WHAT YOU LEARNED)",
        "",
        note,
    )
    return apply_learner_support(note).strip() + "\n"


def audit(note: str) -> None:
    required = (
        "PROMPT TO PROFIT™ WORKBOOK 07",
        "SUPPLIER MANAGEMENT SYSTEM",
        "LEARNER SUPPORT TOOLKIT",
        "suppliers",
        "supplier_name",
        "contact_person",
        "supplier_category",
        "payment_terms",
        "products_services",
        "Row Level Security",
        "emailRedirectTo",
        "CODE-READING QUESTION",
        "PORTFOLIO DESCRIPTION",
        "Workbook 08 — Order Management System",
    )
    for value in required:
        if value not in note:
            raise RuntimeError(f"Workbook 07 is missing required content: {value}")

    forbidden = (
        "Customer Record Management System",
        "Expense Tracker",
        "Professional Quotation Generator",
        "Professional Invoice Generator",
        "Appointment Booking System",
        "Sales Tracker",
        "Workbook 01",
        "Workbook 02",
        "Workbook 03",
        "Workbook 04",
        "Workbook 05",
        "Workbook 06",
        "customer-profile",
        "VS Code",
        "React",
        "Node.js",
    )
    for value in forbidden:
        if value in note:
            raise RuntimeError(f"Workbook 07 contains forbidden text: {value}")

    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook 07 must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") != 36:
        raise RuntimeError("Workbook 07 must contain 36 complete lessons")
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
    note = transform_project(payload["note"])
    note = replace_opening(note)
    note = replace_supplier_model(note)
    note = polish_supplier_workflows(note)
    note = replace_final_pages(note)
    note = clean_language(note)
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
