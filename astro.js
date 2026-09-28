/* Calcoli astronomici per le effemeridi del Mugello (nessun servizio esterno).
   Sole e Luna: formule di SunCalc (V. Agafonkin, licenza BSD, basate su Meeus e
   sulle formule di astronomy.stackexchange), Luna con la formula a bassa precisione
   dell'Astronomical Almanac; pianeti: elementi orbitali approssimati
   del JPL (Standish, validi 1800–2050, errore di qualche primo d'arco); stagioni
   e fasi lunari: algoritmi di J. Meeus, Astronomical Algorithms. Orari sempre in ora italiana. */
(function(){
  const PI=Math.PI, sin=Math.sin, cos=Math.cos, tan=Math.tan, asin=Math.asin, atan=Math.atan2, acos=Math.acos, rad=PI/180;
  const dayMs=864e5, J1970=2440588, J2000=2451545, e=rad*23.4397;
  const TZ="Europe/Rome";
  const LUOGO={nome:"Borgo San Lorenzo",lat:43.955,lon:11.386,quota:196};

  const toJulian=d=>d.valueOf()/dayMs-0.5+J1970, fromJulian=j=>new Date((j+0.5-J1970)*dayMs), toDays=d=>toJulian(d)-J2000;
  const rightAscension=(l,b)=>atan(sin(l)*cos(e)-tan(b)*sin(e),cos(l));
  const declination=(l,b)=>asin(sin(b)*cos(e)+cos(b)*sin(e)*sin(l));
  const azimuth=(H,phi,dec)=>atan(sin(H),cos(H)*sin(phi)-tan(dec)*cos(phi));
  const altitude=(H,phi,dec)=>asin(sin(phi)*sin(dec)+cos(phi)*cos(dec)*cos(H));
  const siderealTime=(d,lw)=>rad*(280.16+360.9856235*d)-lw;
  const astroRefraction=h=>{if(h<0)h=0;return 0.0002967/Math.tan(h+0.00312536/(h+0.08901179));};
  const solarMeanAnomaly=d=>rad*(357.5291+0.98560028*d);
  function eclipticLongitude(M){const C=rad*(1.9148*sin(M)+0.02*sin(2*M)+0.0003*sin(3*M)),P=rad*102.9372;return M+C+P+PI;}
  function sunCoords(d){const M=solarMeanAnomaly(d),L=eclipticLongitude(M);return {dec:declination(L,0),ra:rightAscension(L,0),L};}

  function sunPosition(date,lat=LUOGO.lat,lng=LUOGO.lon){
    const lw=rad*-lng,phi=rad*lat,d=toDays(date),c=sunCoords(d),H=siderealTime(d,lw)-c.ra;
    return {azimuth:azimuth(H,phi,c.dec),altitude:altitude(H,phi,c.dec)};
  }
  const J0=0.0009;
  const julianCycle=(d,lw)=>Math.round(d-J0-lw/(2*PI));
  const approxTransit=(Ht,lw,n)=>J0+(Ht+lw)/(2*PI)+n;
  const solarTransitJ=(ds,M,L)=>J2000+ds+0.0053*sin(M)-0.0069*sin(2*L);
  const hourAngle=(h,phi,d)=>acos((sin(h)-sin(phi)*sin(d))/(cos(phi)*cos(d)));
  const observerAngle=h=>-2.076*Math.sqrt(h)/60;
  function getSetJ(h,lw,phi,dec,n,M,L){const w=hourAngle(h,phi,dec),a=approxTransit(w,lw,n);return solarTransitJ(a,M,L);}
  const ANGOLI=[[-0.833,"alba","tramonto"],[-0.3,"albaFine","tramontoInizio"],[-6,"civileInizio","civileFine"],[-12,"nauticoInizio","nauticoFine"],[-18,"astroInizio","astroFine"],[6,"oroMattinaFine","oroSeraInizio"],[-4,"bluMattinaFine","bluSeraInizio"]];
  // orari del Sole per il giorno civile che contiene "date" (si usa il mezzogiorno italiano)
  function sunTimes(date,lat=LUOGO.lat,lng=LUOGO.lon,height=0){ // quota 0: Borgo è in fondovalle, l'orizzonte non si abbassa
    const lw=rad*-lng,phi=rad*lat,dh=observerAngle(height),d=toDays(date),n=julianCycle(d,lw),ds=approxTransit(0,lw,n);
    const M=solarMeanAnomaly(ds),L=eclipticLongitude(M),dec=declination(L,0),Jnoon=solarTransitJ(ds,M,L);
    const out={mezzogiorno:fromJulian(Jnoon),notte:fromJulian(Jnoon-0.5)};
    ANGOLI.forEach(([a,r,s])=>{const h0=(a+(a<0?dh:0))*rad,Jset=getSetJ(h0,lw,phi,dec,n,M,L);
      if(isNaN(Jset)){out[r]=out[s]=null;return;}out[s]=fromJulian(Jset);out[r]=fromJulian(Jnoon-(Jset-Jnoon));});
    out.altezzaMax=90-lat+dec/rad;
    return out;
  }

  function moonCoords(d){ // Astronomical Almanac, bassa precisione: ~0,3° in longitudine
    const T=d/36525,S=(a,b)=>sin(rad*(a+b*T)),C=(a,b)=>cos(rad*(a+b*T));
    const l=rad*(218.32+481267.881*T+6.29*S(135.0,477198.87)-1.27*S(259.3,-413335.36)+0.66*S(235.7,890534.22)+0.21*S(269.9,954397.74)-0.19*S(357.5,35999.05)-0.11*S(186.5,966404.03));
    const b=rad*(5.13*S(93.3,483202.02)+0.28*S(228.2,960400.89)-0.28*S(318.3,6003.15)-0.17*S(217.6,-407332.21));
    const par=rad*(0.9508+0.0518*C(135.0,477198.87)+0.0095*C(259.3,-413335.36)+0.0078*C(235.7,890534.22)+0.0028*C(269.9,954397.74));
    return {ra:rightAscension(l,b),dec:declination(l,b),dist:6378.14/sin(par),par};
  }
  function moonPosition(date,lat=LUOGO.lat,lng=LUOGO.lon){
    const lw=rad*-lng,phi=rad*lat,d=toDays(date),c=moonCoords(d),H=siderealTime(d,lw)-c.ra,g=altitude(H,phi,c.dec);
    const h=g-c.par*cos(g); // parallasse: altezza vista dalla superficie
    return {azimuth:azimuth(H,phi,c.dec),altitude:h+astroRefraction(h),geo:g,par:c.par,distance:c.dist};
  }
  function moonIllumination(date){
    const d=toDays(date),s=sunCoords(d),m=moonCoords(d),sdist=149598000;
    const phi=acos(sin(s.dec)*sin(m.dec)+cos(s.dec)*cos(m.dec)*cos(s.ra-m.ra)),inc=atan(sdist*sin(phi),m.dist-sdist*cos(phi));
    const angle=atan(cos(s.dec)*sin(s.ra-m.ra),sin(s.dec)*cos(m.dec)-cos(s.dec)*sin(m.dec)*cos(s.ra-m.ra));
    return {fraction:(1+cos(inc))/2,phase:0.5+0.5*inc*(angle<0?-1:1)/PI,angle};
  }
  // sorgere e tramonto della Luna tra la mezzanotte italiana di "date" e quella successiva
  function moonTimes(date,lat=LUOGO.lat,lng=LUOGO.lon){
    const t=mezzanotte(date),H=h=>new Date(t.valueOf()+h*36e5);
    const ore=(mezzanotte(new Date(t.valueOf()+30*36e5))-t)/36e5; // 23, 24 o 25 (cambio d'ora)
    // altezza geocentrica rispetto a h0 = 0,7275·parallasse − 0,5667° (bordo superiore, rifrazione)
    const alt=x=>{const p=moonPosition(x,lat,lng);return p.geo-(0.7275*p.par-0.5667*rad);};
    let h0=alt(t),rise,set,ye;
    for(let i=1;i<=ore;i+=2){
      const h1=alt(H(i)),h2=alt(H(i+1));
      const a=(h0+h2)/2-h1,b=(h2-h0)/2,xe=-b/(2*a);ye=(a*xe+b)*xe+h1;const dd=b*b-4*a*h1;let roots=0,x1=0,x2=0;
      if(dd>=0){const dx=Math.sqrt(dd)/(Math.abs(a)*2);x1=xe-dx;x2=xe+dx;if(Math.abs(x1)<=1)roots++;if(Math.abs(x2)<=1)roots++;if(x1<-1)x1=x2;}
      if(roots===1){if(h0<0)rise=i+x1;else set=i+x1;}else if(roots===2){rise=i+(ye<0?x2:x1);set=i+(ye<0?x1:x2);}
      if(rise&&set)break;h0=h2;
    }
    const r={};if(rise&&rise<=ore)r.sorge=H(rise);if(set&&set<=ore)r.tramonta=H(set);
    if(!r.sorge&&!r.tramonta)r[ye>0?"sempreSu":"sempreGiu"]=true;return r;
  }
  const FASI=[[0,"Luna nuova","🌑"],[0.25,"Primo quarto","🌓"],[0.5,"Luna piena","🌕"],[0.75,"Ultimo quarto","🌗"]];
  function nomeFase(p){ // p = fase 0..1
    if(p<0.02||p>0.98)return ["Luna nuova","🌑"];if(p<0.23)return ["Crescente","🌒"];if(p<0.27)return ["Primo quarto","🌓"];
    if(p<0.48)return ["Gibbosa crescente","🌔"];if(p<0.52)return ["Luna piena","🌕"];if(p<0.73)return ["Gibbosa calante","🌖"];
    if(p<0.77)return ["Ultimo quarto","🌗"];return ["Calante","🌘"];
  }
  const DT=69/86400; // ΔT (TT−UT) in giorni, ~2026
  // istante di una fase lunare (Meeus, cap. 49; errore di un paio di minuti). q: 0 nuova, .25, .5, .75
  function istanteFase(k){
    const q=((k%1)+1)%1,T=k/1236.85,E=1-0.002516*T-0.0000074*T*T,R=x=>rad*x;
    let J=2451550.09766+29.530588861*k+0.00015437*T*T-0.00000015*T*T*T+0.00000000073*T**4;
    const M=R(2.5534+29.1053567*k-0.0000014*T*T),Mp=R(201.5643+385.81693528*k+0.0107582*T*T+0.00001238*T*T*T),
      F=R(160.7108+390.67050284*k-0.0016118*T*T-0.00000227*T*T*T),Om=R(124.7746-1.56375588*k+0.0020672*T*T);
    if(q<0.01||Math.abs(q-0.5)<0.01){const c=q<0.01?[-0.40720,0.17241,0.01608,0.01039,0.00739,-0.00514,0.00208]:[-0.40614,0.17302,0.01614,0.01043,0.00734,-0.00515,0.00209];
      J+=c[0]*sin(Mp)+c[1]*E*sin(M)+c[2]*sin(2*Mp)+c[3]*sin(2*F)+c[4]*E*sin(Mp-M)+c[5]*E*sin(Mp+M)+c[6]*E*E*sin(2*M)
        -0.00111*sin(Mp-2*F)-0.00057*sin(Mp+2*F)+0.00056*E*sin(2*Mp+M)-0.00042*sin(3*Mp)+0.00042*E*sin(M+2*F)
        +0.00038*E*sin(M-2*F)-0.00024*E*sin(2*Mp-M)-0.00017*sin(Om)-0.00007*sin(Mp+2*M)+0.00004*sin(2*Mp-2*F)+0.00004*sin(3*M);
    }else{
      J+=-0.62801*sin(Mp)+0.17172*E*sin(M)-0.01183*E*sin(Mp+M)+0.00862*sin(2*Mp)+0.00804*sin(2*F)+0.00454*E*sin(Mp-M)
        +0.00204*E*E*sin(2*M)-0.0018*sin(Mp-2*F)-0.0007*sin(Mp+2*F)-0.0004*sin(3*Mp)-0.00034*E*sin(2*Mp-M)
        +0.00032*E*sin(M+2*F)+0.00032*E*sin(M-2*F)-0.00028*E*E*sin(Mp+2*M)+0.00027*E*sin(2*Mp+M)-0.00017*sin(Om);
      const W=0.00306-0.00038*E*cos(M)+0.00026*cos(Mp)-0.00002*cos(Mp-M)+0.00002*cos(Mp+M)+0.00002*cos(2*F);
      J+=q<0.5?W:-W;
    }
    return fromJulian(J-DT);
  }
  // prossime n fasi principali a partire da "date"
  function prossimeFasi(date,n=4){
    let k=Math.floor(((date.valueOf()/dayMs+J1970-0.5-2451550.09766)/29.530588861)*4)/4-0.5;const out=[];
    for(let i=0;out.length<n&&i<n+8;i++,k+=0.25){const t=istanteFase(k);if(t<date)continue;
      const [f,nome,ic]=FASI[Math.round((((k%1)+1)%1)*4)%4];out.push({data:t,nome,ic,f});}
    return out;
  }

  /* ---------- pianeti (elementi orbitali JPL, J2000) ---------- */
  const EL={ // a, e, I, L, lunghezza del perielio, nodo; poi i tassi per secolo
    Mercurio:[0.38709927,0.20563593,7.00497902,252.25032350,77.45779628,48.33076593, 0.00000037,0.00001906,-0.00594749,149472.67411175,0.16047689,-0.12534081],
    Venere:[0.72333566,0.00677672,3.39467605,181.97909950,131.60246718,76.67984255, 0.00000390,-0.00004107,-0.00078890,58517.81538729,0.00268329,-0.27769418],
    Terra:[1.00000261,0.01671123,-0.00001531,100.46457166,102.93768193,0, 0.00000562,-0.00004392,-0.01294668,35999.37244981,0.32327364,0],
    Marte:[1.52371034,0.09339410,1.84969142,-4.55343205,-23.94362959,49.55953891, 0.00001847,0.00007882,-0.00813131,19140.30268499,0.44441088,-0.29257343],
    Giove:[5.20288700,0.04838624,1.30439695,34.39644051,14.72847983,100.47390909, -0.00011607,-0.00013253,-0.00183714,3034.74612775,0.21252668,0.20469106],
    Saturno:[9.53667594,0.05386179,2.48599187,49.95424423,92.59887831,113.66242448, -0.00125060,-0.00050991,0.00193609,1222.49362201,-0.41897216,-0.28867794]
  };
  function helio(nome,T){
    const k=EL[nome],a=k[0]+k[6]*T,ec=k[1]+k[7]*T,I=(k[2]+k[8]*T)*rad,L=k[3]+k[9]*T,wb=k[4]+k[10]*T,O=(k[5]+k[11]*T)*rad;
    const w=wb*rad-O;let M=((L-wb)%360+540)%360-180;M*=rad;let E=M+ec*sin(M);for(let i=0;i<8;i++)E=E-(E-ec*sin(E)-M)/(1-ec*cos(E));
    const x=a*(cos(E)-ec),y=a*Math.sqrt(1-ec*ec)*sin(E);
    return [(cos(w)*cos(O)-sin(w)*sin(O)*cos(I))*x+(-sin(w)*cos(O)-cos(w)*sin(O)*cos(I))*y,
            (cos(w)*sin(O)+sin(w)*cos(O)*cos(I))*x+(-sin(w)*sin(O)+cos(w)*cos(O)*cos(I))*y,
            (sin(w)*sin(I))*x+(cos(w)*sin(I))*y];
  }
  function planetPosition(nome,date,lat=LUOGO.lat,lng=LUOGO.lon){
    const d=toDays(date),T=d/36525,p=helio(nome,T),t=helio("Terra",T),x=p[0]-t[0],y=p[1]-t[1],z=p[2]-t[2];
    const xe=x,ye=y*cos(e)-z*sin(e),ze=y*sin(e)+z*cos(e),ra=atan(ye,xe),dec=atan(ze,Math.sqrt(xe*xe+ye*ye));
    const lw=rad*-lng,phi=rad*lat,H=siderealTime(d,lw)-ra;let h=altitude(H,phi,dec);h+=astroRefraction(h);
    const lonP=atan(y,x),lonS=atan(-t[1],-t[0]);let el=Math.abs(((lonP-lonS)/rad+540)%360-180);
    return {altitude:h,azimuth:azimuth(H,phi,dec),dist:Math.sqrt(x*x+y*y+z*z),elongazione:el};
  }
  const PIANETI=["Mercurio","Venere","Marte","Giove","Saturno"];

  /* ---------- stagioni: equinozi e solstizi (Meeus, cap. 27; errore < 1 minuto) ---------- */
  const STAG={0:[2451623.80984,365242.37404,0.05169,-0.00411,-0.00057],90:[2451716.56767,365241.62603,0.00325,0.00888,-0.0003],
    180:[2451810.21715,365242.01767,-0.11575,0.00337,0.00078],270:[2451900.05952,365242.74049,-0.06223,-0.00823,0.00032]};
  const PER=[[485,324.96,1934.136],[203,337.23,32964.467],[199,342.08,20.186],[182,27.85,445267.112],[156,73.14,45036.886],[136,171.52,22518.443],
    [77,222.54,65928.934],[74,296.72,3034.906],[70,243.58,9037.513],[58,119.81,33718.147],[52,297.17,150.678],[50,21.02,2281.226],
    [45,247.54,29929.562],[44,325.15,31555.956],[29,60.93,4443.417],[18,155.12,67555.328],[17,288.79,4562.452],[16,198.04,62894.029],
    [14,199.76,31436.921],[12,95.39,14577.848],[12,287.11,31931.756],[12,320.81,34777.259],[9,227.73,1222.114],[8,15.45,16859.074]];
  function stagione(anno,gradi){
    const c=STAG[gradi],Y=(anno-2000)/1000,J0=c[0]+c[1]*Y+c[2]*Y*Y+c[3]*Y**3+c[4]*Y**4,T=(J0-2451545)/36525;
    const W=rad*(35999.373*T-2.47),dl=1+0.0334*cos(W)+0.0007*cos(2*W),S=PER.reduce((s,[A,B,C])=>s+A*cos(rad*(B+C*T)),0);
    return fromJulian(J0+0.00001*S/dl-DT);
  }

  /* ---------- calendario degli eventi del cielo ---------- */
  const SCIAMI=[["Quadrantidi",1,3,110,"radiante nel Boote, visibili dopo mezzanotte"],["Liridi",4,22,18,"radiante nella Lira"],
    ["Eta Aquaridi",5,6,50,"detriti della cometa di Halley, prima dell'alba"],["Delta Aquaridi",7,30,25,"basse sull'orizzonte sud"],
    ["Perseidi",8,12,100,"le «lacrime di San Lorenzo», il patrono di Borgo"],["Draconidi",10,8,10,"radiante nel Dragone, prima serata"],
    ["Orionidi",10,21,20,"altri detriti della cometa di Halley"],["Leonidi",11,17,15,"radiante nel Leone, dopo mezzanotte"],
    ["Geminidi",12,14,150,"lo sciame più ricco dell'anno"],["Ursidi",12,22,10,"radiante vicino all'Orsa Minore"]];
  const ultimaDomenica=(y,m)=>{const d=new Date(Date.UTC(y,m,0));return d.getUTCDate()-d.getUTCDay();};
  function eventi(da,n=6){
    const out=[],[y0]=partiRoma(da);
    for(const y of [y0,y0+1]){
      [[0,"Equinozio di primavera","🌱","inizia la primavera astronomica"],[90,"Solstizio d'estate","☀️","il giorno più lungo dell'anno"],
       [180,"Equinozio d'autunno","🍂","inizia l'autunno astronomico"],[270,"Solstizio d'inverno","❄️","il giorno più corto dell'anno"]]
        .forEach(([g,nome,ic,nota])=>out.push({data:stagione(y,g),nome,ic,nota,tipo:"stagione",ora:true}));
      SCIAMI.forEach(([nome,m,d,zhr,nota])=>out.push({data:mezzogiorno(y,m,d),nome:"Picco delle "+nome,ic:"☄️",nota:nota+" · fino a "+zhr+" meteore/ora",tipo:"sciame",notte:true}));
      out.push({data:new Date(Date.UTC(y,2,ultimaDomenica(y,3),1)),nome:"Torna l'ora legale",ic:"🕑",nota:"alle 2 le lancette avanzano di un'ora",tipo:"ora"});
      out.push({data:new Date(Date.UTC(y,9,ultimaDomenica(y,10),1)),nome:"Torna l'ora solare",ic:"🕑",nota:"alle 3 le lancette tornano indietro di un'ora",tipo:"ora"});
    }
    const oggi=mezzanotte(da);
    return out.filter(e=>e.data>=oggi).sort((a,b)=>a.data-b.data).slice(0,n);
  }

  /* ---------- fuso e formati ---------- */
  function offsetMin(date){const s=new Intl.DateTimeFormat("en-US",{timeZone:TZ,hour12:false,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).formatToParts(date);
    const g=k=>+s.find(p=>p.type===k).value;return (Date.UTC(g("year"),g("month")-1,g("day"),g("hour")%24,g("minute"))-Math.floor(date.valueOf()/6e4)*6e4)/6e4;}
  function partiRoma(date){const s=new Intl.DateTimeFormat("en-CA",{timeZone:TZ,year:"numeric",month:"2-digit",day:"2-digit"}).format(date);return s.split("-").map(Number);}
  function mezzanotte(date){const [y,m,d]=partiRoma(date),t=Date.UTC(y,m-1,d);return new Date(t-offsetMin(new Date(t))*6e4);}
  function mezzogiorno(y,m,d){const t=Date.UTC(y,m-1,d,12);return new Date(t-offsetMin(new Date(t))*6e4);}
  const ora=d=>d?new Intl.DateTimeFormat("it-IT",{timeZone:TZ,hour:"2-digit",minute:"2-digit"}).format(d):"—";
  const giorno=(d,o)=>new Intl.DateTimeFormat("it-IT",Object.assign({timeZone:TZ,day:"numeric",month:"long"},o||{})).format(d);
  const DIR=["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  const direzione=az=>DIR[Math.round((((az/rad)+180)%360)/22.5)%16]; // azimut SunCalc: da sud, verso ovest
  const gradiAz=az=>((az/rad)+180+360)%360;

  window.Astro={LUOGO,TZ,sunPosition,sunTimes,moonPosition,moonIllumination,moonTimes,nomeFase,prossimeFasi,istanteFase,planetPosition,PIANETI,stagione,eventi,SCIAMI,mezzanotte,mezzogiorno,partiRoma,offsetMin,ora,giorno,direzione,gradiAz,rad};
})();
