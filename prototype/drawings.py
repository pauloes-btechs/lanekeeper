"""Generate the Lanekeeper LK-01 dimension sheet and spec sheet as HTML/SVG.
All measurements in millimetres and match the 3D render (hero.html)."""
import math

# ---- geometry (mm), same numbers as the 3D model ----
L, W, H = 1300, 800, 550
TUB_BOT, TUB_TOP = 80, 280          # lower tub
BAND_TOP = 320                      # green band 270-320
SHELL_L, SHELL_W, SHELL_TOP = 1140, 740, 500
LID_L, LID_W, LID_TOP = 440, 620, 533
LID_C = 300                         # lid centre, toward the rear
BEACON_TOP = 550
WHEEL_D = 220
AXLE_F, AXLE_R = -400, 420          # from body centre, front is negative
TRACK = 730
BROOM_D, BROOM_X, BROOM_Z = 340, 280, -470
SWEEP = 2 * (BROOM_X + BROOM_D / 2)   # 900
CAM_H, CAM_TILT = 410, 20
CAM_REACH = CAM_H / math.tan(math.radians(CAM_TILT))
LANE = 1500

INK = '#1d2228'; MUTE = '#6b7380'; GRID = '#d8d5cc'; PAPER = '#f4f2ec'
GREEN = '#2f8f5b'; AMBER = '#c9821f'; BLUE = '#2f6fb3'; RED = '#b5432a'
FONT = "'DejaVu Sans Condensed','DejaVu Sans',sans-serif"; MONO = "'DejaVu Sans Mono',monospace"; DISP = "'Inter Display','Inter',sans-serif"

def dim(x1, y1, x2, y2, label, off=30, side=1, size=15):
    """Dimension line between two points with extension lines; off in px, side flips."""
    dx, dy = x2 - x1, y2 - y1; ln = math.hypot(dx, dy); nx, ny = -dy / ln * side, dx / ln * side
    a1 = (x1 + nx * off, y1 + ny * off); a2 = (x2 + nx * off, y2 + ny * off)
    mx, my = (a1[0] + a2[0]) / 2, (a1[1] + a2[1]) / 2
    ang = math.degrees(math.atan2(dy, dx))
    if ang > 90 or ang <= -90: ang += 180
    lx, ly = mx + nx * 14, my + ny * 14
    return f'''<g class="dim">
<line x1="{x1 + nx*4:.1f}" y1="{y1 + ny*4:.1f}" x2="{a1[0] + nx*6:.1f}" y2="{a1[1] + ny*6:.1f}" stroke="{MUTE}" stroke-width="1"/>
<line x1="{x2 + nx*4:.1f}" y1="{y2 + ny*4:.1f}" x2="{a2[0] + nx*6:.1f}" y2="{a2[1] + ny*6:.1f}" stroke="{MUTE}" stroke-width="1"/>
<line x1="{a1[0]:.1f}" y1="{a1[1]:.1f}" x2="{a2[0]:.1f}" y2="{a2[1]:.1f}" stroke="{INK}" stroke-width="1.2" marker-start="url(#tick)" marker-end="url(#tick)"/>
<text x="{lx:.1f}" y="{ly + size*0.35:.1f}" font-family="{MONO}" font-size="{size}" fill="{INK}" text-anchor="middle" transform="rotate({ang:.1f} {lx:.1f} {ly:.1f})" paint-order="stroke" stroke="{PAPER}" stroke-width="5">{label}</text></g>'''

def callout(x, y, tx, ty, text, anchor='start'):
    return f'''<g><circle cx="{x}" cy="{y}" r="3" fill="{INK}"/><polyline points="{x},{y} {tx},{ty} {tx + (40 if anchor=='start' else -40)},{ty}" fill="none" stroke="{INK}" stroke-width="1"/>
<text x="{tx + (46 if anchor=='start' else -46)}" y="{ty + 5}" font-family="{FONT}" font-size="15" fill="{INK}" text-anchor="{anchor}" paint-order="stroke" stroke="{PAPER}" stroke-width="5">{text}</text></g>'''

DEFS = f'''<defs>
<marker id="tick" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M2 8 L8 2" stroke="{INK}" stroke-width="1.6"/></marker>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="{MUTE}" stroke-width="1"/></pattern>
<pattern id="lanefill" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="{GREEN}" fill-opacity="0.16"/></pattern>
</defs>'''

