from sqlmodel import Field, SQLModel
from pydantic import BaseModel

class Usuario(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    nome_usuario: str = Field(index=True, unique=True)
    nome: str = Field(index=True)
    data_nascimento: str = Field(index=True)
    email: str = Field(index=True, unique=True)
    senha: str = Field

class Conta(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    cod_usuario: int = Field(index=True)
    aplicativo: str = Field(index=True)
    usuario_app: str = Field(index=True)
    sessao: str = Field(index=True)

class ConectarTG(BaseModel):
    numero: str

class SessaoTG(BaseModel):
    numero: str
    codigo: str