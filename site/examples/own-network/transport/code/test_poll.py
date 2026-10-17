"""Loopback-only compatibility checks for the accompanying bounded C++ server."""
import concurrent.futures, socket, subprocess
checks=0
p=subprocess.Popen(['./build/poll_echo'],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def check(v):
    global checks
    assert v
    checks+=1
def connect():
    return socket.create_connection(('127.0.0.1',port),timeout=2)
def exact(s,n):
    out=b''
    while len(out)<n:
        b=s.recv(n-len(out))
        if not b: break
        out+=b
    return out
try:
    port=int(p.stdout.readline().strip())
    with connect() as a, connect() as b:
        a.sendall(b'one'); b.sendall(b'two\n')
        check(exact(b,4)==b'two\n');a.sendall(b'\n');check(exact(a,4)==b'one\n')
        a.sendall(b'x\ny\nz\n');check(exact(a,6)==b'x\ny\nz\n')
        a.sendall(b'a'*255+b'\n');check(exact(a,256)==b'a'*255+b'\n')
        a.sendall(b'end\n');a.shutdown(socket.SHUT_WR);check(exact(a,4)==b'end\n');check(a.recv(1)==b'')
    for bad in [b'x'*256,b'incomplete']:
        with connect() as s:
            s.sendall(bad);s.shutdown(socket.SHUT_WR)
            try: data=s.recv(1)
            except ConnectionResetError: data=b''
            check(data==b'')
    def client(i):
        data=('client-'+str(i)+'\n').encode()
        with connect() as s:
            for b in data:s.sendall(bytes([b]))
            return exact(s,len(data))==data
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for ok in pool.map(client,range(8)):check(ok)
    check(p.poll() is None)
    print(f'PollEcho PASS {checks} loopback assertions; not a throughput or fault-injection benchmark')
finally:
    if p.poll() is None:p.terminate()
    try:p.wait(timeout=2)
    except subprocess.TimeoutExpired:p.kill();p.wait(timeout=2)
    error=p.stderr.read()
    if error:print(error)
