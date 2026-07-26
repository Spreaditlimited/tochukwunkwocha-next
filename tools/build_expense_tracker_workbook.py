#!/usr/bin/env python3
"""Build the publication master for Prompt to Profit Workbook 01."""

from __future__ import annotations

import argparse
import html
import json
import re
from pathlib import Path


CALLOUTS = {
    "AI Prompt": "prompt",
    "Common Beginner Mistakes": "warning",
    "Behind The Scenes": "insight",
    "Think Like a Software Designer": "designer",
    "Checkpoint": "checklist",
    "Before You Continue": "note",
    "What You Learned": "learning",
    "What The AI Should Return": "result",
    "Test Your Work": "test",
    "Milestone Review": "milestone",
    "BUILD PROMPT": "prompt",
    "COMMON BEGINNER MISTAKES": "warning",
    "BEHIND THE SCENES": "insight",
    "THINK LIKE A SOFTWARE DESIGNER": "designer",
    "CHECKPOINT": "checklist",
    "BEFORE YOU CONTINUE": "note",
    "WHAT YOU LEARNED": "learning",
    "WHAT AI SHOULD RETURN": "result",
    "TEST YOUR WORK": "test",
    "CHAPTER MILESTONE": "milestone",
    "IMPORTANT": "warning",
    "DATABASE SECURITY": "warning",
    "VISUAL GLOSSARY": "glossary",
    "WORK SAFELY: MAKE A BACKUP": "backup",
    "SOMETHING WENT WRONG — WHAT SHOULD I CHECK?": "troubleshoot",
    "MY ERROR LOG": "log",
    "BACK UP BEFORE REPLACING FILES": "backup",
    "CONTINUE SAVING YOUR FILES": "",
    "CODE-READING QUESTION": "code",
}

PROMPT_END_SECTIONS = {
    "WHAT AI SHOULD RETURN",
    "SAVE YOUR FILES",
    "TEST YOUR WORK",
    "CHECKPOINT",
    "COMMON BEGINNER MISTAKES",
    "BEHIND THE SCENES",
    "THINK LIKE A SOFTWARE DESIGNER",
    "CODE-READING QUESTION",
    "WHAT YOU LEARNED",
    "CHAPTER SUMMARY",
    "CHAPTER MILESTONE",
    "TRANSITION",
}


def slug(text: str, used: dict[str, int]) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-") or "section"
    used[base] = used.get(base, 0) + 1
    return base if used[base] == 1 else f"{base}-{used[base]}"


def inline(text: str) -> str:
    escaped = html.escape(text)
    escaped = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", escaped)
    escaped = re.sub(
        r"(https?://[^\s<]+)",
        r'<span class="url">\1</span>',
        escaped,
    )
    return escaped


