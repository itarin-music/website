"""Build data/world-labels.json with one capital city per country."""
import io
import json
import zipfile
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "world-labels.json"
CITIES_URL = "https://download.geonames.org/export/dump/cities15000.zip"
COUNTRY_URL = "https://download.geonames.org/export/dump/countryInfo.txt"
MIN_COUNTRY_POP = 20_000_000
MIN_CITY_POP = 2_000_000

ALIASES = {
    "New York City": "New York",
    "Koeln": "Cologne",
    "Zuerich": "Zurich",
    "Washington, D.C.": "Washington",
}


def fetch(url):
    with urlopen(url, timeout=90) as res:
        return res.read()


def clean_name(name):
    return ALIASES.get(name, name)


def load_countries():
    raw = fetch(COUNTRY_URL).decode("utf-8", "replace")
    countries = {}
    for line in raw.splitlines():
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) < 8:
            continue
        iso = parts[0].strip()
        if not iso:
            continue
        try:
            pop = int(parts[7] or 0)
        except ValueError:
            pop = 0
        countries[iso] = {
            "name": parts[4],
            "capital": (parts[5] or "").strip(),
            "pop": pop,
        }
    return countries


def load_cities():
    blob = fetch(CITIES_URL)
    with zipfile.ZipFile(io.BytesIO(blob)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".txt"))
        text = zf.read(name).decode("utf-8", "replace")
    cities = []
    for line in text.splitlines():
        parts = line.split("\t")
        if len(parts) < 15:
            continue
        feature = parts[7]
        if feature != "PPLC":
            continue
        try:
            lat = float(parts[4])
            lon = float(parts[5])
            pop = int(parts[14] or 0)
        except ValueError:
            continue
        iso = parts[8].strip()
        ascii_name = clean_name((parts[2] or parts[1]).strip())
        if not iso or not ascii_name:
            continue
        cities.append({
            "name": ascii_name,
            "cc": iso,
            "lat": round(lat, 3),
            "lon": round(lon, 3),
            "pop": pop,
        })
    return cities


def pick(countries, cities):
    by_cc = {}
    for city in cities:
        by_cc.setdefault(city["cc"], []).append(city)
    chosen = []
    for cc, group in by_cc.items():
        info = countries.get(cc) or {}
        want = (info.get("capital") or "").lower()
        group.sort(key=lambda c: -c["pop"])
        pick_city = group[0]
        if want:
            for city in group:
                if city["name"].lower() == want or city["name"].lower().startswith(want):
                    pick_city = city
                    break
        chosen.append({
            "name": pick_city["name"],
            "lat": pick_city["lat"],
            "lon": pick_city["lon"],
            "pop": pick_city["pop"],
            "country_pop": int(info.get("pop") or 0),
        })
    chosen.sort(key=lambda c: c["pop"], reverse=True)
    kept = []
    for city in chosen:
        if city["pop"] >= MIN_CITY_POP or city["country_pop"] >= MIN_COUNTRY_POP:
            kept.append({
                "name": city["name"],
                "lat": city["lat"],
                "lon": city["lon"],
                "pop": city["pop"],
            })
    return kept


def main():
    countries = load_countries()
    cities = load_cities()
    labels = pick(countries, cities)
    OUT.write_text(json.dumps(labels, ensure_ascii=True, separators=(",", ":")), encoding="utf-8")
    print("capitals", len(labels), "bytes", OUT.stat().st_size)
    print("sample", [c["name"] for c in labels[:16]])


if __name__ == "__main__":
    main()
