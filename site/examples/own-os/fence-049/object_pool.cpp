#include <array>
#include <atomic>
#include <cassert>
#include <cstddef>
#include <cstdint>
#include <iostream>
#include <limits>
#include <mutex>
#include <new>
#include <stdexcept>
#include <thread>
#include <type_traits>
#include <utility>
#include <vector>
// Fixed-type fixed-capacity pool. Thread-confined unless wrapped with a mutex.
// Pool must outlive handles. No reentrant constructors/destructors using this pool.
template<class T,std::size_t N> class LocalPool {
    static_assert(N>0 && std::is_nothrow_destructible_v<T>);
    struct Slot {
        alignas(T) std::byte bytes[sizeof(T)];
        std::size_t next=0;
        std::uint64_t generation=0;
        bool live=false;
    };
    std::array<Slot,N> slots_{};
    std::size_t head_=0,live_=0;
    T* address(std::size_t i){return std::launder(reinterpret_cast<T*>(slots_[i].bytes));}
public:
    struct Handle {std::size_t index;std::uint64_t generation;T* ptr;};
    LocalPool(){for(std::size_t i=0;i<N;++i)slots_[i].next=i+1;}
    LocalPool(const LocalPool&)=delete;
    LocalPool& operator=(const LocalPool&)=delete;
    ~LocalPool(){for(std::size_t i=0;i<N;++i)if(slots_[i].live)address(i)->~T();}
    template<class... Args> Handle create(Args&&... args){
        if(head_==N)throw std::bad_alloc();
        Slot& s=slots_[head_];
        if(s.generation==std::numeric_limits<std::uint64_t>::max())throw std::overflow_error("generation");
        // Commit freelist state only after construction succeeds.
        T* p=::new(static_cast<void*>(s.bytes))T(std::forward<Args>(args)...);
        std::size_t i=head_;head_=s.next;s.live=true;++s.generation;++live_;
        return {i,s.generation,p};
    }
    void destroy(Handle h){
        if(h.index>=N)throw std::invalid_argument("index");
        Slot& s=slots_[h.index];
        if(!s.live || s.generation!=h.generation || h.ptr!=address(h.index))
            throw std::invalid_argument("stale/foreign handle");
        h.ptr->~T();s.live=false;s.next=head_;head_=h.index;--live_;
    }
    std::size_t live() const{return live_;}
};
template<class T,std::size_t N> class LockedPool {
    LocalPool<T,N> pool_;
    std::mutex mutex_;
public:
    using Handle=typename LocalPool<T,N>::Handle;
    template<class... Args> Handle create(Args&&... args){
        std::lock_guard<std::mutex> lock(mutex_);
        return pool_.create(std::forward<Args>(args)...);
    }
    void destroy(Handle h){std::lock_guard<std::mutex> lock(mutex_);pool_.destroy(h);}
    std::size_t live(){std::lock_guard<std::mutex> lock(mutex_);return pool_.live();}
};
struct alignas(64) Item {
    inline static std::atomic<int> made{0},gone{0};
    int n;
    explicit Item(int x):n(x){if(x<0)throw std::invalid_argument("negative");++made;}
    ~Item() noexcept {++gone;}
};
int main(){
    {LocalPool<Item,2> p,q;
     auto a=p.create(1),b=p.create(2);
     assert(reinterpret_cast<std::uintptr_t>(a.ptr)%alignof(Item)==0);
     assert(a.ptr->n==1 && b.ptr->n==2 && p.live()==2);
     bool full=false;try{(void)p.create(3);}catch(const std::bad_alloc&){full=true;}assert(full);
     p.destroy(a);auto old=a;auto fresh=p.create(4);assert(fresh.ptr==old.ptr);
     bool stale=false;try{p.destroy(old);}catch(const std::invalid_argument&){stale=true;}assert(stale);
     bool foreign=false;try{q.destroy(fresh);}catch(const std::invalid_argument&){foreign=true;}assert(foreign);
     p.destroy(fresh);bool twice=false;try{p.destroy(fresh);}catch(const std::invalid_argument&){twice=true;}assert(twice);
     bool ctor=false;try{(void)p.create(-1);}catch(const std::invalid_argument&){ctor=true;}assert(ctor && p.live()==1);
     auto good=p.create(5);p.destroy(good);p.destroy(b);assert(p.live()==0);
    }
    {LocalPool<Item,2> p;(void)p.create(7);} // Pool destruction ends remaining lifetimes.
    LockedPool<Item,16> pool;std::vector<std::thread> threads;
    for(int k=0;k<4;++k)threads.emplace_back([&,k]{
        for(int i=0;i<2000;++i){auto h=pool.create(k*2000+i);assert(h.ptr->n==k*2000+i);pool.destroy(h);}
    });
    for(auto& t:threads){t.join();}
    assert(pool.live()==0);
    threads.clear();std::atomic<int> local_done{0};
    for(int k=0;k<4;++k)threads.emplace_back([&]{
        thread_local LocalPool<std::uint32_t,8> local;
        for(std::uint32_t i=0;i<10000;++i){auto h=local.create(i);assert(*h.ptr==i);local.destroy(h);}
        assert(local.live()==0);local_done.fetch_add(10000,std::memory_order_relaxed);
    });
    for(auto& t:threads)t.join();
    assert(local_done==40000 && Item::made==Item::gone);
    std::cout<<"PASS pool alignment/full/exception/stale/foreign/destruction; shared8000 local40000; lifetimes="<<Item::made<<'\n';
}

