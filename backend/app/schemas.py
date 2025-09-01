from pydantic import BaseModel, Field
from typing import Any, Dict, Optional, List


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


class FlowStateOut(BaseModel):
    flow_id: str
    data: Dict[str, Any]
    updated_at: str


class FlowStateIn(BaseModel):
    data: Dict[str, Any]


# ---- Flow Schemas (Custom Schemas) ----

class SchemaFieldModel(BaseModel):
    id: str
    name: str
    type: str
    description: Optional[str] = None
    required: bool
    arrayItemType: Optional[str] = None
    arrayItemSchemaId: Optional[str] = None
    objectSchemaId: Optional[str] = None


class FlowSchemaIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    fields: List[SchemaFieldModel]


class FlowSchemaOut(FlowSchemaIn):
    id: str
    flow_id: str
    created_at: str
    updated_at: str


# ---- Execution ----

class RunField(BaseModel):
    name: str
    type: str
    description: str | None = None


class NodeRunIn(BaseModel):
    node_kind: str
    node_title: str | None = None
    node_description: str | None = None
    inputs_schema: list[RunField]
    outputs_schema: list[RunField]
    inputs_values: dict
    model: str | None = None
    lm_params: dict | None = None


class NodeRunOut(BaseModel):
    outputs: dict | None = None
    reasoning: str | None = None
    error: str | None = None