def view_label(x, y, n, title, scale_txt):
    return f'''<g><circle cx="{x+16}" cy="{y-6}" r="16" fill="none" stroke="{INK}" stroke-width="1.4"/><text x="{x+16}" y="{y-1}" text-anchor="middle" font-family="{DISP}" font-weight="700" font-size="15" fill="{INK}">{n}</text>
<text x="{x+44}" y="{y}" font-family="{DISP}" font-weight="700" font-size="21" fill="{INK}" letter-spacing="1">{title}</text>
<text x="{x+44}" y="{y+20}" font-family="{MONO}" font-size="12.5" fill="{MUTE}">{scale_txt}</text></g>'''

# ================= SHEET 1: dimensions =================
SW, SH = 2400, 1560
S = 0.42   # px per mm in views 1-3

def side_view(ox, oy):
    """Side view, front to the left. ox = front of body, oy = ground line. y up is negative."""
    X = lambda z: ox + (z + L / 2) * S          # z from -650 (front) to +650 (rear)
    Y = lambda h: oy - h * S
    o = []
    o.append(f'<line x1="{ox - 560}" y1="{oy}" x2="{X(L/2) + 80}" y2="{oy}" stroke="{INK}" stroke-width="2"/>')
    o.append(f'<rect x="{ox - 560}" y="{oy}" width="{X(L/2) + 640 - ox}" height="10" fill="url(#hatch)"/>')
    # camera field of view to the ground ahead
    cx, cy = X(-L/2 + 30), Y(CAM_H)
    gx = cx - CAM_REACH * S
    o.append(f'<polygon points="{cx},{cy} {gx - 90},{oy} {gx + 120},{oy}" fill="{BLUE}" fill-opacity="0.08"/>')
    o.append(f'<line x1="{cx}" y1="{cy}" x2="{gx}" y2="{oy}" stroke="{BLUE}" stroke-width="1.4" stroke-dasharray="7 5"/>')
    o.append(f'<path d="M {cx - 70} {cy} A 70 70 0 0 0 {cx - 70*math.cos(math.radians(CAM_TILT)):.1f} {cy + 70*math.sin(math.radians(CAM_TILT)):.1f}" fill="none" stroke="{BLUE}" stroke-width="1.2"/>')
    o.append(f'<line x1="{cx - 90}" y1="{cy}" x2="{cx}" y2="{cy}" stroke="{BLUE}" stroke-width="1" stroke-dasharray="3 4"/>')
    o.append(f'<text x="{cx - 104}" y="{cy + 18}" font-family="{MONO}" font-size="14" fill="{BLUE}" text-anchor="end">20° down</text>')
    # body
    o.append(f'<rect x="{X(-L/2)}" y="{Y(TUB_TOP)}" width="{L*S}" height="{(TUB_TOP-TUB_BOT)*S}" rx="{40*S}" fill="#2b2f35" stroke="{INK}" stroke-width="1.6"/>')
    o.append(f'<rect x="{X(-L/2)+2}" y="{Y(BAND_TOP)}" width="{L*S-4}" height="{(BAND_TOP-270)*S}" rx="4" fill="{GREEN}" stroke="{INK}" stroke-width="1.2"/>')
    o.append(f'<rect x="{X(-SHELL_L/2)}" y="{Y(SHELL_TOP)}" width="{SHELL_L*S}" height="{(SHELL_TOP-300)*S}" rx="{35*S}" fill="#fbfaf7" stroke="{INK}" stroke-width="1.6"/>')
    o.append(f'<rect x="{X(LID_C - LID_L/2)}" y="{Y(LID_TOP)}" width="{LID_L*S}" height="{(LID_TOP-SHELL_TOP)*S}" rx="3" fill="#15191e" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(240-35)}" y="{Y(BEACON_TOP)}" width="{70*S}" height="{(BEACON_TOP-SHELL_TOP)*S}" rx="3" fill="{AMBER}" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(-L/2)-2}" y="{Y(CAM_H+42)}" width="{14*S+4}" height="{84*S}" rx="2" fill="#15191e"/>')
    o.append(f'<rect x="{X(-L/2)-6}" y="{Y(160)}" width="{10}" height="{60*S}" rx="3" fill="#111"/>')
    # wheels and brooms
    for z in (AXLE_F, AXLE_R):
        o.append(f'<circle cx="{X(z)}" cy="{Y(WHEEL_D/2)}" r="{WHEEL_D/2*S}" fill="#1a1a1a" stroke="{INK}" stroke-width="1.4"/><circle cx="{X(z)}" cy="{Y(WHEEL_D/2)}" r="{65*S}" fill="#8a9099"/>')
    bx = X(BROOM_Z)
    o.append(f'<ellipse cx="{bx}" cy="{oy - 10}" rx="{BROOM_D/2*S}" ry="9" fill="{AMBER}" fill-opacity="0.85" stroke="{INK}" stroke-width="1"/>')
    # dimensions
    o.append(dim(X(-L/2), oy + 60, X(L/2), oy + 60, '1300', off=0))
    o.append(dim(X(AXLE_F), Y(WHEEL_D/2), X(AXLE_R), Y(WHEEL_D/2), 'wheelbase 820', off=-0, side=1) if False else '')
    o.append(dim(X(AXLE_F), oy + 26, X(AXLE_R), oy + 26, '820 wheelbase', off=0, size=13))
    o.append(dim(X(L/2) + 20, oy, X(L/2) + 20, Y(BEACON_TOP), '550', off=50, side=1))
    o.append(dim(X(L/2) + 20, oy, X(L/2) + 20, Y(SHELL_TOP), '500', off=14, side=1, size=13))
    o.append(dim(X(-L/2) - 10, oy, X(-L/2) - 10, Y(CAM_H), '410 camera', off=34, side=-1, size=13))
    o.append(dim(gx, oy + 26, X(-L/2) + 6, oy + 26, f'{CAM_REACH:.0f} to first ground view', off=0, size=13))
    o.append(dim(X(AXLE_R) + 140, oy, X(AXLE_R) + 140, Y(TUB_BOT), '80', off=0, size=12))
    o.append(callout(X(LID_C), Y(LID_TOP), X(LID_C) + 40, Y(LID_TOP) - 70, 'Sealed glass hopper, 60 L'))
    o.append(callout(X(240), Y(BEACON_TOP), X(240) - 10, Y(BEACON_TOP) - 120, 'Amber beacon'))
    o.append(callout(X(-L/2) + 4, Y(CAM_H), X(-L/2) + 120, Y(CAM_H) - 150, 'Stereo camera + polarized strobe'))
    o.append(callout(bx - 30, oy - 8, bx - 150, oy - 64, 'Side broom Ø340', anchor='end'))
    return '\n'.join(o)