def roman(number: int) -> str:
    values = (
        (1000, "m"), (900, "cm"), (500, "d"), (400, "cd"),
        (100, "c"), (90, "xc"), (50, "l"), (40, "xl"),
        (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i"),
    )
    result = []
    for value, glyph in values:
        while number >= value:
            result.append(glyph)
            number -= value
    return "".join(result)


def workbook_metadata(cover_lines: list[str], note: str) -> dict[str, str]:
    series_line = cover_lines[0].strip() if cover_lines else "PROMPT TO PROFIT™"
    match = re.search(r"\bWORKBOOK\s+(\d+)\b", series_line, re.IGNORECASE)
    number = match.group(1) if match else "01"
    series = re.sub(r"\s+WORKBOOK\s+\d+\s*$", "", series_line, flags=re.IGNORECASE)
    title_source = cover_lines[1].strip() if len(cover_lines) > 1 else "SOFTWARE WORKBOOK"
    build_title_match = re.fullmatch(
        r"BUILD AN?\s+(.+?)\s+WITH AI", title_source, re.IGNORECASE
    )
    title = (
        build_title_match.group(1).title()
        if build_title_match else title_source.title()
    )
    workbook_label = f"Workbook {number}"

    subtitles = {
        "Customer Record Management System":
            "Build a Complete Customer Management Application with AI",
        "Professional Quotation Generator":
            "Build a Complete Quotation Management Application with AI",
        "Professional Invoice Generator":
            "Build a Complete Invoice Management Application with AI",
        "Appointment Booking System":
            "Build a Complete Appointment Scheduling Application with AI",
        "Expense Tracker":
            "Build a Complete Expense Tracking Application with AI",
    }
    subtitle = subtitles.get(title, "Build a Complete Software Application with AI")

    minutes = []
    note_lines = note.splitlines()
    for index, line in enumerate(note_lines):
        if line.strip().lower() != "estimated time":
            continue
        for following in note_lines[index + 1:index + 5]:
            value = following.strip()
            if not value:
                continue
            time_match = re.fullmatch(r"(\d+)\s+minutes?", value, re.IGNORECASE)
            if time_match:
                minutes.append(int(time_match.group(1)))
            break
    total_hours = sum(minutes) / 60 if minutes else 0
    if total_hours:
        lower = max(1, int(total_hours // 5) * 5)
        upper = lower + 5
        estimated_time = f"{lower}–{upper} Hours"
    else:
        estimated_time = "Self-paced"
    if title == "Expense Tracker":
        estimated_time = "10–15 Hours"

    return {
        "series": series,
        "workbook_label": workbook_label,
        "book_title": title,
        "cover_subtitle": subtitle,
        "difficulty": "Beginner",
        "estimated_time": estimated_time,
    }


def apply_metadata(document: str, metadata: dict[str, str]) -> str:
    replacements = {
        "{{SERIES_NAME}}": metadata["series"],
        "{{WORKBOOK_LABEL}}": metadata["workbook_label"],
        "{{BOOK_TITLE}}": metadata["book_title"],
        "{{COVER_SUBTITLE}}": metadata["cover_subtitle"],
        "{{DIFFICULTY}}": metadata["difficulty"],
        "{{ESTIMATED_TIME}}": metadata["estimated_time"],
    }
    for token, value in replacements.items():
        document = document.replace(token, html.escape(value))
    return document


def parse_separator_workbook(lines: list[str]) -> tuple[list[str], list[dict], list[dict[str, str]]]:
    """Parse the revised workbook's rule-delimited plain-text hierarchy."""
    text = "\n".join(lines)
    segments = re.split(r"^={20,}\s*$", text, flags=re.MULTILINE)
    segments = [[line for line in part.splitlines() if line.strip()] for part in segments]
    cover_lines = segments[1] if len(segments) > 1 else []
    segments = segments[2:]

    used: dict[str, int] = {}
    parsed: list[dict] = []
    anchors: list[dict[str, str]] = []
    seen_chapters: set[str] = set()
    pending_chapter_repeat = False
    active_callout = ""
    current_chapter = ""

    def add_heading(
        text: str, level: int, classes: str = "", break_before: bool = False,
        toc_type: str = "", toc_label: str = "", callout: str = "",
        running_text: str = "",
    ) -> str:
        anchor = slug(text, used)
        parsed.append({
            "kind": "heading", "level": level, "text": text, "id": anchor,
            "classes": classes, "break": break_before, "page_kind": "body",
            "callout": callout, "running": running_text,
        })
        if toc_type:
            anchors.append({
                "id": anchor, "label": toc_label or text.title(), "type": toc_type,
            })
        return anchor

    def is_display_heading(value: str) -> bool:
        if value.startswith(("•", "□", "✓", "- ", "* ")):
            return False
        if re.match(r"^\d+\.\s*", value):
            return False
        letters = [c for c in value if c.isalpha()]
        return (
            bool(letters) and value == value.upper() and len(value) <= 92
            and not value.startswith(("HTTP://", "HTTPS://"))
        )

    for segment_index, segment in enumerate(segments):
        if not segment:
            continue
        first = segment[0].strip()
        remaining = list(segment)
        callout = active_callout

        chapter_match = re.fullmatch(r"CHAPTER\s+(\d+)", first)
        lesson_match = re.fullmatch(r"LESSON\s+(\d+)(\s+\(CONTINUED\))?", first)

        if chapter_match:
            active_callout = callout = ""
            chapter = chapter_match.group(1)
            current_chapter = chapter
            title = segment[1].strip() if len(segment) > 1 else ""
            if chapter not in seen_chapters:
                seen_chapters.add(chapter)
                add_heading(
                    first, 1, "chapter-number", True, "chapter",
                    f"CHAPTER {chapter} · {title}" if title else f"CHAPTER {chapter}",
                )
                if title:
                    add_heading(title, 2, "chapter-title")
                pending_chapter_repeat = False
            else:
                next_first = (
                    segments[segment_index + 1][0].strip()
                    if segment_index + 1 < len(segments)
                    and segments[segment_index + 1]
                    else ""
                )
                # Source manuscripts repeat the chapter label before lessons
                # and sometimes once more before a chapter summary. The latter
                # would create a page containing only the small chapter label
                # because the summary has its own forced page break.
                if not re.fullmatch(r"LESSON\s+\d+(\s+\(CONTINUED\))?", next_first):
                    pending_chapter_repeat = False
                    continue
                add_heading(first, 3, "chapter-repeat", True)
                if title:
                    add_heading(title, 3, "chapter-repeat-title")
                pending_chapter_repeat = True
            remaining = segment[2:] if title else segment[1:]

        elif lesson_match:
            active_callout = callout = ""
            title = segment[1].strip() if len(segment) > 1 else ""
            continued = bool(lesson_match.group(2))
            anchor = add_heading(
                first, 1, "lesson-number", not pending_chapter_repeat,
                "" if continued else "lesson",
                (
                    f"LESSON {lesson_match.group(1)} · {title}"
                    if title else f"LESSON {lesson_match.group(1)}"
                ),
                "",
                f"CHAPTER {current_chapter} · LESSON {lesson_match.group(1)}",
            )
            if title:
                add_heading(title, 2, "lesson-title")
            remaining = segment[2:] if title else segment[1:]
            pending_chapter_repeat = False

        elif is_display_heading(first):
            # A Build Prompt can contain many project-specific headings. Keep
            # every one of them inside the prompt treatment until the next
            # locked lesson section begins.
            ending_prompt = (
                active_callout == "prompt" and first in PROMPT_END_SECTIONS
            )
            if active_callout == "prompt" and first not in PROMPT_END_SECTIONS:
                callout = "prompt"
            else:
                callout = CALLOUTS.get(first, "")
            active_callout = callout
            support_pages = {
                "LEARNER SUPPORT TOOLKIT",
                "VISUAL GLOSSARY",
                "WORK SAFELY: MAKE A BACKUP",
                "SOMETHING WENT WRONG — WHAT SHOULD I CHECK?",
                "MY ERROR LOG",
            }
            if first in {
                "WELCOME", "REFLECTION QUESTIONS", "EXTENSION CHALLENGES",
                "NEXT WORKBOOK",
            } | support_pages:
                level, classes = 1, "major-heading"
                break_before = first != "WELCOME"
            elif first in {"CHAPTER SUMMARY", "CHAPTER MILESTONE"}:
                level, classes, break_before = 1, "milestone-heading", True
            else:
                level, classes, break_before = 2, "section-heading", False
            toc_type = "end" if first in {
                "REFLECTION QUESTIONS", "EXTENSION CHALLENGES", "NEXT WORKBOOK"
            } else (
                "support" if first in support_pages
                else (
                    "milestone"
                    if first in {"CHAPTER SUMMARY", "CHAPTER MILESTONE"}
                    else ""
                )
            )
            if ending_prompt:
                parsed.append({
                    "kind": "prompt-marker", "text": "PROMPT ENDS HERE",
                    "position": "end", "callout": "prompt",
                })
            add_heading(first, level, classes, break_before, toc_type, first, callout)
            if first == "BUILD PROMPT":
                parsed.append({
                    "kind": "prompt-marker", "text": "PROMPT STARTS HERE",
                    "position": "start", "callout": "prompt",
                })
            remaining = segment[1:]

        for raw in remaining:
            stripped = raw.strip()
            if raw == stripped and is_display_heading(stripped):
                sub_callout = (
                    "prompt"
                    if callout == "prompt"
                    else CALLOUTS.get(stripped, callout)
                )
                add_heading(stripped, 3, "minor-heading", False, callout=sub_callout)
                active_callout = callout = sub_callout
                continue
            if callout == "glossary" and " :: " in raw:
                kind = "glossary"
            elif stripped.startswith(("□", "✓")):
                kind = "checkbox"
            elif stripped.startswith("•") or re.match(r"^[-*]\s+", stripped):
                kind = "bullet"
            elif re.match(r"^\d+\.\s*", stripped):
                kind = "numbered"
            else:
                kind = "paragraph"
            parsed.append({
                "kind": kind, "text": raw, "section": first, "callout": callout,
            })

    return cover_lines, parsed, anchors


def validate_authentication_standard(note: str) -> None:
    """Prevent publication of authentication lessons that rely on local files."""
    chapter_start = re.search(r"(?m)^CHAPTER 3\s*$", note)
    if not chapter_start:
        return
    chapter_end = re.search(
        r"(?m)^CHAPTER 4\s*$", note[chapter_start.end() :]
    )
    end = (
        chapter_start.end() + chapter_end.start()
        if chapter_end
        else len(note)
    )
    chapter = note[chapter_start.start() : end]
    if not re.search(
        r"(?i)\b(authentication|register\.html|login\.html)\b", chapter
    ):
        return

    required = {
        "a hosted test website": r"(?i)\bNetlify\b",
        "Supabase Site URL": r"(?i)\bSite URL\b",
        "Supabase Redirect URLs": r"(?i)\bRedirect URLs\b",
        "an explicit sign-up redirect": r"(?i)\bemailRedirectTo\b",
        "a same-site login redirect": (
            r"window\.location\.origin[\s\S]{0,100}/login\.html"
        ),
        "HTTPS authentication testing": r"(?i)https://",
        "a warning against local-file authentication tests": r"file://",
    }
    missing = [
        description
        for description, pattern in required.items()
        if not re.search(pattern, chapter)
    ]
    if missing:
        joined = ", ".join(missing)
        raise ValueError(
            "Authentication publication standard failed. Missing: "
            f"{joined}. See docs/workbook-authentication-testing-standard.md."
        )


def validate_learner_support_standard(note: str) -> None:
    """Keep the permanent beginner-support pages and lesson safeguards intact."""
    required_headings = (
        "LEARNER SUPPORT TOOLKIT",
        "VISUAL GLOSSARY",
        "WORK SAFELY: MAKE A BACKUP",
        "SOMETHING WENT WRONG — WHAT SHOULD I CHECK?",
        "MY ERROR LOG",
    )
    missing = [
        heading for heading in required_headings
        if not re.search(rf"(?m)^{re.escape(heading)}\s*$", note)
    ]
    if missing:
        raise ValueError(
            "Learner-support publication standard failed. Missing pages: "
            + ", ".join(missing)
            + ". See docs/workbook-learner-support-standard.md."
        )

    glossary_start = note.index("VISUAL GLOSSARY")
    glossary_end = note.index("WORK SAFELY: MAKE A BACKUP", glossary_start)
    glossary_entries = note[glossary_start:glossary_end].count(" :: ")
    if glossary_entries < 15:
        raise ValueError(
            "Learner-support publication standard failed. "
            "The visual glossary must contain at least 15 recurring terms."
        )

    learned = list(re.finditer(r"(?m)^WHAT YOU LEARNED\s*$", note))
    previous_end = 0
    capability_count = 0
    for match in learned:
        lesson_text = note[previous_end:match.start()]
        previous_end = match.end()
        prompts = list(re.finditer(r"(?m)^BUILD PROMPT\s*$", lesson_text))
        if not prompts:
            continue
        prompt_text = lesson_text[prompts[-1].end():]
        lower = prompt_text.lower()
        no_build = any(
            phrase in lower
            for phrase in (
                "there is nothing to build with ai",
                "there is nothing to build with chatgpt",
                "nothing is created with chatgpt",
            )
        )
        if (
            not no_build
            and re.search(r"\b[\w-]+\.(?:html|css|js)\b", prompt_text, re.I)
        ):
            capability_count += 1

    question_count = len(
        re.findall(r"(?m)^CODE-READING QUESTION\s*$", note)
    )
    if question_count != capability_count:
        raise ValueError(
            "Learner-support publication standard failed. "
            f"Found {capability_count} code-building capabilities but "
            f"{question_count} code-reading questions."
        )

    save_sections = list(re.finditer(r"(?m)^SAVE YOUR FILES\s*$", note))
    for number, match in enumerate(save_sections, start=1):
        after = note[match.end():]
        end_match = re.search(r"(?m)^TEST YOUR WORK\s*$", after)
        if not end_match:
            continue
        body = after[:end_match.start()]
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
        if needs_backup and "BACK UP BEFORE REPLACING FILES" not in body:
            raise ValueError(
                "Learner-support publication standard failed. "
                f"Save Your Files section {number} replaces existing work "
                "without a backup reminder."
            )


def build(source_path: Path, output_path: Path) -> dict[str, int]:
    payload = json.loads(source_path.read_text(encoding="utf-8"))
    note = payload["note"]
    validate_authentication_standard(note)
    validate_learner_support_standard(note)
    lines = note.splitlines()

    if any(re.fullmatch(r"={20,}", line.strip()) for line in lines):
        cover_lines, parsed, anchors = parse_separator_workbook(lines)
        metadata = workbook_metadata(cover_lines, note)
        document = HTML_TEMPLATE.replace(
            "{{COVER}}", render_cover(cover_lines, metadata)
        )
        document = document.replace("{{TOC}}", render_toc(anchors))
        document = document.replace(
            "{{FLOW}}", "\n".join(render_item(item) for item in parsed)
        )
        document = apply_metadata(document, metadata)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(document, encoding="utf-8")
        return {
            "source_lines": len(lines),
            "source_characters": len(note),
            "chapters": sum(1 for a in anchors if a["type"] == "chapter"),
            "lessons": sum(1 for a in anchors if a["type"] == "lesson"),
            "toc_entries": len(anchors),
            "build_prompts": sum(
                1 for item in parsed
                if item["kind"] == "heading" and item.get("text") == "BUILD PROMPT"
            ),
        }

    welcome_index = next(i for i, line in enumerate(lines) if line == "# Welcome")
    cover_lines = lines[:welcome_index]
    body_lines = lines[welcome_index:]

    used: dict[str, int] = {}
    anchors: list[dict[str, str]] = []
    parsed: list[dict[str, str | int | bool]] = []
    current_section = ""
    current_callout = ""
    current_lesson = ""
    chapter_sequence = False

    # Determine which repeated brand marks immediately introduce chapter pages.
    chapter_brand_indexes: set[int] = set()
    for idx, line in enumerate(body_lines):
        if line == "# Prompt to Profit™":
            lookahead = body_lines[idx:idx + 14]
            if any(item.startswith("# Chapter ") for item in lookahead):
                chapter_brand_indexes.add(idx)

    for index, raw in enumerate(body_lines):
        if not raw.strip():
            continue
        if raw == "---":
            parsed.append({"kind": "rule", "callout": current_callout})
            continue
        match = re.match(r"^(#{1,3})\s+(.+)$", raw)
        if match:
            level = len(match.group(1))
            text = match.group(2)
            ending_prompt = (
                current_callout == "prompt"
                and text in {"What The AI Should Return", "WHAT AI SHOULD RETURN"}
            )
            anchor = slug(text, used)
            current_section = text
            current_callout = CALLOUTS.get(text, "")
            classes = []
            break_before = False
            page_kind = "body"

            if level == 1 and re.fullmatch(r"Lesson \d+", text):
                classes.append("lesson-number")
                current_lesson = text
                break_before = True
            elif level == 1 and text.startswith("Chapter "):
                classes.append("chapter-number")
            elif level == 1 and text in {"Milestone", "Final Milestone"}:
                classes.append("milestone-heading")
                break_before = True
            elif level == 1 and text == "Welcome":
                classes.append("welcome-heading")
                break_before = True
            elif level == 1 and text == "Prompt to Profit™" and index in chapter_brand_indexes:
                classes.append("chapter-brand")
                break_before = True
                chapter_sequence = True
            elif chapter_sequence and text in {"Expense Tracker", "Workbook 01"}:
                classes.append("chapter-brand-detail")
            elif level == 2 and current_lesson and index > 0 and body_lines[index - 2:index].count("") >= 0:
                # The first H2 after a lesson number is its title; CSS handles only
                # headings directly following a lesson number.
                classes.append("section-heading")
            if text.startswith("Chapter "):
                chapter_sequence = False

            if level == 1:
                if text.startswith("Chapter "):
                    toc_type = "chapter"
                elif re.fullmatch(r"Lesson \d+", text):
                    toc_type = "lesson"
                elif text in {
                    "Reflection Questions", "Project Submission Statement",
                    "Next Workbook", "End of Workbook 01", "Final Milestone",
                }:
                    toc_type = "end"
                elif text == "Milestone":
                    toc_type = "milestone"
                else:
                    toc_type = ""
                if toc_type:
                    anchors.append({"id": anchor, "label": text, "type": toc_type})

            if ending_prompt:
                parsed.append({
                    "kind": "prompt-marker", "text": "PROMPT ENDS HERE",
                    "position": "end", "callout": "prompt",
                })
            parsed.append({
                "kind": "heading", "level": level, "text": text, "id": anchor,
                "classes": " ".join(classes), "break": break_before,
                "page_kind": page_kind, "callout": current_callout,
            })
            if text in {"AI Prompt", "BUILD PROMPT"}:
                parsed.append({
                    "kind": "prompt-marker", "text": "PROMPT STARTS HERE",
                    "position": "start", "callout": "prompt",
                })
            continue

        stripped = raw.strip()
        if stripped.startswith("□"):
            kind = "checkbox"
        elif stripped.startswith("•") or re.match(r"^[-*]\s+", stripped):
            kind = "bullet"
        elif re.match(r"^\d+\.\s*", stripped):
            kind = "numbered"
        else:
            kind = "paragraph"
        parsed.append({
            "kind": kind,
            "text": raw,
            "section": current_section,
            "callout": current_callout,
        })

    # Add lesson titles to the lesson entries without changing any source text.
    for idx, item in enumerate(parsed):
        if item["kind"] == "heading" and re.fullmatch(r"Lesson \d+", str(item.get("text", ""))):
            for following in parsed[idx + 1:idx + 4]:
                if following["kind"] == "heading" and following.get("level") == 2:
                    entry = next(a for a in anchors if a["id"] == item["id"])
                    entry["label"] = f'{item["text"]} · {following["text"]}'
                    break

    cover_html = render_cover(cover_lines)
    toc_html = render_toc(anchors)
    flow_html = "\n".join(render_item(item) for item in parsed)

    document = HTML_TEMPLATE.replace("{{COVER}}", cover_html)
    document = document.replace("{{TOC}}", toc_html)
    document = document.replace("{{FLOW}}", flow_html)
    document = apply_metadata(document, {
        "series": "Prompt to Profit™", "workbook_label": "Workbook 01",
        "book_title": "Expense Tracker",
        "cover_subtitle": "Build a Complete Expense Tracking Application with AI",
        "difficulty": "Beginner", "estimated_time": "10–15 Hours",
    })
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(document, encoding="utf-8")

    return {
        "source_lines": len(lines),
        "source_characters": len(note),
        "lessons": sum(1 for a in anchors if a["type"] == "lesson"),
        "toc_entries": len(anchors),
        "ai_prompts": sum(
            1 for item in parsed
            if item["kind"] == "heading" and item.get("text") == "AI Prompt"
        ),
    }


def render_cover(lines: list[str], metadata: dict[str, str] | None = None) -> str:
    values = [line for line in lines if line and line != "---"]
    if metadata and values and not any(value.startswith("#") for value in values):
        pieces = [
            '<section class="cover-inner">',
            f'<div class="cover-series">{inline(metadata["series"])}</div>',
            f'<div class="cover-workbook">{inline(metadata["workbook_label"])}</div>',
            f'<div class="cover-title cover-title-standard">{inline(metadata["book_title"])}</div>',
            f'<div class="cover-subtitle">{inline(metadata["cover_subtitle"])}</div>',
        ]
        pieces.extend([
            '<div class="cover-meta-label">Technology stack</div>',
            '<span class="cover-chip">HTML</span>',
            '<span class="cover-chip">CSS</span>',
            '<span class="cover-chip">Vanilla JavaScript</span>',
            '<span class="cover-chip">Supabase</span>',
            '<div class="cover-meta-label">Difficulty</div>',
            f'<div class="cover-meta-value">{inline(metadata["difficulty"])}</div>',
            '<div class="cover-meta-label">Estimated completion time</div>',
            f'<div class="cover-meta-value">{inline(metadata["estimated_time"])}</div>',
            '<div class="cover-publisher">',
            '<span>Produced by</span>',
            '<strong>Tochukwu Tech and AI Academy</strong>',
            '<span>www.tochukwunkwocha.com</span>',
            '</div>',
            "</section>",
        ])
        return "\n".join(pieces)
    pieces = ['<section class="cover-inner">']
    for raw in values:
        if raw.startswith("# "):
            text = raw[2:]
            cls = "cover-series" if text == "Prompt to Profit™" else (
                "cover-title" if text == "Expense Tracker" else "cover-subtitle"
            )
            pieces.append(f'<div class="{cls}">{inline(text)}</div>')
        elif raw.startswith("## "):
            pieces.append(f'<div class="cover-workbook">{inline(raw[3:])}</div>')
        elif raw in {"Technology Stack", "Difficulty", "Estimated Completion Time"}:
            pieces.append(f'<div class="cover-meta-label">{inline(raw)}</div>')
        elif raw.startswith("•"):
            pieces.append(f'<span class="cover-chip">{inline(raw[1:].strip())}</span>')
        else:
            pieces.append(f'<div class="cover-meta-value">{inline(raw)}</div>')
    pieces.append("</section>")
    return "\n".join(pieces)


def render_toc(entries: list[dict[str, str]]) -> str:
    rows = ['<h1 class="toc-title">Contents</h1>',
            '<p class="toc-kicker">{{WORKBOOK_LABEL}} · {{BOOK_TITLE}}</p>']
    for entry in entries:
        rows.append(
            f'<div class="toc-entry toc-{entry["type"]}" data-target="{entry["id"]}">'
            f'<span class="toc-label">{inline(entry["label"])}</span>'
            '<span class="toc-dots"></span><span class="toc-page">—</span></div>'
        )
    return "\n".join(
        f'<div class="flow-item toc-flow" data-kind="toc">{row}</div>' for row in rows
    )


def render_item(item: dict[str, str | int | bool]) -> str:
    kind = str(item["kind"])
    callout = str(item.get("callout", ""))
    callout_class = f" callout-{callout}" if callout else ""
    if kind == "prompt-marker":
        position = html.escape(str(item.get("position", "")))
        return (
            f'<div class="flow-item prompt-marker prompt-marker-{position}" '
            f'data-keep-with-next="true" data-kind="body">'
            f'<p>{inline(str(item["text"]))}</p></div>'
        )
    attrs = ['class="flow-item']
    if kind == "heading":
        attrs[0] += f' heading-flow {item.get("classes", "")}{callout_class}"'
        attrs.append(f'data-anchor="{html.escape(str(item["id"]))}"')
        if item.get("break"):
            attrs.append('data-break-before="true"')
        attrs.append('data-keep-with-next="true"')
        attrs.append(f'data-kind="{item.get("page_kind", "body")}"')
        if item.get("level") == 1:
            running = str(item.get("running") or item["text"])
            attrs.append(f'data-running="{html.escape(running)}"')
        tag = f'h{item["level"]}'
        return f'<div {" ".join(attrs)}><{tag}>{inline(str(item["text"]))}</{tag}></div>'

    attrs[0] += f' {kind}{callout_class}"'
    attrs.append('data-kind="body"')
    text = str(item.get("text", ""))
    if kind == "glossary":
        term, definition = text.split(" :: ", 1)
        content = (
            f'<span class="glossary-term">{inline(term.strip())}</span>'
            f'<span class="glossary-definition">{inline(definition.strip())}</span>'
        )
    elif kind == "checkbox":
        checked = text.lstrip().startswith("✓")
        mark = "✓" if checked else ""
        state = " checked" if checked else ""
        content = (
            f'<span class="box{state}">{mark}</span>'
            f'<span>{inline(text.lstrip()[1:].strip())}</span>'
        )
    elif kind == "bullet":
        marker_removed = re.sub(r"^[•*-]\s*", "", text.strip())
        content = f'<span class="bullet-mark">•</span><span>{inline(marker_removed)}</span>'
    elif kind == "numbered":
        match = re.match(r"^(\d+)\.\s*(.*)$", text.strip())
        content = (
            f'<span class="number-mark">{match.group(1)}.</span>'
            f'<span>{inline(match.group(2))}</span>'
        ) if match else inline(text)
    else:
        content = inline(text)
    return f'<div {" ".join(attrs)}><p>{content}</p></div>'


HTML_TEMPLATE = r"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{SERIES_NAME}} · {{WORKBOOK_LABEL}} · {{BOOK_TITLE}}</title>
<style>
:root {
  --ink: #19232f; --muted: #5e6b78; --blue: #153d63; --blue-2: #275f8e;
  --paper: #fff; --off: #f5f7f8; --line: #d8e0e6; --warm: #f8f4ec;
  --warn: #925728; --green: #2f6654; --violet: #5b5278;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #dfe3e7; color: var(--ink); }
body { font-family: "Avenir Next", Avenir, "Helvetica Neue", Arial, sans-serif; }
#source { display: none; }
#publication { width: 210mm; margin: 10mm auto; }
.sheet {
  width: 210mm; height: 297mm; background: var(--paper); position: relative;
  padding: 17mm 18mm 15mm; overflow: hidden; page-break-after: always;
  box-shadow: 0 2mm 8mm rgba(20,30,40,.16);
}
.page-header {
  height: 9mm; display: flex; align-items: flex-start; justify-content: space-between;
  border-bottom: .35mm solid var(--line); color: var(--muted);
  font-size: 8pt; letter-spacing: .08em; text-transform: uppercase;
}
.page-header .series { color: var(--blue); font-weight: 700; }
.page-body { height: 247mm; padding-top: 7mm; overflow: hidden; }
.page-footer {
  height: 8mm; padding-top: 3mm; display: flex; justify-content: space-between;
  border-top: .35mm solid var(--line); color: var(--muted); font-size: 8pt;
}
.front .page-header, .front .page-footer { border-color: transparent; }
.front .page-header > *, .front .page-footer .footer-title { visibility: hidden; }
.cover { padding: 0; background: var(--blue); color: white; }
.cover .page-body { height: 297mm; padding: 0; }
.cover-source { height: 297mm; }
.cover-inner {
  height: 100%; padding: 27mm 24mm 23mm; display: flex; flex-direction: column;
  background:
    linear-gradient(90deg, rgba(255,255,255,.06) 0 .35mm, transparent .35mm) 24mm 0/32mm 100%,
    var(--blue);
}
.cover-series { font-size: 13pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
.cover-workbook { margin-top: 4mm; font-size: 10pt; letter-spacing: .14em; text-transform: uppercase; opacity: .78; }
.cover-title { margin-top: 33mm; font: 700 42pt/1.02 Georgia, "Times New Roman", serif; max-width: 155mm; }
.cover-title-standard { font-size: 35pt; line-height: 1.04; letter-spacing: -.02em; text-wrap: balance; }
.cover-title-kicker { margin-top: 31mm; color: #b8cada; font-size: 11pt; font-weight: 700; letter-spacing: .18em; text-transform: uppercase; }
.cover-title-main { margin-top: 3mm; max-width: 155mm; font: 700 40pt/1.02 Georgia, "Times New Roman", serif; letter-spacing: -.025em; }
.cover-title-tail { margin-top: 3mm; font: 400 19pt/1.2 Georgia, "Times New Roman", serif; color: #dce8f1; }
.cover-subtitle { margin-top: 8mm; font: 400 18pt/1.35 Georgia, "Times New Roman", serif; max-width: 135mm; color: #dce8f1; }
.cover-meta-label { margin-top: 14mm; font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: #b8cada; }
.cover-meta-value { margin-top: 1.5mm; font-size: 11pt; }
.cover-chip { display: inline-block; width: max-content; margin: 2mm 2mm 0 0; padding: 1.4mm 3mm; border: .3mm solid rgba(255,255,255,.34); border-radius: 9mm; font-size: 9pt; }
.cover-publisher { margin-top: auto; padding-top: 7mm; border-top: .3mm solid rgba(255,255,255,.28); display: grid; gap: 1.5mm; }
.cover-publisher span:first-child { color: #b8cada; font-size: 7.5pt; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; }
.cover-publisher strong { font-size: 11.5pt; letter-spacing: .02em; }
.cover-publisher span:last-child { color: #dce8f1; font-size: 9pt; }
.copyright-inner { margin-top: 62mm; max-width: 125mm; }
.copyright-mark { width: 13mm; height: 1.3mm; background: var(--blue); margin-bottom: 9mm; }
.copyright-inner h1 { font: 700 23pt/1.15 Georgia, serif; color: var(--blue); margin: 0 0 7mm; }
.copyright-inner p { font-size: 9pt; line-height: 1.65; color: var(--muted); margin: 0 0 4mm; }
.flow-item { width: 100%; }
.flow-item p { margin: 0 0 3.1mm; font: 10.2pt/1.54 Georgia, "Times New Roman", serif; orphans: 3; widows: 3; }
.rule { height: 4.5mm; margin: 1mm 0 4.5mm; border-top: .3mm solid var(--line); }
h1, h2, h3 { margin: 0; color: var(--blue); }
h1 { font: 700 27pt/1.12 Georgia, "Times New Roman", serif; margin-bottom: 6mm; }
h2 { font: 700 16pt/1.22 "Avenir Next", Avenir, sans-serif; margin: 3mm 0 4mm; }
h3 { font: 700 11.5pt/1.3 "Avenir Next", Avenir, sans-serif; margin: 2mm 0 3mm; color: var(--ink); }
.heading-flow { break-after: avoid; }
.lesson-number { padding-top: 7mm; }
.lesson-number h1 { font-size: 10pt; font-family: "Avenir Next", sans-serif; letter-spacing: .16em; text-transform: uppercase; color: var(--blue-2); margin-bottom: 3mm; }
.lesson-number + .heading-flow h2 { font: 700 28pt/1.12 Georgia, serif; color: var(--blue); margin: 0 0 5mm; max-width: 150mm; }
.welcome-heading h1, .milestone-heading h1 { padding-top: 12mm; font-size: 34pt; }
.chapter-brand { padding-top: 48mm; color: var(--blue); }
.chapter-brand h1 { font: 700 10pt/1.2 "Avenir Next", sans-serif; letter-spacing: .16em; text-transform: uppercase; margin-bottom: 4mm; }
.chapter-brand-detail h1, .chapter-brand-detail h2 { font: 600 12pt/1.3 "Avenir Next", sans-serif; color: var(--muted); margin: 0 0 3mm; }
.chapter-number h1 { margin-top: 13mm; padding-top: 8mm; border-top: 1.2mm solid var(--blue); font-size: 37pt; }
.chapter-title h2 { font: 700 25pt/1.16 Georgia, serif; max-width: 150mm; margin-bottom: 9mm; }
.chapter-repeat h3 { color: var(--blue-2); font-size: 8pt; letter-spacing: .14em; text-transform: uppercase; margin: 0 0 1.5mm; }
.chapter-repeat-title h3 { color: var(--muted); font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; margin: 0 0 5mm; }
.bullet p, .checkbox p, .numbered p { display: grid; grid-template-columns: 7mm 1fr; gap: 1mm; }
.bullet-mark, .number-mark { color: var(--blue-2); font-family: "Avenir Next", sans-serif; font-weight: 700; }
.box { width: 3.4mm; height: 3.4mm; border: .45mm solid var(--blue-2); border-radius: .5mm; margin-top: 1.1mm; }
.box.checked { display: grid; place-items: center; background: var(--blue-2); color: white; font: 700 7pt/1 "Avenir Next", sans-serif; }
.url { font-family: "SFMono-Regular", Consolas, monospace; font-size: .88em; color: var(--blue-2); overflow-wrap: anywhere; }
.callout-prompt, .callout-warning, .callout-insight, .callout-designer,
.callout-checklist, .callout-note, .callout-learning, .callout-result,
.callout-test, .callout-milestone, .callout-glossary, .callout-backup,
.callout-troubleshoot, .callout-log, .callout-code {
  padding-left: 5mm; padding-right: 5mm; background: var(--off);
  border-left: 1mm solid var(--blue-2);
}
.heading-flow.callout-prompt, .heading-flow.callout-warning, .heading-flow.callout-insight,
.heading-flow.callout-designer, .heading-flow.callout-checklist, .heading-flow.callout-note,
.heading-flow.callout-learning, .heading-flow.callout-result, .heading-flow.callout-test,
.heading-flow.callout-milestone, .heading-flow.callout-glossary,
.heading-flow.callout-backup, .heading-flow.callout-troubleshoot,
.heading-flow.callout-log, .heading-flow.callout-code {
  padding-top: 4.5mm; border-radius: 1.5mm 1.5mm 0 0;
}
.callout-prompt p, .callout-prompt h2, .callout-prompt h3 {
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
.callout-prompt p { font-size: 8.75pt; line-height: 1.48; margin-bottom: 2.7mm; }
.callout-prompt { background: #edf3f7; border-left: 1.2mm solid var(--blue); }
.callout-prompt h2, .callout-prompt h3 { color: var(--blue); }
.prompt-marker {
  padding: 3.4mm 5mm;
  background: var(--blue);
  color: white;
  border-left: 1.2mm solid var(--blue);
  break-inside: avoid;
}
.prompt-marker p {
  margin: 0;
  color: white;
  font: 700 8.5pt/1.2 "Avenir Next", Avenir, sans-serif;
  letter-spacing: .14em;
}
.prompt-marker-start { border-radius: 1.5mm 1.5mm 0 0; break-after: avoid; }
.prompt-marker-end { border-radius: 0 0 1.5mm 1.5mm; margin-bottom: 5mm; break-before: avoid; }
.callout-warning { background: #fbf6ee; border-left-color: var(--warn); }
.callout-warning h2 { color: var(--warn); }
.callout-insight { background: #f0f6f3; border-left-color: var(--green); }
.callout-insight h2 { color: var(--green); }
.callout-designer { background: #f3f1f7; border-left-color: var(--violet); }
.callout-designer h2 { color: var(--violet); }
.callout-milestone { background: #eef4f8; border-left-color: var(--blue); }
.callout-glossary { background: #eef4f8; border-left-color: var(--blue-2); }
.glossary.callout-glossary {
  display: grid; grid-template-columns: 42mm 1fr; gap: 5mm;
  padding-top: 3.2mm; padding-bottom: 3.2mm; margin-bottom: 1.5mm;
  break-inside: avoid;
}
.glossary.callout-glossary p { display: contents; }
.glossary-term {
  color: var(--blue); font: 700 8.5pt/1.3 "Avenir Next", Avenir, sans-serif;
  letter-spacing: .05em;
}
.glossary-definition { font: 9.3pt/1.42 Georgia, "Times New Roman", serif; }
.callout-backup { background: #fbf6ee; border-left-color: var(--warn); }
.callout-backup h2, .callout-backup h3 { color: var(--warn); }
.callout-troubleshoot { background: #f0f6f3; border-left-color: var(--green); }
.callout-troubleshoot h1, .callout-troubleshoot h2 { color: var(--green); }
.callout-log { background: #f7f8fa; border-left-color: var(--muted); }
.callout-log p { margin-bottom: 4.2mm; }
.callout-code { background: #f3f1f7; border-left-color: var(--violet); }
.callout-code h2 { color: var(--violet); }
.callout-code p:last-child { margin-bottom: 4.5mm; }
.toc-title { padding-top: 8mm; margin-bottom: 2mm; font-size: 32pt; }
.toc-kicker { color: var(--muted); font-family: "Avenir Next", sans-serif !important; margin-bottom: 10mm !important; }
.toc-entry { display: flex; align-items: baseline; min-height: 7.4mm; font-size: 9.4pt; line-height: 1.35; color: var(--ink); }
.toc-label { max-width: 144mm; }
.toc-dots { flex: 1; min-width: 6mm; margin: 0 2mm; border-bottom: .3mm dotted #aeb9c2; transform: translateY(-1.2mm); }
.toc-page { min-width: 8mm; text-align: right; font-variant-numeric: tabular-nums; color: var(--blue); font-weight: 700; }
.toc-chapter, .toc-end { font-weight: 700; color: var(--blue); margin-top: 2mm; }
.toc-lesson { padding-left: 7mm; }
.toc-milestone { padding-left: 7mm; color: var(--green); }
.toc-support { font-weight: 650; color: var(--violet); margin-top: 1.5mm; }
@media print {
  html, body { background: white; }
  #publication { margin: 0; }
  .sheet { box-shadow: none; margin: 0; }
  @page { size: A4; margin: 0; }
}
</style>
</head>
<body>
<main id="publication"></main>
<div id="source">
  <div class="flow-item cover-source" data-special="cover" data-kind="cover">{{COVER}}</div>
  <div class="flow-item copyright-source" data-special="copyright" data-kind="front">
    <section class="copyright-inner">
      <div class="copyright-mark"></div>
      <h1>{{SERIES_NAME}}</h1>
      <p>{{WORKBOOK_LABEL}} · {{BOOK_TITLE}}</p>
      <p>© 2026 Tochukwu Tech and AI Academy. All rights reserved.</p>
      <p>Produced and published by Tochukwu Tech and AI Academy.</p>
      <p>www.tochukwunkwocha.com</p>
      <p>This workbook is designed for personal learning and guided software-building practice.</p>
      <p>Technology names and product names remain the property of their respective owners.</p>
    </section>
  </div>
  {{TOC}}
  <div class="flow-item toc-end-marker" data-break-before="true" data-kind="body"></div>
  {{FLOW}}
</div>
<script>
(() => {
  const source = [...document.querySelectorAll("#source > .flow-item")];
  const publication = document.getElementById("publication");
  let sheet = null, body = null, currentKind = "front", running = "{{BOOK_TITLE}}";

  function makeSheet(kind) {
    const el = document.createElement("section");
    el.className = "sheet " + (kind === "body" ? "body-page" : "front");
    el.dataset.kind = kind;
    el.innerHTML = `
      <header class="page-header"><span class="series">Prompt to Profit™</span><span class="running"></span></header>
      <div class="page-body"></div>
      <footer class="page-footer"><span class="footer-title">Tochukwu Tech and AI Academy · www.tochukwunkwocha.com</span><span class="page-number"></span></footer>`;
    publication.appendChild(el);
    el.querySelector(".running").textContent = running;
    sheet = el; body = el.querySelector(".page-body"); currentKind = kind;
    return el;
  }

  function makeSpecial(item, kind) {
    const el = document.createElement("section");
    el.className = "sheet " + (kind === "cover" ? "cover" : "front");
    el.dataset.kind = kind;
    el.innerHTML = kind === "cover"
      ? '<div class="page-body"></div>'
      : '<header class="page-header"></header><div class="page-body"></div><footer class="page-footer"><span class="footer-title"></span><span class="page-number"></span></footer>';
    el.querySelector(".page-body").appendChild(item.cloneNode(true));
    publication.appendChild(el);
    sheet = null; body = null;
  }

  function keepGroupFits(startIndex, kind) {
    if (!body || source[startIndex].dataset.keepWithNext !== "true") return true;
    const testNodes = [];
    let index = startIndex;
    while (index < source.length) {
      const candidate = source[index];
      const candidateKind = candidate.dataset.kind || kind;
      if (
        candidate.dataset.special
        || candidateKind !== kind
        || (index > startIndex && candidate.dataset.breakBefore === "true")
      ) break;
      const testNode = candidate.cloneNode(true);
      body.appendChild(testNode);
      testNodes.push(testNode);
      if (candidate.dataset.keepWithNext !== "true") break;
      index++;
    }
    const fits = body.scrollHeight <= body.clientHeight + 1;
    for (const node of testNodes) body.removeChild(node);
    return fits;
  }

  for (let i = 0; i < source.length; i++) {
    const item = source[i];
    const kind = item.dataset.kind || currentKind;
    if (item.dataset.special) {
      makeSpecial(item, item.dataset.kind);
      continue;
    }
    if (item.dataset.running) running = item.dataset.running;
    if (!sheet || item.dataset.breakBefore === "true" || kind !== currentKind) {
      makeSheet(kind);
    } else if (item.dataset.running) {
      sheet.querySelector(".running").textContent = running;
    }
    if (
      body.children.length
      && item.dataset.keepWithNext === "true"
      && !keepGroupFits(i, kind)
    ) {
      makeSheet(kind);
    }
    const clone = item.cloneNode(true);
    body.appendChild(clone);
    if (body.scrollHeight > body.clientHeight + 1) {
      body.removeChild(clone);
      makeSheet(kind);
      body.appendChild(clone);
    }
  }

  // Rebalance a list when pagination leaves only a few list entries on the
  // following page. Pull matching entries from the preceding page until the
  // continuation page has useful visual weight. This avoids nearly blank
  // pages without forcing a complete long list to stay on one page.
  const paginatedSheets = [...document.querySelectorAll(".sheet")];
  for (let i = 1; i < paginatedSheets.length; i++) {
    const currentBody = paginatedSheets[i].querySelector(".page-body");
    const previousBody = paginatedSheets[i - 1].querySelector(".page-body");
    if (!currentBody || !previousBody || !currentBody.children.length) continue;
    const listKind = ["bullet", "checkbox", "numbered"].find(
      (name) => [...currentBody.children].every((node) => node.classList.contains(name))
    );
    if (!listKind) continue;
    const usedHeight = () => {
      const last = currentBody.lastElementChild;
      return last ? last.getBoundingClientRect().bottom - currentBody.getBoundingClientRect().top : 0;
    };
    while (
      usedHeight() < currentBody.clientHeight * 0.28
      && previousBody.children.length > 1
      && previousBody.lastElementChild.classList.contains(listKind)
    ) {
      currentBody.insertBefore(previousBody.lastElementChild, currentBody.firstElementChild);
    }
  }

  const sheets = [...document.querySelectorAll(".sheet")];
  let frontNumber = 1, bodyNumber = 0;
  for (const page of sheets) {
    let printed = "";
    if (page.dataset.kind === "front") printed = toRoman(++frontNumber);
    if (page.dataset.kind === "body") printed = String(++bodyNumber);
    page.dataset.printedPage = printed;
    const target = page.querySelector(".page-number");
    if (target) target.textContent = printed;
  }

  const pageByAnchor = {};
  for (const page of sheets) {
    for (const anchored of page.querySelectorAll("[data-anchor]")) {
      pageByAnchor[anchored.dataset.anchor] = page.dataset.printedPage;
    }
  }
  for (const entry of document.querySelectorAll(".toc-entry")) {
    entry.querySelector(".toc-page").textContent = pageByAnchor[entry.dataset.target] || "—";
  }
  const previewPage = Number(new URLSearchParams(location.search).get("preview"));
  if (previewPage > 0 && sheets[previewPage - 1]) {
    for (const [index, page] of sheets.entries()) {
      if (index !== previewPage - 1) page.style.display = "none";
    }
  }
  document.documentElement.dataset.ready = "true";
  document.title = "{{SERIES_NAME}} · {{WORKBOOK_LABEL}} · {{BOOK_TITLE}}";

  function toRoman(n) {
    const map = [[1000,"m"],[900,"cm"],[500,"d"],[400,"cd"],[100,"c"],[90,"xc"],[50,"l"],[40,"xl"],[10,"x"],[9,"ix"],[5,"v"],[4,"iv"],[1,"i"]];
    let out = "";
    for (const [value, glyph] of map) while (n >= value) { out += glyph; n -= value; }
    return out;
  }
})();
</script>
</body>
</html>
"""


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    stats = build(args.source, args.output)
    print(json.dumps(stats, indent=2))
