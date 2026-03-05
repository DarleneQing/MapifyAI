from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import requests, offers, providers, users

app = FastAPI(title="LocalBid API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requests.router)
app.include_router(offers.router)
app.include_router(providers.router)
app.include_router(users.router)


@app.get("/health")
def health():
    return {"status": "ok"}