def front_view(cx, oy):
    X = lambda x: cx + x * S
    Y = lambda h: oy - h * S
    o = [f'<line x1="{X(-700)}" y1="{oy}" x2="{X(700)}" y2="{oy}" stroke="{INK}" stroke-width="2"/>',
         f'<rect x="{X(-700)}" y="{oy}" width="{1400*S}" height="10" fill="url(#hatch)"/>']
    for x in (-TRACK/2, TRACK/2):
        o.append(f'<rect x="{X(x-35)}" y="{Y(WHEEL_D)}" width="{70*S}" height="{WHEEL_D*S}" rx="6" fill="#1a1a1a" stroke="{INK}" stroke-width="1.2"/>')
    for x in (-BROOM_X, BROOM_X):
        o.append(f'<ellipse cx="{X(x)}" cy="{oy - 8}" rx="{BROOM_D/2*S}" ry="8" fill="{AMBER}" fill-opacity="0.85" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(-W/2)}" y="{Y(TUB_TOP)}" width="{W*S}" height="{(TUB_TOP-TUB_BOT)*S}" rx="{40*S}" fill="#2b2f35" stroke="{INK}" stroke-width="1.6"/>')
    o.append(f'<rect x="{X(-300)}" y="{Y(282)}" width="{600*S}" height="{22*S}" rx="3" fill="#ffffff" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(-W/2)+2}" y="{Y(BAND_TOP)}" width="{W*S-4}" height="{50*S}" rx="4" fill="{GREEN}" stroke="{INK}" stroke-width="1.2"/>')
    o.append(f'<rect x="{X(-SHELL_W/2)}" y="{Y(SHELL_TOP)}" width="{SHELL_W*S}" height="{200*S}" rx="{35*S}" fill="#fbfaf7" stroke="{INK}" stroke-width="1.6"/>')
    o.append(f'<rect x="{X(-350)}" y="{Y(CAM_H+42)}" width="{700*S}" height="{84*S}" rx="4" fill="#15191e"/>')
    for x in (-70, 70):
        o.append(f'<circle cx="{X(x)}" cy="{Y(CAM_H)}" r="{22*S}" fill="#2a3a4c" stroke="#7fa0c2" stroke-width="1"/>')
    o.append(f'<circle cx="{X(0)}" cy="{Y(CAM_H)}" r="{30*S}" fill="none" stroke="#dff1ff" stroke-width="2"/>')
    o.append(f'<rect x="{X(-LID_W/2)}" y="{Y(LID_TOP)}" width="{LID_W*S}" height="{(LID_TOP-SHELL_TOP)*S}" rx="3" fill="#15191e"/>')
    o.append(f'<rect x="{X(240-35)}" y="{Y(BEACON_TOP)}" width="{70*S}" height="{(BEACON_TOP-SHELL_TOP)*S}" rx="3" fill="{AMBER}" stroke="{INK}" stroke-width="1"/>')
    o.append(dim(X(-W/2), Y(BEACON_TOP) - 20, X(W/2), Y(BEACON_TOP) - 20, '800 body', off=0))
    o.append(dim(X(-SWEEP/2), oy + 40, X(SWEEP/2), oy + 40, '900 sweep path', off=0))
    o.append(dim(X(-TRACK/2), oy + 74, X(TRACK/2), oy + 74, '730 track', off=0, size=13))
    o.append(callout(X(0), Y(CAM_H), X(420), Y(CAM_H) - 150, 'Polarized strobe ring'))
    o.append(callout(X(-150), Y(271), X(-480), Y(271) + 10, 'LED light bar', anchor='end'))
    return '\n'.join(o)

