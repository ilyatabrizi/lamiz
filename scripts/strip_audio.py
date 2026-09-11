#!/usr/bin/env python3
"""Drop the audio track from an MP4 without touching the video stream.

Pure Python, no ffmpeg on this Mac. Removes the 'soun' trak from moov, rebuilds
mdat with only the video chunks (so the audio bytes leave the file too), rewrites
the video track's chunk offsets, and keeps moov ahead of mdat so playback can
start before the download finishes.

    python3 scripts/strip_audio.py in.mp4 out.mp4
"""
import struct
import sys


def read_boxes(buf, start, end):
    out = []
    i = start
    while i + 8 <= end:
        size, typ = struct.unpack(">I4s", buf[i:i + 8])
        hdr = 8
        if size == 1:
            size = struct.unpack(">Q", buf[i + 8:i + 16])[0]
            hdr = 16
        elif size == 0:
            size = end - i
        out.append((typ.decode("latin1"), i, hdr, size))
        i += size
    return out


def find(buf, start, end, path):
    """Locate a nested box by path, e.g. ['mdia', 'minf', 'stbl', 'stco']."""
    for typ, off, hdr, size in read_boxes(buf, start, end):
        if typ == path[0]:
            if len(path) == 1:
                return off, hdr, size
            return find(buf, off + hdr, off + size, path[1:])
    return None


def trak_kind(buf, off, hdr, size):
    h = find(buf, off + hdr, off + size, ["mdia", "hdlr"])
    return buf[h[0] + h[1] + 8:h[0] + h[1] + 12].decode("latin1")


def table(buf, box, entry_fmt):
    off, hdr, size = box
    n = struct.unpack(">I", buf[off + hdr + 4:off + hdr + 8])[0]
    body = buf[off + hdr + 8:off + size]
    step = struct.calcsize(entry_fmt)
    return [struct.unpack(entry_fmt, body[i * step:(i + 1) * step]) for i in range(n)]


def main(src, dst):
    buf = open(src, "rb").read()
    top = read_boxes(buf, 0, len(buf))
    ftyp = next(b for b in top if b[0] == "ftyp")
    moov = next(b for b in top if b[0] == "moov")
    mdat = next(b for b in top if b[0] == "mdat")

    traks = [b for b in read_boxes(buf, moov[1] + moov[2], moov[1] + moov[3]) if b[0] == "trak"]
    video = next(t for t in traks if trak_kind(buf, *t[1:]) == "vide")
    dropped = [t for t in traks if t is not video]

    # --- the video track's chunks -----------------------------------------
    stbl = ["mdia", "minf", "stbl"]
    stco = find(buf, video[1] + video[2], video[1] + video[3], stbl + ["stco"])
    co64 = None
    if stco is None:
        co64 = find(buf, video[1] + video[2], video[1] + video[3], stbl + ["co64"])
    stsc = find(buf, video[1] + video[2], video[1] + video[3], stbl + ["stsc"])
    stsz = find(buf, video[1] + video[2], video[1] + video[3], stbl + ["stsz"])
    offsets = [e[0] for e in table(buf, stco or co64, ">I" if stco else ">Q")]
    runs = table(buf, stsc, ">III")                       # first_chunk, samples_per_chunk, desc
    o, h, s = stsz
    sample_size, count = struct.unpack(">II", buf[o + h + 4:o + h + 12])
    sizes = [sample_size] * count if sample_size else [x[0] for x in table(buf, (o, h + 4, s), ">I")]

    # samples per chunk, expanded from the run table
    per_chunk = []
    for i, (first, n, _) in enumerate(runs):
        last = runs[i + 1][0] - 1 if i + 1 < len(runs) else len(offsets)
        per_chunk += [n] * (last - first + 1)
    assert len(per_chunk) == len(offsets), (len(per_chunk), len(offsets))
    assert sum(per_chunk) == len(sizes), (sum(per_chunk), len(sizes))

    chunk_len, k = [], 0
    for n in per_chunk:
        chunk_len.append(sum(sizes[k:k + n]))
        k += n

    # --- new moov: everything but the dropped traks ------------------------
    new_moov = bytearray()
    for typ, off, hdr, size in read_boxes(buf, moov[1] + moov[2], moov[1] + moov[3]):
        if (typ, off, hdr, size) in dropped:
            continue
        new_moov += buf[off:off + size]
    moov_bytes = struct.pack(">I4s", 8 + len(new_moov), b"moov") + bytes(new_moov)

    # --- new mdat with the video chunks only, in file order ------------------
    order = sorted(range(len(offsets)), key=lambda i: offsets[i])
    mdat_hdr = 8
    mdat_start = ftyp[3] + len(moov_bytes)
    new_offsets = [0] * len(offsets)
    payload = bytearray()
    pos = mdat_start + mdat_hdr
    for i in order:
        new_offsets[i] = pos
        chunk = buf[offsets[i]:offsets[i] + chunk_len[i]]
        payload += chunk
        pos += len(chunk)
    mdat_bytes = struct.pack(">I4s", mdat_hdr + len(payload), b"mdat") + bytes(payload)

    # --- patch the offsets inside the new moov -------------------------------
    out = bytearray(buf[ftyp[1]:ftyp[1] + ftyp[3]] + moov_bytes + mdat_bytes)
    m_off = ftyp[3]
    vt = next(b for b in read_boxes(out, m_off + 8, m_off + len(moov_bytes)) if b[0] == "trak")
    box = find(out, vt[1] + vt[2], vt[1] + vt[3], stbl + ["stco"]) or find(out, vt[1] + vt[2], vt[1] + vt[3], stbl + ["co64"])
    bo, bh, bs = box
    fmt = ">I" if out[bo + 4:bo + 8] == b"stco" else ">Q"
    for i, v in enumerate(new_offsets):
        p = bo + bh + 8 + i * struct.calcsize(fmt)
        out[p:p + struct.calcsize(fmt)] = struct.pack(fmt, v)

    open(dst, "wb").write(out)
    print(f"  {src}: {len(buf)/1e6:.2f} MB → {dst}: {len(out)/1e6:.2f} MB; dropped {len(dropped)} track(s); "
          f"{len(offsets)} video chunks, {len(sizes)} samples")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
