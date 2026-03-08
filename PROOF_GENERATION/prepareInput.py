import json
import argparse
import subprocess
import os

# ── Helpers ───────────────────────────────────────────────────────────────────

# da rifare completamente 


def hex_to_u32_8(hex_str: str) -> list:
    """Converte un hash hex (0x...) in una lista di 8 u32."""
    hex_str = hex_str.replace('0x', '').replace('0X', '').zfill(64)
    return [int(hex_str[i*8:(i+1)*8], 16) for i in range(8)]

def salt_to_u64(salt_str: str) -> int:
    """Converte il salt stringa esadecimale in u64."""
    value = int(salt_str, 16)
    assert value <= 2**64 - 1, "Salt troppo grande per u64"
    return value

def u64_to_u32_pair(value: int) -> tuple:
    """Converte un intero in coppia (high, low) di u32."""
    return (value >> 32) & 0xFFFFFFFF, value & 0xFFFFFFFF

def get_directions(index: int, levels: int = 3) -> list:
    """Calcola le direzioni nel percorso Merkle per una foglia all'indice dato."""
    directions = []
    for _ in range(levels):
        directions.append(index % 2)
        index //= 2
    return directions

# ── Helper comune ─────────────────────────────────────────────────────────────

def _build_args(value: int, salt_val: int, parametro: int, mt: dict, path: dict) -> list:
    """Costruisce la lista di argomenti per ZoKrates nell'ordine del circuit."""
    val_high,  val_low  = u64_to_u32_pair(value)
    salt_high, salt_low = u64_to_u32_pair(salt_val)
    par_high,  par_low  = u64_to_u32_pair(parametro)
    root       = hex_to_u32_8(mt['root'])
    siblings   = [hex_to_u32_8(s) for s in path['siblings']]
    directions = get_directions(path['index'])

    args = []
    args += [str(val_high),  str(val_low)]   # private: valore (high, low)
    args += [str(salt_high), str(salt_low)]  # private: salt   (high, low)
    args += [str(par_high),  str(par_low)]   # pubblico: soglia/codice (high, low)
    args += [str(v) for v in root]           # u32[8] root
    for sib in siblings:                     # u32[8][3] siblings
        args += [str(v) for v in sib]
    args += [str(d) for d in directions]     # u32[3] directions
    return args

# ── Preparazione input per ogni claim ─────────────────────────────────────────

def prepare_grade(degree: dict, soglia: int) -> list:
    """Prepara gli input per grade.zok (finalGrade >= soglia)."""
    mt = degree['merkleTree']
    return _build_args(
        value     = degree['finalGrade'],
        salt_val  = salt_to_u64(degree['salt']),
        parametro = soglia,
        mt        = mt,
        path      = mt['pathGrade']
    )

def prepare_gpa(degree: dict, soglia: int) -> list:
    """Prepara gli input per gpa.zok (gpaX100 >= soglia)."""
    mt = degree['merkleTree']
    return _build_args(
        value     = degree['gpaX100'],
        salt_val  = salt_to_u64(degree['salt']),
        parametro = soglia,
        mt        = mt,
        path      = mt['pathGPA']
    )

def prepare_eqf(degree: dict, soglia: int) -> list:
    """Prepara gli input per eqf.zok (EQFlevel >= soglia)."""
    mt = degree['merkleTree']
    return _build_args(
        value     = degree['EQFlevel'],
        salt_val  = salt_to_u64(degree['salt']),
        parametro = soglia,
        mt        = mt,
        path      = mt['pathEQF']
    )

def prepare_isced(degree: dict, codice: int) -> list:
    """Prepara gli input per isced.zok (iscedDetailed == codice)."""
    mt = degree['merkleTree']
    return _build_args(
        value     = degree['iscedDetailed'],
        salt_val  = salt_to_u64(degree['salt']),
        parametro = codice,
        mt        = mt,
        path      = mt['pathISCED']
    )

# ── ZoKrates ──────────────────────────────────────────────────────────────────

ZOKRATES_DIR = os.path.join(os.path.dirname(__file__), 'zokrates')

def run_zokrates(claim: str, args: list):
    """Esegue ZoKrates compute-witness e generate-proof."""
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

def main():
    parser = argparse.ArgumentParser(description='Genera ZK proof da degree_with_merkle.json')
    parser.add_argument('--input',  default='degree_with_merkle.json')
    parser.add_argument('--claim',  required=True, choices=['grade', 'gpa', 'eqf', 'isced'])
    parser.add_argument('--soglia', type=int, required=True)
    parser.add_argument('--output', default='proof.json')
    args = parser.parse_args()

    with open(args.input, 'r', encoding='utf-8') as f:
        degree = json.load(f)

    if args.claim == 'grade':
        zok_args = prepare_grade(degree, args.soglia)
    elif args.claim == 'gpa':
        zok_args = prepare_gpa(degree, args.soglia)
    elif args.claim == 'eqf':
        zok_args = prepare_eqf(degree, args.soglia)
    elif args.claim == 'isced':
        zok_args = prepare_isced(degree, args.soglia)

    print(f"Claim: {args.claim}, parametro: {args.soglia}")
    proof = run_zokrates(args.claim, zok_args)

    with open(args.output, 'w') as f:
        json.dump(proof, f, indent=2)
    print(f"Proof salvata: {args.output}")


if __name__ == '__main__':
    main()