def top_view(ox, cy):
    """Top view, front to the left. ox = front of body."""
    X = lambda z: ox + (z + L / 2) * S
    Yp = lambda x: cy + x * S
    o = []
    # lane edges around it for context
    o.append(f'<rect x="{X(-L/2) - 120}" y="{Yp(-LANE/2)}" width="{L*S + 240}" height="{LANE*S}" fill="url(#lanefill)" stroke="none"/>')
    for x in (-LANE/2, LANE/2):
        o.append(f'<line x1="{X(-L/2) - 120}" y1="{Yp(x)}" x2="{X(L/2) + 120}" y2="{Yp(x)}" stroke="{GREEN}" stroke-width="2.5"/>')
    o.append(f'<text x="{X(L/2) + 116}" y="{Yp(-LANE/2) - 10}" font-family="{FONT}" font-size="14" fill="{GREEN}" text-anchor="end">1500 lane, design case</text>')
    # sweep path
    o.append(f'<rect x="{X(-L/2) - 120}" y="{Yp(-SWEEP/2)}" width="{(L/2 + BROOM_Z)*S + 120}" height="{SWEEP*S}" fill="{AMBER}" fill-opacity="0.10" stroke="{AMBER}" stroke-width="1" stroke-dasharray="6 5"/>')
    for x in (-TRACK/2, TRACK/2):
        for z in (AXLE_F, AXLE_R):
            o.append(f'<rect x="{X(z) - WHEEL_D/2*S}" y="{Yp(x) - 35*S}" width="{WHEEL_D*S}" height="{70*S}" rx="4" fill="#1a1a1a"/>')
    o.append(f'<rect x="{X(-L/2)}" y="{Yp(-W/2)}" width="{L*S}" height="{W*S}" rx="{40*S}" fill="#2b2f35" stroke="{INK}" stroke-width="1.6"/>')
    o.append(f'<rect x="{X(-SHELL_L/2)}" y="{Yp(-SHELL_W/2)}" width="{SHELL_L*S}" height="{SHELL_W*S}" rx="{35*S}" fill="#fbfaf7" stroke="{INK}" stroke-width="1.4"/>')
    o.append(f'<rect x="{X(LID_C - LID_L/2)}" y="{Yp(-LID_W/2)}" width="{LID_L*S}" height="{LID_W*S}" rx="5" fill="#15191e"/>')
    o.append(f'<circle cx="{X(240)}" cy="{Yp(240)}" r="{35*S}" fill="{AMBER}" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(-L/2)}" y="{Yp(-350)}" width="{20*S}" height="{700*S}" fill="#15191e"/>')
    for x in (-BROOM_X, BROOM_X):
        pass
    for x in (-BROOM_X, BROOM_X):
        o.append(f'<circle cx="{X(BROOM_Z)}" cy="{Yp(x)}" r="{BROOM_D/2*S}" fill="{AMBER}" fill-opacity="0.12" stroke="{AMBER}" stroke-width="1.6" stroke-dasharray="6 4"/>')
    o.append(f'<text x="{X(BROOM_Z)}" y="{Yp(-BROOM_X) - BROOM_D/2*S - 10}" font-family="{FONT}" font-size="14" fill="{AMBER}" text-anchor="middle">brooms under the nose (hidden)</text>')
    o.append(f'<text x="{X(LID_C)}" y="{cy + 5}" font-family="{FONT}" font-size="14" fill="#e9ecf2" text-anchor="middle">HOPPER</text>')
    o.append(f'<path d="M {X(-L/2) - 10} {cy + 230} l -60 0 m 0 0 l 14 -9 m -14 9 l 14 9" stroke="{INK}" stroke-width="1.6" fill="none"/>')
    o.append(f'<text x="{X(-L/2) - 40}" y="{cy + 214}" font-family="{FONT}" font-size="14" fill="{INK}" text-anchor="middle">travel</text>')
    o.append(dim(X(-L/2), Yp(LANE/2) + 30, X(L/2), Yp(LANE/2) + 30, '1300', off=0))
    o.append(dim(X(L/2) + 40, Yp(-W/2), X(L/2) + 40, Yp(W/2), '800', off=0))
    o.append(dim(X(-L/2) - 90, Yp(-SWEEP/2), X(-L/2) - 90, Yp(SWEEP/2), '900', off=0))
    o.append(dim(X(L/2) + 120, Yp(W/2), X(L/2) + 120, Yp(LANE/2), '350', off=0, size=13))
    return '\n'.join(o)

