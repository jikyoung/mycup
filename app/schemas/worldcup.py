# app/schemas/worldcup.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional

class PhotoInMatch(BaseModel):
    """매치 내 사진 정보"""
    id: str
    url: str
    
    class Config:
        from_attributes = True

class MatchResponse(BaseModel):
    """매치 응답"""
    id: str
    round_number: int
    match_order: int
    photo_a: PhotoInMatch
    photo_b: PhotoInMatch
    winner_photo_id: Optional[str] = None
    
    class Config:
        from_attributes = True

class WorldcupCreate(BaseModel):
    """월드컵 생성 요청"""
    photo_ids: List[str] = Field(..., min_length=4, max_length=16)
    round_type: int = Field(..., description="4, 8, 또는 16")

class WorldcupResponse(BaseModel):
    """월드컵 응답"""
    id: str
    round_type: int
    status: str
    current_match: Optional[MatchResponse] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

class MatchSelectRequest(BaseModel):
    """매치 선택 요청"""
    selected_photo_id: str

class RankingPhoto(BaseModel):
    """순위별 사진"""
    rank: int
    photo: PhotoInMatch
    
    class Config:
        from_attributes = True

class WorldcupResultResponse(BaseModel):
    """월드컵 결과 응답"""
    worldcup_id: str
    round_type: int
    status: str
    rankings: List[RankingPhoto]
    completed_at: datetime | None
    
    class Config:
        from_attributes = True

class PhotoAnalysis(BaseModel):
    """사진 분석 결과"""
    keywords: list[str]
    emotion: str
    description: str

class WorldcupInsightResponse(BaseModel):
    """월드컵 AI 인사이트 응답"""
    worldcup_id: str
    rankings: List[RankingPhoto]
    overall_keywords: list[str]
    primary_emotion: str
    winner_analysis: PhotoAnalysis
    insight_story: dict  # summary, detail
    
    class Config:
        from_attributes = True

class CardNewsResponse(BaseModel):
    """카드뉴스 응답"""
    worldcup_id: str
    card_images: list[str]  # URL 리스트
    total_cards: int
    created_at: datetime
