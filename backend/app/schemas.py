from pydantic import BaseModel, Field


class FlowOut(BaseModel):
    id: str
    name: str
    slug: str
    created_at: str
    updated_at: str


class FlowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class FlowUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

