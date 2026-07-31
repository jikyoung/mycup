# app/schemas/photo.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class PhotoResponse(BaseModel):
    """사진 응답"""
    id: str
    url: str
    thumbnail_url: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PhotoUploadResponse(BaseModel):
    """사진 업로드 응답"""
    photos: list[PhotoResponse]
    total: int
