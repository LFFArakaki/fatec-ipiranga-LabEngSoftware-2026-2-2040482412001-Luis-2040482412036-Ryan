from xmlrpc import client

from fastapi import Depends, FastAPI, HTTPException, Query, Response, Cookie, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, SQLModel, create_engine, select
from typing import Annotated
from models_payload import ConectarTG, DeletarMensagem, EditarMensagem, EnviarMensagem, SessaoTG, EsqueciSenha, RedefinirSenha, VisualizarMensagem
from models_db import Conversa, Usuario, Conta, UsuarioVisivel
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import Chat, Channel, User
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from jose import jwt
from datetime import datetime, timezone
from datetime import timedelta
import bcrypt
import os
import dotenv
import utils

dotenv.load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = os.getenv('ALGORITHM')
logins_tg = {}
clients_tg = {}

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

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login/")

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
def cadastrar_usuario(usuario: Usuario, session: SessionDep) -> UsuarioVisivel:
    usuario.senha = bcrypt.hashpw(usuario.senha.encode(), bcrypt.gensalt())
    session.add(usuario)
    session.commit()
    session.refresh(usuario)
    return usuario
 
@app.get("/listar/usuarios/")
def listar_usuarios(
    session: SessionDep,
    offset: int = 0,
    limit: Annotated[int, Query(le=100)] = 100,
) -> list[UsuarioVisivel]:
    usuarios = session.exec(select(Usuario).offset(offset).limit(limit)).all()
    return usuarios
 
@app.get("/listar/usuarios/{username}")
def buscar_usuario(username: str, session: SessionDep) -> UsuarioVisivel:
    statement = select(Usuario).where(Usuario.username == username)
    usuario = session.exec(statement).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    return usuario
 
@app.delete("/excluir/")
def deletar_usuario(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
        
    usuario = session.get(Usuario, user_id)
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
async def realizar_login(dados: Annotated[OAuth2PasswordRequestForm, Depends()], session: SessionDep, response: Response):
    statement = select(Usuario).where(Usuario.email == dados.username)
    usuario = session.exec(statement).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="User not found")
    if bcrypt.checkpw(dados.password.encode(), usuario.senha):
        token_data = {"user_id": usuario.cod, "exp": datetime.now(timezone.utc) + timedelta(minutes=60)}
        token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        statement = select(Conta).where(Conta.cod_usuario == usuario.cod)
        contas = session.exec(statement).all()
        for conta in contas:
            if conta.aplicativo.lower() == "telegram":
                clients_tg[usuario.cod] = TelegramClient(StringSession(conta.sessao), API_ID, API_HASH)
                await clients_tg[usuario.cod].connect()
        return {"access_token": token, "token_type": "bearer"}
    else:
        raise HTTPException(status_code=400, detail="Senha errada")

