// 03/10y — REDE DE MENTIRA para os testes: um proxy TCP entre o aparelho e o servidor.
//  lenta(ms, variacao)  internet lenta (3G, Wi-Fi cheio): atraso sem trocar a ordem
//  travar(ms)           Wi-Fi engasga: segura tudo e solta de uma vez
//  sumir()              a internet some SEM AVISO (o caso real): nada passa, as conexões ficam
//                       "abertas" e mudas, como quando o roteador perde o sinal. Quem percebe é o
//                       batimento (ping) de cada lado.
//  cortar()             queda com aviso: derruba as conexões e recusa as novas
//  voltar()             a internet volta (o que estava preso é entregue, como o TCP faz)
const net = require('net');
function rede(alvoPorta, alvoHost = '127.0.0.1') {
  const pares = new Set(), filas = new Set(); let penduradas = [];
  const st = { atraso: 0, variacao: 0, travadoAte: 0, sumiu: false, cortado: false };
  const bombear = () => { for (const f of filas) f.bombear(); };
  const srv = net.createServer(cli => {
    if (st.cortado) { cli.destroy(); return; }
    const up = net.connect(alvoPorta, alvoHost);
    const par = { cli, up }; pares.add(par);
    const mk = (de, para) => { const q = []; let ult = 0, tm = null;
      const f = { bombear() {
        if (tm) { clearTimeout(tm); tm = null; }
        while (q.length) {
          if (st.sumiu) return;
          const espera = Math.max(q[0].t, st.travadoAte) - Date.now();
          if (espera > 0) { tm = setTimeout(f.bombear, espera); return; }
          const b = q.shift().b; if (!para.destroyed) para.write(b);
        } } };
      de.on('data', b => { const t = Math.max(ult, Date.now() + st.atraso + Math.random() * st.variacao); ult = t; q.push({ t, b }); f.bombear(); });
      filas.add(f); return f; };
    const f1 = mk(cli, up), f2 = mk(up, cli);
    // com a internet "sumida", o aviso de fechamento de um lado também não chega ao outro (fica preso até voltar)
    const fim = () => { if (st.sumiu) { penduradas.push(() => { pares.delete(par); filas.delete(f1); filas.delete(f2); cli.destroy(); up.destroy(); }); return; }
      pares.delete(par); filas.delete(f1); filas.delete(f2); cli.destroy(); up.destroy(); };
    cli.on('error', fim); up.on('error', fim); cli.on('close', fim); up.on('close', fim);
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({
    porta: srv.address().port,
    lenta(atraso, variacao = 0) { st.atraso = atraso; st.variacao = variacao; },
    travar(ms) { st.travadoAte = Date.now() + ms; bombear(); },
    sumir() { st.sumiu = true; },
    cortar() { st.cortado = true; for (const p of [...pares]) { p.cli.destroy(); p.up.destroy(); } },
    voltar() { st.sumiu = false; st.cortado = false; st.travadoAte = 0; bombear(); const p = penduradas; penduradas = []; setTimeout(() => p.forEach(f => f()), 50); },
    conexoes() { return pares.size; },
    fechar() { this.cortar(); srv.close(); }
  })));
}
module.exports = { rede };
