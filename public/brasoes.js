/* ProRider — BRASÕES (29/09b: Aquecimento, Cadência e Pelotão antes do Bronze)
 * Uma fonte só para o desenho dos brasões: app, portal do aluno, Portal,
 * página pública e Ginásio (cópia em gin/brasoes.js — manter iguais).
 * A escada de pontos é a mesma do servidor (NIVEIS em server.js).
 *
 *   prNivel(pontosOuChave)   -> {key, nome, tier, div, pts, cor, ...}
 *   prProgresso(pontos)      -> {atual, prox, faltam, pct}
 *   prBrasaoSVG(nivel, px)   -> string <svg> (nivel = chave, pontos ou objeto)
 */
(function (W) {
  var TIERS = {
    aquecimento: { nome: 'Aquecimento', c: ['#e2e2e8', '#8a8a94', '#3a3a42', '#ffffff'] },
    cadencia: { nome: 'Cadência', c: ['#dfe9f5', '#7f97b3', '#2c3a4d', '#eaf3ff'] },
    pelotao:  { nome: 'Pelotão',  c: ['#f0c6a8', '#8b5e4a', '#2b1f1a', '#ffd9c2'] },
    bronze:   { nome: 'Bronze',   c: ['#f3c79a', '#c9814a', '#6e3c1b', '#ffe0bf'] },
    prata:    { nome: 'Prata',    c: ['#ffffff', '#b9c2cc', '#56606b', '#ffffff'] },
    ouro:     { nome: 'Ouro',     c: ['#fff3a8', '#f0b92a', '#8a5a07', '#fffbe0'] },
    platina:  { nome: 'Platina',  c: ['#e6fffb', '#7fd8cf', '#1e6b68', '#ffffff'] },
    diamante: { nome: 'Diamante', c: ['#e5f6ff', '#5bc4ff', '#13468f', '#ffffff'] },
    mestre:   { nome: 'Mestre',   c: ['#f2d6ff', '#b05cff', '#44126f', '#ffe0ff'] },
    lenda:    { nome: 'Lenda',    c: ['#fff3a8', '#ea860c', '#8a1414', '#ffe033'] }
  };
  var ESCADA = [
    ['aquecimento', 0], ['cadencia', 200], ['pelotao', 400],
    ['bronze1', 600], ['bronze2', 900], ['bronze3', 1200],
    ['prata1', 1600], ['prata2', 2100], ['prata3', 2700],
    ['ouro1', 3400], ['ouro2', 4300], ['ouro3', 5300],
    ['platina1', 6500], ['platina2', 8000], ['platina3', 9700],
    ['diamante1', 11800], ['diamante2', 14300], ['diamante3', 17200],
    ['mestre', 25000], ['lenda', 35000],
  ];
  // chaves antigas (antes de 29/09a) -> degrau equivalente pelos pontos
  var ANTIGOS = { iniciante: 'aquecimento', basico: 'cadencia', intermediario: 'bronze1', avancado: 'prata2', elite: 'ouro3', master: 'platina3',
                  champion: 'diamante3', legend: 'mestre', godmode: 'lenda' };
  var ROM = ['', 'I', 'II', 'III'];
  var NIVEIS = ESCADA.map(function (e, i) {
    var m = /^([a-z]+)(\d)?$/.exec(e[0]), tier = m[1], div = m[2] ? parseInt(m[2], 10) : 0, T = TIERS[tier];
    return { key: e[0], tier: tier, div: div, pts: e[1], idx: i, cor: T.c[1], c: T.c,
             nome: T.nome + (div ? ' ' + ROM[div] : '') };
  });
  function porChave(k) {
    k = String(k || '').toLowerCase().replace(/\s+/g, '');
    k = ANTIGOS[k] || k;
    for (var i = 0; i < NIVEIS.length; i++) if (NIVEIS[i].key === k) return NIVEIS[i];
    return null;
  }
  function porPontos(p) {
    p = parseInt(p, 10) || 0; var n = NIVEIS[0];
    for (var i = 0; i < NIVEIS.length; i++) if (p >= NIVEIS[i].pts) n = NIVEIS[i];
    return n;
  }
  function prNivel(x) {
    if (x && typeof x === 'object' && x.key) return x;
    if (typeof x === 'number' || /^\d+$/.test(String(x || ''))) return porPontos(x);
    return porChave(x) || NIVEIS[0];
  }
  function prProgresso(p) {
    p = parseInt(p, 10) || 0;
    var a = porPontos(p), prox = NIVEIS[a.idx + 1] || null;
    return { atual: a, prox: prox, faltam: prox ? prox.pts - p : 0,
             pct: prox ? Math.max(0, Math.min(100, Math.round((p - a.pts) / (prox.pts - a.pts) * 100))) : 100 };
  }
  var _id = 0;
  function prBrasaoSVG(x, px, semDivisas) {
    var n = prNivel(x), c = n.c, a = c[0], b = c[1], d = c[2], e = c[3], id = 'prb' + (++_id) + '_';
    px = px || 64;
    var asas = (n.tier === 'mestre' || n.tier === 'lenda') ?
      '<g><path d="M40 70 C10 60 2 40 6 26 C18 40 30 44 44 46 Z" fill="url(#' + id + 'w)"/><path d="M40 86 C8 82 -2 64 2 50 C16 64 30 66 44 64 Z" fill="url(#' + id + 'w)" opacity=".8"/>' +
      '<path d="M110 70 C140 60 148 40 144 26 C132 40 120 44 106 46 Z" fill="url(#' + id + 'w)"/><path d="M110 86 C142 82 152 64 148 50 C134 64 120 66 106 64 Z" fill="url(#' + id + 'w)" opacity=".8"/></g>' : '';
    var coroa = n.tier === 'lenda' ? '<path d="M52 20 L60 6 L68 18 L75 2 L82 18 L90 6 L98 20 Z" fill="' + e + '" stroke="' + d + '" stroke-width="2"/>' : '';
    var chamas = n.tier === 'lenda' ? '<path d="M40 150 C50 120 60 140 58 118 C72 136 70 110 75 100 C80 110 78 136 92 118 C90 140 100 120 110 150 Z" fill="#ffe033" opacity=".35"/>' : '';
    var gema = n.tier === 'diamante' ? '<path d="M75 128 l10 10 -10 12 -10 -12z" fill="#fff" opacity=".9"/>' : '';
    // antes do Bronze: Aquecimento (raio pequeno), Cadência (raio no anel do
    // pedivela), Pelotão (raio cheio sobre três rodas do pelotão)
    var extra = '';
    if (n.tier === 'cadencia') extra = '<circle cx="75" cy="82" r="30" fill="none" stroke="' + b + '" stroke-width="5" stroke-dasharray="7 5"/>';
    if (n.tier === 'pelotao') extra = '<g fill="none" stroke="' + b + '" stroke-width="3.5"><circle cx="52" cy="118" r="9"/><circle cx="75" cy="124" r="9"/><circle cx="98" cy="118" r="9"/></g>';
    var raio = n.tier === 'aquecimento'
      ? '<path d="M82 52 L64 84 L75 84 L68 110 L88 76 L77 76 L86 52 Z" fill="' + b + '"/>'
      : n.tier === 'cadencia'
      ? extra + '<path d="M83 56 L64 88 L76 88 L69 112 L90 80 L78 80 L87 56 Z" fill="' + a + '"/>'
      : n.tier === 'pelotao'
      ? extra + '<path d="M84 40 L60 84 L74 84 L66 112 L94 70 L79 70 L90 40 Z" fill="url(#' + id + 'b)" stroke="' + e + '" stroke-width="1" stroke-opacity=".5"/>'
      : '<path d="M84 40 L58 88 L74 88 L64 124 L94 74 L78 74 L90 40 Z" fill="url(#' + id + 'b)" stroke="' + e + '" stroke-width="1.2" stroke-opacity=".6"/>';
    var div = '';
    if (n.div && !semDivisas) {
      for (var k = 0; k < n.div; k++) div += '<path transform="translate(0 ' + (k * 9) + ')" d="M62 158 L75 166 L88 158 L88 162 L75 170 L62 162 Z" fill="' + b + '"/>';
    }
    var h = (n.div && !semDivisas) ? 190 : 170;
    return '<svg class="pr-brasao" width="' + px + '" height="' + Math.round(px * h / 150) + '" viewBox="0 0 150 ' + h + '" role="img" aria-label="' + n.nome + '"><defs>' +
      '<linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset=".5" stop-color="' + b + '"/><stop offset="1" stop-color="' + d + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a + '"/><stop offset="1" stop-color="' + b + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe033"/><stop offset=".55" stop-color="#ea860c"/><stop offset="1" stop-color="#d62d2d"/></linearGradient>' +
      '<radialGradient id="' + id + 'r" cx=".5" cy=".3" r=".7"><stop offset="0" stop-color="#2a2a33"/><stop offset="1" stop-color="#0d0d12"/></radialGradient></defs>' +
      chamas + asas +
      '<path d="M75 14 L128 30 L126 88 C124 122 102 142 75 156 C48 142 26 122 24 88 L22 30 Z" fill="url(#' + id + ')"/>' +
      '<path d="M75 24 L118 37 L116 87 C114 115 97 131 75 143 C53 131 36 115 34 87 L32 37 Z" fill="url(#' + id + 'r)"/>' +
      '<path d="M75 24 L118 37 L116 87 C114 115 97 131 75 143 C53 131 36 115 34 87 L32 37 Z" fill="none" stroke="' + e + '" stroke-opacity=".35" stroke-width="1.5"/>' +
      raio + gema + coroa + div + '</svg>';
  }
  W.PR_NIVEIS = NIVEIS;
  W.prNivel = prNivel;
  W.prProgresso = prProgresso;
  W.prBrasaoSVG = prBrasaoSVG;
})(typeof window !== 'undefined' ? window : this);
