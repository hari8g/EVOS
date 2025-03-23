from fastapi import APIRouter, Query
from h3_engine.processor import process_csv_to_h3, h3_to_geojson
from fastapi.responses import JSONResponse
import os

router = APIRouter()

@router.get("/map/h3-soc")
def get_hex_map(file: str = Query(..., description="Name of CSV file in data/raw_csvs/"), 
                resolution: int =Query(8),
                min_soc: float =Query(0),
                max_soc: float=Query(100),
                min_assets: int = Query(0)
):
    csv_path = os.path.join("/data", "raw_csvs", file)

    try:
        df = process_csv_to_h3(csv_path, resolution=resolution)

        df = df[
            (df['avg_soc'] >= min_soc) &
            (df['avg_soc'] <= max_soc) &
            (df['count'] >= min_assets)
        ]


        geojson = h3_to_geojson(df)

        return JSONResponse(content=geojson)

    except FileNotFoundError:
        return {"error": f"File {file} not found."}