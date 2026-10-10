#!/usr/bin/env python3
"""Conferência automática de um pacote ProRider antes de entregar.
uso: python3 conferir_pacote.py <pasta_do_pacote> [<pasta_do_pacote_anterior>]"""
import sys, os, re, zipfile, subprocess, tempfile, glob, shutil
P=sys.argv[1]; ANT=sys.argv[2] if len(sys.argv)>2 else None
ver=re.search(r'(\d\d-\d\d[a-z])$',P.rstrip('/')).group(1); verb=ver.replace('-','/')
erros=[]; avisos=[]; ok=[]
# 03/10y: o Ginásio tem a versão dele (GINASIO_VERSAO no server.js). Pacote só de servidor mantém o zip da TV.
_sv=open(P+'/1_SERVIDOR/server.js',encoding='utf8').read() if os.path.exists(P+'/1_SERVIDOR/server.js') else ''
_gm=re.search(r"const GINASIO_VERSAO = '(\d\d/\d\d[a-z])'",_sv)
gverb=_gm.group(1) if _gm else verb; gver=gverb.replace('/','-')
def E(m): erros.append(m)
def W(m): avisos.append(m)
def node_check_js(path):
    r=subprocess.run(['node','-e',"new (require('vm').Script)(require('fs').readFileSync(process.argv[1],'utf8'))",path],capture_output=True,text=True)
    return r.returncode==0, r.stderr.strip()[:300]
def css_ok(css):
    t=re.sub(r'/\*.*?\*/','',css,flags=re.S); d=0
    for c in t:
        if c=='{': d+=1
        elif c=='}':
            d-=1
            if d<0: return False
    return d==0
