"""Loopback-only TLS tests. Trust is scoped to the child client argument.
Creates short-lived fixture keys in a temporary directory, never changes OS trust.
Requires an existing OpenSSL executable and compiled https_client binary.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import ssl
import subprocess
import sys
import tempfile
import threading

binary = Path(sys.argv[1]).resolve()
class Handler(BaseHTTPRequestHandler):
    def handle(self):
        try:
            super().handle()
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
            pass  # Expected when a test client rejects this TLS peer or closes early.
    def log_message(self, *_):
        pass
    def do_GET(self):
        status = 500 if self.path == '/error' else (302 if self.path == '/redirect' else 200)
        body = b'x' * 20000 if self.path == '/large' else b'fixture-ok'
        self.send_response(status)
        if status == 302:
            self.send_header('Location', '/ok')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError, ssl.SSLError):
            pass

with tempfile.TemporaryDirectory(prefix='network-tls-', dir=Path(__file__).resolve().parent.parent / 'private' / 'build') as directory:
    cert, key = Path(directory)/'cert.pem', Path(directory)/'key.pem'
    subprocess.run(['openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1',
                    '-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost',
                    '-keyout',str(key),'-out',str(cert)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    server = ThreadingHTTPServer(('127.0.0.1',0),Handler)
    server.daemon_threads = True
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert,key)
    server.socket = context.wrap_socket(server.socket,server_side=True)
    thread = threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    port = server.server_address[1]
    cases = [
        ('trusted correct host',f'https://localhost:{port}/ok',True,0),
        ('untrusted certificate',f'https://localhost:{port}/ok',False,1),
        ('wrong hostname',f'https://127.0.0.1:{port}/ok',True,1),
        ('body limit',f'https://localhost:{port}/large',True,1),
        ('no redirect follow',f'https://localhost:{port}/redirect',True,1),
        ('HTTP error classification',f'https://localhost:{port}/error',True,1),
        ('reject plain HTTP',f'http://127.0.0.1:{port}/ok',True,1),
    ]
    try:
        for name,url,use_ca,expected in cases:
            args=[str(binary),url]+([str(cert)] if use_ca else [])
            result=subprocess.run(args,capture_output=True,text=True,timeout=6)
            assert result.returncode == expected,(name,result.returncode,result.stderr)
            if name == 'trusted correct host': assert 'HTTP 200\nfixture-ok' in result.stdout
            if name == 'no redirect follow': assert 'HTTP 302' in result.stdout
            if name == 'HTTP error classification': assert 'HTTP 500' in result.stdout
        print(f'C++ TLS: {len(cases)} checks passed; loopback fixture only')
    finally:
        server.shutdown();server.server_close();thread.join(timeout=3)
