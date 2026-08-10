#!/usr/bin/env python3
"""
יצירת קובץ אקסל להשוואת קבלנים, ספקים ונותני שירות לפרויקט בניית בית פרטי.

הרצה:
    pip install openpyxl
    python3 create_house_comparison_excel.py

התוצאה: קובץ House_Building_Comparisons.xlsx עם גיליון נפרד לכל תחום מקצועי,
מוגדר מימין לשמאל (RTL), עם שורת כותרות מודגשת ורוחב עמודות מותאם.
"""

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

OUTPUT_FILENAME = "House_Building_Comparisons.xlsx"

# שמות הגיליונות, לפי סדר התחומים המקצועיים
SHEET_NAMES = [
    "יועצים ומנהלת",
    "קבלני שלד",
    "קבלני אינסטלציה",
    "קבלני חשמל ותקשורת",
    "קבלני מיזוג אוויר",
    "ספקי אלומיניום",
    "ספקי דלתות",
    "ריצוף חיפוי וכלים סניטריים",
    "מטבחים ונגרות",
    "קבלני גמר",
]

# תיאור מורחב לכל גיליון (מוצג בהערה/כותרת עליונה לא נדרש, נשמר כאן לתיעוד בלבד)
SHEET_DESCRIPTIONS = {
    "יועצים ומנהלת": "יועצים ומנהלת (מפקח, אדריכל, מהנדס, מודד)",
    "קבלני שלד": "קבלני שלד",
    "קבלני אינסטלציה": "קבלני אינסטלציה (מים וביוב)",
    "קבלני חשמל ותקשורת": "קבלני חשמל ותקשורת",
    "קבלני מיזוג אוויר": "קבלני מיזוג אוויר",
    "ספקי אלומיניום": "ספקי אלומיניום (חלונות ותריסים)",
    "ספקי דלתות": "ספקי דלתות (דלת כניסה ודלתות פנים)",
    "ריצוף חיפוי וכלים סניטריים": "ספקי ריצוף, חיפוי וכלים סניטריים",
    "מטבחים ונגרות": "חברות מטבחים ונגרות",
    "קבלני גמר": "קבלני גמר (טיח, צבע, גבס)",
}

# כותרות העמודות, בסדר תאים A->K (יוצג מימין לשמאל בזכות rightToLeft)
COLUMN_HEADERS = [
    "שם הקבלן / הספק",
    "איש קשר + טלפון",
    'הצעת מחיר בסיסית (לפני מע"מ)',
    'סך הכל לתשלום (כולל מע"מ)',
    "מה לא כלול בהצעה? (החרגות חשובות)",
    "תנאי תשלום (חלוקה לפי אבני דרך)",
    "תאריך זמינות לתחילת עבודה",
    "משך זמן עבודה משוער / זמן אספקה",
    "תקופת אחריות",
    "המלצות (האם דיברתי עם לקוחות עבר? האם ראיתי עבודה בשטח?)",
    "הערות נוספות (יתרונות, חסרונות, תחושת בטן)",
]

# רוחב מותאם לכל עמודה (בערך תווים), לפי אורך התוכן הצפוי בה
COLUMN_WIDTHS = [22, 20, 20, 20, 32, 30, 20, 26, 16, 34, 34]

BLANK_DATA_ROWS = 25
TAB_COLORS = [
    "1F4E78", "2E75B6", "2E7D32", "1B7A6E", "8E24AA",
    "B8860B", "C0392B", "16A085", "6D4C41", "455A64",
]

HEADER_FILL = PatternFill(start_color="1F4E78", end_color="1F4E78", fill_type="solid")
HEADER_FONT = Font(name="Arial", size=12, bold=True, color="FFFFFF")
HEADER_ALIGNMENT = Alignment(horizontal="center", vertical="center", wrap_text=True)

DATA_FONT = Font(name="Arial", size=11)
DATA_ALIGNMENT = Alignment(horizontal="right", vertical="top", wrap_text=True)

THIN_SIDE = Side(style="thin", color="B7B7B7")
THIN_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)


def build_sheet(ws, tab_color):
    ws.sheet_view.rightToLeft = True
    ws.sheet_properties.tabColor = tab_color

    # שורת כותרות
    for col_idx, header_text in enumerate(COLUMN_HEADERS, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header_text)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = HEADER_ALIGNMENT
        cell.border = THIN_BORDER
    ws.row_dimensions[1].height = 45

    # רוחב עמודות
    for col_idx, width in enumerate(COLUMN_WIDTHS, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width

    # שורות ריקות מעוצבות למילוי נתונים
    for row_idx in range(2, BLANK_DATA_ROWS + 2):
        ws.row_dimensions[row_idx].height = 32
        for col_idx in range(1, len(COLUMN_HEADERS) + 1):
            cell = ws.cell(row=row_idx, column=col_idx)
            cell.font = DATA_FONT
            cell.alignment = DATA_ALIGNMENT
            cell.border = THIN_BORDER

    ws.freeze_panes = "A2"
    last_col_letter = get_column_letter(len(COLUMN_HEADERS))
    ws.auto_filter.ref = f"A1:{last_col_letter}1"


def main():
    wb = Workbook()
    wb.remove(wb.active)

    for sheet_name, tab_color in zip(SHEET_NAMES, TAB_COLORS):
        ws = wb.create_sheet(title=sheet_name)
        build_sheet(ws, tab_color)

    wb.save(OUTPUT_FILENAME)
    print(f"נוצר בהצלחה: {OUTPUT_FILENAME}")
    print(f"מספר גיליונות: {len(SHEET_NAMES)}")


if __name__ == "__main__":
    main()
