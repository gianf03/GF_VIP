"""
build_merkle.py — Costruisce il Merkle Tree del titolo di studio.

Struttura foglie:
  F0 → keccak256(campi non numerici + numerici di contesto)
  F1 → keccak256(finalGrade, salt)
  F2 → keccak256(gpaX100, salt)
  F3 → keccak256(iscedDetailed, salt)
  F4 → keccak256(EQFlevel, salt)
  F5, F6, F7 → padding (hash di zeri)
"""

import json
from eth_hash.auto import keccak

# ── Keccak256 ─────────────────────────────────────────────────────────────────

def keccak256(data: bytes) -> str:
    return '0x' + keccak(data).hex()

def keccak256_combine(left: str, right: str) -> str:
    """Combina due hash figli per produrre il nodo padre."""
    left_bytes  = bytes.fromhex(left[2:])
    right_bytes = bytes.fromhex(right[2:])
    return keccak256(left_bytes + right_bytes)

# ── Foglie ────────────────────────────────────────────────────────────────────

PADDING = '0x' + '00' * 32

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
    return keccak256(data)

def leaf_grade(degree: dict) -> str:
    """F1 — hash(finalGrade, salt)"""
    data = f"{degree['finalGrade']}|{degree['salt']}".encode('utf-8')
    return keccak256(data)

def leaf_gpa(degree: dict) -> str:
    """F2 — hash(gpaX100, salt)"""
    data = f"{degree['gpaX100']}|{degree['salt']}".encode('utf-8')
    return keccak256(data)

def leaf_isced(degree: dict) -> str:
    """F3 — hash(iscedDetailed, salt)"""
    data = f"{degree['iscedDetailed']}|{degree['salt']}".encode('utf-8')
    return keccak256(data)

def leaf_eqf(degree: dict) -> str:
    """F4 — hash(EQFlevel, salt)"""
    data = f"{degree['EQFlevel']}|{degree['salt']}".encode('utf-8')
    return keccak256(data)

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

def build(degree: dict) -> dict:
    """
    Prende il dict del titolo di studio e restituisce
    il JSON completo con merkleTree aggiunto.
    """

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
    # Esempio di utilizzo
    degree = {
        "version":         "1.0",
        "issuedAt":        20250925,
        "studentId":       "NF22500126",
        "fullName":        "Gianfranco Vitiello",
        "universityName":  "Università degli Studi di Salerno",
        "universitySchac": "unisa.it",
        "universityCountry": "IT",
        "degreeName":      "Laurea in Informatica",
        "iscedBroad":      6,
        "iscedDetailed":   613,
        "EQFlevel":        7,
        "language":        "IT",
        "finalGrade":      110,
        "honors":          0,
        "maxGrade":        110,
        "gpaX100":         2951,
        "maxGpaX100":      3000,
        "salt":            "a3f8c2e1b7d94f6a8c3b2e9d7f4a1b6c5e8d3f2a1b4c9e7d6f3a2b1c8e5d4f7"
    }

    result = build(degree)

    output_path = 'LAUREA_MERKLE.json'
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f'File salvato: {output_path}')