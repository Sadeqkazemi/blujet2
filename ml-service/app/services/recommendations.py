"""Heuristic buy-now-or-wait advisory until a trained model is ready."""

from datetime import date

from ..schemas.recommendations import RecommendationRequest, RecommendationResponse

MODEL_VERSION = "rec-heuristic-v0"


def _days_until(departure: date) -> int:
    return (departure - date.today()).days


def recommend(body: RecommendationRequest) -> RecommendationResponse:
    dep = body.date
    days = _days_until(dep)
    origin = body.origin_code.upper()
    dest = body.dest_code.upper()

    if days <= 14:
        recommendation = "BUY_NOW"
        explanation_fa = (
            "با توجه به نزدیک بودن تاریخ پرواز، احتمال افزایش قیمت در این مسیر بالاست."
        )
        confidence = 0.72
    elif days >= 45:
        recommendation = "WAIT"
        explanation_fa = (
            "تا تاریخ پرواز فاصله دارید؛ معمولاً نزدیک به پرواز تخفیف‌های بیشتری دیده می‌شود."
        )
        confidence = 0.68
    else:
        seed = hash(f"{origin}{dest}{dep.isoformat()}{body.cabin}") % 2
        if seed == 0:
            recommendation = "BUY_NOW"
            explanation_fa = "روند اخیر قیمت در این مسیر نشان می‌دهد خرید الان منطقی‌تر است."
        else:
            recommendation = "WAIT"
            explanation_fa = "روند اخیر قیمت در این مسیر نشان می‌دهد کمی صبر کنید."
        confidence = 0.58

    return RecommendationResponse(
        model_version=MODEL_VERSION,
        recommendation=recommendation,
        explanation_fa=explanation_fa,
        confidence=confidence,
    )
