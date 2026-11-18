// Rode com: node test.js
var assert = require('assert');
var F = require('./formulas.js');

function rec(idade, respondida, resolvida, voltaria, nota) {
  return { idade: idade, respondida: respondida, resolvida: resolvida, voltaria: voltaria, nota: nota };
}
function perto(a, b) { return Math.abs(a - b) < 1e-9; }

var ok = 0;
function teste(nome, fn) { fn(); ok++; console.log('ok  ' + nome); }

/*
 * Exemplo calculado à mão (fórmula atual)
 * 10 reclamações nos últimos 6 meses:
 *   9 respondidas  -> IR = 90
 *   7 resolvidas   -> IS = 70
 *   6 voltariam    -> IN = 60
 *   notas somam 75 -> MA = 7,5
 * AR = (90x2 + 7,5x10x3 + 70x3 + 60x2) / 100
 *    = (180 + 225 + 210 + 120) / 100 = 7,35  -> Boa
 */
var exemplo = [
  rec(5,  true,  true,  true,  9),
  rec(10, true,  true,  true,  9),
  rec(20, true,  true,  true,  8),
  rec(30, true,  true,  true,  8),
  rec(40, true,  true,  true,  8),
  rec(50, true,  true,  true,  8),
  rec(60, true,  true,  false, 7),
  rec(70, true,  false, false, 6),
  rec(80, true,  false, false, 6),
  rec(90, false, false, false, 6)
];

teste('exemplo à mão: AR = 7,35 e faixa Boa', function () {
  var r = F.atual(exemplo);
  assert.ok(r.definida);
  assert.ok(perto(r.IR, 90) && perto(r.IS, 70) && perto(r.IN, 60) && perto(r.MA, 7.5));
  assert.ok(perto(r.nota, 7.35), 'nota foi ' + r.nota);
  assert.strictEqual(r.faixa, 'Boa');
});

teste('reclamação com mais de 6 meses fica fora', function () {
  var r = F.atual(exemplo.concat([rec(200, false, false, false, 0)]));
  assert.strictEqual(r.n, 10);
  assert.ok(perto(r.nota, 7.35));
});

teste('menos de 10 reclamações avaliadas: sem reputação definida', function () {
  var r = F.atual(exemplo.slice(0, 9));
  assert.strictEqual(r.definida, false);
  assert.strictEqual(r.faixa, 'Sem reputação definida');
});

teste('IR abaixo de 50% vira Não recomendada mesmo com nota alta', function () {
  var lista = [];
  for (var i = 0; i < 10; i++) lista.push(rec(i, i < 4, true, true, 10));
  var r = F.atual(lista);
  assert.ok(r.nota >= 8, 'nota alta: ' + r.nota);
  assert.strictEqual(r.faixa, 'Não recomendada');
});

teste('limites das faixas', function () {
  assert.strictEqual(F.faixa(8.0, 100), 'Ótima');
  assert.strictEqual(F.faixa(7.95, 100), 'Ótima');   // arredonda para 8,0
  assert.strictEqual(F.faixa(7.9, 100), 'Boa');
  assert.strictEqual(F.faixa(7.0, 100), 'Boa');
  assert.strictEqual(F.faixa(6.9, 100), 'Regular');
  assert.strictEqual(F.faixa(5.0, 100), 'Ruim');
  assert.strictEqual(F.faixa(4.9, 100), 'Não recomendada');
});

/* ---------- Proposta ---------- */
var P = Object.assign({}, F.PADRAO, { picos: false, modo: 'duas', volumeCheio: 20 });
var media = { nota: 6, IR: 80, produto: 7 };

teste('proposta: sem reclamações, a nota é a média do segmento', function () {
  var r = F.proposta({ reclamacoes: [], reviews: [] }, media, P);
  assert.ok(perto(r.nota, 6));
  assert.ok(r.poucoVolume);
});

teste('proposta: volume 5 de 20 = 25% empresa, 75% segmento', function () {
  var lista = [];
  for (var i = 0; i < 5; i++) lista.push(rec(0, true, true, true, 10));  // nota bruta 10
  var r = F.proposta({ reclamacoes: lista, reviews: [] }, media, P);
  assert.ok(perto(r.nota, 0.25 * 10 + 0.75 * 6), 'nota foi ' + r.nota);
});

