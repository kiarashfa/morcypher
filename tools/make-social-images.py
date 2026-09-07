"""Generate the social/share images and the iOS home-screen icon.

    python tools/make-social-images.py

Outputs
    src/og-image.png        1200x630  Open Graph / Twitter summary_large_image
    src/og-github.png       1280x640  GitHub repo social preview (2:1, recomposed
                                      at that ratio - not a rescale of the OG image)
    favicon/apple-touch-icon.png  180x180  solid background (iOS paints
                                      transparency black) plus ~10% padding

Fonts are the project's own woff2 files, converted to ttf in a temp dir at run
time so no derived font files are committed. Colors come from the palette
tokens in style.css.
"""
import pathlib
import tempfile

from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent

# palette tokens (style.css :root, dark)
BG_0 = (10, 12, 16)
BG_1 = (15, 18, 24)
AMBER = (251, 165, 62)      # the mark's amber
INK = (231, 236, 243)       # --ink
INK_DIM = (152, 163, 181)   # --ink-dim
INK_FAINT = (91, 102, 119)  # --ink-faint

TITLE = "MorCypher"
TAGLINE = "a virtual Morse code device"
WORD = "MORCYPHER"

MORSE = {
    "M": "--", "O": "---", "R": ".-.", "C": "-.-.", "Y": "-.--",
    "P": ".--.", "H": "....", "E": ".",
}


def load_fonts(tmp):
    """Convert the project's woff2 faces to ttf so Pillow can use them."""
    faces = {}
    for name in ("jetbrains-mono-700", "space-grotesk-400"):
        f = TTFont(ROOT / "fonts" / f"{name}.woff2")
        f.flavor = None
        path = tmp / f"{name}.ttf"
        f.save(str(path))
        faces[name] = path
    return faces


def backdrop(w, h):
    """Vertical bg-0 -> bg-1 gradient with a soft amber bloom up top."""
    img = Image.new("RGB", (w, h), BG_0)
    grad = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        grad.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(BG_0, BG_1)))
    img = grad.resize((w, h))

    # radial amber glow, drawn small and upscaled so it is smooth
    gw, gh = 120, 70
    glow = Image.new("L", (gw, gh), 0)
    gd = ImageDraw.Draw(glow)
    cx, cy = gw / 2, gh * 0.30
    for r in range(60, 0, -1):
        gd.ellipse([cx - r * 1.5, cy - r, cx + r * 1.5, cy + r],
                   fill=int(46 * (1 - r / 60) ** 2))
    glow = glow.resize((w, h), Image.LANCZOS)
    img.paste(Image.new("RGB", (w, h), AMBER), (0, 0), glow)
    return img


def morse_strip(draw, word, cx, y, unit, gap, letter_gap, thickness, color):
    """Draw `word` as amber dots and dashes, centred on cx. Returns (x0, x1)."""
    letters = [MORSE[ch] for ch in word]
    width = 0
    for i, code in enumerate(letters):
        for sym in code:
            width += (unit if sym == "." else unit * 3) + gap
        width -= gap
        if i < len(letters) - 1:
            width += letter_gap
    x = cx - width / 2
    x0 = x
    for i, code in enumerate(letters):
        for sym in code:
            length = unit if sym == "." else unit * 3
            draw.rounded_rectangle([x, y, x + length, y + thickness],
                                   radius=thickness / 2, fill=color)
            x += length + gap
        x -= gap
        if i < len(letters) - 1:
            x += letter_gap
    return x0, x


