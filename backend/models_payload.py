from pydantic import BaseModel

class ConectarTG(BaseModel):
    numero: str

class SessaoTG(BaseModel):
    numero: str
    codigo: str

class EsqueciSenha(BaseModel):
    email: str

class RedefinirSenha(BaseModel):
    token: str
    nova_senha: str

class EnviarMensagem(BaseModel):
    app: str
    chat_id: str
    mensagem: str