# main.py
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.api.routes import auth, photos, worldcup, share, users
from app.core.logging_middleware import log_requests
from app.core.logger import logger
from starlette.middleware.sessions import SessionMiddleware


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug
)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.secret_key  # JWT secret 재사용
)

# ===== 로깅 미들웨어 추가 =====
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    return await log_requests(request, call_next)
# ==========================================

# 요청 크기 제한 미들웨어
MAX_REQUEST_SIZE = 320 * 1024 * 1024

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    """요청 크기 제한"""
    if request.method in ["POST", "PUT", "PATCH"]:
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_REQUEST_SIZE:
            return JSONResponse(
                status_code=413,
                content={"detail": f"요청 크기가 너무 큽니다. 최대: {MAX_REQUEST_SIZE // 1024 // 1024}MB"}
            )
    return await call_next(request)

# CORS 설정
origins = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8081",
    "https://mycup.app",
    "https://www.mycup.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(auth.router)
app.include_router(photos.router)
app.include_router(worldcup.router)
app.include_router(share.router)
app.include_router(users.router)

# 정적 파일 서빙
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ===== 시작 로그 추가 =====
@app.on_event("startup")
async def startup_event():
    logger.info("MyCup API 서버 시작")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("MyCup API 서버 종료")
# ==========================

@app.get("/health")
def health_check():
    """헬스체크"""
    return {
        "status": "healthy",
        "service": settings.app_name
    }
