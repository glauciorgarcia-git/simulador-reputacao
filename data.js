/*
 * Gerador de dados fictícios com semente fixa.
 * Mesma semente = mesmos dados, sempre. Nada aqui vem de fonte real.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Dados = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var SEMENTE = 20261115;

  var SEGMENTOS = [
    {
      id: 'ecommerce', nome: 'E-commerce', base: 0.68,
      nomes: ['Loja Aurora', 'Casa Ipê', 'Mercado Vento Sul', 'Bazar Lumen', 'Empório Maré',
        'Vitrine Cajá', 'Loja Pitanga', 'Armazém Boreal', 'Outlet Jacarandá', 'Shop Ventura',
        'Ateliê Tucano', 'Mundo Caramelo', 'Loja Siriema', 'Feira Cobalto', 'Mercadinho Orvalho']
    },
    {
      id: 'bancos', nome: 'Bancos digitais', base: 0.70,
      nomes: ['Banco Sertão Digital', 'Conta Ágata', 'Banco Pirilampo', 'Pay Saracura', 'Banco Seriema',
        'Carteira Quartzo', 'Banco Maracujá', 'Fin Aroeira', 'Banco Coral', 'Conta Andorinha',
        'Banco Bromélia', 'Pago Lince', 'Banco Jangada', 'Conta Topázio', 'Banco Ventania']
    },
    {
      id: 'telecom', nome: 'Telecom', base: 0.52,
      nomes: ['Fibra Mandacaru', 'TeleCanário', 'Rede Jaguatirica', 'Sinal Cerrado', 'Onda Turquesa',
        'Conecta Juriti', 'Net Graúna', 'Fibra Ametista', 'Tele Pororoca', 'Rede Taquara',
        'Sinal Peroba', 'Conecta Lagoa Lilás', 'Fibra Tangará', 'Tele Capivara', 'Rede Arapuã']
    },
    {
      id: 'viagens', nome: 'Viagens', base: 0.60,
      nomes: ['Viagens Bem-te-vi', 'Rota Caiçara', 'Embarque Gaivota', 'Trilha Norte Turismo', 'Mala Lilás Viagens',
        'Voa Guará', 'Destino Jatobá', 'Passagem Coruja', 'Turismo Pau-Brasil', 'Rumo Arara',
        'Bilhete Albatroz', 'Viaje Sapoti', 'Roteiro Manacá', 'Estrada Tatu', 'Reserva Cambuí']
    }
  ];

  // Volume de reclamações avaliadas em 12 meses. Variado de propósito.
  var VOLUMES = [3, 8, 15, 40, 200, 2000, 5, 12, 25, 60, 120, 300, 600, 1000, 80];
  // Volumes elegíveis para o perfil "oscilante" (precisa de volume para o efeito aparecer).
  var VOLUMES_OSCILANTES = [40, 60, 80, 120, 200, 300, 600];

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

  function gerar(semente) {
    var rnd = mulberry32(semente || SEMENTE);
    function normal() {
      var u = 1 - rnd(), v = rnd();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    function embaralhar(arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rnd() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    function reclamacao(q, idade) {
      var respondida = rnd() < 0.3 + 0.7 * q;
      var resolvida = respondida ? rnd() < 0.35 + 0.65 * q : rnd() < 0.08;
      var voltaria = resolvida ? rnd() < 0.5 + 0.45 * q : rnd() < 0.1 + 0.3 * q;
      var nota = resolvida ? 7 + 3 * q + normal() * 1.3 : 2 + 4 * q + normal() * 1.8;
      return {
        idade: idade,
        respondida: respondida,
        resolvida: resolvida,
        voltaria: voltaria,
        nota: Math.round(clamp(nota, 0, 10))
      };
    }

    function estrelas(q, bonus5) {
      // Reviews pedidos pela loja: tendência positiva.
      // Sem compra verificada, ainda mais positivos (bonus5 > 0).
      var w = [
        0.05 * (1.3 - q) + 0.01,  // 1
        0.07 * (1.3 - q),         // 2
        0.12 * (1.3 - q),         // 3
        0.25,                     // 4
        0.45 + 0.25 * q + bonus5  // 5
      ];
      var total = w.reduce(function (s, x) { return s + x; }, 0);
      var r = rnd() * total, acc = 0;
      for (var i = 0; i < 5; i++) { acc += w[i]; if (r < acc) return i + 1; }
      return 5;
    }

    var empresas = [];
    var id = 0;
    SEGMENTOS.forEach(function (seg) {
      var vols = embaralhar(VOLUMES.slice());
      var candidatos = [];
      vols.forEach(function (v, i) { if (VOLUMES_OSCILANTES.indexOf(v) >= 0) candidatos.push(i); });
      var oscilantes = embaralhar(candidatos).slice(0, 2);

      seg.nomes.forEach(function (nome, i) {
        var vol = vols[i];
        var q = clamp(seg.base + normal() * 0.16, 0.12, 0.95);
        var osc = oscilantes.indexOf(i) >= 0;
        // Oscilante: ruim até 3 meses atrás, boa nos últimos 3 meses.
        var qAntes = osc ? 0.22 + rnd() * 0.1 : q;
        var qDepois = osc ? 0.82 + rnd() * 0.1 : q;

        var reclamacoes = [];
        for (var k = 0; k < vol; k++) {
          var idade = Math.floor(rnd() * 365);
          reclamacoes.push(reclamacao(idade >= 90 ? qAntes : qDepois, idade));
        }

        var reviews = [];
        var nRev = Math.max(2, Math.round(vol * (0.6 + rnd() * 1.4)));
        for (var r = 0; r < nRev; r++) {
          var verificada = rnd() < 0.7;
          reviews.push({
            idade: Math.floor(rnd() * 365),
            estrelas: estrelas(q, verificada ? 0 : 0.6),
            verificada: verificada
          });
        }

        empresas.push({
          id: id++,
          nome: nome,
          segId: seg.id,
          segmento: seg.nome,
          oscilante: osc,
          reclamacoes: reclamacoes,
          reviews: reviews
        });
      });
    });

    return {
      empresas: empresas,
      segmentos: SEGMENTOS.map(function (s) { return { id: s.id, nome: s.nome }; }),
      dataReferencia: '2026-11-15'
    };
  }

  return { gerar: gerar, SEMENTE: SEMENTE };
});
