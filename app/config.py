# app/config.py
from pydantic_settings import BaseSettings
from pydantic import field_validator

class Settings(BaseSettings):
    """환경변수 설정"""
    
    # API 기본 설정
    app_name: str = "MyCup API"
    debug: bool = True
    
    # Database
    database_url: str
    
    # JWT
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # OpenAI API
    openai_api_key: str = ""
    
    @field_validator('secret_key')
    def validate_secret_key(cls, v):
        if len(v) < 32:
            raise ValueError('SECRET_KEY는 최소 32자 이상이어야 합니다')
        return v
    
    class Config:
        env_file = ".env"
        extra = "allow"
        case_sensitive = False

# 싱글톤 인스턴스
settings = Settings()
