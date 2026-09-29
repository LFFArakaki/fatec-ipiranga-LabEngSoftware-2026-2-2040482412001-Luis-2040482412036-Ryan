from fastapi import Depends, FastAPI, HTTPException, Query, Response, Cookie, BackgroundTasks, status
from fastapi.responses import JSONResponse
from sqlmodel import Session, SQLModel, create_engine, select
from typing import Annotated
from models import Usuario, Conta, ConectarTG, SessaoTG, EsqueciSenha, RedefinirSenha
from telethon import TelegramClient
from telethon.sessions import StringSession
from fastapi_mail import FastMail, MessageSchema, MessageType, ConnectionConfig
from jose import jwt
import os
import dotenv
import utils

dotenv.load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = os.getenv('ALGORITHM')
logins_tg = {}

conf = ConnectionConfig(
    MAIL_SERVER="smtp.gmail.com",
    MAIL_PORT=587,
    MAIL_USERNAME=''.join(os.getenv('MAIL_USERNAME')),
    MAIL_PASSWORD=''.join(os.getenv('MAIL_PASSWORD')),
    MAIL_FROM=''.join(os.getenv('MAIL_FROM')),
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
)

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
def realizar_login(dados: Usuario, session: SessionDep, response: Response):
    statement = select(Usuario).where(Usuario.email == dados.email)
    usuario = session.exec(statement).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    if dados.senha == usuario.senha:
        token = jwt.encode({"user_id": usuario.cod}, SECRET_KEY, algorithm=ALGORITHM)
        response.set_cookie(key="access_token", value=token, httponly=True)
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
async def sign_in(payload: SessaoTG, session: SessionDep, access_token: Annotated[str | None, Cookie()] = None):
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

        decode_token = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")

        conta = Conta(
            cod_usuario=user_id,
            aplicativo="Telegram",
            usuario_app=telefone,
            sessao=client.session.save()
        )

        session.add(conta)
        session.commit()
        session.refresh(conta)

        return "Autenticação concluída com sucesso!"
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro na autenticação: {str(e)}")

@app.post("/auth/esqueci-senha")
async def redefinir_senha(dados: EsqueciSenha, session: SessionDep, background_tasks: BackgroundTasks):
    try:
        statement = select(Usuario).where(Usuario.email == dados.email)
        usuario = session.exec(statement).first()
        if not usuario:
            raise HTTPException(status_code=404, detail="User not found")
        else:
            token = utils.create_reset_password_token(dados.email)
            url = f"Aqui está o link para redefinir sua senha: http://localhost:5173/redefinir-senha?token={token}"
            message = MessageSchema(
                subject="Password Reset Instructions",
                recipients=[dados.email],
                body=url,
                subtype="html"
            )
            template_name = "mail/password_reset.html"

            fm = FastMail(conf)
            background_tasks.add_task(fm.send_message, message)

            return "Certo! Verifique seu e-mail para redefinir sua senha."
    except Exception as e:
        return "Erro ao enviar e-mail de redefinição de senha: {str(e)}"

@app.post("/auth/redefinir-senha")
async def redefinir_senha(dados: RedefinirSenha, session: SessionDep):
    try:
        usuario_email = jwt.decode(dados.token, SECRET_KEY, algorithms=[ALGORITHM]).get("email")
        statement = select(Usuario).where(Usuario.email == usuario_email)
        usuario = session.exec(statement).first()
        if not usuario:
            raise HTTPException(status_code=404, detail="User not found")
        else:
            usuario.senha = dados.nova_senha
            session.add(usuario)
            session.commit()
            session.refresh(usuario)
            return "Senha redefinida com sucesso!"
    except Exception as e:
        return "Erro ao redefinir senha: {str(e)}"