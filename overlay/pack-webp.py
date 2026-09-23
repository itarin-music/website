from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent
size = (960, 480)
duration = int(round(1000 / 30))


def pack(folder, dest, loop=0):
    files = sorted((root / "frames" / folder).glob("*.png"))
    frames = []
    for path in files:
        im = Image.open(path).convert("RGBA")
        if im.size != size:
            im = im.resize(size, Image.Resampling.LANCZOS)
        frames.append(im)
    frames[0].save(
        dest,
        format="WEBP",
        save_all=True,
        append_images=frames[1:],
        duration=duration,
        loop=loop,
        lossless=False,
        quality=80,
        method=4,
        minimize_size=True,
    )
    print(dest.name, dest.stat().st_size, "bytes", len(frames), "frames")


pack("full", root / "itarin-mark.webp", loop=0)
pack("loop", root / "itarin-mark-loop.webp", loop=0)
