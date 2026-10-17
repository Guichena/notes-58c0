#include <iostream>
#include <stdexcept>

class Point {
public:
    Point() : Point(0, 0) {}
    explicit Point(int x) : Point(x, 0) {}
    Point(int x, int y) : x_(x), y_(y) {}
    int x() const { return x_; }
    int y() const { return y_; }
private:
    int x_;
    int y_;
};

int main() {
    Point a;
    Point b(3);
    Point c(3, 4);
    Point d = c;
    if (a.x() != 0 || a.y() != 0 || b.x() != 3 || b.y() != 0 ||
        c.x() != 3 || c.y() != 4 || d.x() != 3 || d.y() != 4) {
        throw std::logic_error("constructor contract");
    }
    std::cout << a.x() << ',' << a.y() << '\n';
    std::cout << b.x() << ',' << b.y() << '\n';
    std::cout << c.x() << ',' << c.y() << '\n';
    std::cout << d.x() << ',' << d.y() << '\n';
}