def lane_section(cx, oy):
    """Section across a 1500 lane, looking along travel. Robot hugs the curb side."""
    X = lambda x: cx + x * S
    Y = lambda h: oy - h * S
    rx = -LANE/2 + 120 + W/2     # robot centre: 120 from the curb-side lane edge
    o = [f'<rect x="{X(-LANE/2 - 300)}" y="{Y(150)}" width="{300*S}" height="{150*S}" fill="url(#hatch)" stroke="{INK}" stroke-width="1.4"/>',
         f'<text x="{X(-LANE/2 - 150)}" y="{Y(150) - 10}" font-family="{FONT}" font-size="14" fill="{MUTE}" text-anchor="middle">curb + sidewalk</text>',
         f'<rect x="{X(-LANE/2)}" y="{oy}" width="{LANE*S}" height="8" fill="{GREEN}"/>',
         f'<line x1="{X(-LANE/2)}" y1="{oy}" x2="{X(LANE/2 + 250)}" y2="{oy}" stroke="{INK}" stroke-width="2"/>']
    # buffer post
    px = LANE/2 + 80
    o.append(f'<rect x="{X(px) - 4*S*10}" y="{Y(950)}" width="{80*S}" height="{950*S}" rx="6" fill="#f7f7f4" stroke="{INK}" stroke-width="1.2"/>')
    o.append(f'<rect x="{X(px) - 4*S*10}" y="{Y(900)}" width="{80*S}" height="{50*S}" fill="#c9cdd3"/>')
    o.append(f'<text x="{X(px) + 30}" y="{Y(980)}" font-family="{FONT}" font-size="14" fill="{MUTE}">buffer post</text>')
    # robot (front view silhouette)
    o.append(f'<rect x="{X(rx - W/2)}" y="{Y(TUB_TOP)}" width="{W*S}" height="{(TUB_TOP - TUB_BOT)*S}" rx="10" fill="#2b2f35" stroke="{INK}" stroke-width="1.4"/>')
    o.append(f'<rect x="{X(rx - W/2)}" y="{Y(BAND_TOP)}" width="{W*S}" height="{50*S}" rx="4" fill="{GREEN}" stroke="{INK}" stroke-width="1"/>')
    o.append(f'<rect x="{X(rx - SHELL_W/2)}" y="{Y(SHELL_TOP)}" width="{SHELL_W*S}" height="{200*S}" rx="10" fill="#fbfaf7" stroke="{INK}" stroke-width="1.4"/>')
    for x in (-TRACK/2, TRACK/2):
        o.append(f'<rect x="{X(rx + x - 35)}" y="{Y(WHEEL_D)}" width="{70*S}" height="{WHEEL_D*S}" rx="5" fill="#1a1a1a"/>')
    # passing rider, front view: pedals pass beside the robot, handlebars pass over it
    rcx = (rx + W/2 + LANE/2) / 2          # centre of the open space
    o.append(f'<rect x="{X(rcx - 18)}" y="{Y(700)}" width="{36*S}" height="{700*S}" rx="6" fill="{BLUE}" fill-opacity="0.35"/>')
    o.append(f'<rect x="{X(rcx - 175)}" y="{Y(320)}" width="{350*S}" height="{50*S}" rx="6" fill="{BLUE}" fill-opacity="0.12" stroke="{BLUE}" stroke-width="1.4" stroke-dasharray="6 4"/>')
    o.append(f'<rect x="{X(rcx - 300)}" y="{Y(1020)}" width="{600*S}" height="{40*S}" rx="6" fill="{BLUE}" fill-opacity="0.12" stroke="{BLUE}" stroke-width="1.4" stroke-dasharray="6 4"/>')
    o.append(f'<line x1="{X(rcx)}" y1="{Y(980)}" x2="{X(rcx)}" y2="{Y(700)}" stroke="{BLUE}" stroke-width="2"/>')
    o.append(f'<text x="{X(rcx - 320)}" y="{Y(1000) + 5}" font-family="{FONT}" font-size="14" fill="{BLUE}" text-anchor="end">handlebar 600 passes over the robot</text>')
    o.append(f'<text x="{X(rcx)}" y="{Y(345)}" font-family="{FONT}" font-size="14" fill="{BLUE}" text-anchor="middle" paint-order="stroke" stroke="{PAPER}" stroke-width="5">pedals 350</text>')
    o.append(dim(X(rx + W/2), Y(220), X(rcx - 175), Y(220), f'{rcx - 175 - (rx + W/2):.0f}', off=0, size=12))
    o.append(dim(X(-LANE/2), oy + 40, X(LANE/2), oy + 40, '1500 lane', off=0))
    o.append(dim(X(rx + W/2), Y(SHELL_TOP) - 40, X(LANE/2), Y(SHELL_TOP) - 40, '580 open beside the robot', off=0, size=13))
    o.append(dim(X(-LANE/2), Y(SHELL_TOP) - 40, X(rx - W/2), Y(SHELL_TOP) - 40, '120', off=0, size=13))
    o.append(dim(X(rx - W/2), oy + 78, X(rx + W/2), oy + 78, '800', off=0, size=13))
    o.append(f'<text x="{X(rx)}" y="{Y(BAND_TOP) + 16}" font-family="{MONO}" font-size="11" fill="#fff" text-anchor="middle">LK-01</text>')
    return '\n'.join(o)

