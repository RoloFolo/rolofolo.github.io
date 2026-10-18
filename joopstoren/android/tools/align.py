"""zipalign: rewrite an APK so every uncompressed entry starts on a 4-byte boundary.

Android 11+ refuses apps (targetSdk 30+) whose resources.arsc is not aligned.
Usage: python3 align.py <in.apk> <out.apk>
"""
import struct
import sys
import zipfile

ALIGNMENT_EXTRA = 0xD935  # the extra field zipalign itself uses: id, size, alignment, zero padding

src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, 'w', compresslevel=9) as zout:
    for info in zin.infolist():
        data = zin.read(info)
        entry = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        entry.compress_type = info.compress_type
        entry.external_attr = info.external_attr
        if info.compress_type == zipfile.ZIP_STORED:
            data_start = zout.fp.tell() + 30 + len(info.filename.encode()) + 6
            pad = -data_start % 4
            entry.extra = struct.pack('<HHH', ALIGNMENT_EXTRA, 2 + pad, 4) + b'\0' * pad
        zout.writestr(entry, data)