def compose(w, h, mark_w, title_px, tag_px, gaps, faces, top):
    """Lay out the card at the given size. `top` is where the mark starts."""
    img = backdrop(w, h)
    draw = ImageDraw.Draw(img)

    mark = Image.open(ROOT / "favicon" / "android-chrome-512x512.png").convert("RGBA")
    mark = mark.crop(mark.getchannel("A").getbbox())
    mh = round(mark.height * mark_w / mark.width)
    mark = mark.resize((mark_w, mh), Image.LANCZOS)
    mx, my = (w - mark_w) // 2, top
    img.paste(mark, (mx, my), mark)

    ink = [mx, my, mx + mark_w, my + mh]

    title_font = ImageFont.truetype(str(faces["jetbrains-mono-700"]), title_px)
    tag_font = ImageFont.truetype(str(faces["space-grotesk-400"]), tag_px)

    ty = my + mh + gaps["mark_title"]
    tb = draw.textbbox((w / 2, ty), TITLE, font=title_font, anchor="ma")
    draw.text((w / 2, ty), TITLE, font=title_font, fill=INK, anchor="ma")
    ink = [min(ink[0], tb[0]), ink[1], max(ink[2], tb[2]), max(ink[3], tb[3])]

    gy = tb[3] + gaps["title_tag"]
    gb = draw.textbbox((w / 2, gy), TAGLINE, font=tag_font, anchor="ma")
    draw.text((w / 2, gy), TAGLINE, font=tag_font, fill=INK_DIM, anchor="ma")
    ink = [min(ink[0], gb[0]), ink[1], max(ink[2], gb[2]), max(ink[3], gb[3])]

    my_ = gb[3] + gaps["tag_morse"]
    unit = gaps["unit"]
    sx, sxe = morse_strip(draw, WORD, w / 2, my_, unit, unit, unit * 3,
                          gaps["thickness"], AMBER)
    ink = [min(ink[0], sx), ink[1], max(ink[2], sxe),
           max(ink[3], my_ + gaps["thickness"])]

    return img, [round(v) for v in ink]


def main():
    with tempfile.TemporaryDirectory() as td:
        tmp = pathlib.Path(td)
        faces = load_fonts(tmp)
        out = ROOT / "src"
        out.mkdir(exist_ok=True)

        # --- 1200x630 Open Graph card
        og, _ = compose(
            1200, 630, mark_w=250, title_px=92, tag_px=34,
            gaps={"mark_title": 44, "title_tag": 26, "tag_morse": 54,
                  "unit": 9, "thickness": 9},
            faces=faces, top=96,
        )
        og.save(out / "og-image.png", optimize=True)
        print("wrote src/og-image.png", og.size)

        # --- 1280x640 GitHub social preview, recomposed at 2:1 with a 40pt safe
        #     margin. Shorter and wider, so the stack is tightened rather than
        #     scaled: smaller mark, tighter gaps.
        gh, ink = compose(
            1280, 640, mark_w=222, title_px=88, tag_px=32,
            gaps={"mark_title": 38, "title_tag": 24, "tag_morse": 46,
                  "unit": 9, "thickness": 9},
            faces=faces, top=116,
        )
        gh.save(out / "og-github.png", optimize=True)
        margin = min(ink[0], ink[1], 1280 - ink[2], 640 - ink[3])
        print("wrote src/og-github.png", gh.size, "ink bounds", ink,
              "-> smallest margin", margin, "px", "OK" if margin >= 40 else "TOO TIGHT")

        # --- apple-touch-icon: solid background, ~10% padding
        size, pad = 180, 18
        icon = Image.new("RGB", (size, size), BG_0)
        mark = Image.open(ROOT / "favicon" / "android-chrome-512x512.png").convert("RGBA")
        mark = mark.crop(mark.getchannel("A").getbbox())
        inner = size - pad * 2
        scale = min(inner / mark.width, inner / mark.height)
        mark = mark.resize((round(mark.width * scale), round(mark.height * scale)),
                           Image.LANCZOS)
        icon.paste(mark, ((size - mark.width) // 2, (size - mark.height) // 2), mark)
        icon.save(ROOT / "favicon" / "apple-touch-icon.png", optimize=True)
        print("wrote favicon/apple-touch-icon.png", icon.size, icon.mode)


if __name__ == "__main__":
    main()