def title_block(x, y, w, h, sheet, title):
    rows = [('PROJECT', 'Lanekeeper bike-lane sweeper'), ('MODEL', 'LK-01 concept prototype'), ('SHEET', f'{sheet} of 2  ·  {title}'), ('UNITS', 'millimetres  ·  all views same scale'), ('DATE', '2026-10-12  ·  REV A'), ('STATUS', 'Design targets, not measured')]
    o = [f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="#fbfaf7" stroke="{INK}" stroke-width="1.6"/>',
         f'<text x="{x+20}" y="{y+42}" font-family="{DISP}" font-weight="800" font-size="30" fill="{INK}" letter-spacing="2">LANEKEEPER</text>',
         f'<rect x="{x+w-34}" y="{y+20}" width="16" height="16" rx="3" fill="{GREEN}"/>']
    ry = y + 62
    for k, v in rows:
        o.append(f'<line x1="{x}" y1="{ry}" x2="{x+w}" y2="{ry}" stroke="{GRID}" stroke-width="1"/>')
        o.append(f'<text x="{x+20}" y="{ry+24}" font-family="{MONO}" font-size="12" fill="{MUTE}" letter-spacing="1">{k}</text>')
        o.append(f'<text x="{x+120}" y="{ry+24}" font-family="{FONT}" font-size="16" fill="{INK}">{v}</text>')
        ry += 36
    return '\n'.join(o)

