import numpy as np

def measure(a,stages):
    t=a[:,0];rows=[];prev=None
    for s in range(1,stages+1):
        y=a[:,4+s];m=(t>=150e-6)&(t<=220e-6);tt=t[m];yy=y[m];low=yy<-.5
        crosses=[]
        for i in np.flatnonzero(low[1:]!=low[:-1]):
            cross=tt[i]+(-.5-yy[i])*(tt[i+1]-tt[i])/(yy[i+1]-yy[i]);crosses.append((float(cross),bool(low[i+1])))
        pulses=[];begin=None
        for ct,down in crosses:
            if down:begin=ct
            elif begin is not None:pulses.append((begin,ct));begin=None
        active_min=float(yy.min());keep=np.ones(len(tt),bool)
        for b,e in pulses:keep &= ~((tt>b-4e-6)&(tt<e+4e-6))
        rest_min=float(yy[keep].min()) if keep.any() else None
        order=bool(len(pulses)==1 and (prev is None or pulses[0][0]>prev))
        ok=bool(len(pulses)==1 and active_min<=-6 and rest_min is not None and rest_min>=7 and order)
        if pulses:prev=pulses[0][0]
        rows.append({'stage':s,'pulses':len(pulses),'start_us':pulses[0][0]*1e6 if pulses else None,
                     'width_us':(pulses[0][1]-pulses[0][0])*1e6 if pulses else None,
                     'low_min_v':active_min,'rest_min_v':rest_min,'ordered':order,'pass':ok})
    return {'pass':all(x['pass'] for x in rows),'stages':rows,
            'criterion':'One complete midpoint-crossing low pulse during 150–220 us, low <= -6 V, rest >= +7 V, ordered starts. Width reported, not constrained without specified target.'}
