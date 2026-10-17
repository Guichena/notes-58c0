#include <pthread.h>
#include <cassert>
#include <cstdint>
#include <iostream>
#include <vector>
constexpr std::size_t count = 1'000'000;
struct Result { std::size_t stack_bytes=0; std::uint64_t sum=0; };
void* worker(void* arg) {
    auto* result=static_cast<Result*>(arg);
    pthread_attr_t actual;
    assert(pthread_getattr_np(pthread_self(), &actual)==0);
    void* base=nullptr;
    assert(pthread_attr_getstack(&actual,&base,&result->stack_bytes)==0);
    assert(pthread_attr_destroy(&actual)==0);
    volatile std::uint32_t local[count];
    std::uint64_t total=0;
    for(std::size_t i=0;i<count;++i){ local[i]=static_cast<std::uint32_t>(i);total+=local[i]; }
    result->sum=total; return nullptr;
}
int main(){
    pthread_attr_t attr;assert(pthread_attr_init(&attr)==0);
    const std::size_t budget=16U*1024U*1024U;
    assert(pthread_attr_setstacksize(&attr,budget)==0);
    Result result;pthread_t t;
    assert(pthread_create(&t,&attr,worker,&result)==0);
    assert(pthread_attr_destroy(&attr)==0);assert(pthread_join(t,nullptr)==0);
    assert(result.stack_bytes>=budget);assert(result.sum==499999500000ULL);
    std::vector<std::uint32_t> dynamic(count); std::uint64_t sum=0;
    for(std::size_t i=0;i<count;++i){ dynamic[i]=static_cast<std::uint32_t>(i);sum+=dynamic[i]; }
    assert(sum==result.sum);
    std::cout<<"PASS array_bytes="<<sizeof(std::uint32_t)*count<<" thread_stack_bytes="<<result.stack_bytes<<" sum="<<sum<<'\n';
}

