"""Build the font-independent JamScript SVG wordmarks from Schibsted Semibold.

Run with `python scripts/generate-brand-wordmark.py` (requires fonttools).
"""

from pathlib import Path
from xml.etree import ElementTree as ET

from PIL import Image, ImageDraw, ImageFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
SOURCE = ROOT / "src" / "assets" / "fonts" / "SchibstedGrotesk.ttf"
TEXT = "JamScript"
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)


def wordmark_paths():
    variable = TTFont(SOURCE)
    face = instantiateVariableFont(variable, {"wght": 600}, inplace=True)
    glyphs = face.getGlyphSet()
    cmap = face.getBestCmap()
    units = face["head"].unitsPerEm
    scale = 40 / units
    advance = 0
    paths = []
    for char in TEXT:
        name = cmap[ord(char)]
        pen = SVGPathPen(glyphs)
        transform = TransformPen(pen, (scale, 0, 0, -scale, advance * scale, 39))
        glyphs[name].draw(transform)
        paths.append(pen.getCommands())
        advance += glyphs[name].width
    return paths


def save(name, color, lockup, paths):
    width = 284 if lockup else 224
    svg = ET.Element(f"{{{NS}}}svg", width=str(width), height="52", viewBox=f"0 0 {width} 52")
    if lockup:
        mark = ET.SubElement(svg, f"{{{NS}}}g", transform="translate(0 4)")
        strokes = ET.SubElement(
            mark,
            f"{{{NS}}}g",
            fill="none",
            stroke="#FCB452" if color == "#EFEBE1" else "#121322",
            **{"stroke-width": "5", "stroke-linecap": "round", "stroke-linejoin": "round"},
        )
        ET.SubElement(strokes, f"{{{NS}}}path", d="M14 25 6 19 22 7v22c0 9-12 10-12 2")
        ET.SubElement(strokes, f"{{{NS}}}path", d="m40 13-10-6v9l12 9c2 1.5 2 3.5 0 5l-10 6v-8")
    group = ET.SubElement(svg, f"{{{NS}}}g", transform="translate(60 0)" if lockup else "translate(0 0)", fill=color)
    for path in paths:
        ET.SubElement(group, f"{{{NS}}}path", d=path)
    (BRAND / name).write_text(ET.tostring(svg, encoding="unicode") + "\n", encoding="utf-8")


def save_png():
    image = Image.new("RGBA", (1136, 208), (0, 0, 0, 0))
    mark = Image.open(BRAND / "mark.png").convert("RGBA")
    mark.thumbnail((192, 176), Image.Resampling.LANCZOS)
    image.alpha_composite(mark, ((192 - mark.width) // 2, 16 + (176 - mark.height) // 2))
    face = ImageFont.truetype(str(SOURCE), 160)
    face.set_variation_by_axes([600])
    ImageDraw.Draw(image).text((240, 156), TEXT, font=face, fill="#EFEBE1", anchor="ls")
    image.save(BRAND / "logo.png")


if __name__ == "__main__":
    outlines = wordmark_paths()
    for filename, color, lockup in (
        ("logo.svg", "#EFEBE1", True),
        ("logo-ink.svg", "#121322", True),
        ("wordmark.svg", "#EFEBE1", False),
        ("wordmark-ink.svg", "#121322", False),
    ):
        save(filename, color, lockup, outlines)
    save_png()
