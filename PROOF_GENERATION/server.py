from flask import Flask, request, jsonify, send_file
import json

from prepareInput import prepare_grade, prepare_gpa, prepare_eqf, prepare_isced, run_zokrates

app = Flask(__name__)

@app.route('/')
def index():
    return send_file('index.html')

@app.route('/generate-proof', methods=['POST'])
def generate_proof():

    # 1. Controlla che il file sia stato inviato
    if 'degree' not in request.files:
        return jsonify({'error': 'Nessun file ricevuto.'}), 400

    file = request.files['degree']
    if not file.filename.endswith('.json'):
        return jsonify({'error': 'Il file deve essere .json'}), 400

    # 2. Parsa il JSON
    try:
        degree = json.load(file)
    except json.JSONDecodeError as e:
        return jsonify({'error': f'JSON non valido: {str(e)}'}), 400

    # 3. Controlla che il Merkle Tree sia presente
    if 'merkleTree' not in degree:
        return jsonify({'error': 'Il file non contiene il Merkle Tree. Usa il file fornito dalla tua università.'}), 400

    # 4. Leggi claim e parametro dal form
    claim = request.form.get('claim')
    if not claim:
        return jsonify({'error': 'Nessun claim selezionato.'}), 400

    if claim == 'grade':
        soglia = request.form.get('soglia_voto')
        if not soglia:
            return jsonify({'error': 'Soglia voto mancante.'}), 400
        try:
            parametro = int(soglia)
        except ValueError:
            return jsonify({'error': 'Soglia voto non valida.'}), 400

    elif claim == 'gpa':
        soglia = request.form.get('soglia_media')
        if not soglia:
            return jsonify({'error': 'Soglia media mancante.'}), 400
        try:
            # la media arriva come float (es. 27.5), la convertiamo in intero x100
            parametro = int(float(soglia) * 100)
        except ValueError:
            return jsonify({'error': 'Soglia media non valida.'}), 400

    elif claim == 'eqf':
        soglia = request.form.get('soglia_eqf')
        if not soglia:
            return jsonify({'error': 'Livello EQF mancante.'}), 400
        try:
            parametro = int(soglia)
        except ValueError:
            return jsonify({'error': 'Livello EQF non valido.'}), 400

    elif claim == 'isced':
        codice = request.form.get('codice_isced')
        if not codice:
            return jsonify({'error': 'Codice ISCED mancante.'}), 400
        try:
            parametro = int(codice)
        except ValueError:
            return jsonify({'error': 'Codice ISCED non valido.'}), 400

    else:
        return jsonify({'error': f'Claim non riconosciuto: {claim}'}), 400

    # 5. Controlla che il claim sia dimostrabile
    try:
        if claim == 'grade':
            if degree['finalGrade'] < parametro:
                return jsonify({'error': f"Voto insufficiente: il tuo voto è {degree['finalGrade']}, la soglia richiesta è {parametro}."}), 400
        elif claim == 'gpa':
            if degree['gpaX100'] < parametro:
                return jsonify({'error': f"Media insufficiente: la tua media è {degree['gpaX100']/100:.2f}, la soglia richiesta è {parametro/100:.2f}."}), 400
        elif claim == 'eqf':
            if degree['EQFlevel'] < parametro:
                return jsonify({'error': f"Livello EQF insufficiente: il tuo livello è {degree['EQFlevel']}, richiesto {parametro}."}), 400
        elif claim == 'isced':
            if degree['iscedDetailed'] != parametro:
                return jsonify({'error': f"Codice ISCED non corrispondente: il tuo codice è {degree['iscedDetailed']}, richiesto {parametro}."}), 400
    except KeyError as e:
        return jsonify({'error': f'Campo mancante nel JSON: {str(e)}'}), 400

    # 5. Prepara gli input per ZoKrates
    try:
        if claim == 'grade':
            zok_args = prepare_grade(degree, parametro)
        elif claim == 'gpa':
            zok_args = prepare_gpa(degree, parametro)
        elif claim == 'eqf':
            zok_args = prepare_eqf(degree, parametro)
        elif claim == 'isced':
            zok_args = prepare_isced(degree, parametro)
    except Exception as e:
        return jsonify({'error': f'Errore preparazione input: {str(e)}'}), 500

    # 6. Esegui ZoKrates
    try:
        proof = run_zokrates(claim, zok_args)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Errore ZoKrates: {str(e)}'}), 500

    return jsonify({'proof': proof}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)