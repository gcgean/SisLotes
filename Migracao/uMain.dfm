object frmMain: TfrmMain
  Left = 0
  Top = 0
  Caption = 'Migrador de Dados - SISLOTE'
  ClientHeight = 442
  ClientWidth = 628
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -12
  Font.Name = 'Segoe UI'
  Font.Style = []
  Position = poScreenCenter
  TextHeight = 15
  object lblStatus: TLabel
    Left = 24
    Top = 24
    Width = 230
    Height = 21
    Caption = 'Aguardando in'#237'cio da migra'#231#227'o...'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -16
    Font.Name = 'Segoe UI'
    Font.Style = [fsBold]
    ParentFont = False
  end
  object btnMigrar: TButton
    Left = 24
    Top = 64
    Width = 153
    Height = 49
    Caption = 'Iniciar Migra'#231#227'o'
    TabOrder = 0
    OnClick = btnMigrarClick
  end
  object memLog: TMemo
    Left = 24
    Top = 136
    Width = 577
    Height = 281
    ScrollBars = ssVertical
    TabOrder = 1
  end
  object FDConnectionMySQL: TFDConnection
    Params.Strings = (
      'DriverID=MySQL'
      'Server=185.100.215.16'
      'Port=3306'
      'Database=LO'
      'User_Name=root'
      'Password=SDGdfa45342')
    Left = 328
    Top = 32
  end
  object FDConnectionPG: TFDConnection
    Params.Strings = (
      'DriverID=PG'
      'Server=localhost'
      'Port=5433'
      'Database=sislote'
      'User_Name=sislote'
      'Password=sislote')
    Left = 440
    Top = 32
  end
  object FDPhysMySQLDriverLink1: TFDPhysMySQLDriverLink
    VendorLib = 'libmysql.dll'
    Left = 328
    Top = 88
  end
  object FDPhysPgDriverLink1: TFDPhysPgDriverLink
    VendorLib = 'libpq.dll'
    Left = 440
    Top = 88
  end
end
