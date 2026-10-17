#include <cassert>
#include <cerrno>
#include <cstring>
#include <cstdlib>
#include <iostream>
#include <fcntl.h>
#include <sys/mman.h>
#include <sys/stat.h>
#include <unistd.h>
// Linux/POSIX bounded fixture; assertions are teaching-test failure handling.
int main(){
    for(int round=0;round<20;++round){
        char path[]="/tmp/os006-map-XXXXXX";int fd=mkstemp(path);assert(fd>=0);
        assert(write(fd,"abc",3)==3);
        int append=open(path,O_WRONLY|O_APPEND|O_CLOEXEC);assert(append>=0);
        assert(lseek(append,0,SEEK_SET)==0);assert(write(append,"de",2)==2);assert(close(append)==0);
        char bytes[5];assert(pread(fd,bytes,5,0)==5 && std::memcmp(bytes,"abcde",5)==0);
        assert(fsync(fd)==0); // Local API success, not a tested power-loss guarantee.
        void* p=mmap(nullptr,5,PROT_READ|PROT_WRITE,MAP_SHARED,fd,0);assert(p!=MAP_FAILED);
        static_cast<char*>(p)[0]='A';assert(msync(p,5,MS_SYNC)==0);
        assert(pread(fd,bytes,5,0)==5 && std::memcmp(bytes,"Abcde",5)==0);
        void* copy=mmap(nullptr,5,PROT_READ|PROT_WRITE,MAP_PRIVATE,fd,0);assert(copy!=MAP_FAILED);
        static_cast<char*>(copy)[1]='X';assert(pread(fd,bytes,5,0)==5 && bytes[1]=='b');
        errno=0;assert(mmap(nullptr,0,PROT_READ,MAP_PRIVATE,fd,0)==MAP_FAILED && errno==EINVAL);
        assert(close(fd)==0);assert(static_cast<char*>(p)[0]=='A');
        assert(munmap(copy,5)==0);assert(munmap(p,5)==0);assert(unlink(path)==0);
    }
    std::cout<<"PASS 20 own-tempfile append/shared/private/close-fd/zero-length mapping rounds; no crash durability or performance test\n";
}

