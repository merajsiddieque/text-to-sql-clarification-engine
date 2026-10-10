import base64
import hashlib
from cryptography.fernet import Fernet
from app.core.config import settings


def _get_fernet_key() -> bytes:
    if settings.ENCRYPTION_KEY:
        try:
            return settings.ENCRYPTION_KEY.encode()
        except Exception:
            pass
    # Derive deterministic 32-byte urlsafe key from SECRET_KEY
    derived = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(derived)


def encrypt_secret(plain_text: str) -> str:
    """Encrypts sensitive credentials such as database passwords or connection strings."""
    if not plain_text:
        return ""
    fernet = Fernet(_get_fernet_key())
    return fernet.encrypt(plain_text.encode()).decode()


def decrypt_secret(cipher_text: str) -> str:
    """Decrypts encrypted credentials."""
    if not cipher_text:
        return ""
    fernet = Fernet(_get_fernet_key())
    return fernet.decrypt(cipher_text.encode()).decode()
