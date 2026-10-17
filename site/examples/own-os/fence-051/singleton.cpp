#include <atomic>
#include <cassert>
#include <iostream>
#include <mutex>
#include <stdexcept>
#include <thread>
#include <vector>
class Singleton {
    std::mutex mutex_;
    int count_=0;
    Singleton(){++constructions;}
public:
    inline static std::atomic<int> constructions{0};
    static Singleton& get(){static Singleton value;return value;}
    Singleton(const Singleton&)=delete;
    Singleton& operator=(const Singleton&)=delete;
    void increment(){std::lock_guard<std::mutex> g(mutex_);++count_;}
    int count(){std::lock_guard<std::mutex> g(mutex_);return count_;}
};
class Retry {
    Retry(){if(attempts.fetch_add(1)==0)throw std::runtime_error("first attempt");}
public:
    inline static std::atomic<int> attempts{0};
    static Retry& get(){static Retry r;return r;}
    Retry(const Retry&)=delete;
    Retry& operator=(const Retry&)=delete;
};
int main(){
    std::atomic<bool> start{false};std::vector<std::thread> threads;
    std::vector<Singleton*> addresses(8,nullptr);
    for(int i=0;i<8;++i)threads.emplace_back([&,i]{
        while(!start.load(std::memory_order_acquire))std::this_thread::yield();
        addresses[static_cast<std::size_t>(i)]=&Singleton::get();
        for(int k=0;k<1000;++k)Singleton::get().increment();
    });
    start.store(true,std::memory_order_release);
    for(auto& t:threads)t.join();
    for(auto* p:addresses)assert(p==addresses[0]);
    assert(Singleton::constructions==1 && Singleton::get().count()==8000);
    bool failed=false;try{(void)Retry::get();}catch(const std::runtime_error&){failed=true;}
    assert(failed);auto* r=&Retry::get();assert(r==&Retry::get() && Retry::attempts==2);
    std::cout<<"PASS singleton 8 threads, 8000 protected updates; one construction; failed static initialization retried\n";
}

