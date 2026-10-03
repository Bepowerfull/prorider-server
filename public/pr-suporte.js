/* ProRider — 03/10e: "Esqueci minha senha" e "Reportar um problema", iguais em todas as páginas
   (Portal, admin, página do financeiro e app). Uso:
     prEsqueciSenha(SERVIDOR, emailJaDigitado)
     prReportar(SERVIDOR, token, 'app'|'portal'|'financeiro', nomeDaTela, versao)  */
(function () {
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
      + '.prs-msg{font-size:13px;line-height:1.5;margin:8px 0 0;color:#ffc27a}';
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
      fetch(base + '/suporte/relato', { method: 'POST', headers: h, body: JSON.stringify({ texto: t, origem: origem, tela: tela || '', versao: versao || '', email: em ? em.value.trim() : '', aparelho: navigator.userAgent + ' · ' + screen.width + 'x' + screen.height }) })
        .then(function (r) { return r.json(); }).then(function (d) {
          if (d.error) { msg.style.color = '#ff9a9a'; msg.textContent = d.error; bt.disabled = false; return; }
          msg.style.color = '#9ee39e'; msg.textContent = 'Recebido! Obrigado — a ProRider já foi avisada.'; bt.style.display = 'none'; o.querySelector('[data-x]').textContent = 'Fechar';
        }).catch(function () { msg.textContent = 'Sem conexão com o servidor.'; bt.disabled = false; });
    };
  };
})();
