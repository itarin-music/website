"""Build data/world-cities.json from GeoNames (major cities only)."""
import io
import json
import zipfile
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "world-cities.json"
CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
MIN_POP = 25000


def main():
    with urlopen(CITIES_URL, timeout=90) as res:
        blob = res.read()
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".txt"))
        text = zf.read(name).decode("utf-8", "replace")

    points = []
    seen = set()
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) < 15:
            continue
        feature = parts[7]
        if feature == "PPLX" or not feature.startswith("PPL"):
            continue
        try:
            lat = float(parts[4])
            lon = float(parts[5])
            pop = int(parts[14] or 0)
        except ValueError:
            continue
        if pop < MIN_POP:
            continue
        key = (round(lat, 2), round(lon, 2))
        if key in seen:
            continue
        seen.add(key)
        points.append([key[0], key[1]])

    OUT.write_text(json.dumps(points, separators=(",", ":")), encoding="utf-8")
    print("min_pop", MIN_POP, "cities", len(points), "bytes", OUT.stat().st_size)


if __name__ == "__main__":
    main()
