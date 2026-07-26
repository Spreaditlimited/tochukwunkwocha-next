#!/usr/bin/env python3
"""Apply the permanent hosted authentication-testing standard to Workbooks 01–02."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


SEP = "=" * 50


REGISTER_JS = """REGISTER.JS

Load after:

1. Supabase CDN

2. supabase-config.js

Use:

const supabaseClient

already created inside:

supabase-config.js

Do not create another Supabase client.

Validate:

• Full Name

• Email

• Password

• Confirm Password

Passwords must match.

Create the account using Supabase Authentication.

When calling:

supabaseClient.auth.signUp

include an email confirmation destination.

Create it from the website that is currently open:

`${window.location.origin}/login.html`

Pass that address as:

emailRedirectTo

inside the sign-up options.

Do not hardcode a Netlify website name.

Using:

window.location.origin

allows the same complete files to work when the website address changes.

Display friendly success and error messages.

Disable the button while processing.

After successful registration:

Inform the user to open the verification email.

Redirect to:

login.html

Do not automatically sign the user in from the registration form."""


FIRST_TEST_COMMON = """Do not assume the authentication system works.

Authentication must be tested from a website with an HTTPS address.

Do not test this chapter by double-clicking the HTML files in your project folder.

The files still remain inside your project folder.

You will simply place a test copy of the complete folder online before testing.

--------------------------------------------------
BEFORE YOU START THE TESTS
--------------------------------------------------

1.

Save every updated file in Notepad.

2.

Deploy the complete project folder to Netlify.

If you already created a Netlify test website for this project, deploy the updated folder to the same website.

3.

Copy the website address supplied by Netlify.

It should begin with:

https://

For example:

https://your-site-name.netlify.app

Your own website address will be different.

4.

Open your Supabase project.

Go to:

Authentication

Then open:

URL Configuration

5.

Set the Site URL to your Netlify website address.

Do not add a file name to the Site URL.

6.

Add this complete address to Redirect URLs:

https://your-site-name.netlify.app/login.html

Replace the example website name with your real Netlify website name.

7.

Make sure the latest version of every file has been deployed.

8.

Open the project from its Netlify HTTPS address.

Keep using that address throughout every test below.

--------------------------------------------------
TEST 1

PUBLIC WEBSITE
--------------------------------------------------

Open the deployed index.html page.

Confirm that:

✓ The landing page opens correctly.

✓ The page is fully styled.

✓ The responsive navigation still works.

✓ Login opens the deployed login.html page.

✓ Register opens the deployed register.html page.

Look at the browser address bar.

The address must begin with:

https://

Nothing already built should have stopped working.

--------------------------------------------------
TEST 2

REGISTRATION PAGE
--------------------------------------------------

Open the deployed register.html page.

Attempt to submit the form without entering any information.

Friendly validation messages should appear.

Complete the form using an email address that has not already been used for this test.

Click:

Register

The Register button should become disabled while the request is being processed.

A loading message should appear.

After successful registration:

You should see a message asking you to verify your email.

--------------------------------------------------
TEST 3

EMAIL VERIFICATION
--------------------------------------------------

Open your email inbox.

Locate the verification email from Supabase.

Open the email.

Click the verification link.

Supabase should verify the email and return the browser to your deployed website.

The returned address should use your Netlify website name.

It should not begin with:

file://

Depending on the authentication response, you may briefly see login.html or the application may recognise the new session and open the dashboard.

Both results confirm that the browser returned to the correct website.

If the login page remains open, sign in using the email address and password you registered.

If the verification email does not arrive immediately:

Wait a few minutes.

Refresh your inbox.

Check your Spam or Junk folder.

If the verification link opens the wrong website:

Return to Supabase URL Configuration.

Check the Site URL and Redirect URLs carefully.

Correct them before creating another test account.

--------------------------------------------------
TEST 4

LOGIN
--------------------------------------------------

Open the deployed login.html page.

Enter an incorrect password.

A friendly error message should appear.

Now enter the correct password.

Click:

Login

The Login button should become disabled while signing in.

A loading message should appear.

After a successful login:

The browser should open the deployed dashboard.html page.

--------------------------------------------------
TEST 5

AUTHENTICATED SESSION
--------------------------------------------------

After signing in successfully:

Confirm that the protected dashboard opens.

Confirm that your email address appears.

Refresh the page.

The dashboard should remain open because the same website still has your authenticated session."""


FIRST_TEST_ENDINGS = {
    "expense": """Confirm that the Income, Expenses and Balance cards appear.

Confirm that the Logout button appears.

Click:

Logout

The browser should return to the deployed login.html page.

While signed out, open the complete deployed dashboard.html address.

The application should immediately return you to the deployed login.html page.

Sign in again.

While signed in, open the complete deployed login.html address.

The application should immediately return you to the deployed dashboard.html page.""",
    "customer": """Confirm that the four customer summary cards appear.

Confirm that the Logout button appears.

While signed in, open the complete deployed customer-profile.html address.

The protected customer profile page should open.

Click:

Logout

The browser should return to the deployed login.html page.

While signed out, open the complete deployed dashboard.html address.

The application should immediately return you to the deployed login.html page.

While still signed out, open the complete deployed customer-profile.html address.

The application should immediately return you to the deployed login.html page.

Sign in again.

While signed in, open the complete deployed login.html address.

The application should immediately return you to the deployed dashboard.html page.""",
}


AUDIT_COMMON = """Complete this final authentication check on the deployed HTTPS website.

