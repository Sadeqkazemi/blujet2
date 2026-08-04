"""Request/response contracts for /internal/v1/recommendations (buy-now-or-wait radar)."""

from datetime import date as DateType
from typing import Literal

from pydantic import BaseModel, Field


class RecommendationRequest(BaseModel):
    origin_code: str = Field(min_length=3, max_length=3, description="IATA origin, e.g. THR")
    dest_code: str = Field(min_length=3, max_length=3, description="IATA destination, e.g. MHD")
    date: DateType = Field(description="Flight date (Gregorian ISO YYYY-MM-DD)")
    cabin: Literal["ECONOMY", "BUSINESS"] = "ECONOMY"


class RecommendationResponse(BaseModel):
    model_version: str
    recommendation: Literal["BUY_NOW", "WAIT"]
    explanation_fa: str
    confidence: float = Field(ge=0, le=1)
