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
  var PESO_EXCEDENTE = 0;     // regra 5: excedente de um pico fica em espera até ser verificado
  var PICO_MINIMO = 3;        // regra 5: semana com até 3 avaliações nunca é pico

  var PADRAO = {
    meiaVida: 90,
    volumeCheio: 20,
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
  // têm o excedente amortecido. Devolve um multiplicador por semana.
  function multiplicadoresPico(reclamacoes, limitePico, opcoes) {
    opcoes = opcoes || { minimo: PICO_MINIMO, excedente: PESO_EXCEDENTE };
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
      var limite = Math.max(opcoes.minimo, limitePico * ritmo);
      mult.push(qtd > limite ? (limite + (qtd - limite) * opcoes.excedente) / qtd : 1);
    }
    return mult;
  }

  function agregarAtendimento(reclamacoes, p) {
    var mult = p.picos ? multiplicadoresPico(reclamacoes, p.limitePico, { minimo: p.picoMinimo || PICO_MINIMO, excedente: p.pesoExcedente != null ? p.pesoExcedente : PESO_EXCEDENTE }) : null;
    var a = { W: 0, R: 0, S: 0, V: 0, N: 0, volume: 0, n: 0 };
    for (var i = 0; i < reclamacoes.length; i++) {
      var c = reclamacoes[i];
      if (c.idade >= JANELA_PROPOSTA) continue;
      var m = mult ? mult[Math.floor(c.idade / 7)] : 1;
      var w = m * Math.pow(0.5, c.idade / p.meiaVida);  // regra 1
      a.W += w;
      if (c.respondida) a.R += w;
      if (c.resolvida) a.S += w;
      if (c.voltaria) a.V += w;
      a.N += w * c.nota;
      a.volume += m;  // volume que conta (picos contam pouco)
      a.n++;
    }
    return a;
  }

  function somar(a, b) {
    return { W: a.W + b.W, R: a.R + b.R, S: a.S + b.S, V: a.V + b.V, N: a.N + b.N, volume: a.volume + b.volume, n: a.n + b.n };
  }

  function indicadores(a) {
    if (a.W === 0) return null;
    var IR = a.R / a.W * 100, IS = a.S / a.W * 100, IN = a.V / a.W * 100, MA = a.N / a.W;
    return { IR: IR, IS: IS, IN: IN, MA: MA, nota: ar(IR, MA, IS, IN) };
  }

  // Regra 3: estrelas viram 0 a 10. Só compra verificada.
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
    return { n: n, nota: W > 0 ? soma / W : null };
  }

  // Média do segmento: média simples das empresas do segmento com volume
  // suficiente (cada empresa conta uma vez). Sem nenhuma, junta todas as avaliações.
  function mediaSegmento(empresas, p) {
    var soma = 0, somaIR = 0, k = 0;
    var todas = { W: 0, R: 0, S: 0, V: 0, N: 0, volume: 0, n: 0 };
    for (var i = 0; i < empresas.length; i++) {
      var a = agregarAtendimento(empresas[i].reclamacoes, p);
      todas = somar(todas, a);
      if (a.volume >= p.volumeCheio) {
        var ind = indicadores(a);
        soma += ind.nota; somaIR += ind.IR; k++;
      }
    }
    if (k === 0) return indicadores(todas);
    return { nota: soma / k, IR: somaIR / k };
  }

  function proposta(empresa, media, p) {
    var a = agregarAtendimento(empresa.reclamacoes, p);
    var bruta = indicadores(a);
    // Regra 2: com pouco volume, a nota parte da média do segmento.
    var alfa = Math.min(1, a.volume / p.volumeCheio);
    var atendimento = bruta ? alfa * bruta.nota + (1 - alfa) * media.nota : media.nota;
    var IR = bruta ? alfa * bruta.IR + (1 - alfa) * media.IR : media.IR;

    var prod = agregarProduto(empresa.reviews, p);
    var nota = atendimento;
    var usouReviews = false;
    if (p.modo === 'unica' && prod.n > 0 && p.pesoReviews > 0) {
      nota = (1 - p.pesoReviews) * atendimento + p.pesoReviews * prod.nota;
      usouReviews = true;
    }

    return {
      nota: nota,
      atendimento: atendimento,
      produto: prod.nota,
      faixa: faixa(nota, IR),
      IR: IR,
      alfa: alfa,
      poucoVolume: a.volume < p.volumeCheio,
      reclamacoes: a.n,
      volumeQueConta: a.volume,
      reviews: prod.n,
      usouReviews: usouReviews
    };
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
    multiplicadoresPico: multiplicadoresPico
  };
});
