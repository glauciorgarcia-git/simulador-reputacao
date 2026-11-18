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

teste('menos de 10 avaliações: sem reputação definida', function () {
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
var P = Object.assign({}, F.PADRAO, { picos: false, modo: 'duas' });
var media = { nota: 6, IR: 80 };

teste('proposta: sem avaliações, a nota é a média do segmento', function () {
  var r = F.proposta({ reclamacoes: [], reviews: [] }, media, P);
  assert.ok(perto(r.nota, 6));
  assert.ok(r.poucoVolume);
});

teste('proposta: 5 de 20 avaliações = 25% empresa, 75% segmento', function () {
  var lista = [];
  for (var i = 0; i < 5; i++) lista.push(rec(0, true, true, true, 10));  // nota bruta 10
  var r = F.proposta({ reclamacoes: lista, reviews: [] }, media, P);
  assert.ok(perto(r.nota, 0.25 * 10 + 0.75 * 6), 'nota foi ' + r.nota);
});

teste('proposta: avaliação com idade = meia-vida pesa metade', function () {
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

console.log('\n' + ok + ' testes passaram.');
