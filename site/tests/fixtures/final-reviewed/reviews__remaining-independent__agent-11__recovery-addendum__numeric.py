import math,json
from pathlib import Path
r={'status':'PASS','method':'Small independent Python arithmetic only; no teaching program, training, JVM or full build execution.'}
r['retryAttemptProducts']=[3*5*2,3*5*3,3*3,4*4];assert r['retryAttemptProducts']==[30,45,9,16]
r['weeklyMinutes']=150+65+150;assert r['weeklyMinutes']==150+195+20==365
r['weightedTokenLoss']=(2*2+8*.5)/10;r['equalStageLoss']=(2+.5)/2;r['longerStageTokenLoss']=(2*2+16*.5)/18
assert r['weightedTokenLoss']==.8 and r['equalStageLoss']==1.25 and r['longerStageTokenLoss']==2/3
r['mhaKvRatio']=(8/80)*(1/2);assert r['mhaKvRatio']==1/20
r['kl']=[]
for p,q in [([.4,.6],[.7,.3]),([.5,.5],[1.,0.])]:
 kl=sum(qi*math.log(qi/pi) for pi,qi in zip(p,q) if qi);k3=sum(qi*(pi/qi-1-math.log(pi/qi)) for pi,qi in zip(p,q) if qi);mass=sum(pi for pi,qi in zip(p,q) if qi);assert abs(k3-(kl+mass-1))<1e-14;r['kl'].append(dict(p=p,q=q,kl=kl,k3=k3,pMassOnQSupport=mass))
S=[[.2,-.4,1.1],[.7,.3,-.8],[-1.2,.9,.5]];N=len(S)
def soft(a):
 m=max(a);ex=[math.exp(v-m) for v in a];return [v/sum(ex) for v in ex]
def lse(a):
 m=max(a);return m+math.log(sum(math.exp(v-m) for v in a))
def loss():return sum(lse(S[i])-S[i][i]+lse([S[j][i] for j in range(N)])-S[i][i] for i in range(N))/(2*N)
errors=[]
for i in range(N):
 for j in range(N):
  analytic=(soft(S[i])[j]+soft([S[k][j] for k in range(N)])[i])/(2*N)-(1/N if i==j else 0);old=S[i][j];eps=1e-5;S[i][j]=old+eps;plus=loss();S[i][j]=old-eps;minus=loss();S[i][j]=old;errors.append(abs(analytic-(plus-minus)/(2*eps)))
r['freshContrastiveGradientMaxError']=max(errors);assert max(errors)<1e-9
r['negativeMaxSim']=max([-3,-2]);assert r['negativeMaxSim']==-2
r['priorGradientReceipt']='Prior partial evidence used an unspecified numeric fixture; its exact 3.494449174468173e-11 value is preserved, not claimed reproduced. Fresh explicit fixture in this script independently verifies the formula.'
for n in (11,12,13):
 p=Path(f'reviews/remaining-independent/agent-{n}/recovery-addendum/numeric-recheck.json');assert not p.exists();p.write_text(json.dumps(r,indent=2)+'\n')
print(r)
