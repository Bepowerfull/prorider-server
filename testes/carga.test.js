// 03/10x — TESTE DE CARGA dentro da bateria: roda a ferramenta de carga contra o servidor de teste.
// Cenário 1: o dia 17/10 multiplicado (3 academias x 15 bikes).  Cenário 2: 30 academias x 20 bikes.
const path = require('path');
const { spawnSync } = require('child_process');
const BASE = 'http://127.0.0.1:' + (process.env.PORT || 3999);
const FERR = path.join(__dirname, '..', 'ferramentas', 'teste-carga.js');
let falhou = 0;
function rodar(nome, acad, bikes, seg, p95) {
  const r = spawnSync(process.execPath, [FERR, BASE], { encoding: 'utf8', timeout: (seg + 120) * 1000,
    env: Object.assign({}, process.env, { CARGA_JWT_SECRET: process.env.JWT_SECRET, ACADEMIAS: String(acad), BIKES: String(bikes), SEGUNDOS: String(seg), LIMITE_P95_MS: String(p95) }) });
  const out = (r.stdout || '') + (r.stderr || '');
  const res = out.split('══════════ RESULTADO ══════════')[1] || out.slice(-1500);
  console.log('  ' + nome + ':' + res.replace(/\n/g, '\n    ').trimEnd());
  if (r.status !== 0) { falhou++; console.log('  ✗ ' + nome + ' REPROVADO'); } else console.log('  ✓ ' + nome);
}
// a ferramenta recusa o domínio de produção
const p = spawnSync(process.execPath, [FERR, 'https://app.prorider.app.br'], { encoding: 'utf8', env: Object.assign({}, process.env, { CARGA_JWT_SECRET: 'x' }) });
if (p.status === 2) console.log('  ✓ recusa rodar contra app.prorider.app.br'); else { falhou++; console.log('  ✗ NÃO recusou produção'); }
const s = spawnSync(process.execPath, [FERR, BASE], { encoding: 'utf8', env: Object.assign({}, process.env, { CARGA_JWT_SECRET: '', JWT_SECRET: '' }) });
if (s.status === 2) console.log('  ✓ sem o segredo do servidor, não roda'); else { falhou++; console.log('  ✗ rodou sem segredo'); }
rodar('3 academias x 15 bikes (17/10 x 3)', 3, 15, parseInt(process.env.CARGA_SEG || '20'), 300);
rodar('30 academias x 20 bikes', 30, 20, parseInt(process.env.CARGA_SEG || '30'), 500);
process.exit(falhou ? 1 : 0);
