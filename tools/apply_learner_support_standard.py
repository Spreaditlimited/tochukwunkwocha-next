#!/usr/bin/env python3
"""Add the permanent beginner-support template to a workbook manuscript."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


SEP = "=" * 50

TOOLKIT = f"""
{SEP}
LEARNER SUPPORT TOOLKIT
{SEP}

Keep this part of the workbook close while you build.

It explains common words, shows you how to protect your work, gives you a simple way to investigate problems, and provides a place to record errors and solutions.

You are not expected to remember everything immediately.

Return to these pages whenever you need them.

{SEP}
VISUAL GLOSSARY
{SEP}

HTML :: The file that gives a web page its content and structure.

CSS :: The file that controls colours, spacing, layout and appearance.

VANILLA JAVASCRIPT :: JavaScript used without a framework. It controls what the application does.

BROWSER :: The program used to open and test the application, such as Chrome or Edge.

FILE :: One saved part of the project, such as index.html or dashboard.js.

FOLDER :: The place where all files for one project are kept together.

FUNCTION :: A named set of instructions that performs one task.

EVENT :: An action the browser can notice, such as a click, form submission or key press.

VARIABLE :: A named place used to hold information while the application is running.

URL :: The address of a page, website or online service.

SUPABASE :: The online service used for the database, authentication and security.

DATABASE :: An organised place where the application stores information.

TABLE :: A named part of the database that stores one type of information.

RECORD :: One complete item saved inside a database table.

AUTHENTICATION :: The process of creating accounts, signing in and identifying the current user.

SESSION :: The saved sign-in state that allows the application to remember the current user.

ROW LEVEL SECURITY :: Supabase rules that control which database records each user can access.

PUBLISHABLE KEY :: The Supabase project key that browser-based applications are allowed to use.

DEPLOY :: To place the complete project online so it has a live HTTPS website address.

DEBUGGING :: The careful process of finding, understanding and correcting a problem.

{SEP}
WORK SAFELY: MAKE A BACKUP
{SEP}

A backup is a separate copy of your complete project folder.

Create a backup before replacing files that already contain working code.

1.

Close any project files that are open in Notepad.

2.

Find your complete project folder.

3.

Copy the folder.

4.

Paste the copy outside the working project folder.

Do not place the backup inside the folder you deploy.

5.

Rename the copy clearly.

For example:

Project Backup - Before Chapter 3 Lesson 2

6.

Open the backup folder.

Confirm that the expected files are inside it.

If a new change causes a serious problem, you can return to this working copy.

{SEP}
SOMETHING WENT WRONG — WHAT SHOULD I CHECK?
{SEP}

Problems are a normal part of building software.

Do not replace random pieces of code and do not continue to the next lesson.

Work through this checklist in order.

□ Confirm that you opened the correct project folder.

□ Confirm that every updated file was saved in Notepad.

□ Check every filename carefully.

□ Make sure an HTML, CSS or JavaScript file does not end with .txt.

□ Confirm that you pasted the complete file returned by AI.

□ Confirm that you did not paste an explanation, a code-block label or only part of a file.

□ Check that stylesheet and JavaScript filenames match the names used inside the HTML.

□ On Supabase pages, check that the scripts load in the order taught in the lesson.

□ Read the exact message shown on the page.

□ Open the browser Console and look for the first red error.

To open the Console:

Right-click the page.

Select:

Inspect

Then select:

Console

□ Copy the complete first red error into your error log.

□ Think about the last file you changed before the problem appeared.

□ Compare that file with the lesson requirements.

□ If necessary, restore the most recent working backup.

When asking AI for help, provide:

• What you were trying to do

• What you expected to happen

• What actually happened

• The complete error message

• The names of the files involved

Ask AI to return complete corrected files.

Do not ask for snippets.

{SEP}
MY ERROR LOG
{SEP}

Use this page whenever something does not work.

Writing down the problem helps you investigate it carefully and remember the solution.

ERROR 1

Date: ______________________________________________

Chapter and lesson: _________________________________

What I was trying to do:

____________________________________________________

What I expected to happen:

____________________________________________________

What actually happened:

____________________________________________________

First error message:

____________________________________________________

File or files involved:

____________________________________________________

What I checked or changed:

____________________________________________________

What fixed the problem:

____________________________________________________

ERROR 2

Date: ______________________________________________

Chapter and lesson: _________________________________

What I was trying to do:

____________________________________________________

What I expected to happen:

____________________________________________________

What actually happened:

____________________________________________________

First error message:

____________________________________________________

File or files involved:

____________________________________________________

What I checked or changed:

____________________________________________________

What fixed the problem:

____________________________________________________
""".strip()


BACKUP_REMINDER = """BACK UP BEFORE REPLACING FILES

Before replacing an existing file, copy your complete project folder.

Save the copy outside your working project folder.

Name the backup clearly using the current chapter and lesson.

Open the backup and confirm that your files are inside it.