teste('proposta: reclamação com idade = meia-vida pesa metade', function () {
  // 20 nota 10 hoje + 20 nota 0 há 90 dias -> 10 x 1 / (1 + 0,5) = 6,67 de MA
  var lista = [];
  for (var i = 0; i < 20; i++) lista.push(rec(0, true, true, true, 10));
  for (var j = 0; j < 20; j++) lista.push(rec(90, true, true, true, 0));
  var r = F.proposta({ reclamacoes: lista, reviews: [] }, media, P);
  var MA = 10 / 1.5;
  assert.ok(perto(r.nota, (200 + MA * 30 + 300 + 200) / 100), 'nota foi ' + r.nota);
});

teste('regra 5: pico de 30 numa semana é amortecido', function () {
  var lista = [];
  for (var i = 0; i < 15; i++) lista.push(rec(30 + i * 20, true, true, true, 5));
  for (var k = 0; k < 30; k++) lista.push(rec(k % 7, true, true, true, 10));
  var m = F.multiplicadoresPico(lista, 3);
  // ritmo normal ~0,3/semana -> limite 3; semana 0: só 3 das 30 contam = 0,1
  assert.ok(perto(m[0], 3 / 30), 'mult foi ' + m[0]);
  assert.strictEqual(m[10], 1);
});

/* ---------- Proteções da proposta ---------- */

teste('corte de 50% respondidas usa o índice real da empresa, não o suavizado', function () {
  // 12 reclamações antigas (peso baixo, nota bem puxada para o segmento), só 4 respondidas.
  var lista = [];
  for (var i = 0; i < 12; i++) lista.push(rec(200, i < 4, true, true, 9));
  var r = F.proposta({ reclamacoes: lista, reviews: [] }, media, P);
  assert.ok(r.alfa < 0.5, 'alfa ' + r.alfa);
  assert.ok(r.IRregra < 50, 'IR real ' + r.IRregra);
  assert.strictEqual(r.faixa, 'Não recomendada');
});

teste('corte de 50% respondidas só vale a partir de 10 reclamações', function () {
  var lista = [rec(0, false, false, false, 5), rec(1, false, false, false, 5)];
  var r = F.proposta({ reclamacoes: lista, reviews: [] }, media, P);
  assert.notStrictEqual(r.faixa, 'Não recomendada');
  assert.ok(r.poucoVolume);
});

teste('pouco volume nos reviews: um único review verificado não muda a faixa', function () {
  var lista = [];
  for (var i = 0; i < 40; i++) lista.push(rec(i, true, i < 27, i < 26, 7));
  var unica = Object.assign({}, P, { modo: 'unica' });
  var sem = F.proposta({ reclamacoes: lista, reviews: [] }, media, unica);
  var com = F.proposta({ reclamacoes: lista, reviews: [{ idade: 0, estrelas: 5, verificada: true }] }, media, unica);
  assert.strictEqual(com.faixa, sem.faixa, sem.nota + ' -> ' + com.nota);
  assert.ok(com.poucoVolumeProduto);
  // a nota de produto parte da média de produto do segmento (7) e só anda 1/20 até o 10
  assert.ok(perto(com.produto, 0.05 * 10 + 0.95 * 7), 'produto ' + com.produto);
});

teste('volume recente: reclamações antigas contam menos como volume', function () {
  var antigas = [], novas = [];
  for (var i = 0; i < 20; i++) { antigas.push(rec(300, true, true, true, 10)); novas.push(rec(0, true, true, true, 10)); }
  var a = F.proposta({ reclamacoes: antigas, reviews: [] }, media, P);
  var n = F.proposta({ reclamacoes: novas, reviews: [] }, media, P);
  assert.ok(perto(n.alfa, 1));
  assert.ok(perto(a.alfa, Math.pow(0.5, 300 / 90)), 'alfa ' + a.alfa);
  assert.ok(a.poucoVolume && !n.poucoVolume);
});

teste('ataque de concorrente: reclamações falsas respeitam se a empresa responde', function () {
  var nao = F.reclamacoesFalsas(30, 'negativo', false);
  var sim = F.reclamacoesFalsas(30, 'negativo', true);
  assert.strictEqual(nao.length, 30);
  assert.ok(nao.every(function (c) { return !c.respondida && !c.resolvida && c.nota === 0 && c.idade < 7; }));
  assert.ok(sim.every(function (c) { return c.respondida; }));
});

console.log('\n' + ok + ' testes passaram.');
