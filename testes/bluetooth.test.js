// 03/10p — leitura Bluetooth do app (FTMS, potência, cadência) com pacotes de exemplo de cada padrão
const fs=require('fs'), path=require('path');
const src=fs.readFileSync(path.join(__dirname,'..','public','aluno','index.html'),'utf8');
const ini=src.indexOf('function prFtmsParse'), fim=src.indexOf('// aplica os números na tela');
if(ini<0||fim<0){ console.error('não achei as funções de Bluetooth no app'); process.exit(1); }
const {prFtmsParse,prCpsParse,prCscParse}=new Function(src.slice(ini,fim)+'; return {prFtmsParse,prCpsParse,prCscParse};')();
const dv=a=>new DataView(Uint8Array.from(a).buffer);
let f=0; const ok=(c,t,x)=>{console.log((c?'OK ':'FALHA ')+t+(x!==undefined?' → '+JSON.stringify(x):'')); if(!c)f++;};
// Wahoo KICKR típico: flags 0x0044 (speed presente pois bit0=0, cadência, potência): speed 3250 (32.5km/h), cad 180 (90rpm), power 250
let r=prFtmsParse(dv([0x44,0x00, 0xB2,0x0C, 0xB4,0x00, 0xFA,0x00]),{}); ok(r.kmh===32.5&&r.rpm===90&&r.watts===250,'FTMS rolo (velocidade+cadência+potência)',r);
// Schwinn IC4: flags 0x0244? speed, cad, power, hr → bits 2,6,9 =0x0244 ; speed 2000, cad 160(80rpm), power 180, hr 142
r=prFtmsParse(dv([0x44,0x02, 0xD0,0x07, 0xA0,0x00, 0xB4,0x00, 142]),{}); ok(r.rpm===80&&r.watts===180&&r.hr===142,'FTMS bike com FC (Schwinn)',r);
// Tacx com bit0=1 (sem velocidade), dist (bit4) e resistência (bit5): flags 0x0075: cad 170, dist 3 bytes, res 2, power 300
r=prFtmsParse(dv([0x75,0x00, 0xAA,0x00, 1,2,3, 5,0, 0x2C,0x01]),{}); ok(r.kmh===undefined&&r.rpm===85&&r.watts===300,'FTMS sem velocidade, com distância e resistência',r);
// CPS com voltas do pedivela (flag 0x20): power 220; crank revs 10 @ t=1024, depois 11 @ t=1024+683 (≈0.667s → 90rpm)
let st={}; prCpsParse(dv([0x20,0x00, 220,0, 10,0, 0x00,0x04]),st); r=prCpsParse(dv([0x20,0x00, 230,0, 11,0, 0xAB,0x06]),st);
ok(r.watts===230&&Math.round(r.rpm)===90,'Potência (pedal/medidor) com cadência pelas voltas',r);
// CPS com equilíbrio (0x01) + torque (0x04) + crank (0x20)= 0x25
st={}; prCpsParse(dv([0x25,0x00, 200,0, 50, 0,0, 100,0, 0,0]),st); r=prCpsParse(dv([0x25,0x00, 210,0, 50, 0,0, 101,0, 0xAB,0x02]),st);
ok(r.watts===210&&Math.round(r.rpm)===90,'Potência com campos extras antes da cadência',r);
// CSC só cadência (flag 0x02)
st={}; prCscParse(dv([0x02, 5,0, 0,0]),st); r=prCscParse(dv([0x02, 6,0, 0x00,0x02]),st); ok(Math.round(r.rpm)===120,'Sensor de cadência (CSC)',r);
// contador que dá a volta (65535→0)
st={}; prCscParse(dv([0x02, 0xFF,0xFF, 0xFF,0xFF]),st); r=prCscParse(dv([0x02, 0,0, 0xFF,0x01]),st); ok(Math.round(r.rpm)===120,'contador que dá a volta',r);
console.log(f?`\n${f} FALHA(S)`:'\nbluetooth: tudo OK'); process.exit(f?1:0);
