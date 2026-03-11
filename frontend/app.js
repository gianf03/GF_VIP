/* ═══════════════════════════════════════════════════════════════════════
   MicroChain Admin — app.js
   Contracts: UniversityRegistry · CredentialIssuer · CircuitRegistry
   ═══════════════════════════════════════════════════════════════════════ */

// ── ABIs ────────────────────────────────────────────────────────────────

const REGISTRY_ABI = [
    { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "university", "type": "address" }, { "indexed": false, "internalType": "string", "name": "name", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "UniversityAuthorized", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "address", "name": "university", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "UniversityRevoked", "type": "event" },
    { "inputs": [], "name": "activeUniversityCount", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_university", "type": "address" }, { "internalType": "string", "name": "_name", "type": "string" }], "name": "authorizeUniversity", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "getAllUniversityAddresses", "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_university", "type": "address" }], "name": "getUniversity", "outputs": [{ "components": [{ "internalType": "string", "name": "name", "type": "string" }, { "internalType": "address", "name": "addr", "type": "address" }, { "internalType": "uint256", "name": "authorizedAt", "type": "uint256" }, { "internalType": "bool", "name": "isActive", "type": "bool" }], "internalType": "struct UniversityRegistry.University", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_university", "type": "address" }], "name": "isAuthorizedUniversity", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_university", "type": "address" }], "name": "revokeUniversity", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "totalRegisteredUniversities", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const ISSUER_ABI = [
    { "inputs": [{ "internalType": "address", "name": "_registry", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "credentialId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }, { "indexed": false, "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "CredentialIssued", "type": "event" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "uint256", "name": "credentialId", "type": "uint256" }, { "indexed": true, "internalType": "address", "name": "revokedBy", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "CredentialRevoked", "type": "event" },
    { "inputs": [{ "internalType": "uint256", "name": "_credentialId", "type": "uint256" }], "name": "getCredential", "outputs": [{ "components": [{ "internalType": "uint256", "name": "credentialId", "type": "uint256" }, { "internalType": "address", "name": "issuer", "type": "address" }, { "internalType": "bytes32", "name": "merkleRoot", "type": "bytes32" }, { "internalType": "uint256", "name": "issuedAt", "type": "uint256" }, { "internalType": "bool", "name": "isRevoked", "type": "bool" }], "internalType": "struct CredentialIssuer.Credential", "name": "", "type": "tuple" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "address", "name": "_issuer", "type": "address" }], "name": "getIssuerCredentials", "outputs": [{ "internalType": "uint256[]", "name": "", "type": "uint256[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_credentialId", "type": "uint256" }], "name": "getMerkleRoot", "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_credentialId", "type": "uint256" }], "name": "isCredentialValid", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "name": "isRevoked", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "bytes32", "name": "_merkleRoot", "type": "bytes32" }], "name": "issueCredential", "outputs": [{ "internalType": "uint256", "name": "credentialId", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }], "name": "merkleRootUsed", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "registry", "outputs": [{ "internalType": "contract UniversityRegistry", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "uint256", "name": "_credentialId", "type": "uint256" }], "name": "revokeCredential", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "totalCredentials", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

