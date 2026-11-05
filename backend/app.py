from fastapi import Depends, FastAPI, HTTPException, Query, Response, BackgroundTasks
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlmodel import Session, SQLModel, create_engine, select, func
from typing import Annotated
from models_payload import ConectarNumero, DeletarMensagem, EditarMensagem, EnviarMensagem, SessaoTG, EsqueciSenha, RedefinirSenha
from models_db import Conversa, Usuario, Conta, UsuarioVisivel, ConversaSignal
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.tl.types import Chat, Channel, User
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from jose import jwt
from datetime import datetime, timezone
from datetime import timedelta
from pysignalclirestapi import SignalCliRestApi
import requests
import bcrypt
import os
import dotenv
import utils
import json

dotenv.load_dotenv()

API_ID = os.getenv('API_ID')
API_HASH = os.getenv('API_HASH')
SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = os.getenv('ALGORITHM')
SIGNAL_SERVER = os.getenv('SIGNAL_SERVER')
CONTAINER_NAME = os.getenv('CONTAINER_NAME')
logins_tg = {}
clients_tg = {}
clients_signal = {}

conf = ConnectionConfig(
    MAIL_SERVER= os.getenv('MAIL_SERVER'),
    MAIL_PORT= int(os.getenv('MAIL_PORT')),
    MAIL_USERNAME= os.getenv('MAIL_USERNAME'),
    MAIL_PASSWORD= os.getenv('MAIL_PASSWORD'),
    MAIL_FROM= os.getenv('MAIL_FROM'),
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

@app.get("/busca-conversas/")
async def buscar_conversas(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    tg_client = clients_tg.get(user_id)
    signal_client = clients_signal.get(user_id)

    if tg_client:
        async for dialog in tg_client.iter_dialogs(limit=50):
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
            if not session.exec(select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == dialog.id)).first():
                session.add(conversa)
                session.commit()
                session.refresh(conversa)

    if signal_client:
        groups = signal_client.list_groups()
        for group in groups:
            conversa = Conversa(
                cod_usuario=user_id,
                app="Signal",
                chat_id=group['id'],
                nome_chat=group['name']
            )
            conversa_signal = ConversaSignal(
                cod_conversa=conversa.cod,
                internal_id=group['internal_id'],
                mensagens={}
            )
            if not session.exec(select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == group['id'])).first():
                session.add(conversa)
                session.commit()
                session.refresh(conversa)

                conversa_registrada = session.exec(select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == group['id'])).first()
                conversa_signal = ConversaSignal(
                    cod_usuario=user_id,
                    cod_conversa=conversa_registrada.cod,
                    internal_id=group['internal_id'],
                    mensagens={}
                )
                if not session.exec(select(ConversaSignal).where(ConversaSignal.cod_conversa == conversa_registrada.cod)).first():
                    session.add(conversa_signal)
                    session.commit()
                    session.refresh(conversa_signal)

        contacts = signal_client.get_contacts()
        for contact in contacts:
            conversa = Conversa(
                cod_usuario=user_id,
                app="Signal",
                chat_id=contact['number'],
                nome_chat=contact['name']
            )
            if not session.exec(select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == contact['number'])).first():
                session.add(conversa)
                session.commit()
                session.refresh(conversa)

                conversa_registrada = session.exec(select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == contact['number'])).first()
                conversa_signal = ConversaSignal(
                    cod_usuario=user_id,
                    cod_conversa=conversa_registrada.cod,
                    internal_id=contact['uuid'],
                    mensagens={}
                )
                if not session.exec(select(ConversaSignal).where(ConversaSignal.cod_conversa == conversa_registrada.cod)).first():
                    session.add(conversa_signal)
                    session.commit()
                    session.refresh(conversa_signal)
    return {"status": "success", "message": "Conversas buscadas e registradas com sucesso!"}