CONTINUE SAVING YOUR FILES
"""


NO_BUILD_PHRASES = (
    "there is nothing to build with ai",
    "there is nothing to build with chatgpt",
    "nothing is created with chatgpt",
)


def lesson_capability_segments(note: str) -> list[tuple[int, int, str, str]]:
    """Return (insert position, prompt start, title, lesson text) for code lessons."""
    learned = list(re.finditer(r"(?m)^WHAT YOU LEARNED\s*$", note))
    previous_end = 0
    capabilities: list[tuple[int, int, str, str]] = []
    for match in learned:
        lesson_text = note[previous_end : match.start()]
        previous_end = match.end()
        prompts = list(re.finditer(r"(?m)^BUILD PROMPT\s*$", lesson_text))
        if not prompts:
            continue
        prompt = prompts[-1]
        prompt_text = lesson_text[prompt.end() :]
        lower = prompt_text.lower()
        if any(phrase in lower for phrase in NO_BUILD_PHRASES):
            continue
        if not re.search(r"\b[\w-]+\.(?:html|css|js)\b", prompt_text, re.I):
            continue

        titles = list(
            re.finditer(
                r"(?m)^LESSON\s+\d+(?:\s+\(CONTINUED\))?\s*$", lesson_text
            )
        )
        title = "the capability you just built"
        if titles:
            after = lesson_text[titles[-1].end() :].splitlines()
            title = next((line.strip() for line in after if line.strip()), title)
        capabilities.append(
            (match.start(), previous_end - len("WHAT YOU LEARNED"), title, lesson_text)
        )
    return capabilities


def choose_file(title: str, lesson_text: str) -> str:
    return_sections = list(
        re.finditer(r"(?m)^WHAT AI SHOULD RETURN\s*$", lesson_text)
    )
    search_text = (
        lesson_text[return_sections[-1].end() :]
        if return_sections
        else lesson_text
    )
    filenames = re.findall(
        r"\b[\w-]+\.(?:html|css|js)\b", search_text, flags=re.I
    )
    if not filenames:
        filenames = re.findall(
            r"\b[\w-]+\.(?:html|css|js)\b", lesson_text, flags=re.I
        )
    unique = list(dict.fromkeys(name.lower() for name in filenames))
    upper = title.upper()
    all_filenames = list(
        dict.fromkeys(
            name.lower()
            for name in re.findall(
                r"\b[\w-]+\.(?:html|css|js)\b", lesson_text, flags=re.I
            )
        )
    )
    if "CONNECTION FILE" in upper and "supabase-config.js" in all_filenames:
        return "supabase-config.js"
    if "CONNECTION TEST" in upper and "test-connection.html" in all_filenames:
        return "test-connection.html"
    if "STYL" in upper:
        return next((name for name in unique if name.endswith(".css")), unique[0])
    if (
        ("LANDING PAGE" in upper or "PUBLIC WEBSITE" in upper)
        and "index.html" in all_filenames
    ):
        return "index.html"
    preferred_js = [
        name
        for name in unique
        if name.endswith(".js") and name != "supabase-config.js"
    ]
    if preferred_js:
        return preferred_js[0]
    js_files = [name for name in unique if name.endswith(".js")]
    if js_files:
        return js_files[0]
    return unique[0]


def code_question(title: str, lesson_text: str) -> str:
    filename = choose_file(title, lesson_text)
    capability = title.lower()
    if filename == "supabase-config.js":
        question = (
            "Open supabase-config.js. Which line creates the Supabase client, "
            "and which two saved values does that line use?"
        )
    elif filename.endswith(".css"):
        question = (
            f"Open {filename}. Find one style rule added for {capability}. "
            "Which selector does the rule use?"
        )
    elif filename.endswith(".html"):
        question = (
            f"Open {filename}. Find the part of the page added for {capability}. "
            "Which HTML element starts that part?"
        )
    else:
        question = (
            f"Open {filename}. Find one function that supports {capability}. "
            "What is the function called, and what action makes it run?"
        )
    return (
        "CODE-READING QUESTION\n\n"
        f"{question}\n\n"
        "Write your answer in your own words.\n\n"
        "____________________________________________________\n\n"
        "____________________________________________________\n\n"
        f"{SEP}\n"
    )


def add_code_questions(note: str) -> str:
    inserts = [
        item
        for item in lesson_capability_segments(note)
        if "CODE-READING QUESTION" not in item[3]
    ]
    for position, _, title, lesson_text in reversed(inserts):
        note = note[:position] + code_question(title, lesson_text) + note[position:]
    return note


def add_backup_reminders(note: str) -> str:
    sections = list(re.finditer(r"(?m)^SAVE YOUR FILES\s*$", note))
    for match in reversed(sections):
        after = note[match.end() :]
        end_match = re.search(r"(?m)^TEST YOUR WORK\s*$", after)
        if not end_match:
            continue
        end = match.end() + end_match.start()
        body = note[match.end() : end]
        lower = body.lower()
        needs_backup = any(
            phrase in lower
            for phrase in (
                "replace",
                "updated file",
                "updated version",
                "already exists",
                "existing code",
                "existing contents",
            )
        )
        if not needs_backup or "BACK UP BEFORE REPLACING FILES" in body:
            continue
        separator = re.match(r"\s*\n={50}\n", note[match.end() :])
        insert_at = match.end() + (separator.end() if separator else 0)
        note = note[:insert_at] + "\n" + BACKUP_REMINDER + note[insert_at:]
    return note


def add_toolkit(note: str) -> str:
    if "LEARNER SUPPORT TOOLKIT" in note:
        return note
    chapter = re.search(r"(?m)^CHAPTER 1\s*$", note)
    if not chapter:
        raise RuntimeError("Could not find the first Chapter 1 heading")
    insertion = f"\n{TOOLKIT}\n\n{SEP}\n"
    return note[: chapter.start()] + insertion + note[chapter.start() :]


def apply_standard(note: str) -> str:
    note = add_toolkit(note)
    note = add_backup_reminders(note)
    note = add_code_questions(note)
    return note


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    args = parser.parse_args()

    payload = json.loads(args.source.read_text(encoding="utf-8"))
    payload["note"] = apply_standard(payload["note"])
    args.source.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Updated {args.source}")


if __name__ == "__main__":
    main()
