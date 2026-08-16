import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatDateBR } from "@/lib/date-br";
import { Upload, Link2, Unlink, EyeOff } from "lucide-react";

type Status="pendente"|"conciliado"|"ignorado";
interface Conta{id_conta:number;apelido:string;ativo:boolean}
interface Sugestao{origem:string;id_origem:number;data:string;descricao:string;valor:string;diferenca_dias:number}
interface Item{id_item:number;data:string;tipo:"receita"|"despesa";valor:string;descricao:string;status:Status;vinculo_origem?:string;sugestoes:Sugestao[]}
const fmt=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);

export function ConciliacaoTab(){
  const {token}=useAuth(); const {toast}=useToast(); const qc=useQueryClient();
  const headers={Authorization:`Bearer ${token}`,"Content-Type":"application/json"};
  const [conta,setConta]=useState(""); const [status,setStatus]=useState<Status>("pendente");
  const {data:contas=[]}=useQuery<Conta[]>({queryKey:["financeiro","contas-ativas"],queryFn:async()=>{const r=await fetch("/api/contas?ativo=true",{headers});return r.ok?r.json():[]}});
  const {data:itens=[],isLoading}=useQuery<Item[]>({queryKey:["financeiro","conciliacao",conta,status],enabled:Boolean(conta),queryFn:async()=>{const r=await fetch(`/api/contas/${conta}/conciliacao?status=${status}`,{headers});if(!r.ok)throw new Error("Erro ao carregar conciliação");return r.json()}});
  const importar=useMutation({mutationFn:async(file:File)=>{if(file.size>2*1024*1024)throw new Error("Arquivo OFX excede 2 MB");const conteudo=await file.text();const r=await fetch(`/api/contas/${conta}/conciliacao/importar`,{method:"POST",headers,body:JSON.stringify({nome:file.name,conteudo})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"Erro ao importar OFX");return d},onSuccess:(d)=>{qc.invalidateQueries({queryKey:["financeiro","conciliacao"]});toast({title:`${d.inseridos} transações importadas`,description:d.duplicados?`${d.duplicados} duplicadas ignoradas`:undefined})},onError:(e:Error)=>toast({title:e.message,variant:"destructive"})});
  const acao=useMutation({mutationFn:async({item,url,method,body}:{item:number;url:string;method:string;body?:unknown})=>{const r=await fetch(`/api/contas/${conta}/conciliacao/${item}/${url}`,{method,headers,body:body?JSON.stringify(body):undefined});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Operação não concluída")}},onSuccess:()=>qc.invalidateQueries({queryKey:["financeiro","conciliacao"]}),onError:(e:Error)=>toast({title:e.message,variant:"destructive"})});
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-3 items-center">
      <Select value={conta} onValueChange={setConta}><SelectTrigger className="w-[240px]"><SelectValue placeholder="Selecione uma conta"/></SelectTrigger><SelectContent>{contas.map(c=><SelectItem key={c.id_conta} value={String(c.id_conta)}>{c.apelido}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(v:Status)=>setStatus(v)}><SelectTrigger className="w-[160px]"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pendente">Pendentes</SelectItem><SelectItem value="conciliado">Conciliados</SelectItem><SelectItem value="ignorado">Ignorados</SelectItem></SelectContent></Select>
      <Button asChild variant="outline" disabled={!conta||importar.isPending}><label className="cursor-pointer gap-2"><Upload className="h-4 w-4"/>Importar OFX<Input className="hidden" type="file" accept=".ofx,application/x-ofx" onChange={e=>{const f=e.target.files?.[0];if(f)importar.mutate(f);e.target.value=""}}/></label></Button>
    </div>
    {!conta?<div className="rounded-lg border p-8 text-center text-muted-foreground">Selecione a conta bancária para importar e conciliar o extrato.</div>:isLoading?<div className="p-8 text-center">Carregando…</div>:itens.length===0?<div className="rounded-lg border p-8 text-center text-muted-foreground">Nenhum item {status}.</div>:<div className="space-y-3">{itens.map(i=><div key={i.id_item} className="rounded-lg border p-4 space-y-3"><div className="flex justify-between gap-3"><div><div className="font-medium">{i.descricao}</div><div className="text-xs text-muted-foreground">{formatDateBR(i.data)} · <Badge variant="outline">{i.tipo==="receita"?"Crédito":"Débito"}</Badge></div></div><div className={i.tipo==="receita"?"font-bold text-emerald-600":"font-bold text-red-500"}>{i.tipo==="receita"?"+":"−"}{fmt(Number(i.valor))}</div></div>
      {i.status==="pendente"?<div className="space-y-2"><div className="text-xs font-medium text-muted-foreground">Sugestões compatíveis</div>{i.sugestoes.length?i.sugestoes.map(s=><div key={`${s.origem}-${s.id_origem}`} className="flex items-center justify-between gap-2 rounded bg-muted/40 p-2 text-sm"><span>{formatDateBR(s.data)} · {s.descricao}</span><Button size="sm" onClick={()=>acao.mutate({item:i.id_item,url:"vincular",method:"POST",body:{origem:s.origem,id_origem:s.id_origem}})}><Link2 className="h-3.5 w-3.5 mr-1"/>Conciliar</Button></div>):<div className="text-sm text-muted-foreground">Nenhum lançamento com mesmo valor encontrado em até 3 dias.</div>}<Button size="sm" variant="ghost" onClick={()=>acao.mutate({item:i.id_item,url:"status",method:"PATCH",body:{status:"ignorado"}})}><EyeOff className="h-4 w-4 mr-1"/>Ignorar</Button></div>:i.status==="conciliado"?<Button size="sm" variant="outline" onClick={()=>acao.mutate({item:i.id_item,url:"vinculo",method:"DELETE"})}><Unlink className="h-4 w-4 mr-1"/>Desfazer conciliação</Button>:<Button size="sm" variant="outline" onClick={()=>acao.mutate({item:i.id_item,url:"status",method:"PATCH",body:{status:"pendente"}})}>Voltar para pendentes</Button>}
    </div>)}</div>}
  </div>;
}