@app.get("/mensagens-signal/")
async def listar_mensagens_signal(session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    statement = select(ConversaSignal).where(ConversaSignal.cod_usuario == user_id)
    conversas = session.exec(statement).all()
    return conversas

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

@app.get("/perfil/conversas/{app}")
async def listar_conversas_por_app(app: str, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    if not token:
        raise HTTPException(status_code=401, detail="Token não fornecido")
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    statement = select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.app == app)
    conversas = session.exec(statement).all()
    return conversas

@app.get("/perfil/conversas/{chat_id}")
async def buscar_conversa(chat_id: str, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
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

    elif conversa.app.lower() == "signal":
        signal_client = clients_signal.get(user_id)
        conversa_signal = session.exec(select(ConversaSignal).where(ConversaSignal.cod_conversa == conversa.cod)).first()
        chat_internal_id = conversa_signal.internal_id if conversa_signal else None

        if not signal_client:
            raise HTTPException(status_code=400, detail="Usuário não conectado ao Signal.")
        
        try:
            received_messages = signal_client.receive()
            for message in received_messages:
                if not message['envelope']['syncMessage']['sentMessage']:
                    continue
                if message['envelope']['syncMessage']['sentMessage']['groupInfo']:
                    group_id = message['envelope']['syncMessage']['sentMessage']['groupInfo']['groupId']
                    remetente = message['envelope']['sourceName']
                    texto = message['envelope']['syncMessage']['sentMessage']['message']
                    data = datetime.fromtimestamp(message['envelope']['timestamp'] / 1000).strftime('%d/%m/%Y %H:%M')
                    msg = {
                        "remetente": remetente,
                        "texto": texto,
                        "data": data
                    }
                    if not group_id == chat_internal_id:
                        outra_conversa_signal = session.exec(select(ConversaSignal).where(ConversaSignal.internal_id == group_id)).first()
                        if outra_conversa_signal:
                            conversa_log = outra_conversa_signal.log.copy()
                            conversa_log[f"mensagem{message['envelope']['timestamp']}"] = msg
                            outra_conversa_signal.log = conversa_log
                            session.add(outra_conversa_signal)
                            session.commit()
                            session.refresh(outra_conversa_signal)
                    else:        
                        if conversa_signal:
                            conversa_log = conversa_signal.log.copy()
                            conversa_log[f"mensagem{message['envelope']['timestamp']}"] = msg
                            conversa_signal.log = conversa_log
                            session.add(conversa_signal)
                            session.commit()
                            session.refresh(conversa_signal)
                else:
                    contact_id = message['envelope']['sourceUuid']
                    remetente = message['envelope']['sourceName']
                    texto = message['envelope']['syncMessage']['sentMessage']['message']
                    data = datetime.fromtimestamp(message['envelope']['timestamp'] / 1000).strftime('%d/%m/%Y %H:%M')
                    msg = {
                        "remetente": remetente,
                        "texto": texto,
                        "data": data
                    }
                    if not contact_id == chat_internal_id:
                        outra_conversa_signal = session.exec(select(ConversaSignal).where(ConversaSignal.internal_id == contact_id)).first()
                        if outra_conversa_signal:
                            conversa_log = outra_conversa_signal.log.copy()
                            conversa_log[f"mensagem{message['envelope']['timestamp']}"] = msg
                            outra_conversa_signal.log = conversa_log
                            session.add(outra_conversa_signal)
                            session.commit()
                            session.refresh(outra_conversa_signal)
                    else:
                        if conversa_signal:
                            conversa_log = conversa_signal.log.copy()
                            conversa_log[f"mensagem{message['envelope']['timestamp']}"] = msg
                            conversa_signal.log = conversa_log
                            session.add(conversa_signal)
                            session.commit()
                            session.refresh(conversa_signal)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao listar mensagens do Signal: {str(e)}")
        messages = list(conversa_signal.log.items())
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Signal'.")

    return messages

@app.post("/perfil/conversas/{chat_id}/enviar-mensagem")
async def enviar_mensagem(chat_id: str, session: SessionDep, payload: EnviarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
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
    elif payload.app.lower() == "signal":
        signal_client = clients_signal.get(user_id)
        if not signal_client:
            raise HTTPException(status_code=400, detail="Usuário não conectado ao Signal.")
        try:
            signal_client.send_message(message=payload.mensagem, recipients=[chat_id])
            usuario = session.get(Usuario, user_id)
            statement = select(Conversa).where(Conversa.cod_usuario == user_id, Conversa.chat_id == chat_id)
            conversa = session.exec(statement).first()
            statement = select(ConversaSignal).where(ConversaSignal.cod_conversa == conversa.cod)
            conversa_signal = session.exec(statement).first()

            if conversa_signal:
                conversa_log = conversa_signal.log.copy()
                timestamp = int(datetime.now().timestamp() * 1000)
                msg = {
                    "remetente": usuario.nome,
                    "texto": payload.mensagem,
                    "data": datetime.now().strftime('%d/%m/%Y %H:%M')
                }
                conversa_log[f"mensagem{timestamp}"] = msg
                print(conversa_log)
                conversa_signal.log = conversa_log
                session.add(conversa_signal)
                session.commit()
                session.refresh(conversa_signal)
            return {"status": "success", "message": "Mensagem enviada com sucesso!"}
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erro ao enviar mensagem: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Use 'Telegram' ou 'Signal'.")    

@app.post("/perfil/conversas/{chat_id}/deletar-mensagem")
async def deletar_mensagem(chat_id: str, payload: DeletarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
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
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Pode apenas deletar mensagens do 'Telegram'.")

@app.post("/perfil/conversas/{chat_id}/editar-mensagem")
async def editar_mensagem(chat_id: str, payload: EditarMensagem, token: Annotated[str, Depends(oauth2_scheme)]):
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
    else:
        raise HTTPException(status_code=400, detail="Aplicativo não suportado. Pode apenas editar mensagens do 'Telegram'.")

@app.post("/auth/tg/codigo")
async def send_code_tg(payload: ConectarNumero, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    telefone = payload.numero.strip()

    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")
    
    statement = select(Conta).where(Conta.cod_usuario == user_id, Conta.usuario_app == telefone, Conta.aplicativo == "Telegram")
    conta = session.exec(statement).first()
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
async def sign_in_tg(payload: SessaoTG, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
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

@app.post("/auth/signal/sign-in")
async def sign_in_signal(payload: ConectarNumero, session: SessionDep, token: Annotated[str, Depends(oauth2_scheme)]):
    telefone = payload.numero.strip()
    
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

    conta = Conta(
                cod_usuario=user_id,
                aplicativo="Signal",
                usuario_app=telefone,
                sessao="Sem sessão"
            )

    session.add(conta)
    session.commit()
    session.refresh(conta)

    clients_signal[user_id] = SignalCliRestApi(SIGNAL_SERVER, telefone)
    
    try:
        response = requests.get(f"{SIGNAL_SERVER}/v1/qrcodelink?device_name=communihub")
        return Response(content=response.content, media_type="image/png")
    except Exception as e:
        return {"error": str(e)}, 500

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