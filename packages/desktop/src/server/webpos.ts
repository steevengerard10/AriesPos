export function generatePosHTML(businessName: string, simbolo: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#6c63ff">
<link rel="manifest" href="/manifest.json">
<title>${businessName} · POS</title>
<script src="/socket.io/socket.io.js"></script>
<style>
:root{--bg:#0f1117;--bg2:#1a1d27;--bg3:#252836;--accent:#6c63ff;--green:#4caf50;--red:#e53935;--yellow:#ffc107;--text:#e8eaf6;--text2:#b0b3c1;--text3:#6b6f80;--border:#2e3247;--r:10px;--sh:0 4px 24px rgba(0,0,0,.45)}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--text);height:100dvh;overflow:hidden}
#ls{display:flex;align-items:center;justify-content:center;height:100dvh}
.lbox{background:var(--bg2);border-radius:18px;padding:36px 28px;width:min(360px,92vw);box-shadow:var(--sh);display:flex;flex-direction:column;gap:14px;align-items:center}
.llogo{font-size:28px;font-weight:800;color:var(--accent)}
.lbiz{font-size:13px;color:var(--text2);text-align:center;margin-top:-6px}
.rtabs{display:flex;gap:6px;width:100%;background:var(--bg3);border-radius:10px;padding:4px}
.rtab{flex:1;padding:11px 9px;border:none;background:transparent;color:var(--text2);cursor:pointer;border-radius:8px;font-size:14px;font-weight:600;transition:all .2s;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none}
.rtab.active{background:var(--accent);color:#fff}
.rhint{font-size:12px;color:var(--text3);text-align:center}
.linp{width:100%;background:var(--bg3);border:1.5px solid var(--border);color:var(--text);border-radius:10px;padding:13px 14px;font-size:22px;text-align:center;font-family:monospace;letter-spacing:8px;outline:none;transition:border-color .2s}
.linp:focus{border-color:var(--accent)}
.lbtn{width:100%;background:var(--accent);color:#fff;border:none;border-radius:10px;padding:13px;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .2s}
.lbtn:hover{opacity:.88}
.lerr{font-size:12px;color:var(--red);min-height:16px;text-align:center}
#app{display:none;flex-direction:column;height:100dvh}
.hdr{display:flex;align-items:center;padding:0 12px;height:46px;background:var(--bg2);border-bottom:1px solid var(--border);gap:8px;flex-shrink:0}
.hbiz{font-weight:800;font-size:15px;color:var(--accent)}
.hmid{flex:1;display:flex;align-items:center;gap:8px;justify-content:center}
.rbadge{font-size:10px;padding:2px 8px;border-radius:20px;font-weight:700;letter-spacing:.5px}
.bc{background:#1e3a5f;color:#64b5f6}
.ba{background:#3a1e1e;color:#ef9a9a}
.hterm{font-size:12px;color:var(--text3)}
.hright{display:flex;align-items:center;gap:8px}
.cdot{width:8px;height:8px;border-radius:50%;background:var(--green)}
.cdot.off{background:var(--red)}
.hclk{font-size:12px;color:var(--text2)}
.lout{background:var(--bg3);border:none;color:var(--text3);padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px}
.lout:hover{color:var(--text)}
.anav{display:flex;background:var(--bg2);border-bottom:1px solid var(--border);padding:0 2px;flex-shrink:0;overflow-x:auto;scrollbar-width:none}
.anav::-webkit-scrollbar{display:none}
.nbtn{flex:1;min-width:58px;background:none;border:none;border-bottom:2px solid transparent;color:var(--text3);padding:9px 4px;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}
.nbtn.active{color:var(--accent);border-bottom-color:var(--accent)}
.posbody{display:flex;flex:1;overflow:hidden}
.ppanel{flex:1;display:flex;flex-direction:column;overflow:hidden}
.sbar{padding:8px}
.sinp{width:100%;background:var(--bg3);border:1.5px solid var(--border);color:var(--text);border-radius:10px;padding:9px 13px;font-size:14px;outline:none;transition:border-color .2s}
.sinp:focus{border-color:var(--accent)}
.cats{display:flex;gap:5px;padding:0 8px 7px;overflow-x:auto;flex-shrink:0;scrollbar-width:none}
.cats::-webkit-scrollbar{display:none}
.cbtn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:5px 11px;border-radius:20px;font-size:12px;cursor:pointer;white-space:nowrap;transition:all .2s}
.cbtn.active{background:var(--accent);border-color:var(--accent);color:#fff}
.pgrid{flex:1;overflow-y:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px;padding:0 8px 8px;align-content:start}
.pcard{background:var(--bg2);border-radius:var(--r);padding:11px 9px;cursor:pointer;border:1.5px solid var(--border);transition:all .15s;user-select:none}
.pcard:active{transform:scale(.97)}
.pcard:hover{border-color:var(--accent)}
.pcard.ns{opacity:.6}
.pcc{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px}
.pcn{font-size:13px;font-weight:600;line-height:1.3;margin-bottom:5px}
.pcp{font-size:15px;font-weight:800;color:var(--green)}
.pcs{font-size:10px;color:var(--text3);margin-top:3px}
.pcs-out{color:var(--red);font-weight:600}
.cart{width:260px;display:flex;flex-direction:column;background:var(--bg2);border-left:1px solid var(--border);flex-shrink:0;overflow:hidden}
@media(max-width:540px){.cart{width:190px}}
.chdr{padding:11px 13px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:14px}
.citems{flex:1;overflow-y:auto}
.cempty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;height:100%;color:var(--text3);font-size:22px;padding:20px}
.cempty span{font-size:12px}
.citem{display:flex;align-items:center;gap:5px;padding:7px 11px;border-bottom:1px solid var(--border);font-size:13px}
.cin{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ciqty{display:flex;align-items:center;gap:3px}
.qb{background:var(--bg3);border:1px solid var(--border);color:var(--text);width:21px;height:21px;border-radius:5px;cursor:pointer;font-size:14px;line-height:1}
.qv{font-weight:700;min-width:18px;text-align:center;font-size:12px}
.cip{font-weight:700;font-size:11px;color:var(--green);white-space:nowrap}
.cdel{background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px}
.cfoot{padding:11px 13px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:9px}
.trow{display:flex;justify-content:space-between;align-items:center}
.tlbl{font-weight:700;font-size:13px}
.tval{font-size:20px;font-weight:800;color:var(--green)}
.flbl{font-size:11px;color:var(--text2);margin-bottom:3px}
.finp{width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;outline:none}
.fsel{width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;outline:none}
.cswrap{position:relative}
.csinp{width:100%;background:var(--bg3);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:6px 8px;font-size:13px;outline:none}
.csdd{position:absolute;bottom:100%;left:0;right:0;background:var(--bg2);border:1px solid var(--accent);border-radius:8px;max-height:150px;overflow-y:auto;z-index:50;box-shadow:var(--sh)}
.csopt{padding:7px 11px;cursor:pointer;font-size:12px}
.csopt:hover,.csopt.sel{background:rgba(108,99,255,.15)}
.frow{display:flex;align-items:center;gap:7px}
.flbl2{font-size:12px;color:var(--yellow)}
.cobrar{width:100%;background:var(--green);color:#fff;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:800;cursor:pointer;transition:opacity .2s}
.cobrar:disabled{opacity:.4;cursor:not-allowed}
.cobrar:not(:disabled):hover{opacity:.88}
.apanel{flex:1;overflow-y:auto;padding:13px;display:none;flex-direction:column;gap:14px}
.apanel.vis{display:flex}
.phdr{display:flex;justify-content:space-between;align-items:center}
.ptitle{font-size:16px;font-weight:700}
.rbtn{background:var(--bg3);border:1px solid var(--border);color:var(--text2);padding:5px 10px;border-radius:6px;cursor:pointer;font-size:12px}
.rbtn:hover{color:var(--text)}
.sgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.scard{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:13px 11px}
.sv{font-size:21px;font-weight:800;color:var(--green)}
.sl{font-size:11px;color:var(--text3);margin-top:3px}
.dlist{display:flex;flex-direction:column;gap:6px}
.drow{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:13px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.drl{display:flex;flex-direction:column;gap:2px;min-width:0}
.drm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drs{font-size:11px;color:var(--text3)}
.drr{font-weight:800;color:var(--green);font-size:13px;white-space:nowrap;flex-shrink:0}
.drr.red{color:var(--red)}
.drr.yel{color:var(--yellow)}
.emsg{color:var(--text3);text-align:center;padding:28px;font-size:13px}
.secttitle{font-size:14px;font-weight:700}
.modal{position:fixed;inset:0;background:rgba(0,0,0,.78);z-index:600;display:flex;align-items:flex-end;justify-content:center}
.mbox{background:var(--bg2);border-radius:18px 18px 0 0;width:100%;max-width:500px;max-height:92dvh;overflow-y:auto;display:flex;flex-direction:column}
.mhdr{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);font-weight:700;font-size:15px;flex-shrink:0}
.mclose{background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;line-height:1;padding:0}
.mbody{padding:14px 16px;display:flex;flex-direction:column;gap:6px;overflow-y:auto}
.mfoot{padding:6px 16px 22px;display:flex;flex-direction:column;gap:6px}
.cktag{font-size:11px;padding:2px 8px;border-radius:20px;font-weight:700}
.ckabierta{background:rgba(76,175,80,.2);color:var(--green)}
.ckcerrada{background:rgba(229,57,53,.2);color:var(--red)}
.cajahdr{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cajagrid{display:grid;grid-template-columns:repeat(2,1fr);gap:9px}
.cajabtns{display:flex;gap:8px}
.cajabtn{flex:1;border:none;border-radius:10px;padding:12px;font-size:14px;font-weight:700;cursor:pointer}
.cajabtn.abrir{background:var(--green);color:#fff}
.cajabtn.cerrar{background:var(--red);color:#fff}
.cajabtn.movim{background:var(--bg3);color:var(--text);border:1px solid var(--border)}
.prodrow{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:9px 11px;display:flex;justify-content:space-between;align-items:center;gap:8px}
.prodrl{display:flex;flex-direction:column;gap:2px;min-width:0}
.prodrm{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:13px}
.prodrs{font-size:11px;color:var(--text3)}
.editbtn{background:var(--accent);border:none;color:#fff;border-radius:6px;padding:5px 10px;font-size:11px;cursor:pointer;white-space:nowrap}
.cfgsect{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px}
.cfgurl{background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:9px 11px;font-size:12px;font-family:monospace;word-break:break-all;color:var(--accent);cursor:pointer;transition:opacity .2s}
.cfgurl:hover{opacity:.8}
.cfgok{font-size:12px;color:var(--green);min-height:14px}
.toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:var(--bg2);color:var(--text);padding:9px 17px;border-radius:20px;font-size:14px;box-shadow:var(--sh);display:none;z-index:1000;border:1px solid var(--border)}
.toast.ok{border-color:var(--green);color:var(--green)}
.toast.err{border-color:var(--red);color:var(--red)}
.sov{position:fixed;inset:0;background:rgba(0,0,0,.7);display:none;z-index:500;align-items:center;justify-content:center}
.sovbox{background:var(--bg2);border-radius:18px;padding:34px 26px;width:min(310px,88vw);text-align:center}
.sic{font-size:46px;margin-bottom:8px}
.stit{font-size:19px;font-weight:800;margin-bottom:6px}
.samt{font-size:30px;font-weight:900;color:var(--green);margin-bottom:5px}
.ssub{font-size:13px;color:var(--text2);margin-bottom:18px}
.sbtn{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:12px 26px;font-size:15px;font-weight:700;cursor:pointer}
</style>
</head>
<body>
<div id="ls">
  <div class="lbox">
    <div class="llogo">ARIES<span style="color:var(--text2)">pos</span></div>
    <div class="lbiz">${businessName}</div>
    <div class="rtabs">
      <button class="rtab active" id="rt-cajero" onclick="setRole('cajero')">🧾 Cajero</button>
      <button class="rtab" id="rt-admin" onclick="setRole('admin')">🔑 Admin</button>
    </div>
    <div class="rhint" id="rhint">Ingresá tu PIN de cajero</div>
    <input type="password" class="linp" id="lpin" placeholder="• • • •" inputmode="numeric" autocomplete="off"
      onkeydown="if(event.key==='Enter')doLogin()">
    <div class="lerr" id="lerr"></div>
    <button class="lbtn" id="lbtn" onclick="doLogin()">Ingresar</button>
  </div>
</div>
<div id="app">
  <div class="hdr">
    <span class="hbiz">${businessName}</span>
    <div class="hmid">
      <span class="rbadge bc" id="rbadge">Cajero</span>
      <span class="hterm" id="hterm"></span>
    </div>
    <div class="hright">
      <span class="hclk" id="clk"></span>
      <span class="cdot off" id="cdot"></span>
      <button class="lout" onclick="logout()">Salir</button>
    </div>
  </div>
  <nav class="anav" id="anav" style="display:none">
    <button class="nbtn active" id="n-pos"      onclick="showTab('pos')">🛒 POS</button>
    <button class="nbtn"        id="n-stats"    onclick="showTab('stats')">📊 Stats</button>
    <button class="nbtn"        id="n-ventas"   onclick="showTab('ventas')">📋 Ventas</button>
    <button class="nbtn"        id="n-clientes" onclick="showTab('clientes')">👥 Clientes</button>
    <button class="nbtn"        id="n-fiados"   onclick="showTab('fiados')">💳 Fiados</button>
    <button class="nbtn"        id="n-caja"     onclick="showTab('caja')">🏧 Caja</button>
    <button class="nbtn"        id="n-prods"    onclick="showTab('prods')">📝 Prods</button>
    <button class="nbtn"        id="n-stock"    onclick="showTab('stock')">📦 Stock</button>
    <button class="nbtn"        id="n-config"   onclick="showTab('config')">⚙️ Config</button>
  </nav>
  <div id="t-pos" class="posbody">
    <div class="ppanel">
      <div class="sbar">
        <div style="display:flex;gap:6px;align-items:center">
          <input type="search" class="sinp" id="srch" placeholder="Buscar producto o escanear..." oninput="filterProds()" style="flex:1">
          <button id="scanbtn" onclick="openScanner()" style="background:var(--bg3);border:none;padding:8px 10px;border-radius:8px;cursor:pointer;font-size:18px;color:var(--accent);display:flex;align-items:center;justify-content:center" title="Escanear código">
            <span style="font-size:20px">📷</span>
          </button>
        </div>
      <script>
      function openScanner(){
        if(!('mediaDevices' in navigator)){
          alert('Tu navegador no soporta cámara');return;
        }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.style.display = 'none';
        input.onchange = async (e) => {
          const file = input.files && input.files[0];
          if(!file) return;
          // Intentar usar BarcodeDetector si está disponible
          if('BarcodeDetector' in window){
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = async ()=>{
              try{
                const detector = new window.BarcodeDetector({formats:['ean_13','ean_8','code_128','code_39','qr_code','upc_a','upc_e']});
                const res = await detector.detect(img);
                if(res.length){
                  G('srch').value = res[0].rawValue;
                  filterProds();
                }else{
                  alert('No se detectó ningún código');
                }
              }catch(e){alert('Error al leer el código');}
            };
          }else{
            alert('Tu navegador no soporta escaneo directo. Usa la app móvil para escanear.');
          }
        };
        document.body.appendChild(input);
        input.click();
        setTimeout(()=>input.remove(),20000);
      }
      </script>
      </div>
      <div class="cats" id="cats"></div>
      <div class="pgrid" id="pgrid">
        <div style="color:var(--text3);font-size:12px;padding:20px;text-align:center;grid-column:1/-1">Cargando...</div>
      </div>
    </div>
    <div class="cart">
      <div class="chdr">
        <span>Carrito</span>
        <button onclick="clearCart()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:11px">Limpiar</button>
      </div>
      <div class="citems" id="citems">
        <div class="cempty">🛒<span>Sin productos</span></div>
      </div>
      <div class="cfoot">
        <div class="trow">
          <span class="tlbl">Total</span>
          <span class="tval" id="tot">${simbolo}0,00</span>
        </div>
        <div>
          <div class="flbl">Descuento (${simbolo})</div>
          <input type="number" class="finp" id="disc" value="0" min="0" oninput="updTotal()">
        </div>
        <div>
          <div class="flbl">Cliente</div>
          <div class="cswrap">
            <input type="text" class="csinp" id="csinp" placeholder="Sin cliente"
              oninput="srcCli()" onfocus="showCliDD()">
            <div class="csdd" id="csdd" style="display:none"></div>
          </div>
        </div>
        <div>
          <div class="flbl">Metodo de pago</div>
          <select class="fsel" id="metodo" onchange="updFiado()">
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
            <option value="mercadopago">MercadoPago</option>
          </select>
        </div>
        <label class="frow" id="fiadorow" style="display:none">
          <input type="checkbox" id="fiado" style="accent-color:var(--yellow)">
          <span class="flbl2">💳 Cargar en cuenta (fiado)</span>
        </label>
        <button class="cobrar" id="cobrar" onclick="checkout()" disabled>COBRAR ${simbolo}0,00</button>
      </div>
    </div>
  </div>
  <div id="t-stats" class="apanel">
    <div class="phdr">
      <span class="ptitle">📊 Estadisticas del dia</span>
      <button class="rbtn" onclick="loadStats()">Actualizar</button>
    </div>
    <div class="sgrid">
      <div class="scard"><div class="sv" id="sv-v">-</div><div class="sl">Ventas hoy</div></div>
      <div class="scard"><div class="sv" id="sv-t" style="color:var(--accent)">-</div><div class="sl">Transacciones</div></div>
      <div class="scard"><div class="sv" id="sv-f" style="color:var(--yellow)">-</div><div class="sl">Fiados pendientes</div></div>
      <div class="scard"><div class="sv" id="sv-s" style="color:var(--red)">-</div><div class="sl">Stock critico</div></div>
    </div>
    <div>
      <div class="secttitle" style="margin-bottom:9px">Ultimas ventas</div>
      <div class="dlist" id="sv-list"><div class="emsg">Cargando...</div></div>
    </div>
  </div>
  <div id="t-ventas" class="apanel">
    <div class="phdr">
      <span class="ptitle">📋 Ventas de hoy</span>
      <button class="rbtn" onclick="loadVentas()">Actualizar</button>
    </div>
    <div class="dlist" id="vlist"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-clientes" class="apanel">
    <div class="phdr">
      <span class="ptitle">👥 Clientes</span>
      <button class="rbtn" onclick="loadCli()">Actualizar</button>
    </div>
    <input type="search" class="sinp" id="clisrch" placeholder="Buscar cliente..." oninput="filtCli()" style="flex-shrink:0">
    <div class="dlist" id="clilist"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-fiados" class="apanel">
    <div class="phdr">
      <span class="ptitle">💳 Fiados pendientes</span>
      <button class="rbtn" onclick="loadFiados()">Actualizar</button>
    </div>
    <div class="dlist" id="fiadoslist"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-caja" class="apanel">
    <div class="phdr"><span class="ptitle">🏧 Caja</span><button class="rbtn" onclick="loadCaja()">Actualizar</button></div>
    <div id="caja-estado"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-prods" class="apanel">
    <div class="phdr"><span class="ptitle">📝 Productos</span><button class="rbtn" onclick="loadProdsAdmin()">Actualizar</button></div>
    <input type="search" class="sinp" id="prodadmin-srch" placeholder="Buscar producto..." oninput="filtProdsAdmin()" style="flex-shrink:0">
    <div id="prodadmin-list"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-stock" class="apanel">
    <div class="phdr">
      <span class="ptitle">📦 Stock critico</span>
      <button class="rbtn" onclick="loadStock()">Actualizar</button>
    </div>
    <div class="dlist" id="stklist"><div class="emsg">Cargando...</div></div>
  </div>
  <div id="t-config" class="apanel">
    <div class="phdr"><span class="ptitle">⚙️ Configuracion</span></div>
    <div class="cfgsect">
      <div class="secttitle">Cambiar PIN Admin</div>
      <div class="flbl">PIN actual</div>
      <input type="password" class="finp" id="cfg-apin-cur" inputmode="numeric" placeholder="PIN actual">
      <div class="flbl">Nuevo PIN (minimo 4 digitos)</div>
      <input type="password" class="finp" id="cfg-apin-new" inputmode="numeric" placeholder="Nuevo PIN">
      <div class="flbl">Confirmar nuevo PIN</div>
      <input type="password" class="finp" id="cfg-apin-cfm" inputmode="numeric" placeholder="Confirmar PIN">
      <button class="cobrar" style="margin-top:4px" onclick="changeAdminPin()">Guardar PIN Admin</button>
      <div class="lerr" id="cfg-apin-err"></div>
    </div>
    <div class="cfgsect">
      <div class="secttitle">Cambiar PIN Cajero</div>
      <div class="flbl">Nuevo PIN (minimo 4 digitos)</div>
      <input type="password" class="finp" id="cfg-cpin-new" inputmode="numeric" placeholder="Nuevo PIN cajero">
      <div class="flbl">Confirmar nuevo PIN</div>
      <input type="password" class="finp" id="cfg-cpin-cfm" inputmode="numeric" placeholder="Confirmar PIN">
      <button class="cobrar" style="margin-top:4px" onclick="changeCajeroPin()">Guardar PIN Cajero</button>
      <div class="lerr" id="cfg-cpin-err"></div>
    </div>
    <div class="cfgsect">
      <div class="secttitle">Acceso Remoto 🌐</div>
      <div class="flbl">URL Red Local (WiFi)</div>
      <div class="cfgurl" id="cfg-url-local" title="Toca para copiar">Cargando...</div>
      <div class="flbl" style="margin-top:4px">URL Publica (Internet) <span id="cfg-tun-status" style="font-size:11px"></span></div>
      <div class="cfgurl" id="cfg-url-tunnel" title="Toca para copiar">Conectando al servidor de tunnel...</div>
      <div style="font-size:11px;color:var(--text3)">💡 Instala la app: en tu cel abre la URL y elige "Agregar a pantalla de inicio"</div>
      <button class="rbtn" style="width:100%" onclick="loadConfig()">🔄 Actualizar URLs</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
<div class="sov" id="sov">
  <div class="sovbox">
    <div class="sic">&#x2705;</div>
    <div class="stit">Venta registrada!</div>
    <div class="samt" id="samt">${simbolo}0,00</div>
    <div class="ssub" id="ssub"></div>
    <button class="sbtn" onclick="closeOk()">Nueva venta</button>
  </div>
</div>
<div id="prod-modal" class="modal" style="display:none" onclick="if(event.target===this)closeModal()">
  <div class="mbox">
    <div class="mhdr">
      <span id="modal-title">Editar Producto</span>
      <button class="mclose" onclick="closeModal()">&#x2715;</button>
    </div>
    <div class="mbody">
      <div class="flbl">Nombre</div>
      <input class="finp" id="edt-nombre" type="text">
      <div class="flbl">Precio Venta (${simbolo})</div>
      <input class="finp" id="edt-pventa" type="number" step="0.01" inputmode="decimal" min="0">
      <div class="flbl">Precio Costo (${simbolo})</div>
      <input class="finp" id="edt-pcosto" type="number" step="0.01" inputmode="decimal" min="0">
      <div class="flbl">Stock actual</div>
      <input class="finp" id="edt-stock" type="number" step="0.001" inputmode="decimal">
      <div class="flbl">Stock minimo</div>
      <input class="finp" id="edt-smin" type="number" step="0.001" inputmode="decimal" min="0">
      <label class="frow" style="gap:10px;margin-top:6px">
        <input type="checkbox" id="edt-activo" style="accent-color:var(--accent);width:18px;height:18px">
        <span class="flbl2" style="color:var(--text2)">Producto activo</span>
      </label>
      <label class="frow" style="gap:10px;margin-top:2px">
        <input type="checkbox" id="edt-catalogo" style="accent-color:var(--accent);width:18px;height:18px">
        <span class="flbl2" style="color:var(--text2)">Visible en catálogo</span>
      </label>
    </div>
    <div class="mfoot">
      <button class="cobrar" onclick="saveProd()">Guardar cambios</button>
      <div class="lerr" id="edt-err" style="text-align:center"></div>
    </div>
  </div>
</div>
<div id="caja-num-modal" class="modal" style="display:none" onclick="if(event.target===this)closeCajaModal()">
  <div class="mbox">
    <div class="mhdr">
      <span id="caja-modal-title">Monto</span>
      <button class="mclose" onclick="closeCajaModal()">&#x2715;</button>
    </div>
    <div class="mbody">
      <div class="flbl" id="caja-modal-label">Monto inicial</div>
      <input class="finp" id="caja-modal-inp" type="number" step="0.01" inputmode="decimal" min="0" placeholder="0,00" style="font-size:22px;text-align:center">
      <div id="caja-extra" style="display:none;flex-direction:column;gap:6px">
        <div class="flbl">Descripcion</div>
        <input class="finp" id="caja-modal-desc" type="text" placeholder="Opcional">
        <div class="flbl">Metodo</div>
        <select class="fsel" id="caja-modal-metodo">
          <option value="efectivo">Efectivo</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="transferencia">Transferencia</option>
          <option value="mercadopago">MercadoPago</option>
        </select>
      </div>
    </div>
    <div class="mfoot">
      <button class="cobrar" id="caja-modal-btn" onclick="confirmCajaAction()">Confirmar</button>
      <div class="lerr" id="caja-modal-err" style="text-align:center"></div>
    </div>
  </div>
</div>
<script>
const SIM='${simbolo}';
let AH={},role=null,selectedRole='cajero';
let prods=[],clients=[],allCliAdmin=[],cart=[],selCli=null,activeCat=null;
const G=id=>document.getElementById(id);
// bypass-tunnel-reminder header evita la página de verificación de localtunnel
const BYPASS_HEADERS={'bypass-tunnel-reminder':'pos','Accept':'application/json'};
function mkH(auth=null){return auth?{...BYPASS_HEADERS,'Authorization':auth}:{...BYPASS_HEADERS};}
function apiFetch(url,opts={}){
  const h={...BYPASS_HEADERS,...(AH||{}),...(opts.headers||{})};
  return fetch(url,{cache:'no-store',...opts,headers:h});
}
function bootApp(){
  showApp();
  setTimeout(()=>{
    init().catch(()=>toast('La app abrió, pero algunos datos tardaron en cargar','err'));
  },0);
}
function setRole(r){
  selectedRole=r;
  G('rt-cajero').classList.toggle('active',r==='cajero');
  G('rt-admin').classList.toggle('active',r==='admin');
  G('rhint').textContent=r==='admin'?'PIN de administrador (6 digitos)':'PIN de cajero (4 digitos)';
  G('lpin').placeholder=r==='admin'?'• • • • • •':'• • • •';
  G('lerr').textContent='';
  G('lpin').value='';
  G('lpin').focus();
}
async function doLogin(){
  const pin=G('lpin').value.trim();
  if(!pin){G('lerr').textContent='Ingresa tu clave';return;}
  const b64=btoa(selectedRole+':'+pin);
  const authH=mkH('Basic '+b64);
  G('lerr').textContent='Verificando...';
  G('lbtn').disabled=true;
  try{
    const ctrl=new AbortController();
    const timo=setTimeout(()=>ctrl.abort(),12000);
    const r=await apiFetch('/api/auth/role',{headers:authH,signal:ctrl.signal});
    clearTimeout(timo);
    if(r.ok){
      AH=authH;role=selectedRole;
      sessionStorage.setItem('posAuth',b64);
      sessionStorage.setItem('posRole',role);
      bootApp();return;
    }
    G('lerr').textContent=r.status===401?'Clave incorrecta':'Error '+r.status;
  }catch(e){
    G('lerr').textContent=(e&&e.name==='AbortError')?'Tiempo de espera agotado':'Sin conexion al servidor';
  }
  G('lpin').value='';G('lpin').focus();
  G('lbtn').disabled=false;
}
function logout(){
  sessionStorage.removeItem('posAuth');
  sessionStorage.removeItem('posRole');
  location.reload();
}
function showApp(){
  G('ls').style.display='none';
  G('app').style.display='flex';
  const b=G('rbadge');
  if(role==='admin'){b.textContent='Admin';b.className='rbadge ba';G('anav').style.display='flex';}
  else{b.textContent='Cajero';b.className='rbadge bc';}
  setInterval(()=>{G('clk').textContent=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});},1000);
  G('clk').textContent=new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
}
window.addEventListener('load',()=>{
  const stored=sessionStorage.getItem('posAuth');
  const storedRole=sessionStorage.getItem('posRole');
  if(stored&&storedRole){
    AH=mkH('Basic '+stored);role=storedRole;
    const ctrl=new AbortController();
    setTimeout(()=>ctrl.abort(),10000);
    apiFetch('/api/auth/role',{headers:AH,signal:ctrl.signal}).then(r=>{
      if(r.ok){bootApp();}
      else{sessionStorage.removeItem('posAuth');sessionStorage.removeItem('posRole');}
    }).catch(()=>{sessionStorage.removeItem('posAuth');sessionStorage.removeItem('posRole');});
  } else {
    const isMobile=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
    if(!isMobile) G('lpin').focus();
  }
});
async function init(){
  await Promise.allSettled([loadProds(),loadClients()]);
  const cfg=await apiFetch('/api/config').then(r=>r.ok?r.json():{}).catch(()=>({}));
  if(cfg.nombre_terminal)G('hterm').textContent=cfg.nombre_terminal;
  setupSocket();
}
let activeTab='pos';
const loaded={};
const TABS=['pos','stats','ventas','fiados','caja','clientes','prods','stock','config'];
function showTab(tab){
  TABS.forEach(t=>{
    const el=G('t-'+t);
    if(el){el.style.display='none';el.classList.remove('vis');}
    const nb=G('n-'+t);
    if(nb)nb.classList.remove('active');
  });
  const panel=G('t-'+tab);
  if(panel){
    if(tab==='pos'){panel.style.display='flex';}
    else{panel.style.display='flex';panel.classList.add('vis');}
  }
  const nb=G('n-'+tab);
  if(nb)nb.classList.add('active');
  activeTab=tab;
  if(!loaded[tab]){
    loaded[tab]=true;
    if(tab==='stats')loadStats();
    else if(tab==='ventas')loadVentas();
    else if(tab==='fiados')loadFiados();
    else if(tab==='caja'){loadCaja();loadMovCaja();}
    else if(tab==='clientes')loadCli();
    else if(tab==='prods')loadProdsAdmin();
    else if(tab==='stock')loadStock();
    else if(tab==='config')loadConfig();
  }
}
async function loadProds(silent=false){
  try{
    const r=await apiFetch('/api/productos');
    if(!r.ok)return;
    prods=await r.json();
    renderCats();renderProds();
  }catch{if(!silent)toast('Error al cargar productos','err');}
}
function renderCats(){
  const cats=[...new Set(prods.map(p=>p.categoria_nombre).filter(Boolean))].sort();
  G('cats').innerHTML='<button class="cbtn active" onclick="selCat(null,this)">Todos</button>'+
    cats.map(c=>\`<button class="cbtn" onclick="selCat('\${c}',this)">\${c}</button>\`).join('');
}
function selCat(c,btn){
  activeCat=c;
  document.querySelectorAll('.cbtn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderProds();
}
function filterProds(){renderProds();}
function renderProds(){
  const s=(G('srch')?.value||'').toLowerCase();
  let f=prods;
  if(activeCat)f=f.filter(p=>p.categoria_nombre===activeCat);
  if(s)f=f.filter(p=>(p.nombre||'').toLowerCase().includes(s)||(p.codigo||'').toLowerCase().includes(s)||(p.codigo_barras||'').includes(s));
  const grid=G('pgrid');
  if(!f.length){grid.innerHTML='<div style="color:var(--text3);font-size:12px;padding:16px;grid-column:1/-1;text-align:center">Sin resultados</div>';return;}
  grid.innerHTML=f.map(p=>{
    const ns=p.stock_actual!==null&&p.stock_actual<=0&&!p.fraccionable;
    return \`<div class="pcard" onclick="addToCart(\${p.id})">
      <div class="pcc">\${p.categoria_nombre||''}</div>
      <div class="pcn">\${p.nombre}</div>
      <div class="pcp">\${SIM}\${fmt(p.precio_venta)}</div>
      \${p.stock_actual!==null?\`<div class="pcs\${ns?' pcs-out':''}">Stock: \${p.stock_actual}</div>\`:''}
    </div>\`;
  }).join('');
}
function addToCart(id){
  const p=prods.find(x=>x.id===id);
  if(!p)return;
  const ex=cart.find(i=>i.pid===id);
  if(ex)ex.qty++;else cart.push({pid:id,name:p.nombre,qty:1,price:p.precio_venta});
  G('srch').value='';renderProds();renderCart();
}
function chgQty(i,d){cart[i].qty=Math.max(1,cart[i].qty+d);renderCart();}
function delItem(i){cart.splice(i,1);renderCart();}
function clearCart(){
  cart=[];selCli=null;G('csinp').value='';G('disc').value='0';
  const f=G('fiado');if(f)f.checked=false;
  updFiado();renderCart();
}
function renderCart(){
  const c=G('citems');
  if(!cart.length){c.innerHTML='<div class="cempty">&#x1F6D2;<span>Sin productos</span></div>';updTotal();return;}
  c.innerHTML=cart.map((it,i)=>\`
    <div class="citem">
      <span class="cin" title="\${it.name}">\${it.name}</span>
      <div class="ciqty">
        <button class="qb" onclick="chgQty(\${i},-1)">-</button>
        <span class="qv">\${it.qty}</span>
        <button class="qb" onclick="chgQty(\${i},1)">+</button>
      </div>
      <span class="cip">\${SIM}\${fmt(it.price*it.qty)}</span>
      <button class="cdel" onclick="delItem(\${i})">X</button>
    </div>
  \`).join('');
  updTotal();
}
function updTotal(){
  const sub=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const d=parseFloat(G('disc').value)||0;
  const tot=Math.max(0,sub-d);
  G('tot').textContent=SIM+fmt(tot);
  G('cobrar').textContent='COBRAR '+SIM+fmt(tot);
  G('cobrar').disabled=cart.length===0;
}
async function loadClients(){
  try{const r=await apiFetch('/api/clientes');if(r.ok)clients=await r.json();}catch{}
}
function srcCli(){showCliDD(G('csinp').value.toLowerCase());}
function showCliDD(s=''){
  const dd=G('csdd');
  const f=s?clients.filter(c=>(c.nombre+' '+(c.apellido||'')).toLowerCase().includes(s)||(c.telefono||'').includes(s)):clients.slice(0,15);
  dd.style.display='block';
  dd.innerHTML='<div class="csopt" onclick="selClient(null)">Sin cliente</div>'+
    f.map(c=>\`<div class="csopt\${selCli?.id===c.id?' sel':''}" onclick="selClient(\${c.id})">\${c.nombre} \${c.apellido||''}\${c.telefono?' - '+c.telefono:''}</div>\`).join('');
}
function selClient(id){
  selCli=id?clients.find(c=>c.id===id):null;
  G('csinp').value=selCli?(selCli.nombre+' '+(selCli.apellido||'')).trim():'';
  G('csdd').style.display='none';
  updFiado();
}
document.addEventListener('click',e=>{
  if(!G('csinp')?.contains(e.target)&&!G('csdd')?.contains(e.target)){
    const dd=G('csdd');if(dd)dd.style.display='none';
  }
});
function updFiado(){
  const fr=G('fiadorow');
  if(fr)fr.style.display=selCli?'flex':'none';
  if(!selCli){const f=G('fiado');if(f)f.checked=false;}
}
async function checkout(){
  if(!cart.length)return;
  const isFiado=G('fiado')?.checked;
  if(isFiado&&!selCli){toast('Selecciona un cliente para fiado','err');return;}
  const sub=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const disc=parseFloat(G('disc').value)||0;
  const total=Math.max(0,sub-disc);
  const payload={
    items:cart.map(i=>({producto_id:i.pid,cantidad:i.qty,precio_unitario:i.price,descuento:0})),
    metodo_pago:G('metodo').value,cliente_id:selCli?.id||null,
    es_fiado:isFiado||false,descuento:disc,tipo:'venta',observaciones:'',
  };
  G('cobrar').disabled=true;G('cobrar').textContent='Registrando...';
  try{
    const r=await fetch('/api/ventas',{method:'POST',headers:{...AH,'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const data=await r.json();
    if(r.ok&&data.success){
      const labels={efectivo:'Efectivo',tarjeta:'Tarjeta',transferencia:'Transferencia',mercadopago:'MercadoPago'};
      G('samt').textContent=SIM+fmt(total);
      G('ssub').textContent=isFiado?'Cargado en cuenta de '+(selCli?.nombre||''):'OK '+( labels[G('metodo').value]||G('metodo').value);
      G('sov').style.display='flex';
      loadProds(true);
    }else{toast(data.error||'Error al registrar','err');G('cobrar').disabled=false;updTotal();}
  }catch{toast('Error de conexion','err');G('cobrar').disabled=false;updTotal();}
}
function closeOk(){G('sov').style.display='none';clearCart();}
async function loadStats(){
  try{
    const [rs,rv]=await Promise.all([
      fetch('/api/stats',{headers:AH}),
      fetch('/api/ventas/hoy',{headers:AH}),
    ]);
    if(!rs.ok){G('sv-list').innerHTML='<div class="emsg">Sin permisos</div>';return;}
    const d=await rs.json();
    G('sv-v').textContent=SIM+fmt(d.ventasHoy||0);
    G('sv-f').textContent=SIM+fmt(d.fiadosPendientes||0);
    G('sv-s').textContent=String(d.stockBajo||0);
    if(rv.ok){
      const ventas=await rv.json();
      G('sv-t').textContent=String(ventas.length);
      const list=G('sv-list');
      if(!ventas.length){list.innerHTML='<div class="emsg">Sin ventas hoy</div>';return;}
      list.innerHTML=ventas.slice(0,6).map(v=>\`
        <div class="drow">
          <div class="drl">
            <span class="drm">#\${v.numero}</span>
            <span class="drs">\${v.hora||''} - \${v.metodo_pago||''}\${v.cliente_nombre?' - '+v.cliente_nombre:''}</span>
          </div>
          <span class="drr\${v.es_fiado?' yel':''}">\${SIM}\${fmt(v.total)}</span>
        </div>
      \`).join('');
    }else{G('sv-t').textContent='-';}
  }catch{toast('Error al cargar stats','err');}
}
async function loadVentas(){
  const list=G('vlist');list.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/ventas/hoy',{headers:AH});
    if(!r.ok){list.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    const ventas=await r.json();
    if(!ventas.length){list.innerHTML='<div class="emsg">Sin ventas hoy</div>';return;}
    list.innerHTML=ventas.map(v=>\`
      <div class="drow">
        <div class="drl">
          <span class="drm">#\${v.numero}</span>
          <span class="drs">\${v.hora||''} - \${v.metodo_pago||''}\${v.cliente_nombre?' - '+v.cliente_nombre:''}\${v.es_fiado?' (fiado)':''}</span>
        </div>
        <span class="drr\${v.es_fiado?' yel':''}">\${SIM}\${fmt(v.total)}</span>
      </div>
    \`).join('');
  }catch{list.innerHTML='<div class="emsg">Error al cargar</div>';}
}
async function loadCli(){
  const list=G('clilist');list.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/clientes',{headers:AH});
    if(!r.ok){list.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    allCliAdmin=await r.json();
    filtCli();
  }catch{list.innerHTML='<div class="emsg">Error al cargar</div>';}
}
function filtCli(){
  const s=(G('clisrch')?.value||'').toLowerCase();
  const f=s?allCliAdmin.filter(c=>(c.nombre+' '+(c.apellido||'')).toLowerCase().includes(s)||(c.telefono||'').includes(s)):allCliAdmin;
  const list=G('clilist');
  if(!f.length){list.innerHTML='<div class="emsg">Sin clientes</div>';return;}
  list.innerHTML=f.map(c=>\`
    <div class="drow">
      <div class="drl">
        <span class="drm">\${c.nombre} \${c.apellido||''}</span>
        <span class="drs">\${c.telefono||'Sin telefono'}\${c.email?' - '+c.email:''}</span>
      </div>
      <span class="drr\${(c.saldo_deuda||0)>0?' red':''}">\${(c.saldo_deuda||0)>0?'Deuda: '+SIM+fmt(c.saldo_deuda):'Sin deuda'}</span>
    </div>
  \`).join('');
}
async function loadStock(){
  const list=G('stklist');list.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/stock/alertas',{headers:AH});
    if(!r.ok){list.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    const items=await r.json();
    if(!items.length){list.innerHTML='<div class="emsg">Sin alertas de stock</div>';return;}
    list.innerHTML=items.map(p=>\`
      <div class="drow">
        <div class="drl">
          <span class="drm">\${p.nombre}</span>
          <span class="drs">Minimo: \${p.stock_minimo}</span>
        </div>
        <span class="drr red">Stock: \${p.stock_actual}</span>
      </div>
    \`).join('');
  }catch{list.innerHTML='<div class="emsg">Error al cargar</div>';}
}
function setupSocket(){
  const s=io();
  const dot=G('cdot');
  s.on('connect',()=>dot.classList.remove('off'));
  s.on('disconnect',()=>dot.classList.add('off'));
  s.on('producto:actualizado',()=>loadProds(true));
  s.on('venta:nueva',()=>{
    if(role==='admin'){
      if(activeTab==='stats'){loaded['stats']=false;loadStats();}
      if(activeTab==='ventas'){loaded['ventas']=false;loadVentas();}
    }
  });
}
function fmt(n){return Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});}
let _tt;
function toast(msg,type='ok'){
  const t=G('toast');t.textContent=msg;t.className='toast '+type;t.style.display='block';
  clearTimeout(_tt);_tt=setTimeout(()=>{t.style.display='none';},2800);
}
let _bc='',_bt;
document.addEventListener('keydown',e=>{
  if(document.activeElement?.tagName==='INPUT')return;
  if(e.key==='Enter'&&_bc.length>3){
    const p=prods.find(x=>x.codigo_barras===_bc||x.codigo===_bc);
    if(p)addToCart(p.id);else toast('Codigo no encontrado: '+_bc,'err');
    _bc='';
  }else if(e.key.length===1){
    _bc+=e.key;clearTimeout(_bt);_bt=setTimeout(()=>{_bc='';},80);
  }
});
async function loadConfig(){
  try{
    const r=await fetch('/api/settings/remote-url',{headers:AH});
    if(!r.ok)return;
    const d=await r.json();
    const lu=G('cfg-url-local');
    if(lu){
      lu.textContent=d.local||'No disponible';
      lu.onclick=()=>navigator.clipboard?.writeText(d.local||'').then(()=>toast('URL copiada'));
    }
    const tu=G('cfg-url-tunnel');
    const ts=G('cfg-tun-status');
    if(tu&&ts){
      if(d.tunnel){
        tu.textContent=d.tunnel;
        tu.style.color='var(--green)';
        ts.textContent='✓ activo';
        ts.style.color='var(--green)';
        tu.onclick=()=>navigator.clipboard?.writeText(d.tunnel||'').then(()=>toast('URL copiada'));
      }else{
        tu.textContent='Conectando... (espera 30 seg y actualiza)';
        tu.style.color='var(--yellow)';
        ts.textContent='• pendiente';
        ts.style.color='var(--yellow)';
        tu.onclick=null;
      }
    }
  }catch{toast('Error al cargar config','err');}
}
async function changeAdminPin(){
  const cur=(G('cfg-apin-cur')?.value||'').trim();
  const nw=(G('cfg-apin-new')?.value||'').trim();
  const cfm=(G('cfg-apin-cfm')?.value||'').trim();
  const err=G('cfg-apin-err');
  if(!cur||!nw||!cfm){err.textContent='Completa todos los campos';return;}
  if(nw!==cfm){err.textContent='Los PINs no coinciden';return;}
  if(!/^[0-9]{4,20}$/.test(nw)){err.textContent='El PIN debe tener entre 4 y 20 digitos';return;}
  err.textContent='';
  try{
    const r=await fetch('/api/settings/pins',{method:'PUT',headers:{...AH,'Content-Type':'application/json'},
      body:JSON.stringify({tipo:'admin',pin_actual:cur,nuevo_pin:nw})});
    const d=await r.json();
    if(r.ok){
      const nb64=btoa('admin:'+nw);
      AH={'Authorization':'Basic '+nb64};
      sessionStorage.setItem('posAuth',nb64);
      G('cfg-apin-cur').value='';G('cfg-apin-new').value='';G('cfg-apin-cfm').value='';
      toast('PIN admin actualizado ✓');
    }else{err.textContent=d.error||'Error al cambiar PIN';}
  }catch{err.textContent='Error de conexion';}
}
async function changeCajeroPin(){
  const nw=(G('cfg-cpin-new')?.value||'').trim();
  const cfm=(G('cfg-cpin-cfm')?.value||'').trim();
  const err=G('cfg-cpin-err');
  if(!nw||!cfm){err.textContent='Completa todos los campos';return;}
  if(nw!==cfm){err.textContent='Los PINs no coinciden';return;}
  if(!/^[0-9]{4,20}$/.test(nw)){err.textContent='El PIN debe tener entre 4 y 20 digitos';return;}
  err.textContent='';
  try{
    const r=await fetch('/api/settings/pins',{method:'PUT',headers:{...AH,'Content-Type':'application/json'},
      body:JSON.stringify({tipo:'cajero',nuevo_pin:nw})});
    const d=await r.json();
    if(r.ok){
      G('cfg-cpin-new').value='';G('cfg-cpin-cfm').value='';
      toast('PIN cajero actualizado ✓');
    }else{err.textContent=d.error||'Error al cambiar PIN';}
  }catch{err.textContent='Error de conexion';}
}

// ── FIADOS ──────────────────────────────────────────────────────────────────
let fiadosData=[];
let fiadoModalId=null,fiadoModalPendiente=0;
async function loadFiados(){
  const list=G('fiadoslist');list.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/fiados',{headers:AH});
    if(!r.ok){list.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    fiadosData=await r.json();
    renderFiados();
  }catch{list.innerHTML='<div class="emsg">Error al cargar</div>';}
}
function renderFiados(){
  const list=G('fiadoslist');
  const f=fiadosData.filter(x=>x.estado!=='pagado');
  if(!f.length){list.innerHTML='<div class="emsg">Sin fiados pendientes \ud83c\udf89</div>';return;}
  list.innerHTML=f.map(v=>{
    const total=Number(v.total)||0;
    const pagado=Number(v.monto_pagado)||0;
    const pendiente=total-pagado;
    const tienePagoParcial=pagado>0;
    return \`
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:7px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div class="drl">
          <span class="drm">\${v.cliente_nombre||'Sin cliente'}</span>
          <span class="drs">#\${v.numero} · \${v.fecha||''} \${v.hora||''}</span>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:15px;font-weight:800;color:var(--yellow)">\${SIM}\${fmt(total)}</div>
          <div style="font-size:10px;color:var(--text3)">Total original</div>
        </div>
      </div>
      \${tienePagoParcial?\`
      <div style="background:var(--bg3);border-radius:6px;padding:6px 10px;display:flex;justify-content:space-between;font-size:12px">
        <span style="color:var(--green)">Pagado: \${SIM}\${fmt(pagado)}</span>
        <span style="color:var(--red);font-weight:700">Pendiente: \${SIM}\${fmt(pendiente)}</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:5px;overflow:hidden">
        <div style="background:var(--green);height:100%;width:\${Math.min(100,pagado/total*100).toFixed(1)}%"></div>
      </div>\`:''}
      <button onclick="openFiadoCobro(\${v.id},\${pendiente},this.dataset.cli,\${total},\${pagado})" data-cli="\${(v.cliente_nombre||'Sin cliente').replace(/"/g,'&quot;')}"
        style="background:var(--green);border:none;color:#fff;border-radius:8px;padding:9px;font-size:13px;font-weight:700;cursor:pointer;width:100%">
        \${tienePagoParcial?\`Cobrar (\${SIM}\${fmt(pendiente)} pendiente)\`:'Cobrar'}
      </button>
    </div>\`;
  }).join('');
}
function openFiadoCobro(id,pendiente,cliente,total,pagado){
  fiadoModalId=id;
  fiadoModalPendiente=pendiente;
  const mt=G('caja-modal-title'),ml=G('caja-modal-label'),mi=G('caja-modal-inp'),
        mb=G('caja-modal-btn'),ex=G('caja-extra'),er=G('caja-modal-err');
  mi.value=pendiente.toFixed(2);
  er.textContent='';
  mt.textContent=\`Cobrar fiado - \${cliente||'Sin cliente'}\`;
  ml.textContent=\`Monto a cobrar (pendiente: \${SIM}\${fmt(pendiente)})\`;
  ex.style.display='flex';
  G('caja-modal-desc').value=\`Cobro fiado #\${id}\`;
  mb.textContent='Confirmar cobro';mb.style.background='var(--green)';
  // Nota de pago total vs parcial
  let nota=ex.querySelector('#fiado-nota');
  if(!nota){nota=document.createElement('div');nota.id='fiado-nota';nota.style.cssText='font-size:11px;color:var(--text3);margin-top:2px';ex.appendChild(nota);}
  nota.textContent=\`Total deuda: \${SIM}\${fmt(total)} · Pagado: \${SIM}\${fmt(pagado)}\`;
  cajaAction='fiado';
  G('caja-num-modal').style.display='flex';
  setTimeout(()=>{mi.focus();mi.select();},100);
}
async function confirmFiadoCobro(){
  const monto=parseFloat(G('caja-modal-inp').value)||0;
  const metodo=G('caja-modal-metodo')?.value||'efectivo';
  const er=G('caja-modal-err');er.textContent='';
  if(monto<=0){er.textContent='Ingresa un monto válido';return;}
  if(monto>fiadoModalPendiente+0.01){er.textContent=\`Máximo: \${SIM}\${fmt(fiadoModalPendiente)}\`;return;}
  G('caja-modal-btn').disabled=true;
  try{
    const r=await fetch(\`/api/fiados/\${fiadoModalId}/cobrar\`,{
      method:'PUT',headers:{...AH,'Content-Type':'application/json'},
      body:JSON.stringify({monto,metodo_pago:metodo})
    });
    const d=await r.json();
    if(r.ok){
      closeCajaModal();
      if(d.pagado_total){
        fiadosData=fiadosData.filter(x=>x.id!==fiadoModalId);
        toast(\`Fiado cobrado totalmente ✓\`);
      }else{
        // Actualizar el dato local con el nuevo monto pagado
        const fi=fiadosData.find(x=>x.id===fiadoModalId);
        if(fi)fi.monto_pagado=d.nuevo_pagado;
        toast(\`Cobrado \${SIM}\${fmt(monto)} · Pendiente: \${SIM}\${fmt(d.pendiente)}\`);
      }
      renderFiados();
      if(loaded['caja']){loaded['caja']=false;loadCaja();loadMovCaja();}
    }else{er.textContent=d.error||'Error al cobrar';G('caja-modal-btn').disabled=false;}
  }catch{er.textContent='Error de conexion';G('caja-modal-btn').disabled=false;}
}

// ── CAJA ────────────────────────────────────────────────────────────────────
let cajaAction='',cajaData=null;
async function loadCaja(){
  const el=G('caja-estado');el.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/caja/estado',{headers:AH});
    if(!r.ok){el.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    cajaData=await r.json();
    renderCaja();
  }catch{el.innerHTML='<div class="emsg">Error al cargar</div>';}
}
function renderCaja(){
  const el=G('caja-estado');
  if(!cajaData){el.innerHTML='<div class="emsg">Error</div>';return;}
  if(!cajaData.abierta){
    el.innerHTML=\`
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="cktag ckcerrada">CERRADA</span>
          <span style="font-size:13px;color:var(--text3)">Caja sin sesion activa</span>
        </div>
        <button class="cajabtn abrir" onclick="openCajaModal('abrir')">Abrir Caja</button>
      </div>\`;
    return;
  }
  const s=cajaData.sesion;
  const saldo=(s.monto_inicial||0)+(s.total_ventas||0)+(s.total_ingresos_extra||0)-(s.total_egresos||0);
  el.innerHTML=\`
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="cajahdr">
        <span class="cktag ckabierta">ABIERTA</span>
        <span style="font-size:12px;color:var(--text3)">\${s.fecha_apertura||''}</span>
      </div>
      <div class="cajagrid">
        <div class="scard"><div class="sv" style="color:var(--green)">\${SIM}\${fmt(s.total_ventas)}</div><div class="sl">Ventas</div></div>
        <div class="scard"><div class="sv" style="color:var(--accent)">\${SIM}\${fmt(s.efectivo)}</div><div class="sl">Efectivo</div></div>
        <div class="scard"><div class="sv" style="color:var(--yellow)">\${SIM}\${fmt((s.tarjeta||0)+(s.transferencia||0)+(s.mercadopago||0))}</div><div class="sl">Digital</div></div>
        <div class="scard"><div class="sv" style="color:var(--red)">\${SIM}\${fmt(s.total_egresos)}</div><div class="sl">Egresos</div></div>
        <div class="scard" style="grid-column:span 2"><div class="sv" style="color:var(--green)">\${SIM}\${fmt(saldo)}</div><div class="sl">Saldo caja (estimado)</div></div>
      </div>
      <div class="cajabtns">
        <button class="cajabtn movim" onclick="openCajaModal('ingreso')">+ Ingreso</button>
        <button class="cajabtn movim" onclick="openCajaModal('egreso')">- Egreso</button>
      </div>
      <button class="cajabtn cerrar" onclick="openCajaModal('cerrar')">Cerrar Caja</button>
    </div>\`;
}
async function loadMovCaja(){
  try{
    const r=await fetch('/api/caja/movimientos',{headers:AH});
    if(!r.ok)return;
    const movs=await r.json();
    const tab=G('t-caja');if(!tab)return;
    let mv=tab.querySelector('#caja-movs');
    if(!mv){
      mv=document.createElement('div');mv.id='caja-movs';
      mv.innerHTML='<div class="secttitle" style="margin:8px 0 4px">Movimientos</div><div id="caja-movs-list" class="dlist"></div>';
      tab.appendChild(mv);
    }
    const list=mv.querySelector('#caja-movs-list');
    if(!movs.length){list.innerHTML='<div class="emsg">Sin movimientos</div>';return;}
    list.innerHTML=movs.map(m=>\`
      <div class="drow">
        <div class="drl">
          <span class="drm">\${m.descripcion||(m.tipo==='ingreso'?'Ingreso':'Egreso')}\${m.venta_numero?' (#'+m.venta_numero+')':''}</span>
          <span class="drs">\${m.fecha||''} · \${m.metodo_pago||''}</span>
        </div>
        <span class="drr \${m.tipo==='egreso'?'red':''}">\${m.tipo==='egreso'?'-':''}\${SIM}\${fmt(m.monto)}</span>
      </div>
    \`).join('');
  }catch{}
}
let _cajaConfirmFn=null;
function openCajaModal(tipo){
  cajaAction=tipo;
  const mt=G('caja-modal-title'),ml=G('caja-modal-label'),mi=G('caja-modal-inp'),
        mb=G('caja-modal-btn'),ex=G('caja-extra'),er=G('caja-modal-err');
  mi.value='';er.textContent='';G('caja-modal-desc').value='';
  if(tipo==='abrir'){mt.textContent='Abrir Caja';ml.textContent='Monto inicial (efectivo en caja)';ex.style.display='none';mb.textContent='Abrir Caja';mb.style.background='var(--green)';}
  else if(tipo==='cerrar'){mt.textContent='Cerrar Caja';ml.textContent='Monto final (efectivo contado)';ex.style.display='none';mb.textContent='Cerrar Caja';mb.style.background='var(--red)';}
  else if(tipo==='ingreso'){mt.textContent='Registrar Ingreso';ml.textContent='Monto';ex.style.display='flex';mb.textContent='Registrar';mb.style.background='var(--green)';}
  else if(tipo==='egreso'){mt.textContent='Registrar Egreso';ml.textContent='Monto';ex.style.display='flex';mb.textContent='Registrar';mb.style.background='var(--red)';}
  G('caja-num-modal').style.display='flex';
  setTimeout(()=>G('caja-modal-inp').focus(),100);
}
function closeCajaModal(){G('caja-num-modal').style.display='none';}
async function confirmCajaAction(){
  if(cajaAction==='fiado'){confirmFiadoCobro();return;}
  const monto=parseFloat(G('caja-modal-inp').value)||0;
  const er=G('caja-modal-err');
  er.textContent='';
  if(monto<0){er.textContent='Monto inválido';return;}
  G('caja-modal-btn').disabled=true;
  try{
    let r,desc=G('caja-modal-desc').value||'',met=G('caja-modal-metodo')?.value||'efectivo';
    if(cajaAction==='abrir'){
      r=await fetch('/api/caja/abrir',{method:'POST',headers:{...AH,'Content-Type':'application/json'},body:JSON.stringify({monto_inicial:monto})});
    }else if(cajaAction==='cerrar'){
      r=await fetch('/api/caja/cerrar',{method:'POST',headers:{...AH,'Content-Type':'application/json'},body:JSON.stringify({monto_final:monto})});
    }else{
      r=await fetch('/api/caja/movimiento',{method:'POST',headers:{...AH,'Content-Type':'application/json'},body:JSON.stringify({tipo:cajaAction,monto,descripcion:desc,metodo_pago:met})});
    }
    const d=await r.json();
    if(r.ok){
      closeCajaModal();
      loaded['caja']=false;loadCaja();loadMovCaja();
      toast(cajaAction==='abrir'?'Caja abierta ✓':cajaAction==='cerrar'?'Caja cerrada ✓':'Movimiento registrado ✓');
    }else{er.textContent=d.error||'Error';}
  }catch{er.textContent='Error de conexion';}
  G('caja-modal-btn').disabled=false;
}

// ── PRODUCTOS ADMIN ──────────────────────────────────────────────────────────
let prodsAdmin=[],editingProdId=null;
async function loadProdsAdmin(){
  const list=G('prodadmin-list');list.innerHTML='<div class="emsg">Cargando...</div>';
  try{
    const r=await fetch('/api/productos',{headers:AH});
    if(!r.ok){list.innerHTML='<div class="emsg">Sin permisos</div>';return;}
    prodsAdmin=await r.json();
    filtProdsAdmin();
  }catch{list.innerHTML='<div class="emsg">Error al cargar</div>';}
}
function filtProdsAdmin(){
  const s=(G('prodadmin-srch')?.value||'').toLowerCase();
  const f=s?prodsAdmin.filter(p=>(p.nombre||'').toLowerCase().includes(s)||(p.codigo||'').toLowerCase().includes(s)):prodsAdmin;
  const list=G('prodadmin-list');
  if(!f.length){list.innerHTML='<div class="emsg">Sin resultados</div>';return;}
  list.innerHTML='<div class="dlist">'+f.map(p=>\`
    <div class="prodrow">
      <div class="prodrl">
        <span class="prodrm \${!p.activo?'':''}"\${!p.activo?' style="opacity:.5"':''}>\${p.nombre}\${!p.activo?' (inactivo)':''}</span>
        <span class="prodrs">Precio: \${SIM}\${fmt(p.precio_venta)} · Stock: \${p.stock_actual??'-'}</span>
      </div>
      <button class="editbtn" onclick="openEditProd(\${p.id})">Editar</button>
    </div>
  \`).join('')+'</div>';
}
function openEditProd(id){
  const p=prodsAdmin.find(x=>x.id===id);
  if(!p)return;
  editingProdId=id;
  G('modal-title').textContent='Editar: '+p.nombre;
  G('edt-nombre').value=p.nombre||'';
  G('edt-pventa').value=p.precio_venta??'';
  G('edt-pcosto').value=p.precio_costo??'';
  G('edt-stock').value=p.stock_actual??'';
  G('edt-smin').value=p.stock_minimo??'';
  G('edt-activo').checked=!!p.activo;
  G('edt-catalogo').checked=!!p.en_catalogo;
  G('edt-err').textContent='';
  G('prod-modal').style.display='flex';
  setTimeout(()=>G('edt-nombre').focus(),100);
}
function closeModal(){G('prod-modal').style.display='none';editingProdId=null;}
async function saveProd(){
  if(!editingProdId)return;
  const nombre=G('edt-nombre').value.trim();
  if(!nombre){G('edt-err').textContent='El nombre es requerido';return;}
  const body={
    nombre,
    precio_venta:parseFloat(G('edt-pventa').value)||0,
    precio_costo:parseFloat(G('edt-pcosto').value)||0,
    stock_actual:parseFloat(G('edt-stock').value)||0,
    stock_minimo:parseFloat(G('edt-smin').value)||0,
    activo:G('edt-activo').checked?1:0,
    en_catalogo:G('edt-catalogo').checked?1:0,
  };
  G('edt-err').textContent='';
  try{
    const r=await fetch(\`/api/productos/\${editingProdId}\`,{method:'PUT',headers:{...AH,'Content-Type':'application/json'},body:JSON.stringify(body)});
    const d=await r.json();
    if(r.ok){
      const idx=prodsAdmin.findIndex(x=>x.id===editingProdId);
      if(idx>=0)prodsAdmin[idx]={...prodsAdmin[idx],...body};
      closeModal();
      filtProdsAdmin();
      toast('Producto guardado ✓');
      // Actualizar la lista de POS también
      prods=prods.map(p=>p.id===editingProdId?{...p,...body}:p);
    }else{G('edt-err').textContent=d.error||'Error al guardar';}
  }catch{G('edt-err').textContent='Error de conexion';}
}
</script>
</body>
</html>`;
}
