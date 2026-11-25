'use strict';
/* R250: in-device offline QA. Deliberately does NOT access the BO photo database,
 * read user photographs, send network traffic, or persist submitted QA results.
 */
(function(){
const $=id=>document.getElementById(id);
const required=[
 ['banner','Abertura da prévia isolada','A faixa vermelha de homologação aparece no BO.'],
 ['four','Quatro fotos na primeira página','Anexe quatro imagens fictícias: devem aparecer em uma única folha.'],
 ['five','Quinta foto abre nova página','A quinta foto deve abrir a segunda folha, sem cortar as anteriores.'],
 ['nine','Nove fotos distribuídas 4 + 4 + 1','A nona foto deve aparecer sozinha na terceira folha.'],
 ['crop','Enquadramento e rotação','Ajuste zoom, posição e rotação em uma foto e salve o recorte.'],
 ['pdf','PDF legível no próprio aparelho','Gere, abra e confira o PDF de nove fotos, incluindo suas três folhas adicionais.'],
 ['reload','Descarte ao recarregar','Após conferir o PDF, recarregue o BO: as fotos não devem ser recuperadas.'],
 ['isolation','Isolamento entre BO fictício A e B','Ao selecionar BO B, as fotos do BO A não devem aparecer; voltar ao A também não deve recuperá-las.'],
 ['close','Fechamento e reabertura','Feche a aba e abra novamente: as fotos devem ter sido descartadas.']
];
const optional=[
 ['heic','HEIC / foto de câmera (opcional)','Somente foto de objeto criado para teste. Se o aparelho não oferecer HEIC, marque não aplicável.']
];
const values={auto:[],manual:{}};
function el(tag,cls,txt){
 const e=document.createElement(tag);
 if(cls)e.className=cls;
 if(txt!==undefined)e.textContent=txt;
 return e;
}
function sanitize(s){return String(s||'').replace(/[\u0000-\u001f<>]/g,' ').trim().slice(0,100)}
function renderManual(){
 const target=$('manualChecks');
 for(const [id,title,help] of required.concat(optional)){
  const item=el('div','check-item');
  const row=el('div','row');
  const label=el('strong','',title);
  const select=document.createElement('select');
  select.id='manual-'+id;
  select.setAttribute('aria-label',title);
  for(const [val,text] of [
   ['pending','Não executado'],['pass','Aprovado'],['fail','Reprovado'],
   ...(optional.some(x=>x[0]===id)?[['na','Não aplicável']]:[])
  ]){
   const o=document.createElement('option');o.value=val;o.textContent=text;select.appendChild(o);
  }
  values.manual[id]='pending';
  select.addEventListener('change',()=>{
   values.manual[id]=select.value;
   renderSummary();
  });
  row.appendChild(label);row.appendChild(select);
  item.appendChild(row);item.appendChild(el('p','',help));
  target.appendChild(item);
 }
}
async function runOne(id,name,fn){
 try{
  const detail=await fn();
  values.auto.push({id,name,status:'pass',detail:sanitize(detail||'')});
 }catch(error){
  values.auto.push({id,name,status:'fail',detail:sanitize(error&&error.message||String(error))});
 }
 renderAuto();
}
function renderAuto(){
 const area=$('autoResults');
 area.replaceChildren();
 for(const check of values.auto){
  const row=el('div','result');
  row.appendChild(el('span','',check.name+(check.detail?' — '+check.detail:'')));
  row.appendChild(el('strong',check.status==='pass'?'pass':'fail',
   check.status==='pass'?'APROVADO':'FALHA'));
  area.appendChild(row);
 }
 renderSummary();
}
function loadImg(blob){
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(blob),img=new Image();
  img.onload=()=>{URL.revokeObjectURL(url);resolve({width:img.naturalWidth,height:img.naturalHeight})};
  img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Falha ao decodificar imagem de teste'))};
  img.src=url;
 });
}
async function canvasTest(){
 const canvas=document.createElement('canvas');
 canvas.width=420;canvas.height=280;
 const g=canvas.getContext('2d');
 if(!g)throw Error('Canvas 2D indisponível');
 g.fillStyle='#183c60';g.fillRect(0,0,420,280);
 g.fillStyle='#ffcc66';g.fillRect(40,30,180,130);
 const out=[];
 for(const type of ['image/jpeg','image/png']){
  if(typeof canvas.toBlob!=='function')throw Error('Exportação de imagem indisponível');
  const blob=await new Promise((resolve,reject)=>{
   canvas.toBlob(b=>b?resolve(b):reject(Error('Exportação vazia')),type,0.85);
  });
  if(blob.type!==type||blob.size<300)throw Error('Formato '+type+' não suportado');
  const dimensions=await loadImg(blob);
  if(dimensions.width!==420||dimensions.height!==280)
   throw Error('Dimensões da foto fictícia inconsistentes');
  out.push(type.split('/')[1]);
 }
 return 'gerou e decodificou JPEG e PNG 420×280';
}
async function run(){
 $('run').disabled=true;values.auto=[];
 $('autoResults').replaceChildren(el('p','muted','Executando testes locais...'));
 await runOne('https','HTTPS e contexto seguro',async()=>{
  if(location.protocol!=='https:'||!isSecureContext)throw Error('HTTPS seguro não confirmado');
  return 'contexto seguro ativo';
 });
 await runOne('images','Processamento de imagens fictícias',canvasTest);
 $('run').disabled=false;
 renderSummary();
}
function summaryData(){
 const device=$('device').value,browser=$('browser').value;
 const claimedPhysical=$('physical').checked;
 const physical=claimedPhysical&&(device==='android'||device==='iphone');
 const autoOk=values.auto.length===2&&values.auto.every(x=>x.status==='pass');
 const manualOk=required.every(x=>values.manual[x[0]]==='pass');
 const failed=values.auto.some(x=>x.status==='fail')||
  Object.values(values.manual).some(v=>v==='fail');
 const ready=autoOk&&manualOk&&physical&&!!browser;
 return {autoOk,manualOk,physical,failed,ready,device,browser};
}
function renderSummary(){
 const s=summaryData(),target=$('summary');
 if(s.ready){
  target.className='status pass';
  target.textContent='Autoteste concluído no aparelho físico e itens manuais assinalados como aprovados. Resultado AUTODECLARADO: encaminhar à revisão independente; não autoriza produção.';
 }else if(s.failed){
  target.className='status fail';
  target.textContent='Há uma falha registrada. Não considerar este aparelho aprovado. Exportar o relatório para análise técnica.';
 }else{
  target.className='status pending';
  target.textContent='Pendente: executar dois testes técnicos, preencher os itens manuais, identificar o tipo de aparelho/navegador e confirmar teste físico.';
 }
}
function report(){
 const s=summaryData();
 return {
  schema:'r274-device-qa-v1',
  testEnvironment:'PUBLIC_SYNTHETIC_HTTPS_PREVIEW_ONLY',
  collectedAt:new Date().toISOString(),
  origin:location.origin+location.pathname.replace(/[^/]*$/,''),
  deviceType:s.device||'unspecified',
  browser:s.browser||'unspecified',
  modelDescription:sanitize($('version').value),
  physicalDeviceSelfDeclared:s.physical,
  automaticTests:values.auto.map(x=>({...x})),
  manualTests:required.concat(optional).map(([id,name])=>({
   id,name,status:values.manual[id]||'pending',
   source:'user_self_reported_not_independently_verified'
  })),
  result:s.ready?'SELF_REPORTED_READY_FOR_INDEPENDENT_REVIEW':
    s.failed?'FAIL_OR_INVESTIGATION_REQUIRED':'INCOMPLETE',
  releaseApproved:false,
  independentReviewerApproved:false,
  realProductionFlowsValidated:false,
  photosIncluded:false,
  passwordsIncluded:false,
  personalIdentifiersRequested:false,
  resultsTransmittedByPage:false
 };
}
function renderReport(){
 const data=JSON.stringify(report(),null,2);
 $('reportPreview').value=data;
 return data;
}
function download(){
 const data=renderReport();
 const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
 const a=document.createElement('a');
 a.href=url;a.download='R274_autoteste_BO_fotografico_'+new Date().toISOString().slice(0,10)+'.json';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),2000);
}
async function copy(){
 const data=renderReport();
 try{
  await navigator.clipboard.writeText(data);
  $('copy').textContent='Resumo copiado';
 }catch(e){
  $('reportPreview').focus();$('reportPreview').select();
  $('copy').textContent='Selecione e copie o texto abaixo';
 }
}
renderManual();renderSummary();
$('run').addEventListener('click',run);
$('download').addEventListener('click',download);
$('copy').addEventListener('click',copy);
for(const name of ['device','browser','physical','version']){
 $(name).addEventListener(name==='version'?'input':'change',renderSummary);
}
})();
