from sqlmodel import Field, SQLModel

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
    cod_usuario: int = Field(index=True)
    aplicativo: str = Field(index=True)
    usuario_app: str = Field(index=True)
    sessao: str = Field(index=True)