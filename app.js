import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, increment, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyA0DDj72CDHc4gbjYLvee21vXAb1xysKoY",
    authDomain: "vizela-eletrica.firebaseapp.com",
    projectId: "vizela-eletrica",
    storageBucket: "vizela-eletrica.firebasestorage.app",
    messagingSenderId: "580578429133",
    appId: "1:580578429133:web:d2e2dbbbfa9898e7eb4184"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const storage = getStorage(app);

/* ===================================================================
   ESTRUTURA DE MENUS
   =================================================================== */
const sistemaModulos = {
    'Dashboard': {
        'Visão Geral': ['Resumo'],
        'Obras': ['Folha de Obra'],
        'Agenda': ['Eventos Programados']
    },
    'Tabelas': {
        'Entidades': ['Clientes', 'Fornecedores', 'Vendedores'],
        'Artigos': ['Categorias', 'Artigos', 'Artigos Fabricados', 'Armazéns'],
        'Stocks': ['Controlo de stocks']
    },
    'Documentos': {
        'Venda': ['Faturas', 'Faturas Simplificada', 'Faturas-Recibo'],
        'Transporte': ['Guia de Remessa'],
        'Outros Documentos': ['Fatura pro forma / Orçamento', 'Avenças'],
        'Liquidações': ['Recibos', 'Notas de Crédito', 'Devoluções Pagamento'],
        'Fornecedores': ['Notas de Encomenda', 'Faturas Fornecedor', 'Faturas Simplificadas', 'Notas de Crédito Fornecedor', 'Notas de Devolução', 'Recibos Fornecedor', 'Pedidos de Garantia'],
        'Stocks': ['Nota de Quebra', 'Entrada de Inventário', 'Saída de Inventário']
    },
    'Consultas': {
        'Vendas': ['Extrato de Vendas', 'Análise de Vendas', 'Margens de Lucro', 'Mapas de IVA', 'Listagem de Pendentes', 'Histórico de Clientes', 'Listagem de Documentos'],
        'Compras': ['Extrato de Compras', 'Análise de Compras', 'Mapas IVA', 'Listagem de Pendentes', 'Histórico de Fornecedores', 'Listagem de Documentos'],
        'Vendedores': ['Listagem de Pendentes', 'Histórico de Vendedores']
    },
    'Configurações': {
        'Empresa e Utilizadores': ['Empresa', 'Subscrição', 'Grupos e Permissões de Utilizadores', 'Utilizadores'],
        'Séries e Templates': ['Série de Documentos', 'Templates de Identificação'],
        'Referências Multibanco': ['Consultar', 'Configurar'],
        'Outras Configurações': ['Dados Bancários', 'Métodos de Pagamento', 'Viaturas']
    }
};

/* ===================================================================
   ESTADO GLOBAL
   =================================================================== */
let categoriaAtiva = 'Dashboard';
let subCategoriaAtiva = 'Visão Geral';

// Todas as coleções do Firestore que o sistema ouve em tempo real
const COLECOES = [
    'Clientes', 'Fornecedores', 'Vendedores', 'Categorias', 'Artigos', 'Artigos Fabricados',
    'FolhaObra', 'EventosProgramados',
    'Faturas', 'FaturasSimplificadas', 'FaturasRecibo',
    'GuiaRemessa', 'FaturasProForma', 'Avencas',
    'RecibosVenda', 'NotasCreditoVenda', 'DevolucoesPagamento',
    'NotasEncomendaFornecedor', 'FaturasFornecedor', 'FaturasSimplificadasFornecedor',
    'NotasCreditoFornecedor', 'NotasDevolucaoFornecedor', 'RecibosFornecedor', 'PedidosGarantia',
    'NotasQuebra', 'MovimentosInventario',
    'GruposPermissoes', 'Utilizadores', 'SerieDocumentos', 'TemplatesIdentificacao',
    'DadosBancarios', 'MetodosPagamento', 'Viaturas'
];

let dadosCadastrados = {};
COLECOES.forEach(c => dadosCadastrados[c] = []);

let idSendoEditado = null;
let idParaExcluir = null;
let colecaoParaExcluir = null;
let listenersAtivos = [];

// Variaveis Temporárias para o Fluxo do "Artigos Fabricados"
let artigosBundleTemp = [];
let nomeConjuntoSendoEditado = '';

// Registos "singleton" (um documento só) guardados em coleção 'Configuracoes'
let dadosEmpresa = {};
let dadosSubscricao = {};

/* ===================================================================
   GESTÃO DE INTERFACE LOGIN/REGISTO
   =================================================================== */
window.alternarVista = function (vista) {
    const login = document.getElementById('view-login');
    const register = document.getElementById('view-register');
    if (vista === 'register') { login.style.display = 'none'; register.style.display = 'block'; }
    else { register.style.display = 'none'; login.style.display = 'block'; }
}

window.togglePassword = function (inputId, iconId) {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);
    if (input.type === "password") {
        input.type = "text";
        icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>';
    } else {
        input.type = "password";
        icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
    }
}

/* ===================================================================
   GESTÃO DE AUTENTICAÇÃO (LOGIN/REGISTO)
   =================================================================== */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        if (user.emailVerified) {
            document.getElementById('login-screen').style.display = 'none'; document.getElementById('app-screen').style.display = 'flex';
            iniciarListenersBancoDeDados();
        } else {
            await signOut(auth); document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app-screen').style.display = 'none'; pararListenersBancoDeDados();
        }
    } else {
        document.getElementById('login-screen').style.display = 'flex'; document.getElementById('app-screen').style.display = 'none'; pararListenersBancoDeDados();
    }
});

window.loginComEmail = async function (e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login-email'); btn.disabled = true; btn.innerText = "A entrar...";
    try {
        const userCredential = await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-senha').value);
        if (!userCredential.user.emailVerified) { await signOut(auth); mostrarAlertaCustomizado("Por favor, verifique a sua caixa de entrada e clique no link de confirmação para ativar o seu acesso.", "Acesso Bloqueado"); }
    } catch (error) { mostrarAlertaCustomizado("Email ou senha inválidos.", "Erro no Login"); } finally { btn.disabled = false; btn.innerText = "Entrar"; }
}

window.registrarComEmail = async function (e) {
    e.preventDefault();
    const pass = document.getElementById('reg-senha').value; const passConf = document.getElementById('reg-senha-conf').value;
    const btn = document.getElementById('btn-reg-email');

    if (pass !== passConf) { mostrarAlertaCustomizado("As senhas não coincidem. Verifique e tente novamente.", "Atenção"); return; }
    btn.disabled = true; btn.innerText = "A processar...";
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, document.getElementById('reg-email').value, pass);
        await sendEmailVerification(userCredential.user); await signOut(auth);
        mostrarAlertaCustomizado("Conta criada com sucesso! Enviámos um link de confirmação para o seu email.", "Verifique o seu Email");
        alternarVista('login'); document.querySelectorAll('.auth-form').forEach(f => f.reset());
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') mostrarAlertaCustomizado("Este email já está registado no sistema.", "Erro");
        else if (error.code === 'auth/weak-password') mostrarAlertaCustomizado("A senha é muito fraca. Deve ter pelo menos 6 caracteres.", "Erro");
        else mostrarAlertaCustomizado("Ocorreu um erro ao criar a conta. Tente novamente.", "Erro");
    } finally { btn.disabled = false; btn.innerText = "Registar e Enviar Email"; }
}

window.loginComGoogle = function () { signInWithPopup(auth, provider).catch(() => mostrarAlertaCustomizado("Erro ao iniciar sessão com o Google.", "Erro de Acesso")); }
window.fazerLogout = function () { signOut(auth).catch(() => mostrarAlertaCustomizado("Erro ao encerrar sessão.", "Erro")); }

/* ===================================================================
   GESTÃO DE BANCO DE DADOS EM TEMPO REAL
   =================================================================== */
function iniciarListenersBancoDeDados() {
    pararListenersBancoDeDados();
    COLECOES.forEach(entidade => {
        const unsub = onSnapshot(collection(db, entidade), (snapshot) => {
            dadosCadastrados[entidade] = [];
            snapshot.forEach((doc) => { dadosCadastrados[entidade].push({ id: doc.id, ...doc.data() }); });
            rerenderSeAtivo(entidade);
        }, (error) => { console.error(`Permissões negadas para ${entidade}. Verifique as regras.`); });
        listenersAtivos.push(unsub);
    });

    // Documentos "singleton" (Empresa / Subscrição)
    const unsubEmpresa = onSnapshot(doc(db, 'Configuracoes', 'Empresa'), (snap) => { dadosEmpresa = snap.exists() ? snap.data() : {}; rerenderSeAtivo('Empresa'); });
    const unsubSub = onSnapshot(doc(db, 'Configuracoes', 'Subscricao'), (snap) => { dadosSubscricao = snap.exists() ? snap.data() : {}; rerenderSeAtivo('Subscrição'); });
    listenersAtivos.push(unsubEmpresa, unsubSub);
}

function pararListenersBancoDeDados() { listenersAtivos.forEach(unsub => unsub()); listenersAtivos = []; }

function rerenderSeAtivo(entidade) {
    const abaAtual = document.getElementById('subview-title').innerText;
    if (abaAtual === entidade) { renderConteudoAtual(); return; }
    // Telas cujo conteúdo depende de mais de uma coleção
    const DEPENDENCIAS = {
        'Armazéns': ['Artigos'], 'Controlo de stocks': ['Artigos'], 'Resumo': ['Faturas', 'Artigos', 'Clientes', 'FolhaObra', 'Avencas'],
        'Folha de Obra': ['FolhaObra', 'Clientes'], 'Faturas': ['Clientes', 'Artigos'], 'Faturas Simplificada': ['Artigos'],
        'Faturas-Recibo': ['Clientes', 'Artigos'], 'Guia de Remessa': ['FolhaObra', 'Artigos'],
        'Fatura pro forma / Orçamento': ['Clientes', 'Artigos'], 'Notas de Crédito': ['Faturas', 'FaturasSimplificadas', 'FaturasRecibo', 'Clientes'],
        'Devoluções Pagamento': ['Faturas', 'FaturasSimplificadas', 'FaturasRecibo', 'Clientes'], 'Recibos': ['Faturas', 'FaturasSimplificadas', 'FaturasRecibo'],
        'Notas de Encomenda': ['Fornecedores'], 'Faturas Fornecedor': ['Fornecedores', 'Artigos'],
        'Notas de Crédito Fornecedor': ['FaturasFornecedor', 'FaturasSimplificadasFornecedor', 'Fornecedores'],
        'Notas de Devolução': ['FaturasFornecedor', 'FaturasSimplificadasFornecedor', 'Fornecedores'],
        'Recibos Fornecedor': ['FaturasFornecedor'], 'Avenças': ['Clientes']
    };
    if (DEPENDENCIAS[abaAtual] && DEPENDENCIAS[abaAtual].includes(entidade)) { renderConteudoAtual(); }
}

/* ===================================================================
   NAVEGAÇÃO DO SISTEMA
   =================================================================== */
window.selectCategory = function (categoryName, element) {
    document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active')); element.classList.add('active');
    categoriaAtiva = categoryName; document.getElementById('main-category-title').innerText = categoryName;
    const primeiroSubtitulo = Object.keys(sistemaModulos[categoryName])[0]; const primeiraAba = sistemaModulos[categoryName][primeiroSubtitulo][0];
    updateContentView(categoryName, primeiroSubtitulo, primeiraAba);
    document.getElementById('options-dropdown').classList.remove('active');
}

window.toggleDropdown = function (event) {
    event.stopPropagation(); const dropdown = document.getElementById('options-dropdown');
    renderDropdownStructure(); dropdown.classList.toggle('active');
}

function renderDropdownStructure() {
    const dropdown = document.getElementById('options-dropdown'); dropdown.innerHTML = '';
    const subCategorias = sistemaModulos[categoriaAtiva]; const abaAtual = document.getElementById('subview-title').innerText;

    for (const subTitulo in subCategorias) {
        const titleDiv = document.createElement('div'); titleDiv.className = 'dropdown-section-title'; titleDiv.innerText = subTitulo; dropdown.appendChild(titleDiv);
        subCategorias[subTitulo].forEach(aba => {
            const btn = document.createElement('button'); btn.className = `dropdown-item ${aba === abaAtual ? 'active' : ''}`; btn.innerText = aba;
            btn.onclick = function () { updateContentView(categoriaAtiva, subTitulo, aba); dropdown.classList.remove('active'); };
            dropdown.appendChild(btn);
        });
    }
}

function updateContentView(categoria, subtitulo, aba) {
    subCategoriaAtiva = subtitulo;
    document.getElementById('sub-category-title').innerText = subtitulo; document.getElementById('subview-title').innerText = aba;
    const btnCadastrar = document.querySelector('.btn-cadastrar');
    btnCadastrar.style.display = CADASTRO_HANDLERS[aba] ? 'flex' : 'none';
    renderConteudoAtual();
}

function renderConteudoAtual() {
    const aba = document.getElementById('subview-title').innerText;
    const display = document.getElementById('content-display');
    if (RENDERERS[aba]) {
        display.style.textAlign = 'left'; display.style.padding = '0';
        RENDERERS[aba](display);
    } else {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">${categoriaAtiva} &gt; ${subCategoriaAtiva} &gt; Tela de <strong>${aba}</strong> ainda será implementada numa próxima etapa.</div>`;
    }
}

// Mapas preenchidos por cada módulo (Tabelas, Documentos, Dashboard, Configurações)
const RENDERERS = {};
const CADASTRO_HANDLERS = {};

/* ===================================================================
   UTILITÁRIOS GERAIS
   =================================================================== */
function escapeHTML(str) { return String(str ?? '').replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)); }

function formatMoeda(v) { return (Number(v) || 0).toLocaleString('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }

function formatDataPt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('pt-PT');
}

function hojeISO() { return new Date().toISOString().slice(0, 10); }

function alertaData(dataISO) {
    if (!dataISO) return '-';
    const dias = Math.floor((new Date(dataISO) - new Date(hojeISO())) / (1000 * 60 * 60 * 24));
    let badge = '';
    if (dias < 0) badge = ' <span class="badge badge-danger">Vencido</span>';
    else if (dias <= 30) badge = ' <span class="badge badge-warning">Em breve</span>';
    return `${formatDataPt(dataISO)}${badge}`;
}

function badgeStatus(status) {
    const map = {
        'Pago': 'badge-success', 'Concluído': 'badge-success', 'Aprovado': 'badge-success',
        'Pendente': 'badge-warning', 'Em Aberto': 'badge-warning', 'Aguarda': 'badge-warning',
        'Cancelado': 'badge-danger', 'Vencido': 'badge-danger',
        'Convertido': 'badge-info'
    };
    const classe = map[status] || 'badge-muted';
    return `<span class="badge ${classe}">${escapeHTML(status || '-')}</span>`;
}

async function proximoNumeroDocumento(colecaoNome, prefixo) {
    const ano = new Date().getFullYear();
    const lista = dadosCadastrados[colecaoNome] || [];
    const doAno = lista.filter(d => (d.numero || '').includes(`/${ano}`));
    const proximo = doAno.length + 1;
    return `${prefixo} ${String(proximo).padStart(4, '0')}/${ano}`;
}

function opcoesSelect(lista, valorAtual, placeholder) {
    let html = `<option value="">${placeholder}</option>`;
    lista.forEach(item => {
        const selected = valorAtual === item.value ? 'selected' : '';
        html += `<option value="${item.value}" ${selected}>${escapeHTML(item.label)}</option>`;
    });
    return html;
}

/* ===================================================================
   MODAL DINÂMICO PRINCIPAL (Cadastro simples: entidades / master data)
   =================================================================== */
window.acionarCadastro = function () {
    idSendoEditado = null;
    artigosBundleTemp = [];
    nomeConjuntoSendoEditado = '';
    const abaAtual = document.getElementById('subview-title').innerText;
    const handler = CADASTRO_HANDLERS[abaAtual];
    if (handler) { handler(null); }
    else { mostrarAlertaCustomizado(`A funcionalidade de cadastro para a aba "${abaAtual}" será implementada em breve.`, 'Aviso'); }
}

window.abrirModal = function (larguraMax) {
    const modal = document.getElementById('modal-cadastro');
    const box = modal.querySelector('.modal-box');
    box.style.maxWidth = larguraMax || '500px';
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('active'); }, 10);
}

