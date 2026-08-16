export interface ScreenTutorial {
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
  videoUrl?: string;
}

const financeiro: Record<string, ScreenTutorial> = {
  "visao-geral": {
    title: "Fluxo de Caixa",
    summary: "Acompanhe saldos, entradas, saídas e a projeção financeira da empresa.",
    steps: ["Escolha o mês que deseja analisar.", "Confira os totais e alertas do período.", "Compare o fluxo realizado com o projetado."],
    tips: ["Os valores realizados consideram movimentações confirmadas; os projetados consideram compromissos em aberto."],
  },
  despesas: {
    title: "Contas a Pagar",
    summary: "Cadastre despesas, acompanhe parcelas e registre pagamentos.",
    steps: ["Use os filtros para localizar uma conta.", "Clique em Nova Conta a Pagar para cadastrar uma despesa.", "Abra a conta para pagar, editar, imprimir ou consultar as parcelas."],
    tips: ["Confira conta bancária, encargos e retenções antes de confirmar uma baixa."],
  },
  lancamentos: {
    title: "Extrato e Lançamentos",
    summary: "Consulte a movimentação das contas e registre lançamentos ou transferências.",
    steps: ["Defina período e conta bancária.", "Use Novo Lançamento para entradas ou saídas manuais.", "Use Transferir para movimentar valores entre contas sem afetar o resultado."],
    tips: ["Movimentos originados de pagamentos e recebimentos devem ser alterados pelo fluxo que os gerou."],
  },
  contas: {
    title: "Contas Bancárias",
    summary: "Gerencie bancos, caixas e demais locais onde o dinheiro é movimentado.",
    steps: ["Cadastre a conta e informe o saldo inicial.", "Use o extrato para conferir as movimentações.", "Inative contas que não devem mais receber lançamentos."],
  },
  categorias: {
    title: "Plano de Contas",
    summary: "Organize receitas e despesas em uma estrutura contábil hierárquica.",
    steps: ["Crie uma conta raiz ou uma subconta.", "Separe corretamente receitas e despesas.", "Use apenas contas analíticas nos lançamentos."],
  },
  fornecedores: {
    title: "Fornecedores",
    summary: "Mantenha os dados das pessoas e empresas relacionadas às despesas.",
    steps: ["Cadastre nome e dados de contato.", "Edite informações quando necessário.", "Inative registros que não devem mais ser usados."],
  },
  conciliacao: {
    title: "Conciliação Bancária",
    summary: "Compare o extrato bancário importado com as movimentações do SISLOTE.",
    steps: ["Selecione a conta bancária.", "Importe o arquivo OFX.", "Confirme as sugestões ou trate as divergências manualmente."],
  },
  cobrancas: {
    title: "Boletos e PIX",
    summary: "Prepare cobranças bancárias vinculadas às parcelas a receber.",
    steps: ["Crie um rascunho de cobrança.", "Revise valor, vencimento e conta.", "A emissão será habilitada quando o provedor bancário estiver integrado."],
  },
  "regua-cobranca": {
    title: "Régua de Cobrança",
    summary: "Configure lembretes relacionados ao vencimento das parcelas.",
    steps: ["Crie uma regra e escolha o canal.", "Defina quantos dias antes ou depois do vencimento ela será aplicada.", "Confira a prévia de clientes alcançados."],
    tips: ["O envio externo permanece desativado até a integração do canal."],
  },
  "orcado-realizado": {
    title: "Orçado × Realizado",
    summary: "Compare o orçamento mensal com o resultado efetivamente movimentado.",
    steps: ["Escolha ano e loteamento.", "Cadastre o orçamento por conta e mês.", "Analise diferenças entre os valores planejados e realizados."],
  },
  fechamento: {
    title: "Fechamento de Período",
    summary: "Proteja períodos já conferidos contra alterações financeiras retroativas.",
    steps: ["Confirme que todos os movimentos do período foram conciliados.", "Informe a data limite do fechamento.", "Revise o aviso e confirme a operação."],
    tips: ["O fechamento bloqueia lançamentos, baixas, edições, exclusões e estornos na data informada e nas anteriores."],
  },
};

