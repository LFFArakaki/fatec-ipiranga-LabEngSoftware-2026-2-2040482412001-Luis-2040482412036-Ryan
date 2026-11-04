from sqlmodel import JSON, Field, SQLModel, Column
from typing import Optional, Dict, Any

class UsuarioVisivel(SQLModel):
    nome_usuario: str = Field(index=True, unique=True)
    nome: str = Field(index=True)
    data_nascimento: str = Field(index=True)
    email: str = Field(index=True, unique=True)

class Usuario(UsuarioVisivel, table=True):
    cod: int = Field(primary_key=True)
    senha: str = Field

class Conta(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    cod_usuario: int = Field(index=True, foreign_key="usuario.cod")
    aplicativo: str = Field(index=True)
    usuario_app: str = Field(index=True)
    sessao: str = Field(index=True)

class Conversa(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    cod_usuario: int = Field(index=True, foreign_key="usuario.cod")
    app: str = Field(index=True)
    chat_id: str = Field(index=True)
    nome_chat: str = Field(index=True)

class ConversaSignal(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    cod_usuario: int = Field(index=True, foreign_key="usuario.cod")
    cod_conversa: int = Field(index=True, foreign_key="conversa.cod")
    internal_id: str = Field(index=True)
    log: dict = Field(default_factory=dict, sa_column=Column(JSON))