window.fecharModal = function () {
    const modal = document.getElementById('modal-cadastro'); modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('dynamic-fields').innerHTML = '';
        document.getElementById('btn-guardar-texto').style.display = 'flex';
        document.getElementById('btn-avancar-bundle').style.display = 'none';
        idSendoEditado = null;
        artigosBundleTemp = [];
        nomeConjuntoSendoEditado = '';
        document.getElementById('btn-guardar-texto').disabled = false;
        window.onSalvarDadosDb = null;
    }, 300);
}

// Cada módulo regista aqui a função a executar quando o form principal for submetido
window.salvarDadosDb = async function (event) {
    event.preventDefault();
    if (typeof window.onSalvarDadosDb === 'function') { await window.onSalvarDadosDb(event); }
}

/* ===================================================================
   MODAL DE EXCLUSÃO (genérico para qualquer coleção)
   =================================================================== */
window.prepararExclusao = function (colecao, id) {
    idParaExcluir = id; colecaoParaExcluir = colecao;
    const modal = document.getElementById('modal-exclusao'); modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('active'); }, 10);
}

window.fecharModalExclusao = function () {
    const modal = document.getElementById('modal-exclusao'); modal.classList.remove('active');
    setTimeout(() => { modal.style.display = 'none'; idParaExcluir = null; colecaoParaExcluir = null; }, 300);
}

window.confirmarExclusao = async function () {
    if (!idParaExcluir || !colecaoParaExcluir) return;
    const btnConfirmar = document.getElementById('btn-confirmar-exclusao'); btnConfirmar.disabled = true; btnConfirmar.innerText = "A eliminar...";
    try {
        if (typeof window.onAntesDeExcluir === 'function') { await window.onAntesDeExcluir(colecaoParaExcluir, idParaExcluir); }
        await deleteDoc(doc(db, colecaoParaExcluir, idParaExcluir));
        fecharModalExclusao(); mostrarAlertaCustomizado('Registo eliminado com sucesso!', 'Sucesso');
    } catch (error) { mostrarAlertaCustomizado('Não foi possível eliminar o registo.', 'Erro'); } finally { btnConfirmar.disabled = false; btnConfirmar.innerText = "Sim, Eliminar"; }
}

/* ===================================================================
   MODAL DE ALERTA
   =================================================================== */
window.mostrarAlertaCustomizado = function (mensagem, titulo = 'Notificação') {
    document.getElementById('alerta-titulo').innerText = titulo; document.getElementById('alerta-mensagem').innerText = mensagem;
    const modalAlerta = document.getElementById('modal-alerta'); modalAlerta.style.display = 'flex'; setTimeout(() => { modalAlerta.classList.add('active'); }, 10);
}

window.fecharAlerta = function () {
    const modalAlerta = document.getElementById('modal-alerta'); modalAlerta.classList.remove('active'); setTimeout(() => { modalAlerta.style.display = 'none'; }, 300);
}

/* ===================================================================
   MODAL DE DOCUMENTO (Faturas, Guias, Notas — telas maiores e customizadas)
   =================================================================== */
window.abrirModalDocumento = function (titulo) {
    document.getElementById('documento-titulo').innerText = titulo;
    const modal = document.getElementById('modal-documento');
    modal.style.display = 'flex';
    setTimeout(() => { modal.classList.add('active'); }, 10);
}

window.fecharModalDocumento = function () {
    const modal = document.getElementById('modal-documento'); modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
        document.getElementById('documento-body').innerHTML = '';
        document.getElementById('documento-footer').innerHTML = '';
    }, 300);
}

/* ===================================================================
   MÓDULO: TABELAS
   =================================================================== */

