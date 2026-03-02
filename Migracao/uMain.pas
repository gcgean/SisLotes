unit uMain;

interface

uses
  Winapi.Windows, Winapi.Messages, System.SysUtils, System.Variants, System.Classes, Vcl.Graphics,
  Vcl.Controls, Vcl.Forms, Vcl.Dialogs, Vcl.StdCtrls, FireDAC.Stan.Intf,
  FireDAC.Stan.Option, FireDAC.Stan.Error, FireDAC.UI.Intf, FireDAC.Phys.Intf,
  FireDAC.Stan.Def, FireDAC.Stan.Pool, FireDAC.Stan.Async, FireDAC.Phys,
  FireDAC.Phys.MySQL, FireDAC.Phys.MySQLDef, FireDAC.Phys.PG, FireDAC.Phys.PGDef,
  FireDAC.VCLUI.Wait, Data.DB, FireDAC.Comp.Client, FireDAC.Stan.Param,
  FireDAC.DatS, FireDAC.DApt.Intf, FireDAC.DApt, FireDAC.Comp.DataSet;

type
  TfrmMain = class(TForm)
    lblStatus: TLabel;
    btnMigrar: TButton;
    memLog: TMemo;
    FDConnectionMySQL: TFDConnection;
    FDConnectionPG: TFDConnection;
    FDPhysMySQLDriverLink1: TFDPhysMySQLDriverLink;
    FDPhysPgDriverLink1: TFDPhysPgDriverLink;
    procedure btnMigrarClick(Sender: TObject);
    procedure FormCreate(Sender: TObject);
  private
    { Private declarations }
    procedure Log(const Msg: string);
    procedure ConfigurarConexoes;
    procedure MigrarDados;
    procedure MigrarTabela(const TabelaOrigem, TabelaDestino, Campos: string);
  public
    { Public declarations }
  end;

var
  frmMain: TfrmMain;

implementation

{$R *.dfm}

procedure TfrmMain.ConfigurarConexoes;
begin
  // Configuração MySQL (Origem)
  // Nota: O usuário deve verificar se o usuário 'root' é o correto para o banco remoto
  // Caso contrário, altere 'User_Name' abaixo
  FDConnectionMySQL.Params.Clear;
  FDConnectionMySQL.Params.Add('DriverID=MySQL');
  FDConnectionMySQL.Params.Add('Server=185.100.215.16');
  FDConnectionMySQL.Params.Add('Port=3306');
  FDConnectionMySQL.Params.Add('Database=LO');
  FDConnectionMySQL.Params.Add('User_Name=root'); // VERIFICAR USUÁRIO
  FDConnectionMySQL.Params.Add('Password=SDGdfa45342');
  FDConnectionMySQL.Params.Add('CharacterSet=utf8');
  
  // Configuração PostgreSQL (Destino - Local)
  FDConnectionPG.Params.Clear;
  FDConnectionPG.Params.Add('DriverID=PG');
  FDConnectionPG.Params.Add('Server=localhost');
  FDConnectionPG.Params.Add('Port=5433');
  FDConnectionPG.Params.Add('Database=sislote');
  FDConnectionPG.Params.Add('User_Name=sislote');
  FDConnectionPG.Params.Add('Password=sislote');
end;

procedure TfrmMain.FormCreate(Sender: TObject);
begin
  ConfigurarConexoes;
end;

procedure TfrmMain.Log(const Msg: string);
begin
  memLog.Lines.Add(FormatDateTime('dd/mm/yyyy hh:nn:ss', Now) + ' - ' + Msg);
  // Garante que a UI atualize
  Application.ProcessMessages;
end;

procedure TfrmMain.btnMigrarClick(Sender: TObject);
begin
  btnMigrar.Enabled := False;
  try
    try
      Log('Conectando ao MySQL (Origem)...');
      FDConnectionMySQL.Connected := True;
      Log('Conectado ao MySQL!');

      Log('Conectando ao PostgreSQL (Destino)...');
      FDConnectionPG.Connected := True;
      Log('Conectado ao PostgreSQL!');

      FDConnectionPG.StartTransaction;
      try
        MigrarDados;
        
        FDConnectionPG.Commit;
        Log('MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
        ShowMessage('Migração concluída com sucesso!');
      except
        on E: Exception do
        begin
          FDConnectionPG.Rollback;
          Log('ERRO: Transação revertida. Detalhes: ' + E.Message);
          raise;
        end;
      end;

    except
      on E: Exception do
      begin
        Log('Erro fatal: ' + E.Message);
        ShowMessage('Erro fatal: ' + E.Message);
      end;
    end;
  finally
    btnMigrar.Enabled := True;
    FDConnectionMySQL.Connected := False;
    FDConnectionPG.Connected := False;
  end;
end;

procedure TfrmMain.MigrarDados;
begin
  // Aqui você deve mapear as tabelas. 
  // Como não temos o schema exato do banco antigo, este é um exemplo genérico.
  // Você precisará ajustar os nomes dos campos e tabelas no código abaixo.

  // Exemplo: Migrar Clientes
  // Assumindo que a tabela antiga se chama 'clientes' e a nova 'clientes'
  Log('Iniciando migração de Clientes...');
  
  // Exemplo de query manual para ter controle total
  var qryOrigem := TFDQuery.Create(nil);
  var qryDestino := TFDQuery.Create(nil);
  try
    qryOrigem.Connection := FDConnectionMySQL;
    qryDestino.Connection := FDConnectionPG;
    
    // 1. CLIENTES
    qryOrigem.SQL.Text := 'SELECT * FROM clientes'; // Ajuste o nome da tabela origem
    qryOrigem.Open;
    
    Log(Format('Encontrados %d clientes na origem.', [qryOrigem.RecordCount]));
    
    while not qryOrigem.Eof do
    begin
      qryDestino.SQL.Text := 
        'INSERT INTO clientes (nome, cpf, cnpj, endereco, cidade, estado, tipo_pessoa) ' +
        'VALUES (:nome, :cpf, :cnpj, :endereco, :cidade, :estado, :tipo) ';
        // Nota: O ID é serial no destino, então deixamos gerar automático ou forçamos se necessário
      
      // Mapeamento De -> Para
      qryDestino.ParamByName('nome').AsString := qryOrigem.FieldByName('nome').AsString;
      
      // Tratamento de CPF/CNPJ
      var doc := qryOrigem.FieldByName('cpf_cnpj').AsString; // Ajuste o nome do campo
      if Length(doc) > 11 then
      begin
        qryDestino.ParamByName('cnpj').AsString := doc;
        qryDestino.ParamByName('tipo').AsString := 'j';
      end
      else
      begin
        qryDestino.ParamByName('cpf').AsString := doc;
        qryDestino.ParamByName('tipo').AsString := 'f';
      end;
      
      qryDestino.ParamByName('endereco').AsString := qryOrigem.FieldByName('endereco').AsString;
      qryDestino.ParamByName('cidade').AsString := qryOrigem.FieldByName('cidade').AsString;
      qryDestino.ParamByName('estado').AsString := qryOrigem.FieldByName('uf').AsString;

      qryDestino.ExecSQL;
      qryOrigem.Next;
    end;
    Log('Clientes migrados.');

    // 2. LOTEAMENTOS
    // ... Implementar lógica similar para Loteamentos, Lotes, Vendas, etc.

  finally
    qryOrigem.Free;
    qryDestino.Free;
  end;
end;

procedure TfrmMain.MigrarTabela(const TabelaOrigem, TabelaDestino, Campos: string);
begin
  // Método utilitário para migração direta se os campos forem idênticos
end;

end.
