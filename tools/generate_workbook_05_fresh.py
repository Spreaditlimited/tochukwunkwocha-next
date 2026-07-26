#!/usr/bin/env python3
"""Generate Workbook 05 from the locked Workbook 02 series standard."""

from __future__ import annotations

import json
import re
from pathlib import Path

from apply_learner_support_standard import apply_standard as apply_learner_support
from generate_workbook_04_fresh import (
    SEP,
    chapter_range,
    lesson_range,
    replace_chapter_section,
    replace_chapter_tail,
    replace_lesson_section,
    replace_lesson_title,
)


SOURCE = Path(
    "/Users/tochukwunkwocha/Desktop/PTP New Lessons/"
    "2 - Customer Record Management System.notepad"
)
OUTPUT = Path(
    "deliverables/appointment-booking-system-workbook/"
    "5 - Appointment Booking System.notepad"
)


def transform_project(note: str) -> str:
    replacements = (
        ("PROMPT TO PROFIT™ WORKBOOK 02", "PROMPT TO PROFIT™ WORKBOOK 05"),
        ("Workbook 02", "Workbook 05"),
        ("WORKBOOK 02", "WORKBOOK 05"),
        ("CUSTOMER RECORD MANAGEMENT SYSTEM", "APPOINTMENT BOOKING SYSTEM"),
        ("Customer Record Management System", "Appointment Booking System"),
        ("customer-profile.html", "appointment-details.html"),
        ("customer-profile.js", "appointment-details.js"),
        ("CUSTOMER-PROFILE", "APPOINTMENT-DETAILS"),
        ("Customer Profile", "Appointment Details"),
        ("CUSTOMER PROFILE", "APPOINTMENT DETAILS"),
        ("customer profile", "appointment details"),
        ("Customer Directory", "Appointment Schedule"),
        ("CUSTOMER DIRECTORY", "APPOINTMENT SCHEDULE"),
        ("customer directory", "appointment schedule"),
        ("customer records", "appointments"),
        ("Customer records", "Appointments"),
        ("CUSTOMER RECORDS", "APPOINTMENTS"),
        ("customer record", "appointment"),
        ("Customer record", "Appointment"),
        ("CUSTOMER RECORD", "APPOINTMENT"),
        ("customer-management-system", "appointment-booking-system"),
        ("customer management", "appointment management"),
        ("Customer Management", "Appointment Management"),
        ("customers", "appointments"),
        ("Customers", "Appointments"),
        ("CUSTOMERS", "APPOINTMENTS"),
        ("customer_id", "appointment_id"),
        ("Customer ID", "Appointment ID"),
        ("customer ID", "appointment ID"),
        ("customer type", "appointment status"),
        ("Customer Type", "Appointment Status"),
        ("CUSTOMER TYPE", "APPOINTMENT STATUS"),
        ("customer_type", "status"),
        ("first_name", "client_name"),
        ("last_name", "service"),
        ("First Name", "Client Name"),
        ("Last Name", "Service"),
        ("full name", "client name"),
        ("Full Name", "Client Name"),
        ("job_title", "starts_at"),
        ("Customer", "Appointment"),
        ("CUSTOMER", "APPOINTMENT"),
        ("customer", "appointment"),
        ("Appointment profiles", "Appointment details"),
        ("appointment profiles", "appointment details"),
        ("Appointment profile", "Appointment details"),
        ("appointment profile", "appointment details"),
        ("Add Appointment", "Book Appointment"),
        ("add appointment", "book appointment"),
        ("Delete Appointment", "Cancel Appointment"),
        ("delete appointment", "cancel appointment"),
        ("Deleting Appointments", "Cancelling Appointments"),
        ("DELETING APPOINTMENTS", "CANCELLING APPOINTMENTS"),
        ("deleting appointments", "cancelling appointments"),
        ("deletion", "cancellation"),
        ("Deletion", "Cancellation"),
        ("deleted", "cancelled"),
        ("Deleted", "Cancelled"),
        ("delete", "cancel"),
        ("Delete", "Cancel"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def replace_top_sections(note: str) -> str:
    note = replace_chapter_section(
        note,
        1,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Every useful business application begins with a clear purpose.

An Appointment Booking System helps a business organise time, reduce missed bookings and understand what is happening each day.

Before building the private booking area, you will create a simple public website that explains the problem and introduces the solution.

This chapter begins gently. You will create the project folder, build the landing page, style it and add responsive navigation.

You will continue using only HTML, CSS, Vanilla JavaScript, Notepad and a web browser.""",
    )
    note = replace_chapter_section(
        note,
        1,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• A clear public landing page

• A hero section for the Appointment Booking System

• A business problem section

• A features section

• A simple How It Works section

• A sample schedule preview

• Login and Register links

• Responsive navigation

By the end of the chapter, your project will have a complete public website ready to connect to Supabase.""",
    )
    note = replace_lesson_title(
        note, 1, 1, "UNDERSTANDING THE APPOINTMENT BOOKING SYSTEM"
    )
    return note


def replace_database_content(note: str) -> str:
    note = replace_chapter_section(
        note,
        4,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Your Appointment Booking System can now recognise who is signed in.

The next step is to create a secure database where each authenticated user can store and manage their own appointments.

Every appointment needs enough information to answer five simple questions:

• Who is the appointment for?

• What service is being booked?

• When does it begin?

• When does it end?

• What is its current status?

You will also prevent two active appointments belonging to the same user from using overlapping times.

Row Level Security will make sure one user can never read or change another user's appointments.""",
    )
    note = replace_chapter_section(
        note,
        4,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• appointments table

• Appointment date and time fields

• Required and optional fields

• Allowed appointment statuses

• Protection against invalid time ranges

• Protection against overlapping active appointments

• User ownership

• Row Level Security

• SELECT, INSERT and UPDATE policies

• Secure cancellation support

• Two-account database testing

By the end of this chapter, your application will have a secure appointment database.""",
    )
    titles = {
        1: "UNDERSTANDING THE APPOINTMENT DATA MODEL",
        2: "CREATING THE APPOINTMENTS TABLE",
        3: "PROTECTING APPOINTMENT DATES, TIMES AND STATUSES",
        4: "ENABLING ROW LEVEL SECURITY",
        5: "CREATING THE SELECT POLICY",
        6: "CREATING THE INSERT POLICY",
        7: "CREATING THE UPDATE POLICY",
        8: "CREATING SECURE APPOINTMENT CANCELLATION",
        9: "TESTING THE APPOINTMENT DATABASE",
    }
    for lesson, title in titles.items():
        note = replace_lesson_title(note, 4, lesson, title)

    note = replace_lesson_section(
        note,
        4,
        1,
        "WHAT YOU ARE BUILDING",
        "WHY THIS MATTERS",
        """Before creating the database, you will learn what one appointment must contain.

Each appointment will store:

• Client name — required

• Client email — optional

• Client phone — optional

• Service — required

• Start date and time — required

• End date and time — required

• Status — booked, confirmed, completed or cancelled

• Notes — optional

• User ID — added automatically

• Created and updated times — added automatically

The start and end values will be stored as complete dates and times. This makes schedules easier to sort and display correctly.""",
    )
    note = replace_lesson_section(
        note,
        4,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """There is nothing to build with AI in this lesson.

Study the appointment data model carefully.

Notice that client contact details are optional, but the client name, service, start time, end time and status are required.

Also notice that cancellation changes the appointment status. It does not permanently remove the record.""",
    )
    note = replace_lesson_section(
        note,
        4,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

I am building a beginner-friendly Appointment Booking System using HTML, CSS, Vanilla JavaScript, Supabase and Notepad.

Create one complete SQL file named:

appointments-table.sql

Return the complete file only.

Do not return a snippet or partial SQL.

The SQL must create a public.appointments table with:

• id — uuid primary key with gen_random_uuid()

• user_id — uuid required, referencing auth.users(id) with on delete cascade

• client_name — text required

• client_email — text optional

• client_phone — text optional

• service — text required

• starts_at — timestamp with time zone required

• ends_at — timestamp with time zone required

• status — text required with default booked

• notes — text optional

• created_at — timestamp with time zone required with default now()

• updated_at — timestamp with time zone required with default now()

Enable Row Level Security.

Do not create permissive policies.

Do not disable Row Level Security.

Add clear SQL comments that explain each section in simple language.""",
    )
    note = replace_lesson_section(
        note,
        4,
        2,
        "WHAT AI SHOULD RETURN",
        "SAVE YOUR FILES",
        """AI should return one complete file:

• appointments-table.sql

The file should create the appointments table and enable Row Level Security.""",
    )
    note = replace_lesson_section(
        note,
        4,
        2,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open appointments-table.sql in Notepad.

Copy the complete SQL.

Open the Supabase SQL Editor.

Paste and run the SQL once.

Then open Table Editor and confirm that:

✓ appointments exists.

✓ id is the Primary Key.

✓ user_id references auth.users.

✓ client_name and service are required.

✓ starts_at and ends_at use timestamp with time zone.

✓ status defaults to booked.

✓ Row Level Security is enabled.

Do not add a row manually yet.""",
    )
    note = replace_lesson_section(
        note,
        4,
        3,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The public.appointments table already exists.

Create one complete SQL file named:

appointment-constraints.sql

Return the complete file only.

Do not return snippets or partial SQL.

The SQL must:

• reject blank client_name values

• reject blank service values

• allow only booked, confirmed, completed or cancelled as status values

• require ends_at to be later than starts_at

• create the btree_gist extension if it is not already available

• add a database exclusion constraint that stops overlapping appointment time ranges for the same user

• allow a cancelled appointment to stop blocking that time

Use tstzrange(starts_at, ends_at, '[)') so an appointment may begin exactly when another appointment ends.

Make the SQL safe to run after the table has been created.

Add beginner-friendly comments explaining what each rule protects.""",
    )
    note = replace_lesson_section(
        note,
        4,
        3,
        "WHAT AI SHOULD RETURN",
        "SAVE YOUR FILES",
        """AI should return one complete file:

• appointment-constraints.sql

The file should protect the appointment data and prevent overlapping active bookings.""",
    )
    note = replace_lesson_section(
        note,
        4,
        8,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The appointments table already has Row Level Security and user-owned SELECT, INSERT and UPDATE policies.

Create one complete SQL file named:

cancel-appointment-function.sql

Return the complete file only.

Do not return snippets or partial SQL.

Create a public.cancel_appointment function that:

• accepts one appointment ID

• uses the authenticated user's auth.uid()

• updates only an appointment owned by that user

• changes status to cancelled

• updates updated_at

• does not permanently delete the appointment

• returns the updated appointment

• reports a clear error when the appointment does not exist, belongs to another user or is already cancelled

Use security invoker so the normal Row Level Security rules still apply.

Set a safe search_path.

Grant execution to authenticated users only.

Add simple comments explaining each security decision.""",
    )
    note = replace_lesson_section(
        note,
        4,
        8,
        "WHAT AI SHOULD RETURN",
        "SAVE YOUR FILES",
        """AI should return one complete file:

• cancel-appointment-function.sql

The file should create secure soft cancellation without adding a DELETE policy.""",
    )
    note = replace_lesson_section(
        note,
        4,
        9,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Complete the database tests with two different user accounts.

Use the application or the authenticated browser session. Do not place another user's ID into a public test page.

Confirm that:

✓ Account A can create and read its own appointments.

✓ Account B can create and read its own appointments.

✓ Account A cannot read or update Account B's appointments.

✓ Blank names and services are rejected.

✓ An end time before the start time is rejected.

✓ Unsupported status values are rejected.

✓ Overlapping active appointments for one user are rejected.

✓ An appointment may begin exactly when the previous one ends.

✓ Cancelling an appointment keeps the record but changes its status.

✓ The cancelled time can be booked again.

✓ Row Level Security remains enabled.

Remove any temporary test appointments when the testing is complete.""",
    )
    return note


def replace_dashboard_content(note: str) -> str:
    titles = {
        1: "DESIGNING THE APPOINTMENT DASHBOARD",
        2: "BUILDING THE APPOINTMENT BOOKING FORM",
        3: "SAVING APPOINTMENTS SECURELY",
        4: "BUILDING APPOINTMENT DASHBOARD STATISTICS",
    }
    for lesson, title in titles.items():
        note = replace_lesson_title(note, 5, lesson, title)

    note = replace_chapter_section(
        note,
        5,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """The secure database is ready.

You can now build the private dashboard where a signed-in user books appointments and sees a quick summary of the schedule.

The booking form will collect client details, service, start and end times, status and notes.

The browser will provide a helpful preview, but Supabase will remain responsible for ownership and overlap protection.""",
    )
    note = replace_chapter_section(
        note,
        5,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• Protected appointment dashboard

• Appointment booking form

• Client contact fields

• Service, date and time fields

• Status and notes

• Date and time validation

• Secure appointment saving

• Friendly overlap messages

• Total, today's, upcoming and cancelled statistics""",
    )
    note = replace_lesson_section(
        note,
        5,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

I already have a working Appointment Booking System with authentication, a protected dashboard and a shared supabaseClient from supabase-config.js.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build a complete beginner-friendly appointment booking form.

DASHBOARD.HTML

Keep the protected dashboard and logout feature.

Add clearly labelled fields for:

• Client Name — required

• Client Email — optional, type email

• Client Phone — optional, type tel

• Service — required

• Appointment Date — required, type date

• Start Time — required, type time

• End Time — required, type time

• Status — required, with Booked and Confirmed options

• Notes — optional textarea

Add:

• Book Appointment button

• Form message area with aria-live="polite"

• A simple appointment summary that updates while the user types

DASHBOARD.JS

Keep authentication and logout working.

Add browser-side validation.

Require client name, service, date, start time and end time.

Confirm the end is later than the start.

Do not save yet.

Create complete ISO date-time values from the selected local date and times using the browser Date object and toISOString().

Keep the ISO values ready for the saving lesson.

Never ask the learner to edit generated code manually.

AUTH.CSS

Keep all existing styles.

Style the complete form, validation messages and live summary.

Make the form easy to use on a small screen.

IMPORTANT

Return complete updated files.

Do not include explanations inside the file contents.

Do not use frameworks or build tools.""",
    )
    note = replace_lesson_section(
        note,
        5,
        3,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The Appointment Booking System has a working booking form and a secure appointments table.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.js

GENERAL GOAL

Save one complete appointment securely.

Keep all existing validation and authentication.

When the form is submitted:

• get the authenticated user

• stop if no user is signed in

• trim text fields

• convert the chosen local date and times to ISO strings

• confirm ends_at is later than starts_at

• insert into appointments

Insert:

• user_id from the authenticated user

• client_name

• client_email or null

• client_phone or null

• service

• starts_at

• ends_at

• status

• notes or null

Never trust a user ID from the page address or form.

Continue relying on Row Level Security and database constraints.

Disable the submit button while saving.

If Supabase reports an overlapping appointment, show a friendly message explaining that the selected time is unavailable.

Do not display raw database errors.

Use console.error() for technical details.

After success:

• show Appointment booked successfully.

• reset the form

• refresh the schedule

• refresh dashboard statistics

IMPORTANT

Return the complete updated dashboard.js file only.

Do not return a snippet.""",
    )
    note = replace_lesson_section(
        note,
        5,
        4,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

Appointments now save securely.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build live appointment dashboard statistics.

Display four cards:

• Total Appointments

• Today's Appointments

• Upcoming Appointments

• Cancelled Appointments

Use the authenticated user's appointments only.

Use the browser's local date when deciding whether an appointment is today.

Count upcoming appointments whose starts_at is later than now and whose status is not cancelled.

Show loading, empty and error states.

Refresh the statistics after booking, editing or cancelling an appointment.

Do not expose another user's data.

Continue relying on Row Level Security.

Return complete updated files only.""",
    )
    return note


def replace_schedule_content(note: str) -> str:
    titles = {
        1: "BUILDING THE APPOINTMENT SCHEDULE",
        2: "BUILDING THE APPOINTMENT DETAILS PAGE",
        3: "TESTING THE APPOINTMENT SCHEDULE",
    }
    for lesson, title in titles.items():
        note = replace_lesson_title(note, 6, lesson, title)
    note = replace_chapter_section(
        note,
        6,
        "CHAPTER INTRODUCTION",
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """The application can now save appointments and calculate useful statistics.

The next step is to help the user see the schedule clearly.

You will display appointments in time order, group them by date and provide a separate details page for one authorised appointment.

Clear loading, empty and error states will help beginners understand what the application is doing.""",
    )
    note = replace_chapter_section(
        note,
        6,
        "WHAT YOU WILL BUILD IN THIS CHAPTER",
        "LESSON 1",
        """During this chapter, you will build:

• Appointment Schedule

• Date-grouped appointment cards

• Local date and time display

• Today, upcoming and past labels

• Clear status badges

• Appointment Details page

• Call and email actions when contact details exist

• Loading, empty and error states

• Responsive schedule testing

• Two-account privacy testing""",
    )
    note = replace_lesson_section(
        note,
        6,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

I already have a working Appointment Booking System with authentication, secure appointment saving and dashboard statistics.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build the Appointment Schedule on the protected dashboard.

Load the authenticated user's appointments from Supabase.

Select only the fields needed for the schedule.

Order by starts_at from earliest to latest.

Store the returned appointments in a reusable array.

Group appointments under clear date headings.

Format dates and times for the user with Intl.DateTimeFormat().

Never display raw ISO values.

Each appointment card should show:

• client name

• service

• start and end time

• status badge

• View Appointment button

The button should open:

appointment-details.html?id=APPOINTMENT_ID

Add separate loading, empty, error and content states.

Cancelled appointments should remain visible with a clear cancelled style.

Refresh the schedule after a new appointment is saved.

Continue relying on Row Level Security.

Return complete updated files only.""",
    )
    note = replace_lesson_section(
        note,
        6,
        2,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The protected dashboard now displays an Appointment Schedule.

Everything already built must continue working.

Return complete files only.

Do not return snippets or partial code.

Create or update:

• appointment-details.html

• appointment-details.js

• auth.css

GENERAL GOAL

Build a protected page that displays one complete authorised appointment.

Read only the id value from the page address.

Get the authenticated user.

Retrieve one appointment where:

• id matches the page address

• user_id matches the authenticated user

Continue relying on Row Level Security.

Display:

• client name

• client email when available

• client phone when available

• service

• local appointment date

• local start and end time

• status

• notes when available

• created and updated times

Add:

• Edit Appointment

• Cancel Appointment

• Back to Dashboard

• Logout

Add call and email links only when those values exist.

Add loading, not-found, error and content states.

Never expose raw database errors.

Do not allow a signed-in user to view another user's appointment.

Return complete files only.""",
    )
    note = replace_lesson_section(
        note,
        6,
        3,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Sign in and create appointments on several dates.

Confirm that:

✓ Appointments appear in chronological order.

✓ Date headings are clear.

✓ Times display in the browser's local time.

✓ Cancelled appointments remain visible and clearly labelled.

✓ View Appointment opens the correct record.

✓ Missing email, phone and notes do not create broken areas.

✓ Loading, empty and error states work.

✓ The schedule remains usable on a small screen.

Complete a two-account privacy test.

Confirm that Account A cannot open Account B's appointment by changing the ID in the page address.""",
    )
    return note


def replace_discovery_content(note: str) -> str:
    note = replace_lesson_title(
        note, 7, 1, "BUILDING APPOINTMENT SEARCH, FILTERING AND SORTING"
    )
    note = replace_lesson_title(
        note, 7, 2, "TESTING APPOINTMENT DISCOVERY"
    )
    note = replace_lesson_section(
        note,
        7,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The protected dashboard already displays a complete Appointment Schedule.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• auth.css

GENERAL GOAL

Build a complete toolbar for finding appointments quickly.

Add:

• Search Appointments field

• Status filter with All, Booked, Confirmed, Completed and Cancelled

• Date filter with All Dates, Today, Upcoming and Past

• Sort with Soonest First, Latest First, Client A–Z and Client Z–A

• Clear Search and Filters button

• result information

• separate no-results state

Search while the user types across:

• client name

• service

• client email

• client phone

Ignore letter case and unnecessary spaces.

Filter and sort a copied array.

Do not request Supabase again for every key press.

Use the browser's local date for Today.

Cancelled appointments must be included only when the selected filters allow them.

Keep loading, empty, error and schedule states separate.

Continue supporting authentication, booking, statistics and appointment details.

Return complete updated files only.""",
    )
    note = replace_lesson_section(
        note,
        7,
        2,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Create several appointments with different clients, services, dates and statuses.

Confirm that:

✓ Client and service searches work.

✓ Email and phone searches work.

✓ Status filtering works.

✓ Today, Upcoming and Past filters use the correct local date.

✓ Every sorting option works.

✓ Search, filters and sorting work together.

✓ Result information is accurate.

✓ No-results is different from an empty schedule.

✓ Clear Search and Filters restores the complete schedule.

✓ New, edited and cancelled appointments refresh the results.

✓ Account privacy remains protected.""",
    )
    return note


def replace_edit_cancel_content(note: str) -> str:
    note = replace_lesson_title(note, 8, 1, "BUILDING APPOINTMENT EDITING")
    note = replace_lesson_title(note, 8, 2, "TESTING APPOINTMENT EDITING")
    note = replace_lesson_section(
        note,
        8,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

I already have a working Appointment Booking System.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• dashboard.html

• dashboard.js

• appointment-details.js

• auth.css

GENERAL GOAL

Build complete appointment editing using the existing booking form.

Edit Appointment should open:

dashboard.html?edit=APPOINTMENT_ID

Pass only the appointment ID.

When edit mode begins:

• get the authenticated user

• retrieve one appointment belonging to that user

• fill the existing form

• convert starts_at and ends_at into local date and time field values

• change the heading and submit button text

• display Cancel Edit

Reuse the existing validation.

When saving:

• rebuild complete ISO start and end values

• require the end to be later than the start

• update only the matching id and authenticated user_id

• update updated_at

• preserve id, user_id and created_at

Continue relying on Row Level Security and the overlap constraint.

If the new time overlaps another active appointment, show a friendly message.

After success:

• show Appointment updated successfully.

• leave edit mode

• refresh the schedule

• refresh statistics

• preserve all search and schedule features

Return complete updated files only.""",
    )
    note = replace_lesson_section(
        note,
        8,
        2,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Open an appointment and select Edit Appointment.

Confirm that:

✓ The correct appointment loads.

✓ Date and time fields show local values.

✓ Every existing value appears correctly.

✓ Validation still works.

✓ A valid edit saves.

✓ An overlapping edit is rejected.

✓ id, user_id and created_at do not change.

✓ updated_at changes.

✓ Cancel Edit leaves the appointment unchanged.

✓ Schedule and statistics refresh after success.

✓ Account A cannot edit Account B's appointment by changing the ID.""",
    )

    note = replace_lesson_title(
        note, 9, 1, "BUILDING SECURE APPOINTMENT CANCELLATION"
    )
    note = replace_lesson_title(
        note, 9, 2, "TESTING APPOINTMENT CANCELLATION"
    )
    note = replace_lesson_section(
        note,
        9,
        1,
        "BUILD PROMPT",
        "WHAT AI SHOULD RETURN",
        """PROJECT STATE

The Appointment Details page already loads one authorised appointment.

The database already contains the cancel_appointment function.

Everything already built must continue working.

Return complete updated files only.

Do not return snippets or partial code.

Update only:

• appointment-details.html

• appointment-details.js

• dashboard.js

• auth.css

GENERAL GOAL

Build secure soft cancellation.

When Cancel Appointment is selected:

Display a confirmation dialog:

Are you sure you want to cancel this appointment?

The appointment will remain in the schedule as Cancelled.

If the user chooses not to continue:

• stop immediately

• do not contact Supabase

If confirmed:

• call cancel_appointment with the current appointment ID

• do not use a DELETE request

• do not remove the record permanently

• continue relying on authentication, Row Level Security and the secure function

After success:

• display Appointment cancelled successfully.

• update the details status

• disable the Cancel Appointment action

• refresh the schedule

• refresh dashboard statistics

Show a friendly message for errors and send technical details to console.error().

Style the cancelled state clearly without making it look like an unexpected error.

Return complete updated files only.""",
    )
    note = replace_lesson_section(
        note,
        9,
        2,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Test cancellation carefully.

Confirm that:

✓ Choosing Cancel in the confirmation dialog changes nothing.

✓ Confirming changes the status to cancelled.

✓ The appointment remains in the schedule.

✓ The details page shows Cancelled.

✓ The cancellation button cannot cancel the same appointment again.

✓ Today's, upcoming and cancelled statistics refresh.

✓ The cancelled time becomes available for another booking.

✓ No DELETE request is used.

✓ Account A cannot cancel Account B's appointment.

✓ Row Level Security remains enabled.""",
    )
    return note


def replace_final_sections(note: str) -> str:
    note = replace_lesson_section(
        note,
        10,
        1,
        "TEST YOUR WORK",
        "CHECKPOINT",
        """Complete the following final tests on the deployed HTTPS website.

AUTHENTICATION

✓ Registration, email verification, login and logout work.

✓ Protected pages reject signed-out visitors.

BOOKING

✓ Required fields are enforced.

✓ Local date and time values save correctly.

✓ An end time before the start is rejected.

✓ Overlapping active appointments are rejected.

SCHEDULE

✓ Appointments appear in time order and under the correct date.

✓ Local times, statuses and empty states display correctly.

SEARCH AND FILTERS

✓ Search, date filters, status filters and sorting work together.

EDITING

✓ A valid edit saves securely.

✓ An overlapping edit is rejected.

CANCELLATION

✓ Cancelling keeps the record and changes its status.

✓ A cancelled time can be booked again.

STATISTICS

✓ Total, today, upcoming and cancelled counts remain accurate.

SECURITY

✓ Account A cannot view, edit or cancel Account B's appointment.

✓ Row Level Security remains enabled.

RESPONSIVE DESIGN

✓ The form, schedule, toolbar and details page work on a small screen.

CONSOLE

✓ No unexpected red errors appear during the complete workflow.""",
    )
    final_testing = """Before considering this workbook complete, perform one final review.

Create a completely new user account on the deployed HTTPS website.

Begin with an empty appointment schedule.

Complete this journey:

✓ Register

✓ Verify the email address

✓ Sign in

✓ Book appointments on different dates

✓ Try and fail to create an overlapping appointment

✓ View the complete schedule

✓ Search, filter and sort appointments

✓ Open one appointment

✓ Edit one appointment

✓ Cancel one appointment

✓ Confirm the dashboard statistics

✓ Sign out

✓ Sign in again

Confirm that every saved appointment still exists and every statistic remains correct.

If every step succeeds, your Appointment Booking System is ready to be published."""
    note, count = re.subn(
        rf"(?ms)^FINAL TESTING\s*\n{re.escape(SEP)}\n.*?"
        rf"(?=^GOING LIVE\s*$)",
        f"FINAL TESTING\n{SEP}\n\n{final_testing}\n\n{SEP}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace Final Testing")

    going_live = """Your Appointment Booking System is ready for its final deployment.

1.

Save every complete project file.

2.

Open:

https://app.netlify.com/drop

3.

Drag the complete Appointment Booking System folder into the deployment area.

If you already created the Netlify website during authentication testing, deploy the updated folder to that same website.

4.

Wait for deployment to finish.

5.

Open the HTTPS website address supplied by Netlify.

6.

Confirm that the Supabase Site URL and Redirect URLs still use this exact website address.

7.

Repeat the complete live workflow:

• Registration and email verification

• Appointment booking

• Schedule viewing

• Search, filters and sorting

• Editing

• Cancellation

• Dashboard statistics

• Two-account privacy

Only share the application after every important live test succeeds."""
    note, count = re.subn(
        rf"(?ms)^GOING LIVE\s*\n{re.escape(SEP)}\n.*?"
        rf"(?=^PORTFOLIO DESCRIPTION\s*$)",
        f"GOING LIVE\n{SEP}\n\n{going_live}\n\n{SEP}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace Going Live")

    next_workbook = """Excellent work.

You have completed Workbook 05 of the Prompt to Profit™ Software Workbook Series.

You have built software that allows a business to book, view, find, edit and cancel appointments.

You have also protected every appointment using authentication, Row Level Security and database rules that prevent overlapping active bookings.

The next project in the series is Workbook 06 — Sales Tracker.

For now, review what you have built and make sure every important feature works correctly.

Congratulations once again on completing your Appointment Booking System."""
    note, count = re.subn(
        rf"(?ms)^NEXT WORKBOOK\s*\n{re.escape(SEP)}\n.*$",
        f"NEXT WORKBOOK\n{SEP}\n\n{next_workbook}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace Next Workbook")
    return note


def polish_remaining_sections(note: str) -> str:
    top_build = """By the end of this workbook, your Appointment Booking System will include:

PUBLIC WEBSITE

• Responsive navigation

• Hero, problem, features and How It Works sections

• Sample schedule preview

• Login and Register links

SUPABASE

• Supabase project and shared connection file

• Secure appointments table

• Date, time, status and overlap protection

AUTHENTICATION

• Registration and email verification

• Login, protected pages and logout

APPOINTMENT MANAGEMENT

• Book appointments

• View a date-grouped schedule

• Open complete appointment details

• Search, filter and sort appointments

• Edit appointments

• Cancel appointments without deleting their history

BUSINESS DASHBOARD

• Total, today's, upcoming and cancelled appointments

SECURITY AND COMPLETION

• Row Level Security and authenticated ownership checks

• Two-account privacy testing

• Netlify deployment

• Portfolio description, reflection and extension challenges"""
    note, count = re.subn(
        rf"(?ms)^WHAT YOU WILL BUILD\s*\n(?:{re.escape(SEP)}\n)?.*?"
        rf"(?=^WORKBOOK STRUCTURE\s*$)",
        f"WHAT YOU WILL BUILD\n{SEP}\n\n{top_build}\n\n{SEP}\n",
        note,
        count=1,
    )
    if count != 1:
        raise RuntimeError("Could not replace the opening What You Will Build")

    sections = [
        (4, 3, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS",
         """In this lesson, you will add database rules that protect appointment quality.

The rules will reject blank names and services, unsupported statuses, invalid time ranges and overlapping active appointments."""),
        (4, 2, "SAVE YOUR FILES", "TEST YOUR WORK",
         """Open Notepad.

Paste the complete SQL returned by AI.

Save the file inside your Appointment Booking System project folder as:

appointments-table.sql

In the Save As window, choose All Files so Notepad does not add .txt.

Confirm that the filename ends with .sql."""),
        (4, 3, "SAVE YOUR FILES", "TEST YOUR WORK",
         """Open Notepad.

Paste the complete SQL returned by AI.

Save the file inside your project folder as:

appointment-constraints.sql

Choose All Files and confirm that the filename does not end with .txt."""),
        (4, 3, "WHY THIS MATTERS", "BEFORE YOU CONTINUE",
         """A booking form can warn the user about a problem, but two people could still attempt to save the same time at almost the same moment.

The database is the final source of truth.

Database constraints make sure invalid or overlapping active appointments cannot be saved, even when requests arrive close together."""),
        (4, 3, "TEST YOUR WORK", "CHECKPOINT",
         """Run appointment-constraints.sql in the Supabase SQL Editor.

Confirm that:

✓ Blank client names and services are rejected.

✓ Only booked, confirmed, completed and cancelled are accepted.

✓ The end must be later than the start.

✓ Overlapping active appointments for the same user are rejected.

✓ Back-to-back appointments are allowed.

✓ Cancelled appointments do not block a time.

✓ Row Level Security remains enabled."""),
        (4, 3, "CHECKPOINT", "COMMON BEGINNER MISTAKES",
         """Before moving on, confirm that:

✓ The constraints were created successfully.

✓ Valid appointments are accepted.

✓ Invalid and overlapping appointments are rejected.

✓ Row Level Security remains enabled."""),
        (4, 3, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES",
         """A common mistake is checking for overlaps only in JavaScript.

That check is helpful for the user, but it cannot protect two requests that reach the database at almost the same time.

Another mistake is treating an appointment that ends at 10:00 and another that begins at 10:00 as overlapping.

The [) time range allows that useful back-to-back schedule."""),
        (4, 8, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS",
         """In this lesson, you will create one secure database function that cancels an appointment.

Cancellation changes the status to cancelled and keeps the record in the schedule.

The function will work only for the authenticated owner."""),
        (4, 8, "SAVE YOUR FILES", "TEST YOUR WORK",
         """Open Notepad.

Paste the complete SQL returned by AI.

Save the file inside your project folder as:

cancel-appointment-function.sql

Choose All Files and confirm that the filename ends with .sql."""),
        (4, 8, "WHY THIS MATTERS", "BEFORE YOU CONTINUE",
         """Businesses often need a history of cancelled appointments.

Permanently removing the row would erase useful information and make statistics less accurate.

Soft cancellation preserves the history while releasing the time for a new booking."""),
        (4, 8, "TEST YOUR WORK", "CHECKPOINT",
         """Run cancel-appointment-function.sql in the Supabase SQL Editor.

Confirm that:

✓ cancel_appointment exists.

✓ It uses security invoker and checks auth.uid().

✓ It updates status and updated_at.

✓ It does not permanently remove a row.

✓ Only authenticated users may execute it."""),
        (4, 8, "CHECKPOINT", "COMMON BEGINNER MISTAKES",
         """Before moving on, confirm that:

✓ The secure cancellation function exists.

✓ Row Level Security remains enabled.

✓ No appointment deletion policy was added.

✓ Cancellation preserves the appointment record."""),
        (4, 8, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES",
         """A common mistake is permanently removing a cancelled booking.

That loses useful business history.

Another mistake is using a function that bypasses Row Level Security.

This function uses security invoker so the existing security rules continue protecting every update."""),
        (4, 8, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER",
         """The function performs a normal database update.

It finds one appointment whose ID and user ID match the request, changes the status and returns the updated record.

If ownership does not match, no appointment is changed."""),
        (4, 9, "BEFORE YOU CONTINUE", "BUILD PROMPT",
         """Confirm that:

✓ The appointments table exists.

✓ SELECT, INSERT and UPDATE policies exist.

✓ The cancellation function exists.

✓ The time and status constraints exist.

✓ Row Level Security remains enabled."""),
        (4, 9, "BUILD PROMPT", "WHAT AI SHOULD RETURN",
         """There is nothing to build with AI in this lesson.

Review the appointments table, its constraints, the SELECT, INSERT and UPDATE policies, and the cancel_appointment function.

Confirm that every ownership rule compares user_id with auth.uid().

Do not create a DELETE policy because this workbook keeps cancelled appointments as business history."""),
        (4, 9, "CHECKPOINT", "COMMON BEGINNER MISTAKES",
         """Before moving on, confirm that:

✓ Every required column exists.

✓ Valid statuses are protected.

✓ Invalid and overlapping times are rejected.

✓ SELECT, INSERT and UPDATE ownership policies work.

✓ Secure cancellation works.

✓ Two-account privacy is protected."""),
        (4, 9, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES",
         """A common mistake is testing with only one account.

That proves the application can save information, but it does not prove privacy.

Always test with two accounts and confirm that neither account can read or change the other account's appointments."""),
        (5, 2, "TEST YOUR WORK", "CHECKPOINT",
         """Open the protected dashboard.

Enter a client name, service, date, start time and end time.

Confirm that:

✓ Required fields are enforced.

✓ Optional email, phone and notes may be empty.

✓ Email validation works when an email is entered.

✓ The end must be later than the start.

✓ The live summary is clear.

✓ No appointment is saved during this lesson.

✓ The form remains usable on a small screen."""),
        (5, 3, "WHAT AI SHOULD RETURN", "SAVE YOUR FILES",
         """AI should return one complete updated file:

• dashboard.js

The file should save appointments securely and handle overlap errors clearly."""),
        (5, 3, "TEST YOUR WORK", "CHECKPOINT",
         """Sign in and book a valid appointment.

Confirm that:

✓ The appointment saves with the authenticated user's ID.

✓ starts_at and ends_at contain complete ISO values.

✓ The form resets and repeated submissions are prevented.

Try to book an overlapping active appointment.

Confirm that:

✓ Supabase rejects it.

✓ The page shows a friendly unavailable-time message.

✓ No partial or repeated appointment is saved."""),
        (5, 3, "CHECKPOINT", "COMMON BEGINNER MISTAKES",
         """Before moving on, confirm that:

✓ Valid appointments save securely.

✓ Overlapping active appointments are rejected.

✓ Optional contact fields work.

✓ Ownership comes from the authenticated user.

✓ Row Level Security remains enabled."""),
        (5, 4, "WHY THIS MATTERS", "BEFORE YOU CONTINUE",
         """A useful dashboard answers important questions immediately.

The user should see the size of the schedule, today's workload, future appointments and cancellation activity without counting records manually."""),
        (5, 4, "TEST YOUR WORK", "CHECKPOINT",
         """Create appointments for today and future dates, then cancel one appointment.

Confirm that:

✓ Total Appointments is correct.

✓ Today's Appointments uses the local calendar date.

✓ Upcoming Appointments excludes cancelled records.

✓ Cancelled Appointments is correct.

✓ Statistics refresh after changes.

✓ Only the authenticated user's appointments are counted."""),
        (5, 4, "CHECKPOINT", "COMMON BEGINNER MISTAKES",
         """Before moving on, confirm that:

✓ All four statistics are accurate.

✓ Local-date comparisons work.

✓ Statistics refresh automatically.

✓ Appointment saving still works.

✓ Account privacy remains protected."""),
        (9, 1, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS",
         """In this lesson, you will build the complete soft-cancellation workflow.

The user will confirm the decision, the secure database function will change the appointment status, and the appointment will remain in the schedule as useful business history."""),
        (9, 1, "WHY THIS MATTERS", "BEFORE YOU CONTINUE",
         """Cancellation should be deliberate and reversible only through a later extension.

The application must ask for confirmation, preserve the record and verify authenticated ownership before changing the status."""),
        (9, 1, "TEST YOUR WORK", "CHECKPOINT",
         """Open an active appointment and select Cancel Appointment.

First, stop at the confirmation dialog.

Confirm that the appointment remains unchanged.

Open the confirmation again and continue.

Verify that:

✓ Status changes to cancelled.

✓ The appointment remains in the schedule.

✓ The details page updates.

✓ Statistics refresh.

✓ The same appointment cannot be cancelled twice.

✓ Another user's appointment cannot be cancelled."""),
        (9, 1, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES",
         """A common mistake is removing the appointment row permanently.

This workbook keeps the record and changes only its status.

Another mistake is sending only an appointment ID without checking the authenticated owner.

The secure function and Row Level Security provide that ownership protection."""),
        (9, 1, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER",
         """The confirmation protects against an accidental click.

The secure function protects ownership.

The status change preserves history and releases the time because the overlap constraint ignores cancelled appointments."""),
        (9, 1, "THINK LIKE A SOFTWARE DESIGNER", "CODE-READING QUESTION",
         """A cancelled appointment is still useful information.

It can help a business understand cancellation patterns and keep a truthful record of what happened.

Design important business actions around history, clarity and security."""),
        (9, 2, "WHAT YOU ARE BUILDING", "WHY THIS MATTERS",
         """In this lesson, you will test soft cancellation from beginning to end.

You will confirm that the status changes safely, the record remains visible, the released time can be booked again and account privacy remains protected."""),
        (9, 2, "WHY THIS MATTERS", "BEFORE YOU CONTINUE",
         """Cancellation affects the details page, schedule, overlap protection and statistics.

Testing every connected result confirms that the complete capability works, not only the button."""),
        (9, 2, "COMMON BEGINNER MISTAKES", "BEHIND THE SCENES",
         """A common mistake is testing only the successful confirmation.

Also test stopping at the confirmation dialog, trying to cancel twice and attempting cross-account access.

Each test protects a different part of the workflow."""),
        (9, 2, "BEHIND THE SCENES", "THINK LIKE A SOFTWARE DESIGNER",
         """Soft cancellation changes one status, but several parts of the application respond.

The schedule changes its visual label, upcoming statistics change, cancelled statistics increase and the time becomes available again."""),
        (9, 2, "THINK LIKE A SOFTWARE DESIGNER", "WHAT YOU LEARNED",
         """A business capability is complete only when its connected results are correct.

Always test what changed, what remained and what became possible after the action."""),
    ]
    for chapter, lesson, title, next_title, body in sections:
        note = replace_lesson_section(
            note, chapter, lesson, title, next_title, body
        )

    note = replace_chapter_section(
        note, 5, "CHAPTER SUMMARY", "CHAPTER MILESTONE",
        """Congratulations.

Your protected dashboard can now collect, validate and save complete appointments.

Supabase protects ownership and rejects overlapping active times.

The dashboard also calculates total, today's, upcoming and cancelled statistics from the authenticated user's saved appointments.""",
    )
    note = replace_chapter_section(
        note, 5, "CHAPTER MILESTONE", "TRANSITION TO CHAPTER 6",
        """By the end of Chapter 5, you have successfully built:

✓ Protected appointment dashboard

✓ Complete booking form

✓ Local date and time preparation

✓ Secure appointment saving

✓ Overlap error handling

✓ Automatic form reset

✓ Live appointment statistics

✓ Automatic dashboard refresh""",
    )
    note = replace_chapter_tail(
        note, 5, "TRANSITION TO CHAPTER 6",
        """Your application can now book appointments securely.

In the next chapter, you will turn those saved records into a clear date-grouped schedule and a protected Appointment Details page.""",
    )
    note = replace_chapter_section(
        note, 9, "CHAPTER INTRODUCTION", "WHAT YOU WILL BUILD IN THIS CHAPTER",
        """Appointment plans sometimes change.

A client may ask to cancel, or the business may no longer be available at the selected time.

This application will use soft cancellation.

The appointment will remain in the database, but its status will change to cancelled.

This preserves useful history, keeps statistics honest and releases the time for a new booking.

The user will always confirm the action, and the database will verify ownership before making the change.""",
    )
    note = replace_chapter_section(
        note, 9, "WHAT YOU WILL BUILD IN THIS CHAPTER", "LESSON 1",
        """During this chapter, you will build:

• Cancel Appointment action

• Clear confirmation dialog

• Secure cancel_appointment call

• Soft cancellation

• Preserved appointment history

• Released booking time

• Schedule and statistics refresh

• Two-account cancellation testing""",
    )
    return note


def clean_language(note: str) -> str:
    replacements = (
        (
            "Unlike the Expense Tracker in Workbook 01, this application stores much richer information.",
            "This project stores complete appointment information.",
        ),
        (
            "This means you can begin with this workbook even if you have not completed Workbook 01.",
            "This means you can begin with this workbook even if you have not completed any other workbook.",
        ),
        (
            "This means you can begin with this workbook even if you have not completed Workbook 01 or Workbook 02.",
            "This means you can begin with this workbook even if you have not completed any other workbook.",
        ),
        (
            "This is the same professional approach you used successfully in Workbook 01.",
            "This careful approach reduces missing files and broken redirects.",
        ),
        (
            "Most importantly, you have followed the same professional workflow introduced in Workbook 01.",
            "Most importantly, you have followed a clear professional workflow.",
        ),
        (
            "Unlike Workbook 01, this workbook introduces a much richer database structure, allowing businesses to manage complete appointment detailss instead of simple financial transactions.",
            "This workbook introduces a complete database structure for managing appointment details safely.",
        ),
        (
            "You designed a richer data model than the one used in Workbook 01 and created fields suitable for real business use.",
            "You designed a clear data model and created fields suitable for a real appointment schedule.",
        ),
        (
            "This chapter introduces several new software design patterns that you have not used before and marks a significant step forward from Workbook 01.",
            "This chapter introduces useful software design patterns for appointment booking.",
        ),
        (
            "If your immediate need is to build a Quotation Generator, you can start with that workbook.\n\nIf you need a Appointment Booking System, you can begin with this workbook.",
            "If your immediate need is to build an Appointment Booking System, you can begin with this workbook.",
        ),
        ("expense records", "simple records"),
        ("Expense Tracker", "another project"),
        ("appointment detailss", "appointment details"),
        ("appointment cards", "appointment cards"),
        ("Appointment details cards", "Appointment cards"),
        ("appointment details cards", "appointment cards"),
        ("View Profile", "View Appointment"),
        ("view profile", "view appointment"),
        ("Edit Appointment opens", "Edit Appointment opens"),
        ("appointment growth", "appointment activity"),
        ("Duplicate Detection", "Overlap Protection"),
        ("duplicate appointment details", "overlapping appointment times"),
        ("duplicate appointments", "overlapping appointments"),
        ("duplicate appointment", "overlapping appointment"),
        ("Duplicate appointments", "Overlapping appointments"),
        ("Duplicate appointment", "Overlapping appointment"),
        ("appointment information normalisation", "appointment field preparation"),
        ("Appointment information normalisation", "Appointment field preparation"),
        ("normalise appointment information", "prepare appointment information"),
        ("normalised", "prepared"),
        ("Appointment Added Today", "Today's Appointments"),
        ("Appointments Added Today", "Today's Appointments"),
        ("New Appointments This Month", "Upcoming Appointments"),
        ("Appointment service", "Service"),
        ("appointment service", "service"),
        ("Call Appointment", "Call Client"),
        ("Email Appointment", "Email Client"),
        ("phone numbers", "client phone numbers"),
        ("email addresses", "client email addresses"),
        ("Appointment information rarely remains unchanged.", "Appointment plans sometimes change."),
        (
            "An appointment may change their client phone number, move to a new appointment date and time, join a different service or update their client email appointment date and time.",
            "A client may request a different service, date or time.",
        ),
        ("a Appointment Booking System", "an Appointment Booking System"),
        ("a appointment", "an appointment"),
        ("A appointment", "An appointment"),
        ("the another project", "another project"),
        ("Appointment Relationship Management (CRM)", "appointment management"),
        ("appointment Relationship Management (CRM)", "appointment management"),
        ("Duplicate Email Detection", "Appointment Overlap Protection"),
        ("Duplicate Phone Detection", "Secure Time Validation"),
        ("duplicate email detection", "appointment overlap protection"),
        ("duplicate phone detection", "secure time validation"),
        ("Duplicate detection", "Overlap protection"),
        ("duplicate detection", "overlap protection"),
        (
            "Unlike another project, where each row represented one transaction, every row in this table represents one appointment.",
            "Every row in this table represents one complete appointment.",
        ),
        ("• Company", "• Service"),
        ("• Job title", "• Appointment date and time"),
        ("• Job Title", "• Appointment date and time"),
        ("• Address", "• Appointment Date"),
        ("• Location", "• Start and end time"),
        ("• City", "• Start Time"),
        ("• State", "• End Time"),
        ("• Country", "• Status"),
        (
            "Why might a business appointment include a company name while an individual appointment does not?",
            "Why must the end of an appointment be later than its start?",
        ),
        (
            "• Move to another city.\n\n• Start working for a different company.",
            "• Move to another date.\n\n• Request a different service.",
        ),
        ("• Search by company", "• Search by service"),
        ("Searching by company works.", "Searching by service works."),
        (
            "A appointment may change their phone number, move to a new address, join a different company or update their email address.",
            "A client may request a different service, date or time.",
        ),
        ("Modify:\n\n• Phone\n\n• Company\n\n• Notes",
         "Modify:\n\n• Service\n\n• Appointment time\n\n• Notes"),
        (
            "Include duplicate email and phone number scenarios.",
            "Include overlapping and non-overlapping time scenarios.",
        ),
        (
            "In the next lessons, you will create the UPDATE and DELETE policies before carrying out a complete security audit of the appointment database.",
            "In the next lessons, you will create the UPDATE policy and secure cancellation function before carrying out a complete security audit.",
        ),
        (
            "You also enabled Row Level Security and created separate SELECT, INSERT, UPDATE and DELETE policies to protect every appointment.",
            "You also enabled Row Level Security, created SELECT, INSERT and UPDATE policies, and added secure soft cancellation.",
        ),
        ("professional CRM software", "professional appointment management software"),
        ("professional CRM systems", "professional appointment management systems"),
        (
            "Do not create a secure cancellation function because this workbook keeps cancelled appointments as business history.",
            "Do not create a permanent-deletion policy because this workbook keeps cancelled appointments as business history.",
        ),
        (
            "An appointment may change their phone number, move to a new address, join a different company or update their email address.",
            "A client may request a different service, date or time.",
        ),
        ("Business Appointments", "Cancelled Appointments"),
        ("Individual appointments", "Booked appointments"),
        ("Business appointments", "Confirmed appointments"),
        ("Searching by first name works.", "Searching by client name works."),
        ("Searching by last name works.", "Searching by service works."),
        ("Appointment initials", "Client initials"),
        ("appointment initials", "client initials"),
        ("Appointment name", "Client name"),
        ("Appointment type", "Service"),
        ("Directory", "Schedule"),
        ("directory", "schedule"),
        ("those profiles", "those appointments"),
        (
            "secure cancellation function exists on the appointments table",
            "the secure cancellation function exists in the database",
        ),
        (
            "The file should create secure soft cancellation without adding a secure cancellation function.",
            "The file should create secure soft cancellation without adding a permanent-deletion policy.",
        ),
        (
            "• complete the four essential Row Level Security policies",
            "• complete the ownership policies and secure cancellation support",
        ),
    )
    for old, new in replacements:
        note = note.replace(old, new)

    # Keep cancellation as an UPDATE throughout the learner-facing project.
    note = note.replace("DELETE policy", "secure cancellation function")
    note = note.replace("DELETE Policy", "Secure Cancellation Function")
    note = note.replace("DELETE operation", "cancellation update")
    note = note.replace(
        "Do not create a secure cancellation function because this workbook keeps cancelled appointments as business history.",
        "Do not create a permanent-deletion policy because this workbook keeps cancelled appointments as business history.",
    )

    # The learner support pass is idempotent and supplies the permanent toolkit,
    # backup reminders and code-reading questions.
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
        "PROMPT TO PROFIT™ WORKBOOK 05",
        "APPOINTMENT BOOKING SYSTEM",
        "LEARNER SUPPORT TOOLKIT",
        "appointments",
        "client_name",
        "starts_at",
        "ends_at",
        "cancel_appointment",
        "Appointment Schedule",
        "Row Level Security",
        "emailRedirectTo",
        "CODE-READING QUESTION",
        "PORTFOLIO DESCRIPTION",
        "Workbook 06 — Sales Tracker",
    )
    for value in required:
        if value not in note:
            raise RuntimeError(f"Workbook 05 is missing required content: {value}")
    forbidden = (
        "Customer Record Management System",
        "Expense Tracker",
        "Professional Quotation Generator",
        "Professional Invoice Generator",
        "Workbook 01",
        "Workbook 02",
        "Workbook 03",
        "Workbook 04",
        "customer-profile",
        "VS Code",
        "React",
        "Node.js",
    )
    for value in forbidden:
        if value in note:
            raise RuntimeError(f"Workbook 05 contains forbidden text: {value}")
    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook 05 must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") != 36:
        raise RuntimeError("Workbook 05 must contain 36 complete lessons")
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
        if len(re.findall(rf"(?m)^{re.escape(heading)}$", note)) != 36:
            raise RuntimeError(f"Locked lesson heading count is wrong: {heading}")


def make_note() -> str:
    payload = json.loads(SOURCE.read_text(encoding="utf-8"))
    note = transform_project(payload["note"])
    note = replace_top_sections(note)
    note = replace_database_content(note)
    note = replace_dashboard_content(note)
    note = replace_schedule_content(note)
    note = replace_discovery_content(note)
    note = replace_edit_cancel_content(note)
    note = replace_final_sections(note)
    note = polish_remaining_sections(note)
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
