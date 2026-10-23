"""Render JamScript's installer and social-card artwork from its production mark.

Run with `python scripts/generate-brand-surfaces.py` (requires Pillow). The
generated files are committed so release builders do not need Python/Pillow.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "public" / "brand"
INSTALLER = ROOT / "src-tauri" / "installer"
FONTS = ROOT / "src" / "assets" / "fonts"
SCALE = 3
NAVY = "#111322"
PANEL = "#191c30"
EDGE = "#34394f"
AMBER = "#fcb452"
PAPER = "#efebe1"
MUTED = "#aeb6cf"
INK = "#171a2a"


def font(size, bold=False, mono=False):
    path = FONTS / ("MartianMono.ttf" if mono else "SchibstedGrotesk.ttf")
    result = ImageFont.truetype(str(path), size * SCALE)
    result.set_variation_by_axes([600 if bold else 400, 100] if mono else [600 if bold else 400])
    return result


class Surface:
    def __init__(self, width, height, background):
        self.width, self.height = width, height
        self.image = Image.new("RGB", (width * SCALE, height * SCALE), background)
        self.draw = ImageDraw.Draw(self.image)

    def rect(self, xy, fill, radius=0, outline=None, width=1):
        box = tuple(round(value * SCALE) for value in xy)
        self.draw.rounded_rectangle(
            box,
            radius=radius * SCALE,
            fill=fill,
            outline=outline,
            width=width * SCALE,
        )

    def line(self, points, fill, width=1):
        self.draw.line([(round(x * SCALE), round(y * SCALE)) for x, y in points], fill=fill, width=width * SCALE)

    def circle(self, center, radius, fill, outline=None, width=1):
        x, y = center
        self.draw.ellipse(
            ((x - radius) * SCALE, (y - radius) * SCALE, (x + radius) * SCALE, (y + radius) * SCALE),
            fill=fill,
            outline=outline,
            width=width * SCALE,
        )

    def text(self, xy, value, size, fill, bold=False, mono=False, anchor=None, spacing=4):
        self.draw.multiline_text(
            (xy[0] * SCALE, xy[1] * SCALE),
            value,
            font=font(size, bold, mono),
            fill=fill,
            anchor=anchor,
            spacing=spacing * SCALE,
        )

    def icon(self, xy, size):
        source = Image.open(BRAND / "app-icon-512.png").convert("RGBA")
        resized = source.resize((size * SCALE, size * SCALE), Image.Resampling.LANCZOS)
        self.image.paste(resized, (xy[0] * SCALE, xy[1] * SCALE), resized)

    def brand(self, xy, icon_size, word_size, fill=PAPER):
        self.icon(xy, icon_size)
        self.text((xy[0] + icon_size + 13, xy[1] + (icon_size - word_size) / 2 - 3),
                  "JamScript", word_size, fill, bold=True)

    def save(self, path):
        path.parent.mkdir(parents=True, exist_ok=True)
        image = self.image.resize((self.width, self.height), Image.Resampling.LANCZOS)
        image.save(path)


def steps(surface, x, y, cell=22, gap=8):
    for index in range(8):
        on = index in (0, 2, 4, 6)
        left = x + index * (cell + gap)
        surface.rect((left, y, left + cell, y + cell), AMBER if on else "#34394d", radius=4)


def social_card():
    card = Surface(1200, 630, NAVY)
    card.rect((0, 0, 1200, 8), AMBER)
    card.brand((74, 66), 55, 42)
    card.text((76, 170), "THE MUSIC WORKBENCH", 17, AMBER, bold=True)
    card.text((70, 215), "Make music\nin code.", 79, PAPER, bold=True, spacing=1)
    card.text((76, 470), "Turn a knob. Tap a beat.\nKeep the code as your song.", 27, MUTED, spacing=10)

    card.rect((645, 80, 1146, 552), PANEL, radius=14, outline=EDGE, width=2)
    card.rect((645, 80, 1146, 132), "#22263b", radius=14)
    card.rect((645, 118, 1146, 132), "#22263b")
    card.line([(645, 132), (1146, 132)], EDGE, width=1)
    card.text((675, 96), "session.js", 20, PAPER, mono=True)
    for number, y in enumerate((158, 194, 230, 266, 302), start=1):
        card.text((674, y), str(number), 17, "#78809b", mono=True)
    card.text((717, 153), "setcps(0.5)", 21, PAPER, mono=True)
    card.text((717, 189), "stack(", 21, PAPER, mono=True)
    card.text((717, 225), '  s("bd ~ sd ~"),', 21, PAPER, mono=True)
    card.text((717, 261), '  s("hh hh hh hh").gain(0.6)', 21, PAPER, mono=True)
    card.text((717, 297), ")", 21, PAPER, mono=True)
    card.line([(675, 348), (1114, 348)], EDGE, width=1)
    card.text((677, 368), "RHYTHM", 15, MUTED, bold=True)
    steps(card, 677, 404, cell=36, gap=13)
    card.text((677, 488), "CODE IS THE SOURCE", 17, AMBER, bold=True)
    card.text((966, 488), "GAIN", 13, MUTED, bold=True)
    card.circle((1085, 498), 25, "#292e42", outline="#8992ad", width=2)
    card.line([(1085, 498), (1095, 479)], AMBER, width=3)
    card.save(BRAND / "og-image.png")


def nsis_art():
    header = Surface(150, 57, "#ffffff")
    header.icon((8, 9), 38)
    header.text((52, 17), "JamScript", 17, INK, bold=True)
    header.rect((52, 41, 142, 44), AMBER, radius=1)
    header.save(INSTALLER / "nsis-header.bmp")

    sidebar = Surface(164, 314, NAVY)
    sidebar.rect((0, 0, 164, 5), AMBER)
    sidebar.icon((39, 32), 86)
    sidebar.text((24, 148), "JAMSCRIPT", 19, PAPER, bold=True)
    sidebar.text((24, 183), "CODE IS THE\nSOURCE.", 13, MUTED, bold=True, spacing=6)
    for index in range(4):
        sidebar.rect((24 + index * 30, 264, 44 + index * 30, 284), AMBER if index in (0, 2) else EDGE, radius=3)
    sidebar.save(INSTALLER / "nsis-sidebar.bmp")


def wix_art():
    banner = Surface(493, 58, "#ffffff")
    banner.icon((14, 8), 42)
    banner.text((68, 14), "JamScript", 23, INK, bold=True)
    banner.text((317, 19), "MUSIC WORKBENCH", 12, "#575d74", bold=True)
    banner.rect((0, 54, 493, 58), AMBER)
    banner.save(INSTALLER / "wix-banner.bmp")

    dialog = Surface(493, 312, "#ffffff")
    dialog.rect((0, 0, 164, 312), NAVY)
    dialog.rect((0, 0, 164, 5), AMBER)
    dialog.icon((40, 32), 84)
    dialog.text((24, 148), "JAMSCRIPT", 18, PAPER, bold=True)
    dialog.text((24, 186), "WRITE MUSIC.\nPLAY THE CODE.", 12, MUTED, bold=True, spacing=6)
    for index in range(4):
        dialog.rect((24 + index * 30, 263, 44 + index * 30, 283), AMBER if index in (0, 2) else EDGE, radius=3)
    dialog.save(INSTALLER / "wix-dialog.bmp")


def dmg_art():
    dmg = Surface(660, 400, NAVY)
    dmg.rect((0, 0, 660, 5), AMBER)
    dmg.brand((36, 32), 44, 32)
    dmg.text((330, 49), "MUSIC WORKBENCH", 16, AMBER, bold=True)
    dmg.line([(300, 185), (350, 185)], AMBER, width=4)
    dmg.line([(340, 175), (350, 185), (340, 195)], AMBER, width=4)
    dmg.text((330, 315), "DRAG JAMSCRIPT TO APPLICATIONS", 18, PAPER, bold=True, anchor="ma")
    dmg.text((330, 347), "Write the music. Shape it with your hands.", 14, MUTED, anchor="ma")
    dmg.save(INSTALLER / "dmg-background.png")


if __name__ == "__main__":
    social_card()
    nsis_art()
    wix_art()
    dmg_art()
