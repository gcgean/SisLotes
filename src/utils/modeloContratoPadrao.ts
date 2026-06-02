/**
 * Modelo padrão do contrato (A PRAZO) em formato {{placeholder}}.
 * Usado como valor inicial na tela de configurações e como fallback
 * quando a empresa não possui modelo personalizado.
 */
export const MODELO_CONTRATO_PADRAO = `<div class="titulo">CONTRATO DE PROMESSA DE COMPRA E VENDA DE POSSE DE IMÓVEL (A PRAZO)</div>
<div class="subtitulo">{{loteamento.nome}}</div>

<p class="intro">
  Pelo presente instrumento de Escritura de Contrato Particular de Compra e Venda, que livremente
  celebram com as cláusulas de irretratabilidade e irrevogabilidade, partes maiores capazes e na
  livre disposição e administração de seus bens, fica justa e contratada a presente promessa de
  compra e venda de imóvel sob cláusulas e condições seguintes:
</p>

<p class="secao">1. DAS PARTES CONTRATANTES:</p>
<p class="secao">1.1 Promitente Vendedor(a)</p>
<p>
  <b>Nome:</b> {{loteamento.prop_nome}}<br/>
  <b>Telefone:</b> {{loteamento.prop_fone}}
</p>

<p class="secao">1.2 Promissário(a) Comprador(a)</p>
<p>
  <b>Nome:</b> {{cliente.nome}}<br/>
  <b>Endereço:</b> {{cliente.endereco}} - {{cliente.bairro}}<br/>
  <b>Cidade:</b> {{cliente.cidade}}/{{cliente.estado}}&nbsp;&nbsp;
  <b>CEP:</b> {{cliente.cep}}<br/>
  <b>Telefone:</b> {{cliente.fone}}&nbsp;&nbsp;&nbsp;
  <b>CPF:</b> {{cliente.cpf}}&nbsp;&nbsp;
  <b>RG:</b> {{cliente.rg}}<br/>
  <b>Profissão:</b> {{cliente.profissao}}&nbsp;&nbsp;&nbsp;
  <b>Est. Civil:</b> {{cliente.estado_civil}}
</p>

<p class="secao">2. DO OBJETIVO DO CONTRATO</p>
<p>
  O imóvel objeto deste contrato está situado no loteamento <b>{{loteamento.nome}}</b>,
  com as seguintes características:
</p>
<table style="width:100%;border-collapse:collapse;margin:8px 0 12px 0;font-size:11pt;">
  <tr>
    <td style="border:1px solid #000;padding:5px 8px;width:50%;"><b>Loteamento:</b> {{loteamento.nome}}</td>
    <td style="border:1px solid #000;padding:5px 8px;width:25%;"><b>Lote nº:</b> {{lote.numero}}</td>
    <td style="border:1px solid #000;padding:5px 8px;width:25%;"><b>Quadra:</b> {{lote.quadra}}</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Área:</b> {{lote.area}} m²</td>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Frente:</b> {{lote.frente}} m</td>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Fundo:</b> {{lote.fundo}} m</td>
  </tr>
  <tr>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Cidade/Estado:</b> {{loteamento.cidade}}/{{loteamento.estado}}</td>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Lado Direito:</b> {{lote.direito}} m</td>
    <td style="border:1px solid #000;padding:5px 8px;"><b>Lado Esquerdo:</b> {{lote.esquerdo}} m</td>
  </tr>
</table>

<p class="secao">3. DO PREÇO, DA FORMA E CONDIÇÕES DE PAGAMENTO</p>
<p>
  3.1 O Promissário(a) Comprador(a) acima nomeado(a) se compromete a comprar e a pagar
  o imóvel acima descrito pelo preço certo, justo e exigível disposto da seguinte forma:
</p>

<p>
  Entrada: {{venda.valor_entrada}} e mais {{venda.parcelas}} prestações mensais e sucessivas
  de {{venda.valor_parcela}} pagáveis em moeda corrente e legal no País.<br/>
  Em concordância do vendedor com o comprador, haverá um reajuste anual pelo IGPM.<br/>
  Fica pactuado que:
</p>

<p>
  3.2 As prestações já referidas em número de <b>{{venda.parcelas}}</b> serão representadas
  por Carnês e Boletos Bancários com vencimentos mensais e sucessivos a partir de
  <b>{{venda.primeiro_vencimento}}</b> e que passarão a fazer
  parte integrante do presente instrumento.
</p>
<p>3.3 Os boletos serão entregues pelo(a) Promitente Vendedor(a) no endereço do comprador ou pelo correio.</p>
<p>3.4 O local para o pagamento das prestações será <b>{{venda.local_pagamento}}</b></p>
<p>
  Após 90 dias de atraso ligar para
  <b>{{venda.telefone_contato}}</b>
</p>
<p>
  3.5 Sobre as prestações em atraso indicarão juros convencionais diários praticados no mercado
  na data do pagamento, acrescidas de multa moratória de 2% (dois por cento)
</p>
<p>
  3.6 O atraso de três prestações acarretará no cancelamento do contrato e consequente perda,
  em favor do(a) Promitente Vendedor(a), da posse do imóvel, objeto deste contrato, com as
  benfeitorias acaso feitas, bem como as importâncias pagas sem nenhuma indenização,
  independentemente de qualquer notificação, ação ou interpelação judicial ou extra-judicial.
</p>
<p>
  3.7 O comprador declara ter ciência expressa e desde já autoriza o registro de seu nome em
  cadastro de inadimplentes, a exemplo do SPC e SERASA, na hipótese de inadimplência das
  parcelas contratadas.
</p>

<p class="secao">4. DISPOSIÇÕES COMPLEMENTARES</p>
<p>
  4.1 O(a) Promissário Comprador(a) fica desde já, imitido na posse, uso e gozo do imóvel
  objeto deste contrato devendo, a partir desta data, pagar IPTU, zelar, cercar, proteger e
  defender sua posse e o imóvel. Podendo nele realizar benfeitorias, não podendo, porém onerá-lo
  (penhorá-lo ou hipotecá-lo) de qualquer modo, direta ou indiretamente, antes de efetuar o
  pagamento da última prestação.
</p>
<p>
  4.2 O Promitente Vendedor(a) não se responsabiliza por invasões no lote, nem irá indenizar
  quaisquer construções ou benefícios no terreno se o mesmo não for quitado.
</p>
<p>
  4.3 Fica na obrigação exclusiva do Promissário(a) Comprador(a), todos os atos e despesas de
  registros deste instrumento e escritura definitiva, inclusive impostos e taxas incidentes
  sobre o imóvel objeto deste contrato, a partir desta data.
</p>
<p>
  4.4 As partes contratantes, no ato de suas assinaturas no presente instrumento, declaram
  conhecer o imóvel objeto deste contrato, e aceitá-lo tal como é, obrigando-se por si, seus
  herdeiros e sucessores, ao cumprimento das cláusulas e condições existentes neste instrumento.
</p>

<p class="secao">5. DISPOSIÇÕES FINAIS</p>
<p>
  E por estarem justos e contratados, as partes contratantes assinam o presente instrumento
  em duas vias de igual forma e teor, em presença de duas testemunhas, para os mesmos fins
  de direito.
</p>
<p>{{loteamento.cidade}}, {{venda.data}}</p>

<div class="bloco-assinaturas">
  <div class="linha-assinatura">
    <div class="assinatura">
      <div class="espaco-assinar"></div>
      <div class="linha"></div>
      <p class="label-ass">Promitente Vendedor(a)</p>
      <p class="nome-ass">{{loteamento.prop_nome}}</p>
    </div>
    <div class="assinatura">
      <div class="espaco-assinar"></div>
      <div class="linha"></div>
      <p class="label-ass">Promissário(a) Comprador(a)</p>
      <p class="nome-ass">{{cliente.nome}}</p>
    </div>
  </div>

  <div class="bloco-testemunhas">
    <p class="titulo-test">TESTEMUNHAS</p>
    <div class="linha-assinatura">
      <div class="assinatura">
        <div class="espaco-assinar"></div>
        <div class="linha"></div>
        <p class="label-ass">1ª Testemunha</p>
        <p class="nome-ass">Nome: _______________________________</p>
        <p class="nome-ass">CPF: ________________________________</p>
      </div>
      <div class="assinatura">
        <div class="espaco-assinar"></div>
        <div class="linha"></div>
        <p class="label-ass">2ª Testemunha</p>
        <p class="nome-ass">Nome: _______________________________</p>
        <p class="nome-ass">CPF: ________________________________</p>
      </div>
    </div>
  </div>
</div>`;
