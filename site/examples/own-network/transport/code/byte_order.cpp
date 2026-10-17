#include <arpa/inet.h>
#include <array>
#include <climits>
#include <cstdint>
#include <cstring>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

using Bytes = std::array<std::uint8_t, 4>;
static_assert(CHAR_BIT == 8 && sizeof(std::uint32_t) == 4, "octet and uint32 required");
Bytes big(std::uint32_t x) {
    return {static_cast<std::uint8_t>(x >> 24), static_cast<std::uint8_t>(x >> 16),
            static_cast<std::uint8_t>(x >> 8), static_cast<std::uint8_t>(x)};
}
std::uint32_t read(const Bytes& b) {
    return (std::uint32_t{b[0]} << 24) | (std::uint32_t{b[1]} << 16)
         | (std::uint32_t{b[2]} << 8) | std::uint32_t{b[3]};
}
int checks = 0;
void check(bool b) { if (!b) throw std::runtime_error("check failed"); ++checks; }
int main(int argc, char** argv) {
    std::uint32_t x=17;
    if (argc == 2 && std::string(argv[1]) == "vectors") {
        for (int i=0;i<1000;++i) {
            x=x*1664525u+1013904223u;
            for (auto b : big(x)) std::cout << std::hex << std::setw(2) << std::setfill('0') << unsigned(b);
            std::cout << '\n';
        }
        return 0;
    }
    check(big(0x12345678u) == Bytes{0x12,0x34,0x56,0x78});
    const std::uint32_t marker=0x01020304u; Bytes native{};
    std::memcpy(native.data(), &marker, sizeof(marker));
    const bool little=native == Bytes{4,3,2,1}, large=native == Bytes{1,2,3,4};
    check(little || large); // This test environment supports a conventional byte order.
    for (int i=0;i<10000;++i) {
        x=x*1664525u+1013904223u;
        check(read(big(x)) == x);
        const std::uint32_t network=htonl(x); Bytes raw{};
        std::memcpy(raw.data(), &network, sizeof(network));
        check(raw == big(x)); check(ntohl(network) == x);
    }
    std::cout << "PASS " << checks << "; nativeOrder=" << (little ? "LITTLE_ENDIAN" : "BIG_ENDIAN") << '\n';
}

