import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, FileBarChart, LayoutDashboard, PlayCircle, ShoppingCart, Users, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

const steps = [
  { title: "Bem-vindo ao SISLOTE", description: "Este guia apresenta o caminho recomendado para começar a operar o sistema com segurança.", details: ["Você poderá rever este tutorial a qualquer momento pelo menu.", "Nenhuma informação será criada ou alterada durante o guia."], icon: LayoutDashboard, route: "/", action: "Conhecer o Dashboard" },
  { title: "Configure sua empresa", description: "Revise os dados da empresa, usuários, contas bancárias e parâmetros antes dos primeiros lançamentos.", details: ["Confirme os dados cadastrais.", "Cadastre os usuários e permissões necessárias.", "Revise as configurações financeiras."], icon: Building2, route: "/configuracoes", action: "Abrir Configurações" },
  { title: "Cadastre loteamentos e lotes", description: "A estrutura dos empreendimentos deve estar pronta antes de registrar vendas.", details: ["Cadastre o loteamento.", "Crie as quadras e lotes.", "Confira valores e disponibilidade."], icon: Building2, route: "/loteamentos", action: "Abrir Loteamentos" },
  { title: "Cadastre seus clientes", description: "Mantenha os dados dos compradores completos para contratos, cobranças e relatórios.", details: ["Informe documento e contatos.", "Revise endereço e demais dados.", "Evite cadastros duplicados."], icon: Users, route: "/clientes", action: "Abrir Clientes" },
  { title: "Registre a primeira venda", description: "Vincule cliente e lote, defina entrada, parcelas e vencimentos e revise tudo antes de concluir.", details: ["Escolha um lote disponível.", "Defina as condições de pagamento.", "Confira o resumo da venda."], icon: ShoppingCart, route: "/vendas", action: "Abrir Vendas" },
  { title: "Acompanhe recebimentos", description: "Em Contas a Receber você localiza parcelas por cliente, loteamento, quadra ou lote.", details: ["Use os filtros da Visão geral.", "Informe sempre a conta bancária na baixa.", "Confira o recebimento no extrato."], icon: WalletCards, route: "/pagamentos", action: "Abrir Contas a Receber" },
  { title: "Controle o Financeiro", description: "Cadastre despesas, registre pagamentos e acompanhe o fluxo de caixa e os extratos.", details: ["Cadastre contas e plano de contas.", "Registre despesas e baixas.", "Concilie os saldos periodicamente."], icon: WalletCards, route: "/despesas", action: "Abrir Financeiro" },
  { title: "Analise e acompanhe", description: "Use relatórios e auditoria para conferir resultados e rastrear operações importantes.", details: ["Aplique os filtros do período.", "Exporte os dados quando necessário.", "Consulte a auditoria em caso de dúvida."], icon: FileBarChart, route: "/relatorios", action: "Abrir Relatórios" },
];

interface FirstAccessTutorialProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function FirstAccessTutorial({ open, onOpenChange, onComplete }: FirstAccessTutorialProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const step = steps[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === steps.length - 1;

  useEffect(() => {
    if (open) setCurrentStep(0);
  }, [open]);

  function finish() {
    onComplete();
    onOpenChange(false);
  }

  function goToScreen() {
    finish();
    navigate(step.route);
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? onOpenChange(true) : finish()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-8">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
            <div>
              <DialogTitle>{step.title}</DialogTitle>
              <DialogDescription className="mt-1">Etapa {currentStep + 1} de {steps.length}</DialogDescription>
            </div>
          </div>
          <Progress value={((currentStep + 1) / steps.length) * 100} className="mt-3 h-2" />
        </DialogHeader>
        <div className="space-y-5 py-2">
          <p className="text-base leading-relaxed">{step.description}</p>
          <ul className="space-y-3">
            {step.details.map((detail) => <li key={detail} className="flex items-start gap-2 text-sm text-muted-foreground"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{detail}</span></li>)}
          </ul>
          <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground"><PlayCircle className="h-5 w-5 shrink-0 text-primary" /><span>Os vídeos de treinamento poderão ser vinculados a cada etapa futuramente.</span></div>
        </div>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center">
          <Button variant="ghost" onClick={finish} className="sm:mr-auto">Pular tutorial</Button>
          <Button variant="outline" onClick={goToScreen}>{step.action}</Button>
          {currentStep > 0 ? <Button variant="outline" size="icon" onClick={() => setCurrentStep((value) => value - 1)} aria-label="Etapa anterior"><ArrowLeft className="h-4 w-4" /></Button> : null}
          <Button onClick={() => isLast ? finish() : setCurrentStep((value) => value + 1)}>{isLast ? "Concluir" : "Próximo"}{isLast ? <CheckCircle2 className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
