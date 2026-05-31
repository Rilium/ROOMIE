export const W = 1280;
export const H = 720;
export const C = { bg:'#050505', panel:'#111111', panel2:'#181818', neon:'#C8FF00', cyan:'#00FFD1', white:'#FFFFFF', muted:'#9B9B9B', line:'#2C2C2C', orange:'#FF6A1A' };
export const A = '/Users/Rilio/Documents/ROOMIE/outputs/manual-roomie-keynote/presentations/roomie-launch-keynote/assets/jpeg/screens';
export const IMG = '/Users/Rilio/Documents/ROOMIE/outputs/manual-roomie-keynote/presentations/roomie-launch-keynote/assets/jpeg/images';
export const SEO = '/Users/Rilio/Documents/ROOMIE/public/assets/seo';
export function bg(slide, ctx, fill=C.bg){ ctx.addShape(slide,{x:0,y:0,w:W,h:H,fill,line:{fill, width:0}}); }
export function text(slide, ctx, t, x, y, w, h, opt={}){ return ctx.addText(slide,{text:t,x,y,w,h,fontSize:opt.size||28,color:opt.color||C.white,bold:opt.bold??true,typeface:opt.face||'Barlow Condensed',align:opt.align||'left',valign:opt.valign||'top',insets:opt.insets||{left:0,right:0,top:0,bottom:0},fill:opt.fill||'transparent',line:opt.line||{fill:'transparent',width:0},name:opt.name}); }
export function bebas(slide, ctx, t, x, y, w, h, opt={}){ return text(slide,ctx,t,x,y,w,h,{...opt,face:'Bebas Neue',size:opt.size||86,bold:true}); }
export function label(slide, ctx, t, x, y, w=300, color=C.neon){ return text(slide,ctx,t,x,y,w,24,{size:15,color,face:'Barlow',bold:true,insets:{left:0,right:0,top:0,bottom:0}}); }
export function sub(slide, ctx, t, x, y, w, opt={}){ return text(slide,ctx,t,x,y,w,opt.h||78,{size:opt.size||25,color:opt.color||'#D8D8D8',face:'Barlow',bold:opt.bold??false}); }
export function card(slide, ctx, x, y, w, h, opt={}){ return ctx.addShape(slide,{x,y,w,h,fill:opt.fill||'#121212',line:{fill:opt.stroke||'rgba(255,255,255,0.16)',width:opt.width||1},geometry:'roundRect'}); }
export async function image(slide, ctx, path, x, y, w, h, fit='cover', alt='ROOMIE'){ return ctx.addImage(slide,{path,x,y,w,h,fit,alt}); }
export function overlay(slide, ctx, alpha=0.58){ ctx.addShape(slide,{x:0,y:0,w:W,h:H,fill:'rgba(0,0,0,'+alpha+')',line:{fill:'transparent',width:0}}); }
export function chip(slide, ctx, x, y, s=88){ ctx.addShape(slide,{x,y,w:s,h:s,geometry:'ellipse',fill:C.neon,line:{fill:'#E6FF7A',width:3}}); ctx.addShape(slide,{x:x+s*.12,y:y+s*.12,w:s*.76,h:s*.76,geometry:'ellipse',fill:'#0A0A0A',line:{fill:'#FFFFFF',width:2}}); ctx.addShape(slide,{x:x+s*.27,y:y+s*.27,w:s*.46,h:s*.46,geometry:'ellipse',fill:C.neon,line:{fill:'#E6FF7A',width:2}}); text(slide,ctx,'R',x+s*.39,y+s*.30,s*.22,s*.24,{size:s*.28,color:'#050505',face:'Barlow Condensed',bold:true,align:'center',valign:'mid'}); }
export function page(slide, ctx, n){ text(slide,ctx,String(n).padStart(2,'0'),1190,672,48,20,{size:13,color:'#666',face:'JetBrains Mono',bold:true,align:'right'}); }
export function cta(slide, ctx, t, x, y, w, h){ ctx.addShape(slide,{x,y,w,h,geometry:'roundRect',fill:C.neon,line:{fill:C.neon,width:1}}); text(slide,ctx,t,x,y+14,w,h-10,{size:24,color:'#060606',face:'Barlow Condensed',bold:true,align:'center'}); }