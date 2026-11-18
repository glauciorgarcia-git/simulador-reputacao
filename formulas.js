/*
 * Fórmula atual e fórmula proposta.
 * Sem dependência de tela: roda no navegador e no Node (test.js).
 *
 * Reclamação: { idade (dias), respondida, resolvida, voltaria, nota (0 a 10) }
 * Review:     { idade (dias), estrelas (1 a 5), verificada }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Formulas = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEM = 'Sem reputação definida';
  var FAIXAS = ['Ótima', 'Boa', 'Regular', 'Ruim', 'Não recomendada'];
  var JANELA_ATUAL = 183;     // ~6 meses, em dias
  var JANELA_PROPOSTA = 365;  // 12 meses
  var MINIMO_ATUAL = 10;
  var MINIMO_IR = 10;         // reclamações mínimas para o corte de 50% respondidas valer na proposta
  var PESO_EXCEDENTE = 0;     // regra 5: excedente de um pico fica em espera até ser verificado
  var PICO_MINIMO = 3;        // regra 5: semana com até 3 avaliações nunca é pico

  var PADRAO = {
    meiaVida: 90,
    volumeCheio: 10,
    modo: 'unica',       // 'unica' ou 'duas'
    pesoReviews: 0.2,
    picos: true,
    limitePico: 3
  };

  function arred1(x) { return Math.round(x * 10 + 1e-9) / 10; }

  // AR = ((IR x 2) + (MA x 10 x 3) + (IS x 3) + (IN x 2)) / 100
  function ar(IR, MA, IS, IN) {
    return (IR * 2 + MA * 10 * 3 + IS * 3 + IN * 2) / 100;
  }

  function faixa(nota, IR) {
    if (IR < 50) return 'Não recomendada';
    var n = arred1(nota);
    if (n >= 8) return 'Ótima';
    if (n >= 7) return 'Boa';
    if (n >= 6) return 'Regular';
    if (n >= 5) return 'Ruim';
    return 'Não recomendada';
  }

  /* ---------- Fórmula atual ---------- */
  function atual(reclamacoes) {
    var n = 0, r = 0, s = 0, v = 0, soma = 0;
    for (var i = 0; i < reclamacoes.length; i++) {
      var c = reclamacoes[i];
      if (c.idade >= JANELA_ATUAL) continue;
      n++;
      if (c.respondida) r++;
      if (c.resolvida) s++;
      if (c.voltaria) v++;
      soma += c.nota;
    }
    if (n < MINIMO_ATUAL) return { definida: false, n: n, nota: null, faixa: SEM };
    var IR = r / n * 100, IS = s / n * 100, IN = v / n * 100, MA = soma / n;
    var nota = ar(IR, MA, IS, IN);
    return { definida: true, n: n, IR: IR, IS: IS, IN: IN, MA: MA, nota: nota, faixa: faixa(nota, IR) };
  }

  /* ---------- Fórmula proposta ---------- */

  // Regra 5: semanas com volume muito acima do ritmo normal da empresa
  // têm o excedente em espera (verificação não simulada aqui). Um multiplicador por semana.
  function multiplicadoresPico(reclamacoes, limitePico) {
    var semanas = [], total = 0, i;
    for (i = 0; i < 53; i++) semanas.push(0);
    for (i = 0; i < reclamacoes.length; i++) {
      var c = reclamacoes[i];
      if (c.idade >= JANELA_PROPOSTA) continue;
      semanas[Math.floor(c.idade / 7)]++;
      total++;
    }
    var mult = [];
    for (i = 0; i < 53; i++) {
      var qtd = semanas[i];
      var ritmo = (total - qtd) / 51;  // média semanal das outras semanas
      var limite = Math.max(PICO_MINIMO, limitePico * ritmo);
      mult.push(qtd > limite ? (limite + (qtd - limite) * PESO_EXCEDENTE) / qtd : 1);
    }
    return mult;
  }

  function agregarAtendimento(reclamacoes, p) {
    var mult = p.picos ? multiplicadoresPico(reclamacoes, p.limitePico) : null;
    var a = { W: 0, R: 0, S: 0, V: 0, N: 0, n: 0 };
    for (var i = 0; i < reclamacoes.length; i++) {
      var c = reclamacoes[i];
      if (c.idade >= JANELA_PROPOSTA) continue;
      var m = mult ? mult[Math.floor(c.idade / 7)] : 1;
      var w = m * Math.pow(0.5, c.idade / p.meiaVida);  // regras 1 e 5
      a.W += w;  // também é o volume que conta na regra 2
      if (c.respondida) a.R += w;
      if (c.resolvida) a.S += w;
      if (c.voltaria) a.V += w;
      a.N += w * c.nota;
      a.n++;
    }
    return a;
  }

  function somar(a, b) {
    return { W: a.W + b.W, R: a.R + b.R, S: a.S + b.S, V: a.V + b.V, N: a.N + b.N, n: a.n + b.n };
  }

  function indicadores(a) {
    if (a.W === 0) return null;
    var IR = a.R / a.W * 100, IS = a.S / a.W * 100, IN = a.V / a.W * 100, MA = a.N / a.W;
    return { IR: IR, IS: IS, IN: IN, MA: MA, nota: ar(IR, MA, IS, IN) };
  }

  // Regra 3: estrelas viram 0 a 10. Só compra verificada, com o peso da regra 1.
  function agregarProduto(reviews, p) {
    var W = 0, soma = 0, n = 0;
    for (var i = 0; i < reviews.length; i++) {
      var r = reviews[i];
      if (r.idade >= JANELA_PROPOSTA || !r.verificada) continue;
      var w = Math.pow(0.5, r.idade / p.meiaVida);
      W += w;
      soma += w * (r.estrelas - 1) * 2.5;
      n++;
    }
    return { n: n, W: W, soma: soma, nota: W > 0 ? soma / W : null };
  }

  // Média do segmento: média simples das empresas do segmento com volume
  // suficiente (cada empresa conta uma vez). Sem nenhuma, junta tudo.
  // Vale para atendimento e para produto, cada um com seu volume.
  function mediaSegmento(empresas, p) {
    var soma = 0, somaIR = 0, k = 0, somaProd = 0, kProd = 0;
    var todas = { W: 0, R: 0, S: 0, V: 0, N: 0, n: 0 };
    var prodW = 0, prodSoma = 0;
    for (var i = 0; i < empresas.length; i++) {
      var a = agregarAtendimento(empresas[i].reclamacoes, p);
      todas = somar(todas, a);
      if (a.W >= p.volumeCheio) {
        var ind = indicadores(a);
        soma += ind.nota; somaIR += ind.IR; k++;
      }
      var pr = agregarProduto(empresas[i].reviews, p);
      prodW += pr.W; prodSoma += pr.soma;
      if (pr.W >= p.volumeCheio) { somaProd += pr.nota; kProd++; }
    }
    var geral = indicadores(todas);
    return {
      nota: k ? soma / k : geral.nota,
      IR: k ? somaIR / k : geral.IR,
      produto: kProd ? somaProd / kProd : (prodW > 0 ? prodSoma / prodW : 0)
    };
  }

  function proposta(empresa, media, p) {
    var a = agregarAtendimento(empresa.reclamacoes, p);
    var bruta = indicadores(a);
    // Regra 2: com pouco volume, a nota parte da média do segmento.
    // O volume é contado com o peso da recência (regra 1) e dos picos (regra 5).
    var alfa = Math.min(1, a.W / p.volumeCheio);
    var atendimento = bruta ? alfa * bruta.nota + (1 - alfa) * media.nota : media.nota;

    // Corte de "menos de 50% respondidas": usa o índice real da empresa,
    // e só quando há reclamações suficientes para ele dizer algo.
    var IRregra = bruta && a.n >= MINIMO_IR ? bruta.IR : 100;

    // Regra 2 também nos reviews: a nota de produto parte da média de produto do segmento.
    var pr = agregarProduto(empresa.reviews, p);
    var beta = Math.min(1, pr.W / p.volumeCheio);
    var produto = pr.n > 0 ? beta * pr.nota + (1 - beta) * media.produto : null;

    var nota = atendimento;
    var usouReviews = false;
    if (p.modo === 'unica' && produto != null && p.pesoReviews > 0) {
      nota = (1 - p.pesoReviews) * atendimento + p.pesoReviews * produto;
      usouReviews = true;
    }

    return {
      nota: nota,
      atendimento: atendimento,
      produto: produto,
      faixa: faixa(nota, IRregra),
      IRregra: IRregra,
      alfa: alfa,
      beta: beta,
      poucoVolume: a.W < p.volumeCheio,
      poucoVolumeProduto: pr.n > 0 && pr.W < p.volumeCheio,
      volumeQueConta: a.W,
      reclamacoes: a.n,
      reviews: pr.n,
      usouReviews: usouReviews
    };
  }

  // Reclamações falsas para a simulação de ataque, todas nos últimos 7 dias.
  function reclamacoesFalsas(qtd, tipo, empresaResponde) {
    var lista = [];
    for (var i = 0; i < qtd; i++) {
      lista.push(tipo === 'positivo'
        ? { idade: i % 7, respondida: true, resolvida: true, voltaria: true, nota: 10 }
        : { idade: i % 7, respondida: !!empresaResponde, resolvida: false, voltaria: false, nota: 0 });
    }
    return lista;
  }

  return {
    SEM: SEM,
    FAIXAS: FAIXAS,
    PADRAO: PADRAO,
    JANELA_ATUAL: JANELA_ATUAL,
    arred1: arred1,
    ar: ar,
    faixa: faixa,
    atual: atual,
    proposta: proposta,
    mediaSegmento: mediaSegmento,
    multiplicadoresPico: multiplicadoresPico,
    reclamacoesFalsas: reclamacoesFalsas
  };
});
