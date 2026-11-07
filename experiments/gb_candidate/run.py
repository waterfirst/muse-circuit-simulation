"""Execute one fixed research deck with a locally built, trusted OSDI model."""
import argparse,json,shutil,subprocess
from pathlib import Path
import numpy as np
from metrics import measure

def main():
 p=argparse.ArgumentParser();p.add_argument('case');p.add_argument('--osdi',required=True,type=Path);p.add_argument('--ngspice',default='ngspice');p.add_argument('--output',type=Path,default=Path('results'));p.add_argument('--prepare-only',action='store_true');a=p.parse_args()
 root=Path(__file__).resolve().parent;cases=json.loads((root/'manifest.json').read_text())
 if a.case not in cases:p.error('Unknown case; see manifest.json')
 source=root/'cases'/a.case/'deck.cir';target=(a.output/a.case).resolve();target.mkdir(parents=True,exist_ok=False)
 shutil.copy2(source,target/'deck.cir');shutil.copy2(a.osdi.resolve(),target/'ptft_fit.osdi')
 if a.prepare_only:print(target);return
 r=subprocess.run([a.ngspice,'-b','deck.cir'],cwd=target,capture_output=True,text=True,timeout=300);(target/'ngspice.log').write_text(r.stdout+r.stderr)
 # ngspice batch exit status varies for control-block-only wrdata decks.
 f=target/'out.txt'
 if not f.exists():raise RuntimeError('No output; inspect ngspice.log')
 data=np.loadtxt(f,skiprows=1)
 if not np.isfinite(data).all() or data[-1,0]<399.9e-6:raise RuntimeError('Incomplete/nonfinite output')
 frames=[]
 for offset in [0,120e-6]:
  b=data.copy();b[:,0]-=offset;frame=measure(b,6)
  for i,s in enumerate(frame['stages']):
   t=b[:,0]*1e6;keep=(t>=150)&(t<=220)&~((t>160+4*i)&(t<171+4*i));s['expected_hold_min_v']=float(b[keep,5+i].min());s['expected_hold_margin_v']=s['expected_hold_min_v']-7
  starts=[s['start_us'] for s in frame['stages']];widths=[s['width_us'] for s in frame['stages']]
  frame['timing_pass']=all(x is not None for x in starts) and all(abs(starts[i+1]-starts[i]-4)<.2 for i in range(5)) and all(x is not None and abs(x-3)<.2 for x in widths);frame['strict_pass']=frame['pass'] and frame['timing_pass'];frames.append(frame)
 (target/'summary.json').write_text(json.dumps({'case':a.case,'frames':frames},indent=2));print(target)
if __name__=='__main__':main()
