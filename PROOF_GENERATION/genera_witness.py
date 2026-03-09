import json, sys

def hex_to_u32x8(h):
    b = bytes.fromhex(h[2:])
    u32s = [int.from_bytes(b[i:i+4], 'big') for i in range(0, 32, 4)]
    return ' '.join(map(str, u32s))

def hex_salt_to_u32x7(h):
    b = bytes.fromhex(h)
    u32s = [int.from_bytes(b[i:i+4], 'big') for i in range(0, 28, 4)]
    return ' '.join(map(str, u32s))

with open(sys.argv[1]) as f:
    d = json.load(f)

tree = d['merkleTree']
path = tree['pathGrade']

voto     = d['finalGrade']
soglia   = 100
salt_str = hex_salt_to_u32x7(d['salt'])
radice   = hex_to_u32x8(tree['root'])
sib0     = hex_to_u32x8(path['siblings'][0])
sib1     = hex_to_u32x8(path['siblings'][1])
sib2     = hex_to_u32x8(path['siblings'][2])

idx  = path['index']
dir0 = 1 if (idx & 1) else 0
dir1 = 1 if ((idx >> 1) & 1) else 0
dir2 = 1 if ((idx >> 2) & 1) else 0

print(f"zokrates compute-witness -a \\")
print(f"  {voto} \\")
print(f"  {salt_str} \\")
print(f"  {soglia} \\")
print(f"  {radice} \\")
print(f"  {sib0} \\")
print(f"  {sib1} \\")
print(f"  {sib2} \\")
print(f"  {dir0} {dir1} {dir2}")