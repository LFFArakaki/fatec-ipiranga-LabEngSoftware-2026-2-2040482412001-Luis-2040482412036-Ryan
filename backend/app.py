from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Session, SQLModel, create_engine, select
from typing import Annotated
from contextlib import asynccontextmanager
from models import Usuario

async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield
    
app = FastAPI(lifespan=lifespan)

sqlite_file_name = "users.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
connect_args = {"check_same_thread": False}
engine = create_engine(sqlite_url, connect_args=connect_args)
 
def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
def get_session():
    with Session(engine) as session:
        yield session
SessionDep = Annotated[Session, Depends(get_session)]
 
 
@app.post("/cadastrar/")
def cadastrar_usuario(usuario: Usuario, session: SessionDep) -> Usuario:
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario
 
@app.get("/listar/usuarios/")
def listar_usuarios(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
) -> list[Usuario]:
    usuarios = session.exec(select(Usuario).offset(offset).limit(limit)).all()
    return usuarios
 
@app.get("/listar/usuarios/{cod_usuario}")
def buscar_usuario(cod_usuario: int, session: SessionDep) -> Usuario:
    usuario = session.get(Usuario, cod_usuario)
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    return usuario
 
@app.delete("/excluir/usuarios/{cod_usuario}")
def deletar_usuario(cod_usuario: int, session: SessionDep):
    usuario = session.get(Usuario, cod_usuario)
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    session.delete(usuario)
    session.commit()
    return {"ok": True}

@app.patch("/atualizar/usuarios/{cod_usuario}")
def editar_usuario(cod_usuario: int, session: SessionDep, usuario_novo: Usuario):
    usuario = session.get(Usuario, cod_usuario)
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    dados_usuario = usuario_novo.model_dump(exclude_unset=True)
    usuario.sqlmodel_update(dados_usuario)
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario

@app.post("/login/")
def realizar_login(dados: Usuario, session: SessionDep):
    statement = select(Usuario).where(Usuario.email == dados.email)
    usuario = session.exec(statement).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    if dados.senha == usuario.senha:
        return usuario.cod
    else:
        return "Senha errada"