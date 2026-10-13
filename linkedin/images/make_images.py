"""Draws the LinkedIn images for the Lead CRM launch kit (python3 make_images.py)."""
from PIL import Image, ImageDraw, ImageFont
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/opentype/inter/Inter-{}.otf'
NAVY, TEAL, ORANGE, RED = (31, 56, 100), (17, 122, 101), (230, 126, 34), (192, 57, 43)
INK, MUTED, LIGHT, WHITE, GREY = (27, 38, 49), (86, 101, 115), (238, 242, 247), (255, 255, 255), (242, 243, 244)
ICE = (202, 220, 252)


def f(size, weight='Regular'):
    return ImageFont.truetype(FONT.format(weight), size)


def wrap(d, text, font, width):
    lines, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def para(d, xy, text, font, fill, width, gap=1.25):
    x, y = xy
    for line in wrap(d, text, font, width):
        d.text((x, y), line, font=font, fill=fill)
        y += int(font.size * gap)
    return y


def pill(d, x, y, text, font, bg, fg):
    w = d.textlength(text, font=font) + 36
    d.rounded_rectangle((x, y, x + w, y + font.size + 22), radius=(font.size + 22) // 2, fill=bg)
    d.text((x + 18, y + 10), text, font=font, fill=fg)
    return x + w


def stat(d, x, y, w, h, big, small, color):
    d.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=WHITE)
    d.rectangle((x, y, x + 10, y + h), fill=color)
    d.text((x + 34, y + 22), big, font=f(54, 'ExtraBold'), fill=color)
    para(d, (x + 34, y + 98), small, f(24, 'SemiBold'), MUTED, w - 60)


def mini_sheet(d, x, y, w):
    """A stylised Lead Management sheet: white editable cells, grey locked cells, a red incomplete lead."""
    cols = [('Lead ID', 120, True), ('Name', 150, True), ('Stage', 150, False), ('Next FU', 130, False), ('Updated By', w - 550, True)]
    rows = [['LD-000101', 'Ravi Kumar', 'Interested', '14-Oct', 'Priya'],
            ['LD-000102', 'Asha Rao', 'Contacted', '', 'Amit'],
            ['LD-000103', 'Neha Jain', 'Application', '16-Oct', 'Priya'],
            ['LD-000104', 'Imran K.', 'New Lead', '13-Oct', 'Amit']]
    rh = 46
    cx = x
    for name, cw, locked in cols:
        d.rectangle((cx, y, cx + cw, y + rh), fill=NAVY if not locked else (86, 101, 115))
        d.text((cx + 12, y + 12), name, font=f(19, 'Bold'), fill=WHITE)
        cx += cw
    for i, r in enumerate(rows):
        cy = y + rh * (i + 1)
        cx = x
        for j, (name, cw, locked) in enumerate(cols):
            bg = GREY if locked else WHITE
            fg = INK
            if i == 1 and j < 2:
                bg, fg = (231, 76, 60), WHITE
            d.rectangle((cx, cy, cx + cw, cy + rh), fill=bg, outline=(213, 216, 220))
            d.text((cx + 12, cy + 13), r[j], font=f(19, 'SemiBold' if j == 0 else 'Regular'), fill=fg)
            cx += cw
    return y + rh * (len(rows) + 1)


def toast(d, x, y, w, text):
    d.rounded_rectangle((x + 6, y + 6, x + w + 6, y + 96), radius=14, fill=(200, 205, 212))
    d.rounded_rectangle((x, y, x + w, y + 90), radius=14, fill=(32, 33, 36))
    d.text((x + 24, y + 14), 'Lead CRM', font=f(18, 'Bold'), fill=(138, 180, 248))
    para(d, (x + 24, y + 42), text, f(19), WHITE, w - 48)


def footer(d, W, H, text, color=MUTED):
    d.text((60, H - 70), text, font=f(22, 'SemiBold'), fill=color)


# ---------------------------------------------------------------- 1. Cover 1200x1200
def cover():
    W = H = 1200
    im = Image.new('RGB', (W, H), LIGHT)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 520), fill=NAVY)
    pill(d, 60, 60, 'GOOGLE SHEETS  +  APPS SCRIPT', f(22, 'Bold'), TEAL, WHITE)
    d.text((60, 140), 'A CRM your sales team', font=f(76, 'ExtraBold'), fill=WHITE)
    d.text((60, 228), 'can\'t break.', font=f(76, 'ExtraBold'), fill=ORANGE)
    y = 316
    para(d, (60, y + 20), 'Bad data refused. Wrong edits undone automatically. Missing follow-ups turn red. Zero licence cost.',
         f(32), ICE, 1060, 1.35)
    stats = [('10,000', 'leads, ready on day one', NAVY), ('13', 'dashboard KPIs, 6 charts', TEAL), ('179', 'automated test checks', ORANGE)]
    for i, (b, s_, c) in enumerate(stats):
        stat(d, 60 + i * 366, 470, 346, 170, b, s_, c)
    yb = mini_sheet(d, 60, 700, 760)
    d.text((60, yb + 20), 'Red Lead ID = something is missing.  Grey = automatic or admin only.', font=f(22, 'SemiBold'), fill=MUTED)
    toast(d, 60, yb + 70, 760, 'Lead LD-000102 is assigned to Amit. You can only change your own leads. Your change was undone.')
    para(d, (860, 720), 'What a counsellor sees when they edit someone else\'s lead.', f(24, 'SemiBold'), NAVY, 280, 1.35)
    footer(d, W, H, 'Designed from 5 years of CRM / MIS work  ·  built with Claude Code', NAVY)
    im.save(os.path.join(HERE, '01-cover-1200x1200.png'))


