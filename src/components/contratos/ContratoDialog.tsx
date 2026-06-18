import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { FileText, Printer, ChevronDown } from "lucide-react";
import { MODELO_CONTRATO_PADRAO } from "@/utils/modeloContratoPadrao";
import { formatDateBR } from "@/lib/date-br";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface VendaResumo {
  id_venda: number;
  status: string;
  data_venda: string;
  parcelas: number;
  valor_entrada: string | number;
  lote_desc: string;
  loteamento: string;
}

interface ContratoData {
  venda: {
    id_venda: number;
    data_venda: string;
    valor_entrada: number;
    parcelas: number;
    porcentagem: number;
    status: string;
    valor_total: number;
    valor_parcela: number;
    primeiro_vencimento: string | null;
  };
  cliente: {
    nome: string; tipo: string; cpf: string | null; cnpj: string | null;
    rg: string | null; estado_civil: string | null; conjuge: string | null;
    profissao: string | null; endereco: string | null; bairro: string | null;
    cidade: string | null; estado: string | null; cep: string | null;
    fone_res: string | null; fone_com: string | null;
  } | null;
  lote: {
    lote: string; quadra: string; area: string | null;
    frente: string | null; fundo: string | null;
    esquerdo: string | null; direito: string | null;
  } | null;
  loteamento: {
    nome: string; cidade: string | null; estado: string | null;
    prop_nome: string | null; prop_endereco: string | null;
    prop_bairro: string | null; prop_cidade: string | null;
    prop_estado: string | null; prop_cep: string | null;
    prop_fone: string | null; cnpj: string | null;
  } | null;
  empresa: {
    nome_fantasia: string; razao_social: string | null; cnpj: string | null;
    ie: string | null; endereco: string | null; bairro: string | null;
    cidade: string | null; estado: string | null; cep: string | null;
    telefone: string | null; email: string | null; site: string | null;
    logo: string | null;
    modelo_contrato?: string | null;
  } | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  idCliente: number;
  nomeCliente: string;
  idVenda?: number; // opcional: pula a tela de seleção e vai direto ao formulário
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = window.localStorage.getItem("token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function formatMoeda(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(d: string) {
  return formatDateBR(d, "");
}

function porExtenso(n: number): string {
  const unidades = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
    "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const dezenas = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  if (n === 0) return "zero";
  if (n < 20) return unidades[n];
  if (n < 100) return dezenas[Math.floor(n / 10)] + (n % 10 ? " e " + unidades[n % 10] : "");
  if (n < 1000) return unidades[Math.floor(n / 100)] + " centos" + (n % 100 ? " e " + porExtenso(n % 100) : "");
  return String(n);
}

// ─── Helper: cabeçalho com timbrado da empresa ────────────────────────────────

type EmpresaHeader = {
  nome_fantasia: string; razao_social?: string | null; cnpj?: string | null;
  endereco?: string | null; bairro?: string | null; cidade?: string | null;
  estado?: string | null; telefone?: string | null; email?: string | null;
  logo?: string | null;
} | null | undefined;

function buildTimbrado(empresa: EmpresaHeader, semTimbrado: boolean): string {
  if (semTimbrado) return "";

  const logoHtml = empresa?.logo
    ? `<img src="${empresa.logo}" alt="Logo" style="max-height:70px;max-width:160px;object-fit:contain;" />`
    : `<div style="width:160px;height:70px;background:#eee;border:1px solid #ccc;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;">LOGOMARCA</div>`;

  const endereco = [
    empresa?.endereco,
    empresa?.bairro ? `BAIRRO ${empresa.bairro.toUpperCase()}` : null,
  ].filter(Boolean).join(" - ");

  const cidadeTel = [
    empresa?.cidade && empresa?.estado ? `${empresa.cidade.toUpperCase()}-${empresa.estado.toUpperCase()}` : (empresa?.cidade ?? ""),
    empresa?.telefone ? `TEL.: ${empresa.telefone}` : null,
  ].filter(Boolean).join(" - ");

  return `
  <div style="display:flex;align-items:center;gap:20px;margin-bottom:30px;padding-bottom:12px;border-bottom:2px solid #000;">
    ${logoHtml}
    <div style="flex:1;text-align:center;font-size:9.5pt;line-height:1.6;">
      <div style="font-size:13pt;font-weight:bold;">${empresa?.nome_fantasia ?? "IMOBILIÁRIA"}</div>
      ${endereco ? `<div>${endereco}</div>` : ""}
      ${cidadeTel ? `<div>${cidadeTel}</div>` : ""}
      ${empresa?.cnpj ? `<div>CNPJ: ${empresa.cnpj}</div>` : ""}
      ${empresa?.email ? `<div>${empresa.email}</div>` : ""}
    </div>
  </div>`;
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function ContratoDialog({ open, onClose, idCliente, nomeCliente, idVenda }: Props) {
  const [etapa, setEtapa] = useState<"selecionar" | "formulario">("selecionar");
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaResumo | null>(null);
  const [tipoContrato, setTipoContrato] = useState<"a-prazo" | "a-vista">("a-prazo");
  const [imprimirProcurador, setImprimirProcurador] = useState(false);
  const [procuradorTexto, setProcuradorTexto] = useState("");
  const [clausulasExtra, setClausulasExtra] = useState(
    "Em concordância do vendedor com o comprador, haverá um reajuste anual pelo IGPM.\nFica pactuado que:"
  );
  const [numParcelas, setNumParcelas] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [localPagamento, setLocalPagamento] = useState("");
  const [telefoneContato, setTelefoneContato] = useState("");
  const [areaLote, setAreaLote] = useState("");

  // ── Busca as vendas do cliente
  const { data: vendas = [], isLoading: loadingVendas } = useQuery<VendaResumo[]>({
    queryKey: ["contratos-vendas", idCliente],
    enabled: open,
    queryFn: async () => {
      const r = await fetch(`/api/contratos/cliente/${idCliente}/vendas`, {
        headers: { ...getAuthHeaders() },
      });
      if (!r.ok) throw new Error("Erro ao buscar vendas");
      return r.json();
    },
  });

  // ── Busca os dados completos da venda selecionada
  const { data: contratoData, isLoading: loadingContrato } = useQuery<ContratoData>({
    queryKey: ["contrato-data", vendaSelecionada?.id_venda],
    enabled: !!vendaSelecionada && etapa === "formulario",
    queryFn: async () => {
      const r = await fetch(`/api/contratos/venda/${vendaSelecionada!.id_venda}`, {
        headers: { ...getAuthHeaders() },
      });
      if (!r.ok) throw new Error("Erro ao carregar dados do contrato");
      const data: ContratoData = await r.json();
      // Pré-preenche campos editáveis
      setNumParcelas(String(data.venda.parcelas));
      setAreaLote(data.lote?.area ?? "");
      setTelefoneContato(data.empresa?.telefone ?? "");
      if (data.venda.primeiro_vencimento) setDataInicio(data.venda.primeiro_vencimento);
      return data;
    },
  });

  const [acaoAutomatica, setAcaoAutomatica] = useState<
    null | "recibo" | "recibo-sem-timbrado" | "minuta" | "minuta-sem-timbrado" | "termo-transferencia" | "termo-sem-timbrado" | "contrato-sem-timbrado"
  >(null);

  function handleSelecionarVenda(venda: VendaResumo) {
    setVendaSelecionada(venda);
    setEtapa("formulario");
  }

  useEffect(() => {
    const handleAbrirRecibo = () => setAcaoAutomatica("recibo");
    const handleAbrirReciboSemTimbrado = () => setAcaoAutomatica("recibo-sem-timbrado");
    const handleAbrirMinuta = () => setAcaoAutomatica("minuta");
    const handleAbrirMinutaSemTimbrado = () => setAcaoAutomatica("minuta-sem-timbrado");
    const handleAbrirTermoTransferencia = () => setAcaoAutomatica("termo-transferencia");
    const handleAbrirTermoSemTimbrado = () => setAcaoAutomatica("termo-sem-timbrado");
    const handleAbrirContratoSemTimbrado = () => setAcaoAutomatica("contrato-sem-timbrado");

    window.addEventListener("abrir-recibo-quitacao", handleAbrirRecibo);
    window.addEventListener("abrir-recibo-sem-timbrado", handleAbrirReciboSemTimbrado);
    window.addEventListener("abrir-minuta", handleAbrirMinuta);
    window.addEventListener("abrir-minuta-sem-timbrado", handleAbrirMinutaSemTimbrado);
    window.addEventListener("abrir-termo-transferencia", handleAbrirTermoTransferencia);
    window.addEventListener("abrir-termo-sem-timbrado", handleAbrirTermoSemTimbrado);
    window.addEventListener("abrir-contrato-sem-timbrado", handleAbrirContratoSemTimbrado);

    return () => {
      window.removeEventListener("abrir-recibo-quitacao", handleAbrirRecibo);
      window.removeEventListener("abrir-recibo-sem-timbrado", handleAbrirReciboSemTimbrado);
      window.removeEventListener("abrir-minuta", handleAbrirMinuta);
      window.removeEventListener("abrir-minuta-sem-timbrado", handleAbrirMinutaSemTimbrado);
      window.removeEventListener("abrir-termo-transferencia", handleAbrirTermoTransferencia);
      window.removeEventListener("abrir-termo-sem-timbrado", handleAbrirTermoSemTimbrado);
      window.removeEventListener("abrir-contrato-sem-timbrado", handleAbrirContratoSemTimbrado);
    };
  }, []);

  useEffect(() => {
    if (!acaoAutomatica) return;
    if (!vendas || vendas.length === 0) return;
    setVendaSelecionada(vendas[0]);
    setEtapa("formulario");
  }, [acaoAutomatica, vendas]);

  // Pré-seleciona a venda automaticamente quando idVenda é fornecido
  useEffect(() => {
    if (!idVenda || !vendas || vendas.length === 0) return;
    const vendaEncontrada = vendas.find((v) => v.id_venda === idVenda);
    if (vendaEncontrada) {
      setVendaSelecionada(vendaEncontrada);
      setEtapa("formulario");
    }
  }, [idVenda, vendas]);

  function handleVoltar() {
    setEtapa("selecionar");
    setVendaSelecionada(null);
  }

  function handleClose() {
    setEtapa("selecionar");
    setVendaSelecionada(null);
    onClose();
  }

  function gerarReciboQuitacao(semTimbrado = false) {
    if (!contratoData) return;
    const { venda, cliente, lote, loteamento, empresa } = contratoData;

    const titulo = "RECIBO DE QUITAÇÃO";
    const vendedor = loteamento?.prop_nome ?? empresa?.nome_fantasia ?? "—";
    
    // Obter mês por extenso
    const dataAtual = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const mesExtenso = meses[dataAtual.getMonth()];
    const dataFormatada = `${dataAtual.getDate()} de ${mesExtenso} de ${dataAtual.getFullYear()}`;
    const cidadeContrato = loteamento?.cidade ?? empresa?.cidade ?? "Fortaleza";

    const clienteNome = cliente?.nome ?? "—";
    const clienteCpf = cliente?.cpf ?? cliente?.cnpj ?? "—";
    const clienteRg = cliente?.rg ?? "—";
    const clienteEnd = cliente?.endereco ? `a ${cliente.endereco}` : "—";
    const clienteBairro = cliente?.bairro ? ` - bairro ${cliente.bairro}` : "";
    const clienteCidade = cliente?.cidade ?? "—";
    const clienteEstado = cliente?.estado ?? "—";
    const clienteEstadoCivil = cliente?.estado_civil ?? "—";

    const loteNum = lote?.lote ?? "—";
    const quadraNum = lote?.quadra ?? "—";
    const loteamentoNome = loteamento?.nome ?? "—";
    const loteamentoCidade = loteamento?.cidade ?? "—";
    const loteamentoEstado = loteamento?.estado ?? "—";
    
    const area = areaLote || lote?.area || "—";
    const frente = lote?.frente ?? "—";
    const fundo = lote?.fundo ?? "—";
    const direito = lote?.direito ?? "—";
    const esquerdo = lote?.esquerdo ?? "—";

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      color: #000;
      background: #fff;
      padding: 20mm 25mm;
      line-height: 1.5;
    }
    .titulo {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      font-size: 14pt;
      margin-bottom: 30px;
    }
    p { margin-bottom: 15px; text-align: justify; text-indent: 50px; }
    .imovel-box {
      border: 1.5px solid #000;
      border-radius: 4px;
      padding: 12px 16px;
      margin: 18px 0 20px 0;
    }
    .imovel-box .box-titulo {
      font-weight: bold;
      font-size: 10pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 6px;
      margin-bottom: 10px;
      text-indent: 0;
    }
    .imovel-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 20px;
      font-size: 11pt;
    }
    .imovel-campo {
      display: flex;
      flex-direction: column;
    }
    .imovel-label {
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #555;
      letter-spacing: 0.3px;
    }
    .imovel-valor {
      font-size: 11pt;
      font-weight: bold;
      border-bottom: 1px solid #aaa;
      padding-bottom: 2px;
    }
    .imovel-grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr;
      gap: 6px 12px;
      margin-top: 8px;
    }
    .data-local {
      margin-top: 40px;
      margin-bottom: 60px;
      text-indent: 0;
    }
    .assinatura {
      text-align: center;
      margin-top: 80px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .assinatura .linha {
      border-top: 1px solid #000;
      width: 400px;
      margin: 0 auto 5px auto;
    }
    .assinatura .nome-ass {
      font-size: 11pt;
      text-align: center;
    }
    @media print {
      @page { margin: 0; }
      body { padding: 15mm 20mm; }
      .btn-print { display: none; }
    }
    .btn-print {
      display: block;
      margin: 20px auto;
      padding: 5px 15px;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="conteudo" contenteditable="true">
    ${buildTimbrado(empresa, semTimbrado)}

    <div class="titulo">${titulo}</div>

    <p>
      Declaro, para os devidos fins, que o(a) Sr(a) <b>${clienteNome}</b>, brasileiro(a), ${clienteEstadoCivil}, inscrito(a) no CPF nº ${clienteCpf} e Cédula de Identidade nº ${clienteRg}, residente e domiciliado(a) ${clienteEnd}${clienteBairro}, em ${clienteCidade}/${clienteEstado}, <b>CONCLUIU</b> o pagamento integral do imóvel abaixo identificado:
    </p>

    <div class="imovel-box">
      <div class="box-titulo">Identificação do Imóvel</div>
      <div class="imovel-grid">
        <div class="imovel-campo">
          <span class="imovel-label">Loteamento</span>
          <span class="imovel-valor">${loteamentoNome}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Cidade / Estado</span>
          <span class="imovel-valor">${loteamentoCidade} / ${loteamentoEstado}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Lote nº</span>
          <span class="imovel-valor">${loteNum}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Quadra</span>
          <span class="imovel-valor">${quadraNum}</span>
        </div>
      </div>
      <div class="imovel-grid-4">
        <div class="imovel-campo">
          <span class="imovel-label">Área (m²)</span>
          <span class="imovel-valor">${area}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Frente (m)</span>
          <span class="imovel-valor">${frente}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Fundo (m)</span>
          <span class="imovel-valor">${fundo}</span>
        </div>
        <div class="imovel-campo">
          <span class="imovel-label">Lado Direito (m)</span>
          <span class="imovel-valor">${direito}</span>
        </div>
        <div class="imovel-campo" style="grid-column: span 1;">
          <span class="imovel-label">Lado Esquerdo (m)</span>
          <span class="imovel-valor">${esquerdo}</span>
        </div>
      </div>
    </div>

    <p>
      Declaro ainda que dou plena e geral <b>QUITAÇÃO</b> e desde já cedo e transfiro a posse REAL, domínio e direito sobre o citado imóvel, para que possa o outorgado dele usar, gozar e dispor livremente como seu, obrigando-se o outorgante por si e seus herdeiros e sucessores a fazerem a presente firme, boa e valiosa.
    </p>

    <p>
      E pela <b>OUTORGADA</b> compradora me foi dito que aceita a presente declaração em seus expressos termos, por se achar de pleno acordo com o ajustado e contratado.
    </p>

    <div class="data-local">
      ${cidadeContrato}, ${dataFormatada}
    </div>

    <div class="assinatura">
      <div class="linha"></div>
      <p class="nome-ass">${vendedor}</p>
    </div>
  </div>
  <button class="btn-print" onclick="this.style.display='none'; window.print();">Gerar Recibo de Quitação</button>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({ title: "Bloqueado pelo navegador", description: "Permita popups para imprimir.", variant: "destructive" });
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  useEffect(() => {
    if (!acaoAutomatica) return;
    if (!contratoData || loadingContrato) return;

    if (acaoAutomatica === "recibo") {
      gerarReciboQuitacao(false);
    } else if (acaoAutomatica === "recibo-sem-timbrado") {
      gerarReciboQuitacao(true);
    } else if (acaoAutomatica === "minuta") {
      gerarMinuta(false);
    } else if (acaoAutomatica === "minuta-sem-timbrado") {
      gerarMinuta(true);
    } else if (acaoAutomatica === "termo-transferencia") {
      gerarTermoTransferencia(false);
    } else if (acaoAutomatica === "termo-sem-timbrado") {
      gerarTermoTransferencia(true);
    } else if (acaoAutomatica === "contrato-sem-timbrado") {
      gerarContrato(true);
    }

    setAcaoAutomatica(null);
  }, [acaoAutomatica, contratoData, loadingContrato]);

  function gerarMinuta(semTimbrado = false) {
    if (!contratoData) return;
    const { venda, cliente, lote, loteamento, empresa } = contratoData;

    const vendedor = loteamento?.prop_nome ?? empresa?.nome_fantasia ?? "—";
    
    const dataAtual = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const mesExtenso = meses[dataAtual.getMonth()];
    const dataFormatada = `${dataAtual.getDate()} de ${mesExtenso} de ${dataAtual.getFullYear()}`;
    const cidadeContrato = loteamento?.cidade ?? empresa?.cidade ?? "Fortaleza";

    const clienteNome = cliente?.nome ?? "—";
    const clienteCpf = cliente?.cpf ?? cliente?.cnpj ?? "—";
    const clienteRg = cliente?.rg ?? "—";
    const clienteEnd = cliente?.endereco ? `a ${cliente.endereco}` : "—";
    const clienteBairro = cliente?.bairro ? ` - bairro ${cliente.bairro}` : "";
    const clienteCidade = cliente?.cidade ?? "—";
    const clienteEstado = cliente?.estado ?? "—";
    const clienteEstadoCivil = cliente?.estado_civil ?? "—";

    const loteNum = lote?.lote ?? "—";
    const quadraNum = lote?.quadra ?? "—";
    const loteamentoNome = loteamento?.nome ?? "—";
    const area = areaLote || lote?.area || "—";
    const frente = lote?.frente ?? "—";
    const fundo = lote?.fundo ?? "—";
    const direito = lote?.direito ?? "—";
    const esquerdo = lote?.esquerdo ?? "—";
    
    const valorExtenso = porExtenso(Math.floor(venda.valor_total)) + " reais";

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>MINUTA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      padding: 15mm 20mm;
      line-height: 1.4;
    }
    .titulo-caixa {
      border: 1px solid #000;
      width: 200px;
      margin: 0 auto 30px auto;
      text-align: center;
      padding: 4px;
      font-weight: bold;
      text-decoration: none;
      font-size: 11pt;
    }
    .caixa-texto {
      border: 1px solid #000;
      padding: 15px;
      margin-bottom: 10px;
      text-align: justify;
      text-indent: 0;
    }
    .caixa-texto.segundo {
      text-indent: 0;
    }
    .data-local {
      margin-bottom: 50px;
      margin-top: 0;
    }
    .testemunhas-titulo {
      margin-bottom: 20px;
    }
    .assinaturas-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 20px;
    }
    .assinatura {
      display: flex;
      flex-direction: column;
      margin-bottom: 40px;
    }
    .assinatura .linha {
      border-top: 1px solid #000;
      width: 100%;
      margin-bottom: 5px;
    }
    .assinatura .nome {
      font-size: 10pt;
    }
    @media print {
      @page { margin: 0; }
      body { padding: 15mm 20mm; }
      .btn-print { display: none; }
    }
    .btn-print {
      display: block;
      margin: 30px auto;
      padding: 6px 20px;
      cursor: pointer;
    }
    .lote-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 12px 0;
      font-size: 10.5pt;
    }
    .lote-table td {
      border: 1px solid #000;
      padding: 5px 8px;
    }
    .lote-label {
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #444;
      display: block;
      margin-bottom: 2px;
    }
    .lote-val {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="conteudo" contenteditable="true">
    ${buildTimbrado(empresa, semTimbrado)}

    <div class="titulo-caixa">MINUTA</div>
 
    <div class="caixa-texto">
      Pela presente Minuta, como VENDEDOR <b>${vendedor}</b>, brasileiro(a), inscrito no CNPJ/CPF sob nº ${loteamento?.cnpj ?? empresa?.cnpj ?? "—"},
      ${imprimirProcurador && procuradorTexto ? ` representado por seu procurador(a) ${procuradorTexto}, ` : ""}
      DECLARA, para os devidos fins de direito que vendeu um terreno de sua propriedade, localizado em ${loteamento?.cidade ?? "—"}/${loteamento?.estado ?? "—"}, para o COMPRADOR <b>${clienteNome}</b> portador do CPF nº ${clienteCpf} e RG nº ${clienteRg}, residente e domiciliado ${clienteEnd}${clienteBairro}, na cidade de ${clienteCidade}/${clienteEstado}.
    </div>
 
    <div class="caixa-texto segundo">
      O referido terreno está localizado no loteamento <b>${loteamentoNome}</b>, conforme descrição abaixo:

      <table class="lote-table">
        <tr>
          <td style="width:50%"><span class="lote-label">Loteamento</span><span class="lote-val">${loteamentoNome}</span></td>
          <td style="width:25%"><span class="lote-label">Lote nº</span><span class="lote-val">${loteNum}</span></td>
          <td style="width:25%"><span class="lote-label">Quadra</span><span class="lote-val">${quadraNum}</span></td>
        </tr>
        <tr>
          <td><span class="lote-label">Cidade / Estado</span><span class="lote-val">${loteamento?.cidade ?? "—"} / ${loteamento?.estado ?? "—"}</span></td>
          <td><span class="lote-label">Área (m²)</span><span class="lote-val">${area}</span></td>
          <td><span class="lote-label">Frente (m)</span><span class="lote-val">${frente}</span></td>
        </tr>
        <tr>
          <td><span class="lote-label">Fundo (m)</span><span class="lote-val">${fundo}</span></td>
          <td><span class="lote-label">Lado Direito (m)</span><span class="lote-val">${direito}</span></td>
          <td><span class="lote-label">Lado Esquerdo (m)</span><span class="lote-val">${esquerdo}</span></td>
        </tr>
      </table>

      O Comprador pagou ao Vendedor o valor total de <b>R$ ${venda.valor_total.toFixed(2)}</b> (${valorExtenso}).<br><br>
      Para registrar no Cartório Ofício Privativo de Registro de Imóveis, ${loteamento?.cidade ?? "—"}-${loteamento?.estado ?? "—"}. Por força deste termo, O VENDEDOR dá toda posse e quitação do imóvel acima citado para o COMPRADOR, ficando o vendedor isento de qualquer taxa de impostos junto à Prefeitura Municipal de ${loteamento?.cidade ?? "—"}-${loteamento?.estado ?? "—"}, assim como toda e qualquer ônus fiscal.
    </div>
 
    <div class="data-local">
      ${cidadeContrato}, ${dataFormatada}
    </div>
 
    <div class="testemunhas-titulo">Testemunhas:</div>
 
    <div class="assinaturas-grid">
      <div class="coluna-esq">
        <div class="assinatura">
          <div class="linha"></div>
          <div class="nome">Nome:<br>CPF Nº:</div>
        </div>
        <div class="assinatura">
          <div class="linha"></div>
          <div class="nome">Nome:<br>CPF Nº:</div>
        </div>
      </div>
      
      <div class="coluna-dir">
        <div class="assinatura">
          <div class="linha"></div>
          <div class="nome">${vendedor}<br>CPF/CNPJ Nº: ${loteamento?.cnpj ?? empresa?.cnpj ?? "—"}<br>Vendedor</div>
        </div>
        <div class="assinatura">
          <div class="linha"></div>
          <div class="nome">${clienteNome}<br>CPF Nº: ${clienteCpf}<br>Comprador</div>
        </div>
      </div>
    </div>
  </div>
 
  <button class="btn-print" onclick="this.style.display='none'; window.print();">Gerar Minuta</button>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({ title: "Bloqueado pelo navegador", description: "Permita popups para imprimir.", variant: "destructive" });
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  function gerarTermoTransferencia(semTimbrado = false) {
    if (!contratoData) return;
    const { cliente, lote, loteamento, empresa } = contratoData;

    const cedenteNome = cliente?.nome ?? "—";
    const cedenteCpf = cliente?.cpf ?? cliente?.cnpj ?? "—";
    const cedenteRg = cliente?.rg ?? "—";
    const cedenteEndereco = cliente?.endereco ?? "________________________________________";
    const cedenteBairro = cliente?.bairro ?? "__________________";
    const cedenteCidade = cliente?.cidade ?? "____________";
    const cedenteEstado = cliente?.estado ?? "UF";

    const loteNum = lote?.lote ?? "___";
    const quadraNum = lote?.quadra ?? "___";
    const loteamentoNome = loteamento?.nome ?? "____________________________";
    const cidadeLote = loteamento?.cidade ?? "____________";
    const estadoLote = loteamento?.estado ?? "UF";

    const dataAtual = new Date();
    const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const mesExtenso = meses[dataAtual.getMonth()];
    const dataFormatada = `${dataAtual.getDate()} de ${mesExtenso} de ${dataAtual.getFullYear()}`;
    const cidadeContrato = loteamento?.cidade ?? empresa?.cidade ?? "Fortaleza";

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>TERMO DE TRANSFERÊNCIA DE LOTE</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, sans-serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      padding: 20mm 25mm;
      line-height: 1.5;
    }
    .titulo {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      font-size: 14pt;
      margin-bottom: 40px;
    }
    p { margin-bottom: 16px; text-align: justify; text-indent: 50px; }
    .data-local {
      margin-top: 30px;
      margin-bottom: 60px;
      text-indent: 0;
    }
    .assinaturas {
      margin-top: 40px;
    }
    .assinatura-linha {
      border-top: 1px solid #000;
      width: 340px;
      margin: 50px auto 5px auto;
      text-align: center;
      font-size: 10pt;
    }
    .assinatura-label {
      text-align: center;
      font-size: 9pt;
    }
    .btn-print {
      display: block;
      margin: 30px auto;
      padding: 6px 20px;
      cursor: pointer;
    }
    @media print {
      @page { margin: 0; }
      body { padding: 20mm 25mm; }
      .btn-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="conteudo" contenteditable="true">
    ${buildTimbrado(empresa, semTimbrado)}

    <div class="titulo">TERMO DE TRANSFERÊNCIA DE LOTE</div>

    <p>
      Pelo presente instrumento particular, e na melhor forma de direito, de um lado,
      <b>${cedenteNome}</b>, inscrito(a) no CPF nº ${cedenteCpf} e RG nº ${cedenteRg},
      residente e domiciliado(a) à ${cedenteEndereco}, bairro ${cedenteBairro},
      na cidade de ${cedenteCidade}/${cedenteEstado}, na qualidade de adquirente do
      <b>LOTE ${loteNum} DA QUADRA ${quadraNum} DO ${loteamentoNome}</b>, situado na cidade de
      ${cidadeLote}/${estadoLote}, conforme COMPROMISSO PARTICULAR DE COMPRA E VENDA original,
      firmado em <u>digite a data</u>.
    </p>

    <p>
      De livre e espontânea vontade <b>TRANSFERE</b>, na integralidade, os direitos e obrigações
      referentes ao referido lote para <u>digite o nome do novo comprador</u>, inscrito(a) no CPF nº
      <u>digite o CPF</u>, residente e domiciliado(a) à <u>digite o endereço</u>, que doravante
      passa a figurar como único(a) titular dos direitos oriundos do contrato mencionado.
    </p>

    <p>
      Pelo que firmam o presente instrumento em três vias de igual teor e forma, para um só efeito,
      com a anuência expressa do vendedor, para que surtam os devidos fins de direito.
    </p>

    <div class="data-local">
      ${cidadeContrato}, ${dataFormatada}.
    </div>

    <div class="assinaturas">
      <div class="assinatura-linha">${cedenteNome}</div>
      <div class="assinatura-label">(Cedente / Transferidor)</div>

      <div class="assinatura-linha">&nbsp;</div>
      <div class="assinatura-label">(Comprador / Cessionário)</div>

      <div class="assinatura-linha">${empresa?.nome_fantasia ?? loteamento?.prop_nome ?? "&nbsp;"}</div>
      <div class="assinatura-label">(Anuente / Vendedor)</div>
    </div>
  </div>

  <button class="btn-print" onclick="this.style.display='none'; window.print();">Gerar Termo de Transferência</button>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({
        title: "Bloqueado pelo navegador",
        description: "Permita popups para imprimir.",
        variant: "destructive",
      });
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  function applyContratoTemplate(template: string): string {
    if (!contratoData) return template;
    const { venda, cliente, lote, loteamento, empresa } = contratoData;
    const parcelasNum = numParcelas || String(venda.parcelas);
    const replacements: Record<string, string> = {
      "empresa.nome_fantasia": empresa?.nome_fantasia ?? "",
      "empresa.razao_social": empresa?.razao_social ?? "",
      "empresa.cnpj": empresa?.cnpj ?? "",
      "empresa.ie": empresa?.ie ?? "",
      "empresa.endereco": empresa?.endereco ?? "",
      "empresa.bairro": empresa?.bairro ?? "",
      "empresa.cidade": empresa?.cidade ?? "",
      "empresa.estado": empresa?.estado ?? "",
      "empresa.telefone": empresa?.telefone ?? "",
      "empresa.email": empresa?.email ?? "",
      "empresa.site": empresa?.site ?? "",
      "cliente.nome": cliente?.nome ?? "",
      "cliente.cpf": cliente?.cpf ?? cliente?.cnpj ?? "",
      "cliente.rg": cliente?.rg ?? "",
      "cliente.endereco": cliente?.endereco ?? "",
      "cliente.bairro": cliente?.bairro ?? "",
      "cliente.cidade": cliente?.cidade ?? "",
      "cliente.estado": cliente?.estado ?? "",
      "cliente.cep": cliente?.cep ?? "",
      "cliente.fone": cliente?.fone_res ?? cliente?.fone_com ?? "",
      "cliente.profissao": cliente?.profissao ?? "",
      "cliente.estado_civil": cliente?.estado_civil ?? "",
      "cliente.conjuge": cliente?.conjuge ?? "",
      "lote.numero": lote?.lote || "—",
      "lote.quadra": lote?.quadra || "—",
      "lote.area": areaLote || lote?.area || "—",
      "lote.frente": lote?.frente || "—",
      "lote.fundo": lote?.fundo || "—",
      "lote.direito": lote?.direito || "—",
      "lote.esquerdo": lote?.esquerdo || "—",
      "loteamento.nome": loteamento?.nome ?? "",
      "loteamento.cidade": loteamento?.cidade ?? "",
      "loteamento.estado": loteamento?.estado ?? "",
      "loteamento.prop_nome": loteamento?.prop_nome ?? "",
      "loteamento.prop_fone": loteamento?.prop_fone ?? "",
      "loteamento.cnpj": loteamento?.cnpj ?? "",
      "venda.data": formatData(String(venda.data_venda)),
      "venda.valor_entrada": formatMoeda(venda.valor_entrada),
      "venda.valor_parcela": formatMoeda(venda.valor_parcela),
      "venda.parcelas": parcelasNum,
      "venda.valor_total": formatMoeda(venda.valor_total),
      "venda.primeiro_vencimento": dataInicio ? formatData(dataInicio) : (venda.primeiro_vencimento ? formatData(venda.primeiro_vencimento) : ""),
      "venda.local_pagamento": localPagamento,
      "venda.telefone_contato": telefoneContato,
    };
    return template.replace(/\{\{([\w.]+)\}\}/g, (_, key) => replacements[key] ?? `{{${key}}}`);
  }

  function gerarContrato(semTimbrado = false) {
    if (!contratoData) return;
    const { venda, cliente, lote, loteamento, empresa } = contratoData;

    // Usa modelo personalizado da empresa (ou o padrão em formato {{placeholder}})
    const templateAtivo = empresa?.modelo_contrato ?? MODELO_CONTRATO_PADRAO;
    if (templateAtivo) {
      const timbrado = buildTimbrado(empresa, semTimbrado);
      const corpo = applyContratoTemplate(templateAtivo);
      const titulo = tipoContrato === "a-vista"
        ? "CONTRATO DE PROMESSA DE COMPRA E VENDA DE POSSE DE IMÓVEL (À VISTA)"
        : "CONTRATO DE PROMESSA DE COMPRA E VENDA DE POSSE DE IMÓVEL (A PRAZO)";
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Times New Roman, serif; font-size: 12pt; color: #000; background: #fff; padding: 20mm 25mm; line-height: 1.5; }
    p { margin-bottom: 8px; text-align: justify; }
    .btn-print { display: block; margin: 32px auto 0; padding: 10px 32px; background: #1a56db; color: #fff; font-size: 13pt; font-family: Arial, sans-serif; border: none; border-radius: 6px; cursor: pointer; }
    .btn-print:hover { background: #1e429f; }
    .conteudo:focus { outline: none; }
    @media print { @page { margin: 0; } body { padding: 15mm 18mm; } .btn-print { display: none; } }
  </style>
</head>
<body>
  <div class="conteudo" contenteditable="true">
  ${timbrado}
  ${corpo}
  </div>
  <button class="btn-print" onclick="window.print()">Imprimir</button>
</body>
</html>`;
      const printWindow = window.open("", "_blank");
      if (!printWindow) { toast({ title: "Popup bloqueado", description: "Permita popups para imprimir.", variant: "destructive" }); return; }
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      return;
    }
    const isAVista = tipoContrato === "a-vista";

    const titulo = isAVista
      ? "CONTRATO DE PROMESSA DE COMPRA E VENDA DE POSSE DE IMÓVEL (À VISTA)"
      : "CONTRATO DE PROMESSA DE COMPRA E VENDA DE POSSE DE IMÓVEL (A PRAZO)";

    const vendedor = loteamento?.prop_nome ?? empresa?.nome_fantasia ?? "—";
    const vendedorEndereco = [
      loteamento?.prop_endereco,
      loteamento?.prop_bairro,
      loteamento?.prop_cidade && loteamento?.prop_estado
        ? `${loteamento.prop_cidade}/${loteamento.prop_estado}`
        : loteamento?.prop_cidade,
      loteamento?.prop_cep ? `CEP: ${loteamento.prop_cep}` : null,
    ].filter(Boolean).join(". ");

    const clienteEndereco = [
      cliente?.endereco,
      cliente?.bairro && `8 de junho`, // Exemplo
      cliente?.cidade && cliente?.estado ? `${cliente.cidade}/${cliente.estado}` : cliente?.cidade,
    ].filter(Boolean).join(". ");

    const valorEntrada = formatMoeda(venda.valor_entrada);
    const valorParcela = formatMoeda(venda.valor_parcela);
    const parcelasNum = numParcelas || String(venda.parcelas);
    const dataContrato = formatData(String(venda.data_venda));

    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Times New Roman, serif;
      font-size: 11pt;
      color: #000;
      background: #fff;
      padding: 14mm 18mm;
      line-height: 1.3;
    }
    .titulo {
      text-align: center;
      font-weight: bold;
      text-decoration: underline;
      font-size: 12pt;
      margin-bottom: 4px;
    }
    .subtitulo {
      text-align: center;
      font-weight: bold;
      font-size: 11pt;
      margin-bottom: 10px;
    }
    .intro { text-align: justify; margin-bottom: 9px; }
    .secao { font-weight: bold; margin-top: 9px; margin-bottom: 3px; }
    p { margin-bottom: 5px; text-align: justify; }
    .bloco-assinaturas {
      margin-top: 28px;
      page-break-inside: avoid;
    }
    .linha-assinatura {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 60px;
      margin-bottom: 8px;
    }
    .assinatura {
      text-align: center;
      flex: 1;
    }
    .assinatura .espaco-assinar {
      height: 48px;
      border: 1px dashed #bbb;
      border-radius: 4px;
      margin-bottom: 6px;
      background: #fafafa;
    }
    .assinatura .linha {
      border-top: 1.5px solid #000;
      margin-bottom: 5px;
    }
    .assinatura .label-ass {
      font-size: 10pt;
      text-align: center;
      font-weight: bold;
    }
    .assinatura .nome-ass {
      font-size: 9pt;
      text-align: center;
      color: #444;
      margin-top: 2px;
    }
    .bloco-testemunhas {
      margin-top: 24px;
    }
    .bloco-testemunhas .titulo-test {
      font-size: 10pt;
      font-weight: bold;
      text-align: center;
      margin-bottom: 14px;
      color: #555;
    }
    .btn-print {
      display: block;
      margin: 32px auto 0;
      padding: 10px 32px;
      background: #1a56db;
      color: #fff;
      font-size: 13pt;
      font-family: Arial, sans-serif;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }
    .btn-print:hover { background: #1e429f; }
    .conteudo:focus { outline: none; }
    @media print {
      @page { size: A4; margin: 0; }
      body { padding: 12mm 16mm; }
      .assinatura .espaco-assinar {
        /* mantém o espaço, apenas oculta a borda visual */
        border: none;
        background: transparent;
      }
      .btn-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="conteudo" contenteditable="true">
  ${buildTimbrado(empresa, false)}
  <div class="titulo">${titulo}</div>
  <div class="subtitulo">${loteamento?.nome ?? ""}</div>

  <p class="intro">
    Pelo presente instrumento de Escritura de Contrato Particular de Compra e Venda, que livremente
    celebram com as cláusulas de irretratabilidade e irrevogabilidade, partes maiores capazes e na
    livre disposição e administração de seus bens, fica justa e contratada a presente promessa de
    compra e venda de imóvel sob cláusulas e condições seguintes:
  </p>

  <p class="secao">1. DAS PARTES CONTRATANTES:</p>
  <p class="secao">1.1 Promitente Vendedor(a)</p>
  <p>
    <b>Nome:</b> ${vendedor}<br/>
    ${vendedorEndereco ? `<b>Endereço:</b> ${vendedorEndereco}<br/>` : ""}
    ${loteamento?.prop_fone ? `<b>Telefone:</b> ${loteamento.prop_fone}` : ""}
  </p>

  ${imprimirProcurador && procuradorTexto ? `
  <p><b>Representado por seu procurador(a):</b></p>
  <p>${procuradorTexto}</p>
  ` : ""}

  <p class="secao">1.2 Promissário(a) Comprador(a)</p>
  <p>
    <b>Nome:</b> ${cliente?.nome ?? "—"}<br/>
    ${cliente?.endereco ? `<b>Endereço:</b> ${cliente.endereco}` : ""}
    ${cliente?.bairro ? ` - ${cliente.bairro}` : ""}<br/>
    <b>Cidade:</b> ${cliente?.cidade ?? "—"}/${cliente?.estado ?? "—"}&nbsp;&nbsp;
    <b>CEP:</b> ${cliente?.cep ?? ""}<br/>
    <b>Telefone:</b> ${cliente?.fone_res ?? cliente?.fone_com ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>CPF:</b> ${cliente?.cpf ?? cliente?.cnpj ?? "—"}&nbsp;&nbsp;
    <b>RG:</b> ${cliente?.rg ?? "—"}<br/>
    <b>Profissão:</b> ${cliente?.profissao ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Est. Civil:</b> ${cliente?.estado_civil ?? "—"}
  </p>

  <p class="secao">2. DO OBJETIVO DO CONTRATO</p>
  <p>
    <b>Lote nº:</b> ${lote?.lote ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Quadra:</b> ${lote?.quadra ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Área:</b> ${areaLote || lote?.area || ""} m²<br/>
    <b>Frente:</b> ${lote?.frente ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Fundo:</b> ${lote?.fundo ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Lado direito:</b> ${lote?.direito ?? "—"}&nbsp;&nbsp;&nbsp;
    <b>Lado Esquerdo:</b> ${lote?.esquerdo ?? "—"}
  </p>

  <p class="secao">3. DO PREÇO, DA FORMA E CONDIÇÕES DE PAGAMENTO</p>
  <p>
    3.1 O Promissário(a) Comprador(a) acima nomeado(a) se compromete a comprar e a pagar
    o imóvel acima descrito pelo preço certo, justo e exigível disposto da seguinte forma:
  </p>

  <p>
    ${isAVista
      ? `Valor total: ${formatMoeda(venda.valor_total)} à vista, pagável em moeda corrente e legal no País.`
      : `Entrada: ${valorEntrada} e mais ${parcelasNum} prestações mensais e sucessivas
         de ${valorParcela} pagáveis em moeda corrente e legal no País.<br/>
         ${clausulasExtra.replace(/\n/g, "<br/>")}`
    }
  </p>

  ${!isAVista ? `
  <p>
    3.2 As prestações já referidas em número de <b>${parcelasNum}</b> serão representadas
    por Carnês e Boletos Bancários com vencimentos mensais e sucessivos a partir de
    <b>${dataInicio ? formatData(dataInicio) : "___/___/______"}</b> e que passarão a fazer
    parte integrante do presente instrumento.
  </p>
  <p>3.3 Os boletos serão entregues pelo(a) Promitente Vendedor(a) no endereço do comprador ou pelo correio.</p>
  <p>3.4 O local para o pagamento das prestações será <b>${localPagamento || "____________"}</b></p>
  <p>
    Após 90 dias de atraso ligar para
    <b>${telefoneContato || "(__) ____-____"}</b>
  </p>
  <p>
    3.5 Sobre as prestações em atraso indicarão juros convencionais diários praticados no mercado
    na data do pagamento, acrescidas de multa moratária de 2% (dois por cento)
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
  ` : ""}

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
  <p>
    ${loteamento?.cidade ?? empresa?.cidade ?? "Fortaleza"}, ${dataContrato}
  </p>

  <div class="bloco-assinaturas">

    <!-- Partes principais -->
    <div class="linha-assinatura">
      <div class="assinatura">
        <div class="espaco-assinar"></div>
        <div class="linha"></div>
        <p class="label-ass">Promitente Vendedor(a)</p>
        <p class="nome-ass">${vendedor}</p>
      </div>
      <div class="assinatura">
        <div class="espaco-assinar"></div>
        <div class="linha"></div>
        <p class="label-ass">Promissário(a) Comprador(a)</p>
        <p class="nome-ass">${cliente?.nome ?? ""}</p>
      </div>
    </div>

    <!-- Testemunhas -->
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

  </div>
  </div>

  <button class="btn-print" onclick="this.style.display='none'; window.print();">Gerar Contrato</button>
</body>
</html>`;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast({ title: "Bloqueado pelo navegador", description: "Permita popups para imprimir.", variant: "destructive" });
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Contrato — {nomeCliente}
          </DialogTitle>
        </DialogHeader>

        {/* ── ETAPA 1: Selecionar venda ── */}
        {etapa === "selecionar" && (
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Selecione a venda/lote para gerar o contrato:
            </p>
            {loadingVendas ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Carregando vendas...</p>
            ) : vendas.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma venda encontrada para este cliente.
              </p>
            ) : (
              <div className="space-y-2">
                {vendas.map((v) => (
                  <button
                    key={v.id_venda}
                    onClick={() => handleSelecionarVenda(v)}
                    className="w-full flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/40 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm">{v.lote_desc}</p>
                      <p className="text-xs text-muted-foreground">{v.loteamento}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Data: {formatData(v.data_venda)} · {v.parcelas}x parcelas
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={v.status === "aberta" ? "default" : v.status === "quitada" ? "secondary" : "destructive"}>
                        {v.status === "aberta" ? "Em aberto" : v.status === "quitada" ? "Quitada" : "Cancelada"}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ETAPA 2: Formulário do contrato ── */}
        {etapa === "formulario" && (
          <div className="space-y-5 pt-2">
            {loadingContrato ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Carregando dados do contrato...</p>
            ) : (
              <>
                {/* Tipo */}
                <div className="flex items-center gap-3">
                  <Label className="text-sm font-semibold shrink-0">Tipo de contrato:</Label>
                  <Select value={tipoContrato} onValueChange={(v) => setTipoContrato(v as "a-prazo" | "a-vista")}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a-prazo">A PRAZO</SelectItem>
                      <SelectItem value="a-vista">À VISTA</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground">— {contratoData?.loteamento?.nome ?? ""}</span>
                </div>

                <Separator />

                {/* 1.1 Promitente Vendedor */}
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">1.1 Promitente Vendedor(a)</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-0.5">
                    <p><span className="font-medium">Nome:</span> {contratoData?.loteamento?.prop_nome ?? contratoData?.empresa?.nome_fantasia ?? "—"}</p>
                    {contratoData?.loteamento?.prop_endereco && (
                      <p><span className="font-medium">Endereço:</span> {[contratoData.loteamento.prop_endereco, contratoData.loteamento.prop_bairro, contratoData.loteamento.prop_cidade, contratoData.loteamento.prop_estado].filter(Boolean).join(", ")}</p>
                    )}
                    {contratoData?.loteamento?.prop_fone && (
                      <p><span className="font-medium">Telefone:</span> {contratoData.loteamento.prop_fone}</p>
                    )}
                  </div>

                  {/* Procurador */}
                  <div className="flex items-center gap-2 mt-2">
                    <Checkbox
                      id="procurador"
                      checked={imprimirProcurador}
                      onCheckedChange={(c) => setImprimirProcurador(!!c)}
                    />
                    <Label htmlFor="procurador" className="text-sm cursor-pointer">Imprimir Procurador</Label>
                  </div>
                  {imprimirProcurador && (
                    <Textarea
                      className="mt-2 text-sm"
                      rows={3}
                      placeholder="Texto do procurador(a)..."
                      value={procuradorTexto}
                      onChange={(e) => setProcuradorTexto(e.target.value)}
                    />
                  )}
                </div>

                <Separator />

                {/* 1.2 Comprador */}
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">1.2 Promissário(a) Comprador(a)</p>
                  <div className="bg-muted/30 rounded-lg p-3 text-sm space-y-0.5">
                    <p><span className="font-medium">Nome:</span> {contratoData?.cliente?.nome ?? "—"}</p>
                    {contratoData?.cliente?.endereco && (
                      <p><span className="font-medium">Endereço:</span> {contratoData.cliente.endereco} {contratoData.cliente.bairro ? "- " + contratoData.cliente.bairro : ""}</p>
                    )}
                    <p>
                      <span className="font-medium">Cidade:</span> {contratoData?.cliente?.cidade ?? "—"}/{contratoData?.cliente?.estado ?? "—"}&nbsp;&nbsp;
                      <span className="font-medium">CEP:</span> {contratoData?.cliente?.cep ?? ""}
                    </p>
                    <p>
                      <span className="font-medium">Telefone:</span> {contratoData?.cliente?.fone_res ?? contratoData?.cliente?.fone_com ?? "—"}&nbsp;&nbsp;
                      <span className="font-medium">CPF:</span> {contratoData?.cliente?.cpf ?? contratoData?.cliente?.cnpj ?? "—"}&nbsp;&nbsp;
                      <span className="font-medium">RG:</span> {contratoData?.cliente?.rg ?? "—"}
                    </p>
                    <p>
                      <span className="font-medium">Profissão:</span> {contratoData?.cliente?.profissao ?? "—"}&nbsp;&nbsp;
                      <span className="font-medium">Est. Civil:</span> {contratoData?.cliente?.estado_civil ?? "—"}
                    </p>
                  </div>
                </div>

                <Separator />

                {/* 2. Objetivo */}
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">2. Do Objetivo do Contrato</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <Label className="text-xs">Lote nº</Label>
                      <Input value={contratoData?.lote?.lote ?? ""} readOnly className="bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">Quadra</Label>
                      <Input value={contratoData?.lote?.quadra ?? ""} readOnly className="bg-muted/30" />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-xs">Área (m²)</Label>
                      <Input
                        value={areaLote}
                        onChange={(e) => setAreaLote(e.target.value)}
                        placeholder="Ex: 200"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Frente</Label>
                      <Input value={contratoData?.lote?.frente ?? "—"} readOnly className="bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">Fundo</Label>
                      <Input value={contratoData?.lote?.fundo ?? "—"} readOnly className="bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">Lado direito</Label>
                      <Input value={contratoData?.lote?.direito ?? "—"} readOnly className="bg-muted/30" />
                    </div>
                    <div>
                      <Label className="text-xs">Lado esquerdo</Label>
                      <Input value={contratoData?.lote?.esquerdo ?? "—"} readOnly className="bg-muted/30" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* 3. Pagamento */}
                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">3. Do Preço e Condições de Pagamento</p>

                  <div className="bg-muted/30 rounded-lg p-3 text-sm grid grid-cols-2 md:grid-cols-3 gap-2">
                    <div>
                      <span className="text-xs text-muted-foreground">Valor entrada</span>
                      <p className="font-semibold">{formatMoeda(contratoData?.venda?.valor_entrada ?? 0)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Valor parcela</span>
                      <p className="font-semibold">{formatMoeda(contratoData?.venda?.valor_parcela ?? 0)}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Valor total</span>
                      <p className="font-semibold">{formatMoeda(contratoData?.venda?.valor_total ?? 0)}</p>
                    </div>
                  </div>

                  {tipoContrato === "a-prazo" && (
                    <>
                      <div>
                        <Label className="text-xs">Cláusulas adicionais (item 3.1)</Label>
                        <Textarea
                          rows={3}
                          className="text-sm mt-1"
                          value={clausulasExtra}
                          onChange={(e) => setClausulasExtra(e.target.value)}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">3.2 Nº de prestações</Label>
                          <Input
                            value={numParcelas}
                            onChange={(e) => setNumParcelas(e.target.value)}
                            placeholder="Ex: 60"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Data do 1º vencimento</Label>
                          <Input
                            type="date"
                            value={dataInicio}
                            onChange={(e) => setDataInicio(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">3.4 Local de pagamento</Label>
                          <Input
                            value={localPagamento}
                            onChange={(e) => setLocalPagamento(e.target.value)}
                            placeholder="Ex: Escritório Central"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Telefone de contato</Label>
                          <Input
                            value={telefoneContato}
                            onChange={(e) => setTelefoneContato(e.target.value)}
                            placeholder="(00) 0000-0000"
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Botões */}
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={handleVoltar}>
                      Voltar
                    </Button>
                    <Button variant="default" onClick={onClose} className="bg-primary hover:bg-primary/90">
                      Concluir
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    <Button variant="secondary" onClick={() => gerarMinuta(false)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                      <FileText className="h-4 w-4" />
                      Minuta
                    </Button>
                    <Button variant="secondary" onClick={gerarReciboQuitacao} className="gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-200 border">
                      <FileText className="h-4 w-4" />
                      Recibo de Quitação
                    </Button>
                    <Button onClick={gerarContrato} className="gap-2">
                      <Printer className="h-4 w-4" />
                      Gerar Contrato
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
