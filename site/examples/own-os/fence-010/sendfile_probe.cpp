#include <cassert>
#include <cerrno>
#include <cstdio>
#include <cstdint>
#include <cstdlib>
#include <vector>
#include <iostream>
#include <sys/sendfile.h>
#include <unistd.h>
// Linux regular-file fixture only: verifies byte/offset/EOF semantics, not NIC copies.
int main() {
    for(std::size_t size : {0U,1U,4095U,4096U,65539U}) {
        char from[]="/tmp/os008-from-XXXXXX",to[]="/tmp/os008-to-XXXXXX";
        int in=mkstemp(from),out=mkstemp(to);assert(in>=0 && out>=0);
        assert(unlink(from)==0 && unlink(to)==0);
        std::vector<unsigned char> expected(size),actual(size);
        for(std::size_t i=0;i<size;++i) expected[i]=static_cast<unsigned char>((i*31U+7U)%256U);
        std::size_t written=0;
        while(written<size) {
            ssize_t n=write(in,expected.data()+written,size-written);
            if(n<0 && errno==EINTR) continue;
            assert(n>0);written+=static_cast<std::size_t>(n);
        }
        assert(lseek(in,0,SEEK_SET)==0);off_t offset=0;
        while(static_cast<std::size_t>(offset)<size) {
            ssize_t n=sendfile(out,in,&offset,997);
            if(n<0 && errno==EINTR) continue;
            assert(n>0); // EAGAIN needs readiness wait for nonblocking destinations, not used here.
        }
        assert(static_cast<std::size_t>(offset)==size);
        assert(sendfile(out,in,&offset,997)==0); // EOF.
        assert(lseek(in,0,SEEK_CUR)==0); // Explicit offset leaves input FD position unchanged.
        std::size_t got=0;
        while(got<size) {
            ssize_t n=pread(out,actual.data()+got,size-got,static_cast<off_t>(got));
            if(n<0 && errno==EINTR) continue;
            assert(n>0);got+=static_cast<std::size_t>(n);
        }
        assert(actual==expected); assert(close(in)==0 && close(out)==0);
    }
    std::cout<<"PASS sendfile 5 sizes, explicit offset, EOF and exact bytes; no performance/zero-DMA claim\n";
}