const pages: Record<string, ScreenTutorial> = {
  "/": { title: "Dashboard", summary: "Visualize os principais indicadores da operação.", steps: ["Confira os indicadores gerais.", "Use os atalhos e gráficos para identificar pontos de atenção.", "Acesse o módulo correspondente para ver os detalhes."] },
  "/clientes": { title: "Clientes", summary: "Cadastre compradores e mantenha seus dados atualizados.", steps: ["Pesquise um cliente existente.", "Use Novo Cliente para cadastrar.", "Abra o registro para consultar ou editar os dados."] },
  "/loteamentos": { title: "Loteamentos", summary: "Gerencie empreendimentos, quadras e informações gerais.", steps: ["Selecione ou cadastre um loteamento.", "Confira mapa, indicadores e dados financeiros.", "Edite o empreendimento quando necessário."] },
  "/lotes": { title: "Lotes", summary: "Consulte disponibilidade, situação e valores dos lotes.", steps: ["Escolha o loteamento.", "Filtre por quadra ou situação.", "Abra um lote para consultar detalhes ou iniciar uma venda."] },
  "/vendas": { title: "Vendas", summary: "Registre vendas e acompanhe contratos, comissões e acordos.", steps: ["Clique em Nova Venda e selecione cliente e lote.", "Defina entrada, parcelas e vencimentos.", "Revise todos os dados antes de concluir."], tips: ["Distratos e renegociações alteram compromissos financeiros; revise os avisos antes de confirmar."] },
  "/pagamentos": { title: "Contas a Receber", summary: "Acompanhe parcelas de vendas e registre recebimentos.", steps: ["Use os filtros para localizar parcelas.", "Selecione o recebimento desejado.", "Informe a conta bancária e confirme o valor recebido."] },
  "/relatorios": { title: "Relatórios", summary: "Consulte e exporte informações gerenciais do SISLOTE.", steps: ["Escolha o relatório.", "Preencha os filtros e clique em Buscar.", "Confira os totais antes de imprimir ou exportar."] },
  "/planos": { title: "Planos", summary: "Consulte sua licença e as opções de assinatura.", steps: ["Confira o plano e a validade atuais.", "Compare os recursos disponíveis.", "Escolha a opção adequada para contratar ou renovar."] },
  "/sugestoes": { title: "Sugestões", summary: "Envie ideias e acompanhe melhorias do sistema.", steps: ["Descreva claramente sua sugestão.", "Inclua o resultado esperado.", "Acompanhe o status e as respostas da equipe."] },
  "/configuracoes": { title: "Configurações", summary: "Ajuste dados da empresa, usuários e parâmetros do sistema.", steps: ["Escolha a seção desejada.", "Revise os valores atuais.", "Salve apenas depois de conferir o impacto da alteração."] },
  "/auditoria": { title: "Auditoria", summary: "Consulte o histórico de operações e alterações realizadas.", steps: ["Defina período, usuário ou tipo de registro.", "Localize a operação desejada.", "Abra os detalhes para comparar os dados anteriores e posteriores."] },
  "/admin": { title: "Administração", summary: "Gerencie recursos administrativos da plataforma.", steps: ["Escolha a área administrativa.", "Use os filtros para localizar registros.", "Revise cuidadosamente qualquer alteração global."] },
};

const fallback: ScreenTutorial = {
  title: "Ajuda desta tela",
  summary: "Consulte as orientações básicas para utilizar esta área do SISLOTE.",
  steps: ["Confira os filtros e informações disponíveis.", "Use as ações da tela para consultar ou registrar dados.", "Revise os dados antes de salvar alterações."],
};

export function getScreenTutorial(pathname: string, search: string): ScreenTutorial {
  if (pathname === "/despesas") {
    const tab = new URLSearchParams(search).get("tab") || "visao-geral";
    return financeiro[tab] || financeiro["visao-geral"];
  }
  return pages[pathname] || fallback;
}
