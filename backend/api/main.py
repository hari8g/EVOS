from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.routes import h3_map

app = FastAPI()

# Enable CORS for frontend (React at port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(h3_map.router, prefix="/api")

@app.get("/health")
def health_check():
    return {"status": "ok"}




