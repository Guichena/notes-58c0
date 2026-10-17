#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p build
java -version
java -m jdk.compiler/com.sun.tools.javac.Main -encoding UTF-8 -d build *.java
for main in BoundedFrameDecoderTest FrameDecoderDemo JsonByteSize NioComponents BufferStorage InternetChecksum ByteOrderDemo AdaptiveLimit; do
  java -cp build "$main"
done
g++ -std=c++17 -Wall -Wextra -Werror byte_order.cpp -o build/byte_order
./build/byte_order
gcc -std=c11 -Wall -Wextra -Werror epoll_modes.c -o build/epoll_modes
./build/epoll_modes
g++ -std=c++17 -Wall -Wextra -Werror poll_echo.cpp -o build/poll_echo
python3 test_poll.py
java -cp build ByteOrderDemo vectors > build/java-vectors.txt
./build/byte_order vectors > build/cpp-vectors.txt
python3 - <<'PY'
from pathlib import Path
x=17; expected=[]
for _ in range(1000):
    x=(x*1664525+1013904223)&0xffffffff
    expected.append(x.to_bytes(4,'big').hex())
assert Path('build/java-vectors.txt').read_text().splitlines()==expected
assert Path('build/cpp-vectors.txt').read_text().splitlines()==expected
print('CrossLanguageByteOrder PASS 1000 fixed vectors in Java C++ and Python')
PY
