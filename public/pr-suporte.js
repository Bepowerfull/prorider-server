/* ProRider — 03/10e: "Esqueci minha senha" e "Reportar um problema", iguais em todas as páginas
   (Portal, admin, página do financeiro e app). Uso:
     prEsqueciSenha(SERVIDOR, emailJaDigitado)
     prReportar(SERVIDOR, token, 'app'|'portal'|'financeiro', nomeDaTela, versao)
   03/10f — erros de JavaScript chegam sozinhos na "Saúde do sistema" do admin:
     prErroConfig(SERVIDOR, 'app'|'portal'|'financeiro'|'admin', function(){ return token; }, versao)
     prErro('mensagem', 'erro'|'aviso')   ← para avisar algo importante de propósito  */
(function () {
  // ── 03/10f: ERROS DA TELA → SAÚDE DO SISTEMA ──────────────────
  // Junta os erros por 2 s e manda em lote. O mesmo erro só uma vez a cada 10 min,
  // no máximo 30 por página aberta. Queda de internet não conta como erro.
  var _cfg = null, _fila = [], _vistos = {}, _n = 0, _t = null, _codigos = [], _toastEm = 0;
  // 03/10h: cada erro ganha um código curto (E-7F3A) que aparece no canto da tela.
  // O cliente lê o código para a ProRider, que acha o erro na lupinha da Saúde do sistema.
  function _novoCodigo() { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = ''; for (var i = 0; i < 4; i++) c += a[Math.floor(Math.random() * a.length)]; return 'E-' + c; }
  function _mostrarCodigo(cod) {
    if (Date.now() - _toastEm < 30000 || !document.body) return; _toastEm = Date.now(); css();
    var t = document.createElement('div'); t.className = 'prs-err';
    t.innerHTML = '<span>⚠️ Algo deu errado aqui · código <b>' + cod + '</b></span><button type="button">Reportar</button>';
    t.querySelector('button').onclick = function () { t.remove(); if (_cfg) { var tk = ''; try { tk = typeof _cfg.tk === 'function' ? _cfg.tk() : _cfg.tk; } catch (e) {} window.prReportar(_cfg.base, tk, _cfg.origem, _tela(), _cfg.versao); } };
    document.body.appendChild(t); setTimeout(function () { t.remove(); }, 9000);
  }
  window.prCodigos = function () { return _codigos.slice(-3); };
  function _tela() { var a = document.querySelector('.screen.active,.page.active'); return (a && a.id) || location.pathname.split('/').pop() || ''; }
  window.prErro = function (msg, nivel, stack, onde) {
    try {
      msg = String(msg || '').replace(/\s+/g, ' ').trim().slice(0, 400);
      if (!msg || /^Script error\.?$/i.test(msg) || /ResizeObserver loop/i.test(msg)) return;
      var ag = Date.now(), k = (nivel || 'erro') + '|' + msg;
      if (_vistos[k] && ag - _vistos[k] < 600000) return; _vistos[k] = ag;
      if (++_n > 30) return;
      var cod = nivel === 'aviso' ? '' : _novoCodigo(); if (cod) { _codigos.push(cod); _mostrarCodigo(cod); }
      _fila.push({ nivel: nivel === 'aviso' ? 'aviso' : 'erro', msg: msg, stack: String(stack || '').slice(0, 1500), onde: onde || '', tela: _tela(), quando: new Date().toISOString(), codigo: cod });
      _agenda(2000);
    } catch (e) {}
  };
  function _agenda(ms) { if (_t || !_cfg) return; _t = setTimeout(_enviar, ms); }
  function _enviar() {
    _t = null; if (!_cfg || !_fila.length) return;
    var lote = _fila.splice(0, 20), h = { 'Content-Type': 'application/json' }, tk = '';
    try { tk = typeof _cfg.tk === 'function' ? _cfg.tk() : _cfg.tk; } catch (e) {}
    if (tk) h.Authorization = 'Bearer ' + tk;
    fetch(_cfg.base + '/suporte/erro', { method: 'POST', headers: h, keepalive: true,
      body: JSON.stringify({ origem: _cfg.origem, versao: _cfg.versao || '', aparelho: navigator.userAgent + ' · ' + screen.width + 'x' + screen.height, erros: lote }) })
      .then(function () { if (_fila.length) _agenda(1000); })
      .catch(function () { _fila = lote.concat(_fila).slice(0, 30); });   // sem internet: tenta quando voltar
  }
  window.prErroConfig = function (base, origem, tk, versao) { _cfg = { base: base || '', origem: origem, tk: tk, versao: versao }; _agenda(1500); };
  window.addEventListener('online', function () { _agenda(1500); });
  window.addEventListener('error', function (e) {
    if (!e || !e.message || /^(chrome|moz|safari(-web)?)-extension:/.test(e.filename || '')) return;
    window.prErro(e.message, 'erro', e.error && e.error.stack, String(e.filename || '').split('/').pop() + ':' + (e.lineno || ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var m = e && e.reason ? (e.reason.message || String(e.reason)) : 'promessa rejeitada';
    if (/Failed to fetch|NetworkError|Load failed|AbortError|network|The user aborted/i.test(m)) return;
    window.prErro(m, 'erro', e.reason && e.reason.stack, 'promise');
  });
  function css() {
    if (document.getElementById('prSupCss')) return;
    var s = document.createElement('style'); s.id = 'prSupCss';
    s.textContent = '.prs-ov{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Barlow,Arial,sans-serif}'
      + '.prs-bx{width:100%;max-width:420px;background:#16161a;border:1px solid #2c2c34;border-radius:18px;padding:20px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)}'
      + '.prs-bx h3{margin:0 0 6px;font:900 22px "Barlow Condensed",Barlow,sans-serif;letter-spacing:1px}'
      + '.prs-bx p{margin:0 0 12px;font-size:13.5px;line-height:1.5;color:rgba(255,255,255,.65)}'
      + '.prs-bx input,.prs-bx textarea{width:100%;box-sizing:border-box;padding:12px 13px;border-radius:11px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);color:#fff;font:15px Barlow,Arial,sans-serif;outline:none;margin-bottom:10px}'
      + '.prs-bx textarea{min-height:110px;resize:vertical}'
      + '.prs-ac{display:flex;gap:8px;margin-top:4px}'
      + '.prs-ac button{flex:1;padding:12px;border-radius:12px;font:800 14px Barlow,Arial,sans-serif;cursor:pointer;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:rgba(255,255,255,.8)}'
      + '.prs-ac .pri{border:none;background:linear-gradient(135deg,#ffb02e,#ea860c);color:#16161a}'
      + '.prs-msg{font-size:13px;line-height:1.5;margin:8px 0 0;color:#ffc27a}'
      + '.prs-err{position:fixed;right:14px;bottom:14px;z-index:2147482000;display:flex;gap:10px;align-items:center;max-width:calc(100vw - 28px);background:#1d1d22;border:1px solid rgba(255,170,60,.45);color:#fff;border-radius:12px;padding:9px 10px 9px 14px;font:13px Barlow,Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45)}'
      + '.prs-err b{color:#ffc27a;letter-spacing:.5px}.prs-err button{border:none;border-radius:9px;padding:7px 11px;font:800 12px Barlow,Arial,sans-serif;background:linear-gradient(135deg,#ffb02e,#ea860c);color:#16161a;cursor:pointer}';
    document.head.appendChild(s);
  }
  function caixa(html) {
    css(); var o = document.createElement('div'); o.className = 'prs-ov';
    o.innerHTML = '<div class="prs-bx">' + html + '</div>';
    o.addEventListener('click', function (e) { if (e.target === o) o.remove(); });
    document.body.appendChild(o); return o;
  }
  window.prEsqueciSenha = function (base, email) {
    var o = caixa('<h3>ESQUECI MINHA SENHA</h3><p>Digite o e-mail da sua conta. Mandamos um link para você criar uma senha nova (vale 1 hora).</p>'
      + '<input type="email" id="prsEmail" placeholder="seu@email.com" autocomplete="username">'
      + '<div class="prs-ac"><button type="button" data-x>Cancelar</button><button type="button" class="pri" data-ok>Mandar o link</button></div><div class="prs-msg" id="prsMsg"></div>');
    var inp = o.querySelector('#prsEmail'), msg = o.querySelector('#prsMsg'), bt = o.querySelector('[data-ok]');
    inp.value = email || ''; setTimeout(function () { inp.focus(); }, 50);
    o.querySelector('[data-x]').onclick = function () { o.remove(); };
    bt.onclick = function () {
      var e = inp.value.trim(); if (!/@/.test(e)) { msg.textContent = 'Digite o seu e-mail.'; return; }
      bt.disabled = true; msg.textContent = 'Enviando…';
      fetch(base + '/user/esqueci-senha', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          msg.style.color = d.error ? '#ff9a9a' : '#9ee39e'; msg.textContent = d.error || d.msg || 'Pronto.';
          if (!d.error) { bt.style.display = 'none'; o.querySelector('[data-x]').textContent = 'Fechar'; } else bt.disabled = false;
        }).catch(function () { msg.textContent = 'Sem conexão com o servidor.'; bt.disabled = false; });
    };
  };
  window.prReportar = function (base, token, origem, tela, versao) {
    var o = caixa('<h3>REPORTAR UM PROBLEMA</h3><p>Conte o que aconteceu: o que você tentou fazer e o que apareceu. A ProRider recebe junto a tela e a versão do sistema.</p>'
      + '<textarea id="prsTxt" maxlength="2000" placeholder="Ex.: na aula das 18h a bike 7 não aparecia na TV"></textarea>'
      + (token ? '' : '<input type="email" id="prsEm" placeholder="Seu e-mail (para a gente responder)">')
      + '<div class="prs-ac"><button type="button" data-x>Cancelar</button><button type="button" class="pri" data-ok>Enviar</button></div><div class="prs-msg" id="prsMsg"></div>');
    var tx = o.querySelector('#prsTxt'), msg = o.querySelector('#prsMsg'), bt = o.querySelector('[data-ok]');
    setTimeout(function () { tx.focus(); }, 50);
    o.querySelector('[data-x]').onclick = function () { o.remove(); };
    bt.onclick = function () {
      var t = tx.value.trim(); if (t.length < 5) { msg.textContent = 'Escreva um pouco mais.'; return; }
      bt.disabled = true; msg.textContent = 'Enviando…';
      var h = { 'Content-Type': 'application/json' }; if (token) h.Authorization = 'Bearer ' + token;
      var em = o.querySelector('#prsEm');
      var cs = window.prCodigos ? window.prCodigos() : []; if (cs.length) t += '\n[códigos de erro: ' + cs.join(' ') + ']';   // 03/10h
      fetch(base + '/suporte/relato', { method: 'POST', headers: h, body: JSON.stringify({ texto: t, origem: origem, tela: tela || '', versao: versao || '', email: em ? em.value.trim() : '', aparelho: navigator.userAgent + ' · ' + screen.width + 'x' + screen.height }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d.error) { msg.style.color = '#ff9a9a'; msg.textContent = d.error; bt.disabled = false; return; }
          msg.style.color = '#9ee39e'; msg.textContent = 'Recebido! Obrigado — a ProRider já foi avisada.'; bt.style.display = 'none'; o.querySelector('[data-x]').textContent = 'Fechar';
        }).catch(function () { msg.textContent = 'Sem conexão com o servidor.'; bt.disabled = false; });
    };
  };
})();
