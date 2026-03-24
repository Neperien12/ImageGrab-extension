#!/usr/bin/env python3
"""Generate extension icons as PNG using Pillow."""

import os
import struct
import zlib

def create_png(size):
    """Generate a minimal PNG icon with the given size."""
    # Colors (dark bg + yellow-green accent)
    bg = (15, 15, 17)       # #0f0f11
    accent = (232, 255, 71)  # #e8ff47
    mid = (34, 34, 40)      # #222228

    width = height = size
    raw_rows = []

    for y in range(height):
        row = bytearray()
        row.append(0)  # filter byte
        for x in range(width):
            # Background circle
            cx, cy = width / 2, height / 2
            r = width / 2 - 1
            dx, dy = x - cx, y - cy
            dist = (dx*dx + dy*dy) ** 0.5

            if dist <= r:
                # Inside circle — dark bg
                if dist >= r - max(1, size//12):
                    # Outer ring in accent
                    row.extend(accent)
                    row.append(255)
                else:
                    # Fill with mid color
                    # Draw simple image icon
                    m = size // 8
                    inner = r - max(1, size//12) - 1

                    # Rectangle (image frame)
                    frame_l = cx - inner * 0.55
                    frame_r = cx + inner * 0.55
                    frame_t = cy - inner * 0.45
                    frame_b = cy + inner * 0.55

                    on_frame = (
                        (abs(x - frame_l) < 1.5 or abs(x - frame_r) < 1.5) and frame_t - 1 <= y <= frame_b + 1
                    ) or (
                        (abs(y - frame_t) < 1.5 or abs(y - frame_b) < 1.5) and frame_l - 1 <= x <= frame_r + 1
                    )

                    # Mountain/image inside frame
                    rel_x = (x - frame_l) / (frame_r - frame_l) if frame_r > frame_l else 0
                    rel_y = (y - frame_t) / (frame_b - frame_t) if frame_b > frame_t else 0
                    # Simple triangle peak
                    peak = 0.35
                    mountain = (
                        frame_t < y < frame_b and frame_l < x < frame_r and
                        rel_y > 0.5 - abs(rel_x - 0.5) * 0.8 + peak * 0.1
                    )

                    if on_frame:
                        row.extend(accent)
                        row.append(255)
                    elif mountain and not on_frame:
                        row.extend((50, 50, 60))
                        row.append(255)
                    else:
                        row.extend(bg)
                        row.append(255)
            else:
                # Outside circle — transparent
                row.extend((0, 0, 0))
                row.append(0)

        raw_rows.append(bytes(row))

    raw_data = b''.join(raw_rows)
    compressed = zlib.compress(raw_data, 9)

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png = sig + chunk(b'IHDR', ihdr_data) + chunk(b'IDAT', compressed) + chunk(b'IEND', b'')
    return png

os.makedirs('icons', exist_ok=True)

for size in [16, 48, 128]:
    data = create_png(size)
    with open(f'icons/icon{size}.png', 'wb') as f:
        f.write(data)
    print(f'Created icons/icon{size}.png ({size}x{size})')

print('Done!')
