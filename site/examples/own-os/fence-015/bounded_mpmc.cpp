#include <algorithm>
#include <atomic>
#include <cassert>
#include <condition_variable>
#include <cstddef>
#include <iostream>
#include <mutex>
#include <optional>
#include <stdexcept>
#include <thread>
#include <vector>
class IntQueue {
    std::mutex mu;
    std::condition_variable not_empty, not_full;
    std::vector<int> data;
    std::size_t head=0, tail=0, count=0;
    bool closed=false;
    static std::size_t checked(std::size_t n) {
        if(n==0 || n>4096) throw std::invalid_argument("capacity 1..4096");
        return n;
    }
public:
    explicit IntQueue(std::size_t capacity):data(checked(capacity)){}
    bool push(int v) {
        std::unique_lock<std::mutex> lk(mu);
        not_full.wait(lk,[&]{return closed || count<data.size();});
        if(closed) return false;
        data[tail]=v; tail=(tail+1)%data.size(); ++count;
        lk.unlock(); not_empty.notify_one(); return true;
    }
    std::optional<int> pop() {
        std::unique_lock<std::mutex> lk(mu);
        not_empty.wait(lk,[&]{return closed || count>0;});
        if(count==0) return std::nullopt;
        int v=data[head]; head=(head+1)%data.size(); --count;
        lk.unlock(); not_full.notify_one(); return v;
    }
    void close() {
        {std::lock_guard<std::mutex> lk(mu); closed=true;}
        not_empty.notify_all(); not_full.notify_all();
    }
};
int main() {
    for(std::size_t cap: {0u,4097u}) {
        bool threw=false; try {IntQueue q(cap);}catch(const std::invalid_argument&){threw=true;}
        assert(threw);
    }
    IntQueue fifo(3); assert(fifo.push(7)&&fifo.push(8)); fifo.close(); fifo.close();
    assert(fifo.pop()==7 && fifo.pop()==8 && !fifo.pop() && !fifo.push(9));
    // Close races are tested even if close wins just before the actual wait.
    for(int n=0;n<100;++n) {
        IntQueue full(1); assert(full.push(1)); std::atomic<bool> attempted{false}; bool result=true;
        std::thread p([&]{attempted=true;result=full.push(2);});
        while(!attempted.load()) {std::this_thread::yield();}
        full.close(); p.join(); assert(!result);
        assert(full.pop()==1 && !full.pop());
        IntQueue empty(1); attempted=false; std::optional<int> v=42;
        std::thread c([&]{attempted=true;v=empty.pop();});
        while(!attempted.load()) {std::this_thread::yield();}
        empty.close();c.join();assert(!v);
    }
    int trials=0, total=0;
    for(int np: {1,4}) for(std::size_t cap: {1u,2u,17u}) for(int round=0;round<20;++round) {
        const int each=200, n=np*each, nc=np==1?1:3;
        IntQueue q(cap); std::vector<int> seen(static_cast<std::size_t>(n));
        std::mutex seen_mu; std::vector<std::thread> ps,cs;
        for(int c=0;c<nc;++c)cs.emplace_back([&]{
            while(auto v=q.pop()) {
                assert(*v>=0 && *v<n);std::lock_guard<std::mutex> lk(seen_mu);
                ++seen[static_cast<std::size_t>(*v)];
            }
        });
        for(int p=0;p<np;++p)ps.emplace_back([&,p]{
            for(int i=0;i<each;++i)assert(q.push(p*each+i));
        });
        for(auto& t:ps) {t.join();}
        q.close(); for(auto& t:cs) {t.join();}
        for(int count:seen)assert(count==1);
        assert(!q.pop() && !q.push(99));++trials;total+=n;
    }
    std::cout<<"PASS C++ queue: "<<trials<<" SPSC/MPMC trials, "<<total<<" unique items, 200 close races\n";
}

