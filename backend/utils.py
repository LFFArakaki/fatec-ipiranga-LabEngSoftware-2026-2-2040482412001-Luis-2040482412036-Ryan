from jose import jwt
from datetime import datetime
from datetime import timedelta
import os
import dotenv

dotenv.load_dotenv()

SECRET_KEY = os.getenv('SECRET_KEY')
ALGORITHM = os.getenv('ALGORITHM')

def create_reset_password_token(email: str):
    data = {"email": email, "exp": datetime.utcnow() + timedelta(minutes=10)}
    token = jwt.encode(data, SECRET_KEY, ALGORITHM)
    return token

def manipular_db(session, data):
    session.add(data)
    session.commit()
    session.refresh(data)
    return data

def validar_token(token: str):
    try:
        decode_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = decode_token.get("user_id")
        return user_id
    except:
        return False