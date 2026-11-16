from typing import Optional, Any
from sqlmodel import Field, SQLModel
from datetime import datetime
from pydantic import BeforeValidator
from typing import Annotated


def parse_datetime(v: Any) -> Any:
    if isinstance(v, str):
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00"))
        except ValueError:
            return v
    return v


DatetimeField = Annotated[Optional[datetime], BeforeValidator(parse_datetime)]


class Book(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    original_title: Optional[str] = None
    author: str
    year: Optional[int] = None
    type: str = "Não Técnico"
    priority: str = "1 - Baixa"
    status: str = "A Ler"
    availability: str = "Estante"
    book_class: str = "Desenvolvimento Pessoal"
    category: str = "Geral"
    order: Optional[int] = None
    rating: Optional[int] = None
    google_rating: Optional[float] = None
    date_read: Optional[str] = None
    score: Optional[float] = 0.0
    motivation: Optional[str] = None
    cover_image: Optional[str] = None
    user_id: Optional[str] = Field(default=None, index=True)
    created_at: DatetimeField = Field(default_factory=datetime.utcnow)
    updated_at: DatetimeField = Field(default_factory=datetime.utcnow)
