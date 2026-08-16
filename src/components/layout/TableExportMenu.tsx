import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useLicenseFeatures } from "@/hooks/useLicenseFeatures";
import { useToast } from "@/hooks/use-toast";
import { baixarTexto, coletarTabelasVisiveis, tabelasParaCsv } from "@/lib/table-export";

function nomeBase() { const rota = location.pathname.split("/").filter(Boolean).pop() || "dashboard"; return `${rota}-${new Date().toISOString().slice(0,10)}`; }

export function TableExportMenu(){
  const{canExportCsv}=useLicenseFeatures();const{toast}=useToast();
  const tabelas=()=>{const root=document.getElementById("app-main-content");const dados=root?coletarTabelasVisiveis(root):[];if(!dados.length)toast({title:"Nenhuma tabela visível para exportar",variant:"destructive"});return dados};
  const csv=()=>{const dados=tabelas();if(dados.length)baixarTexto(`\uFEFF${tabelasParaCsv(dados)}`,`${nomeBase()}.csv`,"text/csv;charset=utf-8")};
  const xlsx=async()=>{const dados=tabelas();if(!dados.length)return;const{default:writeXlsxFile}=await import("write-excel-file/browser");const planilhas=dados.map(t=>t.linhas.map((linha,i)=>linha.map(value=>({value,type:String,fontWeight:i===0?"bold":undefined}))));await writeXlsxFile(planilhas,{sheets:dados.map((t,i)=>(t.nome||`Lista ${i+1}`).slice(0,31)),fileName:`${nomeBase()}.xlsx`});};
  if(!canExportCsv)return null;
  return <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="gap-1" title="Exportar tabelas visíveis"><Download className="h-4 w-4"/><span className="hidden lg:inline">Exportar</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={csv}><Download className="mr-2 h-4 w-4"/>CSV</DropdownMenuItem><DropdownMenuItem onClick={()=>void xlsx()}><FileSpreadsheet className="mr-2 h-4 w-4"/>Excel (.xlsx)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
