# app/api/routes/worldcup.py
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.worldcup import Worldcup
from app.models.match import Match
from app.models.photo import Photo
from app.models.share import Share
from app.models.vote import Vote
from app.schemas.worldcup import (
    WorldcupCreate, 
    WorldcupResponse, 
    MatchSelectRequest,
    MatchResponse,
    PhotoInMatch,
    WorldcupResultResponse,
    RankingPhoto,
    WorldcupInsightResponse, 
    PhotoAnalysis,
    CardNewsResponse
)
from app.api.deps import get_current_user
from app.services import worldcup_service, ai_service, cardnews_service, rate_limit_service

from datetime import datetime, timezone
import os

router = APIRouter(prefix="/api/v1/worldcup", tags=["월드컵"])

@router.get("/public")
def get_public_worldcups(
    page: int = 1,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """공개 월드컵 목록 조회 (인증 불필요)"""
    
    # 페이지네이션 계산
    offset = (page - 1) * limit
    
    # 공개된 월드컵 조회 (Share에서 is_public=True인 것들)
    public_shares = db.query(Share)\
        .filter(Share.is_public == True)\
        .order_by(Share.created_at.desc())\
        .offset(offset)\
        .limit(limit)\
        .all()
    
    # 월드컵 정보 수집
    worldcups = []
    for share in public_shares:
        worldcup = share.worldcup
        user = share.user
        
        # 투표 수 계산
        vote_count = db.query(Vote)\
            .filter(Vote.worldcup_id == worldcup.id)\
            .count()
        
        worldcups.append({
            "worldcup_id": worldcup.id,
            "share_id": share.id,
            "username": user.username,
            "round_type": worldcup.round_type,
            "created_at": worldcup.created_at,
            "vote_count": vote_count
        })
    
    # 전체 개수
    total = db.query(Share).filter(Share.is_public == True).count()
    
    return {
        "worldcups": worldcups,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get("/my")
def get_my_worldcups(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내 월드컵 목록 조회"""

    worldcups = db.query(Worldcup)\
        .filter(Worldcup.user_id == current_user.id)\
        .order_by(Worldcup.created_at.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()

    total = db.query(Worldcup)\
        .filter(Worldcup.user_id == current_user.id)\
        .count()

    # 각 월드컵의 우승 사진 정보 포함
    result = []
    for wc in worldcups:
        winner_photo = None
        if wc.winner_photo_id:
            winner_photo = db.query(Photo)\
                .filter(Photo.id == wc.winner_photo_id)\
                .first()

        result.append({
            "id": wc.id,
            "round_type": wc.round_type,
            "status": wc.status,
            "winner_photo": {
                "id": winner_photo.id,
                "url": winner_photo.url
            } if winner_photo else None,
            "created_at": wc.created_at,
            "completed_at": wc.completed_at
        })

    return {
        "worldcups": result,
        "total": total,
        "page": (skip // limit) + 1,
        "pages": (total + limit - 1) // limit
    }

@router.get("/limit")
def get_worldcup_limit(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 생성 제한 조회"""
    
    # 최신 유저 정보 조회
    db.refresh(current_user)
    
    return rate_limit_service.get_remaining_count(current_user)

@router.post("", response_model=WorldcupResponse, status_code=status.HTTP_201_CREATED)
def create_worldcup(
    data: WorldcupCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 생성"""
    
    # 제한 체크
    rate_limit_service.check_worldcup_limit(db, current_user)
    
    # 사진 개수 검증
    if len(data.photo_ids) != data.round_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{data.round_type}강은 {data.round_type}장의 사진이 필요합니다"
        )
    
    # 월드컵 생성
    worldcup = Worldcup(
        user_id=current_user.id,
        round_type=data.round_type
    )
    db.add(worldcup)
    db.commit()
    db.refresh(worldcup)

    # 카운터 증가 (한 번만!)
    rate_limit_service.increment_worldcup_count(db, current_user)
        
    # 토너먼트 브라켓 생성
    worldcup_service.create_tournament_bracket(db, worldcup, data.photo_ids)
    
    # 첫 번째 매치 가져오기
    first_match = worldcup_service.get_next_match(db, worldcup.id)
    
    return WorldcupResponse(
        id=worldcup.id,
        round_type=worldcup.round_type,
        status=worldcup.status,
        current_match=MatchResponse(
            id=first_match.id,
            round_number=first_match.round_number,
            match_order=first_match.match_order,
            photo_a=PhotoInMatch(id=first_match.photo_a.id, url=first_match.photo_a.url),
            photo_b=PhotoInMatch(id=first_match.photo_b.id, url=first_match.photo_b.url),
            winner_photo_id=None
        ) if first_match else None,
        created_at=worldcup.created_at
    )

@router.post("/{worldcup_id}/matches/{match_id}/select")
def select_winner(
    worldcup_id: str,
    match_id: str,
    data: MatchSelectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """매치 승자 선택"""
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 권한 체크
    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )
    
    # 매치 조회
    match = db.query(Match).filter(Match.id == match_id).first()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="매치를 찾을 수 없습니다"
        )
    
    # 이미 선택했는지 확인
    if match.winner_photo_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 선택한 매치입니다"
        )
    
    # 승자가 이 매치의 사진 중 하나인지 확인
    if data.selected_photo_id not in [match.photo_a_id, match.photo_b_id]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 사진입니다"
        )
    
    # 승자 저장
    match.winner_photo_id = data.selected_photo_id
    db.commit()
    
    # 다음 라운드 진행
    worldcup_service.advance_to_next_round(db, worldcup)
    
    # 월드컵 완료되면 AI 분석 자동 실행
    if worldcup.status == "completed":
        try:
            print("===== 월드컵 완료! AI 분석 시작 =====")
            
            # 순위 계산
            rankings_data = worldcup_service.get_worldcup_rankings(db, worldcup_id)
            
            # AI 분석
            photo_paths = [item["photo"].file_path for item in rankings_data]
            batch_analysis = ai_service.analyze_multiple_photos(photo_paths)
            winner_analysis = ai_service.analyze_photo_from_path(rankings_data[0]["photo"].file_path)
            insight_story = ai_service.generate_insight_story(batch_analysis, winner_analysis)
            
            # 결과 저장
            worldcup.analysis_result = {
                "overall_keywords": batch_analysis["overall_keywords"],
                "primary_emotion": batch_analysis["primary_emotion"],
                "insight_story": insight_story
            }
            db.commit()
            print("===== AI 분석 완료 및 저장 =====")
            
        except Exception as e:
            print(f"===== AI 분석 실패 (백그라운드): {e} =====")
            # AI 분석 실패해도 월드컵 완료는 정상 처리
            # 나중에 조회 시 실시간 분석으로 재시도
            db.rollback()  # 분석 결과 저장 실패 시 롤백
    
    # 다음 매치 가져오기
    next_match = worldcup_service.get_next_match(db, worldcup_id)
    
    return {
        "is_completed": worldcup.status == "completed",
        "winner_photo_id": worldcup.winner_photo_id,
        "next_match": MatchResponse(
            id=next_match.id,
            round_number=next_match.round_number,
            match_order=next_match.match_order,
            photo_a=PhotoInMatch(id=next_match.photo_a.id, url=next_match.photo_a.url),
            photo_b=PhotoInMatch(id=next_match.photo_b.id, url=next_match.photo_b.url),
            winner_photo_id=None
        ) if next_match else None
    }

@router.get("/{worldcup_id}/result", response_model=WorldcupResultResponse)
def get_worldcup_result(
    worldcup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 결과 조회"""
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 권한 체크
    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )
    
    # 완료 여부 확인
    if worldcup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="아직 진행 중인 월드컵입니다"
        )
    
    # 순위 계산
    rankings_data = worldcup_service.get_worldcup_rankings(db, worldcup_id)
    
    rankings = [
        RankingPhoto(
            rank=item["rank"],
            photo=PhotoInMatch(
                id=item["photo"].id,
                url=item["photo"].url
            )
        )
        for item in rankings_data
    ]
    
    return WorldcupResultResponse(
        worldcup_id=worldcup.id,
        round_type=worldcup.round_type,
        status=worldcup.status,
        rankings=rankings,
        completed_at=worldcup.completed_at
    )

@router.get("/{worldcup_id}/insights", response_model=WorldcupInsightResponse)
def get_worldcup_insights(
    worldcup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 AI 인사이트 조회"""
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 권한 체크
    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )
    
    # 완료 여부 확인
    if worldcup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="아직 진행 중인 월드컵입니다"
        )
    
    # 순위 계산
    rankings_data = worldcup_service.get_worldcup_rankings(db, worldcup_id)
    rankings = [
        RankingPhoto(
            rank=item["rank"],
            photo=PhotoInMatch(
                id=item["photo"].id,
                url=item["photo"].url
            )
        )
        for item in rankings_data
    ]
    
    # 캐시된 분석 결과 확인
    if worldcup.analysis_result:
        # 캐시 사용 (빠름!)
        print("캐시된 분석 결과 사용")
        analysis_data = worldcup.analysis_result
        overall_keywords = analysis_data["overall_keywords"]
        primary_emotion = analysis_data["primary_emotion"]
        insight_story = analysis_data["insight_story"]
        
        # 1위 사진 분석 (캐시에 없으면 실시간)
        winner_analysis_result = ai_service.analyze_photo_from_path(rankings_data[0]["photo"].file_path)
    else:
        # 실시간 분석 (느림, 첫 조회만)
        print("실시간 AI 분석 실행")
        photo_paths = [item["photo"].file_path for item in rankings_data]
        batch_analysis = ai_service.analyze_multiple_photos(photo_paths)
        winner_analysis_result = ai_service.analyze_photo_from_path(rankings_data[0]["photo"].file_path)
        insight_story = ai_service.generate_insight_story(batch_analysis, winner_analysis_result)
        
        overall_keywords = batch_analysis["overall_keywords"]
        primary_emotion = batch_analysis["primary_emotion"]
        
        # 결과 저장
        worldcup.analysis_result = {
            "overall_keywords": overall_keywords,
            "primary_emotion": primary_emotion,
            "insight_story": insight_story
        }
        db.commit()
    
    return WorldcupInsightResponse(
        worldcup_id=worldcup.id,
        rankings=rankings,
        overall_keywords=overall_keywords,
        primary_emotion=primary_emotion,
        winner_analysis=PhotoAnalysis(
            keywords=winner_analysis_result["keywords"],
            emotion=winner_analysis_result["emotion"],
            description=winner_analysis_result["description"]
        ),
        insight_story=insight_story
    )
  

@router.post("/{worldcup_id}/cardnews", response_model=CardNewsResponse)

@router.post("/{worldcup_id}/cardnews", response_model=CardNewsResponse)
def generate_cardnews(
    worldcup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """카드뉴스 생성"""
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 권한 체크
    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )
    
    # 완료 여부 확인
    if worldcup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="아직 진행 중인 월드컵입니다"
        )
    
    # 순위 계산
    rankings_data = worldcup_service.get_worldcup_rankings(db, worldcup_id)
    
    # AI 캐시 재사용
    if worldcup.analysis_result:
        print("===== 캐시된 AI 분석 결과 사용 (빠름!) =====")
        overall_keywords = worldcup.analysis_result["overall_keywords"]
        insight_story = worldcup.analysis_result["insight_story"]
        
        # 개별 사진 분석 (캐싱 적용!)
        rankings_for_card = []
        for item in rankings_data[:3]:
            photo_analysis = ai_service.analyze_photo_from_path(
                item["photo"].file_path,
                photo_id=item["photo"].id,  # photo_id 전달
                db=db  # db 전달
            )
            rankings_for_card.append({
                "rank": item["rank"],
                "photo_path": item["photo"].file_path,
                "keywords": photo_analysis["keywords"]
            })
    else:
        print("===== 새로운 AI 분석 실행 (느림) =====")
        photo_paths = [item["photo"].file_path for item in rankings_data]
        batch_analysis = ai_service.analyze_multiple_photos(photo_paths)
        winner_analysis = ai_service.analyze_photo_from_path(
            rankings_data[0]["photo"].file_path,
            photo_id=rankings_data[0]["photo"].id,
            db=db
        )
        insight_story = ai_service.generate_insight_story(batch_analysis, winner_analysis)
        overall_keywords = batch_analysis["overall_keywords"]
        
        # 개별 사진 분석 (캐싱 적용!)
        rankings_for_card = []
        for item in rankings_data[:3]:
            photo_analysis = ai_service.analyze_photo_from_path(
                item["photo"].file_path,
                photo_id=item["photo"].id,
                db=db
            )
            rankings_for_card.append({
                "rank": item["rank"],
                "photo_path": item["photo"].file_path,
                "keywords": photo_analysis["keywords"]
            })
        
        # 캐시 저장
        worldcup.analysis_result = {
            "overall_keywords": overall_keywords,
            "primary_emotion": batch_analysis["primary_emotion"],
            "insight_story": insight_story
        }
        db.commit()
    
    # 카드뉴스 생성
    card_paths = cardnews_service.generate_cardnews(
        insight_story=insight_story,
        overall_keywords=overall_keywords,
        rankings=rankings_for_card,
        is_premium=current_user.is_premium
    )
    
    # URL로 변환
    card_urls = [f"/uploads/cardnews/{os.path.basename(path)}" for path in card_paths]
    
    return CardNewsResponse(
        worldcup_id=worldcup_id,
        card_images=card_urls,
        total_cards=len(card_urls),
        created_at=datetime.now(timezone.utc)
    )

@router.post("/{worldcup_id}/vote")
def vote_worldcup(
    worldcup_id: str,
    rankings: list[dict] = Body(...),  # Body로 감싸기
    request: Request = None,
    db: Session = Depends(get_db)
):
    """월드컵 투표 (인증 선택)"""
    
    # current_user 제거 (선택적 인증 복잡해서 일단 빼기)
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 완료된 월드컵만 투표 가능
    if worldcup.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="완료된 월드컵만 투표 가능합니다"
        )
    
    # IP 주소 가져오기
    ip_address = request.client.host if request else "unknown"
    
    # 중복 투표 체크
    existing_vote = db.query(Vote)\
        .filter(Vote.worldcup_id == worldcup_id, Vote.ip_address == ip_address)\
        .first()
    
    if existing_vote:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 투표한 월드컵입니다"
        )
    
    # 투표 저장
    vote = Vote(
        worldcup_id=worldcup_id,
        user_id=None,  # 일단 익명만
        ip_address=ip_address,
        rankings=rankings
    )
    db.add(vote)
    db.commit()
    
    # 원본 결과 가져오기
    original_rankings = worldcup_service.get_worldcup_rankings(db, worldcup_id)
    
    # 비교 분석
    match_count = 0
    for original in original_rankings[:3]:
        for vote_rank in rankings:
            if vote_rank["photo_id"] == original["photo"].id and vote_rank["rank"] == original["rank"]:
                match_count += 1
                break
    
    match_percentage = (match_count / 3) * 100 if len(rankings) >= 3 else 0
    
    return {
        "message": "투표 완료",
        "my_rankings": rankings,
        "original_rankings": [
            {
                "rank": item["rank"],
                "photo_id": item["photo"].id
            }
            for item in original_rankings[:3]
        ],
        "match_percentage": round(match_percentage, 1)
    }

@router.get("/{worldcup_id}/votes/stats")
def get_vote_stats(
    worldcup_id: str,
    db: Session = Depends(get_db)
):
    """월드컵 투표 통계 조회"""
    
    # 월드컵 조회
    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )
    
    # 모든 투표 가져오기
    votes = db.query(Vote).filter(Vote.worldcup_id == worldcup_id).all()
    
    if not votes:
        return {
            "total_votes": 0,
            "photo_stats": []
        }
    
    # 사진별 순위 통계
    photo_stats = {}
    
    for vote in votes:
        for ranking in vote.rankings:
            photo_id = ranking["photo_id"]
            rank = ranking["rank"]
            
            if photo_id not in photo_stats:
                photo_stats[photo_id] = {
                    "photo_id": photo_id,
                    "rank_1_count": 0,
                    "rank_2_count": 0,
                    "rank_3_count": 0,
                    "rank_4_count": 0
                }
            
            if rank == 1:
                photo_stats[photo_id]["rank_1_count"] += 1
            elif rank == 2:
                photo_stats[photo_id]["rank_2_count"] += 1
            elif rank == 3:
                photo_stats[photo_id]["rank_3_count"] += 1
            elif rank == 4:
                photo_stats[photo_id]["rank_4_count"] += 1
    
    return {
        "total_votes": len(votes),
        "photo_stats": list(photo_stats.values())
    }


@router.get("/{worldcup_id}")
def get_worldcup(
    worldcup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 상세 조회 (진행중 월드컵 재개용)"""

    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )

    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )

    # 현재 진행중인 매치 가져오기
    current_match = worldcup_service.get_next_match(db, worldcup_id)

    return WorldcupResponse(
        id=worldcup.id,
        round_type=worldcup.round_type,
        status=worldcup.status,
        current_match=MatchResponse(
            id=current_match.id,
            round_number=current_match.round_number,
            match_order=current_match.match_order,
            photo_a=PhotoInMatch(id=current_match.photo_a.id, url=current_match.photo_a.url),
            photo_b=PhotoInMatch(id=current_match.photo_b.id, url=current_match.photo_b.url),
            winner_photo_id=None
        ) if current_match else None,
        created_at=worldcup.created_at
    )

@router.delete("/{worldcup_id}")
def delete_worldcup(
    worldcup_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """월드컵 삭제"""

    worldcup = db.query(Worldcup).filter(Worldcup.id == worldcup_id).first()
    if not worldcup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="월드컵을 찾을 수 없습니다"
        )

    if worldcup.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="권한이 없습니다"
        )

    # 관련 매치들 삭제
    db.query(Match).filter(Match.worldcup_id == worldcup_id).delete()

    # 월드컵 삭제
    db.delete(worldcup)
    db.commit()

    return {"message": "삭제되었습니다"}
