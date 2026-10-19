"""Saved screenings, account analytics and the doctor's PDF report."""

from __future__ import annotations

import json
import logging
import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from backend.app.db import get_db
from backend.app.model_service import ModelNotLoadedError, model_service
from backend.app.report import build_report
from backend.app.schemas import (
    AnalyticsResponse,
    AssessmentDetail,
    AssessmentSummary,
    ImportRequest,
    ImportResponse,
    LabAnalytics,
    MonthlyCount,
    NoteUpdate,
    PatientInput,
    PredictionResponse,
    StoredLabOut,
    TrendPointOut,
)
from backend.app.security import current_user, iso, utc_now
from ml.config import FEATURE_META
from ml.units import round_for_display

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["history"])

LAB_ORDER = ("TSH", "T3", "TT4", "T4U", "FTI")
CLASSES = ("Negative", "Hypothyroid", "Hyperthyroid")


# --- writing -----------------------------------------------------------------
def save_assessment(
    db: sqlite3.Connection,
    user_id: int,
    patient: PatientInput,
    result: dict,
    created_at: datetime | None = None,
) -> int:
    """Persist one screening and its lab values. Commits."""
    stamp = iso(created_at or utc_now())
    canonical = patient.canonical_payload()
    cursor = db.execute(
        """
        INSERT INTO assessments (
            user_id, created_at, prediction, confidence, probabilities,
            inputs_provided, input_json, result_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            stamp,
            result["prediction"],
            result["confidence"],
            json.dumps(result["probabilities"]),
            result["inputs_provided"],
            patient.model_dump_json(),
            json.dumps(result),
        ),
    )
    assessment_id = cursor.lastrowid
    db.executemany(
        """
        INSERT INTO lab_values (
            assessment_id, user_id, created_at, feature, label, value, unit,
            value_canonical, status, reference_low, reference_high
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                assessment_id,
                user_id,
                stamp,
                flag["feature"],
                flag["label"],
                flag["value"],
                flag["unit"],
                float(canonical[flag["feature"]]),
                flag["status"],
                flag["reference_low"],
                flag["reference_high"],
            )
            for flag in result["lab_flags"]
        ],
    )
    db.commit()
    return assessment_id


# --- reading -----------------------------------------------------------------
_SUMMARY_COLUMNS = """
    a.id, a.created_at, a.prediction, a.confidence, a.probabilities,
    a.inputs_provided, a.note
"""


def _labs_by_assessment(
    db: sqlite3.Connection, user_id: int, assessment_ids: list[int]
) -> dict[int, list[StoredLabOut]]:
    if not assessment_ids:
        return {}
    placeholders = ",".join("?" for _ in assessment_ids)
    rows = db.execute(
        f"""
        SELECT assessment_id, feature, label, value, unit, status,
               reference_low, reference_high
        FROM lab_values
        WHERE user_id = ?
          AND assessment_id IN ({placeholders})
        ORDER BY id
        """,
        (user_id, *assessment_ids),
    ).fetchall()
    grouped: dict[int, list[StoredLabOut]] = {}
    for row in rows:
        grouped.setdefault(row["assessment_id"], []).append(
            StoredLabOut(
                feature=row["feature"],
                label=row["label"],
                value=row["value"],
                unit=row["unit"],
                status=row["status"],
                reference_low=row["reference_low"],
                reference_high=row["reference_high"],
            )
        )
    return grouped


def _summaries(db: sqlite3.Connection, user_id: int, rows: list[sqlite3.Row]) -> list[AssessmentSummary]:
    labs = _labs_by_assessment(db, user_id, [row["id"] for row in rows])
    return [
        AssessmentSummary(
            id=row["id"],
            created_at=row["created_at"],
            prediction=row["prediction"],
            confidence=row["confidence"],
            probabilities=json.loads(row["probabilities"]),
            inputs_provided=row["inputs_provided"],
            labs=labs.get(row["id"], []),
            note=row["note"],
        )
        for row in rows
    ]


