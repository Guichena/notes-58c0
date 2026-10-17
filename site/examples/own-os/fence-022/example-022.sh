nc -vz -w 2 127.0.0.1 8080
printf 'GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n' |
  nc -w 2 127.0.0.1 8080
