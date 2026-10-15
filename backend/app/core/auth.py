from functools import lru_cache
from typing import Any, Dict

from fastapi import HTTPException, Request
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token

from app.core.config import settings


@lru_cache(maxsize=1)
def _google_request() -> GoogleRequest:
    return GoogleRequest()


def verify_firebase_token(token: str) -> Dict[str, Any]:
    """Verify a Firebase ID token and return its claims."""
    project_id = settings.FIREBASE_PROJECT_ID
    if not project_id:
        raise HTTPException(status_code=503, detail="Firebase authentication is not configured.")

    try:
        claims = id_token.verify_firebase_token(
            token,
            _google_request(),
            audience=project_id,
        )
    except Exception as error:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.") from error

    if claims.get("aud") != project_id or claims.get("iss") != f"https://securetoken.google.com/{project_id}":
        raise HTTPException(status_code=401, detail="Firebase token was issued for a different project.")

    if not (claims.get("user_id") or claims.get("sub")):
        raise HTTPException(status_code=401, detail="Firebase token does not identify a user.")
    if not claims.get("email_verified", False):
        raise HTTPException(status_code=403, detail="Verify your email before using the API.")
    return claims


async def attach_authenticated_user(request: Request, call_next):
    """Authenticate hosted API requests; local development remains usable without Firebase."""
    api_prefix = settings.API_V1_STR.rstrip("/") + "/"
    if request.url.path.startswith(api_prefix) and settings.REQUIRE_FIREBASE_AUTH:
        authorization = request.headers.get("authorization", "")
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return _unauthorized_response()

        try:
            claims = verify_firebase_token(token)
        except HTTPException as error:
            from fastapi.responses import JSONResponse

            return JSONResponse(status_code=error.status_code, content={"detail": error.detail})
        request.state.user_id = claims.get("user_id") or claims["sub"]
    else:
        request.state.user_id = "local"

    return await call_next(request)


def _unauthorized_response():
    from fastapi.responses import JSONResponse

    return JSONResponse(status_code=401, content={"detail": "A valid Firebase bearer token is required."})
