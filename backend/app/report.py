"""The PDF a patient takes to their doctor.

Laid out the way a clinician reads a results summary: who the patient is,
the latest panel against reference ranges, how each test has moved over time,
then the full chronological record. Values are printed in the unit the
patient entered, because that is what matches the laboratory report on the
desk next to it.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import UTC, date, datetime
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.graphics.charts.lineplots import LinePlot
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.graphics.widgets.markers import makeMarker
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from backend.app.model_service import DISCLAIMER
from backend.app.schemas import AnalyticsResponse
from ml.config import BINARY_LABELS

BRAND = "ThyroLens"
LAB_ORDER = ("TSH", "T3", "TT4", "T4U", "FTI")

INK = colors.HexColor("#241C16")
MUTED = colors.HexColor("#6E6258")
LINE = colors.HexColor("#EADFD2")
SOFT = colors.HexColor("#FAF6EF")
PRIMARY = colors.HexColor("#178A7E")
CLASS_COLOURS = {
    "Negative": colors.HexColor("#2A8A62"),
    "Hypothyroid": colors.HexColor("#C27A16"),
    "Hyperthyroid": colors.HexColor("#C44B3C"),
}
STATUS_COLOURS = {
    "low": colors.HexColor("#C27A16"),
    "high": colors.HexColor("#C44B3C"),
    "normal": colors.HexColor("#2A8A62"),
}
STATUS_TEXT = {"low": "Low", "high": "High", "normal": "Normal"}
CLASS_TEXT = {
    "Negative": "No thyroid disorder indicated",
    "Hypothyroid": "Pattern consistent with hypothyroidism",
    "Hyperthyroid": "Pattern consistent with hyperthyroidism",
}

_base = getSampleStyleSheet()
STYLES = {
    "title": ParagraphStyle("title", parent=_base["Title"], fontSize=18, leading=22, textColor=INK, alignment=TA_LEFT, spaceAfter=2),
    "subtitle": ParagraphStyle("subtitle", parent=_base["Normal"], fontSize=9.5, leading=13, textColor=MUTED),
    "h2": ParagraphStyle("h2", parent=_base["Heading2"], fontSize=12, leading=15, textColor=INK, spaceBefore=12, spaceAfter=6),
    "body": ParagraphStyle("body", parent=_base["Normal"], fontSize=9, leading=12.5, textColor=INK),
    "small": ParagraphStyle("small", parent=_base["Normal"], fontSize=7.5, leading=10, textColor=MUTED),
    "cell": ParagraphStyle("cell", parent=_base["Normal"], fontSize=8, leading=10, textColor=INK),
    "cell_bold": ParagraphStyle("cell_bold", parent=_base["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=10, textColor=INK),
}


def _parse(moment: str) -> datetime:
    return datetime.fromisoformat(moment)


def _fmt_date(moment: str | datetime) -> str:
    value = _parse(moment) if isinstance(moment, str) else moment
    return value.strftime("%d %b %Y")


def _fmt_datetime(moment: str) -> str:
    return _parse(moment).strftime("%d %b %Y, %H:%M UTC")


def _number(value: float) -> str:
    return f"{value:g}"


def _age(date_of_birth: str | None) -> str | None:
    if not date_of_birth:
        return None
    born = date.fromisoformat(date_of_birth)
    today = date.today()
    return str(today.year - born.year - ((today.month, today.day) < (born.month, born.day)))


def _table(data: list[list], widths: list[float], header: bool = True, extra: list | None = None) -> Table:
    table = Table(data, colWidths=widths, repeatRows=1 if header else 0)
    style = [
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TEXTCOLOR", (0, 0), (-1, -1), INK),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
    ]
    if header:
        style += [
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
            ("FONTSIZE", (0, 0), (-1, 0), 7.5),
            ("BACKGROUND", (0, 0), (-1, 0), SOFT),
            ("LINEBELOW", (0, 0), (-1, 0), 0.8, LINE),
        ]
    table.setStyle(TableStyle(style + (extra or [])))
    return table


def _patient_block(user: sqlite3.Row, rows: list[sqlite3.Row]) -> Table:
    oldest, newest = rows[-1]["created_at"], rows[0]["created_at"]
    period = _fmt_date(newest) if oldest == newest else f"{_fmt_date(oldest)} to {_fmt_date(newest)}"
    age = _age(user["date_of_birth"])
    dob = f"{_fmt_date(datetime.fromisoformat(user['date_of_birth']))} (age {age})" if age else "Not provided"
    sex = (user["sex"] or "Not provided").capitalize()
    cells = [
        [Paragraph("<b>Patient</b>", STYLES["cell"]), Paragraph(escape(user["full_name"]), STYLES["cell"]),
         Paragraph("<b>Report generated</b>", STYLES["cell"]), Paragraph(datetime.now(UTC).strftime("%d %b %Y, %H:%M UTC"), STYLES["cell"])],
        [Paragraph("<b>Date of birth</b>", STYLES["cell"]), Paragraph(dob, STYLES["cell"]),
         Paragraph("<b>Period covered</b>", STYLES["cell"]), Paragraph(period, STYLES["cell"])],
        [Paragraph("<b>Sex</b>", STYLES["cell"]), Paragraph(sex, STYLES["cell"]),
         Paragraph("<b>Screenings</b>", STYLES["cell"]), Paragraph(str(len(rows)), STYLES["cell"])],
        [Paragraph("<b>Email</b>", STYLES["cell"]), Paragraph(escape(user["email"]), STYLES["cell"]), "", ""],
    ]
    table = Table(cells, colWidths=[28 * mm, 60 * mm, 32 * mm, 60 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SOFT),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def _latest_section(row: sqlite3.Row) -> list:
    result = json.loads(row["result_json"])
    patient = json.loads(row["input_json"])
    prediction = result["prediction"]
    story: list = [
        Paragraph(f"Most recent screening &middot; {_fmt_datetime(row['created_at'])}", STYLES["h2"]),
        Paragraph(
            f'<font color="{CLASS_COLOURS[prediction].hexval()}"><b>{CLASS_TEXT[prediction]}</b></font>'
            f" &nbsp; (model probability {result['confidence'] * 100:.1f}%, "
            f"{result['inputs_provided']} of {result['inputs_total']} measured inputs supplied)",
            STYLES["body"],
        ),
        Spacer(1, 6),
    ]

    data = [["Test", "Result", "Reference range", "Status"]]
    status_styles = []
    for index, flag in enumerate(result["lab_flags"], start=1):
        data.append(
            [
                flag["label"],
                f"{_number(flag['value'])} {flag['unit']}",
                f"{_number(flag['reference_low'])} - {_number(flag['reference_high'])} {flag['unit']}",
                STATUS_TEXT[flag["status"]],
            ]
        )
        status_styles.append(("TEXTCOLOR", (3, index), (3, index), STATUS_COLOURS[flag["status"]]))
        if flag["status"] != "normal":
            status_styles.append(("FONTNAME", (1, index), (3, index), "Helvetica-Bold"))
    if len(data) > 1:
        story.append(_table(data, [45 * mm, 40 * mm, 60 * mm, 35 * mm], extra=status_styles))

    probabilities = result["probabilities"]
    story += [
        Spacer(1, 6),
        Paragraph(
            "Class probabilities: "
            + ", ".join(f"{name} {probabilities.get(name, 0) * 100:.1f}%" for name in CLASS_TEXT),
            STYLES["small"],
        ),
    ]

    factors = [item for item in result["contributions"] if item["impact"] >= 0.01][:4]
    if factors:
        lines = []
        for item in factors:
            value = f" ({_number(item['value'])} {item['unit'] or ''})".rstrip() if item["value"] is not None else ""
            verb = "supported" if item["direction"] == "supports" else "weighed against"
            lines.append(f"{escape(item['label'])}{escape(value)} {verb} this result")
        story.append(Spacer(1, 4))
        story.append(Paragraph("<b>Main factors:</b> " + "; ".join(lines) + ".", STYLES["body"]))

    history = [label for feature, label in BINARY_LABELS.items() if feature != "sex_is_male" and patient.get(feature)]
    story.append(Spacer(1, 4))
    story.append(
        Paragraph(
            "<b>Reported history:</b> " + (escape(", ".join(history)) if history else "None reported"),
            STYLES["body"],
        )
    )
    if row["note"]:
        story.append(Spacer(1, 4))
        story.append(Paragraph(f"<b>Patient note:</b> {escape(row['note'])}", STYLES["body"]))
    return story


def _trend_chart(lab) -> Drawing | None:
    if len(lab.series) < 2:
        return None
    width, height = 170 * mm, 42 * mm
    drawing = Drawing(width, height)
    times = [point.date.timestamp() / 86400 for point in lab.series]
    values = [point.value for point in lab.series]
    low = min(min(values), lab.reference_low)
    high = max(max(values), lab.reference_high)
    pad = (high - low) * 0.15 or 1

    plot = LinePlot()
    plot.x, plot.y = 12 * mm, 6 * mm
    plot.width, plot.height = width - 16 * mm, height - 12 * mm
    plot.data = [list(zip(times, values))]
    plot.lines[0].strokeColor = PRIMARY
    plot.lines[0].strokeWidth = 1.4
    plot.lines[0].symbol = makeMarker("FilledCircle", size=3.5, fillColor=PRIMARY, strokeColor=PRIMARY)
    plot.yValueAxis.valueMin = max(low - pad, 0)
    plot.yValueAxis.valueMax = high + pad
    plot.yValueAxis.labels.fontName = "Helvetica"
    plot.yValueAxis.labels.fontSize = 6.5
    plot.yValueAxis.labels.fillColor = MUTED
    plot.yValueAxis.strokeColor = LINE
    plot.xValueAxis.valueMin = min(times) - 0.5
    plot.xValueAxis.valueMax = max(times) + 0.5
    plot.xValueAxis.labels.fontName = "Helvetica"
    plot.xValueAxis.labels.fontSize = 6.5
    plot.xValueAxis.labels.fillColor = MUTED
    plot.xValueAxis.strokeColor = LINE
    plot.xValueAxis.labelTextFormat = lambda day: datetime.fromtimestamp(day * 86400, UTC).strftime("%d %b %y")
    plot.xValueAxis.maximumTicks = 6

    span = plot.yValueAxis.valueMax - plot.yValueAxis.valueMin
    band_bottom = plot.y + (max(lab.reference_low, plot.yValueAxis.valueMin) - plot.yValueAxis.valueMin) / span * plot.height
    band_top = plot.y + (min(lab.reference_high, plot.yValueAxis.valueMax) - plot.yValueAxis.valueMin) / span * plot.height
    drawing.add(
        Rect(plot.x, band_bottom, plot.width, max(band_top - band_bottom, 0.5),
             fillColor=colors.HexColor("#E8F5EE"), strokeColor=None)
    )
    drawing.add(plot)
    legend = f"Reference range {_number(lab.reference_low)}-{_number(lab.reference_high)} {lab.unit}"
    legend_x = plot.x + plot.width
    drawing.add(
        String(legend_x, height - 5, legend, fontName="Helvetica", fontSize=6.5,
               fillColor=colors.HexColor("#2A8A62"), textAnchor="end")
    )
    legend_width = stringWidth(legend, "Helvetica", 6.5)
    drawing.add(
        Rect(legend_x - legend_width - 9, height - 5.5, 6, 6,
             fillColor=colors.HexColor("#E8F5EE"), strokeColor=colors.HexColor("#7BC9A3"), strokeWidth=0.5)
    )
    return drawing


def _trend_section(analytics: AnalyticsResponse) -> list:
    if not analytics.labs:
        return []
    story: list = [
        Paragraph("Trends", STYLES["h2"]),
        Paragraph(
            "Readings converted to a common unit so results entered in different units can be compared.",
            STYLES["small"],
        ),
        Spacer(1, 4),
    ]
    data = [["Test", "Readings", "Out of range", "Latest", "Previous", "Change", "Lowest", "Highest"]]
    for lab in analytics.labs:
        change = "-" if lab.change is None else f"{'+' if lab.change > 0 else ''}{_number(lab.change)}"
        data.append(
            [
                f"{lab.label} ({lab.unit})",
                str(lab.readings),
                str(lab.out_of_range),
                f"{_number(lab.latest_value)} ({STATUS_TEXT[lab.latest_status]})",
                "-" if lab.previous_value is None else _number(lab.previous_value),
                change,
                _number(lab.minimum),
                _number(lab.maximum),
            ]
        )
    story.append(_table(data, [38 * mm, 17 * mm, 20 * mm, 28 * mm, 19 * mm, 18 * mm, 18 * mm, 18 * mm]))

    for lab in analytics.labs:
        chart = _trend_chart(lab)
        if chart is not None:
            story.append(
                KeepTogether([Spacer(1, 6), Paragraph(f"<b>{escape(lab.label)}</b> over time ({lab.unit})", STYLES["body"]), chart])
            )
    return story


def _history_section(rows: list[sqlite3.Row]) -> list:
    header = ["Date", "Result", "Prob."] + ["TSH", "T3", "TT4", "T4U", "FTI"]
    data: list[list] = [header]
    extra = []
    notes = []
    for index, row in enumerate(rows, start=1):
        result = json.loads(row["result_json"])
        flags = {flag["feature"]: flag for flag in result["lab_flags"]}
        cells = []
        for column, feature in enumerate(LAB_ORDER, start=3):
            flag = flags.get(feature)
            if flag is None:
                cells.append("-")
                continue
            marker = {"high": " H", "low": " L"}.get(flag["status"], "")
            cells.append(Paragraph(f"{_number(flag['value'])}{marker}<br/><font size=6 color='#64748B'>{escape(flag['unit'])}</font>", STYLES["cell"]))
            if flag["status"] != "normal":
                extra.append(("BACKGROUND", (column, index), (column, index), colors.HexColor("#FEF3C7")))
        prediction = row["prediction"]
        data.append(
            [
                _fmt_date(row["created_at"]),
                Paragraph(f'<font color="{CLASS_COLOURS[prediction].hexval()}">{prediction}</font>', STYLES["cell_bold"]),
                f"{row['confidence'] * 100:.1f}%",
                *cells,
            ]
        )
        if row["note"]:
            notes.append(f"<b>{_fmt_date(row['created_at'])}:</b> {escape(row['note'])}")

    story: list = [
        Paragraph("Screening history", STYLES["h2"]),
        Paragraph("Values as entered by the patient. H = above reference range, L = below.", STYLES["small"]),
        Spacer(1, 4),
        _table(data, [22 * mm, 26 * mm, 13 * mm] + [23.8 * mm] * 5, extra=extra),
    ]
    if notes:
        story += [Paragraph("Patient notes", STYLES["h2"])] + [Paragraph(note, STYLES["body"]) for note in notes]
    return story


def _decorate(canvas, document) -> None:
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(PRIMARY)
    canvas.rect(0, height - 6, width, 6, stroke=0, fill=1)
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(document.leftMargin, 10 * mm, f"{BRAND} screening report - confidential patient information")
    canvas.drawRightString(width - document.rightMargin, 10 * mm, f"Page {document.page}")
    canvas.restoreState()


def build_report(
    user: sqlite3.Row,
    rows: list[sqlite3.Row],
    analytics: AnalyticsResponse | None,
) -> bytes:
    """Render ``rows`` (newest first) into a PDF and return its bytes."""
    buffer = BytesIO()
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"{BRAND} report - {user['full_name']}",
        author=BRAND,
    )
    single = len(rows) == 1
    story: list = [
        Paragraph(f"{BRAND} &middot; {'Screening report' if single else 'Thyroid screening history'}", STYLES["title"]),
        Paragraph("Prepared for review with a doctor. Bring your original laboratory report as well.", STYLES["subtitle"]),
        Spacer(1, 8),
        _patient_block(user, rows),
    ]
    story += _latest_section(rows[0])
    if analytics is not None and analytics.total > 1:
        story += _trend_section(analytics)
    if not single:
        story += _history_section(rows)
    story += [
        Spacer(1, 12),
        Paragraph(
            f"<b>Important:</b> {escape(DISCLAIMER)}",
            STYLES["small"],
        ),
    ]
    document.build(story, onFirstPage=_decorate, onLaterPages=_decorate)
    return buffer.getvalue()