const CIRCUIT_ABI = [
    { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
    { "inputs": [{ "internalType": "address", "name": "owner", "type": "address" }], "name": "OwnableInvalidOwner", "type": "error" },
    { "inputs": [{ "internalType": "address", "name": "account", "type": "address" }], "name": "OwnableUnauthorizedAccount", "type": "error" },
    { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "string", "name": "circuitName", "type": "string" }, { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }], "name": "VerificationKeySet", "type": "event" },
    { "inputs": [], "name": "getAllCircuitNames", "outputs": [{ "internalType": "string[]", "name": "", "type": "string[]" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "string", "name": "_circuitName", "type": "string" }], "name": "getVerificationKey", "outputs": [{ "internalType": "bytes", "name": "", "type": "bytes" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "string", "name": "_circuitName", "type": "string" }], "name": "hasVerificationKey", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
    { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
    { "inputs": [{ "internalType": "string", "name": "_circuitName", "type": "string" }, { "internalType": "bytes", "name": "_key", "type": "bytes" }], "name": "setVerificationKey", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
    { "inputs": [], "name": "totalCircuits", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];

// ── Config ──────────────────────────────────────────────────────────────

const HARDHAT_RPC_URL = 'http://127.0.0.1:8545';

// ── App state ───────────────────────────────────────────────────────────

const state = {
    provider: null,
    readProvider: null,
    signer: null,
    account: null,
    // write instances (connected to MetaMask signer)
    registry: null,
    issuer: null,
    circuit: null,
    // read-only instances (direct RPC)
    registryRead: null,
    issuerRead: null,
    circuitRead: null,
    owner: null,
    isOwner: false,
    isUni: false,
};

// ── DOM helpers ─────────────────────────────────────────────────────────

const $ = (id) => document.getElementById(id);
const qa = (sel) => [...document.querySelectorAll(sel)];

// ── Toast notifications ─────────────────────────────────────────────────

function toast(msg, type = 'info', duration = 5000) {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    el.onclick = () => el.remove();
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
}

function txToast(hash) {
    const container = $('toast-container');
    const el = document.createElement('div');
    el.className = 'toast success';
    el.innerHTML = `✓ Transaction confirmed<br><span class="tx-hash">${hash}</span>`;
    el.onclick = () => el.remove();
    container.appendChild(el);
    setTimeout(() => el.remove(), 8000);
}

// ── Button loading ──────────────────────────────────────────────────────

function setLoading(btn, loading) {
    if (loading) { btn.classList.add('loading'); btn.disabled = true; }
    else { btn.classList.remove('loading'); btn.disabled = false; }
}

// ── Error helpers ───────────────────────────────────────────────────────

function friendlyError(err) {
    const match = err?.message?.match(/reverted with reason string '(.+?)'/);
    if (match) return match[1];
    if (err?.reason) return err.reason;
    if (err?.message?.includes('user rejected')) return 'Transaction rejected by user.';
    if (err?.message?.includes('insufficient funds')) return 'Insufficient funds for gas.';
    return err?.message?.split('\n')[0] ?? 'Unknown error';
}

function shortAddr(addr) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

function formatDate(timestamp) {
    if (!timestamp || timestamp === 0n) return '—';
    return new Date(Number(timestamp) * 1000).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}

function escapeHtml(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Wallet connection ───────────────────────────────────────────────────

async function connectWallet() {
    if (!window.ethereum) {
        toast('MetaMask not found. Please install it from metamask.io', 'error', 8000);
        return;
    }
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        state.provider = new ethers.BrowserProvider(window.ethereum);
        state.signer = await state.provider.getSigner();
        state.account = await state.signer.getAddress();

        $('wallet-chip').classList.add('visible');
        $('wallet-addr').textContent = shortAddr(state.account);
        $('connect-btn').style.display = 'none';

        await tryLoadContracts();
        $('connect-prompt').style.display = 'none';
        toast('Wallet connected successfully!', 'success');
    } catch (err) {
        toast(friendlyError(err), 'error');
    }
}

// ── Load contracts ──────────────────────────────────────────────────────

async function tryLoadContracts() {
    const regAddr     = $('registry-addr').value.trim();
    const issuerAddr  = $('issuer-addr').value.trim();
    const circuitAddr = $('circuit-addr').value.trim();

    if (!state.signer) return;
    if (!ethers.isAddress(regAddr))     { toast('Invalid UniversityRegistry address', 'warning'); return; }
    if (!ethers.isAddress(issuerAddr))  { toast('Invalid CredentialIssuer address', 'warning'); return; }
    if (!ethers.isAddress(circuitAddr)) { toast('Invalid CircuitRegistry address', 'warning'); return; }

    try {
        state.readProvider = new ethers.JsonRpcProvider(HARDHAT_RPC_URL);

        const code = await state.readProvider.getCode(regAddr);
        if (code === '0x') {
            toast('No contract found at ' + regAddr + '. Have you deployed?', 'error');
            return;
        }

        // Read-only instances
        state.registryRead = new ethers.Contract(regAddr,     REGISTRY_ABI, state.readProvider);
        state.issuerRead   = new ethers.Contract(issuerAddr,  ISSUER_ABI,   state.readProvider);
        state.circuitRead  = new ethers.Contract(circuitAddr, CIRCUIT_ABI,  state.readProvider);

        // Write instances
        state.registry = new ethers.Contract(regAddr,     REGISTRY_ABI, state.signer);
        state.issuer   = new ethers.Contract(issuerAddr,  ISSUER_ABI,   state.signer);
        state.circuit  = new ethers.Contract(circuitAddr, CIRCUIT_ABI,  state.signer);

        state.owner   = await state.registryRead.owner();
        state.isOwner = state.account?.toLowerCase() === state.owner?.toLowerCase();
        state.isUni   = await state.registryRead.isAuthorizedUniversity(state.account);

        updateRoleBadge();
        showApp();
        await refreshAll();
    } catch (err) {
        toast('Could not connect to contracts: ' + friendlyError(err), 'error');
    }
}

function updateRoleBadge() {
    const badge = $('role-badge');
    badge.style.display = 'inline-block';
    if (state.isOwner) {
        badge.className = 'role-badge owner';
        badge.textContent = '👑 Owner';
    } else if (state.isUni) {
        badge.className = 'role-badge university';
        badge.textContent = '🎓 University';
    } else {
        badge.className = 'role-badge guest';
        badge.textContent = 'Guest';
    }
}

function showApp() {
    $('app').style.display = 'block';
    $('setup-panel').style.display = 'none';
}

// ── Tab switching ───────────────────────────────────────────────────────

function initTabs() {
    qa('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            qa('.tab-btn').forEach(b => b.classList.remove('active'));
            qa('.tab-panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            $(`panel-${btn.dataset.tab}`).classList.add('active');
        };
    });
}

// ══════════════════════════════════════════════════════════════════════
//  OWNER ACTIONS
// ══════════════════════════════════════════════════════════════════════

async function authorizeUniversity() {
    const addr = $('auth-addr').value.trim();
    const name = $('auth-name').value.trim();
    const btn  = $('btn-authorize');

    if (!ethers.isAddress(addr)) { toast('Invalid Ethereum address', 'warning'); return; }
    if (!name) { toast('University name is required', 'warning'); return; }

    setLoading(btn, true);
    try {
        const tx = await state.registry.authorizeUniversity(addr, name);
        toast('Transaction sent — waiting for confirmation…', 'info');
        const receipt = await tx.wait();
        txToast(receipt.hash);
        $('auth-addr').value = '';
        $('auth-name').value = '';
        await refreshUniversities();
        state.isUni = await state.registryRead.isAuthorizedUniversity(state.account);
        updateRoleBadge();
    } catch (err) {
        toast(friendlyError(err), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function revokeUniversity(addr) {
    if (!confirm(`Revoke authorization for\n${addr}?`)) return;
    const btn = $(`revoke-${addr}`);
    if (btn) setLoading(btn, true);
    try {
        const tx = await state.registry.revokeUniversity(addr);
        toast('Transaction sent — waiting for confirmation…', 'info');
        const receipt = await tx.wait();
        txToast(receipt.hash);
        await refreshUniversities();
        state.isUni = await state.registryRead.isAuthorizedUniversity(state.account);
        updateRoleBadge();
    } catch (err) {
        toast(friendlyError(err), 'error');
    } finally {
        if (btn) setLoading(btn, false);
    }
}

async function uploadVerificationKey() {
    const circuitName = $('vk-circuit').value;
    const fileInput   = $('vk-file');
    const btn         = $('btn-upload-vk');

    if (!fileInput.files || fileInput.files.length === 0) {
        toast('Please select a verification.key file', 'warning');
        return;
    }

    const file = fileInput.files[0];

    // Read file as text, validate JSON, convert to hex bytes (browser-safe)
    let keyBytes;
    try {
        const text = await file.text();
        JSON.parse(text); // validate it's valid JSON
        // Encode UTF-8 text → Uint8Array → hex string
        const bytes = new TextEncoder().encode(text);
        keyBytes = '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        toast('File is not valid JSON: ' + e.message, 'error');
        return;
    }

    setLoading(btn, true);
    try {
        const tx = await state.circuit.setVerificationKey(circuitName, keyBytes);
        toast('Transaction sent — waiting for confirmation…', 'info');
        const receipt = await tx.wait();
        txToast(receipt.hash);
        fileInput.value = '';
        await refreshCircuits();
    } catch (err) {
        toast(friendlyError(err), 'error');
    } finally {
        setLoading(btn, false);
    }
}

// ══════════════════════════════════════════════════════════════════════
//  UNIVERSITY ACTIONS
// ══════════════════════════════════════════════════════════════════════

async function issueCredential() {
    const root = $('issue-root').value.trim();
    const btn  = $('btn-issue');

    if (!root || root.length !== 66 || !root.startsWith('0x')) {
        toast('Please enter a valid bytes32 Merkle root (0x + 64 hex chars)', 'warning');
        return;
    }

    setLoading(btn, true);
    try {
        const tx = await state.issuer.issueCredential(root);
        toast('Transaction sent — waiting for confirmation…', 'info');
        const receipt = await tx.wait();
        txToast(receipt.hash);
        $('issue-root').value = '';
        await refreshCredentials();
    } catch (err) {
        toast(friendlyError(err), 'error');
    } finally {
        setLoading(btn, false);
    }
}

async function revokeCredential(id) {
    if (!confirm(`Revoke credential #${id}? This cannot be undone.`)) return;
    const btn = $(`revoke-cred-${id}`);
    if (btn) setLoading(btn, true);
    try {
        const tx = await state.issuer.revokeCredential(id);
        toast('Transaction sent — waiting for confirmation…', 'info');
        const receipt = await tx.wait();
        txToast(receipt.hash);
        await refreshCredentials();
    } catch (err) {
        toast(friendlyError(err), 'error');
    } finally {
        if (btn) setLoading(btn, false);
    }
}

// ══════════════════════════════════════════════════════════════════════
//  DATA REFRESH
// ══════════════════════════════════════════════════════════════════════

async function refreshAll() {
    await Promise.all([refreshUniversities(), refreshCredentials(), refreshCircuits()]);
}

async function refreshUniversities() {
    const list = $('uni-list');
    list.innerHTML = '<div class="empty-state"><span class="icon">⏳</span>Loading…</div>';
    try {
        const addresses = await state.registryRead.getAllUniversityAddresses();
        const unis = await Promise.all(addresses.map(a => state.registryRead.getUniversity(a)));

        $('uni-count').textContent = unis.filter(u => u.isActive).length;

        if (unis.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="icon">🏛️</span>No universities registered yet.</div>';
            return;
        }
        list.innerHTML = '';
        unis.forEach((uni, i) => {
            const addr = addresses[i];
            const isMe = addr.toLowerCase() === state.account?.toLowerCase();
            const card = document.createElement('div');
            card.className = 'entity-card';
            card.innerHTML = `
        <div class="status-dot ${uni.isActive ? 'active' : 'revoked'}"></div>
        <div class="entity-info">
          <div class="entity-name">${escapeHtml(uni.name) || '(no name)'}${isMe ? ' <span style="color:#a78bfa;font-size:11px;">• you</span>' : ''}</div>
          <div class="entity-addr">${addr}</div>
          <div class="entity-meta">${uni.isActive ? '✅ Active' : '❌ Revoked'} · Authorized ${formatDate(uni.authorizedAt)}</div>
        </div>
        ${state.isOwner && uni.isActive ? `
          <button class="btn btn-danger"
                  id="revoke-${addr}"
                  onclick="revokeUniversity('${addr}')">
            <span class="spinner"></span>
            <span class="btn-label">Revoke</span>
          </button>` : ''}
      `;
            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(friendlyError(err))}</div>`;
    }
}

async function refreshCredentials() {
    const list = $('cred-list');
    list.innerHTML = '<div class="empty-state"><span class="icon">⏳</span>Loading…</div>';
    try {
        // Show credentials issued by the connected account (if university)
        // For guests/owner, show all credentials (using totalCredentials)
        let ids = [];

        if (state.isUni) {
            ids = await state.issuerRead.getIssuerCredentials(state.account);
        } else {
            // For owner/guest: enumerate all by scanning 1..total
            const total = await state.issuerRead.totalCredentials();
            for (let i = 1n; i <= total; i++) ids.push(i);
        }

        $('cred-count').textContent = ids.length;

        if (ids.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="icon">📜</span>No credentials issued yet.</div>';
            return;
        }

        const creds = await Promise.all(ids.map(id => state.issuerRead.getCredential(id)));
        list.innerHTML = '';
        creds.forEach((c) => {
            const card = document.createElement('div');
            card.className = 'entity-card';
            const canRevoke = state.isUni && !c.isRevoked &&
                c.issuer.toLowerCase() === state.account?.toLowerCase();
            card.innerHTML = `
        <div class="status-dot ${c.isRevoked ? 'revoked' : 'active'}"></div>
        <div class="entity-info">
          <div class="entity-name">Credential #${c.credentialId}</div>
          <div class="entity-addr mono" style="font-size:11px;word-break:break-all;">${c.merkleRoot}</div>
          <div class="entity-meta">
            ${c.isRevoked ? '❌ Revoked' : '✅ Valid'}
            · Issued by ${shortAddr(c.issuer)}
            · ${formatDate(c.issuedAt)}
          </div>
        </div>
        ${canRevoke ? `
          <button class="btn btn-danger"
                  id="revoke-cred-${c.credentialId}"
                  onclick="revokeCredential(${c.credentialId})">
            <span class="spinner"></span>
            <span class="btn-label">Revoke</span>
          </button>` : ''}
      `;
            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(friendlyError(err))}</div>`;
    }
}

async function refreshCircuits() {
    const list = $('circuit-list');
    list.innerHTML = '<div class="empty-state"><span class="icon">⏳</span>Loading…</div>';
    try {
        const names = await state.circuitRead.getAllCircuitNames();
        $('circuit-count').textContent = names.length;

        if (names.length === 0) {
            list.innerHTML = '<div class="empty-state"><span class="icon">🔑</span>No verification keys published yet.</div>';
            return;
        }

        list.innerHTML = '';
        names.forEach(name => {
            const card = document.createElement('div');
            card.className = 'entity-card';
            card.innerHTML = `
        <div class="status-dot active"></div>
        <div class="entity-info">
          <div class="entity-name">Circuit: <code>${escapeHtml(name)}</code></div>
          <div class="entity-meta">✅ Verification key published</div>
        </div>
      `;
            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(friendlyError(err))}</div>`;
    }
}

// ── Auto-load config ────────────────────────────────────────────────────

async function tryLoadConfig() {
    // Source 1: Hardhat Ignition
    try {
        const res = await fetch('../ignition/deployments/chain-31337/deployed_addresses.json');
        if (res.ok) {
            const cfg = await res.json();
            if (cfg['DeployAll#UniversityRegistry']) $('registry-addr').value = cfg['DeployAll#UniversityRegistry'];
            if (cfg['DeployAll#CredentialIssuer'])   $('issuer-addr').value   = cfg['DeployAll#CredentialIssuer'];
            if (cfg['DeployAll#CircuitRegistry'])    $('circuit-addr').value  = cfg['DeployAll#CircuitRegistry'];
            toast('Addresses loaded from Ignition deployment', 'success');
            return;
        }
    } catch { /* not available */ }

    // Source 2: deploy-config.json
    try {
        const res = await fetch('./deploy-config.json');
        if (!res.ok) return;
        const cfg = await res.json();
        if (cfg.UniversityRegistry) $('registry-addr').value = cfg.UniversityRegistry;
        if (cfg.CredentialIssuer)   $('issuer-addr').value   = cfg.CredentialIssuer;
        if (cfg.CircuitRegistry)    $('circuit-addr').value  = cfg.CircuitRegistry;
        toast('Contract addresses loaded from deploy-config.json', 'info');
    } catch { /* no config — user fills manually */ }
}

// ── Account / network change handlers ──────────────────────────────────

function initEventListeners() {
    if (!window.ethereum) return;
    window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length === 0) {
            location.reload();
        } else {
            state.account = accounts[0];
            state.signer  = await state.provider.getSigner();
            $('wallet-addr').textContent = shortAddr(state.account);
            if (state.registry) {
                state.isOwner = state.account.toLowerCase() === state.owner?.toLowerCase();
                state.isUni   = await state.registryRead.isAuthorizedUniversity(state.account);
                const regAddr     = $('registry-addr').value.trim();
                const issuerAddr  = $('issuer-addr').value.trim();
                const circuitAddr = $('circuit-addr').value.trim();
                state.registry = new ethers.Contract(regAddr,     REGISTRY_ABI, state.signer);
                state.issuer   = new ethers.Contract(issuerAddr,  ISSUER_ABI,   state.signer);
                state.circuit  = new ethers.Contract(circuitAddr, CIRCUIT_ABI,  state.signer);
                updateRoleBadge();
                await refreshAll();
            }
            toast('Switched account: ' + shortAddr(state.account), 'info');
        }
    });
    window.ethereum.on('chainChanged', () => location.reload());
}

// ── Bootup ──────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
    initTabs();
    initEventListeners();
    await tryLoadConfig();

    $('connect-btn').onclick = connectWallet;
    $('connect-prompt-btn').onclick = connectWallet;

    $('btn-load-contracts').onclick = async () => {
        if (!state.signer) {
            await connectWallet();
            if (!state.signer) return;
        }
        await tryLoadContracts();
    };

    // Owner actions
    $('btn-authorize').onclick   = authorizeUniversity;
    $('btn-upload-vk').onclick   = uploadVerificationKey;

    // University actions
    $('btn-issue').onclick       = issueCredential;

    // Refresh buttons
    $('btn-refresh-unis').onclick     = refreshUniversities;
    $('btn-refresh-creds').onclick    = refreshCredentials;
    $('btn-refresh-circuits').onclick = refreshCircuits;

    // Enter key support
    const addEnter = (ids, fn) => ids.forEach(id => {
        $(id)?.addEventListener('keydown', e => { if (e.key === 'Enter') fn(); });
    });
    addEnter(['auth-addr', 'auth-name'], authorizeUniversity);
    addEnter(['issue-root'], issueCredential);
});
