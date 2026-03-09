import json
import os
import sys
from eth_hash.auto import keccak

# ── Keccak256 ─────────────────────────────────────────────────────────────────
def keccak256_combine(left: str, right: str) -> str:
    """Combina due hash figli per produrre il nodo padre."""
    left_bytes  = bytes.fromhex(left[2:])
    right_bytes = bytes.fromhex(right[2:])
    return '0x' + keccak(left_bytes + right_bytes).hex()

# ── Foglie ────────────────────────────────────────────────────────────────────

def leaf_context(degree: dict) -> str:
    """
    F0 — hash di tutti i campi non numerici + numerici di contesto.
    Campi inclusi: version, issuedAt, studentId, fullName,
                   universityName, universitySchac, universityCountry,
                   degreeName, iscedBroad, language, honors,
                   maxGrade, maxGpaX100
    """
    fields = [
        str(degree['version']),
        str(degree['issuedAt']),
        str(degree['studentId']),
        str(degree['fullName']),
        str(degree['universityName']),
        str(degree['universitySchac']),
        str(degree['universityCountry']),
        str(degree['degreeName']),
        str(degree['iscedBroad']),
        str(degree['language']),
        str(degree['honors']),
        str(degree['maxGrade']),
        str(degree['maxGpaX100']),
    ]
    data = '|'.join(fields).encode('utf-8')
    return '0x' + keccak(data).hex()

def leaf_grade(degree: dict) -> str:
    import struct
    grade_bytes = struct.pack('>I', degree['finalGrade']) 
    salt_bytes  = bytes.fromhex(degree['salt'])            
    return '0x'+ keccak(grade_bytes + salt_bytes).hex()             

def leaf_gpa(degree: dict) -> str:
    import struct
    val_bytes  = struct.pack('>I', degree['gpaX100'])
    salt_bytes = bytes.fromhex(degree['salt'])
    return '0x'+ keccak(val_bytes + salt_bytes).hex()

def leaf_isced(degree: dict) -> str:
    import struct
    val_bytes  = struct.pack('>I', degree['iscedDetailed'])
    salt_bytes = bytes.fromhex(degree['salt'])
    return '0x' + keccak(val_bytes + salt_bytes).hex()

def leaf_eqf(degree: dict) -> str:
    import struct
    val_bytes  = struct.pack('>I', degree['EQFlevel'])
    salt_bytes = bytes.fromhex(degree['salt'])
    return '0x' + keccak(val_bytes + salt_bytes).hex()

"""F5, F6, F7 - 32 byte con valore 0 """
PADDING = '0x' + '00' * 32

# ── Merkle Tree ───────────────────────────────────────────────────────────────

def build_merkle_tree(leaves: list) -> dict:
    """
    Costruisce il Merkle Tree e restituisce root + tutti i livelli.
    leaves deve avere lunghezza potenza di 2.
    """
    assert len(leaves) == 8, "Servono esattamente 8 foglie"

    level0 = leaves  # foglie

    level1 = [
        keccak256_combine(level0[0], level0[1]),
        keccak256_combine(level0[2], level0[3]),
        keccak256_combine(level0[4], level0[5]),
        keccak256_combine(level0[6], level0[7]),
    ]

    level2 = [
        keccak256_combine(level1[0], level1[1]),
        keccak256_combine(level1[2], level1[3]),
    ]

    root = keccak256_combine(level2[0], level2[1])

    return {
        'root':   root,
        'level2': level2,
        'level1': level1,
        'level0': level0,
    }

def get_path(tree: dict, index: int) -> dict:
    """
    Restituisce il percorso di verifica (siblings) per la foglia
    all'indice dato.

    Con 8 foglie il percorso ha 3 livelli:
      - sibling a livello 0 (foglia fratella)
      - sibling a livello 1
      - sibling a livello 2
    """
    level0 = tree['level0']
    level1 = tree['level1']
    level2 = tree['level2']

    # Livello 0: fratello della foglia
    sib0 = level0[index ^ 1]

    # Livello 1: fratello del nodo padre
    parent1_index = index // 2
    sib1 = level1[parent1_index ^ 1]

    # Livello 2: fratello del nodo nonno
    parent2_index = parent1_index // 2
    sib2 = level2[parent2_index ^ 1]

    return {
        'index':    index,
        'siblings': [sib0, sib1, sib2]
    }

# ── Main ──────────────────────────────────────────────────────────────────────

"""istruzioni per invocare: source venv/bin/activate
                            python3 buildJSON.py <nomeFile> """

def build(degree: dict) -> dict:

    # Genera e aggiunge il salt (28 byte) se non già presente
    if 'salt' in degree:
        raise ValueError("Il file JSON non deve contenere il campo 'salt': verrà generato automaticamente.")
    
    """salt di 28 byte"""
    degree['salt'] = os.urandom(28).hex()  

    # Calcola le 5 foglie reali + 3 padding
    leaves = [
        leaf_context(degree),   # F0 — indice 0
        leaf_grade(degree),     # F1 — indice 1
        leaf_gpa(degree),       # F2 — indice 2
        leaf_isced(degree),     # F3 — indice 3
        leaf_eqf(degree),       # F4 — indice 4
        PADDING,                # F5 — indice 5
        PADDING,                # F6 — indice 6
        PADDING,                # F7 — indice 7
    ]

    tree = build_merkle_tree(leaves)

    degree['merkleTree'] = {
        'root':      tree['root'],
        'leaves':    tree['level0'],
        'pathGrade': get_path(tree, 1),
        'pathGPA':   get_path(tree, 2),
        'pathISCED': get_path(tree, 3),
        'pathEQF':   get_path(tree, 4),
    }

    return degree


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Uso: python build_merkle.py <input.json>")
        sys.exit(1)

    input_path = sys.argv[1]

    if not os.path.exists(input_path):
        print(f"Errore: file '{input_path}' non trovato.")
        sys.exit(1)

    with open(input_path, 'r', encoding='utf-8') as f:
        degree = json.load(f)

    result = build(degree)

    # Output: stesso nome del file input con suffisso _MERKLE
    base = os.path.splitext(input_path)[0]
    output_path = f"{base}_MERKLE.json"

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"Salt generato: {result['salt']}")
    print(f"Root:          {result['merkleTree']['root']}")
    print(f"File salvato:  {output_path}")