import os
import sqlite3
import json
import random
import time
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

DB_PATH = os.path.join(os.path.dirname(__file__), "voxel_worlds.db")

app = FastAPI(title="Voxel Sandbox 2D Server", version="1.0.0")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS worlds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            seed INTEGER NOT NULL,
            width INTEGER NOT NULL DEFAULT 160,
            height INTEGER NOT NULL DEFAULT 90,
            player_x REAL NOT NULL DEFAULT 80.0,
            player_y REAL NOT NULL DEFAULT 30.0,
            time_of_day REAL NOT NULL DEFAULT 0.25,
            inventory_json TEXT NOT NULL,
            blocks_data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

class CreateWorldRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)
    seed: Optional[int] = None
    width: int = Field(default=160, ge=80, le=400)
    height: int = Field(default=90, ge=60, le=200)

class SaveWorldRequest(BaseModel):
    player_x: float
    player_y: float
    time_of_day: float
    inventory: List[Dict[str, Any]]
    blocks_data: Optional[str] = None # RLE or flat string of block IDs

@app.get("/api/worlds")
def list_worlds():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, seed, width, height, player_x, player_y, time_of_day, created_at, updated_at
        FROM worlds
        ORDER BY updated_at DESC
    """)
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return {"worlds": rows}

@app.post("/api/worlds")
def create_world(req: CreateWorldRequest):
    seed = req.seed if req.seed is not None else random.randint(100000, 999999)
    default_inventory = [
        {"id": "pickaxe_wood", "count": 1, "type": "tool"},
        {"id": "axe_wood", "count": 1, "type": "tool"},
        {"id": "dirt", "count": 32, "type": "block"},
        {"id": "wood", "count": 16, "type": "block"},
        {"id": "torch", "count": 12, "type": "item"},
        {"id": "", "count": 0, "type": "empty"},
        {"id": "", "count": 0, "type": "empty"},
        {"id": "", "count": 0, "type": "empty"},
        {"id": "", "count": 0, "type": "empty"}
    ]

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO worlds (name, seed, width, height, player_x, player_y, time_of_day, inventory_json, blocks_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        req.name.strip(),
        seed,
        req.width,
        req.height,
        float(req.width // 2),
        25.0,
        0.25,
        json.dumps(default_inventory),
        ""
    ))
    new_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return {"status": "created", "id": new_id, "seed": seed}

@app.get("/api/worlds/{world_id}")
def get_world(world_id: int):
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM worlds WHERE id = ?", (world_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="World not found")

    data = dict(row)
    data["inventory"] = json.loads(data["inventory_json"])
    return data

@app.put("/api/worlds/{world_id}")
def save_world(world_id: int, req: SaveWorldRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM worlds WHERE id = ?", (world_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="World not found")

    now = datetime.utcnow().isoformat()
    if req.blocks_data is not None:
        cursor.execute("""
            UPDATE worlds 
            SET player_x = ?, player_y = ?, time_of_day = ?, inventory_json = ?, blocks_data = ?, updated_at = ?
            WHERE id = ?
        """, (req.player_x, req.player_y, req.time_of_day, json.dumps(req.inventory), req.blocks_data, now, world_id))
    else:
        cursor.execute("""
            UPDATE worlds 
            SET player_x = ?, player_y = ?, time_of_day = ?, inventory_json = ?, updated_at = ?
            WHERE id = ?
        """, (req.player_x, req.player_y, req.time_of_day, json.dumps(req.inventory), now, world_id))

    conn.commit()
    conn.close()
    return {"status": "saved", "updated_at": now}

@app.delete("/api/worlds/{world_id}")
def delete_world(world_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM worlds WHERE id = ?", (world_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def read_root():
    return FileResponse(os.path.join(static_dir, "index.html"))