@app.get("/perfil/")
async def obter_perfil(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    statement = select(Usuario).where(Usuario.cod == user_id)
    usuario = session.exec(statement).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    return usuario

@app.get("/perfil/conversas/")
def listar_conversas(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    statement = select(Conversa).where(Conversa.cod_usuario == user_id)
    conversas = session.exec(statement).all()
    return conversas

@app.get("/perfil/conversas/{chat_id}")
async def buscar_conversa(chat_id: int, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    messages = []

    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    statement = select(Usuario).where(Usuario.cod == user_id)
    usuario = session.exec(statement).first()
    statement = select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == chat_id)
    conversa = session.exec(statement).first()

    if not conversa:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")

    if conversa.app.lower() == "telegram":
        if user_id not in clients_tg:
            raise HTTPException(status_code=400, detail="Usuário não conectado ao Telegram.")
        async for message in clients_tg[user_id].iter_messages(chat_id, limit=20):
            remetente = usuario.nome if message.out else conversa.nome_chat
            texto = message.text if message.text else "[Mensagem sem texto / Mídia]"
            
            messages.append({
                "remetente": remetente,
                "id": message.id,
                "texto": texto,
                "data": message.date.strftime('%d/%m/%Y %H:%M')
            })
    elif conversa.app.lower() == "google-chat":
        raise HTTPException(status_code=501, detail="Integração com Google Chat ainda não implementada.")
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Google Chat'.")

    return messages

@app.post("/perfil/conversas/{chat_id}/enviar-mensagem")
async def enviar_mensagem(chat_id: int, payload: EnviarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    if payload.app.lower() == "telegram":
        try:
            await clients_tg[user_id].send_message(chat_id, payload.mensagem)
            return {"status": "success", "message": "Mensagem enviada com sucesso!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao enviar mensagem: {str(e)}")
    elif payload.app.lower() == "google chat":
        raise HTTPException(status_code=501, detail="Integração com Google Chat ainda não implementada.")
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Google Chat'.")    

@app.post("/perfil/conversas/{chat_id}/deletar-mensagem")
async def deletar_mensagem(chat_id: int, payload: DeletarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    if payload.app.lower() == "telegram":
        try:
            await clients_tg[user_id].delete_messages(chat_id, payload.message_id)
            return {"status": "success", "message": "Mensagem deletada com sucesso!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao deletar mensagem: {str(e)}")
    elif payload.app.lower() == "google chat":
        raise HTTPException(status_code=501, detail="Integração com Google Chat ainda não implementada.")
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Google Chat'.")

@app.post("/perfil/conversas/{chat_id}/editar-mensagem")
async def editar_mensagem(chat_id: int, payload: EditarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    if payload.app.lower() == "telegram":
        try:
            await clients_tg[user_id].edit_message(chat_id, payload.message_id, payload.nova_mensagem)
            return {"status": "success", "message": "Mensagem editada com sucesso!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao editar mensagem: {str(e)}")
    elif payload.app.lower() == "google chat":
        raise HTTPException(status_code=501, detail="Integração com Google Chat ainda não implementada.")
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Google Chat'.")

@app.post("/auth/tg/codigo")
async def send_code(payload: ConectarTG, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    telefone = payload.numero.strip()

    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    

    statement = select(Conta).where(Conta.cod_usuario == user_id, Conta.usuario_app == telefone, Conta.aplicativo == "Telegram")
    conta = session.exec(statement).first()
    print(conta)
    if conta:
        clients_tg[user_id] = TelegramClient(StringSession(conta.sessao), API_ID, API_HASH)
        await clients_tg[user_id].connect()
        raise HTTPException(status_code=400, detail="Conta já cadastrada para este usuário.")
    else:
        clients_tg[user_id] = TelegramClient(StringSession(), API_ID, API_HASH)
        await clients_tg[user_id].connect()
        
        try:
            send_code_result = await clients_tg[user_id].send_code_request(telefone)
            
            logins_tg[telefone] = {
                "client": clients_tg[user_id],
                "phone_code_hash": send_code_result.phone_code_hash
            }
            
            return {
                "status": "code_sent",
                "message": "Código de verificação enviado pelo Telegram. Prossiga para o endpoint de sign-in."
            }
            
        except Exception as e:
            await clients_tg[user_id].disconnect()
            if telefone in logins_tg:
                del logins_tg[telefone]
            raise HTTPException(status_code=400, detail=f"Erro ao enviar código: {str(e)}")

@app.post("/auth/tg/sign-in")
async def sign_in(payload: SessaoTG, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
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

        try:
                decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
                user_id = decode_token.get("user_id")
        except jwt.PyJWTError:
                raise HTTPException(status_code=401, detail="Token inválido")

        conta = Conta(
            cod_usuario=user_id,
            aplicativo="Telegram",
            usuario_app=telefone,
            sessao=client.session.save()
        )

        session.add(conta)
        session.commit()
        session.refresh(conta)

        async for dialog in client.iter_dialogs(limit=50):
            if isinstance(dialog.entity, User):
                nome = f"{dialog.entity.first_name or ''} {dialog.entity.last_name or ''}".strip()
            elif isinstance(dialog.entity, Chat):
                nome = dialog.entity.title
            elif isinstance(dialog.entity, Channel):
                nome = dialog.entity.title
            else:
                nome = dialog.name
            conversa = Conversa(
                cod_usuario=user_id,
                app="Telegram",
                chat_id=dialog.id,
                nome_chat=nome
            )
            
            session.add(conversa)
            session.commit()
            session.refresh(conversa)
        

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
            url = f"Aqui está o link para redefinir sua senha: http://localhost:80/redefinir-senha?token={token}"
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
            usuario.senha = bcrypt.hashpw(dados.nova_senha.encode(), bcrypt.gensalt())
            session.add(usuario)
            session.commit()
            session.refresh(usuario)
            return "Senha redefinida com sucesso!"
    except Exception as e:
        return "Erro ao redefinir senha: {str(e)}"

@app.post("/logout/")
async def logout(token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    if user_id in clients_tg:
        await clients_tg[user_id].disconnect()
        del clients_tg[user_id]
    
    return "Successfully logged out and disconnected from apps."