ESSENCIAIS_CSS=['.pv-scr','.pv-card','.pv-bars','.bgc-box','.bgc-op','.pa2-g','.pa2-qrs','.nv-qr','.pv-info','#prYTWrap','#cdSpotify','#idleScreen','.pg2c']
GIN_ARQ=['bled112.js','servidor-local.js','construtor.html','style.css','ginasio.html','brasoes.js','LEIA-ME.txt','particles-prorider.js','PRORIDER.bat','script.js','telas-pv.js','logo-prorider.png','GERAR_PROGRAMA_DA_TV.bat','antplus.js']
tmp=tempfile.mkdtemp()
# 1. Ginásio
z=glob.glob(P+'/3_GINASIO/*.zip')
if len(z)!=1: E('3_GINASIO deve ter 1 zip, tem %d'%len(z))
else:
    if gver not in os.path.basename(z[0]): E('nome do zip do Ginásio não tem a versão '+gver)
    zf=zipfile.ZipFile(z[0]); nomes=zf.namelist()
    for a in GIN_ARQ:
        if a not in nomes: E('Ginásio: falta '+a)
    gd=tmp+'/gin'; zf.extractall(gd)
    for js in ['script.js','telas-pv.js','bled112.js','antplus.js','brasoes.js','particles-prorider.js','servidor-local.js']:
        if os.path.exists(gd+'/'+js):
            r,m=node_check_js(gd+'/'+js)
            if not r: E('Ginásio: erro de sintaxe em '+js+': '+m)
    if os.path.exists(gd+'/GERAR_PROGRAMA_DA_TV.bat'):
        bt=open(gd+'/GERAR_PROGRAMA_DA_TV.bat',encoding='ascii',errors='replace').read()
        if ('set VERSAO='+gverb) not in bt: E('GERAR_PROGRAMA_DA_TV.bat não tem "set VERSAO=%s"'%gverb)
        if ('ProRider_1_GINASIO_'+gver+'.zip') not in bt: E('GERAR_PROGRAMA_DA_TV.bat cita outro zip (esperado ProRider_1_GINASIO_%s.zip)'%gver)
        if b'\r\n' not in open(gd+'/GERAR_PROGRAMA_DA_TV.bat','rb').read(): E('GERAR_PROGRAMA_DA_TV.bat sem quebra de linha do Windows (CRLF)')
    css=open(gd+'/style.css',encoding='utf8').read()
    if not css_ok(css): E('style.css com chaves { } desbalanceadas')
    for sel in ESSENCIAIS_CSS:
        if sel not in css: E('style.css sem '+sel+' (arquivo cortado?)')
    sc=open(gd+'/script.js',encoding='utf8').read()
    m=re.search(r"var PR_BUILD='BUILD ([^']+)'",sc)
    if not m or m.group(1)!=gverb: E('PR_BUILD é %s, esperado %s (GINASIO_VERSAO do server.js)'%(m and m.group(1),gverb))
    if ('BUILD '+gverb) not in sc.split('console.log(\'%c[ProRider] ')[-1][:40]: W('linha do BUILD no console não começa com '+gverb)
    html=open(gd+'/ginasio.html',encoding='utf8').read()
    for s in re.findall(r'<script src="([^"h][^"]*)"',html):
        if s not in nomes: E('ginasio.html carrega '+s+' que não está no zip')
    if ANT:
        za=glob.glob(ANT+'/3_GINASIO/*.zip')
        if za:
            zfa=zipfile.ZipFile(za[0])
            for a in GIN_ARQ:
                try:
                    na=zfa.getinfo(a).file_size; nn=zf.getinfo(a).file_size
                    if nn<na*0.95: E('Ginásio: %s encolheu %d%% em relação ao pacote anterior (%d → %d bytes)'%(a,100-nn*100//na,na,nn))
                except KeyError: pass
    # teste de telas
    r=subprocess.run(['node','tpv.js'],cwd=os.path.dirname(os.path.abspath(__file__)),env=dict(os.environ,GDIR=gd,OUT=tmp),capture_output=True,text=True,timeout=180)
    out=r.stdout+r.stderr
    ruins=[l for l in out.splitlines() if re.search(r'TypeError|ReferenceError|SyntaxError|is not defined|Cannot read',l)]
    if r.returncode!=0 or ruins: E('teste das telas do Ginásio falhou: '+' | '.join(ruins[:4] or [out[-300:]]))
    else:
        for n in ['e1_inicio','e2_minhas','e4_lista','e5_config','e6_qr','e7b_aula']:
            if not os.path.exists(tmp+'/'+n+'.png'): E('teste das telas: não gerou '+n)
# 2. Servidor
sv=P+'/1_SERVIDOR/server.js'
if os.path.exists(sv):
    r=subprocess.run(['node','--check',sv],capture_output=True,text=True)
    if r.returncode!=0: E('server.js com erro de sintaxe: '+r.stderr[:300])
    s=open(sv,encoding='utf8').read()
    if 'DATABASE_URL' in s and re.search(r'postgres(ql)?://[^\s\'"`]*:[^\s\'"`]*@',s): E('server.js parece ter senha de banco escrita no código')
    if ANT and os.path.exists(ANT+'/1_SERVIDOR/server.js'):
        a=os.path.getsize(ANT+'/1_SERVIDOR/server.js'); n=os.path.getsize(sv)
        if n<a*0.97: E('server.js encolheu %d%%'%(100-n*100//a))
else: E('falta 1_SERVIDOR/server.js')
# 3. Site
site=P+'/2_SITE_pasta_public'
for h in glob.glob(site+'/*.html')+glob.glob(site+'/aluno/*.html'):
    t=open(h,encoding='utf8').read()
    for i,blk in enumerate(re.findall(r'<script>([\s\S]*?)</script>',t)):
        f=tmp+'/blk.js'; open(f,'w').write(blk); r,m=node_check_js(f)
        if not r: E('%s: erro de sintaxe no script %d: %s'%(os.path.relpath(h,P),i+1,m))
    if ANT:
        ah=h.replace(P,ANT)
        if os.path.exists(ah) and os.path.getsize(h)<os.path.getsize(ah)*0.95 and os.path.basename(h) not in os.environ.get('ENCOLHE_OK','').split(','): E(os.path.relpath(h,P)+' encolheu mais de 5%')   # ENCOLHE_OK=arq.html: corte de propósito, conferido à mão
if not os.path.exists(site+'/img/logo-prorider.png'): E('falta public/img/logo-prorider.png')
# 4. Registros
for f in ['00_LEIA-PRIMEIRO.md','MENSAGEM_DESENVOLVEDOR_'+ver+'.md','4_REGISTROS/CHANGELOG.md']:
    if not os.path.exists(P+'/'+f): E('falta '+f)
lm=open(P+'/00_LEIA-PRIMEIRO.md',encoding='utf8').read() if os.path.exists(P+'/00_LEIA-PRIMEIRO.md') else ''
if verb not in lm: E('00_LEIA-PRIMEIRO não cita '+verb)
outras=set(re.findall(r'GINASIO_(\d\d-\d\d[a-z])',lm))-{gver}
if outras: E('00_LEIA-PRIMEIRO cita zip de outra versão: '+', '.join(outras))
shutil.rmtree(tmp,ignore_errors=True)
print('CONFERÊNCIA DO PACOTE',ver)
for a in avisos: print('  aviso:',a)
for e in erros: print('  ERRO:',e)
print('  RESULTADO:','OK — pode entregar' if not erros else '%d erro(s) — NÃO entregar'%len(erros))
sys.exit(1 if erros else 0)
