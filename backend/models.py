from sqlmodel import Field, SQLModel

class Usuario(SQLModel, table=True):
    cod: int = Field(primary_key=True)
    nome_usuario: str = Field(index=True, unique=True)
    nome: str = Field(index=True)
    data_nascimento: str = Field(index=True)
    email: str = Field(index=True, unique=True)
    senha: str = Field