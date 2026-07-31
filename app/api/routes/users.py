# app/api/routes/users.py
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.photo import Photo
from app.models.user import User
from app.models.worldcup import Worldcup
from app.services import rate_limit_service

router = APIRouter(prefix="/api/v1/users", tags=["유저"])


class ProfileUpdate(BaseModel):
    username: Optional[str] = None


@router.get("/me")
def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내 프로필 조회"""

    # 통계 계산
    total_worldcups = db.query(Worldcup).filter(Worldcup.user_id == current_user.id).count()
    total_photos = db.query(Photo).filter(Photo.user_id == current_user.id).count()
    limit_info = rate_limit_service.get_remaining_count(current_user)

    return {
        "id": str(current_user.id),
        "email": current_user.email,
        "username": current_user.username,
        "profile_image": current_user.profile_image,
        "tier": "premium" if current_user.is_premium else "free",
        "provider": current_user.provider,
        "created_at": current_user.created_at.isoformat(),
        "stats": {
            "total_worldcups": total_worldcups,
            "total_photos": total_photos,
            "worldcup_limit": limit_info
        }
    }

@router.patch("/me")
def update_profile(
    update_data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """프로필 수정"""

    if update_data.username:
        # 중복 체크
        existing = db.query(User).filter(
            User.username == update_data.username,
            User.id != current_user.id
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 사용중인 사용자명입니다"
            )

        current_user.username = update_data.username

    db.commit()
    db.refresh(current_user)

    return {
        "message": "프로필 수정 완료",
        "username": current_user.username
    }
