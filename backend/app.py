from fastapi import Depends, FastAPI, HTTPException, Query
from sqlmodel import Session, SQLModel, create_engine, select
from typing import Annotated
from contextlib import asynccontextmanager
from models import Usuario, Conta, ConectarTG, SessaoTG
from telethon import TelegramClient, events
from telethon.sessions import StringSession
import os
import dotenv

dotenv.load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')

logins_tg = {}

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

@app.post("/auth/tg/codigo")
async def send_code(payload: ConectarTG, session: SessionDep):
    telefone = payload.numero.strip()

    statement = select(Conta).where(Conta.usuario_app == telefone, Conta.aplicativo == "Telegram")
    conta = session.exec(statement).first()
    print(conta)
    if conta:
        client = TelegramClient(StringSession(conta.sessao), API_ID, API_HASH)
        await client.connect()
        raise HTTPException(status_code=400, detail="Conta já cadastrada para este usuário.")
    else:
        client = TelegramClient(StringSession(), API_ID, API_HASH)
        await client.connect()
        
        try:
            send_code_result = await client.send_code_request(telefone)
            
            logins_tg[telefone] = {
                "client": client,
                "phone_code_hash": send_code_result.phone_code_hash
            }
            
            return {
                "status": "code_sent",
                "message": "Código de verificação enviado pelo Telegram. Prossiga para o endpoint de sign-in."
            }
            
        except Exception as e:
            await client.disconnect()
            if telefone in logins_tg:
                del logins_tg[telefone]
            raise HTTPException(status_code=400, detail=f"Erro ao enviar código: {str(e)}")


@app.post("/auth/tg/sign-in")
async def sign_in(payload: SessaoTG, session: SessionDep):
    telefone = payload.numero.strip()
    
    if telefone not in logins_tg:
        raise HTTPException(
            status_code=400, 
            detail="Nenhuma sessão de login ativa encontrada para este número. Chame /send-code primeiro."
        )
        
    login_data = logins_tg[telefone]
    client = login_data["client"]
    phone_code_hash = login_data["phone_code_hash"]
    
    try:
        await client.sign_in(
            phone=telefone,
            code=payload.codigo.strip(),
            phone_code_hash=phone_code_hash
        )
        
        del logins_tg[telefone]

        conta = Conta(
            cod_usuario=1,
            aplicativo="Telegram",
            usuario_app=telefone,
            sessao=client.session.save()
        )

        session.add(conta)
        session.commit()
        session.refresh(conta)

        await client.disconnect()
        return "Autenticação concluída com sucesso!"
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na autenticação: {str(e)}")
        