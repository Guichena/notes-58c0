#!/usr/bin/env python3
"""Trusted loopback only. Independent HTTP oracle and real JVM process death/restart."""
import concurrent.futures, json, pathlib, select, subprocess, sys, time, urllib.request, urllib.error
ROOT=pathlib.Path(__file__).resolve().parents[1]
CP=str(ROOT/'classes')
WORK=pathlib.Path(sys.argv[1]).resolve(); WORK.mkdir(parents=True,exist_ok=True)
checks=0
processes=[]
def check(value,message):
    global checks
    checks+=1
    if not value: raise AssertionError(message)
def line(p):
    ready,_,_=select.select([p.stdout],[],[],30)
    if not ready: raise AssertionError('process startup/claim timed out')
    text=p.stdout.readline().strip()
    if not text: raise AssertionError('unexpected process exit: '+p.stderr.read())
    return text
def server():
    p=subprocess.Popen(['java','-cp',CP,'ScriptService','server',str(WORK/'jobs.json'),'0'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    processes.append(p); out=line(p); check(out.startswith('PORT '),'server port')
    return p,'http://127.0.0.1:'+out.split()[1]
def post(base,path,body,expect=200):
    data=json.dumps(body,separators=(',',':'),ensure_ascii=False).encode()
    req=urllib.request.Request(base+path,data=data,headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=5) as r: status=r.status; raw=r.read()
    except urllib.error.HTTPError as e: status=e.code; raw=e.read()
    check(status==expect,f'{path}: status {status}, want {expect}: {raw!r}')
    return json.loads(raw)
def submit(base,id,template,input,ttl=60000):
    return post(base,'/submit',dict(id=id,template=template,input=input,ttlMillis=ttl))
def worker(base,name):
    p=subprocess.run(['java','-cp',CP,'ScriptService','worker',base,name],capture_output=True,text=True,timeout=30)
    check(p.returncode==0,'worker: '+p.stderr)
    return json.loads(p.stdout) if p.stdout.strip()!='EMPTY' else {'state':'EMPTY'}
def stop(p):
    if p.poll() is None:
        p.stdin.write('\n');p.stdin.flush();p.communicate(timeout=8)
    check(p.returncode==0,'graceful server shutdown')
try:
    s,base=server()
    submit(base,'a','sum-v1',[1,2,3]); submit(base,'b','upper-v1','aß中')
    with concurrent.futures.ThreadPoolExecutor(2) as pool:
        results=list(pool.map(lambda name:worker(base,name),['worker1','worker2']))
    check({x['id'] for x in results}=={'a','b'},'distinct claims')
    check(post(base,'/get',{'id':'a'})['output']==6,'sum output')
    check(post(base,'/get',{'id':'b'})['output']=='ASS中','Unicode output')
    check(submit(base,'a','sum-v1',[1,2,3])['state']=='SUCCEEDED','submission replay')
    post(base,'/submit',dict(id='a',template='sum-v1',input=[999],ttlMillis=60000),409)
    post(base,'/submit',dict(id='unsafe',template='shell',input='echo hi',ttlMillis=60000),400)
    post(base,'/claim',{'owner':'w','now':0},400)
    submit(base,'crash','sum-v1',[10,20])
    dying=subprocess.Popen(['java','-cp',CP,'CrashWorker',base],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    processes.append(dying); first=json.loads(line(dying));check(first['id']=='crash','claim before worker death')
    dying.kill();dying.communicate(timeout=5)
    # Kill coordinator while a lease is persisted; recover the same snapshot in a new JVM.
    s.kill();s.communicate(timeout=5)
    s,base=server()
    before=post(base,'/get',{'id':'crash'});check(before['epoch']==first['epoch'],'persisted epoch')
    check(post(base,'/get',{'id':'a'})['state']=='SUCCEEDED','persisted final result')
    wait=max(0,(first['until']-int(time.time()*1000))/1000)+0.08
    time.sleep(wait)
    nextclaim=post(base,'/claim',{'owner':'replacement'})
    check(nextclaim['id']=='crash' and nextclaim['epoch']==first['epoch']+1,'expired lease takeover advances epoch')
    post(base,'/complete',dict(id='crash',owner=first['owner'],epoch=first['epoch'],output=30),409)
    result=post(base,'/complete',dict(id='crash',owner='replacement',epoch=nextclaim['epoch'],output=30))
    check(result['state']=='SUCCEEDED','accepted replacement result')
    check(post(base,'/complete',dict(id='crash',owner='replacement',epoch=nextclaim['epoch'],output=30))['state']=='SUCCEEDED','completion retry')
    post(base,'/complete',dict(id='crash',owner='replacement',epoch=nextclaim['epoch'],output=31),409)
    submit(base,'queued','upper-v1','restart')
    s.kill();s.communicate(timeout=5);s,base=server()
    check(worker(base,'fresh')['output']=='RESTART','queued task survives coordinator death')
    check(worker(base,'idle')['state']=='EMPTY','empty queue worker exits')
    # Body limit and malformed JSON fail without spawning executable commands.
    req=urllib.request.Request(base+'/submit',data=b'x'*8193,headers={'Content-Type':'application/json'})
    try: urllib.request.urlopen(req,timeout=5);raise AssertionError('oversize accepted')
    except urllib.error.HTTPError as e: check(e.code==400,'body byte limit')
    req=urllib.request.Request(base+'/get',data=b'{"id":"a","id":"b"}',headers={'Content-Type':'application/json'})
    try: urllib.request.urlopen(req,timeout=5);raise AssertionError('duplicate accepted')
    except urllib.error.HTTPError as e: check(e.code==400,'duplicate keys rejected')
    stop(s)
    check(all(p.poll() is not None for p in processes),'all JVMs stopped')
    print(f'PASS {checks} HTTP/process assertions: real independent workers, loopback protocol, kill/restart, retained idempotency, lease fencing, safe allowlist, clean shutdown')
finally:
    for p in processes:
        if p.poll() is None:
            p.kill();p.communicate(timeout=5)
