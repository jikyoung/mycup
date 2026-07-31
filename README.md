# MyCup

사진을 업로드해 토너먼트를 진행하고, 선택 결과를 AI 인사이트와 카드뉴스로
확인하는 개인 모바일 프로젝트입니다.

React Native·TypeScript 클라이언트와 FastAPI 백엔드를 하나의 저장소에서
관리합니다.

## 주요 흐름

1. 사용자가 로그인하고 사진을 선택합니다.
2. FastAPI가 사진을 저장하고 월드컵 대진을 생성합니다.
3. React Native 앱에서 사진을 선택하며 토너먼트를 진행합니다.
4. 완료된 결과를 OpenAI 기반 인사이트와 카드뉴스로 확인합니다.
5. 결과를 다시 조회하거나 공유할 수 있습니다.

## 구현 기능

- 이메일 로그인·회원가입 및 Google·Kakao OAuth
- JWT 기반 인증과 Axios 요청 인터셉터
- 다중 이미지 선택·업로드와 파일 검증
- 4강·8강·16강 월드컵 토너먼트
- 진행 중인 월드컵 재개와 완료 결과 조회
- OpenAI Vision 기반 사진 분석과 결과 캐싱
- AI 인사이트·카드뉴스 생성 및 공유
- 사용자별 생성 횟수 제한
- 구조화 로그와 파일 업로드 보안 검증

## 기술 스택

### Mobile

- React Native 0.81
- TypeScript 5.9
- Expo 54
- Axios
- TanStack Query
- AsyncStorage

### Backend

- Python 3.12
- FastAPI
- PostgreSQL
- SQLAlchemy·Alembic
- OpenAI API
- JWT·OAuth2

## 프로젝트 구조

```text
mycup/
├── app/                 # FastAPI 라우터·서비스·모델
├── alembic/             # 데이터베이스 마이그레이션
├── frontend/            # React Native·TypeScript 앱
├── main.py              # FastAPI 애플리케이션 진입점
└── pyproject.toml
```

## 로컬 실행

### 1. 백엔드

```bash
uv sync
cp .env.example .env
uv run alembic upgrade head
uv run uvicorn main:app --reload
```

`.env`에는 PostgreSQL 연결 정보, 32자 이상의 JWT 비밀키와 필요한 외부
API 키를 설정합니다. 전체 항목은 `.env.example`에서 확인할 수 있습니다.

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 2. 모바일 앱

```bash
cd frontend
npm install
cp .env.example .env
npm run start
```

실기기에서 테스트할 때는 `frontend/.env`의 `EXPO_PUBLIC_API_URL`을
개발 머신의 접근 가능한 주소로 변경합니다.

## 검증

```bash
# Frontend
cd frontend
npm run typecheck

# Backend
uv run python -m compileall -q app main.py
```

## 프로젝트 상태

인증, 이미지 업로드, 토너먼트, AI 분석과 결과 화면을 하나의 모바일 앱
흐름으로 연결한 개인 프로젝트입니다.