def frame(content, w, h):
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>html,body{{margin:0;background:{PAPER}}}</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{DEFS}
<rect width="{w}" height="{h}" fill="{PAPER}"/>
<rect x="24" y="24" width="{w-48}" height="{h-48}" fill="none" stroke="{INK}" stroke-width="2"/>
<rect x="34" y="34" width="{w-68}" height="{h-68}" fill="none" stroke="{INK}" stroke-width="0.8"/>
{content}</svg><script>window.__done = true;</script></body></html>'''

sheet1 = []
sheet1.append(f'<text x="70" y="102" font-family="{DISP}" font-weight="800" font-size="40" fill="{INK}">LK-01 fits a 1500 mm bike lane and leaves 580 mm for a rider to pass</text>')
sheet1.append(f'<text x="70" y="136" font-family="{FONT}" font-size="19" fill="{MUTE}">General arrangement: body 1300 × 800 × 550 mm, 900 mm sweep path, camera 410 mm off the ground looking 20° down.</text>')
sheet1.append(f'<line x1="70" y1="160" x2="{SW-70}" y2="160" stroke="{INK}" stroke-width="1"/>')
sheet1.append(view_label(70, 222, '1', 'SIDE VIEW', 'front to the left'))
sheet1.append(side_view(640, 560))
sheet1.append(view_label(1430, 222, '2', 'FRONT VIEW', 'looking at the camera'))
sheet1.append(front_view(1700, 560))
sheet1.append(f'<line x1="70" y1="720" x2="{SW-70}" y2="720" stroke="{GRID}" stroke-width="1"/>')
sheet1.append(view_label(70, 782, '3', 'TOP VIEW', 'in a 1500 mm lane, front to the left'))
sheet1.append(top_view(330, 1100))
sheet1.append(view_label(1300, 782, '4', 'LANE SECTION', 'rider passing a working robot'))
sheet1.append(lane_section(1530, 1290))
sheet1.append(title_block(1940, 1240, 410, 284, 1, 'General arrangement'))
open('dimensions.html', 'w').write(frame('\n'.join(sheet1), SW, SH))

# ================= SHEET 2: specifications =================
SPECS = [
 ('Body', [('Size (L × W × H)', '1300 × 800 × 550 mm'), ('Ground clearance', '80 mm'), ('Mass', '160 kg target'), ('Wheels', '4 × Ø220 mm, 820 wheelbase, 730 track')]),
 ('Drive and power', [('Speed', '6 km/h sweeping, 12 km/h transit'), ('Battery', '48 V LiFePO4, 4.8 kWh target'), ('Run time', '2.5 h: the 4–6 a.m. window plus transit'), ('Range per night', '10–12 km of lane'), ('Charging', 'Rear dock contacts at the depot, about 3 h')]),
 ('Sweeping', [('Brooms', '2 × Ø340 mm nylon side brooms'), ('Pickup', 'Center roller and vacuum'), ('Hopper', '60 L, sealed, puncture-proof liner'), ('Sweep path', '900 mm')]),
 ('Sensing and compute', [('Front camera', 'Stereo RGB at 410 mm, 20° down'), ('Glass flash', 'Cross-polarized strobe ring'), ('Rear camera', 'After-photo of each cleared spot'), ('Position', 'RTK GNSS + wheel odometry, 25 m lane cells'), ('On-board detector', 'Edge computer, ~30 fps, under 50 ms'), ('Stop sensing', 'Ultrasonic + front bumper contact strip')]),
 ('Data and connectivity', [('Link', 'LTE / 5G; buffers offline, syncs at dock'), ('Database', 'Supabase Postgres + PostGIS'), ('Live feed', 'Supabase Realtime, every cleared spot'), ('Rider reports', 'Text a photo to GLASS (45277), or WhatsApp')]),
 ('Safety and privacy', [('Presence', 'Amber beacon, front LED bar, red tail lights'), ('Rider priority', 'Stops for anything in its path'), ('Pilot', 'Attendant with emergency stop on every run'), ('Privacy', 'Faces and plates blurred on the robot; frames deleted after 30 days')]),
]
GEMINI = [('Model IDs', 'gemini-robotics-er-2-preview (frames) · gemini-robotics-er-2-streaming-preview (live video, optional)'), ('Job', 'Confirms glass, points at each cluster, estimates the piece count'), ('Output', 'Points as [y, x], normalized 0–1000, plus a shard count'), ('Rules out', 'Ice, clear plastic, road reflectors, wet leaves'), ('Runs through', 'verify-glass Supabase function; API key kept server-side'), ('Tested', '2 real street photos, glass found in both (Oct 10, 2026)')]

def spec_block(x, y, w, title, rows, accent=INK):
    o = [f'<text x="{x}" y="{y}" font-family="{DISP}" font-weight="700" font-size="20" fill="{accent}" letter-spacing="0.5">{title}</text>',
         f'<line x1="{x}" y1="{y+12}" x2="{x+w}" y2="{y+12}" stroke="{accent}" stroke-width="1.6"/>']
    ry = y + 40
    for k, v in rows:
        o.append(f'<text x="{x}" y="{ry}" font-family="{FONT}" font-size="15" fill="{MUTE}">{k}</text>')
        # wrap value at ~46 chars
        words, lines, cur = v.split(' '), [], ''
        for wd in words:
            if len(cur) + len(wd) + 1 > 44: lines.append(cur); cur = wd
            else: cur = (cur + ' ' + wd).strip()
        lines.append(cur)
        for i, ln in enumerate(lines):
            o.append(f'<text x="{x+190}" y="{ry + i*20}" font-family="{FONT}" font-size="16" fill="{INK}">{ln}</text>')
        ry += 20 * len(lines) + 12
        o.append(f'<line x1="{x}" y1="{ry-22+10}" x2="{x+w}" y2="{ry-22+10}" stroke="{GRID}" stroke-width="1"/>')
    return '\n'.join(o), ry

def pipeline(x, y, w):
    steps = [('On board', 'Strobe flash + edge detector flags glass, brooms drop', '<50 ms'), ('Gemini Robotics-ER 2', 'Verifies the frame, points at each cluster, counts pieces', 'per flagged frame'), ('Plan', 'Shifts line, slows, widens brooms over the cluster', 'per cluster'), ('Prove', 'Rear camera re-checks the spot; Gemini confirms it is clear', 'after the pass'), ('Log', 'Cleared spot written to Supabase, map and run report update', '1 write per spot')]
    n = len(steps); gap = 26; bw = (w - gap * (n - 1)) / n
    o = [f'<text x="{x}" y="{y - 22}" font-family="{DISP}" font-weight="700" font-size="20" fill="{INK}">How a glass spot gets cleared</text>',
         f'<marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z" fill="{INK}"/></marker>']
    for i, (t, d, lat) in enumerate(steps):
        bx = x + i * (bw + gap); hot = i == 1
        o.append(f'<rect x="{bx}" y="{y}" width="{bw}" height="132" rx="8" fill="{BLUE if hot else "#fbfaf7"}" fill-opacity="{0.1 if hot else 1}" stroke="{BLUE if hot else INK}" stroke-width="{2 if hot else 1.2}"/>')
        o.append(f'<text x="{bx+16}" y="{y+30}" font-family="{MONO}" font-size="13" fill="{BLUE if hot else MUTE}">{i+1:02d}</text>')
        o.append(f'<text x="{bx+48}" y="{y+30}" font-family="{DISP}" font-weight="700" font-size="17" fill="{INK}">{t}</text>')
        words, lines, cur = d.split(' '), [], ''
        for wd in words:
            if len(cur) + len(wd) + 1 > 34: lines.append(cur); cur = wd
            else: cur = (cur + ' ' + wd).strip()
        lines.append(cur)
        for k, ln in enumerate(lines):
            o.append(f'<text x="{bx+16}" y="{y+60 + k*19}" font-family="{FONT}" font-size="15" fill="{INK}">{ln}</text>')
        o.append(f'<text x="{bx+16}" y="{y+120}" font-family="{MONO}" font-size="12.5" fill="{BLUE if hot else MUTE}">{lat}</text>')
        if i < n - 1:
            o.append(f'<line x1="{bx+bw+3}" y1="{y+66}" x2="{bx+bw+gap-3}" y2="{y+66}" stroke="{INK}" stroke-width="1.6" marker-end="url(#arr)"/>')
    return '\n'.join(o)

s2 = []
s2.append(f'<text x="70" y="102" font-family="{DISP}" font-weight="800" font-size="40" fill="{INK}">LK-01 specifications: a night sweeper that sees glass with Gemini</text>')
s2.append(f'<text x="70" y="136" font-family="{FONT}" font-size="19" fill="{MUTE}">Concept prototype. Figures are design targets for the 90-day pilot, except the Gemini test results, which were measured.</text>')
s2.append(f'<line x1="70" y1="160" x2="{SW-70}" y2="160" stroke="{INK}" stroke-width="1"/>')
# render image in a frame
s2.append(f'<image href="../docs/prototype/lanekeeper-render.jpg" x="70" y="190" width="720" height="405" preserveAspectRatio="xMidYMid slice"/>')
s2.append(f'<rect x="70" y="190" width="720" height="405" fill="none" stroke="{INK}" stroke-width="1.4"/>')
s2.append(f'<text x="70" y="620" font-family="{FONT}" font-size="14" fill="{MUTE}">Render: LK-01 on a protected lane at 5:40 a.m., glass ahead, swept lane behind.</text>')
# Gemini block under the image, highlighted
gb, gy = spec_block(70, 680, 720, 'Vision AI: Google DeepMind Gemini Robotics-ER 2', GEMINI, accent=BLUE)
s2.append(gb)
# spec columns
cols = [(860, 0, 3), (1640, 3, 6)]
for cx, a, b in cols:
    y = 210
    for title, rows in SPECS[a:b]:
        blk, y2 = spec_block(cx, y, 690, title, rows)
        s2.append(blk); y = y2 + 30
s2.append(pipeline(860, 960, 1470))
SH2 = 1200
s2.append(f'<text x="70" y="{SH2-58}" font-family="{MONO}" font-size="12.5" fill="{MUTE}">LANEKEEPER · LK-01 · SHEET 2 OF 2 · SPECIFICATIONS · REV A · 2026-10-12</text>')
open('specs.html', 'w').write(frame('\n'.join(s2), SW, SH2))
print('ok', round(CAM_REACH), SWEEP)
