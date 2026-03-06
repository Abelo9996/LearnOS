"""
Certificates Router — Issue, verify, and download course completion certificates.
Generates PDF certificates with unique verification codes.
"""

import hashlib
import io
import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor
from reportlab.lib.units import inch, mm
from reportlab.pdfgen import canvas as pdf_canvas

import db

logger = logging.getLogger("learnos.certificates")
router = APIRouter(prefix="/certificates", tags=["certificates"])


# ═══════════════ Request Models ═══════════════

class IssueCertificateRequest(BaseModel):
    user_id: str
    course_id: str
    course_title: str
    user_display_name: str
    mastery_score: float = 0
    milestones_completed: int = 0
    total_milestones: int = 0
    total_hours: float = 0


class MasteryRequirementsRequest(BaseModel):
    course_id: str
    min_milestones_pct: float = 100
    min_mastery_score: float = 70
    min_hours: float = 0
    require_final_assessment: bool = False


# ═══════════════ PDF GENERATION ═══════════════

def generate_certificate_pdf(cert: dict) -> bytes:
    """Generate a beautiful PDF certificate."""
    buf = io.BytesIO()
    w, h = A4[1], A4[0]  # Landscape
    c = pdf_canvas.Canvas(buf, pagesize=(w, h))

    # Background
    c.setFillColor(HexColor("#FAFAFE"))
    c.rect(0, 0, w, h, fill=1, stroke=0)

    # Border
    c.setStrokeColor(HexColor("#7C3AED"))
    c.setLineWidth(3)
    c.rect(20, 20, w - 40, h - 40, fill=0, stroke=1)
    c.setStrokeColor(HexColor("#C4B5FD"))
    c.setLineWidth(1)
    c.rect(30, 30, w - 60, h - 60, fill=0, stroke=1)

    # Header
    c.setFillColor(HexColor("#7C3AED"))
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(w / 2, h - 70, "🎓  L E A R N O S")

    c.setFillColor(HexColor("#1F2937"))
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(w / 2, h - 120, "Certificate of Completion")

    # Decorative line
    c.setStrokeColor(HexColor("#7C3AED"))
    c.setLineWidth(2)
    c.line(w / 2 - 120, h - 135, w / 2 + 120, h - 135)

    # "This certifies that"
    c.setFillColor(HexColor("#6B7280"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 175, "This certifies that")

    # Name
    c.setFillColor(HexColor("#1F2937"))
    c.setFont("Helvetica-Bold", 28)
    name = cert.get("user_display_name", "Learner")
    c.drawCentredString(w / 2, h - 215, name)

    # "has successfully completed"
    c.setFillColor(HexColor("#6B7280"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(w / 2, h - 255, "has successfully completed the course")

    # Course title
    c.setFillColor(HexColor("#7C3AED"))
    c.setFont("Helvetica-Bold", 22)
    title = cert.get("course_title", "Course")
    if len(title) > 50:
        title = title[:47] + "..."
    c.drawCentredString(w / 2, h - 290, title)

    # Stats row
    y_stats = h - 340
    c.setFont("Helvetica", 11)
    c.setFillColor(HexColor("#4B5563"))

    stats = []
    if cert.get("mastery_score"):
        stats.append(f"Mastery Score: {cert['mastery_score']:.0f}%")
    if cert.get("milestones_completed"):
        stats.append(f"Milestones: {cert['milestones_completed']}/{cert.get('total_milestones', '?')}")
    if cert.get("total_hours"):
        stats.append(f"Hours: {cert['total_hours']:.1f}")

    if stats:
        c.drawCentredString(w / 2, y_stats, "  •  ".join(stats))

    # Date
    c.setFont("Helvetica", 12)
    c.setFillColor(HexColor("#6B7280"))
    date_str = cert.get("completion_date", datetime.now().strftime("%Y-%m-%d"))
    try:
        d = datetime.strptime(date_str[:10], "%Y-%m-%d")
        date_display = d.strftime("%B %d, %Y")
    except Exception:
        date_display = date_str
    c.drawCentredString(w / 2, y_stats - 35, f"Issued on {date_display}")

    # Verification
    c.setFont("Helvetica", 9)
    c.setFillColor(HexColor("#9CA3AF"))
    vh = cert.get("verification_hash", "")
    c.drawCentredString(w / 2, 55, f"Verification: {vh}")
    c.drawCentredString(w / 2, 42, "Verify at learnos.ai/verify or localhost:3000/verify")

    # LearnOS footer
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(HexColor("#7C3AED"))
    c.drawCentredString(w / 2, 75, "LearnOS — The Open-Source AI University")

    c.save()
    buf.seek(0)
    return buf.read()


def _make_verification_hash(user_id: str, course_id: str, timestamp: str) -> str:
    raw = f"learnos:{user_id}:{course_id}:{timestamp}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16].upper()


# ═══════════════ ENDPOINTS ═══════════════

@router.post("/issue")
async def issue_certificate(req: IssueCertificateRequest):
    """Issue a certificate for course completion."""
    # Check mastery requirements
    reqs = await db.get_mastery_requirements(req.course_id)

    if req.total_milestones > 0:
        pct = (req.milestones_completed / req.total_milestones) * 100
        if pct < reqs["min_milestones_pct"]:
            raise HTTPException(400, f"Need {reqs['min_milestones_pct']}% milestones, have {pct:.0f}%")

    if req.mastery_score < reqs["min_mastery_score"]:
        raise HTTPException(400, f"Need {reqs['min_mastery_score']}% mastery, have {req.mastery_score:.0f}%")

    now = datetime.now().isoformat()
    verification_hash = _make_verification_hash(req.user_id, req.course_id, now)

    cert = {
        "certificate_id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "course_id": req.course_id,
        "course_title": req.course_title,
        "user_display_name": req.user_display_name,
        "completion_date": datetime.now().strftime("%Y-%m-%d"),
        "mastery_score": req.mastery_score,
        "milestones_completed": req.milestones_completed,
        "total_milestones": req.total_milestones,
        "total_hours": req.total_hours,
        "verification_hash": verification_hash,
        "issued_at": now,
    }
    await db.save_certificate(cert)

    # Activity + notification
    await db.save_activity({
        "activity_id": str(uuid.uuid4()),
        "user_id": req.user_id,
        "course_id": req.course_id,
        "activity_type": "certificate_earned",
        "title": f"{req.user_display_name} earned a certificate",
        "description": req.course_title,
    })

    return {"certificate": cert}


@router.get("/user/{user_id}")
async def get_user_certificates(user_id: str):
    """Get all certificates for a user (profile gallery)."""
    certs = await db.list_user_certificates(user_id)
    return {"certificates": certs, "count": len(certs)}


@router.get("/verify/{verification_hash}")
async def verify_certificate(verification_hash: str):
    """Public verification endpoint."""
    cert = await db.get_certificate_by_hash(verification_hash)
    if not cert:
        raise HTTPException(404, "Certificate not found")
    return {
        "valid": True,
        "certificate": {
            "user_display_name": cert["user_display_name"],
            "course_title": cert["course_title"],
            "completion_date": cert["completion_date"],
            "mastery_score": cert["mastery_score"],
            "milestones_completed": cert["milestones_completed"],
            "total_milestones": cert["total_milestones"],
            "verification_hash": cert["verification_hash"],
            "issued_at": cert["issued_at"],
        }
    }


@router.get("/download/{certificate_id}")
async def download_certificate(certificate_id: str):
    """Download certificate as PDF."""
    cert = await db.get_certificate(certificate_id)
    if not cert:
        raise HTTPException(404, "Certificate not found")

    pdf_bytes = generate_certificate_pdf(cert)
    filename = f"LearnOS_Certificate_{cert['verification_hash']}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/download-by-hash/{verification_hash}")
async def download_certificate_by_hash(verification_hash: str):
    """Download certificate PDF by verification hash."""
    cert = await db.get_certificate_by_hash(verification_hash)
    if not cert:
        raise HTTPException(404, "Certificate not found")

    pdf_bytes = generate_certificate_pdf(cert)
    filename = f"LearnOS_Certificate_{verification_hash}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.post("/mastery-requirements")
async def set_mastery_requirements(req: MasteryRequirementsRequest):
    """Set mastery requirements for a course (author only)."""
    await db.save_mastery_requirements(req.course_id, req.dict())
    return {"message": "Mastery requirements saved", "requirements": req.dict()}


@router.get("/mastery-requirements/{course_id}")
async def get_mastery_requirements(course_id: str):
    """Get mastery requirements for a course."""
    reqs = await db.get_mastery_requirements(course_id)
    return {"requirements": reqs}
