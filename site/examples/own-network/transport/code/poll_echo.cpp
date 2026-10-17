#include <arpa/inet.h>
#include <cerrno>
#include <chrono>
#include <cstdio>
#include <iostream>
#include <map>
#include <poll.h>
#include <stdexcept>
#include <string>
#include <sys/socket.h>
#include <unistd.h>
#include <vector>

struct Client { std::string input, output; bool eof = false; };
// Teaching server: loopback only, LF frames <=256 bytes including LF,
// <=32 clients and <=4096 queued output bytes per client. No TLS/auth.
int main() {
    int listener = socket(AF_INET, SOCK_STREAM | SOCK_NONBLOCK | SOCK_CLOEXEC, 0);
    if (listener < 0) { perror("socket"); return 1; }
    sockaddr_in addr{}; addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK); addr.sin_port = 0;
    if (bind(listener, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) < 0 || listen(listener,32) < 0) {
        perror("bind/listen"); close(listener); return 1;
    }
    socklen_t length = sizeof(addr);
    if (getsockname(listener,reinterpret_cast<sockaddr*>(&addr),&length) < 0) {
        perror("getsockname"); close(listener); return 1;
    }
    std::cout << ntohs(addr.sin_port) << std::endl;
    std::map<int,Client> clients;
    auto end = std::chrono::steady_clock::now() + std::chrono::seconds(15);
    int status = 0;
    while (std::chrono::steady_clock::now() < end) {
        std::vector<pollfd> ready{{listener,POLLIN,0}};
        for (const auto& [fd,c] : clients)
            ready.push_back({fd,static_cast<short>((c.eof?0:POLLIN) | (c.output.empty()?0:POLLOUT)),0});
        if (poll(ready.data(),ready.size(),100) < 0) {
            if(errno==EINTR) continue;
            perror("poll"); status=1; break;
        }
        if (ready[0].revents & POLLIN) {
            for(int attempts=0;attempts<32;attempts++) {
                int fd=accept4(listener,nullptr,nullptr,SOCK_NONBLOCK|SOCK_CLOEXEC);
                if(fd<0) { if(errno==EINTR) continue; break; }
                if(clients.size()>=32) close(fd); else clients.emplace(fd,Client{});
            }
        }
        for(std::size_t i=1;i<ready.size();i++) {
            int fd=ready[i].fd; auto it=clients.find(fd); if(it==clients.end()) continue;
            auto& c=it->second; bool bad=(ready[i].revents & (POLLERR|POLLNVAL))!=0;
            if(!bad && !c.eof && (ready[i].revents & (POLLIN|POLLHUP))) {
                for(int reads=0;reads<4;reads++) {
                    char data[64]; ssize_t n=recv(fd,data,sizeof(data),0);
                    if(n>0) {
                        c.input.append(data,static_cast<std::size_t>(n));
                        std::size_t at;
                        while((at=c.input.find('\n'))!=std::string::npos) {
                            if(at+1>256 || c.output.size()+at+1>4096) {bad=true;break;}
                            c.output.append(c.input,0,at+1);c.input.erase(0,at+1);
                        }
                        if(c.input.size()>255) bad=true;
                        if(bad) break;
                    } else if(n==0) {c.eof=true;if(!c.input.empty())bad=true;break;}
                    else if(errno==EINTR) continue;
                    else {if(errno!=EAGAIN && errno!=EWOULDBLOCK)bad=true;break;}
                }
            }
            if(!bad && !c.output.empty()) {
                ssize_t n=send(fd,c.output.data(),c.output.size(),MSG_NOSIGNAL);
                if(n>0)c.output.erase(0,static_cast<std::size_t>(n));
                else if(n<0 && errno!=EAGAIN && errno!=EWOULDBLOCK && errno!=EINTR)bad=true;
            }
            if(bad || (c.eof && c.output.empty())) {close(fd);clients.erase(it);}
        }
    }
    for(auto& [fd,c]:clients)close(fd);
    close(listener);return status;
}

