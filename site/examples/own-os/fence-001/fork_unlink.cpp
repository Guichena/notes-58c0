#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <fcntl.h>
#include <unistd.h>
#include <cassert>
#include <cerrno>
#include <cstdlib>
#include <iostream>
#include <string>
// Only self-created temporary files and child processes are used.
void byte(int fd,char value){ ssize_t n;do{n=write(fd,&value,1);}while(n<0 && errno==EINTR);assert(n==1); }
char take(int fd){ char c=0;ssize_t n;do{n=read(fd,&c,1);}while(n<0 && errno==EINTR);assert(n==1);return c; }
int main(){
 for(int trial=0;trial<100;++trial){
    char dir[]="/tmp/os003-fd-XXXXXX";assert(mkdtemp(dir)!=nullptr);
    const std::string path=std::string(dir)+"/file";
    int fd=open(path.c_str(),O_CREAT|O_EXCL|O_RDWR,0600);assert(fd>=0);
    assert(write(fd,"AB",2)==2);assert(lseek(fd,0,SEEK_SET)==0);
    int child_to_parent[2],parent_to_child[2];
    assert(pipe(child_to_parent)==0);assert(pipe(parent_to_child)==0);
    pid_t child=fork();assert(child>=0);
    if(child==0){
      close(child_to_parent[0]);close(parent_to_child[1]);
      assert(take(fd)=='A');byte(child_to_parent[1],'r');
      assert(take(parent_to_child[0])=='u');
      assert(pwrite(fd,"C",1,1)==1);byte(child_to_parent[1],'w');
      close(fd);close(child_to_parent[1]);close(parent_to_child[0]);_exit(0);
    }
    close(child_to_parent[1]);close(parent_to_child[0]);
    assert(take(child_to_parent[0])=='r');
    assert(lseek(fd,0,SEEK_CUR)==1);
    assert(unlink(path.c_str())==0);
    errno=0;assert(open(path.c_str(),O_RDONLY)==-1 && errno==ENOENT);
    int fresh=open(path.c_str(),O_CREAT|O_EXCL|O_RDWR,0600);assert(fresh>=0);
    assert(write(fresh,"NEW",3)==3);
    byte(parent_to_child[1],'u');assert(take(child_to_parent[0])=='w');
    char old[2]={};assert(pread(fd,old,2,0)==2 && old[0]=='A' && old[1]=='C');
    char now[3]={};assert(pread(fresh,now,3,0)==3 && std::string(now,3)=="NEW");
    struct stat st{};assert(fstat(fd,&st)==0 && st.st_nlink==0);
    int status=0;assert(waitpid(child,&status,0)==child && WIFEXITED(status) && WEXITSTATUS(status)==0);
    close(fd);close(fresh);close(child_to_parent[0]);close(parent_to_child[1]);
    assert(unlink(path.c_str())==0);assert(rmdir(dir)==0);
 }
 std::cout<<"PASS 100 real forks: shared offset, open-unlink-write, recreated path isolation, child reaping\n";
}

