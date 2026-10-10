from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class ColumnMetadata(BaseModel):
    name: str
    data_type: str
    is_nullable: bool = True
    is_primary_key: bool = False
    default_value: Optional[str] = None
    comment: Optional[str] = None
    sample_values: List[Any] = Field(default_factory=list)


class ForeignKeyMetadata(BaseModel):
    constrained_column: str
    referred_table: str
    referred_column: str


class TableMetadata(BaseModel):
    name: str
    columns: List[ColumnMetadata] = Field(default_factory=list)
    primary_keys: List[str] = Field(default_factory=list)
    foreign_keys: List[ForeignKeyMetadata] = Field(default_factory=list)
    row_count: Optional[int] = None
    comment: Optional[str] = None

    def get_column(self, col_name: str) -> Optional[ColumnMetadata]:
        for col in self.columns:
            if col.name.lower() == col_name.lower():
                return col
        return None


class DatabaseSchema(BaseModel):
    database_name: str
    dialect: str  # sqlite, postgres, mysql, etc.
    tables: Dict[str, TableMetadata] = Field(default_factory=dict)
    
    def get_table(self, tbl_name: str) -> Optional[TableMetadata]:
        for name, meta in self.tables.items():
            if name.lower() == tbl_name.lower():
                return meta
        return None

    def to_prompt_context(self, include_samples: bool = True, max_samples: int = 3) -> str:
        """
        Formats the schema into a compact, highly descriptive markdown representation
        optimized for LLM schema grounding and token efficiency.
        """
        lines = [f"### Database: `{self.database_name}` (Dialect: {self.dialect.upper()})\n"]
        
        for table_name, table in self.tables.items():
            lines.append(f"#### Table: `{table_name}`" + (f" (~{table.row_count} rows)" if table.row_count is not None else ""))
            if table.comment:
                lines.append(f"*{table.comment}*")
            
            lines.append("Columns:")
            for col in table.columns:
                pk_tag = " [PK]" if col.is_primary_key else ""
                fk_tag = ""
                for fk in table.foreign_keys:
                    if fk.constrained_column.lower() == col.name.lower():
                        fk_tag = f" [FK -> {fk.referred_table}.{fk.referred_column}]"
                
                samples_str = ""
                if include_samples and col.sample_values:
                    # Filter out sensitive or huge strings
                    safe_samples = [str(s) for s in col.sample_values[:max_samples] if s is not None]
                    if safe_samples:
                        samples_str = f" | Examples: [{', '.join(safe_samples)}]"

                lines.append(f"- `{col.name}` ({col.data_type}{pk_tag}{fk_tag}){samples_str}")
            
            lines.append("")  # Blank line between tables

        return "\n".join(lines)