def list_assessments(
    db: sqlite3.Connection,
    user_id: int,
    start: datetime | None = None,
    end: datetime | None = None,
) -> list[sqlite3.Row]:
    return db.execute(
        f"""
        SELECT {_SUMMARY_COLUMNS}, a.input_json, a.result_json
        FROM assessments a
        WHERE a.user_id = ?
          AND (? IS NULL OR a.created_at >= ?)
          AND (? IS NULL OR a.created_at <= ?)
        ORDER BY a.created_at DESC, a.id DESC
        """,
        (
            user_id,
            iso(start) if start else None,
            iso(start) if start else None,
            iso(end) if end else None,
            iso(end) if end else None,
        ),
    ).fetchall()


def _owned_assessment(db: sqlite3.Connection, user_id: int, assessment_id: int) -> sqlite3.Row:
    row = db.execute(
        f"""
        SELECT {_SUMMARY_COLUMNS}, a.input_json, a.result_json
        FROM assessments a
        WHERE a.id = ?
          AND a.user_id = ?
        """,
        (assessment_id, user_id),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")
    return row


@router.get("/assessments", response_model=list[AssessmentSummary])
def get_assessments(
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> list[AssessmentSummary]:
    return _summaries(db, user["id"], list_assessments(db, user["id"]))


@router.get("/assessments/{assessment_id}", response_model=AssessmentDetail)
def get_assessment(
    assessment_id: int,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AssessmentDetail:
    row = _owned_assessment(db, user["id"], assessment_id)
    summary = _summaries(db, user["id"], [row])[0]
    result = json.loads(row["result_json"])
    result["assessment_id"] = row["id"]
    return AssessmentDetail(
        **summary.model_dump(),
        input=json.loads(row["input_json"]),
        result=PredictionResponse(**result),
    )


@router.put("/assessments/{assessment_id}/note", response_model=AssessmentSummary)
def update_note(
    assessment_id: int,
    body: NoteUpdate,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AssessmentSummary:
    _owned_assessment(db, user["id"], assessment_id)
    note = (body.note or "").strip() or None
    db.execute(
        "UPDATE assessments SET note = ? WHERE id = ? AND user_id = ?",
        (note, assessment_id, user["id"]),
    )
    db.commit()
    return _summaries(db, user["id"], [_owned_assessment(db, user["id"], assessment_id)])[0]


@router.delete("/assessments/{assessment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_assessment(
    assessment_id: int,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    cursor = db.execute(
        "DELETE FROM assessments WHERE id = ? AND user_id = ?",
        (assessment_id, user["id"]),
    )
    db.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assessment not found.")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/assessments", status_code=status.HTTP_204_NO_CONTENT)
def clear_assessments(
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    db.execute("DELETE FROM assessments WHERE user_id = ?", (user["id"],))
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/assessments/import", response_model=ImportResponse)
def import_assessments(
    body: ImportRequest,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> ImportResponse:
    imported = 0
    for item in body.items:
        try:
            result = model_service.predict(item.input.canonical_payload(), item.input.units)
        except ModelNotLoadedError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        save_assessment(db, user["id"], item.input, result, created_at=item.created_at)
        imported += 1
    return ImportResponse(imported=imported)


# --- analytics ---------------------------------------------------------------
def compute_analytics(db: sqlite3.Connection, user_id: int) -> AnalyticsResponse:
    totals = db.execute(
        """
        SELECT COUNT(*)                          AS total,
               MIN(created_at)                   AS first_at,
               MAX(created_at)                   AS last_at,
               AVG(confidence)                   AS average_confidence,
               SUM(prediction <> 'Negative')     AS abnormal
        FROM assessments
        WHERE user_id = ?
        """,
        (user_id,),
    ).fetchone()

    class_rows = db.execute(
        """
        SELECT prediction, COUNT(*) AS count
        FROM assessments
        WHERE user_id = ?
        GROUP BY prediction
        """,
        (user_id,),
    ).fetchall()
    class_counts = {name: 0 for name in CLASSES}
    class_counts.update({row["prediction"]: row["count"] for row in class_rows})

    recent = db.execute(
        f"""
        SELECT {_SUMMARY_COLUMNS}
        FROM assessments a
        WHERE a.user_id = ?
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT 2
        """,
        (user_id,),
    ).fetchall()
    recent_summaries = _summaries(db, user_id, recent)

    monthly_rows = db.execute(
        """
        SELECT substr(created_at, 1, 7)          AS month,
               COUNT(*)                          AS total,
               SUM(prediction = 'Negative')      AS negative,
               SUM(prediction = 'Hypothyroid')   AS hypo,
               SUM(prediction = 'Hyperthyroid')  AS hyper
        FROM assessments
        WHERE user_id = ?
        GROUP BY month
        ORDER BY month
        """,
        (user_id,),
    ).fetchall()

    lab_rows = db.execute(
        """
        SELECT feature,
               COUNT(*)                 AS readings,
               SUM(status <> 'normal')  AS out_of_range,
               MIN(value_canonical)     AS minimum,
               MAX(value_canonical)     AS maximum,
               AVG(value_canonical)     AS average
        FROM lab_values
        WHERE user_id = ?
        GROUP BY feature
        """,
        (user_id,),
    ).fetchall()

    series_rows = db.execute(
        """
        SELECT feature, created_at, value_canonical, status
        FROM lab_values
        WHERE user_id = ?
        ORDER BY created_at ASC, id ASC
        """,
        (user_id,),
    ).fetchall()
    series: dict[str, list[TrendPointOut]] = {}
    for row in series_rows:
        series.setdefault(row["feature"], []).append(
            TrendPointOut(
                date=row["created_at"],
                value=round_for_display(row["value_canonical"]),
                status=row["status"],
            )
        )

    aggregates = {row["feature"]: row for row in lab_rows}
    labs: list[LabAnalytics] = []
    for feature in LAB_ORDER:
        row = aggregates.get(feature)
        points = series.get(feature)
        if row is None or not points:
            continue
        meta = FEATURE_META[feature]
        latest = points[-1]
        previous = points[-2] if len(points) > 1 else None
        labs.append(
            LabAnalytics(
                feature=feature,
                label=meta["label"],
                unit=meta["unit"],
                reference_low=meta["reference"][0],
                reference_high=meta["reference"][1],
                readings=row["readings"],
                out_of_range=row["out_of_range"],
                latest_value=latest.value,
                latest_status=latest.status,
                latest_at=latest.date,
                previous_value=previous.value if previous else None,
                change=round_for_display(latest.value - previous.value) if previous else None,
                minimum=round_for_display(row["minimum"]),
                maximum=round_for_display(row["maximum"]),
                average=round_for_display(row["average"]),
                series=points,
            )
        )

    last_at = datetime.fromisoformat(totals["last_at"]) if totals["last_at"] else None
    return AnalyticsResponse(
        total=totals["total"],
        first_at=totals["first_at"],
        last_at=last_at,
        days_since_last=(utc_now() - last_at).days if last_at else None,
        average_confidence=totals["average_confidence"],
        class_counts=class_counts,
        latest=recent_summaries[0] if recent_summaries else None,
        previous_prediction=recent_summaries[1].prediction if len(recent_summaries) > 1 else None,
        abnormal_assessments=totals["abnormal"] or 0,
        monthly=[
            MonthlyCount(
                month=row["month"],
                total=row["total"],
                Negative=row["negative"],
                Hypothyroid=row["hypo"],
                Hyperthyroid=row["hyper"],
            )
            for row in monthly_rows
        ],
        labs=labs,
    )


@router.get("/analytics", response_model=AnalyticsResponse)
def get_analytics(
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> AnalyticsResponse:
    return compute_analytics(db, user["id"])


# --- PDF ---------------------------------------------------------------------
def _pdf_response(content: bytes, filename: str) -> Response:
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/reports/history.pdf", tags=["reports"])
def history_report(
    start: datetime | None = Query(default=None, description="Only include screenings on or after this time."),
    end: datetime | None = Query(default=None, description="Only include screenings on or before this time."),
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    rows = list_assessments(db, user["id"], start, end)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="There are no saved screenings in this period to include in a report.",
        )
    content = build_report(user, rows, analytics=compute_analytics(db, user["id"]))
    stamp = utc_now().strftime("%Y-%m-%d")
    return _pdf_response(content, f"thyrolens-history-{stamp}.pdf")


@router.get("/reports/assessments/{assessment_id}.pdf", tags=["reports"])
def assessment_report(
    assessment_id: int,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> Response:
    row = _owned_assessment(db, user["id"], assessment_id)
    content = build_report(user, [row], analytics=None)
    stamp = datetime.fromisoformat(row["created_at"]).strftime("%Y-%m-%d")
    return _pdf_response(content, f"thyrolens-screening-{stamp}.pdf")
