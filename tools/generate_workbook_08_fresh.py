#!/usr/bin/env python3
"""Generate Workbook 08 using the locked beginner workbook standard."""

from __future__ import annotations

import json
import re
from pathlib import Path

from generate_workbook_06_fresh import SEP, lesson, standard_prompt


SOURCE = Path(
    "deliverables/sales-tracker-workbook/"
    "6 - Sales Tracker.notepad"
)
OUTPUT = Path(
    "deliverables/order-management-system-workbook/"
    "8 - Order Management System.notepad"
)


def transform_project(note: str) -> str:
    replacements = (
        ("PROMPT TO PROFIT™ WORKBOOK 06", "PROMPT TO PROFIT™ WORKBOOK 08"),
        ("Workbook 06", "Workbook 08"),
        ("WORKBOOK 06", "WORKBOOK 08"),
        ("SALES TRACKER", "ORDER MANAGEMENT SYSTEM"),
        ("Sales Tracker", "Order Management System"),
        ("sales-tracker", "order-management-system"),
        ("Sales History", "Orders"),
        ("SALES HISTORY", "ORDERS"),
        ("sales history", "orders list"),
        ("sale-details.html", "order-details.html"),
        ("sale-details.js", "order-details.js"),
        ("edit-sale.html", "edit-order.html"),
        ("edit-sale.js", "edit-order.js"),
        ("sales-table.sql", "orders-table.sql"),
        ("sales-rules.sql", "orders-rules.sql"),
        ("sales-rls.sql", "orders-rls.sql"),
        ("sales-select-policy.sql", "orders-select-policy.sql"),
        ("sales-insert-policy.sql", "orders-insert-policy.sql"),
        ("sales-update-policy.sql", "orders-update-policy.sql"),
        ("sales-delete-policy.sql", "orders-delete-policy.sql"),
        ("SALE DETAILS", "ORDER DETAILS"),
        ("Sale Details", "Order Details"),
        ("sale details", "order details"),
        ("sale_date", "order_date"),
        ("payment_method", "order_status"),
        ("Payment Method", "Order Status"),
        ("PAYMENT METHOD", "ORDER STATUS"),
        ("payment method", "order status"),
        ("sales", "orders"),
        ("Sales", "Orders"),
        ("SALES", "ORDERS"),
        ("sale", "order"),
        ("Sale", "Order"),
        ("SALE", "ORDER"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def polish_opening(note: str) -> str:
    replacements = (
        (
            "If your immediate need is to build a Order Management System, you can begin with this workbook.",
            "If your immediate need is to organise customer orders, you can begin with this workbook.",
        ),
        (
            "a professional orders management application",
            "a professional order management application",
        ),
        (
            "allows businesses to register users, record orders securely, search and organise orders, update order details",
            "allows businesses to create customer orders, track their progress, find and update orders securely",
        ),
        ("A form for recording orders", "A form for creating customer orders"),
        (
            "Daily, monthly and all-time order statistics",
            "Total, pending, completed and order-value statistics",
        ),
        ("A complete Orders page", "A complete Orders page"),
        ("Order Details and editing", "Order details, editing and status tracking"),
        ("Building the Orders Dashboard", "Building the Order Dashboard"),
        ("Building the Orders Database", "Building the Order Database"),
        ("Building the Order Database", "Building the Order Database"),
        ("Viewing Orders", "Viewing Orders"),
        ("Editing Orders", "Editing Orders"),
        ("Deleting Orders", "Deleting Orders"),
        (
            "The application will allow a signed-in business user to record a order with a date, item name, category, quantity, unit price, order status, optional customer name and optional notes.",
            "The application will allow a signed-in business user to create an order with an order number, date, customer name, item name, category, quantity, unit price, status and optional contact details and notes.",
        ),
        (
            "It will calculate totals, show daily and monthly figures, display orders list, find records, edit records and delete unwanted records.",
            "It will calculate totals, show useful order statistics, display an orders list, track status, find records, edit records and delete unwanted records.",
        ),
        ("Sales Tracker", "Order Management System"),
        ("record orders securely", "create orders securely"),
        ("record a order", "create an order"),
        ("record an order", "create an order"),
        ("Record New Order", "Create New Order"),
        ("Record Order", "Create Order"),
        ("RECORD ORDER", "CREATE ORDER"),
        ("record order", "create order"),
        ("Recording Orders", "Creating Orders"),
        ("recording orders", "creating orders"),
        ("recorded order", "created order"),
        ("recorded orders", "created orders"),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def add_order_fields(note: str) -> str:
    replacements = (
        (
            "Include order date, item name, category, quantity, unit price, total amount, order status, customer name and notes.",
            "Include order number, order date, customer name, customer email, customer phone, item name, category, quantity, unit price, total amount, order status and notes.",
        ),
        (
            "Add order_date as a required date.",
            "Add order_number as required text.\n\n• Add order_date as a required date.\n\n• Add customer_name as required text, with optional customer_email and customer_phone.",
        ),
        (
            "Add optional customer_name and notes fields.",
            "Add an optional notes field.",
        ),
        (
            "Create useful indexes for user_id, order_date, category and order_status.",
            "Create useful indexes for user_id, order_number, order_date, category and order_status.\n\n• Prevent the same signed-in user from saving the same order_number twice by using a unique constraint on user_id and order_number.",
        ),
        (
            "Reject blank item_name and blank category after spaces are removed.",
            "Reject blank order_number, customer_name, item_name and category after spaces are removed.",
        ),
        (
            "Allow only Cash, Card, Bank Transfer, Mobile Money or Other for order_status.",
            "Allow only Pending, Processing, Completed or Cancelled for order_status.",
        ),
        (
            "Try an unsupported order status.",
            "Try an unsupported order status such as Delivered.",
        ),
        (
            "unsupported order status",
            "unsupported order status",
        ),
        (
            "Use one row for one item sold in one order entry.",
            "Use one row for one customer order containing one item or service.",
        ),
        (
            "Explain which fields are required and which are optional.",
            "Make order number, order date, customer name, item name, category, quantity, unit price and order status required. Keep customer email, customer phone and notes optional.",
        ),
        (
            "Use a sample order to check that every important detail has a place.",
            "Use a sample customer order to check that every important detail has a place.",
        ),
        (
            "Include order date, item name, category, quantity, unit price, order status, optional customer name and optional notes.",
            "Include order number, order date, customer name, optional customer email, optional customer phone, item name, category, quantity, unit price, order status and optional notes.",
        ),
        (
            "Insert order_date, item_name, category, quantity, unit_price, order_status, customer_name, notes and the current user's id.",
            "Insert order_number, order_date, customer_name, customer_email, customer_phone, item_name, category, quantity, unit_price, order_status, notes and the current user's id.",
        ),
        (
            "Update only order_date, item_name, category, quantity, unit_price, order_status, customer_name and notes.",
            "Update only order_number, order_date, customer_name, customer_email, customer_phone, item_name, category, quantity, unit_price, order_status and notes.",
        ),
        (
            "Show date, item, category, quantity, unit price, total and order status.",
            "Show order number, date, customer name, item, quantity, total and order status.",
        ),
        (
            "Search item_name, category, customer_name and notes without case sensitivity.",
            "Search order_number, customer_name, customer_email, customer_phone, item_name, category and notes without case sensitivity.",
        ),
        (
            "find an order by words, category, order status or date",
            "find an order by order number, customer information, item, category, status or date",
        ),
        (
            "Add category and order-status filters.",
            "Add category and order-status filters. Use Pending, Processing, Completed and Cancelled as the exact status choices.",
        ),
        (
            "Test category, order status and date range separately.",
            "Test customer or order-number search, category, order status and date range separately.",
        ),
        (
            "correct a date, item, quantity, price or other detail",
            "correct an order number, customer, date, item, quantity, price, status or other detail",
        ),
        (
            "Test blank required fields, quantity zero and a negative price.",
            "Test a blank order number, blank customer name, blank item, quantity zero and a negative price.",
        ),
        (
            "Use a select for the allowed order statuses.",
            "Use a select with these exact order-status choices: Pending, Processing, Completed and Cancelled.",
        ),
        (
            "Use a select for the allowed order statuss.",
            "Use a select with these exact order-status choices: Pending, Processing, Completed and Cancelled.",
        ),
        (
            "Add clear labels, help text and validation messages.",
            "Use an email input for customer email and a telephone input for customer phone.\n\n• Add clear labels, help text and validation messages.",
        ),
        (
            "Show a clear success or error message.",
            "Show a clear success or error message.\n\n• If the order number already exists for this user, show a friendly message asking for a different order number.",
        ),
        (
            "Save a valid order.",
            "Save a valid order.\n\n✓ Try to save another order with the same order number and confirm that it is rejected with a friendly message.",
        ),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def polish_status_and_statistics(note: str) -> str:
    replacements = (
        (
            "today's orders total, today's order count, this month's orders total and all-time orders total",
            "total orders, pending orders, completed orders and total order value",
        ),
        (
            "Today's Orders Total",
            "Total Orders",
        ),
        (
            "Today's Order Count",
            "Pending Orders",
        ),
        (
            "This Month's Orders Total",
            "Completed Orders",
        ),
        (
            "All-Time Orders Total",
            "Total Order Value",
        ),
        (
            "BUILDING DAILY AND MONTHLY STATISTICS",
            "BUILDING ORDER STATISTICS",
        ),
        (
            "daily and monthly order statistics",
            "order-count, status and value statistics",
        ),
        (
            "daily and monthly figures",
            "order status and value figures",
        ),
        (
            "today's activity",
            "current order activity",
        ),
        (
            "Use order_date, not created_at, to decide which period contains an order.",
            "Count all rows for Total Orders, count exact status values for Pending Orders and Completed Orders, and add total_amount for Total Order Value.",
        ),
        (
            "Create orders on today, an earlier date this month and an earlier month.",
            "Create Pending, Processing, Completed and Cancelled orders with different dates and values.",
        ),
        (
            "Today's Orders",
            "Pending Orders",
        ),
        (
            "This Month's Orders",
            "Completed Orders",
        ),
        (
            "Adding order_status to the insert.",
            "Adding total_amount to the insert.",
        ),
        (
            "Do not insert total_amount because the database generates it.",
            "Do not insert total_amount because the database generates it.",
        ),
        (
            "allow only the supported order statuses",
            "allow only Pending, Processing, Completed or Cancelled",
        ),
        (
            "Cash\n\nCard\n\nBank Transfer\n\nMobile Money\n\nOther",
            "Pending\n\nProcessing\n\nCompleted\n\nCancelled",
        ),
        (
            "Cash, Card, Bank Transfer, Mobile Money or Other",
            "Pending, Processing, Completed or Cancelled",
        ),
        ("payment rules", "status rules"),
        ("price and payment rules", "price and status rules"),
        ("payment filters", "status filters"),
        ("category and payment", "category and status"),
        ("payment-method", "order-status"),
        ("Payment-method", "Order-status"),
        ("payment method", "order status"),
        ("order count", "order count"),
        ("How to build an orders form.", "How to build an order form."),
    )
    for old, new in replacements:
        note = note.replace(old, new)
    return note


def replace_statistics_lesson(note: str) -> str:
    statistics_lesson = lesson(
        4,
        "BUILDING ORDER STATISTICS",
        "45–60 Minutes",
        "Four working dashboard cards that summarise the signed-in user's orders.",
        "Useful statistics help a business understand its current workload without opening every order.",
        [
            "You can create and save orders.",
            "Your orders contain different status values.",
            "You backed up the current dashboard files.",
        ],
        standard_prompt(
            "Connect the dashboard statistics cards to the signed-in user's orders.",
            [
                "Read the user's orders from Supabase while keeping Row Level Security enabled.",
                "Show Total Orders by counting the returned order rows.",
                "Show Pending Orders by counting rows whose order_status is exactly Pending.",
                "Show Completed Orders by counting rows whose order_status is exactly Completed.",
                "Show Total Order Value by adding total_amount for all returned orders.",
                "Format Total Order Value as money without changing the stored numbers.",
                "Refresh the statistics after a new order is saved.",
                "Show clear loading, empty and error states.",
                "Do not use the service role key and do not disable Row Level Security.",
            ],
            ["dashboard.html", "dashboard.js", "styles.css"],
        ),
        [
            "Four working order statistics.",
            "Correct status counts and total value.",
            "Clear loading, empty and error states.",
        ],
        [
            "Replace dashboard.html.",
            "Replace dashboard.js.",
            "Replace styles.css.",
        ],
        [
            "Create two Pending orders, one Processing order, one Completed order and one Cancelled order.",
            "Confirm Total Orders shows 5.",
            "Confirm Pending Orders shows 2 and Completed Orders shows 1.",
            "Add the five saved totals yourself and compare the answer with Total Order Value.",
            "Create another order and confirm the cards refresh.",
        ],
        [
            "Every card matches the saved test data.",
            "Status values are counted exactly.",
            "The total value uses total_amount from the database.",
        ],
        [
            "Counting quantity instead of counting order rows.",
            "Using different status spellings in the form and the statistics.",
            "Adding formatted money text instead of numeric total_amount values.",
            "Hiding a failed database request behind zero values.",
        ],
        "Supabase returns only the rows allowed by Row Level Security. JavaScript can count those rows, compare their exact status values and add their generated totals.",
        "Why should Pending and pending not be treated as two different status choices?",
        [
            "How to calculate order statistics.",
            "How to count exact status values.",
            "How to add generated order totals.",
            "How to refresh dashboard information after saving.",
        ],
    )
    pattern = (
        rf"(?ms)^LESSON 4\s*\n\s*BUILDING ORDER STATISTICS\s*\n"
        rf"{re.escape(SEP)}.*?(?=^CHAPTER SUMMARY\s*$)"
    )
    note, count = re.subn(pattern, statistics_lesson + "\n\n", note, count=1)
    if count != 1:
        raise RuntimeError("Could not replace the order statistics lesson")
    return note


def polish_language(note: str) -> str:
    replacements = (
        ("an Order Management System", "an Order Management System"),
        ("a Order Management System", "an Order Management System"),
        ("an order management application", "an order management application"),
        ("orders management", "order management"),
        ("Orders management", "Order management"),
        ("order information is scattered across", "order information is scattered across"),
        ("orders information", "order information"),
        ("orders statistics", "order statistics"),
        ("orders database", "order database"),
        ("Orders database", "Order database"),
        ("ORDERS DATABASE", "ORDER DATABASE"),
        ("orders dashboard", "order dashboard"),
        ("Orders dashboard", "Order dashboard"),
        ("ORDERS DASHBOARD", "ORDER DASHBOARD"),
        ("orders data model", "order data model"),
        ("Orders data model", "Order data model"),
        ("ORDERS DATA MODEL", "ORDER DATA MODEL"),
        ("orders values", "order values"),
        ("Orders values", "Order values"),
        ("ORDERS VALUES", "ORDER VALUES"),
        ("order statuss", "order statuses"),
        ("Order statuss", "Order statuses"),
        ("display an orders list", "display the Orders page"),
        ("An orders search area", "An order search area"),
        ("An orders date range", "An order date range"),
        ("orders performance", "order progress"),
        ("Orders Performance", "Order Progress"),
        ("Secure Orders Records", "Secure Order Records"),
        ("A complete protected history page.", "A complete protected Orders page."),
        ("order of the history", "order of the records"),
        ("Orders works.", "The Orders page works."),
        ("from history", "from the Orders page"),
        ("returns to the history", "returns to the Orders page"),
        ("The history and details pages", "The Orders and details pages"),
        ("History and details work", "The Orders and details pages work"),
        ("the complete history", "the complete Orders page"),
        ("The history works", "The Orders page works"),
        ("a long history", "a long order list"),
        ("full history", "full order list"),
        ("complete history files", "complete Orders page files"),
        ("history success message", "Orders page success message"),
        ("disappears from history", "disappears from the Orders page"),
        ("database, history, details and summary figures", "database, Orders page, details page and summary figures"),
        ("Every required orders capability", "Every required order capability"),
        ("secure order creation, reporting, discovery, editing and deletion", "secure order creation, statistics, search, editing and deletion"),
        ("One discovery toolbar", "One search and filter area"),
        ("A complete discovery toolbar.", "A complete search and filter area."),
        ("every discovery control", "every search and filter control"),
        ("The discovery toolbar", "The search and filter area"),
        ("a useful discovery tool", "a useful way to find records"),
        ("a orders", "an orders"),
        ("A orders", "An orders"),
        ("a order", "an order"),
        ("A Order", "An Order"),
        ("A order", "An order"),
        ("one order entry", "one order"),
        ("one orders entry", "one order"),
        ("one orders record", "one order record"),
        ("How to describe one orders record", "How to describe one order record"),
        ("one item sold", "one item or service ordered"),
        ("what was sold", "what was ordered"),
        ("when it was sold", "when the order was created"),
        ("how many units were sold", "how many units were ordered"),
        ("the amount charged for each unit", "the price of each unit"),
        ("a whole shopping basket", "several unrelated customer orders"),
        ("If a business sells three units of the same item in one transaction", "If a customer orders three units of the same item"),
        ("sales figures", "order information"),
        ("orders figures", "order information"),
        ("private orders", "private order information"),
        ("customer name and optional notes", "customer details and optional notes"),
        ("an earlier date", "a different order date"),
        ("Open Orders", "Open the Orders page"),
        ("return to Orders", "return to the Orders page"),
        ("Back to Orders", "Back to Orders"),
        ("load an orders list", "load the orders list"),
        ("orders list search", "order search"),
        ("Orders discovery", "Finding Orders"),
        ("Order discovery", "Finding orders"),
        ("order discovery", "finding orders"),
        ("BUILDING THE ORDERS\n", "BUILDING THE ORDERS PAGE\n"),
        ("TESTING THE ORDERS\n", "TESTING THE ORDERS PAGE\n"),
        ("BUILDING ORDERS SEARCH, FILTERING AND SORTING", "BUILDING ORDER SEARCH, FILTERING AND SORTING"),
        ("TESTING ORDERS DISCOVERY", "TESTING SEARCH, FILTERING AND SORTING"),
        ("Add one search field for item name, customer name and notes.", "Add one search field for order number, customer name, customer email, customer phone, item name, category and notes."),
        ("Add category and status-method filters.", "Add category and order-status filters using Pending, Processing, Completed and Cancelled."),
        ("Combine a date range with an order status.", "Combine a date range with an order status."),
        ("help the user find an order by words, category, order status or date", "help the user find an order by its number, customer information, item, category, status or date"),
        ("secure orders recording", "secure order creation"),
        ("orders recording", "order creation"),
        ("orders records", "order records"),
        ("orders record", "order record"),
        ("Daily, monthly and all-time statistics", "Total, pending, completed and order-value statistics"),
        ("Daily, monthly and all-time order statistics", "Total, pending, completed and order-value statistics"),
        ("Daily and monthly figures", "Order counts, status figures and total value"),
        ("daily and monthly figures", "order counts, status figures and total value"),
        ("daily and monthly performance", "order progress and total value"),
        ("daily and monthly totals", "status counts and total order value"),
        ("Daily and Monthly Statistics", "Order Statistics"),
        ("3. Daily and Monthly Statistics", "3. Order Status and Statistics"),
        ("2. Record a Order", "2. Create an Order"),
        ("• Payment method", "• Order status"),
        ("Slow monthly reporting", "Slow order follow-up"),
        ("Difficulty checking daily performance", "Difficulty checking order progress"),
        ("record what it sells and understand its daily and monthly activity", "keep customer orders together and see which orders still need attention"),
        ("record a order", "create an order"),
        ("record the first real order", "create the first real order"),
        ("record, review, search, edit and delete orders", "create, review, search, edit and delete orders"),
        ("Daily and monthly statistics are accurate.", "Order counts, status figures and total value are accurate."),
        ("Test daily, monthly and all-time dashboard statistics.", "Test total, pending, completed and order-value dashboard statistics."),
        ("Record orders on today, a different order date this month and an earlier month.", "Create Pending, Processing, Completed and Cancelled orders with different dates and values."),
        ("Check today's, this month's and all-time dashboard totals.", "Check Total Orders, Pending Orders, Completed Orders and Total Order Value."),
        ("What is the difference between today's total and this month's total?", "Why must the form and database use exactly the same order-status choices?"),
        ("Add a orders by category summary.", "Add an orders-by-category summary."),
        ("simple printable monthly orders report", "simple printable order-status report"),
        ("Repeat registration, order creation, reports, history, search", "Repeat registration, order creation, statistics, the orders list, search"),
        ("history, details, search, filters and sorting", "the orders list, details, search, filters and sorting"),
        ("reports, history", "statistics, the orders list"),
        ("best-selling categories", "orders by category"),
        ("printable monthly orders report", "printable order-status report"),
        ("the published key", "the publishable key"),
        (
            "You added deliberate, secure deletion and confirmed that related lists and statistics respond correctly.",
            "You added deliberate, secure deletion and confirmed that related lists and statistics respond correctly.\n\nThis means a user can remove an unwanted order without affecting another account's records.",
        ),
        ("Workbook 07 — Supplier Management System", "Workbook 09 — School Fee Management System"),
        (
            "You have built a secure Order Management System that allows a business to record orders, understand performance, find records, correct mistakes and remove unwanted records.",
            "You have built a secure Order Management System that allows a business to create customer orders, track status, view useful statistics, find records, correct mistakes and remove unwanted records.",
        ),
        (
            "The next project in the series is Workbook 09 — School Fee Management System.",
            "The next project in the series is Workbook 09 — School Fee Management System.",
        ),
        ("Congratulations once again on completing your Order Management System.", "Congratulations once again on completing your Order Management System."),
    )
    for old, new in replacements:
        note = note.replace(old, new)

    note = note.replace("a orders", "an orders")
    note = note.replace("An orders search area", "An order search area")
    note = note.replace("An orders date range", "An order date range")
    note = note.replace("How to build an orders form.", "How to build an order form.")
    note = note.replace("an orders by category summary", "an orders-by-category summary")
    note = note.replace("Add an orders-by-category summary.", "Add an order summary grouped by category.")
    note = note.replace(
        "secure order creation, reporting, discovery, editing and deletion",
        "secure order creation, statistics, search, editing and deletion",
    )
    note = re.sub(r"\n{4,}", "\n\n\n", note)
    return note.strip() + "\n"


def audit(note: str) -> None:
    required = (
        "PROMPT TO PROFIT™ WORKBOOK 08",
        "ORDER MANAGEMENT SYSTEM",
        "LEARNER SUPPORT TOOLKIT",
        "orders",
        "order_number",
        "order_date",
        "customer_name",
        "order_status",
        "total_amount",
        "Pending",
        "Processing",
        "Completed",
        "Cancelled",
        "Row Level Security",
        "emailRedirectTo",
        "window.location.origin",
        "CODE-READING QUESTION",
        "PORTFOLIO DESCRIPTION",
        "Workbook 09 — School Fee Management System",
    )
    for value in required:
        if value not in note:
            raise RuntimeError(f"Workbook 08 is missing required content: {value}")

    forbidden = (
        "Sales Tracker",
        "Supplier Management System",
        "Appointment Booking System",
        "Expense Tracker",
        "Customer Record Management System",
        "Professional Quotation Generator",
        "Professional Invoice Generator",
        "Workbook 01",
        "Workbook 02",
        "Workbook 03",
        "Workbook 04",
        "Workbook 05",
        "Workbook 06",
        "Workbook 07",
        "payment_method",
        "Cash, Card",
        "VS Code",
        "React",
        "Node.js",
    )
    for value in forbidden:
        if value in note:
            raise RuntimeError(f"Workbook 08 contains forbidden text: {value}")

    if note.count("CHAPTER INTRODUCTION") != 10:
        raise RuntimeError("Workbook 08 must contain ten chapter introductions")
    if note.count("COMMON BEGINNER MISTAKES") != 36:
        raise RuntimeError("Workbook 08 must contain 36 complete lessons")
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
    note = polish_opening(note)
    note = add_order_fields(note)
    note = polish_status_and_statistics(note)
    note = replace_statistics_lesson(note)
    note = transform_project(note)
    note = polish_language(note)
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
