/* PRParticles — sistema de fogo realista por zona
   Canvas full-screen z-index:1, atrás da UI.
   Emissão centrada no topo da tela (acima do painel de bloco). */

var PRParticles = (function(){
  var canvas, ctx, W, H, raf, zone=4, running=false;

  // Paletas por zona
  var PALETTES = {
    1: { core:[[160,220,255],[120,180,240],[80,140,220]], ember:[180,220,255], bg:'rgba(0,5,20,.06)' }, // azul gelo
    2: { core:[[80,220,180],[40,200,150],[20,160,120]], ember:[100,240,200], bg:'rgba(0,10,12,.06)' }, // teal
    3: { core:[[255,200,40],[255,160,20],[220,120,0]],  ember:[255,220,80],  bg:'rgba(12,8,0,.06)'  }, // âmbar
    4: { core:[[255,140,0],[255,100,0],[220,60,0]],    ember:[255,180,50],  bg:'rgba(14,5,0,.06)'  }, // laranja
    5: { core:[[255,80,0],[255,40,0],[200,20,0]],      ember:[255,140,20],  bg:'rgba(16,2,0,.06)'  }, // laranja-vermelho
    6: { core:[[255,60,0],[255,20,0],[180,0,0]],       ember:[255,120,0],   bg:'rgba(18,0,0,.07)'  }, // fogo intenso
    7: { core:[[255,255,200],[255,200,255],[160,120,255]], ember:[255,255,255], bg:'rgba(8,0,20,.07)' } // elétrico
  };

  var particles=[], MAX=220;
  var t=0;

  function Particle(type){
    var pal=PALETTES[zone]||PALETTES[4];
    var intensity = zone/7; // 0→1

    // Zona de emissão: centro horizontal, painel de bloco no topo
    // emite na faixa y≈130–160px, largura ≈ 480px centrada
    var emitW = Math.min(W*0.42, 260);
    this.x = W/2 + (Math.random()-0.5)*emitW*2;
    this.y = 148 + Math.random()*24;

    this.type = type; // 'fire', 'ember', 'smoke'

    if(type==='fire'){
      var c = pal.core[Math.floor(Math.random()*pal.core.length)];
      this.r0=c[0]; this.g0=c[1]; this.b0=c[2];
      this.size  = 14 + Math.random()*22 + intensity*12;
      this.vx    = (Math.random()-0.5)*0.6;
      this.vy    = -(1.4 + Math.random()*2.2 + intensity*1.2);
      this.life  = 0.9 + Math.random()*0.5;
      this.decay = 0.012 + Math.random()*0.010 + intensity*0.004;
      this.turbF = 0.6 + Math.random()*1.0;
      this.phase = Math.random()*Math.PI*2;
    } else if(type==='ember'){
      this.r0=pal.ember[0]; this.g0=pal.ember[1]; this.b0=pal.ember[2];
      this.size  = 1.5 + Math.random()*2.5;
      this.vx    = (Math.random()-0.5)*1.8;
      this.vy    = -(2.5 + Math.random()*3.5 + intensity*2);
      this.life  = 1.0;
      this.decay = 0.018 + Math.random()*0.014;
      this.turbF = 1.2;
      this.phase = Math.random()*Math.PI*2;
    } else { // smoke
      this.r0=90; this.g0=90; this.b0=100;
      this.size  = 28 + Math.random()*40;
      this.vx    = (Math.random()-0.5)*0.4;
      this.vy    = -(0.4 + Math.random()*0.7);
      this.life  = 0.22 + Math.random()*0.12;
      this.decay = 0.004 + Math.random()*0.003;
      this.turbF = 0.3;
      this.phase = Math.random()*Math.PI*2;
    }
    this.alpha = this.life;
  }

  Particle.prototype.update = function(){
    t += 0;
    // Turbulência horizontal
    this.vx += Math.sin(t*2.1 + this.phase)*0.04*this.turbF;
    this.x  += this.vx;
    this.y  += this.vy;
    // Amortecimento leve
    this.vx *= 0.98;
    this.life -= this.decay;
    this.alpha = Math.max(0, this.life);
  };

  Particle.prototype.draw = function(){
    if(this.alpha<=0) return;
    var lifeRatio = this.alpha / (this.type==='fire'?1.4:1.0);
    var sz = this.size * (0.5 + lifeRatio*0.5);

    if(this.type==='fire'){
      // Partícula de fogo: gradiente radial branco no centro → cor → transparente
      var grd = ctx.createRadialGradient(this.x,this.y,0, this.x,this.y,sz);
      // Centro branco/amarelo quente
      var cr=Math.min(255,this.r0+60), cg=Math.min(255,this.g0+60), cb=Math.min(255,this.b0+20);
      grd.addColorStop(0,   'rgba('+cr+','+cg+','+cb+','+Math.min(0.95,this.alpha*0.9)+')');
      grd.addColorStop(0.35,'rgba('+this.r0+','+this.g0+','+this.b0+','+Math.min(0.7,this.alpha*0.6)+')');
      grd.addColorStop(0.7, 'rgba('+this.r0+','+Math.max(0,this.g0-40)+','+Math.max(0,this.b0-20)+','+Math.min(0.3,this.alpha*0.25)+')');
      grd.addColorStop(1,   'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, sz, 0, Math.PI*2);
      ctx.fillStyle = grd;
      ctx.fill();
    } else if(this.type==='ember'){
      // Brasa: círculo pequeno com glow
      ctx.save();
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba('+this.r0+','+this.g0+','+this.b0+',0.9)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, sz, 0, Math.PI*2);
      ctx.fillStyle = 'rgba('+this.r0+','+this.g0+','+this.b0+','+Math.min(1,this.alpha)+')';
      ctx.fill();
      ctx.restore();
    } else { // smoke
      var grd2 = ctx.createRadialGradient(this.x,this.y,0, this.x,this.y,sz);
      grd2.addColorStop(0,  'rgba('+this.r0+','+this.g0+','+this.b0+','+Math.min(0.12,this.alpha*0.5)+')');
      grd2.addColorStop(1,  'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, sz, 0, Math.PI*2);
      ctx.fillStyle = grd2;
      ctx.fill();
    }
  };

  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function spawnBurst(){
    var intensity = zone/7;
    // Número de partículas por frame
    var firePerFrame  = Math.floor(2.5 + intensity*3.5);
    var emberPerFrame = Math.random() < (0.15 + intensity*0.4) ? 1 : 0;
    var smokePerFrame = Math.random() < (0.08 + intensity*0.06) ? 1 : 0;

    for(var i=0;i<firePerFrame;i++){
      if(particles.length<MAX) particles.push(new Particle('fire'));
    }
    if(emberPerFrame && particles.length<MAX) particles.push(new Particle('ember'));
    if(smokePerFrame && particles.length<MAX) particles.push(new Particle('smoke'));
  }

  function loop(){
    if(!running) return;
    t += 0.016;
    raf = requestAnimationFrame(loop);

    var pal = PALETTES[zone]||PALETTES[4];
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0,0,W,H);

    spawnBurst();

    // Desenhar smoke primeiro (atrás), depois fire, depois ember
    var smoke=[], fire=[], ember=[];
    particles = particles.filter(function(p){ return p.life>0; });
    particles.forEach(function(p){
      p.update();
      if(p.type==='smoke') smoke.push(p);
      else if(p.type==='fire') fire.push(p);
      else ember.push(p);
    });
    smoke.forEach(function(p){p.draw();});
    fire.forEach(function(p){p.draw();});
    ember.forEach(function(p){p.draw();});
  }

  return {
    init: function(opts){
      canvas = document.getElementById(opts.canvasId);
      if(!canvas) return;
      ctx = canvas.getContext('2d');
      zone = opts.zone||4;
      resize();
      window.addEventListener('resize', resize);
      running = true;
      loop();
    },
    setZone: function(z){
      zone = Math.max(1, Math.min(7, z));
      particles = []; // limpa ao mudar de zona para transição limpa
    },
    stop: function(){
      running = false;
      if(raf) cancelAnimationFrame(raf);
    }
  };
})();
