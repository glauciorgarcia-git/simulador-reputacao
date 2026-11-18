# Simulador de nota de reputação

Protótipo que compara a fórmula atual de nota de reputação de empresas com uma fórmula proposta.

**Todos os dados são fictícios.** As 60 empresas, as reclamações e os reviews são gerados no próprio navegador, com semente fixa, então o resultado é sempre o mesmo. Nenhum dado real é buscado ou usado. Qualquer semelhança com nomes reais é coincidência.

A fórmula atual reproduz a descrição pública da nota de uma plataforma de reputação de empresas, aqui chamada de "Plataforma Alfa" (jul/2026).

## O que a proposta muda

1. **O recente vale mais:** cada avaliação perde metade do peso a cada 90 dias (ajustável), olhando 12 meses.
2. **Pouco volume parte da média do segmento:** a nota se aproxima da nota real da empresa conforme o volume cresce. Não existe mais o corte de 10 avaliações.
3. **Reviews entram com cuidado:** só compra verificada, com peso de 20%, ou em uma nota separada de produto.
4. **A nota diz de onde veio:** quantas reclamações, quantos reviews e de que período.
5. **Picos fora do normal ficam em espera:** sem isso, a regra 1 deixaria ataques recentes mais fortes.

## Rodar localmente

Não precisa de build nem de instalar nada. Abra o `index.html` no navegador ou, se preferir, sirva a pasta:

```
python -m http.server 8000
```

e acesse http://localhost:8000.

## Testes

```
node test.js
```

O teste inclui um exemplo da fórmula atual calculado à mão (nota 7,35, faixa Boa).

## Arquivos

- `data.js`: gerador de dados fictícios
- `formulas.js`: fórmula atual e proposta
- `app.js`: tela
- `test.js`: testes

---

Protótipo por Glaucio Garcia.
