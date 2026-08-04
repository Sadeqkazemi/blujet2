import os

os.environ.setdefault("INTERNAL_TOKEN", "test-internal-token")

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.recommendations import RecommendationRequest
from app.services.recommendations import MODEL_VERSION, recommend

client = TestClient(app)

AUTH = {"X-Internal-Token": "test-internal-token"}


def make_body(**overrides) -> dict:
    base = {
        "origin_code": "THR",
        "dest_code": "MHD",
        "date": (date.today() + timedelta(days=7)).isoformat(),
        "cabin": "ECONOMY",
    }
    base.update(overrides)
    return base


def test_rejects_missing_or_wrong_token():
    assert client.post("/internal/v1/recommendations", json=make_body()).status_code == 401
    assert (
        client.post(
            "/internal/v1/recommendations",
            json=make_body(),
            headers={"X-Internal-Token": "wrong"},
        ).status_code
        == 401
    )


def test_recommendations_response_shape_and_model_version():
    res = client.post("/internal/v1/recommendations", json=make_body(), headers=AUTH)
    assert res.status_code == 200
    body = res.json()
    assert body["model_version"] == MODEL_VERSION
    assert body["recommendation"] in ("BUY_NOW", "WAIT")
    assert body["explanation_fa"]
    assert 0 <= body["confidence"] <= 1


def test_near_term_departures_recommend_buy_now():
    body = RecommendationRequest(**make_body(date=(date.today() + timedelta(days=5)).isoformat()))
    result = recommend(body)
    assert result.recommendation == "BUY_NOW"


def test_far_departures_recommend_wait():
    body = RecommendationRequest(**make_body(date=(date.today() + timedelta(days=60)).isoformat()))
    result = recommend(body)
    assert result.recommendation == "WAIT"


def test_validation_rejects_bad_payloads():
    assert (
        client.post(
            "/internal/v1/recommendations",
            json=make_body(origin_code="T"),
            headers=AUTH,
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/internal/v1/recommendations",
            json=make_body(date="not-a-date"),
            headers=AUTH,
        ).status_code
        == 422
    )


def test_deterministic_for_same_input():
    body = RecommendationRequest(**make_body(date=(date.today() + timedelta(days=30)).isoformat()))
    assert recommend(body) == recommend(body)
