import logging

from fastapi import APIRouter, Depends, Header

from ..core.auth import require_internal_token
from ..schemas.recommendations import RecommendationRequest, RecommendationResponse
from ..services.recommendations import MODEL_VERSION, recommend

logger = logging.getLogger("ml.recommendations")

router = APIRouter(prefix="/internal/v1", dependencies=[Depends(require_internal_token)])


@router.post("/recommendations", response_model=RecommendationResponse)
async def recommendations(
    body: RecommendationRequest,
    x_request_id: str = Header(default="-"),
) -> RecommendationResponse:
    result = recommend(body)
    logger.info(
        '{"event":"recommendations","request_id":"%s","origin":"%s","dest":"%s","model":"%s","recommendation":"%s"}',
        x_request_id,
        body.origin_code,
        body.dest_code,
        MODEL_VERSION,
        result.recommendation,
    )
    return result
