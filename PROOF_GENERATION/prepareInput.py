import json
import argparse
import subprocess
import os

# ── Helpers ───────────────────────────────────────────────────────────────────

def hex_to_u32_array(hex_str: str, byte: int) -> list:
    """Converte un hash hex in una lista di byte u32 big-endian."""
    hex_str = hex_str.replace('0x', '').replace('0X', '').zfill(byte*8)
    return [int(hex_str[i*8:(i+1)*8], 16) for i in range(byte)]

def get_directions(index: int, levels: int = 3) -> list:
    """Calcola le direzioni nel percorso Merkle per una foglia all'indice dato."""
    directions = []
    for _ in range(levels):
        directions.append(index % 2)
        index //= 2
    return directions

# ── Helper comune ─────────────────────────────────────────────────────────────

def build_args(value: int, salt_hex: str, parametro: int, mt: dict, path: dict) -> list:
    """
    Costruisce la lista di argomenti per ZoKrates nell'ordine del circuit.

    Struttura (44 argomenti totali):
      - value      : u32       (1)
      - salt       : u32[7]    (7)   ← 28 byte = 224 bit
      - parametro  : u32       (1)
      - root       : u32[8]    (8)
      - siblings   : u32[8][3] (24)
      - directions : u32[3]    (3)
    """
    salt       = hex_to_u32_array(salt_hex, 7)
    root       = hex_to_u32_array(mt['root'], 8)
    siblings   = [hex_to_u32_array(s, 8) for s in path['siblings']]
    directions = get_directions(path['index'])

    args = []
    args += [str(value)]                        # private: valore (u32)
    args += [str(v) for v in salt]              # private: salt   (u32[7])
    args += [str(parametro)]                    # pubblico: soglia/codice (u32)
    args += [str(v) for v in root]              # pubblico: root (u32[8])
    for sib in siblings:                        # privato: siblings (u32[8][3])
        args += [str(v) for v in sib]
    args += [str(d) for d in directions]        # privato: directions (u32[3])
    return args

# ── ZoKrates ──────────────────────────────────────────────────────────────────

ZOKRATES_DIR = os.path.join(os.path.dirname(__file__), 'zokrates')

def run_zokrates(claim: str, args: list):
    """Esegue ZoKrates compute-witness e generate-proof al posto di farlo a mano da terminale"""
    circuit_path = os.path.join(ZOKRATES_DIR, claim, 'out')
    proving_key  = os.path.join(ZOKRATES_DIR, claim, 'proving.key')
    witness_path = os.path.join(ZOKRATES_DIR, claim, 'witness')
    proof_path   = os.path.join(ZOKRATES_DIR, claim, 'proof.json')

    for path, name in [(circuit_path, 'out'), (proving_key, 'proving.key')]:
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"File '{name}' non trovato in {ZOKRATES_DIR}/{claim}/. "
                f"Esegui prima 'zokrates compile' e 'zokrates setup'."
            )

    result = subprocess.run(
        ['zokrates', 'compute-witness', '-i', circuit_path, '-o', witness_path, '-a', *args],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        if 'assertion' in result.stderr.lower():
            raise ValueError("Il valore non soddisfa il requisito richiesto.")
        raise RuntimeError(f"compute-witness fallito:\n{result.stderr}")

    result = subprocess.run(
        ['zokrates', 'generate-proof', '-i', circuit_path, '-p', proving_key, '-w', witness_path, '-j', proof_path],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        raise RuntimeError(f"generate-proof fallito:\n{result.stderr}")

    with open(proof_path, 'r') as f:
        return json.load(f)

# ── Main ──────────────────────────────────────────────────────────────────────


# utile solo per test da terminale
if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Genera ZK proof da file JSON')
    parser.add_argument('--input',  default='degree_with_merkle.json')
    parser.add_argument('--claim',  required=True, choices=['grade', 'gpa', 'eqf', 'isced'])
    parser.add_argument('--soglia', type=int, required=True)
    parser.add_argument('--output', default='proof.json')
    args = parser.parse_args()

    with open(args.input, 'r', encoding='utf-8') as f:
        degree = json.load(f)


    mt = degree['merkleTree']
    pathName = ''
    valueName = ''


    if args.claim == 'grade':
        pathName = 'pathGrade'
        valueName = 'finalGrade'
    elif args.claim == 'gpa':
        pathName = 'pathGPA'
        valueName = 'gpaX100'
    elif args.claim == 'eqf':
        pathName = 'pathEQF'
        valueName = 'EQFlevel'
    elif args.claim == 'isced':
        pathName = 'pathISCED'
        valueName = 'iscedDetailed'


    zok_args = build_args(
        value     = degree[valueName],
        salt_hex  = degree['salt'],
        parametro = args.soglia,
        mt        = mt,
        path      = mt[pathName]
    )


    print(f"Claim: {args.claim}, parametro: {args.soglia}")
    print(f"Argomenti ZoKrates ({len(zok_args)}): {zok_args}")
    proof = run_zokrates(args.claim, zok_args)

    with open(args.output, 'w') as f:
        json.dump(proof, f, indent=2)
    print(f"Proof salvata: {args.output}")