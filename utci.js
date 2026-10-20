/* UTCI (Universal Thermal Climate Index): approssimazione polinomiale ufficiale di Bröde et al. (2012),
   la stessa del codice di riferimento distribuito su utci.org; coefficienti trascritti dalla libreria
   pythermalcomfort (licenza MIT), che restituisce 24,6 °C per Ta=25 °C, Tmrt=25 °C, v=1 m/s, UR=50%.
   Ta temperatura dell'aria (°C), Tmrt temperatura media radiante (°C), va vento a 10 m (m/s), rh umidità (%).
   Campo di validità: Ta −50…50 °C, Tmrt−Ta −30…70 °C, va 0,5…17 m/s; fuori da questo campo restituisce null. */
(function(g){
  "use strict";
  function poly(Ta,va,D,Pa){
    return Ta + 0.607562052 + (-0.0227712343) * Ta + 8.06470249e-4 * Ta * Ta + -1.54271372e-4 * Ta * Ta * Ta + -3.24651735e-6 * Ta * Ta * Ta * Ta +
    7.32602852e-8 * Ta * Ta * Ta * Ta * Ta + 1.35959073e-9 * Ta * Ta * Ta * Ta * Ta * Ta + (-2.25836520) * va + 0.0880326035 * Ta * va +
    0.00216844454 * Ta * Ta * va + -1.53347087e-5 * Ta * Ta * Ta * va + -5.72983704e-7 * Ta * Ta * Ta * Ta * va +
    -2.55090145e-9 * Ta * Ta * Ta * Ta * Ta * va + (-0.751269505) * va * va + (-0.00408350271) * Ta * va * va + -5.21670675e-5 * Ta * Ta * va * va +
    1.94544667e-6 * Ta * Ta * Ta * va * va + 1.14099531e-8 * Ta * Ta * Ta * Ta * va * va + 0.158137256 * va * va * va +
    -6.57263143e-5 * Ta * va * va * va + 2.22697524e-7 * Ta * Ta * va * va * va + -4.16117031e-8 * Ta * Ta * Ta * va * va * va +
    (-0.0127762753) * va * va * va * va + 9.66891875e-6 * Ta * va * va * va * va + 2.52785852e-9 * Ta * Ta * va * va * va * va +
    4.56306672e-4 * va * va * va * va * va + -1.74202546e-7 * Ta * va * va * va * va * va + -5.91491269e-6 * va * va * va * va * va * va +
    0.398374029 * D + 1.83945314e-4 * Ta * D + -1.73754510e-4 * Ta * Ta * D + -7.60781159e-7 * Ta * Ta * Ta * D +
    3.77830287e-8 * Ta * Ta * Ta * Ta * D + 5.43079673e-10 * Ta * Ta * Ta * Ta * Ta * D + (-0.0200518269) * va * D + 8.92859837e-4 * Ta * va * D +
    3.45433048e-6 * Ta * Ta * va * D + -3.77925774e-7 * Ta * Ta * Ta * va * D + -1.69699377e-9 * Ta * Ta * Ta * Ta * va * D +
    1.69992415e-4 * va * va * D + -4.99204314e-5 * Ta * va * va * D + 2.47417178e-7 * Ta * Ta * va * va * D +
    1.07596466e-8 * Ta * Ta * Ta * va * va * D + 8.49242932e-5 * va * va * va * D + 1.35191328e-6 * Ta * va * va * va * D +
    -6.21531254e-9 * Ta * Ta * va * va * va * D + -4.99410301e-6 * va * va * va * va * D + -1.89489258e-8 * Ta * va * va * va * va * D +
    8.15300114e-8 * va * va * va * va * va * D + 7.55043090e-4 * D * D + -5.65095215e-5 * Ta * D * D + -4.52166564e-7 * Ta * Ta * D * D +
    2.46688878e-8 * Ta * Ta * Ta * D * D + 2.42674348e-10 * Ta * Ta * Ta * Ta * D * D + 1.54547250e-4 * va * D * D + 5.24110970e-6 * Ta * va * D * D +
    -8.75874982e-8 * Ta * Ta * va * D * D + -1.50743064e-9 * Ta * Ta * Ta * va * D * D + -1.56236307e-5 * va * va * D * D +
    -1.33895614e-7 * Ta * va * va * D * D + 2.49709824e-9 * Ta * Ta * va * va * D * D + 6.51711721e-7 * va * va * va * D * D +
    1.94960053e-9 * Ta * va * va * va * D * D + -1.00361113e-8 * va * va * va * va * D * D + -1.21206673e-5 * D * D * D +
    -2.18203660e-7 * Ta * D * D * D + 7.51269482e-9 * Ta * Ta * D * D * D + 9.79063848e-11 * Ta * Ta * Ta * D * D * D + 1.25006734e-6 * va * D * D * D +
    -1.81584736e-9 * Ta * va * D * D * D + -3.52197671e-10 * Ta * Ta * va * D * D * D + -3.36514630e-8 * va * va * D * D * D +
    1.35908359e-10 * Ta * va * va * D * D * D + 4.17032620e-10 * va * va * va * D * D * D + -1.30369025e-9 * D * D * D * D +
    4.13908461e-10 * Ta * D * D * D * D + 9.22652254e-12 * Ta * Ta * D * D * D * D + -5.08220384e-9 * va * D * D * D * D +
    -2.24730961e-11 * Ta * va * D * D * D * D + 1.17139133e-10 * va * va * D * D * D * D + 6.62154879e-10 * D * D * D * D * D +
    4.03863260e-13 * Ta * D * D * D * D * D + 1.95087203e-12 * va * D * D * D * D * D + -4.73602469e-12 * D * D * D * D * D * D + 5.12733497 * Pa +
    (-0.312788561) * Ta * Pa + (-0.0196701861) * Ta * Ta * Pa + 9.99690870e-4 * Ta * Ta * Ta * Pa + 9.51738512e-6 * Ta * Ta * Ta * Ta * Pa +
    -4.66426341e-7 * Ta * Ta * Ta * Ta * Ta * Pa + 0.548050612 * va * Pa + (-0.00330552823) * Ta * va * Pa + (-0.00164119440) * Ta * Ta * va * Pa +
    -5.16670694e-6 * Ta * Ta * Ta * va * Pa + 9.52692432e-7 * Ta * Ta * Ta * Ta * va * Pa + (-0.0429223622) * va * va * Pa +
    0.00500845667 * Ta * va * va * Pa + 1.00601257e-6 * Ta * Ta * va * va * Pa + -1.81748644e-6 * Ta * Ta * Ta * va * va * Pa +
    -1.25813502e-3 * va * va * va * Pa + -1.79330391e-4 * Ta * va * va * va * Pa + 2.34994441e-6 * Ta * Ta * va * va * va * Pa +
    1.29735808e-4 * va * va * va * va * Pa + 1.29064870e-6 * Ta * va * va * va * va * Pa + -2.28558686e-6 * va * va * va * va * va * Pa +
    (-0.0369476348) * D * Pa + 0.00162325322 * Ta * D * Pa + -3.14279680e-5 * Ta * Ta * D * Pa + 2.59835559e-6 * Ta * Ta * Ta * D * Pa +
    -4.77136523e-8 * Ta * Ta * Ta * Ta * D * Pa + 8.64203390e-3 * va * D * Pa + -6.87405181e-4 * Ta * va * D * Pa +
    -9.13863872e-6 * Ta * Ta * va * D * Pa + 5.15916806e-7 * Ta * Ta * Ta * va * D * Pa + -3.59217476e-5 * va * va * D * Pa +
    3.28696511e-5 * Ta * va * va * D * Pa + -7.10542454e-7 * Ta * Ta * va * va * D * Pa + -1.24382300e-5 * va * va * va * D * Pa +
    -7.38584400e-9 * Ta * va * va * va * D * Pa + 2.20609296e-7 * va * va * va * va * D * Pa + -7.32469180e-4 * D * D * Pa +
    -1.87381964e-5 * Ta * D * D * Pa + 4.80925239e-6 * Ta * Ta * D * D * Pa + -8.75492040e-8 * Ta * Ta * Ta * D * D * Pa +
    2.77862930e-5 * va * D * D * Pa + -5.06004592e-6 * Ta * va * D * D * Pa + 1.14325367e-7 * Ta * Ta * va * D * D * Pa +
    2.53016723e-6 * va * va * D * D * Pa + -1.72857035e-8 * Ta * va * va * D * D * Pa + -3.95079398e-8 * va * va * va * D * D * Pa +
    -3.59413173e-7 * D * D * D * Pa + 7.04388046e-7 * Ta * D * D * D * Pa + -1.89309167e-8 * Ta * Ta * D * D * D * Pa +
    -4.79768731e-7 * va * D * D * D * Pa + 7.96079978e-9 * Ta * va * D * D * D * Pa + 1.62897058e-9 * va * va * D * D * D * Pa +
    3.94367674e-8 * D * D * D * D * Pa + -1.18566247e-9 * Ta * D * D * D * D * Pa + 3.34678041e-10 * va * D * D * D * D * Pa +
    -1.15606447e-10 * D * D * D * D * D * Pa + (-2.80626406) * Pa * Pa + 0.548712484 * Ta * Pa * Pa + (-0.00399428410) * Ta * Ta * Pa * Pa +
    -9.54009191e-4 * Ta * Ta * Ta * Pa * Pa + 1.93090978e-5 * Ta * Ta * Ta * Ta * Pa * Pa + (-0.308806365) * va * Pa * Pa +
    0.0116952364 * Ta * va * Pa * Pa + 4.95271903e-4 * Ta * Ta * va * Pa * Pa + -1.90710882e-5 * Ta * Ta * Ta * va * Pa * Pa +
    0.00210787756 * va * va * Pa * Pa + -6.98445738e-4 * Ta * va * va * Pa * Pa + 2.30109073e-5 * Ta * Ta * va * va * Pa * Pa +
    4.17856590e-4 * va * va * va * Pa * Pa + -1.27043871e-5 * Ta * va * va * va * Pa * Pa + -3.04620472e-6 * va * va * va * va * Pa * Pa +
    0.0514507424 * D * Pa * Pa + (-0.00432510997) * Ta * D * Pa * Pa + 8.99281156e-5 * Ta * Ta * D * Pa * Pa +
    -7.14663943e-7 * Ta * Ta * Ta * D * Pa * Pa + -2.66016305e-4 * va * D * Pa * Pa + 2.63789586e-4 * Ta * va * D * Pa * Pa +
    -7.01199003e-6 * Ta * Ta * va * D * Pa * Pa + -1.06823306e-4 * va * va * D * Pa * Pa + 3.61341136e-6 * Ta * va * va * D * Pa * Pa +
    2.29748967e-7 * va * va * va * D * Pa * Pa + 3.04788893e-4 * D * D * Pa * Pa + -6.42070836e-5 * Ta * D * D * Pa * Pa +
    1.16257971e-6 * Ta * Ta * D * D * Pa * Pa + 7.68023384e-6 * va * D * D * Pa * Pa + -5.47446896e-7 * Ta * va * D * D * Pa * Pa +
    -3.59937910e-8 * va * va * D * D * Pa * Pa + -4.36497725e-6 * D * D * D * Pa * Pa + 1.68737969e-7 * Ta * D * D * D * Pa * Pa +
    2.67489271e-8 * va * D * D * D * Pa * Pa + 3.23926897e-9 * D * D * D * D * Pa * Pa + (-0.0353874123) * Pa * Pa * Pa +
    (-0.221201190) * Ta * Pa * Pa * Pa + 0.0155126038 * Ta * Ta * Pa * Pa * Pa + -2.63917279e-4 * Ta * Ta * Ta * Pa * Pa * Pa +
    0.0453433455 * va * Pa * Pa * Pa + (-0.00432943862) * Ta * va * Pa * Pa * Pa + 1.45389826e-4 * Ta * Ta * va * Pa * Pa * Pa +
    2.17508610e-4 * va * va * Pa * Pa * Pa + -6.66724702e-5 * Ta * va * va * Pa * Pa * Pa + 3.33217140e-5 * va * va * va * Pa * Pa * Pa +
    (-0.00226921615) * D * Pa * Pa * Pa + 3.80261982e-4 * Ta * D * Pa * Pa * Pa + -5.45314314e-9 * Ta * Ta * D * Pa * Pa * Pa +
    -7.96355448e-4 * va * D * Pa * Pa * Pa + 2.53458034e-5 * Ta * va * D * Pa * Pa * Pa + -6.31223658e-6 * va * va * D * Pa * Pa * Pa +
    3.02122035e-4 * D * D * Pa * Pa * Pa + -4.77403547e-6 * Ta * D * D * Pa * Pa * Pa + 1.73825715e-6 * va * D * D * Pa * Pa * Pa +
    -4.09087898e-7 * D * D * D * Pa * Pa * Pa + 0.614155345 * Pa * Pa * Pa * Pa + (-0.0616755931) * Ta * Pa * Pa * Pa * Pa +
    0.00133374846 * Ta * Ta * Pa * Pa * Pa * Pa + 0.00355375387 * va * Pa * Pa * Pa * Pa + -5.13027851e-4 * Ta * va * Pa * Pa * Pa * Pa +
    1.02449757e-4 * va * va * Pa * Pa * Pa * Pa + (-0.00148526421) * D * Pa * Pa * Pa * Pa + -4.11469183e-5 * Ta * D * Pa * Pa * Pa * Pa +
    -6.80434415e-6 * va * D * Pa * Pa * Pa * Pa + -9.77675906e-6 * D * D * Pa * Pa * Pa * Pa + 0.0882773108 * Pa * Pa * Pa * Pa * Pa +
    (-0.00301859306) * Ta * Pa * Pa * Pa * Pa * Pa + 0.00104452989 * va * Pa * Pa * Pa * Pa * Pa + 2.47090539e-4 * D * Pa * Pa * Pa * Pa * Pa +
    0.00148348065 * Pa * Pa * Pa * Pa * Pa * Pa;
  }
  // pressione di vapore saturo (hPa), formula di Hardy usata dal codice UTCI
  function es(t){
    const c=[-2836.5744,-6028.076559,19.54263612,-0.02737830188,0.000016261698,7.0229056e-10,-1.8680009e-13], tk=t+273.15;
    let e=2.7150305*Math.log(tk); c.forEach((k,i)=>{e+=k*Math.pow(tk,i-2);}); return Math.exp(e)*0.01;
  }
  g.utci=function(Ta,Tmrt,va,rh){
    if([Ta,Tmrt,va,rh].some(x=>x==null||isNaN(x))) return null;
    const D=Tmrt-Ta, Pa=es(Ta)*rh/100/10;
    if(Ta<-50||Ta>50||D<-30||D>70||va<0.5||va>17) return null;
    return poly(Ta,va,D,Pa);
  };
})(window);
