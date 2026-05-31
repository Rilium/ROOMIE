import {bg,bebas,label,text,card,chip,page,C} from './common.mjs';

export async function slide02(presentation,ctx){
  const s=presentation.slides.add();
  bg(s,ctx);
  label(s,ctx,'INDICE',72,58);
  bebas(s,ctx,"IL RITUALE\nROOMIE.",72,132,440,190,{size:82,color:C.neon});
  const items=[
    ['01','Problema','uscire e trovare posto'],
    ['02','Prodotto','prenoti un mood'],
    ['03','Accesso','codici, serranda, porta'],
    ['04','Sessione','chips, shop, live mode'],
    ['05','Loop','torni, inviti, ripeti']
  ];
  items.forEach((it,i)=>{
    const y=95+i*102;
    card(s,ctx,620,y,500,74,{fill:i===1?'rgba(200,255,0,.08)':'#111',stroke:i===1?C.neon:'rgba(255,255,255,.16)'});
    text(s,ctx,it[0],650,y+22,58,24,{size:20,color:i===1?C.neon:C.muted,face:'JetBrains Mono'});
    text(s,ctx,it[1],725,y+14,190,28,{size:29,color:C.white,face:'Barlow Condensed'});
    text(s,ctx,it[2],725,y+44,280,18,{size:15,color:C.muted,face:'Barlow',bold:false});
  });
  chip(s,ctx,390,465,118);
  page(s,ctx,2);
  return s;
}
