(function () {
  'use strict';

  var F = window.Formulas;
  var dados = window.Dados.gerar();
  var empresas = dados.empresas;
  var TOTAL = empresas.length;

  var ORDEM_FAIXA = { 'Ótima': 4, 'Boa': 3, 'Regular': 2, 'Ruim': 1, 'Não recomendada': 0 };
  var CLASSE_FAIXA = {
    'Ótima': 'f-otima', 'Boa': 'f-boa', 'Regular': 'f-regular', 'Ruim': 'f-ruim',
    'Não recomendada': 'f-nao', 'Sem reputação definida': 'f-sem'
  };
  var CURTA = {
    'Ótima': 'Ótima', 'Boa': 'Boa', 'Regular': 'Regular', 'Ruim': 'Ruim',
    'Não recomendada': 'Não rec.', 'Sem reputação definida': 'Sem nota'
  };

  var params = Object.assign({}, F.PADRAO);
  var estado = {
    ordem: { chave: 'diff', dir: -1 },
    filtroSeg: '',
    soMuda: false,
    ataque: { empresaId: null, qtd: 30, tipo: 'negativo', responde: true }
  };

  /* ---------- utilidades ---------- */
  function $(id) { return document.getElementById(id); }
  function num(x) { return F.arred1(x).toFixed(1).replace('.', ','); }
  function sinal(x) { var r = F.arred1(x); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1).replace('.', ','); }
  function pontos(x) { var a = Math.abs(F.arred1(x)); return a.toFixed(1).replace('.', ',') + (a < 2 ? ' ponto' : ' pontos'); }
  function chip(faixa, curta) {
    return '<span class="chip ' + CLASSE_FAIXA[faixa] + '">' + (curta ? CURTA[faixa] : faixa) + '</span>';
  }
  function medias(p) {
    var m = {};
    dados.segmentos.forEach(function (s) {
      m[s.id] = F.mediaSegmento(empresas.filter(function (e) { return e.segId === s.id; }), p);
    });
    return m;
  }

  /* ---------- cálculo ---------- */
  var linhas = [], mediasAtuais = {};

  function calcular() {
    mediasAtuais = medias(params);
    linhas = empresas.map(function (e) {
      var a = F.atual(e.reclamacoes);
      var p = F.proposta(e, mediasAtuais[e.segId], params);
      return {
        e: e, a: a, p: p,
        muda: a.faixa !== p.faixa,
        diff: a.definida ? F.arred1(p.nota) - F.arred1(a.nota) : null
      };
    });
  }

  function simularAtaque(e, qtd, tipo) {
    var atacada = Object.assign({}, e, { reclamacoes: e.reclamacoes.concat(F.reclamacoesFalsas(qtd, tipo, estado.ataque.responde)) });
    var semPicos = Object.assign({}, params, { picos: false });
    var mSem = medias(semPicos);
    return {
      atual: { antes: F.atual(e.reclamacoes), depois: F.atual(atacada.reclamacoes) },
      proposta: {
        antes: F.proposta(e, mediasAtuais[e.segId], params),
        depois: F.proposta(atacada, mediasAtuais[e.segId], params)
      },
      semPicos: {
        antes: F.proposta(e, mSem[e.segId], semPicos),
        depois: F.proposta(atacada, mSem[e.segId], semPicos)
      }
    };
  }

  function empresaPadraoAtaque() {
    // A menor empresa com nota atual definida, que ainda não é Ótima e não é Não recomendada em nenhuma fórmula.
    var cand = linhas.filter(function (l) {
      return l.a.definida && l.a.faixa !== 'Ótima' && l.a.faixa !== 'Não recomendada' && l.p.faixa !== 'Não recomendada';
    })
      .sort(function (x, y) { return x.e.reclamacoes.length - y.e.reclamacoes.length || x.e.id - y.e.id; });
    return (cand[0] || linhas[0]).e.id;
  }

  /* ---------- resumo ---------- */
  function frase1() {
    var mudam = linhas.filter(function (l) { return l.muda; });
    var sobem = 0, caem = 0, ganham = 0;
    mudam.forEach(function (l) {
      if (!l.a.definida) ganham++;
      else if (ORDEM_FAIXA[l.p.faixa] > ORDEM_FAIXA[l.a.faixa]) sobem++;
      else caem++;
    });
    var partes = [];
    if (ganham) partes.push('<b>' + ganham + '</b> hoje sem reputação definida ' + (ganham === 1 ? 'passa' : 'passam') + ' a ter nota');
    if (sobem) partes.push('<b>' + sobem + '</b> ' + (sobem === 1 ? 'sobe' : 'sobem'));
    if (caem) partes.push('<b>' + caem + '</b> ' + (caem === 1 ? 'cai' : 'caem'));
    var txt = '<b>' + mudam.length + ' das ' + TOTAL + ' empresas</b> mudam de faixa com a proposta';
    if (partes.length) txt += ': ' + partes.slice(0, -1).join(', ') + (partes.length > 1 ? ' e ' : '') + partes[partes.length - 1];
    return txt + '.';
  }

  function textoAtaque(e, r, qtd, tipo) {
    var a = r.atual, p = r.proposta;
    var tipoTxt = tipo === 'positivo' ? 'reclamações falsas com nota máxima' : 'reclamações falsas de um concorrente, com nota mínima';
    var txt = 'Num ataque de ' + qtd + ' ' + tipoTxt + ', a empresa ' + e.nome + ' (' + e.reclamacoes.length + ' reclamações avaliadas no ano) ';
    if (a.antes.faixa !== a.depois.faixa) txt += 'vai de <b>' + a.antes.faixa + '</b> para <b>' + a.depois.faixa + '</b> na fórmula atual';
    else txt += 'continua <b>' + a.antes.faixa + '</b> na fórmula atual';
    if (a.antes.definida && a.depois.definida) txt += ' (' + sinal(a.depois.nota - a.antes.nota) + ')';
    var dp = p.depois.nota - p.antes.nota;
    var verbo = F.arred1(dp) > 0 ? 'sobe' : F.arred1(dp) < 0 ? 'cai' : 'não se move';
    txt += '. Na proposta, a nota ' + verbo + (F.arred1(dp) !== 0 ? ' <b>' + pontos(dp) + '</b>' : '');
    txt += p.antes.faixa !== p.depois.faixa
      ? ' e vai de ' + p.antes.faixa + ' para ' + p.depois.faixa + '.'
      : ' e continua ' + p.depois.faixa + '.';
    return txt;
  }

  function frase3() {
    var somaAt = 0, somaProd = 0, nProd = 0;
    var ref = params.pesoReviews > 0 ? params.pesoReviews : F.PADRAO.pesoReviews;
    var somaMist = 0;
    linhas.forEach(function (l) {
      somaAt += l.p.atendimento;
      if (l.p.produto != null) {
        somaProd += l.p.produto; nProd++;
        somaMist += (1 - ref) * l.p.atendimento + ref * l.p.produto;
      } else somaMist += l.p.atendimento;
    });
    var at = somaAt / TOTAL, mist = somaMist / TOTAL, prod = nProd ? somaProd / nProd : null;
    var d = mist - at, dr = F.arred1(mist) - F.arred1(at);
    var mov = dr === 0 ? 'não muda' : (dr > 0 ? 'sobe ' : 'cai ') + '<b>' + pontos(Math.abs(dr)) + '</b>';
    if (params.modo === 'duas') {
      return 'Com duas notas lado a lado, a média de atendimento é <b>' + num(at) + '</b> e a de produto é <b>' + num(prod) + '</b>. ' +
        'Se os reviews entrassem numa nota única com peso de ' + Math.round(ref * 100) + '%, a média ' +
        (dr === 0 ? 'não mudaria' : (dr > 0 ? 'subiria ' : 'cairia ') + pontos(Math.abs(dr))) +
        '. Review pedido pela loja tende a ser positivo, por isso eles ficam separados.';
    }
    if (params.pesoReviews === 0) {
      return 'Reviews fora da nota: com peso 0%, a nota é só de atendimento (média ' + num(at) + '). A média de produto, à parte, seria ' + num(prod) + '.';
    }
    return 'Somando os reviews de compra verificada com peso de ' + Math.round(params.pesoReviews * 100) + '%, a nota média ' + mov +
      (dr === 0 ? '' : ' (de ' + num(at) + ' para ' + num(mist) + ')') +
      '. Review pedido pela loja tende a ser positivo, por isso a opção de mostrar atendimento e produto separados.';
  }

  /* ---------- render ---------- */
  function renderResumo() {
    var e = empresas[estado.ataque.empresaId];
    var r = simularAtaque(e, estado.ataque.qtd, estado.ataque.tipo);
    $('resumo').innerHTML =
      '<li>' + frase1() + '</li>' +
      '<li>' + textoAtaque(e, r, estado.ataque.qtd, estado.ataque.tipo) + '</li>' +
      '<li>' + frase3() + '</li>';
  }

  function renderMatriz() {
    var linhasM = ['Sem reputação definida'].concat(F.FAIXAS);
    var cont = {};
    linhas.forEach(function (l) {
      var k = l.a.faixa + '|' + l.p.faixa;
      cont[k] = (cont[k] || 0) + 1;
    });
    var max = 0;
    Object.keys(cont).forEach(function (k) { if (cont[k] > max) max = cont[k]; });
    var h = '<table class="matriz"><thead><tr><th class="canto">Atual ↓ &nbsp; Proposta →</th>';
    F.FAIXAS.forEach(function (f) { h += '<th>' + chip(f, true) + '</th>'; });
    h += '<th>Total</th></tr></thead><tbody>';
    linhasM.forEach(function (fa) {
      var total = 0;
      var tds = '';
      F.FAIXAS.forEach(function (fp) {
        var n = cont[fa + '|' + fp] || 0;
        total += n;
        var igual = fa === fp;
        var cls = n === 0 ? 'zero' : igual ? 'igual' : 'muda';
        var alpha = n ? (0.15 + 0.6 * n / max).toFixed(2) : 0;
        tds += '<td class="' + cls + '"' + (n && !igual ? ' style="--a:' + alpha + '"' : '') + '>' + (n || '·') + '</td>';
      });
      h += '<tr><th>' + chip(fa, true) + '</th>' + tds + '<td class="total">' + total + '</td></tr>';
    });
    h += '</tbody></table>';
    $('matriz').innerHTML = h;
  }

  var COLUNAS = [
    { chave: 'nome', rotulo: 'Empresa' },
    { chave: 'segmento', rotulo: 'Segmento' },
    { chave: 'volume', rotulo: 'Reclamações', dica: 'Reclamações avaliadas: 12 meses / 6 meses' },
    { chave: 'atual', rotulo: 'Nota atual' },
    { chave: 'faixaAtual', rotulo: 'Faixa atual' },
    { chave: 'proposta', rotulo: 'Nota proposta' },
    { chave: 'faixaProposta', rotulo: 'Faixa proposta' },
    { chave: 'produto', rotulo: 'Produto', soDuas: true },
    { chave: 'diff', rotulo: 'Diferença' }
  ];

  function valorOrdem(l, chave) {
    switch (chave) {
      case 'nome': return l.e.nome;
      case 'segmento': return l.e.segmento + l.e.nome;
      case 'volume': return l.e.reclamacoes.length;
      case 'atual': return l.a.definida ? l.a.nota : -1;
      case 'faixaAtual': return l.a.definida ? ORDEM_FAIXA[l.a.faixa] : -1;
      case 'proposta': return l.p.nota;
      case 'faixaProposta': return ORDEM_FAIXA[l.p.faixa];
      case 'produto': return l.p.produto == null ? -1 : l.p.produto;
      case 'diff': return l.diff == null ? -99 : Math.abs(l.diff) + (l.muda ? 100 : 0);
    }
  }

  function renderTabela() {
    var duas = params.modo === 'duas';
    var cols = COLUNAS.filter(function (c) { return !c.soDuas || duas; });
    var lista = linhas.filter(function (l) {
      return (!estado.filtroSeg || l.e.segId === estado.filtroSeg) && (!estado.soMuda || l.muda);
    });
    var o = estado.ordem;
    lista.sort(function (x, y) {
      var a = valorOrdem(x, o.chave), b = valorOrdem(y, o.chave);
      if (typeof a === 'string') return a.localeCompare(b, 'pt-BR') * o.dir;
      return (a - b) * o.dir || x.e.nome.localeCompare(y.e.nome, 'pt-BR');
    });

    var h = '<table class="tabela"><thead><tr>';
    cols.forEach(function (c) {
      var ativo = o.chave === c.chave;
      h += '<th><button type="button" data-ordem="' + c.chave + '" class="' + (ativo ? 'ativo' : '') + '"' +
        (c.dica ? ' title="' + c.dica + '"' : '') + '>' + c.rotulo +
        (c.chave === 'proposta' && duas ? ' (atendimento)' : '') +
        '<span class="seta">' + (ativo ? (o.dir > 0 ? '▲' : '▼') : '') + '</span></button></th>';
    });
    h += '</tr></thead><tbody>';

    lista.forEach(function (l) {
      var e = l.e, a = l.a, p = l.p;
      var tags = '';
      if (p.poucoVolume) tags += '<span class="tag tag-volume" title="Poucas reclamações recentes: nota puxada para a média do segmento">pouco volume</span>';
      if (e.oscilante) tags += '<span class="tag tag-osc" title="Era ruim e melhorou nos últimos 3 meses">melhorou há pouco</span>';
      var origem = p.reclamacoes + ' reclamações' +
        (params.modo === 'duas' || p.usouReviews ? ' e ' + p.reviews + ' reviews verificados' : '') + ', últimos 12 meses';

      var diffTxt = l.diff == null ? '<span class="novo">ganha nota</span>'
        : '<span class="diff ' + (l.diff > 0 ? 'pos' : l.diff < 0 ? 'neg' : '') + '">' + sinal(l.diff) + '</span>';

      h += '<tr class="' + (l.muda ? 'muda' : '') + '">';
      h += '<td data-label="Empresa" class="c-empresa"><div class="nome">' + e.nome + '</div>' +
        (tags ? '<div class="tags">' + tags + '</div>' : '') + '<div class="origem">' + origem + '</div></td>';
      h += '<td data-label="Segmento">' + e.segmento + '</td>';
      h += '<td data-label="Reclamações (12m / 6m)" class="n"><span>' + e.reclamacoes.length + ' <span class="sub">/ ' + a.n + '</span></span></td>';
      h += '<td data-label="Nota atual" class="n">' + (a.definida ? num(a.nota) : '<span class="sub">sem nota</span>') + '</td>';
      h += '<td data-label="Faixa atual">' + chip(a.faixa) + '</td>';
      h += '<td data-label="Nota proposta" class="n"><b>' + num(p.nota) + '</b></td>';
      h += '<td data-label="Faixa proposta">' + chip(p.faixa) + '</td>';
      if (duas) h += '<td data-label="Produto" class="n">' + (p.produto == null ? '<span class="sub">sem reviews</span>' : num(p.produto) + (p.poucoVolumeProduto ? ' <span class="tag tag-volume" title="Poucos reviews: nota de produto puxada para a média do segmento">pouco volume</span>' : '')) + '</td>';
      h += '<td data-label="Diferença" class="n">' + diffTxt + '</td>';
      h += '</tr>';
    });
    h += '</tbody></table>';
    if (!lista.length) h = '<p class="vazio">Nenhuma empresa com esse filtro.</p>';
    $('tabela').innerHTML = h;
    $('contagem').textContent = lista.length + ' de ' + TOTAL + ' empresas';
  }

  function trilha(antes, depois) {
    if (antes == null || depois == null) return '';
    var a = Math.max(0, Math.min(10, antes)) * 10, d = Math.max(0, Math.min(10, depois)) * 10;
    var ini = Math.min(a, d), fim = Math.max(a, d);
    return '<div class="trilha" aria-hidden="true">' +
      '<span class="marca" style="left:80%"></span><span class="marca" style="left:70%"></span>' +
      '<span class="marca" style="left:60%"></span><span class="marca" style="left:50%"></span>' +
      '<span class="faixa-mov ' + (d >= a ? 'sobe' : 'desce') + '" style="left:' + ini + '%;width:' + (fim - ini) + '%"></span>' +
      '<span class="ponto antes" style="left:' + a + '%"></span>' +
      '<span class="ponto depois" style="left:' + d + '%"></span></div>';
  }

  function linhaAtaque(titulo, nota, r, def) {
    var antes = r.antes, depois = r.depois;
    var nA = def ? (antes.definida ? antes.nota : null) : antes.nota;
    var nD = def ? (depois.definida ? depois.nota : null) : depois.nota;
    var delta = nA != null && nD != null ? '<span class="diff ' + (nD - nA > 0.05 ? 'pos' : nD - nA < -0.05 ? 'neg' : '') + '">' + sinal(nD - nA) + '</span>' : '';
    return '<div class="atk-linha">' +
      '<div class="atk-titulo">' + titulo + (nota ? '<span class="sub"> ' + nota + '</span>' : '') + '</div>' +
      '<div class="atk-valores">' +
      '<span>' + (nA == null ? 'sem nota' : num(nA)) + ' ' + chip(antes.faixa, true) + '</span>' +
      '<span class="seta-atk">→</span>' +
      '<span>' + (nD == null ? 'sem nota' : num(nD)) + ' ' + chip(depois.faixa, true) + '</span>' +
      delta + '</div>' + trilha(nA, nD) + '</div>';
  }

  function renderAtaque() {
    var e = empresas[estado.ataque.empresaId];
    var r = simularAtaque(e, estado.ataque.qtd, estado.ataque.tipo);
    var h = linhaAtaque('Fórmula atual', '', r.atual, true) +
      linhaAtaque('Proposta', params.picos ? '' : '(regra 5 desligada nos controles)', r.proposta, false);
    if (params.picos) h += linhaAtaque('Proposta sem a regra 5', 'para comparar', r.semPicos, false);
    $('atk-resultado').innerHTML = h;
    $('atk-qtd-valor').textContent = estado.ataque.qtd;
  }

  function renderControles() {
    $('meiaVida-valor').textContent = params.meiaVida + ' dias';
    $('volumeCheio-valor').textContent = params.volumeCheio;
    $('atk-responde-campo').hidden = estado.ataque.tipo !== 'negativo';
    $('atk-responde').checked = estado.ataque.responde;
    $('pesoReviews-valor').textContent = Math.round(params.pesoReviews * 100) + '%';
    $('limitePico-valor').textContent = params.limitePico + 'x';
    $('pesoReviews').disabled = params.modo !== 'unica';
    $('campo-peso').classList.toggle('desligado', params.modo !== 'unica');
    $('limitePico').disabled = !params.picos;
    $('campo-limite').classList.toggle('desligado', !params.picos);
    document.querySelectorAll('[data-modo]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-modo') === params.modo));
    });
    $('meiaVida').value = params.meiaVida;
    $('volumeCheio').value = params.volumeCheio;
    $('pesoReviews').value = Math.round(params.pesoReviews * 100);
    $('limitePico').value = params.limitePico;
    $('picos').checked = params.picos;
  }

  var pendente = false;
  function atualizar() {
    if (pendente) return;
    pendente = true;
    setTimeout(function () {
      pendente = false;
      calcular();
      renderControles();
      renderResumo();
      renderMatriz();
      renderTabela();
      renderAtaque();
    }, 16);
  }

  /* ---------- eventos ---------- */
  function ligar() {
    $('meiaVida').addEventListener('input', function () { params.meiaVida = +this.value; atualizar(); });
    $('volumeCheio').addEventListener('input', function () { params.volumeCheio = +this.value; atualizar(); });
    $('pesoReviews').addEventListener('input', function () { params.pesoReviews = this.value / 100; atualizar(); });
    $('limitePico').addEventListener('input', function () { params.limitePico = +this.value; atualizar(); });
    $('picos').addEventListener('change', function () { params.picos = this.checked; atualizar(); });
    document.querySelectorAll('[data-modo]').forEach(function (b) {
      b.addEventListener('click', function () { params.modo = b.getAttribute('data-modo'); atualizar(); });
    });
    $('restaurar').addEventListener('click', function () { params = Object.assign({}, F.PADRAO); atualizar(); });

    $('filtro-seg').addEventListener('change', function () { estado.filtroSeg = this.value; renderTabela(); });
    $('so-muda').addEventListener('change', function () { estado.soMuda = this.checked; renderTabela(); });
    $('ordem-celular').addEventListener('change', function () {
      estado.ordem = { chave: this.value, dir: this.value === 'nome' ? 1 : -1 };
      renderTabela();
    });
    $('tabela').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-ordem]');
      if (!b) return;
      var k = b.getAttribute('data-ordem');
      if (estado.ordem.chave === k) estado.ordem.dir *= -1;
      else estado.ordem = { chave: k, dir: (k === 'nome' || k === 'segmento') ? 1 : -1 };
      renderTabela();
    });

    $('atk-empresa').addEventListener('change', function () { estado.ataque.empresaId = +this.value; atualizar(); });
    $('atk-qtd').addEventListener('input', function () { estado.ataque.qtd = +this.value; atualizar(); });
    $('atk-responde').addEventListener('change', function () { estado.ataque.responde = this.checked; atualizar(); });
    document.querySelectorAll('input[name="atk-tipo"]').forEach(function (r) {
      r.addEventListener('change', function () { estado.ataque.tipo = this.value; atualizar(); });
    });
  }

  function preencherSelects() {
    var seg = '<option value="">Todos os segmentos</option>';
    var emp = '';
    dados.segmentos.forEach(function (s) {
      seg += '<option value="' + s.id + '">' + s.nome + '</option>';
      emp += '<optgroup label="' + s.nome + '">';
      empresas.filter(function (e) { return e.segId === s.id; })
        .sort(function (a, b) { return a.reclamacoes.length - b.reclamacoes.length; })
        .forEach(function (e) {
          emp += '<option value="' + e.id + '">' + e.nome + ' (' + e.reclamacoes.length + ' reclamações)</option>';
        });
      emp += '</optgroup>';
    });
    $('filtro-seg').innerHTML = seg;
    $('atk-empresa').innerHTML = emp;
  }

  preencherSelects();
  calcular();
  estado.ataque.empresaId = empresaPadraoAtaque();
  $('atk-empresa').value = estado.ataque.empresaId;
  ligar();
  atualizar();
})();
