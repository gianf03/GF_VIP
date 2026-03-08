from flask import Flask, request, jsonify, send_file
import json

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

    # 3. Leggi il tipo di claim scelto
    claim = request.form.get('claim')
    if not claim:
        return jsonify({'error': 'Nessun claim selezionato.'}), 400

    # 4. Leggi e valida il parametro specifico per ogni claim
    if claim == 'voto':
        soglia = request.form.get('soglia_voto')
        if not soglia:
            return jsonify({'error': 'Soglia voto mancante.'}), 400
        try:
            soglia = int(soglia)
        except ValueError:
            return jsonify({'error': 'Soglia voto non valida.'}), 400
        if not (18 <= soglia <= 110):
            return jsonify({'error': 'Soglia voto fuori range (18-110).'}), 400
        parametro = soglia

    elif claim == 'media':
        soglia = request.form.get('soglia_media')
        if not soglia:
            return jsonify({'error': 'Soglia media mancante.'}), 400
        try:
            soglia = float(soglia)
        except ValueError:
            return jsonify({'error': 'Soglia media non valida.'}), 400
        if not (18 <= soglia <= 30):
            return jsonify({'error': 'Soglia media fuori range (18-30).'}), 400
        parametro = soglia

    elif claim == 'eqf':
        soglia = request.form.get('soglia_eqf')
        if not soglia:
            return jsonify({'error': 'Livello EQF mancante.'}), 400
        try:
            soglia = int(soglia)
        except ValueError:
            return jsonify({'error': 'Livello EQF non valido.'}), 400
        if not (1 <= soglia <= 8):
            return jsonify({'error': 'Livello EQF fuori range (1-8).'}), 400
        parametro = soglia

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

    # 5. Stampa in console per debug
    print(f"Claim:     {claim}")
    print(f"Parametro: {parametro}")
    print(f"JSON ricevuto:\n{json.dumps(degree, indent=2)}")

    # 6. TODO: chiama ZoKrates con claim e parametro
    return jsonify({'message': f'File ricevuto. Claim: {claim}, parametro: {parametro}'}), 200


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)