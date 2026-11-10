"""Generate original ROM archives with Python's standard library only."""
from pathlib import Path
import lzma, struct, zlib, zipfile

root = Path(__file__).resolve().parent
out = root / 'archives'
out.mkdir(exist_ok=True)
rom = (root / 'roms' / 'audio-pulse.nes').read_bytes()
for method, name in [(zipfile.ZIP_STORED, 'stored'), (zipfile.ZIP_DEFLATED, 'deflate')]:
    with zipfile.ZipFile(out / (name + '.zip'), 'w', compression=method) as archive:
        archive.writestr('README.txt', 'Original generated pulse-tone test ROM.')
        archive.writestr('test.nes', rom)

def number(value):
    for count in range(8):
        if value < (1 << (7 + 7 * count)):
            return bytes([((0xff << (8-count)) & 255) | (value >> (8*count))]) + value.to_bytes(8, 'little')[:count]
    return b'\xff' + value.to_bytes(8, 'little')

for method in ['stored', 'lzma', 'lzma2']:
    dictionary = 1 << 20
    if method == 'stored':
        packed, coder = rom, b'\x01\x00'
    elif method == 'lzma':
        packed = lzma.compress(rom, format=lzma.FORMAT_RAW, filters=[{'id':lzma.FILTER_LZMA1, 'dict_size':dictionary, 'lc':3, 'lp':0, 'pb':2}])
        coder = b'\x23\x03\x01\x01\x05\x5d' + struct.pack('<I', dictionary)
    else:
        packed = lzma.compress(rom, format=lzma.FORMAT_RAW, filters=[{'id':lzma.FILTER_LZMA2, 'dict_size':dictionary}])
        coder = b'\x21\x21\x01\x10'
    crc = lambda data: struct.pack('<I', zlib.crc32(data))
    header = b'\x01\x04\x06\x00\x01\x09' + number(len(packed)) + b'\x0a\x01' + crc(packed) + b'\x00'
    header += b'\x07\x0b\x01\x00\x01' + coder + b'\x0c' + number(len(rom)) + b'\x0a\x01' + crc(rom) + b'\x00\x00'
    name = b'\x00' + 'test.nes\0'.encode('utf-16le')
    header += b'\x05\x01\x11' + number(len(name)) + name + b'\x00\x00'
    start = struct.pack('<QQ', len(packed), len(header)) + crc(header)
    (out / (method + '.7z')).write_bytes(b'7z\xbc\xaf\x27\x1c\x00\x04' + crc(start) + start + packed + header)
print('Generated ZIP stored/Deflate and 7z stored/LZMA/LZMA2 fixtures.')
