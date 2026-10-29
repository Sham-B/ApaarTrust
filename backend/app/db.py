from typing import Generator
from sqlmodel import SQLModel, create_engine, Session
from backend.app.config import settings

# SQLite connection with check_same_thread=False
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)


def init_db() -> None:
    # Ensure models are imported so metadata knows all tables
    import backend.app.models as _models
    _ = _models.__name__
    SQLModel.metadata.create_all(engine)



def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
