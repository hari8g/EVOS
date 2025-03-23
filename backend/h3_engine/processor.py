import pandas as pd
import h3
from datetime import datetime

def latlon_to_h3(lat, lon, resolution=8):
    return h3.geo_to_h3(lat, lon, resolution)

def process_csv_to_h3(filepath, resolution=8):
    df = pd.read_csv(filepath)

    # Ensure required columns exist
    assert {'latitude', 'longitude', 'soc', 'timestamp', 'asset_id'}.issubset(df.columns)

    # Drop rows with missing or malformed data
    df = df.dropna(subset=['latitude', 'longitude', 'soc'])

    # Convert lat/lon to H3 hexes
    df['h3_index'] = df.apply(lambda row: latlon_to_h3(row['latitude'], row['longitude'], resolution), axis=1)

    # Aggregate: mean SOC per hex index
    agg_df = df.groupby('h3_index').agg(
        avg_soc=('soc', 'mean'),
        min_soc=('soc', 'min'),
        max_soc=('soc', 'max'),
        count=('asset_id', 'count'),
    ).reset_index()

    return agg_df

def h3_to_geojson(df):
    features = []

    for _, row in df.iterrows():
        hex_boundary = h3.h3_to_geo_boundary(row['h3_index'], geo_json=True)

        # Convert to [lng, lat] pairs as GeoJSON expects
        coordinates = [[lat, lon] for lat, lon in hex_boundary]
        coordinates.append(coordinates[0])  # Close the polygon loop

        features.append({
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [coordinates]
            },
            "properties": {
                "h3_index": row['h3_index'],
                "avg_soc": row['avg_soc'],
                "min_soc": row['min_soc'],
                "max_soc": row['max_soc'],
                "count": row['count'],
                "soc_color": soc_to_color(row['avg_soc']),
            }
        })

    return {
        "type": "FeatureCollection",
        "features": features
    }

def soc_to_color(soc):
    # Map SOC to a hex color (you can improve this with a gradient later)
    if soc >= 80:
        return "#00FF00"  # Green
    elif soc >= 60:
        return "#ADFF2F"  # Green-yellow
    elif soc >= 40:
        return "#FFD700"  # Yellow
    elif soc >= 20:
        return "#FF8C00"  # Orange
    else:
        return "#FF0000"  # Red