# ---------------------------------------------------------------- 2. Highlights 1080x1350
def highlights():
    W, H = 1080, 1350
    im = Image.new('RGB', (W, H), WHITE)
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W, 230), fill=NAVY)
    d.text((60, 55), 'Counsellor-proof Lead CRM', font=f(58, 'ExtraBold'), fill=WHITE)
    d.text((60, 140), '10 things it does for a sales or admissions team', font=f(30), fill=ICE)
    items = [
        ('Zero licence cost', 'Google Sheets + Apps Script, 11 sheets built in one run'),
        ('Rejects bad data', 'dropdowns, calendar dates, length limits'),
        ('Undoes wrong edits', 'other people\'s leads, system columns, junk pastes'),
        ('Stage -> substage', 'dependent dropdowns that always match'),
        ('Red = incomplete', 'missing follow-up date shows on the dashboard'),
        ('Full audit trail', 'every call, change and refused edit is logged'),
        ('Bulk lead entry', 'automatic IDs, duplicate checks, clear errors'),
        ('Manager dashboard', '13 KPIs, 7 reports, 6 charts'),
        ('Safe delete & reset', 'restore with original ID, go-live reset with backup'),
        ('Optional web app', 'own leads only, Google sign-in, every view logged'),
    ]
    y = 262
    for i, (t, s_) in enumerate(items):
        c = [NAVY, TEAL, ORANGE, RED][i % 4]
        d.ellipse((60, y, 120, y + 60), fill=c)
        num = str(i + 1)
        d.text((90 - d.textlength(num, font=f(28, 'Bold')) / 2, y + 13), num, font=f(28, 'Bold'), fill=WHITE)
        d.text((145, y - 2), t, font=f(32, 'Bold'), fill=INK)
        d.text((145, y + 40), s_, font=f(24), fill=MUTED)
        y += 96
    d.line((60, H - 100, W - 60, H - 100), fill=(213, 216, 220), width=2)
    d.text((60, H - 75), '~6,600 lines  ·  179 test checks  ·  built with Claude Code', font=f(24, 'SemiBold'), fill=NAVY)
    im.save(os.path.join(HERE, '02-highlights-1080x1350.png'))


# ---------------------------------------------------------------- 3. How it works 1200x627
def how():
    W, H = 1200, 627
    im = Image.new('RGB', (W, H), LIGHT)
    d = ImageDraw.Draw(im)
    d.text((60, 45), 'How it works', font=f(48, 'ExtraBold'), fill=NAVY)
    d.text((60, 110), 'Every edit is checked after it happens. Anything not allowed is put back and logged.', font=f(24), fill=MUTED)
    steps = [('Lead Entry', 'Admin pastes leads. Checked row by row, IDs given.', NAVY),
             ('Lead Management', 'Counsellors edit only white cells of their own leads.', TEAL),
             ('Edit guard', 'Wrong edits undone; missing data turns red.', ORANGE),
             ('Log + Dashboard', 'Full history, 13 KPIs, per-counsellor reports.', RED)]
    bw, gap, y0 = 250, 33, 200
    for i, (t, s_, c) in enumerate(steps):
        x = 60 + i * (bw + gap)
        d.rounded_rectangle((x, y0, x + bw, y0 + 300), radius=18, fill=WHITE, outline=c, width=4)
        d.ellipse((x + 24, y0 + 24, x + 84, y0 + 84), fill=c)
        d.text((x + 54 - d.textlength(str(i + 1), font=f(28, 'Bold')) / 2, y0 + 37), str(i + 1), font=f(28, 'Bold'), fill=WHITE)
        para(d, (x + 24, y0 + 105), t, f(28, 'Bold'), INK, bw - 40, 1.15)
        para(d, (x + 24, y0 + 185), s_, f(21), MUTED, bw - 40, 1.35)
        if i < 3:
            ax = x + bw + 4
            d.polygon([(ax, y0 + 140), (ax + gap - 8, y0 + 150), (ax, y0 + 160)], fill=MUTED)
    d.text((60, 545), 'Google Sheets + Apps Script  ·  zero licence cost  ·  10,000 leads', font=f(24, 'SemiBold'), fill=NAVY)
    im.save(os.path.join(HERE, '03-how-it-works-1200x627.png'))


# ---------------------------------------------------------------- 4. Featured 1200x627
def featured():
    W, H = 1200, 627
    im = Image.new('RGB', (W, H), NAVY)
    d = ImageDraw.Draw(im)
    d.rectangle((0, H - 16, W, H), fill=TEAL)
    pill(d, 60, 60, 'PROJECT', f(22, 'Bold'), ORANGE, WHITE)
    y = para(d, (60, 130), 'Counsellor-Proof Lead CRM', f(68, 'ExtraBold'), WHITE, 1080, 1.1)
    y = para(d, (60, y + 10), 'Google Sheets + Apps Script. Bad data refused, wrong edits auto-reverted, 13-KPI dashboard, zero licence cost.',
             f(30), ICE, 1050, 1.35)
    x = 60
    for t in ['10,000 leads', '179 test checks', 'Full audit trail', 'Built with Claude Code']:
        x = pill(d, x, 390, t, f(22, 'SemiBold'), (46, 80, 138), WHITE) + 14
    d.text((60, 520), 'Designed from 5 years of CRM / MIS work with sales counsellors', font=f(24, 'SemiBold'), fill=ICE)
    im.save(os.path.join(HERE, '04-featured-1200x627.png'))


if __name__ == '__main__':
    cover(); highlights(); how(); featured()
    print('done')
