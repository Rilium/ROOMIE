import {bg,bebas,sub,label,image,overlay,cta,chip,text,page,IMG,C} from './common.mjs';

export async function slide17(presentation,ctx){
  const s=presentation.slides.add();
  bg(s,ctx);
  await image(s,ctx,IMG+'/roomie-hero-slide-2.jpg',0,0,1280,720);
  overlay(s,ctx,.68);
  label(s,ctx,'THANK YOU',72,58);
  bebas(s,ctx,"CI VEDIAMO\nDENTRO.",72,132,520,220,{size:78,color:C.neon});
  sub(s,ctx,'ROOMIE · Via Terni, Torino',76,382,430,{size:24});
  cta(s,ctx,'roomie.rilio.it',76,500,330,72);
  chip(s,ctx,530,504,78);
  text(s,ctx,'CONTATTI',770,392,180,24,{size:18,color:C.neon,face:'Barlow',bold:true});
  text(s,ctx,'roomie.rilio.it\ninstagram.com/roomie\nhello@roomie.rilio.it',770,438,360,108,{size:24,color:C.white,face:'Barlow',bold:false});
  page(s,ctx,17);
  return s;
}
