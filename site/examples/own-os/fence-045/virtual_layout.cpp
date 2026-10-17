#include <cassert>
#include <iostream>
#include <memory>
#include <typeinfo>
#include <vector>
static std::vector<int> order;
struct Left {
    int left=1;
    virtual int value() const {return 1;}
    int plain() const {return 10;}
    virtual ~Left(){order.push_back(1);}
};
struct Right {
    int right=2;
    virtual int value() const {return 2;}
    virtual ~Right(){order.push_back(2);}
};
struct Derived final : Left, Right {
    int own=3;
    int value() const override {return 42;}
    int plain() const {return 30;}
    ~Derived() override {order.push_back(3);}
};
struct Other : Left {};
int main(){
    order.reserve(20); // Avoid allocation in these teaching destructors.
    Derived d;Left* l=&d;Right* r=&d;
    assert(l->value()==42 && r->value()==42);
    assert(l->plain()==10 && d.plain()==30);
    assert(dynamic_cast<Derived*>(l)==&d);
    assert(dynamic_cast<Derived*>(r)==&d);
    assert(dynamic_cast<Right*>(l)==r);
    assert(dynamic_cast<void*>(r)==static_cast<void*>(&d));
    assert(dynamic_cast<Other*>(l)==nullptr);
    bool failed=false;try{(void)dynamic_cast<Other&>(*l);}catch(const std::bad_cast&){failed=true;}
    assert(failed);
    // These addresses illustrate this build only; no vtable aliasing or byte poking.
    std::cout<<"observed Left same start="<<(static_cast<void*>(l)==static_cast<void*>(&d))
             <<" Right same start="<<(static_cast<void*>(r)==static_cast<void*>(&d))<<'\n';
    order.clear();
    {std::unique_ptr<Left> p=std::make_unique<Derived>();assert(p->value()==42);}
    assert((order==std::vector<int>{3,2,1}));
    std::cout<<"PASS dynamic dispatch, static nonvirtual call, down/cross/void cast, failures, virtual destruction\n";
}

