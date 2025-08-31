from dataclasses import dataclass


@dataclass
class Flow:
    id: str
    name: str
    slug: str
    created_at: str
    updated_at: str