/* ---------- Clientes / Fornecedores / Vendedores ---------- */
['Clientes', 'Fornecedores', 'Vendedores'].forEach(entidade => {
    RENDERERS[entidade] = function (display) {
        const lista = dadosCadastrados[entidade];
        if (!lista || lista.length === 0) {
            display.style.textAlign = 'center'; display.style.padding = '40px';
            display.innerHTML = `<div style="color: var(--text-muted);">Nenhum registo de ${entidade.toLowerCase()} encontrado. Clique no botão <strong>+ Cadastrar</strong> no cabeçalho para adicionar dados.</div>`;
            return;
        }
        display.style.textAlign = 'left'; display.style.padding = '0';
        const mostraTabelaPreco = entidade === 'Clientes';
        const mostraCreditoFornecedor = entidade === 'Fornecedores';
        let html = `<table class="elegant-table"><thead><tr><th>Nome</th><th>Morada</th><th>Código Postal</th><th>Telefone</th><th>NIF</th>${mostraTabelaPreco ? '<th>Tabela de Preço</th><th>Crédito Disponível</th>' : ''}${mostraCreditoFornecedor ? '<th>Crédito com Fornecedor</th>' : ''}<th>Ações</th></tr></thead><tbody>`;
        lista.forEach(item => {
            html += `<tr>
                <td>${escapeHTML(item.nome)}</td><td>${escapeHTML(item.morada)}</td><td>${escapeHTML(item.codigoPostal)}</td><td>${escapeHTML(item.telefone)}</td><td>${escapeHTML(item.nif)}</td>
                ${mostraTabelaPreco ? `<td>${item.tabelaPreco ? 'Preço ' + item.tabelaPreco : '<span class="badge badge-muted">Não definida</span>'}</td><td>${item.saldoCredito ? `<span class="badge badge-info">${formatMoeda(item.saldoCredito)}</span>` : '-'}</td>` : ''}
                ${mostraCreditoFornecedor ? `<td>${item.saldoCreditoFornecedor ? `<span class="badge badge-info">${formatMoeda(item.saldoCreditoFornecedor)}</span>` : '-'}</td>` : ''}
                <td><div class="action-buttons">${botaoEditar(entidade, item.id)}${botaoExcluir(entidade, item.id)}</div></td>
            </tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML = html;
    };

    CADASTRO_HANDLERS[entidade] = function (item) {
        const mostraTabelaPreco = entidade === 'Clientes';
        let opcoesTabela = '';
        if (mostraTabelaPreco) {
            for (let i = 1; i <= 5; i++) { opcoesTabela += `<option value="${i}" ${item && Number(item.tabelaPreco) === i ? 'selected' : ''}>Tabela de Preço ${i}</option>`; }
        }
        document.getElementById('dynamic-fields').innerHTML = `
            <div class="form-group"><label for="f-nome">Nome</label><input type="text" id="f-nome" class="form-control" placeholder="Introduza o nome" value="${item ? escapeHTML(item.nome) : ''}" required></div>
            <div class="form-group"><label for="f-morada">Morada</label><input type="text" id="f-morada" class="form-control" placeholder="Introduza a morada" value="${item ? escapeHTML(item.morada) : ''}" required></div>
            <div class="form-row">
                <div class="form-group"><label for="f-codigo-postal">Código postal</label><input type="text" id="f-codigo-postal" class="form-control" placeholder="Ex: 1000-001" value="${item ? escapeHTML(item.codigoPostal) : ''}" required></div>
                <div class="form-group"><label for="f-telefone">Telefone</label><input type="tel" id="f-telefone" class="form-control" placeholder="Contacto telefónico" value="${item ? escapeHTML(item.telefone) : ''}" required></div>
            </div>
            <div class="form-group"><label for="f-nif">NIF</label><input type="text" id="f-nif" class="form-control" placeholder="NIF (9 dígitos)" value="${item ? escapeHTML(item.nif) : ''}" required></div>
            ${mostraTabelaPreco ? `<div class="form-group"><label for="f-tabela-preco">Tabela de Preço associada</label><select id="f-tabela-preco" class="form-control" required><option value="">Selecione a tabela de preço do cliente...</option>${opcoesTabela}</select><div class="form-hint">Define qual das 5 tabelas de preço do artigo é usada automaticamente nas faturas deste cliente.</div></div>` : ''}
        `;
        document.getElementById('modal-titulo').innerText = item ? `Editar ${entidade.slice(0, -1)}` : `Novo(a) ${entidade.slice(0, -1)}`;
        document.getElementById('btn-guardar-texto').innerText = item ? `Atualizar ${entidade.slice(0, -1)}` : `Guardar ${entidade.slice(0, -1)}`;
        idSendoEditado = item ? item.id : null;

        window.onSalvarDadosDb = async function () {
            const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
            const dados = {
                nome: document.getElementById('f-nome').value,
                morada: document.getElementById('f-morada').value,
                codigoPostal: document.getElementById('f-codigo-postal').value,
                telefone: document.getElementById('f-telefone').value,
                nif: document.getElementById('f-nif').value,
                atualizadoEm: new Date().toISOString()
            };
            if (mostraTabelaPreco) { dados.tabelaPreco = Number(document.getElementById('f-tabela-preco').value); }
            try {
                if (idSendoEditado) {
                    await updateDoc(doc(db, entidade, idSendoEditado), dados); mostrarAlertaCustomizado(`${entidade.slice(0, -1)} atualizado com sucesso!`, 'Sucesso');
                } else {
                    dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, entidade), dados); mostrarAlertaCustomizado(`${entidade.slice(0, -1)} cadastrado com sucesso!`, 'Sucesso');
                }
                fecharModal();
            } catch (error) { mostrarAlertaCustomizado("Erro ao salvar! Tente novamente.", "Erro"); } finally { btnSalvar.disabled = false; btnSalvar.innerText = idSendoEditado ? `Atualizar ${entidade.slice(0, -1)}` : `Guardar ${entidade.slice(0, -1)}`; }
        };
        abrirModal('500px');
    };
});

window.abrirEdicaoSimples = function (entidade, id) {
    const item = dadosCadastrados[entidade].find(d => d.id === id);
    if (!item) return;
    CADASTRO_HANDLERS[entidade](item);
}

function botaoEditar(entidade, id, extraStop) {
    return `<button class="btn-action btn-edit" onclick="${extraStop ? 'event.stopPropagation();' : ''}abrirEdicaoSimples('${entidade}','${id}')" title="Editar"><svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button>`;
}
function botaoExcluir(entidade, id, extraStop) {
    return `<button class="btn-action btn-delete" onclick="${extraStop ? 'event.stopPropagation();' : ''}prepararExclusao('${entidade}','${id}')" title="Eliminar"><svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>`;
}

/* ---------- Categorias ---------- */
RENDERERS['Categorias'] = function (display) {
    const lista = dadosCadastrados['Categorias'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhuma categoria encontrada. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Material</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    lista.forEach(item => {
        html += `<tr><td>${escapeHTML(item.material)}</td><td><div class="action-buttons">${botaoEditar('Categorias', item.id)}${botaoExcluir('Categorias', item.id)}</div></td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['Categorias'] = function (item) {
    document.getElementById('dynamic-fields').innerHTML = `<div class="form-group"><label for="f-material">Material</label><input type="text" id="f-material" class="form-control" placeholder="Introduza o material (ex: Cobre)" value="${item ? escapeHTML(item.material) : ''}" required></div>`;
    document.getElementById('modal-titulo').innerText = item ? 'Editar Categoria' : 'Nova Categoria';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar Categoria' : 'Guardar Categoria';
    idSendoEditado = item ? item.id : null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const dados = { material: document.getElementById('f-material').value, atualizadoEm: new Date().toISOString() };
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'Categorias', idSendoEditado), dados); mostrarAlertaCustomizado('Categoria atualizada com sucesso!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'Categorias'), dados); mostrarAlertaCustomizado('Categoria cadastrada com sucesso!', 'Sucesso'); }
            fecharModal();
        } catch (error) { mostrarAlertaCustomizado("Erro ao salvar! Tente novamente.", "Erro"); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};

/* ---------- Artigos (com stock por Armazém A/B) ---------- */
window.calcularPrecoFinal = function (index) {
    const custo = parseFloat(document.getElementById(`custo-${index}`).value) || 0;
    const margem = parseFloat(document.getElementById(`margem-${index}`).value) || 0;
    const venda = custo + (custo * (margem / 100));
    document.getElementById(`venda-${index}`).value = venda.toFixed(2);
}

RENDERERS['Artigos'] = function (display) {
    const lista = dadosCadastrados['Artigos'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum artigo encontrado. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Código</th><th>Categoria</th><th>Stock Armazém A</th><th>Stock Armazém B</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    lista.forEach(item => {
        let precosHtml = '';
        if (item.precos && item.precos.length > 0) {
            precosHtml = `<table class="inner-table"><tr><th>Tabela</th><th>Custo (€)</th><th>Margem (%)</th><th>Preço Venda (€)</th></tr>`;
            item.precos.forEach((p, idx) => {
                let final = p.custo + (p.custo * (p.margem / 100));
                precosHtml += `<tr><td>Preço ${idx + 1}</td><td>${p.custo.toFixed(2)}</td><td>${p.margem.toFixed(2)}</td><td>${final.toFixed(2)}</td></tr>`;
            });
            precosHtml += `</table>`;
        }
        html += `
        <tr class="clickable-row" onclick="toggleLinhaDetalhes('detalhes-${item.id}', event)">
            <td>${escapeHTML(item.codigo)}</td><td>${escapeHTML(item.categoria)}</td>
            <td>${item.stockA ?? 0}</td><td>${item.stockB ?? 0}</td>
            <td><div class="action-buttons">${botaoEditar('Artigos', item.id, true)}${botaoExcluir('Artigos', item.id, true)}</div></td>
        </tr>
        <tr id="detalhes-${item.id}" class="details-row"><td colspan="5" style="padding: 10px 20px;">${precosHtml}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

window.toggleLinhaDetalhes = function (id, event) {
    if (event.target.closest('.action-buttons')) return;
    const tr = document.getElementById(id);
    if (tr) tr.classList.toggle('active');
}

CADASTRO_HANDLERS['Artigos'] = function (item) {
    let opcoesCategoria = `<option value="">Selecione um material...</option>`;
    dadosCadastrados['Categorias'].forEach(cat => {
        opcoesCategoria += `<option value="${escapeHTML(cat.material)}" ${item && item.categoria === cat.material ? 'selected' : ''}>${escapeHTML(cat.material)}</option>`;
    });

    let html = `
        <div class="form-row">
            <div class="form-group"><label for="f-codigo">Código</label><input type="text" id="f-codigo" class="form-control" placeholder="Ex: ART-001" value="${item ? escapeHTML(item.codigo) : ''}" required></div>
            <div class="form-group"><label for="f-categoria-select">Categoria</label><select id="f-categoria-select" class="form-control" required>${opcoesCategoria}</select></div>
        </div>
        <div class="form-row">
            <div class="form-group"><label for="f-stock-a">Stock no Armazém A</label><input type="number" id="f-stock-a" class="form-control" min="0" step="1" value="${item ? (item.stockA ?? 0) : 0}"></div>
            <div class="form-group"><label for="f-stock-b">Stock no Armazém B</label><input type="number" id="f-stock-b" class="form-control" min="0" step="1" value="${item ? (item.stockB ?? 0) : 0}"></div>
        </div>
        <h3 style="font-size: 0.95rem; margin: 10px 0; color: var(--primary);">Definição de Preços</h3>
    `;
    for (let i = 1; i <= 5; i++) {
        let pCusto = item && item.precos && item.precos[i - 1] ? item.precos[i - 1].custo : '';
        let pMargem = item && item.precos && item.precos[i - 1] ? item.precos[i - 1].margem : '';
        html += `
            <div style="display: flex; gap: 10px; margin-bottom: 12px; align-items: flex-end; padding-bottom: 12px; border-bottom: 1px dashed var(--border);">
                <div class="form-group" style="margin-bottom: 0; flex: 1;"><label style="font-size: 0.75rem;">Custo ${i} (€)</label><input type="number" id="custo-${i}" class="form-control" step="0.01" value="${pCusto}" oninput="calcularPrecoFinal(${i})"></div>
                <div class="form-group" style="margin-bottom: 0; flex: 1;"><label style="font-size: 0.75rem;">Margem ${i} (%)</label><input type="number" id="margem-${i}" class="form-control" step="0.01" value="${pMargem}" oninput="calcularPrecoFinal(${i})"></div>
                <div class="form-group" style="margin-bottom: 0; flex: 1;"><label style="font-size: 0.75rem;">Venda ${i} (€)</label><input type="text" id="venda-${i}" class="form-control" readonly style="background-color: #f3f4f6; color: #374151;"></div>
            </div>
        `;
    }
    document.getElementById('dynamic-fields').innerHTML = html;
    if (item) { for (let i = 1; i <= 5; i++) calcularPrecoFinal(i); }

    document.getElementById('modal-titulo').innerText = item ? 'Editar Artigo' : 'Novo(a) Artigo';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar Artigo' : 'Guardar Artigo';
    idSendoEditado = item ? item.id : null;

    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const dados = {
            codigo: document.getElementById('f-codigo').value,
            categoria: document.getElementById('f-categoria-select').value,
            stockA: parseInt(document.getElementById('f-stock-a').value) || 0,
            stockB: parseInt(document.getElementById('f-stock-b').value) || 0,
            precos: [], atualizadoEm: new Date().toISOString()
        };
        for (let i = 1; i <= 5; i++) {
            dados.precos.push({ custo: parseFloat(document.getElementById(`custo-${i}`).value) || 0, margem: parseFloat(document.getElementById(`margem-${i}`).value) || 0 });
        }
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'Artigos', idSendoEditado), dados); mostrarAlertaCustomizado('Artigo atualizado com sucesso!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'Artigos'), dados); mostrarAlertaCustomizado('Artigo cadastrado com sucesso!', 'Sucesso'); }
            fecharModal();
        } catch (error) { mostrarAlertaCustomizado("Erro ao salvar! Tente novamente.", "Erro"); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('650px');
};

/* ---------- Artigos Fabricados ---------- */
window.mostrarPrecosBundle = function (artigoId) {
    const container = document.getElementById('area-precos-bundle');
    if (!artigoId) { container.innerHTML = ''; return; }
    const artigo = dadosCadastrados['Artigos'].find(a => a.id === artigoId);
    if (!artigo || !artigo.precos) return;
    let html = `<table class="inner-table" style="cursor: pointer; margin-top: 10px;">
        <tr><th colspan="4" style="text-align:center; background-color: #fef3c7; color: #d97706; padding: 6px;">Clique na linha do preço desejado para adicionar ao conjunto</th></tr>
        <tr><th>Tabela</th><th>Custo (€)</th><th>Margem (%)</th><th>Preço Venda (€)</th></tr>`;
    artigo.precos.forEach((p, idx) => {
        let final = p.custo + (p.custo * (p.margem / 100));
        html += `<tr class="clickable-row" onclick="escolherPrecoBundle('${artigo.id}', ${idx}, ${p.custo})">
            <td>Preço ${idx + 1}</td><td>${p.custo.toFixed(2)}</td><td>${p.margem.toFixed(2)}</td><td>${final.toFixed(2)}</td>
        </tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

window.escolherPrecoBundle = function (artigoId, tabelaIndex, custo) {
    const artigo = dadosCadastrados['Artigos'].find(a => a.id === artigoId);
    artigosBundleTemp.push({ id: artigo.id, codigo: artigo.codigo, categoria: artigo.categoria, tabelaIndex: tabelaIndex, custo: custo });
    document.getElementById('select-artigo-bundle').value = '';
    document.getElementById('area-precos-bundle').innerHTML = '';
    renderListaBundle();
}

window.removerDoBundle = function (index) { artigosBundleTemp.splice(index, 1); renderListaBundle(); }

window.renderListaBundle = function () {
    const container = document.getElementById('area-lista-bundle');
    if (artigosBundleTemp.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 0.9rem; text-align: center;">Nenhum artigo adicionado ao conjunto no momento.</p>`;
        return;
    }
    let html = `<h3 style="font-size: 0.95rem; margin: 15px 0 10px 0; color: var(--primary);">Artigos no Conjunto</h3>
        <table class="elegant-table" style="font-size: 0.85rem;">
        <thead><tr><th>Artigo</th><th>Tabela Usada</th><th>Custo (€)</th><th style="width: 50px;">Ação</th></tr></thead><tbody>`;
    let total = 0;
    artigosBundleTemp.forEach((item, idx) => {
        total += item.custo;
        html += `<tr>
            <td>${item.codigo} - ${item.categoria}</td><td>Preço ${item.tabelaIndex + 1}</td><td>${item.custo.toFixed(2)}</td>
            <td><button type="button" class="btn-action btn-delete" style="padding: 4px;" onclick="removerDoBundle(${idx})" title="Remover"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button></td>
        </tr>`;
    });
    html += `<tr style="font-weight: 700; background-color: #f9fafb;"><td colspan="2" style="text-align: right;">Custo Total:</td><td colspan="2">${total.toFixed(2)} €</td></tr>`;
    html += `</tbody></table>`;
    container.innerHTML = html;
}

window.avancarBundle = function () {
    if (artigosBundleTemp.length === 0) { mostrarAlertaCustomizado("Adicione pelo menos um artigo ao conjunto antes de avançar.", "Atenção"); return; }
    document.getElementById('nome-conjunto-input').value = nomeConjuntoSendoEditado || '';
    const modal = document.getElementById('modal-nome-conjunto');
    modal.style.display = 'flex'; setTimeout(() => { modal.classList.add('active'); }, 10);
}

window.voltarBundle = function () {
    const modal = document.getElementById('modal-nome-conjunto');
    modal.classList.remove('active'); setTimeout(() => { modal.style.display = 'none'; }, 300);
}

window.salvarBundleFinal = async function () {
    const nome = document.getElementById('nome-conjunto-input').value.trim();
    if (!nome) { mostrarAlertaCustomizado("Digite um nome para salvar o conjunto.", "Atenção"); return; }
    const btnSalvar = document.getElementById('btn-salvar-bundle-final');
    btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
    let custoTotal = artigosBundleTemp.reduce((sum, item) => sum + item.custo, 0);
    const dados = { nome: nome, artigos: artigosBundleTemp, custoTotal: custoTotal, atualizadoEm: new Date().toISOString() };
    try {
        if (idSendoEditado) {
            await updateDoc(doc(db, 'Artigos Fabricados', idSendoEditado), dados);
            mostrarAlertaCustomizado("Conjunto atualizado com sucesso!", "Sucesso");
        } else {
            dados.criadoEm = new Date().toISOString();
            await addDoc(collection(db, 'Artigos Fabricados'), dados);
            mostrarAlertaCustomizado("Conjunto criado com sucesso!", "Sucesso");
        }
        fecharModal();
        voltarBundle();
    } catch (error) { mostrarAlertaCustomizado("Erro ao salvar conjunto.", "Erro"); } finally { btnSalvar.disabled = false; btnSalvar.innerText = "Salvar"; }
}

RENDERERS['Artigos Fabricados'] = function (display) {
    const lista = dadosCadastrados['Artigos Fabricados'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum conjunto encontrado. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Nome do Conjunto</th><th>Custo Total (€)</th><th>Qtd. Artigos</th><th style="width: 100px;">Ações</th></tr></thead><tbody>`;
    lista.forEach(item => {
        let artigosHtml = '';
        if (item.artigos && item.artigos.length > 0) {
            artigosHtml = `<table class="inner-table"><tr><th>Artigo</th><th>Tabela Utilizada</th><th>Custo (€)</th></tr>`;
            item.artigos.forEach((a) => { artigosHtml += `<tr><td>${a.codigo} - ${a.categoria}</td><td>Preço ${a.tabelaIndex + 1}</td><td>${a.custo.toFixed(2)}</td></tr>`; });
            artigosHtml += `</table>`;
        }
        html += `
        <tr class="clickable-row" onclick="toggleLinhaDetalhes('detalhes-${item.id}', event)">
            <td>${escapeHTML(item.nome)}</td><td>${(item.custoTotal || 0).toFixed(2)}</td><td>${item.artigos ? item.artigos.length : 0}</td>
            <td><div class="action-buttons">${botaoEditar('Artigos Fabricados', item.id, true)}${botaoExcluir('Artigos Fabricados', item.id, true)}</div></td>
        </tr>
        <tr id="detalhes-${item.id}" class="details-row"><td colspan="4" style="padding: 10px 20px;">${artigosHtml}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['Artigos Fabricados'] = function (item) {
    let opcoesArtigos = `<option value="">Buscar pelo Código ou Categoria...</option>`;
    dadosCadastrados['Artigos'].forEach(art => { opcoesArtigos += `<option value="${art.id}">${escapeHTML(art.codigo)} - ${escapeHTML(art.categoria)}</option>`; });
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group">
            <label for="select-artigo-bundle">Adicionar Artigo ao Conjunto</label>
            <select id="select-artigo-bundle" class="form-control" onchange="mostrarPrecosBundle(this.value)">${opcoesArtigos}</select>
        </div>
        <div id="area-precos-bundle"></div>
        <div id="area-lista-bundle" style="margin-top: 20px;"></div>
    `;
    document.getElementById('btn-guardar-texto').style.display = 'none';
    document.getElementById('btn-avancar-bundle').style.display = 'flex';
    idSendoEditado = item ? item.id : null;
    if (item) { artigosBundleTemp = [...item.artigos]; nomeConjuntoSendoEditado = item.nome; }
    renderListaBundle();
    document.getElementById('modal-titulo').innerText = item ? 'Editar Conjunto' : 'Novo(a) Conjunto';
    abrirModal('650px');
};

/* ---------- Armazéns (agrupamento com stock A/B) ---------- */
RENDERERS['Armazéns'] = function (display) {
    const artigos = dadosCadastrados['Artigos'];
    if (!artigos || artigos.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum artigo registado para ser listado nos armazéns.</div>`;
        return;
    }
    ['A', 'B'].forEach(arm => {
        display.innerHTML += '';
    });
    let html = '';
    ['A', 'B'].forEach(arm => {
        const campo = arm === 'A' ? 'stockA' : 'stockB';
        const itens = artigos.filter(a => (a[campo] || 0) > 0);
        html += `<h3 style="margin: 4px 0 10px 0; color: var(--text-dark);">Armazém ${arm}</h3>`;
        if (itens.length === 0) {
            html += `<div class="view-card" style="margin-bottom: 24px;">Nenhum artigo com stock no Armazém ${arm}.</div>`;
        } else {
            html += `<table class="elegant-table" style="margin-bottom: 24px;"><thead><tr><th>Código</th><th>Categoria</th><th>Quantidade</th></tr></thead><tbody>`;
            itens.forEach(a => { html += `<tr><td>${escapeHTML(a.codigo)}</td><td>${escapeHTML(a.categoria)}</td><td>${a[campo]}</td></tr>`; });
            html += `</tbody></table>`;
        }
    });
    display.innerHTML = html;
};

/* ---------- Controlo de Stocks (visão consolidada, somente leitura) ---------- */
RENDERERS['Controlo de stocks'] = function (display) {
    const artigos = dadosCadastrados['Artigos'];
    if (!artigos || artigos.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum artigo cadastrado ainda.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Código</th><th>Produto (Categoria)</th><th>Qtd. Armazém A</th><th>Qtd. Armazém B</th><th>Qtd. Total</th></tr></thead><tbody>`;
    artigos.forEach(a => {
        const total = (a.stockA || 0) + (a.stockB || 0);
        html += `<tr><td>${escapeHTML(a.codigo)}</td><td>${escapeHTML(a.categoria)}</td><td>${a.stockA || 0}</td><td>${a.stockB || 0}</td><td style="font-weight:700;">${total}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

/* ===================================================================
   CONSTRUTOR DE ITENS DE DOCUMENTO
   (reutilizado por Faturas, Guias, Notas de Crédito, Compras a Fornecedor...)
   =================================================================== */
let itensDocumentoTemp = [];
const DOCUMENTOS_REGISTRY = {};

function precoClienteParaArtigo(artigo, cliente) {
    if (!artigo.precos || artigo.precos.length === 0) return 0;
    const idx = cliente && cliente.tabelaPreco ? cliente.tabelaPreco - 1 : 0;
    const p = artigo.precos[idx] || artigo.precos[0];
    return p.custo + (p.custo * (p.margem / 100));
}

function renderSeletorArtigoDocumento(containerId, movimento) {
    // movimento: 'saida' (baixa stock A/B) | 'entrada' (soma stock) | 'nenhum' (não mexe em stock)
    let opcoes = `<option value="">Selecione um artigo...</option>`;
    dadosCadastrados['Artigos'].forEach(a => { opcoes += `<option value="${a.id}">${escapeHTML(a.codigo)} - ${escapeHTML(a.categoria)}</option>`; });
    return `
        <div class="form-row" style="align-items:flex-end; flex-wrap:wrap;">
            <div class="form-group" style="flex:2; min-width:180px;"><label>Artigo</label><select id="${containerId}-artigo" class="form-control" onchange="sugerirPrecoItemDocumento('${containerId}')">${opcoes}</select></div>
            ${movimento !== 'nenhum' ? `<div class="form-group" style="flex:1; min-width:90px;"><label>Armazém</label><select id="${containerId}-armazem" class="form-control"><option value="A">A</option><option value="B">B</option></select></div>` : ''}
            <div class="form-group" style="flex:1; min-width:90px;"><label>Quantidade</label><input type="number" id="${containerId}-qtd" class="form-control" min="1" step="1" value="1"></div>
            <div class="form-group" style="flex:1; min-width:110px;"><label>Preço Unit. (€)</label><input type="number" id="${containerId}-preco" class="form-control" min="0" step="0.01" value="0"></div>
            <div class="form-group" style="flex:0;"><button type="button" class="btn-secundario" onclick="adicionarItemDocumento('${containerId}','${movimento}')">+ Adicionar</button></div>
        </div>
        <div id="${containerId}-lista"></div>
        <div id="${containerId}-total" style="text-align:right; font-weight:800; font-size:1.05rem; margin-top:10px; color: var(--text-dark);"></div>
    `;
}

window.sugerirPrecoItemDocumento = function (containerId) {
    const artigoId = document.getElementById(`${containerId}-artigo`).value;
    const artigo = dadosCadastrados['Artigos'].find(a => a.id === artigoId);
    if (!artigo) return;
    const clienteSelect = document.getElementById('doc-cliente');
    const cliente = clienteSelect ? dadosCadastrados['Clientes'].find(c => c.id === clienteSelect.value) : null;
    document.getElementById(`${containerId}-preco`).value = precoClienteParaArtigo(artigo, cliente).toFixed(2);
}

window.adicionarItemDocumento = function (containerId, movimento) {
    const artigoId = document.getElementById(`${containerId}-artigo`).value;
    const qtd = parseInt(document.getElementById(`${containerId}-qtd`).value) || 0;
    const preco = parseFloat(document.getElementById(`${containerId}-preco`).value) || 0;
    const armazemEl = document.getElementById(`${containerId}-armazem`);
    const armazem = armazemEl ? armazemEl.value : null;
    if (!artigoId || qtd <= 0) { mostrarAlertaCustomizado('Selecione um artigo e uma quantidade válida.', 'Atenção'); return; }
    const artigo = dadosCadastrados['Artigos'].find(a => a.id === artigoId);
    if (movimento === 'saida' && armazem) {
        const disponivel = armazem === 'A' ? (artigo.stockA || 0) : (artigo.stockB || 0);
        const jaNoCarrinho = itensDocumentoTemp.filter(i => i.artigoId === artigoId && i.armazem === armazem).reduce((s, i) => s + i.quantidade, 0);
        if (qtd + jaNoCarrinho > disponivel) { mostrarAlertaCustomizado(`Stock insuficiente no Armazém ${armazem}. Disponível: ${disponivel}.`, 'Atenção'); return; }
    }
    itensDocumentoTemp.push({ artigoId, codigo: artigo.codigo, categoria: artigo.categoria, armazem, quantidade: qtd, precoUnit: preco, subtotal: qtd * preco });
    document.getElementById(`${containerId}-qtd`).value = 1;
    document.getElementById(`${containerId}-preco`).value = 0;
    renderListaItensDocumento(containerId);
}

window.removerItemDocumento = function (containerId, index) { itensDocumentoTemp.splice(index, 1); renderListaItensDocumento(containerId); }

function renderListaItensDocumento(containerId) {
    const lista = document.getElementById(`${containerId}-lista`);
    const totalDiv = document.getElementById(`${containerId}-total`);
    if (!lista) return;
    const temArmazem = itensDocumentoTemp.some(i => i.armazem);
    if (itensDocumentoTemp.length === 0) { lista.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem; margin-top:10px;">Nenhum artigo adicionado.</p>`; totalDiv.innerText = ''; return; }
    let html = `<table class="elegant-table" style="margin-top:14px; font-size:0.88rem;"><thead><tr><th>Artigo</th>${temArmazem ? '<th>Armazém</th>' : ''}<th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th><th></th></tr></thead><tbody>`;
    let total = 0;
    itensDocumentoTemp.forEach((it, idx) => {
        total += it.subtotal;
        html += `<tr><td>${escapeHTML(it.codigo)} - ${escapeHTML(it.categoria)}</td>${temArmazem ? `<td>${it.armazem || '-'}</td>` : ''}<td>${it.quantidade}</td><td>${formatMoeda(it.precoUnit)}</td><td>${formatMoeda(it.subtotal)}</td>
            <td><button type="button" class="btn-action btn-delete" onclick="removerItemDocumento('${containerId}',${idx})" title="Remover"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button></td></tr>`;
    });
    html += `</tbody></table>`;
    lista.innerHTML = html;
    totalDiv.innerText = `Total: ${formatMoeda(total)}`;
}

async function aplicarMovimentoStock(itens, movimento) {
    // movimento: 'saida' (retirar) | 'entrada' (adicionar)
    const sinal = movimento === 'saida' ? -1 : 1;
    for (const it of itens) {
        if (!it.armazem) continue;
        const campo = it.armazem === 'A' ? 'stockA' : 'stockB';
        await updateDoc(doc(db, 'Artigos', it.artigoId), { [campo]: increment(sinal * it.quantidade) });
    }
}

function detalheItensHtml(item) {
    if (!item.itens || item.itens.length === 0) return '<span style="color:var(--text-muted);">Sem itens associados.</span>';
    let html = `<table class="inner-table"><tr><th>Artigo</th><th>Armazém</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr>`;
    item.itens.forEach(i => { html += `<tr><td>${escapeHTML(i.codigo)} - ${escapeHTML(i.categoria)}</td><td>${i.armazem || '-'}</td><td>${i.quantidade}</td><td>${formatMoeda(i.precoUnit)}</td><td>${formatMoeda(i.subtotal)}</td></tr>`; });
    html += `</table>`;
    return html;
}

/* ---------- Registo genérico de documentos com itens (Faturas, Guias, Notas...) ---------- */
function registrarDocumentoComItens(aba, cfg) {
    DOCUMENTOS_REGISTRY[aba] = cfg;

    RENDERERS[aba] = function (display) {
        const lista = dadosCadastrados[cfg.collection] || [];
        if (lista.length === 0) {
            display.style.textAlign = 'center'; display.style.padding = '40px';
            display.innerHTML = `<div style="color: var(--text-muted);">Nenhum(a) ${aba.toLowerCase()} emitido(a) ainda. Clique em <strong>+ Cadastrar</strong> para criar.</div>`;
            return;
        }
        const campoNome = cfg.campoEntidadeNome || 'clienteNome';
        let html = `<table class="elegant-table"><thead><tr><th>Número</th>${cfg.exigeCliente ? `<th>${cfg.entidadeLabel || 'Cliente'}</th>` : ''}<th>Data</th><th>Total</th><th>Status</th><th style="width:140px;">Ações</th></tr></thead><tbody>`;
        [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
            html += `<tr class="clickable-row" onclick="toggleLinhaDetalhes('det-${item.id}', event)">
                <td>${escapeHTML(item.numero)}</td>${cfg.exigeCliente ? `<td>${escapeHTML(item[campoNome] || '-')}</td>` : ''}<td>${formatDataPt(item.data)}</td><td>${formatMoeda(item.total)}</td><td>${badgeStatus(item.status)}</td>
                <td><div class="action-buttons">${cfg.podeRecibo && item.status === 'Pendente' ? `<button class="btn-action btn-view" onclick="event.stopPropagation(); ${cfg.reciboFn || 'emitirReciboDeFatura'}('${cfg.collection}','${item.id}')" title="Emitir Recibo (dar baixa)"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg></button>` : ''}${botaoExcluir(cfg.collection, item.id, true)}</div></td>
            </tr>
            <tr id="det-${item.id}" class="details-row"><td colspan="${cfg.exigeCliente ? 6 : 5}" style="padding:10px 20px;">${detalheItensHtml(item)}</td></tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML = html;
    };

    CADASTRO_HANDLERS[aba] = function () {
        itensDocumentoTemp = [];
        let opcoesCliente = cfg.exigeCliente ? opcoesSelect(dadosCadastrados[cfg.entidadeCollection || 'Clientes'].map(c => ({ value: c.id, label: c.nome })), '', `Selecione ${cfg.entidadeLabel || 'o cliente'}...`) : '';
        document.getElementById('documento-body').innerHTML = `
            ${cfg.exigeCliente ? `<div class="form-group"><label>${cfg.entidadeLabel || 'Cliente'}</label><select id="doc-cliente" class="form-control" required>${opcoesCliente}</select></div>` : ''}
            <div class="form-group"><label>Data</label><input type="date" id="doc-data" class="form-control" value="${hojeISO()}"></div>
            <h3 style="font-size:0.95rem; margin: 14px 0 8px; color: var(--primary);">Artigos</h3>
            ${renderSeletorArtigoDocumento('doc', cfg.movimentoStock)}
        `;
        document.getElementById('documento-footer').innerHTML = `
            <button class="btn-cancelar" type="button" onclick="fecharModalDocumento()">Cancelar</button>
            <button class="btn-salvar" type="button" onclick="salvarDocumentoComItens('${aba}')">Guardar ${cfg.singular}</button>
        `;
        abrirModalDocumento(`Novo(a) ${cfg.singular}`);
        renderListaItensDocumento('doc');
    };
}

window.salvarDocumentoComItens = async function (aba) {
    const cfg = DOCUMENTOS_REGISTRY[aba];
    if (itensDocumentoTemp.length === 0) { mostrarAlertaCustomizado('Adicione pelo menos um artigo ao documento.', 'Atenção'); return; }
    const campoId = cfg.campoEntidadeId || 'clienteId', campoNome = cfg.campoEntidadeNome || 'clienteNome';
    let entidadeId = null, entidadeNome = null;
    if (cfg.exigeCliente) {
        entidadeId = document.getElementById('doc-cliente').value;
        if (!entidadeId) { mostrarAlertaCustomizado(`Selecione ${cfg.entidadeLabel || 'o cliente'}.`, 'Atenção'); return; }
        const itemEntidade = dadosCadastrados[cfg.entidadeCollection || 'Clientes'].find(c => c.id === entidadeId);
        entidadeNome = itemEntidade ? (cfg.entidadeNomeFn ? cfg.entidadeNomeFn(itemEntidade) : itemEntidade.nome) : '';
    }
    const total = itensDocumentoTemp.reduce((s, i) => s + i.subtotal, 0);
    const numero = await proximoNumeroDocumento(cfg.collection, cfg.prefixo);
    const dados = {
        numero, data: document.getElementById('doc-data').value || hojeISO(),
        itens: itensDocumentoTemp, total, status: cfg.statusInicial,
        criadoEm: new Date().toISOString()
    };
    if (cfg.exigeCliente) { dados[campoId] = entidadeId; dados[campoNome] = entidadeNome; }
    try {
        await addDoc(collection(db, cfg.collection), dados);
        if (cfg.movimentoStock !== 'nenhum') { await aplicarMovimentoStock(itensDocumentoTemp, cfg.movimentoStock); }
        mostrarAlertaCustomizado(`${cfg.singular} emitido(a) com sucesso!`, 'Sucesso');
        fecharModalDocumento();
    } catch (e) { mostrarAlertaCustomizado('Erro ao emitir documento.', 'Erro'); }
}

/* ===================================================================
   MÓDULO: DOCUMENTOS > VENDA
   =================================================================== */
registrarDocumentoComItens('Faturas', { collection: 'Faturas', singular: 'Fatura', prefixo: 'FT', exigeCliente: true, movimentoStock: 'saida', statusInicial: 'Pendente', podeRecibo: true });
registrarDocumentoComItens('Faturas Simplificada', { collection: 'FaturasSimplificadas', singular: 'Fatura Simplificada', prefixo: 'FS', exigeCliente: false, movimentoStock: 'saida', statusInicial: 'Pago', podeRecibo: false });
registrarDocumentoComItens('Faturas-Recibo', { collection: 'FaturasRecibo', singular: 'Fatura-Recibo', prefixo: 'FR', exigeCliente: true, movimentoStock: 'saida', statusInicial: 'Pago', podeRecibo: false });

async function emitirRecibo(colecaoOrigem, faturaId, colecaoRecibo, prefixo, campoEntidadeId, campoEntidadeNome) {
    const fatura = dadosCadastrados[colecaoOrigem].find(f => f.id === faturaId);
    if (!fatura) return;
    try {
        const numero = await proximoNumeroDocumento(colecaoRecibo, prefixo);
        await addDoc(collection(db, colecaoRecibo), {
            numero, faturaId, faturaNumero: fatura.numero, colecaoOrigem,
            [campoEntidadeId]: fatura[campoEntidadeId] || null, [campoEntidadeNome]: fatura[campoEntidadeNome] || '',
            total: fatura.total, data: hojeISO(), criadoEm: new Date().toISOString()
        });
        await updateDoc(doc(db, colecaoOrigem, faturaId), { status: 'Pago' });
        mostrarAlertaCustomizado('Recibo emitido e documento marcado como pago!', 'Sucesso');
    } catch (e) { mostrarAlertaCustomizado('Erro ao emitir recibo.', 'Erro'); }
}
window.emitirReciboDeFatura = (colecaoOrigem, faturaId) => emitirRecibo(colecaoOrigem, faturaId, 'RecibosVenda', 'REC', 'clienteId', 'clienteNome');
window.emitirReciboFornecedor = (colecaoOrigem, faturaId) => emitirRecibo(colecaoOrigem, faturaId, 'RecibosFornecedor', 'RF', 'fornecedorId', 'fornecedorNome');

/* ===================================================================
   DASHBOARD > FOLHA DE OBRA (1 cliente = 1 obra, sempre separadas)
   =================================================================== */
RENDERERS['Folha de Obra'] = function (display) {
    const lista = dadosCadastrados['FolhaObra'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhuma folha de obra criada. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Cliente</th><th>Obra / Descrição</th><th>Data Início</th><th>Status</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr><td>${escapeHTML(item.clienteNome)}</td><td>${escapeHTML(item.descricao)}</td><td>${formatDataPt(item.dataInicio)}</td><td>${badgeStatus(item.status)}</td>
            <td><div class="action-buttons">${botaoEditar('FolhaObra', item.id)}${botaoExcluir('FolhaObra', item.id)}</div></td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['Folha de Obra'] = function (item) {
    const opcoesCliente = opcoesSelect(dadosCadastrados['Clientes'].map(c => ({ value: c.id, label: c.nome })), item ? item.clienteId : '', 'Selecione o cliente...');
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-cliente">Cliente</label><select id="f-cliente" class="form-control" required>${opcoesCliente}</select></div>
        <div class="form-group"><label for="f-descricao">Descrição da Obra</label><textarea id="f-descricao" class="form-control" placeholder="Ex: Instalação elétrica moradia Rua X" required>${item ? escapeHTML(item.descricao) : ''}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label for="f-data-inicio">Data de Início</label><input type="date" id="f-data-inicio" class="form-control" value="${item ? item.dataInicio : hojeISO()}"></div>
            <div class="form-group"><label for="f-status-obra">Status</label><select id="f-status-obra" class="form-control">
                <option value="Em Aberto" ${item && item.status === 'Em Aberto' ? 'selected' : ''}>Em Aberto</option>
                <option value="Concluído" ${item && item.status === 'Concluído' ? 'selected' : ''}>Concluído</option>
            </select></div>
        </div>
    `;
    document.getElementById('modal-titulo').innerText = item ? 'Editar Folha de Obra' : 'Nova Folha de Obra';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar' : 'Guardar';
    idSendoEditado = item ? item.id : null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const clienteId = document.getElementById('f-cliente').value;
        const dados = {
            clienteId, clienteNome: dadosCadastrados['Clientes'].find(c => c.id === clienteId)?.nome || '',
            descricao: document.getElementById('f-descricao').value,
            dataInicio: document.getElementById('f-data-inicio').value,
            status: document.getElementById('f-status-obra').value,
            atualizadoEm: new Date().toISOString()
        };
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'FolhaObra', idSendoEditado), dados); mostrarAlertaCustomizado('Folha de Obra atualizada!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'FolhaObra'), dados); mostrarAlertaCustomizado('Folha de Obra criada!', 'Sucesso'); }
            fecharModal();
        } catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};
// abrirEdicaoSimples() procura o handler pelo nome da coleção — regista o alias (a aba chama-se "Folha de Obra", a coleção "FolhaObra")
CADASTRO_HANDLERS['FolhaObra'] = CADASTRO_HANDLERS['Folha de Obra'];

/* ===================================================================
   MÓDULO: DOCUMENTOS > TRANSPORTE (Guia de Remessa ligada à Folha de Obra)
   =================================================================== */
registrarDocumentoComItens('Guia de Remessa', {
    collection: 'GuiaRemessa', singular: 'Guia de Remessa', prefixo: 'GR',
    exigeCliente: true, entidadeCollection: 'FolhaObra', entidadeLabel: 'Obra',
    entidadeNomeFn: (obra) => `${obra.clienteNome} - ${obra.descricao}`,
    movimentoStock: 'saida', statusInicial: 'Emitida', podeRecibo: false
});
// A Guia de Remessa usa a Folha de Obra como "entidade" (1 obra = 1 conjunto de guias); mostra também o cliente da obra.
{
    const cfgOriginal = DOCUMENTOS_REGISTRY['Guia de Remessa'];
    const cadastroOriginal = CADASTRO_HANDLERS['Guia de Remessa'];
    CADASTRO_HANDLERS['Guia de Remessa'] = function () {
        if (!dadosCadastrados['FolhaObra'] || dadosCadastrados['FolhaObra'].length === 0) {
            mostrarAlertaCustomizado('Crie primeiro uma Folha de Obra em Dashboard > Obras antes de emitir uma Guia de Remessa.', 'Atenção'); return;
        }
        itensDocumentoTemp = [];
        const opcoesObra = opcoesSelect(dadosCadastrados['FolhaObra'].map(o => ({ value: o.id, label: `${o.clienteNome} - ${o.descricao}` })), '', 'Selecione a obra...');
        document.getElementById('documento-body').innerHTML = `
            <div class="form-group"><label>Obra (Cliente)</label><select id="doc-cliente" class="form-control" required>${opcoesObra}</select></div>
            <div class="form-group"><label>Data</label><input type="date" id="doc-data" class="form-control" value="${hojeISO()}"></div>
            <h3 style="font-size:0.95rem; margin: 14px 0 8px; color: var(--primary);">Material a Enviar</h3>
            ${renderSeletorArtigoDocumento('doc', 'saida')}
        `;
        document.getElementById('documento-footer').innerHTML = `
            <button class="btn-cancelar" type="button" onclick="fecharModalDocumento()">Cancelar</button>
            <button class="btn-salvar" type="button" onclick="salvarDocumentoComItens('Guia de Remessa')">Guardar Guia de Remessa</button>
        `;
        abrirModalDocumento('Nova Guia de Remessa');
        renderListaItensDocumento('doc');
    };
}

/* ===================================================================
   MÓDULO: DOCUMENTOS > OUTROS (Fatura pro forma / Orçamento + Avenças)
   =================================================================== */
registrarDocumentoComItens('Fatura pro forma / Orçamento', {
    collection: 'FaturasProForma', singular: 'Fatura pro forma / Orçamento', prefixo: 'PF',
    exigeCliente: true, movimentoStock: 'nenhum', statusInicial: 'Em Aberto', podeRecibo: false
});
// Sobrescreve a listagem para incluir o botão "Converter em Fatura"
RENDERERS['Fatura pro forma / Orçamento'] = function (display) {
    const lista = dadosCadastrados['FaturasProForma'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum orçamento criado ainda. Não baixa stock — serve para apresentar ao cliente antes da venda.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Número</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th><th style="width:150px;">Ações</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr class="clickable-row" onclick="toggleLinhaDetalhes('det-${item.id}', event)">
            <td>${escapeHTML(item.numero)}</td><td>${escapeHTML(item.clienteNome)}</td><td>${formatDataPt(item.data)}</td><td>${formatMoeda(item.total)}</td><td>${badgeStatus(item.status)}</td>
            <td><div class="action-buttons">${item.status === 'Em Aberto' ? `<button class="btn-action btn-view" onclick="event.stopPropagation(); converterProFormaEmFatura('${item.id}')" title="Converter em Fatura"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"></path></svg></button>` : ''}${botaoExcluir('FaturasProForma', item.id, true)}</div></td>
        </tr>
        <tr id="det-${item.id}" class="details-row"><td colspan="6" style="padding:10px 20px;">${detalheItensHtml(item)}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

window.converterProFormaEmFatura = async function (proFormaId) {
    const pf = dadosCadastrados['FaturasProForma'].find(p => p.id === proFormaId);
    if (!pf) return;
    try {
        const numero = await proximoNumeroDocumento('Faturas', 'FT');
        await addDoc(collection(db, 'Faturas'), {
            numero, data: hojeISO(), clienteId: pf.clienteId, clienteNome: pf.clienteNome,
            itens: pf.itens, total: pf.total, status: 'Pendente', origemProFormaId: pf.id, criadoEm: new Date().toISOString()
        });
        await aplicarMovimentoStock(pf.itens, 'saida');
        await updateDoc(doc(db, 'FaturasProForma', proFormaId), { status: 'Convertido' });
        mostrarAlertaCustomizado('Orçamento convertido em Fatura e stock atualizado!', 'Sucesso');
    } catch (e) { mostrarAlertaCustomizado('Erro ao converter em fatura.', 'Erro'); }
}

/* ---------- Avenças (calendário de serviços recorrentes) ---------- */
let avencaEntradasTemp = [];

RENDERERS['Avenças'] = function (display) {
    const lista = dadosCadastrados['Avencas'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhuma avença criada. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    const hoje = hojeISO();
    let html = `<table class="elegant-table"><thead><tr><th>Cliente</th><th>Título</th><th>Próxima Tarefa</th><th>Status</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    lista.forEach(item => {
        const pendentes = (item.entradas || []).filter(e => !e.feito).sort((a, b) => a.data.localeCompare(b.data));
        const proxima = pendentes[0];
        let proximaHtml = '<span style="color:var(--text-muted);">Sem tarefas pendentes</span>';
        if (proxima) {
            const atrasada = proxima.data < hoje;
            proximaHtml = `${formatDataPt(proxima.data)} — ${escapeHTML(proxima.descricao)} ${atrasada ? '<span class="badge badge-danger">Atrasada</span>' : (proxima.data === hoje ? '<span class="badge badge-warning">Hoje</span>' : '')}`;
        }
        html += `<tr class="clickable-row" onclick="toggleLinhaDetalhes('det-${item.id}', event)">
            <td>${escapeHTML(item.clienteNome)}</td><td>${escapeHTML(item.titulo)}</td><td>${proximaHtml}</td><td>${badgeStatus(item.ativa === false ? 'Cancelado' : 'Ativa')}</td>
            <td><div class="action-buttons">${item.ativa !== false ? `<button class="btn-action btn-delete" onclick="event.stopPropagation(); cancelarAvenca('${item.id}')" title="Cancelar Avença"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg></button>` : ''}${botaoExcluir('Avencas', item.id, true)}</div></td>
        </tr>
        <tr id="det-${item.id}" class="details-row"><td colspan="5" style="padding:10px 20px;">${renderEntradasAvenca(item)}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

function renderEntradasAvenca(item) {
    if (!item.entradas || item.entradas.length === 0) return '<span style="color:var(--text-muted);">Sem tarefas cadastradas.</span>';
    let html = `<table class="inner-table"><tr><th>Data</th><th>O que deve ser feito</th><th>Status</th><th></th></tr>`;
    [...item.entradas].sort((a, b) => a.data.localeCompare(b.data)).forEach((e) => {
        const idxReal = item.entradas.indexOf(e);
        html += `<tr><td>${formatDataPt(e.data)}</td><td>${escapeHTML(e.descricao)}</td><td>${badgeStatus(e.feito ? 'Concluído' : 'Pendente')}</td>
            <td>${!e.feito ? `<button type="button" class="btn-action btn-view" onclick="marcarTarefaAvencaFeita('${item.id}',${idxReal})" title="Marcar como feito"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg></button>` : ''}</td></tr>`;
    });
    html += `</table>`;
    return html;
}

window.marcarTarefaAvencaFeita = async function (avencaId, idx) {
    const item = dadosCadastrados['Avencas'].find(a => a.id === avencaId);
    if (!item) return;
    const entradas = [...item.entradas]; entradas[idx] = { ...entradas[idx], feito: true };
    await updateDoc(doc(db, 'Avencas', avencaId), { entradas });
}

window.cancelarAvenca = async function (avencaId) {
    await updateDoc(doc(db, 'Avencas', avencaId), { ativa: false });
    mostrarAlertaCustomizado('Avença cancelada.', 'Sucesso');
}

window.adicionarEntradaAvenca = function () {
    const data = document.getElementById('avenca-data').value;
    const descricao = document.getElementById('avenca-descricao').value.trim();
    if (!data || !descricao) { mostrarAlertaCustomizado('Preencha a data e a descrição da tarefa.', 'Atenção'); return; }
    avencaEntradasTemp.push({ data, descricao, feito: false });
    document.getElementById('avenca-descricao').value = '';
    renderListaEntradasAvencaTemp();
}

window.removerEntradaAvencaTemp = function (idx) { avencaEntradasTemp.splice(idx, 1); renderListaEntradasAvencaTemp(); }

function renderListaEntradasAvencaTemp() {
    const container = document.getElementById('avenca-lista-temp');
    if (!container) return;
    if (avencaEntradasTemp.length === 0) { container.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Nenhuma tarefa adicionada ao calendário desta avença.</p>`; return; }
    let html = `<table class="inner-table"><tr><th>Data</th><th>Descrição</th><th></th></tr>`;
    [...avencaEntradasTemp].sort((a, b) => a.data.localeCompare(b.data)).forEach((e) => {
        const idxReal = avencaEntradasTemp.indexOf(e);
        html += `<tr><td>${formatDataPt(e.data)}</td><td>${escapeHTML(e.descricao)}</td><td><button type="button" class="btn-action btn-delete" onclick="removerEntradaAvencaTemp(${idxReal})"><svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path></svg></button></td></tr>`;
    });
    html += `</table>`;
    container.innerHTML = html;
}

CADASTRO_HANDLERS['Avenças'] = function (item) {
    avencaEntradasTemp = item ? [...item.entradas] : [];
    const opcoesCliente = opcoesSelect(dadosCadastrados['Clientes'].map(c => ({ value: c.id, label: c.nome })), item ? item.clienteId : '', 'Selecione o cliente...');
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-cliente-avenca">Cliente</label><select id="f-cliente-avenca" class="form-control" required>${opcoesCliente}</select></div>
        <div class="form-group"><label for="f-titulo-avenca">Título da Avença</label><input type="text" id="f-titulo-avenca" class="form-control" placeholder="Ex: Manutenção mensal quadro elétrico" value="${item ? escapeHTML(item.titulo) : ''}" required></div>
        <h3 style="font-size: 0.95rem; margin: 14px 0 8px; color: var(--primary);">Calendário de Tarefas</h3>
        <div class="form-row" style="align-items:flex-end;">
            <div class="form-group" style="flex:1;"><label>Data</label><input type="date" id="avenca-data" class="form-control"></div>
            <div class="form-group" style="flex:2;"><label>O que deve ser feito nesse dia</label><input type="text" id="avenca-descricao" class="form-control" placeholder="Ex: Verificar disjuntores"></div>
            <div class="form-group" style="flex:0;"><button type="button" class="btn-secundario" onclick="adicionarEntradaAvenca()">+ Adicionar</button></div>
        </div>
        <div id="avenca-lista-temp"></div>
    `;
    document.getElementById('modal-titulo').innerText = item ? 'Editar Avença' : 'Nova Avença';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar Avença' : 'Guardar Avença';
    idSendoEditado = item ? item.id : null;
    renderListaEntradasAvencaTemp();
    window.onSalvarDadosDb = async function () {
        if (avencaEntradasTemp.length === 0) { mostrarAlertaCustomizado('Adicione pelo menos uma tarefa ao calendário da avença.', 'Atenção'); return; }
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const clienteId = document.getElementById('f-cliente-avenca').value;
        const dados = {
            clienteId, clienteNome: dadosCadastrados['Clientes'].find(c => c.id === clienteId)?.nome || '',
            titulo: document.getElementById('f-titulo-avenca').value,
            entradas: avencaEntradasTemp, ativa: true, atualizadoEm: new Date().toISOString()
        };
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'Avencas', idSendoEditado), dados); mostrarAlertaCustomizado('Avença atualizada!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'Avencas'), dados); mostrarAlertaCustomizado('Avença criada!', 'Sucesso'); }
            fecharModal();
        } catch (e) { mostrarAlertaCustomizado('Erro ao salvar avença.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('600px');
};

/* ===================================================================
   MÓDULO: DOCUMENTOS > LIQUIDAÇÕES (Recibos, Notas de Crédito, Devoluções)
   =================================================================== */
RENDERERS['Recibos'] = function (display) {
    const lista = dadosCadastrados['RecibosVenda'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum recibo emitido ainda. Os recibos são emitidos a partir de Faturas pendentes (botão de check na lista de Faturas), o que dá baixa automaticamente na fatura.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Número</th><th>Cliente</th><th>Fatura de Origem</th><th>Total</th><th>Data</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr><td>${escapeHTML(item.numero)}</td><td>${escapeHTML(item.clienteNome || '-')}</td><td>${escapeHTML(item.faturaNumero)}</td><td>${formatMoeda(item.total)}</td><td>${formatDataPt(item.data)}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

/* ---------- Notas de Crédito / Devoluções (devolução de itens de um documento já emitido) ----------
   Reutilizada tanto do lado da Venda (cliente devolve artigo) como do lado das Compras
   (nós devolvemos artigo ao fornecedor) — só muda a direção do stock e quem recebe o crédito. */
const DEVOLUCAO_REGISTRY = {};
let devolucaoContextoTemp = null;

function listaDocumentosCombinados(colecoes) {
    const combos = [];
    colecoes.forEach(col => { (dadosCadastrados[col] || []).forEach(d => combos.push({ ...d, _colecao: col })); });
    return combos.sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || ''));
}

window.selecionarDocumentoDevolucao = function (valorCombinado, aba) {
    const cfg = DEVOLUCAO_REGISTRY[aba];
    const areaItens = document.getElementById('devolucao-itens-area');
    if (!valorCombinado) { areaItens.innerHTML = ''; devolucaoContextoTemp = null; return; }
    const [colecao, docId] = valorCombinado.split('::');
    const origem = dadosCadastrados[colecao].find(d => d.id === docId);
    if (!origem || !origem.itens || origem.itens.length === 0) { areaItens.innerHTML = '<p style="color:var(--text-muted);">Este documento não tem artigos associados.</p>'; devolucaoContextoTemp = null; return; }
    devolucaoContextoTemp = { colecaoOrigem: colecao, docId, origemNumero: origem.numero, entidadeId: origem[cfg.campoEntidadeId] || null, entidadeNome: origem[cfg.campoEntidadeNome] || '', itensOrigem: origem.itens };
    let html = `<table class="inner-table"><tr><th>Artigo</th><th>Qtd Original</th><th>Preço/Custo Unit.</th><th>Qtd a Devolver</th></tr>`;
    origem.itens.forEach((it, idx) => {
        html += `<tr><td>${escapeHTML(it.codigo)} - ${escapeHTML(it.categoria)}</td><td>${it.quantidade}</td><td>${formatMoeda(it.precoUnit)}</td>
            <td><input type="number" class="form-control" id="devolver-qtd-${idx}" min="0" max="${it.quantidade}" value="0" style="width:90px;"></td></tr>`;
    });
    html += `</table>`;
    areaItens.innerHTML = html;
}

function registrarNotaDevolucao(aba, cfg) {
    // cfg: {collection, singular, prefixo, origemColecoes, campoEntidadeId, campoEntidadeNome, entidadeLabel, movimentoStock, creditoCollection, creditoCampo, mensagemCredito}
    DEVOLUCAO_REGISTRY[aba] = cfg;
    RENDERERS[aba] = function (display) {
        const lista = dadosCadastrados[cfg.collection];
        if (!lista || lista.length === 0) {
            display.style.textAlign = 'center'; display.style.padding = '40px';
            display.innerHTML = `<div style="color: var(--text-muted);">Nenhum(a) ${aba.toLowerCase()} registado(a) ainda.</div>`;
            return;
        }
        let html = `<table class="elegant-table"><thead><tr><th>Número</th><th>${cfg.entidadeLabel}</th><th>Documento Origem</th><th>Valor</th><th>Data</th></tr></thead><tbody>`;
        [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
            html += `<tr><td>${escapeHTML(item.numero)}</td><td>${escapeHTML(item.entidadeNome || '-')}</td><td>${escapeHTML(item.origemNumero)}</td><td>${formatMoeda(item.valor)}</td><td>${formatDataPt(item.data)}</td></tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML = html;
    };
    CADASTRO_HANDLERS[aba] = function () {
        devolucaoContextoTemp = null;
        const opcoes = listaDocumentosCombinados(cfg.origemColecoes).map(d => ({ value: `${d._colecao}::${d.id}`, label: `${d.numero} - ${d[cfg.campoEntidadeNome] || 'Sem ' + cfg.entidadeLabel} (${formatMoeda(d.total)})` }));
        document.getElementById('documento-body').innerHTML = `
            <div class="form-group"><label>Documento de Origem</label><select id="devolucao-doc-origem" class="form-control" onchange="selecionarDocumentoDevolucao(this.value,'${aba}')" required>${opcoesSelect(opcoes, '', 'Selecione o documento de origem...')}</select></div>
            <div id="devolucao-itens-area"></div>
        `;
        document.getElementById('documento-footer').innerHTML = `
            <button class="btn-cancelar" type="button" onclick="fecharModalDocumento()">Cancelar</button>
            <button class="btn-salvar" type="button" onclick="salvarNotaDevolucao('${aba}')">Guardar ${cfg.singular}</button>
        `;
        abrirModalDocumento(`Nova(o) ${cfg.singular}`);
    };
}

window.salvarNotaDevolucao = async function (aba) {
    const cfg = DEVOLUCAO_REGISTRY[aba];
    if (!devolucaoContextoTemp) { mostrarAlertaCustomizado('Selecione o documento de origem.', 'Atenção'); return; }
    const itensDevolvidos = [];
    devolucaoContextoTemp.itensOrigem.forEach((it, idx) => {
        const campoQtd = document.getElementById(`devolver-qtd-${idx}`);
        const qtd = campoQtd ? (parseInt(campoQtd.value) || 0) : 0;
        if (qtd > 0) itensDevolvidos.push({ ...it, quantidade: qtd, subtotal: qtd * it.precoUnit });
    });
    if (itensDevolvidos.length === 0) { mostrarAlertaCustomizado('Indique a quantidade a devolver de pelo menos um artigo.', 'Atenção'); return; }
    const valor = itensDevolvidos.reduce((s, i) => s + i.subtotal, 0);
    try {
        const numero = await proximoNumeroDocumento(cfg.collection, cfg.prefixo);
        await addDoc(collection(db, cfg.collection), {
            numero, entidadeId: devolucaoContextoTemp.entidadeId, entidadeNome: devolucaoContextoTemp.entidadeNome,
            origemColecao: devolucaoContextoTemp.colecaoOrigem, origemId: devolucaoContextoTemp.docId, origemNumero: devolucaoContextoTemp.origemNumero,
            itens: itensDevolvidos, valor, data: hojeISO(), criadoEm: new Date().toISOString()
        });
        await aplicarMovimentoStock(itensDevolvidos, cfg.movimentoStock);
        if (cfg.creditoCollection && devolucaoContextoTemp.entidadeId) {
            await updateDoc(doc(db, cfg.creditoCollection, devolucaoContextoTemp.entidadeId), { [cfg.creditoCampo]: increment(valor) });
        }
        mostrarAlertaCustomizado(`${cfg.singular} registada com sucesso. ${cfg.mensagemCredito}`, 'Sucesso');
        fecharModalDocumento();
    } catch (e) { mostrarAlertaCustomizado('Erro ao registar devolução.', 'Erro'); }
}

registrarNotaDevolucao('Notas de Crédito', {
    collection: 'NotasCreditoVenda', singular: 'Nota de Crédito', prefixo: 'NC',
    origemColecoes: ['Faturas', 'FaturasSimplificadas', 'FaturasRecibo'], campoEntidadeId: 'clienteId', campoEntidadeNome: 'clienteNome', entidadeLabel: 'Cliente',
    movimentoStock: 'entrada', creditoCollection: 'Clientes', creditoCampo: 'saldoCredito', mensagemCredito: 'Stock reposto e crédito disponibilizado ao cliente.'
});
registrarNotaDevolucao('Devoluções Pagamento', {
    collection: 'DevolucoesPagamento', singular: 'Devolução de Pagamento', prefixo: 'DP',
    origemColecoes: ['Faturas', 'FaturasSimplificadas', 'FaturasRecibo'], campoEntidadeId: 'clienteId', campoEntidadeNome: 'clienteNome', entidadeLabel: 'Cliente',
    movimentoStock: 'entrada', creditoCollection: null, creditoCampo: null, mensagemCredito: 'Stock reposto; valor a reembolsar diretamente ao cliente.'
});

/* ===================================================================
   MÓDULO: DOCUMENTOS > FORNECEDORES (COMPRAS)
   =================================================================== */
registrarDocumentoComItens('Notas de Encomenda', {
    collection: 'NotasEncomendaFornecedor', singular: 'Nota de Encomenda', prefixo: 'NE',
    exigeCliente: true, entidadeCollection: 'Fornecedores', entidadeLabel: 'Fornecedor',
    campoEntidadeId: 'fornecedorId', campoEntidadeNome: 'fornecedorNome',
    movimentoStock: 'nenhum', statusInicial: 'Enviada', podeRecibo: false
});

registrarDocumentoComItens('Faturas Fornecedor', {
    collection: 'FaturasFornecedor', singular: 'Fatura de Fornecedor', prefixo: 'FTF',
    exigeCliente: true, entidadeCollection: 'Fornecedores', entidadeLabel: 'Fornecedor',
    campoEntidadeId: 'fornecedorId', campoEntidadeNome: 'fornecedorNome',
    movimentoStock: 'entrada', statusInicial: 'Pendente', podeRecibo: true, reciboFn: 'emitirReciboFornecedor'
});

registrarDocumentoComItens('Faturas Simplificadas', {
    collection: 'FaturasSimplificadasFornecedor', singular: 'Fatura Simplificada de Fornecedor', prefixo: 'FSF',
    exigeCliente: true, entidadeCollection: 'Fornecedores', entidadeLabel: 'Fornecedor',
    campoEntidadeId: 'fornecedorId', campoEntidadeNome: 'fornecedorNome',
    movimentoStock: 'entrada', statusInicial: 'Pago', podeRecibo: false
});

registrarNotaDevolucao('Notas de Crédito Fornecedor', {
    collection: 'NotasCreditoFornecedor', singular: 'Nota de Crédito (Fornecedor)', prefixo: 'NCF',
    origemColecoes: ['FaturasFornecedor', 'FaturasSimplificadasFornecedor'], campoEntidadeId: 'fornecedorId', campoEntidadeNome: 'fornecedorNome', entidadeLabel: 'Fornecedor',
    movimentoStock: 'saida', creditoCollection: 'Fornecedores', creditoCampo: 'saldoCreditoFornecedor',
    mensagemCredito: 'Stock retirado (devolvido ao fornecedor) e valor ficou disponível como crédito com este fornecedor.'
});
registrarNotaDevolucao('Notas de Devolução', {
    collection: 'NotasDevolucaoFornecedor', singular: 'Nota de Devolução', prefixo: 'ND',
    origemColecoes: ['FaturasFornecedor', 'FaturasSimplificadasFornecedor'], campoEntidadeId: 'fornecedorId', campoEntidadeNome: 'fornecedorNome', entidadeLabel: 'Fornecedor',
    movimentoStock: 'saida', creditoCollection: null, creditoCampo: null,
    mensagemCredito: 'Stock retirado (devolvido ao fornecedor); o fornecedor devolve o dinheiro diretamente.'
});

RENDERERS['Recibos Fornecedor'] = function (display) {
    const lista = dadosCadastrados['RecibosFornecedor'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum recibo de fornecedor emitido ainda. É emitido a partir de uma Fatura Fornecedor pendente (botão de check na listagem).</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Número</th><th>Fornecedor</th><th>Fatura de Origem</th><th>Total</th><th>Data</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr><td>${escapeHTML(item.numero)}</td><td>${escapeHTML(item.fornecedorNome || '-')}</td><td>${escapeHTML(item.faturaNumero)}</td><td>${formatMoeda(item.total)}</td><td>${formatDataPt(item.data)}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

/* ---------- Pedidos de Garantia (registo simples, sem movimento de stock automático) ---------- */
RENDERERS['Pedidos de Garantia'] = function (display) {
    const lista = dadosCadastrados['PedidosGarantia'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum pedido de garantia registado. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Fornecedor</th><th>Artigo</th><th>Descrição do Problema</th><th>Data Envio</th><th>Status</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr><td>${escapeHTML(item.fornecedorNome)}</td><td>${escapeHTML(item.artigoDescricao)}</td><td>${escapeHTML(item.descricaoProblema)}</td><td>${formatDataPt(item.dataEnvio)}</td><td>${badgeStatus(item.status)}</td>
            <td><div class="action-buttons">${botaoEditar('PedidosGarantia', item.id)}${botaoExcluir('PedidosGarantia', item.id)}</div></td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['Pedidos de Garantia'] = function (item) {
    const opcoesFornecedor = opcoesSelect(dadosCadastrados['Fornecedores'].map(f => ({ value: f.id, label: f.nome })), item ? item.fornecedorId : '', 'Selecione o fornecedor...');
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-fornecedor-garantia">Fornecedor</label><select id="f-fornecedor-garantia" class="form-control" required>${opcoesFornecedor}</select></div>
        <div class="form-group"><label for="f-artigo-garantia">Artigo / Material</label><input type="text" id="f-artigo-garantia" class="form-control" placeholder="Ex: Disjuntor 32A" value="${item ? escapeHTML(item.artigoDescricao) : ''}" required></div>
        <div class="form-group"><label for="f-problema-garantia">Descrição do Problema</label><textarea id="f-problema-garantia" class="form-control" placeholder="O que foi impresso e devolvido, motivo da garantia...">${item ? escapeHTML(item.descricaoProblema) : ''}</textarea></div>
        <div class="form-row">
            <div class="form-group"><label for="f-data-envio-garantia">Data de Envio</label><input type="date" id="f-data-envio-garantia" class="form-control" value="${item ? item.dataEnvio : hojeISO()}"></div>
            <div class="form-group"><label for="f-status-garantia">Status</label><select id="f-status-garantia" class="form-control">
                <option value="Enviado" ${item && item.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
                <option value="Resolvido" ${item && item.status === 'Resolvido' ? 'selected' : ''}>Resolvido</option>
            </select></div>
        </div>
    `;
    document.getElementById('modal-titulo').innerText = item ? 'Editar Pedido de Garantia' : 'Novo Pedido de Garantia';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar' : 'Guardar';
    idSendoEditado = item ? item.id : null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const fornecedorId = document.getElementById('f-fornecedor-garantia').value;
        const dados = {
            fornecedorId, fornecedorNome: dadosCadastrados['Fornecedores'].find(f => f.id === fornecedorId)?.nome || '',
            artigoDescricao: document.getElementById('f-artigo-garantia').value,
            descricaoProblema: document.getElementById('f-problema-garantia').value,
            dataEnvio: document.getElementById('f-data-envio-garantia').value,
            status: document.getElementById('f-status-garantia').value,
            atualizadoEm: new Date().toISOString()
        };
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'PedidosGarantia', idSendoEditado), dados); mostrarAlertaCustomizado('Pedido de Garantia atualizado!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'PedidosGarantia'), dados); mostrarAlertaCustomizado('Pedido de Garantia registado!', 'Sucesso'); }
            fecharModal();
        } catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};

/* ===================================================================
   MÓDULO: DOCUMENTOS > STOCKS (Nota de Quebra, Entrada/Saída de Inventário)
   =================================================================== */

/* ---------- Nota de Quebra ---------- */
RENDERERS['Nota de Quebra'] = function (display) {
    const lista = dadosCadastrados['NotasQuebra'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhuma nota de quebra registada. Clique em <strong>+ Cadastrar</strong> para retirar do stock um artigo queimado, quebrado ou desperdiçado.</div>`;
        return;
    }
    let html = `<table class="elegant-table"><thead><tr><th>Artigo</th><th>Armazém</th><th>Qtd</th><th>Motivo</th><th>Data</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
        html += `<tr><td>${escapeHTML(item.codigo)} - ${escapeHTML(item.categoria)}</td><td>${item.armazem}</td><td>${item.quantidade}</td><td>${escapeHTML(item.motivo)}</td><td>${formatDataPt(item.data)}</td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['Nota de Quebra'] = function () {
    let opcoesArtigos = `<option value="">Selecione um artigo...</option>`;
    dadosCadastrados['Artigos'].forEach(a => { opcoesArtigos += `<option value="${a.id}">${escapeHTML(a.codigo)} - ${escapeHTML(a.categoria)}</option>`; });
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-artigo-quebra">Artigo</label><select id="f-artigo-quebra" class="form-control" required>${opcoesArtigos}</select></div>
        <div class="form-row">
            <div class="form-group"><label for="f-armazem-quebra">Armazém</label><select id="f-armazem-quebra" class="form-control"><option value="A">A</option><option value="B">B</option></select></div>
            <div class="form-group"><label for="f-qtd-quebra">Quantidade</label><input type="number" id="f-qtd-quebra" class="form-control" min="1" step="1" value="1" required></div>
        </div>
        <div class="form-group"><label for="f-motivo-quebra">Motivo</label><select id="f-motivo-quebra" class="form-control">
            <option value="Queimou">Queimou</option><option value="Quebrou">Quebrou</option><option value="Desperdício">Desperdício</option>
        </select></div>
    `;
    document.getElementById('modal-titulo').innerText = 'Nova Nota de Quebra';
    document.getElementById('btn-guardar-texto').innerText = 'Guardar';
    idSendoEditado = null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const artigoId = document.getElementById('f-artigo-quebra').value;
        const armazem = document.getElementById('f-armazem-quebra').value;
        const quantidade = parseInt(document.getElementById('f-qtd-quebra').value) || 0;
        const artigo = dadosCadastrados['Artigos'].find(a => a.id === artigoId);
        const disponivel = armazem === 'A' ? (artigo?.stockA || 0) : (artigo?.stockB || 0);
        if (!artigoId || quantidade <= 0) { mostrarAlertaCustomizado('Selecione o artigo e uma quantidade válida.', 'Atenção'); btnSalvar.disabled = false; return; }
        if (quantidade > disponivel) { mostrarAlertaCustomizado(`Stock insuficiente no Armazém ${armazem}. Disponível: ${disponivel}.`, 'Atenção'); btnSalvar.disabled = false; return; }
        try {
            await addDoc(collection(db, 'NotasQuebra'), {
                artigoId, codigo: artigo.codigo, categoria: artigo.categoria, armazem, quantidade,
                motivo: document.getElementById('f-motivo-quebra').value, data: hojeISO(), criadoEm: new Date().toISOString()
            });
            await updateDoc(doc(db, 'Artigos', artigoId), { [armazem === 'A' ? 'stockA' : 'stockB']: increment(-quantidade) });
            mostrarAlertaCustomizado('Nota de quebra registada e stock atualizado!', 'Sucesso');
            fecharModal();
        } catch (e) { mostrarAlertaCustomizado('Erro ao registar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};

/* ---------- Entrada de Inventário (importar Excel/CSV para o sistema) ---------- */
RENDERERS['Entrada de Inventário'] = function (display) {
    const lista = dadosCadastrados['MovimentosInventario'].filter(m => m.tipo === 'entrada');
    display.innerHTML = `
        <div class="view-card" style="text-align:left; margin-bottom: 20px;">
            <h3 style="margin-bottom:10px; color: var(--text-dark);">Importar stock antigo (Excel/CSV)</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 14px;">O ficheiro deve ser .csv com as colunas: <strong>codigo,armazem,quantidade</strong> (armazem = A ou B). Ideal para lançar de uma vez o stock que já existia antes do sistema.</p>
            <input type="file" id="input-csv-entrada" accept=".csv" class="form-control" style="max-width:400px;">
            <button class="btn-salvar" style="margin-top:12px;" onclick="processarEntradaInventario()">Importar Ficheiro</button>
            <div id="resultado-entrada-inventario" style="margin-top:14px; font-size:0.9rem;"></div>
        </div>
    `;
    if (lista.length > 0) {
        let html = `<table class="elegant-table"><thead><tr><th>Data</th><th>Artigos Atualizados</th><th>Origem</th></tr></thead><tbody>`;
        [...lista].sort((a, b) => (b.criadoEm || '').localeCompare(a.criadoEm || '')).forEach(item => {
            html += `<tr><td>${formatDataPt(item.data)}</td><td>${item.totalLinhas}</td><td>${escapeHTML(item.origem || 'Importação CSV')}</td></tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML += html;
    }
};

window.processarEntradaInventario = function () {
    const input = document.getElementById('input-csv-entrada');
    const resultado = document.getElementById('resultado-entrada-inventario');
    if (!input.files || input.files.length === 0) { mostrarAlertaCustomizado('Selecione um ficheiro .csv primeiro.', 'Atenção'); return; }
    const reader = new FileReader();
    reader.onload = async function (e) {
        const linhas = e.target.result.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        let atualizados = 0, naoEncontrados = [];
        for (const linha of linhas) {
            const [codigo, armazem, quantidadeStr] = linha.split(',').map(v => (v || '').trim());
            if (!codigo || codigo.toLowerCase() === 'codigo') continue; // ignora cabeçalho
            const artigo = dadosCadastrados['Artigos'].find(a => a.codigo === codigo);
            const qtd = parseInt(quantidadeStr) || 0;
            const arm = (armazem || 'A').toUpperCase() === 'B' ? 'B' : 'A';
            if (!artigo || qtd <= 0) { naoEncontrados.push(codigo); continue; }
            await updateDoc(doc(db, 'Artigos', artigo.id), { [arm === 'A' ? 'stockA' : 'stockB']: increment(qtd) });
            atualizados++;
        }
        await addDoc(collection(db, 'MovimentosInventario'), { tipo: 'entrada', totalLinhas: atualizados, origem: input.files[0].name, data: hojeISO(), criadoEm: new Date().toISOString() });
        resultado.innerHTML = `<span style="color: var(--success);">${atualizados} artigo(s) atualizado(s) com sucesso.</span>${naoEncontrados.length ? `<br><span style="color: var(--danger);">Códigos não encontrados: ${naoEncontrados.join(', ')}</span>` : ''}`;
    };
    reader.readAsText(input.files[0]);
}

/* ---------- Saída de Inventário (imprimir / exportar para Excel) ---------- */
RENDERERS['Saída de Inventário'] = function (display) {
    display.innerHTML = `
        <div class="view-card" style="text-align:left; margin-bottom: 20px;">
            <h3 style="margin-bottom:10px; color: var(--text-dark);">Exportar / Imprimir Inventário Atual</h3>
            <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 14px;">Gera um ficheiro .csv (compatível com Excel) ou uma versão para impressão com o stock atual de todos os artigos.</p>
            <button class="btn-salvar" onclick="exportarInventarioCSV()">Exportar para Excel (.csv)</button>
            <button class="btn-secundario" style="margin-left:10px;" onclick="imprimirInventario()">Imprimir</button>
        </div>
        <div id="tabela-inventario-saida"></div>
    `;
    const artigos = dadosCadastrados['Artigos'];
    if (artigos.length > 0) {
        let html = `<table class="elegant-table" id="tabela-print-inventario"><thead><tr><th>Código</th><th>Categoria</th><th>Stock A</th><th>Stock B</th><th>Total</th></tr></thead><tbody>`;
        artigos.forEach(a => { html += `<tr><td>${escapeHTML(a.codigo)}</td><td>${escapeHTML(a.categoria)}</td><td>${a.stockA || 0}</td><td>${a.stockB || 0}</td><td>${(a.stockA || 0) + (a.stockB || 0)}</td></tr>`; });
        html += `</tbody></table>`;
        document.getElementById('tabela-inventario-saida').innerHTML = html;
    }
};

window.exportarInventarioCSV = function () {
    const artigos = dadosCadastrados['Artigos'];
    let csv = 'codigo,categoria,stockA,stockB,total\n';
    artigos.forEach(a => { csv += `${a.codigo},${a.categoria},${a.stockA || 0},${a.stockB || 0},${(a.stockA || 0) + (a.stockB || 0)}\n`; });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventario_${hojeISO()}.csv`;
    link.click();
}

window.imprimirInventario = function () {
    const tabela = document.getElementById('tabela-print-inventario');
    if (!tabela) { mostrarAlertaCustomizado('Não há dados de inventário para imprimir.', 'Atenção'); return; }
    const janela = window.open('', '_blank');
    janela.document.write(`<html><head><title>Inventário TECNOWATT</title></head><body>${tabela.outerHTML}</body></html>`);
    janela.document.close();
    janela.print();
}

/* ===================================================================
   MÓDULO: DASHBOARD (Resumo + Eventos Programados)
   =================================================================== */
RENDERERS['Resumo'] = function (display) {
    const faturasPendentes = (dadosCadastrados['Faturas'] || []).filter(f => f.status === 'Pendente');
    const totalPendente = faturasPendentes.reduce((s, f) => s + (f.total || 0), 0);
    const obrasAbertas = (dadosCadastrados['FolhaObra'] || []).filter(o => o.status !== 'Concluído');
    const hoje = hojeISO();
    const avencasAtrasadas = (dadosCadastrados['Avencas'] || []).filter(a => a.ativa !== false).reduce((count, a) => count + (a.entradas || []).filter(e => !e.feito && e.data <= hoje).length, 0);
    const artigosStockBaixo = (dadosCadastrados['Artigos'] || []).filter(a => ((a.stockA || 0) + (a.stockB || 0)) <= 2).length;

    display.innerHTML = `
        <div class="dashboard-grid">
            <div class="dashboard-card"><div class="dc-label">Clientes</div><div class="dc-value">${(dadosCadastrados['Clientes'] || []).length}</div></div>
            <div class="dashboard-card"><div class="dc-label">Faturas Pendentes</div><div class="dc-value">${faturasPendentes.length}</div></div>
            <div class="dashboard-card"><div class="dc-label">Valor Pendente</div><div class="dc-value">${formatMoeda(totalPendente)}</div></div>
            <div class="dashboard-card"><div class="dc-label">Obras em Aberto</div><div class="dc-value">${obrasAbertas.length}</div></div>
            <div class="dashboard-card"><div class="dc-label">Tarefas de Avença Atrasadas/Hoje</div><div class="dc-value">${avencasAtrasadas}</div></div>
            <div class="dashboard-card"><div class="dc-label">Artigos com Stock Baixo (≤2)</div><div class="dc-value">${artigosStockBaixo}</div></div>
        </div>
        <div class="view-card" style="text-align:left;">
            <h3 style="margin-bottom:10px; color: var(--text-dark);">Bem-vindo ao TECNOWATT</h3>
            <p style="color: var(--text-muted);">Use o menu à esquerda para navegar entre Tabelas, Documentos, Consultas e Configurações. Esta visão geral é atualizada automaticamente com os dados do sistema.</p>
        </div>
    `;
};

RENDERERS['Eventos Programados'] = function (display) {
    const lista = dadosCadastrados['EventosProgramados'];
    if (!lista || lista.length === 0) {
        display.style.textAlign = 'center'; display.style.padding = '40px';
        display.innerHTML = `<div style="color: var(--text-muted);">Nenhum evento programado. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
        return;
    }
    const hoje = hojeISO();
    let html = `<table class="elegant-table"><thead><tr><th>Data</th><th>Título</th><th>Descrição</th><th>Status</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
    [...lista].sort((a, b) => a.data.localeCompare(b.data)).forEach(item => {
        const status = item.data < hoje ? 'Atrasado' : (item.data === hoje ? 'Hoje' : 'Agendado');
        html += `<tr><td>${formatDataPt(item.data)}</td><td>${escapeHTML(item.titulo)}</td><td>${escapeHTML(item.descricao || '-')}</td><td>${badgeStatus(status)}</td>
            <td><div class="action-buttons">${botaoEditar('EventosProgramados', item.id)}${botaoExcluir('EventosProgramados', item.id)}</div></td></tr>`;
    });
    html += `</tbody></table>`;
    display.innerHTML = html;
};

CADASTRO_HANDLERS['EventosProgramados'] = function (item) {
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-titulo-evento">Título</label><input type="text" id="f-titulo-evento" class="form-control" placeholder="Ex: Visita técnica" value="${item ? escapeHTML(item.titulo) : ''}" required></div>
        <div class="form-group"><label for="f-data-evento">Data</label><input type="date" id="f-data-evento" class="form-control" value="${item ? item.data : hojeISO()}" required></div>
        <div class="form-group"><label for="f-descricao-evento">Descrição</label><textarea id="f-descricao-evento" class="form-control" placeholder="Detalhes do evento">${item ? escapeHTML(item.descricao) : ''}</textarea></div>
    `;
    document.getElementById('modal-titulo').innerText = item ? 'Editar Evento' : 'Novo Evento Programado';
    document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar' : 'Guardar';
    idSendoEditado = item ? item.id : null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const dados = {
            titulo: document.getElementById('f-titulo-evento').value,
            data: document.getElementById('f-data-evento').value,
            descricao: document.getElementById('f-descricao-evento').value,
            atualizadoEm: new Date().toISOString()
        };
        try {
            if (idSendoEditado) { await updateDoc(doc(db, 'EventosProgramados', idSendoEditado), dados); mostrarAlertaCustomizado('Evento atualizado!', 'Sucesso'); }
            else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, 'EventosProgramados'), dados); mostrarAlertaCustomizado('Evento criado!', 'Sucesso'); }
            fecharModal();
        } catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};
// A aba do menu chama-se "Eventos Programados", igual ao nome da coleção — não precisa de alias.
RENDERERS['Eventos Programados'] && (CADASTRO_HANDLERS['Eventos Programados'] = CADASTRO_HANDLERS['EventosProgramados']);

/* ===================================================================
   MOTOR GENÉRICO PARA DADOS MESTRE SIMPLES (usado em várias telas de Configurações)
   =================================================================== */
function registrarEntidadeSimples(aba, cfg) {
    RENDERERS[aba] = function (display) {
        const lista = dadosCadastrados[cfg.collection];
        if (!lista || lista.length === 0) {
            display.style.textAlign = 'center'; display.style.padding = '40px';
            display.innerHTML = `<div style="color: var(--text-muted);">Nenhum registo encontrado. Clique em <strong>+ Cadastrar</strong> para adicionar.</div>`;
            return;
        }
        let html = `<table class="elegant-table"><thead><tr>${cfg.colunas.map(c => `<th>${c.label}</th>`).join('')}<th style="width:100px;">Ações</th></tr></thead><tbody>`;
        lista.forEach(item => {
            html += `<tr>${cfg.colunas.map(c => `<td>${c.render ? c.render(item) : escapeHTML(item[c.key] ?? '')}</td>`).join('')}<td><div class="action-buttons">${botaoEditar(cfg.collection, item.id)}${botaoExcluir(cfg.collection, item.id)}</div></td></tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML = html;
    };
    CADASTRO_HANDLERS[cfg.collection] = function (item) {
        let html = '';
        cfg.campos.forEach(campo => {
            if (campo.type === 'select') {
                let opts = `<option value="">Selecione...</option>`;
                campo.options.forEach(o => { opts += `<option value="${o.value}" ${item && item[campo.id] === o.value ? 'selected' : ''}>${o.label}</option>`; });
                html += `<div class="form-group"><label for="fs-${campo.id}">${campo.label}</label><select id="fs-${campo.id}" class="form-control" ${campo.required ? 'required' : ''}>${opts}</select></div>`;
            } else {
                html += `<div class="form-group"><label for="fs-${campo.id}">${campo.label}</label><input type="${campo.type}" id="fs-${campo.id}" class="form-control" placeholder="${campo.placeholder || ''}" value="${item ? escapeHTML(item[campo.id] ?? '') : ''}" ${campo.required ? 'required' : ''}></div>`;
            }
        });
        document.getElementById('dynamic-fields').innerHTML = html;
        document.getElementById('modal-titulo').innerText = item ? `Editar ${cfg.singular}` : `Novo(a) ${cfg.singular}`;
        document.getElementById('btn-guardar-texto').innerText = item ? 'Atualizar' : 'Guardar';
        idSendoEditado = item ? item.id : null;
        window.onSalvarDadosDb = async function () {
            const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
            const dados = {};
            cfg.campos.forEach(campo => { dados[campo.id] = document.getElementById(`fs-${campo.id}`).value; });
            dados.atualizadoEm = new Date().toISOString();
            try {
                if (idSendoEditado) { await updateDoc(doc(db, cfg.collection, idSendoEditado), dados); mostrarAlertaCustomizado(`${cfg.singular} atualizado(a)!`, 'Sucesso'); }
                else { dados.criadoEm = new Date().toISOString(); await addDoc(collection(db, cfg.collection), dados); mostrarAlertaCustomizado(`${cfg.singular} cadastrado(a)!`, 'Sucesso'); }
                fecharModal();
            } catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
        };
        abrirModal('500px');
    };
    if (aba !== cfg.collection) { CADASTRO_HANDLERS[aba] = CADASTRO_HANDLERS[cfg.collection]; }
}

/* ===================================================================
   MOTOR GENÉRICO PARA BIBLIOTECA DE FICHEIROS (Séries de Documentos / Templates)
   =================================================================== */
function registrarBibliotecaFicheiros(aba, cfg) {
    RENDERERS[aba] = function (display) {
        const lista = dadosCadastrados[cfg.collection];
        if (!lista || lista.length === 0) {
            display.style.textAlign = 'center'; display.style.padding = '40px';
            display.innerHTML = `<div style="color: var(--text-muted);">Nenhum ficheiro guardado ainda. Clique em <strong>+ Cadastrar</strong> para anexar.</div>`;
            return;
        }
        let html = `<table class="elegant-table"><thead><tr><th>Nome</th><th>Ficheiro</th><th style="width:100px;">Ações</th></tr></thead><tbody>`;
        lista.forEach(item => {
            html += `<tr><td>${escapeHTML(item.nome)}</td><td>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener" class="btn-secundario" style="text-decoration:none; padding:6px 12px; display:inline-block;">Abrir / Imprimir</a>` : '<span style="color:var(--text-muted);">Sem ficheiro anexado</span>'}</td><td><div class="action-buttons">${botaoExcluir(cfg.collection, item.id)}</div></td></tr>`;
        });
        html += `</tbody></table>`;
        display.innerHTML = html;
    };
    CADASTRO_HANDLERS[aba] = function () {
        document.getElementById('dynamic-fields').innerHTML = `
            <div class="form-group"><label for="f-bib-nome">Nome</label><input type="text" id="f-bib-nome" class="form-control" placeholder="Ex: Modelo de Orçamento" required></div>
            <div class="form-group"><label for="f-bib-ficheiro">Ficheiro (PDF, Word, Imagem...)</label><input type="file" id="f-bib-ficheiro" class="form-control"></div>
            <div class="form-hint">O ficheiro fica guardado e disponível para abrir/imprimir sempre que precisar.</div>
        `;
        document.getElementById('modal-titulo').innerText = `Novo(a) ${cfg.singular}`;
        document.getElementById('btn-guardar-texto').innerText = 'Guardar';
        idSendoEditado = null;
        window.onSalvarDadosDb = async function () {
            const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A enviar...";
            const nome = document.getElementById('f-bib-nome').value;
            const fileInput = document.getElementById('f-bib-ficheiro');
            try {
                let url = null, nomeFicheiro = null;
                if (fileInput.files && fileInput.files[0]) {
                    const file = fileInput.files[0];
                    const caminho = `${cfg.pastaStorage}/${Date.now()}_${file.name}`;
                    const refFicheiro = storageRef(storage, caminho);
                    await uploadBytes(refFicheiro, file);
                    url = await getDownloadURL(refFicheiro);
                    nomeFicheiro = file.name;
                }
                await addDoc(collection(db, cfg.collection), { nome, url, nomeFicheiro, criadoEm: new Date().toISOString() });
                mostrarAlertaCustomizado(`${cfg.singular} guardado(a) com sucesso!`, 'Sucesso');
                fecharModal();
            } catch (e) { mostrarAlertaCustomizado('Erro ao enviar ficheiro. Verifique se o Firebase Storage está ativado no projeto.', 'Erro'); } finally { btnSalvar.disabled = false; }
        };
        abrirModal('500px');
    };
}

/* ===================================================================
   MÓDULO: CONFIGURAÇÕES
   =================================================================== */

/* ---------- Empresa (registo único) ---------- */
RENDERERS['Empresa'] = function (display) {
    const emp = dadosEmpresa || {};
    display.innerHTML = `
        <div class="view-card" style="text-align:left;">
            <h3 style="margin-bottom:14px; color:var(--text-dark);">Dados da Empresa</h3>
            <p style="margin-bottom:6px;"><strong>Nome:</strong> ${escapeHTML(emp.nome || 'Não definido')}</p>
            <p style="margin-bottom:6px;"><strong>NIF:</strong> ${escapeHTML(emp.nif || '-')}</p>
            <p style="margin-bottom:6px;"><strong>Morada:</strong> ${escapeHTML(emp.morada || '-')}</p>
            <p style="margin-bottom:6px;"><strong>Código Postal:</strong> ${escapeHTML(emp.codigoPostal || '-')}</p>
            <p style="margin-bottom:6px;"><strong>Telefone:</strong> ${escapeHTML(emp.telefone || '-')}</p>
            <p><strong>Email:</strong> ${escapeHTML(emp.email || '-')}</p>
        </div>
    `;
};
CADASTRO_HANDLERS['Empresa'] = function () {
    const emp = dadosEmpresa || {};
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-emp-nome">Nome da Empresa</label><input type="text" id="f-emp-nome" class="form-control" value="${escapeHTML(emp.nome || '')}" required></div>
        <div class="form-group"><label for="f-emp-nif">NIF</label><input type="text" id="f-emp-nif" class="form-control" value="${escapeHTML(emp.nif || '')}" required></div>
        <div class="form-group"><label for="f-emp-morada">Morada</label><input type="text" id="f-emp-morada" class="form-control" value="${escapeHTML(emp.morada || '')}"></div>
        <div class="form-row">
            <div class="form-group"><label for="f-emp-cp">Código Postal</label><input type="text" id="f-emp-cp" class="form-control" value="${escapeHTML(emp.codigoPostal || '')}"></div>
            <div class="form-group"><label for="f-emp-tel">Telefone</label><input type="tel" id="f-emp-tel" class="form-control" value="${escapeHTML(emp.telefone || '')}"></div>
        </div>
        <div class="form-group"><label for="f-emp-email">Email</label><input type="email" id="f-emp-email" class="form-control" value="${escapeHTML(emp.email || '')}"></div>
    `;
    document.getElementById('modal-titulo').innerText = 'Dados da Empresa';
    document.getElementById('btn-guardar-texto').innerText = 'Guardar';
    idSendoEditado = null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const dados = {
            nome: document.getElementById('f-emp-nome').value, nif: document.getElementById('f-emp-nif').value,
            morada: document.getElementById('f-emp-morada').value, codigoPostal: document.getElementById('f-emp-cp').value,
            telefone: document.getElementById('f-emp-tel').value, email: document.getElementById('f-emp-email').value,
            atualizadoEm: new Date().toISOString()
        };
        try { await setDoc(doc(db, 'Configuracoes', 'Empresa'), dados, { merge: true }); mostrarAlertaCustomizado('Dados da empresa atualizados!', 'Sucesso'); fecharModal(); }
        catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('500px');
};

/* ---------- Subscrição (registo único) ---------- */
RENDERERS['Subscrição'] = function (display) {
    const sub = dadosSubscricao || {};
    let alerta = '';
    if (sub.diaVencimento) {
        const diasRestantes = sub.diaVencimento - new Date().getDate();
        if (diasRestantes < 0) alerta = ' <span class="badge badge-danger">Vencido este mês</span>';
        else if (diasRestantes <= 3) alerta = ' <span class="badge badge-warning">Vencimento próximo</span>';
    }
    display.innerHTML = `
        <div class="view-card" style="text-align:left;">
            <h3 style="margin-bottom:14px; color:var(--text-dark);">Subscrição do Sistema</h3>
            <p style="margin-bottom:6px;"><strong>Valor Mensal:</strong> ${formatMoeda(sub.valorMensal)}</p>
            <p style="margin-bottom:6px;"><strong>Dia de Vencimento:</strong> ${sub.diaVencimento || '-'}${alerta}</p>
            <p><strong>Status:</strong> ${badgeStatus(sub.ativo === false ? 'Cancelado' : 'Ativa')}</p>
        </div>
    `;
};
CADASTRO_HANDLERS['Subscrição'] = function () {
    const sub = dadosSubscricao || {};
    document.getElementById('dynamic-fields').innerHTML = `
        <div class="form-group"><label for="f-sub-valor">Valor Mensal (€)</label><input type="number" id="f-sub-valor" class="form-control" step="0.01" value="${sub.valorMensal || ''}"></div>
        <div class="form-group"><label for="f-sub-dia">Dia de Vencimento (1-31)</label><input type="number" id="f-sub-dia" class="form-control" min="1" max="31" value="${sub.diaVencimento || ''}"></div>
        <div class="form-group"><label for="f-sub-status">Status</label><select id="f-sub-status" class="form-control"><option value="ativo" ${sub.ativo !== false ? 'selected' : ''}>Ativa</option><option value="cancelado" ${sub.ativo === false ? 'selected' : ''}>Cancelada</option></select></div>
    `;
    document.getElementById('modal-titulo').innerText = 'Subscrição do Sistema';
    document.getElementById('btn-guardar-texto').innerText = 'Guardar';
    idSendoEditado = null;
    window.onSalvarDadosDb = async function () {
        const btnSalvar = document.getElementById('btn-guardar-texto'); btnSalvar.disabled = true; btnSalvar.innerText = "A guardar...";
        const dados = {
            valorMensal: parseFloat(document.getElementById('f-sub-valor').value) || 0,
            diaVencimento: parseInt(document.getElementById('f-sub-dia').value) || null,
            ativo: document.getElementById('f-sub-status').value === 'ativo',
            atualizadoEm: new Date().toISOString()
        };
        try { await setDoc(doc(db, 'Configuracoes', 'Subscricao'), dados, { merge: true }); mostrarAlertaCustomizado('Subscrição atualizada!', 'Sucesso'); fecharModal(); }
        catch (e) { mostrarAlertaCustomizado('Erro ao salvar.', 'Erro'); } finally { btnSalvar.disabled = false; }
    };
    abrirModal('450px');
};

/* ---------- Grupos e Permissões / Utilizadores ---------- */
registrarEntidadeSimples('Grupos e Permissões de Utilizadores', {
    collection: 'GruposPermissoes', singular: 'Grupo/Cargo',
    campos: [
        { id: 'cargo', label: 'Cargo', type: 'text', placeholder: 'Ex: Administrador', required: true },
        { id: 'email', label: 'Email', type: 'email', placeholder: 'email@exemplo.pt', required: true },
        { id: 'permissoes', label: 'Permissões', type: 'text', placeholder: 'Ex: Tabelas, Documentos, Configurações', required: true }
    ],
    colunas: [{ key: 'cargo', label: 'Cargo' }, { key: 'email', label: 'Email' }, { key: 'permissoes', label: 'Permissões' }]
});

registrarEntidadeSimples('Utilizadores', {
    collection: 'Utilizadores', singular: 'Utilizador',
    campos: [
        { id: 'nome', label: 'Nome', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'cargo', label: 'Cargo', type: 'text', placeholder: 'Ex: Administrador', required: true }
    ],
    colunas: [{ key: 'nome', label: 'Nome' }, { key: 'email', label: 'Email' }, { key: 'cargo', label: 'Cargo' }]
});

/* ---------- Séries e Templates (bibliotecas de ficheiros) ---------- */
registrarBibliotecaFicheiros('Série de Documentos', { collection: 'SerieDocumentos', singular: 'Modelo/Minuta', pastaStorage: 'series-documentos' });
registrarBibliotecaFicheiros('Templates de Identificação', { collection: 'TemplatesIdentificacao', singular: 'Template de Identificação', pastaStorage: 'templates-identificacao' });

/* ---------- Outras Configurações ---------- */
registrarEntidadeSimples('Dados Bancários', {
    collection: 'DadosBancarios', singular: 'Conta Bancária',
    campos: [
        { id: 'banco', label: 'Banco', type: 'text', placeholder: 'Ex: Millennium BCP', required: true },
        { id: 'nivel', label: 'Nível', type: 'select', required: true, options: [{ value: 'Principal', label: 'Principal' }, { value: 'Secundário', label: 'Secundário' }] },
        { id: 'iban', label: 'IBAN', type: 'text', placeholder: 'PT50...', required: true }
    ],
    colunas: [{ key: 'banco', label: 'Banco' }, { key: 'nivel', label: 'Nível' }, { key: 'iban', label: 'IBAN' }]
});

registrarEntidadeSimples('Métodos de Pagamento', {
    collection: 'MetodosPagamento', singular: 'Método de Pagamento',
    campos: [
        { id: 'coluna', label: 'Coluna', type: 'text', placeholder: 'Ex: Categoria', required: true },
        { id: 'metodo', label: 'Método', type: 'text', placeholder: 'Ex: Transferência Bancária', required: true }
    ],
    colunas: [{ key: 'coluna', label: 'Coluna' }, { key: 'metodo', label: 'Método' }]
});

registrarEntidadeSimples('Viaturas', {
    collection: 'Viaturas', singular: 'Viatura',
    campos: [
        { id: 'viatura', label: 'Viatura (Matrícula/Nome)', type: 'text', required: true },
        { id: 'dataRevisao', label: 'Data de Revisão', type: 'date', required: true },
        { id: 'imposto', label: 'Imposto (€)', type: 'number', required: false },
        { id: 'dataImposto', label: 'Data do Imposto', type: 'date', required: true }
    ],
    colunas: [
        { key: 'viatura', label: 'Viatura' },
        { key: 'dataRevisao', label: 'Data de Revisão', render: item => alertaData(item.dataRevisao) },
        { key: 'imposto', label: 'Imposto (€)', render: item => formatMoeda(item.imposto) },
        { key: 'dataImposto', label: 'Data do Imposto', render: item => alertaData(item.dataImposto) }
    ]
});

/* ===================================================================
   EVENTOS GLOBAIS E MÁSCARAS
   =================================================================== */
document.addEventListener('input', function (e) {
    if (e.target.id === 'f-codigo-postal') {
        let value = e.target.value.replace(/\D/g, ''); let formattedValue = '';
        if (value.length > 0) formattedValue = value.substring(0, 4);
        if (value.length > 4) formattedValue += '-' + value.substring(4, 7);
        e.target.value = formattedValue;
    } else if (e.target.id === 'f-nif') {
        e.target.value = e.target.value.replace(/\D/g, '').substring(0, 9);
    }
});

document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('options-dropdown');
    if (dropdown && dropdown.classList.contains('active') && !event.target.closest('.header-left')) { dropdown.classList.remove('active'); }
    const clickFora = [
        { overlayId: 'modal-cadastro', closeFunc: fecharModal },
        { overlayId: 'modal-exclusao', closeFunc: fecharModalExclusao },
        { overlayId: 'modal-alerta', closeFunc: fecharAlerta },
        { overlayId: 'modal-documento', closeFunc: fecharModalDocumento }
    ];
    clickFora.forEach(m => { const overlay = document.getElementById(m.overlayId); if (overlay && event.target === overlay) { m.closeFunc(); } });
});

document.addEventListener('DOMContentLoaded', () => { renderDropdownStructure(); });