Do not complete this audit from files opened with:

file://

SUPABASE URL SETTINGS

✓ The Site URL contains the Netlify website address.

✓ Redirect URLs contains the complete deployed login.html address.

REGISTRATION AND VERIFICATION

✓ Registration works from the deployed register.html page.

✓ A verification email arrives.

✓ The verification link returns to the deployed website.

✓ The returned address begins with https:// and uses the correct Netlify website name.

LOGIN AND SESSION

✓ Login works from the deployed login.html page.

✓ Refreshing a protected page keeps a signed-in user signed in.

✓ Logout works.

PROTECTION

✓ A signed-out visitor cannot remain on dashboard.html.

✓ A signed-in user can reach dashboard.html.

✓ A signed-in user who opens login.html returns to dashboard.html."""


AUDIT_ENDINGS = {
    "expense": """PAGES

✓ The signed-in user's email appears.

✓ The Income, Expenses and Balance cards appear.

If every check passes, the authentication system is ready for the next chapter.""",
    "customer": """PROTECTED CUSTOMER PAGE

✓ A signed-in user can open customer-profile.html.

✓ A signed-out visitor cannot remain on customer-profile.html.

PAGES

✓ The signed-in user's email appears.

✓ The summary cards appear.

✓ The customer profile placeholder appears.

If every check passes, the authentication system is ready for the next chapter.""",
}


def chapter_blocks(note: str, chapter: int) -> list[tuple[int, int, str]]:
    starts = [m.start() for m in re.finditer(rf"(?m)^CHAPTER {chapter}\s*$", note)]
    blocks: list[tuple[int, int, str]] = []
    for start in starts:
        following = re.search(rf"(?m)^CHAPTER (?:{chapter}|{chapter + 1})\s*$", note[start + 1 :])
        end = start + 1 + following.start() if following else len(note)
        blocks.append((start, end, note[start:end]))
    return blocks


def replace_in_block(
    note: str,
    block_anchor: str,
    section_title: str,
    next_title: str,
    body: str,
) -> str:
    matches = [block for block in chapter_blocks(note, 3) if block_anchor in block[2]]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one Chapter 3 block containing {block_anchor!r}; found {len(matches)}"
        )
    start, end, block = matches[0]
    pattern = (
        rf"{re.escape(section_title)}\n{re.escape(SEP)}\n[\s\S]*?"
        rf"(?={re.escape(SEP)}\n{re.escape(next_title)}\n)"
    )
    replacement = f"{section_title}\n{SEP}\n\n{body.strip()}\n\n"
    updated, count = re.subn(pattern, replacement, block, count=1)
    if count != 1:
        raise RuntimeError(
            f"Could not replace {section_title!r} before {next_title!r} "
            f"in block {block_anchor!r}"
        )
    return note[:start] + updated + note[end:]


def replace_register_js(note: str, build_anchor: str) -> str:
    matches = [block for block in chapter_blocks(note, 3) if build_anchor in block[2]]
    if len(matches) != 1:
        raise RuntimeError(
            f"Expected one authentication build block containing {build_anchor!r}"
        )
    start, end, block = matches[0]
    pattern = r"REGISTER\.JS\n\nRequirements:\n[\s\S]*?(?=\n={50}\n\nLOGIN\.JS)"
    replacement = REGISTER_JS
    updated, count = re.subn(pattern, replacement, block, count=1)
    if count != 1:
        pattern = r"REGISTER\.JS\n[\s\S]*?(?=\n={50}\n\nLOGIN\.JS)"
        updated, count = re.subn(pattern, replacement, block, count=1)
    if count != 1:
        raise RuntimeError("Could not replace the REGISTER.JS requirements")
    return note[:start] + updated + note[end:]


def apply_standard(note: str, workbook: str) -> str:
    if workbook == "expense":
        build_anchor = "LESSON 1\n\nBUILDING THE COMPLETE AUTHENTICATION SYSTEM"
        first_test_anchor = "LESSON 1 (CONTINUED)"
        audit_anchor = "LESSON 2\n\nAUDITING YOUR AUTHENTICATION SYSTEM"
        audit_next = "FINAL AUTHENTICATION CHECKLIST"
    else:
        build_anchor = "LESSON 2\n\nBUILDING THE COMPLETE AUTHENTICATION SYSTEM"
        first_test_anchor = "LESSON 2 (CONTINUED)"
        audit_anchor = "LESSON 3\n\nAUDITING THE AUTHENTICATION SYSTEM"
        audit_next = "CHECKPOINT"

    note = replace_register_js(note, build_anchor)
    note = replace_in_block(
        note,
        first_test_anchor,
        "TEST YOUR WORK",
        "CHECKPOINT",
        FIRST_TEST_COMMON + "\n\n" + FIRST_TEST_ENDINGS[workbook],
    )
    note = replace_in_block(
        note,
        audit_anchor,
        "TEST YOUR WORK",
        audit_next,
        AUDIT_COMMON + "\n\n" + AUDIT_ENDINGS[workbook],
    )
    return note


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("--workbook", choices=("expense", "customer"), required=True)
    args = parser.parse_args()

    payload = json.loads(args.source.read_text(encoding="utf-8"))
    updated = apply_standard(payload["note"], args.workbook)
    payload["note"] = updated
    args.source.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {args.source}")


if __name__ == "__main__":
    main()
